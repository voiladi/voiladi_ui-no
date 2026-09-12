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
  - **Chat media**: **image + video sharing** in chat, with quality caps (720p now; 1080p for Plus later)
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
  - Media delivery that is CDN-cacheable and supports Range streaming
- Security target: strong server + client hardening.
  - **Do not rotate JWT secret yet** (keep sessions) (user decision)
  - Protect against abuse (rate limiting, lockouts), lock down WebView and release signing
  - Secure media access (short-lived signed URLs, view-once deletion)

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
- DM threads stored in **`db.matches`**:
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
- Test report: `/app/test_reports/iteration_23.json`.

---

## Phase 24 — Security hardening (Server + Web + APK) (P0/P1)
**Status: COMPLETED (2026-09-10 19:15 UTC)**

### 24.1 Server hardening (FastAPI)
**Implemented**
- `security.py` middlewares:
  - **Rate limiting** keyed by `CF-Connecting-IP` / `X-Forwarded-For`
  - **Security headers** on API JSON responses (HSTS, nosniff, frame deny, CSP, no-store)
  - **Body size cap**: > 12MB → `413`
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
- Implemented as `security-headers.inc.template` **included per location**.
- `WS_BACKEND_URL` derived during container start for CSP connect-src.

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

## Phase 25 — Chat Media (Images + Video) (P0)
**Status: IN PROGRESS (planned; not implemented yet)**

### 25.1 Binding decisions (user, 2026-09-10)
- **Chat only** (no profile video in this phase).
- **Quality caps:**
  - Everyone: **720p** max
  - Later: **1080p** for Plus members
  - Build as **per-user cap** (e.g. `media_quality_max: 720|1080`) so Plus is just a switch.
- **Video duration:** up to **5 minutes**.
- **Storage:** keep on **Railway disk** for now (`UPLOAD_DIR/media`).
- **Modes:** both
  - **Permanent** media messages
  - **View once** media messages

### 25.2 Constraints to design around
- **Cloudflare Free upload limit** (request body ~100MB): use **chunked uploads**.
- Must support **HTTP Range** for streaming video in iOS Safari.
- Must integrate with existing chat rules:
  - sender must be verified
  - blocks prevent sending
  - unsend deletes media
  - requests flow should still work (first media message creates a request thread)

### 25.3 Backend (FastAPI) — implementation plan
1) **Schema extensions**
   - `users`: add `media_quality_max` (default 720)
   - `messages`: add `kind: 'text'|'reaction'|'media'` and `media` object
     - `media.type: 'image'|'video'`
     - `media.url`, `media.thumb_url`, `media.duration_s`, `media.width`, `media.height`, `media.view_once`, `media.status: 'processing'|'ready'|'failed'`
     - `media.size_bytes`, `media.codec` (video)

2) **Chunked upload endpoints**
   - `POST /api/media/init` → returns `upload_id`, chunk size, max bytes
   - `POST /api/media/chunk` → `{upload_id, index}` + binary chunk
   - `POST /api/media/complete` → validates and schedules processing, returns `media_id`
   - Enforce rate limits and auth (verified users only).

3) **Processing pipeline**
   - **Images:** PIL re-encode and downscale to cap, JPEG/WebP output, EXIF stripped.
   - **Videos:** async **ffmpeg** transcode to MP4 H.264/AAC:
     - 720p cap now
     - 1080p cap later based on user cap
     - `-movflags +faststart` for instant streaming start
     - generate poster frame thumbnail
   - Background job runner:
     - initial: asyncio task queue in the API process
     - later: move to a proper worker if needed

4) **Message lifecycle**
   - Create a chat message with `media.status='processing'` immediately.
   - When ready/failed, emit WS event `message_updated` (or reuse `message` with same id) so UI updates.

5) **Secure serving**
   - Media served via an API endpoint that supports Range:
     - `GET /api/media/{id}` (checks match membership + view-once rules)
     - `GET /api/media/{id}/thumb`
   - **View-once**:
     - Open via **signed short-lived token** (e.g. 60s) → first successful open marks consumed and schedules deletion
   - **Permanent**:
     - cacheable at edge (immutable URLs) where allowed

6) **Deletion rules**
   - Unsend removes the message and deletes the associated files (and thumbs).
   - Deleting a thread deletes any view-once not yet consumed (optional cleanup job).

7) **Rate limiting**
   - Add rules for:
     - media init/chunk/complete
     - video processing concurrency

8) **Dependencies / build**
   - Add **ffmpeg** to the backend Docker image.

### 25.4 Frontend (React) — implementation plan
1) **Composer**
   - Add attach button in ChatRoom.
   - Bottom sheet: pick **Photo** / **Video**, preview, toggle **View once**.

2) **Upload UX**
   - Chunked uploader (progress bar, cancel).
   - Send shows a temporary bubble with progress / “Processing…” state.

3) **Rendering**
   - Image bubble: soft tile preview, tap → full-screen viewer (zoom).
   - Video bubble: poster + duration badge, tap → full-screen player (streaming Range).
   - View-once bubble: shows “View once” pill; after viewing it becomes “Opened” and media is unavailable.

4) **Inbox preview text**
   - Chats list preview shows: “Photo” / “Video” / “View once photo” / “View once video”.

5) **Socket events**
   - Handle `message_updated` to swap processing → ready.

### 25.5 Testing plan
- Backend: chunked upload happy path, oversized chunk rejection, Range streaming, view-once consumption, unsend deletes.
- Frontend: upload progress, rendering, view-once behaviour, request thread integration.

---

## Phase 26 — voiladi.com Web Landing Page (Apple glass) + /login rename (P0)
**Status: COMPLETED (2026-09-10)**

### 26.1 Binding decisions (user)
- Exact replica of the reference mock: pale glass canvas, glass hamburger, "A more human internet." hero,
  frosted App Store / Google Play pills, fanned 3-phone carousel (drag / arrows / dots) with caption + counter,
  frosted right-side menu (About, Features, Safety & Privacy, Help Center, Log in, store pills, footer).
- `voiladi.com/welcome` -> `voiladi.com/login` (old link redirects).
- No creative liberties; no AI features.

### 26.2 Implementation
- `frontend/src/pages/Landing.jsx` + `components/landing/PhoneScreens.jsx`: phones show REAL captures of the live app
  (`public/landing/{explore,chat,likes,profile}.webp`, 390x844 @2x, fresh onboarded account) - re-capture after UI changes (see deploy/README.md).
- `index.css`: `.vo-landing`, `.vo-glass-pill`, `.vo-glass-icon`, `.vo-landing-next`, `.vo-phone*`, `.vo-landing-menu/backdrop` (+ `.dark` variants).
- Routing (`App.js`): `/` = Landing for signed-out browsers (Android shell -> `/login`; signed-in -> app);
  `/login` = Welcome chooser; `/login/email` = email form; `/login/phone` unchanged; `/welcome` -> `/login`; `/auth` -> `/login/email`.
- `Legal.jsx`: added `guidelines` page; About rewritten as a social platform ("A more human internet" - story, vision, mission, values). No "dating" wording anywhere in web copy or meta tags.
- Backend housekeeping: chat-media in-flight chunks now go to the OS temp dir (`MEDIA_TMP_DIR`, default `/tmp/voiladi_media_tmp`);
  finished media still on the Railway volume (`UPLOAD_DIR/media`).

### 26.3 Ambient haze (user, 2026-09-11)
- The landing page's soft light (white glow top, pale blue left, pale rose right) is now painted behind EVERY app screen
  via `#vo-main > *` background-image in index.css (one viewport tall, anchored top; `.dark` variant). No component/font changes.
- Landing phone captures refreshed to `*-v2.webp` to show the haze.

### 26.4 Smooth phone bezels (user, 2026-09-11)
- Phones no longer use transform: scale(); they animate real width and are fully fluid (cqi units via `.vo-phone-slot` container).
  Clip uses mask-image + translateZ(0) so rounded corners stay anti-aliased on rotated frames (Android Chrome fix).

### 26.5 Operator user roster + hard delete (user, 2026-09-11)
- `GET /api/admin/users` (x-admin-key): every real account, newest first (include_seed=true for samples).
- `DELETE /api/admin/users/{id}`: full purge via shared `purge_user()` in routes_auth (also used by self-service delete):
  messages + chat media files, matches (partners get `unmatch`), swipes, blocks, reports, pending uploads, OTP sessions, photos, selfie.
- Deployed; deleted account `paulsamrat678@gmail.com` (+917086948523) on production per owner request.

### 26.6 Profile tab realigned to the owner's reference (2026-09-11)
- Header wrapper identical to Explore/Likes/Chats (`px-[clamp(14px,5cqi,20px)] pt-1`, Brand 40).
- Round 88px avatar + camera badge; name 26px; `@handle · Not verified >` inline; Edit profile pill; full-width Followers / Following / Profile views row.
- Feature pills: Start / Available tomorrow / countdown, Super Likes count, `Coming soon`; sub 'Show stronger interest'. Roomy spacing, page scrolls.
- Landing capture refreshed: profile-v3.webp.

### 26.7 Verification flow rebuilt to the owner's 6 reference screens (2026-09-11)
- `components/verification/VerifyUI.jsx`: FlowPage (bare back chevron + bottom black CTA), FlowTitle/Sub, StatusCircle (neutral/ok/bad), TipsCard, FlowButton.
- `/settings/verification` states: none -> 'Verified profile' intro (Not verified pill, WHAT TO EXPECT, Get verified >); pending -> 'Under review' (Done);
  rejected -> 'Try again' (red X, tips, Try again); approved -> "You're verified!" (green check, Great).
- `/verify` steps: tips ('Verify your identity', Take selfie) -> camera (square frame, shutter; device picker fallback) -> 'Review your photo' (Retake / Use this photo) -> 'Under review'.
- Tokens added: --ok/--ok-soft/--red-soft (+ Tailwind ok, ok-soft, red-soft). Verified end-to-end on preview incl. admin reject/approve.

### 26.8 Live-camera-only verification + APK 1.2.0 (2026-09-11)
- Verify.jsx: removed the gallery/file fallback entirely. getUserMedia denied -> 'Camera access needed' state with Allow camera (re-prompts) + settings hint; unsupported browser -> message.
- Android shell (MainActivity.onPermissionRequest): asks the system CAMERA / RECORD_AUDIO runtime permission first, then grants to the page; REQ_CAMERA result handler. Manifest adds RECORD_AUDIO + MODIFY_AUDIO_SETTINGS (ready for calls).
- APK 1.2.0 (versionCode 3) built with the release keystore -> frontend/public/voiladi.apk + deploy/android/voiladi-1.2.0.apk; deployed.

### 26.9 Camera spinner fix + APK 1.3.0 (2026-09-12)
- Root cause of endless spinner: shells before 1.4 never answer the page's camera request. Web now detects the shell via `VoiladiNative.hasCamera()`
  (nativeSupportsCamera) and shows 'Update the Voiladi app' + Download update (REACT_APP_APK_UPDATE_URL -> Railway host, which old shells open in Chrome).
  getUserMedia also has a 20s timeout -> 'Camera didn't respond' with retry; error name shown small for support.
- Shell 1.3.0 (versionCode 4, UA VoiladiApp/1.4): hasCamera()/shellVersion() bridge, DownloadListener -> system browser, runtime CAMERA/RECORD_AUDIO prompt.
- Dockerfile passes REACT_APP_APK_UPDATE_URL build arg; Railway var set on voiladi-web.

### 26.10 Test bots for chat (2026-09-12)
- `backend/bots.py`: `seed_chats_for(user)` builds a full inbox with the 24 sample profiles (8 convos w/ history + unread, 2 fresh matches,
  3 incoming DM requests, 1 outgoing request, 10 likes); `schedule_bot_reply` makes sample profiles read + type + reply 2-5s after any
  text/media the real person sends (scripted replies, no AI). Hooked into routes_chat.send_message and routes_media complete.
- Admin: `POST/DELETE /api/admin/seed/chats?username=arin`, `POST /api/admin/verifications/{id}/grant` (operator verify override).
- Production: @arin seeded + granted verification so messaging works.

### 26.11 Final chat room UI (owner reference, 2026-09-12)
- Header: bare chevron, 46px avatar with official-tint gradient ring + online dot, 20px bold name, 'Active now' presence, glass Phone / Video (coming-soon notice) / More buttons; frosted header (`.vo-chat-header`).
- Messages: glass 'Today' pill; incoming = frosted white bubbles with 38px avatar on first of group; outgoing = black bubbles; 13.5px time under every bubble, violet double tick (--tick) when read, 'Seen' under last own message; typing bubble with avatar.
- Composer: one transparent glass bar (`.vo-chat-composer`): glossy blue + (photo/video), 'Message...' pill, smile (vibe prompts), image, mic (coming soon) that turns into the black send arrow when typing.
- Composer floats (absolute, z-20) over the message list with see-through glass (white 34%->18%, blur 18px, bright rim + glow); compact 52px bar, flat iOS-blue 40px +, 22px icons; list gets 84px bottom padding.
- Focus/typing expands the field to the full bar (framer width/opacity 220ms): +, smile, image, mic collapse; only the black send arrow remains. Send keeps keyboard focus; collapses on blur when empty.
- Open-at-bottom: instant jump on first render (+ retries while media loads, ResizeObserver keeps pinned); new messages glide down only when already near the bottom (stickToBottom).
- Existing features untouched: media, view-once, long-press actions, requests bar, verify gate, report/block.

### 26.12 Testing
- Testing agent iteration 25: 100% pass (landing render mobile+desktop, carousel, toast, side menu, redirects, auth flows, signed-in redirect).

---

## 3) Next Actions
1) **Change Password (Settings → Account)**
   - Add UI row + backend endpoint to change password (with re-auth).
3) **Move servers to Singapore (Asia)** (optional but biggest speed gain for India)
   - Requires explicit approval + maintenance window to migrate volumes (db + uploads).
4) **Cloudflare WAF / Bot protection rules**
   - Requires a Cloudflare token with additional permissions (Zone Settings/Rules) beyond DNS.
5) **Google Play ready**
   - Produce a signed **AAB** (and/or Play App Signing) pipeline; align versioning.

---

## 4) Success Criteria
- UI matches user references pixel-for-pixel.
- Verified-only DM requests work:
  - Verified user can message any profile → recipient sees in Requests until accepted.
- Chat feels professional:
  - typing + seen + unsend + safety actions
- Chat media works end-to-end:
  - photo + video send, stream, progress, processing state, view-once consumption, unsend delete
  - 720p cap enforced now; design supports 1080p cap later (Plus)
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
- Phase 25: **COMPLETED** (Chat media: images + videos, view-once)
- Phase 26: **COMPLETED** (voiladi.com glass landing page + /login rename)

---

## 6) Future backlog
- P1 Google Play ready (signed AAB)
- P1 iPhone app packaging
- P2 Notification settings
- P2 Unblock list
- P3 Recent searches
- P3 Haptics
- P3 Match expiry nudges
