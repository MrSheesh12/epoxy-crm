# Epoxy CRM (v1)

Self-contained CRM for an epoxy flooring / coatings company. Zero npm dependencies: Node.js >= 22.5 (uses built-in `node:sqlite`), plain HTML/CSS/JS front end. Responsive for phone and laptop.

## Run
```
node seed.js     # FIRST TIME ONLY – creates config.json, CREDENTIALS.txt, data.db with (Example) data. Re-running WIPES data.
node server.js   # PORT env var, default 3100
```
Login credentials and the Meta verify token are written to `CREDENTIALS.txt` (chmod 600). Add users: currently one admin (see Known gaps).

## Features
- **Dashboard** – new leads, pipeline counts, open quotes ($), upcoming installs, revenue collected (month / all-time), outstanding balance.
- **Leads** – Kanban pipeline New → Contacted → Quoted → Won → Lost (drag & drop or edit), lead source, project type, sq ft, notes, activity log, search. "Make customer" and "Create quote →" from a lead.
- **Customers** – contact info, notes, SMS opt-in flag, full activity history (auto-logged: lead created, status changes, quotes, jobs, invoices, payments + manual notes), linked quotes/jobs/invoices.
- **Quotes** – line items (qty, unit, price) with presets for coating systems (Full Flake, Metallic, Quartz, Solid Color, Polyaspartic) and add-ons (crack repair, moisture barrier, cove base, stem wall, grinding, coating removal); discount, tax, totals; printable view (browser Print → Save as PDF); **Convert to job** (marks quote Accepted and lead Won).
- **Schedule** – monthly calendar of installs (multi-day spans), color-coded by crew, crew filter, job status (Scheduled / In Progress / Completed / On Hold / Cancelled), unscheduled list. Crews page to manage crews.
- **Invoices** – created from a job (copies quote items), deposits / progress / final payments with method and date, auto status Unpaid / Partial / Paid, balance, printable invoice.

Prices for presets and company header live in `config.json` (`coating_systems`, `addons`, `company`).

## Meta Lead Ads webhook
Endpoint: `GET|POST /api/webhooks/meta-leads` (public, no login).
1. Deploy the app on a public HTTPS URL (Meta requires HTTPS).
2. In Meta for Developers create an app → add **Webhooks** product → object **Page** → subscribe to field `leadgen`.
   - Callback URL: `https://YOUR-DOMAIN/api/webhooks/meta-leads`
   - Verify token: value of `meta_verify_token` in `config.json` (also in CREDENTIALS.txt). The GET handshake echoes `hub.challenge` when the token matches, else 403.
3. Set `meta_app_secret` in `config.json` → POSTs are verified with `X-Hub-Signature-256` (leave blank only for local testing).
4. Real Meta webhooks only send `leadgen_id`; set `meta_page_access_token` (Page token with `leads_retrieval`, `pages_manage_metadata`, `pages_show_list`, `pages_read_engagement`) so the server fetches the lead's `field_data` from the Graph API. Subscribe the Page to the app (`POST /{page-id}/subscribed_apps?subscribed_fields=leadgen`). Test with Meta's **Lead Ads Testing Tool**.
5. Mapped form fields: `full_name` (or first/last), `phone_number`, `email`, `street_address`/`city`/`zip_code`, optional custom `project_type`, `sq_ft`. Duplicate `leadgen_id`s are ignored. Restart the server after editing config.json.

Local test:
```
curl "http://localhost:3100/api/webhooks/meta-leads?hub.mode=subscribe&hub.verify_token=TOKEN&hub.challenge=123"
curl -X POST http://localhost:3100/api/webhooks/meta-leads -H 'Content-Type: application/json' \
 -d '{"object":"page","entry":[{"changes":[{"field":"leadgen","value":{"leadgen_id":"1","field_data":[{"name":"full_name","values":["Test"]},{"name":"phone_number","values":["555-0000"]}]}}]}]}'
```

## SMS texting (planned – not in v1)
Placeholders: `sms_messages` table (direction, to/from, body, status, twilio_sid), `customers.sms_opt_in`, and `twilio` block in config.json. Plan: Twilio number → `POST /api/sms/send` from customer/lead pages, inbound webhook `/api/webhooks/twilio` to log replies into `sms_messages` + activity history, A2P 10DLC registration required for US business texting.

## Known gaps
Single admin user (no roles/user management UI), no password reset, no email sending of quotes/invoices, PDF via browser print, no online card payments, no file/photo uploads, no backups configured (copy `data.db`).

## Configuration via env vars (for hosting)
`PORT`, `DATA_DIR` (where data.db/config.json live; point at a persistent disk), `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `META_VERIFY_TOKEN`, `META_APP_SECRET`, `META_PAGE_ACCESS_TOKEN`, `COMPANY_NAME`, `SEED_EXAMPLE=0` (skip example data). On first boot with an empty DATA_DIR the DB is created automatically.

## Deploy to Render
Push this folder to a GitHub repo (private is fine), then create a Web Service (or use `render.yaml` Blueprint): runtime Node, build `true`, start `node server.js`, env vars above. Free plan storage is ephemeral (data lost on redeploy/restart/spin-down after ~15 min idle). For persistence: Starter ($7/mo) + a persistent disk mounted at e.g. `/var/data` and `DATA_DIR=/var/data`.
