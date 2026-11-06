---
name: scaffold-app
description: Scaffold a new small web app (static or Node server) with App Factory defaults. Use when starting a greenfield app or resetting a skeleton.
---

# Scaffold app

## When to use
Starting a new app repo or adding the first runnable skeleton.

## Steps
1. Confirm static vs Node server with the product plan.
2. **Static:** `index.html`, `style.css`, `app.js` (or equivalent), optional `manifest.json` / service worker for phone installs.
3. **Node:** `server.js` on `0.0.0.0` + `PORT`, `package.json` with `"engines": {"node": ">=22"}`, `public/` for static assets, `render.yaml` stub.
4. Add `.gitignore` excluding `node_modules`, `data.db*`, `.env`, `CREDENTIALS*`, `*.log`.
5. Copy or keep App Factory `.cursor/` + `AGENTS.md`.
6. Write a 10-line README: run locally, deploy, env vars.

## Done when
`npm start` or opening `index.html` / `node server.js` shows the empty shell without errors.
