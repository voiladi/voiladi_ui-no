# plan.md — Voiladi (Gen‑Z dating app)

## 1) Objectives
- Deliver **Voiladi**: a **mobile-first** dating app for ages **18–30** with:
  - **Account creation + login (Email + Password)**
  - **Phone number + OTP verification** (required during onboarding, as shown in photos)
  - **Profile + photo upload**
  - **Swipe cards** (like/pass + **Voila** superlike quota)
  - **Explore grid** (tabs: All / Near you / New / Popular)
  - **Likes** (tabs: All / Likes you / You liked)
  - **Real-time chat** (WebSockets + fallback)
  - **Vibe check** prompts / icebreakers
  - **Filters** (location + age + gender preference)
- **STRICTLY NO AI RELATED FEATURES** in UX/UI, copy, or flows.
- **Top priority**: **Phase 9 pixel-perfect UI replication** of the user’s provided interface photos. No “AI generated” redesigns, no creative liberties.
- Keep deployment **env-driven**, production on **Railway**, and preserve **cache-busting** so users see latest builds.

---

## 2) Implementation Steps

### Phase 1 — Core POC (isolation; do not proceed until stable)
**Status: COMPLETED**
- OTP + upload + WS round-trip stable through preview.

---

### Phase 2 — V1 App Development (build full app around proven core)
**Status: COMPLETED**
- Backend: users/profile/swipes/matches/messages/meta/safety.
- Frontend: working React/Tailwind app with onboarding, discover, likes, chats, profile.

---

### Phase 3 — Hardening, UX polish, and deploy readiness
**Status: PARTIALLY DONE**
- WS reconnect/backoff + offline banners + polling fallback.
- Upload limits and server-side image optimisation.

---

### Phase 4 — Reactions + Safety everywhere + Admin review
**Status: COMPLETED**
- Reaction-aware swipes; reaction messages seed chats.
- Block/report surfaced across app; admin reports endpoint.

---

### Phase 5 — Twilio real SMS OTP
**Status: COMPLETED (pending user real-phone test)**
- Twilio Verify supported; DEV codes shown only when provider is dev/test-prefix.

---

### Phase 6 — Railway Deployment
**Status: COMPLETED**
- Backend + Frontend + MongoDB deployed.
- Uploads persisted on volume.

---

### Phase 7 — Apple/iOS restyle + swipe performance
**Status: COMPLETED but REJECTED by user**

---

### Phase 8 — Editorial redesign
**Status: COMPLETED but REJECTED by user**

---

## Phase 9 — Exact UI replication from user’s interface photos (P0)
**Status: COMPLETED (frontend + backend) — compiled, visually verified, and tested**

> **Binding spec:** `/app/design_guidelines.md` (derived 1:1 from the user’s photos). This replaces all previous design directions.

### 9.1 Why this phase exists
- User explicitly demanded: **“Just make as it is I send you now in the interface photos.”**
- User rejected:
  - iOS-style minimal clone
  - Editorial/Magazine redesign
- Therefore the UI must be a **pixel-perfect clone** of the provided photos.

### 9.2 User decisions recorded (binding)
1) **Email + Password is REAL** account creation/login.
   - Phone number + OTP verification is still required (during onboarding, as in the photos).
2) **Replicate every screen in the photos exactly**.
   - Wire real data where possible.
   - Show placeholders where backend feature doesn’t exist (Boost/VOILADI+).
   - “Super Likes” maps to **real Voila quota**.
3) Gender is not shown in the photos during onboarding but is required for matching.
   - Added minimally as a segmented control on the “What’s your name?” step.
   - “Show me” defaults to **Everyone**.
4) After tests pass: **deploy to Railway immediately**.

### 9.3 Backend work (FastAPI + MongoDB)
**Status: COMPLETED**
- Auth:
  - `POST /api/auth/register` and `POST /api/auth/login` implemented.
  - Password hashing uses PBKDF2 (`hashlib.pbkdf2_hmac`) with per-user random salt.
  - Phone attach + verification: `POST /api/auth/verify-phone`.
  - Indexes: sparse unique on `users.email` and `users.phone`.
- Explore + Likes + Stats:
  - `GET /api/explore?tab=all|near|new|popular`
  - `GET /api/likes/sent`
  - `GET /api/likes/received`
  - `GET /api/me/stats` includes UI-aligned fields: followers/following/profile_views + voilas.
- Profile views:
  - Profile view tracking wired (increment when appropriate endpoints are hit).

### 9.4 Frontend work (React + Tailwind)
**Status: COMPLETED (pixel-perfect UI implemented as per photos)**
- Tokens / typography / radii / components implemented to match the photo spec.
- 5-tab bottom nav exactly as photographed.
- Page set rebuilt to match photos:
  - Splash + Welcome pager
  - Signup/Login (email/password)
  - Onboarding: Name+DOB+Gender, Phone, OTP, Photo (skippable), Interests, Notifications, Done
  - Discover, Explore, Likes, Chat list, Chat room
  - Profile, Edit Profile, Filters, Settings, Legal

#### Fixes made during this session (Phase 9 hardening)
- **Frontend build/runtime fixes**
  - `Filters.jsx`: Fixed Babel “Maximum call stack size exceeded” caused by a local component named `Thumb` colliding with Radix `SliderPrimitive.Thumb` under the visual-edits Babel plugin. Renamed to `SliderKnob`.
  - `Chats.jsx`: Fixed `useMemo` dependency warning by memoizing the `matches` array.
  - `index.css`: Hid native date input calendar indicator so only the custom trailing calendar icon appears (as in the reference), while keeping the picker tappable.
  - `PhoneOtp.jsx` / onboarding phone step: Replaced Radix Select country picker with a transparent native `<select>` overlay (keeps the same look) to ensure reliability on phones and in automation; prevents accidental real SMS sends by allowing deterministic selection of test prefixes.

### 9.5 Testing + verification
**Status: COMPLETED**
- Build verification:
  - `esbuild` compilation check passed.
  - CRA/webpack dev server compile is clean (no “Compiled with problems” overlay).
- Visual verification:
  - Screenshot verification performed across the full screen set against the reference boards.
- Automated test report:
  - `/app/test_reports/iteration_6.json`
  - Backend: **45/45 passed (100%)**
  - Frontend: All core flows validated; the single critical onboarding country selector issue was fixed and re-verified end-to-end.
- End-to-end flow re-verified:
  - Signup → onboarding → phone select +1 → test OTP dev code → photo upload → interests → discover.

---

## Phase 10 — Deploy this Phase 9 build to Railway (P0)
**Status: COMPLETED (2026-09-09 17:43 UTC) — voiladi-api 6347754e SUCCESS, voiladi-web cb21775f SUCCESS; https://api.voiladi.com/api/health ok, https://www.voiladi.com serves new build main.d31542e6.js with no-store headers; prod register/login/explore/stats smoke passed**

### 10.1 Deployment steps (per `/app/deploy/README.md`)
1) Load Railway token:
   - `source /app/deploy/.env.railway && export RAILWAY_API_TOKEN RAILWAY_NO_TELEMETRY=1`
2) Deploy:
   - `railway up ./backend  --path-as-root --service voiladi-api --detach`
   - `railway up ./frontend --path-as-root --service voiladi-web --detach`
3) Verify health + smoke:
   - API health: `https://api.voiladi.com/api/health`
   - Web: `https://www.voiladi.com`
   - Confirm env wiring (web points to api domain), login/signup works, onboarding works with test prefixes.

---


---

## Phase 11 — Profile 1:1 rebuild, Boost, Welcome screen, loading system (P0)
**Status: COMPLETED (2026-09-09)**
- Profile screen rebuilt from the user's high-res reference (100px avatar + camera disc, name/tagline/stats column, PROFILE COMPLETION card,
  grey card with Boost / Super Likes / VOILADI+ rows (white icon tiles + white pills), grey card with Account / Privacy & Safety / Preferences / Help & Support).
- REAL Boost: `POST /api/me/boost` (90 min, one per 24h), `/api/me/stats` returns boost_active/boost_until/boost_next_at; boosted users rank first in discover/explore. Live HH:MM:SS countdown pill.
- Bottom nav: 26px icons, 12px labels, plain red dot badges, two-squares Discover icon.
- Global size corrections measured from the boards (inputs 52, chips 42, buttons 16px, icon buttons 40, OTP boxes white+border, dark glass chips on Discover card, white segmented everywhere, hairline dividers on Filters).
- NEW Welcome screen exactly as the user's final reference (logo with two-stroke V, "Connect with people.", blurb, Create new account / Log in, legal line).
- Loading system: Spinner / PageLoader / Skeleton* (components/Loading.jsx), boot splash with spinner, busy buttons keep solid ink with spinner, list skeletons, chat-room spinner, image fade-in, route transitions.
- Fixed dialog overlays (bg-ink/30 did not resolve -> bg-black/45).
- Tests: iteration_7 (BE 47/47, FE 100%), iteration_8 (FE 95%; the 4 flagged items were test-selector mismatches, verified manually).
- Deployed to Railway (voiladi-api + voiladi-web).

## 3) Next Actions
1) ~~Deploy Phase 9 build to Railway~~ DONE.
2) ~~Post-deploy smoke test~~ DONE (API + web). Remaining manual check by user on a real phone:
   - Signup/login
   - Phone OTP verification (test prefix only)
   - Swipe + match
   - Chat send/receive
   - Explore/Likes/Filters/Profile/Settings
3) Monitor caching behaviour (no-store headers + `src/lib/updateCheck.js`) to ensure users see the latest build.

---

## 4) Success Criteria
- UI matches user photos **pixel-for-pixel** across:
  - Splash/Welcome, Auth, Onboarding, Discover, Explore, Likes, Chat, Profile, Filters, Settings.
- Email/password is real; phone OTP verification is required and succeeds.
- Explore/Likes/Profile stats show real data where endpoints exist.
- Boost/VOILADI+ are placeholders; Super Likes reflects real Voila quota.
- No AI-related features or copy anywhere.
- After deploy, users reliably see the latest build (cache-busting verified).

---

## 5) Status Log
- **Phase 1 (Core POC)**: COMPLETED — tests green.
- **Phase 2 (Full V1)**: COMPLETED — E2E working.
- **Phase 3 (Hardening)**: PARTIALLY DONE — WS resilience + upload hardening.
- **Phase 4 (Reactions + safety + admin reports)**: COMPLETED.
- **Phase 5 (Twilio real SMS)**: COMPLETED (pending user real-phone verification).
- **Phase 6 (Railway deployment)**: COMPLETED.
- **Phase 7 (iOS restyle)**: COMPLETED but rejected.
- **Phase 8 (Editorial redesign)**: COMPLETED but rejected.
- **Phase 9 (Exact UI replication from photos)**: **COMPLETED** — compiled, visually verified, tested; critical onboarding country selector issue fixed.
- **Phase 10 (Railway deploy of Phase 9 build)**: **COMPLETED** — live on www.voiladi.com.
- **Phase 11 (Profile 1:1 + Boost + Welcome + loading system)**: **COMPLETED** — redeployed to Railway.

---

## 6) Future backlog
- **P2** Share Preview Card: OpenGraph meta tags + preview image.
- **P2** Install Prompt: Add PWA support / add-to-home-screen.
- **P3** Match Expiry Nudge: reminder if nobody messages within 24 hours.
- **P3** Photo Verification Badge: live selfie to earn verified badge.