---
title: "Journey — Interactive Dashboard"
status: done
updated: 2026-03-29
created: 2026-03-29
module: dashboard
tags: [journey, dashboard, interactive, bento-grid]
---

# Journey — Interactive Dashboard

## Journey: Manager views dashboard in Operative mode

**Precondition:** Manager is logged in. Active shifts exist today (published + within time window).

1. Manager opens `/dashboard` → System auto-detects operative mode (shifts active) → Dashboard renders bento grid with TaskSwiper, OnDutyStrip, ActivityFeed, QuickBroadcast, KpiPills
2. Manager sees TaskSwiper showing highest-priority action card (e.g., "Erik Pedersen — 12 min sen") → Swipes through cards with arrow keys or drag
3. Manager clicks "Send påminnelse" on late arrival card → Toast confirms reminder sent → Card dismissed
4. Manager sees OnDutyStrip showing 8 avatar circles with status dots → Clicks totals badge → Expand panel shows full shift details
5. Manager clicks avatar → Entity drawer opens (read-only) showing profile details
6. Manager types message in QuickBroadcast → Selects "På jobb" group (3 recipients) → Clicks Send → Toast: "Sendt til 3 personer"
7. Manager sees KpiPills update in realtime (task completion %, deviations count)
8. Manager sees ActivityFeed with new entries sliding in (real-time via Supabase Realtime)

**Postcondition:** Manager has handled pending actions without navigating away from the dashboard.

**Error paths:**

- No active shifts → System shows Preparatory mode instead
- Data hooks fail → Individual cells show retry buttons or "—" values
- Broadcast send fails → Toast error, input preserved

---

## Journey: Manager views dashboard in Preparatory mode

**Precondition:** Manager is logged in. No active shifts (evening/morning before operations).

1. Manager opens `/dashboard` → System auto-detects preparatory mode → Dashboard shows PrepActionCards, StaffingCoverageBar, ActivityFeed, QuickBroadcast, KpiPills
2. Manager sees PrepActionCards sorted by severity: "Fredag 4/4: 2 hull" (critical), "3 kontrakter venter" (warning)
3. Manager clicks "Finn vikar" on staffing gap → Navigates to schedule
4. Manager sees StaffingCoverageBar showing 7-day fill rates → Clicks Thursday bar (75%) → Popover shows "6 av 8 vakter bemannet"
5. Manager clicks "+ Ny oppgave" → InlineTaskCreator expands → Types "Bestill laksefileter" → Assigns to Anna → Sets due tomorrow → Clicks Opprett → Toast confirms, card collapses
6. Manager sees KpiPills: training readiness 82%, absence rate 4.2%, turnover 8%, fill rate 91%
7. Manager clicks training KPI → Expands inline showing detail + target configuration

**Postcondition:** Manager has reviewed upcoming week and created tasks without leaving the dashboard.

**Error paths:**

- No upcoming session → InlineTaskCreator disabled with "Ingen kommende økt" message
- No staffing data → Gray bars with "Ingen vaktdata" text

---

## Journey: Manager switches mode manually

**Precondition:** Manager is on the dashboard in any mode.

1. Manager sees DashboardModeToggle in metric strip: `Drift | Forberedelse | Auto`
2. Manager clicks "Forberedelse" → Override applied → Grid crossfades to preparatory layout (250ms exit, 500ms enter)
3. Manager works in preparatory mode
4. Manager clicks "Auto" → System re-evaluates based on live shifts → Returns to auto-detected mode

**Postcondition:** Mode toggle persists until page reload or manual "Auto" reset.

---

## Journey: Manager uses feature flag fallback

**Precondition:** `NEXT_PUBLIC_INTERACTIVE_DASHBOARD=false` in environment.

1. Manager opens `/dashboard` → AdminDashboard checks feature flag → Renders old HospitalityOperationsCockpit (tactical) or StrategicView (strategic)
2. No interactive components loaded

**Postcondition:** Old dashboard works exactly as before. Safe rollback.

---

## Journey: Employee views dashboard

**Precondition:** Employee (non-admin) is logged in.

1. Employee opens `/dashboard` → EmployeeDashboard renders (unchanged by this feature)
2. Interactive dashboard is admin-only (behind `isAdminMode` check in page.tsx)

**Postcondition:** Employee experience unchanged.
