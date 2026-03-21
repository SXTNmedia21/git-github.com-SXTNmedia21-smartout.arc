---
title: "Worklog — cascade-core-foundation"
status: in_progress
updated: 2026-03-21
created: 2026-03-21
module: cascade
tags: [cascade, foundation, schema, migration, phase-b]
---

# Worklog — cascade-core-foundation

## Status: In Progress

## Done

- [x] Cascade Core Foundation spec written and reviewed
- [x] Spec locked with I1 + 6D + 4C + K1a/K1b canonical model
- [x] Cascade <> Event Engine integration contract added (Section 2.6)
- [x] A1/A2/A3 migration tier split added to spec
- [x] STATE.md updated with Section 4.5 (Cascade decision)
- [x] Implementation plan written and reviewed (3 review rounds)
- [x] Plan approved: T1 (A1 domain) + T2 (A2 framework) + T3 (Phase B primitives) + T4 (cleanup) + T5 (validation)

- [x] Execute T1: A1 domain migration (4 migration files)
- [x] Execute T2: A2 framework migration (2 migration files)
- [x] Execute T3: Phase B pure primitives (4 functions + 29 tests)
- [x] Execute T4: Legacy truth cutover & cleanup safety rails
- [x] Execute T5: Post-merge validation (full reset, typecheck, ADR-0056)
- [x] Fix 3 pre-existing migration bugs (walkai seed, pg_cron, duplicate timestamps)
- [x] Hours integration: backfill operating_hours → department_operating_hours
- [x] Hours integration: rewrite useOperatingHours hook to cascade table
- [x] Hours integration: update 3 consumers with department context
- [x] Hours integration: wire department_session planned_open/close

## Remaining

- [ ] Telemetry registry: add department_operating_hours event with department_id/season_id
- [ ] Engine dispatch: wire planned_open/close (needs shared cascade package)
- [ ] Process docs/needs-rewrite/ merge candidates

## Decisions

| Date       | Decision                                                       | Reason                                                                     |
| ---------- | -------------------------------------------------------------- | -------------------------------------------------------------------------- |
| 2026-03-21 | Cascade operates as independent layer, not inside event engine | Different lifecycle semantics (preview/apply vs linear step execution)     |
| 2026-03-21 | A1/A2/A3 migration split                                       | Schema is a commitment signal — avoid noise from unused tables             |
| 2026-03-21 | Drop season.is_active from spec                                | Season already has status enum (draft/active/archived)                     |
| 2026-03-21 | Phase B functions in apps/web/src/lib/cascade/                 | Follows season-calculations.ts pattern, vitest already configured          |
| 2026-03-21 | evaluateFrameworkRules is a skeleton, not full evaluator       | Needs integrated schema + real framework seed data for full implementation |
| 2026-03-21 | SHA-256 for state hashing (not djb2)                           | Foundation contract — staleness detection and audit depend on it           |

## Log

| Date       | Time | Event                                                    |
| ---------- | ---- | -------------------------------------------------------- |
| 2026-03-21 | —    | Spec written, reviewed, locked                           |
| 2026-03-21 | —    | Implementation plan written (5 tracks, 20+ tasks)        |
| 2026-03-21 | —    | Plan approved after 3 review rounds                      |
| 2026-03-22 | —    | Foundation executed: 19 tasks, 7 migrations, 29 tests    |
| 2026-03-22 | —    | Hours integration: backfill + hook + consumers + session |
| 2026-03-22 | —    | Session ended. Next: cascade UI implementation           |
