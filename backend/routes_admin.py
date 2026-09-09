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
