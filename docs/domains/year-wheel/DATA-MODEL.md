---
title: "Year Wheel — Data Model"
status: in_progress
mirror: verified
last_verified: 2026-05-23
updated: 2026-05-23
created: 2026-05-23
domain: year-wheel
tags: [domain, year-wheel, season, data-model, schema, tables, D4, D5]
---

# Year Wheel — Data Model

> Verified against migrations. Code wins. Every table cited with migration:line ±hint.

## Tables

### `public.season`

Migration: `supabase/migrations/00002_structure_tables.sql:8`

Primary record for a season — D4/D5 authoring unit. Carries dates, status, type, and canvas presentation (color, icon).

| Column | Type | Notes |
|---|---|---|
| `season_id` | UUID PK | `gen_random_uuid()` |
| `workspace_id` | UUID FK → `workspace` | Required. RLS anchor. |
| `parent_season_id` | UUID FK → `season` | Self-referential — for season duplication lineage |
| `name` | TEXT | Display name |
| `slug` | TEXT | URL slug |
| `description` | TEXT | Playbook notes (appended by `season.save_playbook` tool) |
| `season_type` | ENUM `season_type` | e.g. `default`, `summer`, `christmas` (platform enum) |
| `start_date` | DATE | Nullable — draft seasons may lack dates |
| `end_date` | DATE | Nullable |
| `status` | ENUM `season_status` | `draft` → `active` → `archived` (ADR-0085) |
| `is_default` | BOOLEAN | Canvas fallback season when no seasonal block covers a date |
| `color` | TEXT | Hex or CSS var for timeline block |
| `icon` | TEXT | Icon key |
| `planning_cycle_id` | UUID FK → `planning_cycle` | Added by `20260421100350_cascade_a1_alter_existing.sql:23`. Links season to D1 year-wheel container. |
| `opening_hours` | JSONB | Added by `20260416200000_season_opening_hours.sql:6`. Per-department opening hours per weekday. Structure: `{ "Kitchen": { "mon": "09:00-22:00", ... } }` |
| `created_by` | UUID FK → `profile` | Creator |
| `created_at` | TIMESTAMPTZ | Auto |
| `updated_at` | TIMESTAMPTZ | Auto (trigger `set_season_updated_at`) |

Unique constraint: `20260518210000_season_active_workspace_partial_unique.sql` — partial unique on `(workspace_id) WHERE status='active'` — exactly one active season per workspace.

### `public.season_budget`

Migration: `supabase/migrations/20260306100000_season_planning_tables.sql:23`

D4 revenue envelope — 1:1 with season.

| Column | Type | Notes |
|---|---|---|
| `season_budget_id` | UUID PK | |
| `season_id` | UUID FK → `season` CASCADE | |
| `workspace_id` | UUID FK → `workspace` CASCADE | |
| `total_target_revenue` | DECIMAL | Gate for activation (must be > 0) |
| `base_price_per_guest` | DECIMAL | |
| `season_price_factor` | DECIMAL | Default 1.0 |
| `target_labor_percentage` | DECIMAL | Default 0.30 |
| `avg_hourly_wage` | DECIMAL | |
| `status` | ENUM `budget_status` | `draft` / `active` / `locked` |
| `created_at` + `updated_at` | TIMESTAMPTZ | Auto |

### `public.day_factor`

Migration: `supabase/migrations/20260306100000_season_planning_tables.sql:83`

D4 day-of-week demand weights. Per season_budget.

| Column | Type | Notes |
|---|---|---|
| `day_factor_id` | UUID PK | |
| `season_budget_id` | UUID FK → `season_budget` CASCADE | |
| `workspace_id` | UUID FK → `workspace` CASCADE | |
| `weekday` | INT | 0=Monday … 6=Sunday |
| `factor` | DECIMAL | Demand weight (e.g., 1.0 = baseline, 1.8 = busy Saturday) |
| `created_at` + `updated_at` | TIMESTAMPTZ | |

Gate for activation: at least 1 row must exist (checked in `activateSeasonAction`).

### `public.hour_factor`

Migration: `supabase/migrations/20260306100000_season_planning_tables.sql:128`

D4 hourly demand weights. Per season_budget.

| Column | Type | Notes |
|---|---|---|
| `hour_factor_id` | UUID PK | |
| `season_budget_id` | UUID FK → `season_budget` CASCADE | |
| `workspace_id` | UUID FK → `workspace` CASCADE | |
| `hour` | INT | 0–23 |
| `factor` | DECIMAL | Demand weight |
| `created_at` + `updated_at` | TIMESTAMPTZ | |

Gate for activation: at least 1 row must exist.

### `public.season_goal`

Migration: `supabase/migrations/20260502130000_season_goal_table.sql:14`

D5 KPI targets per season.

| Column | Type | Notes |
|---|---|---|
| `season_goal_id` | UUID PK | |
| `workspace_id` | UUID FK → `workspace` CASCADE | |
| `season_id` | UUID FK → `season` CASCADE | |
| `title` | TEXT | Goal label |
| `description` | TEXT | |
| `metric_key` | TEXT | Optional — e.g. `nps`, `labor_pct` |
| `target_value` | DECIMAL | Optional numeric target |
| `target_unit` | TEXT | Optional — e.g. `%`, `NOK` |
| `status` | ENUM `season_goal_status` | `active` / `completed` / `cancelled` |
| `created_at` + `updated_at` | TIMESTAMPTZ | |

Note: `SeasonGoalsTab.tsx` is in `_deferred/` — goals UI is not in the active routing path (see GAPS §Gap G1).

### `public.season_policy_binding`

Migration: `supabase/migrations/20260502130001_season_policy_binding_table.sql:11`

D5 per-season HMS policy activation. Allows managers to activate workspace policies for a specific season without modifying the global `policy.is_active` flag.

| Column | Type | Notes |
|---|---|---|
| `season_policy_binding_id` | UUID PK | |
| `workspace_id` | UUID FK → `workspace` CASCADE | |
| `season_id` | UUID FK → `season` CASCADE | |
| `policy_id` | UUID FK → `policy` CASCADE | Owned by procedure-engine; binding record owned here |
| `is_active` | BOOLEAN | Default true |
| `notes` | TEXT | |
| `activated_by` | UUID FK → `profile` | |
| `created_at` + `updated_at` | TIMESTAMPTZ | |

Unique: `UNIQUE(season_id, policy_id)` — one binding per season per policy.

Note: `SeasonProceduresTab.tsx` is in `_deferred/` — procedures UI is not in the active routing path (see GAPS §Gap G2).

---

## RPCs

### `activate_season(p_workspace_id UUID, p_season_id UUID) → JSONB`

Migrations:
- Initial definition: `supabase/migrations/20260518010002_activate_season_rpc.sql:34`
- Pre/post count amendment: `supabase/migrations/20260518040001_activate_season_rpc_pre_post_count.sql:46`
- Return archived_id amendment: `supabase/migrations/20260518210001_activate_season_rpc_return_archived_id.sql:50`

Final signature: `CREATE OR REPLACE FUNCTION activate_season(p_workspace_id UUID, p_season_id UUID) RETURNS JSONB`

Returns:
- `{ ok: true, season_id, departments_affected, rows_generated }` — success
- `{ ok: true, skipped: true, reason: 'already_active' }` — noop
- `{ ok: false, error: 'unauthenticated' }` — no auth.uid()
- `RAISE EXCEPTION 'season_not_found'` — bad IDs

Invariants (ADR-0200): I11 — auth.uid() resolved before any data access. I12 — no automated backfill block.

---

## RLS

All tables have `workspace_id` and are workspace-scoped. RLS policies enforce:
- SELECT: `workspace_id = get_workspace_ids_for_user()` (authenticated users see their workspace)
- INSERT/UPDATE/DELETE: workspace ownership + role check (manager+ for mutations)
- `activate_season` is SECURITY DEFINER — RLS enforced inside function via auth.uid() validation

---

## Enums

| Enum | Values | Where used |
|---|---|---|
| `season_status` | `draft`, `active`, `archived` | `season.status` |
| `season_type` | `default`, `summer`, `christmas`, … (platform-defined) | `season.season_type` |
| `budget_status` | `draft`, `active`, `locked` | `season_budget.status` |
| `season_goal_status` | `active`, `completed`, `cancelled` | `season_goal.status` |

---

## Authority seeds (C4 gates)

Three authority rows seeded per workspace in `public.engine_authority_config`:

| Migration | Key | What it gates |
|---|---|---|
| `20260518010000_season_activate_authority_seed.sql` | `season.activate` | Server Action path — `activateSeasonAction` |
| `20260518020000_season_agent_capability_authority_seed.sql` | `season.*` (5 tools) | Agent capability tools (create/set_revenue/save_playbook/get_readiness/learn_factors) |
| `20260518030000_season_archive_duplicate_authority_seed.sql` | `season.archive`, `season.duplicate` | Archive + duplicate server actions |

---

## Mission seed

| Migration | What |
|---|---|
| `20260319120400_seed_season_lifecycle_mission.sql` | Seeds season lifecycle mission for onboarding sequence |

---

## Cascade task hrefs

Migration: `supabase/migrations/20260420120000_cascade_task_hrefs_season_route.sql`

`resolve_cascade_tasks(uuid)` RPC updated to point D4 budget-gap hrefs to `/dashboard/season/<active-season-id>?tab=<key>` instead of `/dashboard/year-wheel`. Tabs: `budget`, `day`, `hour`.

---

## Telemetry

Namespace: `season` (ADR-0164, `packages/ai/src/capabilities/season/index.ts:79`)

25 events registered in `packages/telemetry/src/registry.ts` (lines 1710–1954):

| Event | Line | Category |
|---|---|---|
| `season created` | 1710 | mutation |
| `season activated` | 1738 | lifecycle |
| `season operating_hours_generated` | 1758 | D1 fanout |
| `season activation_failed` | 1782 | error |
| `season activation_preview` | 1792 | preview |
| `season archived` | 1804 | lifecycle |
| `season updated` | 1812 | mutation |
| `season operating_hours_copied` | 1824 | operating hours |
| `season operating_hours_updated` | 1832 | operating hours |
| `season operating_hours_removed` | 1840 | operating hours |
| `season block_clicked` | 1895 | UX |
| `season pin_clicked` | 1903 | UX |
| `season year_navigated` | 1911 | UX |
| `season draw_started` | 1924 | UX |
| `season draw_completed` | 1931 | UX |
| `season draw_cancelled` | 1938 | UX |
| `season sidebar_filter_changed` | 1945 | UX |
| `season year_wheel_viewed` | 1952 | UX |
| + 7 additional events | 1954+ | various |

Note: ADR-0201 §Forward-looking reservation — telemetry wiring was scoped to M4 of the year-wheel campaign. Verify which events have active `emit()` call-sites before trusting registry completeness.
