---
name: write-tests
description: Add or extend automated tests and smoke checks. Use when verifying features or before ship.
---

# Write tests

## Approach
1. Prefer the repo's existing test runner; if none, a small Node script or Playwright smoke is fine.
2. Cover the acceptance checks from product first, not implementation details.
3. Keep tests deterministic; no live network unless the skill is explicitly integration.
4. Record how to run them in README or package.json scripts.

## Report
Pass/fail counts and how to re-run. Failed tests get a one-line repro.
