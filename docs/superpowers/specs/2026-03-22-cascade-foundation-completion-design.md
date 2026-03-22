---
title: "Cascade Foundation Completion — Design Specification"
status: draft
updated: 2026-03-22
created: 2026-03-22
module: cascade
tags: [cascade, bootstrap, framework, governance, payroll, design-spec]
---

# Cascade Foundation Completion — Design Specification

## 1. Executive Summary

This spec defines the work to complete the Cascade Core Foundation runtime — taking the existing 100% schema and 60% pure functions to a working system where new workspaces get cascade data from day one, framework rules evaluate against shifts, change proposals enable Terraform-style preview/apply for hours changes, and employee invites cascade into contracts and payroll profiles.

**Approach:** Foundation first, then assess. Build bootstrap + rules + governance, validate against real workspace data, then plan C1/C2/C3/K1b based on what we learn.

**Canonical model reference:** `docs/superpowers/specs/2026-03-21-cascade-scheduling-system-design.md`

---

## 2. Scope

### In Scope

- I1 bootstrap integration (both `/onboarding` and `/join` paths)
- `workspace_operating_hours` table (base hours)
- Department offset model on `department_operating_hours`
- Operational vs administrative department behavior
- K1a platform seed: `hospitality.no.default.v1` framework, rules, triggers, tariff rates
- Employee invite → draft contract → seeded payroll profile cascade
- Payroll profile templates (table + industry seed)
- Change proposal lifecycle for hours and department type changes
- `evaluateFrameworkRules()` completion (multi-rule, employee context, override layering)
- `resolve_tariff_rate()` RPC (timestamp-based)
- Season budget enrichment from onboarding intake data
- Bootstrap audit logging (`workspace_bootstrap_run`)

### Out of Scope (Explicit Deferrals)

- proff.no scraping (follow-up integration — design for it, implement later)
- Leave balance / vacation / sick accounts (separate `employee_leave_balance` table, later)
- Manager-scoped proposal approval (admins only for now)
- C1 calibration loop (EWMA, variance, correction factors)
- C2 explanation generation (beyond light rule-name + reason strings)
- C3 commercial reporting
- Framework rule / tariff rate change proposals (only hours + dept type changes for now)
- External adapters (Tripletex payroll sync)
- Full scheduling product UI (vaktlista, drag-and-drop optimization)

---

## 3. Invariants

These rules are absolute. No code path may violate them.

1. Every active hospitality workspace must have exactly one active framework binding.
2. Every active department must have a `department_type` set.
3. Every active department must have operating hours entries.
4. Every employee invite must resolve to either guest access or employee setup.
5. Every employee setup must result in a payroll profile.
6. Administrative departments never create `department_session` records.
7. Workspace base hour changes never mutate past or current sessions/shifts.
8. User-entered values always win over scraped/inferred values for budget data.
9. Seeded data always carries provenance (source framework, version, timestamp).
10. Bootstrap is idempotent — re-running does not duplicate or corrupt data.

---

## 4. Schema Changes

### 4.1 New Tables

#### `workspace_operating_hours`

Base hours for the workspace. "When are our doors open." One row per weekday.

```sql
CREATE TABLE workspace_operating_hours (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspace(workspace_id),
  day_of_week INT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),  -- 0=Mon..6=Sun
  open_time TIME,
  close_time TIME,
  is_closed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (workspace_id, day_of_week)
);
```

RLS: workspace membership (JWT + API key policies).

#### `payroll_profile_template`

Pre-defined payroll configurations per workspace. Seeded from I1, admin-managed at runtime.

```sql
CREATE TABLE payroll_profile_template (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspace(workspace_id),
  name TEXT NOT NULL,
  salary_type TEXT NOT NULL CHECK (salary_type IN ('hourly', 'monthly')),
  agreed_weekly_hours NUMERIC(4,2),
  tariff_category TEXT,
  employment_category TEXT,  -- fast/deltid/tilkalling
  is_system_template BOOLEAN DEFAULT false,
  is_locked BOOLEAN DEFAULT false,
  seed_source TEXT,           -- e.g. 'hospitality.no.default.v1'
  seed_version TEXT,
  seeded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (workspace_id, name)
);
```

RLS: workspace membership.

#### `workspace_bootstrap_run`

Audit log for bootstrap executions.

```sql
CREATE TABLE workspace_bootstrap_run (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspace(workspace_id),
  source_path TEXT NOT NULL,  -- 'onboarding' | 'join' | 'manual'
  status TEXT NOT NULL CHECK (status IN ('running', 'completed', 'failed', 'partial')),
  current_step TEXT,
  steps_completed TEXT[] DEFAULT '{}',
  warnings JSONB DEFAULT '[]',  -- e.g. [{step: "dept_type_inference", dept: "X", message: "low confidence"}]
  error_payload JSONB,
  framework_binding_id UUID,
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

RLS: workspace membership (read), service role (write).

### 4.2 Altered Tables

#### `department_operating_hours` — add offset columns

```sql
ALTER TABLE department_operating_hours
  ADD COLUMN open_offset_minutes INT DEFAULT 0,
  ADD COLUMN close_offset_minutes INT DEFAULT 0,
  ADD COLUMN is_derived BOOLEAN DEFAULT true;

COMMENT ON COLUMN department_operating_hours.is_derived IS
  'true = absolute times recomputed from workspace base + offsets on cascade. false = manually controlled, does not recascade.';
```

**Semantics:**

- `is_derived = true`: absolute `open_time`/`close_time` are computed from `workspace_operating_hours` base + offsets. When workspace base hours change, these rows are re-computed.
- `is_derived = false`: absolute times are manually set. Workspace base hour changes do NOT affect these rows.
- Operational departments start as `is_derived = true` (anchored to workspace hours).
- Administrative departments start as `is_derived = false` (fixed scaffold).
- Either type can be switched by admin if the business wants different behavior.

#### `department` — add classification confidence

```sql
ALTER TABLE department
  ADD COLUMN classification_source TEXT,       -- 'industry_package' | 'admin_confirmed' | 'manual'
  ADD COLUMN classification_confidence TEXT;    -- 'high' | 'medium' | 'low'
```

Used by bootstrap to flag low-confidence inferences for admin review.

#### `invitation` — add employment type

```sql
ALTER TABLE invitation
  ADD COLUMN employment_type TEXT CHECK (employment_type IN ('employee', 'guest'));
```

Nullable for backwards compatibility with existing invitations. Required for new invites going forward.

#### `employee_payroll_profile` — add provenance

```sql
ALTER TABLE employee_payroll_profile
  ADD COLUMN seeded_from_template_id UUID REFERENCES payroll_profile_template(id),
  ADD COLUMN seeded_at TIMESTAMPTZ;
```

#### `tariff_rate_table` — add provenance for workspace copies

```sql
ALTER TABLE tariff_rate_table
  ADD COLUMN seeded_from_framework_binding_id UUID,
  ADD COLUMN seeded_at TIMESTAMPTZ;
```

**Rationale for copy-on-bootstrap (not reference):** Workspace gets isolated tariff rows for audit stability. Later framework updates do not silently alter historical payroll logic. Workspace may override rates after copy.

---

## 5. Bootstrap Service

### 5.1 Architecture

One shared bootstrap service callable from both workspace creation paths. Implemented as a Supabase Edge Function (`bootstrap-cascade`) using service-role client.

**Trigger points:**

| Path          | Hook location                                          | Called after                                |
| ------------- | ------------------------------------------------------ | ------------------------------------------- |
| `/onboarding` | `finalize_onboarding_workspace` RPC (or post-RPC call) | Workspace + departments + locations created |
| `/join`       | `activate-workspace` EF                                | After agent profile creation                |
| Manual        | Admin UI (re-run bootstrap)                            | On demand                                   |

**Properties:** Idempotent. Auditable via `workspace_bootstrap_run`. Each step is logged. Partial completion is resumable.

### 5.2 Bootstrap Sequence

**Hard dependency: Step 2 must complete before Step 3.** Department type determines hours seeding behavior.

```
Step 1: workspace_operating_hours
  Source: company_opening_hours (intake from wizard) → copy to workspace_operating_hours
  Fallback: hospitality defaults (11:00-23:00 Mon-Sat, 12:00-22:00 Sun)
  One row per weekday.

Step 2: department.department_type (HARD DEPENDENCY for Step 3)
  Source: industry package name mapping
    Kitchen/Kjokken → operational (high confidence)
    Sal/Floor/Front of House → operational (high confidence)
    Bar → operational (high confidence)
    Kontor/Admin/HR/Regnskap → administrative (high confidence)
    Unknown names → operational (low confidence, flagged in warnings)
  Store: classification_source = 'industry_package', classification_confidence
  Low confidence → warning logged in workspace_bootstrap_run.warnings

Step 3: department_operating_hours (with offsets)
  Depends on: Step 1 (base hours) + Step 2 (department type)

  Operational departments:
    Compute absolute times from workspace base + hospitality default offsets:
      Kitchen: open_offset = -120, close_offset = 0
      Sal/Floor: open_offset = -60, close_offset = 0
      Bar: open_offset = 0, close_offset = 0
      Bar ute: open_offset = +240, close_offset = 0
      Default operational: open_offset = 0, close_offset = 0
    Set is_derived = true

  Administrative departments:
    Fixed scaffold: 09:00-17:00 Mon-Fri, closed Sat-Sun
    Set is_derived = false
    open_offset/close_offset = 0 (not offset-based by default)

Step 4: workspace_framework_binding
  Bind workspace to hospitality.no.default.v1
  Requires: K1a seed migration has run (framework exists)

Step 5: tariff_rate_table (workspace rows)
  Copy K1a platform baseline rates (NULL workspace_id rows) to workspace scope
  Set: workspace_id, seeded_from_framework_binding_id, seeded_at = now()
  ON CONFLICT DO NOTHING (idempotent)

Step 6: planning_cycle
  Create default 4-week rolling cycle
  Linked to active season
  Status: active

Step 7: season_budget enrichment
  Populate from wizard intake data:
    expectedRevenue → season_budget.total_target
    targetMargin → season_budget.target_margin (NOT labor_percentage)
  labor_percentage: suggest from industry defaults (e.g. 30% for restaurants)
    but do NOT derive from targetMargin — they are independent variables
  Scraped data: stored as provenance/comparison, never overwrites user input

Step 8: day_factor + hour_factor
  Seed from hospitality industry defaults
  Weekday distribution: higher weight on Fri-Sat
  Hour distribution: peak at 18:00-21:00

Step 9: payroll_profile_template
  Seed workspace defaults from industry package:
    "Servitor heltid" (hourly, 37.5h, ufaglart, fast)
    "Servitor deltid" (hourly, 20h, ufaglart, deltid)
    "Kokk heltid" (hourly, 37.5h, faglart, fast)
    "Leder" (monthly, 37.5h, leder, fast)
  Set: is_system_template=true, is_locked=false, seed_source, seed_version, seeded_at

Step 10: engine_authority_config
  Check if already created (activate-workspace may have done this)
  If missing: seed 9 capabilities x default authority levels
```

---

## 6. K1a Platform Seed — `hospitality.no.default.v1`

### 6.1 Regulatory Framework

One `regulatory_framework` row:

- `slug`: `hospitality.no.default.v1`
- `name`: Norsk serveringsbransje — grunnpakke
- `jurisdiction`: NO
- `industry`: hospitality
- `version`: 1
- `status`: active

### 6.2 V1 Baseline Framework Rules

These are baseline framework rules for `hospitality.no.default.v1`, not an exhaustive legal model. They encode the operational minimum for shift validation and compliance checking.

| Rule                                   | Type       | Threshold                    | Outcome if violated              | Source                  |
| -------------------------------------- | ---------- | ---------------------------- | -------------------------------- | ----------------------- |
| Minimum rest between shifts            | gate       | 11 hours                     | blocked                          | Arbeidsmiljoloven §10-8 |
| Maximum daily work hours               | gate       | 9 hours (10h with agreement) | blocked / allowed_with_exception | AML §10-4               |
| Maximum weekly work hours              | gate       | 40 hours                     | blocked                          | AML §10-4               |
| Overtime requires written agreement    | gate       | >9h/day or >40h/week         | review_required                  | AML §10-6               |
| Under-18 max daily hours               | gate       | 8 hours                      | blocked                          | AML §11-2               |
| Under-18 no night work                 | gate       | 21:00-06:00                  | blocked                          | AML §11-3               |
| Sunday/holiday work requires agreement | constraint | any shift on Sunday/holiday  | review_required                  | AML §10-10              |
| Split shift unpaid gap limit           | advisory   | max 2 hours unpaid           | allowed_with_exception           | Riksavtalen             |

### 6.3 Framework Triggers

| Trigger               | Type         | Mode         | Fires when                         |
| --------------------- | ------------ | ------------ | ---------------------------------- |
| shift_created         | state_change | state_change | New shift inserted                 |
| shift_updated         | state_change | state_change | Shift times/assignment changed     |
| schedule_published    | state_change | state_change | Batch of shifts published          |
| hours_exceeded_daily  | threshold    | threshold    | Employee's daily hours > 9         |
| hours_exceeded_weekly | threshold    | threshold    | Employee's weekly hours > 40       |
| rest_period_violated  | threshold    | threshold    | Gap between shifts < 11h           |
| age_restriction_check | state_change | state_change | Shift assigned to under-18 profile |
| holiday_shift_check   | state_change | state_change | Shift on public_holiday date       |

### 6.4 Tariff Rate Baseline (Riksavtalen — Correct Rates)

Platform-level rows (`workspace_id IS NULL`):

| Rate type           | Amount | Unit      | Applies               |
| ------------------- | ------ | --------- | --------------------- |
| kveldstillegg       | 15.65  | kr/h      | 21:00-06:00           |
| helgetillegg        | 29.74  | kr/h      | Sat 15:00 - Sun 24:00 |
| helligdagstillegg   | 100    | % of base | Public holidays       |
| overtidstillegg_50  | 50     | % of base | First 2h overtime     |
| overtidstillegg_100 | 100    | % of base | Overtime beyond 2h    |

---

## 7. Employee Invite → Contract → Payroll Cascade

### 7.1 Profile State Machine (Replaces Trainee Dead-End)

Current broken state: `trainee` forever, no promotion logic.

New state transitions:

```
invited (invitation created, not yet accepted)
  → pending_employment_setup (invitation accepted, profile created)
    → active (payroll profile created — operational employee)
  → active (guest invite accepted — no payroll needed)
```

**Promotion rule:** Employee invite accepted + payroll profile seeded = `active` profile. Contract signing refines employment state but does not gate activation.

**Note:** This requires either adding `pending_employment_setup` to the `profile_status` enum or using `trainee` for the intermediate state and promoting to `active` within the same accept-invitation transaction. Recommendation: use existing `trainee` as the intermediate state, promote to `active` at end of accept-invitation when payroll profile is created. This avoids enum migration.

### 7.2 Invite Dialog Changes

**New field:** `employment_type: 'employee' | 'guest'`

**When `employee` is selected, require:**

| Field                 | Type    | Required | Notes                                   |
| --------------------- | ------- | -------- | --------------------------------------- |
| department            | UUID[]  | Yes      | Existing field                          |
| role                  | enum    | Yes      | Existing field (employee/manager/admin) |
| employment_category   | text    | Yes      | fast/deltid/tilkalling                  |
| salary_type           | text    | Yes      | hourly/monthly                          |
| intended_weekly_hours | numeric | Yes      | From template or manual                 |
| start_date            | date    | Yes      | Employment start                        |
| payroll_template_id   | UUID    | No       | Pre-defined template selection          |

**When `guest` is selected:** Only name, email, department, role required. No payroll cascade.

Employment metadata stored in `invitation.metadata` JSONB (already exists).

### 7.3 Accept-Invitation Cascade (Employee Type)

```
accept-invitation EF (employment_type = 'employee'):

  1. Create auth user + user_identity (existing)

  2. Create profile
     status: 'trainee' (intermediate)
     department, role from invitation

  3. Create employment_contract (status: draft)
     position_title: from invitation role
     employment_category: from invitation metadata
     hourly_rate: from payroll template or tariff baseline
     start_date: from invitation metadata

  4. Create employee_payroll_profile
     seeded_from_template_id: if template selected
     employment_contract_id: FK to draft contract
     salary_type: from invitation metadata
     agreed_weekly_hours: from invitation metadata
     tariff_category: from template
     valid_from: start_date
     seeded_at: now()

  5. Update profile.status = 'active'
     (payroll profile created = employee is operational)

  6. Emit: employee.onboarded event
     (triggers engine workflows: protocol assignment, training, etc.)
```

**Guest invite:** Steps 1-2 only. Profile status set to `active` directly. No contract, no payroll profile.

### 7.4 Contract Signed → Payroll Profile Sync

When `employment_contract.status` changes to `signed`:

- Update `employee_payroll_profile` with finalized contract values (rate, hours, category)
- If contract terms differ from template seed, contract wins
- Store sync metadata: `synced_from_contract_at`, previous values in activity_trail

---

## 8. Change Proposal Lifecycle (C4 Governance)

### 8.1 Triggers Requiring Proposals

Phase B scope — only these changes go through the proposal pipeline:

| Change                                     | Trigger                                                             |
| ------------------------------------------ | ------------------------------------------------------------------- |
| Workspace base hours change                | Admin edits `workspace_operating_hours`                             |
| Department operating hours change (direct) | Admin edits `department_operating_hours` where `is_derived = false` |
| Department type change                     | Admin changes `department.department_type`                          |

Framework rule changes and tariff rate changes are deferred to a later phase.

### 8.2 Flow

```
1. PREVIEW
   Admin initiates change (UI)
   → System computes impact:
     affected_departments (is_derived=true rows that would re-compute)
     affected_sessions (future upcoming department_sessions with new planned times)
     affected_shifts (anchored shifts with new times)
     affected_hooks (session_hook firing times recalculated)
     impacted_confirmed_shifts (published/confirmed shifts that conflict)
   → Creates change_proposal (status: pending)
     proposal_payload: the change itself
     preview_payload: computed impact
     initiator: cascade_initiator = 'admin_manual'

2. REVIEW
   Admin reviews preview in UI
   Preview shows:
     "5 sessions will update planned times"
     "12 unconfirmed shifts will auto-adjust"
     "3 confirmed shifts require manual review" (listed with employee names)

3. APPROVE / REJECT
   Admin approves → status: approved
   Admin rejects → status: rejected (no changes applied)

4. APPLY (transactional)
   apply_change_proposal(proposal_id):
     a. Apply the base change (workspace_operating_hours or department hours or dept type)
     b. Re-compute all is_derived=true department_operating_hours (base + offsets)
     c. UPDATE future upcoming department_sessions planned_open/planned_close
     d. Auto-adjust future unconfirmed shifts (anchored to new times)
     e. Mark impacted confirmed/published shifts as requiring review (NOT auto-mutated)
     f. Recalculate session_hook firing times
     g. INSERT activity_trail entries for every mutation (before/after)
     h. EMIT operating_hours.changed engine_event
     i. UPDATE change_proposal status → applied, applied_at = now()

5. NEVER:
   Past sessions/shifts → never mutated automatically
   Current active sessions → never mutated automatically
   Confirmed/published future shifts → flagged as impacted, not auto-changed
```

### 8.3 Shift Impact Policy (Phase B)

| Shift state                            | Treatment on cascade                                                |
| -------------------------------------- | ------------------------------------------------------------------- |
| Future, unconfirmed (created/assigned) | Auto-adjust                                                         |
| Future, confirmed/published            | Mark as impacted, require explicit admin review in proposal preview |
| Current (active)                       | Never mutate                                                        |
| Past (completed)                       | Never mutate                                                        |

### 8.4 Approval

Admins only for Phase B. `engine_authority_config` remains separate — it controls AI/agent permissions, not human approval workflows.

---

## 9. Framework Rule Evaluation (Complete)

### 9.1 `evaluateFrameworkRules()` — Phase B Completion

| Capability                                                                     | Status |
| ------------------------------------------------------------------------------ | ------ |
| Load all rules matching a trigger type                                         | NEW    |
| Evaluate each rule against entity context                                      | NEW    |
| Employee-context fields (age, contract type, seniority, weekly hours)          | NEW    |
| Workspace rule overrides layered on framework defaults                         | NEW    |
| Severity ranking: blocked > review_required > allowed_with_exception > allowed | NEW    |
| Return all hits + highest-severity result                                      | NEW    |
| Light explanation payload (rule name + reason string)                          | NEW    |

**Signature:**

```typescript
evaluateFrameworkRules(
  workspaceId: string,
  triggerType: FrameworkTriggerType,
  entityContext: {
    profileId?: string;
    shiftId?: string;
    date: string;
    employeeAge?: number;
    contractType?: string;
    weeklyHoursWorked?: number;
    dailyHoursWorked?: number;
    lastShiftEnd?: string;  // ISO timestamp
  },
  frameworkRules: FrameworkRuleRow[],
  workspaceOverrides: WorkspaceRuleOverrideRow[],
): EvaluationResult
```

**Returns:**

```typescript
type EvaluationResult = {
  outcome: "allowed" | "allowed_with_exception" | "review_required" | "blocked";
  hits: Array<{
    ruleId: string;
    ruleName: string;
    ruleType: FrameworkRuleType;
    outcome: EvaluationOutcome;
    reason: string; // human-readable explanation
    overrideApplied: boolean;
    overrideId?: string;
  }>;
  worstHit: (typeof hits)[number] | null;
};
```

### 9.2 `resolve_tariff_rate()` RPC

**Input:** employee/profile + effective timestamp (not just date).

```typescript
resolve_tariff_rate(
  profileId: string,
  effectiveTimestamp: string,  // ISO datetime — supplements are time-sensitive
  departmentId?: string,       // future: department-specific supplements
): TariffResolution
```

**Resolution chain:**

1. `employee_payroll_profile.tariff_override_id` → specific rate (highest priority)
2. `employee_payroll_profile.tariff_category` → workspace `tariff_rate_table` match
3. Fallback: K1a platform baseline (NULL workspace_id rows)

**Returns:** base_rate + applicable supplements for that timestamp:

- Evening supplement (kveldstillegg) if time is 21:00-06:00
- Weekend supplement (helgetillegg) if Sat 15:00 - Sun 24:00
- Holiday supplement (helligdagstillegg) if date matches `public_holiday`
- Overtime supplements (50% / 100%) based on daily/weekly hour thresholds

---

## 10. Operational vs Administrative — Formal Rules

### 10.1 Behavior Matrix

| Feature                                  | Operational                         | Administrative           |
| ---------------------------------------- | ----------------------------------- | ------------------------ |
| Appears in schedule planner              | Yes                                 | Yes                      |
| Can have shifts assigned                 | Yes                                 | Yes                      |
| Contributes to labor cost reports        | Yes                                 | Yes                      |
| Has `department_operating_hours` entries | Yes                                 | Yes                      |
| Employees have payroll profiles          | Yes                                 | Yes                      |
| `department_session` created daily       | Yes                                 | **No**                   |
| Session hooks fire                       | Yes                                 | **No**                   |
| Reconciliation / daily close             | Yes                                 | **No**                   |
| Session tasks materialized               | Yes                                 | **No**                   |
| Hours `is_derived` default               | `true` (offset from workspace base) | `false` (fixed scaffold) |
| Default hours                            | Workspace base + industry offset    | 09:00-17:00 Mon-Fri      |

### 10.2 `is_derived` Semantics

- `is_derived = true`: absolute hours are recomputed from workspace base + offsets when base hours change.
- `is_derived = false`: absolute hours are manually controlled and do not recascade from workspace base.
- Administrative departments start as `is_derived = false` but CAN be switched to `true` if the business wants admin hours anchored to business hours.
- Operational departments start as `is_derived = true` but CAN be switched to `false` for manual control.

### 10.3 Session Generation Filter

The session generation logic (nightly job or on schedule publish) must filter:

```sql
WHERE department.department_type = 'operational'
   OR department.department_type = 'hybrid'
```

Administrative departments are excluded from session creation.

---

## 11. Planning Cycle

### 11.1 Definition

A planning cycle is a rolling tactical planning horizon. It includes:

- Shift scheduling (who works when)
- Task assignments (what needs doing this cycle)
- Training goals (what employees should learn)
- Budget coordination (spending targets for the period)

### 11.2 Relationship to Season

Season is strategic/business-period scope (months). Planning cycle is tactical/rolling scope within a season (weeks).

A season contains multiple planning cycles. When a cycle ends, the next one starts automatically within the same season.

### 11.3 Bootstrap Default

4-week rolling cycle, customizable by admin. Linked to the active season.

---

## 12. Season Budget Enrichment

### 12.1 Data Flow

```
Onboarding wizard (season step)
  expectedRevenue → season_budget.total_target
  targetMargin → season_budget.target_margin

  labor_percentage: NOT derived from targetMargin
    Suggested from industry defaults (e.g. 30% for restaurants)
    Or from prior data / scraping results
    But always explicit user input or clearly labeled suggestion
```

**targetMargin is a profitability target. labor_percentage is a cost-ratio component. They are independent variables.** The spec must not conflate them.

### 12.2 Scraped Data Treatment

- Scraped financial data (from proff.no in future, or Brreg employee count) → stored as provenance and comparison baseline
- Never overwrites user-entered values
- Can be shown as "industry suggests 28% labor cost" or "last year's revenue was X kr"
- Stored in `workspace.intelligence_data` JSONB (already exists)

### 12.3 proff.no Integration (Deferred)

Design for it now: `workspace.intelligence_data.proff` field reserved. Scraping endpoint spec defined. Implementation deferred until bandwidth allows.

---

## 13. Affected Files

### 13.1 New Files

| File                                                | Purpose                                                     |
| --------------------------------------------------- | ----------------------------------------------------------- |
| `supabase/migrations/YYYYMMDD_cascade_b_schema.sql` | New tables + ALTER statements                               |
| `supabase/migrations/YYYYMMDD_cascade_k1a_seed.sql` | K1a platform data: framework, rules, triggers, tariff rates |
| `supabase/functions/bootstrap-cascade/index.ts`     | Shared bootstrap service                                    |
| `apps/web/src/lib/cascade/resolve-tariff-rate.ts`   | Tariff resolution pure function                             |

### 13.2 Modified Files

| File                                                                     | Change                                                          |
| ------------------------------------------------------------------------ | --------------------------------------------------------------- |
| `supabase/functions/activate-workspace/index.ts`                         | Call bootstrap-cascade after agent profile                      |
| `supabase/migrations/*_finalize_onboarding*.sql`                         | Call bootstrap-cascade after finalization                       |
| `supabase/functions/accept-invitation/index.ts`                          | Employee cascade: contract + payroll profile + status promotion |
| `apps/web/src/app/dashboard/people/_components/invite-member-dialog.tsx` | Add employment_type, payroll fields                             |
| `apps/web/src/lib/cascade/evaluate-framework-rules.ts`                   | Complete: multi-rule, context, overrides                        |
| `apps/web/src/lib/cascade/types.ts`                                      | New types for evaluation, tariff, bootstrap                     |
| `apps/web/src/lib/cascade/resolve-hours.ts`                              | No signature change — works on absolute times                   |
| `apps/web/src/app/dashboard/settings/_hooks/use-operating-hours.ts`      | Show offsets, compute preview from base                         |
| `apps/web/src/lib/industry/packages/hospitality.ts`                      | Fix tariff rates, add department offsets, add payroll templates |
| `apps/web/src/app/dashboard/schedule/page.tsx`                           | Filter session creation by department_type                      |

### 13.3 Files to Verify (Dependencies)

| File                                                                              | Why                                                        |
| --------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| `apps/web/src/app/dashboard/schedule/_hooks/use-planned-hours.ts`                 | Uses resolveEffectiveHours — may need base hours awareness |
| `apps/web/src/app/dashboard/season/_components/HourFactorsTab.tsx`                | Derives hour range from department hours                   |
| `apps/web/src/app/dashboard/website/_hooks/use-company-hours.ts`                  | Reads company_opening_hours — bootstrap source             |
| `apps/web/src/app/join/_lib/setupActions.ts`                                      | Writes company_opening_hours — intake point                |
| `supabase/functions/engine-dispatch/index.ts`                                     | Session creation must respect department_type filter       |
| `apps/web/src/app/dashboard/schedule/_components/day-control/DayControlPanel.tsx` | Tab visibility by department_type                          |

---

## 14. Migration Validation

**First step before any implementation:** Validate existing A1+A2 cascade migrations.

```bash
npx supabase db reset
# Verify: all 7 cascade migrations apply cleanly
# Verify: department_type enum exists
# Verify: department_operating_hours table exists with expected schema
# Verify: framework tables exist
# Verify: all RLS policies active
```

If `db reset` fails, fix migrations before proceeding.

---

## 15. Build Order

### Phase 1: Validate + Seed (blocks everything)

1. `supabase db reset` — validate A1+A2 migrations
2. K1a seed migration — hospitality.no.default.v1 framework + rules + triggers + tariff rates
3. `workspace_operating_hours` table migration
4. `payroll_profile_template` table migration
5. `workspace_bootstrap_run` table migration
6. ALTER migrations: dept_operating_hours offsets, invitation employment_type, payroll provenance, tariff provenance, department classification fields

### Phase 2: Bootstrap Service (unblocks workspace creation)

7. `bootstrap-cascade` Edge Function — full 10-step sequence
8. Hook into `activate-workspace` (join path)
9. Hook into `finalize_onboarding_workspace` (onboarding path)
10. Fix `hospitality.ts` — correct tariff rates, add department offsets, add payroll templates

### Phase 3: Invite → Contract → Payroll Cascade

11. Update invite dialog — employment_type, payroll fields
12. Update `accept-invitation` EF — contract + payroll profile cascade
13. Profile status promotion logic (trainee → active on payroll profile creation)
14. Contract signed → payroll profile sync

### Phase 4: Hours Cascade + Change Proposals

15. `resolveEffectiveHours()` awareness of base + offset model
16. `useOperatingHours()` refactor for offset display
17. Change proposal creation (preview computation)
18. Change proposal apply (transactional cascade)
19. Change proposal UI (preview + approve/reject)

### Phase 5: Rule Evaluation + Tariff Resolution

20. `evaluateFrameworkRules()` completion
21. `resolve_tariff_rate()` pure function
22. Wire evaluation into shift creation/update flow
23. Wire tariff resolution into cost snapshot population

---

## Changelog

| Date       | Version | Change                                          | Author          |
| ---------- | ------- | ----------------------------------------------- | --------------- |
| 2026-03-22 | 1.0.0   | Initial spec — Approach B foundation completion | Claude + Pontus |
