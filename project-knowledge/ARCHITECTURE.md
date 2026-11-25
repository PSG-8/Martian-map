# Architecture

## Front end (no build step, PWA)
- `index.html` loads `css/app.css` and `js/*.js` with `?v=<N>` cache-busting.
- `js/app.js` (~2300 lines, one IIFE): router (hash routes like `#/`, `#/how`, `#/new`, `#/about`, `#/register`, `#/app/...`), all views, i18n additions via `Object.assign(I18N.en/ar, {...})`. New code goes **before** `async function boot(){`.
- `js/i18n.js` EN/AR strings (Arabic is RTL). `js/api.js` calls Supabase RPCs. `js/art.js` logo/illustrations. `js/hero3d.js` three.js banners (vendor three r160 in `js/vendor/`). `js/qr.js` QR codes. `js/pdf.js` result reports. `js/guide.js` result levels (normal / review / urgent).
- v28 sections at the end of app.js: consultations (`viewConsultPublic`, `viewConsultNew`, `viewConsults`, `viewConsult`), `viewBusiness`, `viewBrand`, `vanStrip`. Routes `#/consult`, `#/dental`, `#/business`, `#/brand`, `#/app/consult[/new|/<id>]`.
- Results: `prA()` picks the person's range (adult women `f`, children under 16 `k`), `flagFor()` / `resFlag()` add the "slightly" marker; `LAHGUIDE.assess` matches the database rules.
- `api.js`: every call has a time limit (reads 9 s + one retry, writes 20 s). Catalog and signed-in profile are cached in localStorage (`lah_cat_v2`, `lah_user`) and refreshed in the background.
- `sw.js` service worker: network-first for pages; versioned assets cached; skips `/media/` and Range requests (video).
- `img/hero/h{0-4}{d,m}.jpg` pre-rendered banners (d = desktop 1920x760, m = mobile 780x1200).

## Back end
- Supabase Postgres, every table has RLS on; the app only calls `SECURITY DEFINER` RPCs that check a session token + role.
- Tables: consults (v28), app_users, sessions, login_attempts, tests, packages, programs, orders, order_events, notifications, waitlist, settings, support_tickets, private_config, push_subs, email_tokens, reset_tokens, kit_items, nurse_kit, kit_requests.
- Roles: patient, nurse, courier, lab, company, doctor, admin. Demo accounts `<role>@demo.labathome.om` / `Demo@2026`.
- Analyte fields: lo/hi normal, rlo/rhi "slightly outside" band, clo/chi critical, `f` female and `k` child overrides, `nod` = never random-positive in demo. Trigger `_orders_severity` writes f/m/c/r per result and the order severity. SQL of v28 in `project-knowledge/sql/`.
- Consult RPCs: doctors_list, consult_create, consult_list, consult_get, consult_action; business_public (money settings).
- Vercel functions in `api/`: `mail.js` (email + password reset), `push.js` (web push), `google.js` (Google sign-in), `chat.js` (AI assistant via AI Gateway).
- Env var NAMES (values only in Vercel): MAIL_HOST, MAIL_PORT, MAIL_USER, MAIL_PASS, MAIL_FROM, VAPID_PUBLIC, VAPID_PRIVATE, PUSH_SECRET, GOOGLE_CLIENT_ID, AI_GATEWAY_API_KEY.

## Other pages
- `present/index.html` — fixed 1600x900 stage scaled to the window; keyboard/swipe; N notes, F fullscreen.
- `questions/index.html` — same engine, 9 slides.

## v31 additions
- Front end: `js/motion.js` (window.FX: scan, flyToCart, celebrate, stamp, alert, ride), `vendor/gsap/*`, `vendor/confetti/*`. New routes: `#/sources`, `#/expat`, `#/r/<token>`, `#/app/loyalty`, `#/app/privacy`, `#/app/camps`, `#/app/admin/safety|coupons|camps`.
- Tables: `coupons`, `coupon_uses`, `report_views`, `privacy_requests`, `sample_scans`, `sos_alerts`, `incidents`, `share_links`, `camp_requests`; columns `tests.collection`, `orders.mode`, `orders.disc`.
- RPCs: `my_loyalty`, `referral_apply`, `coupon_check`, `admin_coupons`, `admin_coupon_save`, `my_privacy`, `privacy_request`, `my_data_export`, `admin_privacy`, `admin_privacy_done`, `sample_log`, `sos_raise`, `incident_report`, `admin_safety`, `admin_safety_close`, `share_create`, `share_revoke`, `share_get` (anon), `my_trends`, `camp_create`, `camps_mine`, `admin_camps`, `camp_update`. Internal: `_loyalty`, `_coupon_amount`, trigger `_order_event_after`.
- SQL files: `project-knowledge/sql/v31_a_schema.sql`, `v31_b_core.sql`, `v31_c_rpcs.sql`, `v31_d_go_live.sql`.

## v32 additions
- `js/mascot.js` (window.LAHMascot: show, hide, cheer, place) — loaded by `mascotSync()` in app.js on `#/` and the patient home only.
- `js/motion.js` no longer loads ScrollTrigger; reveals, counters and line drawings use one IntersectionObserver (`watch()`), content is never pre-hidden.
- `js/api.js`: `API.abortReads()` cancels in-flight reads (not catalog / auth_me) when a new render starts; such calls fail with code `ABORTED`, which `errMsg()` / `toast()` ignore.
- Hero: `heroSlides()` items carry `a` = picture / clip / 3D scene number; `js/hero3d.js` BUILD has 9 scenes (5 self-kit, 6 loyalty, 7 doctor online, 8 companies) and mirrors the camera offset for `dir=rtl`. Pictures: `img/hero/h{n}d|r|m.(webp|jpg)`, phone loops `clip{n}.mp4`.
- Home extras: `journeyBlock()`, `featBlock()`, `faqBlock()`, `ctaBlock()`, `bindHomeFx()`; `placeMenu()` positions the desktop dropdown; `copyText()`; `holoWake()/holoCalm()` rest the logo animation.
- Videos: `VIDS` = story (idea), how (guide), film.
