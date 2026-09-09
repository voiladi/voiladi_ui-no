# plan.md — Voiladi (Gen‑Z dating app)

## 1) Objectives
- Deliver **Voiladi**: a **mobile-first**, Apple/Google-grade dating app for ages **18–30** with a **fresh swipe UI**.
- Core v1: **phone OTP auth**, **profile + photo upload**, **swipe + match**, **real-time chat (WS) + fallback**, **vibe-check icebreakers**, **filters (age/distance/gender)**, **deterministic compatibility score**.
- Ensure **no AI** features/copy anywhere.
- Keep deployment **env-driven** for Railway later (no secrets hardcoded).

---

## 2) Implementation Steps

### Phase 1 — Core POC (isolation; do not proceed until stable)
**Goal:** prove the 3 failure-prone flows work through ingress/preview URL.

1) **Best-practice quick webcheck**
   - FastAPI WebSocket behind reverse proxy/ingress (wss), JWT in query/path, CORS, timeouts.
   - FastAPI multipart upload limits + static serving.

2) **Minimal backend endpoints added to `server.py` (POC-only)**
   - OTP: `POST /api/auth/request-otp`, `POST /api/auth/verify-otp` (DEV mode returns `dev_code` when Twilio env missing)
   - Auth: `GET /api/auth/me` (JWT round-trip)
   - Upload: `POST /api/profile/photos` (multipart) + `GET /api/uploads/{file}`
   - WebSocket: `WS /api/ws/{token}` echo + ping/pong + simple “message received” broadcast

3) **1 python script: `backend/test_core.py`**
   - Calls request-otp → verify-otp → uses JWT to call /me
   - Uploads a small image fixture → validates it is retrievable via `/api/uploads/...`
   - Opens WS (wss) → sends message → receives ack/broadcast

4) **Fix until green**
   - Only when OTP + upload + WS are reliable through preview URL, proceed to Phase 2.

**Phase 1 user stories**
1. As a user, I can request an OTP for my phone number and receive a code (DEV hint if no SMS provider).
2. As a user, I can verify OTP and get a JWT that authenticates me.
3. As a user, I can upload a photo from my device and immediately view it back.
4. As a user, I can connect to real-time chat WebSocket and receive a response.
5. As a developer, I can run one script that validates OTP + upload + WS end-to-end.

---

### Phase 2 — V1 App Development (build full app around proven core)
**Backend (FastAPI + MongoDB motor)**
1) **Data models + collections**
   - users, otp_sessions, profiles, swipes, matches, messages, blocks, reports.

2) **Auth & onboarding**
   - OTP flow (Twilio pluggable; DEV mode supported) + JWT middleware/deps.
   - “is_new” user detection; completed_profile flag.

3) **Profile & photos**
   - `PUT /api/profile` update fields (name, birthday 18+ guard, gender, looking_for, bio, interests, prompts, city, lat/lng)
   - Photo management: max 6, reorder/delete, first is main.

4) **Meta content (no AI)**
   - `GET /api/meta` returns curated lists: interests, prompt questions, icebreakers.

5) **Discovery & swiping**
   - `GET /api/discover` applies filters, excludes seen/swiped/blocked/self.
   - Compatibility score: shared interests + prompt category overlap + age proximity + distance.
   - `POST /api/swipe` like/pass/superlike; create match on mutual like.

6) **Matches + messages**
   - REST: list matches w/ last message + unread count; fetch/send/read.
   - WS: push new matches/messages + typing indicator; fallback polling if WS fails.

7) **Safety**
   - block/report/unmatch endpoints.

8) **Seed script (explicit dev tool)**
   - `backend/seed.py` creates ~24 clearly labeled sample profiles (18–30) with lat/lng + interests + prompt answers + placeholder images.

**Frontend (React 19 + Tailwind + shadcn/ui + framer-motion)**
1) App shell: mobile-first, centered “phone frame” on desktop, bottom tabs (Discover/Likes/Chats/Profile).
2) Auth flow: phone → OTP (input-otp, resend timer, DEV code hint) → onboarding wizard.
3) Onboarding wizard: animated stepper (name/birthday/gender/looking_for/photos/bio/interests/prompts/location).
4) Discover: card stack swipe (framer-motion), photo carousel tap, compatibility ring, shared chips, match modal (“It’s a Voila!”).
5) Likes: received likes list/grid; like back → match.
6) Chats: match list + chat room, vibe-check icebreaker chips drawer, typing indicator, toasts/sheets/dialogs.
7) Profile/settings: edit profile, photo manager, preferences, logout, danger zone.
8) Add `data-testid` for key flows.

**Phase 2 user stories**
1. As a new user, I can complete onboarding (incl. photo upload) and land on Discover.
2. As a user, I can swipe like/pass/superlike and never see the same profile again.
3. As a user, I can adjust age/distance/gender filters and the feed updates accordingly.
4. As a user, when we mutually like, I see a match popup and the match appears in Chats.
5. As a user, I can send a chat message and the other user receives it in real time (WS) or via fallback.

**Phase 2 testing checkpoint**
- Run seed → create two test accounts → swipe to match → chat both directions → verify uploads + filters.
- One end-to-end testing pass.

---

### Phase 3 — Hardening, UX polish, and deploy readiness
1) **WS resilience**: reconnect/backoff, offline banners, message dedupe, server heartbeats.
2) **Media hardening**: file type/size limits, thumbnail strategy (optional), cleanup on delete.
3) **Abuse controls**: rate limits on OTP + swipes + messages; basic moderation flags.
4) **Performance**: indexes in Mongo (phone, user_id, match_id, created_at; geospatial index for distance).
5) **Railway prep**: env var checklist + start commands + persistent storage note for uploads (or later S3).
6) **Twilio production wiring** once creds provided (no DEV code in prod).

**Phase 3 user stories**
1. As a user, if my connection drops, chat reconnects automatically without losing messages.
2. As a user, uploads reject unsupported/too-large files with a clear error.
3. As a user, OTP cannot be spammed; I see cooldown timers and helpful messaging.
4. As a user, discovery remains fast and relevant even with many profiles.
5. As an admin/operator, I can deploy to Railway by setting env vars only.

**Phase 3 testing checkpoint**
- Full regression pass: auth, onboarding, swipe/match, chat realtime+fallback, block/report, profile edits.

---

## 3) Next Actions
1) Implement Phase 1 endpoints + `backend/test_core.py` and run until green.
2) Confirm with you: **DEV OTP hint acceptable** until Twilio creds arrive.
3) Build Phase 2 end-to-end (backend + frontend + seed) in minimal large commits.
4) Run E2E test pass and fix UX bugs.

---

## 4) Success Criteria
- POC script verifies: **OTP→JWT**, **upload→serve**, **WS connect→send/receive** through preview URL.
- V1 supports: onboarding + photos, swipe/match, filters, likes, realtime chat w/ fallback, deterministic compatibility.
- UI is **light-mode, polished**, mobile-first with smooth animations; no AI present.
- All config via env vars; Railway deployment ready when key is provided.

---

## 5) Status Log
- **Phase 1 (Core POC)**: COMPLETED — `backend/test_core.py` green.
- **Phase 2 (Full V1: backend + frontend + seed)**: COMPLETED — 2 rounds of E2E testing passed; prompt-editor save bug fixed. Pink brand (#FF2D75) + bold iPhone-style fonts applied per user feedback.
- **Phase 3 (Hardening + Railway)**: NOT STARTED — waiting on user UAT feedback and Railway API key.
- **Handover**: App live at preview URL, 32 seeded profiles, DEV OTP mode (code shown on screen). Awaiting user review.
