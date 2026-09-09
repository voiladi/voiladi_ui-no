# Voiladi — PRD / status

Gen-Z dating app (18-30). Phone+OTP auth, onboarding wizard, swipe discovery with compatibility score, likes, mutual matching,
real-time chat (WebSocket + polling fallback), vibe-check prompts & icebreakers (curated, non-AI), filters (age/distance/show me),
block/report/unmatch, profile edit, preferences, delete account. Light theme, iPhone-native look (SF Pro / Inter, black buttons, hot-pink accent).

## Stack
FastAPI + MongoDB (motor) backend at /api (server.py, core.py, content.py, routes_*.py, ws_manager.py, seed.py)
React 19 + Tailwind + shadcn + framer-motion frontend (src/pages, src/components, src/context, src/hooks)

## Status
- Phase 1 POC: DONE (test_core.py green: OTP->JWT, upload->serve, WS through ingress)
- Phase 2 full app: BUILT, visually verified. Pending: testing agent E2E pass.
- SMS delivery: MOCKED/dev-mode until Twilio creds provided (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER in backend/.env)
- Deployment target: Railway (user will provide API key). All config via env vars.

## Key decisions
- `profile_complete` (validation) + `onboarded` (explicit finish flag) both required to enter the app / appear in discovery.
- Photos stored on disk at UPLOAD_DIR (/app/backend/uploads), served at /api/uploads/{file}. Railway needs a volume or S3 later.
- Compatibility = 20 base + 40 shared interests + 10 prompt overlap + 15 age proximity + 15 distance (deterministic).
- Distance slider max (250) = "Anywhere" (no distance filter).
