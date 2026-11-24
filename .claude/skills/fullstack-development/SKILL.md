---
name: fullstack-development
description: Use when building or changing a feature end to end - database table or RPC, API client, UI screen, and the test that proves it works. Covers the order of work and the done-checklist for web apps (vanilla JS/PWA, React/Next.js, Supabase, Vercel).
---

# Full-stack feature work

Build features as a vertical slice: data → API → UI → test → docs. Small, shippable, verified.

## Order of work
1. **Read the project guide** (`CLAUDE.md`, `project-knowledge/PROJECT_STATUS.md`, then only the file you need).
2. **Database first.** Write the migration as a file in `project-knowledge/sql/` (or `supabase/migrations/`), apply it, then test the RPC directly with SQL: happy path, wrong user, bad input. Keep RLS on; expose only `SECURITY DEFINER` functions with explicit permission checks; revoke internal helpers from `anon`.
3. **API client.** One function per RPC in the API layer, with a timeout; reads retry once; errors map to stable codes and translated messages.
4. **UI.** Follow the design system (`DESIGN_SYSTEM.md`). Every screen has loading, empty, error and success states, works in both languages (RTL for Arabic) and at 375 px phone width. Never trust the client for prices, roles or status.
5. **Test.** Run the local harness (mock and live where available) on phone and desktop; check zero JS errors and zero sideways overflow. Use the `web-testing` skill.
6. **Ship hygiene.** Bump the asset version when the project needs it, update `PROJECT_STATUS.md`, commit with a clear message. Deploy only after the owner approves.

## Rules that prevent most bugs
- Validate on the server; the client only improves UX.
- Escape all user text before inserting HTML (`esc()`); never build HTML from raw input.
- Clean up timers/listeners when a view changes.
- Dates: store UTC, display in the user's time zone (`Asia/Muscat` here).
- Money: integers or fixed decimals, computed on the server.
- Feature flags or role checks in one helper (e.g. `canBiz()`), not scattered.

## Done means
- [ ] Migration file committed and applied; RPCs tested with SQL.
- [ ] UI works phone + desktop, AR + EN, no console errors.
- [ ] Docs updated; no secrets in the diff.
