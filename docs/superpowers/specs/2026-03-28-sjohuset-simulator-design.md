---
title: "Sjohuset Simulator — System Proof & Control Panel"
status: draft
updated: 2026-03-28
created: 2026-03-28
module: simulation
tags: [simulator, cascade, testing, platform-admin, sjohuset]
---

# Sjohuset Simulator — System Proof & Control Panel

> Council reviewed 2026-03-28. Verdict: APPROVE WITH CHANGES. ADR-0068.

**Goal:** A dedicated service + platform-admin control panel that exercises every cascade dimension end-to-end for the Sjohuset restaurant pilot. Phase 1 is deterministic system proof. Phase 2 adds AI swarm demo mode.

**Why:** Smartout's cascade (I1 + 6D + 4C + K1a/K1b, 151 telemetry events, 9 engine processes) has never been verified end-to-end. The simulator proves it works by running the same code paths the app uses.

---

## 1. Architecture

### 1.1 Three Layers

| Layer                 | What                                                                                                                                      | Location                                     |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| **Simulator Service** | Hono on port 5013. Timeline engine, gap analysis, seed/cleanup, SSE streaming.                                                            | `services/simulator/`                        |
| **Simulation Schema** | PostgreSQL `simulation` schema. Run metadata, clock segments, manifests, gap reports, timeline events. No RLS — service is auth boundary. | `supabase/migrations/`                       |
| **Control Panel**     | Platform-admin page. Transport bar, cascade gates, event feed, gap report.                                                                | `apps/web/src/app/platform-admin/simulator/` |

### 1.2 Communication

- **Commands:** REST from control panel → simulator service (POST /runs, POST /runs/:id/pause, etc.)
- **Events:** SSE from simulator service → control panel (GET /runs/:id/events)
- **Auth:** JWT validated by Hono middleware. `is_godmode` check on `user_identity`. Service uses `SUPABASE_SERVICE_ROLE_KEY` for all DB operations.
- **UI never queries simulation tables directly.** All reads go through SSE.

### 1.3 Execution Modes

| Mode             | Phase      | Execution                                                                         | What it proves                                        |
| ---------------- | ---------- | --------------------------------------------------------------------------------- | ----------------------------------------------------- |
| **System proof** | 1 (now)    | Deterministic, sequential, max speed. Direct Supabase client calls. No AI agents. | Cascade data flow, telemetry wiring, engine processes |
| **Demo**         | 2 (future) | Real-time, AI swarm, SSE-driven, timewarp.                                        | Full product E2E including UI, auth, notifications    |

---

## 2. Simulation Schema

Dedicated PostgreSQL schema: `simulation`. All enums schema-qualified. All PKs use `{table}_id` convention. All mutable tables have `updated_at` + `set_updated_at()` trigger.

### 2.1 Tables

#### `simulation.run`

| Column         | Type                               | Notes                                                                                  |
| -------------- | ---------------------------------- | -------------------------------------------------------------------------------------- |
| `run_id`       | UUID PK                            |                                                                                        |
| `workspace_id` | UUID FK → workspace                | Nullable initially, MUST be backfilled after workspace creation                        |
| `mode`         | `simulation.run_mode` enum         | `system_proof`, `demo`                                                                 |
| `status`       | `simulation.run_status` enum       | `preflight`, `diagnosing`, `seeding`, `running`, `paused`, `cleanup`, `done`, `failed` |
| `scenario`     | TEXT                               | Scenario identifier (e.g., `sjohuset`)                                                 |
| `speed`        | REAL                               | Current speed multiplier (1.0, 2.0, 4.0, 10.0)                                         |
| `current_act`  | INT                                | Current act number (1-10)                                                              |
| `started_at`   | TIMESTAMPTZ                        | When run transitioned to `running`                                                     |
| `ended_at`     | TIMESTAMPTZ                        |                                                                                        |
| `error`        | TEXT                               | Failure reason if status = failed                                                      |
| `created_at`   | TIMESTAMPTZ NOT NULL DEFAULT now() |                                                                                        |
| `updated_at`   | TIMESTAMPTZ NOT NULL DEFAULT now() | `set_updated_at()` trigger                                                             |

#### `simulation.clock_segment`

Segmented simulation clock. Accumulates simulated time across speed changes and pauses.

| Column             | Type                               | Notes                                 |
| ------------------ | ---------------------------------- | ------------------------------------- |
| `clock_segment_id` | UUID PK                            |                                       |
| `run_id`           | UUID FK → run                      |                                       |
| `segment_index`    | INT                                | Ordering                              |
| `speed`            | REAL                               | Speed during this segment             |
| `wall_start`       | TIMESTAMPTZ                        | Real-time start                       |
| `wall_end`         | TIMESTAMPTZ                        | Real-time end (null if active)        |
| `sim_start`        | INTERVAL                           | Accumulated sim time at segment start |
| `created_at`       | TIMESTAMPTZ NOT NULL DEFAULT now() |                                       |
| `updated_at`       | TIMESTAMPTZ NOT NULL DEFAULT now() |                                       |

**Current sim time** = `sim_start` of active segment + (`now() - wall_start`) \* `speed`.

#### `simulation.run_scope`

Which cascade dimensions this run exercises.

| Column         | Type                               | Notes                                                        |
| -------------- | ---------------------------------- | ------------------------------------------------------------ |
| `run_scope_id` | UUID PK                            |                                                              |
| `run_id`       | UUID FK → run                      |                                                              |
| `domain`       | TEXT                               | Cascade identifier: `I1`, `D1`-`D6`, `C1`-`C4`, `K1a`, `K1b` |
| `scope_action` | `simulation.scope_action` enum     | `seed`, `mutate`, `observe`                                  |
| `enabled`      | BOOLEAN                            |                                                              |
| `created_at`   | TIMESTAMPTZ NOT NULL DEFAULT now() |                                                              |

#### `simulation.seed_manifest`

One row per business record inserted into real app tables. The cleanup ledger.

| Column              | Type                               | Notes                                          |
| ------------------- | ---------------------------------- | ---------------------------------------------- |
| `seed_manifest_id`  | UUID PK                            |                                                |
| `run_id`            | UUID FK → run                      |                                                |
| `target_schema`     | TEXT                               | e.g., `public`, `payroll`                      |
| `target_table`      | TEXT                               | e.g., `profile`, `schedule_shift`              |
| `target_pk`         | UUID                               | PK of inserted row                             |
| `seed_category`     | TEXT                               | e.g., `staff`, `shift`, `session`, `framework` |
| `cascade_dimension` | TEXT                               | Which dimension this serves (e.g., `D2`, `D6`) |
| `created_at`        | TIMESTAMPTZ NOT NULL DEFAULT now() |                                                |

#### `simulation.mutation_manifest`

Tracks changes to pre-existing rows for rollback.

| Column                 | Type                               | Notes                 |
| ---------------------- | ---------------------------------- | --------------------- |
| `mutation_manifest_id` | UUID PK                            |                       |
| `run_id`               | UUID FK → run                      |                       |
| `target_schema`        | TEXT                               |                       |
| `target_table`         | TEXT                               |                       |
| `target_pk`            | UUID                               |                       |
| `column_name`          | TEXT                               | Changed column        |
| `original_value`       | JSONB                              | Value before mutation |
| `mutated_value`        | JSONB                              | Value after mutation  |
| `created_at`           | TIMESTAMPTZ NOT NULL DEFAULT now() |                       |

#### `simulation.gap_report`

Preflight diagnostic. One row per coverage requirement.

| Column              | Type                               | Notes                                             |
| ------------------- | ---------------------------------- | ------------------------------------------------- |
| `gap_report_id`     | UUID PK                            |                                                   |
| `run_id`            | UUID FK → run                      |                                                   |
| `cascade_dimension` | TEXT                               | e.g., `I1`, `D3`, `C1`                            |
| `requirement`       | TEXT                               | Human-readable requirement                        |
| `status`            | `simulation.gap_status` enum       | `present`, `seedable`, `blocking`, `out_of_scope` |
| `detail`            | JSONB                              | What exists, what's missing, what will be seeded  |
| `created_at`        | TIMESTAMPTZ NOT NULL DEFAULT now() |                                                   |

#### `simulation.timeline_event`

The scenario script. Pre-computed, then executed.

| Column              | Type                                    | Notes                                                       |
| ------------------- | --------------------------------------- | ----------------------------------------------------------- |
| `timeline_event_id` | UUID PK                                 |                                                             |
| `run_id`            | UUID FK → run                           |                                                             |
| `act`               | INT                                     | Act number (1-10)                                           |
| `act_name`          | TEXT                                    | e.g., "Day Opens"                                           |
| `event_key`         | TEXT                                    | Unique event identifier within scenario                     |
| `sim_time`          | INTERVAL                                | When this fires in simulation time                          |
| `payload`           | JSONB                                   | Event-specific data                                         |
| `status`            | `simulation.timeline_event_status` enum | `scheduled`, `dispatched`, `completed`, `failed`, `skipped` |
| `dispatched_at`     | TIMESTAMPTZ                             |                                                             |
| `completed_at`      | TIMESTAMPTZ                             |                                                             |
| `error`             | TEXT                                    | Failure reason                                              |
| `created_at`        | TIMESTAMPTZ NOT NULL DEFAULT now()      |                                                             |
| `updated_at`        | TIMESTAMPTZ NOT NULL DEFAULT now()      |                                                             |

### 2.2 Enums (all schema-qualified)

- `simulation.run_mode`: `system_proof`, `demo`
- `simulation.run_status`: `preflight`, `diagnosing`, `seeding`, `running`, `paused`, `cleanup`, `done`, `failed`
- `simulation.scope_action`: `seed`, `mutate`, `observe`
- `simulation.gap_status`: `present`, `seedable`, `blocking`, `out_of_scope`
- `simulation.timeline_event_status`: `scheduled`, `dispatched`, `completed`, `failed`, `skipped`

### 2.3 Auth & RLS

No RLS on simulation tables. The Hono service is the auth boundary:

- `POST /runs` validates JWT + `is_godmode` before accepting
- `GET /runs/:id/events` (SSE) validates JWT + `is_godmode`
- Service uses `SUPABASE_SERVICE_ROLE_KEY` for all DB operations
- System proof mode uses `set_config('app.workspace_id', ...)` for workspace scoping

---

## 3. Simulator Service

### 3.1 Service Structure

```
services/simulator/
  src/
    index.ts              — Hono server, routes, SSE
    startup.ts            — Orphan detection on boot
    routes/
      runs.ts             — POST /runs, GET /runs, GET /runs/:id
      control.ts          — POST /runs/:id/{start,pause,resume,stop,speed}
      events.ts           — GET /runs/:id/events (SSE stream)
    engine/
      gap-analysis.ts     — Preflight cascade dimension scan
      seeder.ts           — Manifest-tracked seeding into real tables
      timeline.ts         — Act execution engine
      cleanup.ts          — Manifest-based rollback + orphan detection
      clock.ts            — Segmented simulation clock
    scenarios/
      sjohuset.ts         — Scenario definition (cast, timeline, expected coverage)
      types.ts            — Shared scenario types
  Dockerfile
  package.json
```

### 3.2 Key Design Decisions

**Seeding strategy:** Direct inserts into cascade dimension tables via Supabase service role client. Uses `supabase/templates/restaurant/` SQL as source for Sjohuset data. Does NOT call bootstrap-cascade EF (unwired). Documented as temporary scaffolding.

**Tariff rates:** Sourced from correct Riksavtalen 2024-2026 values in `supabase/templates/restaurant/contracts.sql`. Never from `hospitality.ts` (incorrect rates: kveldstillegg 56 should be 15.65, helgetillegg 56 should be 29.74).

**Orphan detection:** On startup, service scans for runs with status `running` or `seeding` that have no heartbeat in 10+ minutes. Flags them as `failed` and triggers cleanup.

**Telemetry:** Simulator emits lifecycle events via `emit()`: `simulation run_started`, `simulation act_completed`, `simulation run_completed`, `simulation run_failed`, `simulation cleanup_completed`. Registered in `packages/telemetry/src/registry.ts`.

### 3.3 Docker Compose

Entry in `infra/docker-compose.yml`:

```yaml
simulator:
  build:
    context: ../
    dockerfile: services/simulator/Dockerfile
  ports:
    - "5013:5013"
  environment:
    - PORT=5013
    - SUPABASE_URL=${SUPABASE_URL}
    - SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY}
  healthcheck:
    test: ["CMD", "curl", "-f", "http://localhost:5013/health"]
    interval: 30s
    timeout: 10s
    retries: 3
  networks:
    - smartout-internal
```

### 3.4 API Endpoints

| Method | Path                | Auth             | Purpose                                |
| ------ | ------------------- | ---------------- | -------------------------------------- |
| GET    | `/health`           | None             | Health check                           |
| POST   | `/runs`             | JWT + is_godmode | Create new simulation run              |
| GET    | `/runs`             | JWT + is_godmode | List runs                              |
| GET    | `/runs/:id`         | JWT + is_godmode | Get run details                        |
| POST   | `/runs/:id/start`   | JWT + is_godmode | Start/resume run                       |
| POST   | `/runs/:id/pause`   | JWT + is_godmode | Pause run                              |
| POST   | `/runs/:id/stop`    | JWT + is_godmode | Stop and trigger cleanup               |
| POST   | `/runs/:id/speed`   | JWT + is_godmode | Change speed (body: { speed: number }) |
| GET    | `/runs/:id/events`  | JWT + is_godmode | SSE event stream                       |
| GET    | `/runs/:id/gaps`    | JWT + is_godmode | Get gap report                         |
| POST   | `/runs/:id/cleanup` | JWT + is_godmode | Manual cleanup trigger                 |

---

## 4. Scenario: Sjohuset (10 Acts)

### 4.1 Restaurant Profile

- **Name:** Sjohuset (seafood restaurant, Bergen)
- **Departments:** 3 core (Kjokken, Sal, Bar) + 4 supporting (Catering, Renhold, Levering, Event)
- **Staff:** 50 employees (25 native, 10 foreign, 5 minors, 4 pensioners, 6 freelancers)
- **Season:** "Varsesong 2026" — NOK 8.5M revenue target, 32% labor
- **Shifts:** ~2,500 over 91 days

### 4.2 Acts (System Proof Mode)

| Act | Sim Time            | What Happens                                                              | Dimensions Exercised |
| --- | ------------------- | ------------------------------------------------------------------------- | -------------------- |
| 1   | Mon 06:00-09:00     | Bootstrap workspace, seed departments, locations, I1 template data        | I1, D1, D5           |
| 2   | Mon 09:00-13:00     | Create 50 employees, contracts, payroll profiles, team assignments        | D2, D3               |
| 3   | Mon 13:00-17:00     | Activate season, set budget, propagate day/hour factors                   | D4                   |
| 4   | Tue 08:00-16:00     | Create and publish shifts, framework rule evaluation, violation detection | D6, D3, C4           |
| 5   | Wed 06:00-10:00     | Session lifecycle: upcoming → active, hooks fire, tasks materialize       | D6                   |
| 6   | Wed 10:00-15:00     | Protocol assignments, procedure step completions, knowledge tests         | K1b, D2              |
| 7   | Wed 15:00-23:00     | Clock-ins, break tracking, late arrival deviation, shift supplements      | D6, C3               |
| 8   | Wed 23:00-Thu 01:00 | Daily close: pending_signoff, reconciliation, cost snapshot               | D6, C1               |
| 9   | Thu 08:00-12:00     | Guardian sweep, signal generation, escalation detection                   | C4                   |
| 10  | Thu-Sun             | Acts 5-8 repeat with variation. Final gap report.                         | All                  |

### 4.3 Expected Coverage

After a full run, the gap report should show:

- 13/13 cascade dimensions exercised
- All seeded telemetry events confirmed in `engine_event` / `activity_trail`
- All engine processes triggered at least once
- Zero orphan data after cleanup

---

## 5. Platform-Admin Control Panel

### 5.1 Layout (2-column)

```
+--[Transport Bar — 56px sticky, full width]-------------------+
| Status Pill | Stop Pause Play | 1x 2x 4x 10x MAX | Clocks  |
+--[Content — flex]--------------------------------------------+
| [Gates Rail 260px]  | [Main Area — flex-1]                   |
| I1                  | [Gap Report — collapsible banner]      |
| ───                 | [Event Feed — virtualized scroll]      |
| D1 D2 D3            |                                        |
| D4 D5 D6            |                                        |
| ───                 |                                        |
| C1 C2 C3 C4         |                                        |
| ───                 |                                        |
| K1a K1b             |                                        |
+--------------------------------------------------------------|
```

### 5.2 Transport Bar (56px)

Three sections:

- **Left:** Status pill (badge with pulsing dot during running/seeding) + act progress ("Act 5/10 — Day Opens")
- **Center:** Transport buttons (Play, Pause, Stop — icon-only, ghost variant, 36px) + speed warper (segmented control pill bar: 1x | 2x | 4x | 10x | MAX)
- **Right:** Dual clock display (Sim: "Wed 14:32" + Wall: "0:04:23") in Geist Mono

### 5.3 Cascade Gates (left rail, 260px)

Grouped by type with muted section headings (11px uppercase):

- **Bootstrap:** I1
- **Dimensions:** D1-D6
- **Control Planes:** C1-C4
- **Knowledge:** K1a, K1b

Each gate: 6px status dot + label (13px) + compact switch (16px height). Gates lock during run (reduced opacity on switches, dots still animate).

**Status dot colors** (CSS variables):

- Not started: `text-muted-foreground`
- Seeding: `text-primary` (pulsing)
- Running: teal accent (pulsing)
- Passed: `text-success` (solid)
- Failed: `text-destructive` (solid)

### 5.4 Event Feed (center, virtualized)

Virtualized list (react-window or similar). Each row:

- Timestamp (Geist Mono 12px, `text-muted-foreground`)
- Dimension badge (4 color families, not 13 unique colors)
- Event key (Geist Sans 13px)
- Status badge (scheduled/dispatched/completed/failed)

**4 color families:**

- Warm amber: D1, D2 (structural/people)
- Teal/cyan: D3, D4 (analytical)
- Soft violet: D5, D6 (operational)
- Muted: I1, C1-C4, K1a/K1b (system)

Auto-scroll with "pin to bottom" toggle. Click expands event details inline (AnimatePresence + layout animation).

### 5.5 Gap Report (collapsible banner)

Shows during preflight/diagnosing phase. Per-dimension mini-cards:

- Present (green) / Seedable (blue) / Blocking (red) / Out of scope (gray)
- Summary: "14/17 requirements met, 3 will be seeded"
- Auto-collapses when run starts (AnimatePresence exit, 250ms min)

### 5.6 Typography

Geist Sans + Geist Mono only. No Instrument Serif (technical tool, not marketing).

### 5.7 Motion (Nordic Split)

- Transport button press: `whileTap scale: 0.94`, spring stiffness 400
- Speed warper pill: `layoutId` with spring stiffness 35, damping 22
- Event feed entrance: staggered y:8→0, opacity 0→1, 150ms, stagger 30ms
- Event expand: layout animation, spring stiffness 300, damping 28
- Gate status dot: color crossfade 300ms
- Gap report collapse: AnimatePresence exit opacity+height, 250ms
- Status pill pulse: `animate opacity [0.6, 1, 0.6]`, 1.5s repeat during running

### 5.8 Accessibility

- All transport buttons: `aria-label`
- Speed warper: `role="radiogroup"` + `aria-label="Simulation speed"`
- Event feed: `aria-live="polite"` (throttled — announce state changes, not every event)
- Gate toggles: `aria-label` with dimension name
- Color never sole indicator — paired with text/icon
- `prefers-reduced-motion`: disable pulsing, stagger, use instant transitions

---

## 6. Phase Scope

### Phase 1 (this implementation)

- Migration: `simulation` schema + 7 tables + 5 enums
- Service: `services/simulator/` — Hono on 5013, health, gap analysis, seed/cleanup, timeline execution (system proof only)
- Docker Compose entry in `infra/docker-compose.yml`
- Platform-admin page: `/platform-admin/simulator/` — transport bar, cascade gates, event feed, gap report
- Sidebar nav entry under "System"
- CLI: `pnpm simulate:test` for CI
- ADR-0068 written and accepted
- Telemetry: 5 simulator lifecycle events registered

### Phase 2 (future — NOT in this implementation)

- `simulation.agent_session` table
- AI swarm orchestration (Director + 5 personas)
- Demo mode with real-time timewarp
- SSE-driven floating overlay panel for dashboard observation
- Botsson/Stage Engine conversation exercises
- Emergent data cleanup phase

---

## 7. Non-Functional Requirements

- System proof mode completes in < 60 seconds for Sjohuset scenario
- Cleanup leaves zero orphan rows in all seeded tables
- Gap report generates in < 5 seconds
- SSE event stream latency < 100ms from event completion to UI display
- Control panel cold load < 3s (platform-admin performance gate)
