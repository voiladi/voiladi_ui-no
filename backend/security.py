"""
Server hardening that sits in front of every route:

  * RateLimitMiddleware  - sliding-window limits per client IP, tuned per endpoint family (login/OTP tight, chat looser).
                           Behind Cloudflare the real client IP is CF-Connecting-IP.
  * SecurityHeadersMiddleware - HSTS, nosniff, frame denial, referrer/permissions policy, no-store for API JSON.
  * BodySizeMiddleware   - reject oversized request bodies before they are read.
  * login lockout helpers - per-account failed-attempt counter with a cooling-off period (see routes_auth).

Everything is in-process (single API instance) and dependency-free.
"""
import os
import re
import time
import hmac
import logging
from collections import deque
from typing import Deque, Dict, List, Optional, Tuple

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

logger = logging.getLogger("voiladi.security")

# ---------------------------------------------------------------- client ip

def client_ip(request: Request) -> str:
    h = request.headers
    ip = h.get("cf-connecting-ip") or (h.get("x-forwarded-for") or "").split(",")[0].strip() or (request.client.host if request.client else "")
    return ip or "unknown"


# ---------------------------------------------------------------- rate limits

# (name, method or None, path regex, max requests, window seconds)
RULES: List[Tuple[str, Optional[str], re.Pattern, int, int]] = [
    ("login",       "POST",   re.compile(r"^/api/auth/(login|register)$"),          12,  60),
    ("otp_request", "POST",   re.compile(r"^/api/auth/request-otp$"),                6,  600),
    ("otp_verify",  "POST",   re.compile(r"^/api/auth/verify-phone$"),              15,  600),
    ("acct_change", None,     re.compile(r"^/api/auth/(email|account|password)$"),   10,  600),
    ("dm_start",    "POST",   re.compile(r"^/api/dm/[^/]+$"),                       30, 3600),
    ("send_msg",    "POST",   re.compile(r"^/api/matches/[^/]+/messages$"),          60,  60),
    ("report",      "POST",   re.compile(r"^/api/users/[^/]+/report$"),              10, 3600),
    ("upload",      "POST",   re.compile(r"^/api/(profile/photos|verification/selfie)$"), 30, 3600),
    ("search",      "GET",    re.compile(r"^/api/explore/search"),                   90,  60),
    ("admin",       None,     re.compile(r"^/api/admin/"),                          120,  60),
    ("api",         None,     re.compile(r"^/api/"),                                600,  60),
]


class _Window:
    __slots__ = ("hits",)

    def __init__(self):
        self.hits: Deque[float] = deque()


class RateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, rules=RULES, enabled: bool = True):
        super().__init__(app)
        self.rules = rules
        self.enabled = enabled
        self.buckets: Dict[str, _Window] = {}
        self._last_sweep = time.monotonic()

    def _sweep(self, now: float):
        # forget idle buckets so memory stays flat
        if now - self._last_sweep < 300:
            return
        self._last_sweep = now
        for k in [k for k, w in self.buckets.items() if not w.hits or now - w.hits[-1] > 3600]:
            self.buckets.pop(k, None)

    def _check(self, name: str, ip: str, limit: int, window: int, now: float) -> Optional[int]:
        w = self.buckets.setdefault(f"{name}:{ip}", _Window())
        cutoff = now - window
        while w.hits and w.hits[0] < cutoff:
            w.hits.popleft()
        if len(w.hits) >= limit:
            return int(w.hits[0] + window - now) + 1
        w.hits.append(now)
        return None

    async def dispatch(self, request: Request, call_next):
        if not self.enabled or request.method == "OPTIONS" or request.url.path in ("/api/health", "/api/"):
            return await call_next(request)
        path = request.url.path
        ip = client_ip(request)
        now = time.monotonic()
        self._sweep(now)
        matched_specific = False
        for name, method, rx, limit, window in self.rules:
            if method and request.method != method:
                continue
            if not rx.search(path):
                continue
            if name != "api":
                matched_specific = True
            elif matched_specific:
                # the generic bucket still counts, but a specific rule already matched - keep counting both
                pass
            retry = self._check(name, ip, limit, window, now)
            if retry is not None:
                logger.warning("rate limited %s %s ip=%s rule=%s", request.method, path, ip, name)
                return JSONResponse(
                    {"detail": "Too many requests. Please wait a moment and try again."},
                    status_code=429,
                    headers={"Retry-After": str(retry), "Cache-Control": "no-store"},
                )
        return await call_next(request)


# ---------------------------------------------------------------- headers

class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        resp = await call_next(request)
        h = resp.headers
        h.setdefault("X-Content-Type-Options", "nosniff")
        h.setdefault("X-Frame-Options", "DENY")
        h.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
        h.setdefault("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()")
        h.setdefault("Cross-Origin-Resource-Policy", "cross-origin")  # photos are embedded by the web origin
        h.setdefault("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload")
        if request.url.path.startswith("/api/uploads/"):
            h.setdefault("Content-Security-Policy", "default-src 'none'; sandbox")
        else:
            h.setdefault("Cache-Control", "no-store")
            h.setdefault("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'")
        return resp


# ---------------------------------------------------------------- body size

MAX_BODY = int(os.environ.get("MAX_BODY_BYTES", str(12 * 1024 * 1024)))  # photos are capped at 8MB by the upload route


class BodySizeMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        cl = request.headers.get("content-length")
        if cl and cl.isdigit() and int(cl) > MAX_BODY:
            return JSONResponse({"detail": "That file is too large"}, status_code=413)
        return await call_next(request)


# ---------------------------------------------------------------- helpers

def secret_equals(a: Optional[str], b: Optional[str]) -> bool:
    """Constant-time comparison for API keys."""
    if not a or not b:
        return False
    return hmac.compare_digest(a.encode(), b.encode())


# per-account login lockout (stored on the user document)
LOCK_AFTER = 8          # failed attempts ...
LOCK_WINDOW_SEC = 900   # ... within 15 minutes ...
LOCK_FOR_SEC = 900      # ... locks the account for 15 minutes


def lock_remaining(user: dict, now_ts: float) -> int:
    until = (user.get("login_lock") or {}).get("until", 0) or 0
    return max(0, int(until - now_ts))
