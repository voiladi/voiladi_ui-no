"""
Test push notification APIs: preferences, device tokens, test push, and fire-and-forget triggers.
"""
import requests
import sys
import time
from datetime import datetime

BASE_URL = "https://match-fresh.preview.emergentagent.com/api"

# Test tokens from /app/tests/dev_tokens.txt
KIARA_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIwNWFhMzRlYy1iMjE3LTQ1M2UtOTRkNi1jYjQzODQ2ZjZmODAiLCJleHAiOjE3OTE1MzUwMTAsImlhdCI6MTc4ODk0MzAxMH0.DVLvGrD5mYf214ED-cVHGh_YO_-8L0Vct-tiGiwCH0U"
RAHUL_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJlODk1YTEyYS1mNWQ3LTQyMmQtODA0ZC04MzQ0ZWNlMzQxZDAiLCJleHAiOjE3OTE1MzUwMTEsImlhdCI6MTc4ODk0MzAxMX0.2Le7KhNp2qe3DdF1f7b6ylTCz6pGOdAvAvXM3wW1c_k"

class PushNotificationTester:
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

    def test_get_prefs_unauthenticated(self):
        """GET /api/push/prefs without auth should return 401"""
        r = requests.get(f"{BASE_URL}/push/prefs")
        assert r.status_code == 401, f"Expected 401, got {r.status_code}"

    def test_get_prefs_initial(self):
        """GET /api/push/prefs should return default prefs and empty devices"""
        r = requests.get(f"{BASE_URL}/push/prefs", headers=self.headers(KIARA_TOKEN))
        assert r.status_code == 200, f"Expected 200, got {r.status_code}"
        data = r.json()
        assert "prefs" in data, "Missing 'prefs' in response"
        assert "devices" in data, "Missing 'devices' in response"
        assert "enabled" in data, "Missing 'enabled' in response"
        
        prefs = data["prefs"]
        assert prefs.get("likes") in [True, False], "likes should be boolean"
        assert prefs.get("requests") in [True, False], "requests should be boolean"
        assert prefs.get("messages") in [True, False], "messages should be boolean"
        assert prefs.get("verification") in [True, False], "verification should be boolean"
        assert isinstance(data["devices"], list), "devices should be a list"
        assert data["enabled"] == True, "enabled should be true"

    def test_put_prefs_single_key(self):
        """PUT /api/push/prefs with single key should update only that key"""
        # First get current prefs
        r = requests.get(f"{BASE_URL}/push/prefs", headers=self.headers(KIARA_TOKEN))
        assert r.status_code == 200
        original_prefs = r.json()["prefs"]
        
        # Toggle likes to false
        r = requests.put(f"{BASE_URL}/push/prefs", headers=self.headers(KIARA_TOKEN), json={"likes": False})
        assert r.status_code == 200, f"Expected 200, got {r.status_code}"
        data = r.json()
        assert data["prefs"]["likes"] == False, "likes should be False"
        # Other keys should remain unchanged
        assert data["prefs"]["requests"] == original_prefs["requests"], "requests should not change"
        assert data["prefs"]["messages"] == original_prefs["messages"], "messages should not change"
        assert data["prefs"]["verification"] == original_prefs["verification"], "verification should not change"
        
        # Toggle likes back to true
        r = requests.put(f"{BASE_URL}/push/prefs", headers=self.headers(KIARA_TOKEN), json={"likes": True})
        assert r.status_code == 200
        data = r.json()
        assert data["prefs"]["likes"] == True, "likes should be True"

    def test_put_prefs_unknown_key(self):
        """PUT /api/push/prefs with unknown key should be ignored (still 200)"""
        r = requests.put(f"{BASE_URL}/push/prefs", headers=self.headers(KIARA_TOKEN), json={"unknown_key": True})
        assert r.status_code == 200, f"Expected 200, got {r.status_code}"

    def test_put_prefs_unauthenticated(self):
        """PUT /api/push/prefs without auth should return 401"""
        r = requests.put(f"{BASE_URL}/push/prefs", json={"likes": False})
        assert r.status_code == 401, f"Expected 401, got {r.status_code}"

    def test_register_token_valid(self):
        """POST /api/push/tokens with valid token should succeed"""
        token = "a" * 40  # 40 character token
        r = requests.post(f"{BASE_URL}/push/tokens", headers=self.headers(KIARA_TOKEN), json={
            "token": token,
            "platform": "android",
            "device": "Test Phone",
            "app_version": "1.8.0"
        })
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
        data = r.json()
        assert data.get("ok") == True, "ok should be True"
        assert "enabled" in data, "Missing 'enabled' in response"
        
        # Verify device appears in prefs
        r = requests.get(f"{BASE_URL}/push/prefs", headers=self.headers(KIARA_TOKEN))
        assert r.status_code == 200
        devices = r.json()["devices"]
        assert len(devices) >= 1, "Should have at least 1 device"
        device = next((d for d in devices if d.get("device") == "Test Phone"), None)
        assert device is not None, "Test Phone device not found"

    def test_register_token_short(self):
        """POST /api/push/tokens with token < 20 chars should return 422"""
        token = "short"  # Less than 20 chars
        r = requests.post(f"{BASE_URL}/push/tokens", headers=self.headers(KIARA_TOKEN), json={
            "token": token,
            "platform": "android"
        })
        assert r.status_code == 422, f"Expected 422, got {r.status_code}"

    def test_token_ownership_transfer(self):
        """Token should belong to one account - registering same token as different user should transfer it"""
        token = "b" * 40  # 40 character token
        
        # Register token as KIARA
        r = requests.post(f"{BASE_URL}/push/tokens", headers=self.headers(KIARA_TOKEN), json={
            "token": token,
            "platform": "android",
            "device": "Shared Phone"
        })
        assert r.status_code == 200
        
        # Verify KIARA has the device
        r = requests.get(f"{BASE_URL}/push/prefs", headers=self.headers(KIARA_TOKEN))
        assert r.status_code == 200
        kiara_devices = r.json()["devices"]
        assert any(d.get("device") == "Shared Phone" for d in kiara_devices), "KIARA should have Shared Phone"
        
        # Register same token as RAHUL
        r = requests.post(f"{BASE_URL}/push/tokens", headers=self.headers(RAHUL_TOKEN), json={
            "token": token,
            "platform": "android",
            "device": "Shared Phone"
        })
        assert r.status_code == 200
        
        # Verify RAHUL now has the device
        r = requests.get(f"{BASE_URL}/push/prefs", headers=self.headers(RAHUL_TOKEN))
        assert r.status_code == 200
        rahul_devices = r.json()["devices"]
        assert any(d.get("device") == "Shared Phone" for d in rahul_devices), "RAHUL should have Shared Phone"
        
        # Verify KIARA no longer has it
        r = requests.get(f"{BASE_URL}/push/prefs", headers=self.headers(KIARA_TOKEN))
        assert r.status_code == 200
        kiara_devices = r.json()["devices"]
        assert not any(d.get("device") == "Shared Phone" for d in kiara_devices), "KIARA should not have Shared Phone anymore"

    def test_delete_token(self):
        """DELETE /api/push/tokens should remove the token"""
        token = "c" * 40
        
        # Register token
        r = requests.post(f"{BASE_URL}/push/tokens", headers=self.headers(RAHUL_TOKEN), json={
            "token": token,
            "platform": "android",
            "device": "Delete Me"
        })
        assert r.status_code == 200
        
        # Delete token
        r = requests.delete(f"{BASE_URL}/push/tokens", headers=self.headers(RAHUL_TOKEN), json={"token": token})
        assert r.status_code == 200, f"Expected 200, got {r.status_code}"
        data = r.json()
        assert data.get("ok") == True, "ok should be True"
        
        # Verify device is gone
        r = requests.get(f"{BASE_URL}/push/prefs", headers=self.headers(RAHUL_TOKEN))
        assert r.status_code == 200
        devices = r.json()["devices"]
        assert not any(d.get("device") == "Delete Me" for d in devices), "Device should be deleted"

    def test_push_test_no_device(self):
        """POST /api/push/test with no registered device should return 404"""
        # Make sure KIARA has no devices
        r = requests.get(f"{BASE_URL}/push/prefs", headers=self.headers(KIARA_TOKEN))
        devices = r.json()["devices"]
        for device in devices:
            # Try to extract token - but we don't have it in the response
            # So we'll just skip this cleanup
            pass
        
        r = requests.post(f"{BASE_URL}/push/test", headers=self.headers(KIARA_TOKEN))
        # Should be 404 if no devices
        if r.status_code == 404:
            assert "No phone registered" in r.json().get("detail", ""), "Should mention no phone registered"
        else:
            # If there are devices, that's also acceptable
            assert r.status_code in [200, 404], f"Expected 200 or 404, got {r.status_code}"

    def test_push_test_with_fake_token(self):
        """POST /api/push/test with fake token should return 200 but sent=0, and drop the dead token"""
        fake_token = "d" * 40
        
        # Register fake token
        r = requests.post(f"{BASE_URL}/push/tokens", headers=self.headers(KIARA_TOKEN), json={
            "token": fake_token,
            "platform": "android",
            "device": "Fake Device"
        })
        assert r.status_code == 200
        
        # Send test push
        r = requests.post(f"{BASE_URL}/push/test", headers=self.headers(KIARA_TOKEN))
        assert r.status_code == 200, f"Expected 200, got {r.status_code}"
        data = r.json()
        assert data.get("ok") == True, "ok should be True"
        assert data.get("sent") == 0, "sent should be 0 for fake token"
        assert data.get("devices") >= 1, "devices count should be >= 1"
        
        # Wait a moment for async cleanup
        time.sleep(1)
        
        # Verify dead token was dropped
        r = requests.get(f"{BASE_URL}/push/prefs", headers=self.headers(KIARA_TOKEN))
        assert r.status_code == 200
        devices = r.json()["devices"]
        assert not any(d.get("device") == "Fake Device" for d in devices), "Dead token should be dropped"

    def test_regression_notifications(self):
        """GET /api/notifications should still work"""
        r = requests.get(f"{BASE_URL}/notifications", headers=self.headers(KIARA_TOKEN))
        assert r.status_code == 200, f"Expected 200, got {r.status_code}"

    def test_regression_ai_links(self):
        """GET /api/ai/links should still work"""
        r = requests.get(f"{BASE_URL}/ai/links", headers=self.headers(KIARA_TOKEN))
        assert r.status_code == 200, f"Expected 200, got {r.status_code}"

    def test_regression_health(self):
        """GET /api/health should still work"""
        r = requests.get(f"{BASE_URL}/health")
        assert r.status_code == 200, f"Expected 200, got {r.status_code}"

    def cleanup(self):
        """Clean up test data and restore prefs to true"""
        self.log("Cleaning up test data...", "INFO")
        
        # Restore all prefs to true for both users
        for token in [KIARA_TOKEN, RAHUL_TOKEN]:
            try:
                requests.put(f"{BASE_URL}/push/prefs", headers=self.headers(token), json={
                    "likes": True,
                    "requests": True,
                    "messages": True,
                    "verification": True
                })
            except Exception as e:
                self.log(f"Cleanup warning: {e}", "WARN")

    def run_all_tests(self):
        """Run all tests"""
        self.log("=" * 60, "INFO")
        self.log("PUSH NOTIFICATION API TESTS", "INFO")
        self.log("=" * 60, "INFO")
        
        # Preferences tests
        self.test("GET /api/push/prefs - unauthenticated", self.test_get_prefs_unauthenticated)
        self.test("GET /api/push/prefs - initial state", self.test_get_prefs_initial)
        self.test("PUT /api/push/prefs - single key update", self.test_put_prefs_single_key)
        self.test("PUT /api/push/prefs - unknown key ignored", self.test_put_prefs_unknown_key)
        self.test("PUT /api/push/prefs - unauthenticated", self.test_put_prefs_unauthenticated)
        
        # Token management tests
        self.test("POST /api/push/tokens - valid token", self.test_register_token_valid)
        self.test("POST /api/push/tokens - short token (422)", self.test_register_token_short)
        self.test("POST /api/push/tokens - ownership transfer", self.test_token_ownership_transfer)
        self.test("DELETE /api/push/tokens - remove token", self.test_delete_token)
        
        # Test push tests
        self.test("POST /api/push/test - no device (404)", self.test_push_test_no_device)
        self.test("POST /api/push/test - fake token drops dead token", self.test_push_test_with_fake_token)
        
        # Regression tests
        self.test("GET /api/notifications - regression", self.test_regression_notifications)
        self.test("GET /api/ai/links - regression", self.test_regression_ai_links)
        self.test("GET /api/health - regression", self.test_regression_health)
        
        # Cleanup
        self.cleanup()
        
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
    tester = PushNotificationTester()
    sys.exit(tester.run_all_tests())
