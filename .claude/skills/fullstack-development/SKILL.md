---
name: fullstack-development
description: Use when building or changing a feature end to end - database table or RPC, API client, UI screen, and the test that proves it works. Covers the order of work and the done-checklist for web apps (vanilla JS/PWA, React/Next.js, Supabase, Vercel).
---

# Full-stack feature work

Build features as a vertical slice: data → API → UI → test → docs. Small, shippable, verified.

## Order of work
1. **Read the project guide** (`CLAUDE.md`, plus any status/architecture docs it points to). Project rules there override this skill.
2. **Database first.** Write the migration as a file in the project's migrations folder (e.g. `supabase/migrations/`), apply it, then test the RPC directly with SQL: happy path, wrong user, bad input. Keep RLS on; expose only `SECURITY DEFINER` functions with explicit permission checks; revoke internal helpers from `anon`.
3. **API client.** One function per RPC in the API layer, with a timeout; reads retry once; errors map to stable codes and translated messages.
4. **UI.** Follow the project's design system if it has one. Every screen has loading, empty, error and success states, works in every supported language (mirror the layout for RTL languages) and at 375 px phone width. Never trust the client for prices, roles or status.
5. **Test.** Run the project's tests or a browser check on phone and desktop; check zero JS errors and zero sideways overflow. Use the `web-testing` skill.
6. **Ship hygiene.** Bump cache/asset versions if the project uses them, update the status doc, commit with a clear message. Deploy only after the owner approves.

## Rules that prevent most bugs
- Validate on the server; the client only improves UX.
- Escape all user text before inserting HTML; never build HTML from raw input.
- Clean up timers/listeners when a view changes.
- Dates: store UTC, display in the user's time zone.
- Money: integers or fixed decimals, computed on the server.
- Feature flags and role checks in one helper, not scattered.

## Done means
- [ ] Migration file committed and applied; RPCs tested with SQL.
- [ ] UI works phone + desktop, every supported language, no console errors.
- [ ] Docs updated; no secrets in the diff.
