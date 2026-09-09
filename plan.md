# plan.md — Voiladi (Gen‑Z dating app)

## 1) Objectives
- Deliver **Voiladi**: a **mobile-first**, Apple/Google-grade dating app for ages **18–30** with a **fresh swipe UI**.
- Core v1: **phone OTP auth**, **profile + photo upload**, **swipe + match**, **real-time chat (WS) + fallback**, **vibe-check icebreakers**, **filters (age/distance/gender)**, **deterministic compatibility score**.
- Ensure **no AI** features/copy anywhere.
- Keep deployment **env-driven** (no secrets hardcoded); support Railway hosting.
- **New (post‑V1 scope)**
  - **Reactions** (Hinge-style): heart a specific **photo** or **prompt**; if it becomes a match, it appears as the **first chat message** (system message text like “Liked your photo 📷” / “Liked your answer”). **No comment field**.
  - **Safety everywhere**: expose **Block/Report** UI in Discover/Likes/ProfileSheet; reporting **flags for admin only** (no auto-hide), blocking hides/ends match.
  - **Production OTP**: wire **Twilio** for real SMS codes (user will provide SID/Auth Token/From number).
  - **Railway deployment**: deploy to user’s **existing Railway project**, provision **MongoDB inside Railway**, and configure runtime env vars.

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

### Phase 4 — Reactions + Safety everywhere + Admin review (NEW)
**Goal:** ship Hinge-style reactions and make safety actions consistent across the app, plus an admin-visible reports feed.

**Backend**
1) **Reaction-aware swipe**
   - Extend `POST /api/swipe` to accept optional reaction payload:
     - `reaction_type`: `photo` | `prompt`
     - `reaction_ref`: string (photo URL OR prompt question key)
   - Persist on swipe record (new fields on `swipes` documents).

2) **Match creation emits system message**
   - On mutual like, if either side’s swipe includes a reaction, insert a **system message** as the **first message**:
     - Example text: `Liked your photo 📷` or `Liked your answer` (prompt)
   - Ensure:
     - Message inserted only once per match creation.
     - Works for superlike too.

3) **Admin reports endpoint (read-only)**
   - Add endpoints:
     - `GET /api/admin/reports` (list recent reports)
     - Optional: `GET /api/admin/reports/{id}` (details)
   - Simple auth gate via env var:
     - `ADMIN_API_KEY` header (e.g., `x-admin-key`) or a bearer token.
   - Reporting behaviour stays **flag-only** (no auto-hide).

**Frontend**
1) **Reactions UI**
   - Discover card + ProfileSheet:
     - Add heart button overlays:
       - On active photo: “heart this photo”
       - On each prompt card: “heart this prompt”
   - When tapped:
     - Calls swipe with `action: like` plus reaction payload.

2) **Block/Report everywhere**
   - Surface **Report** + **Block** actions in:
     - Discover ProfileSheet
     - Likes ProfileSheet
   - Keep existing ChatRoom block/report.
   - Report uses existing `ReportDialog` reasons from `/api/meta`.

3) **UX copy + telemetry (non-AI)**
   - Clear copy that reports are private; block ends chat.

**Phase 4 user stories**
1. As a user, I can heart someone’s specific photo or prompt.
2. As a user, if we match, the reaction appears as the first chat message.
3. As a user, I can block/report from anywhere I see a profile.
4. As an operator, I can review incoming reports via a protected admin endpoint.

**Phase 4 testing checkpoint**
- Reaction like → mutual match → verify first message is system reaction.
- Confirm no duplicate system messages.
- Report endpoint creates report; admin list shows it.
- Block from Discover/Likes removes from feed and ends active match.

---

### Phase 5 — Twilio real SMS OTP (NEW)
**Goal:** move from dev OTP hint to real SMS in production.

1) Add Railway env vars:
   - `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`
2) Confirm:
   - DEV mode hidden when Twilio send succeeds.
   - Error handling for Twilio failures (rate limit / invalid number / region).
3) Production safety:
   - Keep resend cooldown + attempts cap.
   - Ensure logs never print OTP codes.

**Phase 5 testing checkpoint**
- Request OTP → verify OTP with real phone.
- Verify fallback behaviour if Twilio fails (should not leak codes in prod).

---

### Phase 6 — Railway Deployment (NEW)
**Goal:** deploy frontend + backend + MongoDB on user’s existing Railway project.

1) **Railway project setup**
   - Use user’s **existing project** (user provides the project name / invites / access as needed).
   - Provision **MongoDB inside Railway** and wire `MONGO_URL` + `DB_NAME`.

2) **Services**
   - Backend service:
     - Start command: `uvicorn server:app --host 0.0.0.0 --port $PORT`
   - Frontend service:
     - Build + serve (Railway Nixpacks / static hosting) with `REACT_APP_BACKEND_URL` pointing to backend URL.

3) **Env var checklist**
   - Backend: `MONGO_URL`, `DB_NAME`, `JWT_SECRET`, `CORS_ORIGINS`, `UPLOAD_DIR` (or Railway volume path), `ADMIN_API_KEY`, Twilio vars.
   - Frontend: `REACT_APP_BACKEND_URL`.

4) **Uploads persistence**
   - Configure Railway **volume** for `UPLOAD_DIR` OR plan move to object storage later.

5) **Smoke test after deploy**
   - OTP → onboarding → upload photo → discover → match → chat.

---

## 3) Next Actions
1) **Phase 4 (IN PROGRESS)**: Implement reactions + safety everywhere + admin reports endpoint.
2) Create/update tests for reactions/match-first-message + block/report UI flows.
3) **Phase 5**: When you share Twilio credentials, enable real SMS and disable dev-code UX in production.
4) **Phase 6**: Deploy to Railway using your existing project + Railway MongoDB.

---

## 4) Success Criteria
- POC script verifies: **OTP→JWT**, **upload→serve**, **WS connect→send/receive** through preview URL.
- V1 supports: onboarding + photos, swipe/match, filters, likes, realtime chat w/ fallback, deterministic compatibility.
- UI is **light-mode, polished**, mobile-first with smooth animations; no AI present.
- Phase 4: reactions are tied to **photo/prompt** and show as **first chat message** on match; block/report accessible everywhere; admin can review reports.
- Phase 5: real OTP is delivered via **Twilio** in production.
- Phase 6: Voiladi deploys on Railway via env vars only, using Railway MongoDB.

---

## 5) Status Log
- **Phase 1 (Core POC)**: COMPLETED — `backend/test_core.py` green.
- **Phase 2 (Full V1: backend + frontend + seed)**: COMPLETED — 2 rounds of E2E testing passed; prompt-editor save bug fixed. Pink brand (#FF2D75) + bold iPhone-style fonts applied per user feedback.
- **Phase 3 (Hardening + deploy readiness)**: PARTIALLY DONE — WS reconnection + offline banner + polling fallback + upload limits already implemented; remaining hardening optional.
- **Phase 4 (Reactions + safety everywhere + admin reports)**: COMPLETED — reaction swipes, first-message-on-match, Likes tags, chat bubbles, Block/Report in Discover+Likes, admin endpoint (x-admin-key). Testing agent iteration_3: backend 20/21 (1 timeout, verified manually), frontend 100%.
- **Phase 5 (Twilio real SMS)**: COMPLETED (pending user real-phone test) — Twilio Verify service 'Voiladi' (VA0bb827f7...) created on user's account; OTP_PROVIDER auto-detect (dev|twilio_verify|twilio_sms); OTP_TEST_PREFIXES=+1999,+1555,+1777,+91555 keep dev codes for seeded/test accounts; Twilio error codes mapped to friendly messages; codes never logged.
- **Phase 6 (Railway deployment)**: COMPLETED — project 'Voiladi' created (token's account had no existing project), MongoDB + voiladi-api (Dockerfile, volume /data/uploads) + voiladi-web (Dockerfile nginx). Live: https://voiladi-web-production.up.railway.app / https://voiladi-api-production.up.railway.app. WS, uploads, OTP, CORS verified on prod; 24 demo profiles seeded via POST /api/admin/seed. Runbook: /app/deploy/README.md. — Railway token received and stored at `/app/deploy/.env.railway` (gitignored). Need Railway project name/access confirmation during execution.
- **Handover**: App live at preview URL, 32 seeded profiles, DEV OTP mode (code shown on screen) until Twilio is enabled.

---

## Phase 7 — Apple/iOS restyle + swipe performance (Status: COMPLETED — iteration_4 frontend 100%; redeployed to Railway)
> **Important:** Keep all existing functionality. This phase is a **UI/UX + performance** overhaul only. **STRICTLY NO AI-related features.**

### Why this phase exists
User rejected the current frontend look as “AI generated” due to:
- Neon pink/orange accents
- Oversized radii everywhere
- Bouncy/spring-heavy motion and popups
- Confetti in match modal
- Rich/verbose toasts
- Lag/stutter while swiping (core interaction)

### Confirmed decisions (user said “Go”)
**Design system**
- Accent: **one deep muted tone** = **deep navy `#2B4C7E`**
  - Use only for links, progress, selected states, compat ring, sent bubbles tint, Voila bolt, active tab tint.
- Hearts/likes active: **black `#1D1D1F`**
- Primary buttons: **black**
- Secondary surfaces: **`#F5F5F7`** fill
- Destructive: **text only** `#D70015` (no loud red fills)
- Neutrals:
  - ink `#1D1D1F`
  - mute `#6E6E73`
  - surface2 `#F5F5F7`
  - line `#E5E5EA`
  - paper `#FFFFFF`

**Typography**
- Fonts: system **SF Pro stack** (`-apple-system`, `BlinkMacSystemFont`, `Inter` fallback)

**Radii (hard constraints)**
- Buttons/inputs: **12px**
- Cards: **16px**
- Sheets/modals/swipe card: **20px**
- Desktop phone frame: **40px**

**Motion (hard constraints)**
- Tween ease-out only, **150–300ms**
- Drag return can be stiff/damped spring **without bounce**
- Remove:
  - confetti
  - spring pop-ins
  - `layoutId` sliding pill indicator (bottom nav)

**Toasts**
- iOS-style: small white blurred banner (top-center)
- No `richColors`
- Remove trivial toasts:
  - “Code sent”
  - “Feed updated”
  - “Passed”
  - “You liked X’s photo/answer”
  - “Welcome back”
  - “Cover photo updated”

**Landing**
- Monochrome line-art SVG illustration (no photos, no gradients)

**Bottom nav**
- Replace black pill with **flat iOS tab bar**:
  - hairline top border
  - icon + label always visible
  - navy active tint

### Swipe lag fixes (P1)
- Remove expensive effects during drag:
  - no `backdrop-blur` inside swipe card layers
- Ensure GPU-friendly transforms:
  - `will-change: transform` on draggable layer
  - tween for stack transitions
- Improve image performance:
  - `decoding="async"` (and optionally `loading="lazy"` where safe)
  - server-side resize/compress on upload:
    - Pillow: max 1280px
    - JPEG quality ~85
    - EXIF transpose
  - so 3–8MB phone photos don’t hit the GPU uncompressed.

### Build fix (P0)
**Current status:** frontend build is **broken** due to Tailwind opacity modifiers applied to CSS-variable colors (e.g. `ring-ink/30`).

**Fix approach:**
- Move palette colors to **hex tokens in `tailwind.config.js`** (or define as `rgb(r g b / <alpha-value>)` compatible tokens) so `.../30` opacity utilities work.
- Avoid `@apply` of `ring-ink/30` when `ink` is a raw `var(--vo-ink)` string.

### Files impacted
- Frontend:
  - `frontend/tailwind.config.js`
  - `frontend/src/index.css`
  - `frontend/src/App.js`
  - `frontend/src/components/ui/sonner.jsx`
  - all `frontend/src/components/*.jsx`
  - all `frontend/src/pages/*.jsx`
- Backend (image resize/compress):
  - `backend/routes_profile.py`
  - `backend/requirements.deploy.txt` (+ Pillow already present)

### Execution order
1) **Unbreak build** (Tailwind token/opacity fix)
2) Apply Apple/iOS tokens across all components and pages
   - remove neon/pink/orange remnants
   - normalize radii
   - adjust typography
3) Replace match modal
   - remove confetti
   - use subtle fade/slide
4) Replace toast system styling + remove trivial toasts
5) Rebuild bottom nav as iOS tab bar (no pill indicator)
6) Swipe performance
   - framer-motion drag tuning + `will-change`
   - reduce expensive overlays
7) Backend image resize/compress on upload
8) **MANDATORY**: run `testing_agent` (frontend) to verify:
   - core UI flows still work
   - swipe lag improved
   - no regressions
9) Redeploy to Railway (web + api)
10) Explain root-domain safety warning options
   - Cloudflare DNS (CNAME flattening) vs GoDaddy forwarding behavior

### Deliverables / acceptance
- UI reads as “Apple/iOS”: clean monochrome, deep navy accent, minimal motion.
- No confetti, no bouncy popups, no neon.
- Toasts are subtle iOS-like banners; fewer notifications.
- Swipe feels smooth on mid-range devices.
- Build passes; deployment stable.
- Testing agent report attached after changes.
