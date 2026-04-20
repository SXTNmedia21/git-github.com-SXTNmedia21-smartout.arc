---
title: Full CRUD Data Control — Dashboard + Mobile
status: draft
created: 2026-04-10
updated: 2026-04-10
module: platform
tags: [architecture, mobile, dashboard, mutations, crud, council-approved]
---

# Full CRUD Data Control — Dashboard + Mobile

## Summary

Every data entity in Smartout must be creatable, readable, updatable, and deletable from **both** the dashboard (web) and the mobile app. No read-only blind spots. This includes organization structure, shifts, protocols, employees, website content/pages, and all other workspace-scoped data.

**Council verdict:** APPROVE WITH CHANGES (2026-04-10). All four agents unanimous.

## Problem Statement

Current state has massive asymmetry:

| Surface | Writes | Read-only |
|---------|--------|-----------|
| Dashboard | org structure, shifts, protocols, holidays, website content | contracts, employee creation, reports, training, salary |
| Mobile | punch, absence, hours, deviations, HACCP, handoffs, chat | profile, shifts/roster, payslips, tasks, training, team, website |

Additionally:
- **Zero shared mutation logic** — web uses server actions, mobile uses TanStack Query directly
- **Zero mobile telemetry** — 0/12 mutation hooks call `emit()`
- **No cascade classification** — mutations don't know if they trigger re-derivation
- **No centralized C4 role checks** — authorization per-surface, not in data layer

## Architecture

### Core Principle: Shared Brain, Separate Hands

```
packages/data/          ← NEW: Zod schemas, business rules, cascade classification,
│                          telemetry event defs, C4 permission checks
│
├── validators/         ← Per-entity Zod input schemas
├── permissions/        ← Role-based C4 checks (min_role per operation)
├── cascade/            ← Dimension classification + re-derivation flags
├── telemetry/          ← Event name + property shape definitions
└── index.ts            ← Public API

apps/web/               ← Server Actions consume packages/data/ validators,
│                          execute via @smartout/supabase/server, call emit()
│
apps/mobile/            ← TanStack mutations consume packages/data/ validators,
                           execute via local Supabase client, call emit()
```

**No universal mutation executor.** Web SSR auth (cookies) and mobile token auth are fundamentally different transports. Share validation + logic + event definitions, not the transport layer.

### Cascade Dimension Classification

Every entity mutation is classified:

| Classification | Meaning | Example Entities | Behavior |
|---------------|---------|-----------------|----------|
| **Leaf** | No cascade impact | chat, deviation, absence request, HACCP log | Direct write + emit |
| **Cascade-input** | Triggers re-derivation downstream | department_operating_hours, season_budget, day_factor | Must go through cascade pipeline |
| **Governance** | Requires C4 approval workflow | employment_contract, framework_rule, tariff_rate_table | Approval flow before write |
| **Content** | Website/publishing data | website_page, website_section, website_asset, website_menu | Draft → snapshot → publish pipeline |

### C4 Permission Model

Permissions enforced in `packages/data/permissions/`, consumed by both surfaces:

```
checkPermission(operation, userRole, workspaceId) → allowed | denied | needs_approval
```

| Role | Leaf | Cascade-input | Governance | Content |
|------|------|--------------|------------|---------|
| employee | own data only | ❌ | ❌ | ❌ |
| manager | team data | read-only | read-only | ❌ |
| admin | all | ✅ | propose | ✅ |
| owner | all | ✅ | ✅ | ✅ |

## Entity Inventory

### Phase 0 — Blocking Prerequisites (no new CRUD)

| Task | Why |
|------|-----|
| Add `emit()` to all 12 mobile mutation hooks | Live telemetry compliance gap |
| Wire `channel` field through AgentRouterInput → AgentToolContext | ADR-0078 PII defense broken |
| Add `min_role` column to `engine_authority_config` | Security: employee=admin via agent |
| Create `packages/data/` package scaffolding | Foundation for all phases |

### Phase 1 — Safe Entities (no cascade re-derivation)

Employee self-service + admin leaf operations. Low risk.

| Entity | Mobile CRUD | Dashboard CRUD | Classification |
|--------|------------|----------------|----------------|
| Profile (own) | ✅ edit name, phone, emergency contact, avatar | ✅ exists | Leaf |
| Team membership | ✅ view, request join/leave | ✅ full CRUD exists | Leaf |
| Absence requests | ✅ exists | ✅ add (new) | Leaf |
| Shift swap requests | ✅ request, approve/reject | ✅ add (new) | Leaf |
| Availability preferences | ✅ set weekly availability | ✅ add (new) | Leaf |
| Protocol completion | ✅ exists (training) | ✅ exists | Leaf |
| Policy acknowledgment | ✅ read + sign | ✅ exists | Leaf |
| Notifications preferences | ✅ manage | ✅ add (new) | Leaf |
| Website pages | ❌ → ✅ create, edit, reorder | ✅ exists | Content |
| Website sections | ❌ → ✅ create, edit, delete | ✅ exists | Content |
| Website assets | ❌ → ✅ upload, manage | ✅ exists | Content |
| Website menu items | ❌ → ✅ create, edit, delete, price | ✅ exists | Content |
| Website publishing | ❌ → ✅ publish, unpublish, rollback | ✅ exists | Content |

### Phase 2 — Cascade-Adjacent (triggers re-derivation)

Admin operations that affect downstream cascade calculations.

| Entity | Mobile CRUD | Dashboard CRUD | Classification |
|--------|------------|----------------|----------------|
| Shifts / schedule | ❌ → ✅ create, edit, assign | ✅ exists | Cascade-input (D6) |
| Department | ❌ → ✅ create, edit | ✅ exists | Cascade-input (D1) |
| Department operating hours | ❌ → ✅ edit | ✅ exists | Cascade-input (D1) |
| Location | ❌ → ✅ create, edit | ✅ exists | Cascade-input (D1) |
| Position | ❌ → ✅ create, edit | ✅ exists | Leaf |
| Zone / Asset | ❌ → ✅ create, edit | ✅ exists | Leaf |
| Season budget | ❌ → ✅ view, edit factors | ✅ exists | Cascade-input (D4) |
| Holiday calendar | ❌ → ✅ create, edit entries | ✅ exists | Cascade-input (D3) |
| Employee invitations | ❌ → ✅ invite via email/SMS | ✅ exists | Leaf |
| Employee role/status | ❌ → ✅ change role, deactivate | ✅ exists | Governance |

### Phase 3 — High-Governance (C4 gated)

Desktop-primary. Mobile read + propose only.

| Entity | Mobile | Dashboard | Classification |
|--------|--------|-----------|----------------|
| Employment contracts | Read + sign | ✅ compose wizard | Governance |
| Regulatory framework | Read-only | ✅ configure | Governance |
| Tariff rate tables | Read-only | ✅ manage | Governance |
| Protocols (create/edit) | Propose draft | ✅ full CRUD | Governance |
| Payroll settings | Read-only | ✅ configure | Governance |

## Mobile UX Approach

### Role-Based Progressive Disclosure

No separate admin mode. Same app, adaptive sections:

- **Employee** sees: My shifts, my team, my training, my payroll, punch clock
- **Manager** sees: + Team management, shift approvals, deviation overview
- **Admin** sees: + Full org structure, scheduling, protocols, website, employee management
- **Owner** sees: + Contracts, regulatory, payroll config, billing

Sections expand/collapse based on `profile.role`. No empty tabs.

### Form Patterns

| Dashboard pattern | Mobile equivalent |
|-------------------|-------------------|
| Dialog (1-4 fields) | Bottom sheet with form |
| Sheet (5-8 fields) | Full-screen stacked form |
| Multi-step wizard | 2-3 step mobile wizard with swipe |
| Entity drawer | Full-screen detail view with edit button |
| Data table + bulk actions | List view + swipe actions + select mode |

### Website Content on Mobile

Admin manages website content from phone:

- **Pages list** → reorder, create new, edit metadata
- **Section editor** → simplified WYSIWYG, drag to reorder, edit text/images
- **Menu editor** → add/edit items with price, allergens, dietary tags
- **Asset manager** → camera upload, gallery picker
- **Publish** → preview → publish/unpublish with confirmation
- **Draft history** → view revisions, rollback

Content forms use the Content classification — draft → snapshot → publish pipeline. Offline edits queue as draft revisions.

### Botsson as CRUD Accelerator

Voice/chat agent pre-fills forms on mobile:

- "Legg til nytt skift for bar, lørdag 18-02, trenger 3 ansatte" → pre-filled shift form
- "Opprett ny side for sommermenyen" → pre-filled page with menu section
- "Endre åpningstidene til 10-22 fra mandag" → pre-filled operating hours edit

Agent suggests, user confirms. Agent is assistant, not primary mutation path.

## Shared Package: `packages/data/`

### Validator Example

```typescript
// packages/data/src/validators/department.ts
import { z } from 'zod'

export const createDepartmentInput = z.object({
  name: z.string().min(1).max(100),
  location_id: z.string().uuid(),
  workspace_id: z.string().uuid(),
})

export const updateDepartmentInput = createDepartmentInput.partial().extend({
  id: z.string().uuid(),
})

export type CreateDepartmentInput = z.infer<typeof createDepartmentInput>
```

### Permission Check Example

```typescript
// packages/data/src/permissions/check.ts
export function checkPermission(
  operation: CrudOperation,
  entity: EntityType,
  userRole: ProfileRole,
  ownership: 'own' | 'team' | 'workspace'
): 'allowed' | 'denied' | 'needs_approval' {
  const classification = getEntityClassification(entity)
  // ... role × classification matrix lookup
}
```

### Cascade Classification Example

```typescript
// packages/data/src/cascade/classify.ts
export const entityClassification = {
  // Leaf — safe for direct write
  chat_message: { dimension: null, cascadeInput: false },
  deviation: { dimension: 'D6', cascadeInput: false },
  absence_request: { dimension: 'D2', cascadeInput: false },

  // Cascade-input — triggers re-derivation
  department: { dimension: 'D1', cascadeInput: true },
  department_operating_hours: { dimension: 'D1', cascadeInput: true },
  season_budget: { dimension: 'D4', cascadeInput: true },

  // Governance — requires approval
  employment_contract: { dimension: 'D2', cascadeInput: false, governance: true },
  framework_rule: { dimension: 'D3', cascadeInput: false, governance: true },

  // Content — draft/publish pipeline
  website_page: { dimension: null, cascadeInput: false, content: true },
  website_section: { dimension: null, cascadeInput: false, content: true },
} as const
```

## Telemetry Contract

Every mutation in both surfaces must:

1. Call shared validator from `packages/data/`
2. Check permissions via `packages/data/permissions/`
3. Execute write via surface-specific transport
4. Call `emit()` with event name from `packages/data/telemetry/`

Mobile `emit()` strategy: verify `emit.client.ts` works in React Native. If not, route through Edge Function that calls server-side `emit()`.

## ADRs to Write

| ADR | Topic |
|-----|-------|
| ADR-0080 | Shared Data Mutation Architecture (packages/data/, cascade classification, C4 at data layer) |
| ADR-0081 | Mobile Role-Based Progressive Disclosure (adaptive sections, no separate admin mode) |

## Success Criteria

1. Every entity listed in Phase 1-3 has CRUD from both surfaces
2. All mutations call `emit()` on both surfaces
3. All mutations validate via shared `packages/data/` schemas
4. All mutations check C4 permissions via shared permission layer
5. Cascade-input mutations trigger re-derivation pipeline
6. Content mutations follow draft → snapshot → publish pipeline
7. Mobile forms follow stacked full-screen pattern (not bottom sheets for complex forms)
8. Website content fully manageable from mobile (pages, sections, menus, assets, publishing)

## Out of Scope

- Offline conflict resolution strategy (separate design needed)
- Botsson CRUD capability implementation (separate from UI CRUD)
- Dashboard employee self-service views (dashboard already has admin views)
- Mobile payment/billing management
