---
title: "Audit: Frontend UI Data Connections"
status: in_progress
updated: 2026-04-09
created: 2026-04-09
module: engine
tags: [audit, frontend, data, ui-elements]
---

# Audit: Frontend UI Data Connections

> Systematic mapping of every UI element to its data source across all dashboard pages.
> Generated 2026-04-09 by code analysis. No code was modified.

---

## 1. Dashboard Main — `apps/web/src/app/dashboard/page.tsx`

Routes to `AdminDashboard` (admin/manager/owner) or `EmployeeDashboard` (employee) based on `isAdminMode` from DashboardContext.

### 1a. DashboardShell — `apps/web/src/components/dashboard/DashboardShell.tsx`

| Element                    | Component      | Data Source | Hook/Query                 | Table                  | Column(s)                | Notes                            |
| -------------------------- | -------------- | ----------- | -------------------------- | ---------------------- | ------------------------ | -------------------------------- |
| Workspace name in sidebar  | DashboardShell | real        | useWorkspaceOptional       | workspace              | name                     | Via workspace-context            |
| User name / avatar         | UserMenu       | real        | Server layout props        | user_identity, profile | display_name, avatar_url | Passed from server component     |
| Admin/employee mode toggle | DashboardShell | real        | Derived from profile.role  | profile                | role                     | admin/manager/owner = admin mode |
| Dark mode toggle           | DashboardShell | computed    | Local state                | —                      | —                        | Persisted in localStorage        |
| Voice assistant button     | DashboardShell | static      | —                          | —                      | —                        | Opens VoiceAssistant overlay     |
| Route-to-mission mapping   | DashboardShell | static      | ROUTE_MISSION_MAP constant | —                      | —                        | Hardcoded route-mission pairs    |

### 1b. ActionStrip — `apps/web/src/components/dashboard/ActionStrip.tsx`

| Element                 | Component   | Data Source | Hook/Query                      | Table                            | Column(s)                                  | Notes                             |
| ----------------------- | ----------- | ----------- | ------------------------------- | -------------------------------- | ------------------------------------------ | --------------------------------- |
| Shift gaps count        | ActionStrip | real        | useActionItems                  | schedule_shift                   | employee_id IS NULL, shift_date            | Unassigned shifts in next 2 days  |
| Pending contracts count | ActionStrip | real        | useActionItems                  | employment_contract              | status='sent'                              | Count query                       |
| Stuck onboarding count  | ActionStrip | real        | useActionItems                  | onboarding_session               | completed_at IS NULL, updated_at < 48h ago | Count query                       |
| Pending protocols count | ActionStrip | real        | useActionItems                  | protocol_assignment JOIN profile | status='pending'                           | Workspace-scoped via profile join |
| Stale invitations count | ActionStrip | real        | useActionItems                  | invitation                       | status='pending', created_at < 7d ago      | Count query                       |
| "All clear" message     | ActionStrip | computed    | Derived from counts.total === 0 | —                                | —                                          | Shows when no action items        |

### 1c. TacticalView — `apps/web/src/components/dashboard/TacticalView.tsx`

#### Elements with Real Data

| Element                                | Component         | Hook/Query            | Table                            | Column(s)               | Notes                                     |
| -------------------------------------- | ----------------- | --------------------- | -------------------------------- | ----------------------- | ----------------------------------------- |
| Staffing fill % (Bemanning card)       | TacticalView      | useStaffingCoverage   | schedule_shift                   | shift_date, employee_id | 7-day weekly coverage, grouped by date    |
| Ring chart (assigned/total shifts)     | DashboardCard     | useStaffingCoverage   | schedule_shift                   | employee_id             | Count of assigned vs total                |
| Sparkline data                         | DashboardCard     | useStaffingCoverage   | schedule_shift                   | —                       | Daily fill percentages                    |
| Today's gaps count                     | TacticalView      | useStaffingCoverage   | schedule_shift                   | —                       | Computed: total - assigned for today      |
| Training readiness % (Opplaering card) | TacticalView      | useTrainingReadiness  | protocol_assignment JOIN profile | status                  | Workspace-scoped via profile.workspace_id |
| Training completed/total               | DashboardCard     | useTrainingReadiness  | protocol_assignment              | status='completed'      | Ratio shown as trend                      |
| Training pending count                 | TacticalView      | useTrainingReadiness  | protocol_assignment              | status='pending'        | Alert strip and secondary text            |
| Staffing breakdown (expand)            | StaffingBreakdown | useStaffingCoverage   | schedule_shift                   | —                       | Day-by-day bars                           |
| Training breakdown (expand)            | TrainingBreakdown | useTrainingReadiness  | protocol_assignment              | status                  | Completed/pending/expired counts          |
| Leader Pulse questions                 | LeaderPulseCard   | useLeaderPulse        | leader_pulse                     | question, status        | Pending/delivered pulses                  |
| Pulse answer submission                | LeaderPulseCard   | useLeaderPulse.answer | leader_pulse                     | answer, answered_at     | Mutation                                  |

#### Elements with Mock/Static/Placeholder Data

| Element                                                           | Component            | Current Source                 | What It Should Show                      | Suggested Table                | Priority      |
| ----------------------------------------------------------------- | -------------------- | ------------------------------ | ---------------------------------------- | ------------------------------ | ------------- |
| Protocol cards (Matservering, Brannvern, Kassasystem, Allergener) | ProtocolCardsSection | DEMO_PROTOCOLS hardcoded array | Real protocol data with assignment stats | protocol + protocol_assignment | **high**      |
| Protocol procedures count (4, 3, 6, 5)                            | ProtocolCard         | DEMO_PROTOCOLS                 | Procedure count per protocol             | procedure                      | **high**      |
| Protocol control lists count                                      | ProtocolCard         | DEMO_PROTOCOLS                 | Control list count per protocol          | control_list                   | **high**      |
| Protocol knowledge tests count                                    | ProtocolCard         | DEMO_PROTOCOLS                 | Knowledge test count per protocol        | knowledge_test                 | **high**      |
| Protocol confirmations count                                      | ProtocolCard         | DEMO_PROTOCOLS                 | Confirmation count per protocol          | confirmation                   | **high**      |
| Protocol assigned/completed employees                             | ProtocolCard         | DEMO_PROTOCOLS                 | Real assignment counts                   | protocol_assignment            | **high**      |
| Week number display                                               | TacticalView         | computed                       | —                                        | —                              | n/a (correct) |

### 1d. StrategicView — `apps/web/src/components/dashboard/StrategicView.tsx`

#### Elements with Real Data

| Element                              | Component         | Hook/Query                 | Table                            | Column(s)                                   | Notes                             |
| ------------------------------------ | ----------------- | -------------------------- | -------------------------------- | ------------------------------------------- | --------------------------------- |
| KPI target values                    | KPICard           | useKpiTargets              | workspace_kpi_target             | metric, target_value                        | Falls back to DEFAULT_KPI_TARGETS |
| KPI target save                      | DialogTargetInput | useKpiTargets.updateTarget | workspace_kpi_target             | target_value                                | Upsert mutation                   |
| Training readiness % (all locations) | StrategicView     | useTrainingReadiness       | protocol_assignment JOIN profile | status                                      | Only used when location='all'     |
| Active employees count               | PipelineRow       | useWorkforcePipeline       | profile                          | is_active=true                              | Count query                       |
| New hires (30d)                      | PipelineRow       | useWorkforcePipeline       | profile                          | joined_at >= 30d ago                        | Count query                       |
| Departures (30d)                     | PipelineRow       | useWorkforcePipeline       | profile                          | status='offboarding', updated_at >= 30d ago | Count query                       |
| Onboarding count                     | PipelineRow       | useWorkforcePipeline       | profile                          | status='trainee'                            | Count query                       |

#### Elements with Mock/Static/Placeholder Data

| Element                                         | Component     | Current Source                   | What It Should Show                | Suggested Table                           | Priority     |
| ----------------------------------------------- | ------------- | -------------------------------- | ---------------------------------- | ----------------------------------------- | ------------ |
| Varekostnad % (29.0%, 29.2%, etc.)              | KPICard       | defaultMetrics hardcoded object  | Real cost-of-sales calculation     | schedule_shift (hours \* wage) vs revenue | **critical** |
| 90-dagers personalomsetning (14%, 12%, etc.)    | KPICard       | defaultMetrics                   | Real 90-day turnover calculation   | profile (status changes)                  | **critical** |
| Fravaersrate (3.9%, 3.1%, etc.)                 | KPICard       | defaultMetrics                   | Real absence rate                  | schedule_absence                          | **critical** |
| Tid til jobbklar (6.2d, 5.8d, etc.)             | KPICard       | defaultMetrics                   | Real time-to-ready calculation     | profile (joined_at to readiness complete) | **critical** |
| Oppgavefullfoering (88%, 91%, etc.)             | KPICard       | defaultMetrics                   | Real task completion rate          | No table exists yet                       | **high**     |
| Location selector (Baardshaug, Trondheim, Oslo) | StrategicView | LOCATIONS hardcoded array        | Real location list                 | location                                  | **high**     |
| Per-location metrics (all individual values)    | StrategicView | defaultMetrics per location      | Real per-location calculations     | Various                                   | **high**     |
| Turnover trend chart (6-month bars)             | TurnoverChart | chartData hardcoded per location | Real historical turnover data      | profile (monthly aggregation)             | **high**     |
| Month labels (Sep, Okt, Nov, Des, Jan, Feb)     | TurnoverChart | Hardcoded months array           | Dynamic based on actual date range | —                                         | **medium**   |
| Pipeline tenure (8.4 mnd, 11.2 mnd, etc.)       | PipelineRow   | defaultMetrics.tenure            | Real avg tenure                    | profile (joined_at)                       | **medium**   |

### 1e. ReconciliationView — `apps/web/src/components/dashboard/ReconciliationView.tsx`

#### Elements with Real Data

| Element                    | Component          | Hook/Query          | Table                                        | Column(s)            | Notes                                                 |
| -------------------------- | ------------------ | ------------------- | -------------------------------------------- | -------------------- | ----------------------------------------------------- |
| Department groups + shifts | ReconciliationView | useDepartmentShifts | schedule_shift JOIN position JOIN department | Multiple             | Grouped by department for date                        |
| Shift employee name        | ShiftRow           | useDepartmentShifts | schedule_shift                               | employee_id          | NOTE: employeeName always null — missing profile join |
| Shift role                 | ShiftRow           | useDepartmentShifts | schedule_shift                               | role                 |                                                       |
| Shift times                | ShiftRow           | useDepartmentShifts | schedule_shift                               | start_time, end_time |                                                       |
| Shift work hours           | ShiftRow           | useDepartmentShifts | schedule_shift                               | work_hours           |                                                       |
| Department name + color    | DeptSection        | useDepartmentShifts | department                                   | name, color          | Via position join                                     |
| Total hours per dept       | ProgressHeader     | useDepartmentShifts | schedule_shift                               | work_hours (sum)     |                                                       |

#### Elements with No Real Backend

| Element                           | Component          | Notes                                                          |
| --------------------------------- | ------------------ | -------------------------------------------------------------- |
| Approve/Dispute/Handoff decisions | ShiftRow           | Client-only state (useState), NOT persisted to DB              |
| Day approval status               | ReconciliationView | Client-only state, no DB write                                 |
| Handoff messages                  | ShiftRow           | Client-only, toast only — no actual message sent               |
| Employee name in shift rows       | ShiftRow           | Always null — hook comment: "Would need profile join for name" |

### 1f. ActivityView — `apps/web/src/components/dashboard/ActivityView.tsx`

#### Elements with Real Data

| Element                | Component     | Hook/Query           | Table               | Column(s)      | Notes                             |
| ---------------------- | ------------- | -------------------- | ------------------- | -------------- | --------------------------------- |
| Active employees count | DashboardCard | useWorkforcePipeline | profile             | is_active=true | Count                             |
| New hires trend        | DashboardCard | useWorkforcePipeline | profile             | joined_at      | "+X nye" label                    |
| Training readiness %   | DashboardCard | useTrainingReadiness | protocol_assignment | status         |                                   |
| Training progress bar  | ActivityView  | useTrainingReadiness | protocol_assignment | status         | Stacked completed/pending/expired |

#### Elements with Mock/Static/Placeholder Data

| Element                                   | Component           | Current Source                               | What It Should Show           | Suggested Table                    | Priority     |
| ----------------------------------------- | ------------------- | -------------------------------------------- | ----------------------------- | ---------------------------------- | ------------ |
| Heatmap data (all tabs)                   | ActivityView        | generateHeatmapData() — random Math.random() | Real activity/shift intensity | schedule_shift, department_session | **critical** |
| Location labels                           | ActivityView        | LOCATION_LABELS hardcoded                    | Real locations                | location                           | **high**     |
| Department labels                         | ActivityView        | DEPARTMENT_LABELS hardcoded                  | Real departments              | department                         | **high**     |
| Team labels                               | ActivityView        | TEAM_LABELS hardcoded                        | Real teams                    | team                               | **high**     |
| Employee labels                           | ActivityView        | EMPLOYEE_LABELS hardcoded                    | Real employee names           | profile                            | **high**     |
| "Hoyest intensitet: Fredager"             | DashboardCard       | static string                                | Calculated from real data     | —                                  | **high**     |
| "Lavest intensitet: Sondag FM"            | DashboardCard       | static string                                | Calculated from real data     | —                                  | **high**     |
| "-5.2% vs budsjett"                       | DashboardCard       | static string                                | Real budget comparison        | workspace_budget                   | **high**     |
| Activity detail panel (hourly/event data) | ActivityDetailPanel | Hardcoded formula/arrays                     | Real activity log events      | No table exists                    | **medium**   |

### 1g. GuardianView — `apps/web/src/components/dashboard/GuardianView.tsx`

#### Elements with Real Data

| Element                                       | Component              | Hook/Query         | Table                                                  | Column(s)                                                  | Notes                                |
| --------------------------------------------- | ---------------------- | ------------------ | ------------------------------------------------------ | ---------------------------------------------------------- | ------------------------------------ |
| Active agents count                           | GuardianMetricsSection | useGuardianData    | engine_sessions                                        | status='active', mode='mission'                            | Count                                |
| Active signals count                          | GuardianMetricsSection | useGuardianData    | guardian_signal                                        | status IN ('active','acknowledged')                        | Count                                |
| Critical signals count                        | GuardianMetricsSection | useGuardianData    | guardian_signal                                        | severity='critical'                                        | Filtered from signals                |
| Average session time                          | GuardianMetricsSection | useGuardianData    | engine_sessions                                        | created_at                                                 | Computed from active sessions        |
| Guardian whisper count                        | GuardianMetricsSection | useGuardianData    | engine_sessions                                        | guardian_whisper_count                                     | Sum across sessions                  |
| Season pulse (name, price factor, day factor) | SeasonPulseSection     | useGuardianData    | season, season_budget, day_factor                      | Multiple                                                   | Active season covering today         |
| Active sessions list                          | ActiveProtocolsSection | useGuardianData    | engine_sessions JOIN engine_missions, profile, journey | Multiple                                                   | Real session data                    |
| Session stage progress                        | SessionCard            | useGuardianData    | engine_stages                                          | mission_id (count)                                         | Batch-fetched per mission            |
| Signal feed                                   | SignalFeedSection      | useGuardianData    | guardian_signal                                        | title, description, severity, domain, status, entity_label |                                      |
| Signal acknowledge/resolve/dismiss            | SignalActions          | useGuardianActions | guardian_signal (via Edge Function)                    | status                                                     | Calls guardian-actions Edge Function |

#### Elements with Mock/Static/Placeholder Data

| Element                                   | Component                 | Current Source                  | What It Should Show           | Suggested Table                   | Priority |
| ----------------------------------------- | ------------------------- | ------------------------------- | ----------------------------- | --------------------------------- | -------- |
| Protocol Compliance section (5 protocols) | ProtocolComplianceSection | DEMO_COMPLIANCE hardcoded array | Real protocol compliance data | protocol + protocol_assignment    | **high** |
| "73 tilordninger totalt"                  | ProtocolComplianceSection | static string                   | Real count                    | protocol_assignment               | **high** |
| "+12% siste 30 dager"                     | ProtocolComplianceSection | static string                   | Real trend calculation        | protocol_assignment (time series) | **high** |

### 1h. EmployeeDashboard — `apps/web/src/components/dashboard/EmployeeDashboard.tsx`

#### Elements with Real Data

| Element                             | Component         | Hook/Query      | Table               | Column(s)                                          | Notes                 |
| ----------------------------------- | ----------------- | --------------- | ------------------- | -------------------------------------------------- | --------------------- |
| Today's shift                       | EmployeeDashboard | useMyShifts     | schedule_shift      | shift_date, start_time, end_time, role, work_hours | Filtered by profileId |
| Upcoming shifts (next 6)            | EmployeeDashboard | useMyShifts     | schedule_shift      | shift_date, start_time, end_time, role             |                       |
| My Readiness % + progress bar       | EmployeeDashboard | useMyReadiness  | protocol_assignment | status                                             | Filtered by profileId |
| Pending protocols count             | EmployeeDashboard | useMyReadiness  | protocol_assignment | status='pending'                                   |                       |
| Open shifts (unassigned, published) | EmployeeDashboard | inline useQuery | schedule_shift      | employee_id IS NULL, is_published=true             | Direct Supabase query |

#### Elements with No Real Backend

| Element                   | Component         | Notes                                                       |
| ------------------------- | ----------------- | ----------------------------------------------------------- |
| "Punch In" button         | EmployeeDashboard | Button exists but no click handler / no time tracking table |
| "Set Availability" button | EmployeeDashboard | Button exists, no functionality                             |
| "Time Off" button         | EmployeeDashboard | Button exists, no functionality                             |
| "Swap Shift" button       | EmployeeDashboard | Button exists, no functionality                             |
| "Take Shift" button       | EmployeeDashboard | Button exists, no mutation to assign shift                  |
| "My Active Tasks" section | EmployeeDashboard | Always shows "No active task lists" — placeholder           |

---

## 2. Schedule — `apps/web/src/app/dashboard/schedule/page.tsx`

### Elements with Real Data

| Element                    | Component                             | Hook/Query                                     | Table                              | Column(s)                     | Notes                                 |
| -------------------------- | ------------------------------------- | ---------------------------------------------- | ---------------------------------- | ----------------------------- | ------------------------------------- |
| Weekly shift grid          | SchedulePage / GridContent            | useShifts                                      | schedule_shift                     | All columns                   | Full CRUD with optimistic updates     |
| Employee roster (sidebar)  | SchedulePage                          | useEmployees                                   | profile JOIN team_member JOIN team | display_name, job_title, role |                                       |
| Open shifts                | OpenShiftCard                         | useOpenShifts                                  | schedule_shift                     | employee_id IS NULL           |                                       |
| Absences                   | AbsenceCard                           | useAbsences                                    | schedule_absence                   | Multiple                      |                                       |
| Templates                  | TemplateCard                          | useTemplates                                   | schedule_template                  | Multiple                      |                                       |
| Shift create/update/delete | ShiftModal                            | useCreateShift, useUpdateShift, useDeleteShift | schedule_shift                     | All                           | Mutations with optimistic UI          |
| Realtime updates           | SchedulePage                          | useScheduleRealtime                            | schedule_shift                     | —                             | Supabase realtime subscription        |
| Status strip counts        | StatusStrip                           | useScheduleComputed                            | schedule_shift                     | —                             | Derived: total, assigned, open, hours |
| Audit log                  | DayControlPanel                       | useAuditLog                                    | audit_log                          | —                             |                                       |
| Day info dialog            | DayInfoDialog                         | useDayInfo                                     | Multiple                           | —                             |                                       |
| Broadcast dialog           | BroadcastDialog                       | —                                              | —                                  | —                             | Sends via Edge Function               |
| Save/Load template         | SaveTemplateDialog, LoadTemplateSheet | useTemplates                                   | schedule_template                  | —                             |                                       |

### Elements with Static Data

| Element                                | Component    | Current Source                            | Notes                                       |
| -------------------------------------- | ------------ | ----------------------------------------- | ------------------------------------------- |
| Department/Team/Position filter labels | SchedulePage | Fetched via useEmployees + inline queries | Real but limited — pulls from profile joins |
| Week navigation labels                 | SchedulePage | computed                                  | Correct — derived from current date         |

---

## 3. Season — `apps/web/src/app/dashboard/season/page.tsx`

### Elements with Real Data

| Element                                             | Component            | Hook/Query                                       | Table         | Column(s)                                                                           | Notes                                               |
| --------------------------------------------------- | -------------------- | ------------------------------------------------ | ------------- | ----------------------------------------------------------------------------------- | --------------------------------------------------- |
| Season list + selector                              | SeasonSelector       | useSeasons                                       | season        | name, slug, status, start_date, end_date                                            | All workspace seasons                               |
| Season create                                       | SeasonManagementCard | useSeasons.createSeason                          | season        | name, start_date, end_date                                                          | Mutation                                            |
| Budget setup (revenue, labor %, wage, price factor) | BudgetSetupTab       | useSeasonBudget                                  | season_budget | total_target_revenue, target_labor_percentage, avg_hourly_wage, season_price_factor | Upsert                                              |
| Day factors (weekday weights)                       | DayFactorsTab        | useDayFactors                                    | day_factor    | weekday, factor                                                                     | 7 rows per budget                                   |
| Hour factors (hourly weights)                       | HourFactorsTab       | useHourFactors                                   | hour_factor   | hour, factor                                                                        | 24 rows per budget                                  |
| Season overview (computed targets)                  | SeasonOverviewTab    | useSeasonBudget + useDayFactors + useHourFactors | Multiple      | —                                                                                   | Pure calculation engine                             |
| Budget lock status                                  | SeasonPage           | useSeasonBudget                                  | season_budget | status                                                                              | draft/active/locked                                 |
| Setup status indicators                             | SeasonPage           | computed                                         | —             | —                                                                                   | Derived from hasBudget/hasDayFactors/hasHourFactors |

### Elements with Static Data

| Element                                                    | Component  | Current Source | Notes      |
| ---------------------------------------------------------- | ---------- | -------------- | ---------- |
| "MODULE 15" badge                                          | SeasonPage | static string  | Label only |
| Tab labels (Oversikt, Budsjett, Dagfaktorer, Timefaktorer) | SeasonPage | TABS constant  | UI labels  |

---

## 4. Reports — `apps/web/src/app/dashboard/reports/`

### ALL report data is mock/hardcoded

The entire Reports module uses hardcoded data from `report-data.ts`. The file itself contains the comment: `TODO: Replace each section with real Supabase queries via TanStack Query hooks`.

#### Overview Tab (`OverviewSection.tsx`)

| Element                                                | Current Source        | What It Should Show          | Priority     |
| ------------------------------------------------------ | --------------------- | ---------------------------- | ------------ |
| KPI: Ansatte = 47                                      | OVERVIEW_KPIS         | Real profile count           | **critical** |
| KPI: Beredskap = 73%                                   | OVERVIEW_KPIS         | Real readiness %             | **critical** |
| KPI: Vaktdekning = 89%                                 | OVERVIEW_KPIS         | Real shift coverage %        | **critical** |
| KPI: Opplaering = 61%                                  | OVERVIEW_KPIS         | Real training %              | **critical** |
| KPI change strings (+3, +5pp, -2pp, +8pp)              | OVERVIEW_KPIS         | Real period comparisons      | **critical** |
| 7-day trend chart (beredskap/dekning/opplaering)       | TREND_7D              | Real daily metrics           | **critical** |
| Department stats (Kjokken/Sal/Bar)                     | DEPARTMENT_STATS      | Real department data         | **high**     |
| Quick insights (Hoyest beredskap, etc.)                | TOP_INSIGHTS          | Real computed insights       | **high**     |
| Entity steering stack (Locations/Profiles/Departments) | ENTITY_STEERING_STACK | Real entity counts + revenue | **high**     |
| Heatmap labels                                         | HEATMAP_LABELS        | Real entity names            | **high**     |

#### People Tab (`PeopleSection.tsx`)

| Element                                                   | Current Source      | What It Should Show                            | Priority |
| --------------------------------------------------------- | ------------------- | ---------------------------------------------- | -------- |
| Role distribution donut chart                             | ROLE_DISTRIBUTION   | Real role counts from profile                  | **high** |
| Status breakdown bars (Aktiv/Trainee/Inaktiv/Offboarding) | STATUS_BREAKDOWN    | Real status counts from profile                | **high** |
| Tenure distribution histogram                             | TENURE_DISTRIBUTION | Real tenure calculation from profile.joined_at | **high** |
| Department headcount comparison                           | DEPARTMENT_STATS    | Real per-department profile counts             | **high** |

#### Staffing Tab (`StaffingSection.tsx`)

| Element                                          | Current Source  | What It Should Show                               | Priority |
| ------------------------------------------------ | --------------- | ------------------------------------------------- | -------- |
| Weekly coverage chart (needed vs assigned)       | WEEKLY_COVERAGE | Real shift coverage data                          | **high** |
| Shift type distribution bars                     | SHIFT_TYPES     | Real shift time groupings                         | **high** |
| Labor hours 4-week trend (planned/actual/budget) | LABOR_HOURS_4W  | Real hours from schedule_shift + workspace_budget | **high** |
| Unfilled shifts list                             | UNFILLED_SHIFTS | Real unassigned shifts                            | **high** |

#### Training Tab (`TrainingSection.tsx`)

| Element                                                 | Current Source                   | What It Should Show                   | Priority |
| ------------------------------------------------------- | -------------------------------- | ------------------------------------- | -------- |
| Protocol compliance bars (7 protocols)                  | PROTOCOL_COMPLIANCE              | Real protocol assignment data         | **high** |
| Training completion trend (4 weeks)                     | TRAINING_TREND_30D               | Real weekly completion counts         | **high** |
| Overdue assignments table (5 employees)                 | OVERDUE_ASSIGNMENTS              | Real overdue protocol_assignment rows | **high** |
| Summary KPIs (avg compliance, total, overdue, critical) | Derived from PROTOCOL_COMPLIANCE | Real aggregation                      | **high** |

#### Saved Reports Tab

| Element            | Component        | Data Source | Notes                                               |
| ------------------ | ---------------- | ----------- | --------------------------------------------------- |
| Saved reports grid | SavedReportsGrid | Likely real | Would query a reports table (not audited in detail) |
| AI Report Drawer   | AiReportDrawer   | real        | Calls Edge Function for AI-generated reports        |

---

## 5. Other Dashboard Pages

### 5a. Governance — `apps/web/src/app/dashboard/governance/page.tsx`

| Element                   | Component          | Data Source    | Hook/Query                         | Table                                     | Notes                                        |
| ------------------------- | ------------------ | -------------- | ---------------------------------- | ----------------------------------------- | -------------------------------------------- |
| Protocol overview list    | GovernanceOverview | real           | useGovernanceOverview              | protocol JOIN policy, protocol_assignment | Active protocols with completion %           |
| Completion % per protocol | GovernanceOverview | real           | useGovernanceOverview              | protocol_assignment                       | Aggregated counts                            |
| Overdue alerts            | OverdueAlerts      | real (partial) | Derived from useGovernanceOverview | protocol_assignment                       | expiredCount > 0, but dates are approximated |
| Protocol count badge      | GovernancePage     | real           | useGovernanceOverview              | protocol                                  | Count of active protocols                    |

### 5b. People — `apps/web/src/app/dashboard/people/page.tsx`

| Element                                    | Component       | Data Source | Hook/Query                        | Table                                    | Notes     |
| ------------------------------------------ | --------------- | ----------- | --------------------------------- | ---------------------------------------- | --------- |
| Employee data table                        | PeopleDataTable | real        | Direct Supabase query (useEffect) | profile JOIN department, user_identity   | Full CRUD |
| Invitation list                            | PeopleDataTable | real        | Direct Supabase query             | invitation                               |           |
| Metric counts (active, readiness, invites) | PeoplePage      | real        | Direct Supabase count queries     | profile, protocol_assignment, invitation |           |

### 5c. Organization — `apps/web/src/app/dashboard/organization/page.tsx`

| Element                  | Component        | Data Source | Notes                                 |
| ------------------------ | ---------------- | ----------- | ------------------------------------- |
| Company info             | OverviewTab      | real        | Direct Supabase query — company table |
| Workspace info           | OverviewTab      | real        | workspace table                       |
| Departments list + CRUD  | DepartmentsTab   | real        | department table                      |
| Locations list + CRUD    | LocationsTab     | real        | location table                        |
| Teams list + CRUD        | TeamsTab         | real        | team table                            |
| Positions, Zones, Assets | OrganizationPage | real        | position, zone, asset tables          |
| Profile count            | OrganizationPage | real        | profile count query                   |

### 5d. Operations — `apps/web/src/app/dashboard/operations/page.tsx`

| Element                             | Component      | Current Source          | Notes                        |
| ----------------------------------- | -------------- | ----------------------- | ---------------------------- |
| Completion: 68%                     | MetricCard     | **static** "68%"        | No real data connection      |
| Stress Level: High                  | MetricCard     | **static** "High"       | No real data connection      |
| Overdue Tasks: 2                    | MetricCard     | **static** "2"          | No real data connection      |
| Upcoming Tasks: 5                   | MetricCard     | **static** "5"          | No real data connection      |
| Staff Present: 4/5                  | MetricCard     | **static** "4 / 5"      | No real data connection      |
| Tasks Out: 8                        | MetricCard     | **static** "8"          | No real data connection      |
| Revenue vs Staff Cost chart         | OperationsPage | **mock** hardcoded bars | Hardcoded revenue/cost pairs |
| Staff names (Anna, Erik, Lise, Ole) | MetricCard     | **static** string       | No real data                 |

### 5e. Settings — `apps/web/src/app/dashboard/settings/page.tsx`

Delegates to `SettingsTabs` component (not audited in detail — likely real data for workspace settings).

### 5f. AI — `apps/web/src/app/dashboard/ai/page.tsx`

| Element             | Component | Current Source | Notes                        |
| ------------------- | --------- | -------------- | ---------------------------- |
| "Mr. Botsson" title | AiPage    | static         | Label                        |
| Configuration link  | AiPage    | static         | Navigation link              |
| Chat card           | AiPage    | static         | Placeholder — "Kommer snart" |

### 5g. Chat — `apps/web/src/app/dashboard/chat/page.tsx`

Delegates to `ChatShell` — uses profileId from DashboardContext. Real data (messages are stored in DB).

### 5h. Close — `apps/web/src/app/dashboard/close/page.tsx`

Delegates to `CloseOutFlow` component (daily close-out flow, likely real data).

### 5i. Employee pages (my-schedule, my-training, my-cv, my-salary, help)

Not audited in detail — these are employee-facing pages.

---

## Final Summary

### Coverage Per Page

| Page                           | Real | Mock/Static | Placeholder/None | Total Elements |
| ------------------------------ | ---- | ----------- | ---------------- | -------------- |
| Dashboard — TacticalView       | 11   | 6           | 0                | 17             |
| Dashboard — StrategicView      | 7    | 10          | 0                | 17             |
| Dashboard — ReconciliationView | 7    | 0           | 4                | 11             |
| Dashboard — ActivityView       | 4    | 8           | 0                | 12             |
| Dashboard — GuardianView       | 10   | 3           | 0                | 13             |
| Dashboard — EmployeeDashboard  | 5    | 0           | 6                | 11             |
| Dashboard — ActionStrip        | 5    | 0           | 0                | 5              |
| Schedule                       | 12   | 0           | 0                | 12             |
| Season                         | 8    | 0           | 0                | 8              |
| Reports (ALL tabs)             | 1-2  | **30+**     | 0                | 32             |
| Governance                     | 4    | 0           | 0                | 4              |
| People                         | 3    | 0           | 0                | 3              |
| Organization                   | 7    | 0           | 0                | 7              |
| Operations                     | 0    | **8**       | 0                | 8              |

### Mock/Placeholder Elements by Priority

#### CRITICAL (business metrics showing wrong numbers)

| Element                                      | Page                    | Current Source        | Suggested Data Source                                                            |
| -------------------------------------------- | ----------------------- | --------------------- | -------------------------------------------------------------------------------- |
| Varekostnad %                                | StrategicView           | defaultMetrics object | schedule_shift \* hourly_wage / revenue                                          |
| 90-dagers personalomsetning                  | StrategicView           | defaultMetrics object | profile status change history                                                    |
| Fravaersrate                                 | StrategicView           | defaultMetrics object | schedule_absence / schedule_shift hours                                          |
| Tid til jobbklar                             | StrategicView           | defaultMetrics object | profile.joined_at to readiness complete                                          |
| ALL Reports KPIs (47 ansatte, 73%, 89%, 61%) | Reports OverviewSection | OVERVIEW_KPIS         | Existing hooks (useWorkforcePipeline, useTrainingReadiness, useStaffingCoverage) |
| ALL Reports charts and tables                | Reports (4 tabs)        | report-data.ts        | New hooks needed                                                                 |
| Heatmap data (random numbers)                | ActivityView            | Math.random()         | Real activity data                                                               |
| Operations page (all 6 metrics + chart)      | Operations              | Static strings        | department_session, schedule_shift                                               |

#### HIGH (important UI elements with fake data)

| Element                                           | Page              | Current Source                |
| ------------------------------------------------- | ----------------- | ----------------------------- | ----------------------------- |
| Protocol cards (DEMO_PROTOCOLS)                   | TacticalView      | Hardcoded 4-protocol array    |
| Protocol compliance (DEMO_COMPLIANCE)             | GuardianView      | Hardcoded 5-protocol array    |
| Location selector + per-location metrics          | StrategicView     | LOCATIONS + defaultMetrics    |
| Turnover trend chart                              | StrategicView     | Hardcoded per-location arrays |
| Activity labels (locations/depts/teams/employees) | ActivityView      | Hardcoded name arrays         |
| Oppgavefullfoering %                              | StrategicView     | defaultMetrics                | No task-tracking table exists |
| Employee dashboard action buttons                 | EmployeeDashboard | Buttons without handlers      |

#### MEDIUM (nice to have, lower business impact)

| Element                     | Page          | Notes                        |
| --------------------------- | ------------- | ---------------------------- |
| Turnover chart month labels | StrategicView | Hardcoded, should be dynamic |
| Pipeline tenure values      | StrategicView | Per-location values are mock |
| Activity detail panel       | ActivityView  | Hardcoded event/hourly data  |

### Full List of Hooks/Queries Used

| Hook                  | File                                      | Fetches From                    | Table(s)                                                                                 |
| --------------------- | ----------------------------------------- | ------------------------------- | ---------------------------------------------------------------------------------------- |
| useActionItems        | use-action-items.ts                       | 5 parallel count queries        | schedule_shift, employment_contract, onboarding_session, protocol_assignment, invitation |
| useStaffingCoverage   | use-staffing-coverage.ts                  | 7-day shift coverage            | schedule_shift                                                                           |
| useTrainingReadiness  | use-training-readiness.ts                 | Protocol assignment stats       | protocol_assignment JOIN profile                                                         |
| useWorkforcePipeline  | use-workforce-pipeline.ts                 | 4 parallel profile counts       | profile                                                                                  |
| useKpiTargets         | use-kpi-targets.ts                        | KPI target values + upsert      | workspace_kpi_target                                                                     |
| useDepartmentShifts   | use-department-shifts.ts                  | Shifts grouped by department    | schedule_shift JOIN position JOIN department                                             |
| useMyShifts           | use-my-dashboard.ts                       | Employee's upcoming shifts      | schedule_shift                                                                           |
| useMyReadiness        | use-my-dashboard.ts                       | Employee's protocol completion  | protocol_assignment                                                                      |
| useBudget             | use-budget.ts                             | Workspace budget entries        | workspace_budget                                                                         |
| useGuardianData       | useGuardianData.ts                        | Signals, sessions, season pulse | guardian_signal, engine_sessions, season, season_budget, day_factor                      |
| useGuardianActions    | useGuardianActions.ts                     | Signal mutations                | guardian_signal (via Edge Function)                                                      |
| useLeaderPulse        | useLeaderPulse.ts                         | Pending pulse questions         | leader_pulse                                                                             |
| useGovernanceOverview | use-governance-overview.ts                | Active protocols with stats     | protocol JOIN policy, protocol_assignment                                                |
| useProtocolAssignees  | use-protocol-assignees.ts                 | Assignees per protocol          | protocol_assignment JOIN profile                                                         |
| useProtocolJourney    | use-protocol-journey.ts                   | Journey phases/steps            | protocol journey data                                                                    |
| useShifts             | schedule/\_hooks/use-shifts.ts            | Weekly shift CRUD               | schedule_shift                                                                           |
| useEmployees          | schedule/\_hooks/use-employees.ts         | Employee roster                 | profile JOIN team_member JOIN team                                                       |
| useAbsences           | schedule/\_hooks/use-absences.ts          | Absence records                 | schedule_absence                                                                         |
| useTemplates          | schedule/\_hooks/use-templates.ts         | Schedule templates              | schedule_template                                                                        |
| useOpenShifts         | schedule/\_hooks/use-open-shifts.ts       | Unassigned shifts               | schedule_shift                                                                           |
| useScheduleRealtime   | schedule/\_hooks/use-schedule-realtime.ts | Realtime subscription           | schedule_shift                                                                           |
| useSeasons            | season/\_hooks/use-seasons.ts             | Season list + CRUD              | season                                                                                   |
| useSeasonBudget       | season/\_hooks/use-season-budget.ts       | Season budget + upsert          | season_budget                                                                            |
| useDayFactors         | season/\_hooks/use-day-factors.ts         | Day factor weights              | day_factor                                                                               |
| useHourFactors        | season/\_hooks/use-hour-factors.ts        | Hour factor weights             | hour_factor                                                                              |

### Data Gaps — Tables/Data That Don't Exist

| What the UI Wants                | Where                       | Gap                                                 |
| -------------------------------- | --------------------------- | --------------------------------------------------- |
| Real cost-of-sales calculation   | StrategicView KPICard       | No revenue/POS integration table                    |
| Real absence rate                | StrategicView KPICard       | schedule_absence exists but no hours aggregation    |
| Task completion tracking         | StrategicView KPICard       | No task/checklist completion table                  |
| Time tracking (punch in/out)     | EmployeeDashboard           | No time_entry or clock table                        |
| Shift swap functionality         | EmployeeDashboard           | No shift_swap_request table                         |
| Availability preferences         | EmployeeDashboard           | No availability table                               |
| Time-off requests                | EmployeeDashboard           | No time_off_request table                           |
| Activity/intensity heatmap       | ActivityView                | No activity_log or similar table                    |
| Operations live metrics          | OperationsPage              | department_session exists but page doesn't query it |
| Historical turnover data         | StrategicView TurnoverChart | No monthly aggregation stored                       |
| Per-location metric calculations | StrategicView               | Queries exist for "all" only, not per-location      |
