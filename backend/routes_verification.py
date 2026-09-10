"""
Profile verification: a live selfie taken in the app, reviewed by a human operator (no automatic face matching).

  status: none -> pending -> approved | rejected (-> pending again on resubmit)
  approved accounts get the black tick ("Verified Profile") everywhere and can send messages.
"""
import asyncio
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, File, Header, HTTPException, UploadFile
from pydantic import BaseModel

from core import db, now_iso, get_current_user, own_profile, calc_age, UPLOAD_DIR
from routes_admin import require_admin
from routes_profile import ALLOWED_TYPES, MAX_UPLOAD, optimize_image
from ws_manager import manager

router = APIRouter(prefix="/api", tags=["verification"])

VERIFY_COPY = {
    "title": "Verified Profile",
    "body": "This person confirmed they're real with a live selfie that was checked by the Voiladi team.",
}


def verification_of(user: dict) -> dict:
    v = user.get("verification") or {}
    return {
        "status": v.get("status") or "none",
        "selfie_url": v.get("selfie_url"),
        "submitted_at": v.get("submitted_at"),
        "reviewed_at": v.get("reviewed_at"),
        "note": v.get("note") or "",
        "verified": (v.get("status") == "approved"),
    }


@router.get("/verification")
async def my_verification(user=Depends(get_current_user)):
    return {**verification_of(user), "copy": VERIFY_COPY}


@router.post("/verification/selfie")
async def submit_selfie(file: UploadFile = File(...), user=Depends(get_current_user)):
    """Upload the live selfie. Stored privately (never shown on the profile); puts the account in review."""
    v = verification_of(user)
    if v["status"] == "approved":
        raise HTTPException(status_code=400, detail="Your profile is already verified")
    if v["status"] == "pending":
        raise HTTPException(status_code=400, detail="Your selfie is already being reviewed")
    ctype = (file.content_type or "").lower()
    if ctype not in ALLOWED_TYPES:
        raise HTTPException(status_code=400, detail="Only JPG, PNG, WEBP or HEIC images are allowed")
    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="That photo looks empty")
    if len(data) > MAX_UPLOAD:
        raise HTTPException(status_code=400, detail="Image must be under 8MB")
    data, ext = await asyncio.to_thread(optimize_image, data, ctype)
    fname = f"verify_{user['id']}_{uuid.uuid4().hex}.{ext}"
    (UPLOAD_DIR / fname).write_bytes(data)
    doc = {"status": "pending", "selfie_url": f"/api/uploads/{fname}", "submitted_at": now_iso(), "reviewed_at": None, "note": ""}
    await db.users.update_one({"id": user["id"]}, {"$set": {"verification": doc}})
    return {**verification_of({"verification": doc}), "copy": VERIFY_COPY}


# ---------- operator review ----------

class ReviewIn(BaseModel):
    note: Optional[str] = ""


def _row(u: dict) -> dict:
    v = u.get("verification") or {}
    return {
        "user_id": u["id"], "name": u.get("name") or "Someone", "username": u.get("username") or "", "age": calc_age(u.get("birthday")),
        "photos": (u.get("photos") or [])[:3], "selfie_url": v.get("selfie_url"), "status": v.get("status"),
        "submitted_at": v.get("submitted_at"), "reviewed_at": v.get("reviewed_at"), "note": v.get("note") or "",
        "created_at": u.get("created_at"),
    }


@router.get("/admin/verifications")
async def list_verifications(status: str = "pending", limit: int = 100, x_admin_key: Optional[str] = Header(default=None)):
    require_admin(x_admin_key)
    q = {"verification.status": status} if status != "all" else {"verification.status": {"$exists": True}}
    rows = await db.users.find(q, {"_id": 0}).sort("verification.submitted_at", 1).limit(max(1, min(limit, 500))).to_list(None)
    counts = {}
    for st in ("pending", "approved", "rejected"):
        counts[st] = await db.users.count_documents({"verification.status": st})
    return {"items": [_row(u) for u in rows], "counts": counts}


async def _review(user_id: str, approve: bool, note: str):
    u = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not u:
        raise HTTPException(status_code=404, detail="User not found")
    v = u.get("verification") or {}
    if v.get("status") != "pending":
        raise HTTPException(status_code=400, detail="This request isn't pending")
    v.update({"status": "approved" if approve else "rejected", "reviewed_at": now_iso(), "note": (note or "").strip()[:200]})
    await db.users.update_one({"id": user_id}, {"$set": {"verification": v}})
    await manager.send(user_id, {"type": "verification", "status": v["status"], "note": v["note"]})
    u["verification"] = v
    return _row(u)


@router.post("/admin/verifications/{user_id}/approve")
async def approve_verification(user_id: str, body: ReviewIn = ReviewIn(), x_admin_key: Optional[str] = Header(default=None)):
    require_admin(x_admin_key)
    return await _review(user_id, True, body.note or "")


@router.post("/admin/verifications/{user_id}/reject")
async def reject_verification(user_id: str, body: ReviewIn = ReviewIn(), x_admin_key: Optional[str] = Header(default=None)):
    require_admin(x_admin_key)
    return await _review(user_id, False, body.note or "")
