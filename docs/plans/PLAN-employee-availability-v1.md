---
title: "Plan — employee-availability-v1 (Sortie 2 of schedule-harness)"
status: in_progress
updated: 2026-04-23
created: 2026-04-23
module: schedule-harness
tags: [plan, availability, capability, d2-source, council-2026-04-23, greenfield]
---

# Plan — employee-availability-v1

> Branch: `feat/schedule-harness-employee-availability-v1` | Worktree: `/home/sxtnl/dev/smartout.ai-schedule-harness-wt-2` | Base: `campaign/schedule-harness` | Module: schedule-harness | Started: 2026-04-23

## Goal

Implement D2 source-data for employee availability per 2026-04-23 Council verdict ADR-0200 (three-table model). Employee self-service with ADR-0132 BFF + ADR-0151/0176 server-derived identity + ADR-0201 gate_action + ADR-0202 voice policy split.

## Council context

- ADR-0200: Three-table model — schedule_absence (D6 existing) + employee_availability (D2 NEW) + employee_availability_preference (D2 NEW)
- ADR-0201: gate_action mandatory on all mutation capability tools
- ADR-0202: Voice policy split — availability.set_own voice-OK, availability.query_others chat-only

Trust Gate unblocked by Sortie 1 shift-swap-harness (PR #246).

## Tasks

### Task G — Migrations + RLS + types regen
Two new tables (employee_availability + employee_availability_preference) with employee-writable RLS (JWT profile_id=auth.uid() + API-key both), indexes, audit columns.

### Task H — Capability + authority seed
`packages/ai/src/capabilities/availability/` with gate.ts + tools.ts (setOwn/clearOwn/queryOthers). Authority seed: set_own=autonomous/employee, clear_own=autonomous/employee, query_others=read_only/employee+chat-only.

### Task I — BFF routes + mobile hooks
3 BFF routes mirror shift-swap pattern. Mobile hooks useSetAvailability, useMyAvailability.

### Task J — Mobile UI + telemetry
Route `(home)/availability.tsx` — 3-lag (ukemal / swipe-kalender / akutt-bryter). Nordic Split. Empty-state CTA (Invariant #13). Registry: 3 dot-form events.

### Task K — Supervisor + close
10-gate review, typecheck, PR.

## Acceptance

- [ ] 3 migrations clean on db reset
- [ ] Typecheck 35/35 PASS
- [ ] authority-seed-parity all 3 capabilities seeded
- [ ] 0 direct RPC in mobile availability hooks
- [ ] Nordic Split 0 violations in mobile UI
- [ ] 3 dot-form emit events registered
