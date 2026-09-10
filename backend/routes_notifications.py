"""Notifications feed: likes / super likes / matches / messages you received, plus a few system notices.

Everything is derived from existing collections (swipes, matches, messages) so it is always in sync; the only
stored state is `notifications_seen_at` on the user, which splits the feed into "New" and "Earlier".
"""
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends

from core import db, get_current_user, now, now_iso, public_profile

router = APIRouter(prefix="/api", tags=["notifications"])

SYSTEM_NOTICES = [
    {"key": "plus", "icon": "logo", "title": "VOILADI+", "sub": "Unlock more likes, see who liked you and get premium features.", "href": "/profile", "after_hours": 8},
    {"key": "features", "icon": "bell", "title": "New features are here", "sub": "Discover what's new on VOILADI.", "href": "/explore", "after_hours": 24},
    {"key": "safe", "icon": "shield", "title": "Your profile is safe", "sub": "We've reviewed your profile and found no issues.", "href": "/legal/safety", "after_hours": 48},
    {"key": "tips", "icon": "gear", "title": "Tips to get more matches", "sub": "Complete your profile and add photos.", "href": "/profile/edit", "after_hours": 72},
]


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


@router.get("/notifications")
async def list_notifications(user=Depends(get_current_user)):
    uid = user["id"]
    blocked = await _blocked(uid)
    items = []

    # likes + super likes received
    likes = await db.swipes.find({"to_id": uid, "action": {"$in": ["like", "superlike"]}}, {"_id": 0}).sort("created_at", -1).to_list(150)
    # matches
    matches = await db.matches.find({"users": uid, "active": True}, {"_id": 0}).sort("created_at", -1).to_list(150)
    match_ids = [m["id"] for m in matches]
    other_of = {m["id"]: next((o for o in m["users"] if o != uid), None) for m in matches}
    # latest message received per match
    msgs = await db.messages.find({"match_id": {"$in": match_ids}, "sender_id": {"$ne": uid}, "kind": {"$ne": "reaction"}}, {"_id": 0}) \
        .sort("created_at", -1).to_list(400)
    latest_msg = {}
    for m in msgs:
        latest_msg.setdefault(m["match_id"], m)

    ids = set(l["from_id"] for l in likes) | set(v for v in other_of.values() if v)
    ids -= blocked
    users = {u["id"]: u for u in await db.users.find({"id": {"$in": list(ids)}}, {"_id": 0}).to_list(None)}

    def person(u):
        p = public_profile(u, user)
        return {"id": p["id"], "name": p["name"], "photos": p.get("photos", [])[:1]}

    for l in likes:
        u = users.get(l["from_id"])
        if not u:
            continue
        superlike = l["action"] == "superlike"
        items.append({
            "id": f"like:{l['from_id']}:{l['created_at']}",
            "type": "superlike" if superlike else "like",
            "title": f"{_first(u['name'])} gave you a Super Like" if superlike else f"{_first(u['name'])} liked your profile",
            "sub": "Stand out and start a conversation!" if superlike else "They think you're interesting!",
            "created_at": l["created_at"],
            "user": person(u),
            "href": "/likes",
        })

    for m in matches:
        u = users.get(other_of.get(m["id"]))
        if not u:
            continue
        if (m.get("kind") or "match") == "dm":
            # a direct message thread: only the recipient gets a "request" notice; the sender gets nothing here
            if m.get("requested_by") != uid:
                items.append({
                    "id": f"dm:{m['id']}",
                    "type": "message",
                    "title": f"{_first(u['name'])} sent you a message request",
                    "sub": "Open it to accept or delete." if m.get("status") == "request" else "You accepted their request.",
                    "created_at": m["created_at"],
                    "user": person(u),
                    "href": f"/chats/{m['id']}",
                })
        else:
            items.append({
                "id": f"match:{m['id']}",
                "type": "match",
                "title": f"You matched with {_first(u['name'])}",
                "sub": "Say hi and break the ice.",
                "created_at": m["created_at"],
                "user": person(u),
                "href": f"/chats/{m['id']}",
            })
        msg = latest_msg.get(m["id"])
        if msg:
            items.append({
                "id": f"msg:{msg['id']}",
                "type": "message",
                "title": f"{_first(u['name'])} sent you a message",
                "sub": (msg.get("text") or "Sent you a photo")[:80],
                "created_at": msg["created_at"],
                "user": person(u),
                "href": f"/chats/{m['id']}",
            })

    # verification result
    v = user.get("verification") or {}
    if v.get("status") in ("approved", "rejected") and v.get("reviewed_at"):
        ok = v["status"] == "approved"
        items.append({"id": f"verify:{v['reviewed_at']}", "type": "verification", "icon": "badge-check" if ok else "shield-alert",
                      "title": "You're verified" if ok else "We couldn't verify your selfie",
                      "sub": "The black tick now shows on your profile." if ok else (v.get("note") or "Take a clearer selfie and try again."),
                      "created_at": v["reviewed_at"], "href": "/profile" if ok else "/verify"})
    elif v.get("status") == "pending" and v.get("submitted_at"):
        items.append({"id": f"verify:pending", "type": "verification", "icon": "badge-check", "title": "Selfie received",
                      "sub": "We're reviewing it by hand - usually within a day.", "created_at": v["submitted_at"], "href": "/profile"})

    # system notices, timed from account creation
    created = user.get("created_at") or now_iso()
    try:
        base = datetime.fromisoformat(created)
    except ValueError:
        base = now()
    for n in SYSTEM_NOTICES:
        at = (base + timedelta(hours=n["after_hours"])).isoformat()
        if at <= now_iso():
            items.append({"id": f"sys:{n['key']}", "type": "system", "icon": n["icon"], "title": n["title"], "sub": n["sub"], "created_at": at, "href": n["href"]})

    items.sort(key=lambda i: i["created_at"], reverse=True)
    seen_at = user.get("notifications_seen_at") or created
    unseen = sum(1 for i in items if i["created_at"] > seen_at)
    return {"items": items[:120], "seen_at": seen_at, "unseen_count": unseen}


@router.post("/notifications/seen")
async def mark_seen(user=Depends(get_current_user)):
    ts = now_iso()
    await db.users.update_one({"id": user["id"]}, {"$set": {"notifications_seen_at": ts}})
    return {"ok": True, "seen_at": ts}
