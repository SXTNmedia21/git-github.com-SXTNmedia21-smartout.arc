---
title: "Cascade Scheduling System — Design Specification"
status: review
updated: 2026-03-21
created: 2026-03-21
module: cascade
tags: [cascade, architecture, scheduling, design-spec]
---

# Cascade Scheduling System — Design Specification

## 1. Executive Summary

Smartout's Cascade Scheduling System wires six previously disconnected CRUD applications (economic, organizational, physical, compliance, operational, scheduling) into a single reactive state machine. The canonical model is **I1 + 6D + 4C + K1a/K1b**: a pre-runtime Industry Intelligence bootstrap (I1) seeds workspace defaults, six execution dimensions (D1-D6) hold authoritative data, four control planes (C1-C4) observe/explain/value/govern the system, and a two-tier knowledge substrate (K1a industry, K1b workspace) provides shared memory. Changes propagate via a reactive dataflow DAG with Terraform-style plan/apply UX and event-sourced audit. The result: change operating hours once, and sessions, shifts, hooks, tasks, cost estimates, and employee notifications all cascade automatically with full preview and rollback.

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

| # | Name | Norwegian | Core Question | Type |
|---|------|-----------|---------------|------|
| D1 | Operational Envelope | Driftsrammer | When/where/with what capacity? | Structural |
| D2 | Resource Availability | Resurstilgang | Who is available now and within planning horizon? | Volatile (time-projected) |
| D3 | Rules & Constraints | Regler og begrensninger | What is allowed/required/forbidden? | Stable |
| D4 | Demand Signal | Ettersporselsignal | How much activity to prepare for? | Predictive |
| D5 | Service Concept | Driftskonsept | What kind of operation are we? | Strategic |
| D6 | Production & Product | Produksjon og produkt | What to produce, what is the state? | Live (temporal debt) |

**D5** parameterizes coefficients in all other dimensions. A fine-dining restaurant and a fast-casual burger joint share cascade layers but D5 changes weights, thresholds, and defaults throughout. D5 is an execution dimension but not a linear cascade-propagation layer. It parameterizes coefficients in D1-D4 and D6 rather than generating daily runtime diffs. When D5 changes (rare — business model pivot), it triggers a full re-parameterization of all other dimensions.

**D6** has a unique property: **temporal debt**. If Monday's staff skipped prep, Tuesday needs extra staff. Production state accumulates across days. Equipment failure degrades capacity. Stock levels and supplier deliveries are live state.

### 2.3 Control Planes

| # | Name | Core Question | Loop |
|---|------|---------------|------|
| C1 | Observability & Calibration | What happened vs plan? How to correct? | Plan -> actual -> correction |
| C2 | Context & Interaction | What is relevant now? How to explain it? | State -> inference -> explanation |
| C3 | Commercial & Outcome | What value was created? What does it cost? | Value -> attribution -> pricing |
| C4 | Policy & Governance | What is the system ALLOWED to do? | Capability -> permission -> audit |

**Interaction pattern:**
- C1 BELIEVES (Friday needs +15% staff)
- C4 PERMITS (auto-adjust up to 5% allowed)
- C2 EXPLAINS (presents to manager with context)
- C3 MEASURES (that adjustment saved 12,000 kr last month)

### 2.4 Knowledge Substrate

| Tier | Owner | Mutation Rate | Contents |
|------|-------|---------------|----------|
| K1a | Platform (per vertical) | Rare (new tariff rates, updated labor law) | Industry primitives, tariff baselines, policy templates, role capabilities, standard patterns |
| K1b | Workspace (tenant-isolated) | Continuous (C1 learning, admin config) | Semantic memory (pgvector), historical patterns, learned factors, local overrides, policy artifacts |

**Interaction rules:**
- I1 seeds K1b FROM K1a at bootstrap
- C1 writes ONLY to K1b (learned corrections are workspace-specific)
- K1a updates propagate as suggestions, not overwrites
- K1b can override K1a within legal limits

### 2.5 Key Principles

1. **"Confident" does not equal "Authorized"** — C4 gates C1, always. High confidence in a prediction does not grant permission to act on it.
2. **Primary dimension = where authoritative data LIVES**, not where it originates. Fire code originates externally but is owned by D3 and constrains D1.
3. **D1 = physics. D3 = norms.** Physical capacity vs legal/contractual rules.
4. **D5 = design intent. D6 = runtime state.** D5 says "we are fine-dining" (stable). D6 says "the fryer is broken" (live).
5. **Overrides only at the real-world layer.** Template shifts and operating hours are structural. Manual edits happen on schedule_shift.
6. **No empty workspaces.** Every workspace starts from I1 bootstrap.

---

## 3. Implementation Phases

### Fas 1 — Schema Foundation

**Scope:** All new tables, new fields on existing tables, new enums, deprecation markers. Zero application code.

**Deliverables:**

#### New Tables

| Table | Purpose | Ownership |
|-------|---------|-----------|
| `planning_cycle` | Year wheel container. One per planning period. | Runtime (D1) |
| `department_operating_hours` | Consolidated weekly hours per (dept, location, season, weekday). Replaces 3 systems. | Runtime (D1) |
| `department_hours_override` | Date-specific exceptions (holidays, events, closures). | Runtime (D1) |
| `planning_event` | External/internal demand events with multipliers. | Runtime (D4) |
| `tariff_rate_table` | Versioned Riksavtalen rates with effective dates. | K1a (platform baseline) / K1b (workspace override). Consumed by D3, C3, C4. |
| `employee_payroll_profile` | Links contract to payroll calculation. | Runtime (D2/D3) |
| `shift_cost_snapshot` | Append-only per-shift cost audit trail. | Control (C3) |
| `change_proposal` | Persisted cascade preview (Terraform saved plan). | Control (C4) |
| `public_holiday` | Norwegian public holidays for supplement calculation. | Control (D3/K1a) |
| `planning_factors` | Planned vs actual tracking for learning loop. | Control (C1/K1b) |
| `adjustment_factors` | EWMA learning state. | Control (C1/K1b) |

#### New Fields on Existing Tables

| Table | Field | Type | Purpose |
|-------|-------|------|---------|
| `department` | `department_type` | `department_type` ENUM | Operational/administrative/hybrid classification |
| `season` | `planning_cycle_id` | UUID FK | Links season to year wheel |
| `season` | `is_active` | BOOLEAN | System-managed current season flag |
| `employment_contract` | `agreed_weekly_hours` | NUMERIC | Critical for overtime calculation |
| `profile` | `seniority_start_date` | DATE | Ansiennitet wage step lookup |
| `profile` | `has_fagbrev` | BOOLEAN | Fagbrev/non-fagbrev rate distinction |
| `department_session` | `planned_open` | TIME | Set from operating hours at session creation |
| `department_session` | `planned_close` | TIME | Set from operating hours at session creation |
| `schedule_shift` | `department_id` | UUID FK | Direct FK (backfill from position) |
| `schedule_shift` | `location_id` | UUID FK | Direct FK for location scoping |
| `schedule_template` | `department_id` | UUID FK | Replace plain TEXT department column |
| `schedule_template_shift` | `shift_function` | `shift_function` ENUM | Relationship to operating hours |
| `schedule_template_shift` | `start_anchor_type` | `anchor_type` ENUM | How start time is calculated |
| `schedule_template_shift` | `start_offset_min` | INTEGER | Minutes offset from anchor |
| `schedule_template_shift` | `end_anchor_type` | `anchor_type` ENUM | How end time is calculated |
| `schedule_template_shift` | `end_offset_min` | INTEGER | Minutes offset from anchor |
| `schedule_template_shift` | `slot_order` | INTEGER | Display order in vaktlista |
| `schedule_template_shift` | `label` | TEXT | Human-readable name |

#### New Enums

| Enum | Values | Purpose |
|------|--------|---------|
| `department_type` | operational, administrative, hybrid | Department classification |
| `shift_function` | opening, closing, supporting, rush_hour, sub_supply | Template shift purpose |
| `anchor_type` | fixed, open, close | Shift time anchoring |
| `change_proposal_status` | pending, approved, applied, rejected, expired | Proposal lifecycle |
| `cascade_trigger_layer` | operating_hours, season_transition, template_change, event_added, manual_override | What triggered the cascade |
| `planning_event_category` | external_scraped, cultural_commercial, internal, weather, recurring | Event classification |
| `planning_event_source` | manual, scraped_municipality, scraped_cultural, weather_api, booking_integration, historical_import | Event origin |
| `planning_cycle_status` | draft, active, archived | Year wheel lifecycle |
| `cascade_initiator` | cascade_engine, admin_manual, c1_calibration, bootstrap | Who originated the proposal |
| `tariff_source` | riksavtalen, allmenngjoring, internal | Rate provenance |

#### Season Status Change

```sql
ALTER TYPE season_status RENAME VALUE 'active' TO 'ready';
-- draft | ready | archived (NOT 'active')
```

#### Tables to Deprecate

| Table/Column | Replacement |
|---|---|
| `operating_hours` | `department_operating_hours` |
| `company_opening_hours` | `department_operating_hours` |
| `season.opening_hours` JSONB | `department_operating_hours` |

#### Logged Adjustments (from brainstorming)

1. **`policy_status` vs `approval_status`**: `change_proposal` uses `change_proposal_status` (pending/approved/applied/rejected/expired). Separate from C4 policy evaluation result.
2. **`created_by_plane`**: ENUM `cascade_initiator` — `cascade_engine | admin_manual | c1_calibration | bootstrap`. Tracks which plane originated the proposal.
3. **`proposal_payload` diff contract**: `changes` JSONB stores the proposed mutation. `preview` JSONB stores the full CascadePreview result. Both immutable after creation.
4. **`expected_demand_multiplier`**: Named `demand_multiplier` on `planning_event` (not `expected_demand_multiplier`). 1.0 = normal, 1.5 = +50%.
5. **`public_holiday` PK**: Composite `(country_code, holiday_date)` — not UUID. Norway-only for now but extensible.
6. **Validity overlap protection**: `tariff_rate_table` uses `EXCLUDE USING gist` on `(rate_type, daterange(effective_from, effective_until))` to prevent overlapping rate periods.
7. **Tariff precedence**: When multiple rates could apply, resolution order is: workspace override > allmenngjoring > riksavtalen > internal.
8. **Credential normalization gate**: Profile certifications must be normalized before fas 3 resource matching can gate on them. This is a prerequisite, not a fas 1 deliverable.

**Dependencies:** None (pure schema).

**Does NOT do:** Application code, UI, cascade logic, cost calculation.

---

### Fas 2 — Cascade Engine

**Scope:** Pure computation functions + orchestration. The engine that makes changes propagate.

#### Pure Functions (6)

**1. `resolve_hours()`**

```typescript
function resolveEffectiveHours(
  departmentId: string,
  locationId: string | null,
  date: string,
  weeklyHours: DepartmentOperatingHoursRow[],
  overrides: DepartmentHoursOverrideRow[],
): EffectiveHours
```

Resolution: override(date) > weekly(day_of_week, location-specific) > weekly(day_of_week, null location) > closed.

**2. `compute_anchored_shift()`**

```typescript
function computeAnchoredTime(
  anchor: AnchorInput,
  hours: EffectiveHours,
): ComputedShiftTime
```

fixed = use fixedTime. open = openTime + offset. close = closeTime + offset. Falls back to fixedTime if hours are closed.

**3. `detect_conflicts()`**

```typescript
type ComplianceContext = {
  laborLaw: LaborLawRules;
  collectiveAgreement: CollectiveAgreementRules;
  workspaceRules: WorkspaceRule[];
  employeeContracts: Map<string, ContractSummary>;
};

type ConflictCategory = 'constraint' | 'advisory' | 'commercial';

type Conflict = {
  category: ConflictCategory;
  severity: 'hard_block' | 'hard_warn' | 'soft_warn' | 'info';
  entityType: string;
  entityId: string;
  description: string;
  resolution?: string;
};

function detectConflicts(
  proposedChanges: ProposedShiftChange[],
  currentState: ScheduleState,
  context: ComplianceContext,
): Conflict[]
```

- **constraint**: Legal/contractual violations (AML, rest periods, max hours)
- **advisory**: Best-practice warnings (short notice, cert expiring, consecutive days)
- **commercial**: Cost/budget implications (overtime threshold, budget overshoot)

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
): CascadeImpact
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
  riskScore: number;           // 0.0-1.0
  inputStateHash: string;      // SHA-256 of input state for staleness detection
};

function computeCascadePreview(
  trigger: CascadeTrigger,
  currentState: ScheduleState,
  complianceContext: ComplianceContext,
): CascadePreview
```

Pure function. No persistence. No proposal_id. Computes full impact even when hard blocks exist (blocks stop apply, not preview).

**6. `validate_proposal_freshness()`**

```typescript
function validateProposalFreshness(
  proposal: ChangeProposalRow,
  currentStateHash: string,
): { fresh: boolean; staleFields: string[] }
```

Compares `proposal.input_state_hash` against current state. If stale, returns which fields changed since preview was generated. Pure function — state loaded externally by caller.

#### Orchestration Functions (2)

**7. `persist_change_proposal()`**

```typescript
async function persistChangeProposal(
  workspaceId: string,
  initiatedBy: string,
  trigger: CascadeTrigger,
  preview: CascadePreview,
): Promise<ChangeProposalRow>
```

Writes the preview to `change_proposal` table as immutable artifact. Sets status = 'pending'.

**8. `apply_cascade()`**

```typescript
async function applyCascade(
  proposal: ChangeProposalRow,
): Promise<ApplyResult>
```

Applies the **frozen diff** from the proposal. No recomputation. The preview JSONB is the execution plan. If proposal is stale (freshness check fails), reject. Writes all changes in a single transaction.

#### Pipeline (9 steps)

```
1. TRIGGER         → Operating hours changed / season transition / template edit / event added
2. RESOLVE         → resolve_hours() for each affected date
3. COMPUTE         → compute_anchored_shift() for each affected template shift
4. DETECT          → detect_conflicts() with ComplianceContext
5. DERIVE          → derive_impacts() — sessions, hooks, notifications, cost
6. BUILD PREVIEW   → compute_cascade_preview() — pure, assembles full diff
7. PERSIST         → persist_change_proposal() — writes to DB
8. [ADMIN REVIEW]  → Admin sees preview, decides to approve or reject
9. APPLY           → validate_proposal_freshness() → policy gate → apply_cascade()
```

#### Key Rules

- Hard blocks stop **apply**, not preview. Preview always computes full impact.
- Apply is dumb — frozen diff only, no recomputation.
- Stale proposal detection via `input_state_hash` (SHA-256 of all input state at preview time).
- Policy evaluation gate sits between freshness check and apply. TypeScript placeholder in fas 2, Rego in fas 6.
- Conflicts are categorized: constraint (legal), advisory (best practice), commercial (cost).
- Cascade is idempotent — run 10 times, same result.

**Dependencies:** Fas 1 (schema).

**Does NOT do:** Resource matching, cost calculation, UI, control planes.

---

### Fas 3 — Resource Matching

**Scope:** The intelligence layer between template shifts and schedule assignments.

#### Core Function

```typescript
type MatchOutput = {
  result: MatchResult;
  interaction: MatchInteractionPayload;
};

function matchResources(
  shift: TemplateShiftWithHours,
  candidates: CandidateProfile[],
  context: MatchContext,
): MatchOutput
```

**Dual output by design:**

| Output | Consumer | Contents |
|--------|----------|----------|
| `MatchResult` | Engine truth | Rankings, gate results, scores per criterion, cost estimate, compliance coverage |
| `MatchInteractionPayload` | C2 (Interaction plane) | Explanations, intent tags, motivational signals, next actions, why-not reasons |

Principle: **No UI logic inside ranking/gating, but emit interaction-ready metadata.**

#### Hard Gates (binary pass/fail, no scoring)

| Gate | Source | Effect |
|------|--------|--------|
| AML blocks | D3 | Minor after 21:00, max hours exceeded, insufficient rest |
| Availability | D2 | Not available on this date/time |
| Compliance-critical certs | D3 | Missing required certification (e.g., food safety for kitchen) |
| Unsigned contract | D3 | No valid employment contract |

If any hard gate fails, candidate is excluded. No override possible.

#### Scoring Weights

| Criterion | Weight | Source |
|-----------|--------|--------|
| Qualification | 0.35 | D2 (certs, fagbrev, experience) |
| Availability | 0.25 | D2 (declared availability, preference) |
| Experience | 0.18 | D2 (seniority, hours in this role) |
| Cost | 0.15 | D3 (base rate + supplements for this shift) |
| Preference | 0.07 | D2 (employee-stated preferences) |

Weights are parameterized by D5 (service concept) at the vertical/niche level. Workspace-level weight overrides may be supported in future under C4 governance gating. Initial implementation uses fixed weights per service concept.

#### Shift Cost Estimation

```typescript
type ShiftCostEstimate = {
  baseHours: number;
  baseRate: number;
  baseCost: number;
  supplements: SupplementBreakdown[];
  totalCost: number;
  isOvertime: boolean;
  overtimeCost: number;
};

type SupplementBreakdown = {
  type: 'evening' | 'night' | 'weekend' | 'holiday' | 'overtime_50' | 'overtime_100';
  hours: number;
  rate: number;
  amount: number;
};
```

Supplement windows (from Riksavtalen):
- Evening: Mon-Fri 21:00-24:00
- Night: 00:00-06:00
- Weekend: Sat 14:00-24:00, Sun 06:00-24:00
- Holiday: Full shift on red calendar days
- Overtime 50%: Hours exceeding 9h/day or 40h/week
- Overtime 100%: Hours exceeding 13h/day or night/holiday overtime

#### Compliance Task Bundling

Separate function, same module. Bundles required compliance tasks with shift assignments:

```typescript
function bundleComplianceTasks(
  shift: AssignedShift,
  hooks: SessionHook[],
  qualifications: ProfileQualification[],
): ComplianceTaskBundle
```

Opening shift employees get pre_open/open hook tasks. Closing shift employees get pre_close/close hook tasks. Task assignment respects certification requirements.

#### Scope Limitation

Per-shift matching, NOT global week optimizer. Each shift is matched independently. A global optimizer (minimize total cost across a week while respecting all constraints) is future scope — a separate planner layer above the cascade.

**Dependencies:** Fas 1 (schema), fas 2 (cascade engine for hours resolution). Credential normalization (prerequisite from fas 1 notes).

**Does NOT do:** Global optimization, UI, control plane integration.

---

### Fas 4 — I1 Bootstrap to Production

**Scope:** Turn the industry intelligence layer from documentation into running code that seeds real workspaces.

#### Three Bootstrap Levels

| Level | Source | Data Quality | When |
|-------|--------|-------------|------|
| Level 1 | Industry template (`hospitality.ts`, SQL templates) | Good defaults, may not match specific business | Onboarding wizard step "Select industry" |
| Level 2 | Document bootstrap (company handbook via Scrapling) | High, extracted from actual business documents | Onboarding wizard step "Upload documents" |
| Level 3 | Integration bootstrap (POS, booking system, bank) | Highest, from live operational data | Future — not in scope |

#### BootstrapConfig Type

```typescript
type BootstrapConfig = {
  workspaceId: string;
  industry: 'hospitality' | 'retail' | 'healthcare';
  niche: string;                          // 'fine_dining' | 'fast_casual' | 'bar' | 'hotel'
  level: 1 | 2 | 3;
  templateOverrides?: Partial<IndustryPackage>;
  documentExtractions?: DocumentExtraction[];
  resolutionPolicy: 'template_wins' | 'document_wins' | 'manual_review';
};
```

#### Level 1: Industry Template Bootstrap

Pipeline: `hospitality.ts` + SQL templates --> `_apply.sql` --> real DB records.

Templates produce REAL records via the same cascade engine used in steady-state:
1. Insert `planning_cycle` (default year)
2. Insert `season` records (Var, Sommer, Host, Jul/Vinter)
3. Insert `department_operating_hours` per department per season
4. Insert `schedule_template` + `schedule_template_shift` with anchor types
5. Insert `planning_event` for known Norwegian cultural dates
6. Insert `tariff_rate_table` with correct Riksavtalen rates
7. Seed `adjustment_factors` with industry benchmarks (alpha = 0.5)

#### Level 2: Document Bootstrap via Scrapling

Scrapling extraction pipeline is dimension-aware:

```
Document upload → Scrapling service (port 8000)
  → Categorize (which dimension does this content map to?)
  → Dimension map (D1: hours, D2: staff lists, D3: policies, D5: concept)
  → Extract structured data per dimension
  → Cross-validate (does extracted data contradict template defaults?)
  → Generate bootstrap JSON (same format as Level 1 output)
```

Extraction results are **proposal-based**: they generate a `change_proposal` that the admin reviews before applying. Documents do not auto-write to the database.

#### Resolution Policy

When Level 2 extraction contradicts Level 1 template:
- `template_wins`: Keep template value, log extraction as suggestion
- `document_wins`: Override template with extraction, log template as fallback
- `manual_review`: Present both to admin, require explicit choice

#### Source Provenance

Every bootstrapped record carries provenance metadata:

```typescript
type BootstrapProvenance = {
  source: 'template' | 'document_extraction' | 'admin_manual';
  templateVersion: string;
  documentId?: string;
  extractionConfidence?: number;
  overriddenBy?: string;
};
```

#### Onboarding Wizard Mapping

| Wizard Step | Bootstrap Action |
|---|---|
| 1. Company info | Create company, workspace (platform shell) |
| 2. Industry selection | Load Level 1 template, set D5 parameters |
| 3. Department setup | Apply `departments.sql`, set department_type |
| 4. Location setup | Create locations, link to departments |
| 5. Season definition | Apply `budget.sql`, create planning_cycle + seasons |
| 6. Operating hours | Apply `schedule.sql`, create department_operating_hours |
| 7. Document upload | Trigger Level 2 Scrapling pipeline |
| 8. Staff import | Create profiles, employment contracts |
| 9. Policy review | Apply `policies.sql` + `governance.sql`, admin confirms |
| 10. Go live | Activate season, run first cascade |

#### Riksavtalen Rate Correction

The current `hospitality.ts` has **incorrect** hardcoded values (e.g., kveldstillegg 56 kr/t, which is wrong). `hospitality.ts` is NOT the source of truth for rates. The `tariff_rate_table` is. Bootstrap must seed `tariff_rate_table` with the correct Lovdata 2024 values (see Section 5).

**Dependencies:** Fas 1 (schema), fas 2 (cascade engine), Scrapling service.

**Does NOT do:** Level 3 integration, mobile onboarding, POS connectivity.

---

### Fas 5 — UI Layer

**Scope:** Five UI surfaces that expose cascade functionality to users.

**Note:** The route and file structure below is a proposed initial implementation layout, not a locked information architecture. Actual routes may adapt to existing dashboard conventions.

#### A. Operating Hours CRUD (D1)

**Route:** `/dashboard/settings` (existing, replace current operating hours section)

```
apps/web/src/app/dashboard/settings/
  _components/
    DepartmentHoursSettings.tsx    — 7-day grid per department
    HoursOverrideManager.tsx       — Date-specific exception editor
  _hooks/
    use-department-hours.ts        — TanStack Query: department_operating_hours CRUD
    use-hours-override.ts          — TanStack Query: department_hours_override CRUD
```

Department selector + season selector + 7-day grid + overrides section. Every mutation calls `emit()`.

#### B. Vaktlista with Budget Overlay (D1+D2+D4+C3)

**Route:** `/dashboard/schedule` (new tab/view alongside existing views)

```
apps/web/src/app/dashboard/schedule/
  _components/
    VaktlistaView.tsx              — Column-based shift grid
    VaktlistaColumn.tsx            — Single shift slot column
    VaktlistaCell.tsx              — Employee assignment cell
    BudgetOverlay.tsx              — Cost/budget bar per day
    GhostCard.tsx                  — Simulation mode unassigned slot
  _hooks/
    use-vaktlista.ts               — Combines templates + hours + assignments
    use-cascade-realtime.ts        — Realtime subscriptions for live updates
```

Columns = `schedule_template_shift` ordered by `slot_order`. Column headers show `label` + derived times from operating hours. Ghost cards show simulation-mode proposals. Budget overlay shows estimated cost vs budget target per day.

#### C. Compliance Dashboard / Publish Gate (D3+C4)

**Route:** `/dashboard/schedule` (gate before publishing)

```
apps/web/src/app/dashboard/schedule/
  _components/
    ComplianceGate.tsx             — Pre-publish compliance summary
    ConflictList.tsx               — Categorized conflict display
    PublishButton.tsx              — Gated by compliance check
```

Shows all constraint/advisory/commercial conflicts for the selected week. Hard blocks prevent publishing. Advisory warnings require acknowledgment. Compliance is scoped to publication, not individual shift edits.

#### D. Employee View: My Shifts + Pay (D2+C3)

**Route:** `/dashboard/my-schedule` (existing, extend with cost)

```
apps/web/src/app/dashboard/my-schedule/
  _components/
    ShiftPayBreakdown.tsx          — Per-shift cost with supplement detail
    WeeklySummary.tsx              — Hours + estimated pay for the week
```

Employee sees their shifts with estimated pay breakdown. Uses `shift_cost_snapshot` data (append-only, not recalculated on view). Shows source/provenance of rates.

#### E. Cascade Preview Modal (fas 2 visualized)

```
apps/web/src/app/dashboard/
  _components/
    CascadePreviewModal.tsx        — Terraform-style diff display
    CascadeDiffRow.tsx             — Single entity before/after row
    RiskScoreBadge.tsx             — Visual risk indicator
```

Shows full CascadePreview: affected sessions, shifts, hooks, notifications. Color-coded diffs (green=added, red=removed, amber=modified). Conflict section with severity badges. Risk score badge. "Bekreft" and "Avbryt" buttons.

#### Logged UI Rules

1. UI does not own policy decisions — it displays what the engine computed
2. No dual cost truth — employee view uses `shift_cost_snapshot`, not live recalculation
3. Assignment is an explicit action — dragging a name into a ghost card triggers a proposal
4. Show source/provenance on all computed values (where did this rate come from?)
5. Scope compliance to publication — individual shift edits show warnings but do not block
6. Distinguish states visually: observed (actual) / proposed (preview) / planned (template) / applied (confirmed)

**Dependencies:** Fas 1 (schema), fas 2 (cascade engine), fas 3 (resource matching for vaktlista).

**Does NOT do:** Mobile app views, print layouts, PDF export.

---

### Fas 6 — Control Planes (C1-C4)

**Scope:** The four planes that observe, explain, value, and govern the execution layer.

#### C1 — Observability & Calibration

EWMA calibration engine with statistical controls:

```typescript
type CalibrationEngine = {
  /** Update factor with new observation */
  observe(factorKey: string, planned: number, actual: number): AdjustmentFactor;
  /** Get current adjusted prediction */
  predict(factorKey: string, baseValue: number): number;
  /** Detect outlier (not a trend, just noise) */
  isOutlier(factorKey: string, value: number): boolean;
};
```

- **EWMA formula:** `F(t+1) = F(t) + alpha * [A(t) - F(t)]`
- **MAD outlier detection:** Median Absolute Deviation to filter noise before updating EWMA
- **Alpha decay:** `alpha(n) = max(0.1, 0.5 / sqrt(n))` where n = observation_count — starts reactive (0.5), converges toward stability. Square root decay chosen over logarithmic: faster initial convergence, still reaches steady-state by n=25. Locked per ADR — do not change without calibration testing.
- **Seasonal boundary handler:** Reset alpha to 0.3 at season transitions (new season = new patterns)
- **Confidence tracking:** `confidence = min(1.0, observation_count / 10)` — 10 observations = fully confident
- **Cross-dimensional pattern detection:** If D4 demand spike correlates with D6 prep deficit, write pattern to K1b

C1 writes to: `planning_factors`, `adjustment_factors`, `engine_memory` (K1b). Pattern insights written to `engine_memory` are narrative/explanatory only — they do not directly mutate adjustment factors. Factor updates require explicit calibration logic and C4 gating.

#### C2 — Context & Interaction

Extends existing Mr. Botsson / posture / collector infrastructure:

```typescript
type CascadeExplanation = {
  summary: string;                    // "Vi foreslår 2 ekstra timer fordi fredager i juni har 35% høyere omsetning"
  confidence: number;
  sources: ExplanationSource[];       // Which K1a/K1b data supports this
  authorityLevel: AuthorityLevel;     // What the viewer is allowed to see/do
  nextActions: SuggestedAction[];     // What the user can do about it
};
```

- Cascade/matching explanation: Translates engine output into human-readable Norwegian
- Authority-gated insight presentation: Trainee sees less detail than manager
- Trainee filter: Simplified explanations for `profile_status = 'trainee'`
- Intent tags on match results: `{ intent: 'cost_optimization' | 'coverage_gap' | 'compliance_risk' }`

C2 reads from: All D1-D6, K1a+K1b. C2 does NOT mutate execution truth, rankings, policy decisions, or commercial facts. C2 MAY write interaction artifacts: conversation events to `engine_memory`, presentation logs to `activity_trail`.

#### C3 — Commercial & Outcome

```typescript
type CommercialReport = {
  period: DateRange;
  revenue: number;
  laborCost: number;
  laborPercentage: number;
  costPerCover: number;
  valueAttribution: AttributionEntry[];  // Which decisions saved/cost money
};
```

- Commercial report aggregator: Rolls up `shift_cost_snapshot` + `daily_reconciliation` + `workspace_kpi_target`
- Value attribution calculator: Links cost changes to specific cascade decisions via `change_proposal`
- **Consumes** `shift_cost_snapshot` — does NOT create cost data. Fas 3 produces cost ESTIMATES. Cost SNAPSHOTS (accounting truth) are created by the cascade engine at preview/publish/approval/reconciliation steps and written to `shift_cost_snapshot`. C3 aggregates snapshots — it never creates cost data.

C3 reads from: D2 (cost), D4 (demand), D6 (production), `shift_cost_snapshot`, `change_proposal`. Writes to: `workspace_kpi_target` (targets only, not actuals).

#### C4 — Policy & Governance

```typescript
type PolicyEvaluation = {
  allowed: boolean;
  reason: string;
  rule: string;
  authority: AuthorityLevel;
  auditTrail: AuditEntry;
};

// TypeScript implementation (fas 6), Rego migration (post-fas 6)
function evaluatePolicy(
  action: ProposedAction,
  context: GovernanceContext,
): PolicyEvaluation
```

- TypeScript policy engine initially, designed for Rego/OPA migration
- Authority config management via `engine_authority_config`
- Audit trail writer: Every policy evaluation logged to `activity_trail`
- Rule hierarchy: labor law > collective agreement > workspace house rules
- Enforcement severity: hard_block | hard_warn | soft_warn | info_only | monitor
- Rules deploy in monitor mode first, graduate to blocking after validation

**C4 Operational Separation:**

| Concern | Responsibility | Where |
|---------|---------------|-------|
| **Evaluate** | Run policy rules against proposed action | Policy engine (TypeScript → Rego) |
| **Enforce** | Block or gate the action based on evaluation | Assignment/publish/apply service layer |
| **Log** | Record every evaluation with full context | `activity_trail` (immutable audit) |

These three concerns must remain separated. The policy engine produces decisions. The service layer enforces them. The audit trail records them. No single component does all three.

#### Plane Interaction Boundaries

| Rule | Enforced |
|------|----------|
| C1 cannot write without C4 gate | C4 evaluatePolicy() wraps every C1 write |
| C2 cannot change rankings | C2 receives MatchResult as read-only, produces explanations |
| C3 cannot create cost data | C3 reads shift_cost_snapshot, never writes to it |
| C4 cannot produce calibration | C4 governs write permissions, does not compute corrections |

**Dependencies:** Fas 1-5 (all prior phases).

**Does NOT do:** Rego/OPA migration (post-fas 6), ML models, autonomous action.

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
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_dept_hours_weekly UNIQUE (department_id, location_id, season_id, day_of_week),
  CONSTRAINT chk_hours_valid CHECK (is_closed = true OR (open_time IS NOT NULL AND close_time IS NOT NULL))
);
```

`season_id` is nullable by design. `NULL` means workspace-wide default. Season-specific rows (with `season_id` set) override default rows for that season. Resolution order: override(date) > season-specific(day_of_week) > default(day_of_week, season_id IS NULL) > closed.

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
  CONSTRAINT uq_dept_hours_override UNIQUE (department_id, location_id, override_date),
  CONSTRAINT chk_override_hours_valid CHECK (is_closed = true OR (open_time IS NOT NULL AND close_time IS NOT NULL))
);
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
  trigger_layer       cascade_trigger_layer NOT NULL,
  trigger_entity_type TEXT NOT NULL,
  trigger_entity_id   UUID,
  created_by_plane    cascade_initiator NOT NULL DEFAULT 'admin_manual',
  status              change_proposal_status NOT NULL DEFAULT 'pending',
  changes             JSONB NOT NULL DEFAULT '{}',
  preview             JSONB NOT NULL DEFAULT '{}',
  input_state_hash    TEXT,                                    -- SHA-256 for staleness detection
  risk_score          NUMERIC(3,2),
  policy_decision       TEXT,                -- 'allowed' | 'requires_approval' | 'blocked' | 'advisory_only'
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

### 4.2 Ownership Classification

| Table | Owner | Mutation Source |
|-------|-------|----------------|
| `planning_cycle` | Runtime (D1) | Admin CRUD |
| `department_operating_hours` | Runtime (D1) | Admin CRUD, bootstrap |
| `department_hours_override` | Runtime (D1) | Admin CRUD, planning events |
| `planning_event` | Runtime (D4) | Admin, scrapers, integrations |
| `tariff_rate_table` | K1a / K1b (override) | Platform admin, Riksavtalen updates. Consumed by D3, C3, C4. C4 uses but does not own. |
| `employee_payroll_profile` | Runtime (D2) | HR CRUD, contract changes |
| `shift_cost_snapshot` | Control (C3) | Cascade engine (append-only) |
| `change_proposal` | Control (C4) | Cascade engine |
| `public_holiday` | K1a (platform) | Platform admin (annual seed) |
| `planning_factors` | Control (C1) | Session close, reconciliation |
| `adjustment_factors` | Control (C1) | EWMA engine (service_role only) |

### 4.3 Boundary Rules

1. Runtime tables (D1-D6) are written by user actions and cascade engine.
2. Control tables (C1-C4) are written by their respective plane, never by user CRUD.
3. K1a tables are platform-managed, tenant-visible but not tenant-writable (except workspace overrides).
4. K1b tables are workspace-scoped with strict RLS isolation.
5. `shift_cost_snapshot` is append-only. C3 reads, never writes.
6. `change_proposal` payload fields (`changes`, `preview`, `input_state_hash`) are immutable after creation. Lifecycle and governance fields (`status`, `policy_decision`, `policy_rule_ids`, `approval_required`, `approved_by`, `approved_at`, `rejected_at`, `rejection_reason`, `applied_at`) may be updated as the proposal progresses through its lifecycle.

---

## 5. Riksavtalen Reference Data

Corrected 2024 rates from Lovdata (NHO/Fellesforbundet collective agreement for restaurants/hospitality). The current `hospitality.ts` file has incorrect values and is NOT the source of truth for rates.

Numerical values below are seed candidates based on Lovdata retrieval dated 2026-03-21. All rates must be verified against current legally applicable sources before production seeding.

### 5.1 Base Wages — Kokk med fagbrev

| Seniority (years) | 0 | 2 | 4 | 6 | 8 | 10 |
|---|---|---|---|---|---|---|
| kr/t | 224.45 | 226.16 | 240.52 | 241.73 | 244.50 | 247.03 |

Kokk uten fagbrev: approximately 90% of med fagbrev rates at corresponding seniority step.

### 5.2 Supplements (tillegg)

| Type | Norwegian | Rate | Time Window |
|------|-----------|------|-------------|
| Evening | Kveldstillegg | 15.65 kr/t | Mon-Fri 21:00-24:00 |
| Night | Nattillegg | 54.76 kr/t | 00:00-06:00 |
| Weekend | Helgetillegg | 29.74 kr/t | Sat 14:00-24:00, Sun 06:00-24:00 |
| Public holiday | Helligdagstillegg | 100% of individual hourly rate | Red calendar days |

### 5.3 Overtime (overtid)

| Type | Rate | Trigger |
|------|------|---------|
| Daytime overtime | +50% of base hourly rate | >9h/day or >40h/week (AML ss 10-4) |
| Night/holiday overtime | +100% of base hourly rate | Overtime on nights, Sundays, or red days |

### 5.4 Personal Supplements (personlige tillegg)

| Seniority in company | Monthly supplement |
|---|---|
| 10 years | 900 kr/mnd |
| 15 years | 1,400 kr/mnd |
| 20 years | 1,900 kr/mnd |

### 5.5 Allmenngjoring

Under current allmenngjoring regulations, these rates serve as mandatory minimums for the restaurant/hospitality sector in Norway. Seed values must be verified against current legally applicable tariff/allmenngjoring sources before production use.

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

| Decision | Validation |
|---|---|
| 6 dimensions (not 7) | D7 decomposed into 4 control planes provides better separation of concerns |
| D6 temporal debt property | Unique to D6, no other dimension accumulates across days |
| K1a/K1b split | Prevents tenant data from contaminating platform defaults |
| I1 as pre-runtime bootstrap | Clean separation: bootstrap is not a dimension or control plane |
| TypeScript + Rego for C4 | TypeScript first, Rego when policy complexity requires it |
| Per-shift matching (not global) | Global optimizer is a separate planner layer, future scope |
| Conflict categories (3) | constraint/advisory/commercial covers all observed conflict types |

---

## 7. Open Items / Technical Debt

| Item | Phase | Priority | Notes |
|------|-------|----------|-------|
| Credential normalization | Pre-fas 3 | High | Profile certifications must be normalized before resource matching can gate on them |
| Rego/OPA migration | Post-fas 6 | Medium | Replace TypeScript policy engine with Rego for auditable, declarative policy evaluation |
| Global week optimizer | Future | Medium | Minimize total weekly cost while respecting all constraints. Separate planner layer above cascade |
| Level 3 integration bootstrap | Future | Low | POS, booking system, bank integrations for highest-quality bootstrap data |
| Mobile app views | Separate scope | Medium | React Native views for employee shift view, manager cascade preview |
| `hospitality.ts` rate correction | Fas 4 | High | Current values are wrong. Must be corrected when seeding `tariff_rate_table` |
| Historical data import | Fas 4 | Low | Import from Bubble.io, previous year actuals for C1 calibration |
| Multi-currency support | Future | Low | Currently NOK-only. Tariff table structure supports it but no UI |
| Supplement window edge cases | Fas 3 | Medium | Shifts spanning midnight, partial-hour supplements, stacked supplements |

---

## 8. Glossary

| Norwegian | English | Context |
|-----------|---------|---------|
| Vaktlista | Shift roster / schedule grid | Column-based view of template shifts |
| Driftsrammer | Operational envelope | D1 — when/where/capacity |
| Resurstilgang | Resource availability | D2 — who is available |
| Regler og begrensninger | Rules & constraints | D3 — what is allowed |
| Ettersporselsignal | Demand signal | D4 — expected activity |
| Driftskonsept | Service concept | D5 — type of operation |
| Produksjon og produkt | Production & product | D6 — live state |
| Kveldstillegg | Evening supplement | Rate addition 21:00-24:00 Mon-Fri |
| Nattillegg | Night supplement | Rate addition 00:00-06:00 |
| Helgetillegg | Weekend supplement | Rate addition Sat 14:00+, Sun |
| Helligdagstillegg | Public holiday supplement | 100% rate addition on red days |
| Overtid | Overtime | Hours exceeding contractual/legal limits |
| Fagbrev | Trade certificate | Formal vocational qualification |
| Ansiennitet | Seniority | Years of service determining wage step |
| Riksavtalen | National collective agreement | NHO/Fellesforbundet restaurant tariff |
| Allmenngjoring | General application | Makes collective agreement mandatory for all |
| Arbeidsmiljoeloven (AML) | Working Environment Act | Norwegian labor law |
| Uteservering | Outdoor seating/service | Seasonal capacity (D1) |
| Stengingsvakt | Closing shift | Anchored to close_time |
| Apningsvakt | Opening shift | Anchored to open_time |
| Lunsjrush | Lunch rush | Fixed-time demand spike shift |
| Sesong | Season | Time period redefining D1 inputs |
| Arshjul | Year wheel | planning_cycle — container for seasons |
| Forhåndsvis endringer | Preview changes | Cascade preview modal |
| Bekreft | Confirm | Apply cascade button |
| Avbryt | Cancel | Reject cascade button |
