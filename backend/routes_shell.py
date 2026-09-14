"""Android shell diagnostics: crash traces posted by the app on the launch after a crash (no auth - it may crash before login)."""
import uuid
from typing import Optional

from fastapi import APIRouter, Header
from pydantic import BaseModel

from core import db, now_iso
from routes_admin import require_admin

router = APIRouter(prefix="/api/shell", tags=["shell"])


class CrashIn(BaseModel):
    shell: str = ""
    device: str = ""
    android: int = 0
    trace: str = ""


@router.post("/crash")
async def report_crash(body: CrashIn):
    await db.shell_crashes.insert_one({
        "id": str(uuid.uuid4()), "shell": body.shell[:40], "device": body.device[:120], "android": int(body.android or 0),
        "trace": body.trace[:20000], "created_at": now_iso(),
    })
    # keep the collection small
    old = await db.shell_crashes.find({}, {"_id": 0, "id": 1}).sort("created_at", -1).skip(200).to_list(None)
    if old:
        await db.shell_crashes.delete_many({"id": {"$in": [o["id"] for o in old]}})
    return {"ok": True}


@router.get("/crashes")
async def list_crashes(x_admin_key: Optional[str] = Header(default=None), limit: int = 20):
    require_admin(x_admin_key)
    rows = await db.shell_crashes.find({}, {"_id": 0}).sort("created_at", -1).to_list(max(1, min(limit, 200)))
    return {"crashes": rows}
