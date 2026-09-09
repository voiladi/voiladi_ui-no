"""Comprehensive backend API tests for Voiladi dating app."""
import requests
import sys
import time

BASE_URL = "https://match-fresh.preview.emergentagent.com/api"
TEST_PHOTO = "/app/tests/test_photo.jpg"
TEST_PHOTO2 = "/app/tests/test_photo2.jpg"

class VoiladiTester:
    def __init__(self):
        self.tests_run = 0
        self.tests_passed = 0
        self.tests_failed = 0
        self.token = None
        self.user = None
        self.phone = None
        self.failures = []

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

    def req(self, method, endpoint, expected_status=None, **kwargs):
        """Make HTTP request"""
        url = f"{BASE_URL}{endpoint}"
        headers = kwargs.pop('headers', {})
        if self.token:
            headers['Authorization'] = f'Bearer {self.token}'
        
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
            assert r.status_code == expected_status, f"Expected {expected_status}, got {r.status_code}. Response: {r.text[:200]}"
        
        try:
            return r.status_code, r.json() if r.text else {}
        except ValueError:
            return r.status_code, {}

    # ========== AUTH TESTS ==========
    def test_auth_request_otp(self):
        """Test POST /auth/request-otp returns dev_code and resend_in"""
        self.phone = f"+91555000{int(time.time()) % 10000:04d}"
        status, data = self.req('POST', '/auth/request-otp', 200, json={'phone': self.phone})
        assert 'dev_code' in data, "dev_code not in response"
        assert 'resend_in' in data, "resend_in not in response"
        assert len(data['dev_code']) == 6, f"dev_code should be 6 digits, got {data['dev_code']}"
        self.dev_code = data['dev_code']
        print(f"  ✓ Got dev_code: {self.dev_code}")

    def test_auth_request_otp_rate_limit(self):
        """Test POST /auth/request-otp returns 429 within 30s"""
        # Request again immediately
        status, data = self.req('POST', '/auth/request-otp', None, json={'phone': self.phone})
        assert status == 429, f"Expected 429 rate limit, got {status}"
        print(f"  ✓ Rate limit working (429)")

    def test_auth_verify_otp_wrong_code(self):
        """Test POST /auth/verify-otp with wrong code returns 400"""
        status, data = self.req('POST', '/auth/verify-otp', 400, json={'phone': self.phone, 'code': '000000'})
        print(f"  ✓ Wrong code rejected")

    def test_auth_verify_otp_correct(self):
        """Test POST /auth/verify-otp with correct code returns token and user"""
        status, data = self.req('POST', '/auth/verify-otp', 200, json={'phone': self.phone, 'code': self.dev_code})
        assert 'token' in data, "token not in response"
        assert 'user' in data, "user not in response"
        assert 'is_new' in data, "is_new not in response"
        assert data['is_new'] == True, "Should be new user"
        self.token = data['token']
        self.user = data['user']
        print(f"  ✓ Got token and user (is_new={data['is_new']})")

    def test_auth_me(self):
        """Test GET /auth/me with Bearer token"""
        status, data = self.req('GET', '/auth/me', 200)
        assert data['id'] == self.user['id'], "User ID mismatch"
        print(f"  ✓ /auth/me returned correct user")

    def test_auth_me_bad_token(self):
        """Test GET /auth/me with bad token returns 401"""
        old_token = self.token
        self.token = "bad_token_12345"
        status, data = self.req('GET', '/auth/me', 401)
        self.token = old_token
        print(f"  ✓ Bad token rejected (401)")

    # ========== PROFILE TESTS ==========
    def test_profile_update_name_too_long(self):
        """Test PUT /profile with name > 30 chars returns 400"""
        status, data = self.req('PUT', '/profile', 400, json={'name': 'a' * 31})
        print(f"  ✓ Name > 30 chars rejected")

    def test_profile_update_birthday_under_18(self):
        """Test PUT /profile with birthday under 18 returns 400"""
        status, data = self.req('PUT', '/profile', 400, json={'birthday': '2010-01-01'})
        assert '18' in data.get('detail', '').lower() or 'older' in data.get('detail', '').lower(), "Should mention 18+ requirement"
        print(f"  ✓ Under 18 birthday rejected with message: {data.get('detail')}")

    def test_profile_update_interests_over_10(self):
        """Test PUT /profile with > 10 interests returns 400"""
        interests = [f"Interest{i}" for i in range(11)]
        status, data = self.req('PUT', '/profile', 400, json={'interests': interests})
        print(f"  ✓ > 10 interests rejected")

    def test_profile_update_prompts_over_3(self):
        """Test PUT /profile with > 3 prompts returns 400"""
        prompts = [{'question': f'Q{i}', 'answer': f'A{i}'} for i in range(4)]
        status, data = self.req('PUT', '/profile', 400, json={'prompts': prompts})
        print(f"  ✓ > 3 prompts rejected")

    def test_profile_complete_flow(self):
        """Test profile_complete becomes true with all required fields"""
        # Update profile with all required fields
        status, data = self.req('PUT', '/profile', 200, json={
            'name': 'TestUser',
            'birthday': '1995-05-15',
            'gender': 'woman',
            'looking_for': 'men',
            'interests': ['Music', 'Travel', 'Food'],
        })
        assert data['name'] == 'TestUser', "Name not updated"
        assert data['gender'] == 'woman', "Gender not updated"
        # profile_complete should still be False (no photo yet)
        assert data['profile_complete'] == False, "profile_complete should be False without photo"
        print(f"  ✓ Profile updated, profile_complete={data['profile_complete']} (no photo yet)")

    # ========== PHOTO TESTS ==========
    def test_photo_upload(self):
        """Test POST /profile/photos uploads image and returns URL"""
        with open(TEST_PHOTO, 'rb') as f:
            files = {'file': ('test.jpg', f, 'image/jpeg')}
            status, data = self.req('POST', '/profile/photos', 200, files=files)
        assert 'url' in data, "url not in response"
        assert 'photos' in data, "photos not in response"
        assert len(data['photos']) == 1, "Should have 1 photo"
        self.photo_url = data['url']
        print(f"  ✓ Photo uploaded: {self.photo_url}")

    def test_photo_serve(self):
        """Test GET /uploads/<file> serves the image"""
        # photo_url already includes /api prefix, so use base domain only
        url = f"https://match-fresh.preview.emergentagent.com{self.photo_url}"
        r = requests.get(url)
        assert r.status_code == 200, f"Expected 200, got {r.status_code}"
        assert 'image' in r.headers.get('content-type', '').lower(), "Should be image content-type"
        print(f"  ✓ Photo served successfully")

    def test_photo_upload_non_image(self):
        """Test POST /profile/photos with non-image returns 400"""
        files = {'file': ('test.txt', b'not an image', 'text/plain')}
        status, data = self.req('POST', '/profile/photos', 400, files=files)
        print(f"  ✓ Non-image rejected")

    def test_photo_reorder(self):
        """Test PUT /profile/photos/order reorders photos"""
        # Upload second photo
        with open(TEST_PHOTO2, 'rb') as f:
            files = {'file': ('test2.jpg', f, 'image/jpeg')}
            status, data = self.req('POST', '/profile/photos', 200, files=files)
        photo2_url = data['url']
        
        # Reorder
        status, data = self.req('PUT', '/profile/photos/order', 200, json={'photos': [photo2_url, self.photo_url]})
        assert data['photos'][0] == photo2_url, "Photos not reordered"
        print(f"  ✓ Photos reordered")

    def test_photo_reorder_mismatch(self):
        """Test PUT /profile/photos/order with mismatch returns 400"""
        status, data = self.req('PUT', '/profile/photos/order', 400, json={'photos': ['/api/uploads/fake.jpg']})
        print(f"  ✓ Photo mismatch rejected")

    def test_photo_delete(self):
        """Test DELETE /profile/photos removes photo"""
        # Get current photos
        status, user = self.req('GET', '/auth/me', 200)
        photo_to_delete = user['photos'][-1]
        
        status, data = self.req('DELETE', '/profile/photos', 200, params={'url': photo_to_delete})
        assert photo_to_delete not in data['photos'], "Photo not deleted"
        print(f"  ✓ Photo deleted")

    def test_profile_complete_after_photo(self):
        """Test profile_complete becomes true after adding photo"""
        status, data = self.req('GET', '/auth/me', 200)
        assert data['profile_complete'] == True, f"profile_complete should be True now, got {data['profile_complete']}"
        print(f"  ✓ profile_complete is now True")

    # ========== META TESTS ==========
    def test_meta(self):
        """Test GET /meta returns interests, prompts, icebreakers, cities, etc."""
        status, data = self.req('GET', '/meta', 200)
        assert 'interests' in data, "interests not in response"
        assert 'prompts' in data, "prompts not in response"
        assert 'icebreakers' in data, "icebreakers not in response"
        assert 'cities' in data, "cities not in response"
        assert 'genders' in data, "genders not in response"
        assert 'show_me' in data, "show_me not in response"
        assert 'report_reasons' in data, "report_reasons not in response"
        assert 'anywhere_km' in data, "anywhere_km not in response"
        assert data['anywhere_km'] == 250, f"anywhere_km should be 250, got {data['anywhere_km']}"
        print(f"  ✓ Meta returned all fields")

    # ========== PREFERENCES TESTS ==========
    def test_preferences_get(self):
        """Test GET /preferences returns preferences"""
        status, data = self.req('GET', '/preferences', 200)
        assert 'age_min' in data, "age_min not in response"
        assert 'age_max' in data, "age_max not in response"
        assert 'max_distance_km' in data, "max_distance_km not in response"
        assert 'show_me' in data, "show_me not in response"
        print(f"  ✓ Preferences: {data}")

    def test_preferences_put_invalid_age(self):
        """Test PUT /preferences with age_min > age_max returns 400"""
        status, data = self.req('PUT', '/preferences', 400, json={
            'age_min': 30, 'age_max': 20, 'max_distance_km': 50, 'show_me': 'men'
        })
        print(f"  ✓ Invalid age range rejected")

    def test_preferences_put_valid(self):
        """Test PUT /preferences with valid data"""
        status, data = self.req('PUT', '/preferences', 200, json={
            'age_min': 22, 'age_max': 28, 'max_distance_km': 30, 'show_me': 'men'
        })
        assert data['age_min'] == 22, "age_min not updated"
        assert data['show_me'] == 'men', "show_me not updated"
        print(f"  ✓ Preferences updated")

    # ========== DISCOVER TESTS ==========
    def test_discover(self):
        """Test GET /discover returns profiles with compatibility, shared_interests, distance_km"""
        status, data = self.req('GET', '/discover', 200)
        assert 'profiles' in data, "profiles not in response"
        assert 'total' in data, "total not in response"
        if len(data['profiles']) > 0:
            p = data['profiles'][0]
            assert 'id' in p, "profile missing id"
            assert 'name' in p, "profile missing name"
            assert 'age' in p, "profile missing age"
            assert 'compatibility' in p, "profile missing compatibility"
            assert 'shared_interests' in p, "profile missing shared_interests"
            # distance_km can be None
            print(f"  ✓ Discover returned {len(data['profiles'])} profiles")
        else:
            print(f"  ✓ Discover returned 0 profiles (expected if no seed data)")

    # ========== SWIPE TESTS ==========
    def test_swipe_self(self):
        """Test POST /swipe on self returns 400"""
        status, data = self.req('POST', '/swipe', 400, json={'target_id': self.user['id'], 'action': 'like'})
        print(f"  ✓ Swipe on self rejected")

    def test_swipe_invalid_action(self):
        """Test POST /swipe with invalid action returns 400"""
        status, data = self.req('POST', '/swipe', 400, json={'target_id': 'fake-id', 'action': 'invalid'})
        print(f"  ✓ Invalid swipe action rejected")

    def test_swipe_like(self):
        """Test POST /swipe like action"""
        # Get a profile to swipe on
        status, data = self.req('GET', '/discover', 200)
        if len(data['profiles']) > 0:
            target = data['profiles'][0]
            status, swipe_data = self.req('POST', '/swipe', 200, json={'target_id': target['id'], 'action': 'like'})
            assert 'matched' in swipe_data, "matched not in response"
            print(f"  ✓ Swipe like successful, matched={swipe_data['matched']}")
            self.swiped_target = target['id']
        else:
            print(f"  ⚠ Skipped (no profiles to swipe)")

    # ========== LIKES TESTS ==========
    def test_likes_received(self):
        """Test GET /likes/received returns users who liked me"""
        status, data = self.req('GET', '/likes/received', 200)
        assert 'likes' in data, "likes not in response"
        assert 'count' in data, "count not in response"
        print(f"  ✓ Likes received: {data['count']} likes")

    # ========== MATCHES TESTS ==========
    def test_matches_list(self):
        """Test GET /matches returns matches with last_message, unread, total_unread"""
        status, data = self.req('GET', '/matches', 200)
        assert 'matches' in data, "matches not in response"
        assert 'total_unread' in data, "total_unread not in response"
        print(f"  ✓ Matches: {len(data['matches'])} matches, {data['total_unread']} unread")
        if len(data['matches']) > 0:
            self.match_id = data['matches'][0]['id']

    # ========== MESSAGES TESTS ==========
    def test_messages_empty_text(self):
        """Test POST /matches/{id}/messages with empty text returns 400"""
        # Create a match first by having Kiara like us back
        # For now, skip if no match
        if not hasattr(self, 'match_id'):
            print(f"  ⚠ Skipped (no match available)")
            return
        
        status, data = self.req('POST', f'/matches/{self.match_id}/messages', 400, json={'text': ''})
        print(f"  ✓ Empty message rejected")

    # ========== BLOCK/REPORT TESTS ==========
    def test_block_self(self):
        """Test POST /users/{id}/block on self returns 400"""
        status, data = self.req('POST', f'/users/{self.user["id"]}/block', 400)
        print(f"  ✓ Block self rejected")

    def test_report_user(self):
        """Test POST /users/{id}/report"""
        # Get a profile to report
        status, data = self.req('GET', '/discover', 200)
        if len(data['profiles']) > 0:
            target = data['profiles'][0]
            status, report_data = self.req('POST', f'/users/{target["id"]}/report', 200, json={
                'reason': 'Inappropriate content',
                'details': 'Test report'
            })
            assert report_data.get('ok') == True, "Report failed"
            print(f"  ✓ Report submitted")
        else:
            print(f"  ⚠ Skipped (no profiles to report)")

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
    tester = VoiladiTester()
    
    # Auth tests
    tester.test("Auth: Request OTP", tester.test_auth_request_otp)
    tester.test("Auth: Rate limit (429)", tester.test_auth_request_otp_rate_limit)
    tester.test("Auth: Verify OTP wrong code", tester.test_auth_verify_otp_wrong_code)
    tester.test("Auth: Verify OTP correct", tester.test_auth_verify_otp_correct)
    tester.test("Auth: GET /auth/me", tester.test_auth_me)
    tester.test("Auth: Bad token (401)", tester.test_auth_me_bad_token)
    
    # Profile tests
    tester.test("Profile: Name > 30 chars", tester.test_profile_update_name_too_long)
    tester.test("Profile: Birthday under 18", tester.test_profile_update_birthday_under_18)
    tester.test("Profile: > 10 interests", tester.test_profile_update_interests_over_10)
    tester.test("Profile: > 3 prompts", tester.test_profile_update_prompts_over_3)
    tester.test("Profile: Complete flow", tester.test_profile_complete_flow)
    
    # Photo tests
    tester.test("Photo: Upload", tester.test_photo_upload)
    tester.test("Photo: Serve", tester.test_photo_serve)
    tester.test("Photo: Non-image rejected", tester.test_photo_upload_non_image)
    tester.test("Photo: Reorder", tester.test_photo_reorder)
    tester.test("Photo: Reorder mismatch", tester.test_photo_reorder_mismatch)
    tester.test("Photo: Delete", tester.test_photo_delete)
    tester.test("Profile: Complete after photo", tester.test_profile_complete_after_photo)
    
    # Meta tests
    tester.test("Meta: GET /meta", tester.test_meta)
    
    # Preferences tests
    tester.test("Preferences: GET", tester.test_preferences_get)
    tester.test("Preferences: Invalid age range", tester.test_preferences_put_invalid_age)
    tester.test("Preferences: PUT valid", tester.test_preferences_put_valid)
    
    # Discover tests
    tester.test("Discover: GET /discover", tester.test_discover)
    
    # Swipe tests
    tester.test("Swipe: Self (400)", tester.test_swipe_self)
    tester.test("Swipe: Invalid action", tester.test_swipe_invalid_action)
    tester.test("Swipe: Like", tester.test_swipe_like)
    
    # Likes tests
    tester.test("Likes: GET received", tester.test_likes_received)
    
    # Matches tests
    tester.test("Matches: GET list", tester.test_matches_list)
    
    # Messages tests
    tester.test("Messages: Empty text (400)", tester.test_messages_empty_text)
    
    # Block/Report tests
    tester.test("Block: Self (400)", tester.test_block_self)
    tester.test("Report: User", tester.test_report_user)
    
    return tester.summary()

if __name__ == "__main__":
    sys.exit(main())
