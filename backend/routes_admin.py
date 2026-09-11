"""Operator-only endpoints: review user reports. Gated by ADMIN_API_KEY (x-admin-key header)."""
import os
import secrets
from typing import Optional

from fastapi import APIRouter, HTTPException, Header

from core import db, now_iso, calc_age

router = APIRouter(prefix="/api/admin", tags=["admin"])

ADMIN_API_KEY = os.environ.get("ADMIN_API_KEY", "")


def require_admin(x_admin_key: Optional[str]):
    if not ADMIN_API_KEY:
        raise HTTPException(status_code=503, detail="Admin access is not configured (set ADMIN_API_KEY)")
    if not x_admin_key or not secrets.compare_digest(x_admin_key, ADMIN_API_KEY):
        raise HTTPException(status_code=401, detail="Invalid admin key")


def _brief(u: Optional[dict]) -> Optional[dict]:
    if not u:
        return None
    return {"id": u["id"], "name": u.get("name") or "Someone", "age": calc_age(u.get("birthday")), "phone": u.get("phone"),
            "photo": (u.get("photos") or [None])[0], "created_at": u.get("created_at")}


@router.get("/reports")
async def list_reports(status: str = "open", limit: int = 100, x_admin_key: Optional[str] = Header(default=None)):
    require_admin(x_admin_key)
    q = {}
    if status in ("open", "resolved"):
        q["status"] = status if status == "resolved" else {"$ne": "resolved"}
    reports = await db.reports.find(q, {"_id": 0}).sort("created_at", -1).to_list(min(max(limit, 1), 500))
    ids = {r["from_id"] for r in reports} | {r["to_id"] for r in reports}
    users = {u["id"]: u for u in await db.users.find({"id": {"$in": list(ids)}}, {"_id": 0}).to_list(None)}
    # how many distinct people have reported each target (helps triage)
    counts = {}
    for row in await db.reports.aggregate([{"$group": {"_id": "$to_id", "n": {"$sum": 1}}}]).to_list(None):
        counts[row["_id"]] = row["n"]
    out = []
    for r in reports:
        out.append({
            "id": r["id"], "reason": r.get("reason"), "details": r.get("details", ""), "created_at": r.get("created_at"),
            "status": r.get("status", "open"), "resolved_at": r.get("resolved_at"),
            "reporter": _brief(users.get(r["from_id"])), "reported": _brief(users.get(r["to_id"])),
            "reported_total_reports": counts.get(r["to_id"], 0),
        })
    return {"reports": out, "count": len(out)}


@router.post("/reports/{report_id}/resolve")
async def resolve_report(report_id: str, x_admin_key: Optional[str] = Header(default=None)):
    require_admin(x_admin_key)
    res = await db.reports.update_one({"id": report_id}, {"$set": {"status": "resolved", "resolved_at": now_iso()}})
    if not res.matched_count:
        raise HTTPException(status_code=404, detail="Report not found")
    return {"ok": True}


# ---------- registered users (operator roster) ----------
@router.get("/users")
async def list_users(include_seed: bool = False, limit: int = 500, x_admin_key: Optional[str] = Header(default=None)):
    """Every registered account, newest first. Sample profiles are excluded unless include_seed=true."""
    require_admin(x_admin_key)
    q = {} if include_seed else {"is_seed": {"$ne": True}}
    fields = {"_id": 0, "id": 1, "name": 1, "username": 1, "email": 1, "phone": 1, "phone_verified": 1, "birthday": 1,
              "gender": 1, "city": 1, "onboarded": 1, "verified": 1, "verification_status": 1, "photos": 1,
              "created_at": 1, "last_seen": 1, "last_active": 1, "is_seed": 1}
    rows = await db.users.find(q, fields).sort("created_at", -1).to_list(min(max(limit, 1), 2000))
    out = []
    for u in rows:
        out.append({
            "id": u.get("id"), "name": u.get("name"), "username": u.get("username"), "email": u.get("email"),
            "phone": u.get("phone"), "phone_verified": bool(u.get("phone_verified") or u.get("phone")),
            "age": calc_age(u.get("birthday")), "gender": u.get("gender"), "city": u.get("city"),
            "onboarded": bool(u.get("onboarded")), "verified": bool(u.get("verified")),
            "verification_status": u.get("verification_status"), "photos": len(u.get("photos") or []),
            "created_at": u.get("created_at"), "last_seen": u.get("last_seen") or u.get("last_active"),
            "is_seed": bool(u.get("is_seed")),
        })
    return {"users": out, "count": len(out),
            "total_real": await db.users.count_documents({"is_seed": {"$ne": True}}),
            "total_sample": await db.users.count_documents({"is_seed": True})}


@router.delete("/users/{user_id}")
async def admin_delete_user(user_id: str, x_admin_key: Optional[str] = Header(default=None)):
    """Permanently erase an account and all of its data (same routine as self-service account deletion)."""
    require_admin(x_admin_key)
    from routes_auth import purge_user  # local import avoids a circular import at module load
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    removed = await purge_user(user)
    return {"ok": True, "deleted": {"id": user_id, "name": user.get("name"), "email": user.get("email"), "phone": user.get("phone")},
            "removed": removed}


# ---------- demo data (sample profiles flagged is_seed) ----------
@router.get("/seed")
async def seed_status(x_admin_key: Optional[str] = Header(default=None)):
    require_admin(x_admin_key)
    return {"sample_profiles": await db.users.count_documents({"is_seed": True}),
            "real_users": await db.users.count_documents({"is_seed": {"$ne": True}})}


@router.post("/seed")
async def seed_profiles(likes_for: Optional[str] = None, x_admin_key: Optional[str] = Header(default=None)):
    """Upsert the curated sample profiles (idempotent). Optionally make a few of them like `likes_for` (a phone)."""
    require_admin(x_admin_key)
    from seed import seed as run_seed  # local import: dev tool, only loaded when an operator asks for it
    await run_seed(likes_for)
    return await seed_status(x_admin_key)


@router.delete("/seed")
async def purge_profiles(x_admin_key: Optional[str] = Header(default=None)):
    """Remove every sample profile plus their swipes, matches and messages. Real users are untouched."""
    require_admin(x_admin_key)
    from seed import clear as run_clear
    before = await db.users.count_documents({"is_seed": True})
    await run_clear()
    return {"removed": before, **(await seed_status(x_admin_key))}
