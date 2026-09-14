"""Comprehensive backend tests for AI orb feature."""
import asyncio
import base64
import io
import os
import sys

import httpx
from dotenv import load_dotenv

sys.path.insert(0, os.path.dirname(__file__))
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

import routes_ai
from server import app
from core import db, make_token

def tiny_jpeg() -> str:
    from PIL import Image
    im = Image.new("RGB", (64, 64), (200, 40, 40))
    buf = io.BytesIO()
    im.save(buf, "JPEG")
    return "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode()


async def main():
    print("=" * 60)
    print("COMPREHENSIVE AI ORB BACKEND TESTS")
    print("=" * 60)
    
    # Find or create test user
    user = await db.users.find_one({"onboarded": True, "is_seed": {"$ne": True}}, {"_id": 0})
    if not user:
        user = await db.users.find_one({"onboarded": True}, {"_id": 0})
    assert user, "need at least one onboarded user"
    
    token = make_token(user["id"])
    h = {"Authorization": f"Bearer {token}"}
    
    # Stub provider calls
    async def fake_models(provider, key):
        if "invalid" in key.lower() or "fake" in key.lower():
            # Simulate provider rejection - use the same pattern as routes_ai
            from fastapi import HTTPException
            raise HTTPException(status_code=400, detail=f"{routes_ai.PROVIDERS[provider]['name']} didn't accept this key. Check it and try again")
        return ["gpt-test-1", "gpt-test-mini"]
    
    async def fake_answer(provider, key, model, system, turns, image_b64):
        assert image_b64 is not None or len(turns) > 1
        return "That's a coffee cup on a wooden table.\nTERMS: coffee, travel, mumbai"
    
    original_models = routes_ai.provider_models
    original_answer = routes_ai.provider_answer
    routes_ai.provider_models = fake_models
    routes_ai.provider_answer = fake_answer
    
    passed = []
    failed = []
    
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://t") as c:
        # Clean up any existing links
        for provider in ["openai", "anthropic", "gemini"]:
            await c.delete(f"/api/ai/links/{provider}", headers=h)
        
        # TEST 1: GET /api/ai/providers (public)
        try:
            r = await c.get("/api/ai/providers")
            assert r.status_code == 200, f"Expected 200, got {r.status_code}"
            data = r.json()
            assert "providers" in data
            assert len(data["providers"]) == 3
            provider_ids = [p["id"] for p in data["providers"]]
            assert "openai" in provider_ids
            assert "anthropic" in provider_ids
            assert "gemini" in provider_ids
            passed.append("GET /api/ai/providers (public)")
            print("✅ GET /api/ai/providers (public)")
        except Exception as e:
            failed.append(f"GET /api/ai/providers: {e}")
            print(f"❌ GET /api/ai/providers: {e}")
        
        # TEST 2: GET /api/ai/links (authenticated, empty)
        try:
            r = await c.get("/api/ai/links", headers=h)
            assert r.status_code == 200
            data = r.json()
            assert data["links"] == []
            assert data["active"] is None
            passed.append("GET /api/ai/links (empty)")
            print("✅ GET /api/ai/links (empty)")
        except Exception as e:
            failed.append(f"GET /api/ai/links (empty): {e}")
            print(f"❌ GET /api/ai/links (empty): {e}")
        
        # TEST 3: POST /api/ai/links with invalid key (should return 400 with friendly message)
        try:
            r = await c.post("/api/ai/links", headers=h, json={"provider": "openai", "api_key": "sk-fake-000000000000"})
            assert r.status_code == 400, f"Expected 400, got {r.status_code}"
            data = r.json()
            assert "didn't accept this key" in data["detail"].lower() or "check it" in data["detail"].lower()
            passed.append("POST /api/ai/links with invalid key returns 400 with friendly message")
            print("✅ POST /api/ai/links with invalid key returns 400 with friendly message")
        except Exception as e:
            failed.append(f"POST /api/ai/links (invalid key): {e}")
            print(f"❌ POST /api/ai/links (invalid key): {e}")
        
        # TEST 4: POST /api/ai/links with valid stubbed key
        try:
            r = await c.post("/api/ai/links", headers=h, json={"provider": "openai", "api_key": "sk-test-1234567890"})
            assert r.status_code == 201, f"Expected 201, got {r.status_code}"
            link = r.json()
            assert link["hint"] == "…7890"
            assert link["model"] == "gpt-test-1"
            assert link["active"] is True
            assert "ciphertext" not in link
            assert "api_key" not in link
            # Verify DB stores ciphertext only
            row = await db.ai_links.find_one({"user_id": user["id"], "provider": "openai"})
            assert "sk-test-1234567890" not in str(row)
            assert "ciphertext" in row
            passed.append("POST /api/ai/links with valid key (encryption, no ciphertext in response)")
            print("✅ POST /api/ai/links with valid key (encryption, no ciphertext in response)")
        except Exception as e:
            failed.append(f"POST /api/ai/links (valid key): {e}")
            print(f"❌ POST /api/ai/links (valid key): {e}")
        
        # TEST 5: Connect second provider
        try:
            r = await c.post("/api/ai/links", headers=h, json={"provider": "anthropic", "api_key": "sk-ant-test-9876543210"})
            assert r.status_code == 201
            link = r.json()
            assert link["provider"] == "anthropic"
            assert link["active"] is False  # First one stays active
            passed.append("POST /api/ai/links second provider (active=false)")
            print("✅ POST /api/ai/links second provider (active=false)")
        except Exception as e:
            failed.append(f"POST /api/ai/links (second provider): {e}")
            print(f"❌ POST /api/ai/links (second provider): {e}")
        
        # TEST 6: PUT /api/ai/links/{provider} - model validation
        try:
            r = await c.put("/api/ai/links/openai", headers=h, json={"model": "gpt-test-mini"})
            assert r.status_code == 200
            assert r.json()["model"] == "gpt-test-mini"
            
            r = await c.put("/api/ai/links/openai", headers=h, json={"model": "invalid-model"})
            assert r.status_code == 400
            passed.append("PUT /api/ai/links/{provider} model validation")
            print("✅ PUT /api/ai/links/{provider} model validation")
        except Exception as e:
            failed.append(f"PUT /api/ai/links (model): {e}")
            print(f"❌ PUT /api/ai/links (model): {e}")
        
        # TEST 7: PUT /api/ai/links/{provider} - active switching
        try:
            r = await c.put("/api/ai/links/anthropic", headers=h, json={"active": True})
            assert r.status_code == 200
            assert r.json()["active"] is True
            
            # Verify openai is now inactive
            openai_row = await db.ai_links.find_one({"user_id": user["id"], "provider": "openai"})
            assert openai_row["active"] is False
            passed.append("PUT /api/ai/links/{provider} active switching")
            print("✅ PUT /api/ai/links/{provider} active switching")
        except Exception as e:
            failed.append(f"PUT /api/ai/links (active): {e}")
            print(f"❌ PUT /api/ai/links (active): {e}")
        
        # TEST 8: DELETE /api/ai/links/{provider} - remove and promote next
        try:
            r = await c.delete("/api/ai/links/anthropic", headers=h)
            assert r.status_code == 200
            
            # Verify openai is promoted to active
            openai_row = await db.ai_links.find_one({"user_id": user["id"], "provider": "openai"})
            assert openai_row["active"] is True
            passed.append("DELETE /api/ai/links/{provider} removes and promotes next")
            print("✅ DELETE /api/ai/links/{provider} removes and promotes next")
        except Exception as e:
            failed.append(f"DELETE /api/ai/links: {e}")
            print(f"❌ DELETE /api/ai/links: {e}")
        
        # TEST 9: POST /api/ai/lookup - 428 when nothing linked
        try:
            await c.delete("/api/ai/links/openai", headers=h)
            r = await c.post("/api/ai/lookup", headers=h, json={"image": tiny_jpeg()})
            assert r.status_code == 428
            passed.append("POST /api/ai/lookup returns 428 when nothing linked")
            print("✅ POST /api/ai/lookup returns 428 when nothing linked")
        except Exception as e:
            failed.append(f"POST /api/ai/lookup (428): {e}")
            print(f"❌ POST /api/ai/lookup (428): {e}")
        
        # Reconnect for remaining tests
        await c.post("/api/ai/links", headers=h, json={"provider": "openai", "api_key": "sk-test-1234567890"})
        
        # TEST 10: POST /api/ai/lookup - 400 on non-JPEG
        try:
            r = await c.post("/api/ai/lookup", headers=h, json={"image": "data:image/png;base64,AAAA"})
            assert r.status_code == 400
            passed.append("POST /api/ai/lookup returns 400 on non-JPEG")
            print("✅ POST /api/ai/lookup returns 400 on non-JPEG")
        except Exception as e:
            failed.append(f"POST /api/ai/lookup (non-JPEG): {e}")
            print(f"❌ POST /api/ai/lookup (non-JPEG): {e}")
        
        # TEST 11: POST /api/ai/lookup - 400 on bad base64
        try:
            r = await c.post("/api/ai/lookup", headers=h, json={"image": "data:image/jpeg;base64,!!!invalid!!!"})
            assert r.status_code == 400
            passed.append("POST /api/ai/lookup returns 400 on bad base64")
            print("✅ POST /api/ai/lookup returns 400 on bad base64")
        except Exception as e:
            failed.append(f"POST /api/ai/lookup (bad base64): {e}")
            print(f"❌ POST /api/ai/lookup (bad base64): {e}")
        
        # TEST 12: POST /api/ai/lookup - 400 on empty body
        try:
            r = await c.post("/api/ai/lookup", headers=h, json={})
            assert r.status_code == 400
            passed.append("POST /api/ai/lookup returns 400 on empty body")
            print("✅ POST /api/ai/lookup returns 400 on empty body")
        except Exception as e:
            failed.append(f"POST /api/ai/lookup (empty): {e}")
            print(f"❌ POST /api/ai/lookup (empty): {e}")
        
        # TEST 13: POST /api/ai/lookup - 200 with stubbed answer
        try:
            r = await c.post("/api/ai/lookup", headers=h, json={
                "image": tiny_jpeg(),
                "route": "/explore",
                "texts": ["Coffee", "12 members"],
                "user_ids": [],
                "post_ids": []
            })
            assert r.status_code == 200
            data = r.json()
            assert "answer" in data
            assert "TERMS" not in data["answer"]  # Should be stripped
            assert data["terms"] == ["coffee", "travel", "mumbai"]
            assert "found" in data
            assert "people" in data["found"]
            assert "posts" in data["found"]
            assert "topics" in data["found"]
            # Check if Coffee topic is found
            topics = data["found"]["topics"]
            coffee_found = any(t["name"] == "Coffee" for t in topics)
            assert coffee_found, "Coffee topic should be found"
            passed.append("POST /api/ai/lookup returns 200 with stubbed answer and parsed terms")
            print("✅ POST /api/ai/lookup returns 200 with stubbed answer and parsed terms")
        except Exception as e:
            failed.append(f"POST /api/ai/lookup (success): {e}")
            print(f"❌ POST /api/ai/lookup (success): {e}")
        
        # TEST 14: POST /api/ai/lookup - follow-up with history
        try:
            r = await c.post("/api/ai/lookup", headers=h, json={
                "image": tiny_jpeg(),
                "question": "Where can I get one?",
                "history": [
                    {"role": "user", "text": "What did I mark?"},
                    {"role": "assistant", "text": "A coffee cup."}
                ]
            })
            assert r.status_code == 200
            data = r.json()
            assert "answer" in data
            passed.append("POST /api/ai/lookup follow-up with history works")
            print("✅ POST /api/ai/lookup follow-up with history works")
        except Exception as e:
            failed.append(f"POST /api/ai/lookup (follow-up): {e}")
            print(f"❌ POST /api/ai/lookup (follow-up): {e}")
        
        # TEST 15: POST /api/ai/lookup - 401 without auth
        try:
            r = await c.post("/api/ai/lookup", json={"image": tiny_jpeg()})
            assert r.status_code == 401
            passed.append("POST /api/ai/lookup returns 401 without auth")
            print("✅ POST /api/ai/lookup returns 401 without auth")
        except Exception as e:
            failed.append(f"POST /api/ai/lookup (401): {e}")
            print(f"❌ POST /api/ai/lookup (401): {e}")
        
        # Clean up
        await c.delete("/api/ai/links/openai", headers=h)
    
    # Restore original functions
    routes_ai.provider_models = original_models
    routes_ai.provider_answer = original_answer
    
    print("\n" + "=" * 60)
    print(f"RESULTS: {len(passed)} passed, {len(failed)} failed")
    print("=" * 60)
    
    if failed:
        print("\n❌ FAILED TESTS:")
        for f in failed:
            print(f"  - {f}")
    
    if passed:
        print("\n✅ PASSED TESTS:")
        for p in passed:
            print(f"  - {p}")
    
    return len(failed) == 0


if __name__ == "__main__":
    success = asyncio.run(main())
    sys.exit(0 if success else 1)
