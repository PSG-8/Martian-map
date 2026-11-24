# iLab@home — project tools and media sources

Companion branch to `lab-at-home` (the live site). Nothing here is deployed.

| Folder | What it is |
|---|---|
| `films/characters/` | Source of the 55 s character film: compositor page (`film.js`), still images + AI clips, voice + music, `build.sh` to rebuild |
| `tools/test/` | Local Playwright test harness with a mocked Supabase API (`SITE_DIR=/path/to/site node v25.mjs`) |
| `tools/hero-banners/` | Renders the pre-made banner images (`img/hero/*.jpg`) from `js/hero3d.js` |
| `tools/site-check/` | Live check of the deployed site (desktop + iPhone). Workflow runs when pushed to branch `site-check` |
| `tools/deploy.sh` | Bumps the asset version and pushes `lab-at-home` (paths inside are from the old cloud session — adapt) |
| `snmp/` | Bilarab's SNMP keynote (Advanced Computer Network course), single HTML file |
| `brand/` | Instagram profile pictures (A: logo + name, B: logo only) |

See `CLAUDE.md` and `project-knowledge/` on branch `lab-at-home` for the full project guide.
