"""In-process checks for the orb visual search backend (provider call is stubbed - no real keys needed)."""
import asyncio
import base64
import io
import os
import sys

import httpx
from dotenv import load_dotenv

sys.path.insert(0, os.path.dirname(__file__))
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

import routes_ai  # noqa: E402
from server import app  # noqa: E402
from core import db, make_token  # noqa: E402


def tiny_jpeg() -> str:
    from PIL import Image
    im = Image.new("RGB", (64, 64), (200, 40, 40))
    buf = io.BytesIO()
    im.save(buf, "JPEG")
    return "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode()


async def main():
    user = await db.users.find_one({"onboarded": True, "is_seed": {"$ne": True}}, {"_id": 0}) or await db.users.find_one({"onboarded": True}, {"_id": 0})
    assert user, "need at least one onboarded user"
    token = make_token(user["id"])
    h = {"Authorization": f"Bearer {token}"}

    # stub the provider so we exercise everything around it
    async def fake_models(provider, key):
        return ["gpt-test-1", "gpt-test-mini"]

    async def fake_answer(provider, key, model, system, turns, image_b64):
        assert image_b64 is not None or len(turns) > 1
        return "That's a coffee cup on a wooden table.\nTERMS: coffee, travel, mumbai"

    routes_ai.provider_models = fake_models
    routes_ai.provider_answer = fake_answer

    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://t") as c:
        await c.delete("/api/ai/links/openai", headers=h)
        r = await c.post("/api/ai/lookup", headers=h, json={"image": tiny_jpeg()})
        assert r.status_code == 428, r.text
        print("428 without link: ok")

        r = await c.post("/api/ai/links", headers=h, json={"provider": "openai", "api_key": "sk-test-1234567890"})
        assert r.status_code == 201, r.text
        link = r.json()
        assert link["hint"] == "…7890" and link["model"] == "gpt-test-1" and link["active"] is True and "ciphertext" not in link
        row = await db.ai_links.find_one({"user_id": user["id"], "provider": "openai"})
        assert "sk-test-1234567890" not in str(row) and routes_ai._decrypt(row["ciphertext"]) == "sk-test-1234567890"
        print("connect + encryption: ok", link)

        r = await c.put("/api/ai/links/openai", headers=h, json={"model": "gpt-test-mini"})
        assert r.status_code == 200 and r.json()["model"] == "gpt-test-mini"
        r = await c.put("/api/ai/links/openai", headers=h, json={"model": "nope"})
        assert r.status_code == 400
        print("model picker: ok")

        r = await c.post("/api/ai/lookup", headers=h, json={"image": tiny_jpeg(), "route": "/explore", "texts": ["Coffee", "12 members"]})
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["answer"].startswith("That's a coffee cup") and "TERMS" not in d["answer"]
        assert d["terms"] == ["coffee", "travel", "mumbai"], d["terms"]
        assert any(t["name"] == "Coffee" for t in d["found"]["topics"]), d["found"]["topics"]
        print("lookup: ok ->", {k: len(v) for k, v in d["found"].items()}, d["provider_name"], d["model"])

        r = await c.post("/api/ai/lookup", headers=h, json={"image": tiny_jpeg(), "question": "Where can I get one?",
                                                            "history": [{"role": "user", "text": "What did I mark?"}, {"role": "assistant", "text": "A coffee cup."}]})
        assert r.status_code == 200, r.text
        print("follow-up: ok")

        r = await c.post("/api/ai/lookup", headers=h, json={"image": "data:image/png;base64,AAAA"})
        assert r.status_code == 400
        r = await c.post("/api/ai/lookup", headers=h, json={})
        assert r.status_code == 400
        print("validation: ok")

        r = await c.delete("/api/ai/links/openai", headers=h)
        assert r.status_code == 200
        r = await c.get("/api/ai/links", headers=h)
        assert r.json()["links"] == []
        print("disconnect: ok")


asyncio.run(main())
