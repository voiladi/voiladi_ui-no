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
