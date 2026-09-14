"""
Conversations and real-time messaging.

A conversation ("thread") lives in db.matches. Two kinds:
  kind="match" - created when two people like each other (legacy rows have no `kind`; treated as match)
  kind="dm"    - a direct message started from someone's profile (Instagram-style "message request")
                  status="request" until the recipient replies or accepts -> status="active"
Both kinds share the same message endpoints, so the chat screen is identical.
"""
import uuid
from typing import Optional

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel

from core import is_verified, db, now_iso, get_current_user, public_profile
from ws_manager import manager
from bots import schedule_bot_reply

router = APIRouter(prefix="/api", tags=["chat"])

MAX_TEXT = 1000


class MessageIn(BaseModel):
    text: str
    client_id: Optional[str] = None


async def _get_match(match_id: str, uid: str) -> dict:
    match = await db.matches.find_one({"id": match_id, "users": uid, "active": True}, {"_id": 0})
    if not match:
        raise HTTPException(status_code=404, detail="Chat not found")
    return match


def _other(match: dict, uid: str) -> str:
    return [u for u in match["users"] if u != uid][0]


def media_preview_text(kind: str, view_once: bool) -> str:
    """Inbox preview for photo/video messages."""
    base = "Photo" if kind == "image" else "Video"
    return f"{base} (view once)" if view_once else base


def _message_preview(m: dict) -> str:
    if m.get("kind") == "post":
        return "Shared a post"
    if m.get("media"):
        return media_preview_text(m["media"].get("kind", "image"), bool(m["media"].get("view_once")))
    return m.get("text") or ""


def _kind(match: dict) -> str:
    return match.get("kind") or "match"


def _is_request_for(match: dict, uid: str) -> bool:
    """True when this is a DM request the given user has not accepted yet."""
    return _kind(match) == "dm" and match.get("status") == "request" and match.get("requested_by") != uid


async def _blocked_between(a: str, b: str) -> bool:
    return bool(await db.blocks.find_one({"$or": [{"from_id": a, "to_id": b}, {"from_id": b, "to_id": a}]}, {"_id": 0, "from_id": 1}))


async def _match_view(match: dict, uid: str, users_cache: dict, viewer: dict) -> Optional[dict]:
    other_id = _other(match, uid)
    other = users_cache.get(other_id)
    if other is None:
        other = await db.users.find_one({"id": other_id}, {"_id": 0})
        users_cache[other_id] = other
    if not other:
        return None
    return {
        "id": match["id"],
        "created_at": match["created_at"],
        "active": match.get("active", True),
        "kind": _kind(match),
        "status": match.get("status") or "active",
        "requested_by": match.get("requested_by"),
        "is_request": _is_request_for(match, uid),
        "superlike": bool(match.get("superlike")),
        "user": public_profile(other, viewer),
        "last_message": match.get("last_message"),
        "last_message_at": match.get("last_message_at"),
        "unread": (match.get("unread") or {}).get(uid, 0),
        # my last message has been seen when the other side has nothing left unread
        "last_read": bool(match.get("last_message")) and match["last_message"].get("sender_id") == uid and (match.get("unread") or {}).get(other_id, 0) == 0,
        "online": manager.is_online(other_id),
    }


async def _thread_event(match: dict, to_uid: str, type_: str, viewer_of_to: dict):
    """Push a thread-level event (request / accepted) with the thread as seen by `to_uid`."""
    view = await _match_view(match, to_uid, {}, viewer_of_to)
    if view:
        await manager.send(to_uid, {"type": type_, "match_id": match["id"], "match": view})


# ---------- inbox -------------------------------------------------------------

@router.get("/matches")
async def list_matches(user=Depends(get_current_user)):
    uid = user["id"]
    rows = await db.matches.find({"users": uid, "active": True}, {"_id": 0}).to_list(500)
    rows.sort(key=lambda m: (m.get("last_message_at") or m.get("created_at") or ""), reverse=True)
    cache = {}
    matches, requests = [], []
    for m in rows:
        v = await _match_view(m, uid, cache, user)
        if not v:
            continue
        (requests if v["is_request"] else matches).append(v)
    total_unread = sum(v["unread"] for v in matches)
    return {"matches": matches, "requests": requests, "requests_count": len(requests), "total_unread": total_unread}


# ---------- direct messages from a profile -----------------------------------

@router.post("/dm/{user_id}")
async def start_dm(user_id: str, user=Depends(get_current_user)):
    """
    Open (or create) a conversation with any profile. Returns the thread so the app can navigate to /chats/{id}.
    A brand-new thread is a *request* on the other person's side until they reply or accept.
    """
    uid = user["id"]
    if user_id == uid:
        raise HTTPException(status_code=400, detail="That's you")
    if not is_verified(user):
        raise HTTPException(status_code=403, detail="Verify your profile to send messages")
    target = await db.users.find_one({"id": user_id, "onboarded": True}, {"_id": 0})
    if not target:
        raise HTTPException(status_code=404, detail="Profile not found")
    if await _blocked_between(uid, user_id):
        raise HTTPException(status_code=403, detail="You can't message this person")

    existing = await db.matches.find_one({"users": {"$all": [uid, user_id]}, "active": True}, {"_id": 0})
    if existing:
        return await _match_view(existing, uid, {}, user)

    thread = {
        "id": str(uuid.uuid4()), "users": [uid, user_id], "created_at": now_iso(), "active": True,
        "kind": "dm", "status": "request", "requested_by": uid, "unread": {},
    }
    await db.matches.insert_one(dict(thread))
    await _thread_event(thread, user_id, "dm_request", target)
    return await _match_view(thread, uid, {}, user)


@router.post("/matches/{match_id}/accept")
async def accept_request(match_id: str, user=Depends(get_current_user)):
    match = await _get_match(match_id, user["id"])
    if not _is_request_for(match, user["id"]):
        return await _match_view(match, user["id"], {}, user)
    ts = now_iso()
    await db.matches.update_one({"id": match_id}, {"$set": {"status": "active", "accepted_at": ts}})
    match.update({"status": "active", "accepted_at": ts})
    other_id = _other(match, user["id"])
    other = await db.users.find_one({"id": other_id}, {"_id": 0})
    if other:
        await _thread_event(match, other_id, "dm_accepted", other)
    return await _match_view(match, user["id"], {}, user)


# ---------- a single thread -------------------------------------------------

@router.get("/matches/{match_id}")
async def get_match(match_id: str, user=Depends(get_current_user)):
    match = await _get_match(match_id, user["id"])
    v = await _match_view(match, user["id"], {}, user)
    if not v:
        raise HTTPException(status_code=404, detail="Chat not found")
    return v


@router.delete("/matches/{match_id}")
async def end_thread(match_id: str, user=Depends(get_current_user)):
    """Unmatch, or decline/delete a message request. The other side's chat disappears too."""
    match = await _get_match(match_id, user["id"])
    await db.matches.update_one({"id": match_id}, {"$set": {"active": False, "ended_by": user["id"], "ended_at": now_iso()}})
    await manager.send(_other(match, user["id"]), {"type": "unmatch", "match_id": match_id, "kind": _kind(match)})
    return {"ok": True}


@router.get("/matches/{match_id}/messages")
async def list_messages(match_id: str, limit: int = 60, before: Optional[str] = None, user=Depends(get_current_user)):
    await _get_match(match_id, user["id"])
    q = {"match_id": match_id}
    if before:
        q["created_at"] = {"$lt": before}
    msgs = await db.messages.find(q, {"_id": 0}).sort("created_at", -1).to_list(min(limit, 200))
    msgs.reverse()
    return {"messages": msgs, "has_more": len(msgs) >= min(limit, 200)}


@router.post("/matches/{match_id}/messages")
async def send_message(match_id: str, body: MessageIn, user=Depends(get_current_user)):
    match = await _get_match(match_id, user["id"])
    if not match.get("active", True):
        raise HTTPException(status_code=400, detail="This chat has ended")
    if not is_verified(user):
        raise HTTPException(status_code=403, detail="Verify your profile to send messages")
    text = body.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="Message can't be empty")
    if len(text) > MAX_TEXT:
        raise HTTPException(status_code=400, detail=f"Keep it under {MAX_TEXT} characters")
    other = _other(match, user["id"])
    if await _blocked_between(user["id"], other):
        raise HTTPException(status_code=403, detail="You can't message this person")

    # replying to a request accepts it
    accepted_now = _is_request_for(match, user["id"])
    msg = {
        "id": str(uuid.uuid4()), "match_id": match_id, "sender_id": user["id"], "text": text,
        "created_at": now_iso(), "read_at": None, "client_id": body.client_id,
    }
    await db.messages.insert_one(dict(msg))
    update = {
        "$set": {"last_message": {"text": text, "sender_id": user["id"], "created_at": msg["created_at"]},
                 "last_message_at": msg["created_at"]},
        "$inc": {f"unread.{other}": 1},
    }
    if accepted_now:
        update["$set"].update({"status": "active", "accepted_at": msg["created_at"]})
    await db.matches.update_one({"id": match_id}, update)
    payload = {"type": "message", "match_id": match_id, "message": msg, "accepted": accepted_now,
               "sender_name": user.get("name") or "Someone", "sender_photo": (user.get("photos") or [None])[0]}
    await manager.send(other, payload)
    await manager.send(user["id"], payload)
    # sample profiles answer back so chat can be tested end to end (no-op for real people)
    schedule_bot_reply(match, await db.users.find_one({"id": other, "is_seed": True}, {"_id": 0, "id": 1, "name": 1, "photos": 1, "is_seed": 1}), user["id"], text)
    return msg


@router.delete("/matches/{match_id}/messages/{message_id}")
async def unsend_message(match_id: str, message_id: str, user=Depends(get_current_user)):
    """Unsend one of your own messages - removed for both people, like Instagram."""
    match = await _get_match(match_id, user["id"])
    msg = await db.messages.find_one({"id": message_id, "match_id": match_id}, {"_id": 0})
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")
    if msg["sender_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="You can only unsend your own messages")
    await db.messages.delete_one({"id": message_id})
    if msg.get("media"):
        from routes_media import _delete_media_files  # local import: routes_media imports helpers from this module
        await _delete_media_files(msg)
    other = _other(match, user["id"])
    # keep the inbox preview and unread count honest
    latest = await db.messages.find({"match_id": match_id}, {"_id": 0}).sort("created_at", -1).to_list(1)
    sets = {}
    if latest:
        last = latest[0]
        sets = {"last_message": {"text": _message_preview(last), "sender_id": last["sender_id"], "created_at": last["created_at"], "kind": last.get("kind")},
                "last_message_at": last["created_at"]}
    else:
        sets = {"last_message": None, "last_message_at": None}
    update = {"$set": sets}
    if not msg.get("read_at"):
        update["$inc"] = {f"unread.{other}": -1}
    await db.matches.update_one({"id": match_id}, update)
    await db.matches.update_one({"id": match_id, f"unread.{other}": {"$lt": 0}}, {"$set": {f"unread.{other}": 0}})
    payload = {"type": "message_deleted", "match_id": match_id, "message_id": message_id}
    await manager.send(other, payload)
    await manager.send(user["id"], payload)
    return {"ok": True}


@router.post("/matches/{match_id}/read")
async def mark_read(match_id: str, user=Depends(get_current_user)):
    match = await _get_match(match_id, user["id"])
    other = _other(match, user["id"])
    ts = now_iso()
    res = await db.messages.update_many({"match_id": match_id, "sender_id": other, "read_at": None}, {"$set": {"read_at": ts}})
    await db.matches.update_one({"id": match_id}, {"$set": {f"unread.{user['id']}": 0}})
    if res.modified_count:
        await manager.send(other, {"type": "read", "match_id": match_id, "by": user["id"], "read_at": ts})
    return {"ok": True, "read_at": ts}
