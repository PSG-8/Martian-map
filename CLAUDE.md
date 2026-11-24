# iLab@home — project guide for Claude

Home lab-testing platform for North Al Sharqiyah, Oman (student business concept). Live: https://labathome-oman.vercel.app
Owner / platform developer: Bilarab Al Musallami. Team: Jokha Al Rawahi, Ansam Al Noumani, Tasnim Al Hasani. Advisor: Dr. Salim Al Rashdi.

**Read first:** `project-knowledge/PROJECT_STATUS.md` (where we stopped), then only the file you need:
- `project-knowledge/ARCHITECTURE.md` — code map, data, APIs, routes
- `project-knowledge/RUNBOOK.md` — run locally, test, deploy, render videos
- `project-knowledge/DECISIONS.md` — why things are the way they are
- `project-knowledge/DESIGN_SYSTEM.md` — colours, type, brand rules

## Hard rules
- **The GitHub repo is PUBLIC.** Never commit secrets. Secrets live only in Vercel env vars (names in ARCHITECTURE.md). Never print them.
- Never share the owner's admin password or personal email. The demo password `Demo@2026` is public.
- Do not put students' face videos in this repo.
- Brand name: **iLab@home** (Arabic: آي لاب@هوم). Instagram: @ilabathome.
- Bilarab's name comes first in every team list.
- Test before saying something works (local harness + live check). Ask before deleting data, deploying, or spending money.
- No build step: vanilla HTML/CSS/JS. Bump the asset version on every deploy (see RUNBOOK).
