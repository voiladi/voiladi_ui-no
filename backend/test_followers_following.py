"""Test followers/following feature (new endpoints for Instagram-style follow lists)."""
import requests
import sys

BASE_URL = "https://match-fresh.preview.emergentagent.com/api"

# Load tokens from dev_tokens.txt
with open('/app/tests/dev_tokens.txt', 'r') as f:
    lines = f.readlines()
    KIARA_TOKEN = lines[0].split('=')[1].strip()
    RAHUL_TOKEN = lines[1].split('=')[1].strip()

class FollowersFollowingTester:
    def __init__(self):
        self.tests_run = 0
        self.tests_passed = 0
        self.tests_failed = 0
        self.failures = []
        self.token = None
        self.initial_followers = None
        self.initial_following = None

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
        elif method == 'DELETE':
            r = requests.delete(url, headers=headers, **kwargs)
        
        print(f"  ← Status: {r.status_code}")
        
        if expected_status is not None:
            assert r.status_code == expected_status, f"Expected {expected_status}, got {r.status_code}. Response: {r.text[:500]}"
        
        try:
            return r.status_code, r.json() if r.text else {}
        except ValueError:
            return r.status_code, {}

    # ========== FOLLOWERS/FOLLOWING TESTS ==========
    
    def test_followers_unauthenticated(self):
        """Test GET /me/followers without auth returns 401"""
        old_token = self.token
        self.token = None
        status, data = self.req('GET', '/me/followers', 401)
        self.token = old_token
        print(f"  ✓ Unauthenticated request rejected (401)")

    def test_following_unauthenticated(self):
        """Test GET /me/following without auth returns 401"""
        old_token = self.token
        self.token = None
        status, data = self.req('GET', '/me/following', 401)
        self.token = old_token
        print(f"  ✓ Unauthenticated request rejected (401)")

    def test_get_initial_stats(self):
        """Test GET /me/stats to get initial followers/following counts"""
        status, data = self.req('GET', '/me/stats', 200)
        assert 'followers' in data, "followers not in response"
        assert 'following' in data, "following not in response"
        self.initial_followers = data['followers']
        self.initial_following = data['following']
        print(f"  ✓ Initial stats: {self.initial_followers} followers, {self.initial_following} following")

    def test_get_followers(self):
        """Test GET /me/followers returns people array with correct structure"""
        status, data = self.req('GET', '/me/followers', 200)
        assert 'people' in data, "people not in response"
        assert 'count' in data, "count not in response"
        assert isinstance(data['people'], list), "people should be a list"
        assert isinstance(data['count'], int), "count should be an int"
        
        # Count should match stats.followers
        assert data['count'] == self.initial_followers, f"Count {data['count']} doesn't match stats.followers {self.initial_followers}"
        
        # Check structure of each person
        if len(data['people']) > 0:
            p = data['people'][0]
            assert 'id' in p, "person missing id"
            assert 'name' in p, "person missing name"
            assert 'username' in p, "person missing username"
            assert 'photos' in p, "person missing photos"
            assert 'verified' in p, "person missing verified"
            assert 'job' in p, "person missing job"
            assert 'city' in p, "person missing city"
            assert 'followed_by_me' in p, "person missing followed_by_me"
            assert 'follows_me' in p, "person missing follows_me"
            assert 'match_id' in p, "person missing match_id"
            
            # All followers should have follows_me = true
            assert p['follows_me'] == True, f"Follower {p['name']} should have follows_me=true"
            
            print(f"  ✓ Followers list: {data['count']} people, structure validated")
            print(f"  ✓ Sample follower: {p['name']} (@{p['username']}), follows_me={p['follows_me']}, followed_by_me={p['followed_by_me']}")
        else:
            print(f"  ✓ Followers list: {data['count']} people (empty)")
        
        # Store for later tests
        self.followers_data = data

    def test_get_following(self):
        """Test GET /me/following returns people array with correct structure"""
        status, data = self.req('GET', '/me/following', 200)
        assert 'people' in data, "people not in response"
        assert 'count' in data, "count not in response"
        assert isinstance(data['people'], list), "people should be a list"
        assert isinstance(data['count'], int), "count should be an int"
        
        # Count should match stats.following
        assert data['count'] == self.initial_following, f"Count {data['count']} doesn't match stats.following {self.initial_following}"
        
        # Check structure of each person
        if len(data['people']) > 0:
            p = data['people'][0]
            assert 'id' in p, "person missing id"
            assert 'name' in p, "person missing name"
            assert 'username' in p, "person missing username"
            assert 'photos' in p, "person missing photos"
            assert 'verified' in p, "person missing verified"
            assert 'job' in p, "person missing job"
            assert 'city' in p, "person missing city"
            assert 'followed_by_me' in p, "person missing followed_by_me"
            assert 'follows_me' in p, "person missing follows_me"
            assert 'match_id' in p, "person missing match_id"
            
            # All following should have followed_by_me = true
            assert p['followed_by_me'] == True, f"Following {p['name']} should have followed_by_me=true"
            
            print(f"  ✓ Following list: {data['count']} people, structure validated")
            print(f"  ✓ Sample following: {p['name']} (@{p['username']}), follows_me={p['follows_me']}, followed_by_me={p['followed_by_me']}")
            
            # Store one person to unfollow
            self.unfollow_target_id = p['id']
            self.unfollow_target_name = p['name']
        else:
            print(f"  ✓ Following list: {data['count']} people (empty)")
            self.unfollow_target_id = None
        
        # Store for later tests
        self.following_data = data

    def test_unfollow_round_trip(self):
        """Test DELETE /follow/{id} -> count decreases, DELETE again -> 404, restore with POST /swipe"""
        if not self.unfollow_target_id:
            print(f"  ⚠ Skipped (no one to unfollow)")
            return
        
        print(f"  → Unfollowing {self.unfollow_target_name} (id: {self.unfollow_target_id})")
        
        # 1. DELETE /follow/{id} should succeed
        status, data = self.req('DELETE', f'/follow/{self.unfollow_target_id}', 200)
        assert data.get('ok') == True, "ok should be True"
        print(f"  ✓ Unfollowed successfully")
        
        # 2. Check that following count decreased by 1
        status, following_data = self.req('GET', '/me/following', 200)
        new_following_count = following_data['count']
        assert new_following_count == self.initial_following - 1, f"Following count should be {self.initial_following - 1}, got {new_following_count}"
        print(f"  ✓ Following count decreased: {self.initial_following} -> {new_following_count}")
        
        # 3. Check that stats.following matches
        status, stats_data = self.req('GET', '/me/stats', 200)
        assert stats_data['following'] == new_following_count, f"stats.following {stats_data['following']} doesn't match /me/following count {new_following_count}"
        print(f"  ✓ stats.following matches: {stats_data['following']}")
        
        # 4. DELETE again should return 404
        status, data = self.req('DELETE', f'/follow/{self.unfollow_target_id}', 404)
        assert "don't follow" in data.get('detail', '').lower(), "Should mention you don't follow them"
        print(f"  ✓ Second unfollow rejected (404): {data.get('detail')}")
        
        # 5. Restore with POST /swipe like
        print(f"  → Restoring follow with POST /swipe like")
        status, swipe_data = self.req('POST', '/swipe', 200, json={'target_id': self.unfollow_target_id, 'action': 'like'})
        assert 'matched' in swipe_data, "matched not in response"
        print(f"  ✓ Re-followed successfully, matched={swipe_data['matched']}")
        
        # 6. Check that following count is restored
        status, following_data = self.req('GET', '/me/following', 200)
        restored_count = following_data['count']
        assert restored_count == self.initial_following, f"Following count should be restored to {self.initial_following}, got {restored_count}"
        print(f"  ✓ Following count restored: {new_following_count} -> {restored_count}")
        
        # 7. Check that stats.following matches
        status, stats_data = self.req('GET', '/me/stats', 200)
        assert stats_data['following'] == restored_count, f"stats.following {stats_data['following']} doesn't match restored count {restored_count}"
        print(f"  ✓ stats.following restored: {stats_data['following']}")

    def test_regression_likes_received(self):
        """Test GET /likes/received still works (regression)"""
        status, data = self.req('GET', '/likes/received', 200)
        assert 'likes' in data, "likes not in response"
        assert 'count' in data, "count not in response"
        print(f"  ✓ /likes/received still works: {data['count']} likes")

    def test_regression_likes_sent(self):
        """Test GET /likes/sent still works (regression)"""
        status, data = self.req('GET', '/likes/sent', 200)
        assert 'likes' in data, "likes not in response"
        assert 'count' in data, "count not in response"
        print(f"  ✓ /likes/sent still works: {data['count']} likes")

    def test_regression_stats(self):
        """Test GET /me/stats still works (regression)"""
        status, data = self.req('GET', '/me/stats', 200)
        assert 'matches' in data, "matches not in response"
        assert 'likes_received' in data, "likes_received not in response"
        assert 'likes_sent' in data, "likes_sent not in response"
        assert 'followers' in data, "followers not in response"
        assert 'following' in data, "following not in response"
        assert 'profile_views' in data, "profile_views not in response"
        print(f"  ✓ /me/stats still works: followers={data['followers']}, following={data['following']}")

    def test_regression_notifications(self):
        """Test GET /notifications still works (regression)"""
        status, data = self.req('GET', '/notifications', 200)
        assert 'items' in data, "items not in response"
        assert 'seen_at' in data, "seen_at not in response"
        assert 'unseen_count' in data, "unseen_count not in response"
        print(f"  ✓ /notifications still works: {len(data['items'])} items, {data['unseen_count']} unseen")

    def test_with_rahul_token(self):
        """Test GET /me/followers and /me/following with RAHUL_TOKEN"""
        old_token = self.token
        self.token = RAHUL_TOKEN
        
        # Get stats first
        status, stats = self.req('GET', '/me/stats', 200)
        rahul_followers = stats['followers']
        rahul_following = stats['following']
        print(f"  ✓ Rahul's stats: {rahul_followers} followers, {rahul_following} following")
        
        # Get followers
        status, followers = self.req('GET', '/me/followers', 200)
        assert followers['count'] == rahul_followers, f"Followers count mismatch: {followers['count']} vs {rahul_followers}"
        print(f"  ✓ Rahul's followers: {followers['count']} people")
        
        # Get following
        status, following = self.req('GET', '/me/following', 200)
        assert following['count'] == rahul_following, f"Following count mismatch: {following['count']} vs {rahul_following}"
        print(f"  ✓ Rahul's following: {following['count']} people")
        
        self.token = old_token

    def summary(self):
        """Print test summary"""
        print(f"\n{'='*60}")
        print(f"📊 TEST SUMMARY - Followers/Following Feature")
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
    tester = FollowersFollowingTester()
    
    # Set KIARA_TOKEN as default
    tester.token = KIARA_TOKEN
    print(f"Using KIARA_TOKEN for tests")
    
    # Auth tests
    tester.test("Followers: Unauthenticated (401)", tester.test_followers_unauthenticated)
    tester.test("Following: Unauthenticated (401)", tester.test_following_unauthenticated)
    
    # Get initial stats
    tester.test("Stats: Get initial followers/following counts", tester.test_get_initial_stats)
    
    # Main feature tests
    tester.test("Followers: GET /me/followers structure and count", tester.test_get_followers)
    tester.test("Following: GET /me/following structure and count", tester.test_get_following)
    tester.test("Unfollow: Round trip (DELETE -> 404 -> POST restore)", tester.test_unfollow_round_trip)
    
    # Regression tests
    tester.test("Regression: GET /likes/received", tester.test_regression_likes_received)
    tester.test("Regression: GET /likes/sent", tester.test_regression_likes_sent)
    tester.test("Regression: GET /me/stats", tester.test_regression_stats)
    tester.test("Regression: GET /notifications", tester.test_regression_notifications)
    
    # Test with RAHUL_TOKEN
    tester.test("RAHUL: GET /me/followers and /me/following", tester.test_with_rahul_token)
    
    return tester.summary()

if __name__ == "__main__":
    sys.exit(main())
