---
title: "Worklog — agent-profile-system"
status: done
updated: 2026-03-10
created: 2026-03-10
module: ai
tags: [agent, voice, personality, posture, relationship, context]
---

# Worklog — agent-profile-system

> Branch: `feat/agent-profile-system` | Worktree: wt-1 | Started: 2026-03-10

## Status: Done

## Done

- [x] Task 1: DB migration — agent_profile, agent_relationship tables + engine_memory extensions
- [x] Task 2: Personality, Situation, PostureAdaptFlags types in capabilities/types.ts
- [x] Task 3: Posture resolver — role/situation/authority/relationship adaptation
- [x] Task 4: MissionStageOverride type for per-stage voice and posture
- [x] Task 5: AgentContext and AgentProfileData types
- [x] Task 6: Context collector — parallel 5-way data fetch
- [x] Task 7: Prompt builder rewrite — buildBotssonPromptFromContext + legacy compat
- [x] Task 8: Relationship manager — load, create, update after sessions
- [x] Task 9: Agent router integration — full context pipeline
- [x] Task 10: Auto-create default agent_profile on workspace activation
- [x] Task 11: Full typecheck 18/18 + build
- [x] Fix: type assertions in context collector for Supabase join results
- [x] Migration remediation: FK references fixed, idempotent triggers, seed data

## Remaining

_None — feature complete._

## Decisions

| Date       | Decision                                          | Reason                                                      |
| ---------- | ------------------------------------------------- | ----------------------------------------------------------- |
| 2026-03-10 | Logarithmic familiarity growth (log10)            | Natural diminishing returns — 50 conversations ≈ 1.0        |
| 2026-03-10 | Composite: 0.3 familiarity + 0.4 trust + 0.3 sent | Trust is hardest to earn, should weight most                |
| 2026-03-10 | Keep legacy buildBotssonPrompt alongside new      | Backwards compat for callers not yet migrated               |
| 2026-03-10 | Posture adjustments as deltas not absolutes       | Base personality + context deltas = composable adaptation   |
| 2026-03-10 | Auto-create agent_profile at workspace activation | Zero-config: every workspace gets Mr. Botsson with defaults |
| 2026-03-10 | Parallel fetch in context collector               | Latency: 5 independent DB queries should not be sequential  |

## Log

| Date       | Time | Event                                                            |
| ---------- | ---- | ---------------------------------------------------------------- |
| 2026-03-10 | —    | Feature started: wt-1, feat/agent-profile-system                 |
| 2026-03-10 | —    | Phase 1: Migration written + applied (2 tables, 3 ALTER columns) |
| 2026-03-10 | —    | Phase 2: Types + posture resolver + stage override               |
| 2026-03-10 | —    | Phase 3: Context types + collector                               |
| 2026-03-10 | —    | Phase 4: Prompt builder rewrite                                  |
| 2026-03-10 | —    | Phase 5: Relationship manager + agent router integration         |
| 2026-03-10 | —    | Phase 6: Auto-create on workspace activation                     |
| 2026-03-10 | —    | Phase 7: Typecheck 18/18, build clean                            |
| 2026-03-10 | —    | Merged to development                                            |
| 2026-03-10 | —    | Migration remediation: FK fixes, seed data, type regen           |
| 2026-03-10 | —    | Feature closed                                                   |
