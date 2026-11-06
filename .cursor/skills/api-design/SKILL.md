---
name: api-design
description: Design and implement small HTTP JSON APIs. Use when adding or changing backend routes, schemas, or webhooks.
---

# API design

## Conventions
- JSON request/response; consistent error shape `{ "error": "..." }`.
- Validate all inputs; reject unknown required fields early.
- Auth via session cookie or bearer token already used in the repo — do not invent a second auth system.
- Webhooks: verify signatures before mutating state; store provider event ids for idempotency.
- Migrations: additive schema changes preferred; document breakages.

## Deliverable
List new routes (method + path + purpose), env vars, and a curl example per route in the PR body.
