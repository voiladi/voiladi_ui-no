"""Voiladi API entrypoint."""
import os
import logging

from fastapi import FastAPI
from starlette.middleware.cors import CORSMiddleware

from core import db, client, SMS_ENABLED, OTP_PROVIDER
import routes_auth
import routes_profile
import routes_discover
import routes_chat
import routes_admin
import ws_manager

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("voiladi")

app = FastAPI(title="Voiladi API", version="1.0.0")


@app.get("/api/")
async def root():
    return {"app": "Voiladi", "status": "ok", "sms_enabled": SMS_ENABLED, "otp_provider": OTP_PROVIDER}


@app.get("/api/health")
async def health():
    return {"status": "ok"}


app.include_router(routes_auth.router)
app.include_router(routes_profile.router)
app.include_router(routes_discover.router)
app.include_router(routes_chat.router)
app.include_router(routes_admin.router)
app.include_router(ws_manager.router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)


async def _sparse_unique(field: str):
    """Unique index that ignores documents without the field (email-only and phone-only accounts coexist)."""
    name = f"{field}_1"
    info = await db.users.index_information()
    if name in info and not info[name].get("sparse"):
        await db.users.drop_index(name)
    await db.users.create_index(field, unique=True, sparse=True)


@app.on_event("startup")
async def ensure_indexes():
    try:
        await db.users.create_index("id", unique=True)
        await _sparse_unique("phone")
        await _sparse_unique("email")
        await db.users.create_index([("profile_complete", 1), ("gender", 1)])
        await db.otp_sessions.create_index("phone", unique=True)
        await db.swipes.create_index([("from_id", 1), ("to_id", 1)], unique=True)
        await db.swipes.create_index([("to_id", 1), ("action", 1)])
        await db.matches.create_index("id", unique=True)
        await db.matches.create_index("users")
        await db.messages.create_index([("match_id", 1), ("created_at", 1)])
        await db.blocks.create_index([("from_id", 1), ("to_id", 1)], unique=True)
        await db.reports.create_index([("status", 1), ("created_at", -1)])
        await db.reports.create_index("to_id")
        logger.info("Indexes ready. OTP provider: %s (sms_enabled=%s)", OTP_PROVIDER, SMS_ENABLED)
    except Exception as e:
        logger.warning(f"Index creation issue: {e}")


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
