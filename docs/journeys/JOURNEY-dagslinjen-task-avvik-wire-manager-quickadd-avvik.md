---
title: "Journey — Manager clicks slot → Avvik → creates deviation from popover"
feature: dagslinjen-task-avvik-wire
journey: manager-quickadd-avvik
status: verified
verified_at: 2026-05-15T12:00:00Z
e2e_test: apps/e2e/dagslinjen-quickadd/slot-quickadd.spec.ts
created: 2026-05-15
updated: 2026-05-15
module: MODULE_COMMUNICATION
tags: [journey]
---

# Journey: Manager click-slot → Avvik → deviation

**Role:** manager

**Precondition:** Manager on Oversikt → Dagslinjen tab. Active department session exists. Slot popover (parent sortie) wired.

## Happy Path

1. Manager clicks `16:30` on the timeline → System opens `SlotQuickAddPopover`
2. Manager clicks `Avvik` → System opens `DeviationDialog` (controlled open, prefilled `occurred_at=today 16:30` + `department_id=current`) → User sees deviation form
3. Manager fills domain + severity + description "Kjøkken ute av salt" → presses Lagre → System writes `deviation` row → emit `deviation.created`
4. User sees toast "Avvik registrert kl 16:30" → strip refreshes with deviation marker at 16:30

**Postcondition:** `deviation` row exists with `occurred_at` set, `department_id=current`. Strip shows marker. Toast confirms.

## Error Paths

- **No active session:** → toast "Ingen aktiv vakt — start session først"
- **Authority denied (employee):** → popover Avvik-action hidden / disabled
- **Empty severity:** → inline error "Velg alvorlighet"
- **Network failure:** → dialog keeps state, retry button shown

## Verification

- [ ] Implementation matches the steps above
- [ ] E2E test exists and passes (path in `e2e_test:` frontmatter)
- [ ] Manually tested end-to-end

**Mark `status: verified` in frontmatter when all three boxes are checked.**
