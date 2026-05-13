---
title: "Journey — EventDetailPanel deviation update via Server Action"
feature: audit-fsc04-day-control-server-actions
journey: event-detail-deviation-via-server-action
status: draft
verified_at: null
e2e_test: null
created: 2026-05-13
updated: 2026-05-13
module: schedule
tags: [journey, adr-0156, adr-0204, deviation, server-action]
---

# Journey: Manager resolves deviation from EventDetailPanel — gated via Server Action

**Role:** manager in day-control view

**Precondition:** Refactor shipped. `updateDeviationAction` exists with gate_action + emit.

## Happy Path

1. Manager clicks "Resolve" on deviation row in EventDetailPanel
2. Component fires TanStack mutation → calls `updateDeviationAction({ deviation_id, resolution_note, resolved_at })`
3. Server Action: gate_action(capability="schedule_management", action="resolve_deviation") → allowed
4. Action UPDATE `deviation` row with resolved fields
5. Action emits `deviation.resolved` event → activity_trail + engine_event
6. Returns updated row → TanStack invalidates query → UI refreshes

**Postcondition:** Deviation resolved. gate_evaluation row exists. Telemetry emitted. NO direct `.update()` from EventDetailPanel.

## Verification

- [ ] `EventDetailPanel.tsx` zero direct `.from("deviation").update`
- [ ] `updateDeviationAction` exists with `gateAction` + `emit`
- [ ] Vitest on action: granted + denied + happy-path coverage
- [ ] Manual smoke: click resolve → state updates

**Mark verified when all checked.**
