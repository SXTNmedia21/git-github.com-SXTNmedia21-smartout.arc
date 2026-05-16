---
title: "Journey — Manager clicks slot → Oppgave → creates session task from popover"
feature: dagslinjen-task-avvik-wire
journey: manager-quickadd-task
status: verified
verified_at: 2026-05-15T12:00:00Z
e2e_test: apps/e2e/dagslinjen-quickadd/slot-quickadd.spec.ts
created: 2026-05-15
updated: 2026-05-15
module: MODULE_COMMUNICATION
tags: [journey]
---

# Journey: Manager click-slot → Oppgave → session task

**Role:** manager

**Precondition:** Manager on Oversikt → Dagslinjen tab. Active department session exists. Slot popover (parent sortie) wired.

## Happy Path

1. Manager clicks `14:00` on the timeline → System opens `SlotQuickAddPopover`
2. Manager clicks `Oppgave` → System opens `AddTaskDialog` (controlled open, prefilled `time=14:00` + `session_id=current`) → User sees task form
3. Manager types task title "Polish glasses" + body → presses Lagre → System writes `session_task` row → emit `session.task.created`
4. User sees toast "Oppgave lagt til kl 14:00" → strip refreshes with task marker at 14:00

**Postcondition:** `session_task` row exists with `session_id=current`, `due_time=14:00`. Strip shows marker. Toast confirms.

## Error Paths

- **No active session:** → toast "Ingen aktiv vakt — start session først"
- **Authority denied (employee):** → popover Oppgave-action hidden / disabled
- **Network failure:** → dialog keeps state, retry button shown
- **Empty title:** → inline error "Tittel påkrevd" on Lagre

## Verification

- [ ] Implementation matches the steps above
- [ ] E2E test exists and passes (path in `e2e_test:` frontmatter)
- [ ] Manually tested end-to-end

**Mark `status: verified` in frontmatter when all three boxes are checked.**
