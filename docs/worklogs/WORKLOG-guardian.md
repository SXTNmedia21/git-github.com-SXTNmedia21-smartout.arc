---
title: "Worklog — guardian"
status: in_progress
updated: 2026-03-14
created: 2026-03-03
module: ai
tags: [guardian, capability, stage-engine]
---
# Worklog — guardian
> Branch: `feat/guardian` | Worktree: wt-1 | Started: 2026-03-03

## Status: 🟡 In Progress

## Done
- [x] guardian_signal table migration (20260314000000)
- [x] engine_authority_config seed for guardian capability
- [x] Add "guardian" to CapabilityName union type
- [x] Add "guardian" to Situation union type
- [x] Add "guardian" to intent classifier Zod enum + LLM prompt
- [x] Add guardian SITUATION_ADJUSTMENTS in posture.ts
- [x] Create guardian capability tools (get_signals, acknowledge_signal, get_workspace_health)
- [x] Create guardian capability definition (index.ts)
- [x] Register guardian in capability registry
- [x] Add ./capabilities/guardian package.json export
- [x] Add guardian → situation mapping in agent-router.ts
- [x] Engine-architect review — all critical/important issues fixed

## Remaining
- [ ] RLS: Add API key policy on guardian_signal (for workspace-api consumers)
- [ ] RLS: Add UPDATE policy for JWT users on guardian_signal
- [ ] Guardian sweep Edge Function (other agent)
- [ ] Dashboard UI for guardian signals (other agent)
- [ ] Signal expiry cleanup job (other agent)
- [ ] Typecheck pass (needs node_modules installed)

## Decisions
| Date | Decision | Reason |
|------|----------|--------|
| 2026-03-14 | Guardian operates through agent mode, not mission stages | Health monitoring is conversational, not a multi-stage workflow |
| 2026-03-14 | Tools split into readOnlyTools + suggestTools | get_signals/get_workspace_health are safe reads; acknowledge_signal is a mutation gated behind suggest authority |
| 2026-03-14 | Note persisted in data JSONB column | guardian_signal has no dedicated note column; JSONB avoids migration |
| 2026-03-14 | Posture: formality +0.1, assertiveness +0.1 | Guardian context should be slightly more formal and direct than general |

## Log
| Date | Time | Event |
|------|------|-------|
| 2026-03-03 | 17:28 | Feature started |
| 2026-03-14 | — | guardian_signal migration committed |
| 2026-03-14 | — | Brainstorming: scope clarified — sweep+agent, all 3 domains, cron+event |
| 2026-03-14 | — | Scope pivot: another agent builds Guardian; we prepare stage-engine skeleton |
| 2026-03-14 | — | Design doc written to docs/plans/ |
| 2026-03-14 | — | All 8 files created/modified |
| 2026-03-14 | — | Engine-architect review: found 3 issues (posture.ts, package.json, note persistence) |
| 2026-03-14 | — | All 3 issues fixed |
