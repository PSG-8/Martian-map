# Project status — last updated 2026-11-24

## v28 (branch `lab-at-home`, pushed; production deploy waits for the owner's OK)
- **Speed & stability**: every API call has a time limit (reads retry once) so a weak signal never freezes the app; the app opens at once from the saved profile and catalog; a weak signal no longer signs people out; thin progress line on every tap; cart badge on the phone tab bar; stale cart items are dropped.
- **Maps**: always under the bars/buttons (own layer), fixed height, booking map is tap-to-pin on phones (page scroll works), no wheel-zoom hijack on desktop; Leaflet loads only on map screens; Google Fonts no longer block loading.
- **Home banner**: WebP pictures loaded one slide ahead, no forced layout / blur animation; desktop 3D at lower pixel ratio, pauses while scrolling, scenes prebuilt when idle. Banners re-rendered with the new logo.
- **Result reading** (database + app): ranges for adult women and children, a "slightly outside" band that stays *normal with tips*, critical limits only for real emergencies (HbA1c is never "urgent"; eGFR ≥ 60 normal; vitamin D 20–29 slightly low). Old orders were re-read with the new rules (values unchanged).
- **New tests**: premarital package (CBC, Hb electrophoresis, G6PD, HBsAg, anti-HCV, HIV, TPHA) + "coming soon" DNA tests (couple carrier test, NIPT, pharmacogenomics, family genetic panels) and home teeth cleaning.
- **Consultations**: `#/consult`, `#/dental`, `#/app/consult` — before tests (4.000), after results (3.000, free when results need attention), online dentist (4.000), home dental check (12.000). Doctors: Dr. Aisha Al Balushi (female), Dr. Hilal Al Harthy (male), dentists Dr. Rahma Al Shukaili (female), Dr. Talal Al Riyami (male). Video via meet.jit.si link; chat via WhatsApp. Doctor finishes with advice + suggested tests → patient adds them to the cart in one tap.
- **Business**: `#/business` page (idea, goals, per-order split, monthly P&L slider, nurse income calculator, rules). Money settings in DB: nurse 3.000/visit + level bonus, courier 1.000, kit 0.500, lab 65% of tests, card 2.5%. Admin payments shows every party's share and the platform margin.
- **Brand**: new logo (roof + blood drop + cross + orange dot) everywhere, brand spelled **iLab@home**, new app icons and link image, `#/brand` page with logo versions and 16 merchandise mockups, the van drives in on sign-in/sign-up.
- **Videos**: AI character film removed; new motion-graphics film `media/iLabAtHome_Story.mp4` (56 s, English narration by Kokoro `am_michael`, Arabic + English subtitles burned in, 4 MB). Explainer re-rendered with the new logo, same narration.

## Open / next
1. Production deploy of v28 (owner approval) + live check on a real phone.
2. Google sign-in: code ready; the owner must create an OAuth Web client in Google Cloud and add `GOOGLE_CLIENT_ID` in Vercel (authorised origin `https://labathome-oman.vercel.app`).
3. Sentry still not installed.
4. App screenshots inside the explainer still show the v27 app (small logo); refresh them when the UI settles.
5. Real doctor/nurse/lab contracts: all names and money figures are planning/demo values.

## Where everything is
| Thing | Location |
|---|---|
| Site source (deployed) | branch `lab-at-home` (repo root = site) |
| Database changes of v28 | `project-knowledge/sql/` (applied to Supabase) |
| Story film source | scratch build (HTML frames + Kokoro); script in `project-knowledge/VIDEOS.md` |
| Explainer video source + CI render | branch `film-ex` (workflow renders on push → branch `explainer-out`) |
| Character film source (retired), test harness, hero-banner renderer, live-check, deploy script | branch `project-tools` |
| Database | Supabase project `ufykiqxsegyuyablrjsq` |
| Hosting | Vercel project `lab-at-home` (team starseekers), domain labathome-oman.vercel.app |
