# Voiladi — PRD / status

Gen-Z dating app (18-30). REAL email+password accounts (register/login) + mandatory phone OTP verification inside onboarding,
onboarding wizard (name/DOB/gender -> phone -> OTP -> photo (skippable) -> interests -> notifications -> done), swipe discovery
(pass / like / blue-star Voila superlike quota), Explore grid (All / Near you / New / Popular), Likes (All / Likes you / You liked),
real-time chat (WebSocket + polling fallback), curated non-AI icebreakers, Filters (show me / age / distance / interests / goals),
Profile (Followers=likes received, Following=likes sent, Profile views; completion card; Boost + VOILADI+ = STATIC PLACEHOLDERS,
Super Likes = real Voila quota), Edit Profile, Settings (dark mode toggle, red Log Out), block/report/unmatch, delete account, admin reports.
AI: ONLY the user's own AI (ChatGPT / Claude / Gemini account linked in Settings > AI Assistant) - no Voiladi-side AI features. (User rule updated 2026-09-14; earlier rule was 'no AI at all'.)

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
- 2026-09-14: Profile rebuilt to the user's mockup: header brand + flat grey round buttons (+ / bell / menu->/settings), centred 95px avatar with white camera badge,
  26px name + tick, @handle, two flat pills (Edit profile / Share profile via navigator.share), stats row with dividers, icon tabs Posts | Saved | Likes
  (Grip / Bookmark / Heart, black underline + hairline), empty states with big icon. New GET /api/posts/liked. Deployed api + web.
- 2026-09-14: APK 1.4.0 (versionCode 5, UA VoiladiApp/1.5, release keystore) -> frontend/public/voiladi.apk + deploy/android/voiladi-1.4.0.apk, deployed.
  Shell now follows the web theme: bridge setTheme("dark"|"light") persisted in prefs; status bar, Android navigation bar, window/WebView/splash/offline
  backgrounds all black in dark mode (light icons), white in light mode. Web: useTheme.apply() -> nativeSetTheme(dark). Dark-mode glass lens = smoked glass.
- 2026-09-14: Appearance = System / Light / Dark (Settings › Appearance row -> iOS action sheet; replaces the Dark Mode switch). voiladi_theme stores
  "system"|"light"|"dark" (default system). Web follows prefers-color-scheme live; in the APK the WebView media query follows the *app* theme, so shell 1.6
  exposes isSystemDark() + fires window 'voiladi:systemtheme' on uiMode change; useTheme.resolveDark prefers the shell answer. APK 1.5.0 (code 6) live.
- 2026-09-14: EDGE-TO-EDGE Android shell 1.7 / APK 1.6.0 (code 7): on Android 11+ status + navigation bars are transparent and the page draws behind them;
  the shell passes bar sizes as --native-inset-top/bottom (html.vo-native-insets; also readable pre-paint via VoiladiNative.insets()), handles the keyboard
  itself (root padding = IME inset). Web: --safe-top/--safe-bottom tokens (env() fallback) replace every env(safe-area-inset-*); .vo-shell padding-top:
  var(--safe-top); shell[data-canvas=black] on /discover and /p/*; nativeSetBars("dark") requests light bar icons there. Older Androids keep themed solid bars.
  Also: apex voiladi.com -> 301 www; removed emergent/posthog scripts from index.html; boot splash shows Reload after 15s if the app never mounts.
- 2026-09-14: APK 1.6.0 crashed on launch: PhoneWindow.getInsetsController() dereferences the decor view, which was null before setContentView -> NPE.
  Fixed in APK 1.6.1 (code 8, shell 1.7.1): w.getDecorView() first + applySystemBars() again after setContentView; whole edge-to-edge path is try/catch
  with fallback to solid themed bars. Added CrashReporter (stores uncaught trace, posts to POST /api/shell/crash on next launch); admin reads
  GET /api/shell/crashes (x-admin-key). routes_shell.py. Deployed api + web.
- 2026-09-14: KEY FEATURE "Orb": hold the tab-bar glass lens ~0.40s without moving (was 0.65s; HOLD_MS=400 since 2026-09-14) -> it detaches into a 64px floating glass orb (portal, z 400)
  that follows the finger anywhere and lays an ink trail (SVG path, glow; ink colour = ink/white in dark). Release -> orb springs back into the
  current tab slot, ink fades, `window` event `voiladi:ink` {points, bbox} is dispatched for the upcoming visual (AI) search. BottomNav.jsx / index.css
  (.vo-orb, .vo-ink-layer, .vo-ink-path). Normal press-and-slide tab switching unchanged. Deployed web.
- 2026-09-14 17:30 UTC: Orb hold time 0.65s -> 0.40s (BottomNav.jsx HOLD_MS=400). APK 1.6.2 (versionCode 9, shell 1.7.2, release keystore) ->
  frontend/public/voiladi.apk + deploy/android/voiladi-1.6.2.apk. Deployed web (Railway SUCCESS); live bundle verified ",400)".

## 2026-09-14 — Phase 30: Connect your AI + orb visual search (user-approved)
- User decision: "Apple-style login" to ChatGPT/Claude/Gemini is impossible for third parties (OpenAI "Sign in with ChatGPT" is identity-only + partner-gated;
  Anthropic/Google have none), so linking = the user pastes an API key FROM THEIR OWN account, presented as an account-connect flow. Usage is billed to
  their provider account. Told to the user explicitly ("Why key?" -> "the key is the only door the AI companies leave open to outside apps").
- Backend routes_ai.py (prefix /api/ai): collection ai_links {user_id, provider, ciphertext (Fernet; secret = AI_KEY_SECRET or sha256(JWT_SECRET)), hint (last 4),
  model, models[] (account's models, best default first), active}. GET /providers, GET /links, POST /links (verifies key live via provider models endpoint,
  friendly errors, 201), PUT /links/{provider} {model|active}, DELETE /links/{provider}. POST /lookup {image data:image/jpeg (<=6MB), route, texts[], user_ids[],
  post_ids[], question?, history[]} -> provider vision chat (OpenAI chat/completions, Anthropic messages, Gemini generateContent via httpx, no SDKs) with SYSTEM
  prompt asking for a short answer + "TERMS: a, b, c" line -> terms drive find_in_voiladi(): topics (INTERESTS), people (name/username/interests/bio/job/city,
  circled user_ids first), posts (caption/location/authors, circled post_ids first). 428 when nothing is linked. Rate limits: ai_connect 12/10min, ai_lookup 40/10min.
  Model ranking heuristics: OpenAI newest gpt-N (plain > mini > nano, no dated/preview/audio/etc), Anthropic sonnet > opus > haiku newest, Gemini flash (non-lite) newest non-preview.
  test_ai_orb.py = in-process ASGI test with the provider stubbed (connect/encrypt/model/lookup/follow-up/validation/disconnect) - all green.
- Frontend: Settings > App > "AI Assistant" row (Orbit icon; value = active provider name or Off) -> /settings/ai (pages/settings/AiAssistant.jsx): How-it-works card,
  ACCOUNTS card (ChatGPT / Claude / Gemini rows, ink letter tiles, "Connect" / "Connected" tick), THE ORB USES card (pick active). Provider Drawer: steps 1-2,
  "Open OpenAI/Anthropic/Google" (keys_url, new tab), password field with eye, Connect (spinner, red inline error), fine print; when connected: Model row (iOS action-sheet
  picker of the account's models), Use for the orb, Update key, red Disconnect (ConfirmDialog danger).
  components/ai/AiSearchLayer.jsx (mounted in AppShell for signed-in tab screens) listens to `voiladi:ink`: no link -> iOS sheet "Connect your AI" -> /settings/ai;
  linked -> lib/aiCapture.js: markedBBox() keeps only the marking (closed loop, else after the first direction change - the carry line from the bar is dropped),
  captureRegion() (native PixelCopy via VoiladiNative.capture(id) -> 'voiladi:capture' event, else html2canvas useCORS) crops + pads to <=1024px JPEG (ink included),
  collectContext() gathers text nodes / [data-user-id] / [data-post-id] under the region. Result = glass Drawer (.vo-ai-drawer): provider mark + name · model, crop preview,
  answer, chat-style follow-ups (black bubbles) via composer "Ask ChatGPT more…", FOUND IN VOILADI (people rows -> ProfileSheet, 3-up post tiles -> /p/:id,
  community pills -> /explore?topic=Name (Explore now reads ?topic=)). Skeleton lines while thinking; error row with retry. BottomNav: with a real stroke the orb
  dissolves in place (not in the capture) and the ink lingers ~1.1s; plain release still flies home. data-user-id added on PostCard author avatar + Explore PersonRow.
- Android shell 1.7.3 / APK 1.6.3 (code 10): Bridge.capture(id) -> PixelCopy of the WebView rect (fallback web.draw) -> JPEG q80 <=1080w -> evaluateJavascript
  dispatch 'voiladi:capture' {id, dataUrl}. frontend/public/voiladi.apk + deploy/android/voiladi-1.6.3.apk.
- html2canvas added to frontend; cryptography pinned in requirements.deploy.txt.

## 2026-09-14 — Phase 30b: SIGN IN WITH CHATGPT (user rejected the API-key flow: "I need something which can connect ChatGPT accounts")
- Research result shared with user: Apple's ChatGPT link = private contract; official "Sign in with ChatGPT" = identity only + partner-gated; Anthropic (Apr 2026) and
  Google (Feb 2026) banned subscription OAuth in third-party tools; OpenAI's Codex OAuth still works and is tolerated (used by OpenClaw/opencode/pi). User chose:
  Codex OAuth for ChatGPT, REMOVE Claude/Gemini from the UI for now, no API-key entry in the UI.
- backend/chatgpt_account.py: device-code flow on auth.openai.com (client app_EMoamEEZ73f0CkXaXp7hrann; POST /api/accounts/deviceauth/usercode -> user_code +
  device_auth_id; poll POST /api/accounts/deviceauth/token (403/404 = pending) -> authorization_code + code_verifier -> POST /oauth/token with redirect
  https://auth.openai.com/deviceauth/callback; refresh via grant_type=refresh_token). Account (chatgpt_account_id, plan, email) read from the JWT claims
  https://api.openai.com/auth + /profile. Models: GET chatgpt.com/backend-api/codex/models?client_version=1.0.0 (slug/priority/visibility; fallback gpt-5.5, gpt-5.4, gpt-5.4-mini).
  Answers: POST chatgpt.com/backend-api/codex/responses (SSE, store:false, instructions, input_text + input_image data URL, reasoning low, text verbosity low)
  with headers Authorization / chatgpt-account-id / originator (env CODEX_ORIGINATOR, default "voiladi") / User-Agent / OpenAI-Beta: responses=experimental.
  Friendly errors: usage_limit_reached -> "You've hit your ChatGPT usage limit (try in ~N min)", 401/403 -> reconnect, model unavailable.
- routes_ai.py: PROVIDERS gains "chatgpt" {auth:"account", visible:true}; openai/anthropic/gemini stay server-side with visible:false (hidden in UI).
  POST /api/ai/chatgpt/start (201: session_id, user_code, verify_url, interval, expires_in 900) -> db.ai_device_sessions; GET /api/ai/chatgpt/poll/{session_id}
  -> pending | connected {link} | denied | expired (backend polls OpenAI at most once per interval). Link row: ciphertext = Fernet(json tokens), email, plan,
  account_id, model, models. Lookup: chatgpt links decrypt tokens, refresh when <5 min left (re-saved), retry once on expired. POST /api/ai/links refuses provider=chatgpt.
  Tests: test_chatgpt_account.py (stubbed OpenAI: start/poll/connected/encrypted/lookup/refresh/model/disconnect) + test_ai_orb.py both green. Live check: real
  device code issued by auth.openai.com and polling pending; full sign-in + answer must be verified by the user with a real ChatGPT Plus account.
- Frontend AiAssistant.jsx rewritten: one ACCOUNT row "ChatGPT" (Connect / Connected + email · plan · model line). Drawer: 3 steps card -> "Sign in with ChatGPT"
  -> code tile (auto-copied, tap to copy) + black "Open ChatGPT to enter the code" (auth.openai.com/codex/device, opens in the system browser from the APK) + spinner
  "Waiting for you to sign in…" (polls every interval s, plus on focus/visibilitychange) + Cancel; denied/expired errors; fine print about Codex login not being an
  official OpenAI program. Connected: Model row (Codex catalogue picker), Sign in again, red Disconnect. Orb "Connect your AI" sheet now says Connect ChatGPT.

## 2026-09-14 — Phase 30c: ORB IDENTIFIES ANYTHING + STREAMED ANSWERS (user: "find whatever the user marks... product, person, anything. Description. Faster and accurate")
- Why not "Sign in with ChatGPT" / connectors: explained to user. Official Sign in with ChatGPT = invite-only partner beta, identity only (name/email/pic),
  no model access. ChatGPT Developer-mode connectors (Apps SDK / MCP) run ChatGPT -> our server, cannot power the orb. Codex OAuth stays; "Codex" label is
  OpenAI's consent page branding. User: "Wait I will redesign it.. now let it be like this" -> do NOT touch AiAssistant.jsx layout until he sends the redesign.
- routes_ai.py: Lens-style SYSTEM (brand+model for products, names for public figures only, dish/cuisine, landmark+where, read/translate text; never guess
  private people). Reply shape TITLE: / KIND: (product|fashion|person|place|food|animal|plant|vehicle|text|art|app|other) / 1-3 sentences / TERMS:.
  `_parse_answer` -> {title, kind, answer, terms, web_query}. `/lookup` keeps working (now also returns title/kind/web_query).
  NEW `POST /api/ai/lookup/stream` -> NDJSON `{type:delta,text}`* then `{type:done,...result}` | `{type:error,status,detail}`; 428/400/409 pre-flight
  errors are still proper HTTP statuses (raised before streaming starts via `_prepare_lookup`). Token-expired -> refresh once -> retry (only if nothing streamed yet).
- chatgpt_account.py: `codex_stream()` async generator yields SSE output_text deltas; `codex_answer()` = join of the stream.
- frontend: lib/aiStream.js (streamLookup via fetch+ReadableStream, axios-shaped errors so errMsg works; parseLive hides half-typed TITLE:/KIND: lines;
  KIND_LABEL; webSearchUrl=Google). AiSearchLayer: `live` state renders words as they arrive with `.vo-ai-caret`; Answer component (hoisted) = bold 22px title
  + uppercase kind label + description + "Search the web" soft pill (Globe). Falls back to axios `/lookup` when streaming itself fails (non-HTTP error).
- Tests: iteration_30.json 16/16 (backend 428/400/409-in-stream/parser/regression; frontend mocked stream: title, FASHION label, web chip, error+retry).
  Scripts: tests/test_ai_orb_upgrade.py, tests/test_chatgpt_account.py. Deployed web+api via `railway up` (no APK rebuild - shell loads the live web).

## 2026-09-14 — Phase 30d: AI ASSISTANT PAGE REDESIGN (user's 3 mockups, "must match 10/10")
- AiAssistant.jsx rebuilt: ProviderMark now draws the real OpenAI mark on an ink tile (radius 24% of size). Not connected: ACCOUNT label +
  76px surface2 card (48px icon, "ChatGPT" 20px medium, "Not connected" 17px mute, chevron). Sheet (white, 30px radius, own 48x5 grabber):
  58px icon + "Connect ChatGPT" 30px bold + "Use your own ChatGPT account." 19px; bordered steps card (34px number circles, 20px titles,
  16.5px nowrap subs, hairline separators); ink 52px "Sign in with ChatGPT"; "Not now"; "Uses your ChatGPT plan." In progress: steps reworded
  ("You'll get a short code." / "Come back here" / "You're connected."), 58px surface code block "DD1L-JYRDD ... ✓ Copied|Copy" (tap copies),
  ink button with ExternalLink "Open ChatGPT to enter the code", 32px ring spinner + "Waiting for you to sign in / Come back here when it's done.",
  "Cancel" (closes the sheet). Connected: bordered white card (54px icon, "ChatGPT" 22px bold + black check badge, "● Connected" 30px pill with
  #34C759 dot on the title line, email 16px full-width below, hairline, gear "Manage account" row 60px) + bottom 60px surface2 "Disconnect" pill.
  "Manage account" = iOS action sheet: Model · <model> (opens model picker), Sign in again, Open ChatGPT settings. tailwind: added shadow `card`.
- Tests: iteration_31.json (frontend, all flows pass; drawer auto-close verified manually with poll mock). Deployed web via railway up.

## 2026-09-15 — Phase 32: NOTIFICATIONS REDESIGN (user: "Remove matches and unwanted stuff. Professional Instagram/Facebook type. Grid like attached" = All | Requests | Unread pill tabs)
- Backend routes_notifications.py rewritten: feed = like / superlike / request (DM message request, status pending|accepted, match_id) / message /
  verification. REMOVED: 'match' items and the 4 promo SYSTEM_NOTICES. Items now {id,type,actor,text,created_at,user{id,name,username,photos,verified},href,read}.
  Per-item read state: collection notification_reads {user_id,item_id,read_at} (unique index) + users.notifications_read_all_at baseline
  (first GET seeds it from notifications_seen_at so old stuff counts as read). POST /api/notifications/read {ids:[..]} | {all:true} (400 on empty).
  /seen unchanged (bell dot only). Response adds unread_count + request_count.
- Frontend Notifications.jsx rewritten: custom .vo-seg-tabs (50px translucent track, hairline, white raised pill, 18px, bold active) - matches
  the reference image; sections Today / Yesterday / This week / This month / Earlier; rows .vo-notif-row (56px avatar + FB-style type badge,
  "**Actor** text time" inline, blue unread dot, unread tint .vo-notif-unread); pending requests: Accept (blue) / Delete (surface2) inline ->
  POST /matches/{id}/accept | DELETE /matches/{id}; header CheckCheck = mark all read; tapping a row marks read (optimistic, hooks/useNotifications
  markNotificationsRead) then navigates; avatar tap -> ProfileSheet via GET /users/{id}. Old .vo-nrow CSS removed.
- Tests: iteration_32.json (backend 8/9 - 9th is the unverified-account DM limitation, not a bug; frontend 100%). Script: tests/test_notifications_redesign.py.
- 2026-09-15 fix: user said "Fix the panel" (Notifications tabs looked different from Messages). Notifications now uses the SAME `GlassSegmented`
  component + `vo-seg-inbox` class as Chats.jsx (options as {value,label}); the custom .vo-seg-tabs CSS was removed. Web redeployed.
