"""In-process checks for 'Sign in with ChatGPT' (device code) + orb lookup on the ChatGPT account - OpenAI calls stubbed."""
import asyncio
import base64
import io
import json
import os
import sys
import time

import httpx
from dotenv import load_dotenv

sys.path.insert(0, os.path.dirname(__file__))
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

import chatgpt_account as cg  # noqa: E402
import routes_ai  # noqa: E402
from server import app  # noqa: E402
from core import db, make_token  # noqa: E402


def jwt(payload: dict) -> str:
    b = lambda d: base64.urlsafe_b64encode(json.dumps(d).encode()).decode().rstrip("=")  # noqa: E731
    return f"{b({'alg': 'none'})}.{b(payload)}.sig"


def tiny_jpeg() -> str:
    from PIL import Image
    im = Image.new("RGB", (64, 64), (40, 90, 200))
    buf = io.BytesIO()
    im.save(buf, "JPEG")
    return "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode()


FAKE_TOKENS = {
    "access_token": jwt({"https://api.openai.com/auth": {"chatgpt_account_id": "acct_123", "chatgpt_plan_type": "plus"}, "https://api.openai.com/profile": {"email": "neo@example.com"}}),
    "refresh_token": "rt_1", "id_token": "", "expires_at": time.time() + 3600,
}


async def main():
    user = await db.users.find_one({"onboarded": True}, {"_id": 0})
    h = {"Authorization": f"Bearer {make_token(user['id'])}"}

    calls = {"poll": 0, "answer": 0, "refresh": 0}

    async def fake_start():
        return {"device_auth_id": "dev_1", "user_code": "ABCD-12345", "interval": 0.1, "verify_url": cg.DEVICE_VERIFY_URL}

    async def fake_poll(device_auth_id, user_code):
        calls["poll"] += 1
        return ("pending", None) if calls["poll"] < 2 else ("done", dict(FAKE_TOKENS))

    async def fake_models(creds, account_id):
        assert account_id == "acct_123"
        return ["gpt-5.5", "gpt-5.4-mini"]

    async def fake_answer(creds, account_id, model, system, turns, image_b64):
        calls["answer"] += 1
        assert creds["access_token"] and account_id == "acct_123" and model in ("gpt-5.5", "gpt-5.4-mini")
        return "A blue square - probably a placeholder image.\nTERMS: travel, music"

    async def fake_refresh(creds):
        calls["refresh"] += 1
        return {**creds, "access_token": FAKE_TOKENS["access_token"], "expires_at": time.time() + 3600}

    cg.start_device_login = fake_start
    cg.poll_device_login = fake_poll
    cg.list_models = fake_models
    cg.codex_answer = fake_answer
    cg.refresh_tokens = fake_refresh

    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://t") as c:
        await c.delete("/api/ai/links/chatgpt", headers=h)
        r = await c.post("/api/ai/links", headers=h, json={"provider": "chatgpt", "api_key": "sk-whatever-123456"})
        assert r.status_code == 400 and "Sign in" in r.json()["detail"], r.text
        print("key path blocked for chatgpt: ok")

        r = await c.post("/api/ai/chatgpt/start", headers=h)
        assert r.status_code == 201, r.text
        s = r.json()
        assert s["user_code"] == "ABCD-12345" and s["verify_url"].startswith("https://auth.openai.com/") and s["session_id"]
        print("start: ok", s["user_code"])

        r = await c.get(f"/api/ai/chatgpt/poll/{s['session_id']}", headers=h)
        assert r.json()["status"] == "pending", r.text
        await asyncio.sleep(0.2)
        r = await c.get(f"/api/ai/chatgpt/poll/{s['session_id']}", headers=h)
        d = r.json()
        assert d["status"] == "connected", d
        link = d["link"]
        assert link["provider"] == "chatgpt" and link["email"] == "neo@example.com" and link["plan_label"] == "ChatGPT Plus" and link["model"] == "gpt-5.5" and link["active"]
        assert "ciphertext" not in link and "access_token" not in json.dumps(link)
        row = await db.ai_links.find_one({"user_id": user["id"], "provider": "chatgpt"})
        assert "rt_1" not in json.dumps({k: v for k, v in row.items() if k != "_id"}), "tokens must be encrypted"
        assert json.loads(routes_ai._decrypt(row["ciphertext"]))["refresh_token"] == "rt_1"
        print("poll -> connected + encrypted tokens: ok", link["email"], link["plan_label"], link["models"])

        # polling again after success keeps saying connected
        r = await c.get(f"/api/ai/chatgpt/poll/{s['session_id']}", headers=h)
        assert r.json()["status"] == "connected"
        r = await c.get("/api/ai/chatgpt/poll/nope", headers=h)
        assert r.json()["status"] == "expired"

        r = await c.get("/api/ai/links", headers=h)
        assert r.json()["active"] == "chatgpt" and any(p["id"] == "chatgpt" and p["visible"] for p in r.json()["providers"])

        r = await c.post("/api/ai/lookup", headers=h, json={"image": tiny_jpeg(), "route": "/discover"})
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["provider"] == "chatgpt" and d["provider_name"] == "ChatGPT" and d["model"] == "gpt-5.5"
        assert d["answer"].startswith("A blue square") and d["terms"] == ["travel", "music"], d
        assert any(t["name"] in ("Travel", "Music") for t in d["found"]["topics"])
        print("lookup via ChatGPT account: ok", {k: len(v) for k, v in d["found"].items()})

        # expiring token -> refreshed before the call and re-saved
        old = json.loads(routes_ai._decrypt(row["ciphertext"]))
        old["expires_at"] = time.time() + 10
        await db.ai_links.update_one({"id": row["id"]}, {"$set": {"ciphertext": routes_ai._encrypt(json.dumps(old))}})
        r = await c.post("/api/ai/lookup", headers=h, json={"image": tiny_jpeg()})
        assert r.status_code == 200 and calls["refresh"] == 1, (r.text, calls)
        row2 = await db.ai_links.find_one({"id": row["id"]})
        assert json.loads(routes_ai._decrypt(row2["ciphertext"]))["expires_at"] > time.time() + 3000
        print("token refresh: ok")

        r = await c.put("/api/ai/links/chatgpt", headers=h, json={"model": "gpt-5.4-mini"})
        assert r.status_code == 200 and r.json()["model"] == "gpt-5.4-mini"
        r = await c.delete("/api/ai/links/chatgpt", headers=h)
        assert r.status_code == 200
        r = await c.post("/api/ai/lookup", headers=h, json={"image": tiny_jpeg()})
        assert r.status_code == 428
        print("model + disconnect: ok")


asyncio.run(main())
