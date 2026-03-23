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
- `resolveTariffRate()` pure function + `getTariffContext()` loader (timestamp-based)
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
3. No workspace may be marked bootstrap-complete while any active department lacks operating hours entries.
4. Every employee invite must resolve to either guest access or employee setup.
5. Every employee setup must result in a payroll profile.
6. Administrative departments never create `department_session` records.
7. Workspace base hour changes never mutate past or current sessions/shifts.
8. User-entered values always win over scraped/inferred values for budget data.
9. Seeded data always carries provenance (source framework, version, timestamp). See Section 16 for standard provenance shape.
10. Bootstrap is idempotent — re-running does not duplicate or corrupt data.
11. Applying a change proposal must be idempotent and impossible unless `status = 'approved'` and `applied_at IS NULL`.

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

**Weekday convention:** All weekday handling in cascade/runtime uses 0=Mon...6=Sun (ISO-style). This matches `department_operating_hours.day_of_week` and `resolveEffectiveHours()`. JavaScript `Date.getDay()` returns 0=Sun — callers must convert.

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
  framework_binding_id UUID REFERENCES workspace_framework_binding(id),
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
  ADD COLUMN classification_source TEXT CHECK (classification_source IN ('industry_package', 'admin_confirmed', 'manual')),
  ADD COLUMN classification_confidence TEXT CHECK (classification_confidence IN ('high', 'medium', 'low'));
```

Used by bootstrap to flag low-confidence inferences for admin review.

#### `invitation` — add invite employment type

```sql
ALTER TABLE invitation
  ADD COLUMN invite_employment_type TEXT CHECK (invite_employment_type IN ('employee', 'guest'));
```

Named `invite_employment_type` (not `employment_type`) to avoid confusion with `employment_category` (fast/deltid/tilkalling) which describes the employment model. `invite_employment_type` describes whether this invite creates an employee or a guest.

Nullable for backwards compatibility with existing invitations. Required for new invites going forward.

#### `employee_payroll_profile` — add provenance columns

`employee_payroll_profile` already contains the core contract/tariff linkage (`employment_contract_id`, `tariff_override_id`, `tariff_category`, etc.). This spec adds provenance columns only.

```sql
ALTER TABLE employee_payroll_profile
  ADD COLUMN seeded_from_template_id UUID REFERENCES payroll_profile_template(id),
  ADD COLUMN seeded_at TIMESTAMPTZ;
```

#### `season_budget` — add target_margin column

```sql
ALTER TABLE season_budget
  ADD COLUMN target_margin NUMERIC(5,2);

COMMENT ON COLUMN season_budget.target_margin IS
  'Profitability target (%). Independent from target_labor_percentage which is a cost ratio.';
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
| `/onboarding` | `finalize-workspace` Edge Function (post-finalization) | Workspace + departments + locations created |
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
  Idempotent via EXCLUDE constraint: (rate_type, workspace_id, daterange(effective_from, effective_until))
  Conflicts are caught by the exclusion constraint — no duplicate rate+period per workspace

Step 6: planning_cycle
  Create default 4-week rolling cycle
  Linked to active season
  Status: active

Step 7: season_budget enrichment
  If user-entered budget data exists (expectedRevenue, targetMargin):
    expectedRevenue → season_budget.total_target_revenue
    targetMargin → season_budget.target_margin (NEW COLUMN, NOT target_labor_percentage)
  If no intake data (e.g. /join path with partial data):
    Create season_budget with status='draft', NULL targets
    Suggest industry defaults as starting point (displayed in UI, not auto-saved)
    Mark provenance: { source: 'bootstrap_default', needs_user_input: true }
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

- `code`: `hospitality.no.default.v1`
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

Triggers are seeded as `framework_trigger` rows. The `code` column holds the trigger identifier (free text). The `trigger_mode` column uses the `framework_trigger_mode` enum (`state_change`/`time_based`/`threshold`/`external_event`). The `trigger_type` column uses `framework_trigger_type` enum — use the closest match from existing values.

| Code (free text)      | trigger_type (enum) | trigger_mode (enum) | Fires when                         |
| --------------------- | ------------------- | ------------------- | ---------------------------------- |
| shift_created         | operating_hours     | state_change        | New shift inserted                 |
| shift_updated         | operating_hours     | state_change        | Shift times/assignment changed     |
| schedule_published    | operating_hours     | state_change        | Batch of shifts published          |
| hours_exceeded_daily  | operating_hours     | threshold           | Employee's daily hours > 9         |
| hours_exceeded_weekly | operating_hours     | threshold           | Employee's weekly hours > 40       |
| rest_period_violated  | operating_hours     | threshold           | Gap between shifts < 11h           |
| age_restriction_check | manual_override     | state_change        | Shift assigned to under-18 profile |
| holiday_shift_check   | season_transition   | state_change        | Shift on public_holiday date       |

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

#### Conceptual Process State

```
invited (invitation created, not yet accepted)
  → pending_employment_setup (invitation accepted, employee profile being configured)
    → active (payroll profile created — operational employee)
  → active (guest invite accepted — no payroll needed)
```

#### Stored `profile_status` in Phase B

The existing `profile_status` enum (`trainee`/`active`/`inactive`/`offboarding`) is sufficient. No enum migration needed.

- `trainee`: used as temporary intermediate state during accept-invitation transaction
- `active`: set at end of accept-invitation when payroll profile is created (employee) or immediately (guest)

The conceptual "pending_employment_setup" maps to `trainee` in storage. The key change is that `trainee` is no longer a dead-end — it is promoted to `active` within the same transaction.

**Promotion rule:** Employee invite accepted + payroll profile seeded = `active` profile. Contract signing refines employment state but does not gate activation.

**Guest → employee conversion:** Supported later through an explicit admin flow (change employment_type, add payroll fields, trigger contract + payroll cascade). This is NOT part of the accept-invitation transaction — it is a separate admin action.

### 7.2 Invite Dialog Changes

**New field:** `invite_employment_type: 'employee' | 'guest'`

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
accept-invitation EF (invite_employment_type = 'employee'):

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

### 8.5 Proposal Status Transitions

```
pending → approved    (admin approves)
pending → rejected    (admin rejects)
approved → applied    (apply_change_proposal() succeeds)
approved → failed     (apply_change_proposal() errors)
applied  → terminal
rejected → terminal
failed   → pending    (admin can re-review after fix)
```

**Guards:**

- `apply_change_proposal()` only executes when `status = 'approved' AND applied_at IS NULL`
- Status transitions are one-way (no approved → pending, no applied → approved)
- `failed` can return to `pending` for re-review — the only non-terminal backward transition

---

## 9. Framework Rule Evaluation (Complete)

### 9.1 Architecture: Loader + Pure Evaluator

Two-layer design:

1. **Loader** (service layer, upstream caller): loads applicable `framework_rule` rows + `workspace_rule_override` rows for the workspace and trigger type. Passes them to the evaluator.
2. **Pure evaluator** (`evaluateFrameworkRules`): deterministic function. Takes pre-loaded rules + context, returns evaluation result. No DB access.

### 9.2 `evaluateFrameworkRules()` — Phase B Rewrite

**Breaking change:** The existing `evaluateFrameworkRules()` has a different signature (`proposedChanges, rules, workspaceOverrides, evaluationDate`) and returns `Conflict[]`. This spec defines a complete rewrite with a new signature and return type. The existing 29 tests in `__tests__/evaluate-framework-rules.test.ts` must be rewritten to match the new interface. The existing function evaluated proposed cascade changes against rules; the new function evaluates shift/schedule actions against framework rules with employee context — a fundamentally different concern.

| Capability                                                                     | Status |
| ------------------------------------------------------------------------------ | ------ |
| Evaluate all pre-loaded rules against entity context                           | NEW    |
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

### 9.3 Tariff Resolution — Loader + Pure Resolver

Same two-layer design as rule evaluation:

1. **`getTariffContext()`** (DB query helper): loads `employee_payroll_profile`, applicable `tariff_rate_table` rows, and `public_holiday` status for the date. Returns a `TariffContext` object.
2. **`resolveTariffRate()`** (pure function in `apps/web/src/lib/cascade/resolve-tariff-rate.ts`): takes pre-loaded context + timestamp, returns rate + supplements. No DB access.

**`resolveTariffRate()` signature:**

```typescript
resolveTariffRate(
  context: TariffContext,       // pre-loaded payroll profile + tariff rows + holiday status
  effectiveTimestamp: string,   // ISO datetime — supplements are time-sensitive
): TariffResolution
```

**Resolution chain (inside pure function):**

1. `context.tariffOverride` → specific rate (highest priority, from `employee_payroll_profile.tariff_override_id`)
2. `context.tariffCategory` → matching workspace `tariff_rate_table` row
3. Fallback: K1a platform baseline rows (NULL workspace_id)

**Returns:**

```typescript
type TariffResolution = {
  baseRate: number; // kr/h or kr/month
  baseRateUnit: "hourly" | "monthly";
  supplements: Array<{
    type: string; // 'kveldstillegg' | 'helgetillegg' | 'helligdagstillegg' | 'overtid_50' | 'overtid_100'
    amount: number;
    unit: "kr/h" | "percent";
    reason: string; // human-readable: "21:00-06:00 evening supplement"
  }>;
  effectiveHourlyRate: number; // baseRate + all supplements resolved to kr/h
  sourceTier: "override" | "workspace" | "platform"; // which tariff_rate_table level was used
  tariffCategory: string | null; // e.g. 'ufaglart', 'faglart', 'leder'
};
```

Supplement rules:

- Evening (kveldstillegg): 21:00-06:00
- Weekend (helgetillegg): Sat 15:00 - Sun 24:00
- Holiday (helligdagstillegg): date matches `public_holiday`
- Overtime 50%: first 2h beyond daily/weekly threshold
- Overtime 100%: beyond 2h overtime

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

The session generation logic (in `engine-dispatch` or session creation service — NOT in page components) must filter:

```sql
WHERE department.department_type IN ('operational', 'hybrid')
```

Administrative departments are excluded from session creation.

**`hybrid` department type:** Exists in the enum (from A1 migration) but full behavior is not defined in this Phase B spec. For Phase B, `hybrid` is treated identically to `operational` for session generation, hooks, and reconciliation. The filter includes both types explicitly so the SQL and the spec agree.

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
  expectedRevenue → season_budget.total_target_revenue (existing column)
  targetMargin → season_budget.target_margin (NEW COLUMN — requires ALTER TABLE)

  target_labor_percentage (existing column): NOT derived from target_margin
    Suggested from industry defaults (e.g. 30% for restaurants)
    Or from prior data / scraping results
    But always explicit user input or clearly labeled suggestion
```

**Schema note:** `season_budget` currently has `total_target_revenue` and `target_labor_percentage` but NO `target_margin` column. This spec adds `target_margin NUMERIC(5,2)` via ALTER TABLE. targetMargin (profitability target) and target_labor_percentage (cost ratio) are independent variables — the spec must not conflate them.

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
| `apps/web/src/lib/cascade/resolve-tariff-rate.ts`   | Tariff resolution pure function (no DB access)              |
| `apps/web/src/lib/cascade/get-tariff-context.ts`    | Tariff context loader (DB query helper)                     |

### 13.2 Modified Files

| File                                                                     | Change                                                                        |
| ------------------------------------------------------------------------ | ----------------------------------------------------------------------------- |
| `supabase/functions/activate-workspace/index.ts`                         | Call bootstrap-cascade after agent profile (join path)                        |
| `supabase/functions/finalize-workspace/index.ts`                         | Call bootstrap-cascade after finalization (onboarding path)                   |
| `supabase/functions/accept-invitation/index.ts`                          | Employee cascade: contract + payroll profile + status promotion               |
| `apps/web/src/app/dashboard/people/_components/invite-member-dialog.tsx` | Add invite_employment_type, payroll fields                                    |
| `apps/web/src/lib/cascade/evaluate-framework-rules.ts`                   | Rewrite: new signature, multi-rule, context, overrides. 29 tests must migrate |
| `apps/web/src/lib/cascade/types.ts`                                      | New types for evaluation, tariff, bootstrap                                   |
| `apps/web/src/lib/cascade/resolve-hours.ts`                              | No signature change — works on absolute times                                 |
| `apps/web/src/app/dashboard/settings/_hooks/use-operating-hours.ts`      | Show offsets, compute preview from base                                       |
| `apps/web/src/lib/industry/packages/hospitality.ts`                      | Fix tariff rates, add department offsets, add payroll templates               |
| `supabase/functions/engine-dispatch/index.ts`                            | Filter session creation by department_type (upsert_session handler)           |

### 13.3 Files to Verify (Dependencies)

| File                                                                              | Why                                                             |
| --------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| `apps/web/src/app/dashboard/schedule/_hooks/use-planned-hours.ts`                 | Uses resolveEffectiveHours — may need base hours awareness      |
| `apps/web/src/app/dashboard/season/_components/HourFactorsTab.tsx`                | Derives hour range from department hours                        |
| `apps/web/src/app/dashboard/website/_hooks/use-company-hours.ts`                  | Reads company_opening_hours — bootstrap source                  |
| `apps/web/src/app/join/_lib/setupActions.ts`                                      | Writes company_opening_hours — intake point                     |
| `apps/web/src/app/dashboard/schedule/_components/day-control/DayControlPanel.tsx` | Tab visibility by department_type (reduce tabs for admin depts) |
| `apps/web/src/app/dashboard/schedule/page.tsx`                                    | Department list filtering by type for planner display           |

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
6. ALTER migrations: dept_operating_hours offsets, invitation invite_employment_type, payroll provenance, tariff provenance, department classification fields

### Phase 2: Bootstrap Service (unblocks workspace creation)

7. `bootstrap-cascade` Edge Function — full 10-step sequence
8. Hook into `activate-workspace` (join path)
9. Hook into `finalize_onboarding_workspace` (onboarding path)
10. Fix `hospitality.ts` — correct tariff rates, add department offsets, add payroll templates

### Phase 3: Invite → Contract → Payroll Cascade

11. Update invite dialog — invite_employment_type, payroll fields
12. Update `accept-invitation` EF — contract + payroll profile cascade
13. Profile status promotion logic (trainee → active on payroll profile creation)
14. Contract signed → payroll profile sync

### Phase 4: Rule Evaluation + Tariff Resolution (unblocks governance)

15. `evaluateFrameworkRules()` completion (loader + pure evaluator)
16. `getTariffContext()` query helper
17. `resolveTariffRate()` pure function
18. Wire evaluation into shift creation/update flow
19. Wire tariff resolution into cost snapshot population

### Phase 5: Hours Cascade + Change Proposals (uses rule evaluation)

20. `resolveEffectiveHours()` awareness of base + offset model
21. `useOperatingHours()` refactor for offset display
22. Change proposal creation (preview computation, optionally rule-aware)
23. Change proposal apply (transactional cascade)
24. Change proposal UI (preview + approve/reject)

---

## 16. Provenance Fields — Standard Shape

All seeded, copied, or inferred data in the cascade system carries provenance. This is the standard shape used across tables.

| Field             | Type        | Purpose                                      | Example                                  |
| ----------------- | ----------- | -------------------------------------------- | ---------------------------------------- |
| `seed_source`     | TEXT        | Framework or package that produced this data | `hospitality.no.default.v1`              |
| `seed_version`    | TEXT        | Version of the source at seed time           | `1.0.0`                                  |
| `seeded_at`       | TIMESTAMPTZ | When the seed/copy occurred                  | `2026-03-22T14:30:00Z`                   |
| `copied_from_id`  | UUID        | Original row ID if this is a copy            | FK to platform-level row                 |
| `is_user_entered` | BOOLEAN     | True if value came from explicit user input  | `true` for wizard data                   |
| `is_inferred`     | BOOLEAN     | True if value was inferred by system         | `true` for dept type auto-classification |

Not every table needs all fields. Apply what is relevant:

| Table                                | Provenance fields used                                                         |
| ------------------------------------ | ------------------------------------------------------------------------------ |
| `tariff_rate_table` (workspace rows) | `seeded_from_framework_binding_id`, `seeded_at`                                |
| `payroll_profile_template`           | `seed_source`, `seed_version`, `seeded_at`, `is_system_template`, `is_locked`  |
| `employee_payroll_profile`           | `seeded_from_template_id`, `seeded_at`                                         |
| `department_operating_hours`         | `provenance` JSONB (already exists — carries source_type, backfill metadata)   |
| `department` (classification)        | `classification_source`, `classification_confidence`                           |
| `season_budget`                      | Store in existing metadata or provenance JSONB: `{ source, needs_user_input }` |
| `workspace_bootstrap_run`            | `source_path`, `framework_binding_id`                                          |

---

## 17. Bootstrap Completion Criteria

A bootstrap run (`workspace_bootstrap_run.status`) may only be set to `completed` if ALL of the following are true:

| #   | Criterion                                                                  | Verification                                   |
| --- | -------------------------------------------------------------------------- | ---------------------------------------------- |
| 1   | `workspace_operating_hours` exists for all 7 days                          | COUNT = 7 for workspace_id                     |
| 2   | Every active department has `department_type` set                          | No NULL department_type where is_active = true |
| 3   | Every active department has 7 weekday rows in `department_operating_hours` | COUNT = 7 per active department_id             |
| 4   | `workspace_framework_binding` exists and is_active = true                  | Exactly 1 active binding                       |
| 5   | Workspace-scoped `tariff_rate_table` rows exist                            | At least 1 row with this workspace_id          |
| 6   | `planning_cycle` exists for active season                                  | At least 1 row                                 |
| 7   | `season_budget` exists for active season                                   | At least 1 row (status may be draft)           |
| 8   | `payroll_profile_template` seeded                                          | At least 1 is_system_template = true row       |
| 9   | `engine_authority_config` exists or confirmed preexisting                  | At least 1 row for workspace                   |

If any criterion fails, bootstrap status = `partial` with the failing steps logged in `warnings`.

---

## Changelog

| Date       | Version | Change                                                                                                                                                                                                                                                                                                                                                                         | Author          |
| ---------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------- |
| 2026-03-22 | 1.0.0   | Initial spec — Approach B foundation completion                                                                                                                                                                                                                                                                                                                                | Claude + Pontus |
| 2026-03-22 | 1.1.0   | 14 corrections: scoped invariant #3, payroll schema consistency, FK on bootstrap_run, weekday convention, budget fallback, profile state split, guest conversion, invite_employment_type naming, proposal idempotency, evaluator/tariff loader+pure split, remove hybrid, session filter to engine-dispatch, reorder phases 4/5, add provenance + completion criteria sections | Claude + Pontus |
| 2026-03-22 | 1.2.0   | Spec review fixes: season_budget.total_target→total_target_revenue + new target_margin column, regulatory_framework.slug→code, evaluateFrameworkRules acknowledged as rewrite (not completion), finalize-workspace EF as onboarding hook (not RPC), framework trigger table corrected (code vs enum columns)                                                                   | Claude + Pontus |

## 18. Implementation Notes (From Spec Review)

Non-blocking items to address during implementation:

1. Add `seniority_start_date` handling to invite cascade — default to `start_date` from invite metadata
2. Add `set_updated_at()` triggers to all 3 new tables
3. Add API key RLS policies (`api_key_read_*`) to all 3 new tables per CLAUDE.md mandate
4. Define contract-signed sync mechanism — recommend Edge Function hook in existing `contract-lifecycle` EF
5. Add `description_no` to K1a framework rule seeds (i18n)
6. Add `emit()` calls for bootstrap mutations (framework binding, tariff seed, planning cycle, templates)
7. `planning_cycle` / season link: implicit via date overlap (start_date/end_date within season range). No FK needed.
8. `tariff_rate_table.seeded_from_framework_binding_id`: soft reference (no FK constraint) — audit-only field
9. `has_fagbrev` mapping: when template `tariff_category = 'faglart'`, set `has_fagbrev = true` on payroll profile
