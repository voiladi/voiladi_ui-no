"""Test notifications feature with Neo and Hana accounts."""
import requests
import sys
import time

BASE_URL = "https://match-fresh.preview.emergentagent.com/api"

class NotificationsTester:
    def __init__(self):
        self.tests_run = 0
        self.tests_passed = 0
        self.tests_failed = 0
        self.failures = []
        self.neo_token = None
        self.hana_token = None

    def test(self, name, fn):
        """Run a single test"""
        self.tests_run += 1
        print(f"\n{'='*60}")
        print(f"🔍 Test {self.tests_run}: {name}")
        print(f"{'='*60}")
        try:
            fn()
            self.tests_passed += 1
            print(f"✅ PASSED: {name}")
            return True
        except AssertionError as e:
            self.tests_failed += 1
            self.failures.append(f"{name}: {str(e)}")
            print(f"❌ FAILED: {name}")
            print(f"   Error: {str(e)}")
            return False
        except Exception as e:
            self.tests_failed += 1
            self.failures.append(f"{name}: {str(e)}")
            print(f"❌ ERROR: {name}")
            print(f"   Exception: {str(e)}")
            return False

    def req(self, method, endpoint, token=None, expected_status=None, **kwargs):
        """Make HTTP request"""
        url = f"{BASE_URL}{endpoint}"
        headers = kwargs.pop('headers', {})
        if token:
            headers['Authorization'] = f'Bearer {token}'
        
        print(f"  → {method} {endpoint}")
        
        if method == 'GET':
            r = requests.get(url, headers=headers, **kwargs)
        elif method == 'POST':
            r = requests.post(url, headers=headers, **kwargs)
        elif method == 'PUT':
            r = requests.put(url, headers=headers, **kwargs)
        elif method == 'DELETE':
            r = requests.delete(url, headers=headers, **kwargs)
        
        print(f"  ← Status: {r.status_code}")
        
        if expected_status is not None:
            assert r.status_code == expected_status, f"Expected {expected_status}, got {r.status_code}. Response: {r.text[:500]}"
        
        try:
            return r.status_code, r.json() if r.text else {}
        except ValueError:
            return r.status_code, {}

    def test_neo_login(self):
        """Login as Neo (neo1788974536@example.com)"""
        status, data = self.req('POST', '/auth/login', expected_status=200, json={
            'email': 'neo1788974536@example.com',
            'password': 'secret123'
        })
        assert 'token' in data, "token not in response"
        self.neo_token = data['token']
        self.neo_user = data['user']
        print(f"  ✓ Logged in as Neo: {self.neo_user['id']}")

    def test_hana_login(self):
        """Login as Hana (+19990000011) via OTP"""
        # Request OTP
        status, data = self.req('POST', '/auth/request-otp', expected_status=None, json={
            'phone': '+19990000011'
        })
        
        # Handle rate limit
        if status == 429:
            print(f"  ⚠ Rate limited, waiting 30s...")
            time.sleep(30)
            status, data = self.req('POST', '/auth/request-otp', expected_status=200, json={
                'phone': '+19990000011'
            })
        
        assert status == 200, f"Expected 200, got {status}"
        assert 'dev_code' in data, "dev_code not in response"
        dev_code = data['dev_code']
        print(f"  ✓ Got dev_code: {dev_code}")
        
        # Verify OTP
        status, data = self.req('POST', '/auth/verify-otp', expected_status=200, json={
            'phone': '+19990000011',
            'code': dev_code
        })
        assert 'token' in data, "token not in response"
        self.hana_token = data['token']
        self.hana_user = data['user']
        print(f"  ✓ Logged in as Hana: {self.hana_user['id']}")

    def test_neo_notifications_initial(self):
        """Get Neo's initial notifications"""
        status, data = self.req('GET', '/notifications', token=self.neo_token, expected_status=200)
        assert 'items' in data, "items not in response"
        assert 'seen_at' in data, "seen_at not in response"
        assert 'unseen_count' in data, "unseen_count not in response"
        
        self.neo_initial_items = data['items']
        self.neo_initial_unseen = data['unseen_count']
        self.neo_seen_at = data['seen_at']
        
        print(f"  ✓ Neo has {len(data['items'])} notifications, {data['unseen_count']} unseen")
        
        # Check item types
        types = [item['type'] for item in data['items']]
        print(f"  ✓ Notification types: {set(types)}")
        
        # Verify items are sorted newest first
        if len(data['items']) > 1:
            for i in range(len(data['items']) - 1):
                assert data['items'][i]['created_at'] >= data['items'][i+1]['created_at'], \
                    f"Items not sorted: {data['items'][i]['created_at']} < {data['items'][i+1]['created_at']}"
        print(f"  ✓ Items sorted newest first")

    def test_notification_structure(self):
        """Verify notification item structure"""
        if not self.neo_initial_items:
            print(f"  ⚠ No notifications to check structure")
            return
        
        item = self.neo_initial_items[0]
        assert 'id' in item, "item missing id"
        assert 'type' in item, "item missing type"
        assert item['type'] in ['like', 'superlike', 'match', 'message', 'system'], f"Invalid type: {item['type']}"
        assert 'title' in item, "item missing title"
        assert 'sub' in item, "item missing sub"
        assert 'created_at' in item, "item missing created_at"
        assert 'href' in item, "item missing href"
        
        # Check type-specific fields
        if item['type'] in ['like', 'superlike', 'match', 'message']:
            assert 'user' in item, "user notification missing user field"
            assert 'id' in item['user'], "user missing id"
            assert 'name' in item['user'], "user missing name"
            assert 'photos' in item['user'], "user missing photos"
        elif item['type'] == 'system':
            assert 'icon' in item, "system notification missing icon"
        
        print(f"  ✓ Notification structure valid")

    def test_hana_send_message_to_neo(self):
        """Hana sends a message to Neo (if matched)"""
        # Get Hana's matches
        status, data = self.req('GET', '/matches', token=self.hana_token, expected_status=200)
        
        # Find match with Neo
        neo_match = None
        for match in data['matches']:
            if self.neo_user['id'] in match['users']:
                neo_match = match
                break
        
        if not neo_match:
            print(f"  ⚠ Hana and Neo are not matched, skipping message test")
            return
        
        # Send message
        status, msg_data = self.req('POST', f'/matches/{neo_match["id"]}/messages', 
                                     token=self.hana_token, expected_status=200, 
                                     json={'text': f'Test notification message at {int(time.time())}'})
        assert 'id' in msg_data, "message id not in response"
        self.test_message_id = msg_data['id']
        print(f"  ✓ Hana sent message to Neo: {msg_data['text']}")

    def test_neo_notifications_after_message(self):
        """Check Neo's notifications after Hana's message"""
        if not hasattr(self, 'test_message_id'):
            print(f"  ⚠ No message sent, skipping")
            return
        
        # Wait a bit for the notification to be generated
        time.sleep(1)
        
        status, data = self.req('GET', '/notifications', token=self.neo_token, expected_status=200)
        
        # Check unseen_count increased
        assert data['unseen_count'] > self.neo_initial_unseen, \
            f"unseen_count should increase from {self.neo_initial_unseen}, got {data['unseen_count']}"
        
        # Check new message notification exists
        message_notifs = [item for item in data['items'] if item['type'] == 'message']
        assert len(message_notifs) > 0, "No message notifications found"
        
        # Check the new notification is newer than seen_at
        newest_msg = message_notifs[0]
        assert newest_msg['created_at'] > self.neo_seen_at, \
            f"New message notification should be newer than seen_at"
        
        print(f"  ✓ Neo's unseen_count increased to {data['unseen_count']}")
        print(f"  ✓ New message notification found")

    def test_neo_mark_seen(self):
        """Mark Neo's notifications as seen"""
        status, data = self.req('POST', '/notifications/seen', token=self.neo_token, expected_status=200)
        assert data.get('ok') == True, "ok should be True"
        assert 'seen_at' in data, "seen_at not in response"
        self.neo_new_seen_at = data['seen_at']
        print(f"  ✓ Notifications marked as seen: {data['seen_at']}")

    def test_neo_notifications_after_seen(self):
        """Check Neo's notifications after marking seen"""
        status, data = self.req('GET', '/notifications', token=self.neo_token, expected_status=200)
        assert data['unseen_count'] == 0, f"unseen_count should be 0, got {data['unseen_count']}"
        print(f"  ✓ unseen_count is now 0")

    def summary(self):
        """Print test summary"""
        print(f"\n{'='*60}")
        print(f"📊 TEST SUMMARY")
        print(f"{'='*60}")
        print(f"Total tests: {self.tests_run}")
        print(f"✅ Passed: {self.tests_passed}")
        print(f"❌ Failed: {self.tests_failed}")
        print(f"Success rate: {self.tests_passed/self.tests_run*100:.1f}%")
        
        if self.failures:
            print(f"\n{'='*60}")
            print(f"❌ FAILURES:")
            print(f"{'='*60}")
            for f in self.failures:
                print(f"  • {f}")
        
        return 0 if self.tests_failed == 0 else 1

def main():
    tester = NotificationsTester()
    
    # Login tests
    tester.test("Login as Neo", tester.test_neo_login)
    tester.test("Login as Hana", tester.test_hana_login)
    
    # Notifications tests
    tester.test("Get Neo's initial notifications", tester.test_neo_notifications_initial)
    tester.test("Verify notification structure", tester.test_notification_structure)
    tester.test("Hana sends message to Neo", tester.test_hana_send_message_to_neo)
    tester.test("Neo's notifications after message", tester.test_neo_notifications_after_message)
    tester.test("Mark Neo's notifications as seen", tester.test_neo_mark_seen)
    tester.test("Neo's notifications after seen", tester.test_neo_notifications_after_seen)
    
    return tester.summary()

if __name__ == "__main__":
    sys.exit(main())
