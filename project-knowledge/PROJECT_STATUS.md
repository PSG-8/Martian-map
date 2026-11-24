# Project status — last updated 2026-11-24

## v30 (LIVE on labathome-oman.vercel.app since 2026-11-24, deployment dpl_5XKZtX6gDqWQTaDgSn1T9tKb9Dy2; live-checked: phone banner loops play, business page hidden for the public, doctor sign-up, patient↔Dr. Hilal messages)
- **Business page** (`#/business`): only for admin accounts (the leader's account and the demo admin). Removed from the public top bar, footer and menu; other visitors who open the link go to the home page. Admins see it in their menu.
- **Top bar**: a link that does not fit is now hidden whole (it moves to a hidden second line) instead of being cut in half.
- **Doctors can join as partners**: "Join as partner" → Doctor (gender, licence, years, specialty incl. dentistry, wilayat). Pending until approved like other partners; approved doctors take online consultations.
- **Consultation messages and calls**: each online consultation has a message thread (checks for new messages every 4 s while open; the other side gets a notification at most every 3 minutes) and Video call / Voice call buttons (Jitsi Meet room of that consultation) for both patient and doctor. DB: table `consult_messages`, RPCs `consult_msgs`, `consult_send`; `_consult_json` now returns `room` (`project-knowledge/sql/v30_doctor_signup_chat.sql`).
- **Team accounts** (passwords given to the owner in chat, never stored in the repo): Rahaf and Alzahraa (nurses). The two extra team-doctor accounts were switched off (status `deleted`) at the owner's request; online consultations are tested with the existing doctor accounts Dr. Aisha, Dr. Hilal, Dr. Rahma and Dr. Talal (public demo password).
- **Phone banners move**: phones play short silent loops of the same 3D banner scenes as the computer (`img/hero/clip0-4.mp4`, ~0.8 MB in total, only the visible one plays; skipped on data saver, 2G and reduced motion). The pictures stay underneath as a fallback.
- **Merch**: realistic product photos (blank products made with Figma AI, then the exact site logo placed on them) in `project-knowledge/merch/`, plus print files (vector PDF + transparent PNG, colours and sizes) in `project-knowledge/merch/print/`.

## v29 (LIVE on labathome-oman.vercel.app since 2026-11-24, deployment dpl_GmynV6xFJhkRf3DwptnYyHf6E9MQ; after owner review: banners, van, team circles and videos kept as in v27/v28; new Pixar-style films kept aside in `project-knowledge/videos` for later)
- Logo: back to the **approved hexagon + flask** everywhere (header, app icons, link image, explainer). On the site it is a **hologram**: colour sweep along the lines, bubbles rising in the flask, twinkling spark; large version (splash) floats in 3D with a scan line.
- Pictures: Pixar/Disney-style art generated with Figma AI (file "iLab@home v29 art"): 5 banners × phone/desktop, the van (real logo on its side), 4 consult doctors, film scenes. Rules: women in a full, loosely draped Gulf shayla hijab; men in uniforms (nurse, dentist, courier) bare-headed — never a kumma with scrubs/coat.
- Home banners: no 3D any more; pictures on every device with a slow camera move (transform only), so phones move again.
- Sign-in/sign-up and splash: the real van (cut-out picture) drives in.
- Team: Rahaf Al Wardi and Alzahraa Al Busaidi (nurses) added on the About page, footer and presentation. Each member has an emoji-style animated job icon (developer, cybersecurity, HR, nurse; the advisor has a golden halo).
- Brand & merch page removed from the site. Exhibition mockups (graphics only, no people) are in `project-knowledge/merch/`.
- Story film rebuilt from the Pixar-style scenes with camera moves, info chips, the hologram logo and light music under the same English narration and Arabic subtitles. Dental doctors in the film and site are Dr. Rahma and Dr. Talal; Dr. Hilal is family medicine only.

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
