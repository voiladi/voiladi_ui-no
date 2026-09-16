"""Notifications feed (Instagram / Facebook style): likes, message requests, new messages and account notices.

Items are derived from existing collections (swipes, matches, messages) so the feed is always in sync. Stored state:
  - users.notifications_seen_at      -> bell dot (anything newer is "unseen")
  - users.notifications_read_all_at  -> "Mark all as read" baseline (items at or before it count as read)
  - notification_reads {user_id, item_id, read_at} -> per-item read marks (tapping a row)
The "Unread" tab = items that are neither individually read nor older than the read-all baseline.
"""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from core import db, get_current_user, now_iso, public_profile

router = APIRouter(prefix="/api", tags=["notifications"])


async def _blocked(user_id: str) -> set:
    rows = await db.blocks.find({"$or": [{"from_id": user_id}, {"to_id": user_id}]}, {"_id": 0}).to_list(None)
    out = set()
    for r in rows:
        out.add(r.get("from_id"))
        out.add(r.get("to_id"))
    out.discard(user_id)
    return out


def _first(name: str) -> str:
    return (name or "Someone").split(" ")[0]


async def _read_baseline(user: dict) -> str:
    """Existing accounts: everything they had already seen when this feature shipped counts as read."""
    base = user.get("notifications_read_all_at")
    if base:
        return base
    base = user.get("notifications_seen_at") or ""
    await db.users.update_one({"id": user["id"]}, {"$set": {"notifications_read_all_at": base}})
    return base


@router.get("/notifications")
async def list_notifications(user=Depends(get_current_user)):
    uid = user["id"]
    blocked = await _blocked(uid)
    items = []

    likes = await db.swipes.find({"to_id": uid, "action": {"$in": ["like", "superlike"]}}, {"_id": 0}).sort("created_at", -1).to_list(150)
    tags = await db.posts.find({"tagged": uid, "status": {"$ne": "failed"}}, {"_id": 0, "id": 1, "user_id": 1, "created_at": 1}).sort("created_at", -1).to_list(100)
    matches = await db.matches.find({"users": uid, "active": True}, {"_id": 0}).sort("created_at", -1).to_list(150)
    match_ids = [m["id"] for m in matches]
    other_of = {m["id"]: next((o for o in m["users"] if o != uid), None) for m in matches}
    msgs = await db.messages.find({"match_id": {"$in": match_ids}, "sender_id": {"$ne": uid}, "kind": {"$ne": "reaction"}}, {"_id": 0}) \
        .sort("created_at", -1).to_list(400)
    latest_msg = {}
    for m in msgs:
        latest_msg.setdefault(m["match_id"], m)

    ids = set(l["from_id"] for l in likes) | set(v for v in other_of.values() if v) | set(t["user_id"] for t in tags)
    ids -= blocked
    users = {u["id"]: u for u in await db.users.find({"id": {"$in": list(ids)}}, {"_id": 0}).to_list(None)}

    def person(u):
        p = public_profile(u, user)
        return {"id": p["id"], "name": p["name"], "username": p.get("username") or "", "photos": p.get("photos", [])[:1], "verified": bool(p.get("verified"))}

    for t in tags:
        u = users.get(t["user_id"])
        if not u:
            continue
        items.append({
            "id": f"tag:{t['id']}", "type": "tag", "actor": u["name"], "text": "tagged you in a post.",
            "created_at": t["created_at"], "user": person(u), "href": f"/p/{t['id']}",
        })

    for l in likes:
        u = users.get(l["from_id"])
        if not u:
            continue
        superlike = l["action"] == "superlike"
        items.append({
            "id": f"like:{l['from_id']}:{l['created_at']}", "type": "superlike" if superlike else "like",
            "actor": u["name"], "text": "sent you a Super Like." if superlike else "liked your profile.",
            "created_at": l["created_at"], "user": person(u), "href": "/likes",
        })

    for m in matches:
        u = users.get(other_of.get(m["id"]))
        if not u:
            continue
        if (m.get("kind") or "match") == "dm" and m.get("requested_by") != uid:
            pending = m.get("status") == "request"
            items.append({
                "id": f"dm:{m['id']}", "type": "request", "status": "pending" if pending else "accepted", "match_id": m["id"],
                "actor": u["name"], "text": "wants to send you a message." if pending else "can now message you - you accepted their request.",
                "created_at": m["created_at"], "user": person(u), "href": f"/chats/{m['id']}",
            })
        msg = latest_msg.get(m["id"])
        if msg:
            items.append({
                "id": f"msg:{msg['id']}", "type": "message", "match_id": m["id"],
                "actor": u["name"], "text": f"sent you a message: {(msg.get('text') or 'Photo')[:60]}",
                "created_at": msg["created_at"], "user": person(u), "href": f"/chats/{m['id']}",
            })

    # account notices (verification review)
    v = user.get("verification") or {}
    if v.get("status") in ("approved", "rejected") and v.get("reviewed_at"):
        ok = v["status"] == "approved"
        items.append({"id": f"verify:{v['reviewed_at']}", "type": "verification", "icon": "badge-check" if ok else "shield-alert",
                      "actor": "Voiladi", "text": "verified your profile. The black tick now shows on your profile." if ok else
                      ("couldn't verify your selfie. " + (v.get("note") or "Take a clearer selfie and try again.")),
                      "created_at": v["reviewed_at"], "href": "/profile" if ok else "/verify"})
    elif v.get("status") == "pending" and v.get("submitted_at"):
        items.append({"id": "verify:pending", "type": "verification", "icon": "badge-check", "actor": "Voiladi",
                      "text": "received your selfie. We review it by hand, usually within a day.", "created_at": v["submitted_at"], "href": "/profile"})

    items.sort(key=lambda i: i["created_at"], reverse=True)
    items = items[:120]

    baseline = await _read_baseline(user)
    read_ids = set(r["item_id"] for r in await db.notification_reads.find({"user_id": uid, "item_id": {"$in": [i["id"] for i in items]}}, {"_id": 0, "item_id": 1}).to_list(None))
    for i in items:
        i["read"] = i["id"] in read_ids or (bool(baseline) and i["created_at"] <= baseline)

    seen_at = user.get("notifications_seen_at") or user.get("created_at") or ""
    return {
        "items": items, "seen_at": seen_at,
        "unseen_count": sum(1 for i in items if i["created_at"] > seen_at),
        "unread_count": sum(1 for i in items if not i["read"]),
        "request_count": sum(1 for i in items if i["type"] == "request" and i.get("status") == "pending"),
    }


@router.post("/notifications/seen")
async def mark_seen(user=Depends(get_current_user)):
    ts = now_iso()
    await db.users.update_one({"id": user["id"]}, {"$set": {"notifications_seen_at": ts}})
    return {"ok": True, "seen_at": ts}


class ReadIn(BaseModel):
    ids: Optional[List[str]] = None
    all: bool = False


@router.post("/notifications/read")
async def mark_read(body: ReadIn, user=Depends(get_current_user)):
    """Mark some notifications (ids) or everything (all=true) as read."""
    ts = now_iso()
    if body.all:
        await db.users.update_one({"id": user["id"]}, {"$set": {"notifications_read_all_at": ts}})
        await db.notification_reads.delete_many({"user_id": user["id"]})
        return {"ok": True, "read_all_at": ts}
    ids = [i for i in (body.ids or []) if isinstance(i, str) and i][:200]
    if not ids:
        raise HTTPException(status_code=400, detail="Nothing to mark")
    for item_id in ids:
        await db.notification_reads.update_one({"user_id": user["id"], "item_id": item_id}, {"$set": {"read_at": ts}}, upsert=True)
    return {"ok": True, "count": len(ids)}


async def ensure_indexes():
    await db.notification_reads.create_index([("user_id", 1), ("item_id", 1)], unique=True)
