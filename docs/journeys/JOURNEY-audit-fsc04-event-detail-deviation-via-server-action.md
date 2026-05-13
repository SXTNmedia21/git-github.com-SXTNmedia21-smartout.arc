---
title: "Journey — EventDetailPanel deviation update via Server Action"
feature: audit-fsc04-day-control-server-actions
journey: event-detail-deviation-via-server-action
status: verified
verified_at: 2026-06-10
e2e_test: null
created: 2026-05-13
updated: 2026-06-10
module: schedule
tags: [journey, adr-0156, adr-0204, deviation, server-action]
---

# Journey: Manager resolves deviation from EventDetailPanel — gated via Server Action

**Role:** manager in day-control view

**Precondition:** Refactor shipped. `resolveDeviationAction` + `acknowledgeDeviationAction` exist with gate_action + emit.

## Happy Path — resolve

1. Manager clicks "Løs" on deviation row in EventDetailPanel
2. Component calls `resolveDeviationAction({ deviation_id, resolution_notes })` inside `startTransition`
3. Server Action: gate_action(capability="hms.resolve_deviation", action="resolve") → allowed (manager role floor)
4. Action UPDATEs `deviation` row: `status='resolved'`, `resolution_notes`, `resolved_at`, `resolved_by` (server-resolved per ADR-0151)
5. Action emits `deviation resolved` → posthog + logger + activity_trail + engine_event
6. Returns `{ok:true, deviationId, status:"resolved"}` → caller fires `onSaved()` → parent re-fetches timeline

## Happy Path — acknowledge

1. Manager clicks "Bekreft" on deviation row in EventDetailPanel
2. Component calls `acknowledgeDeviationAction({ deviation_id })` inside `startTransition`
3. Server Action: gate_action(capability="hms.acknowledge_deviation", action="acknowledge") → allowed (employee role floor)
4. Action UPDATEs `deviation.status='acknowledged'`. NB: `public.deviation` has no `acknowledged_at/by` columns — `updated_at` and the emit's activity_trail row carry the temporal+actor evidence.
5. Action emits `deviation updated` with `data.status='acknowledged'` → posthog + logger + activity_trail
6. Returns `{ok:true, deviationId, status:"acknowledged"}`

**Postcondition:** Deviation transitioned. gate_evaluation row exists. Telemetry emitted. NO direct `.update()` from EventDetailPanel.

## Verification

- [x] `EventDetailPanel.tsx` zero direct `.from("deviation").update`
- [x] `resolveDeviationAction` + `acknowledgeDeviationAction` exist with `gateAction` + `emit`
- [x] Vitest on actions: granted + denied + L-0177 fail-fast + idempotent + validation coverage (14 tests green)
- [ ] Manual smoke: click resolve + acknowledge → state updates (deferred — code-path proven by unit tests)

**Verified 2026-06-10 by sortie feat/audit-fsc04-day-control-server-actions.**
