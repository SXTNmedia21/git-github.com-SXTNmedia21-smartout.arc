---
title: "Cascade Core Foundation — Design Specification"
status: in_progress
updated: 2026-03-21
created: 2026-03-21
module: cascade
tags: [cascade, architecture, foundation, framework, design-spec]
---

# Cascade Core Foundation — Design Specification

## 1. Executive Summary

Smartout's Cascade Core Foundation is the canonical domain model, framework resolution engine, and proposal/enforcement pipeline upon which scheduling, payroll sync, compliance, attendance, and future workforce intelligence products will rest. The canonical model is **I1 + 6D + 4C + K1a/K1b**: a pre-runtime Industry Intelligence bootstrap (I1) seeds workspace defaults, six execution dimensions (D1-D6) hold authoritative data, four control planes (C1-C4) observe/explain/value/govern the system, and a two-tier knowledge substrate (K1a industry, K1b workspace) provides shared memory. Changes propagate via a reactive dataflow DAG with Terraform-style plan/apply UX and event-sourced audit.

This spec defines the **core foundation**, not the finished scheduling product. The foundation provides the substrate — canonical schema, framework-driven rules and triggers, proposal/enforcement pipeline, bootstrap flow, provenance/audit trail, and external adapter spine — that product layers consume.

### 1.1 Current Delivery Scope

This spec defines the core hospitality foundation layer for future scheduling, compliance, payroll sync, and integration capabilities.

**Current implementation focus:**

- Canonical hospitality domain model (dimensions, control planes, knowledge substrate)
- Framework/rule/trigger resolution model (loadable regulatory and operational frameworks)
- Proposal/enforcement pipeline (plan/apply with preview, staleness detection, audit)
- Bootstrap flow (two-wizard onboarding → hospitality package activation)
- Provenance/audit (every record carries source, every evaluation is logged)
- External adapter spine (contracts for downstream payroll/ERP sync)

**NOT in current scope:**

- Full scheduling product UI (vaktlista, drag-and-drop assignment)
- Weighted resource matching and optimization
- Employee pay view
- Rich control plane behavior (C1 calibration, C2 explanations, C3 commercial reports)
- Multi-industry support

These are future product layers that consume the core foundation.

### 1.2 Production Scope

The Cascade Core Foundation is architected as a framework-driven platform, but the initial and only supported production implementation is the **Norwegian hospitality package** (`hospitality.no.default.v1`). All bootstrap logic, runtime defaults, templates, payroll assumptions, and governance seeds are defined by the hospitality industry intelligence package. Additional industries remain out of scope until the hospitality implementation is proven in production.

---

## 2. Architecture Overview

### 2.1 Canonical Model

```
PRE-RUNTIME
  I1  Industry Intelligence Bootstrap
      Loads vertical defaults, applies SQL templates, sets baselines for all dimensions.

RUNTIME
  EXECUTION           D1 Envelope | D2 Resource | D3 Rules | D4 Demand | D5 Concept | D6 Production
  CONTROL             C1 Calibration | C2 Interaction | C3 Commercial | C4 Governance
  KNOWLEDGE           K1a Industry Base | K1b Workspace Base
```

**Sequence:** Platform Shell (login, org) --> I1 Bootstrap (vertical, niche, apply) --> Workspace Runtime (D1-D6, C1-C4, K1a+K1b)

### 2.2 Execution Dimensions

| #   | Name                  | Norwegian               | Core Question                                     | Type                      |
| --- | --------------------- | ----------------------- | ------------------------------------------------- | ------------------------- |
| D1  | Operational Envelope  | Driftsrammer            | When/where/with what capacity?                    | Structural                |
| D2  | Resource Availability | Resurstilgang           | Who is available now and within planning horizon? | Volatile (time-projected) |
| D3  | Rules & Constraints   | Regler og begrensninger | What is allowed/required/forbidden?               | Stable                    |
| D4  | Demand Signal         | Ettersporselsignal      | How much activity to prepare for?                 | Predictive                |
| D5  | Service Concept       | Driftskonsept           | What kind of operation are we?                    | Strategic                 |
| D6  | Production & Product  | Produksjon og produkt   | What to produce, what is the state?               | Live (temporal debt)      |

**D5** parameterizes coefficients in all other dimensions. A fine-dining restaurant and a fast-casual burger joint share cascade layers but D5 changes weights, thresholds, and defaults throughout. D5 is an execution dimension but not a linear cascade-propagation layer. It parameterizes coefficients in D1-D4 and D6 rather than generating daily runtime diffs. When D5 changes (rare — business model pivot), it triggers a full re-parameterization of all other dimensions.

**D6** has a unique property: **temporal debt**. If Monday's staff skipped prep, Tuesday needs extra staff. Production state accumulates across days. Equipment failure degrades capacity. Stock levels and supplier deliveries are live state.

### 2.3 Control Planes

| #   | Name                        | Core Question                              | Loop                              |
| --- | --------------------------- | ------------------------------------------ | --------------------------------- |
| C1  | Observability & Calibration | What happened vs plan? How to correct?     | Plan -> actual -> correction      |
| C2  | Context & Interaction       | What is relevant now? How to explain it?   | State -> inference -> explanation |
| C3  | Commercial & Outcome        | What value was created? What does it cost? | Value -> attribution -> pricing   |
| C4  | Policy & Governance         | What is the system ALLOWED to do?          | Capability -> permission -> audit |

**Interaction pattern:**

- C1 BELIEVES (Friday needs +15% staff)
- C4 PERMITS (auto-adjust up to 5% allowed)
- C2 EXPLAINS (presents to manager with context)
- C3 MEASURES (that adjustment saved 12,000 kr last month)

### 2.4 Knowledge Substrate

| Tier | Owner                       | Mutation Rate                              | Contents                                                                                            |
| ---- | --------------------------- | ------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| K1a  | Platform (per vertical)     | Rare (new tariff rates, updated labor law) | Industry primitives, tariff baselines, policy templates, role capabilities, standard patterns       |
| K1b  | Workspace (tenant-isolated) | Continuous (C1 learning, admin config)     | Semantic memory (pgvector), historical patterns, learned factors, local overrides, policy artifacts |

**Interaction rules:**

- I1 seeds K1b FROM K1a at bootstrap
- C1 writes ONLY to K1b (learned corrections are workspace-specific)
- K1a updates propagate as suggestions, not overwrites
- K1b can override K1a within framework-permitted limits

### 2.5 Regulatory Framework Model

The engine does **not** hardcode jurisdiction-specific labor, payroll, or compliance logic in service code. Instead, workspaces bind to a **regulatory framework** that defines triggers, gates, enforcement outcomes, exceptions, and evaluation rules. The engine loads the active framework and evaluates against it.

#### Core Concepts

| Concept                         | Definition                                                                                                                                                        |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Regulatory Framework**        | A versioned, loadable package of rules, triggers, thresholds, and evaluation logic for a specific jurisdiction + industry. Example: `hospitality.no.default.v1`   |
| **Framework Rule**              | A single evaluable rule within a framework. Has a type (gate/constraint/advisory/commercial), severity, and evaluation outcome.                                   |
| **Framework Trigger**           | A condition that initiates evaluation — time-based, state-change, threshold crossing, or external event.                                                          |
| **Workspace Framework Binding** | Links a workspace to its active framework version. One workspace = one active framework at a time.                                                                |
| **Workspace Rule Override**     | Workspace-level customization of a framework rule — tightening, exception, or operational policy layered on top of the framework default.                         |
| **Workspace Trigger Override**  | Workspace-level customization of when/how a trigger fires — adjusted thresholds, additional conditions, or disabled triggers (within framework-permitted bounds). |

#### Evaluation Outcomes

Framework rules do not produce simple pass/fail. Evaluation outcomes support the full spectrum of real-world workforce governance:

| Outcome                  | Meaning                                                                                          |
| ------------------------ | ------------------------------------------------------------------------------------------------ |
| `allowed`                | Action permitted under the active framework                                                      |
| `allowed_with_exception` | Action permitted via a documented exception path (e.g., agreement-based deviation, union waiver) |
| `review_required`        | Action requires explicit manager approval — interpretation-dependent or policy-ambiguous         |
| `blocked`                | Action not permitted under the active framework — no exception path available                    |

This model supports:

- Default framework rules (from the regulatory package)
- Agreement-based exceptions (collective agreements, individual contracts)
- Interpretation-dependent review states (where the framework permits discretion)
- Workspace operational policy (house rules layered on the framework)
- Auditable manager decisions (every override and exception is logged with reason and approver)

#### Framework Hierarchy

The foundation defines a precedence resolution contract. When multiple rule sources apply, the resolution order is determined by the framework package, not hardcoded by the engine. The foundation provides the structural machinery for precedence — the `source_layer` concept, the override capability grammar, and the evaluation pipeline — but does not decide which layers exist or what their precedence is.

A typical framework package (e.g., `hospitality.no.default.v1`) might define layers such as:

1. Statutory minimum (non-negotiable floor)
2. Collective agreement (sector-level terms)
3. Workspace operational policy (house rules)
4. Individual contract terms

The framework encodes which rules are overridable at which level via the override capability grammar (`outcome_overridable`, `config_tighten_allowed`, `config_loosen_allowed`, `override_min_level`). The engine enforces whatever the loaded framework declares — it does not assume any specific layer structure.

#### Current Production Framework

Only one framework is implemented and tested: **`hospitality.no.default.v1`** (Norwegian hospitality framework with statutory floor, collective agreement seed data, and framework-defined rules). The framework interface is generic, but production scope is hospitality-only.

### 2.6 Cascade ↔ Event Engine Integration

The Cascade proposal pipeline operates as an independent service layer with its own lifecycle (preview → persist → freshness check → framework gate → apply). It does NOT run inside the event engine (`engine_process` / `engine_state`). However, `apply_cascade()` emits domain events via the existing `emit()` telemetry system upon successful apply. These events (e.g., `operating_hours.changed`, `shift_template.updated`, `season.transitioned`) flow through `engine_dispatch` like any other mutation event, allowing the event engine to trigger downstream workflows (session recalculation, notification dispatch, compliance checks). The cascade pipeline is the producer; the event engine is a consumer.

### 2.7 Key Principles

1. **"Confident" does not equal "Authorized"** — C4 gates C1, always. High confidence in a prediction does not grant permission to act on it.
2. **Primary dimension = where authoritative data LIVES**, not where it originates. External regulations originate outside the system but are owned by D3 and constrain D1.
3. **D1 = physics. D3 = norms.** Physical capacity vs framework-defined rules and constraints.
4. **D5 = design intent. D6 = runtime state.** D5 says "we are fine-dining" (stable). D6 says "the fryer is broken" (live).
5. **Overrides only at the real-world layer.** Template shifts and operating hours are structural. Manual edits happen on schedule_shift.
6. **No empty workspaces.** Every workspace starts from I1 bootstrap with an active framework binding.
7. **Framework-driven, not jurisdiction-hardcoded.** The engine loads the applicable regulatory framework. Business logic evaluates framework rules, not hardcoded country-specific conditions.
8. **Foundation first, product later.** The core foundation (schema, framework resolution, proposal pipeline, bootstrap, adapters) must be stable before product layers (scheduling UI, matching, analytics) are built on top.
9. **Structure, not substance.** The foundation defines the structure of rule evaluation, not the substance of any specific regulatory regime. Numerical values, thresholds, windows, and enforcement levels are framework-managed data inputs, not service-level constants and not foundation decisions.
10. **Foundation models machinery, framework loads content.** During the foundation phase, the system models rule types, trigger types, parameter containers, override mechanics, and evaluation outcomes. The selection and verification of concrete legal or payroll values belongs to framework seeding and later enforcement layers, not to the foundation schema itself.

---

## 3. Implementation Phases

Phases A–D build the **core foundation**. Later phases build product layers on top.

```
CORE FOUNDATION (this spec)
  Phase A: Canonical Schema & Framework Model
  Phase B: Framework Resolution & Proposal Engine
  Phase C: Hospitality Bootstrap & Migration
  Phase D: Integration Spine & Adapter Contracts

PRODUCT LAYERS (future specs)
  Scheduling UI, resource matching, control planes, analytics
```

### Phase A — Canonical Schema & Framework Model

**Scope:** All new tables, new fields on existing tables, new enums, deprecation markers. Zero application code. This is the structural foundation that all later phases depend on.

**Migration tiers:** Phase A is split into three independent migrations to control scope and avoid signaling unneeded work to agents:

| Tier   | Scope             | Tables                                                                                                                                                                                                                                                                                              | When to run                                     |
| ------ | ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| **A1** | Domain model      | `planning_cycle`, `department_operating_hours`, `department_hours_override`, `planning_event`, `tariff_rate_table`, `employee_payroll_profile`, `shift_cost_snapshot`, `change_proposal`, `public_holiday`, `planning_factors`, `adjustment_factors` + new fields on existing tables + domain enums | First — unblocks minimum cascade surface        |
| **A2** | Framework model   | `regulatory_framework`, `framework_rule`, `framework_trigger`, `workspace_framework_binding`, `workspace_rule_override`, `workspace_trigger_override` + framework enums                                                                                                                             | When Phase B work begins                        |
| **A3** | Integration model | `external_system_connection`, `external_sync_mapping`, `external_sync_event` + integration enums                                                                                                                                                                                                    | When integration work actually starts (Phase D) |

Schema is a commitment signal. Agents will see tables and try to wire them up. A3 stays out of the migration until integration work is real — not because the DDL is dangerous, but because it's noise until then.

**Migration prerequisites:**

```sql
CREATE EXTENSION IF NOT EXISTS btree_gist;
```

Required before any `EXCLUDE USING gist` constraints that combine UUID equality with range overlap (used by `planning_cycle`, `tariff_rate_table`, `employee_payroll_profile`).

**Postgres version compatibility rule:**

- If Postgres 15+: use `UNIQUE NULLS NOT DISTINCT` for nullable-column uniqueness (used by `department_operating_hours`, `department_hours_override`).
- If Postgres < 15: replace with equivalent partial unique indexes. Example for `department_operating_hours`:
  ```sql
  CREATE UNIQUE INDEX uq_dept_hours_default ON department_operating_hours
    (department_id, day_of_week) WHERE location_id IS NULL AND season_id IS NULL;
  CREATE UNIQUE INDEX uq_dept_hours_season ON department_operating_hours
    (department_id, season_id, day_of_week) WHERE location_id IS NULL AND season_id IS NOT NULL;
  CREATE UNIQUE INDEX uq_dept_hours_location ON department_operating_hours
    (department_id, location_id, day_of_week) WHERE location_id IS NOT NULL AND season_id IS NULL;
  CREATE UNIQUE INDEX uq_dept_hours_full ON department_operating_hours
    (department_id, location_id, season_id, day_of_week) WHERE location_id IS NOT NULL AND season_id IS NOT NULL;
  ```

This is a foundation invariant, not deferred technical debt. The first migration must verify `SHOW server_version` and select the appropriate strategy.

**Deliverables:**

#### New Tables — Domain Model

| Table                        | Purpose                                                                                  | Ownership                                                                   |
| ---------------------------- | ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `planning_cycle`             | Year wheel container. One per planning period.                                           | Runtime (D1)                                                                |
| `department_operating_hours` | Consolidated weekly hours per (dept, location, season, weekday). Replaces 3 systems.     | Runtime (D1)                                                                |
| `department_hours_override`  | Date-specific exceptions (holidays, events, closures).                                   | Runtime (D1)                                                                |
| `planning_event`             | External/internal demand events with multipliers.                                        | Runtime (D4)                                                                |
| `tariff_rate_table`          | Versioned framework-defined rates with effective dates. Framework-loaded, not hardcoded. | K1a (platform baseline) / K1b (workspace override). Consumed by D3, C3, C4. |
| `employee_payroll_profile`   | Links contract to payroll calculation via framework-defined tariff categories.           | Runtime (D2/D3)                                                             |
| `shift_cost_snapshot`        | Append-only per-shift cost audit trail.                                                  | Control (C3)                                                                |
| `change_proposal`            | Persisted cascade preview (Terraform saved plan).                                        | Control (C4)                                                                |
| `public_holiday`             | Framework-defined calendar days for supplement calculation.                              | Control (D3/K1a)                                                            |
| `planning_factors`           | Planned vs actual tracking for learning loop.                                            | Control (C1/K1b)                                                            |
| `adjustment_factors`         | EWMA learning state.                                                                     | Control (C1/K1b)                                                            |

#### New Tables — Framework Model

| Table                         | Purpose                                                                                                                                           | Ownership      |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| `regulatory_framework`        | Versioned framework packages. E.g. `hospitality.no.default.v1`. Contains metadata, version, applicable jurisdiction, industry.                    | Platform (K1a) |
| `framework_rule`              | Individual evaluable rules within a framework. Type (gate/constraint/advisory/commercial), severity, evaluation logic reference, default outcome. | Platform (K1a) |
| `framework_trigger`           | Conditions that initiate evaluation — time-based, state-change, threshold crossing, external event.                                               | Platform (K1a) |
| `workspace_framework_binding` | Links a workspace to its active framework version. One active binding per workspace.                                                              | Runtime        |
| `workspace_rule_override`     | Workspace-level rule customization — tightened thresholds, exception paths, operational policy. Must stay within framework-permitted bounds.      | Runtime (K1b)  |
| `workspace_trigger_override`  | Workspace-level trigger customization — adjusted thresholds, added conditions, disabled triggers (within framework-permitted bounds).             | Runtime (K1b)  |
| `external_system_connection`  | Registered external system connections (Tripletex, etc.). Provider, credentials ref, sync config.                                                 | Runtime        |
| `external_sync_mapping`       | Maps internal entities to external system entities. Per-connection field mapping.                                                                 | Runtime        |
| `external_sync_event`         | Inbound/outbound sync events and webhook ingestion log.                                                                                           | Runtime        |

#### New Fields on Existing Tables

| Table                     | Field                  | Type                   | Purpose                                          |
| ------------------------- | ---------------------- | ---------------------- | ------------------------------------------------ |
| `department`              | `department_type`      | `department_type` ENUM | Operational/administrative/hybrid classification |
| `season`                  | `planning_cycle_id`    | UUID FK                | Links season to year wheel                       |
| `season`                  | `is_active`            | BOOLEAN                | System-managed current season flag               |
| `employment_contract`     | `agreed_weekly_hours`  | NUMERIC                | Critical for overtime calculation                |
| `profile`                 | `seniority_start_date` | DATE                   | Ansiennitet wage step lookup                     |
| `profile`                 | `has_fagbrev`          | BOOLEAN                | Fagbrev/non-fagbrev rate distinction             |
| `department_session`      | `planned_open`         | TIME                   | Set from operating hours at session creation     |
| `department_session`      | `planned_close`        | TIME                   | Set from operating hours at session creation     |
| `schedule_shift`          | `department_id`        | UUID FK                | Direct FK (backfill from position)               |
| `schedule_shift`          | `location_id`          | UUID FK                | Direct FK for location scoping                   |
| `schedule_template`       | `department_id`        | UUID FK                | Replace plain TEXT department column             |
| `schedule_template_shift` | `shift_function`       | `shift_function` ENUM  | Relationship to operating hours                  |
| `schedule_template_shift` | `start_anchor_type`    | `anchor_type` ENUM     | How start time is calculated                     |
| `schedule_template_shift` | `start_offset_min`     | INTEGER                | Minutes offset from anchor                       |
| `schedule_template_shift` | `end_anchor_type`      | `anchor_type` ENUM     | How end time is calculated                       |
| `schedule_template_shift` | `end_offset_min`       | INTEGER                | Minutes offset from anchor                       |
| `schedule_template_shift` | `slot_order`           | INTEGER                | Display order in vaktlista                       |
| `schedule_template_shift` | `label`                | TEXT                   | Human-readable name                              |

#### New Enums

| Enum                      | Values                                                                                                                  | Purpose                       |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| `department_type`         | operational, administrative, hybrid                                                                                     | Department classification     |
| `shift_function`          | opening, closing, supporting, rush_hour, sub_supply                                                                     | Template shift purpose        |
| `anchor_type`             | fixed, open, close                                                                                                      | Shift time anchoring          |
| `change_proposal_status`  | pending, approved, applied, rejected, expired                                                                           | Proposal lifecycle            |
| `framework_trigger_type`  | operating_hours, season_transition, template_change, event_added, manual_override, framework_rule_change, external_sync | What triggered the evaluation |
| `planning_event_category` | external_scraped, cultural_commercial, internal, weather, recurring                                                     | Event classification          |
| `planning_event_source`   | manual, scraped_municipality, scraped_cultural, weather_api, booking_integration, historical_import                     | Event origin                  |
| `planning_cycle_status`   | draft, active, archived                                                                                                 | Year wheel lifecycle          |
| `cascade_initiator`       | cascade_engine, admin_manual, c1_calibration, bootstrap                                                                 | Who originated the proposal   |
| `tariff_source`           | riksavtalen, allmenngjoring, internal                                                                                   | Rate provenance               |
| `framework_rule_type`     | gate, constraint, advisory, commercial                                                                                  | Rule classification           |
| `framework_trigger_mode`  | state_change, time_based, threshold, external_event                                                                     | How a trigger fires           |
| `evaluation_outcome`      | allowed, allowed_with_exception, review_required, blocked                                                               | Framework evaluation result   |
| `external_provider`       | tripletex, planday, visma                                                                                               | External system provider type |
| `sync_direction`          | inbound, outbound, bidirectional                                                                                        | Sync event direction          |
| `sync_status`             | pending, synced, failed, conflict                                                                                       | Sync event lifecycle          |

#### Tables to Deprecate

| Table/Column                 | Replacement                  |
| ---------------------------- | ---------------------------- |
| `operating_hours`            | `department_operating_hours` |
| `company_opening_hours`      | `department_operating_hours` |
| `season.opening_hours` JSONB | `department_operating_hours` |

#### Logged Adjustments (from brainstorming)

1. **`policy_status` vs `approval_status`**: `change_proposal` uses `change_proposal_status` (pending/approved/applied/rejected/expired). Separate from C4 policy evaluation result.
2. **`created_by_plane`**: ENUM `cascade_initiator` — `cascade_engine | admin_manual | c1_calibration | bootstrap`. Tracks which plane originated the proposal.
3. **`proposal_payload` diff contract**: `changes` JSONB stores the proposed mutation. `preview` JSONB stores the full CascadePreview result. Both immutable after creation.
4. **`expected_demand_multiplier`**: Named `demand_multiplier` on `planning_event` (not `expected_demand_multiplier`). 1.0 = normal, 1.5 = +50%.
5. **`public_holiday` PK**: Composite `(country_code, holiday_date)` — not UUID. Norway-only for now but extensible.
6. **Validity overlap protection**: `tariff_rate_table` uses `EXCLUDE USING gist` on `(rate_type, daterange(effective_from, effective_until))` to prevent overlapping rate periods.
7. **Tariff precedence**: When multiple rates could apply, resolution order is determined by the loaded framework package's precedence hierarchy (see Section 5 for the hospitality package's illustrative precedence). The foundation provides the `source` column on `tariff_rate_table` and the framework hierarchy resolution contract — the engine resolves in the order the active framework declares, not a hardcoded sequence.
8. **Credential normalization gate**: Profile certifications must be normalized before future resource matching can gate on them. This is a prerequisite noted here, not a Phase A deliverable.

**Dependencies:** None (pure schema).

**Does NOT do:** Application code, UI, framework resolution logic, cost calculation.

---

### Phase B — Framework Resolution & Proposal Engine

**Scope:** The framework-driven resolution engine and proposal/enforcement pipeline. Pure computation functions that load the active regulatory framework, evaluate rules and triggers, detect conflicts, compute impacts, and persist proposals. This is the core engine that all product layers (scheduling, compliance, payroll) will use.

#### Framework-Aware Context

```typescript
/** Loaded from workspace_framework_binding → regulatory_framework → framework_rule */
type FrameworkContext = {
  frameworkId: string; // e.g. 'hospitality.no.default.v1'
  rules: FrameworkRule[]; // All rules from the active framework
  triggers: FrameworkTrigger[]; // All triggers from the active framework
  workspaceOverrides: WorkspaceRuleOverride[]; // Workspace customizations
  triggerOverrides: WorkspaceTriggerOverride[];
  employeeContracts: Map<string, ContractSummary>;
};
```

The engine does not hardcode jurisdiction-specific logic. It loads the active framework and evaluates against it.

#### Pure Functions (6)

**1. `resolve_hours()`**

```typescript
function resolveEffectiveHours(
  departmentId: string,
  locationId: string | null,
  date: string,
  weeklyHours: DepartmentOperatingHoursRow[],
  overrides: DepartmentHoursOverrideRow[],
): EffectiveHours;

type EffectiveHours = {
  date: string;
  isOpen: boolean;
  openTime: string | null; // ISO time
  closeTime: string | null; // ISO time (may be next-day if crossesMidnight)
  crossesMidnight: boolean; // close_time < open_time in source row
  effectiveCloseTimestamp: string | null; // Full ISO timestamp (date + close, adjusted for next-day)
  source: "override" | "season_weekly" | "default_weekly" | "closed";
};
```

Resolution: override(date) > weekly(day_of_week, location-specific) > weekly(day_of_week, null location) > closed. All downstream consumers use `EffectiveHours`, never raw `open_time`/`close_time`.

**2. `compute_anchored_shift()`**

```typescript
function computeAnchoredTime(anchor: AnchorInput, hours: EffectiveHours): ComputedShiftTime;
```

fixed = use fixedTime. open = openTime + offset. close = closeTime + offset. Falls back to fixedTime if hours are closed.

**3. `evaluate_framework_rules()`**

```typescript
type ConflictCategory = "constraint" | "advisory" | "commercial";

type Conflict = {
  category: ConflictCategory;
  severity: "hard_block" | "hard_warn" | "soft_warn" | "info";
  outcome: EvaluationOutcome; // allowed | allowed_with_exception | review_required | blocked
  ruleId: string; // Reference to the framework_rule that triggered this
  entityType: string;
  entityId: string;
  description: string;
  exceptionPath?: string; // How this could be resolved (e.g., 'manager_approval', 'union_waiver')
  resolution?: string;
};

type EvaluationOutcome = "allowed" | "allowed_with_exception" | "review_required" | "blocked";

function evaluateFrameworkRules(
  proposedChanges: ProposedChange[],
  currentState: WorkspaceState,
  context: FrameworkContext,
): Conflict[];
```

Evaluates proposed changes against the active framework's rules. Not hardcoded checks — the engine iterates framework rules and evaluates each one. Conflicts are categorized by the rule type that produced them:

- **constraint**: Violations of framework-defined gates and constraints (e.g., working-time limits, rest period requirements, age-based restrictions — all loaded from the active framework, not hardcoded)
- **advisory**: Framework-defined best-practice warnings (e.g., short notice periods, expiring qualifications, consecutive working days — thresholds loaded from framework configuration)
- **commercial**: Cost/budget implications derived from framework compensation rules (e.g., threshold crossings that trigger higher rates, budget overshoot — rates and thresholds loaded from framework)

Each conflict carries an `outcome` from the framework evaluation, not a binary pass/fail.

**4. `derive_impacts()`**

```typescript
type CascadeImpact = {
  sessions: SessionImpact[];
  hooks: HookImpact[];
  notifications: NotificationImpact[];
  costDelta: CostImpact;
};

function deriveImpacts(
  resolvedHours: EffectiveHours[],
  recomputedShifts: RecomputedShift[],
  conflicts: Conflict[],
): CascadeImpact;
```

Computes downstream effects: session time adjustments, hook recalculations, notification targets, aggregate cost change.

**5. `compute_cascade_preview()`**

```typescript
type CascadePreview = {
  affectedSessions: SessionDiff[];
  affectedShifts: ShiftDiff[];
  affectedHooks: HookDiff[];
  notifications: NotificationTarget[];
  conflicts: Conflict[];
  costDelta: CostImpact;
  riskScore: number; // 0.0-1.0
  inputStateHash: string; // SHA-256 of input state for staleness detection
  frameworkId: string; // Which framework was active during evaluation
};

function computeCascadePreview(
  trigger: FrameworkTriggerEvent,
  currentState: WorkspaceState,
  frameworkContext: FrameworkContext,
): CascadePreview;
```

Pure function. No persistence. No proposal_id. Computes full impact even when `blocked` outcomes exist (blocks stop apply, not preview).

**6. `validate_proposal_freshness()`**

```typescript
function validateProposalFreshness(
  proposal: ChangeProposalRow,
  currentStateHash: string,
): { fresh: boolean; staleFields: string[] };
```

Compares `proposal.input_state_hash` against current state. If stale, returns which fields changed since preview was generated. Pure function — state loaded externally by caller.

#### Orchestration Functions (2)

**7. `persist_change_proposal()`**

```typescript
async function persistChangeProposal(
  workspaceId: string,
  initiatedBy: string,
  trigger: FrameworkTriggerEvent,
  preview: CascadePreview,
): Promise<ChangeProposalRow>;
```

Writes the preview to `change_proposal` table as immutable artifact. Sets status = 'pending'. Records the `frameworkId` that was active at evaluation time.

**8. `apply_cascade()`**

```typescript
async function applyCascade(proposal: ChangeProposalRow): Promise<ApplyResult>;
```

Applies the **frozen diff** from the proposal. No recomputation. The preview JSONB is the execution plan. If proposal is stale (freshness check fails), reject. Writes all changes in a single transaction. Emits `external_sync_event` for any connected external systems (e.g., Tripletex).

#### Pipeline (9 steps)

```
1. TRIGGER         → Operating hours changed / season transition / template edit / event added
2. LOAD FRAMEWORK  → Load active framework from workspace_framework_binding
3. RESOLVE         → resolve_hours() for each affected date
4. COMPUTE         → compute_anchored_shift() for each affected template shift
5. EVALUATE        → evaluate_framework_rules() against loaded framework
6. DERIVE          → derive_impacts() — sessions, hooks, notifications, cost
7. BUILD PREVIEW   → compute_cascade_preview() — pure, assembles full diff
8. PERSIST         → persist_change_proposal() — writes to DB
9. [REVIEW/APPLY]  → validate_proposal_freshness() → framework gate → apply_cascade()
```

Step 9 detail: If the framework evaluation produced `review_required` outcomes, the proposal requires explicit manager approval before apply. If `blocked`, apply is refused. If `allowed` or `allowed_with_exception`, apply proceeds (exceptions are logged with reason and approver in the audit trail).

#### Key Rules

- `blocked` outcomes stop **apply**, not preview. Preview always computes full impact.
- Apply is dumb — frozen diff only, no recomputation.
- Stale proposal detection via `input_state_hash` (SHA-256 of all input state at preview time).
- Framework evaluation gate sits between freshness check and apply. TypeScript in Phase B, Rego migration is future scope.
- Conflicts are categorized: constraint (framework-defined), advisory (best practice), commercial (cost).
- Cascade is idempotent — run 10 times, same result.
- Every evaluation is logged to `activity_trail` with the framework version, rule IDs, outcomes, and any exception paths taken.

**Dependencies:** Phase A (schema + framework model).

**Does NOT do:** Resource matching/assignment, scheduling UI, control plane intelligence, external sync execution.

---

### Phase C — Hospitality Bootstrap & Migration

**Scope:** Turn the industry intelligence layer from documentation into running code that seeds real workspaces. The initial and only supported production implementation is the **Norwegian hospitality package**. Additional industries remain out of scope until hospitality is proven in production.

#### Strategic Constraints

1. **Production scope is hospitality only.** Other industries are architectural futures, not supported runtime targets.
2. **I1 currently resolves only the hospitality package.** The package interface is generic, but only one package (`hospitality.ts`) is implemented and tested.
3. **Join intake stores provisional input; authenticated onboarding produces authoritative runtime records.** The `/join` flow collects raw business data. The `/onboarding` flow finalizes the workspace shell into cascade-ready runtime structures. `/dashboard/setup` is post-bootstrap completion guidance, not the source of runtime truth.
4. **Legacy onboarding artifacts** such as `company_opening_hours` remain as transitional inputs until migration is complete, but are **not** runtime sources of truth for cascade once `department_operating_hours` is active.

#### Two-Wizard Onboarding Model

The cascade spec previously described a theoretical 10-step onboarding wizard. The real product has two distinct wizards with different responsibilities:

##### A. Join Wizard (`/join`) — Minimal Tenant Shell Creation

**Purpose:** Acquire user, create workspace shell, collect raw hospitality intake, store provisional business data.

**Existing steps:** 6 steps — account → business (BRREG + scrape) → about/concept → opening hours → menu/cuisine → create account + invite.

**Outputs:**

- `workspace`, `company`, `profile`, `company_member` (identity layer)
- `company_details` (raw concept/cuisine/menu)
- `company_opening_hours` (raw 7-day grid — **provisional intake, not runtime D1**)
- `company_scraped_data` (optional scraped context)
- `company_social_media` (optional)

**What it does NOT do:** The join wizard does not create `department_operating_hours`, `planning_cycle`, `season`, `schedule_template`, `tariff_rate_table`, or any cascade runtime structures. Its opening-hours grid is a single company-level 7-day input — insufficient for department/location/season-specific hours, service windows, or override dates.

**Implementation rule:** Do not break `/join`. Keep `company_opening_hours` for intake compatibility. Reclassify it as raw onboarding input, not runtime source of truth.

##### B. Authenticated Onboarding (`/onboarding`) — I1 Hospitality Bootstrap Executor

**Purpose:** Apply the hospitality package, transform raw join intake into authoritative workspace runtime structures, seed D1-D6 defaults, and let the admin confirm or override package outputs before runtime truth is established.

**Existing steps:** hero → business → departments → locations → procedures → season → contract → welcome.

**Outputs (target state with cascade):**

- `planning_cycle` (year wheel)
- `season` records (Vår, Sommer, Høst, Jul/Vinter)
- Department model with `department_type` classification
- `department_operating_hours` (authoritative, per dept/location/season)
- `schedule_template` + `schedule_template_shift` with anchor types
- `tariff_rate_table` seeded with Riksavtalen rates
- `employee_payroll_profile` configuration
- Governance defaults (policies, procedures, HACCP routines)
- Handbook artifacts (auto-generated from confirmed setup)

#### Authenticated Onboarding Step Mapping (Revised)

Each step is defined by its **bootstrap interface** — what foundation records it creates, what provenance it stamps, and what package data it consumes. The concrete package content (which archetypes, which defaults) is defined by the loaded framework package, not by the foundation.

| Step                | Component                | Bootstrap Interface                                                                                                                             | Foundation Records Created                                                                                             |
| ------------------- | ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| 0 — Welcome         | `WelcomeStep`            | Bind workspace to framework package. Confirm D5 parameters (concept subtype, location mode). Create `workspace_framework_binding`.              | `workspace_framework_binding`                                                                                          |
| 1 — Documents       | `DocumentDropStep`       | Optional enrichment. Generates suggestions stored in wizard state. No foundation records.                                                       | None                                                                                                                   |
| 2 — Governance      | `GovernanceSetupStep`    | Consume package governance defaults. Admin confirms/modifies. Write records with `provenance.source = 'framework_package'` or `'admin_manual'`. | `policy`, `protocol` records (with provenance)                                                                         |
| 3 — Payroll         | `PayrollSetupStep`       | Consume package compensation regime. Seed `tariff_rate_table` from verified source bundle. Write records with provenance tracking source layer. | `tariff_rate_table` entries (with provenance)                                                                          |
| 4 — Employment      | `EmploymentSetupStep`    | Consume package employment defaults. Admin confirms/modifies.                                                                                   | Employment configuration (with provenance)                                                                             |
| 5 — Team            | `TeamSetupStep`          | Invite employees. Pure CRUD, no package dependency.                                                                                             | `invitation` records                                                                                                   |
| 6 — Shift Templates | `ShiftTemplateSetupStep` | Consume package shift archetypes. Read `company_opening_hours` → map into department-level hours via bootstrap service. Admin modifies.         | `schedule_template`, `schedule_template_shift` (with provenance)                                                       |
| 7 — Season          | `SeasonSetupStep`        | Create temporal structures. Transform join intake + package defaults into authoritative runtime records via bootstrap service.                  | `planning_cycle`, `season`, `department_operating_hours`, `planning_event`, `adjustment_factors` (all with provenance) |
| 8 — Handbook        | `HandbookSetupStep`      | Downstream consumer of steps 0-7. No direct foundation record creation.                                                                         | Handbook artifacts                                                                                                     |

#### Post-Bootstrap Setup Guide (`/dashboard/setup`)

The dashboard setup guide remains important, but it is a **consumer of bootstrap outputs**, not a bootstrap executor.

- It should be entered after workspace runtime truth exists.
- It should route from real setup status (`policy`, `profile`, `schedule_shift`, `season`, etc.), not from `workspace.onboarding_completed`.
- It may enrich governance, payroll, employment, team, shift-template, season, and handbook data, but it must not become a parallel source of truth beside the cascade bootstrap contract.

#### Bootstrap Service

The setup wizard does not write cascade records directly. It delegates to a bootstrap service:

```typescript
async function bootstrapWorkspaceFromHospitalityPackage(
  workspaceId: string,
  setupState: SetupWizardState,
): Promise<BootstrapResult>;
```

This service:

1. Reads raw join intake (`company_opening_hours`, `company_details`, scraped data)
2. Reads setup wizard choices (confirmed concept, payroll, governance, templates, seasons)
3. Resolves hospitality package defaults (from `hospitality.ts` + SQL templates)
4. **Creates `workspace_framework_binding`** — binds workspace to `hospitality.no.default.v1`
5. Creates authoritative runtime records (`department_operating_hours`, `planning_cycle`, etc.)
6. Creates `change_proposal` records where cascade preview is appropriate
7. Seeds D1/D3/D5-oriented structures
8. Marks legacy `company_opening_hours` as migrated

#### Bootstrap Levels

| Level   | Source                                                 | Data Quality                                     | When                                        |
| ------- | ------------------------------------------------------ | ------------------------------------------------ | ------------------------------------------- |
| Level 1 | Hospitality package (`hospitality.ts` + SQL templates) | Good defaults, may not match specific business   | Setup wizard Step 0 (industry confirmation) |
| Level 2 | Document enrichment (company handbook via Scrapling)   | Higher, extracted from actual business documents | Setup wizard Step 1 (optional)              |
| Level 3 | Integration bootstrap (POS, booking system, bank)      | Highest, from live operational data              | Future — not in scope                       |

Level 2 document extraction is **optional enrichment**, not a structural requirement. It generates suggestions that pre-fill later wizard steps but does not directly write runtime records.

#### Hospitality Package Content

The bootstrap service consumes the loaded framework package's domain defaults. The content of the first package (`hospitality.no.default.v1`) is described in Section 5 (non-normative). The foundation's contract is that the bootstrap service can consume any package that conforms to the `BootstrapConfig` interface below.

#### BootstrapConfig Type

```typescript
type BootstrapConfig = {
  workspaceId: string;
  industry: "hospitality"; // Only hospitality supported in production
  niche: HospitalityNiche; // 'fine_dining' | 'casual_dining' | 'fast_casual' | 'cafe' | 'bar' | 'hotel'
  locationMode: "single_site" | "multi_site";
  joinIntake: {
    companyOpeningHours: CompanyOpeningHoursRow[];
    companyDetails: CompanyDetailsRow;
    scrapedData?: ScrapedIntelligence;
  };
  setupChoices: {
    confirmedConcept: HospitalityNiche;
    governancePolicies: string[];
    payrollConfig: PayrollSetupState;
    employmentConfig: EmploymentSetupState;
    shiftTemplates: ShiftTemplateSetupState;
    seasonConfig: SeasonSetupState;
  };
  documentExtractions?: DocumentExtractionResult;
};
```

#### Source Provenance

Every bootstrapped record carries provenance metadata:

```typescript
type BootstrapProvenance = {
  source: "hospitality_package" | "join_intake" | "document_extraction" | "admin_manual";
  packageVersion: string;
  joinFieldMapped?: string; // e.g. 'company_opening_hours.monday'
  documentId?: string;
  extractionConfidence?: number;
  overriddenBy?: string;
};
```

#### Legacy Migration Path

**Phase 1 — Don't break `/join`:**

- Keep `company_opening_hours` for intake compatibility
- Reclassify as raw onboarding input, not runtime source of truth

**Phase 2 — Setup wizard as bootstrap executor:**

- Read `company_opening_hours` during Step 6/7
- Map single company grid → department-level hours (kitchen vs floor vs bar)
- Write authoritative `department_operating_hours`
- Mark legacy hours as migrated

**Phase 3 — Runtime cutover:**

- Cascade engine reads only `department_operating_hours` + overrides + templates + proposals
- Stop reading `company_opening_hours` outside onboarding context

**Phase 4 — Deprecation:**

- Remove `company_opening_hours` from runtime queries
- Eventually drop table (separate migration)

#### Riksavtalen Rate Correction

The current `hospitality.ts` has **incorrect** hardcoded values (e.g., kveldstillegg 56 kr/t, which is wrong). `hospitality.ts` is NOT the source of truth for rates. The `tariff_rate_table` is. Bootstrap seeds `tariff_rate_table` from the verified current source bundle at release time, validated against current published tariff/allmenngjøring sources (see Section 5).

**Dependencies:** Phase A (schema + framework model), Phase B (framework resolution engine), existing setup wizard infrastructure, hospitality package.

**Does NOT do:** Level 3 integration, mobile onboarding, POS connectivity, multi-industry support, join wizard replacement.

---

### Phase D — Integration Spine & Adapter Contracts

**Scope:** External system connection contracts, adapter interfaces, and the first production integration target (Tripletex). This phase defines HOW the foundation communicates with external payroll/ERP systems, not the scheduling product itself.

#### Architecture

Smartout owns the canonical framework/rule/enforcement model. External systems are **downstream execution, sync, and reconciliation backends** — they do not define business rules or replace the framework engine.

```
Smartout Foundation (source of truth)
  ↓ adapter contract
External System (execution backend)
  ↓ webhook / sync event
Smartout Foundation (reconciliation)
```

#### Adapter Contract

```typescript
interface ExternalAdapter {
  /** Provider identifier */
  provider: ExternalProvider; // 'tripletex' | 'visma' | etc.

  /** Map internal entity to external representation */
  mapOutbound(entity: InternalEntity, mapping: SyncMapping): ExternalPayload;

  /** Map external webhook/event to internal representation */
  mapInbound(event: ExternalEvent, mapping: SyncMapping): InternalEntity;

  /** Push changes to external system */
  sync(payload: ExternalPayload, connection: SystemConnection): Promise<SyncResult>;

  /** Validate that external state matches internal state */
  reconcile(internalState: InternalEntity[], externalState: ExternalEntity[]): ReconciliationReport;
}

type SyncResult = {
  status: "synced" | "failed" | "conflict" | "partial";
  externalId?: string;
  errors?: SyncError[];
  retryable: boolean;
};
```

#### External System Connection

```typescript
type SystemConnection = {
  connectionId: string;
  workspaceId: string;
  provider: ExternalProvider;
  credentialsRef: string; // op:// reference or Vault key — never raw secret
  syncConfig: {
    direction: "inbound" | "outbound" | "bidirectional";
    entities: string[]; // ['employee', 'shift', 'payroll_basis', 'absence']
    webhookUrl?: string;
    pollingIntervalMs?: number;
  };
  status: "active" | "paused" | "error";
};
```

#### Sync Event Flow

```
1. Foundation mutation (e.g., shift approved, employee updated)
2. Telemetry emit → check external_sync_mapping for affected entity
3. If mapped → create external_sync_event (outbound, pending)
4. Adapter picks up event → maps to external format → pushes to provider
5. Provider responds → update sync_event status (synced | failed | conflict)
6. If conflict → log for admin review, do NOT auto-resolve
```

Inbound flow (webhook from external system):

```
1. External webhook received → create external_sync_event (inbound, pending)
2. Adapter maps to internal format
3. If change detected → create change_proposal (framework evaluation applies)
4. Normal proposal flow: preview → review → apply
```

#### Tripletex — First Production Integration Target

**Tripletex** is the first production payroll/ERP adapter. Important framing:

- Tripletex is **NOT** the rule engine or source of framework truth
- Smartout owns the canonical employee, shift, payroll basis, and compliance model
- Tripletex is a **downstream payroll execution, sync, and reconciliation backend**

| Sync Entity            | Direction     | Smartout Source                          | Tripletex Target      |
| ---------------------- | ------------- | ---------------------------------------- | --------------------- |
| Employee master data   | Outbound      | `profile` + `employee_payroll_profile`   | Employee register     |
| Shift/hours basis      | Outbound      | `schedule_shift` + `shift_cost_snapshot` | Timesheet / hour list |
| Payroll supplements    | Outbound      | `tariff_rate_table` evaluation results   | Salary supplements    |
| Absence                | Bidirectional | `schedule_absence`                       | Absence register      |
| Employment contract    | Outbound      | `employment_contract`                    | Employment register   |
| Payslip reconciliation | Inbound       | Reconciliation report                    | Payslip data          |

The adapter must handle Tripletex-specific concerns (API versioning, rate limiting, token refresh) without leaking provider details into the core foundation.

#### Planday — Competitive Benchmark

**Planday** is an important competitive benchmark in the Norwegian hospitality market and a future capability benchmark. The foundation should be able to support future parity across domains including:

- Schedule management
- Absence / time-off
- Overtime / time bank
- Payroll basis export
- HR / employee master data
- Contract rules
- Punch / attendance
- Revenue / labor analytics
- Permissions / groups

However, the foundation must **NOT** be reshaped into Planday's API model. We want **capability parity later, not schema copying now**. The adapter contract is provider-agnostic — Planday import/export would be another adapter implementation, not a structural change.

**Dependencies:** Phase A (schema — `external_system_connection`, `external_sync_mapping`, `external_sync_event` tables).

**Does NOT do:** Full Tripletex adapter implementation (separate feature work), Planday adapter, real-time bidirectional sync, conflict auto-resolution.

---

### Future Product Layers

The following are product layers that consume the core foundation. They are architecturally designed but **not in current delivery scope**. Each will be specified separately when the foundation is stable.

#### Resource Matching & Assignment (Future)

The intelligence layer between template shifts and schedule assignments. Per-shift matching with framework-driven gates, scoring, and cost estimation. Consumes the framework model for compliance gates and the proposal pipeline for assignment enforcement.

Key design decisions preserved:

- Dual output: `MatchResult` (engine truth) + `MatchInteractionPayload` (C2 explanations)
- Hard gates are framework-rule evaluations, not hardcoded checks
- Per-shift matching, NOT global week optimizer (global optimizer is a separate planner layer)
- Scoring weights parameterized by D5 (service concept)

#### Scheduling UI (Future)

Product UI surfaces that expose cascade functionality to users:

- **Operating Hours CRUD** — department/season/location grid with override management
- **Vaktlista** — column-based shift grid with budget overlay and simulation mode
- **Compliance Gate** — pre-publish framework evaluation summary
- **Employee View** — shift details with pay breakdown from `shift_cost_snapshot`
- **Cascade Preview Modal** — Terraform-style diff display with conflict badges

UI design principles preserved:

- UI does not own policy decisions — displays what the engine computed
- No dual cost truth — employee view uses `shift_cost_snapshot`, not live recalculation
- Show source/provenance on all computed values
- Distinguish states visually: observed / proposed / planned / applied

#### Control Planes (Future)

The four planes that observe, explain, value, and govern the execution layer:

- **C1 — Observability & Calibration**: EWMA-based learning loop. Writes to `planning_factors`, `adjustment_factors`, K1b. All writes gated by C4 framework evaluation.
- **C2 — Context & Interaction**: Translates engine output into human-readable Norwegian. Authority-gated. Read-only against execution state.
- **C3 — Commercial & Outcome**: Aggregates `shift_cost_snapshot` + `daily_reconciliation`. Consumes cost data, never creates it. Value attribution via `change_proposal` linkage.
- **C4 — Policy & Governance**: Now substantially absorbed into the framework resolution model (Phase B). Remaining C4 scope: authority config management, monitor-mode rule graduation, Rego/OPA migration.

Plane interaction boundaries preserved:

- C1 cannot write without framework evaluation gate
- C2 cannot change rankings or execution truth
- C3 cannot create cost data
- C4 governs permissions, does not compute corrections

---

## 4. Data Model Summary

### 4.1 New Table Schemas

#### `planning_cycle`

```sql
CREATE TABLE planning_cycle (
  planning_cycle_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id        UUID NOT NULL REFERENCES workspace(workspace_id) ON DELETE CASCADE,
  name                TEXT NOT NULL,
  start_date          DATE NOT NULL,
  end_date            DATE NOT NULL,
  total_revenue_target NUMERIC(12,2),
  status              planning_cycle_status NOT NULL DEFAULT 'draft',
  created_by          UUID REFERENCES profile(profile_id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_cycle_dates CHECK (end_date > start_date),
  CONSTRAINT excl_cycle_no_overlap EXCLUDE USING gist (
    workspace_id WITH =,
    daterange(start_date, end_date, '[]') WITH &&
  )
);
```

#### `department_operating_hours`

```sql
CREATE TABLE department_operating_hours (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID NOT NULL REFERENCES workspace(workspace_id) ON DELETE CASCADE,
  department_id   UUID NOT NULL REFERENCES department(department_id) ON DELETE CASCADE,
  location_id     UUID REFERENCES location(location_id) ON DELETE CASCADE,
  season_id       UUID REFERENCES season(season_id) ON DELETE CASCADE,  -- NULL = workspace default; season-specific rows override defaults
  day_of_week     INT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  open_time       TIME,
  close_time      TIME,
  is_closed       BOOLEAN NOT NULL DEFAULT false,
  provenance      JSONB NOT NULL DEFAULT '{}',               -- { source, package_version, join_field_mapped? }
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_hours_valid CHECK (is_closed = true OR (open_time IS NOT NULL AND close_time IS NOT NULL))
);

-- NULL-safe uniqueness: Postgres UNIQUE treats NULL != NULL, which would allow
-- duplicate "default" rows. Use UNIQUE NULLS NOT DISTINCT (Postgres 15+) to
-- enforce singular defaults per department/day.
ALTER TABLE department_operating_hours
  ADD CONSTRAINT uq_dept_hours_weekly
  UNIQUE NULLS NOT DISTINCT (department_id, location_id, season_id, day_of_week);
```

`season_id` is nullable by design. `NULL` means workspace-wide default. Season-specific rows (with `season_id` set) override default rows for that season. Resolution order: override(date) > season-specific(day_of_week) > default(day_of_week, season_id IS NULL) > closed.

**Overnight spans:** `open_time` and `close_time` use same-day TIME semantics. For operations that cross midnight (e.g., bar closing at 02:00), `close_time < open_time` indicates a next-day close. The `resolve_hours()` function in Phase B must handle this case — when `close_time < open_time`, the effective close is `close_time` on the following calendar day. This is a foundation-level invariant, not a framework decision.

#### `department_hours_override`

```sql
CREATE TABLE department_hours_override (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID NOT NULL REFERENCES workspace(workspace_id) ON DELETE CASCADE,
  department_id   UUID NOT NULL REFERENCES department(department_id) ON DELETE CASCADE,
  location_id     UUID REFERENCES location(location_id) ON DELETE CASCADE,
  season_id       UUID REFERENCES season(season_id) ON DELETE CASCADE,
  override_date   DATE NOT NULL,
  open_time       TIME,
  close_time      TIME,
  is_closed       BOOLEAN NOT NULL DEFAULT false,
  reason          TEXT,
  planning_event_id UUID REFERENCES planning_event(planning_event_id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_override_hours_valid CHECK (is_closed = true OR (open_time IS NOT NULL AND close_time IS NOT NULL))
);

-- NULL-safe uniqueness for location_id
ALTER TABLE department_hours_override
  ADD CONSTRAINT uq_dept_hours_override
  UNIQUE NULLS NOT DISTINCT (department_id, location_id, override_date);
```

#### `planning_event`

```sql
CREATE TABLE planning_event (
  planning_event_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id        UUID NOT NULL REFERENCES workspace(workspace_id) ON DELETE CASCADE,
  planning_cycle_id   UUID REFERENCES planning_cycle(planning_cycle_id) ON DELETE SET NULL,
  name                TEXT NOT NULL,
  description         TEXT,
  category            planning_event_category NOT NULL,
  source              planning_event_source NOT NULL DEFAULT 'manual',
  event_date          DATE NOT NULL,
  end_date            DATE,
  demand_multiplier   NUMERIC(4,2) NOT NULL DEFAULT 1.0,
  expected_covers     INTEGER,
  confidence          NUMERIC(3,2) DEFAULT 0.5,
  is_recurring        BOOLEAN NOT NULL DEFAULT false,
  recurrence_rule     TEXT,
  external_source_url TEXT,
  hours_override_id   UUID,
  created_by          UUID REFERENCES profile(profile_id),
  provenance          JSONB NOT NULL DEFAULT '{}',               -- { source, package_version, external_source_url }
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

#### `tariff_rate_table`

```sql
CREATE TABLE tariff_rate_table (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID,                                       -- NULL = platform-wide (K1a)
  rate_type       TEXT NOT NULL,                               -- 'base_kokk_fagbrev', 'kveldstillegg', etc.
  source          tariff_source NOT NULL DEFAULT 'riksavtalen',
  effective_from  DATE NOT NULL,
  effective_until DATE,                                        -- NULL = current
  seniority_years INT,                                         -- NULL for supplements
  amount          NUMERIC(10,2) NOT NULL,
  unit            TEXT NOT NULL DEFAULT 'kr/t',                -- 'kr/t', '%', 'kr/mnd'
  metadata        JSONB DEFAULT '{}',                          -- time windows, conditions
  provenance      JSONB NOT NULL DEFAULT '{}',                -- { source, package_version, source_layer }
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT excl_tariff_no_overlap EXCLUDE USING gist (
    rate_type WITH =,
    COALESCE(workspace_id, '00000000-0000-0000-0000-000000000000'::uuid) WITH =,
    daterange(effective_from, COALESCE(effective_until, '9999-12-31'::date), '[]') WITH &&
  )
);
```

#### `employee_payroll_profile`

```sql
CREATE TABLE employee_payroll_profile (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id            UUID NOT NULL REFERENCES workspace(workspace_id) ON DELETE CASCADE,
  profile_id              UUID NOT NULL REFERENCES profile(profile_id) ON DELETE CASCADE,
  employment_contract_id  UUID REFERENCES employment_contract(employment_contract_id),
  salary_type             TEXT NOT NULL CHECK (salary_type IN ('hourly', 'monthly')),
  agreed_weekly_hours     NUMERIC(4,2) NOT NULL,
  tariff_category         TEXT NOT NULL,          -- 'kokk_fagbrev', 'servitor', 'ung_16' etc.
  seniority_start_date    DATE NOT NULL,
  sector_experience_years INTEGER NOT NULL DEFAULT 0,
  has_fagbrev             BOOLEAN NOT NULL DEFAULT false,
  tariff_override_id      UUID REFERENCES tariff_rate_table(id),  -- workspace-specific rate override
  valid_from              DATE NOT NULL,
  valid_until             DATE,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_payroll_profile UNIQUE (profile_id, valid_from),
  CONSTRAINT excl_payroll_no_overlap EXCLUDE USING gist (
    profile_id WITH =,
    daterange(valid_from, COALESCE(valid_until, '9999-12-31'::date), '[]') WITH &&
  )
);
```

Base hourly rate is NOT stored here. It is resolved at query time from `tariff_rate_table` using `tariff_category` + computed seniority bracket. This prevents drift between contract classification and actual rate.

#### `shift_cost_snapshot`

```sql
CREATE TABLE shift_cost_snapshot (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id        UUID NOT NULL REFERENCES workspace(workspace_id) ON DELETE CASCADE,
  schedule_shift_id   UUID NOT NULL REFERENCES schedule_shift(schedule_shift_id) ON DELETE CASCADE,
  profile_id          UUID REFERENCES profile(profile_id),
  base_hours          NUMERIC(5,2) NOT NULL,
  base_rate           NUMERIC(8,2) NOT NULL,
  base_cost           NUMERIC(10,2) NOT NULL,
  supplements         JSONB NOT NULL DEFAULT '[]',   -- Array<SupplementBreakdown>
  overtime_cost       NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_cost          NUMERIC(10,2) NOT NULL,
  calculated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  calculation_version INT NOT NULL DEFAULT 1
);
-- Append-only: new calculation = new row. Never UPDATE.
```

#### `change_proposal`

```sql
CREATE TABLE change_proposal (
  change_proposal_id  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id        UUID NOT NULL REFERENCES workspace(workspace_id) ON DELETE CASCADE,
  initiated_by        UUID NOT NULL REFERENCES profile(profile_id),
  framework_trigger_id UUID REFERENCES framework_trigger(trigger_id), -- Exact trigger definition that fired
  trigger_type        framework_trigger_type NOT NULL,                -- Denormalized convenience metadata
  trigger_entity_type TEXT NOT NULL,
  trigger_entity_id   UUID,
  created_by_plane    cascade_initiator NOT NULL DEFAULT 'admin_manual',
  status              change_proposal_status NOT NULL DEFAULT 'pending',
  changes             JSONB NOT NULL DEFAULT '{}',
  preview             JSONB NOT NULL DEFAULT '{}',
  input_state_hash    TEXT,                                    -- SHA-256 for staleness detection
  risk_score          NUMERIC(3,2),
  policy_decision       evaluation_outcome,  -- allowed | allowed_with_exception | review_required | blocked
  policy_rule_ids       TEXT[],              -- which rules triggered
  approval_required     BOOLEAN NOT NULL DEFAULT false,
  approved_by           UUID REFERENCES profile(profile_id),
  approved_at           TIMESTAMPTZ,
  rejected_at           TIMESTAMPTZ,
  rejection_reason      TEXT,
  affected_employee_count INTEGER DEFAULT 0,
  affected_shift_count    INTEGER DEFAULT 0,
  conflict_count          INTEGER DEFAULT 0,
  applied_at          TIMESTAMPTZ,
  expires_at          TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

#### `public_holiday`

```sql
CREATE TABLE public_holiday (
  country_code    CHAR(2) NOT NULL DEFAULT 'NO',
  holiday_date    DATE NOT NULL,
  name            TEXT NOT NULL,
  name_no         TEXT NOT NULL,                 -- Norwegian name
  is_full_day     BOOLEAN NOT NULL DEFAULT true, -- false for half-days (julaften)
  PRIMARY KEY (country_code, holiday_date)
);
```

**Scoped MVP:** This table is intentionally simplified for Norway-only launch. Future versions should add `region_code TEXT`, `holiday_type TEXT` (national/regional/religious/commercial), and change PK to synthetic UUID with unique constraint on `(country_code, region_code, holiday_date)`.

#### `planning_factors`

```sql
CREATE TABLE planning_factors (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID NOT NULL REFERENCES workspace(workspace_id) ON DELETE CASCADE,
  season_id       UUID REFERENCES season(season_id),
  factor_type     TEXT NOT NULL,        -- 'revenue', 'covers', 'labor_hours', 'labor_cost'
  dimension       TEXT NOT NULL,        -- 'weekday:1', 'hour:14', 'department:<uuid>'
  period_date     DATE NOT NULL,
  planned_value   NUMERIC(12,2) NOT NULL,
  actual_value    NUMERIC(12,2),
  variance_pct    NUMERIC(6,2) GENERATED ALWAYS AS (
    CASE WHEN planned_value != 0 AND actual_value IS NOT NULL
      THEN ((actual_value - planned_value) / planned_value * 100)
      ELSE NULL
    END
  ) STORED,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_planning_factor UNIQUE (workspace_id, factor_type, dimension, period_date)
);
```

#### `adjustment_factors`

```sql
CREATE TABLE adjustment_factors (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id      UUID NOT NULL REFERENCES workspace(workspace_id) ON DELETE CASCADE,
  season_id         UUID REFERENCES season(season_id),
  factor_type       TEXT NOT NULL,
  dimension         TEXT NOT NULL,
  adjustment_ratio  NUMERIC(6,4) NOT NULL DEFAULT 1.0,
  alpha             NUMERIC(4,3) NOT NULL DEFAULT 0.5,
  observation_count INTEGER NOT NULL DEFAULT 0,
  confidence        NUMERIC(3,2) NOT NULL DEFAULT 0.0,
  last_actual       NUMERIC(12,2),
  last_planned      NUMERIC(12,2),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_adjustment_factor UNIQUE (workspace_id, season_id, factor_type, dimension)
);
```

#### Framework Tables

#### `regulatory_framework`

```sql
CREATE TABLE regulatory_framework (
  framework_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code                TEXT NOT NULL UNIQUE,                    -- 'hospitality.no.default.v1'
  name                TEXT NOT NULL,
  description         TEXT,
  jurisdiction        TEXT NOT NULL DEFAULT 'NO',              -- ISO country code
  industry            TEXT NOT NULL,                           -- 'hospitality', 'retail', etc.
  version             TEXT NOT NULL DEFAULT '1.0.0',
  parent_framework_id UUID REFERENCES regulatory_framework(framework_id),  -- For inheritance
  is_active           BOOLEAN NOT NULL DEFAULT true,
  metadata            JSONB DEFAULT '{}',                      -- Supplement windows, thresholds, etc.
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

#### `framework_rule`

```sql
CREATE TABLE framework_rule (
  rule_id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  framework_id        UUID NOT NULL REFERENCES regulatory_framework(framework_id) ON DELETE CASCADE,
  code                TEXT NOT NULL,                           -- 'max_daily_hours', 'minor_work_time_gate', etc.
  rule_type           framework_rule_type NOT NULL,            -- gate | constraint | advisory | commercial
  category            TEXT NOT NULL,                           -- 'working_time', 'rest_period', 'age_restriction', etc.
  description         TEXT NOT NULL,
  description_no      TEXT,                                    -- Norwegian description
  default_outcome     evaluation_outcome NOT NULL DEFAULT 'blocked',
  severity            TEXT NOT NULL DEFAULT 'hard_block',      -- hard_block | hard_warn | soft_warn | info
  -- Override capability grammar (foundation invariant)
  outcome_overridable BOOLEAN NOT NULL DEFAULT false,          -- Can workspace change the default outcome?
  config_tighten_allowed BOOLEAN NOT NULL DEFAULT true,        -- Can workspace make thresholds stricter?
  config_loosen_allowed BOOLEAN NOT NULL DEFAULT false,        -- Can workspace make thresholds more permissive?
  override_min_level  TEXT,                                    -- Minimum authority: 'manager' | 'admin' | 'owner'
  evaluation_config   JSONB NOT NULL DEFAULT '{}',             -- Thresholds, time windows, conditions
  source_reference    TEXT,                                    -- Legal reference, e.g. 'AML §10-4'
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_framework_rule UNIQUE (framework_id, code)
);
```

#### `workspace_framework_binding`

```sql
CREATE TABLE workspace_framework_binding (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id        UUID NOT NULL REFERENCES workspace(workspace_id) ON DELETE CASCADE,
  framework_id        UUID NOT NULL REFERENCES regulatory_framework(framework_id),
  activated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  deactivated_at      TIMESTAMPTZ,
  activated_by        UUID REFERENCES profile(profile_id),
  is_active           BOOLEAN NOT NULL DEFAULT true,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Partial unique index: only one active binding per workspace. Inactive historical bindings are preserved.
CREATE UNIQUE INDEX uq_workspace_active_framework
  ON workspace_framework_binding (workspace_id)
  WHERE is_active = true;
```

#### `workspace_rule_override`

```sql
CREATE TABLE workspace_rule_override (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id        UUID NOT NULL REFERENCES workspace(workspace_id) ON DELETE CASCADE,
  rule_id             UUID NOT NULL REFERENCES framework_rule(rule_id) ON DELETE CASCADE,
  override_outcome    evaluation_outcome,                      -- Override the default outcome
  override_config     JSONB DEFAULT '{}',                      -- Override thresholds, conditions
  reason              TEXT NOT NULL,                           -- Why this override exists
  approved_by         UUID REFERENCES profile(profile_id),
  valid_from          DATE,
  valid_until         DATE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_workspace_rule_override UNIQUE (workspace_id, rule_id)
);
```

**Override governance (foundation invariant):** Writes to `workspace_rule_override` must be validated against the referenced `framework_rule`'s override capability grammar:

| Capability Field                | Effect on Override                                                               |
| ------------------------------- | -------------------------------------------------------------------------------- |
| `outcome_overridable = false`   | Override write that changes outcome MUST be rejected                             |
| `outcome_overridable = true`    | Outcome override allowed, subject to `override_min_level` authority check        |
| `config_tighten_allowed = true` | Workspace may make thresholds stricter than framework default                    |
| `config_loosen_allowed = false` | Workspace may NOT make thresholds more permissive                                |
| `config_loosen_allowed = true`  | Workspace may loosen thresholds, subject to `override_min_level` authority check |
| `override_min_level`            | Minimum authority required for any override (manager/admin/owner)                |

Similarly, writes to `workspace_trigger_override` must respect `framework_trigger.is_disableable` and `threshold_tune_allowed`.

This validation is enforced at the service layer, not via database constraints alone. The override capability grammar is a **foundation invariant** — it is part of the schema contract, not the framework package content.

#### `framework_trigger`

```sql
CREATE TABLE framework_trigger (
  trigger_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  framework_id        UUID NOT NULL REFERENCES regulatory_framework(framework_id) ON DELETE CASCADE,
  code                TEXT NOT NULL,                           -- 'season_transition', 'hours_changed', etc.
  description         TEXT NOT NULL,
  description_no      TEXT,
  trigger_mode        framework_trigger_mode NOT NULL,         -- state_change | time_based | threshold | external_event
  source_entity_type  TEXT,                                    -- 'department_operating_hours', 'season', etc.
  evaluation_config   JSONB NOT NULL DEFAULT '{}',             -- Conditions, thresholds, timing
  linked_rule_ids     UUID[] DEFAULT '{}',                     -- Framework rules to evaluate when triggered
  is_enabled          BOOLEAN NOT NULL DEFAULT true,
  -- Override capability grammar (foundation invariant)
  is_disableable      BOOLEAN NOT NULL DEFAULT false,          -- Can workspace disable this trigger?
  threshold_tune_allowed BOOLEAN NOT NULL DEFAULT true,        -- Can workspace adjust trigger thresholds?
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_framework_trigger UNIQUE (framework_id, code)
);
```

#### `workspace_trigger_override`

```sql
CREATE TABLE workspace_trigger_override (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id        UUID NOT NULL REFERENCES workspace(workspace_id) ON DELETE CASCADE,
  trigger_id          UUID NOT NULL REFERENCES framework_trigger(trigger_id) ON DELETE CASCADE,
  override_config     JSONB DEFAULT '{}',                      -- Adjusted thresholds, additional conditions
  is_disabled         BOOLEAN NOT NULL DEFAULT false,          -- Disable trigger (within framework-permitted bounds)
  reason              TEXT NOT NULL,
  approved_by         UUID REFERENCES profile(profile_id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_workspace_trigger_override UNIQUE (workspace_id, trigger_id)
);
```

#### `external_system_connection`

```sql
CREATE TABLE external_system_connection (
  connection_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id        UUID NOT NULL REFERENCES workspace(workspace_id) ON DELETE CASCADE,
  provider            external_provider NOT NULL,              -- 'tripletex' | 'visma' | etc.
  name                TEXT NOT NULL,
  credentials_ref     TEXT NOT NULL,                           -- op:// reference or Vault key
  sync_config         JSONB NOT NULL DEFAULT '{}',             -- Direction, entities, intervals
  status              TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'error')),
  last_sync_at        TIMESTAMPTZ,
  error_message       TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

#### `external_sync_mapping`

```sql
CREATE TABLE external_sync_mapping (
  mapping_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id       UUID NOT NULL REFERENCES external_system_connection(connection_id) ON DELETE CASCADE,
  workspace_id        UUID NOT NULL REFERENCES workspace(workspace_id) ON DELETE CASCADE,
  internal_entity_type TEXT NOT NULL,                          -- 'profile', 'schedule_shift', 'employment_contract', etc.
  external_entity_type TEXT NOT NULL,                          -- Provider-specific: 'employee', 'timesheet_entry', etc.
  field_mapping       JSONB NOT NULL DEFAULT '{}',             -- { "internal_field": "external_field", ... }
  transform_config    JSONB DEFAULT '{}',                      -- Value transformations, format conversions
  direction           sync_direction NOT NULL DEFAULT 'outbound',
  is_active           BOOLEAN NOT NULL DEFAULT true,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_sync_mapping UNIQUE (connection_id, internal_entity_type, external_entity_type, direction)
);
```

#### `external_sync_event`

```sql
CREATE TABLE external_sync_event (
  event_id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id       UUID NOT NULL REFERENCES external_system_connection(connection_id) ON DELETE CASCADE,
  workspace_id        UUID NOT NULL REFERENCES workspace(workspace_id) ON DELETE CASCADE,
  direction           sync_direction NOT NULL,
  entity_type         TEXT NOT NULL,                           -- 'employee', 'shift', 'absence', etc.
  entity_id           UUID,
  external_id         TEXT,
  status              sync_status NOT NULL DEFAULT 'pending',
  payload             JSONB NOT NULL DEFAULT '{}',
  error_message       TEXT,
  retryable           BOOLEAN NOT NULL DEFAULT true,
  retry_count         INTEGER NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 4.2 Ownership Classification

| Table                         | Owner                | Mutation Source                                     |
| ----------------------------- | -------------------- | --------------------------------------------------- |
| **Domain Model**              |                      |                                                     |
| `planning_cycle`              | Runtime (D1)         | Admin CRUD                                          |
| `department_operating_hours`  | Runtime (D1)         | Admin CRUD, bootstrap                               |
| `department_hours_override`   | Runtime (D1)         | Admin CRUD, planning events                         |
| `planning_event`              | Runtime (D4)         | Admin, scrapers, integrations                       |
| `tariff_rate_table`           | K1a / K1b (override) | Framework seed, platform admin. Consumed by D3, C3. |
| `employee_payroll_profile`    | Runtime (D2)         | HR CRUD, contract changes                           |
| `shift_cost_snapshot`         | Control (C3)         | Cascade engine (append-only)                        |
| `change_proposal`             | Control (C4)         | Cascade engine                                      |
| `public_holiday`              | K1a (platform)       | Framework seed (annual)                             |
| `planning_factors`            | Control (C1)         | Session close, reconciliation                       |
| `adjustment_factors`          | Control (C1)         | EWMA engine (service_role only)                     |
| **Framework Model**           |                      |                                                     |
| `regulatory_framework`        | Platform (K1a)       | Platform admin only                                 |
| `framework_rule`              | Platform (K1a)       | Platform admin only                                 |
| `workspace_framework_binding` | Runtime              | Bootstrap, admin (rare)                             |
| `workspace_rule_override`     | Runtime (K1b)        | Admin CRUD, with approval audit                     |
| `framework_trigger`           | Platform (K1a)       | Platform admin only                                 |
| `workspace_trigger_override`  | Runtime (K1b)        | Admin CRUD, with approval audit                     |
| **Integration Model**         |                      |                                                     |
| `external_system_connection`  | Runtime              | Admin CRUD                                          |
| `external_sync_mapping`       | Runtime              | Admin CRUD                                          |
| `external_sync_event`         | Runtime              | Adapter engine (automated)                          |

### 4.3 Boundary Rules

1. Runtime tables (D1-D6) are written by user actions and cascade engine.
2. Control tables (C1-C4) are written by their respective plane, never by user CRUD.
3. K1a tables are platform-managed, tenant-visible but not tenant-writable (except workspace overrides).
4. K1b tables are workspace-scoped with strict RLS isolation.
5. `shift_cost_snapshot` is append-only. C3 reads, never writes.
6. `change_proposal` payload fields (`changes`, `preview`, `input_state_hash`) are immutable after creation. Lifecycle and governance fields (`status`, `policy_decision`, `policy_rule_ids`, `approval_required`, `approved_by`, `approved_at`, `rejected_at`, `rejection_reason`, `applied_at`) may be updated as the proposal progresses through its lifecycle.
7. Framework tables (`regulatory_framework`, `framework_rule`) are platform-managed. Workspaces can only customize via `workspace_rule_override`, never modify the framework itself.
8. External sync events are append-only audit records. Failed syncs are retried or escalated, never deleted.
9. **Cross-workspace integrity (foundation invariant):** Tables carrying both `workspace_id` and FKs to other workspace-scoped entities must enforce same-workspace consistency. Enforcement strategy per table:

   | Table                        | Cross-Workspace FKs                                   | Enforcement                                                                                                                              |
   | ---------------------------- | ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
   | `department_operating_hours` | `department_id`, `location_id`, `season_id`           | Composite FK practical: all parents have `workspace_id`. Service-layer check on write. RLS scopes reads.                                 |
   | `department_hours_override`  | `department_id`, `location_id`, `planning_event_id`   | Same as above.                                                                                                                           |
   | `employee_payroll_profile`   | `profile_id`, `employment_contract_id`                | Service-layer check required — composite FK impractical across profile + contract. RLS scopes reads.                                     |
   | `change_proposal`            | `initiated_by`, `approved_by`, `framework_trigger_id` | `framework_trigger_id` is platform-scoped (K1a), not workspace-scoped — no cross-workspace risk. Profile FKs validated at service layer. |
   | `external_sync_mapping`      | `connection_id`                                       | Composite FK practical: `connection_id` has `workspace_id`.                                                                              |
   | `external_sync_event`        | `connection_id`                                       | Same as above.                                                                                                                           |

   Where composite FK is practical, it SHOULD be used. Where impractical (cross-entity-type joins), service-layer validation + RLS is the enforcement mechanism.

10. **Overnight time semantics (foundation invariant):** Operating-hours rows represent a **single continuous service window** starting on the row's calendar day. `open_time` and `close_time` use TIME type. When `close_time < open_time`, the effective close is on the following calendar day (e.g., `open_time = 16:00`, `close_time = 02:00` means 16:00 today → 02:00 tomorrow).

    All foundation consumers must interpret this consistently:
    - **`resolve_hours()`** (Phase B): returns an `EffectiveHours` with `crossesMidnight: boolean` and effective close as next-day timestamp.
    - **Override resolution**: an override for date D applies to the service window that _starts_ on date D, even if it ends on D+1. An override for D+1 does not affect a window that started on D.
    - **Shift anchoring**: `close`-anchored shifts use the effective close timestamp (which may be on the next calendar day).
    - **Session creation**: a `department_session` for date D covers the service window starting on D, including any next-day hours.
    - **Cost/compliance windows**: supplement and constraint evaluation must use the effective timestamp range, not the raw TIME values. A shift from 22:00-02:00 crosses midnight and may span multiple supplement windows.

    This is a foundation contract. Services that read `department_operating_hours` MUST use `resolve_hours()` — never interpret raw `open_time`/`close_time` directly.

### 4.4 Provenance & Audit Requirements (Foundation Invariant)

Provenance and audit are **schema-level concerns**, not service-layer best practices. The foundation requires explicit persistence contracts for traceability.

#### Records that MUST carry provenance metadata

Every bootstrapped or framework-seeded record carries a `provenance JSONB NOT NULL DEFAULT '{}'` column. This column is present in the table DDLs in Section 4.1 — it is schema-level, not service convention.

| Table                        | Provenance Required                | Minimum Fields                                                                                                      |
| ---------------------------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `department_operating_hours` | Yes                                | `source` (framework_package / join_intake / admin_manual), `package_version`, `join_field_mapped`                   |
| `tariff_rate_table`          | Yes                                | `source` (framework_package / admin_manual), `package_version`, `source_layer` (statutory / collective / workspace) |
| `schedule_template`          | Yes                                | `source`, `package_version`                                                                                         |
| `planning_event`             | Yes                                | `source` (framework_package / scraped / admin_manual), `external_source_url`                                        |
| `workspace_rule_override`    | Yes (via `reason` + `approved_by`) | Override reason, approving authority, valid period                                                                  |
| `workspace_trigger_override` | Yes (via `reason` + `approved_by`) | Override reason, approving authority                                                                                |

#### Rule evaluation artifacts

Every framework rule evaluation that results in a `change_proposal` must persist the evaluation snapshot:

| Data                                                                      | Where                                         | Retention                |
| ------------------------------------------------------------------------- | --------------------------------------------- | ------------------------ |
| Full evaluation result (rules evaluated, outcomes, exception paths taken) | `change_proposal.preview` JSONB               | Immutable after creation |
| Framework version active at evaluation time                               | `change_proposal.preview` → `frameworkId`     | Immutable                |
| Trigger that fired                                                        | `change_proposal.framework_trigger_id` FK     | Immutable                |
| Override exceptions applied                                               | `change_proposal.policy_rule_ids` array       | Immutable                |
| Manager approval (for `review_required` outcomes)                         | `change_proposal.approved_by` + `approved_at` | Append-only              |

#### Audit trail integration

The foundation uses the existing `activity_trail` table (already in the codebase) as the immutable audit log. Every framework evaluation, override write, and proposal lifecycle transition emits to `activity_trail` via `emit()`. The foundation does not create a new audit table — it defines the contract that these events MUST be emitted.

---

## 5. First Framework Package — `hospitality.no.default.v1` (Non-Normative)

> **Scope note:** This entire section is **non-normative reference material**. It is NOT part of the core foundation specification. It describes the first framework package that will be loaded into the foundation containers after Phase A is complete. Nothing below is a foundation-level decision — it is illustrative of what a loaded framework package looks like and what parameter shapes the foundation must support. The foundation's contract is defined in Sections 2-4 only.

This section sketches the seed data structure for the `hospitality.no.default.v1` regulatory framework to validate that the foundation containers (tables, enums, parameter model, evaluation pipeline) can accommodate real-world framework content. The actual package specification, verification, and seeding is a separate deliverable outside this foundation spec.

The package has **three distinct data layers** with different legal status, override rules, and sources. These layers must not be conflated in the package implementation.

**Important:** The current `hospitality.ts` file has incorrect hardcoded values and is NOT the source of truth. The `tariff_rate_table` (seeded from the framework package) is. Concrete numerical values are **not embedded in this spec**. They are resolved from a verified source bundle at release time, validated against current Fellesforbundet/NHO published rates (most recently updated 1 April 2025) and applicable allmenngjøring regulations.

### 5.0 Package Domain Coverage

The hospitality package owns concrete domain defaults across these areas (illustrative, not exhaustive):

| Domain                       | Example Package Contents                                                  |
| ---------------------------- | ------------------------------------------------------------------------- |
| **Department archetypes**    | Dining room/service, kitchen, bar, takeaway, admin                        |
| **Service concept variants** | Fine dining, casual dining, fast casual, cafe, bar/pub, hotel restaurant  |
| **Shift archetypes**         | Opening, prep, lunch rush, dinner rush, close, bar close, support/runner  |
| **Compensation defaults**    | Tariff categories, supplement parameter shapes, typical contract patterns |
| **Season/event defaults**    | Seasonal periods, recurring cultural/commercial events                    |
| **Governance defaults**      | Hygiene, opening/closing procedures, role-based responsibilities          |

### 5.1 Layer A — Statutory / Allmenngjort Floor

**Source:** Allmenngjøring av tariffavtale for overnattings-, serverings- og cateringvirksomheter (current regulation). Published by Tariffnemnda.

**Legal status:** Mandatory minimums. Apply to ALL employers in the hospitality sector in Norway, regardless of union membership or collective agreement. Non-negotiable floor.

**Override rule:** `is_overridable = false`. Workspace overrides cannot reduce these values. Collective agreement terms and workspace policy can only exceed them.

| Factor Category                      | Description                               | Unit | Stored As                                            |
| ------------------------------------ | ----------------------------------------- | ---- | ---------------------------------------------------- |
| Allmenngjort minimum wage (18+)      | Minimum hourly rate, workers 18 and older | kr/t | `tariff_rate_table` with `source = 'allmenngjoring'` |
| Allmenngjort minimum wage (under 18) | Minimum hourly rate, workers under 18     | kr/t | `tariff_rate_table` with `source = 'allmenngjoring'` |

Concrete rates are resolved from the current allmenngjøring regulation at build time and seeded into `tariff_rate_table`. The framework engine evaluates these as the absolute floor — any collective agreement or workspace rate that falls below triggers a `blocked` evaluation outcome.

### 5.2 Layer B — Collective Agreement Seed (Riksavtalen)

**Source:** Riksavtalen for serveringsoverenskomsten (NHO/Fellesforbundet). Current published rates from Fellesforbundet, effective from the most recent general tariff settlement.

**Legal status:** Applies to employers bound by the collective agreement. For allmenngjort sectors, the collective agreement rates typically exceed the allmenngjort floor. The framework seeds these as the default compensation regime, but they are a **different layer** from the statutory floor.

**Override rule:** `outcome_overridable = false`, `config_tighten_allowed = true`, `config_loosen_allowed = false`. Override requires `override_min_level = 'admin'`.

**Illustrative tariff precedence for this package:** workspace override > allmenngjøring > riksavtalen > internal. This is a package-defined precedence order, not a foundation constant.

| Factor Category                | Description                                             | Seniority Brackets | Stored As                                                                                  |
| ------------------------------ | ------------------------------------------------------- | ------------------ | ------------------------------------------------------------------------------------------ |
| Base wage — kokk med fagbrev   | Hourly rate by seniority step (0, 2, 4, 6, 8, 10 years) | 6 brackets         | `tariff_rate_table` rows, `source = 'riksavtalen'`, `rate_type = 'base_kokk_fagbrev'`      |
| Base wage — kokk uten fagbrev  | Hourly rate by seniority step                           | 6 brackets         | `tariff_rate_table` rows, `source = 'riksavtalen'`, `rate_type = 'base_kokk_uten_fagbrev'` |
| Base wage — servitør           | Hourly rate by seniority step                           | 6 brackets         | `tariff_rate_table` rows, `source = 'riksavtalen'`, `rate_type = 'base_servitor'`          |
| Ansiennitetstillegg (personal) | Monthly supplement for 10 / 15 / 20 years in company    | 3 brackets         | `tariff_rate_table` rows, `rate_type = 'ansiennitetstillegg'`                              |

All rates are resolved from the current Fellesforbundet published tariff at release time and validated against Lovdata. The spec does not embed concrete kr/t values — the verified source bundle is the single point of truth.

### 5.3 Layer C — Framework Compensation & Constraint Rules

> **Illustrative:** This layer describes the types of rules and parameter structures the hospitality framework package would define. The foundation provides the containers (`framework_rule`, `evaluation_config` JSONB, `evaluation_outcome` enum). The content below shows what a seeded framework looks like — it is not foundation-level specification.

**Source:** Combination of statutory, collective agreement, and standard hospitality practice sources.

**Legal status:** Varies per rule. Some are statutory-derived, some are collective agreement terms, some are framework defaults. The framework encodes the source and overridability of each rule.

#### Supplement Rules (tillegg)

| Factor Key          | Norwegian         | Parameter Types in `evaluation_config`                                                      |
| ------------------- | ----------------- | ------------------------------------------------------------------------------------------- |
| `kveldstillegg`     | Kveldstillegg     | Amount (kr/t), time window (weekdays + hours), source reference                             |
| `nattillegg`        | Nattillegg        | Amount (kr/t), time window (hours), source reference                                        |
| `helgetillegg`      | Helgetillegg      | Amount (kr/t), time window (weekday + hours), source reference                              |
| `helligdagstillegg` | Helligdagstillegg | Rate type (percentage of base), calendar day reference (`public_holiday`), source reference |

Time windows, amounts, and rate types are stored in the framework rule's `evaluation_config` JSONB, not hardcoded in engine logic. Concrete values are resolved from the verified source bundle at release time.

#### Overtime Rules (overtid)

The framework defines overtime as a set of rate factors and threshold triggers, not as hardcoded percentages:

| Factor Key    | Parameter Types in `evaluation_config`                                                     |
| ------------- | ------------------------------------------------------------------------------------------ |
| `overtid_50`  | Rate multiplier (percentage), trigger threshold (hours/day, hours/week), source reference  |
| `overtid_100` | Rate multiplier (percentage), trigger threshold, applicable time windows, source reference |

The concrete rate multipliers, ordinary-hours baselines, and trigger thresholds are framework-managed data resolved at seed time. The active work-time regime must resolve the actual applicable thresholds for each evaluation context, which may vary based on:

- Shift work arrangements (reduced ordinary hours for rotating shifts)
- Collective agreement terms (different averaging periods)
- Individual contract terms (agreed weekly hours affecting when overtime begins)
- Averaging arrangements (agreement-based averaging over extended periods)

The framework stores these parameters in `evaluation_config` and the engine evaluates against the resolved applicable regime for each employee and shift context.

#### Illustrative Working Time Constraint Rules

The following are examples of rules that `hospitality.no.default.v1` would define. Each rule's thresholds, source references, and default outcomes are framework-managed data — loaded into `framework_rule` rows with `evaluation_config` containing the concrete parameters. The foundation provides the containers; the values below are illustrative of what the hospitality package seeds.

| Rule Code              | Rule Category         | Parameter Types in `evaluation_config`                                 |
| ---------------------- | --------------------- | ---------------------------------------------------------------------- |
| `max_daily_hours`      | Working time limit    | Threshold (hours), period (24h), source reference                      |
| `max_weekly_hours`     | Working time limit    | Threshold (hours), period (7d), source reference                       |
| `min_daily_rest`       | Rest period           | Threshold (hours), period (24h), exception path flag, source reference |
| `min_weekly_rest`      | Rest period           | Threshold (hours), period (7d), exception path flag, source reference  |
| `minor_work_time_gate` | Age-based restriction | Age threshold, time window, source reference                           |

Each rule carries its own `default_outcome` (from the `evaluation_outcome` enum) and `is_overridable` flag. Rules with exception paths (e.g., rest periods where agreement-based reductions are permitted) use `review_required` as the default outcome, allowing the workspace to document a valid exception that resolves to `allowed_with_exception`. The specific thresholds, outcomes, and exception paths are determined when the framework package is seeded — not by the foundation itself.

---

## 6. AI Council Validation

Architecture validated 2026-03-21 by 12-persona AI Council across three sub-councils.

### 6.1 Council Composition

**Hospitality Council (5):** Executive Chef, Restaurant Manager, HR Director, Night Manager, Sommelier/Bar Manager

**Infrastructure Council (4):** Database Architect, Distributed Systems Engineer, Security Auditor, DevOps Lead

**AI Council (3):** ML Engineer, Conversational AI Specialist, Ethics & Governance Lead

### 6.2 Key Scenarios Tested (35+)

- Season transition: Var --> Sommer (hours change, new staff, capacity increase)
- Emergency closure: Christmas Eve override propagation
- Concurrent edits: Two admins editing hours for same department
- Stale proposal: State changed between preview and apply
- Minor compliance: Under-18 scheduled after 21:00
- Overtime cascade: Single shift change pushing weekly total over 40h
- Bootstrap accuracy: Industry template vs actual business hours
- Cross-location: Same department, different hours at two locations
- Production debt: Monday prep deficit affecting Tuesday staffing
- Temporal boundary: Shift spanning midnight (supplement window crossing)

### 6.3 Key Decisions Validated

| Decision                        | Validation                                                                 |
| ------------------------------- | -------------------------------------------------------------------------- |
| 6 dimensions (not 7)            | D7 decomposed into 4 control planes provides better separation of concerns |
| D6 temporal debt property       | Unique to D6, no other dimension accumulates across days                   |
| K1a/K1b split                   | Prevents tenant data from contaminating platform defaults                  |
| I1 as pre-runtime bootstrap     | Clean separation: bootstrap is not a dimension or control plane            |
| TypeScript + Rego for C4        | TypeScript first, Rego when policy complexity requires it                  |
| Per-shift matching (not global) | Global optimizer is a separate planner layer, future scope                 |
| Conflict categories (3)         | constraint/advisory/commercial covers all observed conflict types          |
| Framework-driven, not hardcoded | Engine loads applicable framework, does not embed jurisdiction logic       |

---

## 7. Open Items / Technical Debt

| Item                               | Phase                 | Priority | Notes                                                                                                                                                                                                               |
| ---------------------------------- | --------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `hospitality.ts` rate correction   | Phase C               | High     | Current values are wrong. Must be corrected when seeding `tariff_rate_table` from framework                                                                                                                         |
| Framework rule + trigger seed data | Phase A               | High     | Populate `framework_rule` and `framework_trigger` with hospitality.no.default.v1 definitions (rules: working time, rest, age, supplements; triggers: hours change, season transition, template edit, external sync) |
| Credential normalization           | Pre-resource-matching | Medium   | Profile certifications must be normalized before future resource matching can gate on them                                                                                                                          |
| Tripletex adapter implementation   | Post-Phase D          | Medium   | First production external adapter. Phase D defines contracts only.                                                                                                                                                  |
| Rego/OPA migration                 | Future                | Medium   | Replace TypeScript framework evaluation with Rego for auditable, declarative policy evaluation                                                                                                                      |
| Global week optimizer              | Future                | Medium   | Minimize total weekly cost while respecting all constraints. Separate planner layer above foundation                                                                                                                |
| Level 3 integration bootstrap      | Future                | Low      | POS, booking system, bank integrations for highest-quality bootstrap data                                                                                                                                           |
| Mobile app views                   | Future                | Medium   | React Native views for employee shift view, manager cascade preview                                                                                                                                                 |
| Historical data import             | Phase C               | Low      | Import from Bubble.io, previous year actuals for future C1 calibration                                                                                                                                              |
| Multi-currency support             | Future                | Low      | Currently NOK-only. Tariff table structure supports it but no UI                                                                                                                                                    |
| Supplement window edge cases       | Future                | Medium   | Shifts spanning midnight, partial-hour supplements, stacked supplements                                                                                                                                             |
| Planday capability mapping         | Future                | Low      | Document Planday feature coverage for competitive parity planning                                                                                                                                                   |
| Postgres version verification      | Phase A               | High     | Verify Supabase instance version. Compatibility strategy for `UNIQUE NULLS NOT DISTINCT` is defined in Phase A prerequisites — execute the appropriate path at migration time.                                      |
| Provenance on existing tables      | Phase A               | Medium   | Add `provenance JSONB NOT NULL DEFAULT '{}'` to `schedule_template` and `schedule_template_shift` (existing tables not defined in this spec's DDL)                                                                  |

---

## 8. Glossary

| Norwegian                | English                       | Context                                                      |
| ------------------------ | ----------------------------- | ------------------------------------------------------------ |
| Vaktlista                | Shift roster / schedule grid  | Column-based view of template shifts                         |
| Driftsrammer             | Operational envelope          | D1 — when/where/capacity                                     |
| Resurstilgang            | Resource availability         | D2 — who is available                                        |
| Regler og begrensninger  | Rules & constraints           | D3 — what is allowed                                         |
| Ettersporselsignal       | Demand signal                 | D4 — expected activity                                       |
| Driftskonsept            | Service concept               | D5 — type of operation                                       |
| Produksjon og produkt    | Production & product          | D6 — live state                                              |
| Kveldstillegg            | Evening supplement            | Framework-defined rate addition for evening hours            |
| Nattillegg               | Night supplement              | Framework-defined rate addition for night hours              |
| Helgetillegg             | Weekend supplement            | Framework-defined rate addition for weekend hours            |
| Helligdagstillegg        | Public holiday supplement     | Framework-defined rate addition on calendar days             |
| Overtid                  | Overtime                      | Hours exceeding framework-defined thresholds                 |
| Fagbrev                  | Trade certificate             | Formal vocational qualification                              |
| Ansiennitet              | Seniority                     | Years of service determining wage step                       |
| Riksavtalen              | National collective agreement | NHO/Fellesforbundet restaurant tariff                        |
| Allmenngjoring           | General application           | Makes collective agreement mandatory for all                 |
| Arbeidsmiljoeloven (AML) | Working Environment Act       | Norwegian labor law                                          |
| Uteservering             | Outdoor seating/service       | Seasonal capacity (D1)                                       |
| Stengingsvakt            | Closing shift                 | Anchored to close_time                                       |
| Apningsvakt              | Opening shift                 | Anchored to open_time                                        |
| Lunsjrush                | Lunch rush                    | Fixed-time demand spike shift                                |
| Sesong                   | Season                        | Time period redefining D1 inputs                             |
| Arshjul                  | Year wheel                    | planning_cycle — container for seasons                       |
| Forhåndsvis endringer    | Preview changes               | Cascade preview modal                                        |
| Bekreft                  | Confirm                       | Apply cascade button                                         |
| Avbryt                   | Cancel                        | Reject cascade button                                        |
| Rammeverk                | Regulatory framework          | Loaded rule package for a jurisdiction + industry            |
| Regel                    | Framework rule                | Single evaluable rule within a framework                     |
| Utløser                  | Framework trigger             | Condition that initiates evaluation                          |
| Unntak                   | Exception path                | Agreement-based or discretionary deviation from default rule |
| Godkjenning påkrevd      | Review required               | Manager approval needed for interpretation-dependent action  |
