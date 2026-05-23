---
title: "Bootstrap Domain — Data Model"
status: in_progress
updated: 2026-05-23
created: 2026-05-23
domain: bootstrap
last_verified: 2026-05-23
mirror: verified
tags: [bootstrap, data-model, schema, workspace_bootstrap_run, workspace_bootstrap_gate, readiness]
---

# Bootstrap — Data Model

> **mirror: verified** — `workspace_bootstrap_run`, `workspace_bootstrap_gate` (ADR-0407), `workspace.onboarding_completed`, `workspace.setup_guide_completed`, `get_workspace_readiness` RPC are all verified.

---

## Verified: workspace_bootstrap_run

Audit and resume log for `bootstrap-cascade` EF runs.

**Migration:** `supabase/migrations/20260422400000_cascade_b_schema.sql:82–111`

```sql
-- anchor: "3. workspace_bootstrap_run"
CREATE TABLE IF NOT EXISTS public.workspace_bootstrap_run (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id         UUID NOT NULL REFERENCES workspace(workspace_id) ON DELETE CASCADE,
  source_path          TEXT NOT NULL CHECK (source_path IN ('onboarding', 'join', 'manual')),
  status               TEXT NOT NULL CHECK (status IN ('running', 'completed', 'failed', 'partial')),
  current_step         TEXT,
  steps_completed      TEXT[] DEFAULT '{}',
  warnings             JSONB DEFAULT '[]',
  error_payload        JSONB,
  framework_binding_id UUID REFERENCES workspace_framework_binding(id),
  started_at           TIMESTAMPTZ DEFAULT now(),
  completed_at         TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**RLS policies:**
- `jwt_select_bootstrap_run` — SELECT for workspace members
- `service_role_bootstrap_run` — ALL for service role
- `api_key_read_bootstrap_run` — SELECT for API key scoped to workspace

**Note:** This table tracks **cascade-step completion** (technical audit), NOT business-level gate readiness. It is the foundation the coordinator will read from but is not itself a readiness gate.

---

## Verified: workspace.onboarding_completed

Boolean flag on `workspace` table. Controls `/onboarding` → `/dashboard` routing.

**Migration:** `supabase/migrations/20260308100000_add_onboarding_completed.sql:7`
**Anchor:** `ADD COLUMN IF NOT EXISTS onboarding_completed boolean`
**Set by:** `finalize-workspace` EF + `finalize_onboarding_workspace` RPC

## Verified: workspace.setup_guide_completed

Boolean flag on `workspace` table. Controls `/dashboard` → `/dashboard/setup` routing. Independent from `onboarding_completed`.

**Migration:** `supabase/migrations/20260327120000_add_setup_guide_completed.sql:5`
**Anchor:** `ADD COLUMN IF NOT EXISTS setup_guide_completed boolean`
**Comment:** "Whether the post-bootstrap setup guide has been completed. Separate from onboarding_completed."

---

## Verified: get_workspace_readiness RPC (employee-readiness, NOT seed-completeness)

**IMPORTANT:** This RPC is not a bootstrap gate. It returns per-employee protocol-assignment completion stats. It is used by the `training` capability (`packages/ai/src/capabilities/training/tools.ts:84`, anchor: `rpc("get_workspace_readiness"`).

**Migration:** `supabase/migrations/20260322193130_add_workspace_readiness_rpc.sql:4`
**Updated:** `supabase/migrations/20260414014856_training_schema_foundation.sql:197`
**Revoked for anon:** `supabase/migrations/20260524000000_revoke_anon_security_definer_hardening.sql:176`

```sql
-- anchor: "get_workspace_readiness"
CREATE OR REPLACE FUNCTION public.get_workspace_readiness(p_workspace_id uuid)
RETURNS TABLE(profile_id uuid, total bigint, completed bigint)
```

Returns: `profile_id` + total protocol assignments + completed assignments per employee. Readiness percent = `completed / total * 100`.

Consumer: `training.get_team_readiness` tool + `workspace_readiness_percent` telemetry field in `packages/telemetry/src/registry.ts:2728,2774`.

---

## Verified: SQL Template Seed Targets

The 10+2 SQL template functions (`supabase/templates/restaurant/`) write to these tables:

| File | Target tables | INSERT count (verified) |
|------|--------------|------------------------|
| `departments.sql` | `department` | 14 |
| `locations.sql` | `location`, `location_zone` | 4 |
| `policies.sql` | `policy` | 2 |
| `governance.sql` | `protocol`, `procedure`, `routine`, `runbook`, `control_list`, `knowledge_test`, `confirmation` | 54 |
| `employees.sql` | `user_identity`, `profile`, `employment_contract` | 100 |
| `schedule.sql` | `schedule_shift` (generator) | 1 |
| `budget.sql` | `season_budget`, `day_factor`, `hour_factor`, `workspace_budget` | 4 |
| `teams.sql` | `team`, `team_member` | 4 |
| `assignments.sql` | `protocol_assignment` | 1 |
| `contracts.sql` | `employment_contract` (bulk) | 1 |
| `mattilsynet.sql` | `routine`, `control_list`, `knowledge_test` | 75 |
| `alcohol-labor.sql` | `routine`, `protocol` | 36 |

Counts verified by: `grep -c "^INSERT INTO\|^ *INSERT INTO" supabase/templates/restaurant/*.sql`

---

## Verified: workspace_bootstrap_gate (ADR-0407 Phase 1)

**Migration:** `supabase/migrations/20260625120000_workspace_bootstrap_gate.sql`

```sql
-- Enum
CREATE TYPE bootstrap_gate_status AS ENUM (
  'open', 'in_progress', 'closed', 'skipped', 'blocked'
);

-- Table
CREATE TABLE workspace_bootstrap_gate (
  workspace_bootstrap_gate_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspace(workspace_id) ON DELETE CASCADE,
  gate_slug text NOT NULL,
  status bootstrap_gate_status NOT NULL DEFAULT 'open',
  industry_source text NOT NULL,
  display_label_no text NOT NULL,
  display_label_en text NOT NULL,
  description text,
  required boolean NOT NULL DEFAULT true,
  depends_on jsonb NOT NULL DEFAULT '[]'::jsonb,
  capability_slug text,
  suggested_day smallint,
  closed_at timestamptz,
  closed_by uuid REFERENCES profile(profile_id),
  closed_via text,
  skip_reason text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, gate_slug)
);
```

**RLS policies:**
- `jwt_read_workspace_bootstrap_gate` — SELECT for workspace members (authenticated)
- `api_key_read_workspace_bootstrap_gate` — SELECT for API key scoped to workspace (anon)
- No direct INSERT/UPDATE/DELETE — all writes go through SECURITY DEFINER RPCs

**RPCs:**
- `fn_list_open_bootstrap_gates(p_workspace_id uuid)` — SECURITY DEFINER, returns open/in_progress/blocked gates
- `fn_close_bootstrap_gate(p_workspace_id, p_gate_slug, p_via, p_profile_id)` — admin-only close
- `fn_skip_bootstrap_gate(p_workspace_id, p_gate_slug, p_reason, p_profile_id)` — admin-only skip; required=true gates RAISE EXCEPTION

**K1a gate registry:**
- `BootstrapGateDefinition` type in `packages/types/src/industry.ts`
- `getBootstrapGates()` on `hospitality.ts` (11 gates) and `default.ts` (6 gates)
- Seeded by bootstrap-cascade EF Step 12

**Hospitality gates (11):** departments_exist, locations_exist, operating_hours_set, regulatory_framework_bound, tariff_binding_decided, owner_contract_active, first_season_active, mattilsynet_routines_seeded (optional), alcohol_labor_routines_seeded (optional), first_employees_invited (optional), authority_config_complete

**Default gates (6):** departments_exist, locations_exist, regulatory_framework_bound, owner_contract_active, first_season_active, authority_config_complete

---

## Historical: Aspirational workspace_readiness Table (REPLACED by workspace_bootstrap_gate)

The original ROADMAP.md proposal called this table `workspace_readiness`. That name was retired in ADR-0407 to avoid collision with the employee-readiness terminology (see `get_workspace_readiness` RPC below). The table exists as `workspace_bootstrap_gate` instead.

**Archived proposed schema** (superseded):

## Archived: workspace_readiness Table Proposal

Originally proposed schema (never migrated, superseded by workspace_bootstrap_gate):

```sql
-- ASPIRATIONAL — not yet migrated
CREATE TABLE public.workspace_readiness (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID NOT NULL REFERENCES workspace(workspace_id) ON DELETE CASCADE,
  gate_slug       TEXT NOT NULL,           -- e.g. 'departments', 'locations', 'framework_binding'
  status          TEXT NOT NULL CHECK (status IN ('open', 'closed', 'skipped')),
  requires_role   TEXT NOT NULL DEFAULT 'admin', -- minimum role to close gate
  depends_on      JSONB,                   -- array of gate_slug strings that must close first
  closed_at       TIMESTAMPTZ,
  closed_by       UUID REFERENCES user_identity(id),
  meta            JSONB,                   -- gate-specific metadata (e.g. count of rows seeded)
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, gate_slug)
);
```

**Proposed critical gates** (seed-completeness checklist):

| gate_slug | Condition to close | Depends on |
|-----------|--------------------|-----------|
| `departments` | ≥1 active department | — |
| `locations` | ≥1 active location + ≥1 zone | `departments` |
| `operating_hours` | `workspace_operating_hours` rows exist | — |
| `framework_binding` | Active `workspace_framework_binding` row | — |
| `tariff_binding_decision` | `workspace_settings.is_tariff_bound` not null | `framework_binding` |
| `season_active` | ≥1 active season with `season_budget` | `departments` |
| `owner_contract` | Active `employment_contract` for owner/admin profile | `departments` |
| `authority_config` | `engine_authority_config` rows exist for all registered capabilities | — |
| `policy_seeded` | ≥1 policy + ≥1 protocol | — |
| `mattilsynet_routines` | Mattilsynet routines seeded | `policy_seeded` |

**Note:** The `workspace_bootstrap_run.steps_completed` array is the closest current proxy for gate state, but it is at the cascade-step level, not the business-level. The coordinator will need to translate from step-complete to gate-open/closed.

---

## Verified: Related Tables (bootstrap writes to)

Bootstrap-cascade EF writes to these tables during its 11 steps:

- `workspace_operating_hours` (Step 1)
- `department` — updates `department_type` (Step 2)
- `department_operating_hours` (Step 3)
- `workspace_framework_binding` (Step 4)
- `tariff_rate_table` — workspace copies (Step 5)
- `planning_cycle` (Step 6)
- `season_budget` (Step 7)
- `day_factor`, `hour_factor` (Step 8)
- `payroll_profile_template` (Step 9)
- `engine_authority_config` (Step 10)
- `profession`, `profession_training` (Step 11, hospitality only)

All verified in `supabase/functions/bootstrap-cascade/index.ts:343–888`.
