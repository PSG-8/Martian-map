# Runbook

## Run locally
Any static server from the repo root, e.g. `npx serve .` then open http://localhost:3000. The app talks to the live Supabase project.
Local test harness with a mocked API: branch `project-tools` → `tools/test/harness.mjs` (set the site path inside; uses Playwright + Chrome).

## Deploy (what was done every release)
1. Bump the version N everywhere: `?v=N` in `index.html` and `sw.js`, `const V = 'lah-vN'` in `sw.js`, `const APP_V = N;` in `js/app.js`. (`project-tools/tools/deploy.sh N "message"` does this.)
2. Commit + push branch `lab-at-home`.
3. Create a production deployment in Vercel for that commit (Vercel MCP `create_deployment`, project lab-at-home) or from the Vercel dashboard.
4. Live check: `project-tools/tools/site-check/check.mjs` (desktop + iPhone emulation: home, videos, /questions/, /present/, team). Pushing it to branch `site-check` runs it in GitHub Actions.

## Videos
- Explainer: edit branch `film-ex` and push → GitHub Actions renders (Kokoro TTS voice `am_michael`, warp timing, 4 parallel workers) → result on branch `explainer-out`.
- Character film: `project-tools/films/characters/build.sh` (needs node, playwright, ffmpeg, Chrome). Copy `out/web.mp4` to `media/iLabAtHome_Characters.mp4`.
- Hero banners: `project-tools/tools/hero-banners/snap.mjs` renders `img/hero/*.jpg` from `js/hero3d.js`.

## Known limits of the old chat environment (not an issue in Claude Code)
No internet from the shell (only GitHub), so rendering was done through GitHub Actions.

## v28 notes
- Banners: `project-tools/tools/hero-banners` renders both sizes; v28 used sizes `m` 780×1200 (ox −0.1, oy 0.14, fov 48) and `d` 1920×760 (ox 0.2, oy 0, fov 30), then WebP copies (quality 72/76) next to the JPGs.
- Story film: see VIDEOS.md. Kokoro model files come from Hugging Face (`fastrtc/kokoro-onnx`); the cloud environment "Martian-map" allows the Hugging Face hosts.
- Local tests: a mock API plus a live mode against the real Supabase with demo accounts; checks every screen as every role on phone and desktop for JS errors and sideways overflow.

## v31 notes
- Deploy order: push → Vercel production deploy → run `project-knowledge/sql/v31_d_go_live.sql` → live check (phone + desktop).
- Local harness: the scratch mock gained v31 RPCs (`mock_v31.cjs`); the sweep visits the new screens for every role.
- Video build: HTML + GSAP timeline rendered frame by frame with Playwright (30 fps), Kokoro narration per scene, music synthesised in Python, ffmpeg loudnorm −16 LUFS.
## v32 notes
- Button sweep: `clicksweep.js` (scratch harness) taps every button/link on every screen per role, phone + desktop; `menucheck.js`, `cspost.js`, `jumpcheck.js`, `idlecpu.js` cover the reported bugs. Re-run before deploys that touch the UI.
- Banner pictures and phone loops come from the 3D scenes: `hb/snap32.mjs` (SETS m / d / r) and `hb/clips32.mjs` (780×1200, 7 s, 30 fps), then WebP/JPEG via Pillow.
- Guide video: TTS clips first (`vid32w/tts.py`), the screen recording uses their lengths as time budgets (`record.js`, Chrome screencast at 2× with `--force-device-scale-factor=2`), then `compose.py` (ffmpeg overlays + music + loudnorm).
- Film: `vid32f/` — `script.json` → `tts.py` → `film.js` (GSAP timeline, letterbox, grain, vignette) → `render.js` frames → `music.py` → ffmpeg.
## v33 security notes
- Database changes: write them as `CREATE OR REPLACE` / exact text replacements that fail loudly, try them first in one query that ends with `raise exception 'DRYRUN_OK …'` (everything rolls back, the message carries the checks), then apply with a migration.
- Demo isolation: any new screen that lists people's data must filter with `public._demo_ok(viewer, owner_user_id)` (a demo viewer sees demo owners only). New internal helpers: `revoke all on function … from public, anon, authenticated`.
- Headers: `vercel.json` has the Content-Security-Policy. A new outside service (script, font, image, API) must be added there, then run `cspsweep.js` (scratch harness: every screen with the production CSP, reports violations).
- Partners are approved by the owner (Admin → Users → approve). `settings.auto_approve_minutes` is JSON null on purpose.
