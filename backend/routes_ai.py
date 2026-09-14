"""
Connect your AI + orb visual search.

A user links their OWN ChatGPT (OpenAI), Claude (Anthropic) or Gemini (Google) account by pasting the API key
from that account. The key is verified live against the provider, encrypted (Fernet) and stored server-side;
the client only ever sees a last-4 hint. The orb's ink stroke sends a cropped screenshot (+ the text under it)
to the user's linked model, and the reply is paired with matching people / posts / communities inside Voiladi.

Collection ai_links: id, user_id, provider, ciphertext, hint, model, models[], active, created_at, updated_at
"""
import base64
import binascii
import hashlib
import json
import os
import re
import time
import uuid
from typing import Optional, List, Dict, Any, Tuple

import httpx
from cryptography.fernet import Fernet, InvalidToken
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from core import db, now_iso, get_current_user, public_profile, JWT_SECRET, logger
from content import INTERESTS, TOPIC_COVERS
import chatgpt_account as cg

router = APIRouter(prefix="/api/ai", tags=["ai"])

# "chatgpt" = sign in with the ChatGPT account (their Plus/Pro pays) - the only provider shown in the app right now.
# The three key-based providers stay available server-side (hidden in the UI until there's a sign-in for them too).
PROVIDERS = {
    "chatgpt": {"name": "ChatGPT", "company": "OpenAI", "auth": "account", "visible": True},
    "openai": {"name": "ChatGPT (API key)", "company": "OpenAI", "auth": "key", "visible": False, "keys_url": "https://platform.openai.com/api-keys", "prefix": "sk-"},
    "anthropic": {"name": "Claude", "company": "Anthropic", "auth": "key", "visible": False, "keys_url": "https://platform.claude.com/settings/keys", "prefix": "sk-ant-"},
    "gemini": {"name": "Gemini", "company": "Google", "auth": "key", "visible": False, "keys_url": "https://aistudio.google.com/api-keys", "prefix": "AIza"},
}
ANTHROPIC_VERSION = "2023-06-01"
MAX_IMAGE_BYTES = 6 * 1024 * 1024
HISTORY_MAX = 12


# ---------------------------------------------------------------- crypto
def _fernet() -> Fernet:
    secret = os.environ.get("AI_KEY_SECRET") or JWT_SECRET
    return Fernet(base64.urlsafe_b64encode(hashlib.sha256(secret.encode("utf-8")).digest()))


def _encrypt(key: str) -> str:
    return _fernet().encrypt(key.encode("utf-8")).decode("ascii")


def _decrypt(token: str) -> str:
    try:
        return _fernet().decrypt(token.encode("ascii")).decode("utf-8")
    except (InvalidToken, ValueError):
        raise HTTPException(status_code=409, detail="Reconnect your AI account")


def _hint(key: str) -> str:
    return "…" + key[-4:] if len(key) >= 8 else "…"


# ---------------------------------------------------------------- provider adapters
def _sanitize_error(status: int, body: Any, provider: str) -> str:
    name = PROVIDERS[provider]["name"]
    if status in (401, 403):
        return f"{name} didn't accept this key. Check it and try again"
    if status == 402:
        return f"Your {PROVIDERS[provider]['company']} account has no credit. Add billing there and try again"
    if status == 429:
        text = json.dumps(body).lower() if body is not None else ""
        if "quota" in text or "billing" in text or "credit" in text:
            return f"Your {PROVIDERS[provider]['company']} account is out of credit or quota"
        return f"{name} is rate-limiting you. Try again in a moment"
    if status == 400 and provider == "gemini":
        text = json.dumps(body).lower() if body is not None else ""
        if "api_key" in text or "api key" in text:
            return "Google didn't accept this key. Check it and try again"
    if status >= 500:
        return f"{name} is having trouble right now. Try again shortly"
    return f"{name} returned an error ({status})"


def _openai_rank(mid: str):
    """Newest general GPT first, then mini, then nano. Non-chat models are dropped."""
    bad = ("realtime", "audio", "tts", "transcribe", "whisper", "embedding", "image", "dall-e", "search", "moderation", "codex", "computer", "instruct", "babbage", "davinci", "-pro")
    if not mid.startswith(("gpt-", "o", "chatgpt-")) or any(b in mid for b in bad):
        return None
    m = re.match(r"^gpt-(\d+(?:\.\d+)?)(.*)$", mid)
    if not m:
        return (1, 0.0, 9, mid)
    ver = float(m.group(1))
    rest = m.group(2)
    if re.search(r"-\d{4}-\d{2}-\d{2}$", rest) or "preview" in rest:
        return None  # dated snapshots / previews: the alias is enough
    variant = 0 if rest in ("", "-chat-latest") else 1 if "mini" in rest else 2 if "nano" in rest else 3
    return (0, -ver, variant, mid)


def _anthropic_rank(mid: str):
    fam = 0 if "sonnet" in mid else 1 if "opus" in mid else 2 if "haiku" in mid else 3
    m = re.search(r"-(\d+)(?:-(\d+))?", mid)
    ver = float(f"{m.group(1)}.{m.group(2) or 0}") if m else 0.0
    return (fam, -ver, mid)


def _gemini_rank(mid: str, meta: dict):
    methods = meta.get("supportedGenerationMethods") or []
    if methods and "generateContent" not in methods:
        return None
    low = mid.lower()
    if any(b in low for b in ("embedding", "aqa", "imagen", "veo", "tts", "audio", "live", "image-generation", "robotics", "computer-use", "learnlm", "gemma")):
        return None
    m = re.search(r"gemini-(\d+(?:\.\d+)?)", low)
    ver = float(m.group(1)) if m else 0.0
    variant = 0 if ("flash" in low and "lite" not in low) else 1 if "pro" in low else 2
    exp = 1 if ("exp" in low or "preview" in low) else 0
    return (exp, -ver, variant, mid)


async def provider_models(provider: str, key: str) -> List[str]:
    """Verify the key and return the model ids the account can use, best default first."""
    timeout = httpx.Timeout(20.0, connect=8.0)
    async with httpx.AsyncClient(timeout=timeout) as client:
        try:
            if provider == "openai":
                r = await client.get("https://api.openai.com/v1/models", headers={"Authorization": f"Bearer {key}"})
            elif provider == "anthropic":
                r = await client.get("https://api.anthropic.com/v1/models?limit=100", headers={"x-api-key": key, "anthropic-version": ANTHROPIC_VERSION})
            else:
                r = await client.get("https://generativelanguage.googleapis.com/v1beta/models?pageSize=200", headers={"x-goog-api-key": key})
        except httpx.HTTPError:
            raise HTTPException(status_code=502, detail=f"Couldn't reach {PROVIDERS[provider]['company']}. Check your connection and try again")
    if r.is_error:
        try:
            body = r.json()
        except ValueError:
            body = None
        raise HTTPException(status_code=400, detail=_sanitize_error(r.status_code, body, provider))
    data = r.json()
    ranked = []
    if provider == "openai":
        for m in data.get("data") or []:
            rk = _openai_rank(m.get("id") or "")
            if rk:
                ranked.append((rk, m["id"]))
    elif provider == "anthropic":
        for m in data.get("data") or []:
            mid = m.get("id") or ""
            if mid:
                ranked.append((_anthropic_rank(mid), mid))
    else:
        for m in data.get("models") or []:
            mid = (m.get("name") or "").split("/")[-1]
            rk = _gemini_rank(mid, m)
            if mid and rk:
                ranked.append((rk, mid))
    ranked.sort(key=lambda t: t[0])
    models = [mid for _, mid in ranked]
    if not models:
        raise HTTPException(status_code=400, detail=f"This {PROVIDERS[provider]['company']} account has no usable models")
    return models[:24]


async def provider_answer(provider: str, key: str, model: str, system: str, turns: List[dict], image_b64: Optional[str]) -> str:
    """One vision-capable chat completion. `turns` = [{role: user|assistant, text}], image attaches to the FIRST user turn."""
    timeout = httpx.Timeout(90.0, connect=10.0)
    async with httpx.AsyncClient(timeout=timeout) as client:
        try:
            if provider == "openai":
                msgs = [{"role": "system", "content": system}]
                first = True
                for t in turns:
                    if t["role"] == "user" and first and image_b64:
                        msgs.append({"role": "user", "content": [
                            {"type": "text", "text": t["text"]},
                            {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{image_b64}", "detail": "auto"}},
                        ]})
                        first = False
                    else:
                        msgs.append({"role": t["role"], "content": t["text"]})
                r = await client.post("https://api.openai.com/v1/chat/completions", headers={"Authorization": f"Bearer {key}"},
                                      json={"model": model, "max_completion_tokens": 700, "messages": msgs})
                if r.is_error and r.status_code == 400 and "max_completion_tokens" in r.text:
                    body = {"model": model, "max_tokens": 700, "messages": msgs}
                    r = await client.post("https://api.openai.com/v1/chat/completions", headers={"Authorization": f"Bearer {key}"}, json=body)
                if r.is_error:
                    raise _upstream(r, provider)
                return (r.json()["choices"][0]["message"]["content"] or "").strip()

            if provider == "anthropic":
                msgs = []
                first = True
                for t in turns:
                    if t["role"] == "user" and first and image_b64:
                        msgs.append({"role": "user", "content": [
                            {"type": "image", "source": {"type": "base64", "media_type": "image/jpeg", "data": image_b64}},
                            {"type": "text", "text": t["text"]},
                        ]})
                        first = False
                    else:
                        msgs.append({"role": t["role"], "content": t["text"]})
                r = await client.post("https://api.anthropic.com/v1/messages", headers={"x-api-key": key, "anthropic-version": ANTHROPIC_VERSION},
                                      json={"model": model, "max_tokens": 700, "system": system, "messages": msgs})
                if r.is_error:
                    raise _upstream(r, provider)
                return "".join(x.get("text", "") for x in r.json().get("content", []) if x.get("type") == "text").strip()

            contents = []
            first = True
            for t in turns:
                parts = []
                if t["role"] == "user" and first and image_b64:
                    parts.append({"inline_data": {"mime_type": "image/jpeg", "data": image_b64}})
                    first = False
                parts.append({"text": t["text"]})
                contents.append({"role": "user" if t["role"] == "user" else "model", "parts": parts})
            r = await client.post(f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent", headers={"x-goog-api-key": key},
                                  json={"system_instruction": {"parts": [{"text": system}]}, "contents": contents,
                                        "generationConfig": {"maxOutputTokens": 700, "temperature": 0.4}})
            if r.is_error:
                raise _upstream(r, provider)
            cands = r.json().get("candidates") or []
            parts = (cands[0].get("content") or {}).get("parts") if cands else []
            return "".join(p.get("text", "") for p in (parts or [])).strip()
        except httpx.HTTPError:
            raise HTTPException(status_code=502, detail=f"Couldn't reach {PROVIDERS[provider]['company']}. Try again")


def _upstream(r: httpx.Response, provider: str) -> HTTPException:
    try:
        body = r.json()
    except ValueError:
        body = None
    logger.warning("ai upstream %s %s", provider, r.status_code)
    return HTTPException(status_code=400, detail=_sanitize_error(r.status_code, body, provider))


# ---------------------------------------------------------------- links
class LinkIn(BaseModel):
    provider: str
    api_key: str = Field(min_length=8, max_length=400)


class LinkUpdate(BaseModel):
    model: Optional[str] = None
    active: Optional[bool] = None


def _check_provider(p: str) -> str:
    if p not in PROVIDERS:
        raise HTTPException(status_code=404, detail="Unknown provider")
    return p


def _public_link(row: dict) -> dict:
    p = PROVIDERS[row["provider"]]
    return {
        "provider": row["provider"], "name": p["name"], "company": p["company"], "auth": p.get("auth", "key"), "hint": row.get("hint") or "",
        "email": row.get("email") or "", "plan": row.get("plan") or "", "plan_label": cg.plan_label(row.get("plan") or "") if row["provider"] == "chatgpt" else "",
        "model": row.get("model") or "", "models": row.get("models") or [], "active": bool(row.get("active")),
        "connected_at": row.get("created_at"),
    }


async def _links(uid: str) -> List[dict]:
    return await db.ai_links.find({"user_id": uid}, {"_id": 0}).sort("created_at", 1).to_list(None)


async def active_link(uid: str) -> Optional[dict]:
    rows = await _links(uid)
    if not rows:
        return None
    return next((r for r in rows if r.get("active")), rows[0])


@router.get("/providers")
async def providers():
    return {"providers": [{"id": k, **v} for k, v in PROVIDERS.items()]}


@router.get("/links")
async def list_links(user=Depends(get_current_user)):
    rows = await _links(user["id"])
    act = next((r for r in rows if r.get("active")), rows[0] if rows else None)
    return {"links": [_public_link(r) for r in rows], "active": act["provider"] if act else None,
            "providers": [{"id": k, **v} for k, v in PROVIDERS.items()]}


@router.post("/links", status_code=201)
async def connect(body: LinkIn, user=Depends(get_current_user)):
    provider = _check_provider(body.provider)
    if PROVIDERS[provider].get("auth") == "account":
        raise HTTPException(status_code=400, detail="Sign in with your ChatGPT account instead")
    key = body.api_key.strip()
    if not key or any(c.isspace() for c in key):
        raise HTTPException(status_code=400, detail="That doesn't look like a key. Paste the whole key")
    models = await provider_models(provider, key)
    existing = await db.ai_links.find_one({"user_id": user["id"], "provider": provider}, {"_id": 0})
    others = await db.ai_links.count_documents({"user_id": user["id"], "provider": {"$ne": provider}})
    model = existing.get("model") if existing and existing.get("model") in models else models[0]
    row = {
        "id": existing["id"] if existing else str(uuid.uuid4()),
        "user_id": user["id"], "provider": provider, "ciphertext": _encrypt(key), "hint": _hint(key),
        "model": model, "models": models, "active": bool(existing.get("active")) if existing else others == 0,
        "created_at": existing["created_at"] if existing else now_iso(), "updated_at": now_iso(),
    }
    await db.ai_links.update_one({"user_id": user["id"], "provider": provider}, {"$set": row}, upsert=True)
    return _public_link(row)


@router.put("/links/{provider}")
async def update_link(provider: str, body: LinkUpdate, user=Depends(get_current_user)):
    _check_provider(provider)
    row = await db.ai_links.find_one({"user_id": user["id"], "provider": provider}, {"_id": 0})
    if not row:
        raise HTTPException(status_code=404, detail="Not connected")
    upd = {"updated_at": now_iso()}
    if body.model is not None:
        if body.model not in (row.get("models") or []):
            raise HTTPException(status_code=400, detail="Pick one of your account's models")
        upd["model"] = body.model
    if body.active:
        await db.ai_links.update_many({"user_id": user["id"], "provider": {"$ne": provider}}, {"$set": {"active": False}})
        upd["active"] = True
    await db.ai_links.update_one({"user_id": user["id"], "provider": provider}, {"$set": upd})
    row.update(upd)
    return _public_link(row)


@router.delete("/links/{provider}")
async def disconnect(provider: str, user=Depends(get_current_user)):
    _check_provider(provider)
    row = await db.ai_links.find_one_and_delete({"user_id": user["id"], "provider": provider})
    if not row:
        raise HTTPException(status_code=404, detail="Not connected")
    if row.get("active"):
        nxt = await db.ai_links.find_one({"user_id": user["id"]}, {"_id": 0}, sort=[("created_at", 1)])
        if nxt:
            await db.ai_links.update_one({"id": nxt["id"]}, {"$set": {"active": True}})
    return {"ok": True}


# ---------------------------------------------------------------- sign in with ChatGPT (device code)
class DevicePollOut(BaseModel):
    status: str
    link: Optional[dict] = None


@router.post("/chatgpt/start", status_code=201)
async def chatgpt_start(user=Depends(get_current_user)):
    """Begin 'Sign in with ChatGPT': returns the short code the user types on OpenAI's page."""
    info = await cg.start_device_login()
    sid = str(uuid.uuid4())
    await db.ai_device_sessions.delete_many({"user_id": user["id"]})
    await db.ai_device_sessions.insert_one({
        "id": sid, "user_id": user["id"], "device_auth_id": info["device_auth_id"], "user_code": info["user_code"],
        "interval": info["interval"], "status": "pending", "created_at": now_iso(), "started": time.time(), "last_poll": 0.0,
    })
    return {"session_id": sid, "user_code": info["user_code"], "verify_url": info["verify_url"], "interval": info["interval"], "expires_in": cg.DEVICE_TIMEOUT_S}


async def _save_chatgpt_link(user_id: str, tokens: dict) -> dict:
    acct = cg.account_from_tokens(tokens)
    if not acct["account_id"]:
        raise HTTPException(status_code=502, detail="ChatGPT signed you in but didn't return an account. Try again")
    models = await cg.list_models(tokens, acct["account_id"])
    existing = await db.ai_links.find_one({"user_id": user_id, "provider": "chatgpt"}, {"_id": 0})
    others = await db.ai_links.count_documents({"user_id": user_id, "provider": {"$ne": "chatgpt"}})
    model = existing.get("model") if existing and existing.get("model") in models else models[0]
    row = {
        "id": existing["id"] if existing else str(uuid.uuid4()), "user_id": user_id, "provider": "chatgpt",
        "ciphertext": _encrypt(json.dumps(tokens)), "hint": acct["email"] or acct["account_id"][:8], "email": acct["email"], "plan": acct["plan"],
        "account_id": acct["account_id"], "model": model, "models": models,
        "active": bool(existing.get("active")) if existing else others == 0,
        "created_at": existing["created_at"] if existing else now_iso(), "updated_at": now_iso(),
    }
    if not existing:
        # a fresh ChatGPT sign-in becomes the orb's AI right away
        await db.ai_links.update_many({"user_id": user_id, "provider": {"$ne": "chatgpt"}}, {"$set": {"active": False}})
        row["active"] = True
    await db.ai_links.update_one({"user_id": user_id, "provider": "chatgpt"}, {"$set": row}, upsert=True)
    return row


@router.get("/chatgpt/poll/{session_id}", response_model=DevicePollOut)
async def chatgpt_poll(session_id: str, user=Depends(get_current_user)):
    """The app calls this every few seconds while the user signs in on OpenAI's page."""
    sess = await db.ai_device_sessions.find_one({"id": session_id, "user_id": user["id"]}, {"_id": 0})
    if not sess:
        return {"status": "expired"}
    if sess.get("status") == "connected":
        row = await db.ai_links.find_one({"user_id": user["id"], "provider": "chatgpt"}, {"_id": 0})
        return {"status": "connected", "link": _public_link(row) if row else None}
    if time.time() - float(sess.get("started") or 0) > cg.DEVICE_TIMEOUT_S:
        await db.ai_device_sessions.delete_one({"id": session_id})
        return {"status": "expired"}
    if time.time() - float(sess.get("last_poll") or 0) < float(sess.get("interval") or 5) - 0.5:
        return {"status": "pending"}
    await db.ai_device_sessions.update_one({"id": session_id}, {"$set": {"last_poll": time.time()}})
    state, tokens = await cg.poll_device_login(sess["device_auth_id"], sess["user_code"])
    if state == "pending":
        return {"status": "pending"}
    if state == "denied":
        await db.ai_device_sessions.delete_one({"id": session_id})
        return {"status": "denied"}
    row = await _save_chatgpt_link(user["id"], tokens)
    await db.ai_device_sessions.update_one({"id": session_id}, {"$set": {"status": "connected"}})
    return {"status": "connected", "link": _public_link(row)}


async def _chatgpt_creds(link: dict) -> Tuple[dict, str]:
    """Decrypt the stored tokens, refreshing (and re-saving) them when they're about to expire."""
    try:
        creds = json.loads(_decrypt(link["ciphertext"]))
    except ValueError:
        raise HTTPException(status_code=409, detail="Reconnect your ChatGPT account in Settings")
    if cg.needs_refresh(creds):
        creds = await cg.refresh_tokens(creds)
        await db.ai_links.update_one({"id": link["id"]}, {"$set": {"ciphertext": _encrypt(json.dumps(creds)), "updated_at": now_iso()}})
    return creds, link.get("account_id") or cg.account_from_tokens(creds)["account_id"]


# ---------------------------------------------------------------- orb lookup
class Turn(BaseModel):
    role: str
    text: str = Field(max_length=4000)


class LookupIn(BaseModel):
    image: Optional[str] = Field(default=None, max_length=9_000_000)  # data:image/jpeg;base64,... (the circled area, ink included)
    route: str = ""
    texts: List[str] = Field(default_factory=list)  # words visible under / around the stroke
    user_ids: List[str] = Field(default_factory=list)
    post_ids: List[str] = Field(default_factory=list)
    question: Optional[str] = Field(default=None, max_length=1000)
    history: List[Turn] = Field(default_factory=list)


SYSTEM = (
    "You are the visual search inside Voiladi, a social app (photo/video posts, profiles, chat, interest communities). "
    "The user circled part of their screen with a floating orb. The image is that area; the dark ink stroke is their marking - "
    "identify ONLY what is inside or under the stroke, ignore the rest and ignore the app's own buttons and chrome.\n"
    "Be fast, specific and confident, like Google Lens. Identify the exact thing: for a product give brand + product/model "
    "(and a typical price range if you know it); for clothing/shoes/accessories give brand, style and colour; for a person who is "
    "a well-known public figure give their name and what they're known for, otherwise describe them briefly and respectfully "
    "(never guess private people's identity or sensitive traits); for food name the dish and cuisine; for a place or landmark name "
    "it and where it is; for an animal, plant or car give species / make + model; for text read it out (translate if not English); "
    "for artwork or a screenshot of another app name it. If you're unsure, give your best guess and say what makes it likely.\n\n"
    "Reply in EXACTLY this shape, plain text, no markdown, no emojis:\n"
    "TITLE: <the specific name of the thing, 2-8 words>\n"
    "KIND: <one of: product, fashion, person, place, food, animal, plant, vehicle, text, art, app, other>\n"
    "<1-3 short sentences describing it and anything useful to know>\n"
    "TERMS: <2-6 short lowercase search terms, comma separated: the thing, its brand/category, related interests, any names or "
    "@usernames you can read - these find matching people, posts and communities inside Voiladi>\n\n"
    "For follow-up questions answer directly in 1-4 short sentences (no TITLE/KIND lines), keeping TERMS only if new things come up."
)
KINDS = ("product", "fashion", "person", "place", "food", "animal", "plant", "vehicle", "text", "art", "app", "other")


def _decode_image(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    if value.startswith("data:"):
        if "," not in value:
            raise HTTPException(status_code=400, detail="Bad image")
        value = value.split(",", 1)[1]
    try:
        raw = base64.b64decode(value, validate=True)
    except (binascii.Error, ValueError):
        raise HTTPException(status_code=400, detail="Bad image")
    if len(raw) > MAX_IMAGE_BYTES:
        raise HTTPException(status_code=413, detail="Image too large")
    if not raw.startswith(b"\xff\xd8\xff"):
        raise HTTPException(status_code=400, detail="Only JPEG screenshots are accepted")
    return base64.b64encode(raw).decode("ascii")


def _parse_answer(answer: str) -> Dict[str, Any]:
    """Pull TITLE / KIND / TERMS out of the model's reply; what's left is the description."""
    terms: List[str] = []
    title = ""
    kind = ""
    kept = []
    for ln in answer.strip().splitlines():
        s = ln.strip().strip("*").strip()
        m = re.match(r"^(title|kind|terms)\s*:\s*(.*)$", s, re.I)
        if not m:
            kept.append(ln)
            continue
        key, val = m.group(1).lower(), m.group(2).strip().strip("*\"' ")
        if key == "title" and not title:
            title = val[:80]
        elif key == "kind" and not kind:
            k = val.lower().strip(" .")
            kind = k if k in KINDS else "other"
        elif key == "terms":
            terms += [t.strip(" .#@\"'").lower() for t in val.split(",")]
    terms = [t for t in dict.fromkeys(terms) if 2 <= len(t) <= 40][:6]
    text = "\n".join(kept).strip()
    web = title or (terms[0] if terms else "")
    return {"title": title, "kind": kind, "answer": text, "terms": terms, "web_query": web}


def _split_terms(answer: str):
    p = _parse_answer(answer)
    return p["answer"], p["terms"]


async def _blocked(uid: str) -> set:
    rows = await db.blocks.find({"$or": [{"from_id": uid}, {"to_id": uid}]}, {"_id": 0}).to_list(None)
    out = set()
    for b in rows:
        out.add(b["from_id"])
        out.add(b["to_id"])
    out.discard(uid)
    return out


async def find_in_voiladi(user: dict, terms: List[str], user_ids: List[str], post_ids: List[str]) -> Dict[str, list]:
    """People / posts / communities matching the AI's terms (plus anything the stroke directly covered)."""
    uid = user["id"]
    hidden = await _blocked(uid)
    hidden.add(uid)
    rxs = [re.compile(re.escape(t), re.I) for t in terms if t]

    # communities
    topics = []
    for name in INTERESTS:
        if any(rx.search(name) for rx in rxs):
            n = await db.users.count_documents({"onboarded": True, "interests": name})
            topics.append({"name": name, "members": n, "cover": TOPIC_COVERS.get(name), "joined": name in (user.get("interests") or [])})
    topics = topics[:6]

    # people: directly circled first, then by name / username / interests / bio / job / city
    people_rows: List[dict] = []
    if user_ids:
        people_rows += await db.users.find({"id": {"$in": user_ids[:6], "$nin": list(hidden)}, "onboarded": True}, {"_id": 0}).to_list(None)
    if rxs:
        ors = []
        for rx in rxs:
            ors += [{"name": rx}, {"username": rx}, {"interests": rx}, {"bio": rx}, {"job": rx}, {"city": rx}]
        more = await db.users.find({"onboarded": True, "id": {"$nin": list(hidden) + [u["id"] for u in people_rows]}, "$or": ors}, {"_id": 0}).limit(40).to_list(None)

        def score(u):
            s = 0
            for rx in rxs:
                if rx.search(u.get("username") or "") or rx.search(u.get("name") or ""):
                    s += 3
                if any(rx.search(i) for i in (u.get("interests") or [])):
                    s += 2
                if rx.search(u.get("bio") or "") or rx.search(u.get("job") or "") or rx.search(u.get("city") or ""):
                    s += 1
            return -s

        more.sort(key=score)
        people_rows += more[:8]
    liked = set(s["to_id"] for s in await db.swipes.find({"from_id": uid, "to_id": {"$in": [u["id"] for u in people_rows]}, "action": {"$in": ["like", "superlike"]}}, {"_id": 0, "to_id": 1}).to_list(None))
    people = []
    for u in people_rows[:8]:
        p = public_profile(u, user)
        p["followed"] = u["id"] in liked
        people.append(p)

    # posts
    post_rows: List[dict] = []
    if post_ids:
        post_rows += await db.posts.find({"id": {"$in": post_ids[:4]}, "status": {"$ne": "processing"}}, {"_id": 0}).to_list(None)
    if rxs:
        ors = []
        for rx in rxs:
            ors += [{"caption": rx}, {"location": rx}]
        author_ids = [u["id"] for u in people_rows[:8]]
        if author_ids:
            ors.append({"user_id": {"$in": author_ids}})
        more = await db.posts.find({"$or": ors, "id": {"$nin": [p["id"] for p in post_rows]}, "user_id": {"$nin": list(hidden)}, "status": {"$nin": ["processing", "failed"]}},
                                   {"_id": 0}).sort("created_at", -1).limit(9).to_list(None)
        post_rows += more
    authors = {u["id"]: u for u in await db.users.find({"id": {"$in": list({p["user_id"] for p in post_rows})}}, {"_id": 0, "id": 1, "name": 1, "username": 1}).to_list(None)}
    posts = []
    for p in post_rows[:9]:
        a = authors.get(p["user_id"], {})
        posts.append({"id": p["id"], "image": p.get("image"), "kind": p.get("kind") or "image", "caption": p.get("caption") or "", "location": p.get("location") or "",
                      "likes": int(p.get("likes") or 0), "author": {"id": p["user_id"], "name": a.get("name") or "Someone", "username": a.get("username") or ""}})
    return {"people": people, "posts": posts, "topics": topics}


async def _prepare_lookup(body: LookupIn, user: dict) -> Dict[str, Any]:
    """Everything that can fail with a proper HTTP status happens here, before any bytes are streamed."""
    link = await active_link(user["id"])
    if not link:
        raise HTTPException(status_code=428, detail="Connect your AI in Settings first")
    image_b64 = _decode_image(body.image)
    if not image_b64 and not body.question:
        raise HTTPException(status_code=400, detail="Nothing to look at")
    key = None
    creds = account_id = None
    if link["provider"] == "chatgpt":
        creds, account_id = await _chatgpt_creds(link)
    else:
        key = _decrypt(link["ciphertext"])

    context_bits = []
    if body.route:
        context_bits.append(f"Screen: {body.route}")
    texts = [t.strip() for t in body.texts if t and t.strip()][:40]
    if texts:
        context_bits.append("Text visible under the marking: " + " | ".join(t[:120] for t in texts))
    context = ("\n".join(context_bits) + "\n\n") if context_bits else ""

    turns: List[dict] = []
    hist = [t for t in body.history if t.role in ("user", "assistant") and t.text.strip()][-HISTORY_MAX:]
    if hist:
        # first user turn carries the image + context; then the rest of the conversation
        first = hist[0]
        turns.append({"role": "user", "text": context + first.text if first.role == "user" else context + "What did I mark?"})
        for t in hist[1:] if first.role == "user" else hist:
            turns.append({"role": t.role, "text": t.text})
        if body.question:
            turns.append({"role": "user", "text": body.question})
    else:
        turns.append({"role": "user", "text": context + (body.question or "What did I mark? Identify it.")})
    if turns[-1]["role"] != "user":
        turns.append({"role": "user", "text": body.question or "Go on."})
    return {"link": link, "image_b64": image_b64, "key": key, "creds": creds, "account_id": account_id, "turns": turns}


async def _refresh_and_save(link: dict, creds: dict) -> dict:
    creds = await cg.refresh_tokens(creds)
    await db.ai_links.update_one({"id": link["id"]}, {"$set": {"ciphertext": _encrypt(json.dumps(creds)), "updated_at": now_iso()}})
    return creds


def _result(user: dict, link: dict, raw: str, found: Dict[str, list]) -> Dict[str, Any]:
    p = _parse_answer(raw)
    if not p["answer"] and not p["title"]:
        p["answer"] = "I couldn't make out what you marked. Try circling it a little larger."
    return {**p, "found": found, "provider": link["provider"], "model": link.get("model") or "", "provider_name": PROVIDERS[link["provider"]]["name"]}


@router.post("/lookup")
async def lookup(body: LookupIn, user=Depends(get_current_user)):
    prep = await _prepare_lookup(body, user)
    link, creds, account_id, turns, image_b64 = prep["link"], prep["creds"], prep["account_id"], prep["turns"], prep["image_b64"]
    model = link.get("model") or cg.FALLBACK_MODELS[0]
    if link["provider"] == "chatgpt":
        try:
            raw = await cg.codex_answer(creds, account_id, model, SYSTEM, turns, image_b64)
        except HTTPException as e:
            if "expired" not in str(e.detail):
                raise
            # the access token was rejected: refresh once and retry
            creds = await _refresh_and_save(link, creds)
            raw = await cg.codex_answer(creds, account_id, model, SYSTEM, turns, image_b64)
    else:
        raw = await provider_answer(link["provider"], prep["key"], link.get("model") or "", SYSTEM, turns, image_b64)
    p = _parse_answer(raw)
    found = await find_in_voiladi(user, p["terms"], body.user_ids, body.post_ids)
    return _result(user, link, raw, found)


@router.post("/lookup/stream")
async def lookup_stream(body: LookupIn, user=Depends(get_current_user)):
    """Same as /lookup but streams NDJSON: {type: delta, text} ... {type: done, ...full result} | {type: error, detail, status}.
    Words show up in the drawer as ChatGPT writes them instead of after the whole reply."""
    prep = await _prepare_lookup(body, user)
    link, creds, account_id, turns, image_b64 = prep["link"], prep["creds"], prep["account_id"], prep["turns"], prep["image_b64"]
    model = link.get("model") or cg.FALLBACK_MODELS[0]

    def line(obj: dict) -> bytes:
        return (json.dumps(obj, ensure_ascii=False) + "\n").encode("utf-8")

    async def gen():
        parts: List[str] = []
        try:
            if link["provider"] == "chatgpt":
                c = creds
                try:
                    async for delta in cg.codex_stream(c, account_id, model, SYSTEM, turns, image_b64):
                        parts.append(delta)
                        yield line({"type": "delta", "text": delta})
                except HTTPException as e:
                    if parts or "expired" not in str(e.detail):
                        raise
                    c = await _refresh_and_save(link, c)
                    async for delta in cg.codex_stream(c, account_id, model, SYSTEM, turns, image_b64):
                        parts.append(delta)
                        yield line({"type": "delta", "text": delta})
            else:
                raw = await provider_answer(link["provider"], prep["key"], link.get("model") or "", SYSTEM, turns, image_b64)
                parts.append(raw)
                yield line({"type": "delta", "text": raw})
            raw = "".join(parts)
            p = _parse_answer(raw)
            found = await find_in_voiladi(user, p["terms"], body.user_ids, body.post_ids)
            yield line({"type": "done", **_result(user, link, raw, found)})
        except HTTPException as e:
            yield line({"type": "error", "status": e.status_code, "detail": str(e.detail)})
        except Exception:  # noqa: BLE001 - never leave the client hanging on a half-open stream
            logger.exception("ai lookup stream")
            yield line({"type": "error", "status": 500, "detail": "Your AI didn't answer. Try again"})

    return StreamingResponse(gen(), media_type="application/x-ndjson", headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


async def ensure_indexes():
    await db.ai_links.create_index([("user_id", 1), ("provider", 1)], unique=True)
