"""Matches and real-time messaging."""
import uuid
from typing import Optional

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel

from core import db, now_iso, get_current_user, public_profile
from ws_manager import manager

router = APIRouter(prefix="/api", tags=["chat"])


class MessageIn(BaseModel):
    text: str
    client_id: Optional[str] = None


async def _get_match(match_id: str, uid: str) -> dict:
    match = await db.matches.find_one({"id": match_id, "users": uid}, {"_id": 0})
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")
    return match


def _other(match: dict, uid: str) -> str:
    return [u for u in match["users"] if u != uid][0]


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
        "superlike": bool(match.get("superlike")),
        "user": public_profile(other, viewer),
        "last_message": match.get("last_message"),
        "last_message_at": match.get("last_message_at"),
        "unread": (match.get("unread") or {}).get(uid, 0),
        "online": manager.is_online(other_id),
    }


@router.get("/matches")
async def list_matches(user=Depends(get_current_user)):
    matches = await db.matches.find({"users": user["id"], "active": True}, {"_id": 0}).to_list(500)
    matches.sort(key=lambda m: (m.get("last_message_at") or m.get("created_at") or ""), reverse=True)
    cache = {}
    out = []
    for m in matches:
        v = await _match_view(m, user["id"], cache, user)
        if v:
            out.append(v)
    total_unread = sum(v["unread"] for v in out)
    return {"matches": out, "total_unread": total_unread}


@router.get("/matches/{match_id}")
async def get_match(match_id: str, user=Depends(get_current_user)):
    match = await _get_match(match_id, user["id"])
    v = await _match_view(match, user["id"], {}, user)
    if not v:
        raise HTTPException(status_code=404, detail="Match not found")
    return v


@router.delete("/matches/{match_id}")
async def unmatch(match_id: str, user=Depends(get_current_user)):
    match = await _get_match(match_id, user["id"])
    await db.matches.update_one({"id": match_id}, {"$set": {"active": False, "ended_by": user["id"], "ended_at": now_iso()}})
    await manager.send(_other(match, user["id"]), {"type": "unmatch", "match_id": match_id})
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
    text = body.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="Message can't be empty")
    if len(text) > 1000:
        raise HTTPException(status_code=400, detail="Keep it under 1000 characters")
    other = _other(match, user["id"])
    msg = {
        "id": str(uuid.uuid4()), "match_id": match_id, "sender_id": user["id"], "text": text,
        "created_at": now_iso(), "read_at": None, "client_id": body.client_id,
    }
    await db.messages.insert_one(dict(msg))
    await db.matches.update_one({"id": match_id}, {
        "$set": {"last_message": {"text": text, "sender_id": user["id"], "created_at": msg["created_at"]},
                 "last_message_at": msg["created_at"]},
        "$inc": {f"unread.{other}": 1},
    })
    payload = {"type": "message", "match_id": match_id, "message": msg,
               "sender_name": user.get("name") or "Someone", "sender_photo": (user.get("photos") or [None])[0]}
    await manager.send(other, payload)
    await manager.send(user["id"], payload)
    return msg


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
