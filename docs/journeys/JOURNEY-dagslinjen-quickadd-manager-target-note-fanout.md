---
title: "Journey — Manager creates targeted note with scheduled fanout"
feature: dagslinjen-quickadd
journey: manager-target-note-fanout
status: in_progress
verified_at: null
e2e_test: apps/e2e/dagslinjen-quickadd/target-note-fanout.spec.ts
created: 2026-05-15
updated: 2026-05-15
module: MODULE_COMMUNICATION
tags: [journey]
---

# Journey: Manager target note + schedule fanout

**Role:** manager

**Precondition:** Manager on Dagslinjen, clicked slot 14:00 → opened Notat from popover. Team "Lørdag PM" exists with 4 members.

## Happy Path

1. System opens `DailyNoteSheet` prefilled `time=14:00` → User sees note form with NEW sections: "Hvem ser dette?" + "Når påminne?"
2. Manager types "VIP-bord 12 — Gluten allergi" in body
3. Manager opens "Hvem ser dette?" → System renders audience picker (radio: Avdeling | Team | Vakt | Spesifikke personer) → User selects "Team → Lørdag PM"
4. Manager opens "Når påminne?" → System renders datetime picker defaulted to slot time (14:00) → User picks 18:00 today
5. Manager clicks "Lagre" → System validates `audience` non-empty AND `notify_at > now` → System writes `session_note` row with `audience={team_ids: ["..."]}` + `notify_at=2026-05-15T18:00:00+02:00` + `delivered_at=NULL` → System emits `comm.scheduled_note.created`
6. System enqueues `engine_process` "scheduled-note-fanout" with `next_run_at=notify_at` → User sees toast "Notat lagret — påminner 4 personer 18:00" + strip shows note marker at 14:00 with clock-overlay icon

**Postcondition:** Row exists in `session_note` with audience + notify_at + delivered_at NULL. Engine_state queued. Authority log written if cross-department.

## Error Paths

- **Empty audience:** → "Velg minst én mottaker" inline error on Lagre
- **notify_at in past:** → Picker rejects, inline "Påminnelse må være fremover"
- **Cross-department audience (manager scope):** → Authority gate blocks save, toast "Kontakt admin for tverr-avdeling"
- **Team has 0 active members:** → Warning "Teamet har ingen aktive medlemmer — fortsette likevel?"
- **Engine_process enqueue fails:** → Note saved with `delivered_at=NULL`; nightly reconciliation picks up

## Verification

- [ ] Implementation matches the steps above
- [ ] E2E test exists and passes (path in `e2e_test:` frontmatter)
- [ ] Manually tested end-to-end

**Mark `status: verified` in frontmatter when all three boxes are checked.**
