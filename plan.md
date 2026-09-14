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
- **NEW (user-approved, 2026-09-14): AI account linking + orb visual search**
  - Users can **connect their own AI provider** (ChatGPT/OpenAI, Claude/Anthropic, Gemini/Google) to power orb search.
  - Orb ink stroke → capture screen region → send to their linked model (vision) → show answer + Voiladi results.
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
  - Sensitive secrets (AI keys) must be **encrypted at rest** and **never returned to clients**.

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
- APK bumped and published: **APK 1.6.2** (shell 1.7.2) + web deployed.

---

## Phase 30 — Connect your AI + Orb Visual Search (NEW, P0)
**Status: COMPLETED (2026-09-14) - tests iteration_29 100%, api + web deployed, APK 1.6.3 live. 30b: replaced API-key UI with Sign in with ChatGPT (Codex device-code OAuth); Claude/Gemini hidden for now**

### 30.1 Binding decisions (locked with user)
- Settings adds a new row: **Settings → AI Assistant** (`/settings/ai`).
- Providers: **ChatGPT (OpenAI)**, **Claude (Anthropic)**, **Gemini (Google)**.
- Linking method: **Bring-your-own-key (BYOK)** but made to feel like **account linking**:
  - Provider card → “Connect” sheet → button opens provider key page in browser (user logs into their account there) → user pastes key → we verify → show **Connected**.
  - **Why key?** Because public “Apple-style login that lets third-party apps use the user’s ChatGPT/Claude/Gemini subscription” is not available. Keys are the only workable integration today.
- Keys must be:
  - Stored **server-side only**, **encrypted at rest**, never returned to the client.
  - Only a **hint** may be shown (e.g., last-4) after successful connect.
- Orb behavior:
  - If user draws with orb and releases → show AI result sheet.
  - If nothing linked → show iOS action sheet: **“Connect your AI”** → navigates to `/settings/ai`.
- Orb result sheet must:
  - Answer about what was circled (vision).
  - Also show **Found in Voiladi**: matching **people / posts / communities**.
- Style: must match existing iOS glass + Settings soft-UI exactly (no new visual language).

### 30.2 Backend (FastAPI + MongoDB)
**New file:** `backend/routes_ai.py` (mounted in `server.py`)

**Collections**
- `ai_links`:
  - `user_id`
  - `provider`: `openai | anthropic | gemini`
  - `ciphertext`: encrypted API key
  - `hint`: last-4 / masked label (non-sensitive)
  - `model`: selected model id
  - `active`: bool
  - `created_at`, `updated_at`, `last_validated_at`

**Encryption**
- Use `cryptography.Fernet`.
- Secret from env `AI_KEY_SECRET` (preferred). Fallback: derive from `JWT_SECRET` (stable) if env absent.

**Endpoints**
- `GET    /api/ai/links` → list connected providers (no keys)
- `POST   /api/ai/links` → connect provider (accept key + provider + optional model)
  - Validate key by calling provider models endpoint.
  - Save encrypted key + default model.
- `PUT    /api/ai/links/{provider}` → update model / active
- `DELETE /api/ai/links/{provider}` → disconnect

**Orb lookup endpoint**
- `POST /api/ai/lookup`
  - Input: `{ provider?, model?, image_data_url, bbox, page_text, question?, history? }`
  - Steps:
    1) Resolve active provider/model for user.
    2) Call provider vision endpoint with:
       - cropped JPEG (base64)
       - prompt that includes: question + page_text context
    3) Extract:
       - `answer_text`
       - `keywords` / `entities` (ask model to output JSON)
    4) Search inside Voiladi:
       - People: reuse `GET /api/explore/search?q=` via internal function (or factor search logic to a helper)
       - Topics: `content.INTERESTS` match
       - Posts: query `posts` by caption/location regex, plus author username match
    5) Return: `{ answer, results: { profiles, posts, topics }, provider, model }`

**Rate limits & body size**
- Add a stricter rule for `/api/ai/*` (protect from abuse).
- Ensure body cap allows images (e.g., 2–4MB JPEG). If needed, keep under existing MAX_BODY and compress client-side.

### 30.3 Frontend (React)

**Settings UI**
- Add Settings row: **AI Assistant** in Settings → App section (or Account section if you prefer; keep to reference grouping).
- New page: `frontend/src/pages/settings/AiAssistant.jsx`
  - Three provider cards:
    - status: Not connected / Connected
    - Connect / Disconnect
    - Model picker (only after connect)
  - Connect flow:
    - iOS glass sheet with:
      - “Open OpenAI / Anthropic / Google” button (opens key creation URL)
      - secure paste field (type=password)
      - Verify & Connect

**Orb AI Search Layer**
- New component: `frontend/src/components/ai/AiSearchLayer.jsx`
  - Listens to `window` event `voiladi:ink`.
  - On event:
    1) Capture screenshot (see capture strategy below)
    2) Crop to bbox (+ padding)
    3) Generate text context:
       - visible headings/buttons in current screen (DOM scan)
       - current route + active post id/profile id if present
    4) Call `POST /api/ai/lookup`
    5) Show a glass **result drawer**:
       - Top: AI answer
       - Below: “Found in Voiladi” sections
         - People: reuse existing profile cards/sheets
         - Posts: small tiles that open `/p/:id`
         - Communities: open topic sheet
       - Follow-up composer (optional v1): user asks a follow-up question (keeps short history)

**Capture strategy**
- Web browsers:
  - Use `html2canvas` (or `modern-screenshot`) to capture `#vo-main` (not the whole page background).
  - Keep image small: downscale and JPEG compress.
- Android shell:
  - Add native bridge `VoiladiNative.capture()` using **PixelCopy** (Phase 30.4).
  - Web receives `voiladi:capture` event with base64 PNG/JPEG.

**BottomNav orb tweak**
- When a stroke exists on release:
  - Instead of flying home immediately, allow the AI layer to take over (orb can dissolve/fade and then return after results open).
  - Keep existing feel; no new visuals.

### 30.4 Android shell updates (APK)
**Target shell:** 1.7.3 (APK 1.6.3)
- Add `@JavascriptInterface capture()`:
  - Use PixelCopy to capture the WebView to a bitmap.
  - Encode to JPEG (quality ~0.75) or PNG.
  - Dispatch to the page via `evaluateJavascript`:
    - `window.dispatchEvent(new CustomEvent('voiladi:capture',{detail:{dataUrl:'data:image/jpeg;base64,...'}}))`

### 30.5 Testing plan
- Backend:
  - Unit-test provider adapters with mocked httpx responses (no real keys in CI).
  - Verify encryption: ciphertext stored, key never returned.
  - Lookup returns answer + structured results.
- Frontend:
  - Settings connect/disconnect states.
  - If no link: orb release opens “Connect your AI” sheet.
  - If linked: orb release opens results drawer with answer + results.
  - Ensure capture works on web (html2canvas).
- APK:
  - Verify PixelCopy capture fires event and results open.

### 30.6 Deploy plan
- Deploy **API + Web** to Railway.
- Build and publish **APK 1.6.3** using `android-build/build_apk.py`.
- Update `memory/PRD.md` with the new AI phase, security notes, and rollout details.

---

## Phase 30b — Orb search: identify anything, faster (COMPLETED 2026-09-14)
**Status: COMPLETED + deployed (web + api on Railway; no APK change needed - the shell loads the live web)**
- User asked the orb to "find whatever the user marks - products, people, places, anything - with a description, fast and accurate".
- Decision: keep Codex OAuth sign-in (the ONLY way to use the user's own ChatGPT Plus). "Sign in with ChatGPT" is an invite-only,
  identity-only beta; ChatGPT "Developer mode connectors" run the opposite direction (ChatGPT -> our server) so they can't power the orb.
  The "Codex" label on OpenAI's consent page is OpenAI's branding and can't be changed. User will redesign the connect screen himself later.
- Backend `routes_ai.py`: Lens-style SYSTEM prompt -> `TITLE:` / `KIND:` / description / `TERMS:`; `_parse_answer()`; `web_query`;
  new `POST /api/ai/lookup/stream` (NDJSON delta/done/error) sharing `_prepare_lookup()` with `/lookup`.
- Backend `chatgpt_account.py`: `codex_stream()` async generator (SSE deltas), `codex_answer()` wraps it.
- Frontend `lib/aiStream.js` (fetch + ReadableStream client, `parseLive`, `KIND_LABEL`, `webSearchUrl`), `AiSearchLayer.jsx` streams
  words as they arrive (caret), bold title + kind label, "Search the web" chip (Google), falls back to `/lookup` if streaming fails.
- Tests: `/app/test_reports/iteration_30.json` - 16/16 pass. Test scripts moved to `/app/tests/`.

## Phase 30d — AI Assistant page redesign to the owner's 3 mockups (COMPLETED 2026-09-14)
**Status: COMPLETED + deployed (web)** - not connected card + connect sheet, code/waiting state, connected card + Disconnect. Details in memory/PRD.md.

## Phase 31 — Voice + Video calls (WebRTC) (P0)
**Status: BLOCKED (waiting on UI mockups from user)**
- Do not implement until incoming/ongoing call UI is provided.

---

## 3) Next Actions
1) **Phase 30: Connect your AI + Orb Visual Search**
   - Backend `routes_ai.py` + encrypted key storage.
   - Settings `/settings/ai` UI.
   - Orb AI layer: capture → lookup → results drawer.
   - Android PixelCopy capture bridge + APK 1.6.3.
   - Test + deploy.
2) **Phase 31: WebRTC voice/video calls** (blocked)
   - Wait for user UI mockups.
3) **Move servers to Singapore (Asia)** (optional biggest speed gain for India)
   - Requires explicit approval + maintenance window.
4) **Admin Reports screen UI** (expand `/admin/verify`)

---

## 4) Success Criteria
- UI matches user references pixel-for-pixel.
- Orb UX:
  - Detach at 0.40s hold.
  - Drawing is smooth and responsive.
  - Release triggers AI (linked) or connect sheet (not linked).
- AI linking:
  - Providers connect/disconnect reliably.
  - Keys are encrypted and never exposed.
  - Model selection works.
- AI results:
  - Answer is relevant to circled content.
  - “Found in Voiladi” returns useful people/posts/communities.
- No regressions to Discover feed, chat, explore, edge-to-edge shell.

---

## 5) Status Log
- Phase 1–29: **COMPLETED**
  - Includes Discover overhaul, Circle feed, dark mode + edge-to-edge fixes, and orb/ink feature.
  - Orb hold time updated to **0.40s**.
  - APK published: **1.6.2**.
- Phase 30: **COMPLETED** (APK 1.6.3)
- Phase 30b (orb identify-anything + streaming): **COMPLETED**
- Phase 30d (AI Assistant page redesign, 3 mockups): **COMPLETED**
- Phase 31: **BLOCKED**

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
- P2 Notification settings
- P2 Unblock list
- P3 Recent searches
- P3 Extra haptics polish
- P3 Match expiry nudges
