---
title: "Sjohuset Simulator — Living Cascade System Test & Demo Engine"
status: draft
updated: 2026-03-23
created: 2026-03-23
module: simulation
tags: [cascade, testing, demo, multi-agent, simulation, microservice]
---

# Sjohuset Simulator

**Living Cascade System Test & Demo Engine**

A real-time restaurant simulation microservice that exercises every cascade dimension, control plane, telemetry event, and AI mission in the Smartout system. Doubles as a diagnostic tool and live demo for stakeholders.

---

## 1. Problem Statement

Smartout's cascade system spans 6 execution dimensions, 4 control planes, 2 knowledge substrates, an industry bootstrap layer, 151 telemetry events, 18 engine action types, 9 engine processes, 6 AI missions (Stage Engine voice/chat), and 5 session hook types. No single test or manual walkthrough exercises the full system. Gaps accumulate silently.

**Three needs:**

1. **System proof** — Deterministic verification that every cascade path fires correctly. CI-runnable.
2. **Live demo** — A breathing restaurant that stakeholders can watch and interact with in real-time.
3. **Workspace diagnostics** — Gap analysis that tells you exactly what's missing in any workspace for full cascade coverage.

---

## 2. Solution Overview

### 2.1 What It Is

A Hono microservice (`services/simulator/`, port 5013) that:

1. Asks the user to select a workspace or create a temporary one
2. Scans the workspace and reports data gaps per cascade dimension
3. Seeds missing data as a fictional Norwegian restaurant ("Sjohuset")
4. Runs a 3-hour real-time simulation of a full week of restaurant operations
5. Cleans up all seeded and created data via a manifest-based control plane

### 2.2 Two Execution Modes

| Mode             | Command              | Execution                                                                                              | Output                                                |
| ---------------- | -------------------- | ------------------------------------------------------------------------------------------------------ | ----------------------------------------------------- |
| **System proof** | `pnpm simulate:test` | Deterministic, sequential, max speed. No swarm. Direct function calls + Supabase client. Reproducible. | Pass/fail report per dimension, event coverage matrix |
| **Demo**         | `pnpm simulate:demo` | Real-time (3h), AI swarm, SSE-driven floating UI panel. Live dashboard. Timewarp available.            | Living restaurant experience                          |

These are **sibling modes**, not one mode with a speed toggle. Same scenario definition, different execution guarantees.

- **System proof** prioritizes reproducibility. No timing-dependent assertions. No AI agents (deterministic function calls instead). Suitable for CI.
- **Demo** prioritizes realism. AI agents act as real users through real UI/API paths. Timing is organic. Suitable for stakeholder demos.

### 2.3 Architecture Layers

| Layer                   | What                                                                                                                                                                                                     | Location                                       |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| **Simulator Service**   | Hono server — timeline engine, gap analysis, seed/cleanup, swarm coordination                                                                                                                            | `services/simulator/`                          |
| **Simulation Schema**   | PostgreSQL control plane — run metadata, manifests, reports, timeline                                                                                                                                    | `simulation` schema                            |
| **Scenario Definition** | Typed TypeScript config — Sjohuset restaurant, cast, timeline, expected coverage                                                                                                                         | `services/simulator/src/scenarios/sjohuset.ts` |
| **Floating UI Panel**   | React component — play/pause/timewarp, act indicator, coverage counters, SSE consumer                                                                                                                    | `apps/web/src/components/simulation/`          |
| **AI Swarm**            | 1 Director + 5 persona agents (demo mode only) — Claude Code agents interacting with real system. Distinct from Stage Engine AI missions (Botsson, HACCP, etc.) which the swarm EXERCISES, not replaces. | Spawned by Director agent                      |

---

## 3. Simulation Schema

Dedicated PostgreSQL schema: `simulation`. Contains ONLY the control plane. All business data is inserted into real app schemas (`public`, `payroll`, etc.) and tracked via manifests.

### 3.1 Tables

#### `simulation.run`

The root entity. One row per simulation execution.

| Column         | Type                                                                                         | Notes                                                                                                                |
| -------------- | -------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `id`           | uuid PK                                                                                      |                                                                                                                      |
| `workspace_id` | uuid FK                                                                                      | Target workspace (nullable — null = temp workspace created)                                                          |
| `mode`         | enum(`system_proof`, `demo`)                                                                 | Execution mode                                                                                                       |
| `status`       | enum(`preflight`, `diagnosing`, `seeding`, `running`, `paused`, `cleanup`, `done`, `failed`) | Run lifecycle                                                                                                        |
| `scenario`     | text                                                                                         | Scenario identifier (e.g., `sjohuset`)                                                                               |
| `speed`        | real                                                                                         | Current speed multiplier (1.0, 4.0, etc.)                                                                            |
| `scope`        | text[]                                                                                       | Active domains: `onboarding`, `staffing`, `season`, `schedule`, `sessions`, `training`, `telemetry`, `notifications` |
| `created_at`   | timestamptz                                                                                  |                                                                                                                      |
| `started_at`   | timestamptz                                                                                  | When run transitioned to `running`                                                                                   |
| `ended_at`     | timestamptz                                                                                  |                                                                                                                      |

#### `simulation.clock_segment`

Segmented simulation clock. Accumulates simulated time across speed changes and pauses.

| Column          | Type          | Notes                                 |
| --------------- | ------------- | ------------------------------------- |
| `id`            | uuid PK       |                                       |
| `run_id`        | uuid FK → run |                                       |
| `segment_index` | int           | Ordering                              |
| `speed`         | real          | Speed during this segment             |
| `wall_start`    | timestamptz   | Real-time start of segment            |
| `wall_end`      | timestamptz   | Real-time end (null if active)        |
| `sim_start`     | interval      | Accumulated sim time at segment start |

**Current sim time** = `sim_start` of active segment + (`now() - wall_start`) \* `speed`.

When speed changes or run pauses: close current segment (`wall_end = now()`), compute accumulated sim time, open new segment.

#### `simulation.run_scope`

Which cascade domains this run is allowed to seed or mutate.

| Column         | Type                              | Notes                                                              |
| -------------- | --------------------------------- | ------------------------------------------------------------------ |
| `id`           | uuid PK                           |                                                                    |
| `run_id`       | uuid FK → run                     |                                                                    |
| `domain`       | text                              | Cascade dimension/plane identifier (e.g., `D1`, `D3`, `C4`, `K1a`) |
| `scope_action` | enum(`seed`, `mutate`, `observe`) | What the run is allowed to do                                      |
| `enabled`      | boolean                           |                                                                    |

#### `simulation.seed_manifest`

One row per business record inserted into real app tables. The cleanup ledger.

| Column              | Type          | Notes                                          |
| ------------------- | ------------- | ---------------------------------------------- |
| `id`                | uuid PK       |                                                |
| `run_id`            | uuid FK → run |                                                |
| `target_schema`     | text          | e.g., `public`, `payroll`                      |
| `target_table`      | text          | e.g., `profile`, `schedule_shift`              |
| `target_pk`         | uuid          | Primary key of inserted row                    |
| `seed_category`     | text          | e.g., `staff`, `shift`, `session`, `framework` |
| `cascade_dimension` | text          | Which dimension this serves (e.g., `D2`, `D6`) |
| `created_at`        | timestamptz   |                                                |

#### `simulation.mutation_manifest`

Tracks changes to PRE-EXISTING rows so rollback can restore original state, not delete.

| Column           | Type          | Notes                 |
| ---------------- | ------------- | --------------------- |
| `id`             | uuid PK       |                       |
| `run_id`         | uuid FK → run |                       |
| `target_schema`  | text          |                       |
| `target_table`   | text          |                       |
| `target_pk`      | uuid          |                       |
| `column_name`    | text          | Changed column        |
| `original_value` | jsonb         | Value before mutation |
| `mutated_value`  | jsonb         | Value after mutation  |
| `created_at`     | timestamptz   |                       |

#### `simulation.gap_report`

Preflight diagnostic. One row per coverage requirement.

| Column              | Type                                                    | Notes                                            |
| ------------------- | ------------------------------------------------------- | ------------------------------------------------ |
| `id`                | uuid PK                                                 |                                                  |
| `run_id`            | uuid FK → run                                           |                                                  |
| `cascade_dimension` | text                                                    | e.g., `I1`, `D3`, `C1`                           |
| `requirement`       | text                                                    | Human-readable requirement description           |
| `status`            | enum(`present`, `seedable`, `blocking`, `out_of_scope`) | Gap classification                               |
| `detail`            | jsonb                                                   | What exists, what's missing, what will be seeded |
| `created_at`        | timestamptz                                             |                                                  |

#### `simulation.timeline_event`

The 3-hour scenario script. Pre-computed, then executed.

| Column            | Type                                                                              | Notes                                                      |
| ----------------- | --------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| `id`              | uuid PK                                                                           |                                                            |
| `run_id`          | uuid FK → run                                                                     |                                                            |
| `act`             | int                                                                               | Act number (1-10)                                          |
| `act_name`        | text                                                                              | e.g., "Day Opens"                                          |
| `event_key`       | text                                                                              | Unique event identifier within scenario                    |
| `sim_time`        | interval                                                                          | When this fires in simulation time                         |
| `agent_persona`   | text                                                                              | Which swarm agent handles this (null in system_proof mode) |
| `payload`         | jsonb                                                                             | Event-specific data                                        |
| `status`          | enum(`scheduled`, `dispatched`, `acknowledged`, `completed`, `failed`, `skipped`) | Lifecycle state                                            |
| `dispatched_at`   | timestamptz                                                                       |                                                            |
| `acknowledged_at` | timestamptz                                                                       |                                                            |
| `completed_at`    | timestamptz                                                                       |                                                            |
| `error`           | text                                                                              | Failure reason if status = failed                          |

**Event lifecycle:**

- `scheduled` — Loaded from scenario, not yet due
- `dispatched` — Sim clock reached this event, sent to agent/executor
- `acknowledged` — Agent confirmed receipt and started work
- `completed` — Agent confirmed the action succeeded (with verification)
- `failed` — Agent reported failure or timeout
- `skipped` — Explicitly skipped (dependency failed, out of scope)

#### `simulation.agent_session`

Swarm persona tracking (demo mode only).

| Column           | Type                                    | Notes                                                          |
| ---------------- | --------------------------------------- | -------------------------------------------------------------- |
| `id`             | uuid PK                                 |                                                                |
| `run_id`         | uuid FK → run                           |                                                                |
| `persona`        | text                                    | e.g., `admin`, `kitchen_manager`, `trainee`                    |
| `display_name`   | text                                    | e.g., "Lars, daglig leder"                                     |
| `auth_mode`      | text                                    | How this persona authenticates (`service_role`, `jwt_as_user`) |
| `profile_id`     | uuid                                    | Supabase profile this persona acts as                          |
| `status`         | enum(`idle`, `active`, `error`, `done`) |                                                                |
| `current_task`   | text                                    | What the agent is currently doing                              |
| `last_heartbeat` | timestamptz                             |                                                                |

#### `simulation.cleanup_job`

Cleanup progress tracking.

| Column           | Type                                                           | Notes                         |
| ---------------- | -------------------------------------------------------------- | ----------------------------- |
| `id`             | uuid PK                                                        |                               |
| `run_id`         | uuid FK → run                                                  |                               |
| `phase`          | enum(`mutations`, `seeds`, `temp_workspace`, `schema_cleanup`) | Cleanup phase                 |
| `status`         | enum(`pending`, `running`, `completed`, `failed`)              |                               |
| `rows_processed` | int                                                            |                               |
| `rows_failed`    | int                                                            |                               |
| `errors`         | jsonb                                                          | Array of { table, pk, error } |
| `started_at`     | timestamptz                                                    |                               |
| `completed_at`   | timestamptz                                                    |                               |

### 3.2 Column Conventions

All simulation schema tables include:

- `created_at timestamptz NOT NULL DEFAULT now()`
- `updated_at timestamptz NOT NULL DEFAULT now()` with `set_updated_at()` trigger

This applies to: `run`, `clock_segment`, `run_scope`, `seed_manifest`, `mutation_manifest`, `gap_report`, `timeline_event`, `agent_session`, `cleanup_job`. The `updated_at` column and trigger are omitted from the table definitions above for brevity but are mandatory in the migration.

### 3.3 Auth & RLS Model

The `simulation` schema is **platform-admin-only**. No RLS policies. Access is restricted to:

| Operation                               | Auth                                      | Client                                 | Justification                                         |
| --------------------------------------- | ----------------------------------------- | -------------------------------------- | ----------------------------------------------------- |
| Run lifecycle (create, control, delete) | `is_godmode` check OR service role        | Service role Supabase client           | Only platform admins run simulations                  |
| Seeding into real app tables            | Service role                              | Service role Supabase client           | Seeding bypasses normal user flows intentionally      |
| Swarm agent interactions (demo mode)    | Real JWT per persona                      | Anon key Supabase client with user JWT | Proving real auth flows work                          |
| Cleanup                                 | Service role                              | Service role Supabase client           | Cleanup must reach all seeded rows regardless of RLS  |
| SSE stream / UI reads                   | Authenticated user + workspace membership | Anon key with JWT                      | Dashboard panel only shows data for current workspace |

**Key rules:**

- The service role client is NEVER exposed to UI components or swarm persona agents
- Swarm agents in demo mode use real Supabase auth users (created during seeding, cleaned up after) to exercise honest RLS paths
- System proof mode uses service role with `set_config('app.workspace_id', ...)` for deterministic execution
- The simulator service validates `is_godmode` on the requesting user before accepting `POST /runs`

---

## 4. Gap Analysis Engine

Before seeding, the simulator runs a coverage scan against the target workspace. The scan classifies each requirement into one of four states:

| Status         | Meaning                              | Action               |
| -------------- | ------------------------------------ | -------------------- |
| `present`      | Workspace already has this data      | Skip seeding         |
| `seedable`     | Missing, simulator can safely add it | Will be seeded       |
| `blocking`     | Missing, cannot be safely fabricated | Report as limitation |
| `out_of_scope` | Not required for this run's scope    | Ignore               |

### 4.1 Coverage Buckets

Mapped directly to the cascade model:

| Bucket     | What's checked                                                                                            | Source of truth tables                                                                                                             |
| ---------- | --------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| **I1/K1a** | Industry bootstrap applied? Framework rules seeded? Tariff rates present? Public holidays loaded?         | `regulatory_framework`, `framework_rule`, `framework_trigger`, `tariff_rate_table`, `public_holiday`                               |
| **D1**     | Departments exist? Locations? Zones? Operating hours configured? Planning cycle? Overrides?               | `department`, `location`, `zone`, `department_operating_hours`, `department_hours_override`, `planning_cycle`, `position`, `asset` |
| **D2**     | Profiles created? Contracts? Payroll profiles? Teams? At least 1 trainee? Absences?                       | `profile`, `employment_contract`, `employee_payroll_profile`, `team`, `schedule_absence`                                           |
| **D3**     | Framework rules/triggers bound to workspace? Override system functional?                                  | `workspace_framework_binding`, `framework_rule`, `framework_trigger`, `workspace_rule_override`, `workspace_trigger_override`      |
| **D4**     | Active season? Budget set? Day/hour factors distributed? KPI targets? Workspace budgets? Planning events? | `season`, `season_budget`, `day_factor`, `hour_factor`, `workspace_kpi_target`, `workspace_budget`, `planning_event`               |
| **D5**     | Workspace config sufficient for scenario? Niche parameters? Authority config?                             | `engine_authority_config`, workspace settings                                                                                      |
| **D6**     | Sessions creatable? Hooks configured? Shifts assignable? Deviations trackable?                            | `department_session`, `session_hook`, `session_task`, `schedule_shift`, `deviation`, `shift_approval`                              |
| **C1**     | Reconciliation path testable?                                                                             | `daily_reconciliation`                                                                                                             |
| **C3**     | Cost snapshot process seeded? Budget propagation wired?                                                   | `shift_cost_snapshot`, `engine_process` seeds for cost/budget                                                                      |
| **C4**     | Authority config per capability? Proposal gates functional?                                               | `engine_authority_config`, `change_proposal`                                                                                       |
| **K1b**    | Workspace doc chunks present (for Botsson)? Engine memory initialized?                                    | `workspace_doc_chunk`, `engine_memory`                                                                                             |

Note: The tables listed are the **minimum viable subset** for each dimension. Some dimensions have additional tables (e.g., D6 has schedule templates, open shifts) that are not required for the Sjohuset scenario but could be added for more comprehensive coverage in future scenarios.

### 4.2 Report Output

The gap report answers four questions:

1. **What exists already?** — Data the workspace has that the simulation will use as-is.
2. **What must be seeded?** — Missing data the simulator will insert (tracked in seed_manifest).
3. **What can only be partially tested?** — Dimensions where blocking gaps prevent full coverage.
4. **What will be cleaned up afterward?** — Summary of expected seed/mutation footprint.

---

## 5. Scenario Definition

### 5.1 Format

Typed TypeScript config. Not a DSL, not loose JSON. Validated at compile time, easy to evolve and refactor.

```typescript
// services/simulator/src/scenarios/types.ts
export interface SimulationScenario {
  id: string;
  name: string;
  description: string;
  locale: "nb-NO";

  // The restaurant
  restaurant: RestaurantConfig;

  // The cast
  cast: PersonaConfig[];

  // The timeline (10 acts)
  acts: ActConfig[];

  // Expected coverage (from registries)
  coverage: CoverageExpectation;
}

export interface RestaurantConfig {
  name: string; // "Sjohuset"
  type: "restaurant";
  city: string; // "Bergen"
  departments: DepartmentConfig[]; // Kjokken, Sal, Bar
  operating_hours: OperatingHoursConfig;
  season: SeasonConfig;
  budget: BudgetConfig;
}

export interface PersonaConfig {
  persona: string; // 'admin' | 'kitchen_manager' | etc.
  display_name: string; // "Lars Berge"
  role: "owner" | "admin" | "manager" | "employee";
  department?: string;
  profile_status: "active" | "trainee";
  contract_type: "full_time" | "part_time" | "extra";
  swarm_agent: boolean; // Does this persona get an AI agent in demo mode?
}

export interface ActConfig {
  act: number;
  name: string;
  sim_time_start: string; // "Mon 06:00" in sim week
  sim_time_end: string;
  events: TimelineEventConfig[];
  expected_telemetry: string[]; // Event names from registry
  expected_dimensions: string[]; // D1, D3, C4, etc.
}

export interface CoverageExpectation {
  telemetry_events: string[]; // Generated from registry
  action_types: string[]; // Generated from engine dispatch
  engine_processes: string[]; // Generated from process seeds
  session_hook_types: string[]; // Generated from enum
  missions: string[]; // Generated from mission registry
  cascade_dimensions: string[]; // I1, D1-D6, C1-C4, K1a, K1b
}
```

### 5.2 Sjohuset Scenario

**Restaurant:** Sjohuset — Seafood restaurant in Bergen, Norway.

**Departments (3):**

| Department | Type    | Offset          | Positions                |
| ---------- | ------- | --------------- | ------------------------ |
| Kjokken    | kitchen | -120 min (open) | Kokk, Sous-chef, Lærling |
| Sal        | floor   | -60 min (open)  | Servitor, Hovmester      |
| Bar        | bar     | -30 min (open)  | Bartender                |

**Cast (12 personas):**

| #   | Name        | Role        | Department | Status  | Swarm Agent           |
| --- | ----------- | ----------- | ---------- | ------- | --------------------- |
| 1   | Lars Berge  | Owner/Admin | —          | active  | Yes (Admin)           |
| 2   | Ingrid Vik  | Manager     | Kjokken    | active  | Yes (Kitchen Manager) |
| 3   | Thomas Dahl | Manager     | Sal + Bar  | active  | Yes (Floor Manager)   |
| 4   | Sofia Lund  | Employee    | Kjokken    | trainee | Yes (Trainee)         |
| 5   | Erik Haugen | Employee    | Sal        | active  | Yes (Employee)        |
| 6   | Marte Olsen | Employee    | Sal        | active  | No                    |
| 7   | Jonas Berg  | Employee    | Bar        | active  | No                    |
| 8   | Hanna Lie   | Employee    | Kjokken    | active  | No                    |
| 9   | Kristian Mo | Employee    | Kjokken    | trainee | No                    |
| 10  | Nora Strand | Employee    | Sal        | active  | No                    |
| 11  | Ole Bakke   | Employee    | Bar        | active  | No                    |
| 12  | Silje Ravn  | Employee    | Kjokken    | active  | No                    |

**Season:** "Varsesong 2026" — Active season with revenue target, day factors (Fri/Sat weighted 1.5x), hour factors (18:00-22:00 peak).

### 5.3 Timeline (10 Acts in 1 Simulated Week)

| Act | Sim Time            | Real Time (1x) | Name            | What Happens                                                                                                                                                                                                                                                                                                       | Cascade Coverage        |
| --- | ------------------- | -------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------- |
| 1   | Mon 06:00-09:00     | 0:00-0:07      | Bootstrap       | Admin onboards Sjohuset via wizard. I1 template applied. Framework bound.                                                                                                                                                                                                                                          | I1, D1, D3, K1a         |
| 2   | Mon 09:00-13:00     | 0:07-0:17      | Staff Up        | 12 employees created. Contracts, payroll profiles, teams. 2 trainees flagged.                                                                                                                                                                                                                                      | D2, D5                  |
| 3   | Mon 13:00-17:00     | 0:17-0:27      | Season & Budget | Varsesong created. Revenue target set. Day/hour factors distributed. Budget propagated.                                                                                                                                                                                                                            | D4, C3                  |
| 4   | Tue 08:00-16:00     | 0:31-0:44      | Schedule        | Week of shifts created across 3 departments. Framework rules evaluated. Violations: Sofia (under-18 test), Erik (rest period test), overtime request.                                                                                                                                                              | D3, D6, C4              |
| 5   | Wed 06:00-10:00     | 0:56-1:03      | Day Opens       | Session hooks fire: pre_open (kitchen prep), open (all departments). Checklists created. Engine dispatch triggers.                                                                                                                                                                                                 | D6, engine dispatch     |
| 6   | Wed 10:00-15:00     | 1:03-1:11      | Training        | Trainees (Sofia, Kristian) get protocol assignments. Procedure steps, knowledge test, confirmation signature. Sofia completes; Kristian partial.                                                                                                                                                                   | Governance, readiness   |
| 7   | Wed 15:00-23:00     | 1:11-1:24      | Live Shift      | Clock-ins, service. Deviations: Erik 12 min late, Marte leaves 30 min early (child sick). Shift approvals by managers.                                                                                                                                                                                             | D6, C1                  |
| 8   | Wed 23:00-Thu 01:00 | 1:24-1:28      | Day Closes      | pre_close and close hooks. Daily reconciliation. Settlement images. Cost snapshot (planned vs actual). Admin sign-off.                                                                                                                                                                                             | C1, C3, engine dispatch |
| 9   | Thu 08:00-12:00     | 1:37-1:44      | Guardian        | Guardian sweep: stale session check, unresolved deviation flag, trainee escalation, Botsson conversations. **Note:** Guardian sweep depends on stage-engine guardian evaluator loop. If not running, this act fires what it can (Botsson chat, deviation queries) and marks guardian-specific events as `skipped`. | C2, stage engine, K1b   |
| 10  | Thu-Sun             | 1:44-2:50      | Week Plays Out  | Acts 5-8 repeat with daily variation. New deviations, different employees, budget vs actual divergence grows. Micro-events between acts.                                                                                                                                                                           | All dimensions cycled   |
| —   | Sun 23:00           | 2:50-3:00      | Final Report    | Coverage check: every telemetry event, every dimension, every process. Gap report updated. Dashboard shows full week KPIs.                                                                                                                                                                                         | Verification            |

**Between acts:** Micro-events keep the restaurant alive — notification pulses, telemetry heartbeats, Botsson conversations, guardian checks. No dead time.

---

## 6. Segmented Simulation Clock

### 6.1 Problem

A naive `simulationTime = started_at + elapsed * speed` breaks when speed changes or the run pauses. After pause+resume or a timewarp toggle, the calculated sim time jumps or drifts.

### 6.2 Solution: Clock Segments

The clock is a chain of segments stored in `simulation.clock_segment`. Each segment records the speed and wall-clock window for that period.

**Deriving current simulation time:**

```typescript
function currentSimTime(segments: ClockSegment[]): Duration {
  let total = Duration.zero();

  for (const seg of segments) {
    const wallEnd = seg.wall_end ?? DateTime.now();
    const wallDuration = wallEnd.diff(seg.wall_start);
    const simDuration = wallDuration.multiply(seg.speed);
    total = total.plus(simDuration);
  }

  return total;
}
```

**Speed change protocol:**

1. Close active segment: set `wall_end = now()`
2. Compute `sim_start` for new segment: sum of all previous segments' sim durations
3. Insert new segment: `{ speed: newSpeed, wall_start: now(), wall_end: null, sim_start }`

**Pause:** Close active segment. No new segment until resume.
**Resume:** Open new segment at same speed, `sim_start` = accumulated.

### 6.3 Time Compression Math

The scenario spans Mon 06:00 to Sun 23:00 = 161 simulated hours. Target: 3 real hours (180 min).

**Base compression ratio:** 161 sim hours / 3 real hours = **53.7:1**. So 1x speed = 1 real minute = ~54 sim minutes.

Verification: 180 real min \* 54 sim min/real min = 9,720 sim min = 162 sim hours. Covers the full week.

### 6.4 Timewarp Modes (Demo Only)

| Mode            | Multiplier | Effective ratio | Behavior                                          |
| --------------- | ---------- | --------------- | ------------------------------------------------- |
| **Normal (1x)** | 1.0        | 54:1            | 1 real min = 54 sim min. Base pace for 3h demo.   |
| **Fast (2x)**   | 2.0        | 108:1           | 1 real min = 108 sim min. Demo finishes in ~1.5h. |
| **Pause**       | 0.0        | frozen          | Timeline frozen. User explores dashboard state.   |

System proof mode ignores the clock entirely — it processes events sequentially at system speed.

---

## 7. Simulator Service API

### 7.1 Endpoints

`services/simulator/` — Hono on port 5013.

| Method   | Path                 | Description                                  |
| -------- | -------------------- | -------------------------------------------- |
| `POST`   | `/runs`              | Start a new simulation run                   |
| `GET`    | `/runs`              | List all runs (active + completed)           |
| `GET`    | `/runs/:id`          | Run status, current act, coverage progress   |
| `PATCH`  | `/runs/:id`          | Control: pause, resume, speed change, stop   |
| `DELETE` | `/runs/:id`          | Stop + trigger cleanup                       |
| `GET`    | `/runs/:id/report`   | Gap analysis + coverage report               |
| `GET`    | `/runs/:id/timeline` | Full timeline with event lifecycle states    |
| `GET`    | `/runs/:id/events`   | SSE stream — real-time event feed for UI     |
| `GET`    | `/runs/:id/cleanup`  | Cleanup progress + failures                  |
| `POST`   | `/runs/:id/cleanup`  | Trigger manual cleanup (retry after failure) |
| `GET`    | `/health`            | Health check                                 |

**Internal-only (not exposed to UI):**

| Method | Path                                           | Description                     |
| ------ | ---------------------------------------------- | ------------------------------- |
| `POST` | `/internal/runs/:id/agents/:persona/command`   | Send command to swarm agent     |
| `POST` | `/internal/runs/:id/agents/:persona/heartbeat` | Agent heartbeat + status update |
| `POST` | `/internal/runs/:id/events/:eventId/ack`       | Agent acknowledges event        |
| `POST` | `/internal/runs/:id/events/:eventId/complete`  | Agent reports event completion  |
| `POST` | `/internal/runs/:id/events/:eventId/fail`      | Agent reports event failure     |

Internal endpoints are used by the swarm Director to coordinate agents. Never exposed to the UI or manual use.

### 7.2 Key Request/Response Shapes

**`POST /runs`**

```typescript
// Request
{
  mode: 'system_proof' | 'demo',
  workspace_id: string | null,    // null = create temp workspace
  scenario: 'sjohuset',
  scope: string[],                // ['onboarding', 'staffing', 'season', ...]
  speed?: number                  // Initial speed (demo only, default 1.0)
}

// Response
{
  id: string,
  status: 'preflight',
  workspace_id: string,           // Assigned or created
  gap_report_ready: false
}
```

**`GET /runs/:id`**

```typescript
{
  id: string,
  status: 'running',
  mode: 'demo',
  workspace_id: string,
  speed: 1.0,
  simulation_time: 'Wed 16:42',
  wall_time_elapsed: '1h 13m',
  wall_time_remaining: '1h 47m',
  current_act: {
    number: 7,
    name: 'Live Shift',
    progress_pct: 45
  },
  coverage: {
    telemetry: { fired: 89, expected: 114, pct: 78 },
    action_types: { fired: 12, expected: 16, pct: 75 },
    engine_processes: { triggered: 5, expected: 7, pct: 71 },
    dimensions: {
      covered: ['I1', 'D1', 'D2', 'D3', 'D4', 'D6'],
      partial: ['D5', 'C1', 'C4'],
      missing: ['C3']
    }
  },
  agents: {
    active: 4,
    idle: 1,
    error: 0,
    personas: [
      { persona: 'admin', status: 'idle', display_name: 'Lars Berge' },
      { persona: 'kitchen_manager', status: 'active', task: 'Approving shift deviations', display_name: 'Ingrid Vik' },
      // ...
    ]
  }
}
```

**Coverage counts are NEVER hardcoded.** They are derived at run start from:

- Telemetry: `packages/telemetry/src/registry.ts` (151 events total, filtered by scenario scope)
- Action types: `supabase/functions/engine-dispatch/index.ts` (18 total, filtered by scenario)
- Engine processes: seeded `engine_process` rows (7 total)
- Missions: `packages/ai/src/missions/registry.ts` (6 total, filtered by scenario)
- Session hooks: `session_hook_type` enum (5 values)
- Dimensions: scenario definition declares expected coverage

### 7.3 SSE Stream

```
event: act_start
data: {"act": 5, "name": "Day Opens", "sim_time": "Wed 06:00"}

event: agent_action
data: {"agent": "kitchen_manager", "action": "create_shift", "detail": "Erik -> lordag 16:00-23:00"}

event: telemetry_fired
data: {"event": "shift.created", "destinations": ["posthog", "activity_trail", "engine_event"], "coverage_pct": 72}

event: rule_evaluation
data: {"rule": "AML 10-8 min rest", "outcome": "blocked", "context": "Sofia -> fredag 06:00"}

event: notification
data: {"type": "deviation_created", "to": "Ingrid Vik", "message": "Erik 12 min sen"}

event: coverage_update
data: {"telemetry_pct": 78, "dimensions_covered": 9, "total_dimensions": 14}

event: act_complete
data: {"act": 5, "duration_wall": "7m 12s", "events_completed": 12, "events_failed": 0}

event: clock_update
data: {"sim_time": "Wed 16:42", "speed": 1.0, "wall_remaining": "1h 47m"}
```

---

## 8. AI Swarm Architecture (Demo Mode Only)

### 8.1 Composition

6 agents, each with a persona and clear interaction boundaries.

| Agent               | Persona                  | Interacts Via                                 | Never Does                   |
| ------------------- | ------------------------ | --------------------------------------------- | ---------------------------- |
| **Director**        | Orchestrator             | Simulator internal API, SSE stream            | Touch Supabase directly      |
| **Admin**           | Lars Berge, daglig leder | Dashboard UI paths, Supabase client (as user) | Create data via service role |
| **Kitchen Manager** | Ingrid Vik, kjokkensjef  | Dashboard UI paths, Supabase client (as user) | Touch other departments      |
| **Floor Manager**   | Thomas Dahl, hovmester   | Dashboard UI paths, Supabase client (as user) | Touch kitchen data           |
| **Trainee**         | Sofia Lund, laerling     | Employee UI, Stage Engine (Botsson chat)      | Admin actions                |
| **Employee**        | Erik Haugen, servitor    | Employee UI, Stage Engine (Botsson chat)      | Admin/manager actions        |

### 8.2 Interaction Rules

1. **Privileged access (service role)** is used ONLY for: bootstrap seeding, diagnostics, cleanup, and timeline event tracking.
2. **Real UI/API paths** are used for: onboarding, schedule creation, shift actions, training flows, Botsson interaction, session management, notifications, telemetry emission.
3. **A direct DB insert is NEVER counted as proof that a user-facing flow works.** If a shift is created via service role for seeding, that's fine. But proving "schedule creation works" requires the Kitchen Manager agent to create shifts through the same code path a real manager would use.

### 8.3 Director Flow

```
Director Agent
  |
  +-- Subscribes to: GET /runs/:id/events (SSE)
  |
  +-- On act_start:
  |     1. Read act config from scenario
  |     2. For each event in act:
  |        a. POST /internal/.../ack (acknowledge receipt)
  |        b. Dispatch to correct persona agent
  |        c. Wait for persona to report back
  |        d. POST /internal/.../complete or .../fail
  |
  +-- On clock_update:
  |     Verify sim time matches expected act progression
  |
  +-- On agent error:
        Log, attempt retry, mark event as failed if unrecoverable
```

### 8.4 System Proof Mode Differences

No swarm. No Director. The simulator service itself executes each timeline event:

1. Calls the same business logic functions directly (e.g., `evaluateFrameworkRules()`, `propagateBudgetTargets()`)
2. Inserts data via Supabase client with appropriate auth context
3. Asserts expected outcomes (telemetry events emitted, correct evaluation results, etc.)
4. Reports pass/fail per event

This makes system proof deterministic and fast. No timing dependencies, no agent flakiness.

---

## 9. Cleanup Engine

### 9.1 Cleanup Order

Manifest-driven, reverse FK order:

1. **Phase 1: Mutations** — Restore pre-existing rows to original values using `mutation_manifest`
2. **Phase 2: Seeds** — Delete seeded rows in reverse insertion order using `seed_manifest`. FK dependencies resolved by processing child tables before parents.
3. **Phase 3: Temp workspace** — If pure demo mode created a temporary workspace, delete it entirely
4. **Phase 4: Simulation data** — Clean up the `simulation` schema rows for this run (optional — can keep for historical reporting)

### 9.2 Safety Rules

- Cleanup NEVER deletes rows not in the manifest
- Cleanup NEVER touches rows from other simulation runs
- If a seeded row has been modified by real user activity (not tracked in mutation_manifest), cleanup logs a warning and skips it
- Failed cleanup rows are logged to `cleanup_job.errors` for manual resolution
- Cleanup is idempotent — can be retried safely

### 9.3 Trigger

- **Auto:** Runs when simulation status transitions to `done` or user sends `DELETE /runs/:id`
- **Manual:** `POST /runs/:id/cleanup` for retry after partial failure

---

## 10. Floating UI Panel (Demo Mode)

### 10.1 Component

`apps/web/src/components/simulation/SimulationPanel.tsx`

A floating panel in the bottom-right of the dashboard (similar to a chat widget). Only visible when a demo run is active for the current workspace.

### 10.2 Elements

| Element               | What                                            |
| --------------------- | ----------------------------------------------- |
| **Act indicator**     | Current act name + progress bar                 |
| **Sim clock**         | "Wed 16:42" — ticking in sim time               |
| **Speed controls**    | 1x / 4x / Pause buttons                         |
| **Coverage counters** | Telemetry: 89/114, Dimensions: 9/14             |
| **Event feed**        | Scrolling list of recent events from SSE stream |
| **Agent status**      | Who's active, what they're doing                |
| **Stop button**       | Triggers cleanup                                |

### 10.3 Design

Follows "Ren og Varm" style guide. Spring physics for panel open/close (stiffness 35, damping 22, mass 2). Semi-transparent background. Instrument Serif for act names, Geist Sans for data, Geist Mono for timestamps.

---

## 11. Registry-Backed Coverage Accounting

Coverage totals are NEVER hardcoded. They are computed at run initialization from source-of-truth registries.

### 11.1 Coverage Sources

| Metric                | Registry Source                                          | Current Count                   | How Computed                                                                      |
| --------------------- | -------------------------------------------------------- | ------------------------------- | --------------------------------------------------------------------------------- |
| Telemetry events      | `packages/telemetry/src/registry.ts` SmartoutEvent union | 151 total                       | Parse union type, filter by scenario scope                                        |
| Routing destinations  | Registry routing map                                     | 4 implemented (5 declared)      | Enum values; `notifications` destination declared but not yet handled in emit.ts  |
| Action types          | `supabase/functions/engine-dispatch/` handler switch     | 18                              | Parse handler cases                                                               |
| Engine processes      | `engine_process` table (seeded via migrations)           | 9                               | Query DB at run start                                                             |
| Session hook types    | `session_hook_type` enum                                 | 5                               | Query DB enum                                                                     |
| Stage Engine missions | `packages/ai/src/missions/registry.ts`                   | 6                               | Import and count (these are exercised BY swarm agents, not the agents themselves) |
| Cascade dimensions    | Scenario definition                                      | 14 (I1, D1-D6, C1-C4, K1a, K1b) | Scenario config                                                                   |

### 11.2 Per-Run Expected Coverage

Not every telemetry event is relevant to every scenario. The scenario definition declares which events it expects to fire:

```typescript
// In sjohuset.ts scenario config
coverage: {
  telemetry_events: [
    'shift.created', 'shift.published', 'shift.completed',
    'session.opened', 'session.closed', 'session.hook_fired',
    'protocol.assigned', 'protocol.step_completed', 'protocol.completed',
    'deviation.reported', 'deviation.resolved',
    'reconciliation.submitted', 'reconciliation.admin_action',
    'season.created', 'season_budget.updated',
    'contract.created', 'contract.signed',
    // ... filtered subset of 151
  ],
  action_types: [
    'assign_task', 'upsert_session', 'cascade_cost_snapshot',
    'cascade_budget_propagation', 'generate_steps', 'present_content',
    'administer_test', 'collect_signature', 'check_readiness',
    'create_session_task', 'start_process', 'create_deviation',
    'wait_for_event', 'update_entity', 'lock_checkout', 'schedule_control'
  ],
  // ...
}
```

Coverage percentage = (events actually fired during run) / (events expected by scenario).

---

## 12. Infrastructure & Deployment

### 12.1 Local Development

```bash
# Start simulator alongside other services
docker compose up simulator

# Or standalone
cd services/simulator && pnpm dev  # Port 5013

# Run system proof
pnpm simulate:test

# Run demo
pnpm simulate:demo
```

### 12.2 Dependencies

- Local Supabase running (`npx supabase start`)
- `simulation` schema migration applied
- Web dashboard running on port 3060 (for demo mode)
- Stage Engine running on port 5010 (for Botsson interactions in demo mode)

### 12.3 Docker Compose Addition

```yaml
simulator:
  build: ./services/simulator
  ports:
    - "5013:5013"
  environment:
    - SUPABASE_URL=${SUPABASE_URL}
    - SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY}
    - STAGE_ENGINE_URL=http://stage-engine:5010
    - SIMULATOR_PORT=5013
  depends_on:
    - stage-engine
```

Note: Local Supabase runs via `npx supabase start` (external to Docker Compose), not as a Docker Compose service. The `SUPABASE_URL` env var points to the local instance. No `depends_on: supabase` — the service connects via URL.

### 12.4 Not In Scope

- Mobile app simulation (web dashboard only)
- Production deployment (local/staging only)
- Multi-workspace simultaneous runs (future)
- Building missing cascade features (we test what exists)
- Custom scenario authoring UI (scenarios are TypeScript files)

---

## 13. Error Handling

### 13.1 System Proof Mode

- **Event failure:** Log error, mark event as `failed`, continue to next event. The run does NOT abort on individual failures — it completes all acts and reports a failure summary.
- **Seeding failure:** Abort run. Mark as `failed`. Trigger cleanup of any partially seeded data.
- **Cleanup failure:** Log to `cleanup_job.errors`. Retry up to 3 times with exponential backoff. If still failing, mark cleanup as `failed` and surface for manual resolution.

### 13.2 Demo Mode

- **Agent failure:** Director retries once. If still failing, marks event as `failed` and continues. Agent status set to `error` with heartbeat monitoring.
- **Agent crash:** Director detects missing heartbeat (30s timeout). Marks agent as `error`. Remaining events for that persona are `skipped`. Other personas continue.
- **Timeline drift:** If actual wall time deviates >10% from expected (e.g., slow Supabase), the Director logs a warning but does not auto-adjust speed.

### 13.3 FK Constraint Violations During Cleanup

Cleanup processes tables in reverse FK order. If a constraint violation occurs:

1. Skip the offending row
2. Log to `cleanup_job.errors` with table, PK, and constraint name
3. Continue with remaining rows
4. Re-attempt skipped rows after all other rows are processed (dependency may now be resolved)
5. If still failing after 2 passes, mark as manual-resolution-required

---

## 14. Decision Log

| #   | Decision                                                                                  | Rationale                                                                                                                             |
| --- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Dedicated `simulation` schema for control plane, business data in real schemas            | Manifest-based cleanup is safer than schema drop. Real app reads from real tables.                                                    |
| 2   | Segmented clock, not `started_at * speed`                                                 | Speed changes and pauses require accumulated segments. Simple multiplication drifts.                                                  |
| 3   | 6-state event lifecycle (scheduled->dispatched->acknowledged->completed->failed->skipped) | `dispatched` is not `completed`. Swarm agents may fail silently without acknowledgment tracking.                                      |
| 4   | System proof and demo as sibling modes, not speed variants                                | System proof needs deterministic, reproducible assertions. Demo needs organic, real-time interaction. Different execution guarantees. |
| 5   | Internal-only agent command channel                                                       | UI controls the run, simulator controls the swarm. Manual agent commands are a debugging tool, not a user surface.                    |
| 6   | Registry-backed coverage, not hardcoded totals                                            | 151 telemetry events today, could be 200 tomorrow. Coverage must be computed from registries at run start.                            |
| 7   | Typed TypeScript scenario config, not DSL/JSON                                            | Compile-time validation, IDE support, easy refactoring. DSL is premature.                                                             |
| 8   | Manifest tracks every insert for surgical cleanup                                         | No residual data after simulation. Safe to run against real workspaces.                                                               |
| 9   | Hono microservice on port 5013                                                            | Consistent with stage-engine (5010), shift-mcp (5011), contract-service (5012).                                                       |
| 10  | Real UI/API paths for demo, direct calls for system proof                                 | Demo proves the product works end-to-end. System proof proves the logic is correct.                                                   |
| 11  | Platform-admin-only auth for simulation schema (no RLS)                                   | Simulation is a diagnostic/testing tool, not a user feature. Service role for seeding/cleanup, real JWTs for swarm personas.          |
| 12  | Real Supabase auth users for swarm personas in demo mode                                  | Honest RLS testing. Service role impersonation would bypass the auth paths we're trying to prove.                                     |
| 13  | ADR required before implementation                                                        | New microservice + new PostgreSQL schema. Per project conventions, requires architectural decision record.                            |

---

## 14. Open Questions

1. **Auth for swarm agents in demo mode:** Create real Supabase auth users for each persona? Or use service role with `set_config` to impersonate? Real users are more honest but require email/password setup.
2. **Telemetry side effects:** Should PostHog events from simulation be tagged to avoid polluting analytics? Or use a separate PostHog project?
3. **Stage Engine load:** 6 personas potentially chatting with Botsson simultaneously. Is the stage engine WebSocket server ready for this?
4. **Notification rendering:** `send_notification` is currently a stub. Should the simulator mock notifications, or should we implement the real handler first?
5. **Scenario extensibility:** When should we add a second scenario (e.g., hotel, retail)? After v1 is stable, or design for it now?

---

## Appendix A: Current System Inventory

Exact counts from source-of-truth registries as of 2026-03-23:

| Registry                      | Count                           | Source                                                                                                                                                                                                                                                                                          |
| ----------------------------- | ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Telemetry events              | 151                             | `packages/telemetry/src/registry.ts`                                                                                                                                                                                                                                                            |
| Telemetry destinations        | 5 declared, **4 implemented**   | posthog, logger, activity_trail, engine_event (active); notifications (declared in type but NO handler in emit.ts)                                                                                                                                                                              |
| Event categories              | 12                              | auth, onboarding, org_structure, scheduling, contracts, operations, haccp, training, communication, system, navigation, channels                                                                                                                                                                |
| Engine action types           | 18                              | `supabase/functions/engine-dispatch/index.ts`                                                                                                                                                                                                                                                   |
| Engine processes (seeded)     | 9                               | onboarding_journey, training_protocol, department_session_lifecycle, session_hook_dispatcher, daily_close, cascade_cost_snapshot, cascade_budget_propagation, signup_onboarding, workspace_setup                                                                                                |
| Session hook types            | 5                               | pre_open, open, scheduled, pre_close, close                                                                                                                                                                                                                                                     |
| AI missions (Stage Engine)    | 6                               | onboarding-interview, landing-demo, mr-botsson, haccp-inspector, shift-assistant, walkai-session. **Note:** These are Stage Engine voice/chat missions, distinct from the simulator's Claude Code swarm agents. The swarm EXERCISES these missions (e.g., Trainee persona talks to mr-botsson). |
| Animated dashboard components | 3                               | ActivityView, ReconciliationView, SwipeReconciliation                                                                                                                                                                                                                                           |
| Notification tables           | 3                               | notification_outbox, notification_preference, channel_notification_policy. **Note:** `send_notification` action type is a stub — handler exists but does not deliver.                                                                                                                           |
| Cascade pure functions        | 9 files                         | resolve-hours, compute-anchored-shift, compute-proposal-preview, evaluate-framework-rules, get-tariff-context, propagate-budget-targets, resolve-tariff-rate, validate-proposal-freshness, build-entity-context                                                                                 |
| Database migrations           | 188 total, ~19 cascade-specific | `supabase/migrations/`                                                                                                                                                                                                                                                                          |

---

## Appendix B: File Structure

```
services/simulator/
  src/
    index.ts                    # Hono server entry
    routes/
      runs.ts                   # Public API routes
      internal.ts               # Internal swarm coordination routes
      health.ts
    engine/
      timeline.ts               # Timeline tick loop
      clock.ts                  # Segmented clock implementation
      dispatcher.ts             # Event dispatch (system_proof: direct, demo: to Director)
    analysis/
      gap-scanner.ts            # Per-dimension coverage scan
      coverage-tracker.ts       # Registry-backed live coverage accounting
    seed/
      seeder.ts                 # Manifest-tracked seeding engine
      cleanup.ts                # Manifest-driven cleanup engine
    scenarios/
      types.ts                  # Scenario type definitions
      sjohuset.ts               # Sjohuset restaurant scenario
    swarm/
      director.ts               # Director agent protocol
      personas.ts               # Persona definitions + auth setup
    sse/
      stream.ts                 # SSE event broadcasting
  test/
    engine.test.ts
    clock.test.ts
    gap-scanner.test.ts
    cleanup.test.ts
  package.json
  tsconfig.json
  Dockerfile

apps/web/src/components/simulation/
  SimulationPanel.tsx           # Floating control panel
  ActIndicator.tsx              # Current act display
  CoverageCounters.tsx          # Live coverage numbers
  EventFeed.tsx                 # Scrolling SSE event log
  TimeWarpControls.tsx          # Speed buttons
  useSimulationStream.ts        # SSE hook

supabase/migrations/
  YYYYMMDDHHMMSS_simulation_schema.sql  # simulation schema + 8 tables
```
