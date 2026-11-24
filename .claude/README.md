# Claude Code setup for this repo

Loaded automatically by Claude Code in any session opened on this repo. Contains no secrets (the repo is public).

## Skills (`skills/`)
| Skill | Use it for |
|---|---|
| software-architecture | stack/module/data-model/API decisions, decision records |
| fullstack-development | a feature end to end: SQL → API → UI → test → docs |
| ui-ux-design | flows, layout, copy, accessibility, RTL, review checklist |
| ai-engineering | LLM features: prompts, RAG, agents, evals, safety |
| ai-automation | scheduled jobs, webhooks, notifications, AI steps in pipelines |
| web-testing | Playwright checks on phone + desktop before saying "it works" |
| security-baseline | secrets, RLS/RPC permissions, health data, release checklist |

Not duplicated on purpose: code review → `/code-review` and Superpowers; debugging and TDD → Superpowers; security diff review → `/security-review`; research → `deep-research`; visual design craft → frontend-design plugin.

## Subagents (`agents/`)
`code-reviewer`, `qa-tester`, `security-auditor`, `researcher`. The reviewers and auditor are read-only.

## Hooks (`settings.json`, scripts in `hooks/`)
| When | What | Effect |
|---|---|---|
| Before Edit/Write | `secret-scan.js` | blocks text that looks like an API key, token, private key, DB URL with password or a hard-coded password literal |
| Before `git commit` | `secret-scan.js` | scans the staged diff, blocks the commit on a finding |
| After Edit/Write of `.js` | `check-js.js` | `node --check`; reports syntax errors back (never reformats) |

Manual scan of the whole repo: `node .claude/hooks/secret-scan.js --scan-tree`.
A false positive? Adjust the rule in `hooks/secret-scan.js` - never paste the real value to test it.
