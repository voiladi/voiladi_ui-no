# Voiladi — Railway deployment runbook

Live:
- Web  https://www.voiladi.com  (root `/` = public glass landing page for signed-out browsers; `/login` = app entry, `/welcome` redirects)
- API  https://voiladi-api-production.up.railway.app  (health: /api/health)

Railway project **Voiladi** (workspace "My Projects", account tyleralexisbrown@gmail.com)
- `MongoDB`      Railway Mongo template, volume /data/db
- `voiladi-api`  backend/Dockerfile (python:3.11-slim, uvicorn), volume `/data/uploads` for photos, healthcheck /api/health
- `voiladi-web`  frontend/Dockerfile (node build -> nginx, SPA fallback), REACT_APP_BACKEND_URL baked in at build time

## Secrets (never commit)
`/app/deploy/.env.railway` holds RAILWAY_API_TOKEN, PROD_JWT_SECRET, PROD_ADMIN_API_KEY (gitignored).
Twilio creds live in `/app/backend/.env` (dev) and as Railway variables on voiladi-api (prod).

## Variables
voiladi-api: MONGO_URL=${{MongoDB.MONGO_URL}}, DB_NAME=voiladi, JWT_SECRET, ADMIN_API_KEY, CORS_ORIGINS=<web url>, UPLOAD_DIR=/data/uploads,
             PORT=8001, OTP_TEST_PREFIXES=+1999,+1555,+1777, TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_VERIFY_SERVICE_SID
voiladi-web: REACT_APP_BACKEND_URL=<api url>, PORT=3000

Optional: OTP_PROVIDER=dev|twilio_verify|twilio_sms (default auto-detect), TWILIO_MESSAGING_SERVICE_SID / TWILIO_FROM_NUMBER (for twilio_sms).

## Redeploy (from this repo)
```bash
# If `railway` is missing after a pod restart: curl -fsSL https://railway.com/install.sh | sh ; export PATH="$HOME/.railway/bin:$PATH"
source /app/deploy/.env.railway && export RAILWAY_API_TOKEN RAILWAY_NO_TELEMETRY=1
cd /app
railway up ./backend  --path-as-root --service voiladi-api --detach
railway up ./frontend --path-as-root --service voiladi-web --detach
railway deployment list --service voiladi-api --json | head -c 400
railway logs --service voiladi-api --lines 50
```
Changing a variable on a service triggers an automatic redeploy. To switch to GitHub auto-deploys later:
`railway service source connect --repo <owner/repo> --branch main --service voiladi-api` (set Root Directory = backend / frontend).

## Demo data & moderation (header `x-admin-key: <ADMIN_API_KEY>`)
- `GET  /api/admin/seed`    counts of sample vs real users
- `POST /api/admin/seed`    upsert 24 sample profiles (idempotent); `?likes_for=+1...` makes some of them like that account
- `DELETE /api/admin/seed`  purge ALL sample profiles + their swipes/matches/messages (do this before real launch)
- `GET  /api/admin/reports?status=open|resolved`, `POST /api/admin/reports/{id}/resolve`

## Notes
- Test-prefix numbers (+1999/+1555/+1777) log in without SMS. Remove OTP_TEST_PREFIXES on voiladi-api before a public launch.
- railway.json config-as-code is deprecated by Railway (works until 2026-12-01); settings are also applied in the dashboard.
- Custom domain: `railway domain yourdomain.com --service voiladi-web` then add the DNS records it prints; update CORS_ORIGINS on the api.

## Custom domain voiladi.com (added 2026-09-09, DNS at GoDaddy)
Railway custom domains attached: voiladi.com + www.voiladi.com -> voiladi-web, api.voiladi.com -> voiladi-api.
Required DNS records (from `railway domain status <host> --service <svc> --json`, copies in deploy/dns_*.json):
| Type  | Host (name)          | Value                                                     |
|-------|----------------------|-----------------------------------------------------------|
| CNAME | @  (voiladi.com)     | kt4522tf.up.railway.app                                   |
| CNAME | www                  | 79o52nmh.up.railway.app                                   |
| CNAME | api                  | jbpsrl5b.up.railway.app                                   |
| TXT   | _railway-verify      | railway-verify=8917ab44ccdc5a6d3a094ee88ee631c26c3e5707d28460f7eda60d3d070cedbc |
| TXT   | _railway-verify.www  | (token in deploy/dns_www.voiladi.com.json)                |
| TXT   | _railway-verify.api  | (token in deploy/dns_api.voiladi.com.json)                |
GoDaddy cannot CNAME the root (@). Recommended: move DNS to Cloudflare (free, CNAME flattening) OR keep GoDaddy and
forward voiladi.com -> https://www.voiladi.com (301) with CNAMEs for www + api only.
After DNS resolves: set voiladi-web REACT_APP_BACKEND_URL=https://api.voiladi.com (triggers rebuild) and keep CORS_ORIGINS
(already includes https://voiladi.com and https://www.voiladi.com).

### Domain status (2026-09-09 10:50 UTC)
- https://www.voiladi.com  -> voiladi-web  (cert VALID, live)          <- canonical app URL
- https://api.voiladi.com  -> voiladi-api  (cert VALID, live; web built with REACT_APP_BACKEND_URL=https://api.voiladi.com)
- http://voiladi.com       -> GoDaddy forwarding 301 -> https://www.voiladi.com (works)
- https://voiladi.com      -> GoDaddy forwarding has no TLS cert yet (TLS alert). GoDaddy usually issues one within 24-48h;
                              if it never does, move DNS to Cloudflare and add CNAME @ -> kt4522tf.up.railway.app.

## Root domain status (checked 2026-09-09 11:55 UTC)
`voiladi.com` resolves to GoDaddy forwarding (A 15.197.225.128 / 3.33.251.168). GoDaddy's DV certificate for voiladi.com is now issued,
so BOTH http://voiladi.com and https://voiladi.com return 301 -> https://www.voiladi.com with no browser warning.
The earlier "not secure" warning was GoDaddy's TLS-pending window (typically up to 24h after enabling forwarding).
If you ever want voiladi.com to be served directly by Railway (no redirect hop), move DNS to Cloudflare (free) and add the CNAME
`@ -> kt4522tf.up.railway.app` (Cloudflare flattens root CNAMEs); the root domain is already attached to voiladi-web in Railway.

## Photo uploads (2026-09-09)
Uploads are optimised server-side (backend/routes_profile.py optimize_image): EXIF orientation fixed, downscaled to max 1280px,
re-encoded JPEG q84 (WEBP when transparent), HEIC decoded via pillow-heif. Existing files on the volume are untouched.

### Cloudflare in front of the domain (2026-09-10 16:15 UTC) - fixes Jio (India) blocking of *.up.railway.app
Jio's DNS refuses to resolve *.up.railway.app, so CNAMEs to Railway were dead for every Jio user (web AND the Android app).
DNS for voiladi.com now lives at Cloudflare (Free plan, zone 1ec504b048b74b878f55e2525bfca6a1, NS piper/terry.ns.cloudflare.com).
Records (all Proxied / orange cloud, so clients only ever see Cloudflare IPs):
  CNAME @    -> kt4522tf.up.railway.app   (root served directly by Railway now; GoDaddy forwarding A records removed)
  CNAME www  -> 79o52nmh.up.railway.app
  CNAME api  -> jbpsrl5b.up.railway.app   (WebSocket /api/ws verified through Cloudflare)
  email / _domainconnect CNAMEs + MX/SPF/DMARC/SRV kept, DNS-only.
SSL mode is Full (verified by 200s end to end; token has no Zone Settings permission to read/change it).
API token (Edit zone DNS only) in deploy/.env.cloudflare (gitignored). Verify: curl -sD- https://www.voiladi.com/ | grep -i cf-ray

### 2026-09-10 19:15 UTC - security hardening + DM release
- API: security.py (rate limits per CF-Connecting-IP, security headers, 12MB body cap), login lockout (8 fails/15min),
  docs disabled in prod, WS auth via first frame (/api/ws) with legacy /api/ws/{token} kept for one release.
- Web: nginx security headers via security-headers.inc.template (included per location!). CSP connect-src needs
  WS_BACKEND_URL, derived by docker/15-derive-ws.envsh - MUST be *.envsh AND executable (chmod 755) or the nginx
  entrypoint ignores it and nginx fails with 'unknown ws_backend_url variable' (caused a 10-min outage today).
- APK v1.3.0 signed with the RELEASE keystore (android-build/voiladi-release.keystore, password in android-build/release.env,
  both gitignored - BACK THEM UP; losing them means users must reinstall). Installs of the old debug-signed APK cannot
  update in place: uninstall + reinstall once.

## Landing page phone captures
The phones on voiladi.com show REAL screenshots of the app (`frontend/public/landing/{explore,chat,likes,profile}.webp`, 390x844 @2x).
Re-capture after UI changes: log in as a fresh onboarded account (e.g. arin.landing@voiladi.com on preview, profile name Rin @rin), screenshot /explore /chats /likes /profile
at viewport 390x844 device_scale_factor=2, convert to WebP q82, then redeploy voiladi-web.
NOTE: /landing/*.webp is edge-cached for 7 days; when re-capturing, give the file a NEW name (e.g. profile-rin.webp) and update SCREENS in PhoneScreens.jsx.
