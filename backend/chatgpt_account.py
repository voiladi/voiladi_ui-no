"""
Sign in with your ChatGPT account (Codex OAuth, device-code flow).

The user signs in on OpenAI's own page (auth.openai.com/codex/device) and types a short code; we never see the
password. We receive OAuth tokens for the ChatGPT account and call the Codex backend (chatgpt.com/backend-api/codex)
so the answers are paid for by the user's own ChatGPT Plus / Pro plan.

Honest note (also in the PRD): this is the same public client the Codex CLI uses. OpenAI has not published it as a
third-party API; tools like OpenClaw / opencode / pi use it today and OpenAI tolerates it, but it is not guaranteed.
"""
import base64
import json
import os
import re
import time
from typing import Optional, List, Tuple

import httpx
from fastapi import HTTPException

from core import logger

CLIENT_ID = "app_EMoamEEZ73f0CkXaXp7hrann"
AUTH_BASE = "https://auth.openai.com"
DEVICE_USERCODE_URL = f"{AUTH_BASE}/api/accounts/deviceauth/usercode"
DEVICE_TOKEN_URL = f"{AUTH_BASE}/api/accounts/deviceauth/token"
DEVICE_VERIFY_URL = f"{AUTH_BASE}/codex/device"
DEVICE_REDIRECT_URI = f"{AUTH_BASE}/deviceauth/callback"
TOKEN_URL = f"{AUTH_BASE}/oauth/token"
CODEX_BASE = "https://chatgpt.com/backend-api"
DEVICE_TIMEOUT_S = 15 * 60
ORIGINATOR = os.environ.get("CODEX_ORIGINATOR", "voiladi")
USER_AGENT = os.environ.get("CODEX_USER_AGENT", "voiladi/1.0 (web)")
FALLBACK_MODELS = ["gpt-5.5", "gpt-5.4", "gpt-5.4-mini"]


def _jwt_payload(token: str) -> dict:
    try:
        part = token.split(".")[1]
        part += "=" * (-len(part) % 4)
        return json.loads(base64.urlsafe_b64decode(part.encode("ascii")).decode("utf-8"))
    except Exception:
        return {}


def account_from_tokens(tokens: dict) -> dict:
    """{account_id, email, plan} read from the access / id token claims."""
    acc = _jwt_payload(tokens.get("access_token") or "")
    idt = _jwt_payload(tokens.get("id_token") or "")
    auth = acc.get("https://api.openai.com/auth") or idt.get("https://api.openai.com/auth") or {}
    prof = acc.get("https://api.openai.com/profile") or idt.get("https://api.openai.com/profile") or {}
    return {
        "account_id": auth.get("chatgpt_account_id") or "",
        "email": prof.get("email") or idt.get("email") or "",
        "plan": (auth.get("chatgpt_plan_type") or "").lower(),
    }


def plan_label(plan: str) -> str:
    return {"plus": "ChatGPT Plus", "pro": "ChatGPT Pro", "team": "ChatGPT Team", "business": "ChatGPT Business",
            "enterprise": "ChatGPT Enterprise", "edu": "ChatGPT Edu", "free": "ChatGPT Free", "go": "ChatGPT Go"}.get(plan or "", "ChatGPT")


# ---------------------------------------------------------------- device-code login
async def start_device_login() -> dict:
    async with httpx.AsyncClient(timeout=httpx.Timeout(20.0, connect=8.0)) as c:
        try:
            r = await c.post(DEVICE_USERCODE_URL, json={"client_id": CLIENT_ID}, headers={"User-Agent": USER_AGENT})
        except httpx.HTTPError:
            raise HTTPException(status_code=502, detail="Couldn't reach OpenAI. Check your connection and try again")
    if r.is_error:
        logger.warning("chatgpt device usercode %s %s", r.status_code, r.text[:200])
        raise HTTPException(status_code=502, detail="ChatGPT sign-in isn't available right now. Try again in a minute")
    d = r.json()
    interval = d.get("interval")
    try:
        interval = float(interval)
    except (TypeError, ValueError):
        interval = 5.0
    if not d.get("device_auth_id") or not d.get("user_code"):
        raise HTTPException(status_code=502, detail="ChatGPT sign-in returned an unexpected answer. Try again")
    return {"device_auth_id": d["device_auth_id"], "user_code": d["user_code"], "interval": max(2.0, min(interval, 15.0)), "verify_url": DEVICE_VERIFY_URL}


async def poll_device_login(device_auth_id: str, user_code: str) -> Tuple[str, Optional[dict]]:
    """('pending'|'done'|'denied', tokens)"""
    async with httpx.AsyncClient(timeout=httpx.Timeout(20.0, connect=8.0)) as c:
        try:
            r = await c.post(DEVICE_TOKEN_URL, json={"device_auth_id": device_auth_id, "user_code": user_code}, headers={"User-Agent": USER_AGENT})
        except httpx.HTTPError:
            return "pending", None
        if r.status_code in (403, 404):
            return "pending", None
        if r.is_error:
            code = ""
            try:
                err = r.json().get("error")
                code = err.get("code") if isinstance(err, dict) else (err or "")
            except ValueError:
                pass
            if code in ("deviceauth_authorization_pending", "slow_down", "authorization_pending"):
                return "pending", None
            logger.warning("chatgpt device poll %s %s", r.status_code, r.text[:200])
            return "denied", None
        d = r.json()
        if not d.get("authorization_code") or not d.get("code_verifier"):
            return "denied", None
        try:
            t = await c.post(TOKEN_URL, data={
                "grant_type": "authorization_code", "client_id": CLIENT_ID, "code": d["authorization_code"],
                "code_verifier": d["code_verifier"], "redirect_uri": DEVICE_REDIRECT_URI,
            }, headers={"Content-Type": "application/x-www-form-urlencoded", "User-Agent": USER_AGENT})
        except httpx.HTTPError:
            return "denied", None
    if t.is_error:
        logger.warning("chatgpt token exchange %s %s", t.status_code, t.text[:200])
        return "denied", None
    tokens = t.json()
    if not tokens.get("access_token") or not tokens.get("refresh_token"):
        return "denied", None
    return "done", _pack(tokens)


def _pack(tokens: dict) -> dict:
    return {
        "access_token": tokens["access_token"], "refresh_token": tokens["refresh_token"], "id_token": tokens.get("id_token") or "",
        "expires_at": time.time() + float(tokens.get("expires_in") or 3600),
    }


async def refresh_tokens(creds: dict) -> dict:
    async with httpx.AsyncClient(timeout=httpx.Timeout(20.0, connect=8.0)) as c:
        try:
            r = await c.post(TOKEN_URL, data={"grant_type": "refresh_token", "refresh_token": creds["refresh_token"], "client_id": CLIENT_ID},
                             headers={"Content-Type": "application/x-www-form-urlencoded", "User-Agent": USER_AGENT})
        except httpx.HTTPError:
            raise HTTPException(status_code=502, detail="Couldn't reach OpenAI. Try again")
    if r.is_error:
        logger.warning("chatgpt refresh %s %s", r.status_code, r.text[:200])
        raise HTTPException(status_code=409, detail="Your ChatGPT sign-in expired. Connect it again in Settings")
    tokens = r.json()
    if not tokens.get("access_token"):
        raise HTTPException(status_code=409, detail="Your ChatGPT sign-in expired. Connect it again in Settings")
    tokens.setdefault("refresh_token", creds["refresh_token"])
    packed = _pack(tokens)
    if not packed.get("id_token"):
        packed["id_token"] = creds.get("id_token") or ""
    return packed


def needs_refresh(creds: dict) -> bool:
    return float(creds.get("expires_at") or 0) - time.time() < 300


# ---------------------------------------------------------------- codex backend
def _headers(creds: dict, account_id: str) -> dict:
    return {
        "Authorization": f"Bearer {creds['access_token']}", "chatgpt-account-id": account_id,
        "originator": ORIGINATOR, "User-Agent": USER_AGENT,
    }


async def list_models(creds: dict, account_id: str) -> List[str]:
    """The Codex catalog for this account, best first (its own priority). Falls back to a known list."""
    async with httpx.AsyncClient(timeout=httpx.Timeout(15.0, connect=8.0)) as c:
        try:
            r = await c.get(f"{CODEX_BASE}/codex/models?client_version=1.0.0", headers=_headers(creds, account_id))
        except httpx.HTTPError:
            return list(FALLBACK_MODELS)
    if r.is_error:
        return list(FALLBACK_MODELS)
    try:
        rows = (r.json() or {}).get("models") or []
    except ValueError:
        return list(FALLBACK_MODELS)
    ranked = []
    for m in rows:
        if not isinstance(m, dict):
            continue
        slug = (m.get("slug") or "").strip()
        if not slug or (m.get("visibility") or "").lower() in ("hide", "hidden"):
            continue
        pr = m.get("priority")
        ranked.append((int(pr) if isinstance(pr, (int, float)) else 10_000, slug))
    ranked.sort()
    out = []
    for _, s in ranked:
        if s not in out:
            out.append(s)
    return out[:16] or list(FALLBACK_MODELS)


def _friendly_codex_error(status: int, body: Optional[dict]) -> str:
    err = (body or {}).get("error") if isinstance(body, dict) else None
    code = ""
    msg = ""
    if isinstance(err, dict):
        code = str(err.get("code") or err.get("type") or "")
        msg = str(err.get("message") or "")
        if re.search(r"usage_limit_reached|usage_not_included|rate_limit_exceeded", code, re.I) or status == 429:
            mins = None
            if err.get("resets_at"):
                try:
                    mins = max(0, round((float(err["resets_at"]) - time.time()) / 60))
                except (TypeError, ValueError):
                    mins = None
            when = f" Try again in about {mins} min." if mins is not None else ""
            return f"You've hit your ChatGPT usage limit.{when}"
    if status in (401, 403):
        return "Your ChatGPT sign-in expired. Connect it again in Settings"
    if status == 400 and "model" in msg.lower():
        return "That model isn't available on your ChatGPT plan. Pick another one in Settings"
    if status >= 500:
        return "ChatGPT is having trouble right now. Try again shortly"
    return msg[:160] if msg else f"ChatGPT returned an error ({status})"


async def codex_answer(creds: dict, account_id: str, model: str, system: str, turns: List[dict], image_b64: Optional[str]) -> str:
    """One turn against the Codex Responses endpoint. Returns the whole assistant text."""
    parts: List[str] = []
    async for delta in codex_stream(creds, account_id, model, system, turns, image_b64):
        parts.append(delta)
    return "".join(parts).strip()


async def codex_stream(creds: dict, account_id: str, model: str, system: str, turns: List[dict], image_b64: Optional[str]):
    """One turn against the Codex Responses endpoint (SSE), yielding text deltas as they arrive."""
    inputs = []
    first = True
    for t in turns:
        if t["role"] == "user":
            content = [{"type": "input_text", "text": t["text"]}]
            if first and image_b64:
                content.append({"type": "input_image", "image_url": f"data:image/jpeg;base64,{image_b64}", "detail": "auto"})
            first = False
            inputs.append({"role": "user", "content": content})
        else:
            inputs.append({"role": "assistant", "content": [{"type": "output_text", "text": t["text"]}]})
    body = {
        "model": model, "store": False, "stream": True, "instructions": system, "input": inputs,
        "text": {"verbosity": "low"}, "include": ["reasoning.encrypted_content"],
        "reasoning": {"effort": "low", "summary": "auto"},
    }
    headers = {**_headers(creds, account_id), "OpenAI-Beta": "responses=experimental", "accept": "text/event-stream", "content-type": "application/json"}
    streamed = False
    final_text = ""
    async with httpx.AsyncClient(timeout=httpx.Timeout(120.0, connect=10.0)) as c:
        try:
            async with c.stream("POST", f"{CODEX_BASE}/codex/responses", headers=headers, json=body) as r:
                if r.is_error:
                    raw = await r.aread()
                    try:
                        parsed = json.loads(raw.decode("utf-8", "ignore"))
                    except ValueError:
                        parsed = None
                    logger.warning("codex responses %s %s", r.status_code, raw[:300])
                    raise HTTPException(status_code=400, detail=_friendly_codex_error(r.status_code, parsed))
                async for line in r.aiter_lines():
                    if not line.startswith("data:"):
                        continue
                    data = line[5:].strip()
                    if not data or data == "[DONE]":
                        continue
                    try:
                        ev = json.loads(data)
                    except ValueError:
                        continue
                    et = ev.get("type") or ""
                    if et == "response.output_text.delta":
                        delta = ev.get("delta") or ""
                        if delta:
                            streamed = True
                            yield delta
                    elif et == "response.output_text.done" and not streamed:
                        final_text = ev.get("text") or final_text
                    elif et == "response.completed":
                        resp = ev.get("response") or {}
                        for item in resp.get("output") or []:
                            if item.get("type") == "message":
                                for part in item.get("content") or []:
                                    if part.get("type") == "output_text" and part.get("text"):
                                        final_text = final_text or part["text"]
                    elif et in ("response.failed", "error"):
                        err = (ev.get("response") or {}).get("error") or ev.get("error") or {}
                        raise HTTPException(status_code=400, detail=_friendly_codex_error(400, {"error": err}))
        except httpx.HTTPError:
            raise HTTPException(status_code=502, detail="Couldn't reach ChatGPT. Try again")
    if not streamed and final_text:
        yield final_text
