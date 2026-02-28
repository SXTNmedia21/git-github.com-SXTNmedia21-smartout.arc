---
title: "Build Order (Detailed Implementation Plan)"
id: PLAN_BUILD_ORDER
version: "1.0"
status: canonical
layer: plan
created: 2026-02-24
updated: 2026-02-28
author: pontus
supersedes: []
superseded_by: null
depends_on: []
tags:
  - plan
  - build-order
  - implementation
  - waves
tables: []
changelog:
  - date: 2026-02-28
    change: "Added YAML frontmatter"
---

# Smartout — Build Order (Detailed Implementation Plan)

> Step-by-step implementation tasks for each wave.
> This is the execution companion to [`project-roadmap.md`](roadmaps/project-roadmap.md).
> Last updated: 2026-02-28

---

## How to Read This Document

- **Waves** follow the dependency order defined in the [Project Roadmap](roadmaps/project-roadmap.md)
- Each wave has numbered **steps** — do them in order within a wave
- `[x]` = done, `[ ]` = to do
- **Refs** point to the spec, ADR, or architecture doc to read _before_ starting
- **Components** sections list reusable UI that should be built and tested as part of that wave

---

## Wave 0: Foundation & Scaffolding [COMPLETED]

**Status:** Done
**Outcome:** Monorepo, database, auth, packages, dashboard shell, platform-admin.

<details>
<summary>Completed work (click to expand)</summary>

### 0.1 — Monorepo Scaffold

- [x] pnpm workspace (`apps/web`, `packages/types`, `packages/supabase`)
- [x] Turborepo config (`turbo.json`)
- [x] Base `tsconfig.json` with strict mode
- [x] ESLint + Prettier

### 0.2 — Supabase Setup

- [x] Dev environment, `.env.local`, `supabase/config.toml`
- [x] 15 migrations (00001–00012 sequential + 3 timestamped)

### 0.3 — Core Database: Identity + Structure

- [x] `user_identity`, `company`, `company_member`, `workspace`, `profile`
- [x] `department`, `location`, `zone`, `asset`, `position`, `team`, `season`

### 0.4 — Core Database: Governance

- [x] `policy`, `protocol`, `procedure`, `routine`, `knowledge_test`
- [x] `confirmation`, `protocol_assignment`, `employment_contract`
- [x] `activity_trail`, `onboarding_session`

### 0.5 — Security & RLS

- [x] RLS on all user-facing tables
- [x] `get_workspace_ids_for_user()`, `is_admin_in_workspace()`

### 0.6 — Shared Packages

- [x] `@smartout/types` — Zod domain schemas
- [x] `@smartout/supabase` — Client/Server/Middleware
- [x] `@smartout/ui` — badge, button, card, dialog, input, label, separator, skeleton, status-badge
- [x] `@smartout/ai` — Vercel AI SDK + OpenRouter agents
- [x] `@smartout/telemetry` — PostHog
- [x] `@smartout/notifications`, `@smartout/i18n`, `@smartout/utils`

### 0.7 — Next.js App

- [x] App Router, Tailwind v4, shadcn/ui (new-york)
- [x] Auth flows, middleware, Playwright E2E
- [x] Dashboard layout + DashboardContext + 34 route shells

### 0.8 — Platform Admin (Module 17)

- [x] 8 sub-pages (audit, billing, content, contracts, dashboard, health, users, workspaces)
- [x] TanStack Table data tables
- [x] Enterprise infrastructure (health-check, watchdog-integrity, watchdog-uptime edge functions)

### 0.9 — AI Onboarding (Module 1 — Partial)

- [x] Web scraping pipeline, workspace intelligence
- [x] Voice assistant (Ultravox/Claude)
- [x] AI agent with Vercel AI SDK + OpenRouter
- [x] Onboarding session persistence

</details>

---

## Wave 1: Structural Core

**Status:** Next up
**Goal:** Make org structure manageable, settings configurable, and complete the onboarding entry point.
**Prereqs:** Wave 0 (done)

### 1.0 — Reusable Component Library

> **Refs:** [UI Architecture](architecture/SMARTOUT_UI_ARCHITECTURE.md), [ADR-0003](decisions/0003-shadcn-integration.md)

Before building module UIs, build the reusable "dumb" components that every module needs.
These are presentational, stateless, and testable in isolation.

#### Existing (in `@smartout/ui` or `apps/web/src/components/ui/`)

- [x] `Badge`, `Button`, `Card`, `Dialog`, `Input`, `Label`, `Separator`, `Skeleton`, `StatusBadge`
- [x] `DropdownMenu`, `Select`, `Sheet`, `Table`, `Tabs`, `Tooltip`

#### To Build — Shared Package (`@smartout/ui`)

These components are used across 3+ modules and should live in the shared package:

- [ ] **EmptyState** — Icon + title + description + optional action button. Every list/table needs one when there's no data. Props: `icon`, `title`, `description`, `action?: { label, onClick }`.

- [ ] **PageHeader** — Consistent page header with title, breadcrumb, description, and action area. Props: `title`, `description?`, `breadcrumbs?: Array<{label, href}>`, `actions?: ReactNode`. Used on every dashboard sub-page.

- [ ] **StatCard** — Metric display card with label, value, trend indicator, and optional sparkline. Props: `label`, `value`, `trend?: { direction: 'up'|'down'|'flat', percentage: number }`, `icon?`. Used in dashboard, reports, operations, payroll.

- [ ] **Avatar / AvatarGroup** — Profile picture with initials fallback. AvatarGroup shows stacked circles with "+N" overflow. Props: `name`, `imageUrl?`, `size: 'sm'|'md'|'lg'`. Used everywhere people are displayed.

- [ ] **SearchInput** — Debounced search field with clear button and loading indicator. Props: `value`, `onChange`, `placeholder`, `debounceMs?: number`. Used in every list/table view.

- [ ] **ConfirmDialog** — Reusable confirmation modal for destructive actions. Props: `title`, `description`, `confirmLabel`, `variant: 'default'|'destructive'`, `onConfirm`, `onCancel`. Every delete/archive/deactivate action needs one.

- [ ] **InfoTooltip** — Small info icon that shows a tooltip on hover. Props: `content: string | ReactNode`. Used next to form labels and settings to explain concepts.

- [ ] **LoadingSkeleton** — Composable loading state matching common page layouts. Variants: `table`, `card-grid`, `form`, `detail`. Used as Suspense fallbacks.

- [ ] **FormSection** — Grouped form fields with section title, description, and divider. Props: `title`, `description?`, `children`. Used in settings, org structure, onboarding.

- [ ] **DataTable** — Generic wrapper around TanStack Table with built-in search, column visibility, pagination, and empty state. Already exists in platform-admin — extract and generalize. Props: `columns`, `data`, `searchColumn?`, `emptyState?`.

- [ ] **Timeline** — Chronological event/activity display. Props: `items: Array<{timestamp, title, description?, icon?, variant?}>`. Used in audit logs, onboarding progress, employee history.

- [ ] **FilterBar** — Composable filter controls: search + dropdown filters + date range + clear all. Props: `filters: Array<FilterConfig>`, `onFilterChange`. Used in people, scheduling, reports, operations.

- [ ] **Breadcrumb** — Navigation context component using the route hierarchy. Props: `items: Array<{label, href?}>`. Used on every sub-page.

- [ ] **ProgressBar** — Linear or circular progress indicator with label. Props: `value: number`, `max?: number`, `variant?: 'linear'|'circular'`, `label?`. Used in onboarding, training, readiness scores.

---

### 1.1 — Module 2: Org Structure

> **Refs:** [Module 2 Spec](modules/SMARTOUT_MODULE_2_ORG_STRUCTURE.md), [Org Roadmap](architecture/SMARTOUT_ORG_STRUCTURE_ROADMAP.md), [Data Model](architecture/SMARTOUT_FOUNDATION_DATA_MODEL.md)
> **Route:** `/dashboard/organization`
> **Tables:** `department`, `location`, `zone`, `asset`, `team`, `position` (all exist)

#### 1.1.1 — Department Management

- [ ] Department list page with DataTable
- [ ] Create department form (name, description, color, is_seasonal)
- [ ] Edit department inline or in sheet/dialog
- [ ] Deactivate/reactivate department (soft delete)
- [ ] Department detail page showing associated teams, positions, profiles

#### 1.1.2 — Location Management

- [ ] Location list with map view (optional) and table view
- [ ] Create/edit location (name, type, address, capacity)
- [ ] Zone management within a location (CRUD for zones)
- [ ] Asset management within a location (equipment tracking)

#### 1.1.3 — Team Management

- [ ] Team list with member preview (AvatarGroup)
- [ ] Create team (name, type, leader, department associations)
- [ ] Assign/remove team members
- [ ] Team detail view (members, leader, seasonal toggle)

#### 1.1.4 — Position Management

- [ ] Position list by department
- [ ] Create/edit position (title, department, required certifications)
- [ ] Position ↔ Department mapping

#### 1.1.5 — People Management

- [ ] Profile list in `/dashboard/people` with DataTable (partially exists)
- [ ] Profile detail page (personal info, role, status, department, team memberships)
- [ ] Role management (employee → manager → admin → owner)
- [ ] Status management (trainee → active → inactive → offboarding)
- [ ] Bulk actions (assign department, change status)

#### 1.1.6 — Org Visualization

- [ ] Tree/hierarchy view of workspace structure
- [ ] Department → Team → Profile drill-down
- [ ] Location → Zone → Asset drill-down

---

### 1.2 — Module 11: Settings

> **Refs:** [Module 11 Spec](modules/SMARTOUT_MODULE_11_SETTINGS.md)
> **Route:** `/dashboard/settings`

#### 1.2.1 — Workspace Settings

- [ ] General settings form (workspace name, industry, timezone, currency, language)
- [ ] Logo/branding upload (Supabase Storage)
- [ ] Season defaults

#### 1.2.2 — Notification Preferences

- [ ] Notification channel preferences (in-app, email, SMS, push) per event type
- [ ] Quiet hours configuration

#### 1.2.3 — User Preferences

- [ ] Theme preference (dark/light/system) — persist to profile
- [ ] Language preference override
- [ ] Dashboard layout preferences

#### 1.2.4 — Database

- [ ] Create `workspace_settings` table (or JSONB column on `workspace`)
- [ ] Migration + RLS policies
- [ ] Regenerate `database.types.ts`

---

### 1.3 — Module 1: Onboarding (Completion)

> **Refs:** [Module 1 Spec](modules/SMARTOUT_MODULE_1_ONBOARDING.md), [Onboarding Architecture](architecture/SMARTOUT_WORKSPACE_ONBOARDING_ARCHITECTURE.md), [Agent Rewrite Plan](plans/2026-02-27-onboarding-agent-rewrite.md)
> **Existing:** AI assistant, scraping, workspace activation, voice assistant

#### 1.3.1 — Invitation Management UI

- [ ] Invitation dashboard page (list of sent invites with status)
- [ ] Resend/cancel invite actions
- [ ] Bulk invite via CSV upload
- [ ] Invite link generation (shareable link with expiry)

#### 1.3.2 — Accept-Invite Flow

- [ ] Landing page for invite token (`/invite/[token]` — shell exists)
- [ ] Link new user to existing profile created by admin
- [ ] Handle expired/cancelled invites gracefully
- [ ] Post-accept onboarding checklist for new employee

#### 1.3.3 — Trainee Mode

- [ ] Flag new profiles as `trainee` status
- [ ] Sandbox mode: real UI, no live data impact
- [ ] Trainee progress tracker (% of required protocols completed)
- [ ] 48-hour escalation alert if trainee not progressing
- [ ] Role progression: trainee → active (manual or automatic on readiness threshold)

---

## Wave 2: Operational Core

**Status:** After Wave 1
**Goal:** Shift scheduling and team communication — the daily operational features.
**Prereqs:** Wave 1 (Org Structure must be manageable)

### 2.1 — Module 3: Scheduling

> **Refs:** [Module 3 Spec](modules/SMARTOUT_MODULE_3_SCHEDULING.md)
> **Route:** `/dashboard/schedule`, `/dashboard/my-schedule`
> **Partially built:** Basic shift view and "Vaktliste" exist

#### 2.1.1 — Schedule Data Model

- [ ] Create scheduling tables if not present: `shift`, `shift_template`, `availability`, `shift_swap`
- [ ] Migration + RLS policies
- [ ] Regenerate `database.types.ts`

#### 2.1.2 — Schedule Views

- [ ] Week view (grid: days × departments/positions)
- [ ] Day view (timeline per location)
- [ ] List view / "Vaktliste" (print-optimized — partially exists)
- [ ] Employee "My Schedule" view

#### 2.1.3 — Shift Management

- [ ] Create shift (date, time, department, position, location, assigned employee)
- [ ] Edit shift (drag-and-drop on week/day view)
- [ ] Delete/cancel shift with confirmation
- [ ] Copy week / apply template
- [ ] Shift templates (save/load recurring patterns)

#### 2.1.4 — Availability & Conflicts

- [ ] Employee availability submission (preferred/unavailable times)
- [ ] Conflict detection (double-booked employees, over/under-staffed)
- [ ] Visual warnings on schedule view

#### 2.1.5 — Open Shifts & Swaps

- [ ] Open shift board (unassigned shifts employees can claim)
- [ ] Shift swap request/approval workflow
- [ ] Notifications for open shifts and swap requests

---

### 2.2 — Module 9: Communication

> **Refs:** [Module 9 Spec](modules/SMARTOUT_MODULE_9_COMMUNICATION.md)
> **Route:** `/dashboard/chat`

#### 2.2.1 — Communication Data Model

- [ ] Create tables: `channel`, `message`, `channel_member`
- [ ] Migration + RLS policies (workspace-scoped)
- [ ] Supabase Realtime subscriptions for live updates

#### 2.2.2 — Chat UI

- [ ] Channel list sidebar
- [ ] Message thread with real-time updates
- [ ] Compose message with formatting
- [ ] File/image attachments (Supabase Storage)
- [ ] @mentions with profile lookup

#### 2.2.3 — Channels

- [ ] Workspace-wide announcements channel (read-only for non-admins)
- [ ] Department channels (auto-created from org structure)
- [ ] Team channels
- [ ] Direct messages

#### 2.2.4 — Notifications

- [ ] In-app notification bell with unread count
- [ ] Notification preferences (per channel type)
- [ ] Email/SMS fallback for critical notifications (SendGrid/Twilio)

### 2.3 — Module 18: WebRTC Voice & Video

> **Refs:** [Module 18 Spec](modules/SMARTOUT_MODULE_18_WEBRTC.md)
> **Route Surface:** `/dashboard/chat` (extends Module 9 UI)

#### 2.3.1 — Call Data & Security

- [ ] Create call tables (`call_session`, `call_participant`) with workspace scoping + RLS
- [ ] Add call status lifecycle (`ringing`, `active`, `missed`, `completed`, `rejected`)
- [ ] Ensure auth-bound token issuance (room-scoped identities)

#### 2.3.2 — Realtime Call Flows

- [ ] Implement initiate/accept/reject/end call signaling through realtime channels
- [ ] Add timeout + missed call behavior for direct calls
- [ ] Add group-call join flow for department/team/session channels

#### 2.3.3 — Chat Integration

- [ ] Add call CTA controls in chat header and DM views
- [ ] Add in-call state indicators and participant list in channel context
- [ ] Add call history entry rendering in communication timeline

#### 2.3.4 — Platform Integration

- [ ] Implement LiveKit token endpoint (Edge Function)
- [ ] Configure webhook handler for room lifecycle and duration logging
- [ ] Add baseline observability (errors, duration, participation metrics)

---

## Wave 3: Live Operations

**Status:** After Wave 2
**Goal:** Transform schedules into actionable daily workflows.
**Prereqs:** Wave 2 (Scheduling must be working)

### 3.1 — Module 4: Operations

> **Refs:** [Module 4 Spec](modules/SMARTOUT_MODULE_4_OPERATIONS.md) (80KB — the biggest spec)
> **Route:** `/dashboard/operations`

#### 3.1.1 — Department Sessions

- [ ] Auto-generate daily department sessions from schedule
- [ ] Session lifecycle: `upcoming → active → pending_signoff → closed | missed`
- [ ] Session overview page (all departments for today)
- [ ] Session detail page (tasks, staff, notes, handoffs)

#### 3.1.2 — Session Hooks

- [ ] Hook system: `pre_open`, `open`, `scheduled`, `pre_close`, `close`
- [ ] Hooks trigger procedures and routines as `session_task` records
- [ ] Time-based auto-triggering via Supabase scheduled functions or n8n

#### 3.1.3 — Task Execution

- [ ] Task list per session (generated from hooks + ad-hoc)
- [ ] Task status tracking: `pending → available → in_progress → completed | skipped | overdue | escalated`
- [ ] Task assignment to specific profiles
- [ ] Ad-hoc task creation by managers
- [ ] Task completion with notes/evidence

#### 3.1.4 — Live Dashboard

- [ ] Real-time staff count vs. planned (Supabase Realtime)
- [ ] Capacity/stress indicator
- [ ] Clock-in/clock-out tracking
- [ ] Handoff notes between sessions

---

### 3.2 — Module 5: HACCP

> **Refs:** [Module 5 Spec](modules/SMARTOUT_MODULE_5_HACCP.md)
> **Prereqs:** Module 4 (Operations) — HACCP tasks are session hooks

#### 3.2.1 — HACCP Setup

- [ ] Critical Control Points (CCP) configuration per department
- [ ] Temperature monitoring points
- [ ] HACCP plan templates

#### 3.2.2 — Daily HACCP Execution

- [ ] Temperature logging tasks (integrated as session hooks)
- [ ] CCP verification checklists
- [ ] Deviation alerts + corrective action workflow
- [ ] HACCP compliance reporting

---

## Wave 4: Governance & Training

**Status:** After Wave 3
**Goal:** Policy enforcement and employee readiness tracking.
**Prereqs:** Wave 1 (Org Structure) + Wave 3 (Operations for hook-based training)

### 4.1 — Module 6: Training

> **Refs:** [Module 6 Spec](modules/SMARTOUT_MODULE_6_TRAINING.md)
> **Route:** `/dashboard/governance`, `/dashboard/my-training`

#### 4.1.1 — Policy & Protocol Management

- [ ] Policy list with type filter (operational, haccp, hr, safety, access, payroll, custom)
- [ ] Create/edit policy (title, type, scope, content)
- [ ] Protocol creation linked to policy (1:1)
- [ ] Protocol status lifecycle: `draft → active → deprecated`

#### 4.1.2 — Training Content

- [ ] Procedure builder (ordered steps with media)
- [ ] Knowledge test builder (questions, answers, pass threshold)
- [ ] Confirmation templates (sign-off forms)

#### 4.1.3 — Assignment & Progress

- [ ] Assign protocols to profiles (by department, team, or individual)
- [ ] Training progress dashboard (per employee)
- [ ] Readiness score: % of assigned protocols completed
- [ ] Due dates and overdue alerts

#### 4.1.4 — Employee Training View

- [ ] "My Training" page with assigned protocols
- [ ] Step-through procedure viewer
- [ ] Knowledge test taking experience
- [ ] Confirmation signing (DocuSign integration)

---

## Wave 5: Time & Money

**Status:** After Wave 2+3
**Goal:** Absence management and payroll processing.
**Prereqs:** Wave 2 (Scheduling)

### 5.1 — Module 7: Absence

> **Refs:** [Module 7 Spec](modules/SMARTOUT_MODULE_7_ABSENCE.md)

#### 5.1.1 — Absence Types & Requests

- [ ] Absence type configuration (vacation, sick, personal, parental, etc.)
- [ ] Absence request form (type, dates, notes)
- [ ] Approval workflow (manager → admin)
- [ ] Calendar view of team absences

#### 5.1.2 — Schedule Impact

- [ ] Auto-detect uncovered shifts when absence approved
- [ ] Suggest replacements based on availability
- [ ] Absence balance tracking (vacation days remaining)

---

### 5.2 — Module 8: Payroll

> **Refs:** [Module 8 Spec](modules/SMARTOUT_MODULE_8_PAYROLL.md), [Billing](cross-cutting/SMARTOUT_CROSSCUT_BILLING_STRIPE.md)
> **Route:** `/dashboard/my-salary`

#### 5.2.1 — Time Tracking

- [ ] Worked hours aggregation from shifts + clock-in/out
- [ ] Overtime calculation (Norwegian labor law rules)
- [ ] Break tracking

#### 5.2.2 — Payroll Processing

- [ ] Pay period configuration (monthly, bi-weekly)
- [ ] Salary calculation (base + overtime + supplements)
- [ ] Payroll review and approval
- [ ] Export to CSV / payroll system integration

#### 5.2.3 — Employee Salary View

- [ ] Payslip display
- [ ] Hours worked summary
- [ ] Tax and deductions breakdown

---

## Wave 6: Intelligence & Advanced

**Status:** After Waves 3–5
**Goal:** Reporting, advanced features, and AI enhancement.
**Prereqs:** Data from all previous modules

### 6.1 — Module 10: Reports

> **Refs:** [Module 10 Spec](modules/SMARTOUT_MODULE_10_REPORTS.md), [PRD-03 Avstemming](architecture/PRD-03_Avstemmingssystem.md), [Telemetry Architecture](architecture/SMARTOUT_TELEMETRY_ARCHITECTURE.md)
> **Route:** `/dashboard/reports`

#### 6.1.1 — KPI Dashboard

- [ ] Configurable KPI cards (partially built)
- [ ] Turnover rate, absence rate, onboarding SLA, payroll %, readiness score
- [ ] Trend charts (Recharts — already in deps via ADR-0018)
- [ ] Date range selection and comparison

#### 6.1.2 — Reconciliation System

- [ ] Daily/weekly data snapshots via edge functions
- [ ] Planned vs. actual comparison (hours, staff, costs)
- [ ] Discrepancy detection and alerts

#### 6.1.3 — Export & Sharing

- [ ] PDF report generation
- [ ] Scheduled email reports
- [ ] Dashboard sharing (read-only links)

---

### 6.2 — Module 14: Production

> **Refs:** [Module 14 Spec](modules/SMARTOUT_MODULE_14_PRODUCTION.md), [Production Architecture](architecture/SMARTOUT_PRODUCTION_ARCHITECTURE.md)

#### 6.2.1 — Menu & Recipes

- [ ] Menu item CRUD
- [ ] Recipe builder (ingredients, steps, portions)
- [ ] Recipe costing (ingredient cost × quantity)

#### 6.2.2 — Inventory

- [ ] Ingredient inventory tracking
- [ ] Stock alerts (low inventory)
- [ ] Waste logging

---

### 6.3 — Module 15: Season Planning

> **Refs:** [Module 15 Spec](modules/SMARTOUT_MODULE_15_SEASON_PLANNING.md)
> **Route:** `/dashboard/season`

#### 6.3.1 — Season Lifecycle

- [ ] Create/configure season (name, dates, type, budget)
- [ ] Season activation and archival
- [ ] Season comparison (this year vs. last year)

#### 6.3.2 — Budget & Gamification

- [ ] Budget engine (labor cost targets per department)
- [ ] Point system configuration
- [ ] Leaderboard per season

---

### 6.4 — Module 12: AI (Progressive Enhancement)

> **Refs:** [Module 12 Spec](modules/SMARTOUT_MODULE_12_AI.md), [ADR-0010](decisions/0010-ai-sdk-openrouter.md), [AI Council Research](research/Seven%20AI%20Council%20personas%20for%20Smartout's%20Norwegian%20hospitality%20platform.md)
> **Route:** `/dashboard/ai`

AI is built incrementally. Each wave unlocks new AI capabilities:

| Wave   | AI Capability                                      |
| ------ | -------------------------------------------------- |
| Wave 0 | Onboarding assistant (workspace setup)             |
| Wave 1 | Org structure suggestions based on industry        |
| Wave 2 | Schedule optimization, shift coverage suggestions  |
| Wave 3 | Operations anomaly detection, task prioritization  |
| Wave 4 | Training content generation, readiness predictions |
| Wave 5 | Payroll anomaly detection                          |
| Wave 6 | Full "Mr. Botsson" workspace assistant             |

---

## Component Testing Strategy

Reusable components from step 1.0 should be tested before modules depend on them:

### Storybook-style Testing (via Playwright Component Tests)

| Component          | Test Cases                                    |
| ------------------ | --------------------------------------------- |
| EmptyState         | Renders with/without action, icon variants    |
| PageHeader         | With/without breadcrumbs, responsive collapse |
| StatCard           | Positive/negative trends, loading state       |
| Avatar/AvatarGroup | Image, initials fallback, overflow count      |
| SearchInput        | Debounce behavior, clear button, loading      |
| ConfirmDialog      | Open/close, destructive variant, keyboard     |
| DataTable          | Sort, filter, paginate, empty state, loading  |
| FilterBar          | Add/remove filters, clear all, responsive     |
| Timeline           | Various item counts, scroll behavior          |
| ProgressBar        | 0%, 50%, 100%, overflow handling              |

### Integration Testing Approach

Each module's UI should be tested against seed data:

```bash
# Run seed to get test data
npx supabase db reset

# Run E2E tests for specific module
pnpm --filter e2e test:e2e -- --grep "org-structure"
```

---

## Current Priority: What to Build Next

**Immediate next steps (in this exact order):**

1. Build the reusable component library (Step 1.0)
2. Build Module 2: Org Structure (Step 1.1) — the entire platform depends on this
3. Build Module 11: Settings (Step 1.2) — workspace configuration
4. Complete Module 1: Onboarding (Step 1.3) — invitation + trainee mode

**Why this order:**

- Components are needed by everything → build them first
- Org Structure is the skeleton → you can't schedule without departments, you can't assign tasks without teams
- Settings configures the workspace → affects how org structure and scheduling behave
- Onboarding completion requires org structure to exist (inviting people to departments/teams)

---

## Quick Reference: Module → Route → Spec

| Module              | Dashboard Route                                   | Spec Document                           | Wave          |
| ------------------- | ------------------------------------------------- | --------------------------------------- | ------------- |
| 2: Org Structure    | `/dashboard/organization`                         | `SMARTOUT_MODULE_2_ORG_STRUCTURE.md`    | 1             |
| 11: Settings        | `/dashboard/settings`                             | `SMARTOUT_MODULE_11_SETTINGS.md`        | 1             |
| 1: Onboarding       | `/invite/[token]`, `/onboarding`                  | `SMARTOUT_MODULE_1_ONBOARDING.md`       | 1             |
| 3: Scheduling       | `/dashboard/schedule`, `/dashboard/my-schedule`   | `SMARTOUT_MODULE_3_SCHEDULING.md`       | 2             |
| 9: Communication    | `/dashboard/chat`                                 | `SMARTOUT_MODULE_9_COMMUNICATION.md`    | 2             |
| 4: Operations       | `/dashboard/operations`                           | `SMARTOUT_MODULE_4_OPERATIONS.md`       | 3             |
| 5: HACCP            | (within operations)                               | `SMARTOUT_MODULE_5_HACCP.md`            | 3             |
| 6: Training         | `/dashboard/governance`, `/dashboard/my-training` | `SMARTOUT_MODULE_6_TRAINING.md`         | 4             |
| 7: Absence          | (within scheduling)                               | `SMARTOUT_MODULE_7_ABSENCE.md`          | 5             |
| 8: Payroll          | `/dashboard/my-salary`                            | `SMARTOUT_MODULE_8_PAYROLL.md`          | 5             |
| 10: Reports         | `/dashboard/reports`                              | `SMARTOUT_MODULE_10_REPORTS.md`         | 6             |
| 14: Production      | (new route)                                       | `SMARTOUT_MODULE_14_PRODUCTION.md`      | 6             |
| 15: Season Planning | `/dashboard/season`                               | `SMARTOUT_MODULE_15_SEASON_PLANNING.md` | 6             |
| 18: WebRTC          | `/dashboard/chat` (extends communication)         | `SMARTOUT_MODULE_18_WEBRTC.md`          | 2 (extends 9) |
| 12: AI              | `/dashboard/ai`                                   | `SMARTOUT_MODULE_12_AI.md`              | Progressive   |
| 17: Platform Admin  | `/platform-admin/*`                               | `SMARTOUT_MODULE_17_PLATFORM_ADMIN.md`  | 0.5 (Done)    |
| 13: Multi-tenant    | Cross-cutting                                     | `SMARTOUT_MODULE_13_MULTITENANT.md`     | Cross-cutting |
