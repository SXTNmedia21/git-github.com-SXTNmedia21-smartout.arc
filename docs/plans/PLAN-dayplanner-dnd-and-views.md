---
title: "Plan — dayplanner-dnd-and-views"
status: draft
updated: 2026-05-25
created: 2026-05-25
module: day-session
feature: dayplanner-dnd-and-views
tags: [plan, dayplanner, oppgaver, dnd, view-modes, p11-followup]
affected_domains: [day-session]
---

# Plan — dayplanner-dnd-and-views

> Branch: `feat/dayplanner-dnd-and-views` | Worktree: `/home/sxtnl/dev/smartout.ai-wt-1` | Base: `development` | Module: day-session | Started: 2026-05-25

## Goal

Extend `/dashboard/oppgaver` (Manager Timeline page shipped in p11-oppgaver-page) with three missing features from the Claude Design prototype: drag-and-drop task re-timing, area/role/person view modes, and chip-filter + zoom wired to the chart body.

## Source

- Design prototype: `docs/domains/day-session/day-planner/project/Manager Timeline.html` + `timeline-app.jsx` + `timeline-shared.jsx` + `timeline-chart.jsx`
- Gap-analysis: Explore agent report 2026-05-25 (see HANDOFF at close)
- p11 closure handoff: `docs/HANDOFF-p11-oppgaver-page.md` for upstream debt

## Scope — IN

1. **Phase A: DnD task re-timing** — drag task block to new time + assignee, persist via task capability
2. **Phase B: View-mode swimlanes** — area / role / person modes wired to ManagerTimelineChart, chip-bar selector in toolbar
3. **Phase C: Filter + zoom wiring** — chip-filter dims non-matching lanes; toolbar zoom buttons set `pxPerHour` (50-180)

## Scope — OUT (explicit, deferred to follow-up sorties)

- Broadcast tab in right-rail (separate notifications sortie)
- Apply-template modal (cascade-template capability)
- Close-day modal (D6 production completion sortie)
- Search (V2, Q2)
- Quick-add popover (task.create_session UX expansion)
- Deviation pins (requires deviation data-pipeline first)
- Notes/broadcast track (notifications domain)
- Multi-day support (D1 envelope expansion)

## Architecture

**Data layer:**
- Existing hooks (`useDayLinesForDate`, `useSessionTasksForDate`, `useRolesForPositions`) stay — they already return what Phase A/B/C need
- NEW mutation: `session_task.update_scheduled_at` via task-capability (delegates to existing task tool group, ADR-0298 task ontology compliance)
- NEW client-side state: `viewMode: "area" | "role" | "person"`, `pxPerHour: number`, `activeFilters: Set<string>` — all local React useState in ManagerTimelineShell

**Telemetry (must register + emit per L-0340):**
- `oppgaver.task_re_timed` — `{ workspace_id, profile_id, task_id, from_iso, to_iso, from_assignee, to_assignee }`
- `oppgaver.view_mode_changed` — `{ workspace_id, profile_id, from_mode, to_mode }`
- `oppgaver.filter_toggled` — `{ workspace_id, profile_id, filter_type, filter_value, active }`
- `oppgaver.zoom_changed` — `{ workspace_id, profile_id, px_per_hour }`

## Phase A — DnD task re-timing

**Files:**
- MODIFY: `apps/web/src/app/dashboard/oppgaver/_components/ManagerTimelineShell.tsx` — wire drag handlers
- CREATE: `apps/web/src/app/dashboard/oppgaver/_components/_chart/useDragRetiming.ts` — drag state + drop calculation
- MODIFY: `packages/ai/src/capabilities/task/tools/update.ts` (or create if absent) — `update_scheduled_at` tool
- CREATE: `apps/web/src/app/dashboard/_actions/update-task-scheduled-at.ts` — server action wrapper, L-0177 fail-fast
- MODIFY: `packages/telemetry/src/registry.ts` — register `oppgaver.task_re_timed`

**Acceptance (Journey 2):** Manager drags task block from lane A 12:00 to lane B 14:00 → release → toast confirms → DB has new `scheduled_at` + `assignee_profile_id` → telemetry emit fired with from/to → reload shows new position.

## Phase B — View-mode swimlanes

**Files:**
- MODIFY: `apps/web/src/app/dashboard/oppgaver/_components/TimelineToolbar.tsx` — view-mode selector (3 buttons or segmented control)
- CREATE: `apps/web/src/app/dashboard/oppgaver/_components/_chart/AreaSwimlane.tsx` — area-mode lane layout
- CREATE: `apps/web/src/app/dashboard/oppgaver/_components/_chart/RoleSwimlane.tsx` — role-mode lane layout (groups by `role_id`)
- CREATE: `apps/web/src/app/dashboard/oppgaver/_components/_chart/PersonSwimlane.tsx` — person-mode lane (one lane per assigned profile)
- MODIFY: `apps/web/src/app/dashboard/oppgaver/_components/ManagerTimelineShell.tsx` — viewMode state, swimlane selector
- MODIFY: `packages/telemetry/src/registry.ts` — register `oppgaver.view_mode_changed`

**Acceptance (Journey 3):** Manager clicks "Roller" in toolbar → chart re-renders grouped by role → click "Personer" → grouped by person → tasks visible in correct lanes → emit fired per mode change.

## Phase C — Filter + zoom wiring

**Files:**
- MODIFY: `apps/web/src/app/dashboard/oppgaver/_components/TimelineToolbar.tsx` — wire chip-toggle callbacks to shell state
- MODIFY: `apps/web/src/app/dashboard/oppgaver/_components/ManagerTimelineShell.tsx` — pass `activeFilters` + `pxPerHour` to chart, dim non-matching, propagate zoom
- MODIFY: `packages/telemetry/src/registry.ts` — register `oppgaver.filter_toggled` + `oppgaver.zoom_changed`

**Acceptance (Journey 1):** Manager clicks area-chip "Kjøkken" → non-Kjøkken lanes dim to 30% opacity → tasks outside Kjøkken hidden → click "Alle" → reset. Zoom +/− changes `pxPerHour` by 20px steps within [50, 180].

## Tasks

- [ ] Phase A.1 — Verify `session_task.scheduled_at` schema column exists; if not, defer Phase A and open separate migration sortie
- [ ] Phase A.2 — Register telemetry event `oppgaver.task_re_timed` in registry
- [ ] Phase A.3 — Write failing test for `useDragRetiming` drop-calculation
- [ ] Phase A.4 — Implement `useDragRetiming` hook + `update-task-scheduled-at` server action
- [ ] Phase A.5 — Wire drag handlers in ManagerTimelineShell + TaskBlock; emit on drop
- [ ] Phase A.6 — E2E Playwright spec for Journey 2 (DnD happy path)
- [ ] Phase B.1 — Verify role→task data path; document expected shape
- [ ] Phase B.2 — Register telemetry event `oppgaver.view_mode_changed`
- [ ] Phase B.3 — Build AreaSwimlane (refactor existing lane logic into named component)
- [ ] Phase B.4 — Build RoleSwimlane + PersonSwimlane
- [ ] Phase B.5 — Add view-mode selector to TimelineToolbar; wire shell state + emit
- [ ] Phase B.6 — E2E Playwright spec for Journey 3 (mode switching)
- [ ] Phase C.1 — Register telemetry events `oppgaver.filter_toggled` + `oppgaver.zoom_changed`
- [ ] Phase C.2 — Wire chip-toggle in TimelineToolbar → activeFilters state in shell
- [ ] Phase C.3 — Apply filter as dim/hide in chart body
- [ ] Phase C.4 — Wire zoom +/− buttons to `pxPerHour` with [50, 180] bounds
- [ ] Phase C.5 — E2E Playwright spec for Journey 1 (filter toggle)
- [ ] Closure.1 — Write 3 journey files (mark `status: verified` post-build)
- [ ] Closure.2 — Write HANDOFF (decisions, learnings, debt, next steps)
- [ ] Closure.3 — Run `pnpm turbo typecheck --filter web --force`
- [ ] Closure.4 — L-0340 grep — verify 4 new event names each have ≥1 emit-site

## Acceptance Criteria

- [ ] All 3 phases shipped + per-phase Acceptance pass
- [ ] 3 JOURNEY-dayplanner-*.md frontmatter `status: verified` + `feature: dayplanner-dnd-and-views`
- [ ] HANDOFF written
- [ ] `pnpm turbo typecheck --filter web` passes
- [ ] L-0340 grep returns ≥1 emit per new event name
- [ ] No new ADR-0298 violations (task capability is sole writer to `session_task.scheduled_at`)
- [ ] Manager Timeline.html design parity verified visually for all 3 modes

## Risks + Open Questions

- **DnD library choice** — prototype uses native HTML5 drag-and-drop. Decide vs `@dnd-kit/core`. Recommend native first (zero dep), revisit if accessibility gaps appear.
- **`session_task.scheduled_at` column existence** — must verify schema; if absent, Phase A blocks on migration (separate sortie).
- **Role swimlane data** — `useRolesForPositions` provides roles, but task→role mapping may need server-side join. Verify before Phase B.
