---
title: "Journey — drift-insights"
status: done
updated: 2026-03-28
created: 2026-03-28
module: hms
tags: [journey, drift, insights, operations]
---

# Journey: drift-insights

## Journey: Admin Views Operational Insights on Drift Page

**Precondition:** Admin is logged in, workspace has active departments with department sessions for today.

1. Admin navigates to `/dashboard/hms/drift` -> System detects admin mode via `isAdminMode` from DashboardContext -> Admin sees the Drift page with insight strip at top
2. System loads data via `useDriftInsights(today)` -> Composes department sessions, deviations, and overdue task count -> DriftInsightStrip renders 4 metric cells
3. Admin sees **Sessions** cell showing `closed/total` with sublabel (e.g. "2 aktive") -> Variant turns critical (red) if any sessions are missed
4. Admin sees **Tasks** cell showing completion percentage -> Variant turns warning (yellow) at <80%, critical (red) at <50%
5. Admin sees **Deviations** cell showing open count or "Ingen" -> Variant turns warning if any open, critical if any are blocking
6. Admin sees **Overdue** cell showing count or "Ingen" -> Variant turns warning if any overdue

**Postcondition:** Admin has immediate operational awareness without drilling into individual sessions.

**Error paths:**

- No sessions for today -> Strip returns null (hidden), only session table shown
- Data loading -> Loader2 spinner shown in strip placeholder
- Query error -> Hook throws, parent error boundary catches

## Journey: Employee Views Task List on Drift Page

**Precondition:** Employee is logged in (not admin mode).

1. Employee navigates to `/dashboard/hms/drift` -> System detects non-admin mode -> Employee sees `DriftTaskList` component (no insight strip)

**Postcondition:** Employee sees their assigned tasks for today.

**Error paths:**

- No tasks assigned -> Empty state in DriftTaskList

## Journey: Admin Views Operations Pipeline Dashboard

**Precondition:** Admin navigates to `/dashboard/operations`.

1. System loads data via `useOperationsData()` -> 7 parallel queries (sessions, tasks, shifts, deviations, reconciliation, hourly budget, payroll settings)
2. Admin sees 6 live metric cards: Fullforring (%), Stressniwa (Lav/Middels/Hoy), Forfalt, Kommende, Til stede, Aktive
3. Stress level calculated from shift fill rate: >=90% = Lav (green), >=70% = Middels (orange), <70% = Hoy (red)
4. Admin sees Revenue vs Labor Cost hourly chart -> Budget targets per hour or evenly distributed daily total
5. Data auto-refreshes every 60 seconds (refetchInterval)

**Postcondition:** Admin has real-time operational view of today's performance.

**Error paths:**

- No sessions/shifts for today -> Graceful zeros shown (dashes for empty, "Ingen vakter i dag")
- Query errors -> Error banner with retry spinner
- No hourly budget data -> Chart shows "Ingen timedata tilgjengelig for i dag"
