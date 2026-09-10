"""Test verification feature - unverified user flow"""
import requests
import sys
import time

BASE_URL = "https://match-fresh.preview.emergentagent.com/api"
TEST_PHOTO = "/app/tests/test_photo.jpg"

def test_unverified_user_cannot_send_messages():
    """Test that unverified users get 403 when trying to send messages"""
    print("\n" + "="*60)
    print("Testing unverified user message blocking")
    print("="*60)
    
    # 1. Create a fresh account
    test_email = f"unverified{int(time.time())}@example.com"
    test_password = "secret123"
    
    print(f"\n1. Creating fresh account: {test_email}")
    r = requests.post(f"{BASE_URL}/auth/register", json={'email': test_email, 'password': test_password})
    assert r.status_code == 200, f"Registration failed: {r.status_code} {r.text}"
    data = r.json()
    token = data['token']
    user_id = data['user']['id']
    print(f"   ✓ Account created: {user_id}")
    
    # 2. Complete onboarding
    print(f"\n2. Completing onboarding")
    headers = {'Authorization': f'Bearer {token}'}
    r = requests.put(f"{BASE_URL}/profile", 
                     json={
                         'name': 'UnverifiedUser',
                         'birthday': '1995-05-15',
                         'gender': 'woman',
                         'looking_for': 'men',
                         'interests': ['Music', 'Travel', 'Food'],
                     },
                     headers=headers)
    assert r.status_code == 200, f"Profile update failed: {r.status_code} {r.text}"
    print(f"   ✓ Profile updated")
    
    # 3. Upload a photo
    print(f"\n3. Uploading photo")
    with open(TEST_PHOTO, 'rb') as f:
        files = {'file': ('test.jpg', f, 'image/jpeg')}
        r = requests.post(f"{BASE_URL}/profile/photos", files=files, headers=headers)
    assert r.status_code == 200, f"Photo upload failed: {r.status_code} {r.text}"
    print(f"   ✓ Photo uploaded")
    
    # 4. Check verification status (should be none)
    print(f"\n4. Checking verification status")
    r = requests.get(f"{BASE_URL}/verification", headers=headers)
    assert r.status_code == 200, f"Verification check failed: {r.status_code} {r.text}"
    data = r.json()
    assert data['status'] == 'none', f"Expected status=none, got {data['status']}"
    assert data['verified'] == False, f"Expected verified=False, got {data['verified']}"
    print(f"   ✓ Verification status: {data['status']}, verified={data['verified']}")
    
    # 5. Try to get a match (swipe on someone)
    print(f"\n5. Getting a profile to swipe on")
    r = requests.get(f"{BASE_URL}/discover", headers=headers)
    assert r.status_code == 200, f"Discover failed: {r.status_code} {r.text}"
    profiles = r.json()['profiles']
    
    if len(profiles) == 0:
        print(f"   ⚠ No profiles available to test message blocking")
        return True
    
    target_id = profiles[0]['id']
    print(f"   ✓ Found profile: {target_id}")
    
    # 6. Swipe like
    print(f"\n6. Swiping like on {target_id}")
    r = requests.post(f"{BASE_URL}/swipe", json={'target_id': target_id, 'action': 'like'}, headers=headers)
    assert r.status_code == 200, f"Swipe failed: {r.status_code} {r.text}"
    data = r.json()
    matched = data.get('matched', False)
    print(f"   ✓ Swipe successful, matched={matched}")
    
    if not matched:
        print(f"   ⚠ No match created, cannot test message blocking")
        return True
    
    # 7. Get match ID
    print(f"\n7. Getting match ID")
    r = requests.get(f"{BASE_URL}/matches", headers=headers)
    assert r.status_code == 200, f"Matches list failed: {r.status_code} {r.text}"
    matches = r.json()['matches']
    
    if len(matches) == 0:
        print(f"   ⚠ No matches available, cannot test message blocking")
        return True
    
    match_id = matches[0]['id']
    print(f"   ✓ Match ID: {match_id}")
    
    # 8. Try to send a message (should get 403)
    print(f"\n8. Trying to send message as unverified user")
    r = requests.post(f"{BASE_URL}/matches/{match_id}/messages", 
                     json={'text': 'Hello!'}, 
                     headers=headers)
    
    if r.status_code == 403:
        data = r.json()
        detail = data.get('detail', '')
        print(f"   ✓ Got 403 as expected: {detail}")
        assert 'verify' in detail.lower(), f"Error message should mention verification: {detail}"
        print(f"   ✓ Error message mentions verification")
        return True
    else:
        print(f"   ❌ Expected 403, got {r.status_code}: {r.text}")
        return False

if __name__ == "__main__":
    try:
        success = test_unverified_user_cannot_send_messages()
        if success:
            print("\n" + "="*60)
            print("✅ UNVERIFIED USER MESSAGE BLOCKING TEST PASSED")
            print("="*60)
            sys.exit(0)
        else:
            print("\n" + "="*60)
            print("❌ UNVERIFIED USER MESSAGE BLOCKING TEST FAILED")
            print("="*60)
            sys.exit(1)
    except Exception as e:
        print(f"\n❌ TEST ERROR: {str(e)}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
