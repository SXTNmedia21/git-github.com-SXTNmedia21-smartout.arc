# Smartout — Build Order & Implementation Strategy

> Strategic implementation sequence for the Smartout enterprise workforce platform.
> This document tracks both the foundation of the platform and the progressive rollout of complex modules.
> It reflects the 'Layered Sovereignty' architecture and our AI-first approach.

---

## Phase 0: Foundation & Scaffolding [COMPLETED]

**Status:** ✅ Substantially Complete
**Goal:** Monorepo, database schema, authentication, foundational shared packages, and base app architecture.

### 0.1 — Monorepo Scaffold [DONE]

- [x] pnpm workspace (`apps/web`, `packages/types`, `packages/supabase`, `packages/utils`)
- [x] Turborepo config (`turbo.json`)
- [x] Base `tsconfig.json` with strict mode and bundler module resolution
- [x] Code Quality (ESLint, Prettier)

### 0.2 — Supabase Project Setup [DONE]

- [x] Dev environment configured
- [x] `.env.local` mappings
- [x] `supabase/config.toml` set

### 0.3 & 0.4 — Core SQL: Identity & Structure Tables [DONE]

- [x] Core models: `user`, `company`, `company_member`, `workspace`, `profile`
- [x] Structure models: `department`, `location`, `zone`, `asset`, `position`, `team`, `season`

### 0.5 — Core SQL: Governance Tables [DONE]

- [x] Base tables: `policy`, `protocol`, `procedure`, `routine`, `knowledge_test`
- [x] Data tracking tables: `confirmation`, `protocol_assignment`

### 0.6 — Security & Access Control [IN PROGRESS]

- [x] RLS enabled on core tables
- [x] Helper functions for workspace isolation
- [ ] Refine complex cross-tenant RLS policies for aggregated data

### 0.7 & 0.8 — Shared Packages [DONE]

- [x] `@smartout/types` — Exported domain types
- [x] `@smartout/supabase` — Client/Server/Middleware exports for Next.js 14+ Edge environments

### 0.9 — Next.js Application Scaffold [DONE]

- [x] App Router, Tailwind CSS, shadcn/ui
- [x] Authentication flows (`/login`, `/signup`)
- [x] Supabase edge middleware for active session management
- [x] Playwright E2E testing framework integrated

---

## Phase 1: Intelligent Onboarding & Workspace Setup

**Status:** 🟡 In Progress / Nearing Completion
**Goal:** Seamless, AI-driven onboarding experience enabling users to create companies, workspaces, and structure their organization dynamically.

### 1.1 — AI Onboarding Assistant

- [x] Initial signup flow creating Company, Workspace, and Owner profile
- [x] Web scraping pipeline for automated intelligence gathering
- [x] Voice Assistant (Ultravox/Claude) integration for guided setup
- [x] Assistant UI with transcripts and step-by-step progression tracker

### 1.2 — Org Structure Configuration

- [x] Dynamic seasonal toggles for Departments (`isSeasonActive`)
- [x] Multi-department teams configuration support
- [x] `activate_workspace_v3` / Edge function execution

### 1.3 — Employee Invitation System

- [x] Edge function for robust invite creation (email/link/bulk)
- [ ] Invitation management UI (resend, status tracking)
- [ ] Accept-invite flow linking new users to existing profiles

### 1.4 — Trainee & Verification Mode

- [x] Company Verification Card (Industry/Description rendering)
- [ ] Flagging new profiles as 'Trainees'
- [ ] Role progression mechanisms

---

## Phase 2: Strategic Dashboarding & KPIs

**Status:** 🟡 Active Development
**Goal:** High-level strategic views for owners/HR to monitor "Cost of Sales", "Turnover", and operations across locations.

### 2.1 — Tactical & Strategic UI

- [x] Component mapping for Admin Dashboard (Tactical vs Strategic views)
- [x] Real-time Operational capacity tracking (Staff Present vs Tasks)
- [x] Dark Mode / Light Mode parity using `DashboardContext`

### 2.2 — Configurable KPI Targets

- [x] Settings Modal for configuring Baseline Targets (Payroll %, Turnover %, Absence Rate, Onboarding SLA)
- [x] Visual KPI Cards with context/explanation flips
- [ ] Save configurations mutations to Supabase `workspace_settings`

### 2.3 — Historical Data & Forecasting

- [x] Modern interactive Turnover Trend Chart (SVG/Framer Motion)
- [x] Workforce Pipeline view (Hires, Resignations, Tenure)
- [ ] Database Edge Functions for extracting and snapshotting daily metrics
- [ ] Implement data extraction pipeline aligning with `SMARTOUT_TELEMETRY_ARCHITECTURE.md`

---

## Phase 3: Scheduling & Shift Management

**Status:** 🟡 Active Development
**Goal:** Flexible, print-friendly, and highly functional scheduling architecture.

### 3.1 — Schedule Views

- [x] Shift tracking UI
- [x] Print-optimized "Vaktliste" (List view) grouping shifts by day with high-contrast formatting
- [x] Dynamic time handling ("Hele Dagen" logic, fallback states)

### 3.2 — Advanced Scheduling Features [Upcoming]

- [ ] Drag-and-drop shift assignment matrix
- [ ] Shift Templates mapping
- [ ] Open Shift Board & Swap mechanics
- [ ] Real-time availability conflict detection

---

## Phase 4: Live Operations (Daily Execution)

**Status:** 🔵 Up Next
**Goal:** Transform static schedules into actionable, live data flows for workers on shift.

### 4.1 — The Department Session

- [ ] Auto-generation of Daily Department Sessions based on schedule
- [ ] Real-time "Register vs Staff Cost (Hour by Hour)" live tracking
- [ ] Stress Level / Capacity calculators

### 4.2 — Task Execution & Compliance

- [ ] Session Tasks generation (Opening, Closing routines)
- [ ] Ad-hoc task injection
- [ ] Compliance verification (Sign-offs, Handoff system)

---

## Phase 5–15: Advanced Modules

**Remaining Horizon:**

- _Phase 5: Automated Academy & Training_
- _Phase 6: Payroll Processing & Export_
- _Phase 7: Advanced Governance & Audit Protocols_
- _Phase 10: Reports, Dashboards & Reconciliation_
- _Phase 14: Production & Menu Management_
- _Phase 15: Season Planning & Budget Engine_

Detailed stories to be elaborated prior to Sprint Kickoffs.
See `docs/modules/` for architectural briefs on subsequent systems.

---

## Linear / Sprint Mapping Structure

All tasks map to Linear using the following paradigm:

```text
Project: Smartout Core Platform
  └── Epic: Phase 1 — Intelligent Onboarding
        ├── Story: 1.1 — AI Onboarding Assistant (UI)
        ├── Story: 1.2 — Multi-Dept Backend Activation
        └── ...
  └── Epic: Phase 2 — Strategic KPIs
        ├── Story: 2.1 — KPI Configuration Panel
        ├── Story: 2.2 — Telemetry Extraction RPCs
        └── ...
```

Each Linear Issue contains:

- **Title**: `[Phase.Story] — Description`
- **AC**: Acceptance criteria as verifiable checklist
- **Labels**: `Frontend`, `Backend`, `AI`, `Testing`
- **Link**: PR tracking back to this living Build Order document.
