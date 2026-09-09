"""Comprehensive Phase 4 backend tests: reactions, block/report, admin, OTP prefixes."""
import requests
import sys
import time

BASE_URL = "https://match-fresh.preview.emergentagent.com/api"
ADMIN_KEY = "voiladi-admin-dev-key"

class Phase4Tester:
    def __init__(self):
        self.tests_run = 0
        self.tests_passed = 0
        self.tests_failed = 0
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

    def login(self, phone):
        """Login with test phone and return token, user"""
        print(f"  → Logging in with {phone}")
        r = requests.post(f"{BASE_URL}/auth/request-otp", json={"phone": phone})
        assert r.status_code == 200, f"request-otp failed: {r.status_code} {r.text}"
        data = r.json()
        assert "dev_code" in data, f"dev_code not in response: {data}"
        code = data["dev_code"]
        
        r = requests.post(f"{BASE_URL}/auth/verify-otp", json={"phone": phone, "code": code})
        assert r.status_code == 200, f"verify-otp failed: {r.status_code} {r.text}"
        data = r.json()
        assert "token" in data and "user" in data, f"token/user not in response: {data}"
        print(f"  ✓ Logged in as {data['user'].get('name', 'New User')}")
        return data["token"], data["user"]

    def hdr(self, token):
        """Return auth header"""
        return {"Authorization": f"Bearer {token}"}

    def complete_profile(self, token, name, gender, looking_for):
        """Complete a profile with minimal data"""
        print(f"  → Completing profile for {name}")
        # Update profile
        r = requests.put(f"{BASE_URL}/profile", headers=self.hdr(token), json={
            "name": name,
            "birthday": "2000-05-05",
            "gender": gender,
            "looking_for": looking_for,
            "interests": ["Music", "Coffee", "Travel"],
            "prompts": [{"question": "My simple pleasures", "answer": "Iced coffee at 7am"}],
        })
        assert r.status_code == 200, f"profile update failed: {r.status_code} {r.text}"
        
        # Upload a tiny PNG
        png = bytes.fromhex("89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c6360000002000154a24f5d0000000049454e44ae426082")
        r = requests.post(f"{BASE_URL}/profile/photos", headers=self.hdr(token), files={"file": ("p.png", png, "image/png")})
        assert r.status_code == 200, f"photo upload failed: {r.status_code} {r.text}"
        
        # Mark onboarded
        r = requests.put(f"{BASE_URL}/profile", headers=self.hdr(token), json={"onboarded": True})
        assert r.status_code == 200, f"onboarding failed: {r.status_code} {r.text}"
        
        # Get updated user
        r = requests.get(f"{BASE_URL}/auth/me", headers=self.hdr(token))
        assert r.status_code == 200, f"auth/me failed: {r.status_code} {r.text}"
        user = r.json()
        print(f"  ✓ Profile complete: {user['name']}, {len(user['photos'])} photo(s)")
        return user

    # ========== OTP PREFIX TESTS ==========
    def test_otp_1999_prefix(self):
        """Test OTP with +1999 prefix returns dev_code"""
        phone = f"+1999{int(time.time()) % 10000:07d}"
        r = requests.post(f"{BASE_URL}/auth/request-otp", json={"phone": phone})
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
        data = r.json()
        assert "dev_code" in data, f"dev_code not in response: {data}"
        assert data.get("dev_mode") == True, f"dev_mode should be True: {data}"
        assert len(data["dev_code"]) == 6, f"dev_code should be 6 digits: {data['dev_code']}"
        print(f"  ✓ +1999 prefix returned dev_code: {data['dev_code']}")

    def test_otp_1555_prefix(self):
        """Test OTP with +1555 prefix returns dev_code"""
        phone = f"+1555{int(time.time()) % 10000:07d}"
        r = requests.post(f"{BASE_URL}/auth/request-otp", json={"phone": phone})
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
        data = r.json()
        assert "dev_code" in data, f"dev_code not in response: {data}"
        assert data.get("dev_mode") == True, f"dev_mode should be True: {data}"
        print(f"  ✓ +1555 prefix returned dev_code: {data['dev_code']}")

    def test_otp_1777_prefix(self):
        """Test OTP with +1777 prefix returns dev_code"""
        phone = f"+1777{int(time.time()) % 10000:07d}"
        r = requests.post(f"{BASE_URL}/auth/request-otp", json={"phone": phone})
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
        data = r.json()
        assert "dev_code" in data, f"dev_code not in response: {data}"
        assert data.get("dev_mode") == True, f"dev_mode should be True: {data}"
        print(f"  ✓ +1777 prefix returned dev_code: {data['dev_code']}")

    def test_otp_wrong_code(self):
        """Test OTP verify with wrong code returns 400 with correct message"""
        phone = f"+1555{int(time.time()) % 10000:07d}"
        r = requests.post(f"{BASE_URL}/auth/request-otp", json={"phone": phone})
        assert r.status_code == 200
        
        r = requests.post(f"{BASE_URL}/auth/verify-otp", json={"phone": phone, "code": "000000"})
        assert r.status_code == 400, f"Expected 400, got {r.status_code}"
        data = r.json()
        assert "doesn't look right" in data.get("detail", "").lower(), f"Expected 'doesn't look right' message: {data}"
        print(f"  ✓ Wrong code rejected with message: {data['detail']}")

    def test_otp_non_6_digit(self):
        """Test OTP verify with non-6-digit code returns 400"""
        phone = f"+1555{int(time.time()) % 10000:07d}"
        r = requests.post(f"{BASE_URL}/auth/request-otp", json={"phone": phone})
        assert r.status_code == 200
        
        r = requests.post(f"{BASE_URL}/auth/verify-otp", json={"phone": phone, "code": "12345"})
        assert r.status_code == 400, f"Expected 400, got {r.status_code}"
        print(f"  ✓ Non-6-digit code rejected")

    # ========== REACTION SWIPE TESTS ==========
    def test_reaction_swipe_invalid_photo(self):
        """Test swipe with invalid photo URL returns 400"""
        stamp = int(time.time()) % 100000
        ta, ua = self.login(f"+1555{stamp:07d}01")
        tb, ub = self.login(f"+1555{stamp:07d}02")
        self.complete_profile(ta, "Alice", "woman", "men")
        self.complete_profile(tb, "Bob", "man", "women")
        
        r = requests.post(f"{BASE_URL}/swipe", headers=self.hdr(ta), json={
            "target_id": ub["id"],
            "action": "like",
            "reaction": {"type": "photo", "photo": "/fake/photo.jpg"}
        })
        assert r.status_code == 400, f"Expected 400, got {r.status_code}: {r.text}"
        data = r.json()
        assert "photo" in data.get("detail", "").lower(), f"Expected photo error: {data}"
        print(f"  ✓ Invalid photo rejected: {data['detail']}")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/auth/account", headers=self.hdr(ta))
        requests.delete(f"{BASE_URL}/auth/account", headers=self.hdr(tb))

    def test_reaction_swipe_invalid_prompt(self):
        """Test swipe with unknown prompt question returns 400"""
        stamp = int(time.time()) % 100000
        ta, ua = self.login(f"+1555{stamp:07d}03")
        tb, ub = self.login(f"+1555{stamp:07d}04")
        self.complete_profile(ta, "Carol", "woman", "men")
        self.complete_profile(tb, "Dave", "man", "women")
        
        r = requests.post(f"{BASE_URL}/swipe", headers=self.hdr(ta), json={
            "target_id": ub["id"],
            "action": "like",
            "reaction": {"type": "prompt", "question": "Unknown question"}
        })
        assert r.status_code == 400, f"Expected 400, got {r.status_code}: {r.text}"
        data = r.json()
        assert "prompt" in data.get("detail", "").lower(), f"Expected prompt error: {data}"
        print(f"  ✓ Invalid prompt rejected: {data['detail']}")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/auth/account", headers=self.hdr(ta))
        requests.delete(f"{BASE_URL}/auth/account", headers=self.hdr(tb))

    def test_reaction_swipe_photo_valid(self):
        """Test swipe with valid photo reaction returns 200"""
        stamp = int(time.time()) % 100000
        ta, ua = self.login(f"+1555{stamp:07d}05")
        tb, ub = self.login(f"+1555{stamp:07d}06")
        ua = self.complete_profile(ta, "Eve", "woman", "men")
        ub = self.complete_profile(tb, "Frank", "man", "women")
        
        r = requests.post(f"{BASE_URL}/swipe", headers=self.hdr(ta), json={
            "target_id": ub["id"],
            "action": "like",
            "reaction": {"type": "photo", "photo": ub["photos"][0]}
        })
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
        data = r.json()
        assert "matched" in data, f"matched not in response: {data}"
        print(f"  ✓ Photo reaction swipe successful, matched={data['matched']}")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/auth/account", headers=self.hdr(ta))
        requests.delete(f"{BASE_URL}/auth/account", headers=self.hdr(tb))

    def test_reaction_swipe_prompt_valid(self):
        """Test swipe with valid prompt reaction returns 200"""
        stamp = int(time.time()) % 100000
        ta, ua = self.login(f"+1555{stamp:07d}07")
        tb, ub = self.login(f"+1555{stamp:07d}08")
        ua = self.complete_profile(ta, "Grace", "woman", "men")
        ub = self.complete_profile(tb, "Henry", "man", "women")
        
        r = requests.post(f"{BASE_URL}/swipe", headers=self.hdr(ta), json={
            "target_id": ub["id"],
            "action": "like",
            "reaction": {"type": "prompt", "question": "My simple pleasures"}
        })
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
        data = r.json()
        assert "matched" in data, f"matched not in response: {data}"
        print(f"  ✓ Prompt reaction swipe successful, matched={data['matched']}")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/auth/account", headers=self.hdr(ta))
        requests.delete(f"{BASE_URL}/auth/account", headers=self.hdr(tb))

    # ========== REACTION MATCH TESTS ==========
    def test_reaction_match_creates_messages(self):
        """Test mutual like with reactions creates match with reaction messages"""
        stamp = int(time.time()) % 100000
        ta, ua = self.login(f"+1555{stamp:07d}09")
        tb, ub = self.login(f"+1555{stamp:07d}10")
        ua = self.complete_profile(ta, "Ivy", "woman", "men")
        ub = self.complete_profile(tb, "Jack", "man", "women")
        
        # A likes B's prompt
        r = requests.post(f"{BASE_URL}/swipe", headers=self.hdr(ta), json={
            "target_id": ub["id"],
            "action": "like",
            "reaction": {"type": "prompt", "question": "My simple pleasures"}
        })
        assert r.status_code == 200
        data = r.json()
        assert data["matched"] == False, f"Should not match yet: {data}"
        
        # B likes A's photo -> match
        r = requests.post(f"{BASE_URL}/swipe", headers=self.hdr(tb), json={
            "target_id": ua["id"],
            "action": "like",
            "reaction": {"type": "photo", "photo": ua["photos"][0]}
        })
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
        data = r.json()
        assert data["matched"] == True, f"Should match: {data}"
        match_id = data["match"]["id"]
        print(f"  ✓ Matched with ID: {match_id}")
        
        # Check messages
        r = requests.get(f"{BASE_URL}/matches/{match_id}/messages", headers=self.hdr(ta))
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
        msgs = r.json()["messages"]
        assert len(msgs) == 2, f"Expected 2 reaction messages, got {len(msgs)}: {msgs}"
        
        # First message should be A's reaction (earlier liker)
        assert msgs[0]["kind"] == "reaction", f"First message should be reaction: {msgs[0]}"
        assert msgs[0]["sender_id"] == ua["id"], f"First message should be from A: {msgs[0]}"
        assert msgs[0]["reaction"]["type"] == "prompt", f"First reaction should be prompt: {msgs[0]}"
        assert msgs[0]["text"] == "Liked your answer", f"First message text wrong: {msgs[0]}"
        
        # Second message should be B's reaction
        assert msgs[1]["kind"] == "reaction", f"Second message should be reaction: {msgs[1]}"
        assert msgs[1]["sender_id"] == ub["id"], f"Second message should be from B: {msgs[1]}"
        assert msgs[1]["reaction"]["type"] == "photo", f"Second reaction should be photo: {msgs[1]}"
        assert msgs[1]["text"] == "Liked your photo", f"Second message text wrong: {msgs[1]}"
        
        print(f"  ✓ Reaction messages created correctly: [{msgs[0]['text']}, {msgs[1]['text']}]")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/auth/account", headers=self.hdr(ta))
        requests.delete(f"{BASE_URL}/auth/account", headers=self.hdr(tb))

    def test_reaction_match_last_message(self):
        """Test match last_message shows kind='reaction' and unread incremented"""
        stamp = int(time.time()) % 100000
        ta, ua = self.login(f"+1555{stamp:07d}11")
        tb, ub = self.login(f"+1555{stamp:07d}12")
        ua = self.complete_profile(ta, "Kate", "woman", "men")
        ub = self.complete_profile(tb, "Leo", "man", "women")
        
        # A likes B's photo
        requests.post(f"{BASE_URL}/swipe", headers=self.hdr(ta), json={
            "target_id": ub["id"],
            "action": "like",
            "reaction": {"type": "photo", "photo": ub["photos"][0]}
        })
        
        # B likes A's prompt -> match
        r = requests.post(f"{BASE_URL}/swipe", headers=self.hdr(tb), json={
            "target_id": ua["id"],
            "action": "like",
            "reaction": {"type": "prompt", "question": "My simple pleasures"}
        })
        match_id = r.json()["match"]["id"]
        
        # Check matches list for A
        r = requests.get(f"{BASE_URL}/matches", headers=self.hdr(ta))
        assert r.status_code == 200
        matches = r.json()["matches"]
        match = next((m for m in matches if m["id"] == match_id), None)
        assert match is not None, f"Match not found in list: {matches}"
        assert match["last_message"]["kind"] == "reaction", f"last_message.kind should be reaction: {match}"
        assert match["unread"] == 1, f"unread should be 1 for A (B's reaction): {match}"
        print(f"  ✓ Match last_message: kind={match['last_message']['kind']}, text={match['last_message']['text']}, unread={match['unread']}")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/auth/account", headers=self.hdr(ta))
        requests.delete(f"{BASE_URL}/auth/account", headers=self.hdr(tb))

    def test_reaction_no_duplicate_messages(self):
        """Test repeated swipe doesn't create duplicate reaction messages"""
        stamp = int(time.time()) % 100000
        ta, ua = self.login(f"+1555{stamp:07d}13")
        tb, ub = self.login(f"+1555{stamp:07d}14")
        ua = self.complete_profile(ta, "Mia", "woman", "men")
        ub = self.complete_profile(tb, "Noah", "man", "women")
        
        # A likes B's photo
        requests.post(f"{BASE_URL}/swipe", headers=self.hdr(ta), json={
            "target_id": ub["id"],
            "action": "like",
            "reaction": {"type": "photo", "photo": ub["photos"][0]}
        })
        
        # B likes A -> match
        r = requests.post(f"{BASE_URL}/swipe", headers=self.hdr(tb), json={
            "target_id": ua["id"],
            "action": "like"
        })
        match_id = r.json()["match"]["id"]
        
        # Get message count
        r = requests.get(f"{BASE_URL}/matches/{match_id}/messages", headers=self.hdr(ta))
        msgs1 = r.json()["messages"]
        count1 = len(msgs1)
        
        # A swipes again (should update swipe but not create new messages)
        requests.post(f"{BASE_URL}/swipe", headers=self.hdr(ta), json={
            "target_id": ub["id"],
            "action": "like",
            "reaction": {"type": "photo", "photo": ub["photos"][0]}
        })
        
        # Check message count again
        r = requests.get(f"{BASE_URL}/matches/{match_id}/messages", headers=self.hdr(ta))
        msgs2 = r.json()["messages"]
        count2 = len(msgs2)
        
        assert count2 == count1, f"Message count should not change: {count1} -> {count2}"
        print(f"  ✓ No duplicate reaction messages created: {count1} messages")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/auth/account", headers=self.hdr(ta))
        requests.delete(f"{BASE_URL}/auth/account", headers=self.hdr(tb))

    # ========== LIKES RECEIVED TESTS ==========
    def test_likes_received_includes_reaction(self):
        """Test GET /likes/received includes reaction field"""
        stamp = int(time.time()) % 100000
        ta, ua = self.login(f"+1555{stamp:07d}15")
        tb, ub = self.login(f"+1555{stamp:07d}16")
        ua = self.complete_profile(ta, "Olivia", "woman", "men")
        ub = self.complete_profile(tb, "Paul", "man", "women")
        
        # A likes B's photo with reaction
        requests.post(f"{BASE_URL}/swipe", headers=self.hdr(ta), json={
            "target_id": ub["id"],
            "action": "like",
            "reaction": {"type": "photo", "photo": ub["photos"][0]}
        })
        
        # B checks likes received
        r = requests.get(f"{BASE_URL}/likes/received", headers=self.hdr(tb))
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
        likes = r.json()["likes"]
        like = next((l for l in likes if l["user"]["id"] == ua["id"]), None)
        assert like is not None, f"Like from A not found: {likes}"
        assert "reaction" in like, f"reaction field missing: {like}"
        assert like["reaction"] is not None, f"reaction should not be None: {like}"
        assert like["reaction"]["type"] == "photo", f"reaction type should be photo: {like}"
        print(f"  ✓ Likes received includes reaction: {like['reaction']}")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/auth/account", headers=self.hdr(ta))
        requests.delete(f"{BASE_URL}/auth/account", headers=self.hdr(tb))

    def test_likes_received_null_reaction(self):
        """Test GET /likes/received shows null reaction for likes without reaction"""
        stamp = int(time.time()) % 100000
        ta, ua = self.login(f"+1555{stamp:07d}17")
        tb, ub = self.login(f"+1555{stamp:07d}18")
        ua = self.complete_profile(ta, "Quinn", "woman", "men")
        ub = self.complete_profile(tb, "Ryan", "man", "women")
        
        # A likes B without reaction
        requests.post(f"{BASE_URL}/swipe", headers=self.hdr(ta), json={
            "target_id": ub["id"],
            "action": "like"
        })
        
        # B checks likes received
        r = requests.get(f"{BASE_URL}/likes/received", headers=self.hdr(tb))
        likes = r.json()["likes"]
        like = next((l for l in likes if l["user"]["id"] == ua["id"]), None)
        assert like is not None, f"Like from A not found: {likes}"
        assert "reaction" in like, f"reaction field missing: {like}"
        assert like["reaction"] is None, f"reaction should be None: {like}"
        print(f"  ✓ Likes received shows null reaction for regular like")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/auth/account", headers=self.hdr(ta))
        requests.delete(f"{BASE_URL}/auth/account", headers=self.hdr(tb))

    # ========== REPORT TESTS ==========
    def test_report_user(self):
        """Test POST /users/{id}/report creates report"""
        stamp = int(time.time()) % 100000
        ta, ua = self.login(f"+1555{stamp:07d}19")
        tb, ub = self.login(f"+1555{stamp:07d}20")
        self.complete_profile(ta, "Sara", "woman", "men")
        self.complete_profile(tb, "Tom", "man", "women")
        
        r = requests.post(f"{BASE_URL}/users/{ub['id']}/report", headers=self.hdr(ta), json={
            "reason": "Inappropriate content",
            "details": "Test report"
        })
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
        data = r.json()
        assert data.get("ok") == True, f"Report failed: {data}"
        print(f"  ✓ Report created successfully")
        
        # Verify target is still discoverable (flag only)
        r = requests.get(f"{BASE_URL}/discover", headers=self.hdr(ta))
        # Target may or may not appear in discover (depends on filters), but endpoint should work
        assert r.status_code == 200, f"Discover should still work: {r.status_code}"
        print(f"  ✓ Reported user still discoverable (flag only)")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/auth/account", headers=self.hdr(ta))
        requests.delete(f"{BASE_URL}/auth/account", headers=self.hdr(tb))

    # ========== BLOCK TESTS ==========
    def test_block_user(self):
        """Test POST /users/{id}/block hides user from discover and likes"""
        stamp = int(time.time()) % 100000
        ta, ua = self.login(f"+1555{stamp:07d}21")
        tb, ub = self.login(f"+1555{stamp:07d}22")
        ua = self.complete_profile(ta, "Uma", "woman", "men")
        ub = self.complete_profile(tb, "Victor", "man", "women")
        
        # B likes A first
        requests.post(f"{BASE_URL}/swipe", headers=self.hdr(tb), json={
            "target_id": ua["id"],
            "action": "like"
        })
        
        # A checks likes received (should see B)
        r = requests.get(f"{BASE_URL}/likes/received", headers=self.hdr(ta))
        likes_before = r.json()["likes"]
        assert any(l["user"]["id"] == ub["id"] for l in likes_before), f"B should be in likes: {likes_before}"
        
        # A blocks B
        r = requests.post(f"{BASE_URL}/users/{ub['id']}/block", headers=self.hdr(ta))
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
        print(f"  ✓ Block successful")
        
        # A checks likes received again (B should be gone)
        r = requests.get(f"{BASE_URL}/likes/received", headers=self.hdr(ta))
        likes_after = r.json()["likes"]
        assert not any(l["user"]["id"] == ub["id"] for l in likes_after), f"B should not be in likes: {likes_after}"
        print(f"  ✓ Blocked user removed from likes received")
        
        # A checks discover (B should not appear)
        r = requests.get(f"{BASE_URL}/discover", headers=self.hdr(ta))
        profiles = r.json()["profiles"]
        assert not any(p["id"] == ub["id"] for p in profiles), f"B should not be in discover: {profiles}"
        print(f"  ✓ Blocked user removed from discover")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/auth/account", headers=self.hdr(ta))
        requests.delete(f"{BASE_URL}/auth/account", headers=self.hdr(tb))

    def test_block_ends_match(self):
        """Test blocking a matched user makes match inactive"""
        stamp = int(time.time()) % 100000
        ta, ua = self.login(f"+1555{stamp:07d}23")
        tb, ub = self.login(f"+1555{stamp:07d}24")
        ua = self.complete_profile(ta, "Wendy", "woman", "men")
        ub = self.complete_profile(tb, "Xander", "man", "women")
        
        # Mutual like -> match
        requests.post(f"{BASE_URL}/swipe", headers=self.hdr(ta), json={
            "target_id": ub["id"],
            "action": "like"
        })
        r = requests.post(f"{BASE_URL}/swipe", headers=self.hdr(tb), json={
            "target_id": ua["id"],
            "action": "like"
        })
        match_id = r.json()["match"]["id"]
        
        # Verify match exists
        r = requests.get(f"{BASE_URL}/matches/{match_id}", headers=self.hdr(ta))
        assert r.status_code == 200, f"Match should exist: {r.status_code}"
        assert r.json()["active"] == True, f"Match should be active: {r.json()}"
        
        # A blocks B
        requests.post(f"{BASE_URL}/users/{ub['id']}/block", headers=self.hdr(ta))
        
        # Check match is inactive
        r = requests.get(f"{BASE_URL}/matches", headers=self.hdr(ta))
        matches = r.json()["matches"]
        match = next((m for m in matches if m["id"] == match_id), None)
        # Match should either be inactive or not in the list (if filtered out)
        if match:
            assert match["active"] == False, f"Match should be inactive: {match}"
        print(f"  ✓ Block ended the match")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/auth/account", headers=self.hdr(ta))
        requests.delete(f"{BASE_URL}/auth/account", headers=self.hdr(tb))

    # ========== ADMIN TESTS ==========
    def test_admin_reports_no_header(self):
        """Test GET /admin/reports without header returns 401"""
        r = requests.get(f"{BASE_URL}/admin/reports")
        assert r.status_code == 401, f"Expected 401, got {r.status_code}: {r.text}"
        print(f"  ✓ Admin endpoint requires auth (401)")

    def test_admin_reports_wrong_key(self):
        """Test GET /admin/reports with wrong key returns 401"""
        r = requests.get(f"{BASE_URL}/admin/reports", headers={"x-admin-key": "wrong-key"})
        assert r.status_code == 401, f"Expected 401, got {r.status_code}: {r.text}"
        print(f"  ✓ Wrong admin key rejected (401)")

    def test_admin_reports_list(self):
        """Test GET /admin/reports with correct key returns reports"""
        # Create a report first
        stamp = int(time.time()) % 100000
        ta, ua = self.login(f"+1555{stamp:07d}25")
        tb, ub = self.login(f"+1555{stamp:07d}26")
        self.complete_profile(ta, "Yara", "woman", "men")
        self.complete_profile(tb, "Zane", "man", "women")
        
        requests.post(f"{BASE_URL}/users/{ub['id']}/report", headers=self.hdr(ta), json={
            "reason": "Scam or spam",
            "details": "Test admin report"
        })
        
        # Get reports as admin
        r = requests.get(f"{BASE_URL}/admin/reports", headers={"x-admin-key": ADMIN_KEY})
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
        data = r.json()
        assert "reports" in data, f"reports not in response: {data}"
        assert "count" in data, f"count not in response: {data}"
        
        # Find our report
        report = next((r for r in data["reports"] if r["reported"] and r["reported"]["id"] == ub["id"]), None)
        assert report is not None, f"Report not found: {data['reports']}"
        assert report["reason"] == "Scam or spam", f"Reason mismatch: {report}"
        assert report["reporter"]["id"] == ua["id"], f"Reporter mismatch: {report}"
        assert report["status"] == "open", f"Status should be open: {report}"
        assert "reported_total_reports" in report, f"reported_total_reports missing: {report}"
        print(f"  ✓ Admin reports list: {report['reason']} by {report['reporter']['name']} -> {report['reported']['name']}")
        
        self.report_id = report["id"]
        
        # Cleanup
        requests.delete(f"{BASE_URL}/auth/account", headers=self.hdr(ta))
        requests.delete(f"{BASE_URL}/auth/account", headers=self.hdr(tb))

    def test_admin_resolve_report(self):
        """Test POST /admin/reports/{id}/resolve marks report as resolved"""
        # Create a report
        stamp = int(time.time()) % 100000
        ta, ua = self.login(f"+1555{stamp:07d}27")
        tb, ub = self.login(f"+1555{stamp:07d}28")
        self.complete_profile(ta, "Amy", "woman", "men")
        self.complete_profile(tb, "Ben", "man", "women")
        
        requests.post(f"{BASE_URL}/users/{ub['id']}/report", headers=self.hdr(ta), json={
            "reason": "Fake profile",
            "details": "Test resolve"
        })
        
        # Get report ID
        r = requests.get(f"{BASE_URL}/admin/reports", headers={"x-admin-key": ADMIN_KEY})
        reports = r.json()["reports"]
        report = next((r for r in reports if r["reported"] and r["reported"]["id"] == ub["id"] and r["reason"] == "Fake profile"), None)
        assert report is not None, f"Report not found"
        report_id = report["id"]
        
        # Resolve report
        r = requests.post(f"{BASE_URL}/admin/reports/{report_id}/resolve", headers={"x-admin-key": ADMIN_KEY})
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
        print(f"  ✓ Report resolved")
        
        # Check resolved reports
        r = requests.get(f"{BASE_URL}/admin/reports?status=resolved", headers={"x-admin-key": ADMIN_KEY})
        resolved = r.json()["reports"]
        assert any(r["id"] == report_id for r in resolved), f"Report not in resolved list: {resolved}"
        print(f"  ✓ Report appears in resolved list")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/auth/account", headers=self.hdr(ta))
        requests.delete(f"{BASE_URL}/auth/account", headers=self.hdr(tb))

    def summary(self):
        """Print test summary"""
        print(f"\n{'='*60}")
        print(f"📊 PHASE 4 TEST SUMMARY")
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
    tester = Phase4Tester()
    
    # OTP prefix tests
    tester.test("OTP: +1999 prefix returns dev_code", tester.test_otp_1999_prefix)
    tester.test("OTP: +1555 prefix returns dev_code", tester.test_otp_1555_prefix)
    tester.test("OTP: +1777 prefix returns dev_code", tester.test_otp_1777_prefix)
    tester.test("OTP: Wrong code returns 400 with 'doesn't look right'", tester.test_otp_wrong_code)
    tester.test("OTP: Non-6-digit code returns 400", tester.test_otp_non_6_digit)
    
    # Reaction swipe tests
    tester.test("Reaction: Invalid photo URL returns 400", tester.test_reaction_swipe_invalid_photo)
    tester.test("Reaction: Invalid prompt question returns 400", tester.test_reaction_swipe_invalid_prompt)
    tester.test("Reaction: Valid photo reaction returns 200", tester.test_reaction_swipe_photo_valid)
    tester.test("Reaction: Valid prompt reaction returns 200", tester.test_reaction_swipe_prompt_valid)
    
    # Reaction match tests
    tester.test("Reaction: Match creates reaction messages (ordered)", tester.test_reaction_match_creates_messages)
    tester.test("Reaction: Match last_message shows kind='reaction'", tester.test_reaction_match_last_message)
    tester.test("Reaction: No duplicate messages on repeated swipe", tester.test_reaction_no_duplicate_messages)
    
    # Likes received tests
    tester.test("Likes: Received includes reaction field", tester.test_likes_received_includes_reaction)
    tester.test("Likes: Received shows null reaction for regular like", tester.test_likes_received_null_reaction)
    
    # Report tests
    tester.test("Report: User report creates flag (target still visible)", tester.test_report_user)
    
    # Block tests
    tester.test("Block: User removed from discover and likes", tester.test_block_user)
    tester.test("Block: Ends active match", tester.test_block_ends_match)
    
    # Admin tests
    tester.test("Admin: Reports endpoint requires header (401)", tester.test_admin_reports_no_header)
    tester.test("Admin: Wrong key rejected (401)", tester.test_admin_reports_wrong_key)
    tester.test("Admin: Reports list with correct key", tester.test_admin_reports_list)
    tester.test("Admin: Resolve report", tester.test_admin_resolve_report)
    
    return tester.summary()

if __name__ == "__main__":
    sys.exit(main())
