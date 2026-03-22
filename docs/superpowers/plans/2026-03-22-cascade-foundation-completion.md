---
title: "Cascade Foundation Completion — Implementation Plan"
status: draft
updated: 2026-03-22
created: 2026-03-22
module: cascade
tags: [cascade, bootstrap, framework, governance, payroll, plan]
---

# Cascade Foundation Completion — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the Cascade Core Foundation runtime so new workspaces get cascade data from day one, framework rules evaluate shifts, change proposals enable preview/apply for hours changes, and employee invites cascade into contracts and payroll profiles.

**Architecture:** 5 phases with dependencies: Phase 1 (schema) blocks everything. Phase 2 (bootstrap) and Phase 4 (rule evaluation) can run in parallel after Phase 1. Phase 3 (invite cascade) depends on Phase 2. Phase 5 (change proposals) depends on Phase 2 + Phase 4.

**Tech Stack:** Supabase (PostgreSQL, Edge Functions, RLS), TypeScript, Next.js App Router, TanStack Query, Zod

**Spec:** `docs/superpowers/specs/2026-03-22-cascade-foundation-completion-design.md` v1.3.0

---

## Phase 1: Schema + Seed (Blocks Everything)

### Task 1: Validate A1+A2 Cascade Migrations

**Files:**

- Verify: `supabase/migrations/20260421100000_cascade_a1_extensions.sql`
- Verify: `supabase/migrations/20260421100100_cascade_a1_enums.sql`
- Verify: `supabase/migrations/20260421100200_cascade_a1_domain_tables.sql`
- Verify: `supabase/migrations/20260421100300_cascade_a1_alter_existing.sql`
- Verify: `supabase/migrations/20260421200000_cascade_a2_enums.sql`
- Verify: `supabase/migrations/20260421200100_cascade_a2_framework_tables.sql`
- Verify: `supabase/migrations/20260421210000_cascade_cleanup_markers.sql`

- [ ] **Step 1: Start local Supabase**

```bash
npx supabase start
```

Expected: Supabase containers running.

- [ ] **Step 2: Run db reset to validate all migrations**

```bash
npx supabase db reset
```

Expected: All migrations apply cleanly, no errors. If errors occur, fix the failing migration before proceeding.

- [ ] **Step 3: Verify cascade tables exist**

```bash
docker exec -i $(docker ps -q -f name=supabase_db) psql -U postgres -c "
  SELECT table_name FROM information_schema.tables
  WHERE table_schema = 'public'
  AND table_name IN (
    'department_operating_hours', 'department_hours_override',
    'regulatory_framework', 'framework_rule', 'framework_trigger',
    'workspace_framework_binding', 'workspace_rule_override',
    'workspace_trigger_override', 'tariff_rate_table', 'public_holiday',
    'employee_payroll_profile', 'planning_cycle', 'planning_event',
    'planning_factors', 'adjustment_factors', 'shift_cost_snapshot',
    'change_proposal'
  )
  ORDER BY table_name;
"
```

Expected: All 17 tables listed.

- [ ] **Step 4: Verify cascade enums exist**

```bash
docker exec -i $(docker ps -q -f name=supabase_db) psql -U postgres -c "
  SELECT typname FROM pg_type WHERE typname IN (
    'department_type', 'shift_function', 'anchor_type',
    'change_proposal_status', 'cascade_initiator', 'evaluation_outcome',
    'framework_rule_type', 'framework_trigger_type', 'framework_trigger_mode'
  ) ORDER BY typname;
"
```

Expected: All 9 enums listed.

- [ ] **Step 5: Regenerate database types**

```bash
npx supabase gen types typescript --local > packages/supabase/src/database.types.ts
```

- [ ] **Step 6: Commit**

```bash
git add packages/supabase/src/database.types.ts
git commit -m "chore(db): regenerate types after cascade migration validation

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Phase B Schema Migration — New Tables + ALTERs

**Files:**

- Create: `supabase/migrations/YYYYMMDDHHMMSS_cascade_b_schema.sql`

- [ ] **Step 1: Write the migration SQL**

Create `supabase/migrations/20260422300000_cascade_b_schema.sql` with:

```sql
-- Cascade Foundation Phase B — New tables + ALTER statements
-- Spec: docs/superpowers/specs/2026-03-22-cascade-foundation-completion-design.md

-- ========================================
-- 0. Enum additions
-- ========================================
ALTER TYPE change_proposal_status ADD VALUE IF NOT EXISTS 'failed';

-- ========================================
-- 1. workspace_operating_hours (base hours)
-- ========================================
CREATE TABLE IF NOT EXISTS public.workspace_operating_hours (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspace(workspace_id) ON DELETE CASCADE,
  day_of_week INT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),  -- 0=Mon..6=Sun (ISO)
  open_time TIME,
  close_time TIME,
  is_closed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, day_of_week)
);

CREATE TRIGGER set_workspace_operating_hours_updated_at
  BEFORE UPDATE ON public.workspace_operating_hours
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE workspace_operating_hours ENABLE ROW LEVEL SECURITY;

CREATE POLICY "jwt_select_workspace_hours" ON workspace_operating_hours
  FOR SELECT USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));
CREATE POLICY "jwt_insert_workspace_hours" ON workspace_operating_hours
  FOR INSERT WITH CHECK (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));
CREATE POLICY "jwt_update_workspace_hours" ON workspace_operating_hours
  FOR UPDATE USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));
CREATE POLICY "api_key_read_workspace_hours" ON workspace_operating_hours
  FOR SELECT USING (workspace_id = (current_setting('app.workspace_id', true))::uuid);

COMMENT ON TABLE workspace_operating_hours IS 'Cascade D1: Workspace base operating hours. One row per weekday. Departments derive hours from these via offsets.';

-- ========================================
-- 2. payroll_profile_template
-- ========================================
CREATE TABLE IF NOT EXISTS public.payroll_profile_template (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspace(workspace_id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  salary_type TEXT NOT NULL CHECK (salary_type IN ('hourly', 'monthly')),
  agreed_weekly_hours NUMERIC(4,2),
  tariff_category TEXT,
  employment_category TEXT,
  is_system_template BOOLEAN DEFAULT false,
  is_locked BOOLEAN DEFAULT false,
  seed_source TEXT,
  seed_version TEXT,
  seeded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, name)
);

CREATE TRIGGER set_payroll_profile_template_updated_at
  BEFORE UPDATE ON public.payroll_profile_template
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE payroll_profile_template ENABLE ROW LEVEL SECURITY;

CREATE POLICY "jwt_select_payroll_template" ON payroll_profile_template
  FOR SELECT USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));
CREATE POLICY "jwt_insert_payroll_template" ON payroll_profile_template
  FOR INSERT WITH CHECK (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));
CREATE POLICY "jwt_update_payroll_template" ON payroll_profile_template
  FOR UPDATE USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));
CREATE POLICY "api_key_read_payroll_template" ON payroll_profile_template
  FOR SELECT USING (workspace_id = (current_setting('app.workspace_id', true))::uuid);

COMMENT ON TABLE payroll_profile_template IS 'Cascade D2: Pre-defined payroll configurations. Seeded from I1 hospitality package, admin-managed at runtime.';

-- ========================================
-- 3. workspace_bootstrap_run
-- ========================================
CREATE TABLE IF NOT EXISTS public.workspace_bootstrap_run (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspace(workspace_id) ON DELETE CASCADE,
  source_path TEXT NOT NULL CHECK (source_path IN ('onboarding', 'join', 'manual')),
  status TEXT NOT NULL CHECK (status IN ('running', 'completed', 'failed', 'partial')),
  current_step TEXT,
  steps_completed TEXT[] DEFAULT '{}',
  warnings JSONB DEFAULT '[]',
  error_payload JSONB,
  framework_binding_id UUID REFERENCES workspace_framework_binding(id),
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER set_workspace_bootstrap_run_updated_at
  BEFORE UPDATE ON public.workspace_bootstrap_run
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE workspace_bootstrap_run ENABLE ROW LEVEL SECURITY;

CREATE POLICY "jwt_select_bootstrap_run" ON workspace_bootstrap_run
  FOR SELECT USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));
CREATE POLICY "service_role_bootstrap_run" ON workspace_bootstrap_run
  FOR ALL USING (current_setting('role') = 'service_role');
CREATE POLICY "api_key_read_bootstrap_run" ON workspace_bootstrap_run
  FOR SELECT USING (workspace_id = (current_setting('app.workspace_id', true))::uuid);

COMMENT ON TABLE workspace_bootstrap_run IS 'Cascade I1: Audit log for bootstrap executions. Idempotent, resumable, auditable.';

-- ========================================
-- 4. ALTER department_operating_hours
-- ========================================
ALTER TABLE department_operating_hours
  ADD COLUMN IF NOT EXISTS open_offset_minutes INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS close_offset_minutes INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_derived BOOLEAN DEFAULT true;

COMMENT ON COLUMN department_operating_hours.is_derived IS
  'true = absolute times recomputed from workspace base + offsets on cascade. false = manually controlled.';

-- ========================================
-- 5. ALTER department — classification
-- ========================================
ALTER TABLE department
  ADD COLUMN IF NOT EXISTS classification_source TEXT
    CHECK (classification_source IN ('industry_package', 'admin_confirmed', 'manual')),
  ADD COLUMN IF NOT EXISTS classification_confidence TEXT
    CHECK (classification_confidence IN ('high', 'medium', 'low'));

-- ========================================
-- 6. ALTER invitation — invite_employment_type
-- ========================================
ALTER TABLE invitation
  ADD COLUMN IF NOT EXISTS invite_employment_type TEXT
    CHECK (invite_employment_type IN ('employee', 'guest'));

-- ========================================
-- 7. ALTER employee_payroll_profile — provenance
-- ========================================
ALTER TABLE employee_payroll_profile
  ADD COLUMN IF NOT EXISTS seeded_from_template_id UUID REFERENCES payroll_profile_template(id),
  ADD COLUMN IF NOT EXISTS seeded_at TIMESTAMPTZ;

-- ========================================
-- 8. ALTER tariff_rate_table — provenance
-- ========================================
ALTER TABLE tariff_rate_table
  ADD COLUMN IF NOT EXISTS seeded_from_framework_binding_id UUID,
  ADD COLUMN IF NOT EXISTS seeded_at TIMESTAMPTZ;

-- ========================================
-- 9. ALTER season_budget — target_margin
-- ========================================
ALTER TABLE season_budget
  ADD COLUMN IF NOT EXISTS target_margin NUMERIC(5,2);

COMMENT ON COLUMN season_budget.target_margin IS
  'Profitability target (%). Independent from target_labor_percentage which is a cost ratio.';
```

- [ ] **Step 2: Apply migration**

```bash
docker exec -i $(docker ps -q -f name=supabase_db) psql -U postgres < supabase/migrations/20260422300000_cascade_b_schema.sql
```

Expected: No errors.

- [ ] **Step 3: Verify new tables and columns**

```bash
docker exec -i $(docker ps -q -f name=supabase_db) psql -U postgres -c "
  SELECT table_name FROM information_schema.tables
  WHERE table_schema = 'public'
  AND table_name IN ('workspace_operating_hours', 'payroll_profile_template', 'workspace_bootstrap_run')
  ORDER BY table_name;
"
```

Expected: All 3 tables listed.

- [ ] **Step 4: Regenerate types**

```bash
npx supabase gen types typescript --local > packages/supabase/src/database.types.ts
```

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260422300000_cascade_b_schema.sql packages/supabase/src/database.types.ts
git commit -m "feat(db): cascade Phase B schema — 3 new tables, 6 ALTERs

New: workspace_operating_hours, payroll_profile_template, workspace_bootstrap_run
Alter: dept_operating_hours offsets, dept classification, invitation type,
payroll provenance, tariff provenance, season_budget target_margin

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: K1a Platform Seed — hospitality.no.default.v1

**Files:**

- Create: `supabase/migrations/20260422300100_cascade_k1a_hospitality_seed.sql`

- [ ] **Step 1: Write the seed migration**

This populates the platform-level K1a data: regulatory framework, rules, triggers, and correct Riksavtalen tariff rates. All rows have `workspace_id IS NULL` (platform-owned).

Read the spec sections 6.1–6.4 for exact values. The seed must include:

- 1 `regulatory_framework` row (code: `hospitality.no.default.v1`)
- 8 `framework_rule` rows (min rest, max daily/weekly hours, overtime, under-18, Sunday/holiday, split shift)
- 8 `framework_trigger` rows (shift_created, shift_updated, schedule_published, hours thresholds, rest violation, age check, holiday check)
- 5 `tariff_rate_table` rows (kveldstillegg 15.65, helgetillegg 29.74, helligdagstillegg 100%, overtid 50%, overtid 100%)

Each `framework_rule` needs BOTH `description` (English) and `description_no` (Norwegian) for i18n compliance.

Use `ON CONFLICT DO NOTHING` with appropriate conflict targets for idempotency.

**CRITICAL schema notes — the spec has field name errors. Use actual DB column names:**

- `regulatory_framework`: use `is_active = true` (boolean), NOT `status = 'active'` — no status column exists
- `regulatory_framework.version`: use `'1'` (string type), NOT `1` (integer)
- `framework_trigger`: use `trigger_mode` column (enum: `state_change`/`time_based`/`threshold`/`external_event`). There is NO `trigger_type` column on this table — the spec table labeled "trigger_type" is actually the `code` (free text) column
- `tariff_rate_table`: idempotency handled by EXCLUDE constraint on `(rate_type, workspace_id, daterange)`

- [ ] **Step 2: Apply migration**

```bash
docker exec -i $(docker ps -q -f name=supabase_db) psql -U postgres < supabase/migrations/20260422300100_cascade_k1a_hospitality_seed.sql
```

- [ ] **Step 3: Verify seed data**

```bash
docker exec -i $(docker ps -q -f name=supabase_db) psql -U postgres -c "
  SELECT code, name, status FROM regulatory_framework WHERE code = 'hospitality.no.default.v1';
  SELECT COUNT(*) as rule_count FROM framework_rule WHERE framework_id = (SELECT framework_id FROM regulatory_framework WHERE code = 'hospitality.no.default.v1');
  SELECT COUNT(*) as trigger_count FROM framework_trigger WHERE framework_id = (SELECT framework_id FROM regulatory_framework WHERE code = 'hospitality.no.default.v1');
  SELECT rate_type, amount, unit FROM tariff_rate_table WHERE workspace_id IS NULL;
"
```

Expected: 1 framework, 8 rules, 8 triggers, 5 tariff rates.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260422300100_cascade_k1a_hospitality_seed.sql
git commit -m "feat(db): seed K1a hospitality.no.default.v1 framework + tariff rates

8 framework rules (AML §10-4/8/10, §11-2/3, Riksavtalen)
8 framework triggers (shift/schedule/threshold events)
5 tariff rates (correct Riksavtalen: kveldstillegg 15.65, helgetillegg 29.74)

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Fix hospitality.ts — Correct Rates + Add Offsets + Templates

**Files:**

- Modify: `apps/web/src/lib/industry/packages/hospitality.ts`
- Test: `apps/web/src/lib/industry/packages/__tests__/hospitality.test.ts` (create if missing)

- [ ] **Step 1: Read current hospitality.ts**

Read `apps/web/src/lib/industry/packages/hospitality.ts` fully. Note the wrong tariff rates and existing structure.

- [ ] **Step 2: Write tests for industry package data**

Create `apps/web/src/lib/industry/packages/__tests__/hospitality.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import {
  HOSPITALITY_TARIFF_RATES,
  DEPARTMENT_TYPE_MAP,
  DEPARTMENT_OFFSET_DEFAULTS,
  PAYROLL_PROFILE_TEMPLATES,
} from "../hospitality";

describe("hospitality industry package", () => {
  it("has correct Riksavtalen tariff rates", () => {
    const kveld = HOSPITALITY_TARIFF_RATES.find((r) => r.rateType === "kveldstillegg");
    expect(kveld?.amount).toBe(15.65);

    const helg = HOSPITALITY_TARIFF_RATES.find((r) => r.rateType === "helgetillegg");
    expect(helg?.amount).toBe(29.74);

    const hellig = HOSPITALITY_TARIFF_RATES.find((r) => r.rateType === "helligdagstillegg");
    expect(hellig?.amount).toBe(100);
    expect(hellig?.unit).toBe("percent");
  });

  it("maps department names to types", () => {
    expect(DEPARTMENT_TYPE_MAP["Kjøkken"]).toBe("operational");
    expect(DEPARTMENT_TYPE_MAP["Kontor"]).toBe("administrative");
    expect(DEPARTMENT_TYPE_MAP["Sal"]).toBe("operational");
  });

  it("has offset defaults for operational departments", () => {
    const kitchen = DEPARTMENT_OFFSET_DEFAULTS["Kjøkken"];
    expect(kitchen.openOffset).toBe(-120);
    expect(kitchen.closeOffset).toBe(0);
  });

  it("has payroll profile templates", () => {
    expect(PAYROLL_PROFILE_TEMPLATES.length).toBeGreaterThanOrEqual(4);
    const servitor = PAYROLL_PROFILE_TEMPLATES.find((t) => t.name === "Servitør heltid");
    expect(servitor?.salaryType).toBe("hourly");
    expect(servitor?.weeklyHours).toBe(37.5);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
cd apps/web && npx vitest run src/lib/industry/packages/__tests__/hospitality.test.ts
```

Expected: FAIL — exports don't exist yet.

- [ ] **Step 4: Update hospitality.ts with correct data**

Add/fix exports in `hospitality.ts`:

- `HOSPITALITY_TARIFF_RATES` — correct Riksavtalen rates
- `DEPARTMENT_TYPE_MAP` — name → operational/administrative mapping with confidence
- `DEPARTMENT_OFFSET_DEFAULTS` — per-department-name open/close offsets in minutes
- `PAYROLL_PROFILE_TEMPLATES` — 4 default templates (servitør heltid/deltid, kokk heltid, leder)
- `ADMINISTRATIVE_DEFAULT_HOURS` — 09:00-17:00 Mon-Fri, closed Sat-Sun
- `HOSPITALITY_DEFAULT_HOURS` — 11:00-23:00 Mon-Sat, 12:00-22:00 Sun

Keep existing exports unchanged. Only add new ones and fix wrong tariff values.

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd apps/web && npx vitest run src/lib/industry/packages/__tests__/hospitality.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/industry/packages/hospitality.ts apps/web/src/lib/industry/packages/__tests__/hospitality.test.ts
git commit -m "fix(industry): correct Riksavtalen rates, add dept offsets + payroll templates

kveldstillegg: 56→15.65, helgetillegg: 56→29.74, helligdagstillegg: 133%→100%
Add: DEPARTMENT_TYPE_MAP, DEPARTMENT_OFFSET_DEFAULTS, PAYROLL_PROFILE_TEMPLATES

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Phase 2: Bootstrap Service (Unblocks Workspace Creation)

### Task 5: Cascade Types

**Files:**

- Modify: `apps/web/src/lib/cascade/types.ts`

- [ ] **Step 1: Add bootstrap, tariff, and evaluation types**

Read `apps/web/src/lib/cascade/types.ts` first. The existing file has old types (`Conflict`, `ConflictCategory`, `ConflictSeverity`, `ProposedChange`) that will be replaced by the new evaluation types. Keep the old types for now — Task 11 (evaluator rewrite) will remove them when it replaces the evaluator. Add new types needed by later tasks:

```typescript
// Bootstrap types
export type BootstrapSourcePath = "onboarding" | "join" | "manual";
export type BootstrapStatus = "running" | "completed" | "failed" | "partial";

export type BootstrapWarning = {
  step: string;
  departmentId?: string;
  departmentName?: string;
  message: string;
};

// Tariff types
export type TariffContext = {
  payrollProfile: {
    tariffOverrideId: string | null;
    tariffCategory: string;
    seniority_start_date: string;
    has_fagbrev: boolean;
  } | null;
  workspaceTariffRates: Array<{
    id: string;
    rate_type: string;
    amount: number;
    unit: string;
    effective_from: string;
    effective_until: string | null;
  }>;
  platformTariffRates: Array<{
    id: string;
    rate_type: string;
    amount: number;
    unit: string;
    effective_from: string;
    effective_until: string | null;
  }>;
  isPublicHoliday: boolean;
};

export type TariffSupplement = {
  type: string;
  amount: number;
  unit: "kr/h" | "percent";
  reason: string;
};

export type TariffResolution = {
  baseRate: number;
  baseRateUnit: "hourly" | "monthly";
  supplements: TariffSupplement[];
  effectiveHourlyRate: number;
  sourceTier: "override" | "workspace" | "platform";
  tariffCategory: string | null;
};

// Evaluation types (replaces existing Conflict-based types)
export type EvaluationOutcomeLevel =
  | "allowed"
  | "allowed_with_exception"
  | "review_required"
  | "blocked";

export type RuleHit = {
  ruleId: string;
  ruleName: string;
  ruleType: string;
  outcome: EvaluationOutcomeLevel;
  reason: string;
  overrideApplied: boolean;
  overrideId?: string;
};

export type EvaluationResult = {
  outcome: EvaluationOutcomeLevel;
  hits: RuleHit[];
  worstHit: RuleHit | null;
};

export type EntityContext = {
  profileId?: string;
  shiftId?: string;
  date: string;
  employeeAge?: number;
  contractType?: string;
  weeklyHoursWorked?: number;
  dailyHoursWorked?: number;
  lastShiftEnd?: string;
};
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/lib/cascade/types.ts
git commit -m "feat(cascade): add bootstrap, tariff, evaluation types

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Bootstrap Cascade Edge Function

**Files:**

- Create: `supabase/functions/bootstrap-cascade/index.ts`
- Modify: `supabase/functions/config.toml` (if verify_jwt needs changing)

This is the largest single task. The Edge Function implements the 10-step bootstrap sequence from spec section 5.2. It uses service-role client for all operations.

- [ ] **Step 1: Create the Edge Function directory and file**

```bash
mkdir -p supabase/functions/bootstrap-cascade
```

- [ ] **Step 2: Implement the bootstrap function**

Read spec section 5.2 carefully. The function:

- Accepts `{ workspaceId, sourcePath }` in request body
- Uses service-role client (internal call, not user-facing)
- Creates a `workspace_bootstrap_run` row at start (status: running)
- Executes 10 steps in order, logging each to `steps_completed`
- Hard dependency: Step 2 (department_type) before Step 3 (department hours)
- On success: updates run to status=completed
- On failure: updates run to status=failed with error_payload
- On partial: updates run to status=partial with warnings
- Idempotent: uses `ON CONFLICT DO NOTHING` or `INSERT ... WHERE NOT EXISTS` patterns

Key implementation details:

- Step 1: Copy from `company_opening_hours` to `workspace_operating_hours`. Fallback to hospitality defaults if no intake data.
- Step 2: Read departments, match names against `DEPARTMENT_TYPE_MAP` from hospitality.ts (import or inline the map). Set `classification_source` and `classification_confidence`.
- Step 3: For operational depts: compute absolute times from workspace base + `DEPARTMENT_OFFSET_DEFAULTS`. For administrative: fixed 09-17 Mon-Fri.
- Step 4: INSERT into `workspace_framework_binding` referencing the `hospitality.no.default.v1` framework.
- Step 5: Copy `tariff_rate_table` rows where `workspace_id IS NULL` to workspace scope.
- Step 6: INSERT `planning_cycle` with 4-week default.
- Step 7: UPDATE `season_budget` with intake data if present. If not, leave as draft.
- Step 8: INSERT `day_factor` + `hour_factor` from hospitality defaults.
- Step 9: INSERT `payroll_profile_template` from `PAYROLL_PROFILE_TEMPLATES`.
- Step 10: Verify `engine_authority_config` exists, create if missing.
- Final: Run completion criteria check (spec section 17).

**Telemetry:** Per CLAUDE.md "no mutation without emit", include `emit()` calls via engine-dispatch for: framework_binding.created, tariff_rates.seeded, planning_cycle.created, payroll_templates.seeded. Use the existing telemetry pattern (POST to engine-dispatch EF with service-role).

- [ ] **Step 3: Test locally**

```bash
npx supabase functions serve bootstrap-cascade --no-verify-jwt
```

Then test with a real workspace ID from the local DB.

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/bootstrap-cascade/
git commit -m "feat(cascade): bootstrap-cascade Edge Function — 10-step I1 integration

Idempotent bootstrap service for new workspaces. Seeds: base hours,
department types + hours with offsets, framework binding, tariff rates,
planning cycle, season budget enrichment, day/hour factors, payroll
templates, authority config. Logs to workspace_bootstrap_run.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: Hook Bootstrap into Workspace Creation Paths

**Files:**

- Modify: `supabase/functions/activate-workspace/index.ts`
- Modify: `supabase/functions/finalize-workspace/index.ts`

- [ ] **Step 1: Read both Edge Functions**

Read `activate-workspace/index.ts` and `finalize-workspace/index.ts` fully to understand their current structure.

- [ ] **Step 2: Add bootstrap call to activate-workspace**

After the agent profile creation (around line 46-51), add:

```typescript
// Bootstrap cascade data for the new workspace
try {
  await adminClient.functions.invoke("bootstrap-cascade", {
    body: { workspaceId: data, sourcePath: "join" },
  });
} catch (_bootstrapError) {
  // Non-fatal: workspace activation succeeded even if bootstrap fails.
  // Bootstrap can be re-run manually.
  console.error("Failed to bootstrap cascade:", _bootstrapError);
}
```

- [ ] **Step 3: Add bootstrap call to finalize-workspace**

Add the same pattern after workspace finalization completes, using `sourcePath: "onboarding"`.

- [ ] **Step 4: Test both paths locally**

Create a test workspace through each path and verify `workspace_bootstrap_run` row is created.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/activate-workspace/index.ts supabase/functions/finalize-workspace/index.ts
git commit -m "feat(cascade): hook bootstrap into workspace creation paths

activate-workspace (join path) and finalize-workspace (onboarding path)
both call bootstrap-cascade after workspace creation. Non-fatal on failure.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Phase 3: Invite → Contract → Payroll Cascade

### Task 8: Update Invite Dialog

**Files:**

- Modify: `apps/web/src/app/dashboard/people/_components/invite-member-dialog.tsx`

- [ ] **Step 1: Read the invite dialog**

Read the full component to understand current fields and form state.

- [ ] **Step 2: Add invite_employment_type toggle**

Add a toggle/radio: `invite_employment_type: 'employee' | 'guest'`. Default to `'employee'`.

When `employee` is selected, show additional fields:

- `employment_category` select: fast/deltid/tilkalling
- `salary_type` select: hourly/monthly
- `intended_weekly_hours` number input
- `start_date` date picker
- `payroll_template_id` select (fetched from `payroll_profile_template` for workspace)

When `guest` is selected, hide employment fields.

Store employment metadata in the invitation's `metadata` JSONB field via the existing payload structure.

- [ ] **Step 3: Add the invite_employment_type to the create-invitation payload**

The `create-invitation` Edge Function already supports arbitrary columns. Add `invite_employment_type` to the insert.

- [ ] **Step 4: Test the dialog manually**

Verify both employee and guest invite flows create correct invitation rows.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/dashboard/people/_components/invite-member-dialog.tsx
git commit -m "feat(people): add invite_employment_type + payroll fields to invite dialog

Employee invites require: employment category, salary type, weekly hours,
start date, payroll template. Guest invites: name + email + dept only.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 9: Accept-Invitation — Employee Cascade

**Files:**

- Modify: `supabase/functions/accept-invitation/index.ts`

- [ ] **Step 1: Read accept-invitation fully**

Understand the current flow: validate token → create/find auth user → create profile (trainee) → assign teams → mark accepted.

- [ ] **Step 2: Add employee cascade after profile creation**

After profile creation, check `invitation.invite_employment_type`:

If `'employee'`:

1. Create `employment_contract` (status: draft) with data from `invitation.metadata`
2. Create `employee_payroll_profile` from template or metadata. Set `seniority_start_date` to `start_date` from metadata. Set `has_fagbrev` based on template tariff_category.
3. Update `profile.status` to `'active'` (promote from trainee)
4. Emit `employee.onboarded` event via `supabase.functions.invoke("engine-dispatch", ...)`

If `'guest'`:

1. Update `profile.status` to `'active'` directly
2. No contract, no payroll profile

- [ ] **Step 3: Test with a real employee invite**

Create an employee invite, accept it, verify: profile is active, contract exists (draft), payroll profile exists with template values.

- [ ] **Step 4: Test with a guest invite**

Create a guest invite, accept it, verify: profile is active, no contract, no payroll profile.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/accept-invitation/index.ts
git commit -m "feat(invite): employee cascade — draft contract + payroll profile on accept

Employee invites create employment_contract (draft) + employee_payroll_profile
(from template). Profile promoted to active. Guest invites: active directly.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 10: Contract Signed → Payroll Sync

**Files:**

- Modify: `supabase/functions/contract-lifecycle/index.ts`

- [ ] **Step 1: Read contract-lifecycle Edge Function**

Understand the existing contract state machine and webhook handling.

- [ ] **Step 2: Add payroll sync on signed status**

When contract status transitions to `signed`:

1. Find `employee_payroll_profile` where `employment_contract_id = contract_id`
2. Update with finalized contract values (hourly_rate, agreed_weekly_hours, employment_category)
3. Log previous values in `activity_trail`

- [ ] **Step 3: Test the sync**

Update a draft contract to signed status, verify payroll profile updates.

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/contract-lifecycle/index.ts
git commit -m "feat(contract): sync payroll profile on contract signed

Updates employee_payroll_profile with finalized contract values when
status changes to signed. Previous values logged in activity_trail.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Phase 4: Rule Evaluation + Tariff Resolution (Parallel with Phase 2-3)

### Task 11: Rewrite evaluateFrameworkRules()

**Files:**

- Modify: `apps/web/src/lib/cascade/evaluate-framework-rules.ts`
- Rewrite: `apps/web/src/lib/cascade/__tests__/evaluate-framework-rules.test.ts`

This is a **rewrite**, not a completion. The existing function (29 tests) has a different signature and evaluates proposed cascade changes. The new function evaluates shift/schedule actions against framework rules with employee context.

- [ ] **Step 0: Remove deprecated types from types.ts**

Remove old types that are being replaced: `Conflict`, `ConflictCategory`, `ConflictSeverity`, `ProposedChange`. These were used by the old evaluator. The new types (`EvaluationResult`, `RuleHit`, `EntityContext`, `EvaluationOutcomeLevel`) were added in Task 5.

- [ ] **Step 1: Read existing implementation and tests**

Read both files fully. Understand what the old function does and what tests exist.

- [ ] **Step 2: Write new tests first (TDD)**

Rewrite the test file with tests for the new interface. Key test cases:

1. No matching rules → `outcome: 'allowed'`, empty hits
2. Single rule, employee exceeds daily hours → `outcome: 'blocked'`
3. Multiple rules, worst outcome wins (blocked > review_required > allowed)
4. Workspace override loosens a rule → `outcome: 'allowed_with_exception'`
5. Under-18 employee assigned to night shift → `outcome: 'blocked'`
6. Sunday shift without agreement → `outcome: 'review_required'`
7. Rest period < 11h between shifts → `outcome: 'blocked'`
8. All rules pass → `outcome: 'allowed'`

Use the types from Task 5 (`EntityContext`, `EvaluationResult`, etc.)

- [ ] **Step 3: Run tests to verify they fail**

```bash
cd apps/web && npx vitest run src/lib/cascade/__tests__/evaluate-framework-rules.test.ts
```

- [ ] **Step 4: Implement the new evaluator**

Pure function, no DB access. Caller provides pre-loaded rules and overrides.

```typescript
export function evaluateFrameworkRules(
  entityContext: EntityContext,
  rules: FrameworkRuleRow[], // pre-filtered by trigger type by caller
  workspaceOverrides: WorkspaceRuleOverrideRow[],
): EvaluationResult;
```

**Note:** The caller (service layer / loader) is responsible for pre-filtering rules by trigger type before passing them to this pure evaluator. The spec signature includes `workspaceId` and `triggerType` — those are loader concerns, not evaluator concerns. This 3-param signature is the pure function boundary.

Implementation:

1. For each rule, match its conditions against entity context
2. For each matching rule, check if workspace override exists
3. Evaluate rule threshold against entity context values
4. Determine outcome per rule
5. Rank all hits by severity
6. Return aggregate result with worst outcome

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd apps/web && npx vitest run src/lib/cascade/__tests__/evaluate-framework-rules.test.ts
```

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/cascade/evaluate-framework-rules.ts apps/web/src/lib/cascade/__tests__/evaluate-framework-rules.test.ts
git commit -m "feat(cascade): rewrite evaluateFrameworkRules — multi-rule + employee context

Breaking: new signature (entityContext, rules, overrides) replaces old
(proposedChanges, rules, overrides, date). 29 old tests replaced with
8+ new tests covering severity ranking, overrides, age/rest/hours rules.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 12: Tariff Resolution — Loader + Pure Function

**Files:**

- Create: `apps/web/src/lib/cascade/get-tariff-context.ts`
- Create: `apps/web/src/lib/cascade/resolve-tariff-rate.ts`
- Create: `apps/web/src/lib/cascade/__tests__/resolve-tariff-rate.test.ts`

- [ ] **Step 1: Write tests for resolveTariffRate**

Key test cases:

1. Base hourly rate, no supplements → just base rate
2. Evening shift (22:00) → kveldstillegg applied
3. Saturday afternoon → helgetillegg applied
4. Public holiday → helligdagstillegg applied (100% of base)
5. Multiple supplements stack (holiday + evening)
6. Override tier wins over workspace tier
7. Workspace tier wins over platform tier

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd apps/web && npx vitest run src/lib/cascade/__tests__/resolve-tariff-rate.test.ts
```

- [ ] **Step 3: Implement resolveTariffRate pure function**

```typescript
export function resolveTariffRate(
  context: TariffContext,
  effectiveTimestamp: string,
): TariffResolution;
```

No DB access. Uses pre-loaded context from `getTariffContext()`.

- [ ] **Step 4: Implement getTariffContext loader**

```typescript
export async function getTariffContext(
  supabase: SupabaseClient,
  profileId: string,
  date: string,
): Promise<TariffContext>;
```

Queries: `employee_payroll_profile`, `tariff_rate_table` (workspace + platform), `public_holiday`.

- [ ] **Step 5: Run tests to verify they pass**

- [ ] **Step 6: Update cascade barrel export**

Add new exports to `apps/web/src/lib/cascade/index.ts`.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/lib/cascade/resolve-tariff-rate.ts apps/web/src/lib/cascade/get-tariff-context.ts apps/web/src/lib/cascade/__tests__/resolve-tariff-rate.test.ts apps/web/src/lib/cascade/index.ts
git commit -m "feat(cascade): tariff resolution — loader + pure function

getTariffContext() loads payroll + tariff + holiday data.
resolveTariffRate() computes base rate + supplements (evening, weekend,
holiday, overtime). Three-tier resolution: override > workspace > platform.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Phase 5: Hours Cascade + Change Proposals

### Task 13: Update useOperatingHours for Offset Model

**Files:**

- Modify: `apps/web/src/app/dashboard/settings/_hooks/use-operating-hours.ts`

- [ ] **Step 1: Read the current hook**

Understand how it fetches and upserts `department_operating_hours`.

- [ ] **Step 2: Add workspace base hours query**

Fetch `workspace_operating_hours` alongside department hours. Display offsets in the UI by computing `department_time - workspace_base_time`.

- [ ] **Step 3: Update upsert to maintain offset columns**

When admin changes department hours directly, set `is_derived = false`. When admin changes offset, recompute absolute times from workspace base and set `is_derived = true`.

- [ ] **Step 4: Test manually**

Verify hours display shows offset relationship to workspace base.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/dashboard/settings/_hooks/use-operating-hours.ts
git commit -m "feat(settings): operating hours hook supports offset model

Fetches workspace base hours alongside department hours. Shows offset
relationship. Direct edits set is_derived=false, offset edits recompute.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 14: Change Proposal — Preview Computation

**Files:**

- Create: `apps/web/src/lib/cascade/compute-proposal-preview.ts`
- Create: `apps/web/src/lib/cascade/__tests__/compute-proposal-preview.test.ts`

- [ ] **Step 1: Write tests**

Test cases:

1. Workspace base hours change → lists affected derived departments
2. Affected departments → lists affected future sessions
3. Affected sessions → lists affected unconfirmed shifts (auto-adjust)
4. Published/confirmed shifts → listed as impacted (not auto-adjusted)
5. Past sessions → never included
6. No affected entities → empty preview

- [ ] **Step 2: Run tests to verify they fail**

- [ ] **Step 3: Implement compute-proposal-preview**

Pure function that takes current state + proposed change → returns preview of all impacts. No mutations.

- [ ] **Step 4: Run tests to verify they pass**

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/cascade/compute-proposal-preview.ts apps/web/src/lib/cascade/__tests__/compute-proposal-preview.test.ts
git commit -m "feat(cascade): change proposal preview computation

Pure function computing impact of hours/dept-type changes: affected
departments, sessions, shifts (auto-adjust vs impacted), hooks.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 15: Change Proposal — Apply + Edge Function

**Files:**

- Create: `supabase/functions/apply-change-proposal/index.ts`

- [ ] **Step 1: Implement apply-change-proposal Edge Function**

Transactional Edge Function. Guards:

- `status = 'approved' AND applied_at IS NULL`
- Uses service-role client for mutations

Apply sequence (from spec section 8.2):

1. Apply base change (workspace_operating_hours or department hours or dept type)
2. Re-compute `is_derived=true` department hours (base + offsets)
3. Update future upcoming `department_session` planned_open/planned_close
4. Auto-adjust future unconfirmed shifts
5. Mark impacted confirmed/published shifts (NOT auto-changed)
6. Recalculate session_hook firing times
7. INSERT activity_trail entries
8. EMIT `operating_hours.changed` via engine-dispatch
9. UPDATE change_proposal: status=applied, applied_at=now()

Status transitions: pending→approved→applied (or failed). See spec section 8.5.

- [ ] **Step 2: Test locally**

Create a change proposal, approve it, apply it, verify cascade effects.

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/apply-change-proposal/
git commit -m "feat(cascade): apply-change-proposal Edge Function

Transactional cascade: base hours → dept hours → sessions → shifts → hooks.
Guards: approved + not-yet-applied. Activity trail + event emission.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 16: Session Generation Filter by Department Type

**Files:**

- Modify: `supabase/functions/engine-dispatch/index.ts`

- [ ] **Step 1: Read the upsert_session handler in engine-dispatch**

Find where department_sessions are created.

- [ ] **Step 2: Add department_type filter**

Before creating a department_session, check:

```sql
WHERE department.department_type IN ('operational', 'hybrid')
```

Administrative departments are excluded from session creation.

- [ ] **Step 3: Test**

Verify that publishing shifts for an administrative department does NOT create a department_session.

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/engine-dispatch/index.ts
git commit -m "fix(engine): filter session creation by department_type

Only operational and hybrid departments create department_sessions.
Administrative departments excluded from session lifecycle.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 17: Change Proposal UI — Preview + Approve/Reject

**Files:**

- Create: `apps/web/src/app/dashboard/settings/_components/ChangeProposalDialog.tsx`
- Create: `apps/web/src/app/dashboard/settings/_hooks/use-change-proposals.ts`

- [ ] **Step 1: Create hook for change proposals**

TanStack Query hook that:

- Fetches pending change proposals for workspace
- Provides `createProposal()` mutation (calls preview computation, inserts proposal)
- Provides `approveProposal()` mutation (updates status to approved)
- Provides `rejectProposal()` mutation (updates status to rejected)
- Provides `applyProposal()` mutation (calls apply-change-proposal EF)

- [ ] **Step 2: Create ChangeProposalDialog component**

Dialog/sheet that:

- Shows preview payload: affected departments, sessions, shifts, hooks
- Highlights impacted confirmed/published shifts requiring manual review
- Approve / Reject buttons
- Apply button (only visible when status = approved)
- Status badge showing current proposal state

- [ ] **Step 3: Wire into operating hours settings**

When admin saves workspace base hours or department hours changes:

1. Instead of direct save, call `createProposal()` with the change
2. Open ChangeProposalDialog showing preview
3. Admin reviews, approves, then applies

- [ ] **Step 4: Test manually**

Change workspace hours → verify preview shows affected entities → approve → apply → verify cascade effects.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/dashboard/settings/_components/ChangeProposalDialog.tsx apps/web/src/app/dashboard/settings/_hooks/use-change-proposals.ts
git commit -m "feat(settings): change proposal UI — preview + approve/reject/apply

Dialog shows cascade impact preview. Admin reviews affected sessions,
shifts, hooks before approving. Confirmed shifts flagged for review.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 18: Final Typecheck + Validation

**Files:** All modified files

- [ ] **Step 1: Run full typecheck**

```bash
pnpm turbo typecheck
```

Expected: 0 errors.

- [ ] **Step 2: Run cascade tests**

```bash
cd apps/web && npx vitest run src/lib/cascade/
```

Expected: All tests pass.

- [ ] **Step 3: Run full lint**

```bash
pnpm lint
```

Expected: No new errors.

- [ ] **Step 4: Validate migrations end-to-end**

```bash
npx supabase db reset
```

Expected: All migrations apply cleanly including new Phase B migrations.

- [ ] **Step 5: Regenerate types one final time**

```bash
npx supabase gen types typescript --local > packages/supabase/src/database.types.ts
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore(cascade): final typecheck + types regeneration

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Dependency Graph

```
Phase 1: Schema + Seed
  Task 1 (validate) → Task 2 (schema) → Task 3 (K1a seed)
  Task 4 (hospitality.ts) — parallel with Task 2-3

Phase 2: Bootstrap (depends on Phase 1)
  Task 5 (types) → Task 6 (bootstrap EF) → Task 7 (hook into creation)

Phase 3: Invite Cascade (depends on Phase 2)
  Task 8 (invite dialog) → Task 9 (accept cascade) → Task 10 (contract sync)

Phase 4: Rule Eval + Tariff (depends on Phase 1, parallel with Phase 2-3)
  Task 5 (types) → Task 11 (rewrite evaluator) | Task 12 (tariff resolution)

Phase 5: Hours Cascade + Proposals (depends on Phase 2 + Phase 4)
  Task 13 (hours hook) → Task 14 (preview) → Task 15 (apply EF)
  Task 16 (session filter) — parallel

Task 17: Change proposal UI
Task 18: Final validation (after all phases)
```

**Parallelization opportunities:**

- Phase 2 (bootstrap) and Phase 4 (rule eval + tariff) can run in parallel after Phase 1
- Task 4 (hospitality.ts) can run in parallel with Tasks 2-3
- Task 16 (session filter) can run any time after Phase 1
