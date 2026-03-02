---
title: Dashboard Redesign — Full Design
status: draft
updated: 2026-03-02
created: 2026-03-02
module: dashboard
tags: [dashboard, redesign, personas, ux, data-architecture]
---

# Dashboard Redesign — Full Design

## Overview

Full redesign of all 5 dashboard views (4 admin + 1 employee) with:

- Persona-driven panels mapped to AI council research
- Shared action inbox (top strip) across all admin views
- Signal → Context → Action layout pattern in every view
- Scannable design principles across ALL views (not just employee)
- Hybrid data plan: real Supabase queries where tables exist, flagged gaps for future

## Design Principles

1. **Every view has a persona owner** — design decisions validated against that persona's JTBD
2. **Signal → Context → Action** — top signal cards, middle context blocks, bottom action items
3. **Scannable everywhere** — no walls of numbers, visual indicators with legends, progressive disclosure
4. **Icons + text always** — never icon-only (accessibility for low-literacy/multilingual workforce)
5. **Large touch targets** — min 48px (employee view: mobile-first)
6. **Color coding with text labels** — colors indicate severity but never carry meaning alone
7. **Real data where possible** — query existing tables, placeholder where infrastructure is missing

## Research Foundation

### AI Council Personas (7 personas)

Source: `docs/research/Seven AI Council personas for Smartout's Norwegian hospitality platform.md`

| Persona               | Role                              | Dashboard View            |
| --------------------- | --------------------------------- | ------------------------- |
| Ingrid Haugen         | Multi-site restaurant manager, 42 | Tactical                  |
| Erik (research)       | Franchise owner, 50, 5 locations  | Strategic                 |
| Maria (research)      | Fine dining manager, 38, 12 staff | Reconciliation            |
| Thomas Lindgren       | HR admin, 29, regional            | Activity                  |
| Low-education persona | Immigrant worker, third-language  | Employee                  |
| Professional persona  | High-education sommelier          | Employee (power features) |

### Workforce Research (3-Level Dashboard Architecture)

Source: `docs/research/Workforce management research report.md`

- **Level 1: Operational** — "What happens NOW & next 4 hours" (shift leader)
- **Level 2: Tactical** — "This week, trends, team health" (manager)
- **Level 3: Strategic** — "KPIs, location comparison, insights" (owner)

### Key Norwegian Context

- 97,000 workers across 152,000 jobs; 50% immigrants; 50% under 30; 45% annual turnover
- Regulatory: Mattilsynet HACCP, Kunnskapsprøven, Arbeidsmiljøloven working-hour caps
- Cultural: Flat hierarchy, Dugnad mentality, "frihet under ansvar"

---

## Architecture: Shared Action Strip

A persistent 56px horizontal bar between the header and main content, visible on ALL admin views.

### Layout

```
┌──────────────────────────────────────────────────────────────────┐
│ ⚠ 2 Shift Gaps  │  📋 3 Pending  │  🎓 1 Stuck  │  📄 2 Unsigned │  → View All │
└──────────────────────────────────────────────────────────────────┘
```

### Behavior

- Each category = clickable chip with count badge
- Color: red (critical), amber (high), blue (normal), gray (low)
- Click chip → dropdown card list below strip with specific items
- Each item: person name, context line, primary action button
- "View All" → full action queue page
- Strip hides when all counts = 0 (clean state message)
- Server component with Supabase queries, refresh on navigation + 60s polling

### Action Items — Real Data

| Action Type                        | Query                                                                                 | Priority       |
| ---------------------------------- | ------------------------------------------------------------------------------------- | -------------- |
| Shift gaps (unassigned within 48h) | `schedule_shift WHERE employee_id IS NULL AND shift_date < now() + interval '2 days'` | Critical (red) |
| Pending contract signatures        | `employment_contract WHERE contract_status = 'sent'`                                  | High (amber)   |
| Onboarding stuck (>48h same state) | `onboarding_session WHERE updated_at < now() - interval '48 hours'`                   | High (amber)   |
| Unassigned protocols               | `protocol_assignment WHERE status = 'pending'` (count per profile)                    | Normal (blue)  |
| Stale invitations (>7 days)        | `invitation WHERE status = 'pending' AND created_at < now() - interval '7 days'`      | Low (gray)     |

### Action Items — Needs New Infrastructure

| Action Type             | Required Infrastructure                                                     | Priority |
| ----------------------- | --------------------------------------------------------------------------- | -------- |
| Expiring certifications | New `certification` table or protocol expiry dates on `protocol_assignment` | High     |
| Overtime alerts         | Time tracking / punch-in system                                             | High     |
| Deviation reviews       | `department_session` table (Module 5, planned)                              | Medium   |
| KPI threshold breaches  | `kpi_config` + `strategic_metrics_snapshot` tables (Module 10)              | Medium   |

---

## View 1: Tactical (Persona: Ingrid — Multi-Site Manager)

**JTBD:** "Show me what needs my attention this week so I can act, not investigate."

### Layout

```
┌─────────────────────────────────────────────────────────────────┐
│ ACTION STRIP (shared)                                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐                  │
│  │Staffing│ │Wage %  │ │Absence │ │Tasks   │   ← SIGNALS      │
│  │ 92%  ↑ │ │28.3% ✓│ │ 4.2% ↑ │ │87%   ✓│                  │
│  └────────┘ └────────┘ └────────┘ └────────┘                  │
│                                                                 │
│  ┌──────────────────────────┐ ┌────────────────────┐           │
│  │ 7-Day Staffing Coverage  │ │ This Week's Alerts │ ← CONTEXT │
│  │ [visual bars per day]    │ │ • Cert expiry (2)  │           │
│  │                          │ │ • Event: banquet   │           │
│  │                          │ │ • Overtime risk (3)│           │
│  └──────────────────────────┘ └────────────────────┘           │
│                                                                 │
│  ┌──────────────────────────────────────────────┐              │
│  │ Needs Your Action                            │ ← ACTION     │
│  │ [shift gap cards] [approval cards]            │              │
│  └──────────────────────────────────────────────┘              │
└─────────────────────────────────────────────────────────────────┘
```

### Signal Cards

| Card              | Data Source                                              | Status      | Thresholds                         |
| ----------------- | -------------------------------------------------------- | ----------- | ---------------------------------- |
| Staffing Coverage | `schedule_shift` — assigned vs total positions this week | Real        | Green >90%, Amber 75-90%, Red <75% |
| Wage %            | Revenue data + shift hours × rate                        | Placeholder | Green <30%, Amber 30-35%, Red >35% |
| Absence Rate      | `schedule_shift.status = 'sick'` count / total           | Placeholder | Green <3%, Amber 3-5%, Red >5%     |
| Task Completion   | `protocol_assignment` completed / total this period      | Real        | Green >85%, Amber 70-85%, Red <70% |

### Context Blocks

- **7-Day Staffing Coverage (70% width):** Horizontal progress bars per day. Query: `schedule_shift` grouped by `shift_date` for next 7 days. Color per bar based on fill ratio.
- **This Week's Alerts (30% width):** Aggregated items from action strip + upcoming events. Card list with severity icons.

### Action Section

Filtered subset of action strip items relevant to this week. Each card: assignable, with primary action button.

### Filters

- Department dropdown (from `department` table)
- Week navigation (← This Week →)

---

## View 2: Strategic (Persona: Erik — Multi-Location Owner)

**JTBD:** "Compare my locations, spot trends, know if we're healthy."

### Layout

```
┌─────────────────────────────────────────────────────────────────┐
│ ACTION STRIP (shared)                                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  [All Locations ▾]  [Last 30 days ▾]  [vs Budget ▾]            │
│                                                                 │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐      │
│  │Turnover│ │Wage %  │ │Absence │ │Ready   │ │Compli- │ SIGNAL│
│  │ 12% ↓  │ │28% ✓  │ │ 4.2% ↑ │ │ 78%  ↑ │ │ance 94%│      │
│  └────────┘ └────────┘ └────────┘ └────────┘ └────────┘      │
│                                                                 │
│  ┌──────────────────────────┐ ┌────────────────────┐           │
│  │ Location Comparison Grid │ │ Workforce Pipeline │ CONTEXT   │
│  │ [heatmap: loc × KPI]    │ │ Active: 142        │           │
│  │                          │ │ Hired (30d): +12   │           │
│  │                          │ │ Left (30d): -4     │           │
│  │                          │ │ Onboarding: 8      │           │
│  └──────────────────────────┘ └────────────────────┘           │
│                                                                 │
│  ┌──────────────────────────────────────────────┐              │
│  │ 6-Month Trend (selected KPI)                 │ DEEP DIVE   │
│  │ [area chart with target line]                 │              │
│  └──────────────────────────────────────────────┘              │
└─────────────────────────────────────────────────────────────────┘
```

### Signal Cards (5 KPIs)

| Card               | Data Source                                                        | Status         |
| ------------------ | ------------------------------------------------------------------ | -------------- |
| 90-Day Turnover %  | Needs `profile` status change history or `status_change_log` table | Placeholder    |
| Wage %             | Needs POS/payroll integration                                      | Placeholder    |
| Absence Rate       | Needs shift status tracking                                        | Placeholder    |
| Training Readiness | `protocol_assignment` completed % across workspace                 | Real           |
| Compliance Health  | `protocol_assignment` WHERE type in compliance protocols           | Partially real |

### Context Blocks

**Location Comparison Grid (70% width):**

- Heatmap: rows = locations, columns = KPIs
- Cell color = performance vs target (green/amber/red)
- Click cell → drill into that location + KPI
- Data: `profile` + `protocol_assignment` JOIN `department` JOIN `location` for real KPIs; placeholder for financial KPIs

**Workforce Pipeline (30% width):**

- Active staff: `SELECT COUNT(*) FROM profile WHERE workspace_id = $1 AND status = 'active'`
- New hires (30d): `profile WHERE created_at > now() - interval '30 days'`
- Departures (30d): `profile WHERE status = 'offboarding' AND updated_at > now() - interval '30 days'`
- Onboarding: `onboarding_session WHERE state != 'completed'` count
- **All queries available with existing tables**

**6-Month Trend Chart (full width):**

- Area chart for selected KPI
- Needs `strategic_metrics_snapshot` table (Module 10) for historical data
- Placeholder with generated data until snapshots exist
- Target line configurable via settings modal

### Filters

- Location dropdown (from `location` table) — filters all widgets
- Time period: 7d / 30d / 90d / custom
- Comparison: vs Budget / vs Last Period / vs Target

---

## View 3: Reconciliation (Persona: Maria — Fine Dining Manager)

**JTBD:** "Close the day in 5 minutes. Flag what's wrong. Approve what's right."

### Layout

```
┌─────────────────────────────────────────────────────────────────┐
│ ACTION STRIP (shared)                                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  [Today ◀ ▶]  [Department: All ▾]                              │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Department Session Cards                                  │  │
│  │                                                           │  │
│  │ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐         │  │
│  │ │ 🟢 Kitchen  │ │ 🟡 Service  │ │ 🔴 Bar      │         │  │
│  │ │ 4/4 staff   │ │ 3/5 staff   │ │ Deviation!  │         │  │
│  │ │ 32.0h total │ │ 24.5h total │ │ 16.0h total │         │  │
│  │ │ [Approved ✓]│ │ [Review →]  │ │ [Review →]  │         │  │
│  │ └─────────────┘ └─────────────┘ └─────────────┘         │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Detail Panel (expand on card click)                       │  │
│  │ Tabs: Shifts & Hours │ Revenue │ Deviations │ Tasks      │  │
│  │ [shift table: scheduled vs actual + flags]                │  │
│  │ [Approve Day ✓]                                           │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### Department Session Cards

- One card per department for the selected day
- Status indicator: green (approved), amber (needs review), red (has deviations)
- Metrics: staff count, total hours, deviation count
- Primary action: "Approve" or "Review"
- **Data:** `schedule_shift` grouped by department (via `position.department_id`) for the selected date

### Detail Panel (expandable)

| Tab            | Data Source                                              | Status      |
| -------------- | -------------------------------------------------------- | ----------- |
| Shifts & Hours | `schedule_shift` JOIN `profile` for selected dept + date | Real        |
| Revenue        | Manual entry field; needs POS integration for auto       | Placeholder |
| Deviations     | Needs `department_session` + `deviation` tables          | Placeholder |
| Tasks          | Needs task completion tracking                           | Placeholder |

### Key Design Change

- **Cards instead of 12-column table rows** — more scannable, mobile-friendlier
- Each department is a distinct visual unit with clear status
- Detail panel uses Framer Motion expand/collapse animation

### Filters

- Date navigation (← Today →)
- Department filter (from `department` table)

---

## View 4: Activity (Persona: Thomas — HR Admin)

**JTBD:** "Who's engaged, who's falling behind, where's training stuck?"

### Layout

```
┌─────────────────────────────────────────────────────────────────┐
│ ACTION STRIP (shared)                                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  [Locations │ Departments │ Teams │ People]  [Last 30 days ▾]  │
│                                                                 │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐                  │
│  │Activity│ │Highest │ │Lowest  │ │People  │   ← SIGNALS      │
│  │Score   │ │Cluster │ │Cluster │ │Active  │                  │
│  └────────┘ └────────┘ └────────┘ └────────┘                  │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Heatmap Grid                                              │  │
│  │ [rows = entity, cols = days, intensity = activity score]  │  │
│  │ Click cell → sidebar with detail breakdown                │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Training Progress (NEW)                                   │  │
│  │ [stacked bar per dept/person: done │ in-progress │ todo]  │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### Signal Cards

| Card                 | Data Source                             | Status                                   |
| -------------------- | --------------------------------------- | ---------------------------------------- |
| Total Activity Score | Weighted `activity_trail` count         | Partially real (needs scoring algorithm) |
| Highest Intensity    | MAX group from heatmap data             | Depends on scoring                       |
| Lowest Intensity     | MIN group from heatmap data             | Depends on scoring                       |
| People Active        | `profile WHERE status = 'active'` count | Real                                     |

### Heatmap

- Tab navigation: Locations / Departments / Teams / People
- Rows = selected entity, Columns = days (30-day default)
- Cell intensity = activity score (6 color levels)
- Click cell → sidebar detail panel with action breakdown
- **Data:** `activity_trail` grouped by entity + date; needs scoring weights

### Training Progress (NEW addition)

- Stacked horizontal bar chart
- Per department or per person (toggle)
- Segments: completed (green) / in-progress (amber) / not started (gray)
- **Data:** `protocol_assignment` grouped by `profile_id` or `department_id`, counted by status
- **This is immediately buildable with real data**

### Filters

- Entity tab (Locations / Departments / Teams / People)
- Time period: 7d / 14d / 30d / 90d

---

## View 5: Employee (Personas: Low-Literacy Worker + Professional)

**JTBD:** "What do I do now? Am I ready? How am I doing?"

### Layout

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ TODAY'S SHIFT (hero card)                                 │  │
│  │ 🕐 15:00 - 23:30  •  Service  •  Main Restaurant        │  │
│  │ [Punch In →]                                              │  │
│  │ Working with: Anna, Per, Kari                             │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌─────────────────┐ ┌─────────────────┐                      │
│  │ 🎯 My Readiness │ │ 📅 Next Shifts  │                      │
│  │ ████████░░ 78%  │ │ Mon 08-16 Kj.   │                      │
│  │ 3 protocols left│ │ Wed 15-23 Sal   │                      │
│  │ [Continue →]    │ │ Thu 08-16 Kj.   │                      │
│  └─────────────────┘ └─────────────────┘                      │
│                                                                 │
│  ┌─────────────────┐ ┌─────────────────┐                      │
│  │ Quick Actions   │ │ Open Shifts     │                      │
│  │ • Set Avail.    │ │ 2 available     │                      │
│  │ • Time Off      │ │ [View →]        │                      │
│  │ • Swap Shift    │ │                 │                      │
│  └─────────────────┘ └─────────────────┘                      │
└─────────────────────────────────────────────────────────────────┘
```

### Widgets — All Real Data

| Widget        | Query                                                                                                   | Status |
| ------------- | ------------------------------------------------------------------------------------------------------- | ------ |
| Today's Shift | `schedule_shift WHERE employee_id = $profile AND shift_date = CURRENT_DATE`                             | Ready  |
| Next Shifts   | `schedule_shift WHERE employee_id = $profile AND shift_date > CURRENT_DATE ORDER BY shift_date LIMIT 5` | Ready  |
| My Readiness  | `protocol_assignment WHERE profile_id = $profile`: completed count / total count                        | Ready  |
| Open Shifts   | `schedule_shift WHERE employee_id IS NULL AND is_published = true AND shift_date > CURRENT_DATE`        | Ready  |
| Colleagues    | `schedule_shift WHERE shift_date = CURRENT_DATE AND department matches` → JOIN `profile`                | Ready  |

### Accessibility Design Rules

- **Max 2 columns** on any screen size
- **Large touch targets:** minimum 48px height for all interactive elements
- **Icons + text always:** never icon-only buttons
- **Progress bar** for readiness (visual, not just %)
- **High contrast** color coding with text labels alongside
- **No dense tables** — card-based everything
- **Simple language** — action verbs, short sentences

### Key Changes from Current

1. **Readiness widget is NEW** — directly from `protocol_assignment` data
2. **Colleagues on today's shift** — social context for the day
3. **Simplified quick actions** — 3 buttons max, not a 2x2 grid
4. **No action strip** — employee view has no admin inbox

---

## Data Architecture Summary

### Available Now (existing tables)

| Data              | Table(s)                                     | Views Using                             |
| ----------------- | -------------------------------------------- | --------------------------------------- |
| Shift schedule    | `schedule_shift` + `position` + `department` | All 5 views                             |
| Staff profiles    | `profile` + `team_member` + `team`           | All views                               |
| Training progress | `protocol_assignment` + `protocol`           | Tactical, Strategic, Activity, Employee |
| Onboarding status | `onboarding_session`                         | Action Strip, Strategic                 |
| Contracts         | `employment_contract`                        | Action Strip                            |
| Invitations       | `invitation`                                 | Action Strip                            |
| Activity audit    | `activity_trail`                             | Activity                                |
| Locations         | `location`                                   | Strategic, Reconciliation               |
| Departments       | `department`                                 | All admin views                         |

### Needs New Infrastructure

| Data                     | Required Table/Feature                   | Views Using               | Priority |
| ------------------------ | ---------------------------------------- | ------------------------- | -------- |
| KPI snapshots            | `strategic_metrics_snapshot` (Module 10) | Strategic, Tactical       | High     |
| KPI targets              | `kpi_config` (Module 10)                 | Strategic, Tactical       | High     |
| Department sessions      | `department_session` (Module 5)          | Reconciliation            | High     |
| Certification tracking   | `certification` or protocol expiry       | Action Strip, Tactical    | Medium   |
| Time tracking / punch-in | Clock-in/out system                      | Employee, Tactical        | Medium   |
| Activity scoring         | Scoring algorithm + weights              | Activity                  | Medium   |
| Revenue / POS data       | POS integration or manual entry          | Strategic, Reconciliation | Low      |
| Status change history    | `profile_status_log` or trigger          | Strategic (turnover)      | Low      |

---

## Component Architecture

### New Components Needed

| Component                | Type             | Purpose                                      |
| ------------------------ | ---------------- | -------------------------------------------- |
| `ActionStrip`            | Server Component | Shared top strip with action counts          |
| `ActionStripDropdown`    | Client Component | Expandable card list per action category     |
| `SignalCard`             | Client Component | Reusable metric card with threshold coloring |
| `StaffingCoverageChart`  | Client Component | 7-day horizontal bar chart                   |
| `LocationComparisonGrid` | Client Component | Heatmap grid (loc × KPI)                     |
| `WorkforcePipeline`      | Server Component | Pipeline stats card                          |
| `DepartmentSessionCard`  | Client Component | Reconciliation department card               |
| `TrainingProgressChart`  | Client Component | Stacked bar chart                            |
| `ReadinessBar`           | Client Component | Employee progress bar                        |
| `ShiftHeroCard`          | Client Component | Today's shift prominent card                 |

### Refactored Components

| Current                              | Change                                                               |
| ------------------------------------ | -------------------------------------------------------------------- |
| `AdminDashboard.tsx` (997 lines)     | Split into 4 view components + shared Signal/Context/Action sections |
| `EmployeeDashboard.tsx` (335 lines)  | Replace mock data with Supabase queries, add Readiness widget        |
| `ReconciliationView.tsx` (634 lines) | Cards instead of table, real shift data                              |
| `ActivityView.tsx` (355 lines)       | Add Training Progress panel, real protocol data                      |

---

## Success Metrics (from research)

| Metric                        | Target                            | Source                        |
| ----------------------------- | --------------------------------- | ----------------------------- |
| Manager morning check time    | 5 min (vs 45 min current)         | Workforce Research: Journey 1 |
| Weekly planning time          | 20 min (vs 2-3 hours)             | Workforce Research: Journey 2 |
| Time to identify staffing gap | < 10 seconds                      | Ingrid persona JTBD           |
| Employee readiness visibility | Instant (vs "check with manager") | Low-literacy persona          |
| Action items to zero          | Daily goal for tactical view      | Maria persona JTBD            |
