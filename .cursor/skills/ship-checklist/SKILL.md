---
name: ship-checklist
description: Final ship checklist before calling an app done. Use right before or after production deploy.
---

# Ship checklist

- [ ] README explains run + deploy
- [ ] No secrets in git
- [ ] Env vars documented
- [ ] QA acceptance checks run (or waivers listed)
- [ ] Security glance on auth and inputs
- [ ] Live URL responds
- [ ] Free-plan limits noted (spin-down, ephemeral disk)
- [ ] Owner told the URL and any manual dashboard steps left

Only mark shipped when the live URL check passes or the user accepts a known blocker.
