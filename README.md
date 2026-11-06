# Epoxy CRM (v1)

Self-contained CRM for an epoxy flooring / coatings company. Zero npm dependencies: Node.js >= 22.5 (uses built-in `node:sqlite`), plain HTML/CSS/JS front end. Responsive for phone and laptop.

## Run
```
node seed.js     # FIRST TIME ONLY – creates config.json, CREDENTIALS.txt, data.db with (Example) data. Re-running WIPES data.
node server.js   # PORT env var, default 3100
```
Login credentials are written to `CREDENTIALS.txt` (chmod 600). The Meta webhook reads `META_VERIFY_TOKEN`, `META_APP_SECRET`, and `META_PAGE_ACCESS_TOKEN` from the environment. Add users: currently one admin (see Known gaps).

## Features
- **Dashboard** – new leads, pipeline counts, open quotes ($), upcoming installs, revenue collected (month / all-time), outstanding balance.
- **Leads** – Kanban pipeline New → Contacted → Quoted → Won → Lost (drag & drop or edit), lead source, project type, sq ft, notes, activity log, search. "Make customer" and "Create quote →" from a lead.
- **Customers** – contact info, notes, SMS opt-in flag, full activity history (auto-logged: lead created, status changes, quotes, jobs, invoices, payments + manual notes), linked quotes/jobs/invoices.
- **Quotes** – line items (qty, unit, price) with presets for coating systems (Full Flake, Metallic, Quartz, Solid Color, Polyaspartic) and add-ons (crack repair, moisture barrier, cove base, stem wall, grinding, coating removal); discount, tax, totals; printable view (browser Print → Save as PDF); **Convert to job** (marks quote Accepted and lead Won).
- **Schedule** – monthly calendar of installs (multi-day spans), color-coded by crew, crew filter, job status (Scheduled / In Progress / Completed / On Hold / Cancelled), unscheduled list. Crews page to manage crews.
- **Invoices** – created from a job (copies quote items), deposits / progress / final payments with method and date, auto status Unpaid / Partial / Paid, balance, printable invoice.

Prices for presets and company header live in `config.json` (`coating_systems`, `addons`, `company`).

## Meta Lead Ads webhook
Endpoint: `GET|POST /api/webhooks/meta-leads` (public, no login). Set the three environment variables below on the host. Do not commit the values. If any one of them is missing, the process logs the missing name and refuses the request (403). Unverified or unsigned webhook traffic is not accepted. `config.json` cannot stand in for these variables.

1. Set the environment:
   - `META_VERIFY_TOKEN` — the verify token you enter in the Meta webhook form.
   - `META_APP_SECRET` — the app secret. Every `POST` must include `X-Hub-Signature-256` (`sha256=` plus HMAC-SHA256 of the raw body). A missing or wrong signature is rejected (401).
   - `META_PAGE_ACCESS_TOKEN` — a Page access token with `leads_retrieval`, `pages_manage_metadata`, `pages_show_list`, and `pages_read_engagement`.
2. In Meta for Developers, add **Webhooks**, choose object **Page**, and subscribe to `leadgen`.
   - Callback URL: `https://epoxy-crm-q4yu.onrender.com/api/webhooks/meta-leads`
   - Verify token: the value of `META_VERIFY_TOKEN`. The GET handshake returns `hub.challenge` as plain text only when `hub.mode` is `subscribe` and the token matches. Otherwise it returns 403.
3. Subscribe the Page to the app (`POST /{page-id}/subscribed_apps?subscribed_fields=leadgen`). A live notification includes `leadgen_id` and not the answers. The server loads `field_data` from Graph API `v25.0` (`fields=created_time,id,ad_id,form_id,field_data`). If Graph does not return `field_data`, a signed body that already includes it is stored; otherwise the lead is not inserted and the response is 502 so Meta can retry. The same `leadgen_id` is skipped (unique on `meta_lead_id`). Mapped form fields: `full_name` (or first/last), `phone_number`, `email`, `street_address` / `city` / `zip_code`, optional `project_type` and `sq_ft`.

Local handshake check (export the three variables first; do not paste the values into the repo):
```
curl "http://localhost:3100/api/webhooks/meta-leads?hub.mode=subscribe&hub.verify_token=$META_VERIFY_TOKEN&hub.challenge=123"
```
A lead `POST` must be signed with `META_APP_SECRET` over the exact raw JSON body. Sending the same `leadgen_id` again does not create a second lead.

## SMS texting (planned – not in v1)
Placeholders: `sms_messages` table (direction, to/from, body, status, twilio_sid), `customers.sms_opt_in`, and `twilio` block in config.json. Plan: Twilio number → `POST /api/sms/send` from customer/lead pages, inbound webhook `/api/webhooks/twilio` to log replies into `sms_messages` + activity history, A2P 10DLC registration required for US business texting.

## Known gaps
Single admin user (no roles/user management UI), no password reset, no email sending of quotes/invoices, PDF via browser print, no online card payments, no file/photo uploads, no backups configured (copy `data.db`).

## Configuration via env vars (for hosting)
`PORT`, `DATA_DIR` (where data.db/config.json live; point at a persistent disk), `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `META_VERIFY_TOKEN`, `META_APP_SECRET`, `META_PAGE_ACCESS_TOKEN`, `COMPANY_NAME`, `SEED_EXAMPLE=0` (skip example data). On first boot with an empty DATA_DIR the DB is created automatically.

## Deploy to Render
Push this folder to a GitHub repo (private is fine), then create a Web Service (or use `render.yaml` Blueprint): runtime Node, build `true`, start `node server.js`, env vars above. Free plan storage is ephemeral (data lost on redeploy/restart/spin-down after ~15 min idle). For persistence: Starter ($7/mo) + a persistent disk mounted at e.g. `/var/data` and `DATA_DIR=/var/data`.
