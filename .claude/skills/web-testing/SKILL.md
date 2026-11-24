---
name: web-testing
description: Use when verifying a website or web app works - after any UI change, before saying something works, before and after a deploy. Drives the pre-installed Playwright on phone and desktop viewports, checks JS errors, overflow, key flows and takes screenshots. Pairs with Superpowers test-driven-development for unit-level work.
---

# Web testing with Playwright

Rule: never say "it works" without running it. Test locally, then live after deploy.

## Setup (cloud container)
- Playwright + Chromium are pre-installed: `require('playwright')` works; run scripts with `NODE_PATH=$(npm root -g) node file.js`. Do not run `playwright install`.
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
- Confirm the new version is served (asset version / service-worker cache name).
- Repeat the minimum check on the production URL for phone + desktop.
- Use `waitUntil: 'domcontentloaded'` plus explicit waits; pages with video or long-polling may never reach `load`/`networkidle`.

## Reporting
List what was tested (screens × devices × languages), what passed, what failed with the error text, and attach screenshots. Untested items are stated as untested.
