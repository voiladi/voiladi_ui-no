"""Quick API check for Phase 4: reaction likes -> match -> first chat message, admin reports."""
import os
import sys
import time
import requests

URL = os.environ.get("BASE_URL", "http://localhost:8001").rstrip("/") + "/api"
ADMIN = os.environ.get("ADMIN_API_KEY", "voiladi-admin-dev-key")


def login(phone):
    r = requests.post(f"{URL}/auth/request-otp", json={"phone": phone}).json()
    r = requests.post(f"{URL}/auth/verify-otp", json={"phone": phone, "code": r["dev_code"]}).json()
    return r["token"], r["user"]


def hdr(t):
    return {"Authorization": f"Bearer {t}"}


def main():
    stamp = int(time.time()) % 100000
    ta, ua = login(f"+1777{stamp:05d}01")
    tb, ub = login(f"+1777{stamp:05d}02")
    for t, name, g, lf in ((ta, "Ava", "woman", "men"), (tb, "Ben", "man", "women")):
        requests.put(f"{URL}/profile", headers=hdr(t), json={
            "name": name, "birthday": "2000-05-05", "gender": g, "looking_for": lf,
            "interests": ["Music", "Coffee", "Travel"],
            "prompts": [{"question": "My simple pleasures", "answer": "Iced coffee at 7am"}], "onboarded": True}).raise_for_status()
        # attach a photo via a seeded photo URL trick: upload a tiny png
        png = bytes.fromhex("89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c6360000002000154a24f5d0000000049454e44ae426082")
        requests.post(f"{URL}/profile/photos", headers=hdr(t), files={"file": ("p.png", png, "image/png")}).raise_for_status()
        requests.put(f"{URL}/profile", headers=hdr(t), json={"onboarded": True}).raise_for_status()

    a = requests.get(f"{URL}/auth/me", headers=hdr(ta)).json()
    b = requests.get(f"{URL}/auth/me", headers=hdr(tb)).json()

    # invalid reaction is rejected
    r = requests.post(f"{URL}/swipe", headers=hdr(ta), json={"target_id": b["id"], "action": "like", "reaction": {"type": "photo", "photo": "/nope.jpg"}})
    assert r.status_code == 400, r.text
    print("invalid reaction rejected ->", r.json()["detail"])

    # A likes B's prompt
    r = requests.post(f"{URL}/swipe", headers=hdr(ta), json={"target_id": b["id"], "action": "like",
                      "reaction": {"type": "prompt", "question": "My simple pleasures"}}).json()
    assert r["matched"] is False
    likes = requests.get(f"{URL}/likes/received", headers=hdr(tb)).json()
    assert likes["likes"][0]["reaction"]["type"] == "prompt", likes
    print("B sees like with reaction:", likes["likes"][0]["reaction"])

    # B likes A's photo -> match with two reaction messages
    r = requests.post(f"{URL}/swipe", headers=hdr(tb), json={"target_id": a["id"], "action": "like",
                      "reaction": {"type": "photo", "photo": a["photos"][0]}}).json()
    assert r["matched"] is True, r
    mid = r["match"]["id"]
    print("matched; their_reaction:", r["match"]["their_reaction"]["type"], "| mine:", r["match"]["reaction"]["type"])
    msgs = requests.get(f"{URL}/matches/{mid}/messages", headers=hdr(ta)).json()["messages"]
    assert len(msgs) == 2, msgs
    assert msgs[0]["kind"] == "reaction" and msgs[0]["sender_id"] == a["id"] and msgs[0]["reaction"]["type"] == "prompt"
    assert msgs[1]["kind"] == "reaction" and msgs[1]["sender_id"] == b["id"] and msgs[1]["reaction"]["type"] == "photo"
    print("first messages:", [(m["text"], m["reaction"]["type"]) for m in msgs])
    m = requests.get(f"{URL}/matches", headers=hdr(ta)).json()
    mv = [x for x in m["matches"] if x["id"] == mid][0]
    assert mv["last_message"]["kind"] == "reaction" and mv["unread"] == 1, mv
    print("match preview:", mv["last_message"]["text"], "| unread for A:", mv["unread"])

    # report + admin
    requests.post(f"{URL}/users/{b['id']}/report", headers=hdr(ta), json={"reason": "Scam or spam", "details": "test"}).raise_for_status()
    r = requests.get(f"{URL}/admin/reports", headers={"x-admin-key": "wrong"})
    assert r.status_code == 401
    r = requests.get(f"{URL}/admin/reports", headers={"x-admin-key": ADMIN}).json()
    rep = [x for x in r["reports"] if x["reported"] and x["reported"]["id"] == b["id"]][0]
    print("admin sees report:", rep["reason"], "by", rep["reporter"]["name"], "->", rep["reported"]["name"], "| status", rep["status"])
    requests.post(f"{URL}/admin/reports/{rep['id']}/resolve", headers={"x-admin-key": ADMIN}).raise_for_status()
    r = requests.get(f"{URL}/admin/reports?status=resolved", headers={"x-admin-key": ADMIN}).json()
    assert any(x["id"] == rep["id"] for x in r["reports"])
    # reported user still discoverable (flag only, no auto-hide): B still in matches for A
    assert requests.get(f"{URL}/matches/{mid}", headers=hdr(ta)).status_code == 200
    print("report is flag-only: match still active. ALL GOOD")

    # cleanup
    for t in (ta, tb):
        requests.delete(f"{URL}/auth/account", headers=hdr(t))


if __name__ == "__main__":
    try:
        main()
    except AssertionError as e:
        print("ASSERTION FAILED:", e)
        sys.exit(1)
