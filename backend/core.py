"""Shared config, database, auth helpers and serializers for Voiladi."""
import os
import math
import hmac
import hashlib
import secrets
import logging
from pathlib import Path
from datetime import datetime, timezone, timedelta, date
from typing import Optional, Tuple, List

import jwt
from dotenv import load_dotenv
from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from motor.motor_asyncio import AsyncIOMotorClient

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

logger = logging.getLogger("voiladi")

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

JWT_SECRET = os.environ.get("JWT_SECRET", "voiladi-dev-secret-change-me")
JWT_ALG = "HS256"
UPLOAD_DIR = Path(os.environ.get("UPLOAD_DIR", str(ROOT_DIR / "uploads")))
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

TWILIO_SID = os.environ.get("TWILIO_ACCOUNT_SID")
TWILIO_TOKEN = os.environ.get("TWILIO_AUTH_TOKEN")
TWILIO_FROM = os.environ.get("TWILIO_FROM_NUMBER")
TWILIO_MESSAGING_SID = os.environ.get("TWILIO_MESSAGING_SERVICE_SID")
TWILIO_VERIFY_SID = os.environ.get("TWILIO_VERIFY_SERVICE_SID")


def _detect_otp_provider() -> str:
    """dev (code shown in app) | twilio_verify (Twilio Verify API) | twilio_sms (our code via Messages API)."""
    forced = (os.environ.get("OTP_PROVIDER") or "auto").strip().lower()
    if forced in ("dev", "twilio_verify", "twilio_sms"):
        return forced
    if TWILIO_SID and TWILIO_TOKEN and TWILIO_VERIFY_SID:
        return "twilio_verify"
    if TWILIO_SID and TWILIO_TOKEN and (TWILIO_MESSAGING_SID or TWILIO_FROM):
        return "twilio_sms"
    return "dev"


OTP_PROVIDER = _detect_otp_provider()
SMS_ENABLED = OTP_PROVIDER != "dev"
# Phone prefixes that always use the in-app dev code (seeded/test accounts, app-store review), even when SMS is live.
OTP_TEST_PREFIXES = [p.strip() for p in (os.environ.get("OTP_TEST_PREFIXES") or "").split(",") if p.strip()]


def is_test_phone(phone: str) -> bool:
    return any(phone.startswith(p) for p in OTP_TEST_PREFIXES)

ANYWHERE_KM = 250  # slider max => no distance filter
DEFAULT_PREFS = {"age_min": 18, "age_max": 30, "max_distance_km": ANYWHERE_KM, "show_me": "everyone", "interests": [], "goals": []}
GENDERS = ["woman", "man", "nonbinary"]
SHOW_ME = ["women", "men", "everyone"]
SHOW_ME_TO_GENDER = {"women": "woman", "men": "man"}

# Fields that must never leave the server.
PRIVATE_FIELDS = ("_id", "password_hash", "password_salt")

bearer = HTTPBearer(auto_error=False)


# ---------- time helpers ----------
def now() -> datetime:
    return datetime.now(timezone.utc)


def now_iso() -> str:
    return now().isoformat()


def calc_age(birthday: Optional[str]) -> Optional[int]:
    if not birthday:
        return None
    try:
        b = date.fromisoformat(birthday[:10])
    except ValueError:
        return None
    t = date.today()
    return t.year - b.year - ((t.month, t.day) < (b.month, b.day))


def haversine_km(lat1, lng1, lat2, lng2) -> float:
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dl = math.radians(lng2 - lng1)
    a = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def distance_between(a: dict, b: dict) -> Optional[float]:
    if a.get("lat") is None or a.get("lng") is None or b.get("lat") is None or b.get("lng") is None:
        return None
    return haversine_km(a["lat"], a["lng"], b["lat"], b["lng"])


# ---------- passwords (stdlib PBKDF2, no extra dependency) ----------
PBKDF2_ROUNDS = 200_000


def hash_password(password: str, salt: Optional[str] = None) -> Tuple[str, str]:
    salt = salt or secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), bytes.fromhex(salt), PBKDF2_ROUNDS)
    return digest.hex(), salt


def verify_password(password: str, password_hash: Optional[str], salt: Optional[str]) -> bool:
    if not password_hash or not salt:
        return False
    digest, _ = hash_password(password, salt)
    return hmac.compare_digest(digest, password_hash)


# ---------- auth ----------
def make_token(user_id: str) -> str:
    payload = {"sub": user_id, "exp": now() + timedelta(days=30), "iat": now()}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)


def decode_token(token: str) -> Optional[str]:
    try:
        data = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
        return data.get("sub")
    except Exception:
        return None


async def get_current_user(creds: HTTPAuthorizationCredentials = Depends(bearer)) -> dict:
    if not creds:
        raise HTTPException(status_code=401, detail="Not authenticated")
    user_id = decode_token(creds.credentials)
    if not user_id:
        raise HTTPException(status_code=401, detail="Session expired. Please sign in again")
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="Account not found")
    return user


# ---------- profile logic ----------
def get_prefs(user: dict) -> dict:
    return {**DEFAULT_PREFS, **(user.get("preferences") or {})}


def has_basics(user: dict) -> bool:
    """Name, adult age and gender: the minimum needed to enter the app."""
    age = calc_age(user.get("birthday"))
    return bool((user.get("name") or "").strip() and age is not None and age >= 18 and user.get("gender") in GENDERS)


def is_profile_complete(user: dict) -> bool:
    """A complete profile is discoverable by others: basics + who to show + a photo + 3 interests."""
    return bool(
        has_basics(user)
        and (user.get("looking_for") or "everyone") in SHOW_ME
        and len(user.get("photos") or []) >= 1
        and len(user.get("interests") or []) >= 3
    )


def compatibility(a: dict, b: dict) -> Tuple[int, List[str]]:
    """Deterministic score 0-99 from shared interests, prompt overlap, age proximity and distance."""
    ia = set(x.lower() for x in (a.get("interests") or []))
    ib = set(x.lower() for x in (b.get("interests") or []))
    shared = sorted(ia & ib)
    score = 20.0  # baseline: you're both here
    score += 40.0 * min(1.0, len(shared) / 4.0)
    qa = set(p.get("question") for p in (a.get("prompts") or []))
    qb = set(p.get("question") for p in (b.get("prompts") or []))
    score += min(10.0, 3.5 * len(qa & qb))
    age_a, age_b = calc_age(a.get("birthday")), calc_age(b.get("birthday"))
    if age_a is not None and age_b is not None:
        score += 15.0 * max(0.0, 1.0 - abs(age_a - age_b) / 10.0)
    else:
        score += 7.0
    dist = distance_between(a, b)
    if dist is None:
        score += 8.0
    else:
        score += 15.0 * max(0.0, 1.0 - dist / 300.0)
    # display casing from a's list
    label_map = {x.lower(): x for x in (a.get("interests") or [])}
    return int(max(5, min(99, round(score)))), [label_map[s] for s in shared]


def is_verified(user: dict) -> bool:
    """The black tick ("Verified Profile"): a live selfie was reviewed and approved by the team."""
    return (user.get("verification") or {}).get("status") == "approved"


# ---------- usernames ----------
import re as _re

USERNAME_RE = _re.compile(r"^[a-z0-9](?:[a-z0-9._]{1,18}[a-z0-9])?$")
RESERVED_USERNAMES = {"admin", "voiladi", "support", "help", "official", "root", "api", "www", "team", "staff", "moderator", "mod", "null", "undefined"}


def normalize_username(raw: str) -> str:
    return (raw or "").strip().lstrip("@").lower()


def username_problem(u: str) -> Optional[str]:
    """Return a human message if the handle is not acceptable, else None."""
    if len(u) < 3:
        return "Username needs at least 3 characters"
    if len(u) > 20:
        return "Username can be up to 20 characters"
    if ".." in u or "__" in u or "._" in u or "_." in u:
        return "Use single dots or underscores between letters"
    if not USERNAME_RE.match(u):
        return "Only lowercase letters, numbers, dots and underscores"
    if u in RESERVED_USERNAMES:
        return "That username isn't available"
    return None


async def username_taken(u: str, exclude_id: Optional[str] = None) -> bool:
    q = {"username": u}
    if exclude_id:
        q["id"] = {"$ne": exclude_id}
    return await db.users.count_documents(q) > 0


def _username_seed(user: dict) -> str:
    base = _re.sub(r"[^a-z0-9]+", ".", (user.get("name") or "").lower()).strip(".")
    if len(base) < 3:
        local = (user.get("email") or "").split("@")[0].lower()
        base = _re.sub(r"[^a-z0-9]+", ".", local).strip(".")
    if len(base) < 3:
        base = "user"
    return base[:16]


async def ensure_username(user: dict) -> str:
    """Existing accounts get a handle derived from their name the first time it's needed (e.g. neo, neo.2)."""
    if user.get("username"):
        return user["username"]
    base = _username_seed(user)
    cand = base
    n = 1
    while username_problem(cand) or await username_taken(cand, user["id"]):
        n += 1
        cand = f"{base[:16]}.{n}"
        if n > 500:
            cand = f"{base[:10]}.{secrets.token_hex(3)}"
            break
    await db.users.update_one({"id": user["id"]}, {"$set": {"username": cand}})
    user["username"] = cand
    return cand


def own_profile(user: dict) -> dict:
    u = {k: v for k, v in user.items() if k not in PRIVATE_FIELDS}
    u["age"] = calc_age(u.get("birthday"))
    u["preferences"] = get_prefs(u)
    u["profile_complete"] = is_profile_complete(u)
    u["has_basics"] = has_basics(u)
    u["onboarded"] = bool(u.get("onboarded"))
    u["verified"] = is_verified(u)
    v = user.get("verification") or {}
    u["verification"] = {"status": v.get("status") or "none", "submitted_at": v.get("submitted_at"), "reviewed_at": v.get("reviewed_at"), "note": v.get("note") or ""}
    u["has_password"] = bool(user.get("password_hash"))
    u.setdefault("photos", [])
    u.setdefault("interests", [])
    u.setdefault("prompts", [])
    u.setdefault("email", None)
    u.setdefault("phone", None)
    u.setdefault("job", "")
    u.setdefault("relationship_goal", "")
    u.setdefault("profile_views", 0)
    return u


def public_profile(user: dict, viewer: Optional[dict] = None) -> dict:
    p = {
        "id": user["id"],
        "name": user.get("name") or "Someone",
        "username": user.get("username") or "",
        "age": calc_age(user.get("birthday")),
        "gender": user.get("gender"),
        "bio": user.get("bio") or "",
        "job": user.get("job") or "",
        "relationship_goal": user.get("relationship_goal") or "",
        "interests": user.get("interests") or [],
        "prompts": user.get("prompts") or [],
        "photos": user.get("photos") or [],
        "city": user.get("city") or "",
        "last_active": user.get("last_active"),
        "created_at": user.get("created_at"),
        "verified": is_verified(user),
        "is_seed": bool(user.get("is_seed")),
    }
    if viewer:
        dist = distance_between(viewer, user)
        p["distance_km"] = round(dist) if dist is not None else None
        score, shared = compatibility(viewer, user)
        p["compatibility"] = score
        p["shared_interests"] = shared
    return p
