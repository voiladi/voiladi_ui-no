# Voiladi — PRD / status

Gen-Z dating app (18-30). REAL email+password accounts (register/login) + mandatory phone OTP verification inside onboarding,
onboarding wizard (name/DOB/gender -> phone -> OTP -> photo (skippable) -> interests -> notifications -> done), swipe discovery
(pass / like / blue-star Voila superlike quota), Explore grid (All / Near you / New / Popular), Likes (All / Likes you / You liked),
real-time chat (WebSocket + polling fallback), curated non-AI icebreakers, Filters (show me / age / distance / interests / goals),
Profile (Followers=likes received, Following=likes sent, Profile views; completion card; Boost + VOILADI+ = STATIC PLACEHOLDERS,
Super Likes = real Voila quota), Edit Profile, Settings (dark mode toggle, red Log Out), block/report/unmatch, delete account, admin reports.
NO AI features (user rule).

## Design (Phase 9, CURRENT, user-approved direction): 1:1 replica of the user's interface photos — see /app/design_guidelines.md
Inter font, white #FFFFFF page, #F2F2F4 surfaces, ink #111111, blue #3478F6 (verified badge / Voila star), red #FF3B30,
black pill buttons, 12px inputs, 16px list cards, 24px discover card, black "V" tile logo + lowercase "voiladi" wordmark,
5-tab bottom nav Discover / Explore / Likes / Chat / Profile. Reference boards are job assets (2 PNGs: 10 onboarding + 8 app screens).
REJECTED by user (do not reintroduce): neon v2, iOS-clone v3, editorial/magazine v4 (Playfair/oxblood), anything "AI generated"-looking.

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

- Phase 7 Apple restyle + swipe perf: DONE (iteration_4 FE 100%). Tokens live in tailwind.config.js (ink, ink2, mute, mute2, surface2, surface3, line,
  tint, tint-dark, tint-soft, danger, online; rounded-btn 12 / card 16 / sheet 20; shadow-soft/card/float) + src/lib/motion.js (EASE, tween, slideX, SETTLE).
  Swipe lag fix: no backdrop-blur inside cards, .vo-gpu drag layer (will-change), tween stack, decoding=async, server-side resize on upload
  (Pillow: EXIF transpose, max 1280px, JPEG q84 / WEBP if alpha, HEIC via pillow-heif). Trivial toasts removed. Redeployed to Railway.

- Phase 8 editorial redesign: DONE (iteration_5 backend 32/32, frontend 100%). New: weekly Voila quota (5, enforced in /swipe), GET /api/me/stats,
  Profile cover + real stats strip, self-updating SPA (lib/updateCheck.js) + no-store index.html. Deployed to Railway.

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

- Phase 9 exact-photo UI + email/password auth: DONE (2026-09-09). Backend: /api/auth/register, /api/auth/login (PBKDF2), /api/auth/verify-phone,
  /api/explore?tab=, /api/likes/sent, /api/likes/received, /api/me/stats (followers/following/profile_views). Frontend fully rewritten
  (pages: Welcome, Signup, Login, PhoneLogin, Onboarding, Discover, Explore, Likes, Chats, ChatRoom, Profile, EditProfile, Filters, Settings, Legal).
  Fixes: Filters.jsx babel recursion (local `Thumb` vs SliderPrimitive.Thumb -> SliderKnob), native date-input icon hidden, country picker is a
  transparent native <select> (data-testid auth-country-select). Testing iteration_6: backend 45/45, frontend all flows pass.
- Phase 10 redeploy of Phase 9 build to Railway: DONE 2026-09-09 17:43 UTC (voiladi-api + voiladi-web SUCCESS). Live: https://www.voiladi.com, https://api.voiladi.com/api/health.
- Phase 11 (2026-09-09): Profile rebuilt 1:1 from the user's hi-res reference; REAL Boost (POST /api/me/boost, 90 min, 1/24h, countdown pill);
  final Welcome screen ("Connect with people.", two-stroke V logo); loading system in components/Loading.jsx (Spinner, PageLoader, Skeleton*, busy buttons
  via aria-busy, image fade-in, route transitions in AppShell). Dialog overlays fixed (bg-black/45). Tests iteration_7 + iteration_8 green. Redeployed to Railway.
- Phase 12 (2026-09-09): iOS blank-screen bug fixed (AnimatePresence exit-wait removed; CSS entrance + ScreenErrorBoundary). Exact PNG logo everywhere + icons.
  Profile 1:1 rebuild (fits 393x852, no scroll). Fit-to-device scaling hook (useFitScale, transform scale 0.78..1). Tests iteration_9/10 green. Redeployed web.
