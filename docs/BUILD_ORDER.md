---
title: "Build Order (Detailed Implementation Plan)"
id: PLAN_BUILD_ORDER
version: "3.1"
status: stale
layer: plan
created: 2026-02-24
updated: 2026-04-07
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
  - date: 2026-03-01
    change: "Status audit — marked Wave 1 progress (Org Structure done, Onboarding partial, Settings stub)"
  - date: 2026-03-11
    change: "Major audit — marked all built features across Waves 0-6, added cross-cutting systems, updated percentages (typo-corrected from 2026-04-11)"
  - date: 2026-03-17
    change: "Full codebase audit — updated counts (130 migrations, 72 enums, 31 Edge Functions, 51 ADRs, 147 tables), updated worktree status, verified all wave percentages against code"
  - date: 2026-04-07
    change: "Flagged stale — wave percentages and counts not re-audited since 2026-03-17. Counts are now ~75 ADRs, more migrations. Use STATE.md/DASHBOARD.md for current state, this doc for waves narrative only."
---

# Smartout — Build Order (Detailed Implementation Plan)

> Step-by-step implementation tasks for each wave.
> This is the execution companion to [`project-roadmap.md`](roadmaps/project-roadmap.md).
> Last full audit: 2026-03-17 — counts and percentages below are from that snapshot.
>
> ⚠️ **STALE — flagged 2026-04-07.** Wave structure and dependency order are still valid. Counts (ADRs, migrations, enums) and "% built" percentages are stale. For current state see `STATE.md` + `DASHBOARD.md`.

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

- [x] Dev environment, `.env.template` (op:// based), `supabase/config.toml`
- [x] 130 migrations (00001–00013 sequential + 117 timestamped)

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
- [x] Dashboard layout + DashboardContext + 40+ route shells

### 0.8 — Platform Admin (Module 17)

- [x] 14 sub-pages (audit, communications, content, contracts, dashboard, guardian, health, journeys, keys, landing, services, templates, users, workspaces)
- [x] TanStack Table data tables
- [x] Enterprise infrastructure (health-check, watchdog-integrity, watchdog-uptime edge functions)
- [x] Landing page builder — block-based variant system (ADR-0046)
- [x] API key management — generation, rotation, usage tracking (ADR-0028)
- [x] Guardian admin dashboard — 13 components, real-time monitoring
- [x] Journey system — AI-assisted journey creation wizard
- [x] Services monitoring — health dashboard, config management
- [x] Communications/templates — SendGrid integration (ADR-0045)

### 0.9 — AI Onboarding (Module 1 — Partial)

- [x] Web scraping pipeline, workspace intelligence
- [x] Voice assistant (Ultravox/Claude)
- [x] AI agent with Vercel AI SDK + OpenRouter
- [x] Onboarding session persistence

### 0.10 — Infrastructure Services

- [x] Contract service (Fastify, port 3100) — DocuSign/DocuSeal integration
- [x] Stage Engine (Hono, port 3000) — Agent runtime with mission/agent mode
- [x] Shift MCP (MCP, port 3001) — 5 shift management tools (ADR-0036)
- [x] Interview MCP — Conversation management anchor
- [x] Scrapling (Python) — Web content extraction
- [x] Unified Docker Compose + Caddy reverse proxy (ADR-0039)

### 0.11 — Supabase Edge Functions (31 functions)

- [x] Workspace setup: create-invitation, accept-invitation, activate-workspace, extract-workspace-data, gather-workspace-intelligence, analyze-workspace, analyze-setup-documents, finalize-workspace, google-places-intelligence
- [x] Guardian: guardian-notify, guardian-sweep, guardian-actions
- [x] Search: search-brreg, web-search-intelligence, scrape-website, scrape-raw-data
- [x] Integrations: sendgrid-webhook, contract-lifecycle, engine-dispatch
- [x] Infrastructure: health-check, watchdog-uptime, watchdog-integrity, cleanup-api-keys
- [x] Operations: process-settlement-image, validate-settlement, leader-pulse, identify-company, emma-task-trigger
- [x] API gateway: workspace-api (15 endpoints, dual-auth, scope-based access), validate-api-key
- [x] Automation: fire-delayed-triggers

</details>

---

## Wave 1: Structural Core

**Status:** ~85% done
**Goal:** Make org structure manageable, settings configurable, and complete the onboarding entry point.
**Prereqs:** Wave 0 (done)

### 1.0 — Reusable Component Library

> **Refs:** [UI Architecture](architecture/SMARTOUT_UI_ARCHITECTURE.md), [ADR-0003](decisions/0003-shadcn-integration.md)

#### Existing (in `@smartout/ui` or `apps/web/src/components/ui/`)

- [x] `Badge`, `Button`, `Card`, `Dialog`, `Input`, `Label`, `Separator`, `Skeleton`, `StatusBadge`
- [x] `DropdownMenu`, `Select`, `Sheet`, `Table`, `Tabs`, `Tooltip`

#### To Build — Shared Package (`@smartout/ui`)

- [ ] **EmptyState** — Icon + title + description + optional action button
- [ ] **PageHeader** — Consistent page header with title, breadcrumb, description, and action area
- [ ] **StatCard** — Metric display card (note: `SignalCard` exists in dashboard as similar pattern)
- [ ] **Avatar / AvatarGroup** — Profile picture with initials fallback
- [ ] **SearchInput** — Debounced search field with clear button and loading indicator
- [x] **ConfirmDialog** — Exists as `ConfirmationDialog` in `platform-admin/confirmation-dialog.tsx`. Needs extraction to `@smartout/ui`.
- [ ] **InfoTooltip** — Small info icon with tooltip
- [ ] **LoadingSkeleton** — Composable loading state matching common page layouts
- [ ] **FormSection** — Grouped form fields with section title, description, and divider
- [x] **DataTable** — Exists in `platform-admin/data-table.tsx` with TanStack Table. Needs extraction to `@smartout/ui`.
- [ ] **Timeline** — Chronological event/activity display
- [ ] **FilterBar** — Composable filter controls
- [ ] **Breadcrumb** — Navigation context component
- [ ] **ProgressBar** — Linear or circular progress indicator with label

---

### 1.1 — Module 2: Org Structure [~85% DONE]

> **Refs:** [Module 2 Spec](modules/SMARTOUT_MODULE_2_ORG_STRUCTURE.md), [Org Roadmap](architecture/SMARTOUT_ORG_STRUCTURE_ROADMAP.md)
> **Route:** `/dashboard/organization`

#### 1.1.1 — Department Management

- [x] Department list page with DataTable
- [x] Create department form (name, description, color, icon, is_seasonal)
- [x] Edit department dialog
- [x] Deactivate/reactivate department (soft delete)
- [x] Department detail page showing associated positions, policies

#### 1.1.2 — Location Management

- [x] Location list with table view
- [x] Create location form (name, type, address, capacity)
- [x] Edit location form
- [x] Location detail page
- [ ] Zone CRUD within a location (counts displayed, no create UI)
- [ ] Asset CRUD within a location (counts displayed, no create UI)

#### 1.1.3 — Team Management

- [x] Team list with member/policy counts
- [x] Create team form (name, type: operational/access/cross_department/seasonal/custom)
- [x] Team detail page
- [ ] Assign/remove team members UI
- [ ] Team leader assignment

#### 1.1.4 — Position Management

- [x] Position list within department view (role, min role requirement, status)
- [ ] Create/edit position form (title, department, required certifications)
- [ ] Position <> Department mapping UI

#### 1.1.5 — People Management

- [x] Profile list in `/dashboard/people` with DataTable + invite status
- [x] Employee profile card component
- [x] Row actions (edit, deactivate, etc.)
- [ ] Profile detail page (personal info, role, status, department, team memberships)
- [ ] Role management (employee > manager > admin > owner)
- [ ] Status management (trainee > active > inactive > offboarding)
- [ ] Bulk actions (assign department, change status)

#### 1.1.6 — Org Visualization

- [ ] Tree/hierarchy view of workspace structure
- [ ] Department > Team > Profile drill-down
- [ ] Location > Zone > Asset drill-down

---

### 1.2 — Module 11: Settings [~30% DONE]

> **Refs:** [Module 11 Spec](modules/SMARTOUT_MODULE_11_SETTINGS.md)
> **Route:** `/dashboard/settings`

#### 1.2.1 — Workspace Settings

- [x] Settings page with tab navigation
- [x] Opening hours configuration
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

### 1.3 — Module 1: Onboarding [~90% DONE]

> **Refs:** [Module 1 Spec](modules/SMARTOUT_MODULE_1_ONBOARDING.md), [ADR-0041](decisions/0041-onboarding-wizard.md)
> **Existing:** Full 15-step wizard with voice AI, progressive save, 55+ components

#### 1.3.1 — Onboarding Wizard (Admin Setup) [DONE]

- [x] 15-step wizard with 4 modal drawers
- [x] AI-powered intelligence gathering (Brreg, Google Places, web scraping)
- [x] Voice AI integration (Ultravox — Botsson personality)
- [x] Progressive save pattern (LEARN-0017)
- [x] Auth step with signup
- [x] Invite step for team members
- [x] Real-time workspace setup
- [x] Showcase mode for product demos (`/onboarding/showcase`)
- [x] Key facts panel, business card grid, finale overlay
- [x] Ambient effects, typewriter text, section reveal animations

#### 1.3.2 — Invitation Management UI

- [x] Invitation list integrated in `/dashboard/people` (pending/expired status)
- [x] Create invitation dialog (name, email/phone, department, role)
- [x] Cancel invite action
- [x] `create-invitation` Edge Function (token generation, 7-day expiry)
- [ ] Resend invite action
- [ ] Bulk invite via CSV upload
- [ ] Invite link generation (shareable link with expiry)
- [ ] Email dispatch (currently stubbed — TODO in Edge Function)

#### 1.3.3 — Accept-Invite Flow

- [x] Landing page for invite token (`/invite/[token]` — UI complete)
- [ ] Connect to real auth signup (currently mocked)
- [ ] Link new user to existing profile created by admin
- [ ] Handle expired/cancelled invites gracefully
- [ ] Post-accept onboarding checklist for new employee

#### 1.3.4 — Trainee Mode

- [x] `trainee` status exists in profile status enum (with GraduationCap icon in People table)
- [ ] Sandbox mode: real UI, no live data impact
- [ ] Trainee progress tracker (% of required protocols completed)
- [ ] 48-hour escalation alert if trainee not progressing
- [ ] Role progression: trainee > active (manual or automatic on readiness threshold)

---

## Wave 2: Operational Core

**Status:** ~75% done
**Goal:** Shift scheduling and team communication — the daily operational features.
**Prereqs:** Wave 1 (Org Structure must be manageable)

### 2.1 — Module 3: Scheduling [~80% DONE]

> **Refs:** [Module 3 Spec](modules/SMARTOUT_MODULE_3_SCHEDULING.md), [ADR-0036](decisions/0036-schedule-shift.md)
> **Route:** `/dashboard/schedule`, `/dashboard/my-schedule`
> **Database:** 9 tables (schedule_shift, schedule_absence, schedule_template, schedule_template_shift, schedule_open_shift, schedule_day_message, schedule_day_task, schedule_day_booking, schedule_audit_log) + deviation, shift_approval

#### 2.1.1 — Schedule Data Model [DONE]

- [x] `schedule_shift` table with 14 columns, enums: `shift_status`, `day_category`
- [x] `schedule_absence` with `absence_status` enum
- [x] `schedule_template` + `schedule_template_shift` — reusable templates
- [x] `schedule_open_shift` — unassigned shifts
- [x] `schedule_day_message` with `message_visibility` enum
- [x] `schedule_day_task` — daily operational tasks
- [x] `schedule_day_booking` with `booking_status` enum
- [x] `schedule_audit_log` — row-level audit trail
- [x] `deviation` (5 domains: safety, customer, procedure, system, material) + `shift_approval`
- [x] RLS on ALL tables (JWT + API key policies)
- [x] Supabase Realtime on 6 tables

#### 2.1.2 — Schedule Views [DONE]

- [x] Week view (grid: days x employees, @tanstack/react-virtual for large rosters)
- [x] Day view (daily-grid with status filters: draft/published/active/completed/absence/overtime/compliance)
- [x] Monthly view (calendar with KPI overlays)
- [x] Multi-range views: day, week, two-weeks, month, custom
- [x] Daily briefing summary cards
- [x] Print-friendly grid surface
- [x] Employee "My Schedule" view (`/dashboard/my-schedule`)

#### 2.1.3 — Shift Management [DONE]

- [x] Create shift (date, time, department, position, location, assigned employee)
- [x] Shift modal with 6 tabs (Detaljer, Funksjoner, Historie, Lonnsgrunnlag, Oppgaver, Innstillinger)
- [x] Drag-and-drop shift assignment (@dnd-kit/core)
- [x] Resize handles on shift cards (15-min granularity)
- [x] Delete/cancel shift with confirmation
- [x] Shift presets (Morgenvakt, Dagvakt, Kveldsvakt, Nattvakt, Delt vakt)
- [x] Copy week / apply template
- [x] Shift templates — save/load/create/edit recurring patterns
- [x] Batch action bar for multi-select operations
- [x] Day context menu (copy, save template, load template, publish)
- [x] Publish overview dialog (preview before publishing)

#### 2.1.4 — Day Control Panel [DONE]

- [x] Bottom sheet with 6 tabs:
  - Oversikt (KPI cards, timeline, roster, budget, duty manager)
  - Meldinger (compose/send day messages with audience/visibility filters)
  - Bookings (create/edit/cancel reservations, VIP flag, guest count)
  - Budget (revenue targets, labor %, wage settings)
  - Staffing (employee roster, availability)
  - Session Tasks (category filtering, task creation/completion)
- [x] Day navigation (prev/next)
- [x] DaySessionProvider integrated state
- [x] Timeline visualization of shifts
- [x] Broadcast footer with send controls

#### 2.1.5 — Open Shifts & Absence

- [x] Open shift dialog (create/browse unassigned shifts)
- [x] Assign open shift to employee
- [x] Absence popover (record absence types: sick, vacation, parental, etc.)
- [x] Absence status workflow (pending > approved/rejected)
- [ ] Shift swap request/approval workflow
- [ ] Notifications for open shifts and swap requests

#### 2.1.6 — Schedule Intelligence

- [x] Agent proposals context (ghost cards for AI-suggested shifts)
- [x] Voice tools integration (create/update/assign/publish via voice)
- [x] Cost estimation (base rates + supplements: evening 40%, weekend 100%)
- [x] AML compliance risk detection (max hours per employee)
- [x] Coverage calculations and staffing stats
- [ ] AI schedule optimization (full autonomous mode)

#### 2.1.7 — Schedule Data Layer [DONE]

- [x] 17 TanStack Query hooks (shifts, templates, open shifts, day content, employees, absences, computed, realtime, voice, day session, day info, audit, week range, day session model)
- [x] Query key factory (`schedule-keys.ts`)
- [x] Data mappers (Supabase to UI types + reversal)
- [x] Realtime subscriptions via Supabase
- [x] Unit tests (day-session-model, schedule-mappers)

#### 2.1.8 — Schedule API & MCP

- [x] Send message API route (`/api/schedule/send-message`) — SMS/Email/Push dispatch
- [x] Shift MCP service with 5 tools (create, update, list, get, delete) — dual-auth, Zod validation
- [ ] Schedule-specific Edge Functions (using Supabase RLS directly instead)
- [ ] E2E Playwright tests

---

### 2.2 — Module 9: Communication [~70% DONE]

> **Refs:** [Module 9 Spec](modules/SMARTOUT_MODULE_9_COMMUNICATION.md)
> **Route:** `/dashboard/chat`

#### 2.2.1 — Communication Data Model

- [x] Tables exist (channels, messages, channel members)
- [x] RLS policies (workspace-scoped)
- [x] Supabase Realtime subscriptions for live updates

#### 2.2.2 — Chat UI [DONE]

- [x] ChatShell — main container
- [x] ConversationList — sidebar with conversation list
- [x] ConversationItem — individual conversation rendering
- [x] MessageList — message thread with real-time updates
- [x] MessageBubble — individual message display
- [x] MessageInput — compose message
- [x] ChatHeader — header with conversation info
- [x] ReplyPreview — reply context display
- [x] MemberPanel — conversation member management
- [x] CreateConversation — new conversation dialog

#### 2.2.3 — Channels

- [ ] Workspace-wide announcements channel (read-only for non-admins)
- [ ] Department channels (auto-created from org structure)
- [ ] Team channels
- [x] Direct messages

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

- [x] LiveKit adapter exists (`packages/ai/adapters/livekit.ts`)
- [ ] Implement LiveKit token endpoint (Edge Function)
- [ ] Configure webhook handler for room lifecycle and duration logging
- [ ] Add baseline observability (errors, duration, participation metrics)

---

## Wave 3: Live Operations

**Status:** ~50% done
**Goal:** Transform schedules into actionable daily workflows.
**Prereqs:** Wave 2 (Scheduling must be working)

### 3.1 — Module 4: Operations [~40% DONE]

> **Refs:** [Module 4 Spec](modules/SMARTOUT_MODULE_4_OPERATIONS.md)
> **Route:** `/dashboard/operations`, `/dashboard/close`

#### 3.1.1 — Department Sessions

- [ ] Auto-generate daily department sessions from schedule
- [ ] Session lifecycle: `upcoming > active > pending_signoff > closed | missed`
- [ ] Session overview page (all departments for today)
- [ ] Session detail page (tasks, staff, notes, handoffs)

#### 3.1.2 — Session Hooks

- [ ] Hook system: `pre_open`, `open`, `scheduled`, `pre_close`, `close`
- [ ] Hooks trigger procedures and routines as `session_task` records
- [ ] Time-based auto-triggering via Supabase scheduled functions or n8n

#### 3.1.3 — Task Execution

- [x] Task list per session (schedule_day_task + SessionTasksTab in Day Control Panel)
- [x] Task status tracking (category filtering, completion)
- [x] Task assignment
- [x] Ad-hoc task creation by managers
- [x] Task completion with notes
- [ ] Full status lifecycle: `pending > available > in_progress > completed | skipped | overdue | escalated`

#### 3.1.4 — Live Dashboard

- [ ] Real-time staff count vs. planned (Supabase Realtime)
- [ ] Capacity/stress indicator
- [ ] Clock-in/clock-out tracking
- [ ] Handoff notes between sessions

#### 3.1.5 — Daily Close / Settlement [DONE]

- [x] CloseOutFlow — main close workflow orchestration (`/dashboard/close`)
- [x] ChecklistSection — checklist validation UI
- [x] GatekeeperStatus — gatekeeper sign-off status
- [x] ImageUpload — image/evidence capture for close
- [x] Settlement validation Edge Function
- [x] Image processing Edge Function (OCR)

#### 3.1.6 — Reconciliation [DONE]

- [x] ReconciliationDashboard — main view (`/dashboard/reconciliation`)
- [x] DayList — daily entries list
- [x] DayApproval — day sign-off workflow
- [x] ShiftApprovalSection — shift approval details
- [x] RevenueSection — revenue reconciliation
- [x] DeviationSection — deviation tracking
- [x] Database: `daily_reconciliation`, `shift_approval`, `deviation` tables

---

### 3.2 — Module 5: HACCP

> **Refs:** [Module 5 Spec](modules/SMARTOUT_MODULE_5_HACCP.md)
> **Prereqs:** Module 4 (Operations) — HACCP tasks are session hooks

#### 3.2.1 — HACCP Setup

- [ ] Critical Control Points (CCP) configuration per department
- [ ] Temperature monitoring points
- [ ] HACCP plan templates

#### 3.2.2 — Daily HACCP Execution

- [x] HACCP Inspector mission (Ultravox voice agent — "HACCP-inspektoren")
- [ ] Temperature logging tasks (integrated as session hooks)
- [ ] CCP verification checklists
- [ ] Deviation alerts + corrective action workflow
- [ ] HACCP compliance reporting

---

## Wave 4: Governance & Training

**Status:** ~30% done
**Goal:** Policy enforcement and employee readiness tracking.
**Prereqs:** Wave 1 (Org Structure) + Wave 3 (Operations for hook-based training)

### 4.1 — Module 6: Training [~30% DONE]

> **Refs:** [Module 6 Spec](modules/SMARTOUT_MODULE_6_TRAINING.md)
> **Route:** `/dashboard/governance`, `/dashboard/my-training`

#### 4.1.1 — Policy & Protocol Management

- [x] GovernanceOverview — policy dashboard
- [x] ProtocolEmployeeList — protocol assignment list
- [x] OverdueAlerts — overdue training alerts
- [x] EmployeeJourneyMap — training journey visualization
- [ ] Policy list with type filter (operational, haccp, hr, safety, access, payroll, custom)
- [ ] Create/edit policy (title, type, scope, content)
- [ ] Protocol creation linked to policy (1:1)
- [ ] Protocol status lifecycle: `draft > active > deprecated`

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

- [x] "My Training" page route exists (`/dashboard/my-training`)
- [ ] Step-through procedure viewer
- [ ] Knowledge test taking experience
- [ ] Confirmation signing (DocuSign integration)

---

## Wave 5: Time & Money

**Status:** ~10% done
**Goal:** Absence management and payroll processing.
**Prereqs:** Wave 2 (Scheduling)

### 5.1 — Module 7: Absence [~40% DONE]

> **Refs:** [Module 7 Spec](modules/SMARTOUT_MODULE_7_ABSENCE.md)

#### 5.1.1 — Absence Types & Requests

- [x] Absence type configuration (vacation, sick, personal, parental) — `schedule_absence` table + `absence_status` enum
- [x] Absence recording via popover in schedule UI
- [x] Absence cards rendered in schedule grid
- [ ] Approval workflow (manager > admin)
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

- [x] Shift approval with punch in/out (`shift_approval` table)
- [x] Worked hours displayed in shift modal (Lonnsgrunnlag tab)
- [ ] Overtime calculation (Norwegian labor law rules)
- [ ] Break tracking

#### 5.2.2 — Payroll Processing

- [ ] Pay period configuration (monthly, bi-weekly)
- [ ] Salary calculation (base + overtime + supplements)
- [ ] Payroll review and approval
- [ ] Export to CSV / payroll system integration

#### 5.2.3 — Employee Salary View

- [x] Route exists (`/dashboard/my-salary`)
- [ ] Payslip display
- [ ] Hours worked summary
- [ ] Tax and deductions breakdown

---

## Wave 6: Intelligence & Advanced

**Status:** ~60% done (significant AI work completed ahead of schedule)
**Goal:** Reporting, advanced features, and AI enhancement.
**Prereqs:** Data from all previous modules

### 6.1 — Module 10: Reports [~70% DONE]

> **Refs:** [Module 10 Spec](modules/SMARTOUT_MODULE_10_REPORTS.md)
> **Route:** `/dashboard/reports`

#### 6.1.1 — KPI Dashboard [DONE]

- [x] ReportsPageShell — main container
- [x] OverviewSection — overview metrics
- [x] StaffingSection — staffing analytics
- [x] TrainingSection — training progress
- [x] PeopleSection — people analytics
- [x] OverviewDeepInsights — deep dive insights
- [x] ReportCard — individual report display
- [x] SavedReportsGrid — saved reports
- [x] ReportViewer — report rendering

#### 6.1.2 — AI Reporting [DONE]

- [x] ReportsChatPanel — AI-powered reporting chat interface
- [x] AiReportDrawer — AI-generated report drawer
- [x] ReportInsightDrawer — insight detail drawer
- [x] AI report tools: listDataSources, previewReport, saveReport, deleteReport, listSavedReports

#### 6.1.3 — Reconciliation System [DONE]

- [x] Daily settlement tracking (`daily_reconciliation` table)
- [x] Planned vs. actual comparison (hours, staff, costs)
- [x] Deviation detection and tracking
- [x] Full reconciliation UI (see Wave 3.1.6)

#### 6.1.4 — Export & Sharing

- [ ] PDF report generation
- [ ] Scheduled email reports
- [ ] Dashboard sharing (read-only links)

---

### 6.2 — Module 14: Production

> **Refs:** [Module 14 Spec](modules/SMARTOUT_MODULE_14_PRODUCTION.md)

#### 6.2.1 — Menu & Recipes

- [ ] Menu item CRUD
- [ ] Recipe builder (ingredients, steps, portions)
- [ ] Recipe costing (ingredient cost x quantity)

#### 6.2.2 — Inventory

- [ ] Ingredient inventory tracking
- [ ] Stock alerts (low inventory)
- [ ] Waste logging

---

### 6.3 — Module 15: Season Planning [DONE]

> **Refs:** [Module 15 Spec](modules/SMARTOUT_MODULE_15_SEASON_PLANNING.md)
> **Route:** `/dashboard/year-wheel`

#### 6.3.1 — Season Lifecycle [DONE]

- [x] SeasonSelector — season selection dropdown
- [x] SeasonManagementCard — create/edit seasons
- [x] SeasonOverviewTab — budget overview, season selection
- [x] Season activation and archival

#### 6.3.2 — Budget Engine [DONE]

- [x] BudgetSetupTab — total target, labor %, avg wage, base price configuration
- [x] DayFactorsTab — weekday weight distribution (Monday-Sunday)
- [x] HourFactorsTab — hourly weight distribution
- [x] Pure calculation engine (`apps/web/src/lib/season-calculations.ts`)
- [x] Database: `season_budget` (1:1 with season), `day_factor`, `hour_factor` tables
- [x] `budget_status` enum (draft/active/locked)

#### 6.3.3 — Gamification

- [ ] Point system configuration
- [ ] Leaderboard per season
- [ ] Season comparison (this year vs. last year)

---

### 6.4 — Module 12: AI (Progressive Enhancement) [~80% DONE]

> **Refs:** [Module 12 Spec](modules/SMARTOUT_MODULE_12_AI.md), [ADR-0042](decisions/0042-agent-architecture.md)
> **Route:** `/dashboard/ai`

AI has been built progressively and is far ahead of the original wave plan:

| Wave   | AI Capability                                      | Status      |
| ------ | -------------------------------------------------- | ----------- |
| Wave 0 | Onboarding assistant (workspace setup)             | DONE        |
| Wave 1 | Org structure suggestions based on industry        | DONE        |
| Wave 2 | Schedule optimization, shift coverage suggestions  | DONE        |
| Wave 3 | Operations anomaly detection, task prioritization  | PARTIAL     |
| Wave 4 | Training content generation, readiness predictions | NOT STARTED |
| Wave 5 | Payroll anomaly detection                          | NOT STARTED |
| Wave 6 | Full "Mr. Botsson" workspace assistant             | DONE        |

#### 6.4.1 — Agent Architecture [DONE]

- [x] Stage Engine service (Hono, port 3000) — universal agent gateway
- [x] Agent Router: intent classification > authority loading > context collection > tool selection > prompt building > LLM invocation
- [x] Intent Classifier (OpenRouter/Claude) — 10 capabilities
- [x] Tool Selector — authority-aware filtering
- [x] Context Collector — parallel profile/relationship/memory/shift loading
- [x] Prompt Builder — context-aware with posture adaptation
- [x] WebSocket gateway for real-time agent sessions
- [x] Session management with auto-expiry

#### 6.4.2 — Capability System [DONE]

- [x] Profile capability (getProfile, getTeam, getContractStatus)
- [x] Guardian capability (getSignals, acknowledgeSignal, getWorkspaceHealth)
- [x] UI capability (screen navigation, form filling, panel display)
- [x] Onboarding tools (10 tools: getState, triggerScrape, updateBusiness, addDepartments, etc.)
- [x] Contract tools (15 tools: read/edit/replace/insert/remove sections, placeholders, signatures)
- [x] Report tools (5 tools: listDataSources, previewReport, saveReport, etc.)
- [x] Intelligence tools (5 tools: searchCompany, identifyCompany, brregLookup, getIndustryDefaults, mergeData)
- [x] Journey tools (3 tools: lookupJourneys, saveDraft, checkDuplicates)
- [x] Season tools (5 tools: createSeason, setRevenue, learnFactors, getReadiness, savePlaybook)
- [x] Schedule tools (10 Ultravox tools: read/write/navigate)
- [x] Workspace docs RAG (pgvector semantic search)
- [x] Platform docs RAG

#### 6.4.3 — Voice Missions (Ultravox) [DONE]

- [x] Botsson — onboarding interview (Norwegian, Mark voice, 30min)
- [x] Lise — landing page ambassador (Norwegian, custom voice, 10min)
- [x] Mr. Botsson — dashboard assistant (Norwegian, Mark voice, 30min)
- [x] HACCP Inspector — food safety auditor (Norwegian, Sarah voice, 15min)
- [x] Shift Assistant — schedule planner (Norwegian, Tina voice, 15min)
- [x] Mission registry with template context, voice config, client tools

#### 6.4.4 — Guardian System [DONE]

- [x] Guardian Bus — WebSocket pub/sub for workspace-wide events
- [x] Guardian Evaluator — real-time session monitoring (30s interval)
- [x] Calendar Guardian — time-based triggers (60s interval)
- [x] Guardian actions: none, advance, nudge, timeout, off_topic, silence
- [x] Edge Functions: guardian-notify, guardian-sweep, guardian-actions
- [x] Admin dashboard (13 components)

#### 6.4.5 — Memory & Relationships [DONE]

- [x] Persistent memory with pgvector embeddings (`engine_memory` table)
- [x] Memory types: preference, fact, summary
- [x] TTL support (expires_at)
- [x] Relationship tracking: familiarity, trust, sentiment scores
- [x] Auto-create on first interaction
- [x] Memory injection during context collection

#### 6.4.6 — Authority System [DONE]

- [x] Per-workspace capability authority levels (`engine_authority_config` table)
- [x] 5 levels: autonomous, confirm, suggest, read_only, disabled
- [x] Authority-aware tool selection in router
- [x] Posture system adapts personality to role/situation/authority

#### 6.4.7 — Event Engine [DONE]

- [x] `engine_event` — generic event stream
- [x] `engine_trigger` — rules matching events to processes
- [x] `engine_state` — execution state for triggered processes
- [x] `engine_step` — steps within a process
- [x] `engine-dispatch` Edge Function — event matching and trigger execution

---

## Cross-Cutting Systems (Built Outside Wave Structure)

These features were built across multiple waves and don't fit neatly into a single wave.

### C.1 — Document Mode [DONE]

- [x] Document mode shell, panel, toolbar, canvas, sidebar
- [x] Context provider for state management
- [x] Template picker and chapter structure
- [x] Handbook content hook
- [x] Integrated into DashboardShell

### C.2 — Unified Search [DONE]

- [x] Search orchestrator — multi-source coordinator (`apps/web/src/lib/search/orchestrator.ts`)
- [x] Query prefix parsing and normalization
- [x] Search metrics/performance tracking
- [x] GlobalSearchPalette — command-palette style search
- [x] Workspace docs semantic search (pgvector RAG)
- [x] Search API route (`/api/search`)

### C.3 — Dashboard Views [DONE]

- [x] TacticalView — operational day view
- [x] StrategicView — strategic KPI overview
- [x] ReconciliationView — settlement tracking
- [x] ActivityView — activity feed
- [x] EmployeeDashboard — employee-specific view
- [x] ActionStrip — quick action toolbar
- [x] DashboardShell — server layout + client shell (ADR-0021)
- [x] Workspace switcher, user menu, contract pending banner

### C.4 — Docs Pipeline [DONE]

- [x] CLI tool for knowledge base management (`packages/docs-pipeline/`)
- [x] Commands: ingest, ingest-workspace, watch, validate
- [x] Git diff mode, filesystem hash tracking, workspace metadata
- [x] Deduplication via cosine similarity (threshold 0.96)
- [x] Dry-run mode, workspace filtering, idempotency

### C.5 — Landing Page System [DONE]

- [x] Dynamic block-based rendering (apps/landing/)
- [x] 13+ block types: hero, features, case studies, testimonials, pricing, FAQs, stats, CTAs, voice widget, workspace analyzer
- [x] Multi-variant A/B testing support
- [x] Admin editor (`/platform-admin/landing/variants`)
- [x] Live preview
- [x] Variant metadata (SEO, analytics)
- [x] PostHog EU event tracking

### C.6 — Employee Self-Service Routes

- [x] `/dashboard/my-schedule` — personal schedule view
- [x] `/dashboard/my-training` — training progress (route exists, content partial)
- [x] `/dashboard/my-salary` — payroll/hours view (route exists, content partial)
- [x] `/dashboard/my-cv` — employee profile/CV

### C.7 — Marketing Pages

- [x] `/pricing` — Pricing page
- [x] `/features` — Features page with tabs
- [x] `/concepts` — Concept explanations
- [x] `/blog` — Blog section
- [x] `/om-oss` — About us (Norwegian)
- [x] `/demo` — Demo section
- [x] `/personvern` — Privacy policy
- [x] `/vilkar` — Terms and conditions
- [x] `/login`, `/signup`, `/waitlist` — Auth flows

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

**Overall progress:** Wave 0 done, Wave 1 ~85%, Wave 2 ~75%, Wave 3 ~50%, Wave 4 ~30%, Wave 5 ~10%, Wave 6 ~60%.

The project has built significantly out of wave order — especially AI (Wave 6.4) and Scheduling (Wave 2.1) which are both ~80% complete. The largest gaps are in Operations (Wave 3 department sessions/hooks), Training (Wave 4), and Payroll (Wave 5).

**Active work (as of 2026-03-17):**

| Worktree   | Branch                     | Focus                                                            |
| ---------- | -------------------------- | ---------------------------------------------------------------- |
| walkTalkie | `feat/agent-chat`          | AI conversation, brreg integration, emma memory, login/join flow |
| wt-14      | `feat/dashboardWork`       | Dashboard UI improvements                                        |
| wt-3       | `feat/fix/adminpage-speed` | Admin page caching + query consolidation                         |
| wt-5       | `feat/journey-engine-core` | Event-driven workflow engine                                     |
| wt-50      | `feat/bugfixes`            | Invite dialog, people table, wizard steps                        |

**Immediate next steps (recommended order):**

1. **Finish Wave 1 gaps** — Settings module, position CRUD, zone/asset CRUD, people profile detail page
2. **Complete invite-accept flow (1.3.3)** — Real auth signup, email dispatch — employee entry point
3. **Build Operations core (Wave 3.1)** — Department sessions, session hooks, clock-in/out — the biggest missing business features
4. **Complete Schedule gaps** — Shift swap workflow, E2E tests
5. **Wire end-to-end event flows** — Shift publish → session creation, invite accept → protocol assignment (partially done but untested)

**Why this order:**

- Settings and invite-accept are blocking onboarding completion
- Operations (department sessions + hooks) is the core daily workflow and blocks HACCP
- End-to-end event flows are the glue — engine_dispatch is deployed but flows are untested
- Schedule is functional but needs swap workflow for production use

---

## Quick Reference: Module > Route > Status

| Module              | Dashboard Route                                   | Status      | Wave | Completion |
| ------------------- | ------------------------------------------------- | ----------- | ---- | ---------- |
| 1: Onboarding       | `/onboarding`, `/invite/[token]`                  | In progress | 1    | ~90%       |
| 2: Org Structure    | `/dashboard/organization`                         | In progress | 1    | ~85%       |
| 3: Scheduling       | `/dashboard/schedule`                             | In progress | 2    | ~80%       |
| 4: Operations       | `/dashboard/operations`, `/dashboard/close`       | In progress | 3    | ~40%       |
| 5: HACCP            | (within operations)                               | Minimal     | 3    | ~5%        |
| 6: Training         | `/dashboard/governance`, `/dashboard/my-training` | Partial     | 4    | ~30%       |
| 7: Absence          | (within scheduling)                               | Partial     | 5    | ~40%       |
| 8: Payroll          | `/dashboard/my-salary`                            | Minimal     | 5    | ~10%       |
| 9: Communication    | `/dashboard/chat`                                 | Built       | 2    | ~70%       |
| 10: Reports         | `/dashboard/reports`                              | Built       | 6    | ~70%       |
| 11: Settings        | `/dashboard/settings`                             | Partial     | 1    | ~30%       |
| 12: AI              | `/dashboard/ai` + Stage Engine                    | Built       | 6    | ~80%       |
| 13: Multi-tenant    | Cross-cutting                                     | Built       | 0    | ~90%       |
| 14: Production      | (new route)                                       | Not started | 6    | 0%         |
| 15: Season Planning | `/dashboard/year-wheel`                           | Done        | 6    | ~95%       |
| 17: Platform Admin  | `/platform-admin/*`                               | Done        | 0    | ~95%       |
| 18: WebRTC          | `/dashboard/chat` (extends)                       | Minimal     | 2    | ~10%       |

---

## Appendix A: Intelligence Architecture — Conceptual Summary

> How Smartout's AI agents work, end to end.

### The Big Picture

Smartout has a **multi-agent intelligence layer** that runs alongside the human-facing dashboard. Every AI interaction — voice onboarding, schedule planning, HACCP audits, free-form chat — flows through a single runtime: the **Stage Engine**. Agents don't just answer questions; they have persistent memory, adapt their personality to each employee, and operate within workspace-defined authority boundaries.

### Stage Engine (Runtime Gateway)

The Stage Engine (`services/stage-engine/`, Hono, port 3000) is the universal entry point for all agent interactions. It supports two modes:

| Mode        | Purpose                                                  | Session Shape                                                      |
| ----------- | -------------------------------------------------------- | ------------------------------------------------------------------ |
| **Mission** | Structured multi-stage flows (onboarding, HACCP audit)   | Has `mission_id`, stages with goals/criteria, Guardian supervision |
| **Agent**   | Free-form conversation (Mr. Botsson dashboard assistant) | NULL `mission_id`, open-ended, still authority-bounded             |

Both modes use WebSocket connections for real-time streaming. Sessions persist in `engine_sessions` with auto-expiry.

### Agent Router Pipeline (6 Steps)

Every user message goes through a deterministic pipeline in `agent-router.ts`:

```
1. Load Authority Config    → What CAN this agent do in this workspace?
2. Classify Intent          → What DOES the user want? (OpenRouter/Claude Sonnet 4)
3. Collect Context          → Profile, relationships, memories, shift data (parallel)
4. Select Tools             → Filter available tools by authority level
5. Build Prompt             → Three-layer prompt with posture adaptation
6. Invoke LLM              → OpenRouter/Claude with selected tools + context
```

The intent classifier returns a capability domain (one of 9), confidence score, and reasoning. Low-confidence intents get routed to general conversation rather than tool use.

### Capability System (9 Domains)

Each workspace configures which capabilities their agents may use, and at what authority level:

| Capability        | What it covers                    | Example tools                          |
| ----------------- | --------------------------------- | -------------------------------------- |
| **knowledge**     | Company knowledge, handbook, docs | searchDocs, getHandbook                |
| **schedule**      | Shifts, availability, coverage    | createShift, listShifts, publishWeek   |
| **training**      | Protocols, procedures, readiness  | getAssignments, checkReadiness         |
| **operations**    | Sessions, tasks, deviations       | getSessionStatus, logDeviation         |
| **profile**       | Employee data, teams, contracts   | getProfile, getTeam, getContractStatus |
| **communication** | Messages, notifications           | sendMessage, notifyTeam                |
| **memory**        | Agent recall, preferences         | storeMemory, recallMemory              |
| **payroll**       | Hours, salary, supplements        | getWorkedHours, calculatePay           |
| **ui**            | Screen navigation, form filling   | navigateTo, openPanel, fillForm        |

Authority levels per capability: **autonomous** (act freely) → **confirm** (ask before acting) → **suggest** (recommend only) → **read_only** (observe) → **disabled** (hidden). Stored in `engine_authority_config` (per-workspace, per-capability).

### Three-Layer Prompt Architecture

Every agent prompt is composed from three layers:

```
┌─────────────────────────────────────┐
│  MISSION LAYER                      │  Who am I? (identity, voice, rules)
│  - Agent persona (Botsson, Lise...) │
│  - System prompt from mission       │
│  - Temperature, max duration        │
├─────────────────────────────────────┤
│  CONTEXT LAYER                      │  What do I know? (dynamic per-request)
│  - Profile data (role, department)  │
│  - Relationship history             │
│  - Retrieved memories (pgvector)    │
│  - Current shift/schedule context   │
│  - Workspace authority config       │
├─────────────────────────────────────┤
│  STAGE LAYER                        │  What am I doing now? (mission mode only)
│  - Current stage goal               │
│  - Completion criteria              │
│  - Allowed tools for this stage     │
│  - Stage-specific instructions      │
└─────────────────────────────────────┘
```

### Posture System (Personality Adaptation)

Agents don't have fixed personalities — they adapt along 5 dimensions:

| Dimension     | Range | What it controls               |
| ------------- | ----- | ------------------------------ |
| Formality     | 0–1   | Casual ↔ Professional tone     |
| Assertiveness | 0–1   | Passive ↔ Direct behavior      |
| Warmth        | 0–1   | Neutral ↔ Encouraging language |
| Humor         | 0–1   | Serious ↔ Playful responses    |
| Verbosity     | 0–1   | Terse ↔ Detailed explanations  |

Posture is resolved through 4 adjustment layers: **role** (trainees get more warmth, less formality) → **situation** (HACCP gets more assertiveness, less humor) → **authority** (read_only gets more formality, less assertiveness) → **relationship** (high familiarity reduces formality, increases humor).

### Voice Missions (Ultravox)

Five pre-configured voice agents, each with distinct identity and purpose:

| Agent               | Role                    | Voice       | Duration | Key Tools                                        |
| ------------------- | ----------------------- | ----------- | -------- | ------------------------------------------------ |
| **Botsson**         | Onboarding interviewer  | Mark (NO)   | 30 min   | Workspace intelligence, scraping, business setup |
| **Lise**            | Landing page ambassador | Custom (NO) | 10 min   | Demo navigation, feature explanation             |
| **Mr. Botsson**     | Dashboard assistant     | Mark (NO)   | 30 min   | All 9 capability domains                         |
| **HACCP Inspector** | Food safety auditor     | Sarah (NO)  | 15 min   | Temperature logging, CCP verification            |
| **Shift Assistant** | Schedule planner        | Tina (NO)   | 15 min   | Shift CRUD, coverage analysis, publishing        |

### Guardian System (Supervision Layer)

The Guardian monitors active agent sessions and intervenes when needed:

- **Guardian Evaluator**: Checks sessions against completion criteria every 30 seconds
- **Calendar Guardian**: Fires time-based triggers (shift start reminders, session opens) every 60 seconds
- **Guardian Bus**: WebSocket pub/sub for workspace-wide event distribution

Guardian actions: `none` (on track) → `nudge` (gentle redirect) → `advance` (auto-progress to next stage) → `off_topic` (redirect back) → `silence` (re-engage after inactivity) → `timeout` (end session).

Three Edge Functions support the Guardian: `guardian-sweep` (batch evaluation), `guardian-notify` (dispatch alerts), `guardian-actions` (execute interventions).

### Memory System (Persistent Recall)

Agents remember across sessions via `engine_memory` table with pgvector embeddings:

- **Memory types**: preference ("likes morning shifts"), fact ("allergic to nuts"), summary (conversation recap)
- **TTL support**: memories can expire (`expires_at`)
- **Retrieval**: Semantic search during context collection — relevant memories injected into prompt
- **Workspace isolation**: RLS ensures agents only recall memories from their workspace

### Relationship Tracking

Each agent-profile pair builds a relationship over time (`agent_relationship` table):

- **Familiarity score**: How well the agent "knows" this person (conversation count weighted)
- **Trust score**: Quality of past interactions
- **Sentiment score**: Overall emotional tone of interactions
- **Relationship score**: Composite metric influencing posture adaptation

Auto-created on first interaction. Higher familiarity = more casual tone, more personalized responses.

### Event Engine (Automation)

The event-driven automation layer processes domain events and triggers processes:

```
engine_event (something happened)
    ↓ matched by
engine_trigger (rule: if event X, start process Y)
    ↓ creates
engine_state (execution context for the triggered process)
    ↓ steps through
engine_step (individual actions within the process)
```

The `engine-dispatch` Edge Function handles event matching and trigger execution. Currently used for DailyClose process (10 steps) — designed to support any workflow automation.

### What's Built vs. What's Missing

| Layer                          | Status    | Gap                                                                    |
| ------------------------------ | --------- | ---------------------------------------------------------------------- |
| Agent runtime (Stage Engine)   | DONE      | —                                                                      |
| Agent router (6-step pipeline) | DONE      | —                                                                      |
| Capability system (9 domains)  | DONE      | Tool implementations vary (some capabilities have stubs)               |
| Posture system                 | DONE      | —                                                                      |
| Voice missions (5 agents)      | DONE      | —                                                                      |
| Guardian supervision           | DONE      | Calendar triggers not yet connected to department sessions             |
| Memory system                  | DONE      | Memory creation during conversations not yet automatic                 |
| Relationship tracking          | DONE      | —                                                                      |
| Authority config               | DONE      | No admin UI to configure per-workspace authority                       |
| Event engine                   | DONE      | Only DailyClose process seeded; no events actually emitted yet         |
| Employee-facing agent access   | NOT BUILT | Employees can't interact with agents from /my-schedule or /my-training |

---

## Appendix B: Dashboard View Modes — Conceptual Summary

> The four ways users experience the Smartout dashboard.

The dashboard (`DashboardShell.tsx`) has **two independent mode switches** that combine into four distinct experiences:

```
                    ┌──────────────────┐
                    │  Document Mode   │  (toggle button in sidebar)
                    │  "Handbok"       │
                    └──────────────────┘
                            │
                    ┌───────┴────────┐
                    │  isDocumentMode │
                    │  true / false   │
                    └───────┬────────┘
                            │ false
                    ┌───────┴────────┐
                    │  isAdminMode   │
                    │  true / false   │
                    └───────┬────────┘
                   ┌────────┴────────┐
              true │                 │ false
        ┌──────────┴──┐     ┌───────┴────────┐
        │ Operation   │     │ My View        │
        │ View (Drift)│     │ (Arbeidsrom)   │
        └─────────────┘     └────────────────┘
              │
     ┌────────┴────────┐
     │ adminView tabs: │
     │ Taktisk         │  → TacticalView
     │ Strategisk      │  → StrategicView
     │ Avstemming      │  → ReconciliationView
     │ Aktivitet       │  → ActivityView
     │ Vakt            │  → GuardianView
     └────────────────-┘
```

### 1. Operation View (Drift) — Admin Mode ON, Document Mode OFF

**Breadcrumb:** `Drift > [current page]`
**Who:** Managers, admins, owners
**Purpose:** Run the business — scheduling, staffing, reports, governance, operations.

The sidebar shows the full admin navigation organized in three groups:

| Group              | Routes                                                                                  |
| ------------------ | --------------------------------------------------------------------------------------- |
| **Planlegging**    | Oversikt (dashboard home), Vaktplan (/schedule), Ansatte (/people), Chat (/chat)        |
| **Operasjoner**    | Drift (/operations), Rapporter (/reports)                                               |
| **Administrasjon** | HMS (/governance), Sesong (/season), Organisasjon (/organization), Vakt (Guardian view) |

On the **dashboard home page** (`/dashboard`), admins see a tab switcher in the action bar with 5 sub-views:

| Tab            | Component            | What it shows                                                                                                                                                                      |
| -------------- | -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Taktisk**    | `TacticalView`       | Today's operational reality — weekly calendar strip, shift coverage, staffing stats, leader pulse, deviation alerts, guardian signals. Clickable dates open the Day Control Panel. |
| **Strategisk** | `StrategicView`      | KPI dashboard — revenue targets vs actuals, labor cost %, budget tracking, location comparison, settings for KPI targets.                                                          |
| **Avstemming** | `ReconciliationView` | Settlement tracking — daily planned vs actual reconciliation, shift approvals, deviation log, revenue matching.                                                                    |
| **Aktivitet**  | `ActivityView`       | Activity feed — chronological log of all workspace events (shifts created, protocols assigned, invitations sent, etc.).                                                            |
| **Vakt**       | `GuardianView`       | Guardian monitoring — real-time agent session status, signal dashboard, active warnings, 13 guardian components.                                                                   |

The admin also gets the `ActionStrip` toolbar (quick actions: create shift, invite employee, start session, etc.) rendered above the view content.

### 2. My View (Arbeidsrom) — Admin Mode OFF

**Breadcrumb:** `Arbeidsrom > [current page]`
**Who:** Employees (and admins previewing the employee experience)
**Purpose:** Personal workspace — my shifts, my training, my profile, my pay.

The sidebar collapses to the "Mitt arbeidsrom" (My Workspace) navigation:

| Route                    | Icon            | Label         | Status                                                                                                      |
| ------------------------ | --------------- | ------------- | ----------------------------------------------------------------------------------------------------------- |
| `/dashboard`             | LayoutDashboard | Oversikt      | **Built** — `EmployeeDashboard` shows today's shift, upcoming shifts, readiness score, open shifts to claim |
| `/dashboard/my-schedule` | Calendar        | Min vaktplan  | **Route exists** — content is a placeholder shell                                                           |
| `/dashboard/my-training` | GraduationCap   | Min opplæring | **Route exists** — content is a placeholder shell                                                           |
| `/dashboard/my-cv`       | FileText        | Min profil    | **Route exists** — personal profile/CV view                                                                 |
| `/dashboard/my-salary`   | Banknote        | Min lønn      | **Route exists** — content is a placeholder shell                                                           |

The `EmployeeDashboard` component is real — it queries `useMyShifts(profileId)` and `useMyReadiness(profileId)` for actual data, and shows open shifts from `schedule_shift` where `employee_id IS NULL`. No ActionStrip, no admin sub-views.

**Key gap:** The employee view routes exist but most are placeholder shells. The EmployeeDashboard landing page is functional but the individual pages (my-schedule, my-training, my-salary) show "under construction" messages.

### 3. Document View (Handbok) — Document Mode ON

**Breadcrumb:** `Handbok > Dokumentmodus`
**Who:** Admins authoring the company handbook
**Purpose:** Write and maintain the 10-chapter company handbook using a rich text editor.

When Document Mode is toggled ON (via the sidebar button), the entire main content area is replaced by `DocumentModeShell`:

| Component              | Role                                                                                |
| ---------------------- | ----------------------------------------------------------------------------------- |
| `DocumentModeSidebar`  | Left panel — 10 fixed chapter navigation (replaces the normal sidebar content area) |
| `DocumentModeCanvas`   | Center — Tiptap rich text editor with StarterKit + Highlight extensions             |
| `DocumentModeToolbar`  | Top — Formatting toolbar (bold, italic, headings, lists, etc.)                      |
| `DocumentModePanel`    | Right — 3 tabs: Tools (template picker), Actions (save), Settings (font size)       |
| `DocumentModeProvider` | Context — activeChapterKey, panelTab, isDirty, editorRef state management           |

The 10 handbook chapters are fixed keys defined in `chapters.ts`:

```
velkommen, om-oss, verdier, organisering, rutiner,
sikkerhet, personal, opplaering, kvalitet, diverse
```

Content is stored as Tiptap JSONContent in `handbook_chapter` table (one row per workspace × chapter_key). The `useHandbookContent` hook loads and `useHandbookSave` mutation persists changes.

**Key gap:** Document Mode is admin-only (authoring). There is no employee-facing handbook reader — employees cannot browse the chapters their admin has written. The handbook content is also not connected to the workspace RAG pipeline (`workspace_doc_chunk`), so agents can't search handbook content either.

### 4. Focus View (Specialized Pages)

**Not a toggle** — Focus View refers to full-page routes that take over the content area when navigated to, regardless of admin/employee mode. These pages have their own internal navigation and don't use the dashboard sub-view tabs.

Key focus pages:

| Route                   | Page             | What it does                                                                                                                                                                                                               |
| ----------------------- | ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/dashboard/schedule`   | Schedule Planner | Full scheduling interface with week/day/month views, drag-and-drop shifts, Day Control Panel, publish workflow. Has its own layout toggle (Uke/Rullerende/Måned/Liste) and view mode (Ansatt/Jobb/Team) in the action bar. |
| `/dashboard/close`      | Daily Close      | CloseOutFlow — structured close workflow with checklist, gatekeeper sign-off, image upload, settlement validation.                                                                                                         |
| `/dashboard/reports`    | Reports          | ReportsPageShell with AI chat panel, saved reports, deep insights.                                                                                                                                                         |
| `/dashboard/chat`       | Communication    | ChatShell with conversation list, message thread, real-time updates.                                                                                                                                                       |
| `/dashboard/ai`         | Mr. Botsson      | Full-screen AI assistant interface.                                                                                                                                                                                        |
| `/dashboard/governance` | HMS/Governance   | Protocol overview, employee assignment tracking, journey maps.                                                                                                                                                             |

These pages render as `{children}` inside DashboardShell — the sidebar navigation still shows, but the action bar view tabs (Taktisk/Strategisk/etc.) are hidden since they only appear on the dashboard home page.

### Summary: How the Modes Relate

| Mode                       | Trigger                          | Sidebar                   | Content Area                   | Action Bar              |
| -------------------------- | -------------------------------- | ------------------------- | ------------------------------ | ----------------------- |
| **Operation View**         | Admin toggle ON + dashboard home | Full admin nav (3 groups) | 5 sub-views via tab switcher   | ActionStrip + view tabs |
| **Operation View (focus)** | Admin toggle ON + any sub-page   | Full admin nav            | Page-specific content          | Page-specific controls  |
| **My View**                | Admin toggle OFF                 | Employee nav (5 items)    | EmployeeDashboard or sub-pages | None                    |
| **Document View**          | Document mode toggle ON          | Chapter navigation        | Tiptap editor + panel          | Hidden                  |
