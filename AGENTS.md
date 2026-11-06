# AGENTS.md — App Factory

You are working in an app built with the App Factory pack.

## Role routing

Delegate with the matching `.cursor/agents/` subagent when the task fits:

- Product / scope / acceptance → `product`
- UI / CSS / client JS → `frontend`
- Server / DB / API / webhooks → `backend`
- Tests / smoke / verify → `qa`
- Auth / secrets / XSS / injection → `security` (prefer readonly)
- Deploy / Render / env / health → `ship`

Load the matching skill under `.cursor/skills/` before doing that kind of work.

## Hard rules

1. Free Render only unless the user explicitly approves paid.
2. Never commit secrets, `.env`, or credential files.
3. Prefer small PRs; one concern per branch.
4. After backend or frontend changes, leave clear how to run and test locally.
5. Ephemeral free-plan disks lose data on restart — warn when SQLite is used without a paid disk.

## Stack defaults

- Node `>=22` when a server is needed (`node:http`, built-in `node:sqlite` is fine for prototypes)
- Static HTML/CSS/JS for simple games and marketing sites
- `render.yaml` Blueprint for Render services
- Hash-routed or simple multi-page UIs are fine; no framework required unless the product asks for one
