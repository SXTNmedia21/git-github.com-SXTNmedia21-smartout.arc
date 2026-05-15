---
title: "Plan — dagslinjen-task-avvik-wire"
feature: dagslinjen-task-avvik-wire
spec: docs/superpowers/specs/2026-05-15-dagslinjen-quickadd-design.md
parent_sortie: dagslinjen-quickadd (merged 1405b8e6c)
status: draft
updated: 2026-05-15
created: 2026-05-15
module: MODULE_COMMUNICATION
tags: [plan]
---

# Plan — dagslinjen-task-avvik-wire

> Branch: `feat/dagslinjen-task-avvik-wire` | Worktree: `/home/sxtnl/dev/smartout.ai-wt-4` | Base: `development` | Module: MODULE_COMMUNICATION

**Spec:** [Dagslinjen QuickAdd — Slot-popover, filter, targeted note fanout](../superpowers/specs/2026-05-15-dagslinjen-quickadd-design.md) (parent)

## Context

Parent sortie `dagslinjen-quickadd` shipped slot popover with 5 action buttons (Booking/Notat/Oppgave/Avvik/Vaktstart). Booking + Notat fully wired. Oppgave + Avvik show placeholder toast because:

- `AddTaskDialog` (apps/web/src/components/day/AddTaskDialog.tsx) owns its own open-state via an internal trigger — no controlled `open` + `onOpenChange` props
- `DeviationDialog` (apps/web/src/app/dashboard/operations/_components/DeviationDialog.tsx) same pattern

This sortie refactors both to controlled-open API + wires them into `SlotQuickAddPopover` action handlers + replaces the toast stubs with real dialog opens with prefilled time.

Follow-up #1 + #2 from parent HANDOFF.

## Journeys

- [JOURNEY-dagslinjen-task-avvik-wire-manager-quickadd-task](../journeys/JOURNEY-dagslinjen-task-avvik-wire-manager-quickadd-task.md) — Manager clicks 14:00 → Oppgave → AddTaskDialog opens prefilled → submit creates session_task
- [JOURNEY-dagslinjen-task-avvik-wire-manager-quickadd-avvik](../journeys/JOURNEY-dagslinjen-task-avvik-wire-manager-quickadd-avvik.md) — Manager clicks 16:30 → Avvik → DeviationDialog opens prefilled → submit creates deviation

## Goal

Flip both deferred journeys from parent (Oppgave + Avvik) from placeholder-toast to fully wired by refactoring two dialogs to controlled API.

## Tasks

- [ ] **Task 1** — Refactor `AddTaskDialog` to accept `open?`, `onOpenChange?`, `defaultTime?`, `defaultSessionId?` props. Preserve existing self-managed-trigger usage via fallback (uncontrolled when no `open` prop).
- [ ] **Task 2** — Refactor `DeviationDialog` same way: `open?`, `onOpenChange?`, `defaultOccurredAt?`, `defaultDepartmentId?`.
- [ ] **Task 3** — Update `TimelineTab.tsx` open-state + `handleQuickAddAction` dispatcher: replace toast stubs for `task` and `deviation` with controlled-dialog open. Mount both dialogs at bottom of TimelineTab (mirror DailyNoteSheet pattern).
- [ ] **Task 4** — Update parent E2E spec `apps/e2e/dagslinjen-quickadd/slot-quickadd.spec.ts` — flip H3 Oppgave assertion from toast to AddTaskDialog visibility + submit. Flip H4 Avvik assertion similarly. Add data-testids on dialogs.
- [ ] **Task 5** — Add new E2E specs for the two new journeys (or extend the existing slot-quickadd.spec.ts with two scenarios). Stamp `e2e_test:` in journey frontmatter.
- [ ] **Task 6** — Verify telemetry: `session.task.created` and `deviation.created` emit on dialog submit. Already exists in dialog code if pre-existing; just verify.
- [ ] **Task 7** — Flip both journeys to `verified` + write HANDOFF + register learnings.
- [ ] **Task 8** — Also flip parent journey `manager-quickadd-at-slot` from `in_progress` → `verified` in parent feature's journey file (cross-feature update justified — this sortie closes that gap).

## Dependencies

```
1 (AddTaskDialog refactor) ─┐
                            ├─→ 3 (TimelineTab wire) ─→ 4+5 (E2E) ─→ 6+7+8 (verify+flip+handoff)
2 (DeviationDialog refactor)┘
```

1+2 run parallel. 3 sequential. Single agent can do all (it's S+S scope).

## Acceptance Criteria

- [ ] Every declared journey has `status: verified` in frontmatter
- [ ] Parent journey `manager-quickadd-at-slot` flipped to `verified` (cross-feature)
- [ ] Typecheck passes: `pnpm turbo typecheck`
- [ ] Both dialogs work in BOTH uncontrolled (existing call sites) AND controlled (new SlotQuickAddPopover path)
- [ ] E2E covers both happy paths
- [ ] HANDOFF written
- [ ] No new ADR needed (refactor only, no architectural decisions)
