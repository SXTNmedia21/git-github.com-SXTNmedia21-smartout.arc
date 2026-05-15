---
title: "Journey — Manager clicks slot to add booking/note/task/deviation/shift-start"
feature: dagslinjen-quickadd
journey: manager-quickadd-at-slot
status: in_progress
verified_at: null
e2e_test: apps/e2e/dagslinjen-quickadd/slot-quickadd.spec.ts
created: 2026-05-15
updated: 2026-05-15
module: MODULE_COMMUNICATION
tags: [journey]
---

# Journey: Manager click-slot quick-add on Dagslinjen

**Role:** manager

**Precondition:** Manager logged in, on Oversikt → Dagslinjen tab. A department session exists for today.

## Happy Path

1. Manager hovers `08:00` on the time axis → System highlights slot → User sees thin vertical guide-line
2. Manager clicks `08:00` → System opens `SlotQuickAddPopover` anchored to cursor → User sees 5 action buttons (Booking / Notat / Oppgave / Avvik / Vaktstart)
3. Manager clicks `Booking` → System opens `ReservationSheet` prefilled with `time=08:00`, `date=today`, `department_id=current` → User sees booking form
4. Manager fills guest_count + name + ENTER → System calls `add-booking-action` → System emits `schedule.booking.created` → User sees toast "Booking 08:00 lagt til" and strip refreshes with new marker
5. Manager clicks `20:00` → repeats 2-4 for "Notat" (opens `DailyNoteSheet`), "Oppgave" (opens `TaskCreateDialog`), "Avvik" (opens `DeviationSheet`), "Vaktstart" (opens shift-start dialog)

**Postcondition:** All 5 event types can be created from the strip with the slot's time prefilled. Strip re-renders within 200ms after mutation.

## Error Paths

- **No department session for today:** → System shows toast "Ingen aktiv vakt — start session først" + redirects to session-start
- **Authority denied (employee tries):** → Popover hidden; clicking slot does nothing (read-only UX preserved)
- **Network failure mid-write:** → Sheet keeps form state; retry button shown; emit error logged
- **Time outside session window:** → Slot click works but warns "Utenfor vaktvindu (06:00–02:00) — bekreft eller endre"

## Verification

- [ ] Implementation matches the steps above
- [ ] E2E test exists and passes (path in `e2e_test:` frontmatter)
- [ ] Manually tested end-to-end

**Mark `status: verified` in frontmatter when all three boxes are checked.**
