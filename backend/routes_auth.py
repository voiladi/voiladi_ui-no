"""Authentication: email + password accounts, phone OTP verification (providers: dev | twilio_verify | twilio_sms)."""
import re
import secrets
import uuid
import logging
import time
from datetime import timedelta, datetime
from typing import Optional

import httpx
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel

from core import (ensure_username, db, now, now_iso, make_token, get_current_user, own_profile, OTP_PROVIDER, is_test_phone,
                  hash_password, verify_password,
                  TWILIO_SID, TWILIO_TOKEN, TWILIO_FROM, TWILIO_MESSAGING_SID, TWILIO_VERIFY_SID, UPLOAD_DIR)
from ws_manager import manager
from security import lock_remaining, LOCK_AFTER, LOCK_WINDOW_SEC, LOCK_FOR_SEC

logger = logging.getLogger("voiladi.auth")
router = APIRouter(prefix="/api/auth", tags=["auth"])

OTP_TTL_MIN = 10
RESEND_COOLDOWN_SEC = 30
MAX_ATTEMPTS = 5
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
MIN_PASSWORD = 6

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


class EmailPasswordIn(BaseModel):
    email: str
    password: str


def normalize_phone(p: str) -> str:
    p = p.strip()
    digits = "".join(ch for ch in p if ch.isdigit())
    if len(digits) < 7 or len(digits) > 15:
        raise HTTPException(status_code=400, detail="Enter a valid phone number")
    return "+" + digits


def normalize_email(e: str) -> str:
    e = (e or "").strip().lower()
    if not EMAIL_RE.match(e) or len(e) > 120:
        raise HTTPException(status_code=400, detail="Enter a valid email address")
    return e


def _new_user_doc(**extra) -> dict:
    return {
        "id": str(uuid.uuid4()), "created_at": now_iso(), "last_active": now_iso(),
        "profile_complete": False, "onboarded": False, "photos": [], "interests": [], "prompts": [],
        "looking_for": "everyone", "preferences": {"show_me": "everyone"}, "profile_views": 0,
        **extra,
    }


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


# ---------- email + password ----------
@router.post("/register")
async def register(body: EmailPasswordIn):
    email = normalize_email(body.email)
    if len(body.password) < MIN_PASSWORD:
        raise HTTPException(status_code=400, detail=f"Password should be at least {MIN_PASSWORD} characters")
    if len(body.password) > 128:
        raise HTTPException(status_code=400, detail="Password is too long")
    if await db.users.find_one({"email": email}, {"_id": 0, "id": 1}):
        raise HTTPException(status_code=400, detail="An account with this email already exists. Log in instead")
    pw_hash, salt = hash_password(body.password)
    user = _new_user_doc(email=email, password_hash=pw_hash, password_salt=salt)
    await db.users.insert_one(dict(user))
    return {"token": make_token(user["id"]), "user": own_profile(user), "is_new": True}


@router.post("/login")
async def login(body: EmailPasswordIn):
    """Email + password. After LOCK_AFTER wrong passwords in LOCK_WINDOW_SEC the account cools off for LOCK_FOR_SEC (brute-force guard)."""
    email = normalize_email(body.email)
    user = await db.users.find_one({"email": email}, {"_id": 0})
    ts = time.time()
    if user:
        remaining = lock_remaining(user, ts)
        if remaining > 0:
            raise HTTPException(status_code=429, detail=f"Too many attempts. Try again in {max(1, remaining // 60)} min")
    ok = bool(user) and verify_password(body.password, user.get("password_hash"), user.get("password_salt"))
    if not ok:
        if user:
            lock = user.get("login_lock") or {}
            fails = [t for t in (lock.get("fails") or []) if ts - t < LOCK_WINDOW_SEC] + [ts]
            new_lock = {"fails": fails[-LOCK_AFTER:], "until": ts + LOCK_FOR_SEC if len(fails) >= LOCK_AFTER else 0}
            await db.users.update_one({"id": user["id"]}, {"$set": {"login_lock": new_lock}})
            if new_lock["until"]:
                logger.warning("login locked for %s after %d failures", user["id"], len(fails))
        raise HTTPException(status_code=400, detail="Incorrect email or password")
    await db.users.update_one({"id": user["id"]}, {"$set": {"last_active": now_iso()}, "$unset": {"login_lock": ""}})
    return {"token": make_token(user["id"]), "user": own_profile(user), "is_new": False}


# ---------- phone OTP ----------
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


async def _check_otp(phone: str, code: str) -> None:
    """Validate a code against the pending session for `phone`; raises on failure, consumes the session on success."""
    code = code.strip()
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


@router.post("/verify-otp")
async def verify_otp(body: VerifyIn):
    """Log in (or create an account) with a phone number alone."""
    phone = normalize_phone(body.phone)
    await _check_otp(phone, body.code)
    user = await db.users.find_one({"phone": phone}, {"_id": 0})
    is_new = False
    if not user:
        is_new = True
        user = _new_user_doc(phone=phone, phone_verified_at=now_iso())
        await db.users.insert_one(dict(user))
    else:
        await db.users.update_one({"id": user["id"]}, {"$set": {"last_active": now_iso()}})
    return {"token": make_token(user["id"]), "user": own_profile(user), "is_new": is_new}


@router.post("/verify-phone")
async def verify_phone(body: VerifyIn, user=Depends(get_current_user)):
    """Attach a verified phone number to the signed-in (email) account."""
    phone = normalize_phone(body.phone)
    other = await db.users.find_one({"phone": phone, "id": {"$ne": user["id"]}}, {"_id": 0, "id": 1})
    if other:
        raise HTTPException(status_code=400, detail="This number is already linked to another account")
    await _check_otp(phone, body.code)
    await db.users.update_one({"id": user["id"]}, {"$set": {"phone": phone, "phone_verified_at": now_iso(), "last_active": now_iso()}})
    fresh = await db.users.find_one({"id": user["id"]}, {"_id": 0})
    return own_profile(fresh)


class ChangeEmailIn(BaseModel):
    email: str
    password: Optional[str] = None


@router.put("/email")
async def change_email(body: ChangeEmailIn, user=Depends(get_current_user)):
    """Settings > Account > Email. Accounts with a password must confirm it; phone-only accounts can just add/replace their email."""
    email = normalize_email(body.email)
    if user.get("password_hash"):
        if not body.password:
            raise HTTPException(status_code=400, detail="Enter your password to change your email")
        if not verify_password(body.password, user.get("password_hash"), user.get("password_salt")):
            raise HTTPException(status_code=400, detail="Incorrect password")
    if email == (user.get("email") or ""):
        raise HTTPException(status_code=400, detail="That's already your email")
    other = await db.users.find_one({"email": email, "id": {"$ne": user["id"]}}, {"_id": 0, "id": 1})
    if other:
        raise HTTPException(status_code=400, detail="An account with this email already exists")
    await db.users.update_one({"id": user["id"]}, {"$set": {"email": email, "updated_at": now_iso(), "last_active": now_iso()}})
    fresh = await db.users.find_one({"id": user["id"]}, {"_id": 0})
    return own_profile(fresh)


@router.get("/me")
async def me(user=Depends(get_current_user)):
    await db.users.update_one({"id": user["id"]}, {"$set": {"last_active": now_iso()}})
    await ensure_username(user)
    return own_profile(user)


async def purge_user(user: dict) -> dict:
    """Erase an account and everything it owns: chats + media files, swipes, blocks, reports, OTP sessions, photos,
    verification selfie, pending uploads. Match partners get an `unmatch` so their inbox updates live."""
    uid = user["id"]
    matches = await db.matches.find({"users": uid}, {"_id": 0}).to_list(None)
    for m in matches:
        other = [u for u in m["users"] if u != uid]
        if other:
            try:
                await manager.send(other[0], {"type": "unmatch", "match_id": m["id"]})
            except Exception:
                pass
    match_ids = [m["id"] for m in matches]
    media_dir = UPLOAD_DIR / "media"
    files_removed = 0
    async for msg in db.messages.find({"match_id": {"$in": match_ids}, "media": {"$exists": True}}, {"_id": 0, "media": 1}):
        media = msg.get("media") or {}
        for key in ("file", "poster_file"):
            if media.get(key):
                try:
                    (media_dir / media[key].split("/")[-1]).unlink(missing_ok=True)
                    files_removed += 1
                except Exception:
                    pass
    counts = {
        "messages": (await db.messages.delete_many({"match_id": {"$in": match_ids}})).deleted_count,
        "matches": (await db.matches.delete_many({"users": uid})).deleted_count,
        "swipes": (await db.swipes.delete_many({"$or": [{"from_id": uid}, {"to_id": uid}]})).deleted_count,
        "blocks": (await db.blocks.delete_many({"$or": [{"from_id": uid}, {"to_id": uid}]})).deleted_count,
        "reports": (await db.reports.delete_many({"$or": [{"from_id": uid}, {"to_id": uid}]})).deleted_count,
        "pending_uploads": (await db.media_uploads.delete_many({"user_id": uid})).deleted_count,
    }
    if user.get("phone"):
        counts["otp_sessions"] = (await db.otp_sessions.delete_many({"phone": user["phone"]})).deleted_count
    for url in list(user.get("photos") or []) + [((user.get("verification") or {}).get("selfie_url"))]:
        if not url:
            continue
        try:
            (UPLOAD_DIR / url.split("/")[-1]).unlink(missing_ok=True)
            files_removed += 1
        except Exception:
            pass
    counts["files_removed"] = files_removed
    counts["user"] = (await db.users.delete_one({"id": uid})).deleted_count
    return counts


@router.delete("/account")
async def delete_account(user=Depends(get_current_user)):
    await purge_user(user)
    return {"ok": True}
