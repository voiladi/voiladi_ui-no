"""WebSocket connection manager + endpoint for real-time events."""
import logging
from typing import Dict, Set

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from core import db, decode_token, now_iso

logger = logging.getLogger("voiladi.ws")
router = APIRouter(prefix="/api")


class ConnectionManager:
    def __init__(self):
        self.active: Dict[str, Set[WebSocket]] = {}

    async def connect(self, user_id: str, ws: WebSocket):
        await ws.accept()
        self.active.setdefault(user_id, set()).add(ws)

    def disconnect(self, user_id: str, ws: WebSocket):
        conns = self.active.get(user_id)
        if conns:
            conns.discard(ws)
            if not conns:
                self.active.pop(user_id, None)

    def is_online(self, user_id: str) -> bool:
        return bool(self.active.get(user_id))

    async def send(self, user_id: str, payload: dict):
        for ws in list(self.active.get(user_id, [])):
            try:
                await ws.send_json(payload)
            except Exception:
                self.disconnect(user_id, ws)


manager = ConnectionManager()


@router.websocket("/ws/{token}")
async def ws_endpoint(ws: WebSocket, token: str):
    user_id = decode_token(token)
    if not user_id:
        await ws.close(code=4001)
        return
    await manager.connect(user_id, ws)
    await ws.send_json({"type": "hello", "user_id": user_id})
    try:
        while True:
            data = await ws.receive_json()
            t = data.get("type")
            if t == "ping":
                await ws.send_json({"type": "pong"})
            elif t == "typing":
                match_id = data.get("match_id")
                if not match_id:
                    continue
                match = await db.matches.find_one({"id": match_id, "users": user_id, "active": True}, {"_id": 0})
                if match:
                    other = [u for u in match["users"] if u != user_id][0]
                    await manager.send(other, {"type": "typing", "match_id": match_id, "user_id": user_id, "at": now_iso()})
    except WebSocketDisconnect:
        manager.disconnect(user_id, ws)
    except Exception as e:  # noqa
        logger.debug(f"ws closed: {e}")
        manager.disconnect(user_id, ws)
