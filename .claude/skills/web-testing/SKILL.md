---
name: web-testing
description: Use when you need to actually run a website in a browser to prove a change works - scripting Playwright on phone and desktop viewports, checking JS errors, overflow and key user flows, taking screenshots. This is the how-to for running tests; for a full quality audit use web-quality-review, for releases use site-deploy-check, for unit-level work use Superpowers test-driven-development.
---

# Web testing with Playwright

Rule: never say "it works" without running it. Test locally, then live after deploy.

## Setup
- **Claude Code cloud container:** Playwright + Chromium are pre-installed: `require('playwright')` works; run scripts with `NODE_PATH=$(npm root -g) node file.js`. Do not run `playwright install`.
- **Local machine / other sandbox:** use the project's Playwright if present; otherwise `npm i -D playwright && npx playwright install chromium` (ask first - it downloads browsers).
- **No browser available (e.g. plain chat):** do not guess. Give the user the exact checklist below to run, and report the screen as untested.
- Serve a static site: `npx -y serve -l 5055 .` from the repo root (run in background).
- Keep test scripts in the session scratchpad unless the project asks to commit them.

## Minimum check for any UI change
For each changed screen, in **iPhone 13** (`devices['iPhone 13']`) and **1440×900**, in each language:
1. No `pageerror` events and no failed requests to your own origin.
2. `document.documentElement.scrollWidth - innerWidth <= 2` (no sideways scroll).
3. Main text present (`body.innerText.length > 80`) and the key element exists.
4. Screenshot at `deviceScaleFactor: 1` for yourself, `2` for screenshots the owner will see.

## Flow tests
Script the real path (open → fill → submit → see result). Use roles/test accounts, never real users. When a flow writes to a live database, clean up afterwards (cancel/delete the test record) and say so.

## Live check after deploy
(Release steps - version bump, push, approval, deploy - belong to `site-deploy-check` if available; this is only the browser part.)
- Confirm the new version is served (asset version / service-worker cache name).
- Repeat the minimum check on the production URL for phone + desktop.
- Use `waitUntil: 'domcontentloaded'` plus explicit waits; pages with video or long-polling may never reach `load`/`networkidle`.

## Reporting
List what was tested (screens × devices × languages), what passed, what failed with the error text, and attach screenshots. Untested items are stated as untested.
