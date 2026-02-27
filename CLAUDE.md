# GEMINI_CONTEXT.md — Smartout System Prompt

> This file is automatically loaded by Gemini. It defines who we are, what we're building, and how code should be written.

---

## Project Identity

**Smartout** is an Employee Readiness System for shift-based businesses in Norway (restaurants, hotels, cafés, bars).

**Core problem:** ~75% annual turnover in the Norwegian service industry. Smartout makes employees _ready_ — trained, compliant, equipped, and informed before their first shift.

**"Ready" means:** All assigned Policies learned, all Protocols completed — knowledge tested, procedures trained, confirmations signed.

---

## Tech Stack

| Layer         | Technology                                       | Notes                                                         |
| ------------- | ------------------------------------------------ | ------------------------------------------------------------- |
| Web Dashboard | Next.js 14+ (App Router)                         | TypeScript, Tailwind CSS, shadcn/ui                           |
| Mobile App    | React Native + Expo                              | TypeScript                                                    |
| Backend       | Supabase                                         | PostgreSQL, Auth, Storage, Realtime, Edge Functions (Deno)    |
| Automation    | n8n + Edge Functions                             | n8n for complex workflows, Edge Functions for simple triggers |
| Hosting       | Vercel (web), Supabase Cloud, DigitalOcean (n8n) |                                                               |
| Language      | TypeScript                                       | Everywhere. No exceptions.                                    |
| Monorepo      | pnpm workspaces + Turborepo                      |                                                               |

---

## Monorepo Structure

```
smartout/
├── apps/web/          → Next.js dashboard
├── apps/mobile/       → React Native + Expo
├── packages/types/    → Shared TypeScript types
├── packages/supabase/ → Shared Supabase client, queries, helpers
├── packages/utils/    → Shared utilities
├── supabase/          → Migrations, Edge Functions, seed data
├── docs/              → All documentation
└── .cursor/rules/     → Cursor context rules
```

---

## Core Data Model (11 Types)

These are the foundational entities. Every module builds on top of these.

**Identity:**

- `user` — Person. One per human. Login identity.
- `company` — Legal entity. Org number. Can have multiple workspaces.
- `company_member` — Thin bridge: User ↔ Company.
- `workspace` — Physical workplace. The operational unit. ALL daily work happens here.
- `profile` — Rich bridge: User ↔ Workspace. Role, status, department, teams.

**Structure:**

- `department` — What (Kitchen, Floor, Bar). Permanent. Never seasonal.
- `location` — Where (Main building, Terrace). Physical places.
- `team` — Access grouping. Can be seasonal. Has a leader.

**Governance:**

- `policy` — The rule. Types: operational, haccp, hr, safety, access, payroll, custom.
- `protocol` — The enforcement mechanism. 1:1 with Policy.

**Time:**

- `season` — When. Wraps all operations. Gamification container.

### Governance Chain

```
Policy (the rule)
  └── Protocol (the enforcement)
        ├── Procedure (learn: ordered steps)
        │     └── ProcedureStep
        ├── Routine (do: recurring operational task)
        ├── Runbook (do: multi-step operational process)
        ├── ControlList (verify: checklist after routines/runbooks)
        ├── KnowledgeTest (prove: quiz)
        └── Confirmation (acknowledge: sign-off, anti-ghosting)
```

### Extension Types

- `zone` — Extends Location. Service sections (Section 1, Seaside, Penthouse).
- `asset` — Extends Location. Equipment (Walk-in Fridge, Oven, Register).
- `position` — Extends Department. Job types (Servitør, Kokk, Bartender). Assigned per shift, NOT per profile.

### Key Rules

- ALL tables (except user, company, company_member) have `workspace_id`
- `workspace_id` is enforced via Supabase RLS — no data leaks between tenants
- Profile has NO direct season connection. Season filters DATA, not the person.
- Department is permanent. Team can be seasonal.
- Position is per-shift, not per-person. An employee can work different positions.

---

## Role & Access Model

**Roles (ascending):** employee → manager → admin → owner
**Statuses:** trainee → active → inactive → offboarding
**Leader:** Team attribute (`team.leader_profile_id`), NOT a role

- `trainee` = sandbox mode. Actions don't affect live data.
- `active` = full employee. Real impact.
- `inactive` = paused / on leave.
- `offboarding` = leaving the organization.

---

## Code Conventions

### TypeScript

- Strict mode always (`strict: true`)
- Use `type` over `interface` for data shapes
- Use `enum` only for true enums, prefer union types for option sets
- No `any`. Use `unknown` + type guards if needed.
- Prefer named exports over default exports
- Use barrel exports (`index.ts`) in packages

### File Naming

- Components: `PascalCase.tsx` (e.g., `DepartmentCard.tsx`)
- Hooks: `camelCase.ts` prefixed with `use` (e.g., `useDepartmentSessions.ts`)
- Utils/lib: `camelCase.ts` (e.g., `formatCurrency.ts`)
- Types: `camelCase.ts` (e.g., `core.ts`, `operations.ts`)
- Pages (Next.js): `page.tsx` in route folders
- Migrations: `NNNNN_description.sql` (e.g., `00001_core_tables.sql`)
- Edge Functions: `kebab-case/index.ts` (e.g., `create-invite/index.ts`)

### Database

- Table names: `snake_case`, singular (e.g., `department_session`, not `departmentSessions`)
- Column names: `snake_case`
- Primary keys: `{table}_id` (e.g., `department_id`, `session_id`)
- Foreign keys: `{referenced_table}_id`
- Timestamps: `created_at`, `updated_at` on every table
- Booleans: `is_` prefix (e.g., `is_active`, `is_required`)
- JSONB: Use for flexible/nested data. Document the shape in comments.
- UUIDs for all primary keys

### Supabase

- Use Row Level Security (RLS) on EVERY table
- Use `auth.uid()` in RLS policies
- Edge Functions: validate input with Zod
- Use Supabase client with RLS (not service role) for user-facing operations
- Service role only for admin operations and triggers

### React / Next.js

- App Router (not Pages Router)
- Server Components by default, Client Components only when needed
- Use shadcn/ui for all UI components
- Tailwind CSS for styling — no CSS modules, no styled-components
- Use React Query (TanStack Query) for data fetching
- Use Supabase Realtime for live updates where documented

### Error Handling

- Edge Functions: Always return proper HTTP status codes with JSON error body
- Client: Toast notifications for user-facing errors
- Never swallow errors silently
- Log errors with context (what was being attempted, what failed)

---

## Module Documentation

Full documentation for each module lives in `docs/modules/`. Before implementing any module, **read the corresponding documentation file first**.

| Module        | Doc File                     | Core Tables                                                  |
| ------------- | ---------------------------- | ------------------------------------------------------------ |
| Onboarding    | `MODULE_01_ONBOARDING.md`    | invitation, onboarding_journey, journey_checkpoint           |
| Org Structure | `MODULE_02_ORG_STRUCTURE.md` | department, location, zone, asset, position, team            |
| Scheduling    | `MODULE_03_SCHEDULING.md`    | shift_template, shift, punch, availability_request           |
| Operations    | `MODULE_04_OPERATIONS.md`    | department_session, session_hook, session_task, session_note |
| HACCP         | `MODULE_05_HACCP.md`         | (uses session_task with category='haccp')                    |
| Training      | `MODULE_06_TRAINING.md`      | protocol_assignment, procedure_completion, test_attempt      |
| Communication | `MODULE_09_COMMUNICATION.md` | chat_channel, chat_message, notification                     |
| Multi-tenant  | `MODULE_13_MULTITENANT.md`   | stripe_subscription, (RLS policies)                          |

---

## Key Enums (Option Sets)

```typescript
type ProfileRole = "employee" | "manager" | "admin" | "owner";
type ProfileStatus = "trainee" | "active" | "inactive" | "offboarding";
type PolicyType =
  | "operational"
  | "haccp"
  | "hr"
  | "safety"
  | "access"
  | "payroll"
  | "custom";
type SeasonType = "default" | "calendar" | "focus" | "cycle" | "custom";
type SeasonStatus = "draft" | "active" | "archived";
type SessionStatus =
  | "upcoming"
  | "active"
  | "pending_signoff"
  | "closed"
  | "missed";
type TaskStatus =
  | "pending"
  | "available"
  | "in_progress"
  | "completed"
  | "skipped"
  | "overdue"
  | "escalated";
type HookType =
  | "pre_open"
  | "open"
  | "scheduled"
  | "pre_close"
  | "close"
  | "custom";
type InviteStatus = "pending" | "accepted" | "expired" | "cancelled";
type DayCategory =
  | "morning"
  | "midday"
  | "afternoon"
  | "evening"
  | "night"
  | "weekend";
type Industry = "restaurant" | "hotel" | "cafe" | "bar" | "catering" | "other";
```

---

## Important Domain Concepts

### Department Session

A daily operational container per department. Auto-generated from Department Schedule. Contains all tasks, notes, and handoffs for that day. Lifecycle: `upcoming → active → pending_signoff → closed | missed`.

### Session Hooks

Time-based triggers attached to department sessions. They fire Procedures and Routines as session_tasks at specific moments (pre_open, open, scheduled, pre_close, close).

### Governance = Readiness

An employee is "ready" when all assigned Protocols are completed:

- Procedures learned (steps completed)
- Knowledge Tests passed
- Confirmations signed
  Readiness score = % of assigned protocols completed.

### Trainee Mode

Sandbox. All actions are real UI but don't affect live data. Trainee sees a badge. Completes onboarding journey before first shift. 48-hour escalation if not progressing.

### Season

A defined time period that wraps all operations. Like a "campaign" in gamification. Has its own leaderboard, point rules, and team configurations. Setup battlefield → click play.

---

## What NOT To Do

- Never use JavaScript. TypeScript only.
- Never use Pages Router. App Router only.
- Never bypass RLS with service role for user-facing operations.
- Never create tables without `workspace_id` (except user, company, company_member).
- Never create tables without `created_at` and `updated_at`.
- Never hardcode Norwegian text — use i18n keys (but Norwegian is the primary language).
- Never create a UI without checking the UI Architecture doc first.
- Never skip input validation on Edge Functions.
- Never store secrets in code — use environment variables.
