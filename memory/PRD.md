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
- Phase 13 (2026-09-09): Instagram-style toasts (dark bottom bar; dark top banners with avatar for match/message). Notifications page + API
  (routes_notifications.py; New/Earlier split via notifications_seen_at; tabs). Tests iteration_11/12 green. Deployed api + web.
- Phase 14 (2026-09-09): Android APK (WebView shell) built without Gradle (hand-encoded AXML/ARSC + javac/d8/apksigner) in /app/android-build;
  download https://www.voiladi.com/voiladi.apk. Validated iteration_13 (61/61). Bump VERSION_CODE/VERSION_NAME env when rebuilding.
- Phase 15 (2026-09-10): Offline banner/screen (web) + native offline view, Android background notifications (JobScheduler polling, no FCM),
  native splash, JS bridge window.VoiladiNative. APK 1.1.0 at https://www.voiladi.com/voiladi.apk. Tests iteration_14 100%.
- Phase 16 (2026-09-10): Toasts removed app-wide. Successes are inline (no popup); errors use a glass notice bar (lib/feedback.js, components/Feedback.jsx);
  confirmations are iOS glass action sheets (components/Dialogs.jsx). VOILADI+ shows a "Soon" pill. Tests iteration_15 17/17. NOT yet redeployed to Railway.
- Phase 17 (2026-09-10): Likes + Messages tabs rebuilt 1:1 from soft-UI mockups (components/SoftUI.jsx), floating rounded bottom nav app-wide,
  Chats tabs All/Matches/Unread + search toggle, Likes "..." sort/filter menu + heart count pill. Tests iteration_16 100%. Deployed voiladi-web.
- Phase 18 (2026-09-10): Explore/Profile/Discover rebuilt to neumorphic mockups; Explore communities (topics API), Follow, search, Nearby/Creators.
  Tests iteration_17 100%. Deployed voiladi-api + voiladi-web.
- Phase 19 (2026-09-10): Removed fit-to-canvas transform scaling; shell fully responsive (clamp/cqi units, flex scroll areas). iteration_18 100%. Deployed web.
- Phase 20 (2026-09-10): Usernames (@handle) - unique, auto-generated for existing users, editable with live availability, shown on Profile/public profiles, searchable in Explore. Deployed.
- Phase 21 (2026-09-10): Profile verification - live selfie -> human review at /admin/verify (ADMIN_API_KEY) -> black tick "Verified Profile"; unverified can't send messages. Deployed.
- Phase 22 (2026-09-10): Verification moved out of Profile into Settings (IG "Meta Verified" style). Profile shows only a small grey "Not verified >" link under @username
  -> /settings/verification (status card + how-it-works + Get verified -> /verify). Settings restyled to Soft UI with grouped sections; new ACCOUNT rows:
  Email (/settings/email, PUT /api/auth/email - password accounts must confirm password), Phone (/settings/phone, request-otp + verify-phone), Verification.
  New shared pieces: SoftPageHeader / SoftSectionLabel / SoftRow (SoftUI.jsx), lib/phone.js (splitPhone/formatPhone). Tests iteration_20 100%. Deployed to Railway 2026-09-10 11:55 UTC (api + web).
- 2026-09-10 13:24 UTC: Notifications tabs - Segmented gained `fit` prop (.vo-seg-fit: flex, items size to text, leftover space shared equally -> equal gaps between labels); Notifications uses fit + vo-seg-lg. Deployed web.
- 2026-09-10 13:45 UTC: Loading system pass. Static pre-JS boot splash in public/index.html (#vo-boot, dark-aware via voiladi_theme). All 21 screens lazy (App.js `screen()` helper: React.lazy + one-shot reload on chunk fail) with Suspense RouteLoader in AppShell. Initial JS 320KB->160KB gz. Boost pill spinner. Tests iteration_21 all pass. Deployed web.
- 2026-09-10 13:52 UTC: Offline UX. AuthContext caches profile in localStorage (voiladi_user): with token+cache the app opens instantly and re-checks in background; network failure shows "Reconnecting..." pill (OfflineBanner now also reads netError) + auto-retry every 5s / on `online`; full OfflineScreen only with no cache. Deployed web.
- 2026-09-10 16:15 UTC: ROOT CAUSE of "hostname not found"/"offline"/blank on user's phone = Jio ISP blocks *.up.railway.app DNS. Fixed by moving DNS to Cloudflare (proxied www/api/root). Details in deploy/README.md. voiladi.com root now served directly (no GoDaddy redirect).
- 2026-09-10 16:50 UTC: Performance pass. logo-mark.png 361KB->3.4KB (256px quantized, visually identical); nginx caches root images 7d (regex loc, /static/ ^~ immutable); index.html: async emergent script, preconnect API, preload logo. Backend: GET /api/uploads/{f}?w=240|480|800 on-demand variants in uploads/_thumbs (immutable, CDN-cached), deleted with the photo. Frontend UserPhoto size prop (xs/sm/md/full) -> grids/lists/avatars use thumbnails; SwipeCard/ProfileSheet full. Tests iteration_22 pass. Deployed api+web. REMAINING LATENCY: Railway services + volumes in US (iad); India->US ~300ms/API call. Option: migrate to asia-southeast1 (Singapore) - needs volume migration (mongo ~1GB, uploads ~1GB), user approval.
- 2026-09-10 19:15 UTC: Phase 23 DONE - Direct messages (POST /api/dm/{user}, threads in db.matches with kind=dm/status=request, accept endpoint, reply auto-accepts, unsend DELETE messages/{id}, Requests tab in Chats, Message button on ProfileSheet, neumorphic ChatRoom with long-press Unsend/Copy, mutual like upgrades dm->match). Phase 24 DONE - security.py middleware (rate limits, headers, body cap), login lockout, WS auth frame, nginx CSP/HSTS via include, APK v1.3.0 hardened WebView (exact https host allow-list, no file/content access, no 3rd-party cookies) + release keystore. JWT secret NOT rotated (user choice). Tests iteration_23. Deployed api+web (web had a 10-min outage from envsh exec bit; fixed).

## 2026-09-10 — Web landing page + /login
- `voiladi.com/` shows the Apple-glass landing page (hero, glass store pills, 3-phone carousel, frosted side menu with Log in) to signed-out web visitors; Android shell and signed-in users skip it.
- `/welcome` renamed to `/login` (redirect kept). Email form moved to `/login/email`; phone OTP at `/login/phone`.
- Deployed to Railway (voiladi-web + voiladi-api) and verified live.

## 2026-09-12 — Chat composer glare + Discover Feed (Posts) — Phase 27
- Chat composer: removed the outer white glow + fade band behind the floating glass message bar (box itself unchanged). Deployed web.
- Phase 27 DONE: Discover is now a full-screen vertical POSTS feed (one post per screen, snap-scroll), exact to the user's reference:
  white "Discover" title, right rail (pink heart+count, comment+count, share+count, bookmark+count, ...), bottom-left avatar / username / black tick /
  outlined Follow pill / pin + place / caption. Spinner on black first, then grey shimmer per post, photo fades in. Swipe deck removed.
  Backend `routes_posts.py`: collections posts / post_likes / post_saves / post_comments / post_hidden; endpoints GET /api/posts/feed (cursor `before`),
  /posts/mine, /posts/saved, /users/{id}/posts, POST /posts (multipart file+caption+location, 201), DELETE /posts/{id}, GET /posts/{id},
  POST /posts/{id}/like|save|hide|report (toggles), GET/POST /posts/{id}/comments, DELETE comments/{cid}, POST /posts/{id}/share {match_id} ->
  chat message kind="post" with snapshot (inbox preview "Shared a post"; bots reply). Follow = existing POST /api/swipe like.
  Admin: POST/DELETE /api/admin/seed/posts gives every sample profile one Unsplash post (is_seed) so the feed is full.
  Frontend: pages/Discover.jsx (feed), components/feed/PostCard.jsx, PostSheets.jsx (Comments drawer, Share-to-chat drawer, iOS "..." sheet),
  PostsGrid.jsx, hooks/usePostActions.js, pages/NewPost.jsx (/posts/new, from Profile "+" header button and Posts section), pages/PostView.jsx (/p/:id,
  used by shared messages + Copy link), pages/Saved.jsx (/saved, Profile menu "Saved"). ChatRoom renders kind="post" as a tappable card.
  Tests iteration_27 (backend 24/25 -> fixed 201; frontend 100%). Deployed api + web.
- 2026-09-14: Profile cleaned (completion card, Boost/Super Likes/VOILADI+, Account..Help menu hidden behind SHOW_PROFILE_EXTRAS=false in Profile.jsx; code kept).
  Settings › Profile group now: Account, Saved, Preferences, Notifications, Privacy & Safety. Profile shows glass segmented "Posts | Saved" under stats.
  VIDEO POSTS: POST /api/posts/video/init -> PUT /api/media/{upload_id}/chunk -> POST /api/posts/video/{upload_id}/complete (201, status processing);
  ffmpeg 720p + poster in background (<=60s, <=300MB), post.status ready/failed, WS `post_ready`; feed excludes non-ready. PostCard <video muted loop playsInline>,
  only the on-screen post plays, single tap = sound toggle (feed-wide), double tap = like. NewPost accepts image/*,video/* with progress %. PostView polls while processing.
  Tests iteration_28 100%. Deployed api + web. Calls (WebRTC) still waiting on the user's call-screen designs.
- 2026-09-14: Messages inbox rebuilt to the user's reference: flat list (no cards) with 0.5px hairlines, 48px avatars, 20px names, 16px preview, time top-right,
  22px black unread badge, chevron, live "••• typing..." (WS typing event) and ✓✓ read ticks (backend `last_read` on match rows); bigger 40px title;
  compact 40px glass segmented All / Requests / Unread (`.vo-seg-inbox`). Log Out sheet action black (`ink` prop on ConfirmDialog). Deployed api + web.
- 2026-09-14: Discover now has two minimal text tabs top-left: "Discover" (everyone) | "Circle" (posts from people you follow = your like-swipes).
  Backend GET /api/posts/feed?scope=circle. Active tab 38px white with short underline, inactive 30px white/60. Circle empty state -> Find people.
  Scope remembered per session (sessionStorage vo_feed_scope). Brand row removed from Explore/Likes/Messages (SoftTitle `actions` prop); Profile keeps it. Deployed.
