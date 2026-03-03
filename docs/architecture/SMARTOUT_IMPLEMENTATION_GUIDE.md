---
title: "Implementation Guide"
id: IMPL_GUIDE
version: "1.0"
status: canonical
layer: architecture
created: 2026-02-24
updated: 2026-02-28
author: pontus
supersedes: []
superseded_by: null
depends_on:
  - CORE_ARCH_V2
  - FOUND_ARCH
tags:
  - implementation
  - build-order
  - migration
  - phases
tables: []
changelog:
  - date: 2026-02-28
    change: "Added YAML frontmatter"
---

# Smartout — Implementation Guide

> **Smartout.ai** — Implementation documentation
> Version 1.0 | February 2026
> **Source:** SMARTOUT_COMPLETE_DOCUMENTATION.md, Sections 31-35
> **See also:** BUILD_ORDER.md (detailed task-level breakdown), archive/SMARTOUT_REBUILD_STRATEGY.md (archived), CLAUDE.md

---

## 1. Build Order & Migration Strategy (Section 31)

### Phase 0: Foundation (Week 1–2)

Monorepo, Supabase, Core SQL (identity + structure + governance), RLS, shared types, Next.js scaffold, seed data.

### Phase 1: Onboarding (Week 3–4)

Company/workspace creation, invitation system, profile setup, trainee mode.

### Phase 2: Org Structure (Week 5–6)

Department, Location, Zone, Asset, Position, Team management.

### Phase 3: Scheduling (Week 7–9)

Shift templates, calendar, availability, swap, open shifts, punch clock, overtime.

### Phase 4: Operations (Week 10–13)

Department Session, hooks, tasks, ad-hoc, recurring, inheritance, notes, handoff, sign-off.

### Phases 5–11: Remaining Modules

Same pattern: read doc → migrations → types → Edge Functions → UI → tests.

### Migration Strategy

Gradual from Bubble — module-by-module cutover. Not big-bang.

---

## 2. Code Conventions (Section 32)

### TypeScript

- Strict mode. `type` over `interface`. Union types over enums. No `any`.

### File Naming

| Type           | Convention                | Example                    |
| -------------- | ------------------------- | -------------------------- |
| Components     | PascalCase.tsx            | `DepartmentCard.tsx`       |
| Hooks          | camelCase use prefix      | `useDepartmentSessions.ts` |
| Utils          | camelCase.ts              | `formatCurrency.ts`        |
| Pages          | page.tsx in route folders | `app/dashboard/page.tsx`   |
| Migrations     | NNNNN_description.sql     | `00001_core_tables.sql`    |
| Edge Functions | kebab-case/index.ts       | `create-invite/index.ts`   |

### Database

- snake_case tables (singular), snake_case columns
- PK: `{table}_id`, FK: `{referenced_table}_id`
- `created_at`, `updated_at` on every table
- `is_` prefix for booleans
- UUIDs for all PKs

### Supabase

- RLS on EVERY table. `auth.uid()` in policies. Zod validation on Edge Functions.

### React / Next.js

- App Router only. Server Components default. TanStack Query for client data.

---

## 3. Monorepo Structure (Section 33)

```
smartout/
├── apps/
│   ├── web/          (Next.js dashboard)
│   └── mobile/       (React Native + Expo)
├── packages/
│   ├── types/        (Shared TypeScript types + Zod schemas)
│   ├── supabase/     (Client helpers, middleware, generated types)
│   └── ui/           (Shared components — if needed)
├── supabase/
│   ├── migrations/   (SQL migration files)
│   ├── functions/    (Edge Functions)
│   └── seed.sql      (Development seed data)
└── docs/             (Module documentation)
```

---

## 4. Seed Data (Section 35)

Development seed includes: 1 company, 2 workspaces, 3 users (owner/manager/employee), 3 departments, 2 locations, 2 zones, 3 assets, 3 positions, 2 teams, 1 default season per workspace, sample policies and protocols.

---

## 5. Appendix: API Endpoints

Key Edge Functions:

- `create-invite`, `accept-invite`, `stripe-webhook`, `run-payroll`
- `generate-day-brief`, `process-handoff`, `check-readiness`

n8n workflows: session generation, notification delivery, AI context refresh, certification expiry, billing sync.

## 6. Appendix: User Flows

See SMARTOUT_COMPLETE_DOCUMENTATION.md Appendix D for:

- D.1 Workspace Creation
- D.2 Employee Invitation & Acceptance
- D.3 Daily Operations Flow

## 7. Appendix: Data Migration (Bubble → Custom)

Module-by-module: Map → Transform → Migrate → Validate → Cutover → Decommission.
Order: Users → Workspaces → Org Structure → Governance → Scheduling → Operations → Training → Rest.

---

_For detailed task-level build order see BUILD_ORDER.md._
_For layered context architecture see archive/SMARTOUT_REBUILD_STRATEGY.md (archived)._
_For AI coding agent instructions see CLAUDE.md._
