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
import uuid
from typing import Optional, List, Dict, Any

import httpx
from cryptography.fernet import Fernet, InvalidToken
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from core import db, now_iso, get_current_user, public_profile, JWT_SECRET, logger
from content import INTERESTS, TOPIC_COVERS

router = APIRouter(prefix="/api/ai", tags=["ai"])

PROVIDERS = {
    "openai": {"name": "ChatGPT", "company": "OpenAI", "keys_url": "https://platform.openai.com/api-keys", "prefix": "sk-"},
    "anthropic": {"name": "Claude", "company": "Anthropic", "keys_url": "https://platform.claude.com/settings/keys", "prefix": "sk-ant-"},
    "gemini": {"name": "Gemini", "company": "Google", "keys_url": "https://aistudio.google.com/api-keys", "prefix": "AIza"},
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
        "provider": row["provider"], "name": p["name"], "company": p["company"], "hint": row.get("hint") or "",
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
    "You are the search assistant inside Voiladi, a social app where people share photo and video posts, follow each other, "
    "chat and join interest communities. The user circled part of their screen with a floating orb; the image is that area, "
    "the dark ink stroke is their marking. Describe or explain what they marked in 1-3 short, friendly sentences (no headings, "
    "no markdown, no emojis). Then, on a final separate line, output exactly: TERMS: followed by 2-6 short lowercase search "
    "terms separated by commas (things, places, interests, names or usernames you can read) that would find related people, "
    "posts or communities inside the app."
)


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


def _split_terms(answer: str):
    terms: List[str] = []
    lines = answer.strip().splitlines()
    kept = []
    for ln in lines:
        m = re.match(r"^\s*\**terms\**\s*:\s*(.*)$", ln, re.I)
        if m:
            terms += [t.strip(" .#@\"'").lower() for t in m.group(1).split(",")]
        else:
            kept.append(ln)
    terms = [t for t in dict.fromkeys(terms) if 2 <= len(t) <= 40][:6]
    return "\n".join(kept).strip(), terms


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


@router.post("/lookup")
async def lookup(body: LookupIn, user=Depends(get_current_user)):
    link = await active_link(user["id"])
    if not link:
        raise HTTPException(status_code=428, detail="Connect your AI in Settings first")
    image_b64 = _decode_image(body.image)
    if not image_b64 and not body.question:
        raise HTTPException(status_code=400, detail="Nothing to look at")
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
        turns.append({"role": "user", "text": context + (body.question or "What did I mark? Tell me about it.")})
    if turns[-1]["role"] != "user":
        turns.append({"role": "user", "text": body.question or "Go on."})

    raw = await provider_answer(link["provider"], key, link.get("model") or "", SYSTEM, turns, image_b64)
    answer, terms = _split_terms(raw)
    if not answer:
        answer = "I couldn't make out what you marked. Try circling it a little larger."
    found = await find_in_voiladi(user, terms, body.user_ids, body.post_ids)
    return {"answer": answer, "terms": terms, "found": found, "provider": link["provider"], "model": link.get("model") or "",
            "provider_name": PROVIDERS[link["provider"]]["name"]}


async def ensure_indexes():
    await db.ai_links.create_index([("user_id", 1), ("provider", 1)], unique=True)
