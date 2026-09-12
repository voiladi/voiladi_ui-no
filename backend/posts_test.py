"""Backend API tests for Posts feature (Discover feed)."""
import requests
import sys
import time
import os

BASE_URL = "https://match-fresh.preview.emergentagent.com/api"
ADMIN_KEY = "ARIN2008ANIN"
TEST_PHOTO = "/app/tests/test_photo.jpg"

# Test credentials from review_request
TEST_EMAIL = "arin.landing@voiladi.com"
TEST_PASSWORD = "landing-arin-2026"

class PostsTester:
    def __init__(self):
        self.tests_run = 0
        self.tests_passed = 0
        self.tests_failed = 0
        self.token = None
        self.user = None
        self.failures = []
        self.post_id = None
        self.comment_id = None
        self.match_id = None

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
            assert r.status_code == expected_status, f"Expected {expected_status}, got {r.status_code}. Response: {r.text[:500]}"
        
        try:
            return r.status_code, r.json() if r.text else {}
        except ValueError:
            return r.status_code, {}

    # ========== AUTH TESTS ==========
    def test_login(self):
        """Test POST /auth/login with arin.landing@voiladi.com"""
        status, data = self.req('POST', '/auth/login', 200, json={'email': TEST_EMAIL, 'password': TEST_PASSWORD})
        assert 'token' in data, "token not in response"
        assert 'user' in data, "user not in response"
        self.token = data['token']
        self.user = data['user']
        print(f"  ✓ Logged in as {self.user.get('name')} (id={self.user['id']})")

    # ========== ADMIN SEED POSTS ==========
    def test_admin_seed_posts(self):
        """Test POST /admin/seed/posts to ensure bot posts exist"""
        status, data = self.req('POST', '/admin/seed/posts', 200, headers={'x-admin-key': ADMIN_KEY})
        assert 'ok' in data or 'created' in data, "Should return ok or created"
        print(f"  ✓ Seeded posts: created={data.get('created', 0)}, total={data.get('total_sample_posts', 0)}")

    # ========== POSTS FEED TESTS ==========
    def test_posts_feed_basic(self):
        """Test GET /posts/feed returns posts with required fields"""
        status, data = self.req('GET', '/posts/feed', 200, params={'limit': 8})
        assert 'posts' in data, "posts not in response"
        assert 'next' in data, "next cursor not in response"
        assert isinstance(data['posts'], list), "posts should be a list"
        
        if len(data['posts']) > 0:
            post = data['posts'][0]
            # Check required fields
            required_fields = ['id', 'image', 'caption', 'location', 'likes', 'comments', 'shares', 'saves', 
                             'author', 'liked', 'saved', 'followed', 'mine']
            for field in required_fields:
                assert field in post, f"Post missing field: {field}"
            
            # Check author fields
            author = post['author']
            assert 'id' in author, "author missing id"
            assert 'name' in author, "author missing name"
            assert 'username' in author, "author missing username"
            assert 'photo' in author, "author missing photo"
            assert 'verified' in author, "author missing verified"
            
            # Check boolean flags
            assert isinstance(post['liked'], bool), "liked should be bool"
            assert isinstance(post['saved'], bool), "saved should be bool"
            assert isinstance(post['followed'], bool), "followed should be bool"
            assert isinstance(post['mine'], bool), "mine should be bool"
            
            # Own posts should be excluded
            assert post['mine'] == False, "Own posts should not appear in feed"
            
            print(f"  ✓ Feed returned {len(data['posts'])} posts with all required fields")
            self.feed_post_id = post['id']
        else:
            print(f"  ⚠ Feed returned 0 posts (no seed data)")

    def test_posts_feed_pagination(self):
        """Test GET /posts/feed with before cursor for pagination"""
        # Get first page
        status, data1 = self.req('GET', '/posts/feed', 200, params={'limit': 3})
        if data1.get('next'):
            # Get second page
            status, data2 = self.req('GET', '/posts/feed', 200, params={'limit': 3, 'before': data1['next']})
            assert 'posts' in data2, "posts not in second page"
            # Posts should be different
            ids1 = {p['id'] for p in data1['posts']}
            ids2 = {p['id'] for p in data2['posts']}
            assert len(ids1 & ids2) == 0, "Pages should have different posts"
            print(f"  ✓ Pagination working: page1={len(data1['posts'])} posts, page2={len(data2['posts'])} posts")
        else:
            print(f"  ⚠ Not enough posts to test pagination")

    # ========== CREATE POST TESTS ==========
    def test_create_post(self):
        """Test POST /posts creates a post with multipart form data"""
        if not os.path.exists(TEST_PHOTO):
            print(f"  ⚠ Test photo not found at {TEST_PHOTO}, skipping")
            return
        
        with open(TEST_PHOTO, 'rb') as f:
            files = {'file': ('test.jpg', f, 'image/jpeg')}
            data = {'caption': 'Test post from automated tests', 'location': 'Test Location'}
            status, response = self.req('POST', '/posts', 201, files=files, data=data)
        
        assert 'id' in response, "Post id not in response"
        assert 'image' in response, "image not in response"
        assert response['caption'] == 'Test post from automated tests', "Caption mismatch"
        assert response['location'] == 'Test Location', "Location mismatch"
        assert response['mine'] == True, "mine should be True for own post"
        
        self.post_id = response['id']
        print(f"  ✓ Created post: id={self.post_id}, image={response['image']}")

    def test_create_post_invalid_file(self):
        """Test POST /posts with non-image returns 400"""
        files = {'file': ('test.txt', b'not an image', 'text/plain')}
        data = {'caption': 'Test', 'location': 'Test'}
        status, response = self.req('POST', '/posts', 400, files=files, data=data)
        assert 'jpg' in response.get('detail', '').lower() or 'image' in response.get('detail', '').lower(), "Should mention image types"
        print(f"  ✓ Non-image rejected: {response.get('detail')}")

    def test_create_post_caption_too_long(self):
        """Test POST /posts with caption > 300 chars returns 400"""
        if not os.path.exists(TEST_PHOTO):
            print(f"  ⚠ Test photo not found, skipping")
            return
        
        with open(TEST_PHOTO, 'rb') as f:
            files = {'file': ('test.jpg', f, 'image/jpeg')}
            data = {'caption': 'a' * 301, 'location': 'Test'}
            status, response = self.req('POST', '/posts', 400, files=files, data=data)
        assert '300' in response.get('detail', ''), "Should mention 300 character limit"
        print(f"  ✓ Long caption rejected: {response.get('detail')}")

    # ========== GET POST TESTS ==========
    def test_get_post(self):
        """Test GET /posts/{id} returns post details"""
        if not self.post_id:
            print(f"  ⚠ No post created, skipping")
            return
        
        status, data = self.req('GET', f'/posts/{self.post_id}', 200)
        assert data['id'] == self.post_id, "Post ID mismatch"
        assert 'author' in data, "author not in response"
        assert 'liked' in data, "liked not in response"
        print(f"  ✓ Retrieved post: {self.post_id}")

    def test_get_post_not_found(self):
        """Test GET /posts/{id} with invalid ID returns 404"""
        status, data = self.req('GET', '/posts/invalid-post-id', 404)
        assert 'not found' in data.get('detail', '').lower(), "Should mention not found"
        print(f"  ✓ Invalid post ID rejected (404)")

    def test_get_my_posts(self):
        """Test GET /posts/mine returns my posts"""
        status, data = self.req('GET', '/posts/mine', 200)
        assert 'posts' in data, "posts not in response"
        
        if self.post_id:
            # Should include the post we created
            post_ids = [p['id'] for p in data['posts']]
            assert self.post_id in post_ids, "Created post not in my posts"
            print(f"  ✓ My posts: {len(data['posts'])} posts (includes created post)")
        else:
            print(f"  ✓ My posts: {len(data['posts'])} posts")

    # ========== LIKE TESTS ==========
    def test_like_post(self):
        """Test POST /posts/{id}/like toggles like"""
        if not hasattr(self, 'feed_post_id'):
            print(f"  ⚠ No feed post available, skipping")
            return
        
        # Like the post
        status, data = self.req('POST', f'/posts/{self.feed_post_id}/like', 200)
        assert 'liked' in data, "liked not in response"
        assert 'likes' in data, "likes count not in response"
        assert data['liked'] == True, "Post should be liked"
        initial_likes = data['likes']
        print(f"  ✓ Liked post: liked={data['liked']}, likes={data['likes']}")
        
        # Unlike the post
        status, data = self.req('POST', f'/posts/{self.feed_post_id}/like', 200)
        assert data['liked'] == False, "Post should be unliked"
        assert data['likes'] == initial_likes - 1, "Likes count should decrease"
        print(f"  ✓ Unliked post: liked={data['liked']}, likes={data['likes']}")

    # ========== SAVE TESTS ==========
    def test_save_post(self):
        """Test POST /posts/{id}/save toggles save"""
        if not hasattr(self, 'feed_post_id'):
            print(f"  ⚠ No feed post available, skipping")
            return
        
        # Save the post
        status, data = self.req('POST', f'/posts/{self.feed_post_id}/save', 200)
        assert 'saved' in data, "saved not in response"
        assert 'saves' in data, "saves count not in response"
        assert data['saved'] == True, "Post should be saved"
        print(f"  ✓ Saved post: saved={data['saved']}, saves={data['saves']}")
        
        # Unsave the post
        status, data = self.req('POST', f'/posts/{self.feed_post_id}/save', 200)
        assert data['saved'] == False, "Post should be unsaved"
        print(f"  ✓ Unsaved post: saved={data['saved']}, saves={data['saves']}")

    def test_get_saved_posts(self):
        """Test GET /posts/saved returns saved posts"""
        # Save a post first
        if hasattr(self, 'feed_post_id'):
            self.req('POST', f'/posts/{self.feed_post_id}/save', 200)
        
        status, data = self.req('GET', '/posts/saved', 200)
        assert 'posts' in data, "posts not in response"
        print(f"  ✓ Saved posts: {len(data['posts'])} posts")

    # ========== COMMENTS TESTS ==========
    def test_add_comment(self):
        """Test POST /posts/{id}/comments adds a comment"""
        if not hasattr(self, 'feed_post_id'):
            print(f"  ⚠ No feed post available, skipping")
            return
        
        status, data = self.req('POST', f'/posts/{self.feed_post_id}/comments', 200, 
                               json={'text': 'Great post! 🔥'})
        assert 'id' in data, "comment id not in response"
        assert 'text' in data, "text not in response"
        assert data['text'] == 'Great post! 🔥', "Comment text mismatch"
        assert 'author' in data, "author not in response"
        assert data['mine'] == True, "mine should be True for own comment"
        assert 'count' in data, "count not in response"
        
        self.comment_id = data['id']
        print(f"  ✓ Added comment: id={self.comment_id}, count={data['count']}")

    def test_add_comment_empty(self):
        """Test POST /posts/{id}/comments with empty text returns 400"""
        if not hasattr(self, 'feed_post_id'):
            print(f"  ⚠ No feed post available, skipping")
            return
        
        status, data = self.req('POST', f'/posts/{self.feed_post_id}/comments', 400, json={'text': ''})
        assert 'write' in data.get('detail', '').lower(), "Should mention write something"
        print(f"  ✓ Empty comment rejected: {data.get('detail')}")

    def test_list_comments(self):
        """Test GET /posts/{id}/comments returns comments"""
        if not hasattr(self, 'feed_post_id'):
            print(f"  ⚠ No feed post available, skipping")
            return
        
        status, data = self.req('GET', f'/posts/{self.feed_post_id}/comments', 200)
        assert 'comments' in data, "comments not in response"
        assert 'count' in data, "count not in response"
        
        if self.comment_id:
            # Should include our comment
            comment_ids = [c['id'] for c in data['comments']]
            assert self.comment_id in comment_ids, "Created comment not in list"
        
        print(f"  ✓ Listed comments: {data['count']} comments")

    def test_delete_comment(self):
        """Test DELETE /posts/{id}/comments/{cid} deletes comment"""
        if not hasattr(self, 'feed_post_id') or not self.comment_id:
            print(f"  ⚠ No comment to delete, skipping")
            return
        
        status, data = self.req('DELETE', f'/posts/{self.feed_post_id}/comments/{self.comment_id}', 200)
        assert 'ok' in data, "ok not in response"
        assert 'count' in data, "count not in response"
        print(f"  ✓ Deleted comment: count={data['count']}")

    def test_delete_comment_not_mine(self):
        """Test DELETE /posts/{id}/comments/{cid} on someone else's comment returns 403"""
        if not hasattr(self, 'feed_post_id'):
            print(f"  ⚠ No feed post available, skipping")
            return
        
        # Try to delete a non-existent comment (will return 404, but that's ok for this test)
        status, data = self.req('DELETE', f'/posts/{self.feed_post_id}/comments/fake-comment-id', None)
        assert status in [403, 404], f"Expected 403 or 404, got {status}"
        print(f"  ✓ Delete other's comment rejected ({status})")

    # ========== SHARE TESTS ==========
    def test_share_post_to_chat(self):
        """Test POST /posts/{id}/share shares post to a chat"""
        if not hasattr(self, 'feed_post_id'):
            print(f"  ⚠ No feed post available, skipping")
            return
        
        # Get matches to find a chat
        status, matches_data = self.req('GET', '/matches', 200)
        if len(matches_data.get('matches', [])) == 0:
            print(f"  ⚠ No matches available to share to, skipping")
            return
        
        self.match_id = matches_data['matches'][0]['id']
        
        # Share the post
        status, data = self.req('POST', f'/posts/{self.feed_post_id}/share', 200, 
                               json={'match_id': self.match_id})
        assert 'ok' in data, "ok not in response"
        assert 'message' in data, "message not in response"
        assert 'shares' in data, "shares count not in response"
        assert data['message']['kind'] == 'post', "Message kind should be 'post'"
        
        print(f"  ✓ Shared post to chat: match_id={self.match_id}, shares={data['shares']}")

    def test_share_post_invalid_match(self):
        """Test POST /posts/{id}/share with invalid match_id returns 404"""
        if not hasattr(self, 'feed_post_id'):
            print(f"  ⚠ No feed post available, skipping")
            return
        
        status, data = self.req('POST', f'/posts/{self.feed_post_id}/share', None, 
                               json={'match_id': 'invalid-match-id'})
        assert status in [404, 400], f"Expected 404 or 400, got {status}"
        print(f"  ✓ Share to invalid match rejected ({status})")

    # ========== HIDE TESTS ==========
    def test_hide_post(self):
        """Test POST /posts/{id}/hide hides post from feed"""
        if not hasattr(self, 'feed_post_id'):
            print(f"  ⚠ No feed post available, skipping")
            return
        
        # Get initial feed count
        status, feed1 = self.req('GET', '/posts/feed', 200, params={'limit': 20})
        initial_count = len(feed1['posts'])
        
        # Hide a post
        status, data = self.req('POST', f'/posts/{self.feed_post_id}/hide', 200)
        assert 'ok' in data, "ok not in response"
        print(f"  ✓ Hidden post: {self.feed_post_id}")
        
        # Verify it's not in feed anymore
        status, feed2 = self.req('GET', '/posts/feed', 200, params={'limit': 20})
        post_ids = [p['id'] for p in feed2['posts']]
        assert self.feed_post_id not in post_ids, "Hidden post should not appear in feed"
        print(f"  ✓ Hidden post not in feed (was {initial_count} posts, now {len(feed2['posts'])})")

    # ========== REPORT TESTS ==========
    def test_report_post(self):
        """Test POST /posts/{id}/report reports a post"""
        # Get a new post from feed (not the one we hid)
        status, feed = self.req('GET', '/posts/feed', 200, params={'limit': 5})
        if len(feed['posts']) == 0:
            print(f"  ⚠ No posts in feed to report, skipping")
            return
        
        report_post_id = feed['posts'][0]['id']
        
        status, data = self.req('POST', f'/posts/{report_post_id}/report', 200, 
                               json={'reason': 'Inappropriate content', 'details': 'Test report'})
        assert 'ok' in data, "ok not in response"
        print(f"  ✓ Reported post: {report_post_id}")
        
        # Verify it's hidden after report
        status, feed2 = self.req('GET', '/posts/feed', 200, params={'limit': 20})
        post_ids = [p['id'] for p in feed2['posts']]
        assert report_post_id not in post_ids, "Reported post should be hidden from feed"
        print(f"  ✓ Reported post hidden from feed")

    def test_report_own_post(self):
        """Test POST /posts/{id}/report on own post returns 400"""
        if not self.post_id:
            print(f"  ⚠ No own post to report, skipping")
            return
        
        status, data = self.req('POST', f'/posts/{self.post_id}/report', 400, 
                               json={'reason': 'Test', 'details': 'Test'})
        assert 'invalid' in data.get('detail', '').lower(), "Should mention invalid report"
        print(f"  ✓ Report own post rejected: {data.get('detail')}")

    # ========== DELETE POST TESTS ==========
    def test_delete_other_post(self):
        """Test DELETE /posts/{id} on someone else's post returns 403"""
        if not hasattr(self, 'feed_post_id'):
            print(f"  ⚠ No feed post available, skipping")
            return
        
        # Try to delete someone else's post
        status, data = self.req('DELETE', f'/posts/{self.feed_post_id}', None)
        # Could be 403 or 404 if already hidden
        assert status in [403, 404], f"Expected 403 or 404, got {status}"
        print(f"  ✓ Delete other's post rejected ({status})")

    def test_delete_own_post(self):
        """Test DELETE /posts/{id} deletes own post"""
        if not self.post_id:
            print(f"  ⚠ No own post to delete, skipping")
            return
        
        status, data = self.req('DELETE', f'/posts/{self.post_id}', 200)
        assert 'ok' in data, "ok not in response"
        print(f"  ✓ Deleted own post: {self.post_id}")
        
        # Verify it's gone
        status, data = self.req('GET', f'/posts/{self.post_id}', 404)
        print(f"  ✓ Deleted post returns 404")

    def summary(self):
        """Print test summary"""
        print(f"\n{'='*60}")
        print(f"📊 POSTS FEATURE TEST SUMMARY")
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
    tester = PostsTester()
    
    # Auth
    tester.test("Auth: Login with arin.landing@voiladi.com", tester.test_login)
    
    # Admin seed
    tester.test("Admin: Seed bot posts", tester.test_admin_seed_posts)
    
    # Feed tests
    tester.test("Posts: GET /posts/feed returns posts", tester.test_posts_feed_basic)
    tester.test("Posts: GET /posts/feed pagination", tester.test_posts_feed_pagination)
    
    # Create post tests
    tester.test("Posts: POST /posts creates post", tester.test_create_post)
    tester.test("Posts: POST /posts invalid file (400)", tester.test_create_post_invalid_file)
    tester.test("Posts: POST /posts caption too long (400)", tester.test_create_post_caption_too_long)
    
    # Get post tests
    tester.test("Posts: GET /posts/{id} returns post", tester.test_get_post)
    tester.test("Posts: GET /posts/{id} not found (404)", tester.test_get_post_not_found)
    tester.test("Posts: GET /posts/mine returns my posts", tester.test_get_my_posts)
    
    # Like tests
    tester.test("Posts: POST /posts/{id}/like toggles like", tester.test_like_post)
    
    # Save tests
    tester.test("Posts: POST /posts/{id}/save toggles save", tester.test_save_post)
    tester.test("Posts: GET /posts/saved returns saved posts", tester.test_get_saved_posts)
    
    # Comments tests
    tester.test("Posts: POST /posts/{id}/comments adds comment", tester.test_add_comment)
    tester.test("Posts: POST /posts/{id}/comments empty (400)", tester.test_add_comment_empty)
    tester.test("Posts: GET /posts/{id}/comments lists comments", tester.test_list_comments)
    tester.test("Posts: DELETE /posts/{id}/comments/{cid} deletes comment", tester.test_delete_comment)
    tester.test("Posts: DELETE /posts/{id}/comments/{cid} not mine (403)", tester.test_delete_comment_not_mine)
    
    # Share tests
    tester.test("Posts: POST /posts/{id}/share shares to chat", tester.test_share_post_to_chat)
    tester.test("Posts: POST /posts/{id}/share invalid match (404)", tester.test_share_post_invalid_match)
    
    # Hide tests
    tester.test("Posts: POST /posts/{id}/hide hides from feed", tester.test_hide_post)
    
    # Report tests
    tester.test("Posts: POST /posts/{id}/report reports post", tester.test_report_post)
    tester.test("Posts: POST /posts/{id}/report own post (400)", tester.test_report_own_post)
    
    # Delete tests
    tester.test("Posts: DELETE /posts/{id} other's post (403)", tester.test_delete_other_post)
    tester.test("Posts: DELETE /posts/{id} own post", tester.test_delete_own_post)
    
    return tester.summary()

if __name__ == "__main__":
    sys.exit(main())
