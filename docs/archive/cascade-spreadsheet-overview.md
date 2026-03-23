---
title: "Cascade Architecture — I1 + 6D + 4C + K1a/K1b Model"
status: canonical
updated: 2026-03-21
created: 2026-03-21
module: cross-cutting
tags:
  [
    cascade,
    scheduling,
    dimensions,
    operating-hours,
    payroll,
    compliance,
    architecture,
    industry-intelligence,
    rego,
  ]
---

# Cascade Architecture — I1 + 6D + 4C + K1a/K1b Model

> Canonical source for how Smartout's scheduling, staffing, and operations cascade works.
> Every doc that mentions cascade, scheduling, salary, or operating hours should reference this file.
> Architecture stress-tested by 12-persona AI Council (hospitality + infrastructure + AI) on 2026-03-21.
> Final canonical model locked 2026-03-21: I1 pre-runtime + 6D execution + 4C control + K1a/K1b knowledge.

---

## System Overview

```
PRE-RUNTIME
  I1 Industry Intelligence Bootstrap
     loads vertical defaults, applies SQL templates, sets baselines

RUNTIME
  Execution:  D1 Envelope | D2 Resource | D3 Rules | D4 Demand | D5 Concept | D6 Production
  Control:    C1 Calibration | C2 Interaction | C3 Commercial | C4 Governance
  Knowledge:  K1a Industry Base | K1b Workspace Base
```

**Sequence:** Platform Shell (login, org) --> I1 Bootstrap (choose vertical, load profile, apply defaults) --> Workspace Runtime (D1-D6, C1-C4, K1a+K1b)

The admin portal NEVER creates empty workspaces. Every workspace starts from I1 bootstrap.

---

## Pre-Runtime: I1 Industry Intelligence Bootstrap

I1 is the pre-runtime layer that gives initial form to a workspace. Before any runtime dimension or control plane activates, I1 loads the vertical's defaults, applies SQL templates, and sets baselines for every dimension.

### What I1 bootstraps

| I1 Source                         | Target Dimensions/Planes | What it seeds                                                  |
| --------------------------------- | ------------------------ | -------------------------------------------------------------- |
| `departments.sql`                 | D1, D2                   | Operational envelope structure, resource slots                 |
| `budget.sql`                      | D4, C1                   | Demand baselines, calibration starting points                  |
| `policies.sql` + `governance.sql` | D3, C4                   | Rules, authority config, governance constraints                |
| `hospitality.ts` tariffs          | D3, D2                   | Riksavtalen rates, supplement rules, seniority steps           |
| `schedule.sql`                    | D1, D6                   | Template shifts, production anchors                            |
| Niche profiles                    | D5                       | Service concept parameters (fine-dining vs fast-casual vs bar) |
| AI council + posture              | C2                       | Interaction style, explanation tone, agent personas            |
| `_apply.sql`                      | ALL                      | The bootstrap engine — orchestrates all template application   |

### Codebase mapping (3 levels)

| Level             | Path                                          | Contents                                                                          |
| ----------------- | --------------------------------------------- | --------------------------------------------------------------------------------- |
| Documentation     | `docs/engines/industri-inteligence/`          | 30 files — industry engine specs, niche profiles, role capabilities, AI council   |
| SQL Templates     | `supabase/templates/restaurant/`              | 13 SQL files + `_apply.sql` — departments, budget, policies, governance, schedule |
| TypeScript Config | `apps/web/src/lib/industry/`                  | `hospitality.ts` (tariffs, supplements), `types.ts` (industry package interface)  |
| Document Analysis | `supabase/functions/analyze-setup-documents/` | Extracts company handbook data to seed K1b                                        |

### I1 lifecycle

1. Admin creates company + workspace (platform shell)
2. Admin selects industry vertical (e.g., hospitality)
3. I1 loads the industry profile and niche variant
4. `_apply.sql` executes all SQL templates against the workspace
5. TypeScript config sets runtime parameters (tariffs, coefficients)
6. Workspace is ready for runtime — all dimensions have baseline values

---

## Execution Dimensions (D1-D6)

Six dimensions shape all scheduling and staffing decisions. These are the EXECUTION layer — where authoritative data LIVES.

| #   | Name                  | Norwegian               | Core Question                                         | Type                      |
| --- | --------------------- | ----------------------- | ----------------------------------------------------- | ------------------------- |
| D1  | Operational Envelope  | Driftsrammer            | When/where/with what capacity?                        | Structural                |
| D2  | Resource Availability | Resurstilgang           | Who is available NOW and within the planning horizon? | Volatile (time-projected) |
| D3  | Rules & Constraints   | Regler og begrensninger | What is allowed/required/forbidden?                   | Stable                    |
| D4  | Demand Signal         | Ettersporselsignal      | How much activity to prepare for?                     | Predictive                |
| D5  | Service Concept       | Driftskonsept           | What kind of operation are we?                        | Strategic                 |
| D6  | Production & Product  | Produksjon og produkt   | What to produce, what's the state?                    | Live (temporal debt)      |

**D5 is special:** It parameterizes coefficients in all other dimensions. A fine-dining restaurant and a fast-casual burger joint have the same cascade layers, but D5 changes the weights, thresholds, and defaults throughout. D5 does NOT appear as a cascade layer itself.

**D6 is special:** It has a UNIQUE property no other dimension has — **temporal debt**. If Monday's staff didn't do prep, Tuesday needs extra staff to compensate. Production state ACCUMULATES — it doesn't reset daily like other dimensions. Equipment failure (broken fryer, wine cellar cooling) = production capacity degradation. Stock levels, supplier deliveries, menu availability — all live state.

### Dimension Details

**D1 — Operational Envelope:** Operating hours per department/location/season/weekday. Date overrides (holidays, events, closures). Capacity constraints (max guests, open sections, uteservering). Season as context switch — redefines hours and capacity, not rules. Multi-instance aware for multi-location businesses.

**D2 — Resource Availability:** Staff profiles, contract hours, availability declarations, certifications, seniority, cost. Future: machines, rooms, vehicles for other industries. Time-projected — "Who is available NOW and within the planning horizon" (not just a static roster).

**D3 — Rules & Constraints:** Labor law (Arbeidsmiljoeloven), collective agreements (Riksavtalen), budget caps, internal rules, compliance requirements (HACCP, food safety certs). Rules do NOT change with seasons.

**D4 — Demand Signal:** Reservations, walk-in forecasts, occupancy per time slot, season-based demand profiles, event load (concerts, holidays, tourism peaks). MVP: manual input + historical patterns.

**D5 — Service Concept:** Industry, niche, price segment, service style. Determines staffing ratios, skill requirements, acceptable wait times, quality thresholds. Configured per workspace via industry engine package.

**D6 — Production & Product:** The live state of what must be produced and what has been produced. Unlike other dimensions, D6 accumulates — yesterday's deficit becomes today's extra workload.

---

## Control Planes (C1-C4)

Four control planes operate ACROSS the execution dimensions. They observe, interpret, govern, and value what happens in D1-D6. These replace the earlier monolithic "intelligence layer" concept.

| #   | Name                        | Core Question                              | Loop                                          | Smartout Code                                                                 |
| --- | --------------------------- | ------------------------------------------ | --------------------------------------------- | ----------------------------------------------------------------------------- |
| C1  | Observability & Calibration | What happened vs plan? How to correct?     | Plan -> actual -> correction                  | telemetry, activity_trail, guardian_log, planning_factors, adjustment_factors |
| C2  | Context & Interaction       | What's relevant now? How to explain it?    | State -> inference -> explanation -> response | mr-botsson.ts, posture.ts, collector.ts, Stage Engine, agent_relationship     |
| C3  | Commercial & Outcome        | What value was created? What does it cost? | Value -> attribution -> pricing               | Stripe, contract-service, workspace_kpi_target, daily_reconciliation          |
| C4  | Policy & Governance         | What is the system ALLOWED to do?          | Capability -> permission -> audit             | engine_authority_config, guardian, deviation, RLS, shift_approval             |

### Critical Separation Principle

- **C1** says: "System BELIEVES Friday needs +15% staff"
- **C4** says: "System is ALLOWED to auto-adjust up to 5%"
- **C2** says: "This is HOW we explain it to the manager"
- **C3** says: "That adjustment SAVED 12,000 kr last month"

**"Confident" does not equal "Authorized" — C4 gates C1, always.**

### How Control Planes Interact with Dimensions

| Control Plane      | Reads from                              | Writes to / Affects                                                    |
| ------------------ | --------------------------------------- | ---------------------------------------------------------------------- |
| C1 (Observability) | All D1-D6 (actual vs planned)           | adjustment_factors -> D4 tuning, planning_factors -> D1 calibration    |
| C2 (Context)       | D1-D6 state, K1a+K1b memory             | Employee/manager-facing explanations, agent conversations              |
| C3 (Commercial)    | D2 (cost), D4 (demand), D6 (production) | KPI targets, reconciliation, billing                                   |
| C4 (Governance)    | D3 (rules), D2 (certs/qualifications)   | Authority limits on C1 corrections, deviation tracking, approval gates |

---

## Knowledge Substrate (K1a + K1b)

Shared memory layer used by multiple control planes. NOT a control plane itself — it is the substrate they read from and write to. Split into two tiers with different ownership and mutation rates.

### K1a — Industry Knowledge Base

Platform-owned. Shared per vertical. Changes rarely (new Riksavtalen rates, updated labor law, new niche profiles).

| Component           | Used by                                     | Smartout Code                                          |
| ------------------- | ------------------------------------------- | ------------------------------------------------------ |
| Industry primitives | D5 (concept defaults), I1 (bootstrap)       | `docs/engines/industri-inteligence/`, `hospitality.ts` |
| Standard patterns   | D1 (template shifts), D3 (policy templates) | `supabase/templates/restaurant/*.sql`                  |
| Tariff baselines    | D3 (rules), D2 (cost calculation)           | `hospitality.ts` tariff tables                         |
| Role capabilities   | D2 (qualification profiles)                 | Engine niche profiles                                  |
| Policy templates    | C4 (governance defaults), D3 (compliance)   | `policies.sql`, `governance.sql`                       |

### K1b — Workspace Knowledge Base

Workspace-owned. Tenant-isolated. Changes continuously via C1 learning and admin configuration.

| Component           | Used by                                     | Smartout Code                            |
| ------------------- | ------------------------------------------- | ---------------------------------------- |
| Semantic memory     | C1 (priors), C2 (context), C4 (governance)  | engine_memory (pgvector)                 |
| Workspace knowledge | C2 (retrieval), D3/D5 (institutional)       | workspace_doc_chunk                      |
| Historical patterns | C1 (calibration)                            | planning_factors                         |
| Learned factors     | C1 (corrections), D4 (demand tuning)        | adjustment_factors                       |
| Local overrides     | D3 (house rules), D5 (local concept tuning) | policy/protocol chain (workspace-scoped) |
| Policy artifacts    | C4 (authority), D3 (rules)                  | engine_authority_config                  |
| Retrieval index     | C2 (contextual search)                      | pgvector embeddings                      |

### K1a/K1b interaction

- I1 bootstrap seeds K1b FROM K1a (industry defaults become workspace starting point)
- C1 calibration writes to K1b only (learned corrections are workspace-specific)
- K1a updates propagate as suggestions, not overwrites (new Riksavtalen rates prompt admin review)
- K1b can override K1a values (workspace house rules > industry defaults, within legal limits)

---

## Boundary Rules

1. **Primary dimension = where authoritative data LIVES**, not where it originates. Fire code originates externally but is owned by D3 (rules) and constrains D1 (envelope).
2. **D1 = physics. D3 = norms.** Physical capacity vs legal/contractual rules. Both constrain, but from different sources.
3. **D5 = design intent. D6 = runtime state.** D5 says "we are a fine-dining restaurant" (stable). D6 says "the fryer is broken and we are 3 prep hours behind" (live).

### D6 Factors (~15)

| Factor                               | Description                               |
| ------------------------------------ | ----------------------------------------- |
| Menu/product catalog                 | Static + seasonal changes                 |
| Prep requirements per dish           | Time, station, skills needed              |
| Current prep status                  | Done vs pending vs deficit from yesterday |
| Raw material stock levels            | What's available, what's running out      |
| Supplier delivery schedule           | Expected deliveries and status            |
| Equipment operational status         | Working, degraded, broken                 |
| Production capacity per station/hour | Throughput limits                         |
| Waste/svinn tracking                 | Actual vs target                          |
| Recipe/allergen profiles             | Constraints on what can be produced       |
| Catering production orders           | External orders requiring production      |
| Menu availability                    | What CAN we serve right now               |
| Production quality state             | Temp logs, HACCP status                   |
| Handover state                       | What's communicated between shifts        |

### D6 Cross-Dimension Interactions

| Interaction                | Effect                                                   |
| -------------------------- | -------------------------------------------------------- |
| D6 deficit → D2            | Need extra staff tomorrow for catch-up prep              |
| D6 equipment failure → D1  | May need to close a station/section                      |
| D6 stock shortage → D4     | Can't meet demand for certain items                      |
| D6 menu complexity → D5    | Concept defines WHAT, D6 tracks STATE                    |
| D6 HACCP requirements → D3 | Rules say what must be checked, D6 tracks whether it was |

---

## The Cascade Waterfall

Think of this as a spreadsheet: each layer is a row, and changing a cell in an upper row automatically recalculates everything below it.

```
L1  Planning Cycle          (year wheel — contains seasons)
L2  Seasons                 (time periods — redefine D1 inputs)
L3  Operating Hours         (department_operating_hours + overrides)
L4  Template Shifts         (anchor-based structural patterns)
  --- Resource Matching ---  (sits between L4 and L5)
L5  Schedule Shifts         (real-world assignments)
L6  Sessions                (daily department containers)
L7  Hooks                   (time-triggered procedures)
L8  Tasks                   (materialized work items)
L9  Notifications           (employee-facing alerts)
```

### Layer Details with Dimension Inputs

| Layer | Name              | Dimensions         | What It Does                                                                                                                                                                   |
| ----- | ----------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| L1    | Planning Cycle    | D5                 | Year wheel container. Ordered, gap-free, non-overlapping seasons.                                                                                                              |
| L2    | Seasons           | D1, D4, D5         | Time periods that redefine operating hours, demand profiles, capacity. Status: draft / ready / archived. `is_active` boolean for current season.                               |
| L3    | Operating Hours   | D1, D5             | `department_operating_hours` (weekly defaults) + `department_hours_override` (date exceptions). Resolution: override(date) OR default(weekday).                                |
| L4    | Template Shifts   | D1, D5             | Anchor-based patterns. `shift_function`: opening / closing / supporting / rush_hour / sub_supply. Start/end anchored to open_time, close_time, or fixed.                       |
| RM    | Resource Matching | D2, D3, D4, D5, D6 | Dual-input layer (see below). Matches people to shifts with cost estimates, compliance flags, and production debt.                                                             |
| L5    | Schedule Shifts   | All                | Real-world assignments. Manual edits and overrides happen here. D6 production debt may add catch-up shifts.                                                                    |
| L6    | Sessions          | D1, D3, D6         | `department_session` with planned_open/planned_close from L3. D6 handover state feeds into session context. Status lifecycle: upcoming -> active -> pending_signoff -> closed. |
| L7    | Hooks             | D1, D3             | `session_hook` firing times = anchor_time + trigger_offset_min. Types: pre_open / open / scheduled / pre_close / close.                                                        |
| L8    | Tasks             | D3                 | `session_task` materialized from hooks + linked procedures/routines.                                                                                                           |
| L9    | Notifications     | All                | Push/email/SMS to affected employees. Only fires if abs(time_delta) > threshold.                                                                                               |

### Resource Matching Layer (between L4 and L5)

This is the intelligence layer. It takes two inputs and produces staffing proposals.

**Input A — Resources (D2):**

- Employment contracts (agreed_weekly_hours, wage, employment_category)
- Availability declarations
- Certifications and expiry dates
- Seniority (seniority_start_date, has_fagbrev)
- Cost profile (base rate + supplement calculation)

**Input B — Compliance Tasks (D3):**

- What procedures/routines must be performed
- Who is qualified (required_certifications)
- Minimum staffing rules (e.g., "1 senior per shift")

**Output:**

- Staffing proposal with cost estimate per shift
- Compliance flags (who can legally work this shift)
- Coverage gaps and overstaffing warnings

---

## Compliance Enforcement Points

Four severity levels. The cascade engine checks these at Resource Matching (RM) and before publishing (L5).

### Hard Block (no override possible)

| Rule                              | Source      | When                     |
| --------------------------------- | ----------- | ------------------------ |
| Minors working after 21:00        | AML ss 11-2 | Shift assignment         |
| More than 69h/week                | AML ss 10-6 | Weekly total calculation |
| Less than 11h rest between shifts | AML ss 10-8 | Shift assignment         |
| Unsigned employment contract      | Internal    | Shift assignment         |

### Hard Warn (override requires documented reason)

| Rule                                      | Source      | When                     |
| ----------------------------------------- | ----------- | ------------------------ |
| Shift longer than 9h                      | AML ss 10-4 | Shift creation           |
| More than 40h/week                        | AML ss 10-4 | Weekly total calculation |
| Missing certification for compliance task | Internal    | Task assignment          |

### Soft Warn (displayed, no override needed)

| Rule                                       | Source      | When             |
| ------------------------------------------ | ----------- | ---------------- |
| Certification expiring within 30 days      | Internal    | Shift assignment |
| Less than 7 days notice before publication | AML ss 10-3 | Schedule publish |
| 6+ consecutive working days                | AML ss 10-8 | Shift assignment |

### Display Only (informational)

| Info                                               | When                   |
| -------------------------------------------------- | ---------------------- |
| Supplement calculation (kveld/natt/helg/helligdag) | Shift cost view        |
| Weekly hours vs contracted hours                   | Employee schedule view |
| Overtime threshold proximity                       | Manager dashboard      |

---

## Riksavtalen Rates (Corrected 2026-03-21)

Previous documentation had incorrect hardcoded values. These are the verified Riksavtalen (NHO/Fellesforbundet) rates for restaurant/hospitality.

### Supplements (tillegg)

| Supplement     | Norwegian         | Rate                           | When                             |
| -------------- | ----------------- | ------------------------------ | -------------------------------- |
| Evening        | Kveldstillegg     | 15.65 kr/t                     | Mon-Fri 21:00-24:00              |
| Night          | Nattillegg        | 54.76 kr/t                     | 00:00-06:00                      |
| Weekend        | Helgetillegg      | 29.74 kr/t                     | Sat 14:00-24:00, Sun 06:00-24:00 |
| Public holiday | Helligdagstillegg | 100% of individual hourly rate | Red calendar days                |

### Overtime (overtid)

| Type                   | Rate                      |
| ---------------------- | ------------------------- |
| Daytime overtime       | +50% of base hourly rate  |
| Night/holiday overtime | +100% of base hourly rate |

### Seniority wage steps (ansiennitet) — Kokk med fagbrev

| Years | 0      | 2      | 4      | 6      | 8      | 10     |
| ----- | ------ | ------ | ------ | ------ | ------ | ------ |
| kr/t  | 224.45 | 228.67 | 233.01 | 237.47 | 242.06 | 247.03 |

### Personal supplements (personlige tillegg)

| Seniority | Monthly supplement |
| --------- | ------------------ |
| 10 years  | 900 kr/mnd         |
| 15 years  | 1400 kr/mnd        |
| 20 years  | 1900 kr/mnd        |

### Allmenngjoring

ALL rates above are mandatory for ALL restaurants in Norway via allmenngjoring. There is no opt-out. Even non-unionized restaurants must pay these minimums.

---

## Cascade Modes

The cascade engine runs in two modes. NOT database triggers — event-driven via `engine_process`.

| Mode       | Purpose                                         |                      Writes to DB?                       |
| ---------- | ----------------------------------------------- | :------------------------------------------------------: |
| Simulation | Background intelligence, ghost cards, "what if" |               NO — returns computed state                |
| Execution  | Confirmed schedule generation                   | YES — writes to schedule_shift, department_session, etc. |

### Cascade Pipeline (triggered by OPERATING_HOURS_CHANGED)

```
Step 1 — Resolve effective hours
  For each affected date: hours = override(date) OR default(day_of_week)

Step 2 — Recompute template shift times (pure function)
  For anchored shifts: recalculate start/end from new hours

Step 3 — Conflict detection
  Flag: manual overrides, approved shifts that would change, overlapping assignments

Step 4 — Session recalculation
  department_session.planned_open/close = hours.open/close

Step 5 — Hook recalculation
  hook_trigger_time = anchor_time + trigger_offset_min

Step 6 — Notification dispatch
  Only if abs(time_delta) > threshold (e.g., 15 min)
```

Idempotency: run the cascade 10 times, same result.

### Terraform-style UX

1. **Preview** — cascade-preview Edge Function shows all downstream effects
2. **Confirm** — admin reviews and approves
3. **Apply** — cascade-apply Edge Function writes changes transactionally
4. **Conflicts** — manually overridden shifts flagged, not auto-changed

---

## Schema Gaps (Identified 2026-03-21)

Fields and tables that must be created before the full cascade + payroll system works.

### Missing fields on existing tables

| Table                                    | Field                     | Type    | Purpose                                      |
| ---------------------------------------- | ------------------------- | ------- | -------------------------------------------- |
| `employment_contract`                    | `agreed_weekly_hours`     | NUMERIC | Critical for overtime calculation            |
| `profile`                                | `seniority_start_date`    | DATE    | Ansiennitet wage step lookup                 |
| `profile`                                | `has_fagbrev`             | BOOLEAN | Fagbrev/non-fagbrev rate distinction         |
| `procedure` / `routine` / `session_hook` | `required_certifications` | TEXT[]  | Which certs are needed to perform this       |
| `department_session`                     | `planned_open`            | TIME    | Set from operating hours at session creation |
| `department_session`                     | `planned_close`           | TIME    | Set from operating hours at session creation |
| `schedule_shift`                         | `department_id`           | UUID FK | Direct FK instead of join through position   |
| `schedule_shift`                         | `location_id`             | UUID FK | Direct FK for location scoping               |

### New tables needed

| Table                        | Purpose                                          | Key Columns                                                                                         |
| ---------------------------- | ------------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| `department_operating_hours` | Consolidated weekly hours (replaces 3 systems)   | workspace_id, department_id, location_id?, season_id, day_of_week, open_time, close_time, is_closed |
| `department_hours_override`  | Date-specific exceptions                         | workspace_id, department_id, override_date, open_time, close_time, is_closed, reason                |
| `planning_cycle`             | Year wheel container                             | workspace_id, year, label                                                                           |
| `planning_event`             | External/internal demand events                  | workspace_id, planning_cycle_id, event_date, label, demand_factor                                   |
| `tariff_rate_table`          | Versioned Riksavtalen rates                      | effective_from, effective_until, rate_type, amount, source                                          |
| `employee_payroll_profile`   | Links contract to payroll calculation            | profile_id, employment_contract_id, tariff_table_id, base_hourly_rate, seniority_step               |
| `shift_cost_snapshot`        | Append-only per-shift cost audit                 | schedule_shift_id, base_cost, supplements_json, total_cost, calculated_at                           |
| `change_proposal`            | Persisted cascade preview (Terraform saved plan) | workspace_id, proposal_type, payload, affected_entities, status                                     |

### New enums needed

| Enum              | Values                                              | Purpose                       |
| ----------------- | --------------------------------------------------- | ----------------------------- |
| `department_type` | operational, administrative, hybrid                 | Department classification     |
| `shift_function`  | opening, closing, supporting, rush_hour, sub_supply | Template shift purpose        |
| `anchor_type`     | fixed, open, close                                  | Template shift time anchoring |
| `proposal_status` | pending, approved, applied, rejected                | Change proposal lifecycle     |

---

## Tech Stack

| Concern    | Technology                                                                       | Scope                                                                                           |
| ---------- | -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| TypeScript | Portal, services, orchestration, bootstrap, AI/context, runtime, industry config | Everything except policy evaluation                                                             |
| Rego / OPA | C4 policy evaluation                                                             | Permissions, approval thresholds, escalation rules, governance constraints, auditable decisions |

### Why Rego for C4

C4's core question is "What is the system ALLOWED to do?" This is exactly what Rego is built for:

- Declarative policy rules with formal evaluation
- Auditable decision logs (every policy evaluation produces a trace)
- Separates policy from code (rules can be updated without redeployment)
- Supports hierarchical rule composition (labor law > collective agreement > house rules)
- OPA's partial evaluation enables efficient pre-filtering of allowed actions

C4 is the ONLY plane that uses Rego. All other planes, dimensions, and I1 bootstrap use TypeScript.

---

## Key Design Principles

1. **Declarative truth vs derived artifacts.** Only source-of-truth data is stored. Everything downstream must be derivable and recomputable.
2. **Season modifies reality, not rules.** Season redefines operating hours and demand profiles. Labor law and contracts do not change with seasons.
3. **Overrides only at the real-world layer.** Template shifts and operating hours are structural. Manual edits happen on schedule_shift.
4. **No empty workspaces.** Every workspace starts from I1 bootstrap. Industry defaults seed all dimensions.
5. **K1a is shared, K1b is owned.** Industry knowledge (K1a) is platform-managed. Workspace knowledge (K1b) is tenant-isolated. C1 learning only writes to K1b.
6. **The cascade is a constraint satisfaction + optimization process.** D4 (demand) drives need, D1 (envelope) sets boundaries, D2 (resources) enables solutions, D3 (rules) constrains them, D5 (concept) parameterizes everything, D6 (production) adds temporal debt and live state. Control planes observe (C1), explain (C2), value (C3), and govern (C4) the entire process. K1a+K1b provide shared memory across all planes.

---

## Cross-References

| Document                                                               | Relationship                                                            |
| ---------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `docs/INVESTIGATION_OPERATING_HOURS_CORE_STRUCTURE.md`                 | Investigation findings + design decisions that led to this architecture |
| `docs/decisions/ADR-DRAFT-core-hierarchy-cascade.md`                   | Draft ADR for core hierarchy changes                                    |
| `docs/modules/SMARTOUT_MODULE_3_SCHEDULING.md`                         | Scheduling module — implements L4-L5                                    |
| `docs/modules/SMARTOUT_MODULE_8_PAYROLL.md`                            | Payroll module — consumes L5 + D3 rates                                 |
| `docs/modules/SMARTOUT_MODULE_7_ABSENCE.md`                            | Absence module — feeds D2 (resource availability)                       |
| `docs/reference/DATABASE.md`                                           | Schema reference — planned tables in "Planned" section                  |
| `docs/superpowers/plans/2026-03-20-cascade-architecture-foundation.md` | Implementation plan                                                     |
| `docs/engines/industri-inteligence/hospitalety/00-engine-core.md`      | Industry engine that provides D5 defaults                               |
