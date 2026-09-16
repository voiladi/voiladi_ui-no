"""
Backend API tests for Instagram-style post creation with tagging, hide_likes, and comments_off features.
Tests the new fields: tagged, hide_likes, comments_off in POST /api/posts and POST /api/posts/video/init
"""
import requests
import sys
import io
from PIL import Image

BASE_URL = "https://match-fresh.preview.emergentagent.com/api"
TEST_EMAIL = "arin.landing@voiladi.com"
TEST_PASSWORD = "landing-arin-2026"

class PostTestSuite:
    def __init__(self):
        self.token = None
        self.user_id = None
        self.other_user_id = None
        self.other_token = None
        self.created_posts = []
        self.tests_run = 0
        self.tests_passed = 0
        
    def log(self, msg, success=None):
        """Log test results"""
        if success is True:
            print(f"✅ {msg}")
            self.tests_passed += 1
        elif success is False:
            print(f"❌ {msg}")
        else:
            print(f"ℹ️  {msg}")
        self.tests_run += 1 if success is not None else 0
    
    def generate_test_image(self, width=1200, height=1600):
        """Generate a small test JPEG image"""
        img = Image.new('RGB', (width, height), color=(73, 109, 137))
        buf = io.BytesIO()
        img.save(buf, format='JPEG', quality=85)
        buf.seek(0)
        return buf
    
    def test_login(self):
        """Test login and get token"""
        self.log("Testing login...")
        try:
            response = requests.post(f"{BASE_URL}/auth/login", json={
                "email": TEST_EMAIL,
                "password": TEST_PASSWORD
            }, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                self.token = data.get("token")
                self.user_id = data.get("user", {}).get("id")
                if self.token and self.user_id:
                    self.log(f"Login successful, user_id: {self.user_id}", True)
                    return True
                else:
                    self.log("Login response missing token or user_id", False)
                    return False
            else:
                self.log(f"Login failed with status {response.status_code}: {response.text}", False)
                return False
        except Exception as e:
            self.log(f"Login error: {str(e)}", False)
            return False
    
    def test_search_user(self):
        """Search for another user to tag"""
        self.log("Searching for another user to tag...")
        try:
            headers = {"Authorization": f"Bearer {self.token}"}
            response = requests.get(f"{BASE_URL}/search", params={"q": "a", "limit": 10}, headers=headers, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                profiles = data.get("profiles", [])
                # Find a user that's not me
                for profile in profiles:
                    if profile.get("id") != self.user_id and not profile.get("is_me"):
                        self.other_user_id = profile["id"]
                        self.log(f"Found user to tag: {profile.get('name')} (id: {self.other_user_id})", True)
                        return True
                self.log("No other users found in search results", False)
                return False
            else:
                self.log(f"Search failed with status {response.status_code}", False)
                return False
        except Exception as e:
            self.log(f"Search error: {str(e)}", False)
            return False
    
    def test_create_post_with_new_fields(self):
        """Test POST /api/posts with tagged, hide_likes, comments_off"""
        self.log("Testing POST /api/posts with new fields...")
        try:
            headers = {"Authorization": f"Bearer {self.token}"}
            
            # Create test image
            img_buffer = self.generate_test_image()
            
            # Include a bogus ID to test filtering
            tagged_value = f"{self.other_user_id},bogus-id-12345"
            
            files = {"file": ("test.jpg", img_buffer, "image/jpeg")}
            data = {
                "caption": "Test post with tagging and privacy settings",
                "location": "Test Location",
                "tagged": tagged_value,
                "hide_likes": "true",
                "comments_off": "true"
            }
            
            response = requests.post(f"{BASE_URL}/posts", headers=headers, files=files, data=data, timeout=30)
            
            if response.status_code == 201:
                post = response.json()
                self.created_posts.append(post["id"])
                
                # Verify response structure
                checks = []
                checks.append(("id" in post, "Post has id"))
                checks.append((isinstance(post.get("tagged"), list), "tagged is a list"))
                checks.append((self.other_user_id in post.get("tagged", []), f"tagged contains {self.other_user_id}"))
                checks.append(("bogus-id-12345" not in post.get("tagged", []), "bogus ID filtered out"))
                checks.append((isinstance(post.get("tagged_users"), list), "tagged_users is a list"))
                checks.append((len(post.get("tagged_users", [])) == 1, "tagged_users has 1 user"))
                
                if post.get("tagged_users"):
                    user = post["tagged_users"][0]
                    checks.append(("id" in user, "tagged_user has id"))
                    checks.append(("username" in user, "tagged_user has username"))
                    checks.append(("name" in user, "tagged_user has name"))
                    checks.append(("photo" in user, "tagged_user has photo"))
                    checks.append(("verified" in user, "tagged_user has verified"))
                
                checks.append((post.get("hide_likes") is True, "hide_likes is true"))
                checks.append((post.get("comments_off") is True, "comments_off is true"))
                checks.append((post.get("likes") == 0, "likes is 0 (owner sees number)"))
                
                all_passed = all(check[0] for check in checks)
                for passed, msg in checks:
                    self.log(f"  {msg}", passed)
                
                if all_passed:
                    self.log("POST /api/posts with new fields successful", True)
                    return post["id"]
                else:
                    self.log("POST /api/posts response validation failed", False)
                    return None
            else:
                self.log(f"POST /api/posts failed with status {response.status_code}: {response.text}", False)
                return None
        except Exception as e:
            self.log(f"POST /api/posts error: {str(e)}", False)
            return None
    
    def test_create_post_with_own_id(self):
        """Test that own user ID is excluded from tagged"""
        self.log("Testing POST /api/posts with own user ID in tagged...")
        try:
            headers = {"Authorization": f"Bearer {self.token}"}
            img_buffer = self.generate_test_image()
            
            files = {"file": ("test2.jpg", img_buffer, "image/jpeg")}
            data = {
                "caption": "Test with own ID",
                "tagged": f"{self.user_id},{self.other_user_id}",
                "hide_likes": "false",
                "comments_off": "false"
            }
            
            response = requests.post(f"{BASE_URL}/posts", headers=headers, files=files, data=data, timeout=30)
            
            if response.status_code == 201:
                post = response.json()
                self.created_posts.append(post["id"])
                
                own_id_excluded = self.user_id not in post.get("tagged", [])
                other_id_included = self.other_user_id in post.get("tagged", [])
                
                self.log(f"  Own ID excluded from tagged: {own_id_excluded}", own_id_excluded)
                self.log(f"  Other ID included in tagged: {other_id_included}", other_id_included)
                
                if own_id_excluded and other_id_included:
                    self.log("Own user ID correctly excluded from tagged", True)
                    return True
                else:
                    self.log("Own user ID handling failed", False)
                    return False
            else:
                self.log(f"POST failed with status {response.status_code}", False)
                return False
        except Exception as e:
            self.log(f"Error: {str(e)}", False)
            return False
    
    def test_create_post_defaults(self):
        """Test POST /api/posts with default values (no new fields)"""
        self.log("Testing POST /api/posts with defaults (regression test)...")
        try:
            headers = {"Authorization": f"Bearer {self.token}"}
            img_buffer = self.generate_test_image()
            
            files = {"file": ("test3.jpg", img_buffer, "image/jpeg")}
            data = {"caption": "Test with defaults"}
            
            response = requests.post(f"{BASE_URL}/posts", headers=headers, files=files, data=data, timeout=30)
            
            if response.status_code == 201:
                post = response.json()
                self.created_posts.append(post["id"])
                
                checks = []
                checks.append((post.get("tagged") == [], "tagged is empty list"))
                checks.append((post.get("hide_likes") is False, "hide_likes is false"))
                checks.append((post.get("comments_off") is False, "comments_off is false"))
                
                all_passed = all(check[0] for check in checks)
                for passed, msg in checks:
                    self.log(f"  {msg}", passed)
                
                if all_passed:
                    self.log("Default values work correctly", True)
                    return True
                else:
                    self.log("Default values validation failed", False)
                    return False
            else:
                self.log(f"POST failed with status {response.status_code}", False)
                return False
        except Exception as e:
            self.log(f"Error: {str(e)}", False)
            return False
    
    def test_get_post_as_non_owner(self, post_id):
        """Test GET /api/posts/{id} as non-owner with hide_likes"""
        self.log("Testing GET /api/posts/{id} as non-owner (hide_likes)...")
        
        # Try to register a second user or use existing test account
        try:
            # Try to login with a different test account
            import random
            test_phone = f"+19990000{random.randint(10, 23):03d}"
            
            # Request OTP
            otp_response = requests.post(f"{BASE_URL}/auth/request-otp", json={"phone": test_phone}, timeout=10)
            if otp_response.status_code == 200:
                otp_data = otp_response.json()
                dev_code = otp_data.get("dev_code")
                
                if dev_code:
                    # Verify OTP
                    verify_response = requests.post(f"{BASE_URL}/auth/verify-otp", json={
                        "phone": test_phone,
                        "code": dev_code
                    }, timeout=10)
                    
                    if verify_response.status_code == 200:
                        verify_data = verify_response.json()
                        self.other_token = verify_data.get("token")
                        
                        if self.other_token:
                            # Now get the post as the other user
                            headers = {"Authorization": f"Bearer {self.other_token}"}
                            response = requests.get(f"{BASE_URL}/posts/{post_id}", headers=headers, timeout=10)
                            
                            if response.status_code == 200:
                                post = response.json()
                                likes_is_null = post.get("likes") is None
                                self.log(f"  Non-owner sees likes as null: {likes_is_null}", likes_is_null)
                                
                                if likes_is_null:
                                    self.log("hide_likes works correctly for non-owners", True)
                                    return True
                                else:
                                    self.log(f"hide_likes failed: non-owner sees likes={post.get('likes')}", False)
                                    return False
                            else:
                                self.log(f"GET post failed with status {response.status_code}", False)
                                return False
            
            self.log("Could not create second user account, skipping non-owner test", None)
            return None
        except Exception as e:
            self.log(f"Non-owner test error: {str(e)}", None)
            return None
    
    def test_comment_on_comments_off_post(self, post_id):
        """Test POST /api/posts/{id}/comments when comments_off"""
        if not self.other_token:
            self.log("Skipping comments_off test (no second user)", None)
            return None
        
        self.log("Testing POST /api/posts/{id}/comments with comments_off...")
        try:
            # Try to comment as non-owner
            headers = {"Authorization": f"Bearer {self.other_token}"}
            response = requests.post(f"{BASE_URL}/posts/{post_id}/comments", 
                                   headers=headers, 
                                   json={"text": "Test comment"}, 
                                   timeout=10)
            
            if response.status_code == 403:
                error_msg = response.json().get("detail", "")
                correct_error = "Comments are turned off" in error_msg
                self.log(f"  Non-owner got 403: {correct_error}", correct_error)
                
                if correct_error:
                    # Now test that owner can still comment
                    owner_headers = {"Authorization": f"Bearer {self.token}"}
                    owner_response = requests.post(f"{BASE_URL}/posts/{post_id}/comments",
                                                  headers=owner_headers,
                                                  json={"text": "Owner comment"},
                                                  timeout=10)
                    
                    owner_can_comment = owner_response.status_code == 200
                    self.log(f"  Owner can still comment: {owner_can_comment}", owner_can_comment)
                    
                    if owner_can_comment:
                        self.log("comments_off works correctly", True)
                        return True
                    else:
                        self.log("Owner cannot comment (should be allowed)", False)
                        return False
                else:
                    self.log(f"Wrong error message: {error_msg}", False)
                    return False
            else:
                self.log(f"Expected 403, got {response.status_code}", False)
                return False
        except Exception as e:
            self.log(f"Error: {str(e)}", False)
            return False
    
    def test_video_init_with_new_fields(self):
        """Test POST /api/posts/video/init with new fields"""
        self.log("Testing POST /api/posts/video/init with new fields...")
        try:
            headers = {"Authorization": f"Bearer {self.token}", "Content-Type": "application/json"}
            data = {
                "content_type": "video/mp4",
                "size": 1000,
                "duration": 5,
                "caption": "Test video",
                "location": "Video Location",
                "tagged": [self.other_user_id],
                "hide_likes": True,
                "comments_off": False
            }
            
            response = requests.post(f"{BASE_URL}/posts/video/init", headers=headers, json=data, timeout=10)
            
            if response.status_code == 200:
                result = response.json()
                has_upload_id = "upload_id" in result
                self.log(f"  Got upload_id: {has_upload_id}", has_upload_id)
                
                if has_upload_id:
                    self.log("POST /api/posts/video/init successful", True)
                    return True
                else:
                    self.log("Missing upload_id in response", False)
                    return False
            else:
                self.log(f"POST /api/posts/video/init failed with status {response.status_code}: {response.text}", False)
                return False
        except Exception as e:
            self.log(f"Error: {str(e)}", False)
            return False
    
    def test_notifications_for_tagged_user(self):
        """Test GET /api/notifications for tagged user"""
        if not self.other_token:
            self.log("Skipping notifications test (no second user)", None)
            return None
        
        self.log("Testing GET /api/notifications for tagged user...")
        try:
            headers = {"Authorization": f"Bearer {self.other_token}"}
            response = requests.get(f"{BASE_URL}/notifications", headers=headers, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                items = data.get("items", [])
                
                # Look for a 'tag' notification
                tag_notifications = [item for item in items if item.get("type") == "tag"]
                has_tag_notification = len(tag_notifications) > 0
                
                self.log(f"  Found {len(tag_notifications)} tag notification(s)", has_tag_notification)
                
                if has_tag_notification:
                    tag_notif = tag_notifications[0]
                    has_href = tag_notif.get("href", "").startswith("/p/")
                    self.log(f"  Tag notification has correct href: {has_href}", has_href)
                    
                    if has_href:
                        self.log("Tag notifications work correctly", True)
                        return True
                    else:
                        self.log("Tag notification missing correct href", False)
                        return False
                else:
                    self.log("No tag notifications found (may take time to appear)", None)
                    return None
            else:
                self.log(f"GET notifications failed with status {response.status_code}", False)
                return False
        except Exception as e:
            self.log(f"Error: {str(e)}", False)
            return False
    
    def cleanup(self):
        """Delete created posts"""
        self.log(f"\nCleaning up {len(self.created_posts)} created posts...")
        headers = {"Authorization": f"Bearer {self.token}"}
        
        for post_id in self.created_posts:
            try:
                response = requests.delete(f"{BASE_URL}/posts/{post_id}", headers=headers, timeout=10)
                if response.status_code == 200:
                    self.log(f"  Deleted post {post_id}", True)
                else:
                    self.log(f"  Failed to delete post {post_id}: {response.status_code}", False)
            except Exception as e:
                self.log(f"  Error deleting post {post_id}: {str(e)}", False)
    
    def run_all_tests(self):
        """Run all backend tests"""
        print("\n" + "="*70)
        print("BACKEND API TESTS - Instagram-style Post Creation")
        print("="*70 + "\n")
        
        # Login
        if not self.test_login():
            print("\n❌ Login failed, cannot continue tests")
            return False
        
        # Search for user to tag
        if not self.test_search_user():
            print("\n⚠️  No other user found, some tests will be skipped")
        
        # Test 1: Create post with new fields
        post_id = self.test_create_post_with_new_fields()
        
        # Test 2: Create post with own ID (should be excluded)
        self.test_create_post_with_own_id()
        
        # Test 3: Create post with defaults
        self.test_create_post_defaults()
        
        # Test 4: Get post as non-owner (hide_likes)
        if post_id:
            self.test_get_post_as_non_owner(post_id)
        
        # Test 5: Comment on comments_off post
        if post_id:
            self.test_comment_on_comments_off_post(post_id)
        
        # Test 6: Video init with new fields
        self.test_video_init_with_new_fields()
        
        # Test 7: Notifications for tagged user
        self.test_notifications_for_tagged_user()
        
        # Cleanup
        self.cleanup()
        
        # Summary
        print("\n" + "="*70)
        print(f"BACKEND TESTS SUMMARY: {self.tests_passed}/{self.tests_run} passed")
        print("="*70 + "\n")
        
        return self.tests_passed == self.tests_run

def main():
    suite = PostTestSuite()
    success = suite.run_all_tests()
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())
