---
title: "Journey — Manager adjusts opening/closing on an existing day-line"
feature: timeline-location-awareness
journey: manager-edit-opening-closing
status: draft
created: 2026-05-17
updated: 2026-05-17
module: MODULE_COMMUNICATION
tags: [journey, timeline, opening-closing, day-line, authority]
---

# Journey: Manager adjusts opening/closing for the day

**Role:** manager (own department/team only) | admin | owner

**Precondition:**
- Existing `day_line` row for the day (created via [manager-create-day-line](JOURNEY-timeline-location-awareness-manager-create-day-line.md)).
- Authority gate `timeline.edit_opening_closing` granted.
- The day has not been C1-reconciled yet (`daily_reconciliation` is null or status != `closed`).

## Happy Path

1. Manager opens Dagslinjen → System renders the strip with the current `planned_open` / `planned_close` band → User sees "08:00 → 02:00" in the strip header.
2. Manager clicks the strip header time chip (e.g. `08:00`) → System opens `OpenCloseEditPopover` anchored at the chip → User sees two time inputs prefilled with current values.
3. Manager changes `08:00` → `07:30` → System validates `planned_open < planned_close` (overnight tolerated) and confirms button activates.
4. Manager clicks "Lagre" → System calls Server Action `updateDayLineHoursAction` → wraps `gate_action("timeline.edit_opening_closing", { day_line_id })` → on grant updates `day_line.planned_open`.
5. System emits `"day_line opening_changed"` telemetry → revalidates strip → User sees the strip band shift left to start at 07:30; existing markers (hooks/tasks) keep their absolute time and remain in place.

**Postcondition:** `day_line.planned_open` is `07:30:00`. Strip background band, time axis, and phase boundaries all recompute from the new open value. No event marker is moved.

## Error Paths

- **Closing earlier than opening (same day)** → Helper text "Lukking må være etter åpning, eller passere midnatt" + save disabled.
- **Existing event outside new window** → Confirmation modal "3 hendelser ligger utenfor det nye vinduet — beholde eller flytte?" → User picks "Behold" (markers stay outside band, faded) or "Flytt" (each marker capped to band edge).
- **Authority denied** → toast "Kun avdelingens leder kan justere åpning/lukking" + emit `"day_line opening_change_denied"`.
- **Day already C1-reconciled** → Inputs read-only; helper text "Dagen er avstemt — endring krever C4-overstyring".
- **Conflicting concurrent edit** → Server returns 409 → toast "Noen andre oppdaterte linjen samtidig — last på nytt" + auto-refetch.

## Verification

- [ ] Server Action `updateDayLineHoursAction` wraps `gate_action`.
- [ ] `OpenCloseEditPopover` enforces ordering rule + overnight tolerance.
- [ ] Phase boundary recompute (`getPhaseBoundaries`) re-runs on new open/close.
- [ ] E2E covers: trim left, extend right, overnight, denied authority.
- [ ] Reconciled-day path proves read-only enforcement.

**Mark `status: verified` when implementation lands.**

---

## Related

- Cascade: **D6** (production session window). Touches C1 (reconciliation lock).
- ADR ref: TBD — depends on day_line model decision.
- Touches: `apps/web/src/components/day/tabs/TimelineTab.tsx` strip header,
  `apps/web/src/app/dashboard/_actions/update-day-line-hours-action.ts` (new).
