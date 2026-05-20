---
title: "Journey — Manager creates a day-line bound to (location, department|team) with opening/closing"
feature: timeline-location-awareness
journey: manager-create-day-line
status: draft
created: 2026-05-17
updated: 2026-05-17
module: MODULE_COMMUNICATION
tags: [journey, timeline, location, day-line, opening-closing, cascade-d1, cascade-d2]
---

# Journey: Manager creates a location-anchored day-line

**Role:** manager (own department only) | admin | owner (all departments + teams)

**Precondition:**
- User logged in, on Oversikt → Dagslinjen tab for today (or any date within planning horizon).
- Workspace has at least one `location` row and at least one `department` row (D1 envelope rule).
- Authority gate `timeline.create_day_line` granted via `engine_authority_config`.

## Happy Path

1. Manager taps the "Ny dagslinje" button in `TimelineTopBar` → System opens `DayLineCreateSheet` → User sees a 3-field form.
2. Field 1 — **Lokasjon (mandatory)** → User picks from `location` dropdown filtered by `workspace_id` → System highlights the choice; no submit without this field.
3. Field 2 — **Avdeling eller team (mandatory, exactly one)** → User flips a toggle "Avdeling | Team" then picks the resource → System enforces `CHECK (department_id IS NOT NULL XOR team_id IS NOT NULL)` client-side and shows red helper text if both/neither chosen.
4. Field 3 — **Åpning / Lukking (mandatory pair)** → User types `08:00` → `02:00` in two `<TimeInput>` fields → System validates `planned_open < planned_close` (overnight allowed: close < open means next-day close).
5. Manager clicks "Opprett" → System calls Server Action `createDayLineAction` → wraps `gate_action("timeline.create_day_line", { workspace_id, location_id, department_id?, team_id? })` → on grant inserts into `day_line(workspace_id, business_date, location_id, department_id, team_id, planned_open, planned_close, created_by)`.
6. System emits `"day_line created"` telemetry → revalidates the day's lines query → `TimelineTab` re-renders → User sees a new strip for `<location> · <dept|team> · 08:00–02:00` in the day stack.

**Postcondition:** A new `day_line` row exists for the day. The strip is editable by the same authority that created it. Hooks/tasks/notes/avvik added to this strip inherit its `location_id` + `(dept_id|team_id)` automatically.

## Error Paths

- **No locations exist** → Sheet shows empty-state "Ingen lokasjoner — opprett under Innstillinger → Lokasjoner" + CTA. Submit disabled.
- **Both dept and team selected** → Submit disabled, helper text "Velg avdeling eller team — ikke begge".
- **Neither dept nor team selected** → Submit disabled, helper text "Avdeling eller team er obligatorisk".
- **Opening == closing** → Submit disabled, helper text "Åpning og lukking kan ikke være lik".
- **gate_action denies** (manager outside own dept) → toast "Ingen tilgang — denne avdelingen tilhører ikke deg" + emit `"day_line create_denied"` with gate-reason.
- **Duplicate line same day same (location, dept|team)** → DB UNIQUE constraint fires → toast "Dagslinje finnes allerede for denne kombinasjonen" + offer "Åpne eksisterende".
- **Network failure mid-submit** → Sheet keeps state; retry button; no telemetry double-emit.

## Verification

- [ ] `day_line` table exists with mandatory `location_id` + `CHECK (department_id IS NOT NULL OR team_id IS NOT NULL)` + UNIQUE (workspace_id, business_date, location_id, department_id, team_id).
- [ ] Server Action `createDayLineAction` wraps `gate_action`.
- [ ] `DayLineCreateSheet` enforces XOR + non-equal open/close client-side.
- [ ] E2E test passes — happy path + each error path.
- [ ] Cascade audit confirms no D1/D2 dimension violation.

**Mark `status: verified` when implementation lands.**

---

## Related

- Cascade dimensions touched: **D1** (location, department), **D2** (team), **D6** (day_line replaces single-session-per-dept model).
- ADR ref: TBD — council-class change, requires new ADR before implementation.
- Depends on: model decision (Option A vs B vs C from review 2026-05-17).
