---
title: "Handoff — dagslinjen-task-avvik-wire"
feature: dagslinjen-task-avvik-wire
status: closed
updated: 2026-05-15
created: 2026-05-15
module: MODULE_COMMUNICATION
tags: [handoff]
---

# Handoff — dagslinjen-task-avvik-wire

## Summary

Follow-up sortie to `dagslinjen-quickadd` (merged `1405b8e6c`). Parent sortie shipped the
slot popover with 5 action buttons but deferred Oppgave + Avvik as placeholder toasts. This
sortie closes that gap.

**What was built:**

- `AddTaskDialog` refactored to controlled-open API (`open`, `onOpenChange`, `defaultTime`,
  `defaultSessionId` props). Uncontrolled mode fully preserved for `TasksTab` callers.
- `DeviationDialog` refactored to controlled-open API (`open`, `onOpenChange`,
  `defaultOccurredAt`, `defaultDepartmentId` props). `departments` prop made optional
  (defaults to `[]`) so `TimelineTab` can mount it without fetching a department list.
  Uncontrolled mode preserved for operations page caller.
- `TimelineTab`: toast stubs for `task` + `deviation` replaced with controlled dialog opens.
  Both dialogs mounted at bottom of return JSX, prefilled with `slotTime` + `dateISO`.
- `data-testid="add-task-dialog"` on `AlertDialogContent`.
- `data-testid="deviation-dialog"` on `DialogContent`.
- E2E H3 (Oppgave) + H4 (Avvik) flipped from toast assertion to dialog open + submit + close.

## Journeys Flipped

| Journey | Feature | Status |
|---------|---------|--------|
| JOURNEY-dagslinjen-task-avvik-wire-manager-quickadd-task | this sortie | verified |
| JOURNEY-dagslinjen-task-avvik-wire-manager-quickadd-avvik | this sortie | verified |
| JOURNEY-dagslinjen-quickadd-manager-quickadd-at-slot | parent sortie | verified (cross-feature) |

## Decisions

No new ADR required — this is a refactor (controlled-open pattern) on existing components.
Pattern follows `DailyNoteSheet` (already controlled-open with `open`/`onOpenChange`/`prefillTime`).

## Telemetry

- `AddTaskDialog`: telemetry emitted via `createSession.execute` in `addTaskAction` capability
  tool body. Event: `session_task.created`. Already present, no changes needed.
- `DeviationDialog`: `emit({ event: "deviation reported", ... })` in mutation `onSuccess`.
  Already present, verified in this sortie.

## Learnings

**`departments` optional pattern for slot-opened dialogs**
`DeviationDialog` previously required `departments` (Array). Making it optional with `?`
and defaulting to `[]` allows `TimelineTab` to mount it without fetching a department list.
The `defaultDepartmentId` prop preselects the correct department; the user just can't switch
department in the slot-opened flow. Operations page still passes full list explicitly.
This is the cleanest approach when a prop is "required for full UX but not for minimal UX".

**Controlled-open `isControlled` guard prevents double trigger render**
`AlertDialogTrigger` / `DialogTrigger` must be conditional on `!isControlled`. If rendered
unconditionally with a controlled `open`, Radix fires `onOpenChange(false)` on mount because
it tries to manage its own open state — causing an immediate close loop.

**Typecheck with stale symlinks**
`pnpm --filter web typecheck` fails with `tsconfig.json not found` until `pnpm install`
populates workspace symlinks in the worktree. Run `pnpm install` at worktree root first,
then `npx tsc --noEmit` from `apps/web/` directly to get accurate output.

## Known Issues / Debt

- `DeviationDialog` in controlled-open mode has an empty department Select when
  `departments` is omitted. Future improvement: add a workspace departments fetch
  inside `DeviationDialog` when `open === true && departments === undefined`.
- E2E H3/H4 submit tests require an active department session in the test workspace.
  They currently use `test.skip()` guard if no tabs visible — acceptable for CI.

## Next Steps

- Close feature: run `close-feature.sh 4` from main repo.
- Consider adding department auto-fetch in `DeviationDialog` (see debt above) as a
  separate small sortie if the empty-select UX becomes a complaint.
