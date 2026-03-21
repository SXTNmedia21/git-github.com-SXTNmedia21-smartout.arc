---
title: "Cascade Architecture — The Five Dimensions & Spreadsheet Model"
status: canonical
updated: 2026-03-21
created: 2026-03-21
module: cross-cutting
tags: [cascade, scheduling, dimensions, operating-hours, payroll, compliance, architecture]
---

# Cascade Architecture — The Five Dimensions & Spreadsheet Model

> Canonical source for how Smartout's scheduling, staffing, and operations cascade works.
> Every doc that mentions cascade, scheduling, salary, or operating hours should reference this file.

---

## The Five Dimensions

All scheduling and staffing decisions in Smartout are shaped by five dimensions. These were confirmed by AI Council + Pontus on 2026-03-21.

| # | English | Norwegian | Core Question |
|---|---------|-----------|---------------|
| D1 | Operational Envelope | Driftsrammer | When/where/with what capacity? |
| D2 | Resource Availability | Resurstilgang | Who is available, qualified, willing? |
| D3 | Rules & Constraints | Regler og begrensninger | What is allowed/required/forbidden? |
| D4 | Demand Signal | Ettersporselsignal | How much activity to prepare for? |
| D5 | Service Concept | Driftskonsept | What kind of operation are we? |

**D5 is special:** It parameterizes coefficients in all other dimensions. A fine-dining restaurant and a fast-casual burger joint have the same cascade layers, but D5 changes the weights, thresholds, and defaults throughout. D5 does NOT appear as a cascade layer itself.

### Dimension Details

**D1 — Operational Envelope:** Operating hours per department/location/season/weekday. Date overrides (holidays, events, closures). Capacity constraints (max guests, open sections, uteservering). Season as context switch — redefines hours and capacity, not rules.

**D2 — Resource Availability:** Staff profiles, contract hours, availability declarations, certifications, seniority, cost. Future: machines, rooms, vehicles for other industries.

**D3 — Rules & Constraints:** Labor law (Arbeidsmiljoeloven), collective agreements (Riksavtalen), budget caps, internal rules, compliance requirements (HACCP, food safety certs). Rules do NOT change with seasons.

**D4 — Demand Signal:** Reservations, walk-in forecasts, occupancy per time slot, season-based demand profiles, event load (concerts, holidays, tourism peaks). MVP: manual input + historical patterns.

**D5 — Service Concept:** Industry, niche, price segment, service style. Determines staffing ratios, skill requirements, acceptable wait times, quality thresholds. Configured per workspace via industry engine package.

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

| Layer | Name | Dimensions | What It Does |
|-------|------|------------|--------------|
| L1 | Planning Cycle | D5 | Year wheel container. Ordered, gap-free, non-overlapping seasons. |
| L2 | Seasons | D1, D4, D5 | Time periods that redefine operating hours, demand profiles, capacity. Status: draft / ready / archived. `is_active` boolean for current season. |
| L3 | Operating Hours | D1, D5 | `department_operating_hours` (weekly defaults) + `department_hours_override` (date exceptions). Resolution: override(date) OR default(weekday). |
| L4 | Template Shifts | D1, D5 | Anchor-based patterns. `shift_function`: opening / closing / supporting / rush_hour / sub_supply. Start/end anchored to open_time, close_time, or fixed. |
| RM | Resource Matching | D2, D3, D4, D5 | Dual-input layer (see below). Matches people to shifts with cost estimates and compliance flags. |
| L5 | Schedule Shifts | All | Real-world assignments. Manual edits and overrides happen here. |
| L6 | Sessions | D1, D3 | `department_session` with planned_open/planned_close from L3. Status lifecycle: upcoming -> active -> pending_signoff -> closed. |
| L7 | Hooks | D1, D3 | `session_hook` firing times = anchor_time + trigger_offset_min. Types: pre_open / open / scheduled / pre_close / close. |
| L8 | Tasks | D3 | `session_task` materialized from hooks + linked procedures/routines. |
| L9 | Notifications | All | Push/email/SMS to affected employees. Only fires if abs(time_delta) > threshold. |

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

| Rule | Source | When |
|------|--------|------|
| Minors working after 21:00 | AML ss 11-2 | Shift assignment |
| More than 69h/week | AML ss 10-6 | Weekly total calculation |
| Less than 11h rest between shifts | AML ss 10-8 | Shift assignment |
| Unsigned employment contract | Internal | Shift assignment |

### Hard Warn (override requires documented reason)

| Rule | Source | When |
|------|--------|------|
| Shift longer than 9h | AML ss 10-4 | Shift creation |
| More than 40h/week | AML ss 10-4 | Weekly total calculation |
| Missing certification for compliance task | Internal | Task assignment |

### Soft Warn (displayed, no override needed)

| Rule | Source | When |
|------|--------|------|
| Certification expiring within 30 days | Internal | Shift assignment |
| Less than 7 days notice before publication | AML ss 10-3 | Schedule publish |
| 6+ consecutive working days | AML ss 10-8 | Shift assignment |

### Display Only (informational)

| Info | When |
|------|------|
| Supplement calculation (kveld/natt/helg/helligdag) | Shift cost view |
| Weekly hours vs contracted hours | Employee schedule view |
| Overtime threshold proximity | Manager dashboard |

---

## Riksavtalen Rates (Corrected 2026-03-21)

Previous documentation had incorrect hardcoded values. These are the verified Riksavtalen (NHO/Fellesforbundet) rates for restaurant/hospitality.

### Supplements (tillegg)

| Supplement | Norwegian | Rate | When |
|------------|-----------|------|------|
| Evening | Kveldstillegg | 15.65 kr/t | Mon-Fri 21:00-24:00 |
| Night | Nattillegg | 54.76 kr/t | 00:00-06:00 |
| Weekend | Helgetillegg | 29.74 kr/t | Sat 14:00-24:00, Sun 06:00-24:00 |
| Public holiday | Helligdagstillegg | 100% of individual hourly rate | Red calendar days |

### Overtime (overtid)

| Type | Rate |
|------|------|
| Daytime overtime | +50% of base hourly rate |
| Night/holiday overtime | +100% of base hourly rate |

### Seniority wage steps (ansiennitet) — Kokk med fagbrev

| Years | 0 | 2 | 4 | 6 | 8 | 10 |
|-------|---|---|---|---|---|---|
| kr/t | 224.45 | 228.67 | 233.01 | 237.47 | 242.06 | 247.03 |

### Personal supplements (personlige tillegg)

| Seniority | Monthly supplement |
|-----------|-------------------|
| 10 years | 900 kr/mnd |
| 15 years | 1400 kr/mnd |
| 20 years | 1900 kr/mnd |

### Allmenngjoring

ALL rates above are mandatory for ALL restaurants in Norway via allmenngjoring. There is no opt-out. Even non-unionized restaurants must pay these minimums.

---

## Cascade Modes

The cascade engine runs in two modes. NOT database triggers — event-driven via `engine_process`.

| Mode | Purpose | Writes to DB? |
|------|---------|:---:|
| Simulation | Background intelligence, ghost cards, "what if" | NO — returns computed state |
| Execution | Confirmed schedule generation | YES — writes to schedule_shift, department_session, etc. |

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

| Table | Field | Type | Purpose |
|-------|-------|------|---------|
| `employment_contract` | `agreed_weekly_hours` | NUMERIC | Critical for overtime calculation |
| `profile` | `seniority_start_date` | DATE | Ansiennitet wage step lookup |
| `profile` | `has_fagbrev` | BOOLEAN | Fagbrev/non-fagbrev rate distinction |
| `procedure` / `routine` / `session_hook` | `required_certifications` | TEXT[] | Which certs are needed to perform this |
| `department_session` | `planned_open` | TIME | Set from operating hours at session creation |
| `department_session` | `planned_close` | TIME | Set from operating hours at session creation |
| `schedule_shift` | `department_id` | UUID FK | Direct FK instead of join through position |
| `schedule_shift` | `location_id` | UUID FK | Direct FK for location scoping |

### New tables needed

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `department_operating_hours` | Consolidated weekly hours (replaces 3 systems) | workspace_id, department_id, location_id?, season_id, day_of_week, open_time, close_time, is_closed |
| `department_hours_override` | Date-specific exceptions | workspace_id, department_id, override_date, open_time, close_time, is_closed, reason |
| `planning_cycle` | Year wheel container | workspace_id, year, label |
| `planning_event` | External/internal demand events | workspace_id, planning_cycle_id, event_date, label, demand_factor |
| `tariff_rate_table` | Versioned Riksavtalen rates | effective_from, effective_until, rate_type, amount, source |
| `employee_payroll_profile` | Links contract to payroll calculation | profile_id, employment_contract_id, tariff_table_id, base_hourly_rate, seniority_step |
| `shift_cost_snapshot` | Append-only per-shift cost audit | schedule_shift_id, base_cost, supplements_json, total_cost, calculated_at |
| `change_proposal` | Persisted cascade preview (Terraform saved plan) | workspace_id, proposal_type, payload, affected_entities, status |

### New enums needed

| Enum | Values | Purpose |
|------|--------|---------|
| `department_type` | operational, administrative, hybrid | Department classification |
| `shift_function` | opening, closing, supporting, rush_hour, sub_supply | Template shift purpose |
| `anchor_type` | fixed, open, close | Template shift time anchoring |
| `proposal_status` | pending, approved, applied, rejected | Change proposal lifecycle |

---

## Key Design Principles

1. **Declarative truth vs derived artifacts.** Only source-of-truth data is stored. Everything downstream must be derivable and recomputable.
2. **Season modifies reality, not rules.** Season redefines operating hours and demand profiles. Labor law and contracts do not change with seasons.
3. **Overrides only at the real-world layer.** Template shifts and operating hours are structural. Manual edits happen on schedule_shift.
4. **The cascade is a constraint satisfaction + optimization process.** D4 (demand) drives need, D1 (envelope) sets boundaries, D2 (resources) enables solutions, D3 (rules) constrains them, D5 (concept) parameterizes everything.

---

## Cross-References

| Document | Relationship |
|----------|-------------|
| `docs/INVESTIGATION_OPERATING_HOURS_CORE_STRUCTURE.md` | Investigation findings + design decisions that led to this architecture |
| `docs/decisions/ADR-DRAFT-core-hierarchy-cascade.md` | Draft ADR for core hierarchy changes |
| `docs/modules/SMARTOUT_MODULE_3_SCHEDULING.md` | Scheduling module — implements L4-L5 |
| `docs/modules/SMARTOUT_MODULE_8_PAYROLL.md` | Payroll module — consumes L5 + D3 rates |
| `docs/modules/SMARTOUT_MODULE_7_ABSENCE.md` | Absence module — feeds D2 (resource availability) |
| `docs/reference/DATABASE.md` | Schema reference — planned tables in "Planned" section |
| `docs/superpowers/plans/2026-03-20-cascade-architecture-foundation.md` | Implementation plan |
| `docs/engines/industri-inteligence/hospitalety/00-engine-core.md` | Industry engine that provides D5 defaults |
