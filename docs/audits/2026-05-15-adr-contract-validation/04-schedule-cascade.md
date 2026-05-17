---
title: "Slice 04 — Schedule Cascade ADR Audit"
status: complete
updated: 2026-05-15
created: 2026-05-15
module: schedule-cascade
tags: [audit, schedule, cascade, adr]
---

# Slice 04 — Schedule Cascade ADR Audit

**Date:** 2026-05-15
**Auditor:** system-steward
**Branch:** development HEAD
**ADRs in scope:** 0032, 0047, 0091, 0156, 0204, 0287, 0299
**Surfaces:** `apps/web/src/app/dashboard/schedule/`, `apps/web/src/lib/cascade/`, `packages/ai/src/industry/`, `apps/web/src/components/day/WebDayControl.tsx`

---

## Summary

| Severity | Count |
|----------|-------|
| CRITICAL | 0 |
| HIGH     | 3 |
| MEDIUM   | 2 |
| LOW      | 1 |
| INFO     | 2 |

Both 2026-05-13 baseline closures (F-SC-04-13, F-SC-04-15) **confirmed closed**. The ADR-0204 SS-5 backlog has grown from 13+ to 40 direct mutations across schedule hooks — not yet a regression (SS-5 was never closed), but the count increase warrants re-baselining. One new HIGH (F-SC-04-09 STATUS UNKNOWN resolved to OPEN), one new HIGH for voice tool D6 ungated writes. ADR-0156 compliance holds in UI layer; tariff fallback observability gap (FP-002) persists.

---

## Findings Table

| ID | Severity | File:Line | ADR | Description |
|----|----------|-----------|-----|-------------|
| F-SC-04-13 | CLOSED | `OversiktTab.tsx:102–110` | ADR-0156, ADR-0204 | duty_leader write routed through Server Action — no inline direct write |
| F-SC-04-15 | CLOSED | `EventDetailPanel.tsx` | ADR-0156, ADR-0204 | No direct deviation.update found in component — confirmed clean |
| F-SC-04-09 | HIGH | `use-employee-roster.ts:333` | ADR-0204 | `useAutoFillShifts` bulk-inserts `schedule_shift` with no gate. No `gatedMutation` / `mutateWithGate` call. `emit()` fires in `onSuccess` (telemetry present), but C4 authority gate absent. |
| F-SC-04-17 | HIGH | `use-schedule-voice-tools.ts:854–882` | ADR-0091, ADR-0204, ADR-0287 | Voice tool `addSessionTaskTool` directly inserts into `department_session` (line 854) and `session_task` (line 872) via `supabase.from(...).insert()` — both governance-gated D6 tables — with no `gate_action` / `gatedMutation` call. No `emit()` on success path. |
| F-SC-04-18 | HIGH | `use-hours-overrides.ts:67,103` | ADR-0204 | `department_hours_override` upsert and delete are direct `supabase.from()` calls — D1 table, outside `gatedMutation`. `emit()` present in `onSuccess`. Workspace_id null-safety gap on line 87 (`wsId ?? null`) risks silent corrupt telemetry (L-0177 class). |
| F-SC-04-19 | MEDIUM | `use-schedule-voice-tools.ts:665,759` | ADR-0204, ADR-0287 | `addReservationTool` (line 665) and `updateReservationTool` (line 759) write directly to `schedule_day_booking` with no gate and no `emit()`. `schedule_day_booking` is a D6 table. No authority check on voice path. |
| F-SC-04-20 | MEDIUM | `packages/ai/src/industry/loader.ts:70,77` | ADR-0091 (ADR-0190 amendment) | Tier-3 fallback (hardcoded `hospitalityPackage`) fires silently on both "rates empty" (line 70) and "DB error" (line 77) paths. ADR-0190 Control 3b requires `gate.default_permitted` emit to `activity_trail` when default-permit fires. No warn, no emit, no log on fallback. I1 bootstrap false positive: caller believes live tariffs loaded. |
| F-SC-04-21 | LOW | `use-absences.ts` (approve/reject mutations) | ADR-0204 | `schedule_absence` approve and reject mutations are direct `.update({status})` calls via `supabase.from("schedule_absence")` — no `gatedMutation`. `emit()` fires in `onSuccess`. Absence approval is an authority-sensitive action; C4 gate absent. |
| F-SC-04-22 | INFO | `use-shifts.ts` (all mutations) | ADR-0204 SS-5 | All `schedule_shift` mutations (create, update, delete, publish, unpublish, complete, assign, bulk-insert) are direct `supabase.from("schedule_shift")` calls — 9 mutation sites, no `gatedMutation`. `emit()` present. These are correctly in the SS-5 backlog; no regression. |
| F-SC-04-23 | INFO | `use-day-content.ts` (5 mutations) | ADR-0204 SS-5 | `schedule_day_message` and `schedule_day_booking` mutations are direct — 5 mutation sites. `emit()` present on success paths. In SS-5 backlog. |

---

## Per-ADR Rollup

### ADR-0032 — Schedule Local State Architecture
**Status: Compliant.** No `useReducer`+Context local state found surviving in production mutation paths. DB persistence fully migrated per ADR-0047.

### ADR-0047 — Schedule DB Persistence with TanStack Query
**Status: Compliant.** All schedule mutations use TanStack `useMutation` hooks. Optimistic cache updates and invalidation patterns follow the ADR. No raw React state mutations for D6 data.

### ADR-0091 — Governance Gate Placement (cascade_gate_write)
**Status: Partially non-compliant.** `cascade_gate_write` WP3 helpers (`gatedInsert/Update/Delete`) are not used in schedule hooks for D6 mutations. `department_hours_override`, `schedule_shift`, `schedule_absence`, `department_session`, `session_task`, `schedule_day_booking` all write direct `supabase.from()`. The WP3 intent (all D6 writes through gated helpers) is not satisfied in this surface. ADR-0204 SS-5 is the named migration path; it is open.

ADR-0190 Control 3b (default-permit observability): **OPEN**. `loader.ts` tier-3 fallback fires silently.

### ADR-0156 — Day-Control Panel as Canonical D6 Admin Surface
**Status: Compliant.** `OversiktTab.tsx` F-SC-04-13 baseline finding confirmed closed — duty_leader writes go through `updateDepartmentSessionDutyLeaderAction` Server Action (lines 110–116). No inline `supabase.from('department_session').update(...)` in UI components. Phase enum derivation via `derivePhase()` helper verified by code comment pattern.

### ADR-0204 — Composition Orchestrator for Dual-Gate Mutations
**Status: Open (SS-5 active).** 40 direct DB mutations found in schedule hooks — none using `gatedMutation` orchestrator. All `schedule_shift`, `schedule_absence`, `department_hours_override`, `schedule_day_message`, `schedule_day_booking` mutation sites are SS-5 backlog. No regression from 2026-05-13 per ADR-0204 framing; count increase (13+ → 40) reflects the full scope now being re-counted across all hooks.

`use-schedule-voice-tools.ts` D6 writes (department_session, session_task) are NOT in SS-5 backlog — they appear to be new ungated sites on a voice-specific path. **This is a new finding (F-SC-04-17)** not covered by the known backlog.

### ADR-0287 — gate_action Mandatory on Mutation Capability Tools
**Status: Compliant for capability tools (packages/ai/src/capabilities/).** The 2026-05-13 enforcement baseline showed 43 passing / 0 violating. That baseline covers `packages/ai/src/capabilities/**` only.

**Non-compliant for schedule hooks (F-SC-04-09, F-SC-04-17, F-SC-04-18, F-SC-04-19):** `use-employee-roster.ts::useAutoFillShifts`, `use-schedule-voice-tools.ts` D6 voice writes, and `use-hours-overrides.ts` are TanStack mutation hooks, not `SmartoutTool` execute() functions — the CI gate-action-coverage script does NOT cover them. The hooks constitute a blind spot in ADR-0287 CI coverage.

### ADR-0299 — Sortie A D6 RLS WITH CHECK Hardening
**Status: Compliant (no regression detected).** Sister-table sweep (department_session, session_hook, deviation, personal_task) and shift_approval WITH CHECK were closed by Sortie A.2. No new D6 RLS FOR-ALL-without-WITH-CHECK patterns found in this audit. Voice tool direct inserts (F-SC-04-17) rely on RLS; per ADR-0299 logic, service_role path is unaffected; JWT-path inserts via voice tool use `createClient()` (anon key) and would be subject to WITH CHECK — this needs RLS policy verification (not in scope here, flagged as gap).

---

## Verified Intentional

- **F-SC-04-13 CLOSED.** `OversiktTab.tsx:102–130` — duty_leader updates go through `updateDepartmentSessionDutyLeaderAction` Server Action. Comment at line 102 explicitly documents the fix. No inline direct write.
- **F-SC-04-15 CLOSED.** `EventDetailPanel.tsx` — No `.update` or `.insert` on deviation table found. Component appears refactored to use day-session hooks.
- **use-shift-swap.ts** — BFF routing confirmed. Initiate/respond/cancel go through `/api/shift-swap/*` BFF. `useApproveSwap` (admin-only, direct RPC) is documented as out-of-scope with tracking note. This is intentional per ADR-0132 + sortie scope comment.
- **`packages/ai/src/industry/loader.ts`** — Three-tier fallback chain (K1b → K1a → hardcoded) is architecturally correct per cascade spec I1 bootstrap. FP-002: tariff numeric values are not in scope for this audit. Only the missing observability on tier-3 fire is flagged (F-SC-04-20).

---

## In-Progress (campaign/ui-shell)

`campaign/ui-shell` touched dashboard layout and sidebar restructuring on 2026-05-15. No changes to schedule hooks or cascade lib observed on development HEAD. Schedule surface appears unaffected by ui-shell campaign at this HEAD.

---

## Delta vs 2026-05-13 Baseline

| Finding | 2026-05-13 | 2026-05-15 | Change |
|---------|-----------|-----------|--------|
| F-SC-04-13 HIGH (OversiktTab inline update) | CLOSED | CONFIRMED CLOSED | Stable |
| F-SC-04-15 HIGH (EventDetailPanel direct update) | CLOSED | CONFIRMED CLOSED | Stable |
| F-SC-04-09 HIGH (useAutoFillShifts bulk insert no gate) | STATUS UNKNOWN | OPEN — confirmed no gate_action | Resolved Unknown → HIGH |
| F-SC-04-17 (voice tool D6 ungated insert) | Not in baseline | NEW HIGH | New finding |
| F-SC-04-18 (hours-overrides direct D1 write) | Not in baseline | NEW HIGH | New finding |
| F-SC-04-19 (voice tool booking writes no gate/emit) | Not in baseline | NEW MEDIUM | New finding |
| F-SC-04-20 (tariff tier-3 fallback silent) | FP-002 (observability gap noted) | MEDIUM — ADR-0190 Control 3b breach | Confirmed + classified |
| ADR-0204 SS-5 mutation count | 13+ (estimated) | 40 (full recount) | Scope increase, not regression |
| ADR-0287 CI scope gap (hooks not in gate-action-coverage) | Not noted | Identified | New gap |
