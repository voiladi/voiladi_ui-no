"""Phone push notifications via Firebase Cloud Messaging (HTTP v1).

Credentials: FCM_SERVICE_ACCOUNT_JSON (the service-account JSON as a string) or FCM_SERVICE_ACCOUNT_FILE (path).
Without either the module is inert (send() just logs), so local/dev environments keep working.

We always send DATA messages: the Android shell (PushService) draws the notification itself so it can attach the
avatar and deep-link into the app. Delivery respects the user's per-type preferences (users.push_prefs) and drops
tokens FCM reports as UNREGISTERED.
"""
import asyncio
import json
import logging
import os
import time
from typing import Dict, List, Optional

import httpx

from core import db, now_iso

logger = logging.getLogger("push")
SCOPES = ["https://www.googleapis.com/auth/firebase.messaging"]

# kind -> preference key (users.push_prefs[key], default True)
PREF_OF = {"like": "likes", "superlike": "likes", "match": "likes", "tag": "likes", "request": "requests", "message": "messages", "verification": "verification", "test": None}
DEFAULT_PREFS = {"likes": True, "requests": True, "messages": True, "verification": True}

_creds = None
_project = None
_token_cache = {"token": None, "exp": 0.0}


def _load():
    global _creds, _project
    if _creds is not None:
        return _creds
    raw = os.environ.get("FCM_SERVICE_ACCOUNT_JSON")
    path = os.environ.get("FCM_SERVICE_ACCOUNT_FILE")
    info = None
    try:
        if raw:
            info = json.loads(raw)
        elif path and os.path.exists(path):
            with open(path) as f:
                info = json.load(f)
    except ValueError:
        logger.error("FCM service account JSON is not valid JSON")
    if not info:
        _creds = False
        return False
    from google.oauth2 import service_account
    _creds = service_account.Credentials.from_service_account_info(info, scopes=SCOPES)
    _project = info.get("project_id")
    logger.info("push: FCM enabled for project %s", _project)
    return _creds


def enabled() -> bool:
    return bool(_load())


def _access_token() -> str:
    if _token_cache["token"] and _token_cache["exp"] - time.time() > 120:
        return _token_cache["token"]
    from google.auth.transport.requests import Request
    creds = _load()
    creds.refresh(Request())
    _token_cache["token"] = creds.token
    _token_cache["exp"] = creds.expiry.timestamp() if creds.expiry else time.time() + 3000
    return creds.token


def prefs_of(user: dict) -> Dict[str, bool]:
    p = dict(DEFAULT_PREFS)
    p.update({k: bool(v) for k, v in (user.get("push_prefs") or {}).items() if k in DEFAULT_PREFS})
    return p


async def _tokens(user_id: str) -> List[str]:
    rows = await db.push_tokens.find({"user_id": user_id}, {"_id": 0, "token": 1}).to_list(20)
    return [r["token"] for r in rows]


async def _send_one(client: httpx.AsyncClient, token: str, data: Dict[str, str], collapse: Optional[str]) -> Optional[str]:
    """Returns None on success, 'unregistered' when the token is dead, or an error string."""
    android = {"priority": "high", "ttl": "86400s"}
    if collapse:
        android["collapse_key"] = collapse[:32]
    body = {"message": {"token": token, "data": data, "android": android}}
    try:
        r = await client.post(f"https://fcm.googleapis.com/v1/projects/{_project}/messages:send",
                              headers={"Authorization": f"Bearer {await asyncio.to_thread(_access_token)}"}, json=body)
    except httpx.HTTPError as e:
        return f"network: {e}"
    if r.status_code < 300:
        return None
    text = r.text
    if r.status_code == 404 or "UNREGISTERED" in text or (r.status_code == 400 and "not a valid FCM registration token" in text):
        return "unregistered"
    return f"{r.status_code}: {text[:200]}"


async def send(user_id: str, kind: str, title: str, body: str, path: str = "/notifications", photo: Optional[str] = None,
               tag: Optional[str] = None, user: Optional[dict] = None, extra: Optional[Dict[str, str]] = None) -> int:
    """Push one notification to every device of user_id. Returns the number of successful deliveries."""
    if not enabled():
        return 0
    if user is None:
        user = await db.users.find_one({"id": user_id}, {"_id": 0, "push_prefs": 1})
    pref = PREF_OF.get(kind, "likes")
    if pref and not prefs_of(user or {}).get(pref, True):
        return 0
    tokens = await _tokens(user_id)
    if not tokens:
        return 0
    data = {"kind": kind, "title": title[:120], "body": body[:400], "path": path or "/notifications", "sent_at": now_iso()}
    if photo:
        data["photo"] = photo
    if tag:
        data["tag"] = tag
    for k, v in (extra or {}).items():
        if v is not None:
            data[k] = str(v)[:200]
    ok = 0
    async with httpx.AsyncClient(timeout=15) as client:
        for t in tokens:
            err = await _send_one(client, t, data, tag)
            if err is None:
                ok += 1
            elif err == "unregistered":
                await db.push_tokens.delete_one({"token": t})
                logger.info("push: dropped dead token for %s", user_id)
            else:
                logger.warning("push: %s -> %s", user_id, err)
    return ok


def fire(user_id: str, kind: str, title: str, body: str, **kw) -> None:
    """Fire-and-forget from request handlers: never block or fail the API call because of a push."""
    if not enabled():
        return

    async def _run():
        try:
            await send(user_id, kind, title, body, **kw)
        except Exception:  # noqa: BLE001
            logger.exception("push failed")

    try:
        asyncio.get_running_loop().create_task(_run())
    except RuntimeError:
        pass


def first_name(user: dict) -> str:
    return ((user or {}).get("name") or "Someone").split(" ")[0]


def photo_of(user: dict) -> Optional[str]:
    return ((user or {}).get("photos") or [None])[0]


async def ensure_indexes():
    await db.push_tokens.create_index("token", unique=True)
    await db.push_tokens.create_index("user_id")
