---
title: "JOURNEY — Manager opens /dashboard/oppgaver for today's overview"
status: verified
created: 2026-05-24
updated: 2026-05-24
feature: p11-oppgaver-page
module: day-session
tags: [journey, oppgaver, manager-timeline]
---

# Manager opens /dashboard/oppgaver for today's overview

**Precondition:** Manager (role owner/admin/manager) signed in. Workspace has ≥1 `day_line` row for today + ≥1 `session_task` linked to it.

## Happy path

1. Manager clicks **Oppgaver** in sidebar → System routes to `/dashboard/oppgaver` (admin-path guard allows; employees redirected to `/dashboard/my-schedule`) → Manager sees TopBar (brand "Dagslinjen" + today's date + "Lukk dagen → AVV" CTA disabled placeholder + manager-pill).
2. System mounts `ManagerTimelineShell` → `DomainChatOwnership` declares "oppgaver-timeline" → Botsson Orb suppresses to passive (ADR-0238) → 3 hooks fire (`useDayLinesForDate`, `useSessionTasksForDate`, `useRolesForPositions` V1 stub) → telemetry emits `oppgaver.view_opened` once.
3. Manager sees Toolbar with 3-segment view-mode switcher (Område selected) + area chip-bar + "Kun åpne" + "Avvik" (with destructive count badge) + zoom cluster.
4. Manager sees Gantt chart: 6 areas as bands (left to right by day_line ordering) × time vertical (06:00→02:00) → RoutineStrips paint behind → NowLine pulses (gated by `useReducedMotion`) → PastDim covers from 06:00 to current minute → tasks render in person columns with `layoutOverlap` algorithm.

**Postcondition:** Manager has a single-screen overview of today's plan across all areas. Botsson chat surface knows the context via `pinOppgaverContextAction` 24h TTL row in `engine_memory`.

## Error paths

- **No `day_line` for today:** Chart renders empty bands → empty-state message "Ingen dagslinjer for denne datoen" (i18n key `oppgaver.empty.no_day_lines`).
- **Hook fetch fails (RLS / network):** TanStack `error` state surfaces in chart body → empty list with retry on focus.
- **Employee profile reaches URL directly:** `ADMIN_ONLY_PATH_PREFIXES` redirect to `/dashboard/my-schedule`.
