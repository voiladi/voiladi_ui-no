# plan.md — Voiladi (Gen‑Z dating app)

## 1) Objectives
- Deliver **Voiladi**: a **mobile-first** dating app for ages **18–30** with:
  - **Account creation + login (Email + Password)**
  - **Phone number + OTP verification**
  - **Profile + photo upload**
  - **Swipe cards** (like/pass + **Voila** superlike quota)
  - **Explore grid** (tabs + global @username search)
  - **Likes** views
  - **Real-time chat** (WebSockets + fallback polling)
  - **Filters** (age/distance/show-me)
  - **Manual selfie verification** (human review) → **black tick** + unlock messaging
  - **Direct messages (DM Requests)**: **verified users can message any profile**; recipient sees it under **Requests** until they reply/accept
- **STRICTLY NO AI RELATED FEATURES** in UX/UI, copy, or flows.
- **Top priority**: **pixel-perfect UI replication** of the user’s provided interface photos / reference boards.
  - No “AI generated” look, no creative liberties.
  - Preserve neumorphic/glass tokens and Apple font stack.
- Production is **env-driven**, hosted on **Railway**, with domain behind **Cloudflare** (fixes Jio).
- Performance target: **Instagram-like perceived speed**
  - Fast first paint (boot splash)
  - Lazy route loading with professional loaders
  - Thumbnail photo delivery + edge caching
  - Reduce India latency where possible (region migration if approved)
- Security target: strong server + client hardening.
  - **Do not rotate JWT secret yet** (keep sessions) (user decision)
  - Protect against abuse (rate limiting, lockouts), lock down WebView and release signing

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
- Therefore the UI must be a **pixel-perfect clone** of the provided photos.

### 9.2 User decisions recorded (binding)
1) **Email + Password is REAL** account creation/login.
   - Phone number + OTP verification is still required.
2) **Replicate every screen in the photos exactly**.
3) Gender not shown in photos but required for matching → minimally added.
4) After tests pass: **deploy to Railway**.

### 9.3 Backend work (FastAPI + MongoDB)
**Status: COMPLETED**
- Auth: register/login, PBKDF2 hashing, phone verify, sparse unique indexes.
- Explore + Likes + Stats, profile view tracking.

### 9.4 Frontend work (React + Tailwind)
**Status: COMPLETED**
- Tokens / typography / radii / components implemented to match photo spec.
- 5-tab bottom nav.
- Full page set implemented.

### 9.5 Testing + verification
**Status: COMPLETED**
- Test reports in `/app/test_reports/iteration_6.json` and later.

---

## Phase 10 — Deploy this Phase 9 build to Railway (P0)
**Status: COMPLETED**
- Deployment steps captured in `/app/deploy/README.md`.

---

## Phase 11 — Profile 1:1 rebuild, Boost, Welcome screen, loading system (P0)
**Status: COMPLETED**
- Profile rebuilt 1:1.
- Real Boost feature.
- Welcome screen exact.
- Loading primitives added.

---

## Phase 12 — Blank-screen bug fix + exact logo + responsive shell evolution
**Status: COMPLETED**
- Removed transform scaling; migrated to fluid responsive layouts.
- Screen transition bug fixed.

---

## Phase 13 — Instagram-style notifications + Notifications page
**Status: COMPLETED**
- Notifications page + backend routes.

---

## Phase 14 — Android APK (P1)
**Status: COMPLETED**
- Native WebView wrapper built via `android-build/build_apk.py`.

---

## Phase 15 — Offline notice, native notifications bridge, native splash
**Status: COMPLETED**

---

## Phase 16 — No-popup feedback: inline states + iOS glass sheets
**Status: COMPLETED**

---

## Phase 17 — Likes + Messages tabs soft-UI rebuild + floating nav
**Status: COMPLETED**

---

## Phase 18 — Explore / Profile / Discover 1:1 from neumorphic mockups + communities
**Status: COMPLETED**

---

## Phase 19 — Fully responsive shell (no transform scaling)
**Status: COMPLETED**

---

## Phase 20 — Usernames + Global Search
**Status: COMPLETED**

---

## Phase 21 — Manual Profile Verification (selfie, human review, black tick)
**Status: COMPLETED**
- Admin verify dashboard.
- Verified badges.
- Unverified chat lock for matches messaging.

---

## Phase 22 — Settings refactor + Verification in Settings + Loading/Offline/Perf + Cloudflare (P0)
**Status: COMPLETED (2026-09-10)**
- Verification moved from Profile card → **Settings > Verification** (Meta-Verified style)
- Settings now has **Account** section with **Email / Phone / Verification**; Email + Phone editable
  - Backend: `PUT /api/auth/email` added (password confirmation for password accounts)
- Professional loading improvements:
  - Boot splash (pre-JS) + route-level lazy loading with Suspense RouteLoader
  - Chunk-load auto-recover (one-shot reload)
- Offline UX improved:
  - Cache last profile locally; on network blip show “Reconnecting…” pill instead of blocking offline screen
- Domain reliability:
  - Cloudflare proxy in front of `voiladi.com` to fix **Jio DNS blocking** of `*.up.railway.app`
- Photo/performance:
  - `logo-mark.png` reduced dramatically + cached
  - Backend `/api/uploads/{file}?w=240|480|800` on-demand variants in `uploads/_thumbs` with immutable caching
  - Frontend `UserPhoto size` → grids/lists/avatars request thumbnails; swipe cards use full

---

## Phase 23 — Direct Messages + Requests tab + Chat polish (P0)
**Status: COMPLETED (2026-09-10 19:15 UTC)**

### 23.1 Direct Messages (DM Requests)
**Binding spec (user decision 2026-09-10):**
- **Anyone verified can message anyone** from their profile.
- Recipient sees the conversation under **Requests** until they reply/accept.

**Backend (implemented)**
- DM threads are stored in **`db.matches`** (no new collection), with:
  - `kind: 'dm' | 'match'` (legacy rows treated as `match`)
  - `status: 'request' | 'active'`
  - `requested_by`, `accepted_at`
- Endpoints:
  - `POST /api/dm/{user_id}` → create/return thread
  - `POST /api/matches/{match_id}/accept` → accept request
  - Replying via `POST /api/matches/{match_id}/messages` auto-accepts
- Rules:
  - Sender must be **verified**
  - Blocks prevent DM
  - Mutual like upgrades existing `dm` → `match`

**Frontend (implemented)**
- ProfileSheet: **Message** button (`data-testid=profile-message-button`) opens/creates chat.
- Chats: added **Requests** tab + request badge + hint text.

### 23.2 Chat polish (visual + UX)
**Implemented**
- Neumorphic chat refresh (soft header controls, raised bubbles, soft input bar).
- Typing indicator + seen ticks.
- Message actions: long-press / context menu on own bubble → **Copy** / **Unsend**.
- Chat safety actions:
  - DM: Delete chat
  - Match: Unmatch
  - Both: Report / Block

### 23.3 Testing
- Test report: `/app/test_reports/iteration_23.json` (post-fix: ended threads 404).

---

## Phase 24 — Security hardening (Server + Web + APK) (P0/P1)
**Status: COMPLETED (2026-09-10 19:15 UTC)**

### 24.1 Server hardening (FastAPI)
**Implemented**
- `security.py` middlewares:
  - **Rate limiting** keyed by `CF-Connecting-IP` / `X-Forwarded-For`
  - **Security headers** on API JSON responses (HSTS, nosniff, frame deny, CSP, no-store)
  - **Body size cap**:  > 12MB → `413`
- Brute force guard:
  - **Account lockout** after **8 wrong passwords in 15 min** → `429`
- Production hygiene:
  - `/api/docs` disabled in prod
- WebSocket auth:
  - New: `/api/ws` then first frame `{type:'auth', token}`
  - Legacy `/api/ws/{token}` kept temporarily for rollout

### 24.2 Web security (nginx)
**Implemented**
- Security headers for the SPA, including CSP + HSTS.
- Implemented as `security-headers.inc.template` **included per location** (nginx drops server-level add_header if location adds its own).

**Outage lesson (recorded)**
- `/docker-entrypoint.d/*.envsh` must be **executable** and end with `.envsh` so nginx entrypoint sources it.
  - Otherwise nginx may crash with `unknown "ws_backend_url" variable`.

### 24.3 APK hardening (Android)
**Implemented**
- **v1.3.0 APK** built and copied to `frontend/public/voiladi.apk`.
- **Release signing**:
  - Uses `android-build/release.env` and `android-build/voiladi-release.keystore` (both gitignored).
  - **Backup required**: losing the keystore prevents in-place updates.
  - Old debug-signed installs cannot update in place (uninstall+reinstall once).
- WebView lockdown:
  - https-only exact-host allow-list: `voiladi.com`, `www.voiladi.com`, `api.voiladi.com`
  - Disable file/content access, disable 3rd-party cookies, disable WebView debugging

### 24.4 Deliverables
- Deployed to Railway + Cloudflare.
- Documentation updates in `/app/deploy/README.md` and `memory/PRD.md`.

---

## 3) Next Actions
1) **Change Password (Settings → Account)**
   - Add UI row + backend endpoint to change password (with re-auth). 
2) **Move servers to Singapore (Asia)** (optional but biggest speed gain for India)
   - Requires explicit approval + maintenance window to migrate volumes (db + uploads).
3) **Cloudflare WAF / Bot protection rules**
   - Requires a Cloudflare token with additional permissions (Zone Settings/Rules) beyond DNS.
4) **Google Play ready**
   - Produce a signed **AAB** (and/or Play App Signing) pipeline; align versioning.

---

## 4) Success Criteria
- UI matches user references pixel-for-pixel.
- Verified-only DM requests work:
  - Verified user can message any profile → recipient sees in Requests until accepted.
- Chat feels professional:
  - typing + seen + unsend + safety actions
- App loads fast on Indian networks:
  - thumbnails + edge caching + reduced first paint
- Security hardened:
  - rate limits, lockouts, security headers, upload/body caps, WebView lockdown, release signing
- No AI-related features.

---

## 5) Status Log
- Phase 1–21: **COMPLETED**
- Phase 22: **COMPLETED** (Settings verification, loading/offline/perf, Cloudflare/Jio fix)
- Phase 23: **COMPLETED** (DM Requests + Requests tab + Chat polish)
- Phase 24: **COMPLETED** (Security hardening server + web + APK)

---

## 6) Future backlog
- P1 Google Play ready (signed AAB)
- P1 iPhone app packaging
- P2 Notification settings
- P2 Unblock list
- P3 Recent searches
- P3 Haptics
- P3 Match expiry nudges
