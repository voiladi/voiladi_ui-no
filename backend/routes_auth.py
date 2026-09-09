"""Phone + OTP authentication."""
import secrets
import uuid
import logging
from datetime import timedelta, datetime

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel

from core import (db, now, now_iso, make_token, get_current_user, own_profile, SMS_ENABLED,
                  TWILIO_SID, TWILIO_TOKEN, TWILIO_FROM, UPLOAD_DIR)
from ws_manager import manager

logger = logging.getLogger("voiladi.auth")
router = APIRouter(prefix="/api/auth", tags=["auth"])

OTP_TTL_MIN = 10
RESEND_COOLDOWN_SEC = 30
MAX_ATTEMPTS = 5


class PhoneIn(BaseModel):
    phone: str


class VerifyIn(BaseModel):
    phone: str
    code: str


def normalize_phone(p: str) -> str:
    p = p.strip()
    plus = p.startswith("+")
    digits = "".join(ch for ch in p if ch.isdigit())
    if len(digits) < 7 or len(digits) > 15:
        raise HTTPException(status_code=400, detail="Enter a valid phone number")
    return ("+" if plus or True else "") + digits


async def send_sms(phone: str, code: str) -> bool:
    if not SMS_ENABLED:
        return False
    try:
        import httpx
        url = f"https://api.twilio.com/2010-04-01/Accounts/{TWILIO_SID}/Messages.json"
        async with httpx.AsyncClient(timeout=15) as c:
            r = await c.post(url, data={"To": phone, "From": TWILIO_FROM, "Body": f"Your Voiladi code is {code}. It expires in {OTP_TTL_MIN} minutes."},
                             auth=(TWILIO_SID, TWILIO_TOKEN))
            if r.status_code >= 300:
                logger.error(f"Twilio error {r.status_code}: {r.text}")
            return r.status_code < 300
    except Exception as e:
        logger.error(f"SMS send failed: {e}")
        return False


@router.post("/request-otp")
async def request_otp(body: PhoneIn):
    phone = normalize_phone(body.phone)
    existing = await db.otp_sessions.find_one({"phone": phone}, {"_id": 0})
    if existing and existing.get("created_at"):
        elapsed = (now() - datetime.fromisoformat(existing["created_at"])).total_seconds()
        if elapsed < RESEND_COOLDOWN_SEC:
            raise HTTPException(status_code=429, detail=f"Please wait {int(RESEND_COOLDOWN_SEC - elapsed)}s before requesting another code")
    code = f"{secrets.randbelow(1000000):06d}"
    await db.otp_sessions.update_one(
        {"phone": phone},
        {"$set": {"phone": phone, "code": code, "expires_at": (now() + timedelta(minutes=OTP_TTL_MIN)).isoformat(),
                  "attempts": 0, "created_at": now_iso()}},
        upsert=True,
    )
    sent = await send_sms(phone, code)
    resp = {"ok": True, "phone": phone, "sms_sent": sent, "resend_in": RESEND_COOLDOWN_SEC}
    if not sent:
        # SMS provider not configured: surface the code so the flow is testable end-to-end.
        resp["dev_mode"] = True
        resp["dev_code"] = code
    return resp


@router.post("/verify-otp")
async def verify_otp(body: VerifyIn):
    phone = normalize_phone(body.phone)
    sess = await db.otp_sessions.find_one({"phone": phone})
    if not sess:
        raise HTTPException(status_code=400, detail="Request a new code first")
    if datetime.fromisoformat(sess["expires_at"]) < now():
        raise HTTPException(status_code=400, detail="That code expired. Request a new one")
    if sess.get("attempts", 0) >= MAX_ATTEMPTS:
        raise HTTPException(status_code=429, detail="Too many attempts. Request a new code")
    if sess["code"] != body.code.strip():
        await db.otp_sessions.update_one({"phone": phone}, {"$inc": {"attempts": 1}})
        raise HTTPException(status_code=400, detail="That code doesn't look right")
    await db.otp_sessions.delete_one({"phone": phone})
    user = await db.users.find_one({"phone": phone}, {"_id": 0})
    is_new = False
    if not user:
        is_new = True
        user = {
            "id": str(uuid.uuid4()), "phone": phone, "created_at": now_iso(), "last_active": now_iso(),
            "profile_complete": False, "onboarded": False, "photos": [], "interests": [], "prompts": [], "preferences": {},
        }
        await db.users.insert_one(dict(user))
    else:
        await db.users.update_one({"id": user["id"]}, {"$set": {"last_active": now_iso()}})
    return {"token": make_token(user["id"]), "user": own_profile(user), "is_new": is_new}


@router.get("/me")
async def me(user=Depends(get_current_user)):
    await db.users.update_one({"id": user["id"]}, {"$set": {"last_active": now_iso()}})
    return own_profile(user)


@router.delete("/account")
async def delete_account(user=Depends(get_current_user)):
    uid = user["id"]
    matches = await db.matches.find({"users": uid}, {"_id": 0}).to_list(None)
    for m in matches:
        other = [u for u in m["users"] if u != uid]
        if other:
            await manager.send(other[0], {"type": "unmatch", "match_id": m["id"]})
    match_ids = [m["id"] for m in matches]
    await db.messages.delete_many({"match_id": {"$in": match_ids}})
    await db.matches.delete_many({"users": uid})
    await db.swipes.delete_many({"$or": [{"from_id": uid}, {"to_id": uid}]})
    await db.blocks.delete_many({"$or": [{"from_id": uid}, {"to_id": uid}]})
    for url in user.get("photos") or []:
        try:
            (UPLOAD_DIR / url.split("/")[-1]).unlink(missing_ok=True)
        except Exception:
            pass
    await db.users.delete_one({"id": uid})
    return {"ok": True}
