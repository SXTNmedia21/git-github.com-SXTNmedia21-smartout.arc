---
title: "Handoff — tooling-optimization"
feature: tooling-optimization
branch: feat/tooling-optimization
closed: 2026-04-06
module: developer-experience
---

# Handoff — tooling-optimization

## Summary

Optimized Claude Code's developer tooling for the Smartout monorepo. Introduced "authority skills" model where domain knowledge lives in repo-local skills (loaded on-demand) instead of always in CLAUDE.md. Slimmed CLAUDE.md from 566 to 351 lines. Cleaned up 17 irrelevant global skills, fixed 5 symlinks, removed 2 duplicate plugins, added n8n + Sentry MCP servers.

## What Was Done

- [x] Created 4 authority skills: smartout-database-guide, smartout-cascade-developer, smartout-edge-function-guide, smartout-nordic-split
- [x] Moved 5 skills from global to repo-local: secrets-protocol, linear-protocol, project-lifecycle, task-stacking, project-development
- [x] Slimmed CLAUDE.md from 566 to ~351 lines with 5 skill pointers
- [x] Deleted 17 irrelevant global skills (GSAP, n8n-detailed, flow-authoring, etc.)
- [x] Fixed 5 WSL symlinks (framer-motion, vercel-\*, web-design-guidelines)
- [x] Removed stale repo skill files (agent-scoring, journey, mission, roadmap) + ui-ux-pro-max duplicate
- [x] Added n8n and Sentry MCP server config to settings.local.json
- [x] Removed 2 duplicate plugins (code-review, frontend-design from claude-plugins-official)
- [x] Verified claude-mem already installed (v11.0.1)
- [x] Ran council review — APPROVE WITH CHANGES
- [x] Applied council fixes: restored decision log, Event Engine handlers, telemetry registry, subdomain routing
- [ ] smartout-agent-dev full rewrite (deferred to separate branch)

## Decisions Made

| Decision                                                                      | Reason                                                                   | Impact                                                              |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------- |
| Authority skills model — domain knowledge IN skills, CLAUDE.md points to them | Reduce always-loaded context, single source of truth per domain          | All agents get lighter CLAUDE.md, domain context on-demand          |
| Keep "What NOT To Do" in CLAUDE.md, not in skills                             | Guardrails must be always-loaded, never gated by triggers                | Safety rules always visible regardless of task type                 |
| Defer smartout-agent-dev rewrite to separate branch                           | Skill is 601 lines, severely outdated, needs System Steward verification | Stale skill disabled with one-liner pointing to actual code         |
| Event Engine + Telemetry + Subdomain routing stay in CLAUDE.md                | Short, high-signal, cross-cutting — no good single skill trigger         | 4 lines added back to CLAUDE.md after council review caught removal |

## Learnings

| Learning                                                                     | Context                                                                    |
| ---------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Content removal during refactoring must have a destination checklist         | Council caught 3 items removed from CLAUDE.md without landing in any skill |
| Authority skills beat pointer skills beat content duplication                | Single source of truth per domain, loaded on demand                        |
| Stale skills are worse than no skills                                        | Wrong ADR numbers and outdated paths cause confident but incorrect work    |
| Global file operations (rm -rf on ~/.claude/) blocked by Claude Code sandbox | User must run these commands manually via `!` prefix                       |

## Known Issues / Debt

- `smartout-agent-dev` global skill disabled but not rewritten — needs separate branch
- `secrets-protocol` is 366 lines — could be trimmed
- `tool-index` global skill needs n8n/Sentry/claude-mem entries added (user step)
- `frontend-designer` agent could reference `smartout-nordic-split` skill
- 5 moved skills' global copies already removed by user
- Cross-cutting skill trigger gap (e.g., cascade + Edge Functions) has no automated mitigation yet

## Next Steps

- Create `feat/agent-dev-skill-rewrite` branch for smartout-agent-dev full rewrite
- Write ADR for authority skills model (decision #11 in log)
- Trim secrets-protocol in follow-up PR
- Update tool-index and frontend-designer agent (global files, user steps)
