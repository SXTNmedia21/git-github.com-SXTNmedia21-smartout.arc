---
title: "Overtime-cap default scope — workspace vs tariff vs framework — FK target table for overtime_cap_policy_id"
id: ADR-0254
status: proposed
layer: decision
created: 2026-04-30
updated: 2026-04-30
supersedes: []
relates_to:
  - ADR_0001
  - ADR_0090
  - ADR_0241
  - ADR_0252
---

# ADR-0254: Overtime-cap default scope — workspace vs tariff vs framework — FK target table for `overtime_cap_policy_id`

**Status:** Proposed
**Date:** 2026-04-30

---

## 1. Context and Problem Statement

### 1.1 Inherited ambiguity from ADR-0001-contract-service

ADR-0001-contract-service (`docs/architecture/contract-service/ADR-0001-kontrakt-og-lonnsprofil-fundament.md`, superseded 2026-04-29) decision **D3 §"Konsekvens"** reads at line 122:

> Engine har en `overtime_cap_default` per workspace (eller per tariff_id) basert på lov + standard

The phrase "per workspace (eller per tariff_id)" explicitly deferred choosing between two scopes. The same section at line 220 (§"Konsekvenser samlet") declares that Fase 0a migration must add:

> `overtime_cap_policy_id` på `employment_contract` (D3, valgfri FK)

No FK target table for `overtime_cap_policy_id` is defined anywhere in the codebase. The FK column on `employment_contract` therefore has no migration-safe landing target.

### 1.2 Current schema state (verified against `packages/supabase/src/database.types.ts`)

`employment_contract` already carries two overtime-related columns (lines 7580–7581):

```
overtime_agreement_type   → enum overtime_agreement_type (legal_default | local_tariff_agreement | arbeidstilsynet_vedtak)
overtime_framework_rule_id → uuid | null → FK → framework_rule.rule_id
```

These columns resolve **which agreement type** the contract operates under, and **which framework rule** governs evaluation, but they do not define the **numeric caps** (hours/week, hours/4-week, hours/year, warn threshold). The missing FK target is the gap this ADR closes.

There is no `overtime_cap_policy_id` column on `employment_contract` today. There is no `overtime_cap_policy` table. Both must be created before Phase 5 of PLAN-contract-employee.md can be implemented.

### 1.3 Blocked downstream work

Three concrete blockers that cannot be resolved until this decision is made:

1. **PLAN Phase 5 engine_event at 80% monthly cap** — ADR-0001-contract-service §"Risks" #6 and §"Open Questions" item #6, line 137: "engine_event ved 80% av månedlig overtid-tak". The engine cannot evaluate how close a profile is to its overtime cap if the cap values live in no table.

2. **ADR-0245 §H telemetry events** — `docs/decisions/0245-employee-contract-mobile-flow.md` Section H references `contract.overtime_cap_warning_threshold_crossed` and related events that feed the mobile push-trigger map (Section E). Neither the events nor the push-trigger are registerable until the policy-source table exists.

3. **`contract_pay_rule` overtime calculation** — any pay rule of `rule_type = 'overtime'` (confirmed in `packages/supabase/src/database.types.ts` line 1453 for the `pay_rule_type` enum) must evaluate against a ceiling. Without `overtime_cap_policy_id`, the ceiling is implicit code-knowledge — neither auditable nor variant.

### 1.3.1 Blocked cascade and ADR-0245 telemetry events in detail

**PLAN Phase 5 — the 80%-cap event** is defined in ADR-0001-contract-service §"Open Questions" #6 as:

> engine_event ved nær-tak (f.eks. 80% av månedlig overtid-tak) går til ansatt + leder

The event consumer exists as a pattern in stage-engine (pg_notify fanout per ADR-0186) and the push-trigger infrastructure exists per ADR-0245 §E. What is missing:

1. A numeric source for the threshold value (what is "80% of cap"?) — this is `overtime_cap_policy.max_yearly_hours × overtime_cap_policy.warn_threshold_pct`
2. A FK to resolve which policy applies to which employee — this is `employment_contract.overtime_cap_policy_id`
3. The event names and routing — declared in this ADR §4.H

**ADR-0245 §H (lines 204–218)** declares a telemetry registry contract for mobile contract events. The Section E push-trigger map (lines 150–162) routes `contract.obligation_due_soon` and related events through `engine_event` → stage-engine → `/api/push/dispatch` → FCM/APNs. The `contract.overtime_cap_warning_threshold_crossed` event follows the same fanout architecture. Without the policy table, the event cannot be emitted — there is no `policy_id` to include in the payload, and the payload schema requires `cap_threshold` and `hours_accrued` values derived from the policy row.

### 1.4 Norwegian legal framework

Aml. §10-6 (Arbeidsmiljøloven) establishes a three-tier overtime ceiling:

| Agreement basis | Max/week | Max/4-week | Max/year |
|---|---|---|---|
| **Standard** (§10-6 second ledd — no agreement) | 10 h | 25 h | 200 h |
| **Med tariffavtale / lokal avtale** (§10-6 third/fourth ledd) | 20 h | 50 h | 300 h |
| **Unntak §10-12** (nøkkelstilling, særlig uavhengig) | NULL | NULL | NULL |

**2024 update note (ADR-0241 Lovsen amendment 8, line 85):** The 2024 revision of Aml. §10-6 removed the fifth paragraph (særskilt skriftlig avtale uten tillitsvalgt). The correct references are now §10-6 second ledd (standard), §10-6 fourth ledd (lokal tariffavtale), and Arbeidstilsynet-vedtak (§10-6 sixth ledd). The existing `overtime_agreement_type` enum in the database — `legal_default | local_tariff_agreement | arbeidstilsynet_vedtak` — already reflects this 2024-revised three-tier model.

**Important:** Aml. §10-6 second ledd caps are **absolute upper bounds** for the `legal_default` tier. No workspace, no tariff, no individual agreement can exceed them for standard-tier employees. The DB constraint enforcing this must live at the database level — not in application code — so it cannot be accidentally bypassed by a future build agent (see Section 2.D).

---

## 2. Decision Drivers

- **PLAN Phase 5 is blocked** — the 80%-cap `engine_event` has no numeric source for its threshold calculation.
- **ADR-0245 push-trigger map is blocked** — `contract.overtime_cap_warning_threshold_crossed` event has no source-of-truth table.
- **DB correctness** — the FK column `overtime_cap_policy_id` declared in ADR-0001-contract-service D3 §Konsekvenser line 220 cannot be added without a referent table.
- **Cascade model (CLAUDE.md)** — the cascade model distinguishes K1a (platform-level, shared regulatory_framework rows without workspace_id) from workspace-scoped D2/D3 data. Overtime caps span both levels; mixing them in one table destroys the K1a/workspace boundary.
- **`framework_rule` is not a cap-values store** — `framework_rule` (ADR-0090, `docs/decisions/0090-framework-rule-evaluation-config-schema.md`) carries a typed condition tree and an `evaluation_outcome`. Its columns (`rule_type`, `category`, `code`, `evaluation_config`) describe *when* a rule fires and *what outcome* it produces — not numeric cap values. Reusing it for hour-caps would be a category error.
- **Legal certainty** — K1a Aml. §10-6 ceilings are non-negotiable and must be enforced by DB CHECK constraints, not application-layer guards that agents might silently skip.
- **Flexibility for atypical roles** — Aml. §10-12 (særlig uavhengig / nøkkelstilling) allows NULL caps for specific roles; the model must accommodate this without a special-case code path.

---

## 3. Considered Options

### Option 1 — New table `overtime_cap_policy` (workspace-scoped only)

Each workspace defines its own overtime cap rows. `employment_contract.overtime_cap_policy_id` FK to the workspace's policy. Pros: simple, workspace-isolated. Cons: every workspace must seed these rows from scratch; K1a Aml. §10-6 ceiling is not enforced at the data layer — only by application code, which agents can bypass.

### Option 2 — Reuse `framework_rule` rows with `category = 'overtime_cap'`

Encode numeric caps as `evaluation_config` JSONB on `framework_rule` rows. `overtime_framework_rule_id` (already on `employment_contract`) is repurposed to hold the cap-row reference. Pros: no new table, existing FK column reused. Cons: `framework_rule.evaluation_config` is a typed condition tree (ADR-0090), not a key-value store for numeric fields — this violates the schema contract of ADR-0090 lines 38–55; `framework_rule` has no `max_weekly_hours`, `max_yearly_hours` columns; making JSONB carry numeric caps makes them unindexable, unvalidatable by CHECK constraint, and opaque to DB-level enforcement of Aml. §10-6 ceilings.

### Option 2 — extended: why `framework_rule` cannot be the cap-values store

Before stating Option 3, it is worth being precise about why Option 2 fails structurally:

`framework_rule` (ADR-0090) carries `evaluation_config` as a JSONB column holding a typed condition tree:

```ts
type EvaluationConfig = {
  condition: Condition;
  outcome_if_match: EvaluationOutcome;
  outcome_if_no_match?: EvaluationOutcome;
  exception_reason?: string;
};
```

The node types are `all | any | not | equals | threshold | in | exists` — condition evaluation primitives, not numeric fields. A `framework_rule` row for overtime cannot have a `max_weekly_hours` column because `framework_rule` has no such column (verified: `database.types.ts` lines 8925–8990). One could encode `{ type: "threshold", path: "overtime_hours_this_week", op: "gte", value: 10 }` in `evaluation_config` — but then:

1. Reading the cap value back out ("what is the employee's current weekly cap?") requires parsing JSONB and extracting a nested `value` field — not a typed, indexable numeric column.
2. The CHECK constraint enforcement of Aml. §10-6 ceilings becomes impossible at the DB level — JSONB contents cannot be constrained by a PostgreSQL CHECK constraint.
3. The three Aml. §10-6 dimensions (weekly, 4-week, yearly) each need a separate `framework_rule` row, and the relationship between those three rows and a single employee contract becomes a non-trivial join.
4. Workspace admins cannot "tighten" the cap for their workspace without creating new `framework_rule` rows — a platform-level table — which requires admin access beyond their workspace scope.

Option 2 is therefore rejected not for lack of cleverness but because it puts cap-numeric data in a schema layer (K1a evaluation rules) that is not designed to carry or validate it.

### Option 3 — Hybrid: K1a `framework_rule` enforces absolute ceiling; new `overtime_cap_policy` provides workspace defaults; per-employee override on `employment_contract` (chosen)

Three layers, each at the right cascade level:

1. **K1a layer** — `framework_rule` rows (NULL `workspace_id`, shared per regulatory_framework) represent the Aml. §10-6 absolute ceiling as evaluation rules. These already exist conceptually in the K1a hospitality seed. They enforce the outer bound but do not hold numeric cap values directly.

2. **Workspace layer** — new table `overtime_cap_policy` (workspace-scoped, `workspace_id NOT NULL`) holds the numeric caps the workspace has chosen to apply, subject to Aml. §10-6 absolute bounds enforced via DB CHECK constraint. Workspace admin can tighten (e.g., "never schedule over 5h overtime/week even though law allows 10") but can never exceed the K1a ceiling.

3. **Per-employee layer** — `employment_contract.overtime_cap_policy_id` (nullable FK) lets admin point an individual contract to a non-default policy (e.g., "Sjef med nøkkelfunksjon — Aml. §10-12 unntak"). When NULL, the workspace default policy applies.

---

## 4. Decision Outcome

**Chosen: Option 3 — Hybrid three-layer model.**

### 4.0 What this ADR does NOT change

The following existing columns on `employment_contract` remain unchanged:

- `overtime_agreement_type` — still the canonical record of *which Aml. §10-6 tier* applies to the contract. This ADR does not redefine its semantics.
- `overtime_framework_rule_id` — still the FK to the `framework_rule` row that the C4 governance evaluator uses when evaluating overtime-related rule outcomes (e.g., "is this shift's overtime composition allowed given the contract's framework?"). This ADR does not change its meaning or replace it with `overtime_cap_policy_id`.

The three columns serve distinct purposes:

| Column | Layer | Answers |
|---|---|---|
| `overtime_agreement_type` | Contract metadata | "Under which legal tier does this contract operate?" |
| `overtime_framework_rule_id` | C4 governance | "Which evaluation rule controls overtime approval for this contract?" |
| `overtime_cap_policy_id` (new) | Numeric cap | "What are the actual hour limits, warn threshold, and agreement tier for this person?" |

They are complementary, not redundant. A contract can have `overtime_agreement_type = 'local_tariff_agreement'`, `overtime_framework_rule_id` pointing to the Riksavtalen overtime-gate rule, AND `overtime_cap_policy_id` pointing to the workspace's tariff-agreement policy (20h/week, 50h/4-week, 300h/year).

### 4.A New table `overtime_cap_policy`

```sql
-- Decision-level schema. Migration authored separately.
CREATE TABLE public.overtime_cap_policy (
  id                     uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id           uuid        NOT NULL REFERENCES public.workspace(workspace_id) ON DELETE CASCADE,
  name                   text        NOT NULL,
  -- Maps to the existing overtime_agreement_type enum already present in the DB.
  -- 'legal_default'         = Aml. §10-6 second ledd (no agreement; 10/25/200)
  -- 'local_tariff_agreement'= Aml. §10-6 fourth ledd (lokal tariffavtale; 20/50/300)
  -- 'arbeidstilsynet_vedtak'= Aml. §10-6 sixth ledd (Arbeidstilsynet approval)
  -- 'unntak_10_12'          = Aml. §10-12 (særlig uavhengig; NULL caps allowed)
  agreement_type         text        NOT NULL,
  -- NULL permitted only when agreement_type = 'unntak_10_12'
  max_weekly_hours       numeric(5,2),
  max_per_4_week_period  numeric(6,2),
  max_yearly_hours       numeric(7,2),
  -- Fraction of max_*_hours at which engine_event fires.
  -- Default 0.80 = PLAN Phase 5 "80% månedlig overtid-tak" trigger.
  warn_threshold_pct     numeric(4,3) NOT NULL DEFAULT 0.80,
  -- Exactly one per workspace must be flagged is_default = true.
  is_default             boolean      NOT NULL DEFAULT false,
  created_at             timestamptz  NOT NULL DEFAULT now(),
  updated_at             timestamptz  NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, name)
);

-- Enforce that each workspace has at most one default policy.
CREATE UNIQUE INDEX idx_overtime_cap_policy_one_default_per_workspace
  ON public.overtime_cap_policy (workspace_id)
  WHERE is_default = true;
```

**Rationale for `agreement_type` as `text` rather than the existing enum:**
The existing `overtime_agreement_type` enum (verified at `database.types.ts` line 20267) has values `legal_default | local_tariff_agreement | arbeidstilsynet_vedtak`. This ADR adds a fourth: `unntak_10_12`. Using `text` here avoids an `ALTER TYPE ADD VALUE` in the same migration wave as `CREATE TABLE`; a later migration can change the column to the enum once the enum is extended. Alternatively, the migration sortie that implements this ADR extends the enum first (preferred — keeps type safety). The column SHOULD be typed to the enum after extension. This is flagged in §8 Open Questions.

### 4.B FK column on `employment_contract`

```sql
-- Added in the same migration sortie as the table above.
ALTER TABLE public.employment_contract
  ADD COLUMN overtime_cap_policy_id uuid
    REFERENCES public.overtime_cap_policy(id)
    ON DELETE SET NULL;
```

**NULL semantics:** NULL means "use the workspace default." The runtime resolution chain is:

```
effective_policy = employment_contract.overtime_cap_policy_id
               || (SELECT id FROM overtime_cap_policy
                    WHERE workspace_id = employment_contract.workspace_id
                      AND is_default = true)
```

This two-step fallback must be implemented in all three consumers: the engine (Phase 5 cron), the `shift_pay_calculation` capability (ADR-0251), and the `contract` read capability (for display in ContractDetailScreen per ADR-0245 §A).

### 4.C CHECK constraints — K1a Aml. §10-6 ceiling enforced at DB level

The following constraints enforce that no workspace policy can exceed the national law ceiling for its tier. A workspace admin can only *tighten* the policy (e.g., set `max_weekly_hours = 5` on a `legal_default`-tier policy), never loosen it beyond what the tier permits.

```sql
ALTER TABLE public.overtime_cap_policy
  ADD CONSTRAINT chk_overtime_cap_agreement_type
    CHECK (agreement_type IN (
      'legal_default',
      'local_tariff_agreement',
      'arbeidstilsynet_vedtak',
      'unntak_10_12'
    )),
  ADD CONSTRAINT chk_overtime_cap_legal_default_weekly
    CHECK (
      agreement_type <> 'legal_default'
      OR (max_weekly_hours IS NOT NULL AND max_weekly_hours <= 10)
    ),
  ADD CONSTRAINT chk_overtime_cap_legal_default_4week
    CHECK (
      agreement_type <> 'legal_default'
      OR (max_per_4_week_period IS NOT NULL AND max_per_4_week_period <= 25)
    ),
  ADD CONSTRAINT chk_overtime_cap_legal_default_yearly
    CHECK (
      agreement_type <> 'legal_default'
      OR (max_yearly_hours IS NOT NULL AND max_yearly_hours <= 200)
    ),
  ADD CONSTRAINT chk_overtime_cap_tariff_weekly
    CHECK (
      agreement_type <> 'local_tariff_agreement'
      OR (max_weekly_hours IS NOT NULL AND max_weekly_hours <= 20)
    ),
  ADD CONSTRAINT chk_overtime_cap_tariff_4week
    CHECK (
      agreement_type <> 'local_tariff_agreement'
      OR (max_per_4_week_period IS NOT NULL AND max_per_4_week_period <= 50)
    ),
  ADD CONSTRAINT chk_overtime_cap_tariff_yearly
    CHECK (
      agreement_type <> 'local_tariff_agreement'
      OR (max_yearly_hours IS NOT NULL AND max_yearly_hours <= 300)
    ),
  ADD CONSTRAINT chk_overtime_cap_arbeidstilsynet_non_null
    CHECK (
      agreement_type <> 'arbeidstilsynet_vedtak'
      OR (max_weekly_hours IS NOT NULL AND max_per_4_week_period IS NOT NULL AND max_yearly_hours IS NOT NULL)
    ),
  ADD CONSTRAINT chk_overtime_cap_unntak_null
    CHECK (
      agreement_type <> 'unntak_10_12'
      OR (max_weekly_hours IS NULL AND max_per_4_week_period IS NULL AND max_yearly_hours IS NULL)
    ),
  ADD CONSTRAINT chk_overtime_cap_warn_threshold_range
    CHECK (warn_threshold_pct > 0 AND warn_threshold_pct < 1);
```

**Design principle:** These constraints are not application-level validation — they are DB-enforced. Any future build agent writing to `overtime_cap_policy` will receive a `23514 check_violation` on INSERT if it tries to create a policy that exceeds Aml. §10-6 bounds. This is the correct layer for a regulatory ceiling: it cannot be accidentally bypassed by omitting a validation call.

**Why `arbeidstilsynet_vedtak` requires non-null:** When the Arbeidstilsynet has granted a specific exemption, the exact hours approved are documented in the approval letter and must be recorded. A NULL cap on an `arbeidstilsynet_vedtak` row would mean "no cap at all" — which is not what Arbeidstilsynet grants (they grant a specific extension, not a blank exemption).

### 4.D Default-policy seeding at workspace bootstrap (I1)

The cascade I1 bootstrap (workspace creation) MUST seed exactly two `overtime_cap_policy` rows per workspace:

| `name` | `agreement_type` | `max_weekly_hours` | `max_per_4_week_period` | `max_yearly_hours` | `is_default` |
|---|---|---|---|---|---|
| Standard | `legal_default` | 10 | 25 | 200 | **true** |
| Med tariffavtale | `local_tariff_agreement` | 20 | 50 | 300 | false |

The `local_tariff_agreement` row is seeded but not default — workspaces operating under a tariff agreement (Riksavtalen NHO Reiseliv, HK Handel, etc.) must explicitly switch the default policy to the tariff-agreement row when they configure their `regulatory_framework` binding. This is an admin operation, not an automatic derivation, because the workspace must have a documented basis (a signed local tariff agreement) before operating under §10-6 fourth ledd caps.

The bootstrap seed task lives in the I1 workspace initializer. This ADR does not implement the seed — it declares it as a required output of the migration sortie.

**Relation to ADR-0241 Lovsen amendment 8 (line 85):** The seeded rows use the same `agreement_type` vocabulary as the existing `overtime_agreement_type` enum, ensuring consistency between the contract's declared agreement basis and the policy's tier ceiling.

### 4.E RLS policies — workspace-scoped

`overtime_cap_policy` is workspace-scoped. RLS must follow the two-path pattern (JWT anon key + API key) per ADR-0029 (`docs/decisions/0029-workspace-api-gateway.md`) conventions.

```sql
-- Enable RLS
ALTER TABLE public.overtime_cap_policy ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.overtime_cap_policy FORCE ROW LEVEL SECURITY;

-- JWT path (dashboard + mobile)
CREATE POLICY overtime_cap_policy_select_jwt
  ON public.overtime_cap_policy FOR SELECT
  USING (
    workspace_id = ANY(get_workspace_ids_for_user(auth.uid()))
  );

CREATE POLICY overtime_cap_policy_insert_jwt
  ON public.overtime_cap_policy FOR INSERT
  WITH CHECK (
    is_admin_in_workspace(auth.uid(), workspace_id)
  );

CREATE POLICY overtime_cap_policy_update_jwt
  ON public.overtime_cap_policy FOR UPDATE
  USING (is_admin_in_workspace(auth.uid(), workspace_id))
  WITH CHECK (is_admin_in_workspace(auth.uid(), workspace_id));

CREATE POLICY overtime_cap_policy_delete_jwt
  ON public.overtime_cap_policy FOR DELETE
  USING (is_admin_in_workspace(auth.uid(), workspace_id));

-- API key path (service role used by Edge Functions / stage-engine)
-- Service role bypasses RLS; no extra policy needed.
-- API key path via scope_guard in workspace-api gateway (ADR-0039) uses workspace_id from
-- JWT claim verified by the gateway; the policies above cover this path.
```

**Note on helper functions used:** `get_workspace_ids_for_user(uid)` (verified at `database.types.ts` line 19714) returns `string[]` of workspace IDs the authenticated user belongs to. `is_admin_in_workspace(uid, wid)` (verified at `database.types.ts` line 19753) returns `boolean`. There is no `is_member_of_workspace` function in the current schema — the SELECT policy correctly uses `get_workspace_ids_for_user` with `= ANY(...)`.

### 4.F Phase 5 engine_event: 80%-cap warning and cap-hit

This section resolves ADR-0001-contract-service §"Risks" #6 and §"Open Questions" item #6 (line 137): "engine_event ved 80% av månedlig overtid-tak."

**Evaluation logic:**

```
overtime_hours_in_period = SUM(schedule_shift.duration_hours WHERE is_overtime = true
                               AND profile_id = $profile_id
                               AND shift_date BETWEEN period_start AND period_end)

effective_policy = employment_contract.overtime_cap_policy_id
               || workspace_default_policy(employment_contract.workspace_id)

warn_at   = effective_policy.max_yearly_hours * effective_policy.warn_threshold_pct
cap_at    = effective_policy.max_yearly_hours

-- Or substitute max_weekly_hours / max_per_4_week_period for weekly/4-week checks.
```

**Event sequence:**

1. When `overtime_hours_in_period >= warn_at` and no prior `contract.overtime_cap_warning_threshold_crossed` event exists for this profile × period × cap dimension: emit `contract.overtime_cap_warning_threshold_crossed`. Engine routes to manager push notification (mirror of PLAN Phase 5 obligation pattern).

2. When `overtime_hours_in_period >= cap_at`: emit `contract.overtime_cap_hit`. `schedule_shift` creation for this profile in this period is refused (blocked at the engine level, not the UI level — block must be enforced in the shift-create action handler, not as a frontend guard).

**Check dimensions:** All three Aml. §10-6 dimensions must be checked independently:
- weekly (rolling 7-day window)
- 4-week period (rolling 28-day window, not calendar month)
- yearly (calendar year Jan 1–Dec 31, Norwegian law baseline)

The "monthly" language in ADR-0001-contract-service is imprecise. Aml. §10-6 does not use calendar months; it uses 4-week periods. This ADR corrects the language.

**Cron cadence:** The evaluation runs as a pg_cron job triggered daily, not on every shift-create. Shift-create also triggers an inline cap check (synchronous, returns error if cap exceeded) — the cron handles the warn threshold which is less time-critical.

### 4.F.1 Relation to `overtime_limit_hours` on budget tables (D4)

The database also carries `overtime_limit_hours` on a D4 demand/budget table (verified at `database.types.ts` line 18475). That column is a *planning ceiling* for a budget period — it controls how many overtime hours are budgeted for a department in a given period, used for cost forecasting. It is not a *legal cap* per employee.

The relationship is:
- `overtime_limit_hours` (D4 budget) = "how many overtime hours does this department plan to use this month" — a cost-planning signal
- `overtime_cap_policy.max_*_hours` (this ADR) = "how many overtime hours is this employee legally allowed to accrue" — a compliance ceiling

These two values serve different purposes and operate at different cascade layers. D4 budget may be *lower* than the legal cap (a manager budgets 8h/week overtime knowing the law allows 10) or may not be set at all. D4 budget does NOT replace the legal cap check. Both checks apply: a shift that would exceed the D4 budget triggers a D4 planning warning; a shift that would exceed `overtime_cap_policy.max_*_hours` triggers a compliance block (§4.F cap-hit).

**Agent rule:** Never read `overtime_limit_hours` as a substitute for `overtime_cap_policy.max_*_hours`. They answer different questions at different cascade layers.

### 4.F.2 Relation to `shift_cost_snapshot.overtime_cost` (C3)

`shift_cost_snapshot.overtime_cost` (verified at `database.types.ts` line 16970, C3 commercial layer) records the already-incurred cost of overtime for a shift after it is completed. It is a *historical accounting* field, not a forward-looking cap check.

The Phase 5 cron uses `schedule_shift` rows (D6 production) to sum accrued overtime hours for a period — not `shift_cost_snapshot`. The `shift_cost_snapshot.overtime_cost` field remains useful for the `shift_pay_calculation_event` payload (ADR-0251) to include cap headroom in the cost record.

### 4.G Per-employee override — Aml. §10-12 unntak

For roles meeting Aml. §10-12 (særlig uavhengig stilling / nøkkelfunksjon), a workspace admin can:

1. Create an `overtime_cap_policy` row with `agreement_type = 'unntak_10_12'` and all cap columns NULL.
2. Set `employment_contract.overtime_cap_policy_id` to that row.

When the effective policy has all caps NULL, the Phase 5 cron skips warn and cap-hit evaluation for that profile. The skip is explicit: a NULL cap is not "unlimited by accident" — it is `unntak_10_12` deliberately recorded.

**Admin UX requirement** (build agent constraint, not this ADR's implementation scope): the UI must prevent assigning `unntak_10_12` policy unless the admin has first documented the §10-12 basis. Enforcement method: a non-null `notes` column on `overtime_cap_policy` with a UI-level validation check. The `notes` column is part of the migration definition:

```sql
ALTER TABLE public.overtime_cap_policy
  ADD COLUMN notes text,
  ADD CONSTRAINT chk_overtime_cap_unntak_notes
    CHECK (
      agreement_type <> 'unntak_10_12'
      OR (notes IS NOT NULL AND length(notes) > 10)
    );
```

The constraint requires a non-trivial notes entry (> 10 characters) when `unntak_10_12` is selected. This is a lightweight audit safeguard — not a substitute for the Arbeidstilsyn approval documentation, which in v1 is manual admin entry.

### 4.G.1 Alignment with `overtime_agreement_type` on `employment_contract`

The existing `overtime_agreement_type` column on `employment_contract` (database.types.ts line 7580) declares which Aml. §10-6 basis the contract operates under. This ADR adds `overtime_cap_policy_id` which carries the *numeric values* consistent with that basis.

The two columns must be kept consistent. The following invariant MUST be enforced at the application layer (and optionally as a trigger):

```
employment_contract.overtime_agreement_type = 'legal_default'
  → overtime_cap_policy.agreement_type ∈ {'legal_default', 'unntak_10_12'}

employment_contract.overtime_agreement_type = 'local_tariff_agreement'
  → overtime_cap_policy.agreement_type ∈ {'local_tariff_agreement', 'unntak_10_12'}

employment_contract.overtime_agreement_type = 'arbeidstilsynet_vedtak'
  → overtime_cap_policy.agreement_type ∈ {'arbeidstilsynet_vedtak', 'unntak_10_12'}
```

In plain terms: an employee whose contract is `legal_default` cannot be assigned a `local_tariff_agreement`-tier policy (that would give them 20h/week instead of 10h/week without a valid tariff basis). The `unntak_10_12` exception is always permitted regardless of contract tier because §10-12 is a separate exemption mechanism that overrides any tier.

This consistency check is the responsibility of the admin UI (prevent selecting an incompatible policy) and the `contract` capability's `validate_contract` tool (emit a `review_required` outcome if mismatch detected at compose time). It is NOT enforced as a DB constraint in v1 because the constraint would require a FK-join across two rows, which PostgreSQL cannot express in a standard CHECK constraint.

### 4.H Telemetry events to register

These events must be registered in `packages/telemetry/src/registry.ts` per ADR-0175 frozen-event-set discipline. Registration is a separate sub-plan task; this ADR declares the contract only.

| Event name | Routing destinations | Payload keys |
|---|---|---|
| `contract.overtime_cap_warning_threshold_crossed` | PostHog + activity_trail + engine_event | `profile_id, workspace_id, contract_id, policy_id, cap_dimension (weekly|4week|yearly), hours_accrued, cap_threshold, warn_threshold_pct` |
| `contract.overtime_cap_hit` | PostHog + activity_trail + engine_event | `profile_id, workspace_id, contract_id, policy_id, cap_dimension, hours_accrued, cap_value` |
| `contract.overtime_cap_policy_assigned` | activity_trail | `profile_id, workspace_id, contract_id, policy_id, assigned_by_profile_id` |
| `contract.overtime_cap_policy_overridden` | activity_trail | `profile_id, workspace_id, contract_id, old_policy_id, new_policy_id, changed_by_profile_id` |

All four events conform to ADR-0134 R1: `workspace_id` and `profile_id` resolved via `getProfileContext()` (or server-side equivalent) before `emit()`. Empty-string fallbacks forbidden per CLAUDE.md "Mobile Telemetry Contract" paragraph.

Routing destinations follow ADR-0004 four-destination contract (`emit()` from `@smartout/telemetry`):
- `contract.overtime_cap_hit` routes to `engine_event` because cap-hit must trigger the shift-block action handler via the Event Engine.
- `contract.overtime_cap_warning_threshold_crossed` routes to `engine_event` because it triggers manager push notification via the push dispatch pattern (ADR-0186 fanout).

**Relation to ADR-0245 §H:** ADR-0245 `docs/decisions/0245-employee-contract-mobile-flow.md` Section H declares a mobile push event map for `contract.obligation_due_soon` and sibling events. `contract.overtime_cap_warning_threshold_crossed` follows the same push-trigger pattern: stage-engine consumer → `/api/push/dispatch` → FCM/APNs → `smartout://contract/overtime-warning` deep link. The push payload carries no salary amounts (ADR-0078 forbids salary readback outside chat channel).

### 4.I Migration sequence

This ADR is decision-only. The migration sortie must execute the following steps in order within a single transaction:

```
Step 1.  (Optional) ALTER TYPE overtime_agreement_type ADD VALUE IF NOT EXISTS 'unntak_10_12';
         -- COMMIT here if PostgreSQL version requires it (ADD VALUE is non-transactional < PG 12).
         -- Postgres 17 (Supabase local) supports ADD VALUE in transaction; verify before batching.

Step 2.  CREATE TABLE public.overtime_cap_policy (...) — per §4.A schema.

Step 3.  ALTER TABLE public.overtime_cap_policy ADD CONSTRAINT ... — all CHECK constraints per §4.C + §4.G note.

Step 4.  ALTER TABLE public.overtime_cap_policy ADD COLUMN notes text;
         ALTER TABLE public.overtime_cap_policy ADD CONSTRAINT chk_overtime_cap_unntak_notes ...;
         -- per §4.G unntak_10_12 documentation requirement.

Step 5.  ALTER TABLE public.employment_contract ADD COLUMN overtime_cap_policy_id uuid
           REFERENCES public.overtime_cap_policy(id) ON DELETE SET NULL;
         -- per §4.B.

Step 6.  CREATE UNIQUE INDEX idx_overtime_cap_policy_one_default_per_workspace
           ON public.overtime_cap_policy (workspace_id) WHERE is_default = true;
         -- per §4.A.

Step 7.  ALTER TABLE public.overtime_cap_policy ENABLE ROW LEVEL SECURITY;
         ALTER TABLE public.overtime_cap_policy FORCE ROW LEVEL SECURITY;
         CREATE POLICY ... — per §4.E.

Step 8.  Backfill: for existing workspaces, INSERT default policies if none exist.
         This is a data migration step — safe with ON CONFLICT DO NOTHING.
```

**Timestamp requirement (per ADR-0241 line 37):** migration filename timestamp must be > current `development` HEAD max timestamp. The migration sortie must check `git log --oneline supabase/migrations/` before choosing the timestamp.

**Migration file path:** `supabase/migrations/<YYYYMMDDHHMMSS>_overtime_cap_policy_table.sql` — per ADR-0241 §"Required migration changes" Step 1 convention.

---

## 5. Consequences

### Summary table

| Layer | Store | When it fires | Mutability |
|---|---|---|---|
| K1a — Aml. §10-6 absolute | DB CHECK constraints on `overtime_cap_policy` | Always, at INSERT/UPDATE | Immutable (encoded in migration) |
| Workspace default | `overtime_cap_policy` (is_default = true) | When `employment_contract.overtime_cap_policy_id IS NULL` | Admin-configurable (tighten only) |
| Per-employee override | `employment_contract.overtime_cap_policy_id` | When non-null | Admin-configurable (any policy within workspace) |

### Positive

- **PLAN Phase 5 unblocked.** The 80%-cap engine_event (ADR-0001-contract-service §"Open Questions" #6) now has a defined numeric source: `overtime_cap_policy.max_*_hours × warn_threshold_pct`.
- **ADR-0245 mobile flow unblocked.** The push-trigger map in Section E of ADR-0245 can be wired once the telemetry events in §4.H are registered and the `engine_event` fan-out consumer exists.
- **FK column on `employment_contract` can now be added.** The `overtime_cap_policy_id` column (deferred from ADR-0001-contract-service D3 §Konsekvenser line 220) has a concrete referent table.
- **`shift_pay_calculation_event` gains overtime context.** ADR-0251 (`docs/decisions/0251-shift-pay-calculation-audit-module.md`) calculates overtime cost per shift. With `overtime_cap_policy_id` resolvable to numeric caps, ADR-0251's `shift_pay_calculation_event` payload can include `cap_headroom_hours` (hours remaining before cap hit) as an audit field.
- **K1a / workspace boundary preserved.** Absolute ceilings live as DB CHECK constraints derived from K1a Aml. §10-6 law (platform layer), workspace defaults live in `overtime_cap_policy` (workspace layer), per-employee overrides live on `employment_contract` (contract layer). Each layer is independently modifiable without coupling.
- **Idempotent seeding.** The I1 bootstrap inserts with `ON CONFLICT (workspace_id, name) DO NOTHING` — safe to re-run in development resets.

### Negative / migration costs

- **New table + 1 FK column + CHECK constraints** → requires a dedicated migration sortie. The migration cannot be batched into the ADR-0241 Phase 0a wave (that wave is already branched and under review); it must follow as a separate Phase 0b/0c migration.
- **I1 workspace bootstrap must be extended** to seed the two default policies. Any existing workspaces in the local dev environment will need a backfill step.
- **Workspace admin UI must expose policy management.** Currently no UI exists for `overtime_cap_policy`. Phase 5 cannot ship without a settings page (or at minimum a controlled seed that admins cannot misconfigure).
- **`agreement_type` text column vs enum** (see §4.A note) — the migration sortie must decide: extend the existing `overtime_agreement_type` enum before `CREATE TABLE`, or use `text` with a later enum migration. Both paths are valid; the sortie ADR must document the choice explicitly.

### Agent impact

- **Build agents implementing the Phase 5 cron** MUST resolve `effective_policy` via the two-step fallback chain in §4.B, not assume `overtime_cap_policy_id` is always set.
- **Build agents writing `overtime_cap_policy` rows** will receive a `23514 check_violation` if cap values exceed Aml. §10-6 tier bounds — this is intentional. Do not catch and suppress these errors; surface them to the admin.
- **`shift_pay_calculation` consumers** (ADR-0251) must add `overtime_cap_policy_id` resolution to their context bundle when checking whether a shift increment is the last "allowed" overtime shift in a period.
- **Mobile build agents** implementing ContractDetailScreen per ADR-0245 §A must render the effective policy's `max_*_hours` values in the obligation list view (so the employee can see "du har brukt 7 av 10 timer overtid denne uken").
- **Never bypass the DB CHECK constraints** with a service-role `INSERT` that sets `max_weekly_hours = 25` on a `legal_default`-tier row. The constraint will catch it. If a workspace genuinely needs 20h/week, the admin must change the policy to `local_tariff_agreement` tier and provide documentary basis.

---

## 6. Open Questions

The following are explicitly deferred and must be resolved before the migration sortie is closed.

1. **`agreement_type` column type: extend existing enum or use `text`?** The existing `overtime_agreement_type` enum (`database.types.ts` line 20267) has three values. This ADR requires a fourth: `unntak_10_12`. Two paths: (a) `ALTER TYPE overtime_agreement_type ADD VALUE 'unntak_10_12'` in the migration sortie and use the enum as column type; (b) use `text` with a CHECK constraint. Path (a) is preferred for type-safety but requires that `overtime_agreement_type` is not used in any `DEFAULT` expressions that would block `ALTER TYPE` (Postgres restriction). The migration sortie agent must verify this before choosing.

2. **Multiple active contracts per employee (ADR-0001 D2)** — When a profile has two active `employment_contract` rows (e.g., main + secondary per ADR-0001 D2 §"Beslutning"), each potentially with a different `overtime_cap_policy_id`, the Phase 5 cron must decide: evaluate caps per-contract or aggregate across all active contracts for the profile? Aggregation is legally correct (Aml. §10-6 applies to the person, not the contract) but technically complex (requires summing `schedule_shift` hours across contract-scoped shifts). Out of scope for v1; flag as known gap. V1 behavior: evaluate the primary (`employment_role = 'main'`) contract's policy only.

3. **Apprentice-specific overtime rules (Opplæringsloven kap. 4 / under 18)** — Opplæringsloven restricts overtime significantly for apprentices (lower caps, stricter rules for under-18 workers). This intersects with ADR-0241 amendment 5 (Opplæringsloven kap. 4 apprentice blocker) and will require a separate ADR when apprentice contracts ship. `overtime_cap_policy` must not be extended with `apprentice`-specific logic until that ADR is written. Flag.

4. **Arbeidstilsynet approval documentation (§10-12 unntak)** — In some cases, Aml. §10-12 exceptions require formal Arbeidstilsynet approval (e.g., for industries not explicitly exempted). V1 accepts admin-entered `notes` as the documentation basis. This creates a compliance gap if a workspace incorrectly self-classifies a role as §10-12 without a genuine exemption. A Phase 2 improvement would require attaching a document (PDF scan of the Arbeidstilsynet letter) — the storage pattern would follow ADR-0136 (camera-evidence model). Out of scope here; flag.

5. **`warn_threshold_pct` per dimension** — This ADR defines a single `warn_threshold_pct` applied to all three cap dimensions (weekly, 4-week, yearly). A more precise model would allow separate thresholds per dimension (e.g., warn at 80% on yearly but 90% on weekly). Deferred to v2. V1 applies the same percentage to all three.

6. **Tariff-level defaults (the deferred "eller per tariff_id" from ADR-0001 D3 line 122)** — This ADR resolves the FK target question without adding tariff-level defaults. The workspace admin seeds their own cap values; they are not automatically derived from `tariff_id`. A future ADR could add a `regulatory_framework_id` FK on `overtime_cap_policy` to enable "inherit from Riksavtalen binding" as an option. Deferred — this ADR closes the unblocked FK target question; tariff-derived inheritance is a Day 2 optimisation.

7. **`warn_threshold_pct` per cap dimension** — This ADR provides one `warn_threshold_pct` per policy applied uniformly across the weekly, 4-week, and yearly dimensions. A workspace may want to warn at 80% of the yearly limit (long-lead planning signal) but 95% of the weekly limit (shorter window, less actionable early). Deferred to v2 — the current single-field design is safe to extend additively (e.g., `warn_threshold_pct_weekly numeric`, `warn_threshold_pct_yearly numeric`) without breaking existing rows.

8. **Consistency trigger between `overtime_agreement_type` and `overtime_cap_policy.agreement_type`** — §4.G.1 documents the invariant as an application-layer concern. Whether a DB trigger should enforce it at the DB layer is deferred. Adding a trigger requires a function that JOINs across `employment_contract` and `overtime_cap_policy`, which is feasible but adds a mutation hotspot. The migration sortie should benchmark and decide.

9. **Periodic reset — which calendar defines "year" for the yearly cap?** Aml. §10-6 uses calendar year (Jan 1 – Dec 31, Norway). This is straightforward for full-year employees. For employees who start mid-year, the Lovdata commentary is ambiguous: does the yearly cap apply pro-rata (employee started July 1, cap is 100h for that year) or in full (cap is 200h from start date)? Legal consensus: cap applies in full from hire date within the same calendar year; pro-rata is not mandated by §10-6. The Phase 5 cron should use `date_trunc('year', CURRENT_DATE)` as period_start for the yearly dimension check. Document this interpretation in the migration sortie.

10. **Relation to ADR-0252 (Riksavtalen versioning policy) and ADR-0253 (if existing)** — ADR-0252 (referenced in the frontmatter but not yet filed) governs how the Riksavtalen-specific tariff rules are versioned when the agreement is renegotiated (2026+). If Riksavtalen is renegotiated to change the §10-6 fourth ledd hours (currently 20/50/300), existing `overtime_cap_policy` rows on `local_tariff_agreement` tier would need updating. This ADR does not define the update cascade for policy rows on tariff revision. ADR-0252 should declare whether an `UPDATE` on `overtime_cap_policy` rows is triggered automatically by tariff versioning or requires admin action. Flagged here for ADR-0252 authors to address.

---

## 7. Rules & Consequences enforced for Agents

- **Good, because** Phase 5 80%-cap engine_event is unblocked: numeric source is now `overtime_cap_policy.max_*_hours × warn_threshold_pct`, resolvable per-profile via two-step fallback in §4.B.
- **Good, because** K1a Aml. §10-6 absolute ceilings are enforced at the DB layer (CHECK constraints in §4.C) — no build agent can bypass them by omitting a validation call.
- **Good, because** `framework_rule` (ADR-0090) is not polluted with cap-value semantics; its evaluation_config JSONB remains a typed condition tree, not a key-value store.
- **Good, because** existing `overtime_framework_rule_id` and `overtime_agreement_type` columns on `employment_contract` are preserved — this ADR adds `overtime_cap_policy_id` as an additive column, not a replacement.
- **Bad, because** migration sortie must decide the `agreement_type` enum-extension question (§6.1) before `CREATE TABLE` — if it chooses `text`, a follow-up migration is needed to cast to enum.
- **Bad, because** multi-contract overtime aggregation (§6.2) is punted to v2, creating a known correctness gap for profiles with secondary contracts.
- **Agent Impact:** All agents reading overtime cap values MUST use the resolution chain: `employment_contract.overtime_cap_policy_id` → workspace default. Never hardcode Aml. §10-6 values in TypeScript (e.g., `const MAX_WEEKLY_OVERTIME = 10`) — the DB is the authoritative source, workspace admins can tighten it, and `unntak_10_12` policies have NULL caps.

---

## 8. References

### ADR files

- `docs/architecture/contract-service/ADR-0001-kontrakt-og-lonnsprofil-fundament.md` — D3 §"Konsekvens" line 122 (scope deferral), §"Konsekvenser samlet" line 220 (`overtime_cap_policy_id` FK declaration), §"Risks" #6 + §"Open Questions" #6 (Phase 5 80%-cap blocker). Status: superseded 2026-04-29.
- `docs/decisions/0090-framework-rule-evaluation-config-schema.md` — ADR-0090, typed condition tree schema (lines 41–55), evaluation_outcome enum (lines 41–46), K1a/C4 boundary (lines 84–86). Reason for *not* reusing `framework_rule` as a cap-values store.
- `docs/decisions/0241-contract-schema-migration-foundation.md` — ADR-0241, Lovsen amendment 8 (line 85): Aml. §10-6 femte ledd 2024-revisjon removed; `overtime_agreement_type` enum corrected. FK fix conventions (line 39). Enum migration pattern (lines 39–47).
- `docs/decisions/0245-employee-contract-mobile-flow.md` — ADR-0245, Section E push-trigger map (lines 150–162), Section H telemetry registry contract (lines 204–218). The `contract.overtime_cap_warning_threshold_crossed` event in this ADR §4.H follows the same push-trigger pattern as ADR-0245 §E.
- `docs/decisions/0251-shift-pay-calculation-audit-module.md` — ADR-0251, `shift_pay_calculation_event` audit payload. `overtime_cap_policy_id` resolution enables `cap_headroom_hours` field in that payload.
- `docs/decisions/0029-workspace-api-gateway.md` — ADR-0029, JWT + API key dual-path RLS convention. RLS policies in §4.E follow this pattern.

### Verified database columns (`packages/supabase/src/database.types.ts`)

- `employment_contract.overtime_agreement_type` — line 7580, enum `overtime_agreement_type`
- `employment_contract.overtime_framework_rule_id` — line 7581, uuid | null, FK → `framework_rule.rule_id` (line 7734–7737)
- `overtime_agreement_type` enum values — line 20267–20270: `legal_default | local_tariff_agreement | arbeidstilsynet_vedtak`
- `framework_rule` columns — lines 8925–8990: no `target` column; overtime cap semantics do not map to `evaluation_config` JSONB
- `regulatory_framework` columns — lines 14752–14820: no `workspace_id` column (confirming K1a platform-level ownership)
- `is_admin_in_workspace(uid, wid)` — line 19753
- `get_workspace_ids_for_user(uid)` — line 19714

### Norwegian law

- **Arbeidsmiljøloven (Aml.) §10-6** — Overtid. Second ledd: standard cap (10h/week, 25h/4-week, 200h/year). Fourth ledd: lokal tariffavtale (20h/week, 50h/4-week, 300h/year). Sixth ledd: Arbeidstilsynet-vedtak. (Fifth ledd: removed in 2024 revision per ADR-0241 Lovsen amendment 8.)
- **Arbeidsmiljøloven §10-12** — Unntak for særlig uavhengig stilling / nøkkelstilling. Caps may be NULL for qualifying roles; Arbeidstilsynet approval may be required.
- **Riksavtalen NHO Reiseliv 2024–2026** — Hospitality-sector tariff agreement. Activates §10-6 fourth ledd tier for tariff-bound workspaces. Referenced in workspace policy seeding guidance (§4.D).
- **Forskrift om unntak fra arbeidstidsbestemmelsene (FOR-2005-06-16-1554)** — Sector-specific exemptions from §10 provisions. Relevant for §10-12 unntak documentation requirement (§6.4).

---

> Not yet registered in `docs/decisions/0000-decision-log.md`. Register after orchestrator persists this file. Promote to `accepted` when: (a) migration sortie creating `overtime_cap_policy` table + `overtime_cap_policy_id` FK + CHECK constraints merges to `development`; (b) I1 bootstrap seeds default policies; (c) `overtime_agreement_type` enum extended with `unntak_10_12` value (or `text` path documented in sortie ADR).
