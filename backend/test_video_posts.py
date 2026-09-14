"""
Test video posts: chunked upload, transcoding, feed filtering, deletion.
"""
import requests
import sys
import time
import subprocess
from pathlib import Path

BASE_URL = "https://match-fresh.preview.emergentagent.com"
TEST_EMAIL = "arin.landing@voiladi.com"
TEST_PASSWORD = "landing-arin-2026"

class VideoPostTester:
    def __init__(self):
        self.token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.created_posts = []
        self.test_video_path = None

    def log(self, msg):
        print(f"  {msg}")

    def test(self, name, fn):
        """Run a test function"""
        self.tests_run += 1
        print(f"\n🔍 Test {self.tests_run}: {name}")
        try:
            fn()
            self.tests_passed += 1
            print(f"✅ PASSED")
            return True
        except AssertionError as e:
            print(f"❌ FAILED: {e}")
            return False
        except Exception as e:
            print(f"❌ ERROR: {e}")
            return False

    def generate_test_video(self):
        """Generate a 2-3s test video with ffmpeg"""
        print("\n📹 Generating test video...")
        video_path = Path("/tmp/test_video.mp4")
        try:
            subprocess.run([
                "ffmpeg", "-y", "-f", "lavfi", "-i", "testsrc=size=720x1280:rate=24",
                "-t", "2", "-c:v", "libx264", "-pix_fmt", "yuv420p", str(video_path)
            ], check=True, capture_output=True, timeout=30)
            self.test_video_path = video_path
            size = video_path.stat().st_size
            self.log(f"Generated test video: {size} bytes")
            return True
        except Exception as e:
            print(f"❌ Failed to generate video: {e}")
            return False

    def login(self):
        """Login and get token"""
        def _login():
            r = requests.post(f"{BASE_URL}/api/auth/login", json={
                "email": TEST_EMAIL,
                "password": TEST_PASSWORD
            }, timeout=10)
            assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
            data = r.json()
            assert "token" in data, "No token in response"
            self.token = data["token"]
            self.log(f"Logged in successfully")
        return self.test("Login", _login)

    def headers(self):
        return {"Authorization": f"Bearer {self.token}", "Content-Type": "application/json"}

    def test_video_post_flow(self):
        """Test complete video post flow: init -> chunk -> complete -> poll until ready"""
        def _test():
            if not self.test_video_path or not self.test_video_path.exists():
                raise AssertionError("Test video not found")
            
            video_data = self.test_video_path.read_bytes()
            video_size = len(video_data)
            
            # Step 1: Init
            self.log("Step 1: POST /api/posts/video/init")
            r = requests.post(f"{BASE_URL}/api/posts/video/init", json={
                "content_type": "video/mp4",
                "size": video_size,
                "duration": 2,
                "caption": "Test video post",
                "location": "Test Location"
            }, headers=self.headers(), timeout=10)
            assert r.status_code == 200, f"Init failed: {r.status_code} {r.text}"
            init_data = r.json()
            assert "upload_id" in init_data, "No upload_id in response"
            assert "chunk_size" in init_data, "No chunk_size in response"
            upload_id = init_data["upload_id"]
            self.log(f"Got upload_id: {upload_id}")
            
            # Step 2: Upload chunk
            self.log("Step 2: PUT /api/media/{upload_id}/chunk?i=0")
            r = requests.put(
                f"{BASE_URL}/api/media/{upload_id}/chunk?i=0",
                data=video_data,
                headers={"Authorization": f"Bearer {self.token}", "Content-Type": "application/octet-stream"},
                timeout=30
            )
            assert r.status_code == 200, f"Chunk upload failed: {r.status_code} {r.text}"
            chunk_data = r.json()
            assert chunk_data.get("ok") == True, "Chunk upload not ok"
            assert chunk_data.get("received") == video_size, f"Received {chunk_data.get('received')} != {video_size}"
            self.log(f"Uploaded {video_size} bytes")
            
            # Step 3: Complete
            self.log("Step 3: POST /api/posts/video/{upload_id}/complete")
            r = requests.post(
                f"{BASE_URL}/api/posts/video/{upload_id}/complete",
                headers=self.headers(),
                timeout=30
            )
            assert r.status_code == 201, f"Complete failed: {r.status_code} {r.text}"
            post = r.json()
            assert post.get("kind") == "video", f"Post kind is {post.get('kind')}, expected 'video'"
            assert post.get("status") == "processing", f"Post status is {post.get('status')}, expected 'processing'"
            assert "id" in post, "No post id"
            assert "video" in post, "No video URL"
            post_id = post["id"]
            self.created_posts.append(post_id)
            self.log(f"Created post {post_id}, status: processing")
            
            # Step 4: Poll until ready
            self.log("Step 4: Poll GET /api/posts/{id} until status='ready' (max 30s)")
            start = time.time()
            ready = False
            final_post = None
            while time.time() - start < 30:
                r = requests.get(f"{BASE_URL}/api/posts/{post_id}", headers=self.headers(), timeout=10)
                assert r.status_code == 200, f"Get post failed: {r.status_code}"
                final_post = r.json()
                status = final_post.get("status")
                self.log(f"  Status: {status}")
                if status == "ready":
                    ready = True
                    break
                elif status == "failed":
                    raise AssertionError(f"Video processing failed: {final_post.get('error')}")
                time.sleep(2)
            
            assert ready, "Video did not become ready within 30s"
            assert final_post.get("video"), "No video URL in ready post"
            assert final_post.get("image"), "No poster image URL in ready post"
            assert final_post.get("width"), "No width in ready post"
            assert final_post.get("height"), "No height in ready post"
            assert final_post.get("duration"), "No duration in ready post"
            self.log(f"Video ready: {final_post['width']}x{final_post['height']}, {final_post['duration']}s")
            
            # Step 5: Verify video file is accessible
            self.log("Step 5: GET /api/media/{id}.mp4")
            video_url = final_post["video"]
            if not video_url.startswith("http"):
                video_url = f"{BASE_URL}{video_url}"
            r = requests.get(video_url, headers=self.headers(), timeout=10)
            assert r.status_code == 200, f"Video file not accessible: {r.status_code}"
            assert r.headers.get("Content-Type") == "video/mp4", f"Wrong content type: {r.headers.get('Content-Type')}"
            self.log(f"Video file accessible: {len(r.content)} bytes")
            
            # Step 6: Verify poster is accessible
            self.log("Step 6: GET /api/media/{id}_poster.jpg")
            poster_url = final_post["image"]
            if not poster_url.startswith("http"):
                poster_url = f"{BASE_URL}{poster_url}"
            r = requests.get(poster_url, headers=self.headers(), timeout=10)
            assert r.status_code == 200, f"Poster not accessible: {r.status_code}"
            assert "image" in r.headers.get("Content-Type", ""), f"Wrong poster content type: {r.headers.get('Content-Type')}"
            self.log(f"Poster accessible: {len(r.content)} bytes")
            
            # Step 7: Verify Range support
            self.log("Step 7: Verify Range support (206)")
            r = requests.get(video_url, headers={**self.headers(), "Range": "bytes=0-1023"}, timeout=10)
            assert r.status_code == 206, f"Range request failed: {r.status_code}"
            assert "Content-Range" in r.headers, "No Content-Range header"
            self.log(f"Range support working: {r.headers.get('Content-Range')}")
            
        return self.test("Video post flow (init -> chunk -> complete -> ready)", _test)

    def test_init_rejects_long_duration(self):
        """Test that init rejects videos > 60s"""
        def _test():
            r = requests.post(f"{BASE_URL}/api/posts/video/init", json={
                "content_type": "video/mp4",
                "size": 1000000,
                "duration": 90,
                "caption": "Too long",
                "location": ""
            }, headers=self.headers(), timeout=10)
            assert r.status_code == 400, f"Expected 400, got {r.status_code}"
            self.log(f"Correctly rejected 90s video: {r.json()}")
        return self.test("Init rejects duration > 60s", _test)

    def test_init_rejects_non_video(self):
        """Test that init rejects non-video content types"""
        def _test():
            r = requests.post(f"{BASE_URL}/api/posts/video/init", json={
                "content_type": "image/jpeg",
                "size": 1000000,
                "duration": 2,
                "caption": "Not a video",
                "location": ""
            }, headers=self.headers(), timeout=10)
            assert r.status_code == 400, f"Expected 400, got {r.status_code}"
            self.log(f"Correctly rejected image/jpeg: {r.json()}")
        return self.test("Init rejects non-video content_type", _test)

    def test_feed_excludes_processing(self):
        """Test that GET /api/posts/feed excludes processing/failed posts"""
        def _test():
            r = requests.get(f"{BASE_URL}/api/posts/feed", headers=self.headers(), timeout=10)
            assert r.status_code == 200, f"Feed request failed: {r.status_code}"
            data = r.json()
            assert "posts" in data, "No posts in response"
            posts = data["posts"]
            self.log(f"Feed returned {len(posts)} posts")
            for post in posts:
                status = post.get("status", "ready")
                assert status not in ["processing", "failed"], f"Feed contains post with status '{status}'"
            self.log("All posts in feed have status 'ready' or no status field")
        return self.test("Feed excludes processing/failed posts", _test)

    def test_my_posts_includes_video(self):
        """Test that GET /api/posts/mine includes video posts with kind/status"""
        def _test():
            r = requests.get(f"{BASE_URL}/api/posts/mine", headers=self.headers(), timeout=10)
            assert r.status_code == 200, f"My posts request failed: {r.status_code}"
            data = r.json()
            assert "posts" in data, "No posts in response"
            posts = data["posts"]
            self.log(f"My posts returned {len(posts)} posts")
            video_posts = [p for p in posts if p.get("kind") == "video"]
            assert len(video_posts) > 0, "No video posts found in my posts"
            for vp in video_posts:
                assert "status" in vp, "Video post missing status field"
                assert "kind" in vp, "Video post missing kind field"
                self.log(f"Video post {vp['id']}: kind={vp['kind']}, status={vp['status']}")
        return self.test("My posts includes video posts with kind/status", _test)

    def test_delete_video_post(self):
        """Test DELETE /api/posts/{id} and verify media files are gone"""
        def _test():
            if not self.created_posts:
                raise AssertionError("No posts to delete")
            
            post_id = self.created_posts[0]
            
            # Get post details first
            r = requests.get(f"{BASE_URL}/api/posts/{post_id}", headers=self.headers(), timeout=10)
            assert r.status_code == 200, f"Get post failed: {r.status_code}"
            post = r.json()
            video_url = post.get("video")
            
            # Delete post
            self.log(f"Deleting post {post_id}")
            r = requests.delete(f"{BASE_URL}/api/posts/{post_id}", headers=self.headers(), timeout=10)
            assert r.status_code == 200, f"Delete failed: {r.status_code}"
            self.log("Post deleted")
            
            # Verify post is gone
            r = requests.get(f"{BASE_URL}/api/posts/{post_id}", headers=self.headers(), timeout=10)
            assert r.status_code == 404, f"Post still exists: {r.status_code}"
            self.log("Post no longer accessible")
            
            # Verify video file is gone
            if video_url:
                if not video_url.startswith("http"):
                    video_url = f"{BASE_URL}{video_url}"
                r = requests.get(video_url, headers=self.headers(), timeout=10)
                assert r.status_code == 404, f"Video file still exists: {r.status_code}"
                self.log("Video file removed")
            
            self.created_posts.remove(post_id)
        return self.test("Delete video post and verify media is gone", _test)

    def test_image_post_still_works(self):
        """Smoke test: image posts still work"""
        def _test():
            # Create a tiny 1x1 PNG
            import base64
            png_data = base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==")
            
            files = {"file": ("test.png", png_data, "image/png")}
            data = {"caption": "Test image", "location": "Test"}
            
            r = requests.post(
                f"{BASE_URL}/api/posts",
                files=files,
                data=data,
                headers={"Authorization": f"Bearer {self.token}"},
                timeout=30
            )
            assert r.status_code == 201, f"Image post failed: {r.status_code} {r.text}"
            post = r.json()
            assert post.get("kind", "image") == "image", "Wrong post kind"
            assert "image" in post, "No image URL"
            self.created_posts.append(post["id"])
            self.log(f"Created image post {post['id']}")
        return self.test("Image posts still work (smoke test)", _test)

    def cleanup(self):
        """Delete any remaining test posts"""
        if not self.created_posts:
            return
        print(f"\n🧹 Cleaning up {len(self.created_posts)} test posts...")
        for post_id in list(self.created_posts):
            try:
                r = requests.delete(f"{BASE_URL}/api/posts/{post_id}", headers=self.headers(), timeout=10)
                if r.status_code == 200:
                    print(f"  ✅ Deleted {post_id}")
                else:
                    print(f"  ⚠️  Could not delete {post_id}: {r.status_code}")
            except Exception as e:
                print(f"  ⚠️  Error deleting {post_id}: {e}")

    def run_all(self):
        """Run all tests"""
        print("=" * 60)
        print("VIDEO POSTS BACKEND TEST")
        print("=" * 60)
        
        if not self.generate_test_video():
            print("\n❌ Cannot proceed without test video")
            return 1
        
        if not self.login():
            print("\n❌ Cannot proceed without login")
            return 1
        
        # Run tests
        self.test_video_post_flow()
        self.test_init_rejects_long_duration()
        self.test_init_rejects_non_video()
        self.test_feed_excludes_processing()
        self.test_my_posts_includes_video()
        self.test_delete_video_post()
        self.test_image_post_still_works()
        
        # Cleanup
        self.cleanup()
        
        # Summary
        print("\n" + "=" * 60)
        print(f"📊 RESULTS: {self.tests_passed}/{self.tests_run} tests passed")
        print("=" * 60)
        
        return 0 if self.tests_passed == self.tests_run else 1

def main():
    tester = VideoPostTester()
    return tester.run_all()

if __name__ == "__main__":
    sys.exit(main())
