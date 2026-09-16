"""Push notification device tokens + per-user preferences.

  POST   /api/push/tokens   {token, platform, device?, app_version?}  register this device for the signed-in user
  DELETE /api/push/tokens   {token}                                   forget it (logout)
  GET    /api/push/prefs    -> {prefs, devices, enabled}
  PUT    /api/push/prefs    {likes?, requests?, messages?, verification?}
  POST   /api/push/test     sends a test notification to the caller's devices
"""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

import push
from core import db, get_current_user, now_iso

router = APIRouter(prefix="/api/push", tags=["push"])


class TokenIn(BaseModel):
    token: str = Field(min_length=20, max_length=4096)
    platform: str = "android"
    device: Optional[str] = None
    app_version: Optional[str] = None


class TokenOut(BaseModel):
    token: str = Field(min_length=20, max_length=4096)


class PrefsIn(BaseModel):
    likes: Optional[bool] = None
    requests: Optional[bool] = None
    messages: Optional[bool] = None
    verification: Optional[bool] = None


@router.post("/tokens")
async def register_token(body: TokenIn, user=Depends(get_current_user)):
    # a token belongs to exactly one account: re-point it if another user signed in on the same phone
    await db.push_tokens.update_one(
        {"token": body.token},
        {"$set": {"user_id": user["id"], "platform": body.platform[:20], "device": (body.device or "")[:80],
                  "app_version": (body.app_version or "")[:20], "updated_at": now_iso()},
         "$setOnInsert": {"created_at": now_iso()}},
        upsert=True,
    )
    return {"ok": True, "enabled": push.enabled()}


@router.delete("/tokens")
async def delete_token(body: TokenOut, user=Depends(get_current_user)):
    await db.push_tokens.delete_one({"token": body.token, "user_id": user["id"]})
    return {"ok": True}


@router.get("/prefs")
async def get_prefs(user=Depends(get_current_user)):
    devices = await db.push_tokens.find({"user_id": user["id"]}, {"_id": 0, "device": 1, "platform": 1, "app_version": 1, "updated_at": 1}).to_list(20)
    return {"prefs": push.prefs_of(user), "devices": devices, "enabled": push.enabled()}


@router.put("/prefs")
async def set_prefs(body: PrefsIn, user=Depends(get_current_user)):
    prefs = push.prefs_of(user)
    for k, v in body.model_dump(exclude_none=True).items():
        prefs[k] = bool(v)
    await db.users.update_one({"id": user["id"]}, {"$set": {"push_prefs": prefs}})
    return {"prefs": prefs}


@router.post("/test")
async def test_push(user=Depends(get_current_user)):
    if not push.enabled():
        raise HTTPException(status_code=503, detail="Push notifications aren't configured on the server")
    tokens = await db.push_tokens.count_documents({"user_id": user["id"]})
    if not tokens:
        raise HTTPException(status_code=404, detail="No phone registered yet. Open the Voiladi app on your phone once, then try again")
    sent = await push.send(user["id"], "test", "Voiladi", "Notifications are on. This is how they'll look.", path="/settings/notifications",
                           photo=push.photo_of(user), tag="test", user=user)
    return {"ok": True, "sent": sent, "devices": tokens}
