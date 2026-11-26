# iLab@home checker (`tools/qa`)

Runs the real site files locally, answers the database calls with a fake database (`mock*.cjs`, demo data only),
and drives Chromium (Playwright) like a person on many devices. Nothing here is deployed (`tools` is in `.vercelignore`).

```bash
tools/qa/run-all.sh          # quick: back button, storage, menus, buttons (~6 min)
tools/qa/run-all.sh full     # + every screen on 20 devices (~45 min)
```

| Checker | What it proves |
|---|---|
| `backtest.js` | App Back and phone Back for the owner, patient, staff, doctor, signed-out visitor: never stuck, never bounces into a redirect, never leaves the site from a WhatsApp/Instagram link, sign-in screen not left in history |
| `storechk.js` | Site still opens when saved data is damaged (old cart format, broken JSON) or when the browser blocks storage (Instagram/WhatsApp in-app browsers) |
| `menutest.js` | Every main-menu item for every account type on a Samsung phone and a 1366×768 laptop opens its screen (no silent redirect, no error, menu closes) |
| `clicksweep.js [role] [m\|d]` | Every button and link on every screen: covered by something? does tapping it do anything? |
| `devmatrix.js <group> <groups>` | Every screen × every account × 20 devices: Galaxy S24 (Samsung Internet), A55, S8, S9+ (320 px), Z Flip 7/Fold 7 covers, Fold 7 open, Tab S9, Huawei (Huawei Browser), Redmi (MIUI Browser), Pixel 7, large-text phone (300 px), iPhone SE 1/3, iPhone 15 Pro Max, iPad Mini, iPad Pro landscape, Galaxy landscape, 1280×720 and 1920×1080. Checks sideways scroll, buttons off-screen, buttons covered, cut text, text over pictures/characters/other text, small tap targets, JS errors. One screenshot per problem in `out/devices/` |
| `squeeze.js` (`WIDTHS=320,384`) | Sentences squeezed into a one-word-per-line column because a button or picture beside them takes the room, every screen x every account, Arabic + English |
| `narrow.js role:route …` | Which element is the first to stick out at width `W` (default 300) |
| `perfchk.js [url]` | Smoothness on a slowed-down (4×) Galaxy A-series: first paint, blocking time, janky frames while scrolling |

Accounts in the fake database: `patient`, `nurse`, `courier`, `lab`, `company`, `doctor`, `admin` (demo), `leader` (the owner), `staff`.
Point `QA_BASE` at another server to test it (only public screens work against the live site).
