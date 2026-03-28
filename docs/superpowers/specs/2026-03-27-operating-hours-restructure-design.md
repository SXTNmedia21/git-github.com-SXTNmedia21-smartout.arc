---
title: Operating Hours Restructure — Workspace Base + Department Offset
status: review
updated: 2026-03-27
created: 2026-03-27
module: cascade
tags: [D1, operating-hours, settings, organization, cascade-tasks]
---

# Operating Hours Restructure — Workspace Base + Department Offset

## Problem

The Settings page writes directly to `department_operating_hours` per department, bypassing `workspace_operating_hours` entirely. This breaks the two-layer cascade model that already exists in the codebase (`bootstrap-cascade`, `apply-change-proposal`). The result:

1. `workspace_operating_hours` is empty and unused despite full schema + RLS
2. `department_operating_hours` offset columns (`open_offset_minutes`, `close_offset_minutes`, `is_derived`) are never used
3. The cascade task RPC shows false "missing hours" tasks because it only checks `department_operating_hours`
4. Users see default values (08:00-22:00) and think hours are saved when they aren't

## Decision: Direct Write with ADR Justification

The change proposal pipeline (`apply-change-proposal/applyWorkspaceHoursChange()`) exists but is designed for governance-level changes with approval flows. Admin settings (base opening hours) are operational configuration, not governance proposals. We use **direct writes** to `workspace_operating_hours` from the Settings UI.

**Justification:** Opening hours are a D1 source input (operational envelope), not a C4 governance artifact. The change proposal pipeline is for mutations requiring approval (contract changes, schedule changes). Base hours are an admin-only setting with no approval gate.

**Trade-off:** No automatic re-derivation of `is_derived: true` department rows on workspace base change. This is acceptable because Alt B (fallback, no propagation) means departments inherit implicitly — no department rows need updating.

## Three-Layer Hours Model

```
company_opening_hours (wizard/join intake — KEEP, out of scope)
  → bootstrap-cascade copies to →
workspace_operating_hours (runtime base — Settings page)
  → department inherits OR overrides via →
department_operating_hours (department offset — Department detail page)
  → date-specific override via →
department_hours_override (session-level — unaffected)
```

### Resolution Order (for any consumer)

1. `department_operating_hours` rows for this department? → use them (absolute times, offset is metadata)
2. No department rows? → `workspace_operating_hours` rows? → use them
3. Neither? → defaults (08:00-22:00, all open)

### `is_derived` Semantics

| State               | Meaning                                                      |
| ------------------- | ------------------------------------------------------------ |
| No department rows  | Inherits workspace base implicitly                           |
| `is_derived: true`  | Created by bootstrap/propagation, offset from workspace base |
| `is_derived: false` | Admin explicitly set via department detail page              |

Existing `department_operating_hours` rows (created by current Settings UI with `is_derived: false` and zero offsets) are preserved as explicit overrides. No migration needed.

## Changes

### 1. Settings Page → Workspace Base Hours

**File:** `apps/web/src/app/dashboard/settings/_components/opening-hours-settings.tsx`

- Remove department selector dropdown
- Write to `workspace_operating_hours` (not `department_operating_hours`)
- New hook: `useWorkspaceOperatingHours()` — reads/writes `workspace_operating_hours`
- Keep warning banner for unsaved state
- Emit `"workspace_operating_hours updated"` telemetry
- Invalidate cascade tasks query key after save
- Label: "Workspace base-åpningstider" (i18n key)

### 2. Department Detail Page → Offset Tab

**File:** `apps/web/src/app/dashboard/organization/departments/[id]/page.tsx`

- Add new "Åpningstider" tab (6th tab, after "Settings")
- Shows workspace base hours as read-only reference (from `workspace_operating_hours`)
- Per-day offset controls: open offset (minutes), close offset (minutes)
- Computed result: "Base 10:00-22:00 → Kitchen: 10:00-21:00 (stenger 1t tidliger)"
- Save writes to `department_operating_hours` with:
  - `is_derived: false`
  - `open_offset_minutes` / `close_offset_minutes` stored
  - `open_time` / `close_time` = computed absolute values (workspace base + offset)
- Emit `"department_operating_hours updated"` telemetry
- Invalidate cascade tasks query key after save

### 3. Hook Fallback Chain

**File:** `apps/web/src/app/dashboard/settings/_hooks/use-operating-hours.ts`

The existing `useOperatingHours(departmentId)` hook must implement the resolution order:

1. Query `department_operating_hours` for this department
2. If `persistedCount === 0`, fall back to `baseHoursQuery` data (already fetched from `workspace_operating_hours`)
3. If workspace also empty, fall back to `DEFAULT_ENTRY` (08:00-22:00)

The `hours` return value must reflect this chain. Consumers (`HourFactorsTab`, `SeasonOverviewTab`) get correct data without changes.

**New return field:** `source: "department" | "workspace" | "default"` — tells the UI which layer provided the data.

### 4. Cascade Task RPC Update

**File:** `supabase/migrations/20260426100000_resolve_cascade_tasks_rpc.sql`

#### 4a. Update `dept_with_hours` CTE

```sql
dept_with_hours AS (
  SELECT DISTINCT d.department_id
  FROM dept_all d
  WHERE EXISTS (
    SELECT 1 FROM department_operating_hours doh
    WHERE doh.department_id = d.department_id
  )
  OR EXISTS (
    SELECT 1 FROM workspace_operating_hours woh
    WHERE woh.workspace_id = p_workspace_id
  )
),
```

A department "has hours" if it has own rows OR the workspace has base hours.

#### 4b. Add workspace-level task

New task in the RPC: `workspace.missing_base_hours`

```sql
workspace_hours_check AS (
  SELECT count(*) AS cnt
  FROM workspace_operating_hours
  WHERE workspace_id = p_workspace_id
),
workspace_hours_task AS (
  SELECT jsonb_build_object(
    'id', 'workspace.missing_base_hours',
    'group', 'departments',
    'dimension', 'D1',
    'title_key', 'dashboard.todo.workspace_missing_hours',
    'description_key', 'dashboard.todo.desc.workspace_missing_hours',
    'urgency', 'critical',
    'href', '/dashboard/settings'
  ) AS task
  WHERE (SELECT cnt FROM workspace_hours_check) = 0
),
```

This replaces per-department "missing hours" tasks. Departments with workspace base hours are considered configured.

#### 4c. Update dept_summary done/total

`done` count: departments that have either own rows or inherit workspace base.
`total`: all active departments.

### 5. Schedule Hook Fallback

**File:** `apps/web/src/app/dashboard/schedule/_hooks/use-planned-hours.ts`

Must implement same fallback: department hours → workspace hours → defaults. Prevents schedule view from breaking for departments relying on inherited hours.

### 6. Telemetry

Register two events in `packages/telemetry/src/registry.ts`:

- `"workspace_operating_hours updated"` — workspace base hours saved
- `"department_operating_hours updated"` — department offset saved

Both route to: PostHog, activity_trail, Logger.

### 7. i18n Keys

Add to `packages/i18n/locales/{nb,en}/dashboard.json`:

**Norwegian (nb):**

```json
{
  "settings": {
    "workspace_hours_title": "Base-åpningstider",
    "workspace_hours_description": "Standard åpningstider for hele virksomheten. Avdelinger arver disse med mindre de har egne justeringer.",
    "hours_not_saved": "Åpningstider ikke lagret",
    "hours_not_saved_desc": "Tidene under er standardverdier. Klikk Lagre for å aktivere.",
    "day_closed": "Stengt",
    "day_open": "Åpen"
  },
  "department_hours": {
    "tab_label": "Åpningstider",
    "offset_title": "Avdelingsjustering",
    "offset_description": "Juster åpningstider relativt til virksomhetens base-tid.",
    "opens_offset": "Åpner",
    "closes_offset": "Stenger",
    "minutes_earlier": "min tidliger",
    "minutes_later": "min seinare",
    "result_label": "Resultat",
    "inherits_workspace": "Arver virksomhetens åpningstider"
  },
  "todo": {
    "workspace_missing_hours": "Virksomheten mangler base-åpningstider",
    "workspace_missing_hours_desc": "Sett opp åpningstider i innstillinger. Alle avdelinger arver disse som standard."
  }
}
```

## Out of Scope

| Item                                  | Why                                                                         |
| ------------------------------------- | --------------------------------------------------------------------------- |
| `company_opening_hours` (4 consumers) | Wizard intake surface, per CLAUDE.md "keep"                                 |
| SeasonSetupStep direct writes         | Cleanup ticket — document as known bypass                                   |
| Season-scoped workspace hours         | `workspace_operating_hours` has no `season_id`. Future extension if needed. |
| Season tab refactoring                | Pre-existing tech debt, separate PR                                         |
| Change proposal pipeline integration  | Direct write justified (operational config, not governance)                 |
| `department_hours_override` table     | Session-level overrides, unaffected                                         |

## Cleanup Tickets (post-merge)

1. **SeasonSetupStep:** Currently writes directly to `department_operating_hours`. Should write to `workspace_operating_hours` or be documented as intake-only bypass.
2. **i18n debt:** Hardcoded Norwegian/English strings in `opening-hours-settings.tsx`, `HourFactorsTab.tsx`, `SeasonOverviewTab.tsx`.

## Files Changed

| File                                                                          | Change                                         |
| ----------------------------------------------------------------------------- | ---------------------------------------------- |
| `apps/web/src/app/dashboard/settings/_components/opening-hours-settings.tsx`  | Rewrite: workspace hours, remove dept selector |
| `apps/web/src/app/dashboard/settings/_hooks/use-operating-hours.ts`           | Add fallback chain + `source` field            |
| `apps/web/src/app/dashboard/settings/_hooks/use-workspace-operating-hours.ts` | NEW: workspace hours hook                      |
| `apps/web/src/app/dashboard/organization/departments/[id]/page.tsx`           | Add "Åpningstider" tab with offset UI          |
| `supabase/migrations/20260426100000_resolve_cascade_tasks_rpc.sql`            | Workspace fallback + workspace-level task      |
| `apps/web/src/app/dashboard/schedule/_hooks/use-planned-hours.ts`             | Add workspace fallback                         |
| `packages/telemetry/src/registry.ts`                                          | Register 2 events                              |
| `packages/i18n/locales/nb/dashboard.json`                                     | Add i18n keys                                  |
| `packages/i18n/locales/en/dashboard.json`                                     | Add i18n keys                                  |

## Council Review

Reviewed 2026-03-27. Agents: System Steward, Supervisor, Agent Coordinator.
Verdict: PASS WITH CONDITIONS (all conditions addressed in this spec).
