"""Test redesigned notifications feature (Instagram/Facebook style).

Tests:
1. GET /api/notifications structure (items, seen_at, unseen_count, unread_count, request_count)
2. Item types: like, superlike, request, message, verification (NO match or system)
3. POST /api/notifications/read with {ids:[...]} and {all:true}
4. POST /api/notifications/seen (doesn't change read flags)
5. Request flow: DM request creation and acceptance
"""
import requests
import sys
import time
import uuid

BASE_URL = "https://match-fresh.preview.emergentagent.com/api"

# Test tokens from /app/tests/dev_tokens.txt
KIARA_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIwNWFhMzRlYy1iMjE3LTQ1M2UtOTRkNi1jYjQzODQ2ZjZmODAiLCJleHAiOjE3OTE1MzUwMTAsImlhdCI6MTc4ODk0MzAxMH0.DVLvGrD5mYf214ED-cVHGh_YO_-8L0Vct-tiGiwCH0U"
RAHUL_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJlODk1YTEyYS1mNWQ3LTQyMmQtODA0ZC04MzQ0ZWNlMzQxZDAiLCJleHAiOjE3OTE1MzUwMTEsImlhdCI6MTc4ODk0MzAxMX0.2Le7KhNp2qe3DdF1f7b6ylTCz6pGOdAvAvXM3wW1c_k"

class NotificationsRedesignTester:
    def __init__(self):
        self.tests_run = 0
        self.tests_passed = 0
        self.tests_failed = 0
        self.failures = []

    def test(self, name, fn):
        """Run a single test"""
        self.tests_run += 1
        print(f"\n{'='*70}")
        print(f"🔍 Test {self.tests_run}: {name}")
        print(f"{'='*70}")
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
        if 'json' in kwargs:
            print(f"     Body: {kwargs['json']}")
        
        if method == 'GET':
            r = requests.get(url, headers=headers, **kwargs)
        elif method == 'POST':
            r = requests.post(url, headers=headers, **kwargs)
        elif method == 'DELETE':
            r = requests.delete(url, headers=headers, **kwargs)
        
        print(f"  ← Status: {r.status_code}")
        
        if expected_status is not None:
            assert r.status_code == expected_status, f"Expected {expected_status}, got {r.status_code}. Response: {r.text[:500]}"
        
        try:
            data = r.json() if r.text else {}
            if data and len(str(data)) < 500:
                print(f"     Response: {data}")
            return r.status_code, data
        except ValueError:
            return r.status_code, {}

    def test_get_notifications_structure(self):
        """Test GET /api/notifications returns correct structure"""
        status, data = self.req('GET', '/notifications', token=KIARA_TOKEN, expected_status=200)
        
        # Check top-level fields
        assert 'items' in data, "Missing 'items' field"
        assert 'seen_at' in data, "Missing 'seen_at' field"
        assert 'unseen_count' in data, "Missing 'unseen_count' field"
        assert 'unread_count' in data, "Missing 'unread_count' field"
        assert 'request_count' in data, "Missing 'request_count' field"
        
        print(f"  ✓ Response has all required fields")
        print(f"  ✓ Items: {len(data['items'])}, Unseen: {data['unseen_count']}, Unread: {data['unread_count']}, Requests: {data['request_count']}")
        
        # Store for later tests
        self.kiara_initial_data = data
        
    def test_notification_item_structure(self):
        """Test notification item has correct fields"""
        items = self.kiara_initial_data.get('items', [])
        if not items:
            print(f"  ⚠ No notifications to check structure")
            return
        
        item = items[0]
        
        # Required fields for all items
        assert 'id' in item, "Item missing 'id'"
        assert 'type' in item, "Item missing 'type'"
        assert 'actor' in item, "Item missing 'actor'"
        assert 'text' in item, "Item missing 'text'"
        assert 'created_at' in item, "Item missing 'created_at'"
        assert 'href' in item, "Item missing 'href'"
        assert 'read' in item, "Item missing 'read'"
        
        print(f"  ✓ Item has all required fields")
        print(f"  ✓ Sample item: type={item['type']}, actor={item['actor']}, read={item['read']}")
        
    def test_no_match_or_system_types(self):
        """Test that NO items have type 'match' or 'system'"""
        items = self.kiara_initial_data.get('items', [])
        
        types = [item['type'] for item in items]
        unique_types = set(types)
        
        assert 'match' not in unique_types, "Found forbidden 'match' type in notifications"
        assert 'system' not in unique_types, "Found forbidden 'system' type in notifications"
        
        # Valid types
        valid_types = {'like', 'superlike', 'request', 'message', 'verification'}
        invalid_types = unique_types - valid_types
        assert not invalid_types, f"Found invalid types: {invalid_types}"
        
        print(f"  ✓ No 'match' or 'system' types found")
        print(f"  ✓ All types are valid: {unique_types}")
        
    def test_request_item_structure(self):
        """Test request items have status and match_id"""
        items = self.kiara_initial_data.get('items', [])
        request_items = [item for item in items if item['type'] == 'request']
        
        if not request_items:
            print(f"  ⚠ No request items to check")
            return
        
        item = request_items[0]
        assert 'status' in item, "Request item missing 'status'"
        assert item['status'] in ['pending', 'accepted'], f"Invalid status: {item['status']}"
        assert 'match_id' in item, "Request item missing 'match_id'"
        
        print(f"  ✓ Request item has status and match_id")
        print(f"  ✓ Status: {item['status']}, Match ID: {item['match_id']}")
        
    def test_mark_single_notification_read(self):
        """Test POST /api/notifications/read with single ID"""
        items = self.kiara_initial_data.get('items', [])
        unread_items = [item for item in items if not item['read']]
        
        if not unread_items:
            print(f"  ⚠ No unread items to mark as read")
            return
        
        item_id = unread_items[0]['id']
        initial_unread_count = self.kiara_initial_data['unread_count']
        
        # Mark as read
        status, data = self.req('POST', '/notifications/read', token=KIARA_TOKEN, 
                               expected_status=200, json={'ids': [item_id]})
        
        assert data.get('ok') == True, "Response should have ok=true"
        assert data.get('count') == 1, f"Count should be 1, got {data.get('count')}"
        
        print(f"  ✓ Marked notification as read: {item_id}")
        
        # Verify it's marked as read
        status, new_data = self.req('GET', '/notifications', token=KIARA_TOKEN, expected_status=200)
        
        marked_item = next((item for item in new_data['items'] if item['id'] == item_id), None)
        assert marked_item is not None, f"Item {item_id} not found after marking read"
        assert marked_item['read'] == True, f"Item should be read=true, got {marked_item['read']}"
        
        # Check unread_count decreased
        assert new_data['unread_count'] == initial_unread_count - 1, \
            f"unread_count should decrease by 1: {initial_unread_count} -> {new_data['unread_count']}"
        
        print(f"  ✓ Item is now read=true")
        print(f"  ✓ unread_count decreased: {initial_unread_count} -> {new_data['unread_count']}")
        
    def test_mark_all_notifications_read(self):
        """Test POST /api/notifications/read with all=true"""
        # Mark all as read
        status, data = self.req('POST', '/notifications/read', token=KIARA_TOKEN, 
                               expected_status=200, json={'all': True})
        
        assert data.get('ok') == True, "Response should have ok=true"
        assert 'read_all_at' in data, "Response should have read_all_at"
        
        print(f"  ✓ Marked all notifications as read at: {data['read_all_at']}")
        
        # Verify all are read
        status, new_data = self.req('GET', '/notifications', token=KIARA_TOKEN, expected_status=200)
        
        assert new_data['unread_count'] == 0, f"unread_count should be 0, got {new_data['unread_count']}"
        
        all_read = all(item['read'] for item in new_data['items'])
        assert all_read, "All items should be read=true"
        
        print(f"  ✓ unread_count is now 0")
        print(f"  ✓ All items are read=true")
        
    def test_mark_read_empty_body(self):
        """Test POST /api/notifications/read with empty body returns 400"""
        status, data = self.req('POST', '/notifications/read', token=KIARA_TOKEN, 
                               expected_status=400, json={})
        
        print(f"  ✓ Empty body correctly returns 400")
        
    def test_mark_seen(self):
        """Test POST /api/notifications/seen doesn't change read flags"""
        # First, get current state
        status, before_data = self.req('GET', '/notifications', token=RAHUL_TOKEN, expected_status=200)
        
        initial_unseen = before_data['unseen_count']
        initial_unread = before_data['unread_count']
        
        # Mark as seen
        status, seen_data = self.req('POST', '/notifications/seen', token=RAHUL_TOKEN, expected_status=200)
        
        assert seen_data.get('ok') == True, "Response should have ok=true"
        assert 'seen_at' in seen_data, "Response should have seen_at"
        
        print(f"  ✓ Marked as seen at: {seen_data['seen_at']}")
        
        # Get new state
        status, after_data = self.req('GET', '/notifications', token=RAHUL_TOKEN, expected_status=200)
        
        # unseen_count should be 0
        assert after_data['unseen_count'] == 0, f"unseen_count should be 0, got {after_data['unseen_count']}"
        
        # unread_count should NOT change
        assert after_data['unread_count'] == initial_unread, \
            f"unread_count should not change: {initial_unread} -> {after_data['unread_count']}"
        
        # read flags should not change
        before_read_flags = {item['id']: item['read'] for item in before_data['items']}
        after_read_flags = {item['id']: item['read'] for item in after_data['items']}
        
        for item_id in before_read_flags:
            if item_id in after_read_flags:
                assert before_read_flags[item_id] == after_read_flags[item_id], \
                    f"read flag changed for {item_id}: {before_read_flags[item_id]} -> {after_read_flags[item_id]}"
        
        print(f"  ✓ unseen_count: {initial_unseen} -> 0")
        print(f"  ✓ unread_count unchanged: {initial_unread}")
        print(f"  ✓ read flags unchanged")

    def test_dm_request_flow(self):
        """Test DM request creation and acceptance flow"""
        # Check if Kiara and Rahul have an existing match
        status, matches_data = self.req('GET', '/matches', token=KIARA_TOKEN, expected_status=200)
        
        # Get Rahul's user ID from token (e895a12a-f5d7-422d-804d-8344ece341d0)
        rahul_id = "e895a12a-f5d7-422d-804d-8344ece341d0"
        
        # Check if they already have a match
        existing_match = None
        for match in matches_data.get('matches', []) + matches_data.get('requests', []):
            if rahul_id in match.get('users', []) or match.get('user', {}).get('id') == rahul_id:
                existing_match = match
                break
        
        if existing_match:
            print(f"  ⚠ Kiara and Rahul already have a match/request: {existing_match['id']}")
            print(f"  ⚠ Skipping DM request creation test")
            return
        
        # Create DM request from Kiara to Rahul
        status, dm_data = self.req('POST', f'/dm/{rahul_id}', token=KIARA_TOKEN, expected_status=200)
        
        assert 'id' in dm_data, "DM response missing 'id'"
        assert dm_data.get('kind') == 'dm', f"Expected kind='dm', got {dm_data.get('kind')}"
        assert dm_data.get('status') == 'request', f"Expected status='request', got {dm_data.get('status')}"
        
        match_id = dm_data['id']
        print(f"  ✓ Created DM request: {match_id}")
        
        # Check Rahul's notifications for the request
        time.sleep(1)  # Wait for notification to be generated
        status, rahul_notifs = self.req('GET', '/notifications', token=RAHUL_TOKEN, expected_status=200)
        
        request_items = [item for item in rahul_notifs['items'] 
                        if item['type'] == 'request' and item.get('match_id') == match_id]
        
        assert len(request_items) > 0, "Rahul should have a request notification"
        request_item = request_items[0]
        
        assert request_item['status'] == 'pending', f"Request status should be 'pending', got {request_item['status']}"
        assert rahul_notifs['request_count'] >= 1, f"request_count should be >= 1, got {rahul_notifs['request_count']}"
        
        print(f"  ✓ Rahul has request notification with status='pending'")
        print(f"  ✓ request_count: {rahul_notifs['request_count']}")
        
        # Rahul accepts the request
        status, accept_data = self.req('POST', f'/matches/{match_id}/accept', 
                                      token=RAHUL_TOKEN, expected_status=200)
        
        assert accept_data.get('status') == 'active', f"Expected status='active', got {accept_data.get('status')}"
        
        print(f"  ✓ Rahul accepted the request")
        
        # Check notification updated
        time.sleep(1)
        status, rahul_notifs_after = self.req('GET', '/notifications', token=RAHUL_TOKEN, expected_status=200)
        
        request_items_after = [item for item in rahul_notifs_after['items'] 
                              if item['type'] == 'request' and item.get('match_id') == match_id]
        
        if request_items_after:
            assert request_items_after[0]['status'] == 'accepted', \
                f"Request status should be 'accepted', got {request_items_after[0]['status']}"
            assert 'accepted their request' in request_items_after[0]['text'], \
                f"Text should mention acceptance: {request_items_after[0]['text']}"
            print(f"  ✓ Request notification updated to status='accepted'")
        
        # Clean up: delete the match
        status, delete_data = self.req('DELETE', f'/matches/{match_id}', 
                                      token=KIARA_TOKEN, expected_status=200)
        print(f"  ✓ Cleaned up test match")

    def summary(self):
        """Print test summary"""
        print(f"\n{'='*70}")
        print(f"📊 TEST SUMMARY - Notifications Redesign")
        print(f"{'='*70}")
        print(f"Total tests: {self.tests_run}")
        print(f"✅ Passed: {self.tests_passed}")
        print(f"❌ Failed: {self.tests_failed}")
        print(f"Success rate: {self.tests_passed/self.tests_run*100:.1f}%")
        
        if self.failures:
            print(f"\n{'='*70}")
            print(f"❌ FAILURES:")
            print(f"{'='*70}")
            for f in self.failures:
                print(f"  • {f}")
        
        return 0 if self.tests_failed == 0 else 1

def main():
    tester = NotificationsRedesignTester()
    
    print("="*70)
    print("🧪 Testing Redesigned Notifications (Instagram/Facebook style)")
    print("="*70)
    
    # Structure tests
    tester.test("GET /api/notifications structure", tester.test_get_notifications_structure)
    tester.test("Notification item structure", tester.test_notification_item_structure)
    tester.test("No 'match' or 'system' types", tester.test_no_match_or_system_types)
    tester.test("Request item structure", tester.test_request_item_structure)
    
    # Read functionality
    tester.test("Mark single notification read", tester.test_mark_single_notification_read)
    tester.test("Mark all notifications read", tester.test_mark_all_notifications_read)
    tester.test("Mark read with empty body (400)", tester.test_mark_read_empty_body)
    
    # Seen functionality
    tester.test("Mark seen (doesn't change read flags)", tester.test_mark_seen)
    
    # Request flow
    tester.test("DM request flow (create & accept)", tester.test_dm_request_flow)
    
    return tester.summary()

if __name__ == "__main__":
    sys.exit(main())
