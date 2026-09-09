"""Profile, photos, preferences, meta content and safety."""
import asyncio
import uuid
from io import BytesIO
from pathlib import Path
from typing import Optional, List, Tuple
from datetime import date

from PIL import Image, ImageOps

try:  # iPhone HEIC/HEIF uploads -> decodable by Pillow
    from pillow_heif import register_heif_opener

    register_heif_opener()
except Exception:  # pragma: no cover - optional dependency
    pass

from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

from core import (db, now_iso, get_current_user, own_profile, public_profile, is_profile_complete,
                  calc_age, UPLOAD_DIR, GENDERS, SHOW_ME, ANYWHERE_KM, SMS_ENABLED)
from content import INTERESTS, PROMPTS, ICEBREAKERS, CITIES, REPORT_REASONS
from ws_manager import manager

router = APIRouter(prefix="/api", tags=["profile"])

ALLOWED_TYPES = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/heic": "heic", "image/heif": "heif", "image/gif": "gif"}
MAX_UPLOAD = 8 * 1024 * 1024
MAX_PHOTOS = 6
# Photos are shown on a 430px-wide card at up to 3x DPR; anything larger only costs bandwidth and GPU time while swiping.
PHOTO_MAX_EDGE = 1280
PHOTO_QUALITY = 84


def optimize_image(data: bytes, ctype: str) -> Tuple[bytes, str]:
    """Fix EXIF orientation, downscale to PHOTO_MAX_EDGE, strip metadata and re-encode (JPEG, or WEBP if transparent).
    Animated GIFs are kept as-is. On any decode error the original bytes are stored unchanged."""
    ext = ALLOWED_TYPES[ctype]
    try:
        img = Image.open(BytesIO(data))
        if getattr(img, "is_animated", False):
            return data, ext
        img = ImageOps.exif_transpose(img)
        img.thumbnail((PHOTO_MAX_EDGE, PHOTO_MAX_EDGE), Image.LANCZOS)
        has_alpha = img.mode in ("RGBA", "LA") or (img.mode == "P" and "transparency" in img.info)
        out = BytesIO()
        if has_alpha:
            img.convert("RGBA").save(out, format="WEBP", quality=PHOTO_QUALITY, method=4)
            return out.getvalue(), "webp"
        img.convert("RGB").save(out, format="JPEG", quality=PHOTO_QUALITY, optimize=True, progressive=True)
        return out.getvalue(), "jpg"
    except Exception:
        return data, ext


class PromptIn(BaseModel):
    question: str
    answer: str


class ProfileIn(BaseModel):
    name: Optional[str] = None
    birthday: Optional[str] = None  # YYYY-MM-DD
    gender: Optional[str] = None
    looking_for: Optional[str] = None
    bio: Optional[str] = None
    interests: Optional[List[str]] = None
    prompts: Optional[List[PromptIn]] = None
    city: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    clear_location: Optional[bool] = None
    onboarded: Optional[bool] = None


class PreferencesIn(BaseModel):
    age_min: int = Field(ge=18, le=80)
    age_max: int = Field(ge=18, le=80)
    max_distance_km: int = Field(ge=5, le=ANYWHERE_KM)
    show_me: str


class PhotoOrderIn(BaseModel):
    photos: List[str]


class ReportIn(BaseModel):
    reason: str
    details: Optional[str] = ""


@router.get("/meta")
async def meta():
    return {
        "interests": INTERESTS, "prompts": PROMPTS, "icebreakers": ICEBREAKERS, "cities": CITIES,
        "genders": GENDERS, "show_me": SHOW_ME, "report_reasons": REPORT_REASONS,
        "anywhere_km": ANYWHERE_KM, "max_photos": MAX_PHOTOS, "sms_enabled": SMS_ENABLED,
    }


@router.put("/profile")
async def update_profile(body: ProfileIn, user=Depends(get_current_user)):
    update = {}
    if body.name is not None:
        name = body.name.strip()
        if not (1 <= len(name) <= 30):
            raise HTTPException(status_code=400, detail="Name should be 1-30 characters")
        update["name"] = name
    if body.birthday is not None:
        try:
            b = date.fromisoformat(body.birthday[:10])
        except ValueError:
            raise HTTPException(status_code=400, detail="Enter a valid birthday")
        age = calc_age(b.isoformat())
        if age is None or age < 18:
            raise HTTPException(status_code=400, detail="You need to be 18 or older to use Voiladi")
        if age > 100:
            raise HTTPException(status_code=400, detail="Enter a valid birthday")
        update["birthday"] = b.isoformat()
    if body.gender is not None:
        if body.gender not in GENDERS:
            raise HTTPException(status_code=400, detail="Invalid gender option")
        update["gender"] = body.gender
    if body.looking_for is not None:
        if body.looking_for not in SHOW_ME:
            raise HTTPException(status_code=400, detail="Invalid option")
        update["looking_for"] = body.looking_for
        prefs = dict(user.get("preferences") or {})
        prefs["show_me"] = body.looking_for
        update["preferences"] = prefs
    if body.bio is not None:
        if len(body.bio) > 300:
            raise HTTPException(status_code=400, detail="Bio should be under 300 characters")
        update["bio"] = body.bio.strip()
    if body.interests is not None:
        cleaned = []
        for i in body.interests:
            i = i.strip()
            if i and i not in cleaned:
                cleaned.append(i[:30])
        if len(cleaned) > 10:
            raise HTTPException(status_code=400, detail="Pick up to 10 interests")
        update["interests"] = cleaned
    if body.prompts is not None:
        ps = [{"question": p.question.strip()[:80], "answer": p.answer.strip()[:200]} for p in body.prompts if p.answer.strip()]
        if len(ps) > 3:
            raise HTTPException(status_code=400, detail="Pick up to 3 prompts")
        update["prompts"] = ps
    if body.clear_location:
        update["city"] = ""
        update["lat"] = None
        update["lng"] = None
    else:
        if body.city is not None:
            update["city"] = body.city.strip()[:60]
        if body.lat is not None and body.lng is not None:
            if not (-90 <= body.lat <= 90 and -180 <= body.lng <= 180):
                raise HTTPException(status_code=400, detail="Invalid coordinates")
            update["lat"] = body.lat
            update["lng"] = body.lng
    merged = {**user, **update}
    update["profile_complete"] = is_profile_complete(merged)
    if body.onboarded and update["profile_complete"]:
        update["onboarded"] = True
    update["updated_at"] = now_iso()
    await db.users.update_one({"id": user["id"]}, {"$set": update})
    fresh = await db.users.find_one({"id": user["id"]}, {"_id": 0})
    return own_profile(fresh)


@router.post("/profile/photos")
async def upload_photo(file: UploadFile = File(...), user=Depends(get_current_user)):
    ctype = (file.content_type or "").lower()
    if ctype not in ALLOWED_TYPES:
        raise HTTPException(status_code=400, detail="Only JPG, PNG, WEBP, GIF or HEIC images are allowed")
    data = await file.read()
    if len(data) == 0:
        raise HTTPException(status_code=400, detail="That file looks empty")
    if len(data) > MAX_UPLOAD:
        raise HTTPException(status_code=400, detail="Image must be under 8MB")
    photos = list(user.get("photos") or [])
    if len(photos) >= MAX_PHOTOS:
        raise HTTPException(status_code=400, detail=f"You can add up to {MAX_PHOTOS} photos")
    data, ext = await asyncio.to_thread(optimize_image, data, ctype)
    fname = f"{user['id']}_{uuid.uuid4().hex}.{ext}"
    (UPLOAD_DIR / fname).write_bytes(data)
    url = f"/api/uploads/{fname}"
    photos.append(url)
    merged = {**user, "photos": photos}
    await db.users.update_one({"id": user["id"]}, {"$set": {"photos": photos, "profile_complete": is_profile_complete(merged)}})
    return {"url": url, "photos": photos}


@router.delete("/profile/photos")
async def delete_photo(url: str, user=Depends(get_current_user)):
    photos = list(user.get("photos") or [])
    if url not in photos:
        raise HTTPException(status_code=404, detail="Photo not found")
    photos.remove(url)
    if url.startswith("/api/uploads/"):
        try:
            (UPLOAD_DIR / Path(url).name).unlink(missing_ok=True)
        except Exception:
            pass
    merged = {**user, "photos": photos}
    await db.users.update_one({"id": user["id"]}, {"$set": {"photos": photos, "profile_complete": is_profile_complete(merged)}})
    return {"photos": photos, "profile_complete": is_profile_complete(merged)}


@router.put("/profile/photos/order")
async def reorder_photos(body: PhotoOrderIn, user=Depends(get_current_user)):
    current = list(user.get("photos") or [])
    if sorted(current) != sorted(body.photos):
        raise HTTPException(status_code=400, detail="Photo list mismatch")
    await db.users.update_one({"id": user["id"]}, {"$set": {"photos": body.photos}})
    return {"photos": body.photos}


@router.get("/uploads/{fname}")
async def get_upload(fname: str):
    p = UPLOAD_DIR / Path(fname).name
    if not p.exists():
        raise HTTPException(status_code=404, detail="Not found")
    return FileResponse(p, headers={"Cache-Control": "public, max-age=31536000, immutable"})


@router.get("/preferences")
async def get_preferences(user=Depends(get_current_user)):
    return own_profile(user)["preferences"]


@router.put("/preferences")
async def set_preferences(body: PreferencesIn, user=Depends(get_current_user)):
    if body.age_min > body.age_max:
        raise HTTPException(status_code=400, detail="Minimum age can't be above maximum age")
    if body.show_me not in SHOW_ME:
        raise HTTPException(status_code=400, detail="Invalid option")
    prefs = body.model_dump()
    await db.users.update_one({"id": user["id"]}, {"$set": {"preferences": prefs, "looking_for": body.show_me}})
    return prefs


@router.get("/users/{user_id}")
async def get_user(user_id: str, user=Depends(get_current_user)):
    target = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not target:
        raise HTTPException(status_code=404, detail="Profile not found")
    return public_profile(target, user)


@router.post("/users/{user_id}/block")
async def block_user(user_id: str, user=Depends(get_current_user)):
    if user_id == user["id"]:
        raise HTTPException(status_code=400, detail="You can't block yourself")
    await db.blocks.update_one({"from_id": user["id"], "to_id": user_id},
                               {"$set": {"from_id": user["id"], "to_id": user_id, "created_at": now_iso()},
                                "$setOnInsert": {"id": str(uuid.uuid4())}}, upsert=True)
    match = await db.matches.find_one({"users": {"$all": [user["id"], user_id]}, "active": True}, {"_id": 0})
    if match:
        await db.matches.update_one({"id": match["id"]}, {"$set": {"active": False, "ended_by": user["id"], "ended_at": now_iso()}})
        await manager.send(user_id, {"type": "unmatch", "match_id": match["id"]})
    # make sure they never appear in discovery again
    await db.swipes.update_one({"from_id": user["id"], "to_id": user_id},
                               {"$set": {"from_id": user["id"], "to_id": user_id, "action": "pass", "created_at": now_iso()},
                                "$setOnInsert": {"id": str(uuid.uuid4())}}, upsert=True)
    return {"ok": True}


@router.post("/users/{user_id}/report")
async def report_user(user_id: str, body: ReportIn, user=Depends(get_current_user)):
    if user_id == user["id"]:
        raise HTTPException(status_code=400, detail="Invalid report")
    await db.reports.insert_one({"id": str(uuid.uuid4()), "from_id": user["id"], "to_id": user_id, "status": "open",
                                 "reason": body.reason[:100], "details": (body.details or "")[:500], "created_at": now_iso()})
    return {"ok": True}
