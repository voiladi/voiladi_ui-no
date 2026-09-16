# plan.md — Voiladi (Gen‑Z social app: “a more human internet”)

## 1) Objectives
- Deliver **Voiladi**: a **mobile-first** Gen‑Z social platform for ages **18–30** with:
  - **Account creation + login (Email + Password)**
  - **Phone number + OTP verification**
  - **Profile + photo upload**
  - **Discover (Feed)**: full-screen vertical **Instagram/TikTok-style** feed of **Posts** (one per screen, upward snap scroll)
  - **Circle feed**: posts from followed users
  - **Explore grid** (tabs + global @username search + topics/communities)
  - **Likes** views
  - **Real-time chat** (WebSockets + fallback polling)
  - **Filters** (age/distance/show-me) — still used by matching/search surfaces
  - **Manual selfie verification** (human review) → **black tick** + unlock messaging
  - **Direct messages (DM Requests)**: **verified users can message any profile**; recipient sees it under **Requests** until they reply/accept
  - **Chat media**: image + video
  - **Android APK shell** with **edge-to-edge** system bars + native bridge
- **AI Assistant (connected account) + orb visual search**
  - Users can **connect their AI provider** via **ChatGPT Codex OAuth device flow**.
  - Orb ink stroke → capture screen region → send to linked model (vision) → show answer + Voiladi results.
- **Top priority** remains: **pixel-perfect UI replication** of the user’s provided interface photos / reference boards.
  - No “AI generated” look, no creative liberties.
  - Preserve neumorphic/glass tokens and iOS-like spacing/typography.
- Production is **env-driven**, hosted on **Railway**, with domain behind **Cloudflare** (fixes Jio).
- Performance target: **Instagram-like perceived speed**
  - Fast first paint (boot splash)
  - Lazy route loading with professional loaders
  - Thumbnail photo delivery + edge caching
  - Media delivery supports Range streaming
- Security target: strong server + client hardening.
  - Keep existing rate limiting, lockouts, security headers, WebView lockdown, release signing.
  - Sensitive secrets must be **encrypted at rest** and **never returned to clients**.

---

## 2) Implementation Steps

### Phase 1 — Core POC (isolation; do not proceed until stable)
**Status: COMPLETED**

---

### Phase 2 — V1 App Development (build full app around proven core)
**Status: COMPLETED**

---

### Phase 3 — Hardening, UX polish, and deploy readiness
**Status: COMPLETED**

---

### Phase 4 — Reactions + Safety everywhere + Admin review
**Status: COMPLETED**

---

### Phase 5 — Twilio real SMS OTP
**Status: COMPLETED (pending user real-phone test)**

---

### Phase 6 — Railway Deployment
**Status: COMPLETED**

---

### Phase 7 — Apple/iOS restyle + swipe performance
**Status: COMPLETED but REJECTED by user**

---

### Phase 8 — Editorial redesign
**Status: COMPLETED but REJECTED by user**

---

## Phase 9 — Exact UI replication from user’s interface photos (P0)
**Status: COMPLETED (frontend + backend) — compiled, visually verified, and tested**

> **Binding spec:** `/app/design_guidelines.md`

---

## Phase 10 — Deploy this Phase 9 build to Railway (P0)
**Status: COMPLETED**

---

## Phase 11 — Profile 1:1 rebuild, Boost, Welcome screen, loading system (P0)
**Status: COMPLETED**

---

## Phase 12 — Blank-screen bug fix + exact logo + responsive shell evolution
**Status: COMPLETED**

---

## Phase 13 — Instagram-style notifications + Notifications page
**Status: COMPLETED**

---

## Phase 14 — Android APK (P1)
**Status: COMPLETED**

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

---

## Phase 22 — Settings refactor + Verification in Settings + Loading/Offline/Perf + Cloudflare (P0)
**Status: COMPLETED**

---

## Phase 23 — Direct Messages + Requests tab + Chat polish (P0)
**Status: COMPLETED**

---

## Phase 24 — Security hardening (Server + Web + APK) (P0/P1)
**Status: COMPLETED**

---

## Phase 25 — Chat Media (Images + Video) (P0)
**Status: COMPLETED**

---

## Phase 26 — voiladi.com Web Landing Page (Apple glass) + /login rename (P0)
**Status: COMPLETED**

---

## Phase 27 — Discover Feed (Posts) — Instagram/TikTok-style vertical feed (P0)
**Status: COMPLETED — deployed api + web, sample posts seeded, includes photo + video posts + chunked uploads**

---

## Phase 28 — Android Edge-to-Edge + Dark Mode polish + crash hardening (P0)
**Status: COMPLETED**
- Transparent system bars, native insets bridged into CSS tokens.
- Crash loop fixed (InsetsController null deref) with try/catch fallback + CrashReporter.

---

## Phase 29 — Draggable bottom navigation “glass orb” + ink trail (P0)
**Status: COMPLETED**
- Long press detaches orb, draws SVG ink trail, dispatches `window` event `voiladi:ink`.
- **Hold time adjusted:** 0.65s → **0.40s** (`HOLD_MS=400`).

---

## Phase 30 — Connect your AI + Orb Visual Search (NEW, P0)
**Status: COMPLETED**
- Codex OAuth Device Flow for ChatGPT.
- Orb visual search layer + streaming lookup.

---

## Phase 30b — Orb search: identify anything, faster (COMPLETED 2026-09-14)
**Status: COMPLETED + deployed**

---

## Phase 30d — AI Assistant page redesign to the owner's 3 mockups (COMPLETED 2026-09-14)
**Status: COMPLETED + deployed (web)**

---

## Phase 32 — Notifications redesign (All / Requests / Unread, Instagram-Facebook style) (COMPLETED 2026-09-15)
**Status: COMPLETED + deployed (web + api)**

---

## Phase 33 — Phone push notifications via FCM (COMPLETED 2026-09-16, awaiting real-device check)
**Status: COMPLETED + deployed (api + web + APK 1.7.1)**

---

## Phase 34 — Followers / Following sheet + Remove follower (COMPLETED 2026-09-16)
**Status: COMPLETED + deployed (web + api)**
- Followers/Following bottom sheet with search.
- Follow/unfollow from the list.
- **Remove follower** (silent) via `DELETE /api/me/followers/{user_id}`.

---

## Phase 35 — Instagram-style New Post flow (P0)
**Status: COMPLETED + deployed (web + api) — tested iteration_35 (backend 34/35, the miss was a test-setup mismatch; tag notifications verified manually)**

### Shipped
- 3-step flow in `NewPost.jsx`: Pick (X / New post / Next, square preview, Recents + 4-col grid, Camera + Gallery tiles, expand toggle) → Edit (crop pinch/drag, aspect chips, 16 filter presets, 6 adjust sliders; baked with canvas in `lib/imageEdit.js`) → Details (thumb + caption, Add location / Tag people / Advanced settings rows, pinned blue Share).
- New components: `components/post/{CropView,PhotoEditor,TagPeopleSheet,LocationSheet}.jsx`.
- Backend: `tagged`, `hide_likes`, `comments_off` on posts (image + video), `tagged_users` decoration, likes=null for non-owners when hidden, 403 on comments when off, `tag` notification rows + push (kind "tag", pref "likes").
- Feed: "with @user" line on PostCard, hidden like count, comments-off notice in CommentsSheet.

### 35.1 Binding decisions (locked with user)
- Replace the current single-screen `NewPost.jsx` with an **Instagram-style 3-step flow**:
  1) **Picker step**
     - Header: **X** (close), centered **New post**, right **Next**.
     - Body: **large square preview** at top.
     - Bottom: **gallery grid** (recent media), tappable thumbnails.
  2) **Edit step**
     - **Crop** UI: pinch/drag reposition.
     - Toggle: **1:1 ↔ Original (expand)**.
     - **Filters** row + **Adjust** sliders.
     - Must export the final image by baking edits to a canvas and producing a Blob for upload.
  3) **Details step**
     - Row: **small square thumbnail on the left** + **Write a caption…** field to the right.
     - Rows below (chevrons): **Add location**, **Tag people**, **Advanced settings**.
     - Bottom: **full-width blue Share button pinned** above safe-area.

- Additional user request: **“can crop edit etc”** → implement minimal Instagram-like crop + basic filters/adjust now; keep room to expand later.

### 35.2 Frontend (React)
**Rewrite**: `frontend/src/pages/NewPost.jsx`
- Convert into a step-based state machine (Picker → Edit → Details).
- Keep edge-to-edge + safe-bottom correctness.

**New components**
- `frontend/src/components/post/CropView.jsx`
  - Gestures: drag to reposition image, pinch to zoom.
  - Aspect: 1:1 and “Original” toggle.
  - Outputs crop rectangle/transform state.
- `frontend/src/components/post/PhotoEditor.jsx`
  - Filter strip + Adjust sliders (brightness/contrast/saturation/temp as baseline).
  - Feeds parameters into `imageEdit.js` export.
- `frontend/src/components/post/TagPeopleSheet.jsx`
  - Bottom sheet using existing Drawer pattern.
  - Search input → `GET /api/search?q=`.
  - Multi-select users; show selected chips.
  - Produces `tagged: [user_id]`.
- `frontend/src/components/post/LocationSheet.jsx`
  - Bottom sheet with free text input + suggestion list.
  - Suggestions include: current user city + recent typed values (local) + common entries.
- `frontend/src/lib/imageEdit.js`
  - `exportEditedImage({ fileOrImage, crop, filters, adjust, outType, quality }) -> Blob`
  - Uses canvas to apply crop + transforms + filter matrix and returns a new uploadable file.

**Integrations / wiring**
- Update `frontend/src/lib/media.js` `uploadPostVideo(...)` to accept and send new fields:
  - `tagged`, `hide_likes`, `comments_off` (as part of init body)
- Post creation payloads:
  - Image posts: append `tagged`, `hide_likes`, `comments_off` to `FormData`.
  - Video posts: include the same fields in `/posts/video/init`.

### 35.3 Backend (FastAPI)
Update: `backend/routes_posts.py`
- Extend post schema with:
  - `tagged: [user_id]` (default `[]`)
  - `hide_likes: bool` (default `False`)
  - `comments_off: bool` (default `False`)
- Apply to **both** image and video posts:
  - `POST /api/posts` (multipart): accept these fields via `Form(...)`.
  - `POST /api/posts/video/init`: accept in `VideoInitIn`.
  - Ensure persisted into the `posts` document.

Decorators / serializers
- Extend `_decorate(...)` to include:
  - `tagged_users`: public profiles of tagged ids (limited list)
  - Preserve `tagged` raw ids if needed for edit screens (or omit and only return `tagged_users`).

Comments enforcement
- If `comments_off` is true:
  - Block `POST /api/posts/{post_id}/comments` (return 403/400 with clear message).

Likes privacy
- If `hide_likes` is true:
  - Return likes count as 0 or `null` to non-owners (final behavior to match Instagram-style privacy).
  - Owner still sees accurate count.

### 35.4 Feed UI impact
Update:
- `frontend/src/components/feed/PostCard.jsx`
  - Display a “tagged” line or compact tagged indicator if `tagged_users` is present.
  - Respect `hide_likes` by hiding or neutralizing the like count in the rail (Instagram-style).
- `frontend/src/components/feed/PostSheets.jsx`
  - Comments sheet and composer should be disabled/hidden when `comments_off` is true.

### 35.5 Testing plan
- Frontend:
  - Picker grid loads + selecting updates preview.
  - Edit step: crop gestures + aspect toggle work; exported blob uploads successfully.
  - Tag people sheet: search, select/deselect, persists into Details.
  - Advanced settings: toggles for hide likes / comments off reflect in created post.
  - Share button pinned; safe-area correct on small Android devices.
- Backend:
  - Create image post with new fields.
  - Create video post init with new fields.
  - Comments blocked when `comments_off`.
  - Decorator returns `tagged_users` and applies hide-likes behavior.

---

## Phase 31 — Voice + Video calls (WebRTC) (P0)
**Status: BLOCKED (waiting on UI mockups from user)**
- Do not implement until incoming/ongoing call UI is provided.

---

## 3) Next Actions
1) **Phase 35: Instagram-style New Post flow (P0)**
   - Implement Picker → Edit → Details.
   - Add tagging + advanced settings.
   - Add backend fields + enforce comments_off/hide_likes.
   - Update feed/comment UI to respect privacy toggles.
   - Test and deploy.
2) **Phase 31: WebRTC voice/video calls** (blocked)
   - Wait for user UI mockups.
3) **Move servers to Singapore (Asia)** (optional biggest speed gain for India)
   - Requires explicit approval + maintenance window.
4) **Admin Reports screen UI** (expand `/admin/verify`).

---

## 4) Success Criteria
- UI matches user references pixel-for-pixel.
- New Post flow:
  - 3-step Instagram-style flow is accurate (header, grid, edit controls, pinned Share).
  - Crop + filter export produces the exact uploaded media.
  - Tag people + location + advanced settings work end-to-end.
- Privacy controls:
  - `hide_likes` respected in feed UI and API responses.
  - `comments_off` fully blocks new comments and disables UI affordances.
- No regressions to Discover feed, chat, explore, edge-to-edge shell.

---

## 5) Status Log
- Phase 1–29: **COMPLETED**
- Phase 30 / 30b / 30d: **COMPLETED**
- Phase 32: **COMPLETED**
- Phase 33: **COMPLETED** (needs on-device confirmation)
- Phase 34 (Followers/Following + Remove follower): **COMPLETED**
- Phase 35 (Instagram-style New Post flow): **COMPLETED + deployed**
- Phase 31 (WebRTC calls): **BLOCKED**

---

## 6) Future backlog
- P0 WebRTC voice/video calls UI + integration (after mockups)
- P0 AI Screen Search expansion
  - multi-step follow-up chat
  - “search in chats” / “search in posts” scoped toggles
  - moderation/abuse limits for AI
- P1 Google Play ready (signed AAB)
- P1 iPhone app packaging
- P2 Admin Reports screen UI
- P2 Community join (topic sheet → shows on profile)
- P2 Unblock list
- P3 Recent searches
- P3 Extra haptics polish
- P3 Match expiry nudges
