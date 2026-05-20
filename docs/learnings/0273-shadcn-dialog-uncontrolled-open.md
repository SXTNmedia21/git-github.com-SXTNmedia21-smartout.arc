---
id: L-0273
title: "shadcn dialogs with internal open-state cannot be opened from outside"
status: accepted
date: 2026-05-15
discovered_in: feat/dagslinjen-quickadd (Track C)
related_adrs: []
tags: [react, shadcn, ui-architecture, controlled-vs-uncontrolled]
---

# Existing dialogs that own internal open-state block chained UI flows

## Discovery

`SlotQuickAddPopover` was specced to launch five action targets when a
manager clicks a time slot:

1. `ReservationSheet` (Booking)
2. `DailyNoteSheet` (Notat)
3. `AddTaskDialog` (Oppgave)
4. `DeviationDialog` (Avvik)
5. `ShiftStartDialog` (Vaktstart)

For (1), (2), (5) — clean: those components already accept
`open` + `onOpenChange` props (controlled).

For (3) and (4) — blocked: `AddTaskDialog` and `DeviationDialog` were
authored as **uncontrolled** dialogs that own their own `useState(open)`
internally and render a built-in trigger button. There is no way to
programmatically open them from an external popover action without
forking or refactoring.

## Workaround taken

`TimelineTab.handleQuickAddAction()` for the `task` and `deviation`
branches falls back to a `toast.info()` placeholder that tells the
manager "open the Oppgaver-fanen / HMS-fanen to add manually" instead
of opening the dialog. Two TODO comments document the deferred wiring.

## Lesson

When a Council or spec assumes a dialog/sheet "exists", verify it
exposes controlled `open` + `onOpenChange` props BEFORE writing the
launcher UI. If it doesn't, escalate to a separate sortie to refactor
the dialog to controlled mode — do not let the launcher ship broken
because the deferred component design wasn't checked.

## Follow-up

Separate sortie (rough scope S–M each):

- `AddTaskDialog`: add `open?: boolean` + `onOpenChange?: (o: boolean) => void`
  props, fall through to internal state when both are absent.
- `DeviationDialog`: same treatment.

Once both ship, update `TimelineTab.handleQuickAddAction` task/deviation
branches and flip `JOURNEY-manager-quickadd-at-slot.md` to `verified`.

## Promote to ADR?

Not as standalone. Could feed into a future "Controlled-First Component
API" convention ADR for `packages/ui` and `apps/web/src/components/**`
if the pattern recurs.
