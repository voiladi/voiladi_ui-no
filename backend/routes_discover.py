"""Discovery feed, explore grid, swipes, likes and matching."""
import re
import uuid
from datetime import datetime, timedelta
from typing import Optional, List, Tuple

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel

from core import (db, now, now_iso, get_current_user, public_profile, get_prefs, calc_age, distance_between,
                  ANYWHERE_KM, SHOW_ME_TO_GENDER)
from content import INTERESTS, TOPIC_COVERS
from ws_manager import manager

router = APIRouter(prefix="/api", tags=["discover"])

# Voila (superlike) is scarce on purpose: a fixed weekly allowance makes it mean something.
VOILA_WEEKLY_LIMIT = 5
EXPLORE_TABS = ("all", "near", "new", "popular", "people", "nearby", "creators")
# Explore screen names -> ranking
EXPLORE_ALIAS = {"people": "all", "nearby": "near", "creators": "popular"}


async def voilas_used_this_week(user_id: str) -> int:
    since = (now() - timedelta(days=7)).isoformat()
    return await db.swipes.count_documents({"from_id": user_id, "action": "superlike", "created_at": {"$gte": since}})


# Boost: a 90-minute window during which the profile is ranked first in other people's decks. One boost per 24h.
BOOST_MINUTES = 90
BOOST_COOLDOWN_HOURS = 24


def _boost_active(doc: dict) -> bool:
    until = (doc or {}).get("boost_until")
    return bool(until) and until > now_iso()


def _boost_state(doc: dict) -> dict:
    until = (doc or {}).get("boost_until")
    active = _boost_active(doc)
    next_at = None
    if until and not active:
        try:
            next_at = (datetime.fromisoformat(until) + timedelta(hours=BOOST_COOLDOWN_HOURS - BOOST_MINUTES / 60)).isoformat()
        except ValueError:
            next_at = None
    return {"boost_active": active, "boost_until": until if active else None, "boost_next_at": next_at if next_at and next_at > now_iso() else None}


class ReactionIn(BaseModel):
    """A like tied to a specific photo or prompt (Hinge-style)."""
    type: str  # photo | prompt
    photo: Optional[str] = None
    question: Optional[str] = None


class SwipeIn(BaseModel):
    target_id: str
    action: str  # like | pass | superlike
    reaction: Optional[ReactionIn] = None


def _clean_reaction(reaction: Optional[ReactionIn], target: dict) -> Optional[dict]:
    """Validate the reaction against the target's real photos/prompts and return a storable dict."""
    if reaction is None:
        return None
    if reaction.type == "photo":
        photos = target.get("photos") or []
        if not reaction.photo or reaction.photo not in photos:
            raise HTTPException(status_code=400, detail="That photo isn't on their profile anymore")
        return {"type": "photo", "photo": reaction.photo, "index": photos.index(reaction.photo)}
    if reaction.type == "prompt":
        q = (reaction.question or "").strip()
        match = next((p for p in (target.get("prompts") or []) if p.get("question") == q), None)
        if not match:
            raise HTTPException(status_code=400, detail="That prompt isn't on their profile anymore")
        return {"type": "prompt", "question": match["question"], "answer": match.get("answer", "")}
    raise HTTPException(status_code=400, detail="Invalid reaction")


def reaction_caption(reaction: dict) -> str:
    return "Liked your photo" if reaction.get("type") == "photo" else "Liked your answer"


def _reaction_message(match_id: str, sender_id: str, reaction: dict, created_at: str) -> dict:
    return {
        "id": str(uuid.uuid4()), "match_id": match_id, "sender_id": sender_id, "kind": "reaction",
        "text": reaction_caption(reaction), "reaction": reaction, "created_at": created_at, "read_at": None, "client_id": None,
    }


async def _seed_reaction_messages(match: dict, entries: list) -> None:
    """Insert reaction messages (in order) as the opening of a brand-new match and update previews/unread."""
    if not entries:
        return
    base = now()
    last = None
    for i, (sender_id, reaction) in enumerate(entries):
        ts = (base + timedelta(milliseconds=i)).isoformat()
        msg = _reaction_message(match["id"], sender_id, reaction, ts)
        await db.messages.insert_one(dict(msg))
        receiver = [u for u in match["users"] if u != sender_id][0]
        await db.matches.update_one({"id": match["id"]}, {"$inc": {f"unread.{receiver}": 1}})
        last = msg
        payload = {"type": "message", "match_id": match["id"], "message": msg}
        await manager.send(receiver, payload)
        await manager.send(sender_id, payload)
    await db.matches.update_one({"id": match["id"]}, {"$set": {
        "last_message": {"text": last["text"], "sender_id": last["sender_id"], "created_at": last["created_at"], "kind": "reaction"},
        "last_message_at": last["created_at"],
    }})


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


def _pref_boost(viewer: dict, candidate: dict) -> int:
    """Filters page extras (interests + relationship goals) nudge the ranking; they never empty the feed."""
    prefs = get_prefs(viewer)
    boost = 0
    wanted = set(i.lower() for i in (prefs.get("interests") or []))
    if wanted:
        theirs = set(i.lower() for i in (candidate.get("interests") or []))
        boost += min(12, 4 * len(wanted & theirs))
    goals = prefs.get("goals") or []
    if goals and candidate.get("relationship_goal") in goals:
        boost += 8
    return boost


async def _candidates(user: dict) -> List[Tuple[int, dict, dict]]:
    """Everyone the viewer may see (mutual preference match), as (rank, public_profile, raw_doc)."""
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
        rank = p["compatibility"] + (12 if c["id"] in liked_me else 0) + _pref_boost(user, c)
        if _boost_active(c):
            rank += 40  # Boost: be seen by more people -> boosted profiles surface first
        scored.append((rank, p, c))
    scored.sort(key=lambda t: t[0], reverse=True)
    return scored


@router.get("/discover")
async def discover(limit: int = 20, user=Depends(get_current_user)):
    await db.users.update_one({"id": user["id"]}, {"$set": {"last_active": now_iso()}})
    scored = await _candidates(user)
    page = [p for _, p, _ in scored[:limit]]
    if page:
        # Being served in someone's deck counts as a profile view (shown as "Profile views" on the profile page).
        await db.users.update_many({"id": {"$in": [p["id"] for p in page]}}, {"$inc": {"profile_views": 1}})
    return {"profiles": page, "total": len(scored)}


@router.get("/explore")
async def explore(tab: str = "all", limit: int = 40, user=Depends(get_current_user)):
    """Grid of people for the Explore tab. all=best match, near=closest first, new=recently joined, popular=most liked."""
    if tab not in EXPLORE_TABS:
        raise HTTPException(status_code=400, detail="Unknown tab")
    tab = EXPLORE_ALIAS.get(tab, tab)
    scored = await _candidates(user)
    if tab == "near":
        scored = [t for t in scored if t[1].get("distance_km") is not None]
        scored.sort(key=lambda t: (t[1]["distance_km"], -t[0]))
    elif tab == "new":
        scored.sort(key=lambda t: t[2].get("created_at") or "", reverse=True)
    elif tab == "popular":
        ids = [c["id"] for _, _, c in scored]
        counts = {}
        if ids:
            rows = await db.swipes.aggregate([
                {"$match": {"to_id": {"$in": ids}, "action": {"$in": ["like", "superlike"]}}},
                {"$group": {"_id": "$to_id", "n": {"$sum": 1}}},
            ]).to_list(None)
            counts = {r["_id"]: r["n"] for r in rows}
        for _, p, c in scored:
            p["likes_count"] = counts.get(c["id"], 0)
        scored.sort(key=lambda t: (t[1]["likes_count"], t[0]), reverse=True)
    return {"profiles": [p for _, p, _ in scored[:limit]], "total": len(scored), "tab": tab}


def _compact(n: int) -> str:
    if n >= 1_000_000:
        return f"{n / 1_000_000:.1f}".rstrip("0").rstrip(".") + "M"
    if n >= 1_000:
        return f"{n / 1_000:.1f}".rstrip("0").rstrip(".") + "K"
    return str(n)


async def _topic_rows(user: dict):
    """Interest communities: every curated interest with how many real members share it (excluding blocked people)."""
    blocks = await db.blocks.find({"$or": [{"from_id": user["id"]}, {"to_id": user["id"]}]}, {"_id": 0}).to_list(None)
    hidden = set()
    for b in blocks:
        hidden.add(b["from_id"])
        hidden.add(b["to_id"])
    hidden.discard(user["id"])
    rows = await db.users.aggregate([
        {"$match": {"onboarded": True, "id": {"$nin": list(hidden)}, "interests": {"$exists": True, "$ne": []}}},
        {"$unwind": "$interests"},
        {"$group": {"_id": "$interests", "members": {"$sum": 1}, "photo": {"$first": {"$arrayElemAt": ["$photos", 0]}}}},
    ]).to_list(None)
    counts = {r["_id"]: r for r in rows}
    mine = set(user.get("interests") or [])
    topics = []
    for name in INTERESTS:
        r = counts.get(name, {})
        n = int(r.get("members") or 0)
        topics.append({
            "name": name,
            "members": n,
            "members_label": f"{_compact(n)} member" + ("" if n == 1 else "s"),
            "cover": TOPIC_COVERS.get(name) or r.get("photo") or None,
            "joined": name in mine,
        })
    topics.sort(key=lambda t: (-t["members"], INTERESTS.index(t["name"])))
    return topics


@router.get("/search")
async def search(q: str, limit: int = 20, user=Depends(get_current_user)):
    """
    Instagram-style search across EVERY account (not just your Discover candidates): @username prefix first,
    then name matches, then anything containing the term. Also returns matching communities.
    """
    term = (q or "").strip().lstrip("@").lower()
    if not term:
        return {"q": term, "profiles": [], "topics": []}
    limit = max(1, min(limit, 40))
    rx = re.escape(term)

    blocks = await db.blocks.find({"$or": [{"from_id": user["id"]}, {"to_id": user["id"]}]}, {"_id": 0}).to_list(None)
    hidden = set()
    for b in blocks:
        hidden.add(b["from_id"])
        hidden.add(b["to_id"])
    hidden.discard(user["id"])

    rows = await db.users.find(
        {"onboarded": True, "id": {"$nin": list(hidden)},
         "$or": [{"username": {"$regex": rx}}, {"name": {"$regex": rx, "$options": "i"}}]},
        {"_id": 0},
    ).limit(120).to_list(None)

    def rank(u):
        un = (u.get("username") or "").lower()
        nm = (u.get("name") or "").lower()
        if un == term:
            return 0
        if un.startswith(term):
            return 1
        if nm.startswith(term):
            return 2
        if term in un:
            return 3
        return 4

    rows.sort(key=lambda u: (rank(u), (u.get("username") or ""), (u.get("name") or "")))
    rows = rows[:limit]

    ids = [u["id"] for u in rows]
    liked = set(s["to_id"] for s in await db.swipes.find(
        {"from_id": user["id"], "to_id": {"$in": ids}, "action": {"$in": ["like", "superlike"]}}, {"_id": 0, "to_id": 1}).to_list(None))
    matched = set()
    for m in await db.matches.find({"users": user["id"], "active": True}, {"_id": 0, "users": 1}).to_list(None):
        for uid in m.get("users", []):
            matched.add(uid)

    profiles = []
    for u in rows:
        p = public_profile(u, user)
        p["is_me"] = u["id"] == user["id"]
        p["followed"] = u["id"] in liked
        p["matched"] = u["id"] in matched
        profiles.append(p)

    topics = [t for t in await _topic_rows(user) if term in t["name"].lower()][:6]
    return {"q": term, "profiles": profiles, "topics": topics}


@router.get("/explore/topics")
async def explore_topics(user=Depends(get_current_user)):
    """Communities for the Explore tab: trending (top 4), popular (top 10 chips) and the full list."""
    topics = await _topic_rows(user)
    return {"trending": topics[:4], "popular": topics[:10], "topics": topics}


@router.get("/explore/topics/{name}")
async def explore_topic(name: str, limit: int = 40, user=Depends(get_current_user)):
    """People in one community (mutual preference match), best match first."""
    if name not in INTERESTS:
        raise HTTPException(status_code=404, detail="Unknown community")
    scored = await _candidates(user)
    people = [p for _, p, c in scored if name in (c.get("interests") or [])]
    total = await db.users.count_documents({"onboarded": True, "interests": name})
    return {"name": name, "members": total, "members_label": f"{_compact(total)} member" + ("" if total == 1 else "s"),
            "cover": TOPIC_COVERS.get(name), "joined": name in (user.get("interests") or []), "profiles": people[:limit]}


@router.post("/swipe")
async def swipe(body: SwipeIn, user=Depends(get_current_user)):
    if body.action not in ("like", "pass", "superlike"):
        raise HTTPException(status_code=400, detail="Invalid action")
    if body.target_id == user["id"]:
        raise HTTPException(status_code=400, detail="Nice try")
    target = await db.users.find_one({"id": body.target_id}, {"_id": 0})
    if not target:
        raise HTTPException(status_code=404, detail="Profile not found")
    reaction = _clean_reaction(body.reaction, target) if body.action != "pass" else None
    if body.action == "superlike":
        previous = await db.swipes.find_one({"from_id": user["id"], "to_id": target["id"], "action": "superlike"}, {"_id": 0})
        if not previous and await voilas_used_this_week(user["id"]) >= VOILA_WEEKLY_LIMIT:
            raise HTTPException(status_code=400, detail=f"You've used all {VOILA_WEEKLY_LIMIT} Super Likes this week. They reset weekly.")
    swipe_doc = {"from_id": user["id"], "to_id": target["id"], "action": body.action, "created_at": now_iso(), "reaction": reaction}
    await db.swipes.update_one(
        {"from_id": user["id"], "to_id": target["id"]},
        {"$set": swipe_doc, "$setOnInsert": {"id": str(uuid.uuid4())}},
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
            fresh_match = False
            if existing and existing.get("active"):
                match = existing
                if existing.get("kind") == "dm":
                    # they were already talking (or one had sent a request) - a mutual like turns it into a real match
                    await db.matches.update_one({"id": existing["id"]}, {"$set": {"kind": "match", "status": "active", "accepted_at": now_iso(), "matched_at": now_iso()}})
                    match = {**existing, "kind": "match", "status": "active"}
                    fresh_match = True
            elif existing:
                await db.matches.update_one({"id": existing["id"]}, {"$set": {"active": True, "created_at": now_iso(), "kind": "match", "status": "active"}})
                match = {**existing, "active": True, "kind": "match", "status": "active"}
                fresh_match = True
            else:
                match = {
                    "id": str(uuid.uuid4()), "users": [user["id"], target["id"]], "created_at": now_iso(),
                    "active": True, "last_message": None, "last_message_at": None,
                    "unread": {user["id"]: 0, target["id"]: 0},
                    "superlike": body.action == "superlike" or reciprocal.get("action") == "superlike",
                }
                await db.matches.insert_one(dict(match))
                fresh_match = True
            if fresh_match:
                # Their earlier reaction opens the chat first, then ours.
                entries = []
                if reciprocal.get("reaction"):
                    entries.append((target["id"], reciprocal["reaction"]))
                if reaction:
                    entries.append((user["id"], reaction))
                await _seed_reaction_messages(match, entries)
            matched = True
            match_out = {"id": match["id"], "created_at": match["created_at"], "user": public_profile(target, user),
                         "reaction": reaction, "their_reaction": reciprocal.get("reaction")}
            await manager.send(target["id"], {"type": "new_match", "match": {
                "id": match["id"], "created_at": match["created_at"], "user": public_profile(user, target)}})
    return {"matched": matched, "match": match_out}


@router.get("/me/stats")
async def my_stats(user=Depends(get_current_user)):
    """Real numbers for the profile page: matches, likes, views and the weekly Super Like allowance."""
    matches = await db.matches.count_documents({"users": user["id"], "active": True, "kind": {"$ne": "dm"}})
    likes_received = await db.swipes.count_documents({"to_id": user["id"], "action": {"$in": ["like", "superlike"]}})
    likes_sent = await db.swipes.count_documents({"from_id": user["id"], "action": {"$in": ["like", "superlike"]}})
    used = await voilas_used_this_week(user["id"])
    fresh = await db.users.find_one({"id": user["id"]}, {"_id": 0, "profile_views": 1, "boost_until": 1})
    return {
        "matches": matches,
        "likes_received": likes_received,
        "likes_sent": likes_sent,
        "followers": likes_received,
        "following": likes_sent,
        "profile_views": int((fresh or {}).get("profile_views") or 0),
        "voilas_used_week": used,
        "voilas_left": max(0, VOILA_WEEKLY_LIMIT - used),
        "voila_weekly_limit": VOILA_WEEKLY_LIMIT,
        **_boost_state(fresh),
    }


@router.post("/me/boost")
async def start_boost(user=Depends(get_current_user)):
    """Start a Boost (profile shown first to others for BOOST_MINUTES). One per BOOST_COOLDOWN_HOURS."""
    fresh = await db.users.find_one({"id": user["id"]}, {"_id": 0, "boost_until": 1})
    state = _boost_state(fresh)
    if state["boost_active"]:
        raise HTTPException(400, "Boost is already running")
    if state["boost_next_at"]:
        raise HTTPException(400, "You can boost once a day. Come back later.")
    until = (now() + timedelta(minutes=BOOST_MINUTES)).isoformat()
    await db.users.update_one({"id": user["id"]}, {"$set": {"boost_until": until}})
    return {"ok": True, "boost_active": True, "boost_until": until, "boost_next_at": None}


async def _blocked_ids(uid: str) -> set:
    blocks = await db.blocks.find({"$or": [{"from_id": uid}, {"to_id": uid}]}, {"_id": 0}).to_list(None)
    out = set()
    for b in blocks:
        out.add(b["from_id"])
        out.add(b["to_id"])
    return out


@router.get("/likes/received")
async def likes_received(user=Depends(get_current_user)):
    """People who liked you and are still waiting on your answer."""
    my_swipes = set(s["to_id"] for s in await db.swipes.find({"from_id": user["id"]}, {"_id": 0, "to_id": 1}).to_list(None))
    blocked = await _blocked_ids(user["id"])
    likes = await db.swipes.find({"to_id": user["id"], "action": {"$in": ["like", "superlike"]}}, {"_id": 0}) \
        .sort("created_at", -1).to_list(200)
    ids = [l["from_id"] for l in likes if l["from_id"] not in my_swipes and l["from_id"] not in blocked]
    users = {u["id"]: u for u in await db.users.find({"id": {"$in": ids}, "profile_complete": True, "onboarded": True}, {"_id": 0}).to_list(None)}
    out = []
    for l in likes:
        u = users.get(l["from_id"])
        if not u:
            continue
        out.append({"user": public_profile(u, user), "superlike": l["action"] == "superlike", "created_at": l["created_at"],
                    "reaction": l.get("reaction"), "direction": "received"})
    return {"likes": out, "count": len(out)}


@router.get("/likes/sent")
async def likes_sent(user=Depends(get_current_user)):
    """People you liked (with whether it already turned into a match)."""
    blocked = await _blocked_ids(user["id"])
    likes = await db.swipes.find({"from_id": user["id"], "action": {"$in": ["like", "superlike"]}}, {"_id": 0}) \
        .sort("created_at", -1).to_list(200)
    ids = [l["to_id"] for l in likes if l["to_id"] not in blocked]
    users = {u["id"]: u for u in await db.users.find({"id": {"$in": ids}}, {"_id": 0}).to_list(None)}
    matches = await db.matches.find({"users": user["id"], "active": True}, {"_id": 0, "users": 1, "id": 1}).to_list(None)
    matched = {}
    for m in matches:
        for other in m["users"]:
            if other != user["id"]:
                matched[other] = m["id"]
    out = []
    for l in likes:
        u = users.get(l["to_id"])
        if not u:
            continue
        out.append({"user": public_profile(u, user), "superlike": l["action"] == "superlike", "created_at": l["created_at"],
                    "reaction": l.get("reaction"), "direction": "sent", "match_id": matched.get(l["to_id"])})
    return {"likes": out, "count": len(out)}
