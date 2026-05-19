---
title: Sortie — Daglinje Wiring
status: in_progress
updated: 2026-05-18
created: 2026-05-18
module: day-control
tags: [adr-0367, day-line, integration, wiring]
---

# Sortie — Daglinje Wiring

## Why

ADR-0367 shipped 11 PRs. Audit 2026-05-18 found 4 CT2/CT3 components built but never mounted:

1. `ScopeFilterPopover` (multi-select, W7-W9) — dead code, legacy `ScopeFilterPill` still renders
2. `AggregatedDayLineList` — dead code, no consumer
3. `DayLineCreateSheet` — dead code, no "Ny dagslinje"-button anywhere
4. `AttachRoutineDialog` — dead code, no "Legg til rutine"-trigger

E2E J2–J4 blocked. User cannot create day_line or scope-filter via UI.

## Scope

Wire 4 components into parent surfaces. No new components, no new actions, no new capabilities. Pure integration.

## Files to edit

| Action | File | Change |
|---|---|---|
| Replace | `apps/web/src/components/day/TimelineTopBar.tsx` | swap `ScopeFilterPill` → `ScopeFilterPopover` (multi-select). Adapt props (multi-select uses `selection: ScopeSelection` not single `scope`). Keep SavedTimelinesDropdown next to it. |
| Mount | `apps/web/src/components/day/tabs/TimelineTab.tsx` | (a) "Ny dagslinje"-trigger above DayLineStrip-list when canEdit + session.status ≠ closed. Opens `DayLineCreateSheet`. (b) When AggregatedDayLineList is appropriate (scope.type !== "all" AND scope.type === "location"), render it INSTEAD of multi-strip — line filtered to picked location. |
| Mount | `apps/web/src/components/day/DayLineStripHeader.tsx` OR `DayLineStrip.tsx` | "Legg til rutine"-button per strip, opens `AttachRoutineDialog` scoped to that day_line. Per-strip state. |

## Hard constraints

- No new server actions / capabilities.
- No schema changes.
- Re-use existing `useDayLines` hook to invalidate after `DayLineCreateSheet` save.
- Nordic Split: no OKLCH literals (ADR-0366). Use CSS variables only.
- ADR-0240: do NOT bypass capability layer; sheets/dialogs already call server actions correctly — verify they do.
- shadcn/ui new-york + Lucide icons only.
- Mobile parity: this is web-only wiring; mobile already has its own surface.

## Acceptance (falsifiable)

1. `grep -rln "ScopeFilterPill" apps/web/src/` returns either zero or only test files. `ScopeFilterPopover` imported by `TimelineTopBar`.
2. Manual: visit `/dashboard` on 2026-05-18, Dagslinjen tab → "Ny dagslinje"-button visible above strip-list when canEdit. Click → DayLineCreateSheet opens.
3. Manual: on a rendered strip, "Legg til rutine"-button visible. Click → AttachRoutineDialog opens with that day_line preselected.
4. Manual: scope filter pill opens new multi-select popover with departments + teams + locations + shifts multi-checkbox. Old single-select tab UI removed.
5. `pnpm turbo typecheck --filter=web` = 0 errors.
6. `grep -rn "AggregatedDayLineList\|DayLineCreateSheet\|AttachRoutineDialog" apps/web/src/components/day/tabs/` returns ≥1 hit per name → all mounted.
7. Lint clean.

## Journeys

Existing journeys become reachable. No new journey files needed:

- `JOURNEY-day-line-create.md` — now reachable via UI button (previously only via API)
- `JOURNEY-day-line-attach-routine.md` — now reachable via UI button
- `JOURNEY-day-line-edit-hours.md` — already wired (OpenCloseEditPopover)

## Out of scope

- E2E test updates (separate sortie; J2-J4 unblocked by this)
- Mobile changes
- New capabilities
- `hms` capability creation
- `task.create_session` schema extension
- Push-pipeline coverage

## Dispatch

1 sonnet build-agent. ~3 file-edits. Closes 4 dead-code paths.
