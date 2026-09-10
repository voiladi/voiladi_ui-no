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
- Logo updated everywhere to the user's final mark (thick white stroke front, grey stroke behind, radius 23.5%, wordmark 800 weight); favicon.svg, PNG icons (32/64/180/192/512 + maskable), manifest.json, OG tags added. Welcome page made fluid (clamp() sizes, flex rhythm, safe areas) and verified at 320x568, 393x852, 430x932, 1440x900 with no scrolling. Redeployed web.


## Phase 12 — Blank-screen bug, exact logo, Profile 1:1 + fit-to-device scaling (P0)
**Status: COMPLETED (2026-09-09)**
- BUG (iOS Safari: Profile/Likes/Filters turned white until reload): root cause = AnimatePresence mode="wait" exit-wait in AppShell. Fixed with a plain
  <main key={pathname}> + CSS entrance animation (.vo-page-fade/.vo-page-push) + ScreenErrorBoundary. Verified iteration_9 (80 rapid switches, 0 blank) and iteration_10 (70/70).
- Logo: user's own PNG cropped pixel-exact (/public/logo-mark.png) used by LogoMark everywhere; favicon/app icons/manifest regenerated from it.
- Profile rebuilt 1:1 from the hi-res reference (canvas bg, white cards, 60/42px rows) and fits 393x852 without scrolling.
- Fit-to-device system (hooks/useFitScale.js): shell laid out at viewport/scale and transform-scaled (0.78..1) so screens keep the mockup proportions on any phone; frozen while typing.
- Deployed web to Railway (SUCCESS).


## Phase 13 — Instagram-style notifications + Notifications page (P0)
**Status: COMPLETED (2026-09-09)**
- Toasts: single dark bottom bar above the tab bar (sonner unstyled, .vo-toast), success check / red error icon; realtime match/message banners = dark top card with avatar (.vo-banner, position top-center). No stacking, no white cards.
- Notifications page (/notifications) from the profile bell: tabs All/Likes/Matches/Messages/System, New/Earlier groups, avatar badges, system notices. Backend routes_notifications.py (GET /api/notifications, POST /api/notifications/seen; users.notifications_seen_at). Bell dot = unseen_count.
- Tests iteration_11 (toasts) + iteration_12 (notifications, BE+FE 100%). Deployed api + web.


## Phase 14 — Android APK (P1)
**Status: COMPLETED (2026-09-09)**
- /app/android-build: WebView shell (com.voiladi.app, MainActivity -> https://www.voiladi.com/, file chooser, geolocation permission, back navigation, white status bar).
  build_apk.py hand-encodes AndroidManifest.xml (binary AXML) + resources.arsc (icon) because aapt2 is x86-only; javac + d8 + apksigner (v2/v3, keystore android-build/voiladi-debug.keystore, pass voiladi123).
  SDK bits in android-build/sdk (gitignored; re-download build-tools_r34 + platform-34-ext7 if missing). Requires openjdk-17 (apt).
- Download: https://www.voiladi.com/voiladi.apk (nginx serves with APK mime + attachment). Copies: frontend/public/voiladi.apk, deploy/android/voiladi-1.0.0.apk.
- Validated by testing agent (iteration_13: 61/61 structural checks, androguard + pyaxml + apksigner).


## Phase 15 — Offline notice, phone notifications, native splash (P1)
**Status: COMPLETED (2026-09-10)**
- Web: OfflineBanner (top pill while navigator offline) + OfflineScreen (cold start with token but network error -> no redirect to /welcome; Retry). AuthContext exposes netError.
- Native bridge (lib/native.js): window.VoiladiNative.setToken/clearToken on login/logout/refresh, ready() after first render (NativeReady in App.js).
- APK 1.1.0 (versionCode 2): native splash (logo, fades when web calls ready(), 8s safety), native offline view on main-frame errors (Try again), JS bridge, PollService (JobScheduler 15 min, persisted, GET /api/notifications, posts notifications with avatar, deep-links via "path" extra), Notifier channel voiladi_activity, POST_NOTIFICATIONS runtime prompt after login, second mipmap ic_notification (0x7f010001).
- Tests iteration_14: 100% (web offline, bridge, regression, APK structure, rebuild). Deployed web (serves the new APK). Copies: deploy/android/voiladi-1.1.0.apk.
- Ops note: pod restarts wipe the railway CLI -> reinstall (see deploy/README.md); java 17 survived, android-build/sdk is in /app.

## Phase 16 — No-popup feedback: inline states + iOS glass sheets (P0) — COMPLETED 2026-09-10
User rejected toast pop-ups ("weird / AI generated"). Chosen after visual mockups: (C) inline state, no popup for successes;
Instagram glass notice bar ONLY for errors / must-know; (D) iOS action sheets (glass, red destructive, separate Cancel) for confirmations.
- lib/feedback.js (notice/banner store) + components/Feedback.jsx (NoticeBar above tab bar, iOS notification Banner at top) mounted in AppShell.
- components/Dialogs.jsx rebuilt: ConfirmDialog = iOS action sheet; ReportDialog = sheet with reason list + inline "Thanks for letting us know" done state.
- Sonner Toaster removed from App.js; all 45 toast() call sites converted (Profile VOILADI+ -> "Soon" pill; block/unmatch/superlike/save/boost -> silent inline;
  interests limit -> red counter flash via hooks/useFlash.js; notifications switch disabled when blocked). Apple font stack + glass tokens in index.css.
- Tests iteration_15: 17/17 pass. Dev hook window.__voFeedback (non-production only).

## Phase 17 — Likes + Messages tabs 1:1 from soft-UI mockups, floating nav app-wide (P0) — COMPLETED 2026-09-10
- components/SoftUI.jsx: SoftHeader (40px brand), SoftIconButton (44px raised), SoftTitle (34px + subtitle + right slot), SoftEmpty (fills to nav),
  BubblesArt (SVG) / CardsArt. CSS: --soft-* tokens, .vo-soft*, .vo-seg-lg, .vo-float-nav, .vo-art-card*. --nav-h/--nav-gap drive page bottom padding.
- Chats: Messages title, tabs All/Matches(no msgs)/Unread, search toggle button, compose drawer, raised rows, empty card + "Find people" -> /explore.
- Likes: "..." menu (Newest/Oldest, Super Likes only), heart-count pill, tabs, raised rows, empty card + "Explore people" -> /explore.
- BottomNav floating (inset 12px, 68px, raised) on all tabs; Discover/Explore/Profile paddings updated. Tests iteration_16 100%.
- Pass 2 (user: 'not same, box line, glass effect'): removed all 1px inset highlights (they aliased into a dashed line under fit-scale), widened SVG filter regions
  (shadow was clipping to a rectangle = the 'box'), wider/softer neumorphic shadows, CardsArt -> SVG, 34px card radius, 22px title, art 220x198.
- Pass 3 (user: 'iPhone glass effect, white + shades of black, fonts'): true neumorphism tokens (--neu-*: top-left white light, bottom-right dark shadow,
  gradient surfaces, inset segment track, bevelled SVG art). Font stack now -apple-system/SF Pro first (real SF on iPhone), Inter variable w/ opsz for Android.
- Pass 4: stronger downward dark shadows (--neu-dark 0.16/0.20) as in reference; useFitScale(fluid) -> /likes & /chats scale by WIDTH only so they fill the phone height 1:1. Deployed web.

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