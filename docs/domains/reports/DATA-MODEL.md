---
title: "Reports — Data Model"
status: in_progress
mirror: verified
last_verified: 2026-05-23
updated: 2026-05-23
created: 2026-05-23
domain: reports
tags: [domain, reports, data-model, schema]
---

# Reports — Data Model

> Actual schema. **Code wins** — verified against migration `supabase/migrations/20260301150000_create_custom_report.sql`.

## Tables

| Table | Schema | workspace-scoped | Key columns | Migration |
|---|---|---|---|---|
| `custom_report` | `public` | yes (`workspace_id NOT NULL`) | see below | `20260301150000_create_custom_report.sql` |

### `custom_report` — exact schema (10 columns)

Verified against `supabase/migrations/20260301150000_create_custom_report.sql:11-22`.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `report_id` | `UUID` | NOT NULL | `gen_random_uuid()` | Primary key |
| `workspace_id` | `UUID` | NOT NULL | — | FK → `workspace(workspace_id)` |
| `name` | `TEXT` | NOT NULL | — | Short, descriptive report name |
| `description` | `TEXT` | NULL | — | Optional extended description |
| `config` | `JSONB` | NOT NULL | — | `ReportConfig` object: data_source, metrics, group_by, filters, visualization, sort_by |
| `created_by` | `UUID` | NOT NULL | — | FK → `profile(profile_id)` |
| `updated_by` | `UUID` | NULL | — | FK → `profile(profile_id)` |
| `is_pinned` | `BOOLEAN` | NOT NULL | `false` | Pin flag for "Mine rapporter" grid |
| `created_at` | `TIMESTAMPTZ` | NOT NULL | `now()` | Creation timestamp |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL | `now()` | Auto-updated by trigger `set_updated_at` |

Column count: **10** (confirmed by reading the migration CREATE TABLE statement).

### `config` JSONB shape (TypeScript type at `packages/ai/src/tools/report/types.ts:63`)

```typescript
type ReportConfig = {
  data_source: "profiles" | "departments" | "teams" | "locations" | "protocols" | "protocol_assignments";
  metrics: Array<{
    field: string;
    aggregation: "count" | "count_distinct" | "percentage" | "avg" | "sum" | "min" | "max";
    label: string;
  }>;
  group_by?: { field: string; label: string };
  filters?: Array<{
    field: string;
    operator: "eq" | "neq" | "in" | "is_null" | "is_not_null";
    value: unknown;
  }>;
  visualization: "table" | "bar_chart" | "pie_chart" | "kpi_cards";
  sort_by?: { field: string; direction: "asc" | "desc" };
};
```

## Enums

No custom enums defined by this domain. The `visualization` and `aggregation` values above are Zod enum schemas in TypeScript, not PostgreSQL enums.

## FK map

```
custom_report.workspace_id → workspace.workspace_id
custom_report.created_by   → profile.profile_id
custom_report.updated_by   → profile.profile_id (nullable)
```

## RLS posture

RLS enabled: `ALTER TABLE custom_report ENABLE ROW LEVEL SECURITY` at migration line `25`.

**4 policies** (all use `get_workspace_ids_for_user(auth.uid())`):

| Policy name | Operation | Condition | Migration line |
|---|---|---|---|
| `workspace_member_read` | SELECT | `workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))` | line `28-30` |
| `workspace_member_insert` | INSERT | `workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))` | line `33-35` |
| `workspace_member_update` | UPDATE | `workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))` | line `38-40` |
| `workspace_member_delete` | DELETE | `workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))` | line `43-45` |

**Important:** JWT auth only — no API-key policy. This is documented in the migration comment at line `24`: "RLS: workspace-scoped (JWT auth only — internal dashboard feature)". The `custom_report` table is NOT accessible via the workspace-api gateway Edge Function.

**Auto-update trigger:** `set_updated_at` trigger on `BEFORE UPDATE` via `public.set_updated_at()` function (migration lines `48-51`).

## Read-side tables (reports domain reads, does NOT own)

The 4 data hooks read from D1/D2/D6 tables owned by other domains:

| Table | Owning domain | Used by hook |
|---|---|---|
| `profile` | core-structure (D2) | `use-report-overview`, `use-report-people` |
| `department` | core-structure (D1) | `use-report-overview` |
| `schedule_shift` | scheduling (D6) | `use-report-overview`, `use-report-staffing` |
| `protocol_assignment` | training (governance) | `use-report-overview`, `use-report-training` |
| `department_session` | day-session (D6) | `use-report-staffing` |

Reports domain only SELECTs from these tables. RLS on each enforces workspace scoping — the reports hooks use the Supabase browser client (JWT auth) and have no special permissions.

## Telemetry events

**Zero `reports.*` events registered in `packages/telemetry/src/registry.ts`.**

Confirmed by: `grep -n "reports\." packages/telemetry/src/registry.ts` → no output.

The `save_report` and `delete_report` tools use `gatedMutation()` which logs to `activity_trail` and `engine_event` internally, but there are NO domain-specific `reports.*` telemetry events registered in the registry. This is a gap — see GAPS-AND-DEBT.md §G2.

## Views / RPCs

No domain-specific views or RPCs. Reports reads directly via the Supabase client JS SDK with client-side aggregation (see `packages/ai/src/tools/report/preview-report.ts` — `computeMetrics()` at line `119`).
