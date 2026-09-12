"""Operator-only endpoints: review user reports. Gated by ADMIN_API_KEY (x-admin-key header)."""
import os
import secrets
from typing import Optional

from fastapi import APIRouter, HTTPException, Header

from core import db, now_iso, calc_age

router = APIRouter(prefix="/api/admin", tags=["admin"])

ADMIN_API_KEY = os.environ.get("ADMIN_API_KEY", "")


def require_admin(x_admin_key: Optional[str]):
    if not ADMIN_API_KEY:
        raise HTTPException(status_code=503, detail="Admin access is not configured (set ADMIN_API_KEY)")
    if not x_admin_key or not secrets.compare_digest(x_admin_key, ADMIN_API_KEY):
        raise HTTPException(status_code=401, detail="Invalid admin key")


def _brief(u: Optional[dict]) -> Optional[dict]:
    if not u:
        return None
    return {"id": u["id"], "name": u.get("name") or "Someone", "age": calc_age(u.get("birthday")), "phone": u.get("phone"),
            "photo": (u.get("photos") or [None])[0], "created_at": u.get("created_at")}


@router.get("/reports")
async def list_reports(status: str = "open", limit: int = 100, x_admin_key: Optional[str] = Header(default=None)):
    require_admin(x_admin_key)
    q = {}
    if status in ("open", "resolved"):
        q["status"] = status if status == "resolved" else {"$ne": "resolved"}
    reports = await db.reports.find(q, {"_id": 0}).sort("created_at", -1).to_list(min(max(limit, 1), 500))
    ids = {r["from_id"] for r in reports} | {r["to_id"] for r in reports}
    users = {u["id"]: u for u in await db.users.find({"id": {"$in": list(ids)}}, {"_id": 0}).to_list(None)}
    # how many distinct people have reported each target (helps triage)
    counts = {}
    for row in await db.reports.aggregate([{"$group": {"_id": "$to_id", "n": {"$sum": 1}}}]).to_list(None):
        counts[row["_id"]] = row["n"]
    out = []
    for r in reports:
        out.append({
            "id": r["id"], "reason": r.get("reason"), "details": r.get("details", ""), "created_at": r.get("created_at"),
            "status": r.get("status", "open"), "resolved_at": r.get("resolved_at"),
            "reporter": _brief(users.get(r["from_id"])), "reported": _brief(users.get(r["to_id"])),
            "reported_total_reports": counts.get(r["to_id"], 0),
        })
    return {"reports": out, "count": len(out)}


@router.post("/reports/{report_id}/resolve")
async def resolve_report(report_id: str, x_admin_key: Optional[str] = Header(default=None)):
    require_admin(x_admin_key)
    res = await db.reports.update_one({"id": report_id}, {"$set": {"status": "resolved", "resolved_at": now_iso()}})
    if not res.matched_count:
        raise HTTPException(status_code=404, detail="Report not found")
    return {"ok": True}


# ---------- registered users (operator roster) ----------
@router.get("/users")
async def list_users(include_seed: bool = False, limit: int = 500, x_admin_key: Optional[str] = Header(default=None)):
    """Every registered account, newest first. Sample profiles are excluded unless include_seed=true."""
    require_admin(x_admin_key)
    q = {} if include_seed else {"is_seed": {"$ne": True}}
    fields = {"_id": 0, "id": 1, "name": 1, "username": 1, "email": 1, "phone": 1, "phone_verified": 1, "birthday": 1,
              "gender": 1, "city": 1, "onboarded": 1, "verified": 1, "verification_status": 1, "photos": 1,
              "created_at": 1, "last_seen": 1, "last_active": 1, "is_seed": 1}
    rows = await db.users.find(q, fields).sort("created_at", -1).to_list(min(max(limit, 1), 2000))
    out = []
    for u in rows:
        out.append({
            "id": u.get("id"), "name": u.get("name"), "username": u.get("username"), "email": u.get("email"),
            "phone": u.get("phone"), "phone_verified": bool(u.get("phone_verified") or u.get("phone")),
            "age": calc_age(u.get("birthday")), "gender": u.get("gender"), "city": u.get("city"),
            "onboarded": bool(u.get("onboarded")), "verified": bool(u.get("verified")),
            "verification_status": u.get("verification_status"), "photos": len(u.get("photos") or []),
            "created_at": u.get("created_at"), "last_seen": u.get("last_seen") or u.get("last_active"),
            "is_seed": bool(u.get("is_seed")),
        })
    return {"users": out, "count": len(out),
            "total_real": await db.users.count_documents({"is_seed": {"$ne": True}}),
            "total_sample": await db.users.count_documents({"is_seed": True})}


@router.delete("/users/{user_id}")
async def admin_delete_user(user_id: str, x_admin_key: Optional[str] = Header(default=None)):
    """Permanently erase an account and all of its data (same routine as self-service account deletion)."""
    require_admin(x_admin_key)
    from routes_auth import purge_user  # local import avoids a circular import at module load
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    removed = await purge_user(user)
    return {"ok": True, "deleted": {"id": user_id, "name": user.get("name"), "email": user.get("email"), "phone": user.get("phone")},
            "removed": removed}


# ---------- test inbox: sample profiles chat with a real account ----------
@router.post("/seed/chats")
async def seed_chats(username: Optional[str] = None, user_id: Optional[str] = None, reset: bool = True,
                     x_admin_key: Optional[str] = Header(default=None)):
    """Give @username a full test inbox (conversations, fresh matches, requests, likes) with the sample profiles.
    Sample profiles then auto-reply to anything this account sends them."""
    require_admin(x_admin_key)
    from bots import seed_chats_for
    from seed import seed as seed_profiles
    q = {"id": user_id} if user_id else {"username": (username or "").lstrip("@").lower()}
    user = await db.users.find_one(q, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if await db.users.count_documents({"is_seed": True}) < 14:
        await seed_profiles()
    created = await seed_chats_for(user, reset=reset)
    return {"ok": True, "user": {"id": user["id"], "name": user.get("name"), "username": user.get("username")}, "created": created}


@router.delete("/seed/chats")
async def unseed_chats(username: Optional[str] = None, user_id: Optional[str] = None, x_admin_key: Optional[str] = Header(default=None)):
    """Remove the test inbox again (sample profiles stay)."""
    require_admin(x_admin_key)
    from bots import clear_chats_for
    q = {"id": user_id} if user_id else {"username": (username or "").lstrip("@").lower()}
    user = await db.users.find_one(q, {"_id": 0, "id": 1})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return {"ok": True, "removed": await clear_chats_for(user["id"])}


# ---------- sample posts for the Discover feed ----------
SAMPLE_POSTS = [
    ("1506905925346-21bda4d32df4", "Good places make better days.", "Lake Como, Italy"),
    ("1469474968028-56623f02e42e", "Chasing the last light.", "Dolomites, Italy"),
    ("1507525428034-b723cf961d3e", "Salt in the air, nowhere to be.", "Goa, India"),
    ("1476514525535-07fb3b4ae5f1", "Somewhere between here and there.", "Lofoten, Norway"),
    ("1500530855697-b586d89ba3ee", "Left the city for this.", "Manali, India"),
    ("1493246507139-91e8fad9978e", "Slow mornings.", "Ubud, Bali"),
    ("1470770841072-f978cf4d019e", "The lake was louder than the city.", "Lake Bled, Slovenia"),
    ("1501785888041-af3ef285b470", "Woke up early for once.", "Kashmir, India"),
    ("1519681393784-d120267933ba", "Cold hands, warm heart.", "Banff, Canada"),
    ("1502082553048-f009c37129b9", "Nothing else mattered up here.", "Yosemite, USA"),
    ("1464822759023-fed622ff2c3b", "Coffee first, then the mountain.", "Chamonix, France"),
    ("1433086966358-54859d0ed716", "Just water and noise.", "Iceland"),
    ("1518098268026-4e89f1a2cd8e", "Made it before the rain.", "Munnar, India"),
    ("1504893524553-b855bce32c67", "Long roads, short stories.", "Ladakh, India"),
    ("1516483638261-f4dbaf036963", "Sunday feels like this.", "Amalfi, Italy"),
    ("1499346030926-9a72daac6c63", "One more reason to stay.", "Santorini, Greece"),
    ("1472214103451-9374bd1c798e", "Green for days.", "Coorg, India"),
    ("1449034446853-66c86144b0ad", "Streetlights and a good song.", "Tokyo, Japan"),
    ("1506744038136-46273834b3fb", "Quiet is underrated.", "Lake Louise, Canada"),
    ("1447752875215-b2761acb3c5d", "Another way home.", "Black Forest, Germany"),
    ("1682687982501-1e58ab814714", "Post-swim thoughts.", "Maldives"),
    ("1508233620467-f79f1e317a05", "Better than the photos.", "Hampi, India"),
    ("1454496522488-7a8e488e8606", "Up before the town.", "Zermatt, Switzerland"),
    ("1526772662000-3f88f10405ff", "Warmer than it looks.", "Rishikesh, India"),
]


@router.post("/seed/posts")
async def seed_posts(x_admin_key: Optional[str] = Header(default=None)):
    """Give every sample profile one post so Discover has a full feed (idempotent; posts are tagged is_seed)."""
    require_admin(x_admin_key)
    import random
    import uuid as _uuid
    from datetime import datetime, timezone, timedelta
    seeds = await db.users.find({"is_seed": True}, {"_id": 0, "id": 1}).to_list(None)
    if not seeds:
        from seed import seed as seed_profiles
        await seed_profiles()
        seeds = await db.users.find({"is_seed": True}, {"_id": 0, "id": 1}).to_list(None)
    rnd = random.Random(11)
    created = 0
    for i, u in enumerate(seeds):
        if await db.posts.count_documents({"user_id": u["id"], "is_seed": True}):
            continue
        pid, caption, place = SAMPLE_POSTS[i % len(SAMPLE_POSTS)]
        at = (datetime.now(timezone.utc) - timedelta(hours=rnd.uniform(1, 240))).isoformat()
        await db.posts.insert_one({
            "id": str(_uuid.uuid4()), "user_id": u["id"], "is_seed": True,
            "image": f"https://images.unsplash.com/photo-{pid}?w=1080&q=80&auto=format&fit=crop",
            "width": 1080, "height": 1620, "caption": caption, "location": place, "created_at": at,
            "likes": rnd.randint(120, 14000), "comments": rnd.randint(4, 420), "shares": rnd.randint(10, 900), "saves": rnd.randint(20, 1300),
        })
        created += 1
    return {"ok": True, "created": created, "total_sample_posts": await db.posts.count_documents({"is_seed": True})}


@router.delete("/seed/posts")
async def unseed_posts(x_admin_key: Optional[str] = Header(default=None)):
    require_admin(x_admin_key)
    ids = [p["id"] for p in await db.posts.find({"is_seed": True}, {"_id": 0, "id": 1}).to_list(None)]
    await db.posts.delete_many({"id": {"$in": ids}})
    for coll in (db.post_likes, db.post_saves, db.post_comments, db.post_hidden):
        await coll.delete_many({"post_id": {"$in": ids}})
    return {"ok": True, "removed": len(ids)}



# ---------- demo data (sample profiles flagged is_seed) ----------
@router.get("/seed")
async def seed_status(x_admin_key: Optional[str] = Header(default=None)):
    require_admin(x_admin_key)
    return {"sample_profiles": await db.users.count_documents({"is_seed": True}),
            "real_users": await db.users.count_documents({"is_seed": {"$ne": True}})}


@router.post("/seed")
async def seed_profiles(likes_for: Optional[str] = None, x_admin_key: Optional[str] = Header(default=None)):
    """Upsert the curated sample profiles (idempotent). Optionally make a few of them like `likes_for` (a phone)."""
    require_admin(x_admin_key)
    from seed import seed as run_seed  # local import: dev tool, only loaded when an operator asks for it
    await run_seed(likes_for)
    return await seed_status(x_admin_key)


@router.delete("/seed")
async def purge_profiles(x_admin_key: Optional[str] = Header(default=None)):
    """Remove every sample profile plus their swipes, matches and messages. Real users are untouched."""
    require_admin(x_admin_key)
    from seed import clear as run_clear
    before = await db.users.count_documents({"is_seed": True})
    await run_clear()
    return {"removed": before, **(await seed_status(x_admin_key))}
