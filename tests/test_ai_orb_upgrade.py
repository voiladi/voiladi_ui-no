"""
Test the upgraded orb visual search feature:
1. Streaming endpoint POST /api/ai/lookup/stream
2. Enhanced non-stream endpoint POST /api/ai/lookup
3. _parse_answer function for TITLE:/KIND:/TERMS: format
4. Regression tests for existing AI endpoints
"""
import base64
import json
import time
import sys
from typing import Optional

import httpx

# Test configuration
BASE_URL = "https://match-fresh.preview.emergentagent.com"
KIARA_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIwNWFhMzRlYy1iMjE3LTQ1M2UtOTRkNi1jYjQzODQ2ZjZmODAiLCJleHAiOjE3OTE1MzUwMTAsImlhdCI6MTc4ODk0MzAxMH0.DVLvGrD5mYf214ED-cVHGh_YO_-8L0Vct-tiGiwCH0U"
KIARA_USER_ID = "05aa34ec-b217-453e-94d6-cb43846f6f80"

# Small valid JPEG (1x1 red pixel)
TINY_JPEG = "/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCwAA8A/9k="


class TestResults:
    def __init__(self):
        self.total = 0
        self.passed = 0
        self.failed = 0
        self.errors = []
    
    def record(self, name: str, passed: bool, error: Optional[str] = None):
        self.total += 1
        if passed:
            self.passed += 1
            print(f"✅ PASS: {name}")
        else:
            self.failed += 1
            print(f"❌ FAIL: {name}")
            if error:
                print(f"   Error: {error}")
                self.errors.append({"test": name, "error": error})
    
    def summary(self):
        print(f"\n{'='*60}")
        print(f"Test Summary: {self.passed}/{self.total} passed")
        print(f"{'='*60}")
        return self.failed == 0


def headers_with_token(token: str) -> dict:
    return {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }


async def test_stream_no_ai_link(results: TestResults):
    """Test 1: POST /api/ai/lookup/stream with valid token but NO ai_links → 428"""
    test_name = "Stream endpoint returns 428 when no AI link"
    
    # First, ensure no ai_links exist for this user
    from core import db
    await db.ai_links.delete_many({"user_id": KIARA_USER_ID})
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            payload = {
                "image": f"data:image/jpeg;base64,{TINY_JPEG}",
                "route": "/explore",
                "texts": [],
                "user_ids": [],
                "post_ids": []
            }
            r = await client.post(
                f"{BASE_URL}/api/ai/lookup/stream",
                headers=headers_with_token(KIARA_TOKEN),
                json=payload
            )
            
            if r.status_code == 428:
                # For streaming endpoint, check if it returns JSON error or NDJSON
                try:
                    data = r.json()
                    detail = data.get("detail", "")
                    if "Connect your AI in Settings first" in detail:
                        results.record(test_name, True)
                    else:
                        results.record(test_name, False, f"Wrong detail message: {detail}")
                except:
                    # Might be NDJSON format
                    text = r.text
                    if "Connect your AI in Settings first" in text:
                        results.record(test_name, True)
                    else:
                        results.record(test_name, False, f"Wrong response format: {text[:200]}")
            else:
                results.record(test_name, False, f"Expected 428, got {r.status_code}: {r.text[:200]}")
        except Exception as e:
            results.record(test_name, False, str(e))


async def test_lookup_no_ai_link(results: TestResults):
    """Test 2: POST /api/ai/lookup (non-stream) with no link → 428"""
    test_name = "Non-stream endpoint returns 428 when no AI link"
    
    # Ensure no ai_links exist
    from core import db
    await db.ai_links.delete_many({"user_id": KIARA_USER_ID})
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            payload = {
                "image": f"data:image/jpeg;base64,{TINY_JPEG}",
                "route": "/explore",
                "texts": [],
                "user_ids": [],
                "post_ids": []
            }
            r = await client.post(
                f"{BASE_URL}/api/ai/lookup",
                headers=headers_with_token(KIARA_TOKEN),
                json=payload
            )
            
            if r.status_code == 428:
                data = r.json()
                detail = data.get("detail", "")
                if "Connect your AI in Settings first" in detail:
                    results.record(test_name, True)
                else:
                    results.record(test_name, False, f"Wrong detail: {detail}")
            else:
                results.record(test_name, False, f"Expected 428, got {r.status_code}")
        except Exception as e:
            results.record(test_name, False, str(e))


async def test_lookup_no_image_no_question_with_link(results: TestResults):
    """Test 3: POST /api/ai/lookup with link but no image and no question → 400"""
    test_name = "Lookup returns 400 when no image and no question"
    
    # Insert a fake ai_link
    from core import db
    from routes_ai import _encrypt
    
    fake_tokens = json.dumps({
        "access_token": "eyJ.fake.tok",
        "refresh_token": "bad",
        "id_token": "",
        "expires_at": time.time() + 3600
    })
    
    fake_link = {
        "id": "test-fake-link-001",
        "user_id": KIARA_USER_ID,
        "provider": "chatgpt",
        "ciphertext": _encrypt(fake_tokens),
        "hint": "fake",
        "account_id": "acct_x",
        "model": "gpt-5.4-mini",
        "models": ["gpt-5.4-mini"],
        "active": True,
        "created_at": "2025-01-01T00:00:00Z",
        "updated_at": "2025-01-01T00:00:00Z"
    }
    
    await db.ai_links.delete_many({"user_id": KIARA_USER_ID})
    await db.ai_links.insert_one(fake_link)
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            payload = {
                "route": "/explore",
                "texts": [],
                "user_ids": [],
                "post_ids": []
            }
            r = await client.post(
                f"{BASE_URL}/api/ai/lookup",
                headers=headers_with_token(KIARA_TOKEN),
                json=payload
            )
            
            if r.status_code == 400:
                data = r.json()
                detail = data.get("detail", "")
                if "Nothing to look at" in detail:
                    results.record(test_name, True)
                else:
                    results.record(test_name, False, f"Wrong detail: {detail}")
            else:
                results.record(test_name, False, f"Expected 400, got {r.status_code}")
        except Exception as e:
            results.record(test_name, False, str(e))
        finally:
            # Cleanup
            await db.ai_links.delete_many({"user_id": KIARA_USER_ID, "id": "test-fake-link-001"})


async def test_stream_fake_token_expired(results: TestResults):
    """Test 4: Stream with fake ChatGPT link returns 409 when token is rejected"""
    test_name = "Stream returns 409 error in NDJSON when fake token expires"
    
    from core import db
    from routes_ai import _encrypt
    
    fake_tokens = json.dumps({
        "access_token": "eyJ.fake.tok",
        "refresh_token": "bad",
        "id_token": "",
        "expires_at": time.time() + 3600
    })
    
    fake_link = {
        "id": "test-fake-link-002",
        "user_id": KIARA_USER_ID,
        "provider": "chatgpt",
        "ciphertext": _encrypt(fake_tokens),
        "hint": "fake",
        "account_id": "acct_x",
        "model": "gpt-5.4-mini",
        "models": ["gpt-5.4-mini"],
        "active": True,
        "created_at": "2025-01-01T00:00:00Z",
        "updated_at": "2025-01-01T00:00:00Z"
    }
    
    await db.ai_links.delete_many({"user_id": KIARA_USER_ID})
    await db.ai_links.insert_one(fake_link)
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            payload = {
                "image": f"data:image/jpeg;base64,{TINY_JPEG}",
                "route": "/explore",
                "texts": [],
                "user_ids": [],
                "post_ids": []
            }
            r = await client.post(
                f"{BASE_URL}/api/ai/lookup/stream",
                headers=headers_with_token(KIARA_TOKEN),
                json=payload
            )
            
            if r.status_code == 200:
                # Should be NDJSON with error
                text = r.text
                lines = [l.strip() for l in text.split("\n") if l.strip()]
                
                # Look for error line
                found_error = False
                for line in lines:
                    try:
                        obj = json.loads(line)
                        if obj.get("type") == "error":
                            status = obj.get("status")
                            detail = obj.get("detail", "")
                            if status == 409 and "ChatGPT sign-in expired" in detail:
                                found_error = True
                                break
                    except:
                        continue
                
                if found_error:
                    results.record(test_name, True)
                else:
                    results.record(test_name, False, f"Expected error line with 409, got: {text[:300]}")
            else:
                results.record(test_name, False, f"Expected 200 with NDJSON error, got {r.status_code}")
        except Exception as e:
            results.record(test_name, False, str(e))
        finally:
            # Cleanup
            await db.ai_links.delete_many({"user_id": KIARA_USER_ID, "id": "test-fake-link-002"})


def test_parse_answer_unit(results: TestResults):
    """Test 5: Unit test _parse_answer function"""
    from routes_ai import _parse_answer
    
    # Test 1: Full format with TITLE, KIND, TERMS
    test_name = "Parse answer with TITLE/KIND/TERMS"
    try:
        result = _parse_answer("TITLE: Nike Air Force 1\nKIND: fashion\nWhite sneaker.\nTERMS: nike, sneakers")
        
        if (result["title"] == "Nike Air Force 1" and
            result["kind"] == "fashion" and
            result["answer"] == "White sneaker." and
            result["terms"] == ["nike", "sneakers"] and
            result["web_query"] == "Nike Air Force 1"):
            results.record(test_name, True)
        else:
            results.record(test_name, False, f"Unexpected result: {result}")
    except Exception as e:
        results.record(test_name, False, str(e))
    
    # Test 2: Plain text (no TITLE/KIND)
    test_name = "Parse plain text answer"
    try:
        result = _parse_answer("This is a plain text answer without special formatting.")
        
        if (result["title"] == "" and
            result["answer"] == "This is a plain text answer without special formatting."):
            results.record(test_name, True)
        else:
            results.record(test_name, False, f"Unexpected result: {result}")
    except Exception as e:
        results.record(test_name, False, str(e))
    
    # Test 3: KIND outside allowed list becomes 'other'
    test_name = "Parse answer with invalid KIND becomes 'other'"
    try:
        result = _parse_answer("TITLE: Something\nKIND: invalid_kind\nDescription here.")
        
        if result["kind"] == "other":
            results.record(test_name, True)
        else:
            results.record(test_name, False, f"Expected kind='other', got: {result['kind']}")
    except Exception as e:
        results.record(test_name, False, str(e))


async def test_regression_ai_endpoints(results: TestResults):
    """Test 6: Regression tests for existing AI endpoints"""
    
    # Test GET /api/ai/links
    test_name = "GET /api/ai/links"
    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            r = await client.get(
                f"{BASE_URL}/api/ai/links",
                headers=headers_with_token(KIARA_TOKEN)
            )
            
            if r.status_code == 200:
                data = r.json()
                if "links" in data and "providers" in data:
                    results.record(test_name, True)
                else:
                    results.record(test_name, False, f"Missing expected keys: {data.keys()}")
            else:
                results.record(test_name, False, f"Expected 200, got {r.status_code}")
        except Exception as e:
            results.record(test_name, False, str(e))
    
    # Test GET /api/ai/providers
    test_name = "GET /api/ai/providers"
    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            r = await client.get(
                f"{BASE_URL}/api/ai/providers",
                headers=headers_with_token(KIARA_TOKEN)
            )
            
            if r.status_code == 200:
                data = r.json()
                if "providers" in data:
                    results.record(test_name, True)
                else:
                    results.record(test_name, False, f"Missing 'providers' key")
            else:
                results.record(test_name, False, f"Expected 200, got {r.status_code}")
        except Exception as e:
            results.record(test_name, False, str(e))
    
    # Test POST /api/ai/chatgpt/start
    test_name = "POST /api/ai/chatgpt/start"
    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            r = await client.post(
                f"{BASE_URL}/api/ai/chatgpt/start",
                headers=headers_with_token(KIARA_TOKEN),
                json={}
            )
            
            # Should return 201 with session_id/user_code/verify_url OR 502 if OpenAI unreachable
            if r.status_code == 201:
                data = r.json()
                if "session_id" in data and "user_code" in data and "verify_url" in data:
                    results.record(test_name, True)
                else:
                    results.record(test_name, False, f"Missing expected keys: {data.keys()}")
            elif r.status_code == 502:
                # Acceptable - OpenAI unreachable
                results.record(test_name, True, "502 acceptable (OpenAI unreachable)")
            else:
                results.record(test_name, False, f"Expected 201 or 502, got {r.status_code}")
        except Exception as e:
            results.record(test_name, False, str(e))


async def main():
    print("="*60)
    print("Testing AI Orb Visual Search Upgrade")
    print("="*60)
    
    results = TestResults()
    
    # Backend tests
    print("\n--- Backend Tests ---")
    await test_stream_no_ai_link(results)
    await test_lookup_no_ai_link(results)
    await test_lookup_no_image_no_question_with_link(results)
    await test_stream_fake_token_expired(results)
    test_parse_answer_unit(results)
    await test_regression_ai_endpoints(results)
    
    # Summary
    success = results.summary()
    
    if not success:
        print("\n❌ Some tests failed. See errors above.")
        sys.exit(1)
    else:
        print("\n✅ All tests passed!")
        sys.exit(0)


if __name__ == "__main__":
    import asyncio
    asyncio.run(main())
