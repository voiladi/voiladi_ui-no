"""Phone + OTP authentication (providers: dev | twilio_verify | twilio_sms)."""
import secrets
import uuid
import logging
from datetime import timedelta, datetime

import httpx
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel

from core import (db, now, now_iso, make_token, get_current_user, own_profile, OTP_PROVIDER, is_test_phone,
                  TWILIO_SID, TWILIO_TOKEN, TWILIO_FROM, TWILIO_MESSAGING_SID, TWILIO_VERIFY_SID, UPLOAD_DIR)
from ws_manager import manager

logger = logging.getLogger("voiladi.auth")
router = APIRouter(prefix="/api/auth", tags=["auth"])

OTP_TTL_MIN = 10
RESEND_COOLDOWN_SEC = 30
MAX_ATTEMPTS = 5

# Twilio error code -> (http status, user-facing message). Codes are never logged or returned.
TWILIO_ERRORS = {
    21211: (400, "Enter a valid phone number"),
    21608: (400, "This number isn't allowed on our SMS account yet"),
    21614: (400, "That number can't receive texts"),
    60200: (400, "Enter a valid phone number"),
    60205: (400, "That number can't receive texts"),
    60203: (429, "Too many codes sent to this number. Try again in a bit"),
    60212: (429, "Too many requests. Wait a moment and try again"),
    60202: (429, "Too many attempts. Request a new code"),
    20429: (429, "Too many requests. Wait a moment and try again"),
    20404: (400, "That code expired. Request a new one"),
}
SMS_FAIL_MSG = "We couldn't send a text right now. Please try again in a minute"


class PhoneIn(BaseModel):
    phone: str


class VerifyIn(BaseModel):
    phone: str
    code: str


def normalize_phone(p: str) -> str:
    p = p.strip()
    digits = "".join(ch for ch in p if ch.isdigit())
    if len(digits) < 7 or len(digits) > 15:
        raise HTTPException(status_code=400, detail="Enter a valid phone number")
    return "+" + digits


def _twilio_http_error(r: httpx.Response, default_status: int = 502, default_msg: str = SMS_FAIL_MSG) -> HTTPException:
    code = None
    try:
        code = r.json().get("code")
    except ValueError:
        pass
    logger.error("Twilio request failed: http=%s code=%s", r.status_code, code)
    status, msg = TWILIO_ERRORS.get(code, (default_status, default_msg))
    return HTTPException(status_code=status, detail=msg)


async def twilio_verify_start(phone: str) -> None:
    url = f"https://verify.twilio.com/v2/Services/{TWILIO_VERIFY_SID}/Verifications"
    try:
        async with httpx.AsyncClient(timeout=15) as c:
            r = await c.post(url, data={"To": phone, "Channel": "sms"}, auth=(TWILIO_SID, TWILIO_TOKEN))
    except httpx.HTTPError as e:
        logger.error("Twilio Verify unreachable: %s", type(e).__name__)
        raise HTTPException(status_code=502, detail=SMS_FAIL_MSG)
    if r.status_code >= 300:
        raise _twilio_http_error(r)


async def twilio_verify_check(phone: str, code: str) -> bool:
    url = f"https://verify.twilio.com/v2/Services/{TWILIO_VERIFY_SID}/VerificationCheck"
    try:
        async with httpx.AsyncClient(timeout=15) as c:
            r = await c.post(url, data={"To": phone, "Code": code}, auth=(TWILIO_SID, TWILIO_TOKEN))
    except httpx.HTTPError as e:
        logger.error("Twilio Verify unreachable: %s", type(e).__name__)
        raise HTTPException(status_code=502, detail="Couldn't check the code right now. Try again")
    if r.status_code >= 300:
        raise _twilio_http_error(r, 502, "Couldn't check the code right now. Try again")
    return r.json().get("status") == "approved"


async def twilio_send_sms(phone: str, code: str) -> None:
    url = f"https://api.twilio.com/2010-04-01/Accounts/{TWILIO_SID}/Messages.json"
    data = {"To": phone, "Body": f"Your Voiladi code is {code}. It expires in {OTP_TTL_MIN} minutes. Don't share it with anyone."}
    if TWILIO_MESSAGING_SID:
        data["MessagingServiceSid"] = TWILIO_MESSAGING_SID
    else:
        data["From"] = TWILIO_FROM
    try:
        async with httpx.AsyncClient(timeout=15) as c:
            r = await c.post(url, data=data, auth=(TWILIO_SID, TWILIO_TOKEN))
    except httpx.HTTPError as e:
        logger.error("Twilio SMS unreachable: %s", type(e).__name__)
        raise HTTPException(status_code=502, detail=SMS_FAIL_MSG)
    if r.status_code >= 300:
        raise _twilio_http_error(r)


@router.post("/request-otp")
async def request_otp(body: PhoneIn):
    phone = normalize_phone(body.phone)
    existing = await db.otp_sessions.find_one({"phone": phone}, {"_id": 0})
    if existing and existing.get("created_at"):
        elapsed = (now() - datetime.fromisoformat(existing["created_at"])).total_seconds()
        if elapsed < RESEND_COOLDOWN_SEC:
            raise HTTPException(status_code=429, detail=f"Please wait {int(RESEND_COOLDOWN_SEC - elapsed)}s before requesting another code")

    provider = "dev" if (OTP_PROVIDER == "dev" or is_test_phone(phone)) else OTP_PROVIDER
    session = {"phone": phone, "provider": provider, "attempts": 0, "created_at": now_iso(),
               "expires_at": (now() + timedelta(minutes=OTP_TTL_MIN)).isoformat(), "code": None}
    resp = {"ok": True, "phone": phone, "sms_sent": False, "resend_in": RESEND_COOLDOWN_SEC}

    if provider == "twilio_verify":
        await twilio_verify_start(phone)  # Twilio generates + texts the code
        resp["sms_sent"] = True
    else:
        code = f"{secrets.randbelow(1000000):06d}"
        session["code"] = code
        if provider == "twilio_sms":
            await twilio_send_sms(phone, code)
            resp["sms_sent"] = True
        else:
            # No SMS for this number: surface the code in-app so the flow is testable end-to-end.
            resp["dev_mode"] = True
            resp["dev_code"] = code
    await db.otp_sessions.update_one({"phone": phone}, {"$set": session}, upsert=True)
    return resp


@router.post("/verify-otp")
async def verify_otp(body: VerifyIn):
    phone = normalize_phone(body.phone)
    code = body.code.strip()
    if not (code.isdigit() and len(code) == 6):
        raise HTTPException(status_code=400, detail="Enter the 6-digit code")
    sess = await db.otp_sessions.find_one({"phone": phone})
    if not sess:
        raise HTTPException(status_code=400, detail="Request a new code first")
    if datetime.fromisoformat(sess["expires_at"]) < now():
        raise HTTPException(status_code=400, detail="That code expired. Request a new one")
    if sess.get("attempts", 0) >= MAX_ATTEMPTS:
        raise HTTPException(status_code=429, detail="Too many attempts. Request a new code")

    if sess.get("provider") == "twilio_verify":
        ok = await twilio_verify_check(phone, code)
    else:
        ok = sess.get("code") == code
    if not ok:
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
