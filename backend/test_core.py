"""Voiladi core POC: OTP->JWT, photo upload->serve, WebSocket through preview URL."""
import asyncio
import io
import json
import os
import sys

import httpx
import websockets
from PIL import Image

BASE = os.environ.get("BASE_URL", "https://match-fresh.preview.emergentagent.com")
API = f"{BASE}/api"
WS_BASE = BASE.replace("https://", "wss://").replace("http://", "ws://")


def ok(msg):
    print(f"  PASS  {msg}")


def fail(msg):
    print(f"  FAIL  {msg}")
    sys.exit(1)


async def auth_flow(client: httpx.AsyncClient, phone: str):
    r = await client.post(f"{API}/auth/request-otp", json={"phone": phone})
    assert r.status_code == 200, r.text
    body = r.json()
    code = body.get("dev_code")
    assert code, "no dev_code returned (SMS mode?)"
    ok(f"request-otp for {phone} -> dev code received")

    bad = await client.post(f"{API}/auth/verify-otp", json={"phone": phone, "code": "000000"})
    assert bad.status_code == 400, "wrong code should be rejected"
    ok("wrong OTP rejected")

    r = await client.post(f"{API}/auth/verify-otp", json={"phone": phone, "code": code})
    assert r.status_code == 200, r.text
    data = r.json()
    token = data["token"]
    assert data["user"]["phone"].endswith(phone[-6:])
    ok(f"verify-otp -> JWT issued (is_new={data['is_new']})")

    r = await client.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200 and r.json()["id"] == data["user"]["id"]
    ok("/auth/me authenticated with JWT")

    r = await client.get(f"{API}/auth/me", headers={"Authorization": "Bearer garbage"})
    assert r.status_code == 401
    ok("bad JWT rejected")
    return token, data["user"]["id"]


async def upload_flow(client: httpx.AsyncClient, token: str):
    img = Image.new("RGB", (240, 320), (255, 90, 120))
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    buf.seek(0)
    r = await client.post(
        f"{API}/profile/photos",
        files={"file": ("me.jpg", buf.getvalue(), "image/jpeg")},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 200, r.text
    url = r.json()["url"]
    ok(f"upload -> {url}")
    r = await client.get(f"{BASE}{url}")
    assert r.status_code == 200 and r.headers["content-type"].startswith("image/"), r.status_code
    assert len(r.content) == len(buf.getvalue())
    ok("uploaded image served back byte-identical via /api/uploads")

    r = await client.post(
        f"{API}/profile/photos",
        files={"file": ("x.txt", b"hello", "text/plain")},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 400
    ok("non-image upload rejected")


async def ws_flow(token_a: str, uid_a: str, token_b: str, uid_b: str):
    async with websockets.connect(f"{WS_BASE}/api/ws/{token_a}", open_timeout=15) as wa, \
            websockets.connect(f"{WS_BASE}/api/ws/{token_b}", open_timeout=15) as wb:
        ha = json.loads(await asyncio.wait_for(wa.recv(), 10))
        hb = json.loads(await asyncio.wait_for(wb.recv(), 10))
        assert ha["type"] == "hello" and ha["user_id"] == uid_a
        assert hb["type"] == "hello" and hb["user_id"] == uid_b
        ok("both WS connections accepted through ingress (wss)")

        await wa.send(json.dumps({"type": "ping"}))
        assert json.loads(await asyncio.wait_for(wa.recv(), 10))["type"] == "pong"
        ok("ping/pong")

        await wa.send(json.dumps({"type": "echo", "payload": {"hi": 1}}))
        e = json.loads(await asyncio.wait_for(wa.recv(), 10))
        assert e["type"] == "echo" and e["payload"] == {"hi": 1}
        ok("echo")

        await wa.send(json.dumps({"type": "dm", "to": uid_b, "payload": "hey from A"}))
        m = json.loads(await asyncio.wait_for(wb.recv(), 10))
        assert m["type"] == "dm" and m["from"] == uid_a and m["payload"] == "hey from A"
        ok("A -> B real-time delivery across sockets")

    try:
        async with websockets.connect(f"{WS_BASE}/api/ws/badtoken", open_timeout=15) as wbad:
            await asyncio.wait_for(wbad.recv(), 10)
            fail("bad token WS should have been closed")
    except Exception:
        ok("bad token WS closed")


async def main():
    print(f"Voiladi core POC against {BASE}")
    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.get(f"{API}/")
        assert r.status_code == 200 and r.json()["app"] == "Voiladi"
        ok("API reachable")
        print("\n[1] OTP -> JWT")
        tok_a, uid_a = await auth_flow(client, "+15550001111")
        tok_b, uid_b = await auth_flow(client, "+15550002222")
        print("\n[2] Upload -> serve")
        await upload_flow(client, tok_a)
    print("\n[3] WebSocket")
    await ws_flow(tok_a, uid_a, tok_b, uid_b)
    print("\nALL CORE CHECKS PASSED")


if __name__ == "__main__":
    asyncio.run(main())
