# Voiladi — PRD / status

Gen-Z dating app (18-30). Phone+OTP auth, onboarding wizard, swipe discovery with compatibility score, likes, mutual matching,
real-time chat (WebSocket + polling fallback), vibe-check prompts & icebreakers (curated, non-AI), filters (age/distance/show me),
Hinge-style reactions (heart a specific photo/prompt -> opens the chat on match), block/report/unmatch, profile edit, preferences,
delete account, admin reports review. Light theme, iPhone-native look (bold Apple-like type, black buttons, hot-pink #FF2D75 accent). NO AI features (user rule).

## Stack
FastAPI + MongoDB (motor) backend at /api (server.py, core.py, content.py, routes_auth/profile/discover/chat/admin.py, ws_manager.py, seed.py)
React 19 + Tailwind + shadcn + framer-motion frontend (src/pages, src/components, src/context, src/hooks)

## Status
- Phase 1 POC: DONE. Phase 2 full app: DONE (2 E2E passes). Phase 4 reactions + safety + admin: DONE (iteration_3: BE 20/21, FE 100%).
- Phase 5 SMS: LIVE via Twilio Verify (service "Voiladi" VA0bb827f7c15e61ad3991dfde111deb9e on the user's Twilio account).
  OTP_PROVIDER auto: twilio_verify | twilio_sms | dev. OTP_TEST_PREFIXES (+1999,+1555,+1777[,+91555 on preview]) -> dev code in-app, no SMS.
  User has NOT yet confirmed receipt on a real phone.
- Phase 6 Railway: LIVE. Project "Voiladi" (id 8174208d-2760-45ad-b6f2-3eb5a645ce42) in workspace "My Projects" (tyleralexisbrown@gmail.com).
  Services: MongoDB, voiladi-api (Dockerfile, volume /data/uploads), voiladi-web (Dockerfile: CRA build -> nginx).
  Custom domain (GoDaddy DNS): https://www.voiladi.com (app), https://api.voiladi.com (API), voiladi.com -> 301 www via GoDaddy forwarding
  (https://voiladi.com TLS pending on GoDaddy side). Railway defaults still work: voiladi-web-production / voiladi-api-production .up.railway.app
  Deployed via `railway up ./backend|./frontend --path-as-root` (see /app/deploy/README.md). 24 demo profiles seeded in prod.
  NOTE: user said "existing project" but the token's account had none, so a new project was created.

## Key decisions
- `profile_complete` (validation) + `onboarded` (explicit finish flag) both required to enter the app / appear in discovery.
- Photos stored on disk at UPLOAD_DIR, served at /api/uploads/{file}. Prod: Railway volume mounted at /data/uploads.
- Compatibility = 20 base + 40 shared interests + 10 prompt overlap + 15 age proximity + 15 distance (deterministic).
- Distance slider max (250) = "Anywhere" (no distance filter).
- Reactions: swipe.reaction {type: photo|prompt, photo|question+answer}; on a NEW match, reaction messages (kind='reaction') are inserted
  in order (earlier liker first) and become last_message; no 'New message' toast for them (match popup covers it).
- Report = flag only (db.reports, status open/resolved, admin reviews via GET /api/admin/reports with x-admin-key). Block = hide + end match.
- Admin endpoints (x-admin-key header = ADMIN_API_KEY env): /api/admin/reports, /resolve, GET/POST/DELETE /api/admin/seed (demo profiles).
- Deployment uses backend/requirements.deploy.txt (lean, pinned) — requirements.txt still holds the dev environment (emergentintegrations etc).
