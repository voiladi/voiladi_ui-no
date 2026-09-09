"""Discovery feed, swipes, likes and matching."""
import uuid
from typing import Optional

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel

from core import (db, now_iso, get_current_user, public_profile, get_prefs, calc_age, distance_between,
                  compatibility, ANYWHERE_KM, SHOW_ME_TO_GENDER)
from ws_manager import manager

router = APIRouter(prefix="/api", tags=["discover"])


class SwipeIn(BaseModel):
    target_id: str
    action: str  # like | pass | superlike


def _accepts(viewer: dict, candidate: dict, dist: Optional[float]) -> bool:
    """Does `viewer`'s preference set accept `candidate`?"""
    prefs = get_prefs(viewer)
    age = calc_age(candidate.get("birthday"))
    if age is None or age < prefs["age_min"] or age > prefs["age_max"]:
        return False
    want = prefs.get("show_me", "everyone")
    if want in SHOW_ME_TO_GENDER and candidate.get("gender") != SHOW_ME_TO_GENDER[want]:
        return False
    if dist is not None and prefs["max_distance_km"] < ANYWHERE_KM and dist > prefs["max_distance_km"]:
        return False
    return True


async def _excluded_ids(uid: str):
    swiped = await db.swipes.find({"from_id": uid}, {"_id": 0, "to_id": 1}).to_list(None)
    blocks = await db.blocks.find({"$or": [{"from_id": uid}, {"to_id": uid}]}, {"_id": 0}).to_list(None)
    ids = {uid}
    ids.update(s["to_id"] for s in swiped)
    for b in blocks:
        ids.add(b["from_id"])
        ids.add(b["to_id"])
    return ids


@router.get("/discover")
async def discover(limit: int = 20, user=Depends(get_current_user)):
    await db.users.update_one({"id": user["id"]}, {"$set": {"last_active": now_iso()}})
    excluded = await _excluded_ids(user["id"])
    prefs = get_prefs(user)
    query = {"id": {"$nin": list(excluded)}, "profile_complete": True, "onboarded": True}
    want = prefs.get("show_me", "everyone")
    if want in SHOW_ME_TO_GENDER:
        query["gender"] = SHOW_ME_TO_GENDER[want]
    candidates = await db.users.find(query, {"_id": 0}).to_list(600)
    liked_me = set(s["from_id"] for s in await db.swipes.find(
        {"to_id": user["id"], "action": {"$in": ["like", "superlike"]}}, {"_id": 0, "from_id": 1}).to_list(None))
    scored = []
    for c in candidates:
        dist = distance_between(user, c)
        if not _accepts(user, c, dist):
            continue
        if not _accepts(c, user, dist):
            continue
        p = public_profile(c, user)
        rank = p["compatibility"] + (12 if c["id"] in liked_me else 0)
        scored.append((rank, p))
    scored.sort(key=lambda t: t[0], reverse=True)
    return {"profiles": [p for _, p in scored[:limit]], "total": len(scored)}


@router.post("/swipe")
async def swipe(body: SwipeIn, user=Depends(get_current_user)):
    if body.action not in ("like", "pass", "superlike"):
        raise HTTPException(status_code=400, detail="Invalid action")
    if body.target_id == user["id"]:
        raise HTTPException(status_code=400, detail="Nice try")
    target = await db.users.find_one({"id": body.target_id}, {"_id": 0})
    if not target:
        raise HTTPException(status_code=404, detail="Profile not found")
    await db.swipes.update_one(
        {"from_id": user["id"], "to_id": target["id"]},
        {"$set": {"from_id": user["id"], "to_id": target["id"], "action": body.action, "created_at": now_iso()},
         "$setOnInsert": {"id": str(uuid.uuid4())}},
        upsert=True,
    )
    matched, match_out = False, None
    if body.action in ("like", "superlike"):
        reciprocal = await db.swipes.find_one(
            {"from_id": target["id"], "to_id": user["id"], "action": {"$in": ["like", "superlike"]}}, {"_id": 0})
        blocked = await db.blocks.find_one({"$or": [{"from_id": user["id"], "to_id": target["id"]},
                                                    {"from_id": target["id"], "to_id": user["id"]}]})
        if reciprocal and not blocked:
            existing = await db.matches.find_one({"users": {"$all": [user["id"], target["id"]]}}, {"_id": 0})
            if existing and existing.get("active"):
                match = existing
            elif existing:
                await db.matches.update_one({"id": existing["id"]}, {"$set": {"active": True, "created_at": now_iso()}})
                match = {**existing, "active": True}
            else:
                match = {
                    "id": str(uuid.uuid4()), "users": [user["id"], target["id"]], "created_at": now_iso(),
                    "active": True, "last_message": None, "last_message_at": None,
                    "unread": {user["id"]: 0, target["id"]: 0},
                    "superlike": body.action == "superlike" or reciprocal.get("action") == "superlike",
                }
                await db.matches.insert_one(dict(match))
            matched = True
            match_out = {"id": match["id"], "created_at": match["created_at"], "user": public_profile(target, user)}
            await manager.send(target["id"], {"type": "new_match", "match": {
                "id": match["id"], "created_at": match["created_at"], "user": public_profile(user, target)}})
    return {"matched": matched, "match": match_out}


@router.get("/likes/received")
async def likes_received(user=Depends(get_current_user)):
    my_swipes = set(s["to_id"] for s in await db.swipes.find({"from_id": user["id"]}, {"_id": 0, "to_id": 1}).to_list(None))
    blocks = await db.blocks.find({"$or": [{"from_id": user["id"]}, {"to_id": user["id"]}]}, {"_id": 0}).to_list(None)
    blocked = set()
    for b in blocks:
        blocked.add(b["from_id"])
        blocked.add(b["to_id"])
    likes = await db.swipes.find({"to_id": user["id"], "action": {"$in": ["like", "superlike"]}}, {"_id": 0}) \
        .sort("created_at", -1).to_list(200)
    ids = [l["from_id"] for l in likes if l["from_id"] not in my_swipes and l["from_id"] not in blocked]
    users = {u["id"]: u for u in await db.users.find({"id": {"$in": ids}, "profile_complete": True, "onboarded": True}, {"_id": 0}).to_list(None)}
    out = []
    for l in likes:
        u = users.get(l["from_id"])
        if not u:
            continue
        out.append({"user": public_profile(u, user), "superlike": l["action"] == "superlike", "created_at": l["created_at"]})
    return {"likes": out, "count": len(out)}
