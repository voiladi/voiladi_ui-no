"""
Posts + the Discover feed.

A post is one photo with a caption and a place, published from the Profile "+" button. Discover shows
everyone's posts full-screen, newest first, one per screen.

Collections
  posts          id, user_id, image (/api/uploads/...), width, height, caption, location, created_at,
                 likes, comments, shares, saves (denormalised counters)
  post_likes     post_id + user_id (unique)
  post_saves     post_id + user_id (unique)         -> "Saved" list on the profile
  post_comments  id, post_id, user_id, text, created_at
  post_hidden    post_id + user_id (unique)         -> "Not interested"
  reports        kind="post" rows land in the same moderation queue as profile reports

"Follow" on a post is the app's existing like-swipe (POST /api/swipe) - it is what drives the
followers / following numbers on the profile - so the feed only reports `followed` per author.
"""
import asyncio
import uuid
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from pydantic import BaseModel

from core import db, now_iso, get_current_user, public_profile, is_verified, UPLOAD_DIR
from routes_profile import optimize_image, ALLOWED_TYPES, MAX_UPLOAD
from routes_chat import _get_match, _other, _is_request_for, _blocked_between
from ws_manager import manager

router = APIRouter(prefix="/api", tags=["posts"])

CAPTION_MAX = 300
LOCATION_MAX = 80
COMMENT_MAX = 500
FEED_PAGE = 8


class CommentIn(BaseModel):
    text: str


class ShareIn(BaseModel):
    match_id: str


class ReportIn(BaseModel):
    reason: str
    details: Optional[str] = ""


def _author(u: Optional[dict]) -> dict:
    if not u:
        return {"id": "", "name": "Someone", "username": "", "photo": None, "verified": False}
    return {
        "id": u["id"],
        "name": u.get("name") or "Someone",
        "username": u.get("username") or "",
        "photo": (u.get("photos") or [None])[0],
        "verified": is_verified(u),
        "city": u.get("city") or "",
    }


async def _decorate(posts: List[dict], viewer: dict) -> List[dict]:
    """Attach author + viewer flags (liked / saved / followed / mine) to a list of raw post rows."""
    if not posts:
        return []
    uid = viewer["id"]
    pids = [p["id"] for p in posts]
    author_ids = list({p["user_id"] for p in posts})
    users = {u["id"]: u for u in await db.users.find({"id": {"$in": author_ids}}, {"_id": 0}).to_list(None)}
    liked = {r["post_id"] for r in await db.post_likes.find({"user_id": uid, "post_id": {"$in": pids}}, {"_id": 0, "post_id": 1}).to_list(None)}
    saved = {r["post_id"] for r in await db.post_saves.find({"user_id": uid, "post_id": {"$in": pids}}, {"_id": 0, "post_id": 1}).to_list(None)}
    followed = {r["to_id"] for r in await db.swipes.find(
        {"from_id": uid, "to_id": {"$in": author_ids}, "action": {"$in": ["like", "superlike"]}}, {"_id": 0, "to_id": 1}).to_list(None)}
    out = []
    for p in posts:
        row = {k: v for k, v in p.items() if k != "_id"}
        row["author"] = _author(users.get(p["user_id"]))
        row["liked"] = p["id"] in liked
        row["saved"] = p["id"] in saved
        row["followed"] = p["user_id"] in followed
        row["mine"] = p["user_id"] == uid
        row.setdefault("kind", "image")
        row.setdefault("status", "ready")
        row.setdefault("video", None)
        row.setdefault("duration", None)
        for k in ("likes", "comments", "shares", "saves"):
            row[k] = int(row.get(k) or 0)
        out.append(row)
    return out


async def _get_post(post_id: str) -> dict:
    post = await db.posts.find_one({"id": post_id}, {"_id": 0})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    return post


async def _blocked_ids(uid: str) -> set:
    rows = await db.blocks.find({"$or": [{"from_id": uid}, {"to_id": uid}]}, {"_id": 0}).to_list(None)
    out = set()
    for b in rows:
        out.add(b["from_id"])
        out.add(b["to_id"])
    out.discard(uid)
    return out


# ------------------------------------------------------------------ feed

@router.get("/posts/feed")
async def feed(before: Optional[str] = None, limit: int = FEED_PAGE, scope: str = "all", user=Depends(get_current_user)):
    """Discover: everyone's posts, newest first, minus your own, hidden ones and blocked people. Cursor = created_at.
    scope=circle -> only people you follow (your like-swipes)."""
    uid = user["id"]
    limit = max(1, min(limit, 20))
    hidden = [r["post_id"] for r in await db.post_hidden.find({"user_id": uid}, {"_id": 0, "post_id": 1}).to_list(None)]
    blocked = list(await _blocked_ids(uid))
    q = {"user_id": {"$nin": blocked + [uid]}, "status": {"$nin": ["processing", "failed"]}}
    if scope == "circle":
        followed = [r["to_id"] for r in await db.swipes.find({"from_id": uid, "action": {"$in": ["like", "superlike"]}}, {"_id": 0, "to_id": 1}).to_list(None)]
        followed = [f for f in followed if f not in blocked]
        if not followed:
            return {"posts": [], "next": None}
        q["user_id"] = {"$in": followed}
    if hidden:
        q["id"] = {"$nin": hidden}
    if before:
        q["created_at"] = {"$lt": before}
    rows = await db.posts.find(q, {"_id": 0}).sort("created_at", -1).to_list(limit)
    posts = await _decorate(rows, user)
    return {"posts": posts, "next": rows[-1]["created_at"] if len(rows) >= limit else None}


@router.get("/posts/mine")
async def my_posts(user=Depends(get_current_user)):
    rows = await db.posts.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(200)
    return {"posts": await _decorate(rows, user)}


@router.get("/posts/saved")
async def saved_posts(user=Depends(get_current_user)):
    saves = await db.post_saves.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(300)
    ids = [s["post_id"] for s in saves]
    rows = {p["id"]: p for p in await db.posts.find({"id": {"$in": ids}}, {"_id": 0}).to_list(None)}
    ordered = [rows[i] for i in ids if i in rows]
    return {"posts": await _decorate(ordered, user)}


@router.get("/users/{user_id}/posts")
async def user_posts(user_id: str, user=Depends(get_current_user)):
    if user_id != user["id"] and await _blocked_between(user["id"], user_id):
        return {"posts": []}
    rows = await db.posts.find({"user_id": user_id}, {"_id": 0}).sort("created_at", -1).to_list(200)
    return {"posts": await _decorate(rows, user)}


# ------------------------------------------------------------------ create / delete

@router.post("/posts", status_code=201)
async def create_post(file: UploadFile = File(...), caption: str = Form(""), location: str = Form(""), user=Depends(get_current_user)):
    ctype = (file.content_type or "").lower()
    if ctype not in ALLOWED_TYPES:
        raise HTTPException(status_code=400, detail="Only JPG, PNG, WEBP, GIF or HEIC images are allowed")
    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="That file looks empty")
    if len(data) > MAX_UPLOAD:
        raise HTTPException(status_code=400, detail="Image must be under 8MB")
    caption = (caption or "").strip()
    location = (location or "").strip()
    if len(caption) > CAPTION_MAX:
        raise HTTPException(status_code=400, detail=f"Keep the caption under {CAPTION_MAX} characters")
    if len(location) > LOCATION_MAX:
        raise HTTPException(status_code=400, detail="That place name is too long")
    data, ext = await asyncio.to_thread(optimize_image, data, ctype)
    # dimensions (for the skeleton aspect while the photo loads)
    width = height = None
    try:
        from io import BytesIO
        from PIL import Image
        with Image.open(BytesIO(data)) as img:
            width, height = img.size
    except Exception:
        pass
    fname = f"p_{user['id']}_{uuid.uuid4().hex}.{ext}"
    (UPLOAD_DIR / fname).write_bytes(data)
    post = {
        "id": str(uuid.uuid4()), "user_id": user["id"], "image": f"/api/uploads/{fname}", "width": width, "height": height,
        "caption": caption, "location": location, "created_at": now_iso(),
        "likes": 0, "comments": 0, "shares": 0, "saves": 0,
    }
    await db.posts.insert_one(dict(post))
    return (await _decorate([post], user))[0]


@router.delete("/posts/{post_id}")
async def delete_post(post_id: str, user=Depends(get_current_user)):
    post = await _get_post(post_id)
    if post["user_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="You can only delete your own posts")
    await db.posts.delete_one({"id": post_id})
    await asyncio.gather(
        db.post_likes.delete_many({"post_id": post_id}),
        db.post_saves.delete_many({"post_id": post_id}),
        db.post_comments.delete_many({"post_id": post_id}),
        db.post_hidden.delete_many({"post_id": post_id}),
    )
    if (post.get("image") or "").startswith("/api/uploads/"):
        try:
            name = post["image"].rsplit("/", 1)[-1]
            (UPLOAD_DIR / name).unlink(missing_ok=True)
            for w in (240, 480, 800):
                (UPLOAD_DIR / "_thumbs" / f"w{w}_{name}").unlink(missing_ok=True)
        except Exception:
            pass
    if post.get("kind") == "video":
        from routes_media import MEDIA_DIR
        for f in (f"{post_id}.mp4", f"{post_id}_poster.jpg"):
            (MEDIA_DIR / f).unlink(missing_ok=True)
    return {"ok": True}


@router.get("/posts/{post_id}")
async def get_post(post_id: str, user=Depends(get_current_user)):
    post = await _get_post(post_id)
    if post["user_id"] != user["id"] and await _blocked_between(user["id"], post["user_id"]):
        raise HTTPException(status_code=404, detail="Post not found")
    return (await _decorate([post], user))[0]


# ------------------------------------------------------------------ video posts (chunked upload, ffmpeg -> 720p mp4 + poster)

POST_VIDEO_MAX_SECONDS = 60
POST_VIDEO_MAX_BYTES = 300 * 1024 * 1024


class VideoInitIn(BaseModel):
    content_type: str
    size: int
    duration: Optional[float] = None
    caption: str = ""
    location: str = ""


@router.post("/posts/video/init")
async def post_video_init(body: VideoInitIn, user=Depends(get_current_user)):
    """Step 1 of a video post. Chunks then go to PUT /api/media/{upload_id}/chunk (shared with chat media)."""
    from routes_media import VIDEO_TYPES, CHUNK_MAX, TMP_DIR
    import time
    ct = body.content_type.lower().split(";")[0].strip()
    if ct not in VIDEO_TYPES:
        raise HTTPException(status_code=400, detail="Only videos can be uploaded here")
    if body.size <= 0:
        raise HTTPException(status_code=400, detail="Empty file")
    if body.size > POST_VIDEO_MAX_BYTES:
        raise HTTPException(status_code=413, detail="That video is too large (max 300 MB)")
    if body.duration and body.duration > POST_VIDEO_MAX_SECONDS + 1:
        raise HTTPException(status_code=400, detail=f"Videos can be up to {POST_VIDEO_MAX_SECONDS} seconds")
    caption, location = (body.caption or "").strip(), (body.location or "").strip()
    if len(caption) > CAPTION_MAX:
        raise HTTPException(status_code=400, detail=f"Keep the caption under {CAPTION_MAX} characters")
    if len(location) > LOCATION_MAX:
        raise HTTPException(status_code=400, detail="That place name is too long")
    upload_id = str(uuid.uuid4())
    await db.media_uploads.insert_one({
        "id": upload_id, "user_id": user["id"], "match_id": None, "purpose": "post", "kind": "video", "content_type": ct,
        "size": body.size, "view_once": False, "client_id": None, "caption": caption, "location": location,
        "received": 0, "chunks": 0, "created_at": now_iso(), "ts": time.time(),
    })
    (TMP_DIR / upload_id).mkdir(parents=True, exist_ok=True)
    return {"upload_id": upload_id, "chunk_size": CHUNK_MAX}


async def _finish_post_video(post_id: str, raw, dst, poster, upload_id: str):
    import shutil
    from routes_media import _transcode_video, _transcode_sem, TMP_DIR, public_url, QUALITY_TIERS
    try:
        async with _transcode_sem:
            meta = await _transcode_video(raw, dst, poster, QUALITY_TIERS[720])
        if meta.get("duration", 0) > POST_VIDEO_MAX_SECONDS + 1:
            raise ValueError(f"Videos can be up to {POST_VIDEO_MAX_SECONDS} seconds")
        await db.posts.update_one({"id": post_id}, {"$set": {
            "status": "ready", "width": meta.get("width"), "height": meta.get("height"), "duration": meta.get("duration"),
            "image": public_url(poster.name) if poster.exists() else None,
        }})
    except Exception as e:
        await db.posts.update_one({"id": post_id}, {"$set": {"status": "failed", "error": str(e)[:160]}})
        dst.unlink(missing_ok=True)
    finally:
        shutil.rmtree(TMP_DIR / upload_id, ignore_errors=True)
        await db.media_uploads.delete_one({"id": upload_id})
    post = await db.posts.find_one({"id": post_id}, {"_id": 0})
    if post:
        await manager.send(post["user_id"], {"type": "post_ready", "post_id": post_id, "status": post.get("status")})


@router.post("/posts/video/{upload_id}/complete", status_code=201)
async def post_video_complete(upload_id: str, user=Depends(get_current_user)):
    """Step 3: assemble the chunks and create the post. It shows in the feed once ffmpeg has finished (status ready)."""
    from routes_media import _assemble, MEDIA_DIR, public_url
    up = await db.media_uploads.find_one({"id": upload_id, "user_id": user["id"], "purpose": "post"}, {"_id": 0})
    if not up:
        raise HTTPException(status_code=404, detail="Upload not found")
    if up["received"] < up["size"]:
        raise HTTPException(status_code=400, detail="Upload incomplete")
    raw = await asyncio.to_thread(_assemble, upload_id)
    post_id = str(uuid.uuid4())
    fname, pname = f"{post_id}.mp4", f"{post_id}_poster.jpg"
    post = {
        "id": post_id, "user_id": user["id"], "kind": "video", "status": "processing",
        "video": public_url(fname), "image": None, "width": None, "height": None, "duration": None,
        "caption": up.get("caption") or "", "location": up.get("location") or "", "created_at": now_iso(),
        "likes": 0, "comments": 0, "shares": 0, "saves": 0,
    }
    await db.posts.insert_one(dict(post))
    asyncio.create_task(_finish_post_video(post_id, raw, MEDIA_DIR / fname, MEDIA_DIR / pname, upload_id))
    return (await _decorate([post], user))[0]



async def _toggle(coll, counter: str, post: dict, uid: str) -> dict:
    key = {"post_id": post["id"], "user_id": uid}
    existing = await coll.find_one(key, {"_id": 0})
    if existing:
        await coll.delete_one(key)
        await db.posts.update_one({"id": post["id"], counter: {"$gt": 0}}, {"$inc": {counter: -1}})
        on = False
    else:
        await coll.update_one(key, {"$setOnInsert": {**key, "created_at": now_iso()}}, upsert=True)
        await db.posts.update_one({"id": post["id"]}, {"$inc": {counter: 1}})
        on = True
    fresh = await db.posts.find_one({"id": post["id"]}, {"_id": 0, counter: 1})
    return {"on": on, "count": int((fresh or {}).get(counter) or 0)}


@router.post("/posts/{post_id}/like")
async def toggle_like(post_id: str, user=Depends(get_current_user)):
    post = await _get_post(post_id)
    r = await _toggle(db.post_likes, "likes", post, user["id"])
    return {"liked": r["on"], "likes": r["count"]}


@router.post("/posts/{post_id}/save")
async def toggle_save(post_id: str, user=Depends(get_current_user)):
    post = await _get_post(post_id)
    r = await _toggle(db.post_saves, "saves", post, user["id"])
    return {"saved": r["on"], "saves": r["count"]}


@router.post("/posts/{post_id}/hide")
async def hide_post(post_id: str, user=Depends(get_current_user)):
    """Not interested: this post never shows in your Discover again."""
    await _get_post(post_id)
    await db.post_hidden.update_one({"post_id": post_id, "user_id": user["id"]},
                                    {"$setOnInsert": {"post_id": post_id, "user_id": user["id"], "created_at": now_iso()}}, upsert=True)
    return {"ok": True}


@router.post("/posts/{post_id}/report")
async def report_post(post_id: str, body: ReportIn, user=Depends(get_current_user)):
    post = await _get_post(post_id)
    if post["user_id"] == user["id"]:
        raise HTTPException(status_code=400, detail="Invalid report")
    await db.reports.insert_one({"id": str(uuid.uuid4()), "kind": "post", "post_id": post_id, "from_id": user["id"], "to_id": post["user_id"],
                                 "status": "open", "reason": body.reason[:100], "details": (body.details or "")[:500], "created_at": now_iso()})
    # reporting also hides it for you
    await db.post_hidden.update_one({"post_id": post_id, "user_id": user["id"]},
                                    {"$setOnInsert": {"post_id": post_id, "user_id": user["id"], "created_at": now_iso()}}, upsert=True)
    return {"ok": True}


# ------------------------------------------------------------------ comments

@router.get("/posts/{post_id}/comments")
async def list_comments(post_id: str, user=Depends(get_current_user)):
    await _get_post(post_id)
    rows = await db.post_comments.find({"post_id": post_id}, {"_id": 0}).sort("created_at", 1).to_list(500)
    ids = list({c["user_id"] for c in rows})
    users = {u["id"]: u for u in await db.users.find({"id": {"$in": ids}}, {"_id": 0}).to_list(None)}
    out = [{**c, "author": _author(users.get(c["user_id"])), "mine": c["user_id"] == user["id"]} for c in rows]
    return {"comments": out, "count": len(out)}


@router.post("/posts/{post_id}/comments")
async def add_comment(post_id: str, body: CommentIn, user=Depends(get_current_user)):
    post = await _get_post(post_id)
    text = body.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="Write something first")
    if len(text) > COMMENT_MAX:
        raise HTTPException(status_code=400, detail=f"Keep it under {COMMENT_MAX} characters")
    if post["user_id"] != user["id"] and await _blocked_between(user["id"], post["user_id"]):
        raise HTTPException(status_code=403, detail="You can't comment on this post")
    c = {"id": str(uuid.uuid4()), "post_id": post_id, "user_id": user["id"], "text": text, "created_at": now_iso()}
    await db.post_comments.insert_one(dict(c))
    await db.posts.update_one({"id": post_id}, {"$inc": {"comments": 1}})
    fresh = await db.posts.find_one({"id": post_id}, {"_id": 0, "comments": 1})
    return {**c, "author": _author(user), "mine": True, "count": int((fresh or {}).get("comments") or 0)}


@router.delete("/posts/{post_id}/comments/{comment_id}")
async def delete_comment(post_id: str, comment_id: str, user=Depends(get_current_user)):
    post = await _get_post(post_id)
    c = await db.post_comments.find_one({"id": comment_id, "post_id": post_id}, {"_id": 0})
    if not c:
        raise HTTPException(status_code=404, detail="Comment not found")
    if c["user_id"] != user["id"] and post["user_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="You can only delete your own comments")
    await db.post_comments.delete_one({"id": comment_id})
    await db.posts.update_one({"id": post_id, "comments": {"$gt": 0}}, {"$inc": {"comments": -1}})
    fresh = await db.posts.find_one({"id": post_id}, {"_id": 0, "comments": 1})
    return {"ok": True, "count": int((fresh or {}).get("comments") or 0)}


# ------------------------------------------------------------------ share into a chat

def post_snapshot(post: dict, author: dict) -> dict:
    """What a shared post carries inside a chat message (enough to draw the card without another request)."""
    return {"id": post["id"], "kind": post.get("kind") or "image", "image": post.get("image"), "caption": post.get("caption") or "", "location": post.get("location") or "",
            "username": author.get("username") or "", "name": author.get("name") or "Someone", "photo": author.get("photo")}


@router.post("/posts/{post_id}/share")
async def share_post(post_id: str, body: ShareIn, user=Depends(get_current_user)):
    """Send this post into one of your chats as a `post` message (Instagram-style share)."""
    post = await _get_post(post_id)
    match = await _get_match(body.match_id, user["id"])
    if not match.get("active", True):
        raise HTTPException(status_code=400, detail="This chat has ended")
    if not is_verified(user):
        raise HTTPException(status_code=403, detail="Verify your profile to send messages")
    other = _other(match, user["id"])
    if await _blocked_between(user["id"], other):
        raise HTTPException(status_code=403, detail="You can't message this person")
    author = _author(await db.users.find_one({"id": post["user_id"]}, {"_id": 0}))
    ts = now_iso()
    msg = {"id": str(uuid.uuid4()), "match_id": match["id"], "sender_id": user["id"], "kind": "post", "text": "",
           "post": post_snapshot(post, author), "created_at": ts, "read_at": None, "client_id": None}
    await db.messages.insert_one(dict(msg))
    accepted_now = _is_request_for(match, user["id"])
    update = {"$set": {"last_message": {"text": "Shared a post", "sender_id": user["id"], "created_at": ts, "kind": "post"}, "last_message_at": ts},
              "$inc": {f"unread.{other}": 1}}
    if accepted_now:
        update["$set"].update({"status": "active", "accepted_at": ts})
    await db.matches.update_one({"id": match["id"]}, update)
    await db.posts.update_one({"id": post_id}, {"$inc": {"shares": 1}})
    payload = {"type": "message", "match_id": match["id"], "message": msg, "accepted": accepted_now,
               "sender_name": user.get("name") or "Someone", "sender_photo": (user.get("photos") or [None])[0]}
    await manager.send(other, payload)
    await manager.send(user["id"], payload)
    from bots import schedule_bot_reply
    schedule_bot_reply(match, await db.users.find_one({"id": other, "is_seed": True}, {"_id": 0, "id": 1, "name": 1, "photos": 1, "is_seed": 1}), user["id"], "", "post")
    fresh = await db.posts.find_one({"id": post_id}, {"_id": 0, "shares": 1})
    return {"ok": True, "message": msg, "shares": int((fresh or {}).get("shares") or 0)}


# ------------------------------------------------------------------ indexes

async def ensure_indexes():
    await db.posts.create_index("id", unique=True)
    await db.posts.create_index([("created_at", -1)])
    await db.posts.create_index("user_id")
    await db.post_likes.create_index([("post_id", 1), ("user_id", 1)], unique=True)
    await db.post_saves.create_index([("post_id", 1), ("user_id", 1)], unique=True)
    await db.post_saves.create_index([("user_id", 1), ("created_at", -1)])
    await db.post_hidden.create_index([("post_id", 1), ("user_id", 1)], unique=True)
    await db.post_comments.create_index([("post_id", 1), ("created_at", 1)])
    await db.post_comments.create_index("id", unique=True)
