---
name: render-deploy
description: Deploy or update an app on Render's free plan using render.yaml and GitHub. Use when going live or fixing deploy config.
---

# Render deploy

## Defaults
- Free web service or static site
- Node: build often `true` or `npm install` / `npm run build`; start `node server.js`
- Bind `0.0.0.0` and `process.env.PORT`
- `NODE_VERSION` 22.x when using modern Node APIs
- Secrets: `sync: false` in Blueprint; set in dashboard
- Free disk is ephemeral — call that out for SQLite

## Steps
1. Update `render.yaml` if needed.
2. Push to the connected GitHub branch (usually `main`).
3. Trigger or wait for deploy; fix build/start errors from logs.
4. Curl the live URL (cache-bust if static) and report status + URL.

## Never
Upgrade to paid, add a disk, or enable paid add-ons without the user's explicit approval.
