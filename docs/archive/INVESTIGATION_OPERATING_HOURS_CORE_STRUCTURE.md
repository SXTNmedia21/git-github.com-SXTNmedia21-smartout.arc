---
title: "Investigation & Design: Core Structure, Operating Hours & Cascade Model"
status: in_progress
updated: 2026-03-21
created: 2026-03-19
module: cross-cutting
tags:
  [investigation, operating-hours, department, location, cascade, architecture, season, vaktlista]
---

> **Canonical cascade reference:** `docs/cascade-spreadsheet-overview.md` — the I1 + 6D + 4C + K1a/K1b model (pre-runtime bootstrap, execution dimensions, control planes, knowledge substrate), waterfall layers, compliance rules, Riksavtalen rates, and schema gaps are all defined there. This document contains the investigation findings and design decisions that led to that architecture.

# Investigation & Design: Core Structure, Operating Hours & Cascade Model

## Date: 2026-03-19 (investigation) → 2026-03-20 (design refinement)

## Contributors: Claude Code agents (investigation), external architect (design review), Pontus (product direction)

---

# PART A: INVESTIGATION FINDINGS (2026-03-19)

## 1. Operating Hours — Three Systems Found

Three separate, disconnected operating hours systems exist:

| Aspect             | `company_opening_hours` | `operating_hours`                 | `season.opening_hours`                    |
| ------------------ | ----------------------- | --------------------------------- | ----------------------------------------- |
| **Migration**      | `20260310140000`        | `20260302152749`                  | `20260416200000`                          |
| **Type**           | Standalone table        | Standalone table                  | JSONB column on `season`                  |
| **Purpose**        | Signup onboarding       | Dashboard operations              | Season planning                           |
| **Scoping**        | Per-workspace           | Per-workspace + optional location | Per-season + per-department (nested keys) |
| **Per-weekday**    | Yes (0-6)               | Yes (0-6)                         | Yes (mon/tue/wed...)                      |
| **Date overrides** | No                      | No                                | No                                        |
| **Used by UI**     | No                      | Yes (`OpeningHoursSettings`)      | No                                        |
| **Used by engine** | No                      | No                                | No                                        |

**Verdict:** All three will be **deprecated** and replaced by a single consolidated model (see Part B, Section 2).

## 2. Department ↔ Location — No Connection Exists

- Department has NO `location_id`, NO `department_type`, NO `is_operational`
- Location has NO `department_id`, NO operating hours fields
- They are queried independently, rendered in separate UI tabs, never joined
- `schedule_shift` has NO `department_id` and NO `location_id` — connects to dept only via `position_id -> position.department_id`
- Profile has both `department_id` and `location_id` but they are independent fields

### Subordinate entities:

| Entity             | → Department? | → Location? |
| ------------------ | :-----------: | :---------: |
| Zone               |       —       |     FK      |
| Asset              |       —       |     FK      |
| Position           |      FK       |      —      |
| schedule_shift     | via position  |      —      |
| operating_hours    |       —       | nullable FK |
| session_hook       |      FK       |      —      |
| department_session |      FK       |      —      |

## 3. Template Shifts — Missing Structural Concepts

`schedule_template.department` is **plain TEXT** (no FK). `schedule_template_shift` has:

- NO `slot_order` / `sort_order`
- NO `is_opening_shift` / `is_closing_shift` flags
- NO time anchoring (times are fixed, not relative to operating hours)
- NO link to procedures
- `zone` is plain TEXT (no FK)

## 4. Procedure Scoping — Two Parallel Mechanisms

**Governance chain:** Policy(`policy_scope` + `scope_ref_id`) → Protocol → Procedure → Routine
**Operational chain:** `session_hook` has direct FK to `department_id` AND `linked_procedure_id`

These two mechanisms are independent. Hooks bypass the governance chain entirely.

## 5. Cascade State — Nothing Cascades

- Saving operating hours: simple CRUD, zero downstream effects
- `upsert_session` handler: does NOT read operating hours, only sets (workspace_id, department_id, session_date, status)
- `department_session` has NO planned open/close times — only actual timestamps
- No cascade logic exists anywhere in the system

## 6. Vaktlista — Backend Ready, Zero UI

`employee_roster` table + `useRoster()` + `useUpsertRoster()` + `useAutoFillShifts()` all exist. No UI component uses them.

---

# PART B: DESIGN DECISIONS (2026-03-20)

Based on investigation findings + external architect review + product direction.

## 1. Core Principle: Declarative Truth vs Derived Artifacts

**Non-negotiable rule:**

| Layer                              | Role                                   | Stored?                                     |
| ---------------------------------- | -------------------------------------- | ------------------------------------------- |
| **A. Declarative Source of Truth** | "When is this department operational?" | YES — stored as truth                       |
| **B. Derived Execution Artifacts** | Shifts, sessions, hooks, notifications | COMPUTED — must be derivable + recomputable |

Only A is stored. Everything in B must be a function of A. If this is violated, cascade becomes a bug factory.

## 2. Consolidated Operating Hours Model

**Replace all three existing systems with:**

### `department_operating_hours` (source of truth)

```sql
department_operating_hours (
  id UUID PK,
  workspace_id UUID NOT NULL FK->workspace,
  department_id UUID NOT NULL FK->department,
  location_id UUID NULL FK->location,
  season_id UUID NOT NULL FK->season,
  day_of_week INT NOT NULL CHECK (0-6),
  open_time TIME,
  close_time TIME,
  is_closed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  UNIQUE (department_id, location_id, season_id, day_of_week)
)
```

### `department_hours_override` (temporal exceptions)

```sql
department_hours_override (
  id UUID PK,
  workspace_id UUID NOT NULL FK->workspace,
  department_id UUID NOT NULL FK->department,
  location_id UUID NULL FK->location,
  season_id UUID NOT NULL FK->season,
  override_date DATE NOT NULL,
  open_time TIME,
  close_time TIME,
  is_closed BOOLEAN DEFAULT false,
  reason TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  UNIQUE (department_id, location_id, override_date)
)
```

**Resolution logic:** `effective_hours(dept, location, date) = override(date) OR default(day_of_week)`

**Deprecation path:**

- `company_opening_hours` → drop (signup-only, unused)
- `operating_hours` → migrate data to new table, update Settings UI
- `season.opening_hours` JSONB → drop column after migration

## 3. Department Classification

Add to department table:

```sql
department_type department_type ENUM ('operational', 'administrative', 'hybrid')
```

**Enforced invariants:**

| Type             | Operating hours |     Shifts     |    Sessions    |
| ---------------- | :-------------: | :------------: | :------------: |
| `operational`    |    REQUIRED     |      YES       |      YES       |
| `administrative` |  MUST NOT have  |       NO       |       NO       |
| `hybrid`         |    OPTIONAL     | IF hours exist | IF hours exist |

## 4. Season Model Refinement

### Year wheel concept

A year = an ordered, gap-free, non-overlapping list of seasons. Seasons are recurring templates that repeat annually. Each year gets its own season instances (for historical tracking).

### Status enum change

```sql
-- BEFORE: draft | active | archived
-- AFTER:  draft | ready | archived
season_status ENUM ('draft', 'ready', 'archived')
```

- `draft` — being configured, not usable by cascade
- `ready` — configuration complete, usable by cascade engine
- `archived` — historical, read-only

### `is_active` boolean

```sql
ALTER TABLE season ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT false;
```

- `is_active = true` means this season is the currently live season (based on date range)
- Avoids constant date comparison queries
- Only ONE season per workspace can be `is_active = true` at any time
- System-managed: set by season transition logic, not directly by user

### Season as context switch

**Season modifies reality, not rules.**

| Affected by season                   | Not affected by season |
| ------------------------------------ | ---------------------- |
| Operating hours                      | Labor law (arbetsrätt) |
| Demand profiles                      | Base contracts         |
| Capacity (uteservering etc.)         | Core policies          |
| Seasonal staff availability          | Compliance rules       |
| Template shift outputs (via anchors) |                        |
| Sessions & hooks                     |                        |

Season does NOT multiply factors. It **redefines inputs**:

```
❌ staff_needed = base × season_factor
✅ season → defines operating hours + demand profile → system derives staffing
```

## 5. Template Shift Function Types

Template shifts need a **function classification** that defines their relationship to operating hours and their purpose in the department.

### `shift_function` ENUM

```sql
shift_function ENUM (
  'opening',     -- anchored to operating hours open time
  'closing',     -- anchored to operating hours close time
  'supporting',  -- fixed time, supports operational peak
  'rush_hour',   -- fixed time, covers demand spike (e.g., lunch rush)
  'sub_supply'   -- flexible, fills coverage gaps
)
```

### How function drives behavior:

| Function     | Time anchor         | Affected by hours change? | Example                                    |
| ------------ | ------------------- | :-----------------------: | ------------------------------------------ |
| `opening`    | open_time + offset  |          **YES**          | "Open kitchen" 07:00-15:00 when open=07:00 |
| `closing`    | close_time + offset |          **YES**          | "Close service" ends at close time         |
| `supporting` | fixed               |          **NO**           | "Daytime support" 10:00-16:00              |
| `rush_hour`  | fixed               |          **NO**           | "Lunch rush" 11:00-14:00                   |
| `sub_supply` | derived from gaps   |       **COMPUTED**        | Fill coverage holes                        |

### Anchor system on `schedule_template_shift`

New columns:

```sql
shift_function shift_function NOT NULL DEFAULT 'supporting',
start_anchor_type anchor_type NOT NULL DEFAULT 'fixed',  -- ENUM: fixed, open, close
start_offset_min INTEGER NOT NULL DEFAULT 0,
end_anchor_type anchor_type NOT NULL DEFAULT 'fixed',    -- ENUM: fixed, open, close
end_offset_min INTEGER NOT NULL DEFAULT 0,
slot_order INTEGER NOT NULL DEFAULT 0,
label TEXT,                                               -- human-readable name
```

### Examples:

**Opening shift (Kitchen):**

```json
{
  "shift_function": "opening",
  "start_anchor_type": "open",
  "start_offset_min": 0,
  "end_anchor_type": "fixed",
  "end_offset_min": 360,
  "label": "Åpningsvakt Kjøkken"
}
```

→ If kitchen opens at 09:00: shift = 09:00-15:00
→ If kitchen opens at 07:00: shift = 07:00-13:00 (auto-adjusted)

**Closing shift (Service):**

```json
{
  "shift_function": "closing",
  "start_anchor_type": "close",
  "start_offset_min": -240,
  "end_anchor_type": "close",
  "end_offset_min": 0,
  "label": "Stengingsvakt Service"
}
```

→ If service closes at 23:00: shift = 19:00-23:00
→ Shorter day (close 21:00): shift = 17:00-21:00 (auto-adjusted)

**Lunch rush (fixed, never changes):**

```json
{
  "shift_function": "rush_hour",
  "start_anchor_type": "fixed",
  "start_offset_min": 0,
  "end_anchor_type": "fixed",
  "end_offset_min": 0,
  "start_time": "11:00",
  "end_time": "14:00",
  "label": "Lunsjrush"
}
```

→ Always 11:00-14:00 regardless of operating hours

### What each function type implies:

- **Opening shift** → addressed by opening hooks. The person on this shift runs opening procedures (start machines, check reservations, HACCP checklist)
- **Closing shift** → addressed by closing hooks. The person runs closing procedures (clean, count, reconcile)
- **Supporting shift** → general operational support, no hook binding
- **Rush hour shift** → demand-driven, no hook binding
- **Sub supply shift** → gap filler, computed by system

### Connection to hooks:

Session hooks with `hook_type = 'pre_open'` or `'open'` → target employees on `opening` shifts.
Session hooks with `hook_type = 'pre_close'` or `'close'` → target employees on `closing` shifts.
This replaces the need for `responsible_shift_type` on hooks — the function type IS the binding.

## 6. Three-Layer Shift Architecture

Overrides only exist at the real-world layer. No template-level or hours-level overrides.

| Layer               | Responsibility                                        | Mutable?                 |
| ------------------- | ----------------------------------------------------- | ------------------------ |
| **Operating hours** | Time boundaries per (dept, location, season, weekday) | Yes (triggers cascade)   |
| **Template shifts** | Structural patterns (anchor-based)                    | Yes (triggers recompute) |
| **Schedule shifts** | Real-world assignments + exceptions                   | Yes (manual edits)       |

If something deviates from template → it's a `schedule_shift` exception, not template logic.

## 7. The Cascade Engine

### NOT database triggers. Event-driven via `engine_process`.

**Why:** Triggers are opaque, hard to debug, no audit trail, dangerous with bulk updates. The engine is auditable, idempotent, and supports dry-run.

### Two modes:

| Mode           | Purpose                                         |                      Writes to DB?                       |
| -------------- | ----------------------------------------------- | :------------------------------------------------------: |
| **Simulation** | Background intelligence, ghost cards, "what if" |               NO — returns computed state                |
| **Execution**  | Confirmed schedule generation                   | YES — writes to schedule_shift, department_session, etc. |

### Cascade pipeline (6 steps):

```
Event: OPERATING_HOURS_CHANGED
Payload: { department_id, location_id, affected_dates[] }

Step 1 — Resolve effective hours
  For each affected date:
  hours = override(date) OR default(day_of_week)

Step 2 — Recompute template shift times (pure function)
  For each template_shift with anchor_type != 'fixed':
  schedule_shift.start_time = f(template_shift.anchor, hours)
  schedule_shift.end_time = f(template_shift.anchor, hours)

Step 3 — Conflict detection
  Flag if employee has:
  - manual override on schedule_shift
  - approved shift that would change
  - overlapping assignment
  → mark as requires_review

Step 4 — Session recalculation
  department_session.planned_open_time = hours.open_time
  department_session.planned_close_time = hours.close_time

Step 5 — Hook recalculation
  hook_trigger_time = anchor_time + trigger_offset_min

Step 6 — Notification dispatch
  Only if abs(time_delta) > threshold (e.g., 15 min)
```

### Idempotency guarantee:

Run the cascade 10 times → same result. No side effects from repeated execution.

### Vaktlista as simulation surface:

The vaktlista is NOT a read-only view. It uses **simulation mode** to show ghost cards:

- "Given your operating hours + templates + rosters, here's what shifts WOULD look like"
- User can adjust, confirm, or override
- Confirmation triggers **execution mode** → writes to schedule_shift

### Background intelligence (no user action needed):

The cascade runs silently even without published shifts:

- Computes coverage gaps, overstaffing, cost projections
- Stores as Guardian signals / intelligence metrics
- Surfaces insights through Emma or Guardian
- Helps the company "figure things out" before they've made a single scheduling decision

---

# PART C: THE I1 + 6D + 4C + K1a/K1b MODEL (Finalized 2026-03-21)

> Stress-tested by 12-persona AI Council (hospitality + infrastructure + AI).
> Full specification: `docs/cascade-spreadsheet-overview.md`

### Pre-Runtime: I1 Industry Intelligence Bootstrap

I1 is the pre-runtime layer that gives initial form to a workspace before any dimension or control plane activates. It loads industry vertical defaults (departments, budget, policies, tariffs, schedule templates, niche profiles, AI posture) and applies them via SQL templates + TypeScript config.

- Codebase: `docs/engines/industri-inteligence/` (30 files), `supabase/templates/restaurant/` (13 SQL + `_apply.sql`), `apps/web/src/lib/industry/` (hospitality.ts, types.ts)
- I1 bootstraps ALL dimensions: D1-D6 get baseline values, C1-C4 get starting config, K1b is seeded from K1a
- Principle: admin portal NEVER creates empty workspaces — always from I1 bootstrap

**Sequence:** Platform Shell --> I1 Bootstrap --> Workspace Runtime (D1-D6, C1-C4, K1a+K1b)

### Execution Dimensions (D1-D6)

| #   | Name                  | Core Question                      | Type                      |
| --- | --------------------- | ---------------------------------- | ------------------------- |
| D1  | Operational Envelope  | When/where/with what capacity?     | Structural                |
| D2  | Resource Availability | Who can/will/may work?             | Volatile (time-projected) |
| D3  | Rules & Constraints   | What's allowed/forbidden?          | Stable                    |
| D4  | Demand Signal         | How much activity?                 | Predictive                |
| D5  | Service Concept       | What kind of operation?            | Strategic                 |
| D6  | Production & Product  | What to produce, what's the state? | Live (temporal debt)      |

### Control Planes (C1-C4) — replaces earlier "intelligence layer" concept

| #   | Name                        | Core Question                     | Loop                                          |
| --- | --------------------------- | --------------------------------- | --------------------------------------------- |
| C1  | Observability & Calibration | What happened vs plan?            | Plan -> actual -> correction                  |
| C2  | Context & Interaction       | What's relevant now?              | State -> inference -> explanation -> response |
| C3  | Commercial & Outcome        | What value was created?           | Value -> attribution -> pricing               |
| C4  | Policy & Governance         | What is the system ALLOWED to do? | Capability -> permission -> audit             |

### Knowledge Substrate (K1a + K1b) — shared, not a plane

Split into two tiers:

- **K1a Industry Knowledge Base** — Platform-owned, shared per vertical. Hospitality primitives, standard patterns, policy templates, tariff baselines, role capabilities. Changes rarely.
- **K1b Workspace Knowledge Base** — Tenant-isolated. Local overrides, learned factors (from C1), workspace docs, engine_memory, local patterns. Changes continuously.

I1 bootstrap seeds K1b FROM K1a. C1 calibration writes to K1b only. K1a updates propagate as suggestions, not overwrites.

Smartout code: engine_memory (pgvector), workspace_doc_chunk, planning_factors, adjustment_factors, engine_authority_config, policy/protocol chain. Used by C1, C2, C4.

### Critical separation: "Confident" does not equal "Authorized"

- C1 says: "System BELIEVES Friday needs +15% staff"
- C4 says: "System is ALLOWED to auto-adjust up to 5%"
- C2 says: "This is HOW we explain it to the manager"
- C3 says: "That adjustment SAVED 12,000 kr last month"

C4 gates C1, always.

### Season impact by dimension

- D1: DIRECT — season redefines operating hours and capacity
- D2: INDIRECT — seasonal staff, student availability, vacation periods
- D3: NONE — labor law and rules do not change with seasons
- D4: DIRECT — demand profiles shift dramatically with seasons
- D5: RARE — service concept is mostly stable, but some venues change style seasonally
- D6: INDIRECT — seasonal menus change production requirements, but production state itself is live

**The cascade is a constraint satisfaction + optimization process.** D4 drives need, D1 sets boundaries, D2 enables solutions, D3 constrains them, D5 parameterizes everything, D6 adds temporal debt and live state. Control planes observe (C1), explain (C2), value (C3), and govern (C4) the entire process.

---

# PART D: OPEN QUESTIONS

Issues identified but not yet resolved. Must be addressed before implementation.

### OQ-1: Employee availability vs roster vs template reconciliation — RESOLVED

Three inputs that compete: template says "need someone 07-15", roster says "Per works Mon-Fri 07-15", availability says "Per is off Thursday." Resolution: The Resource Matching layer (between L4 and L5 in the cascade) handles this. Input A = resources (contracts, availability, certs), Input B = compliance tasks. Output = staffing proposal with conflict flags. Priority: availability declarations > roster patterns > template defaults. Hard blocks (AML violations) cannot be overridden.

### OQ-2: Migration path from current operating_hours

The Settings UI currently writes to `operating_hours` table. When do we migrate? Replace in one go or run parallel during transition?

### OQ-3: Season boundary cascade timing

When "Sommersesong" starts June 1, the entire operating hours profile changes. Does the system auto-cascade all of June on May 31? Or cascade on-demand as each date approaches? Or both (preview + confirm)?

### OQ-4: Multi-department coordination in vaktlista

Kitchen closes at 22:00 but Bar closes at 01:00. The cascade handles per-department hours independently. How does the vaktlista UI render this unified? Column per department? Stacked?

### OQ-5: Year wheel creation flow

When a year's seasons are set up: manual "prepare next year" action or auto-clone? Each year's parameters may differ. Who configures the next year's seasons — admin, system suggestion, or both?

### OQ-6: Demand signal data sources

Category 4 (demand) is critical but we have no reservation integration yet. What is the MVP demand signal? Manual input? Historical patterns? Or is the cascade functional without demand for now (operating on just categories 1-3)?

### OQ-7: Constraint solver priority — PARTIALLY RESOLVED

Compliance enforcement uses four severity levels (confirmed 2026-03-21): Hard Block (no override: minors after 21:00, >69h/week, <11h rest, unsigned contract), Hard Warn (override with reason: >9h/day, >40h/week, missing cert), Soft Warn (display: cert expiring 30d, <7d notice, 6+ consecutive days), Display (supplements, weekly hours vs contracted). Full list: `docs/cascade-spreadsheet-overview.md`. Optimization priority order (coverage > cost > fairness) remains configurable per workspace — not yet locked.

### OQ-8: Confidence scoring

How "good" is a generated schedule? What metrics define quality? Coverage %, cost %, employee satisfaction, rule compliance %?

### OQ-9: Fixed-time shifts and operating hours validation

A lunch rush shift (11:00-14:00) is fixed. But what if the restaurant doesn't open until 12:00? Should the system flag this as a conflict? Or should fixed shifts be allowed outside operating hours?

### OQ-10: Sub-supply shift computation

The `sub_supply` shift function is "computed from gaps." What algorithm? What triggers the computation? Is this a separate engine process?

---

# PART E: WHAT TO LOCK BEFORE BUILDING

These must be frozen before any implementation begins:

| Decision                                   | Status                  |
| ------------------------------------------ | ----------------------- |
| `department_operating_hours` table schema  | ✅ Decided              |
| `department_hours_override` table schema   | ✅ Decided              |
| `department_type` ENUM on department       | ✅ Decided              |
| Season status: draft / ready / archived    | ✅ Decided              |
| Season `is_active` boolean                 | ✅ Decided              |
| `shift_function` ENUM                      | ✅ Decided              |
| Anchor system on template shifts           | ✅ Decided              |
| Cascade via engine_process (not triggers)  | ✅ Decided              |
| Two cascade modes (simulation + execution) | ✅ Decided              |
| I1 + 6D + 4C + K1a/K1b architecture        | ✅ Decided (2026-03-21) |
| Three-layer shift architecture             | ✅ Decided              |
| Open questions OQ-1 through OQ-10          | ⬜ Must resolve         |

---

## Appendix: Complete File Reference

### Current migrations (to be deprecated/migrated):

- `supabase/migrations/20260302152749_add_dashboard_evolution_tables.sql` — `operating_hours` table
- `supabase/migrations/20260310140000_signup_tables.sql` — `company_opening_hours` table
- `supabase/migrations/20260416200000_season_opening_hours.sql` — `season.opening_hours` JSONB

### Structure migrations:

- `supabase/migrations/00002_structure_tables.sql` — department, location, zone, asset, position, team
- `supabase/migrations/00003_governance_tables.sql` — policy, protocol, procedure, routine

### Schedule/session migrations:

- `supabase/migrations/20260301300000_schedule_shift_table.sql` — shift_status, day_category enums
- `supabase/migrations/20260301600003_schedule_persistence_tables.sql` — schedule_template + shifts
- `supabase/migrations/20260302000300_employee_roster.sql` — employee_roster
- `supabase/migrations/20260412100300_session_infrastructure.sql` — session_hook, session_task, session_note

### Frontend (will need updates):

- `apps/web/src/app/dashboard/settings/_hooks/use-operating-hours.ts`
- `apps/web/src/app/dashboard/settings/_components/opening-hours-settings.tsx`
- `apps/web/src/app/dashboard/schedule/_hooks/use-templates.ts`
- `apps/web/src/app/dashboard/schedule/_hooks/use-employee-roster.ts`
- `apps/web/src/app/dashboard/schedule/page.tsx`
- `apps/web/src/lib/industry/use-industry-package.ts`

### Engine:

- `supabase/functions/engine-dispatch/index.ts` (upsert_session handler — needs cascade integration)
