# plan.md — Voiladi (Gen‑Z social app: “a more human internet”)

## 1) Objectives
- Deliver **Voiladi**: a **mobile-first** Gen‑Z social platform for ages **18–30** with:
  - **Account creation + login (Email + Password)**
  - **Phone number + OTP verification**
  - **Profile + photo upload**
  - **Discover (Feed)**: full-screen vertical **Instagram-style** feed of **Posts** (one per screen, upward snap scroll)
  - **Explore grid** (tabs + global @username search)
  - **Likes** views (people who liked you; legacy matching layer)
  - **Real-time chat** (WebSockets + fallback polling)
  - **Filters** (age/distance/show-me) — still used by matching/search surfaces
  - **Manual selfie verification** (human review) → **black tick** + unlock messaging
  - **Direct messages (DM Requests)**: **verified users can message any profile**; recipient sees it under **Requests** until they reply/accept
  - **Chat media**: **image + video sharing** in chat, with quality caps (720p now; 1080p for Plus later)
  - **Android APK shell** with permissions for **CAMERA/RECORD_AUDIO** and in-place update fallback for old shells
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
**Status: COMPLETED**
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
- Release signing pipeline (keystore gitignored).
- WebView lockdown (https-only allow-list, no file/content access, no 3rd-party cookies, no debugging).

### 24.4 Deliverables
- Deployed to Railway + Cloudflare.
- Documentation updates in `/app/deploy/README.md` and `memory/PRD.md`.

---

## Phase 25 — Chat Media (Images + Video) (P0)
**Status: COMPLETED**
- Chunked uploads + ffmpeg compression + view-once + Range streaming.
- WS `message_updated` swaps processing → ready.

---

## Phase 26 — voiladi.com Web Landing Page (Apple glass) + /login rename (P0)
**Status: COMPLETED (2026-09-10)**
- Landing page exact replica + ambient haze behind every app screen.
- Operator admin endpoints for listing/purging users.
- 6-step verification flow using live camera only.
- Android shell permissions + “Update app” fallback for old shells.
- Final chat UI (floating glass composer) with **outer-glare removed** (no smoke/glow outside the bar).

---

## Phase 27 — Discover Feed (Posts) — Instagram-style vertical feed (P0)
**Status: COMPLETED (2026-09-12) — tests iteration_27, deployed api + web, sample posts seeded on prod**

### 27.1 Binding decisions (user)
- **Discover replaces the swipe-card deck completely.**
- **Posts are real**:
  - Users upload a **photo + caption + location** from a **Profile “+” button**.
  - Feed shows everyone’s posts.
- **UI must match reference exactly**:
  - Full-screen post image/video area (image for v1)
  - White **“Discover”** title top-left
  - Right rail icons (exact):
    - **Heart (pink)** + count
    - **Comment** + count
    - **Share** + count
    - **Bookmark** + count
    - **•••**
  - Bottom-left: avatar, username, verified tick, **Follow** pill, location pin + text, caption.
  - Keep existing floating bottom nav.
- Icon actions:
  - Heart = **like post**
  - Comment = opens **real comments sheet**
  - Share = **send post into a chat** (new message kind **`post`**)
  - Bookmark = **saved posts** list in Profile
  - ••• = **Report / Not interested / Copy link**
- Loading: **Instagram spinner first**, then **grey shimmer skeleton** per post; photo **fades in**.
- Follow: **just button UI + follower count** on profile (no feed filtering).

### 27.2 Backend (FastAPI + MongoDB)
**Goal:** add Posts with likes/saves/comments + feed + moderation/hide.

**Collections**
- `posts`:
  - `id`, `user_id`, `photo_url` (uploads), `caption`, `location`, `created_at`,
  - `like_count`, `comment_count`, `save_count` (denormalised counters)
- `post_likes`: `post_id`, `user_id`, `created_at` (unique index on `(post_id,user_id)`)
- `post_saves`: `post_id`, `user_id`, `created_at` (unique index)
- `post_comments`: `id`, `post_id`, `user_id`, `text`, `created_at` (+ soft delete optional)
- `post_hidden`: `post_id`, `user_id`, `created_at` (Not interested)

**Routes (`routes_posts.py`)**
- `POST   /api/posts` — create post (verified-only optional; or allow all onboarded)
- `GET    /api/feed` — discover feed (exclude hidden; cursor pagination)
- `GET    /api/posts/{id}` — single post (for deep link `/p/:id`)
- `POST   /api/posts/{id}/like` / `DELETE .../like`
- `POST   /api/posts/{id}/save` / `DELETE .../save`
- `GET    /api/posts/{id}/comments` — list comments
- `POST   /api/posts/{id}/comments` — create comment
- `POST   /api/posts/{id}/hide` — Not interested
- `POST   /api/posts/{id}/report` — report post (reuse reports collection or add `post_reports`)
- `DELETE /api/posts/{id}` — delete own post

**Share into chat**
- Add message kind: `kind: "post"` with payload:
  - `post_id`, `post_owner_id`, `post_photo`, `post_caption`, `post_location`, `post_username`
- Endpoint option A (recommended): client sends a normal message `POST /api/matches/{id}/messages` with `kind="post"`.
  - Update `MessageIn` schema to accept `kind` + `post` object.

**Indexes**
- `posts`: `created_at` desc, `user_id`.
- `post_comments`: `post_id` + `created_at`.

**Seed data**
- Admin: `POST /api/admin/seed/posts` (idempotent) to create sample posts for `is_seed` users so feed is not empty.

### 27.3 Frontend (React)
**Routing / screens**
- Rewrite `pages/Discover.jsx` → feed screen (vertical snap):
  - `PostCard` full-screen
  - Right rail buttons + counts
  - Bottom-left author block + Follow
  - Top-left title “Discover”
  - Loading sequence: spinner → skeleton → image fade
- New:
  - `pages/NewPost.jsx` (`/posts/new`) — upload + caption + location
  - `pages/PostView.jsx` (`/p/:id`) — opens single post (from shared message / copy link)
  - `pages/Saved.jsx` (`/saved`) — saved posts list

**Components**
- `CommentsSheet` (Radix/vaul-style sheet): list + composer.
- `ShareSheet`: choose a chat thread and send the post.
- `MoreSheet`: Report / Not interested / Copy link.

**Profile integration**
- Add Profile “+” entry point (exact per reference):
  - Opens `/posts/new`.
- Add Profile menu row → **Saved**.
- Add Posts grid (optional v1.1) or keep minimal: Saved list only.

**Chat integration**
- Update `ChatRoom.jsx` renderer:
  - New bubble type for `m.kind === "post"` → card with image thumbnail + caption + location + “View post”
  - Tap opens `/p/:id`.

### 27.4 Testing plan
- Backend:
  - Create post, fetch feed, pagination, like/unlike, save/unsave, comment create/list, hide removes from feed, delete own post.
  - Share message kind `post` appears in chat history and inbox preview.
- Frontend:
  - Discover opens with spinner, then skeleton, then image fade.
  - Snap-scroll one-by-one behaviour matches reference.
  - Right rail taps update counts.
  - Comments sheet works and persists.
  - Share into chat produces correct post card in chat.
  - Saved list shows bookmarked posts.
- Visual validation:
  - Screenshot comparison against user reference (icons, spacing, typography).

### 27.5 Deploy plan
- Deploy **API + Web** (Railway) after tests.
- Verify Cloudflare caching does not break feed freshness (post images remain immutable; feed JSON no-store or short max-age).

---

## Phase 28 — Voice + Video calls (WebRTC) (P0)
**Status: BLOCKED (waiting on UI mockups from user)**
- Planned: Instagram-style voice/video calling in chat via WebRTC + Cloudflare TURN.
- **Do not implement** until exact incoming/ongoing call UI designs are provided.

---

## 3) Next Actions
1) **Phase 27: Discover Feed (Posts)**
   - Implement backend `routes_posts.py` + DB collections + admin seeding for posts.
   - Rewrite Discover UI to match reference exactly.
   - Add New Post flow from Profile “+”.
   - Add comments/share/save/more sheets.
   - Add chat `kind="post"` rendering.
   - Test + deploy api+web.
2) **Change Password (Settings → Account)**
   - Add UI row + backend endpoint to change password (with re-auth).
3) **Move servers to Singapore (Asia)** (optional but biggest speed gain for India)
   - Requires explicit approval + maintenance window to migrate volumes (db + uploads).
4) **Cloudflare WAF / Bot protection rules**
   - Requires a Cloudflare token with additional permissions (Zone Settings/Rules) beyond DNS.

---

## 4) Success Criteria
- UI matches user references pixel-for-pixel.
- Discover feed behaves like reference:
  - full-screen vertical snap
  - exact icons + placements
  - spinner → shimmer → fade-in
- Posts system works end-to-end:
  - create post, feed, like, comment, save, hide, report, delete
  - saved posts list in profile
  - share post into chat renders a proper post card
- Verified-only DM requests work:
  - Verified user can message any profile → recipient sees in Requests until accepted.
- Chat feels professional:
  - typing + seen + unsend + safety actions + media + post cards
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
- Phase 26: **COMPLETED** (voiladi.com landing + haze + 6-step live camera verification + bots + final chat UI; outer composer glare removed)
- Phase 27: **COMPLETED** (Discover Feed / Posts)
- Phase 28: **BLOCKED** (WebRTC calls pending UI)

---

## 6) Future backlog
- P0 WebRTC voice/video calls UI + integration (after mockups)
- P1 Google Play ready (signed AAB)
- P1 iPhone app packaging
- P2 Admin Reports screen UI (currently API exists; UI at `/admin/verify` can be expanded)
- P2 Community join (from Explore topic sheet → shows on profile)
- P2 Notification settings
- P2 Unblock list
- P3 Recent searches
- P3 Haptics
- P3 Match expiry nudges
