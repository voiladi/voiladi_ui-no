# Voiladi — Railway deployment runbook

Live:
- Web  https://voiladi-web-production.up.railway.app
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
