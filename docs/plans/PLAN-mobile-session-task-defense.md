---
title: "Plan — mobile-session-task-defense"
status: done
updated: 2026-05-13
created: 2026-05-13
module: mobile
tags: [sortie-1, defense, session-task, ADR-0298, plan]
---

# Plan — mobile-session-task-defense

> Branch: `feat/mobile-session-task-defense` | Worktree: /home/sxtnl/dev/smartout.ai-wt-2 | Base: `development` | Module: mobile | Started: 2026-05-13 | Closed: 2026-05-13

## Goal

Close the 5 undefended mobile direct-mutation handlers for `session_task`, `schedule_shift`, and `shift_approval` behind JWT-derived actor identity, `gateAction` capability gates, RLS WITH CHECK, and tightened Zod schemas — **defense only, per ADR-0298 Sortie 1 scope**.

## Tasks

- [x] P1 — Extend telemetry: EntityType union + ShiftConfirmed + HoursConfirmed events
- [x] P2 — Migrations: session_task RLS WITH CHECK + 3 gate-action seeds
- [x] P3 — Extract `resolveMobileActor` shared helper
- [x] P4 — 3 Server Actions (completeSessionTask, confirmShift, confirmHours) with gateAction gates
- [x] P5 — 3 BFF PATCH routes (/tasks/[id]/complete, /shifts/[id]/confirm, /shift-approvals/[id]/confirm)
- [x] P6 — Tighten 5 Zod schemas (remove .catchall + actor body fields)
- [x] P7 — Rewire 5 action-map handlers to call BFF routes
- [x] P8 — Fix entity_type in personal capability (line 192: "personal_task_action" → "personal_task")
- [x] P9 — Delete 2 orphan task routes
- [x] P10 — Close 3 doc-drift surfaces (BOTSSON-SYSTEM-MAP, MODULE_14, DATABASE.md)
- [x] P11 — Playwright E2E: 3 spec files, 9 tests (happy + 401 + 422)
- [x] P12 — Verification gate: 8/8 gates PASS
- [x] P13 — Closure deliverables: HANDOFF + JOURNEY + plan update

## Acceptance Criteria

- [x] Typecheck passes: `pnpm turbo typecheck`
- [x] Decision log updated (ADR-0298 registered; ADR-0299 scope reserved in ADR-0298 description)
- [x] User journeys written (`docs/journeys/JOURNEY-mobile-session-task-defense.md`)
- [x] HANDOFF written (`docs/HANDOFF-mobile-session-task-defense.md`)
- [x] Playwright 9/9 green
- [x] Intent coverage: 29 caps ↔ 33 enums (clean, no new toolless intents)
- [x] 2 migrations apply clean on local Supabase
- [x] 3 BFF routes reject missing/expired JWT with 401
- [x] 3 Server Actions blocked by gateAction on unconfigured authority config
- [x] Orphan routes deleted, no dangling imports

## Delivery

17 commits on `feat/mobile-session-task-defense`. P12 gate: 8/8 PASS. Ready for `/close-feature` merge to `development`.

See full implementation plan: `docs/superpowers/plans/2026-05-13-sortie-1-session-task-defense.md`
See spec: `docs/superpowers/specs/2026-05-13-sortie-1-session-task-defense-design.md`
