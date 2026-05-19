---
title: Journey — Manager Edits Day Line Open/Close Hours
status: accepted
created: 2026-05-18
updated: 2026-05-18
module: daytimeline
tags: [journey, day-line, area-anchored, manager, edit, opening, closing, adr-0367, d6]
---

# Journey: Manager Edits Day Line Open/Close Hours

> Captures the edit-hours flow from the `OpenCloseEditPopover` component through `updateDayLineHoursAction` to the `day-line.update_hours` capability and telemetry emission.
>
> Relevant ADRs: ADR-0367 (Rule 7, Rule 10), ADR-0099, ADR-0114, ADR-0151, ADR-0204, ADR-0287, ADR-0377.

---

## Journey: Manager Changes Planned Open Time on a Day Line

**Precondition:**
- Manager is authenticated.
- At least one `day_line` exists for the current `(department_session, location)`.
- The parent `department_session` is NOT closed (`daily_reconciliation.status != 'closed'`).
- `engine_authority_config` has a seed entry for `day_line.update_hours` granting manager+ access.

**Happy path — change planned_open only:**

1. Manager clicks on the open-time label or the left edge of a `DayLineStrip` (the area-anchored time-axis ribbon).
   → System: renders `OpenCloseEditPopover` anchored to the strip header (planned: `data-testid="open-close-edit-popover"`).
   → Manager sees: a compact popover with two time-picker fields: "Åpner" (`planned_open`) and "Stenger" (`planned_close`), pre-filled with current values.
2. Manager adjusts `planned_open` to a new time value and leaves `planned_close` unchanged.
3. Manager submits by pressing "Lagre" or equivalent confirm action.
   → System: calls `updateDayLineHoursAction` Server Action with `{ day_line_id, planned_open: newTime }`.
   → `updateDayLineHoursAction` calls the `day-line.update_hours` capability tool.
   → Capability: resolves `workspace_id` and validates `day_line_id` belongs to the session's workspace (ADR-0151).
   → Capability: calls `gate_action('day_line.update_hours', workspace_id, profile_id)` — ALLOW for manager+.
   → Capability: executes `gatedMutation` (ADR-0204) — `UPDATE day_line SET planned_open = $1, updated_at = now() WHERE day_line_id = $2`.
   → Capability: emits `day_line.opening_changed` event via `emit()` from `@smartout/telemetry`, payload includes `{ day_line_id, old_planned_open, new_planned_open }`.
4. `updateDayLineHoursAction` returns success.
   → System: TanStack Query mutation invalidates day-timeline query key.
   → TimelineTab re-renders the strip with the new open band position.
   → Manager sees: strip left edge moves to reflect the updated `planned_open`.

**Happy path — change both open and close:**

Steps 1–2 as above but manager adjusts both fields.

→ Capability emits **two** events: `day_line.opening_changed` + `day_line.closing_changed`. Each event carries its own old/new pair. This is per ADR-0367 Rule 10 — the events are separate to allow analytics to differentiate which dimension changed.

**Postcondition:**
- `day_line.planned_open` and/or `day_line.planned_close` updated.
- One or both telemetry events (`day_line.opening_changed`, `day_line.closing_changed`) recorded.
- Strip renders at updated band positions.
- No change to sibling `day_line` rows for the same session — each area line is independent.

**Error paths:**

| Condition | System behaviour | Manager sees |
|---|---|---|
| `planned_open >= planned_close` | Capability returns validation error before DB write | Popover shows inline error: "Åpningstid må være før stengetid." |
| Session locked (`daily_reconciliation.status = 'closed'`) | `gate_action` or capability guard detects lock; mutation blocked | Toast: "Dagsøkten er avsluttet — kan ikke endre åpningstider." |
| `day_line_id` not found in workspace | Capability 404; action returns error | Toast: "Dagslinjen ble ikke funnet." |
| `gate_action` DENY (non-manager) | Capability aborts before mutation | Toast: "Mangler tillatelse." |
| Concurrent edit (optimistic conflict) | DB `updated_at` drift; later write wins (last-write-wins V1) | Strip silently reflects DB state on next fetch. V2 conflict resolution deferred. |

**E2E coverage pointer:**
- Spec file: `apps/e2e/tests/day-line/edit-hours.spec.ts`
- Key selectors: `data-testid="open-close-edit-popover"`, `data-testid="planned-open-input"`, `data-testid="planned-close-input"` (planned — assigned in Phase C UI work).
- Status: NOT YET WRITTEN — gated on Phase B + Phase C merge.

**ADR refs:** ADR-0367 (Rule 7, Rule 10), ADR-0099, ADR-0114, ADR-0151, ADR-0204, ADR-0287, ADR-0377.
