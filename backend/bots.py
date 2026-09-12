"""
Test bots: sample profiles (is_seed) that hold realistic conversations with a real account so chat can be exercised
end to end. Two parts:

  seed_chats_for(user)   -> matches / DM requests / likes / message history between the sample profiles and `user`
  schedule_bot_reply(..) -> when a real person messages a sample profile, the bot "types" and answers a few seconds
                            later through the same WebSocket events as a human reply (so ticks, previews, unread all work)

Everything a bot writes is plain text; nothing here is AI - the replies are picked from fixed scripts.
"""
import asyncio
import random
import uuid
from datetime import datetime, timedelta, timezone

from core import db, now_iso
from ws_manager import manager

# ---------------------------------------------------------------------------- scripts

# Conversation scripts. "b" = bot, "u" = the real user. Rendered oldest -> newest.
SCRIPTS = [
    [("b", "hey! you're the one with the sky photos right?"), ("u", "guilty. the sky just keeps doing things"),
     ("b", "haha fair. marine drive at 6am is undefeated tho"), ("u", "ok that's a strong opinion"),
     ("b", "come see for yourself sometime :)"), ("b", "also what's your coffee order, this matters")],
    [("u", "your catan record cannot be real"), ("b", "37-2. the 2 were when i was sick"),
     ("u", "rematch. i'm bringing snacks"), ("b", "snacks accepted, mercy will not be shown"), ("b", "friday?")],
    [("b", "ok your playlist is actually good"), ("b", "not the 2am half marathon energy i expected"),
     ("u", "the marathon is a cry for help tbh"), ("b", "lmao same. want a running buddy who complains the whole time?")],
    [("b", "just saw your profile, hi 👋"), ("b", "do you actually make your own matcha or is that a flex")],
    [("u", "berlin in winter, worth it?"), ("b", "if you like grey and techno, yes"), ("b", "if you like the sun, no"),
     ("u", "sold. grey it is"), ("b", "i'll send you the good club list. not the tourist one")],
    [("b", "your dog is cuter than you and i think you know that"), ("u", "he knows it too, it's a problem"),
     ("b", "put him on the next call"), ("u", "he charges a fee"), ("b", "treats acceptable?"), ("b", "?")],
    [("b", "ok real talk what's the best street food in your city"), ("u", "vada pav. not up for debate"),
     ("b", "i have notes but i respect the confidence")],
    [("b", "you looked like you were having the best day in that second photo"), ("u", "it was a very good bowl of ramen day"),
     ("b", "the best kind of day. where?"), ("u", "little place near the station, i'll take you"), ("b", "deal 🍜")],
    [("u", "hi! saw we both like museums"), ("b", "yes!! the tiny weird ones especially"),
     ("b", "there's one about locks. just locks."), ("u", "i need to see this"), ("b", "saturday. i'll bring the enthusiasm")],
    [("b", "your bio made me laugh out loud in a quiet office"), ("b", "so thanks for that")],
    [("u", "founder life treating you ok?"), ("b", "sleep is a rumour"), ("b", "but yes, good chaos"),
     ("u", "coffee on me then"), ("b", "you're the first person to offer instead of pitch. yes.")],
    [("b", "hey, this might be random but do you climb?"), ("u", "badly, yes"), ("b", "perfect, so do i. wednesday?")],
]

# Short auto-replies used when the real person messages a bot. Picked so most of them work after anything.
REPLIES = [
    "haha ok fair", "wait really?", "tell me more", "that's actually so cool", "same honestly", "ok i like that",
    "you're funny", "hmm, go on", "noted 📝", "that's a green flag", "ok when?", "i'm in", "lol stop",
    "you can't just say that and leave", "this is why i swiped right", "wait i have a story about that",
    "ok that's my favourite kind of answer", "sounds like a plan", "you're on", "send me a photo of it",
    "hahaha no way", "i knew you'd say that", "big agree", "let's do it this week?", "okay okay, you win this one",
    "what are you doing right now?", "i'm listening", "10/10 answer", "brb, getting coffee ☕", "that made my day",
]
QUESTION_REPLIES = ["yes! definitely", "honestly, not sure yet. you?", "i'd say yes", "maybe... convince me", "depends who's asking 👀"]
GREET_REPLIES = ["hey you 👋", "hi! how's your day going?", "hello hello", "heyy, finally"]
PHOTO_REPLIES = ["oh wow", "ok that's a great photo", "saving that", "you look great", "where is this?"]
POST_REPLIES = ["oh I saw this one", "okay this is so good", "wait where is that", "saving this", "love this post"]


def _hours_ago(h: float) -> str:
    return (datetime.now(timezone.utc) - timedelta(hours=h)).isoformat()


async def _seeds():
    return await db.users.find({"is_seed": True}, {"_id": 0, "id": 1, "name": 1, "photos": 1}).to_list(None)


async def clear_chats_for(user_id: str) -> dict:
    """Remove every match / message / like between the user and sample profiles (keeps the sample profiles)."""
    seed_ids = [s["id"] for s in await _seeds()]
    rows = await db.matches.find({"users": {"$all": [user_id], "$in": seed_ids}}, {"_id": 0, "id": 1}).to_list(None)
    mids = [r["id"] for r in rows]
    msgs = (await db.messages.delete_many({"match_id": {"$in": mids}})).deleted_count
    await db.matches.delete_many({"id": {"$in": mids}})
    sw = (await db.swipes.delete_many({"$or": [{"from_id": user_id, "to_id": {"$in": seed_ids}}, {"from_id": {"$in": seed_ids}, "to_id": user_id}]})).deleted_count
    return {"threads": len(mids), "messages": msgs, "swipes": sw}


async def seed_chats_for(user: dict, reset: bool = True) -> dict:
    """
    Build a full test inbox for `user`:
      - 8 active conversations with history (some with unread bot messages)
      - 2 fresh matches with no messages yet
      - 3 incoming DM requests (bot wrote first, waiting in Requests)
      - 1 outgoing DM request (user wrote first, bot hasn't answered)
      - the remaining sample profiles like the user (Likes tab)
    """
    uid = user["id"]
    if reset:
        await clear_chats_for(uid)
    seeds = await _seeds()
    random.Random(7).shuffle(seeds)
    if len(seeds) < 14:
        raise RuntimeError("Need at least 14 sample profiles (run the sample seed first)")

    convo = seeds[:8]
    fresh = seeds[8:10]
    incoming = seeds[10:13]
    outgoing = seeds[13:14]
    likers = seeds[14:]
    created = {"conversations": 0, "fresh_matches": 0, "incoming_requests": 0, "outgoing_requests": 0, "likes": 0, "messages": 0}

    async def like(a, b, action="like", hours=48):
        await db.swipes.update_one({"from_id": a, "to_id": b}, {"$set": {"from_id": a, "to_id": b, "action": action, "created_at": _hours_ago(hours)},
                                                                 "$setOnInsert": {"id": str(uuid.uuid4())}}, upsert=True)

    async def write(match_id, sender, text, at, read):
        msg = {"id": str(uuid.uuid4()), "match_id": match_id, "sender_id": sender, "text": text, "created_at": at,
               "read_at": at if read else None, "client_id": None}
        await db.messages.insert_one(msg)
        created["messages"] += 1
        return msg

    # ---- conversations with history
    for i, bot in enumerate(convo):
        script = SCRIPTS[i % len(SCRIPTS)]
        base_hours = [1.2, 3, 7, 14, 26, 40, 60, 90][i]  # newest first in the inbox
        await like(bot["id"], uid, "superlike" if i == 2 else "like", base_hours + 6)
        await like(uid, bot["id"], "like", base_hours + 5)
        mid = str(uuid.uuid4())
        n = len(script)
        msgs = []
        for j, (who, text) in enumerate(script):
            sender = bot["id"] if who == "b" else uid
            at = _hours_ago(base_hours + (n - 1 - j) * 0.35)
            msgs.append(await write(mid, sender, text, at, read=True))
        # leave the trailing bot messages unread on threads 0, 1, 3, 5 so the inbox shows bold rows + badges
        unread = 0
        if i in (0, 1, 3, 5):
            for m in reversed(msgs):
                if m["sender_id"] != bot["id"]:
                    break
                await db.messages.update_one({"id": m["id"]}, {"$set": {"read_at": None}})
                unread += 1
        last = msgs[-1]
        await db.matches.insert_one({
            "id": mid, "users": [uid, bot["id"]], "created_at": _hours_ago(base_hours + 5), "active": True,
            "kind": "match", "status": "active", "superlike": i == 2,
            "last_message": {"text": last["text"], "sender_id": last["sender_id"], "created_at": last["created_at"]},
            "last_message_at": last["created_at"], "unread": {uid: unread, bot["id"]: 0},
        })
        created["conversations"] += 1

    # ---- fresh matches, no messages yet
    for k, bot in enumerate(fresh):
        h = 0.5 + k * 2
        await like(bot["id"], uid, "like", h + 1)
        await like(uid, bot["id"], "like", h)
        await db.matches.insert_one({"id": str(uuid.uuid4()), "users": [uid, bot["id"]], "created_at": _hours_ago(h), "active": True,
                                     "kind": "match", "status": "active", "superlike": False, "last_message": None, "last_message_at": None,
                                     "unread": {uid: 0, bot["id"]: 0}})
        created["fresh_matches"] += 1

    # ---- incoming DM requests (bot wrote first)
    openers = ["hey! we keep showing up in the same communities, figured i'd say hi", "your photos are unreal. where was the third one taken?",
               "ok i have to know the story behind your bio"]
    for k, bot in enumerate(incoming):
        h = 2 + k * 9
        mid = str(uuid.uuid4())
        m = await write(mid, bot["id"], openers[k % len(openers)], _hours_ago(h), read=False)
        await db.matches.insert_one({"id": mid, "users": [bot["id"], uid], "created_at": _hours_ago(h), "active": True,
                                     "kind": "dm", "status": "request", "requested_by": bot["id"],
                                     "last_message": {"text": m["text"], "sender_id": bot["id"], "created_at": m["created_at"]},
                                     "last_message_at": m["created_at"], "unread": {uid: 1, bot["id"]: 0}})
        created["incoming_requests"] += 1

    # ---- outgoing DM request (user wrote first, no answer yet)
    for bot in outgoing:
        mid = str(uuid.uuid4())
        m = await write(mid, uid, "hi! loved your profile, are you actually a chef?", _hours_ago(20), read=True)
        await db.matches.insert_one({"id": mid, "users": [uid, bot["id"]], "created_at": _hours_ago(20), "active": True,
                                     "kind": "dm", "status": "request", "requested_by": uid,
                                     "last_message": {"text": m["text"], "sender_id": uid, "created_at": m["created_at"]},
                                     "last_message_at": m["created_at"], "unread": {uid: 0, bot["id"]: 1}})
        created["outgoing_requests"] += 1

    # ---- likes waiting in the Likes tab
    for k, bot in enumerate(likers):
        await like(bot["id"], uid, "superlike" if k == 0 else "like", 1 + k * 5)
        created["likes"] += 1

    return created


# ---------------------------------------------------------------------------- live auto-replies

def _pick_reply(text: str, kind: str) -> str:
    t = (text or "").strip().lower()
    if kind in ("image", "video"):
        return random.choice(PHOTO_REPLIES)
    if kind == "post":
        return random.choice(POST_REPLIES)
    if t in ("hi", "hey", "hello", "heyy", "hii", "yo", "hola") or t.startswith(("hi ", "hey ", "hello ")):
        return random.choice(GREET_REPLIES)
    if t.endswith("?"):
        return random.choice(QUESTION_REPLIES + REPLIES[:6])
    return random.choice(REPLIES)


async def _bot_reply(match_id: str, bot: dict, to_uid: str, text: str, kind: str):
    try:
        delay = random.uniform(2.0, 5.0)
        await asyncio.sleep(delay * 0.35)
        # typing bubble for the rest of the wait
        typing_until = asyncio.get_event_loop().time() + delay * 0.65
        while asyncio.get_event_loop().time() < typing_until:
            await manager.send(to_uid, {"type": "typing", "match_id": match_id, "user_id": bot["id"], "at": now_iso()})
            await asyncio.sleep(1.2)
        match = await db.matches.find_one({"id": match_id, "active": True}, {"_id": 0})
        if not match:
            return
        # the bot reading your message -> Seen ticks
        ts = now_iso()
        await db.messages.update_many({"match_id": match_id, "sender_id": to_uid, "read_at": None}, {"$set": {"read_at": ts}})
        await db.matches.update_one({"id": match_id}, {"$set": {f"unread.{bot['id']}": 0}})
        await manager.send(to_uid, {"type": "read", "match_id": match_id, "by": bot["id"], "read_at": ts})

        reply = _pick_reply(text, kind)
        msg = {"id": str(uuid.uuid4()), "match_id": match_id, "sender_id": bot["id"], "text": reply,
               "created_at": now_iso(), "read_at": None, "client_id": None}
        await db.messages.insert_one(dict(msg))
        update = {"$set": {"last_message": {"text": reply, "sender_id": bot["id"], "created_at": msg["created_at"]},
                           "last_message_at": msg["created_at"]},
                  "$inc": {f"unread.{to_uid}": 1}}
        accepted = False
        if match.get("status") == "request" and match.get("requested_by") == to_uid:
            update["$set"].update({"status": "active", "accepted_at": msg["created_at"]})
            accepted = True
        await db.matches.update_one({"id": match_id}, update)
        await manager.send(to_uid, {"type": "message", "match_id": match_id, "message": msg, "accepted": accepted,
                                    "sender_name": bot.get("name") or "Someone", "sender_photo": (bot.get("photos") or [None])[0]})
    except Exception:
        pass


def schedule_bot_reply(match: dict, other: dict, from_uid: str, text: str, kind: str = "text"):
    """Fire-and-forget: if `other` is a sample profile, it answers shortly. No-op for real people."""
    if not other or not other.get("is_seed"):
        return
    asyncio.get_event_loop().create_task(_bot_reply(match["id"], other, from_uid, text, kind))
