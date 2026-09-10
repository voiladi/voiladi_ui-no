"""
Photos and videos in chat.

Flow
  1. POST /api/media/init                 -> upload_id            (declares match, type, size, view_once)
  2. PUT  /api/media/{upload_id}/chunk?i= -> ok                   (<= CHUNK_MAX bytes each; Cloudflare caps bodies at 100MB, so we chunk)
  3. POST /api/media/{upload_id}/complete -> the chat message     (image: ready immediately; video: status "processing")
     Videos are transcoded in the background with ffmpeg to H.264/AAC MP4 (long edge capped by the user's quality tier,
     720p for everyone, 1080p for Plus later) plus a poster frame. When done the message flips to "ready" and both people
     receive a `message_updated` socket event.

Serving
  GET /api/media/{fname}       Range-capable (iOS Safari refuses to play video without Range support).
  View-once files are NOT served by name: the recipient calls POST /api/matches/{id}/messages/{mid}/open, gets a signed
  URL valid for a few minutes, and the file is deleted shortly after. The sender sees "Opened".

Everything lives under UPLOAD_DIR/media on the Railway volume (50GB); raw uploads are deleted after processing.
"""
import asyncio
import hashlib
import hmac
import json
import logging
import os
import shutil
import tempfile
import time
import uuid
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, Header, Query
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel
from PIL import Image, ImageOps

from core import db, now_iso, get_current_user, is_verified, UPLOAD_DIR, JWT_SECRET
from ws_manager import manager
from routes_chat import _get_match, _other, _is_request_for, _blocked_between, media_preview_text

logger = logging.getLogger("voiladi.media")
router = APIRouter(prefix="/api", tags=["media"])

MEDIA_DIR = UPLOAD_DIR / "media"          # finished photos/videos -> persistent volume (Railway 50GB)
# In-flight chunks + raw uploads are scratch data only: they are assembled and deleted within the same
# request/transcode, so they live in the OS temp dir (overridable with MEDIA_TMP_DIR), not on the app disk.
TMP_DIR = Path(os.environ.get("MEDIA_TMP_DIR") or (Path(tempfile.gettempdir()) / "voiladi_media_tmp"))
MEDIA_DIR.mkdir(parents=True, exist_ok=True)
TMP_DIR.mkdir(parents=True, exist_ok=True)

CHUNK_MAX = 8 * 1024 * 1024            # 8MB per chunk (well under the CDN body cap)
IMAGE_MAX_BYTES = 25 * 1024 * 1024     # phone photos
VIDEO_MAX_BYTES = 600 * 1024 * 1024    # 5 min of phone footage can be large before we compress it
VIDEO_MAX_SECONDS = 5 * 60
UPLOAD_TTL_SEC = 2 * 3600              # abandoned uploads are swept after 2h
VIEW_ONCE_URL_TTL = 180                # signed url lifetime (seconds)
VIEW_ONCE_DELETE_AFTER = 300           # file removed this long after it was opened
QUALITY_TIERS = {720: 1280, 1080: 1920}  # tier -> max long edge (px)
IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp", "image/heic", "image/heif", "image/gif"}
VIDEO_TYPES = {"video/mp4", "video/quicktime", "video/webm", "video/3gpp", "video/x-matroska", "video/x-m4v"}

_transcode_sem = asyncio.Semaphore(1)  # one ffmpeg at a time on the small API box


def quality_cap(user: dict) -> int:
    """Long-edge cap in px for this user's tier. Everyone is 720p today; Plus members will get 1080p."""
    tier = int(user.get("media_quality") or 720)
    return QUALITY_TIERS.get(tier, QUALITY_TIERS[720])


def public_url(fname: str) -> str:
    return f"/api/media/{fname}"


# ------------------------------------------------------------------ uploads

class InitIn(BaseModel):
    match_id: str
    content_type: str
    size: int
    view_once: bool = False
    client_id: Optional[str] = None
    duration: Optional[float] = None  # client-side hint; the server re-checks video length


async def _check_can_send(match: dict, user: dict):
    if not match.get("active", True):
        raise HTTPException(status_code=400, detail="This chat has ended")
    if not is_verified(user):
        raise HTTPException(status_code=403, detail="Verify your profile to send messages")
    if await _blocked_between(user["id"], _other(match, user["id"])):
        raise HTTPException(status_code=403, detail="You can't message this person")


@router.post("/media/init")
async def media_init(body: InitIn, user=Depends(get_current_user)):
    match = await _get_match(body.match_id, user["id"])
    await _check_can_send(match, user)
    ct = body.content_type.lower().split(";")[0].strip()
    if ct in IMAGE_TYPES:
        kind, limit = "image", IMAGE_MAX_BYTES
    elif ct in VIDEO_TYPES:
        kind, limit = "video", VIDEO_MAX_BYTES
    else:
        raise HTTPException(status_code=400, detail="Only photos and videos can be shared")
    if body.size <= 0:
        raise HTTPException(status_code=400, detail="Empty file")
    if body.size > limit:
        mb = limit // (1024 * 1024)
        raise HTTPException(status_code=413, detail=f"That {kind} is too large (max {mb} MB)")
    if kind == "video" and body.duration and body.duration > VIDEO_MAX_SECONDS + 1:
        raise HTTPException(status_code=400, detail="Videos can be up to 5 minutes")
    upload_id = str(uuid.uuid4())
    await db.media_uploads.insert_one({
        "id": upload_id, "user_id": user["id"], "match_id": body.match_id, "kind": kind, "content_type": ct,
        "size": body.size, "view_once": bool(body.view_once), "client_id": body.client_id,
        "received": 0, "chunks": 0, "created_at": now_iso(), "ts": time.time(),
    })
    (TMP_DIR / upload_id).mkdir(parents=True, exist_ok=True)
    return {"upload_id": upload_id, "chunk_size": CHUNK_MAX, "kind": kind}


@router.put("/media/{upload_id}/chunk")
async def media_chunk(upload_id: str, request: Request, i: int = Query(..., ge=0), user=Depends(get_current_user)):
    up = await db.media_uploads.find_one({"id": upload_id, "user_id": user["id"]}, {"_id": 0})
    if not up:
        raise HTTPException(status_code=404, detail="Upload not found")
    cl = request.headers.get("content-length")
    if cl and cl.isdigit() and int(cl) > CHUNK_MAX:
        raise HTTPException(status_code=413, detail="Chunk too large")
    data = await request.body()
    if not data or len(data) > CHUNK_MAX:
        raise HTTPException(status_code=413 if data else 400, detail="Chunk too large" if data else "Empty chunk")
    part = TMP_DIR / upload_id / f"{i:06d}.part"
    if part.exists():  # retried chunk: replace, don't double count
        old = part.stat().st_size
        await db.media_uploads.update_one({"id": upload_id}, {"$inc": {"received": -old, "chunks": -1}})
    part.write_bytes(data)
    res = await db.media_uploads.find_one_and_update(
        {"id": upload_id}, {"$inc": {"received": len(data), "chunks": 1}, "$set": {"ts": time.time()}},
        projection={"_id": 0, "received": 1, "size": 1}, return_document=True,
    )
    if res["received"] > res["size"] + CHUNK_MAX:
        shutil.rmtree(TMP_DIR / upload_id, ignore_errors=True)
        await db.media_uploads.delete_one({"id": upload_id})
        raise HTTPException(status_code=413, detail="Upload larger than declared")
    return {"ok": True, "received": res["received"]}


def _assemble(upload_id: str) -> Path:
    d = TMP_DIR / upload_id
    parts = sorted(d.glob("*.part"))
    raw = d / "raw.bin"
    with open(raw, "wb") as out:
        for p in parts:
            with open(p, "rb") as f:
                shutil.copyfileobj(f, out, 1024 * 1024)
            p.unlink(missing_ok=True)
    return raw


def _process_image(raw: Path, dst: Path, max_edge: int) -> dict:
    with Image.open(raw) as img:
        img = ImageOps.exif_transpose(img)  # honours phone rotation, and re-encoding strips EXIF/GPS + any payload
        if getattr(img, "n_frames", 1) > 1:
            img.seek(0)
        img = img.convert("RGB")
        img.thumbnail((max_edge, max_edge), Image.LANCZOS)
        w, h = img.size
        img.save(dst, format="JPEG", quality=86, optimize=True, progressive=True)
    return {"width": w, "height": h, "size": dst.stat().st_size}


async def _ffprobe(path: Path) -> dict:
    proc = await asyncio.create_subprocess_exec(
        "ffprobe", "-v", "error", "-print_format", "json", "-show_streams", "-show_format", str(path),
        stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
    )
    out, err = await proc.communicate()
    if proc.returncode != 0:
        raise ValueError(err.decode(errors="ignore")[:200] or "ffprobe failed")
    return json.loads(out.decode())


async def _transcode_video(raw: Path, dst: Path, poster: Path, max_edge: int) -> dict:
    info = await _ffprobe(raw)
    vstreams = [s for s in info.get("streams", []) if s.get("codec_type") == "video"]
    if not vstreams:
        raise ValueError("No video track")
    v = vstreams[0]
    duration = float(info.get("format", {}).get("duration") or v.get("duration") or 0)
    if duration > VIDEO_MAX_SECONDS + 1:
        raise ValueError("Videos can be up to 5 minutes")
    has_audio = any(s.get("codec_type") == "audio" for s in info.get("streams", []))
    # scale so the LONGER edge is <= max_edge (portrait videos keep their orientation); never upscale; keep even dims
    vf = (
        f"scale='if(gt(iw,ih),min({max_edge},iw),-2)':'if(gt(iw,ih),-2,min({max_edge},ih))',"
        "format=yuv420p"
    )
    cmd = ["ffmpeg", "-y", "-v", "error", "-i", str(raw), "-vf", vf, "-c:v", "libx264", "-preset", "veryfast", "-crf", "26",
           "-profile:v", "high", "-level", "4.1", "-movflags", "+faststart", "-map_metadata", "-1", "-max_muxing_queue_size", "1024"]
    if has_audio:
        cmd += ["-c:a", "aac", "-b:a", "96k", "-ac", "2"]
    else:
        cmd += ["-an"]
    cmd += [str(dst)]
    proc = await asyncio.create_subprocess_exec(*cmd, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE)
    _, err = await proc.communicate()
    if proc.returncode != 0:
        raise ValueError(err.decode(errors="ignore")[-300:] or "ffmpeg failed")
    # poster from ~0.5s in (or the first frame for very short clips)
    at = "0.5" if duration > 1 else "0"
    pp = await asyncio.create_subprocess_exec(
        "ffmpeg", "-y", "-v", "error", "-ss", at, "-i", str(dst), "-frames:v", "1", "-q:v", "4", str(poster),
        stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
    )
    await pp.communicate()
    out_info = await _ffprobe(dst)
    ov = [s for s in out_info.get("streams", []) if s.get("codec_type") == "video"][0]
    return {"width": int(ov.get("width") or 0), "height": int(ov.get("height") or 0), "duration": round(duration, 1), "size": dst.stat().st_size}


async def _broadcast_update(match: dict, msg: dict):
    payload = {"type": "message_updated", "match_id": match["id"], "message": msg}
    for uid in match["users"]:
        await manager.send(uid, payload)


async def _finish_video(msg_id: str, match: dict, raw: Path, dst: Path, poster: Path, max_edge: int, upload_id: str):
    try:
        async with _transcode_sem:
            meta = await _transcode_video(raw, dst, poster, max_edge)
        media = {"status": "ready", **meta, "poster": public_url(poster.name) if poster.exists() else None}
        await db.messages.update_one({"id": msg_id}, {"$set": {f"media.{k}": v for k, v in media.items()}})
    except Exception as e:
        logger.warning("video processing failed for %s: %s", msg_id, e)
        await db.messages.update_one({"id": msg_id}, {"$set": {"media.status": "failed", "media.error": str(e)[:160]}})
        dst.unlink(missing_ok=True)
    finally:
        shutil.rmtree(TMP_DIR / upload_id, ignore_errors=True)
        await db.media_uploads.delete_one({"id": upload_id})
    msg = await db.messages.find_one({"id": msg_id}, {"_id": 0})
    if msg:
        await _broadcast_update(match, msg)


@router.post("/media/{upload_id}/complete")
async def media_complete(upload_id: str, user=Depends(get_current_user)):
    up = await db.media_uploads.find_one({"id": upload_id, "user_id": user["id"]}, {"_id": 0})
    if not up:
        raise HTTPException(status_code=404, detail="Upload not found")
    if up["received"] < up["size"]:
        raise HTTPException(status_code=400, detail="Upload incomplete")
    match = await _get_match(up["match_id"], user["id"])
    await _check_can_send(match, user)

    raw = await asyncio.to_thread(_assemble, upload_id)
    max_edge = quality_cap(user)
    msg_id = str(uuid.uuid4())
    other = _other(match, user["id"])
    accepted_now = _is_request_for(match, user["id"])
    ts = now_iso()
    media = {"kind": up["kind"], "status": "processing", "view_once": up["view_once"], "opened_at": None}

    if up["kind"] == "image":
        fname = f"{msg_id}.jpg"
        dst = MEDIA_DIR / fname
        try:
            meta = await asyncio.to_thread(_process_image, raw, dst, max_edge)
        except Exception:
            shutil.rmtree(TMP_DIR / upload_id, ignore_errors=True)
            await db.media_uploads.delete_one({"id": upload_id})
            raise HTTPException(status_code=400, detail="That image couldn't be read")
        media.update({"status": "ready", "url": public_url(fname), "file": fname, **meta})
        shutil.rmtree(TMP_DIR / upload_id, ignore_errors=True)
        await db.media_uploads.delete_one({"id": upload_id})
    else:
        fname = f"{msg_id}.mp4"
        media.update({"url": public_url(fname), "file": fname, "poster_file": f"{msg_id}_poster.jpg"})

    msg = {
        "id": msg_id, "match_id": match["id"], "sender_id": user["id"], "kind": up["kind"], "text": "",
        "media": media, "created_at": ts, "read_at": None, "client_id": up.get("client_id"),
    }
    await db.messages.insert_one(dict(msg))
    update = {
        "$set": {"last_message": {"text": media_preview_text(up["kind"], up["view_once"]), "sender_id": user["id"], "created_at": ts, "kind": up["kind"]},
                 "last_message_at": ts},
        "$inc": {f"unread.{other}": 1},
    }
    if accepted_now:
        update["$set"].update({"status": "active", "accepted_at": ts})
    await db.matches.update_one({"id": match["id"]}, update)

    payload = {"type": "message", "match_id": match["id"], "message": msg, "accepted": accepted_now,
               "sender_name": user.get("name") or "Someone", "sender_photo": (user.get("photos") or [None])[0]}
    await manager.send(other, payload)
    await manager.send(user["id"], payload)

    if up["kind"] == "video":
        asyncio.create_task(_finish_video(msg_id, match, raw, MEDIA_DIR / fname, MEDIA_DIR / media["poster_file"], max_edge, upload_id))
    return msg


# ------------------------------------------------------------------ view once

def _sign(fname: str, exp: int) -> str:
    return hmac.new(JWT_SECRET.encode(), f"{fname}:{exp}".encode(), hashlib.sha256).hexdigest()[:32]


async def _delete_media_files(msg: dict):
    m = msg.get("media") or {}
    for key in ("file", "poster_file"):
        if m.get(key):
            (MEDIA_DIR / Path(m[key]).name).unlink(missing_ok=True)


async def _delete_later(msg_id: str, delay: int):
    await asyncio.sleep(delay)
    msg = await db.messages.find_one({"id": msg_id}, {"_id": 0})
    if msg:
        await _delete_media_files(msg)
        await db.messages.update_one({"id": msg_id}, {"$set": {"media.status": "expired", "media.url": None, "media.poster": None}})


@router.post("/matches/{match_id}/messages/{message_id}/open")
async def open_view_once(match_id: str, message_id: str, user=Depends(get_current_user)):
    """Recipient opens a view-once photo/video: returns a short-lived signed URL; the file is deleted a few minutes later."""
    match = await _get_match(match_id, user["id"])
    msg = await db.messages.find_one({"id": message_id, "match_id": match_id}, {"_id": 0})
    if not msg or not (msg.get("media") or {}).get("view_once"):
        raise HTTPException(status_code=404, detail="Message not found")
    if msg["sender_id"] == user["id"]:
        raise HTTPException(status_code=403, detail="View-once media can only be opened by the person you sent it to")
    media = msg["media"]
    if media.get("status") == "expired" or (media.get("opened_at") and time.time() - media.get("opened_ts", 0) > VIEW_ONCE_URL_TTL):
        raise HTTPException(status_code=410, detail="This was already viewed")
    if media.get("status") != "ready":
        raise HTTPException(status_code=409, detail="Still processing")
    first_open = not media.get("opened_at")
    if first_open:
        ts = now_iso()
        await db.messages.update_one({"id": message_id}, {"$set": {"media.opened_at": ts, "media.opened_ts": time.time()}})
        msg["media"].update({"opened_at": ts})
        await _broadcast_update(match, {**msg, "media": {**msg["media"], "url": None, "poster": None}})
        asyncio.create_task(_delete_later(message_id, VIEW_ONCE_DELETE_AFTER))
    exp = int(time.time()) + VIEW_ONCE_URL_TTL
    fname = media["file"]
    return {"url": f"{public_url(fname)}?exp={exp}&sig={_sign(fname, exp)}", "kind": media["kind"], "expires_in": VIEW_ONCE_URL_TTL}


# ------------------------------------------------------------------ serving (Range-capable)

def _iter_file(path: Path, start: int, end: int, chunk: int = 1024 * 512):
    with open(path, "rb") as f:
        f.seek(start)
        left = end - start + 1
        while left > 0:
            data = f.read(min(chunk, left))
            if not data:
                break
            left -= len(data)
            yield data


@router.get("/media/{fname}")
async def get_media(fname: str, request: Request, exp: Optional[int] = None, sig: Optional[str] = None, range_header: Optional[str] = Header(None, alias="Range")):
    safe = Path(fname).name
    path = MEDIA_DIR / safe
    if not path.exists():
        raise HTTPException(status_code=404, detail="Not found")
    # view-once files need a valid, unexpired signature
    stem = safe.rsplit(".", 1)[0].replace("_poster", "")
    msg = await db.messages.find_one({"id": stem}, {"_id": 0, "media.view_once": 1})
    if msg and (msg.get("media") or {}).get("view_once"):
        if not exp or not sig or exp < time.time() or not hmac.compare_digest(sig, _sign(safe, exp)):
            raise HTTPException(status_code=403, detail="This link has expired")
        cache = "private, no-store"
    else:
        cache = "public, max-age=31536000, immutable"
    ctype = "video/mp4" if safe.endswith(".mp4") else "image/jpeg"
    size = path.stat().st_size
    headers = {"Cache-Control": cache, "Accept-Ranges": "bytes", "Content-Disposition": f'inline; filename="{safe}"'}
    if range_header and range_header.startswith("bytes="):
        try:
            spec = range_header[6:].split(",")[0]
            s, e = spec.split("-")
            start = int(s) if s else max(0, size - int(e))
            end = int(e) if (e and s) else size - 1
            end = min(end, size - 1)
            if start > end or start >= size:
                raise ValueError
        except ValueError:
            raise HTTPException(status_code=416, detail="Bad range", headers={"Content-Range": f"bytes */{size}"})
        headers.update({"Content-Range": f"bytes {start}-{end}/{size}", "Content-Length": str(end - start + 1)})
        return StreamingResponse(_iter_file(path, start, end), status_code=206, media_type=ctype, headers=headers)
    return FileResponse(path, media_type=ctype, headers=headers)


# ------------------------------------------------------------------ housekeeping

async def sweep_uploads():
    """Remove abandoned chunked uploads (called from the app's startup loop)."""
    cutoff = time.time() - UPLOAD_TTL_SEC
    async for up in db.media_uploads.find({"ts": {"$lt": cutoff}}, {"_id": 0, "id": 1}):
        shutil.rmtree(TMP_DIR / up["id"], ignore_errors=True)
        await db.media_uploads.delete_one({"id": up["id"]})
