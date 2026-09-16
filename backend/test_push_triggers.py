"""
Test that push notification triggers don't break existing APIs (fire-and-forget).
Tests swipe, chat, and verification flows.
"""
import requests
import sys

BASE_URL = "https://match-fresh.preview.emergentagent.com/api"

# Test tokens
KIARA_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIwNWFhMzRlYy1iMjE3LTQ1M2UtOTRkNi1jYjQzODQ2ZjZmODAiLCJleHAiOjE3OTE1MzUwMTAsImlhdCI6MTc4ODk0MzAxMH0.DVLvGrD5mYf214ED-cVHGh_YO_-8L0Vct-tiGiwCH0U"
RAHUL_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJlODk1YTEyYS1mNWQ3LTQyMmQtODA0ZC04MzQ0ZWNlMzQxZDAiLCJleHAiOjE3OTE1MzUwMTEsImlhdCI6MTc4ODk0MzAxMX0.2Le7KhNp2qe3DdF1f7b6ylTCz6pGOdAvAvXM3wW1c_k"

class TriggerTester:
    def __init__(self):
        self.tests_run = 0
        self.tests_passed = 0
        self.tests_failed = 0
        self.failed_tests = []

    def log(self, msg, level="INFO"):
        prefix = {
            "INFO": "ℹ️",
            "PASS": "✅",
            "FAIL": "❌",
            "WARN": "⚠️"
        }.get(level, "•")
        print(f"{prefix} {msg}")

    def test(self, name, fn):
        """Run a test function and track results"""
        self.tests_run += 1
        self.log(f"Testing: {name}", "INFO")
        try:
            fn()
            self.tests_passed += 1
            self.log(f"PASSED: {name}", "PASS")
            return True
        except AssertionError as e:
            self.tests_failed += 1
            self.failed_tests.append({"name": name, "error": str(e)})
            self.log(f"FAILED: {name} - {e}", "FAIL")
            return False
        except Exception as e:
            self.tests_failed += 1
            self.failed_tests.append({"name": name, "error": f"Exception: {e}"})
            self.log(f"ERROR: {name} - {e}", "FAIL")
            return False

    def headers(self, token):
        return {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }

    def test_swipe_api(self):
        """POST /api/swipe should still return 200 with matched/match fields"""
        # Get a profile to swipe on
        r = requests.get(f"{BASE_URL}/discover", headers=self.headers(KIARA_TOKEN))
        assert r.status_code == 200, f"Discover failed: {r.status_code}"
        profiles = r.json().get("profiles", [])
        
        if not profiles:
            self.log("No profiles to swipe on, skipping swipe test", "WARN")
            return
        
        target_id = profiles[0]["id"]
        
        # Swipe (like)
        r = requests.post(f"{BASE_URL}/swipe", headers=self.headers(KIARA_TOKEN), json={
            "target_id": target_id,
            "action": "like"
        })
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
        data = r.json()
        assert "matched" in data, "Missing 'matched' field"
        assert "match" in data, "Missing 'match' field"
        assert isinstance(data["matched"], bool), "matched should be boolean"

    def test_dm_request_api(self):
        """POST /api/dm/{user_id} should still work (may require verified account)"""
        # Get Rahul's user ID
        rahul_id = "e895a12a-f5d7-422d-804d-8344ece341d0"  # From RAHUL_TOKEN
        
        r = requests.post(f"{BASE_URL}/dm/{rahul_id}", headers=self.headers(KIARA_TOKEN))
        # May return 403 if account is not verified, which is expected
        if r.status_code == 403:
            detail = r.json().get("detail", "")
            if "verify" in detail.lower():
                self.log("DM requires verification (expected behavior)", "INFO")
                return
        
        assert r.status_code in [200, 403], f"Expected 200 or 403, got {r.status_code}: {r.text}"
        
        if r.status_code == 200:
            data = r.json()
            assert "id" in data, "Missing 'id' field in DM response"

    def test_send_message_api(self):
        """POST /api/matches/{id}/messages should still work"""
        # Get matches
        r = requests.get(f"{BASE_URL}/matches", headers=self.headers(KIARA_TOKEN))
        assert r.status_code == 200, f"Expected 200, got {r.status_code}"
        matches = r.json().get("matches", [])
        
        if not matches:
            self.log("No matches to send message to, skipping message test", "WARN")
            return
        
        match_id = matches[0]["id"]
        
        # Send message
        r = requests.post(f"{BASE_URL}/matches/{match_id}/messages", headers=self.headers(KIARA_TOKEN), json={
            "text": "Test message for push notification trigger"
        })
        
        # May return 403 if not verified
        if r.status_code == 403:
            detail = r.json().get("detail", "")
            if "verify" in detail.lower():
                self.log("Messaging requires verification (expected behavior)", "INFO")
                return
        
        assert r.status_code in [200, 403], f"Expected 200 or 403, got {r.status_code}: {r.text}"

    def run_all_tests(self):
        """Run all trigger tests"""
        self.log("=" * 60, "INFO")
        self.log("PUSH NOTIFICATION TRIGGER TESTS", "INFO")
        self.log("=" * 60, "INFO")
        
        self.test("POST /api/swipe - trigger doesn't break API", self.test_swipe_api)
        self.test("POST /api/dm/{user_id} - trigger doesn't break API", self.test_dm_request_api)
        self.test("POST /api/matches/{id}/messages - trigger doesn't break API", self.test_send_message_api)
        
        # Summary
        self.log("=" * 60, "INFO")
        self.log(f"TESTS RUN: {self.tests_run}", "INFO")
        self.log(f"PASSED: {self.tests_passed}", "PASS")
        self.log(f"FAILED: {self.tests_failed}", "FAIL")
        self.log("=" * 60, "INFO")
        
        if self.failed_tests:
            self.log("FAILED TESTS:", "FAIL")
            for test in self.failed_tests:
                self.log(f"  - {test['name']}: {test['error']}", "FAIL")
        
        return 0 if self.tests_failed == 0 else 1

if __name__ == "__main__":
    tester = TriggerTester()
    sys.exit(tester.run_all_tests())
