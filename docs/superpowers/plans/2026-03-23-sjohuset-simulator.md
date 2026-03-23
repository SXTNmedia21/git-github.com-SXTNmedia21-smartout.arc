---
title: "Sjohuset Simulator — Implementation Plan"
status: draft
updated: 2026-03-23
created: 2026-03-23
module: simulation
tags: [cascade, testing, simulation, microservice, plan]
---

# Sjohuset Simulator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Hono microservice that runs a 3-hour real-time restaurant simulation exercising every cascade dimension, with two modes: deterministic system proof (CI) and live demo (AI swarm + dashboard UI).

**Architecture:** Hono service on port 5013 with dedicated `simulation` PostgreSQL schema as control plane. Business data seeded into real app tables, tracked via manifests for surgical cleanup. Segmented clock for timewarp. SSE for real-time UI updates. Typed TypeScript scenario config.

**Tech Stack:** Hono, TypeScript, Supabase (PostgreSQL + client), Vitest, SSE (EventSource), Framer Motion (UI panel)

**Spec:** `docs/superpowers/specs/2026-03-23-sjohuset-simulator-design.md`
**ADR:** `docs/decisions/0058-simulation-schema-and-simulator-service.md`

---

## Phase Overview

| Phase | Name                 | Tasks       | Dependencies | Can Parallelize                          |
| ----- | -------------------- | ----------- | ------------ | ---------------------------------------- |
| 1     | Foundation           | Tasks 1-4   | None         | Tasks 2-4 parallel after Task 1          |
| 2     | Core Engine          | Tasks 5-9   | Phase 1      | Tasks 5-8 all parallel, Task 9 after any |
| 3     | API + System Proof   | Tasks 10-12 | Phase 2      | Task 10 alone, then 11-12 parallel       |
| 4     | Floating UI Panel    | Tasks 13-14 | Phase 3      | Independent from Phase 5                 |
| 5     | AI Swarm (Demo Mode) | Tasks 15-16 | Phase 3      | Independent from Phase 4                 |
| 6     | Integration + Polish | Task 17     | Phases 4-5   | Sequential                               |

---

## Phase 1: Foundation

### Task 1: Simulation Schema Migration

**Files:**

- Create: `supabase/migrations/20260423100000_simulation_schema.sql`

**IMPORTANT:** Timestamp must sort AFTER the latest existing migration (`20260422400500`). Do NOT use `20260323` — it would sort before cascade migrations.

This is the prerequisite for everything else. Creates the `simulation` schema with all 9 tables.

- [ ] **Step 1: Write the migration SQL**

```sql
-- supabase/migrations/20260423100000_simulation_schema.sql

-- Create simulation schema
CREATE SCHEMA IF NOT EXISTS simulation;

-- Enums
CREATE TYPE simulation.run_mode AS ENUM ('system_proof', 'demo');
CREATE TYPE simulation.run_status AS ENUM (
  'preflight', 'diagnosing', 'seeding', 'running', 'paused', 'cleanup', 'done', 'failed'
);
CREATE TYPE simulation.scope_action AS ENUM ('seed', 'mutate', 'observe');
CREATE TYPE simulation.gap_status AS ENUM ('present', 'seedable', 'blocking', 'out_of_scope');
CREATE TYPE simulation.event_lifecycle AS ENUM (
  'scheduled', 'dispatched', 'acknowledged', 'completed', 'failed', 'skipped'
);
CREATE TYPE simulation.agent_status AS ENUM ('idle', 'active', 'error', 'done');
CREATE TYPE simulation.cleanup_phase AS ENUM ('mutations', 'seeds', 'temp_workspace', 'schema_cleanup');
CREATE TYPE simulation.job_status AS ENUM ('pending', 'running', 'completed', 'failed');

-- 1. simulation.run
CREATE TABLE simulation.run (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES public.workspace(id),
  mode simulation.run_mode NOT NULL,
  status simulation.run_status NOT NULL DEFAULT 'preflight',
  scenario text NOT NULL,
  speed real NOT NULL DEFAULT 1.0,
  scope text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  ended_at timestamptz
);

-- 2. simulation.clock_segment
CREATE TABLE simulation.clock_segment (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES simulation.run(id) ON DELETE CASCADE,
  segment_index int NOT NULL,
  speed real NOT NULL,
  wall_start timestamptz NOT NULL DEFAULT now(),
  wall_end timestamptz,
  sim_start interval NOT NULL DEFAULT '0'::interval,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 3. simulation.run_scope
CREATE TABLE simulation.run_scope (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES simulation.run(id) ON DELETE CASCADE,
  domain text NOT NULL,
  scope_action simulation.scope_action NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 4. simulation.seed_manifest
CREATE TABLE simulation.seed_manifest (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES simulation.run(id) ON DELETE CASCADE,
  target_schema text NOT NULL,
  target_table text NOT NULL,
  target_pk uuid NOT NULL,
  seed_category text NOT NULL,
  cascade_dimension text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 5. simulation.mutation_manifest
CREATE TABLE simulation.mutation_manifest (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES simulation.run(id) ON DELETE CASCADE,
  target_schema text NOT NULL,
  target_table text NOT NULL,
  target_pk uuid NOT NULL,
  column_name text NOT NULL,
  original_value jsonb NOT NULL,
  mutated_value jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 6. simulation.gap_report
CREATE TABLE simulation.gap_report (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES simulation.run(id) ON DELETE CASCADE,
  cascade_dimension text NOT NULL,
  requirement text NOT NULL,
  status simulation.gap_status NOT NULL,
  detail jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 7. simulation.timeline_event
CREATE TABLE simulation.timeline_event (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES simulation.run(id) ON DELETE CASCADE,
  act int NOT NULL,
  act_name text NOT NULL,
  event_key text NOT NULL,
  sim_time interval NOT NULL,
  agent_persona text,
  payload jsonb NOT NULL DEFAULT '{}',
  status simulation.event_lifecycle NOT NULL DEFAULT 'scheduled',
  dispatched_at timestamptz,
  acknowledged_at timestamptz,
  completed_at timestamptz,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 8. simulation.agent_session
CREATE TABLE simulation.agent_session (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES simulation.run(id) ON DELETE CASCADE,
  persona text NOT NULL,
  display_name text NOT NULL,
  auth_mode text NOT NULL,
  profile_id uuid,
  status simulation.agent_status NOT NULL DEFAULT 'idle',
  current_task text,
  last_heartbeat timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 9. simulation.cleanup_job
CREATE TABLE simulation.cleanup_job (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES simulation.run(id) ON DELETE CASCADE,
  phase simulation.cleanup_phase NOT NULL,
  status simulation.job_status NOT NULL DEFAULT 'pending',
  rows_processed int NOT NULL DEFAULT 0,
  rows_failed int NOT NULL DEFAULT 0,
  errors jsonb NOT NULL DEFAULT '[]',
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_clock_segment_run ON simulation.clock_segment(run_id, segment_index);
CREATE INDEX idx_seed_manifest_run ON simulation.seed_manifest(run_id);
CREATE INDEX idx_seed_manifest_target ON simulation.seed_manifest(target_schema, target_table, target_pk);
CREATE INDEX idx_mutation_manifest_run ON simulation.mutation_manifest(run_id);
CREATE INDEX idx_timeline_event_run ON simulation.timeline_event(run_id, sim_time);
CREATE INDEX idx_timeline_event_status ON simulation.timeline_event(run_id, status);
CREATE INDEX idx_gap_report_run ON simulation.gap_report(run_id);

-- updated_at triggers (reuse existing set_updated_at function)
CREATE TRIGGER set_updated_at BEFORE UPDATE ON simulation.run
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON simulation.clock_segment
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON simulation.run_scope
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON simulation.seed_manifest
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON simulation.mutation_manifest
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON simulation.gap_report
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON simulation.timeline_event
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON simulation.agent_session
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON simulation.cleanup_job
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
```

- [ ] **Step 2: Apply migration to local Supabase**

Run: `docker exec -i $(docker ps -q -f name=supabase_db) psql -U postgres < supabase/migrations/20260423100000_simulation_schema.sql`
Expected: No errors. Tables created in `simulation` schema.

- [ ] **Step 3: Verify tables exist**

Run: `docker exec -i $(docker ps -q -f name=supabase_db) psql -U postgres -c "\dt simulation.*"`
Expected: 9 tables listed.

- [ ] **Step 4: Regenerate database types**

Run: `npx supabase gen types typescript --local > packages/supabase/src/database.types.ts`
Expected: File regenerated (simulation schema types may not appear — that's OK, simulation is accessed via service role raw queries).

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260423100000_simulation_schema.sql packages/supabase/src/database.types.ts
git commit -m "feat(simulation): add simulation schema migration (9 tables, 8 enums)

ADR-0058: Dedicated simulation schema for cascade system testing.
Platform-admin-only, no RLS. Manifest-based cleanup control plane.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Service Scaffold

**Files:**

- Create: `services/simulator/package.json`
- Create: `services/simulator/tsconfig.json`
- Create: `services/simulator/src/index.ts`
- Create: `services/simulator/src/routes/health.ts`
- Create: `services/simulator/src/lib/supabase.ts`
- Modify: `pnpm-workspace.yaml` (add `services/simulator`)

Sets up the Hono service following stage-engine patterns.

- [ ] **Step 1: Create package.json**

Follow stage-engine pattern. ESM module, tsx watch for dev, tsc for build.

```json
{
  "name": "@smartout/simulator",
  "version": "0.0.1",
  "type": "module",
  "scripts": {
    "dev": "tsx watch --env-file=.env src/index.ts",
    "build": "tsc && node ../../scripts/fix-esm-imports.mjs",
    "start": "node dist/index.js",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "hono": "^4.7.0",
    "@hono/node-server": "^1.13.0",
    "@hono/zod-validator": "^0.4.0",
    "@supabase/supabase-js": "^2.49.1",
    "zod": "^3.24.2"
  },
  "devDependencies": {
    "tsx": "^4.19.0",
    "typescript": "^5.7.2",
    "vitest": "^3.0.0",
    "@types/node": "^22.0.0"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

Copy stage-engine's inline tsconfig exactly (do NOT extend shared base.json):

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "resolveJsonModule": true
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 3: Create vitest.config.ts**

```typescript
// services/simulator/vitest.config.ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
  },
});
```

- [ ] **Step 4: Create Supabase client helper**

```typescript
// services/simulator/src/lib/supabase.ts
import { createClient } from "@supabase/supabase-js";

/**
 * Service role client for simulation schema access and seeding.
 * Platform-admin-only — never expose to UI or swarm agents.
 */
export function createSimulatorClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required");
  }

  return createClient(url, key, {
    auth: { persistSession: false },
  });
}
```

- [ ] **Step 4: Create health route**

```typescript
// services/simulator/src/routes/health.ts
import { Hono } from "hono";

export const healthRoutes = new Hono();

healthRoutes.get("/health", (c) => {
  return c.json({ status: "ok", service: "simulator", port: 5013 });
});
```

- [ ] **Step 5: Create main entry**

```typescript
// services/simulator/src/index.ts
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { healthRoutes } from "./routes/health.js";

const app = new Hono();

app.use("*", cors());
app.route("/", healthRoutes);

const port = Number(process.env.SIMULATOR_PORT ?? 5013);

serve({ fetch: app.fetch, port }, () => {
  console.log(`[simulator] Running on port ${port}`);
});

export default app;
```

- [ ] **Step 6: Add to pnpm workspace**

Verify `services/simulator` is covered by existing glob in `pnpm-workspace.yaml` (likely `services/*`). If not, add it.

- [ ] **Step 7: Install dependencies and verify**

Run: `cd services/simulator && pnpm install && pnpm dev &`
Wait 3 seconds, then: `curl http://localhost:5013/health`
Expected: `{"status":"ok","service":"simulator","port":5013}`
Kill the dev server.

- [ ] **Step 8: Commit**

```bash
git add services/simulator/ pnpm-workspace.yaml pnpm-lock.yaml
git commit -m "feat(simulation): scaffold simulator Hono service on port 5013

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Segmented Clock (Pure Function, TDD)

**Files:**

- Create: `services/simulator/src/engine/clock.ts`
- Create: `services/simulator/src/engine/clock.test.ts`

The segmented clock is a pure function — no DB, no IO. Perfect for TDD.

- [ ] **Step 1: Write the failing tests**

```typescript
// services/simulator/src/engine/clock.test.ts
import { describe, it, expect } from "vitest";
import { currentSimTime, createSegment, closeSegment, type ClockSegment } from "./clock.js";

describe("currentSimTime", () => {
  it("returns zero for empty segments", () => {
    expect(currentSimTime([])).toBe(0);
  });

  it("computes sim time for a single active segment at 1x", () => {
    const now = Date.now();
    const seg = createSegment(0, 1.0, now - 60_000, 0); // 60s ago, speed 1x
    // 60 real seconds * 1.0 speed = 60,000 ms sim time
    const result = currentSimTime([seg], now);
    expect(result).toBeCloseTo(60_000, -2);
  });

  it("computes sim time for a single active segment at 54x (base compression)", () => {
    const now = Date.now();
    const seg = createSegment(0, 54.0, now - 60_000, 0);
    // 60 real seconds * 54 speed = 3,240,000 ms sim time = 54 sim minutes
    const result = currentSimTime([seg], now);
    expect(result).toBeCloseTo(3_240_000, -2);
  });

  it("accumulates across closed + active segments", () => {
    const now = Date.now();
    const seg1 = closeSegment(createSegment(0, 1.0, now - 120_000, 0), now - 60_000);
    // seg1: 60 real seconds * 1.0 = 60,000 ms sim
    const seg2 = createSegment(1, 2.0, now - 60_000, 60_000);
    // seg2: 60 real seconds * 2.0 = 120,000 ms sim
    const result = currentSimTime([seg1, seg2], now);
    expect(result).toBeCloseTo(180_000, -2); // 60k + 120k
  });

  it("handles paused state (no active segment)", () => {
    const now = Date.now();
    const seg1 = closeSegment(createSegment(0, 1.0, now - 120_000, 0), now - 60_000);
    const result = currentSimTime([seg1], now);
    expect(result).toBeCloseTo(60_000, -2); // Only closed segment counts
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd services/simulator && pnpm test -- src/engine/clock.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the clock**

```typescript
// services/simulator/src/engine/clock.ts

export interface ClockSegment {
  segmentIndex: number;
  speed: number;
  wallStart: number; // ms epoch
  wallEnd: number | null; // null = active
  simStart: number; // accumulated sim ms at segment start
}

/** Create a new clock segment */
export function createSegment(
  index: number,
  speed: number,
  wallStart: number,
  simStart: number,
): ClockSegment {
  return { segmentIndex: index, speed, wallStart, wallEnd: null, simStart };
}

/** Close a segment (pause or speed change) */
export function closeSegment(segment: ClockSegment, wallEnd: number): ClockSegment {
  return { ...segment, wallEnd };
}

/**
 * Compute current simulation time in milliseconds from a chain of segments.
 * The last segment with wallEnd=null is the active segment.
 */
export function currentSimTime(segments: ClockSegment[], now: number = Date.now()): number {
  if (segments.length === 0) return 0;

  let total = 0;

  for (const seg of segments) {
    const wallEnd = seg.wallEnd ?? now;
    const wallDuration = wallEnd - seg.wallStart;
    const simDuration = wallDuration * seg.speed;
    total = seg.simStart + simDuration;
  }

  // Return the last segment's accumulated time
  // (simStart already includes all prior segments)
  return total;
}

/** Format sim milliseconds as "Day HH:MM" in a simulated week starting Mon 06:00 */
export function formatSimTime(simMs: number): string {
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const baseHour = 6; // Week starts Mon 06:00
  const totalMinutes = Math.floor(simMs / 60_000) + baseHour * 60;
  const dayIndex = Math.min(Math.floor(totalMinutes / (24 * 60)), 6);
  const minutesInDay = totalMinutes % (24 * 60);
  const hours = Math.floor(minutesInDay / 60);
  const minutes = minutesInDay % 60;
  return `${days[dayIndex]} ${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd services/simulator && pnpm test -- src/engine/clock.test.ts`
Expected: All 4 tests PASS.

- [ ] **Step 5: Add formatSimTime tests**

```typescript
// Append to clock.test.ts
describe("formatSimTime", () => {
  it("formats 0ms as Mon 06:00 (week start)", () => {
    expect(formatSimTime(0)).toBe("Mon 06:00");
  });

  it("formats 1 sim hour as Mon 07:00", () => {
    expect(formatSimTime(60 * 60 * 1000)).toBe("Mon 07:00");
  });

  it("formats 24 sim hours as Tue 06:00", () => {
    expect(formatSimTime(24 * 60 * 60 * 1000)).toBe("Tue 06:00");
  });
});
```

- [ ] **Step 6: Run all clock tests**

Run: `cd services/simulator && pnpm test -- src/engine/clock.test.ts`
Expected: All 7 tests PASS.

- [ ] **Step 7: Commit**

```bash
git add services/simulator/src/engine/clock.ts services/simulator/src/engine/clock.test.ts
git commit -m "feat(simulation): implement segmented clock with TDD (7 tests)

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Scenario Types + Sjohuset Config

**Files:**

- Create: `services/simulator/src/scenarios/types.ts`
- Create: `services/simulator/src/scenarios/sjohuset.ts`
- Create: `services/simulator/src/scenarios/sjohuset.test.ts`

Typed scenario definition. The Sjohuset restaurant config with 12 personas, 3 departments, 10 acts.

- [ ] **Step 1: Define scenario types**

```typescript
// services/simulator/src/scenarios/types.ts

export interface SimulationScenario {
  id: string;
  name: string;
  description: string;
  locale: "nb-NO";
  restaurant: RestaurantConfig;
  cast: PersonaConfig[];
  acts: ActConfig[];
  coverage: CoverageExpectation;
}

export interface RestaurantConfig {
  name: string;
  type: "restaurant";
  city: string;
  orgNumber: string;
  departments: DepartmentConfig[];
  operatingHours: OperatingHoursConfig;
  season: SeasonConfig;
}

export interface DepartmentConfig {
  name: string;
  type: string;
  offsetMinutes: number;
  positions: string[];
}

export interface OperatingHoursConfig {
  weekday: { open: string; close: string };
  weekend: { open: string; close: string };
}

export interface SeasonConfig {
  name: string;
  startDate: string;
  endDate: string;
  revenueTarget: number;
  laborPercent: number;
  dayFactors: Record<string, number>;
  peakHours: { start: number; end: number; factor: number };
}

export interface PersonaConfig {
  persona: string;
  displayName: string;
  role: "owner" | "admin" | "manager" | "employee";
  department?: string;
  profileStatus: "active" | "trainee";
  contractType: "full_time" | "part_time" | "extra";
  swarmAgent: boolean;
  email: string;
}

export interface ActConfig {
  act: number;
  name: string;
  simTimeStartMs: number;
  simTimeEndMs: number;
  events: TimelineEventConfig[];
  expectedTelemetry: string[];
  expectedDimensions: string[];
}

export interface TimelineEventConfig {
  eventKey: string;
  simTimeMs: number;
  agentPersona: string | null;
  description: string;
  payload: Record<string, unknown>;
}

export interface CoverageExpectation {
  telemetryEvents: string[];
  actionTypes: string[];
  engineProcesses: string[];
  sessionHookTypes: string[];
  missions: string[];
  cascadeDimensions: string[];
}
```

- [ ] **Step 2: Create Sjohuset scenario**

Create `services/simulator/src/scenarios/sjohuset.ts` with:

- 3 departments (Kjokken, Sal, Bar)
- 12 personas (5 with swarm agents)
- 10 acts with timeline events
- Coverage expectations using space-separated telemetry names from registry

This file will be ~200 lines. The key content:

- Restaurant config with Bergen operating hours (11:00-23:00 weekday, 11:00-01:00 weekend)
- Cast of 12 with realistic Norwegian names and roles
- 10 acts with `simTimeStartMs` computed from base offset (Mon 06:00 = 0ms)
- Coverage: filtered subset of 151 telemetry events relevant to the scenario

- [ ] **Step 3: Write validation test**

```typescript
// services/simulator/src/scenarios/sjohuset.test.ts
import { describe, it, expect } from "vitest";
import { sjohuset } from "./sjohuset.js";

describe("sjohuset scenario", () => {
  it("has 3 departments", () => {
    expect(sjohuset.restaurant.departments).toHaveLength(3);
  });

  it("has 12 cast members", () => {
    expect(sjohuset.cast).toHaveLength(12);
  });

  it("has 5 swarm agents + 1 director = 6 total", () => {
    expect(sjohuset.cast.filter((c) => c.swarmAgent)).toHaveLength(5);
  });

  it("has 10 acts", () => {
    expect(sjohuset.acts).toHaveLength(10);
  });

  it("acts are in chronological order", () => {
    for (let i = 1; i < sjohuset.acts.length; i++) {
      expect(sjohuset.acts[i].simTimeStartMs).toBeGreaterThanOrEqual(
        sjohuset.acts[i - 1].simTimeStartMs,
      );
    }
  });

  it("telemetry events use space-separated names (not dotted)", () => {
    for (const event of sjohuset.coverage.telemetryEvents) {
      expect(event).not.toContain(".");
      expect(event).toContain(" ");
    }
  });

  it("has at least 2 trainees", () => {
    expect(sjohuset.cast.filter((c) => c.profileStatus === "trainee")).toHaveLength(2);
  });
});
```

- [ ] **Step 4: Run tests**

Run: `cd services/simulator && pnpm test -- src/scenarios/sjohuset.test.ts`
Expected: All 7 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add services/simulator/src/scenarios/
git commit -m "feat(simulation): add scenario types and Sjohuset restaurant config

12 personas, 3 departments, 10 acts, registry-matched telemetry events.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Phase 2: Core Engine

### Task 5: Gap Analysis Engine (TDD)

**Files:**

- Create: `services/simulator/src/analysis/gap-scanner.ts`
- Create: `services/simulator/src/analysis/gap-scanner.test.ts`

Scans a workspace and reports what data exists, what's missing, and what's seedable — per cascade dimension.

- [ ] **Step 1: Write failing tests**

Test against a mock Supabase client that returns empty results (no data = everything is seedable).

```typescript
// services/simulator/src/analysis/gap-scanner.test.ts
import { describe, it, expect } from "vitest";
import { scanWorkspaceGaps, type GapResult } from "./gap-scanner.js";

// Mock Supabase client that returns empty arrays for all queries
const emptyClient = {
  from: () => ({
    select: () => ({
      eq: () => ({ data: [], error: null }),
      data: [],
      error: null,
    }),
  }),
} as unknown as SupabaseClient;

const workspaceId = "00000000-0000-0000-0000-000000000001";

describe("scanWorkspaceGaps", () => {
  it("reports all dimensions as seedable for empty workspace", async () => {
    const results = await scanWorkspaceGaps(emptyClient, workspaceId);
    const seedable = results.filter((r) => r.status === "seedable");
    expect(seedable.length).toBeGreaterThan(0);
  });

  it("checks all cascade dimensions", async () => {
    const results = await scanWorkspaceGaps(emptyClient, workspaceId);
    const dimensions = new Set(results.map((r) => r.cascadeDimension));
    expect(dimensions).toContain("I1");
    expect(dimensions).toContain("D1");
    expect(dimensions).toContain("D2");
    expect(dimensions).toContain("D3");
    expect(dimensions).toContain("D4");
    expect(dimensions).toContain("D6");
    expect(dimensions).toContain("C4");
  });

  it("returns GapResult shape with required fields", async () => {
    const results = await scanWorkspaceGaps(emptyClient, workspaceId);
    for (const r of results) {
      expect(r).toHaveProperty("cascadeDimension");
      expect(r).toHaveProperty("requirement");
      expect(r).toHaveProperty("status");
      expect(r).toHaveProperty("detail");
    }
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd services/simulator && pnpm test -- src/analysis/gap-scanner.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement gap scanner**

Create `gap-scanner.ts` with one check function per dimension bucket. Each function queries the workspace for required data and returns `present`/`seedable`/`blocking`/`out_of_scope`.

See spec Section 4.1 for the full list of tables per dimension.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd services/simulator && pnpm test -- src/analysis/gap-scanner.test.ts`
Expected: All 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add services/simulator/src/analysis/
git commit -m "feat(simulation): implement gap analysis engine with TDD

Scans workspace per cascade dimension, classifies gaps as
present/seedable/blocking/out_of_scope.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Seed Engine + Manifest Tracking (TDD)

**Files:**

- Create: `services/simulator/src/seed/seeder.ts`
- Create: `services/simulator/src/seed/seeder.test.ts`
- Create: `services/simulator/src/seed/sjohuset-seed.ts`

Every insert is tracked in `simulation.seed_manifest`. Every mutation to existing rows is tracked in `simulation.mutation_manifest`.

- [ ] **Step 1: Write failing tests for manifest tracking**

```typescript
// services/simulator/src/seed/seeder.test.ts
import { describe, it, expect, vi } from "vitest";
import { TrackedSeeder } from "./seeder.js";

describe("TrackedSeeder", () => {
  it("records insert in seed_manifest", async () => {
    const insertedRows: any[] = [];
    const mockClient = {
      from: (table: string) => ({
        insert: (data: any) => {
          insertedRows.push({ table, data });
          return { data: [{ id: "fake-uuid" }], error: null };
        },
        select: () => ({ eq: () => ({ data: [], error: null }) }),
      }),
    } as unknown as SupabaseClient;

    const seeder = new TrackedSeeder(mockClient, "run-123");
    await seeder.insert(
      "public",
      "department",
      {
        id: "dept-1",
        name: "Kjokken",
        workspace_id: "ws-1",
      },
      "staff",
      "D1",
    );

    // Should have inserted into both the target table AND seed_manifest
    const manifestInsert = insertedRows.find((r) => r.table === "simulation.seed_manifest");
    expect(manifestInsert).toBeDefined();
    expect(manifestInsert.data.target_table).toBe("department");
    expect(manifestInsert.data.cascade_dimension).toBe("D1");
  });

  it("records mutation in mutation_manifest", async () => {
    const insertedRows: any[] = [];
    const mockClient = {
      from: (table: string) => ({
        insert: (data: any) => {
          insertedRows.push({ table, data });
          return { data: [data], error: null };
        },
        update: (data: any) => ({
          eq: () => ({ data: [data], error: null }),
        }),
        select: () => ({
          eq: () => ({
            single: () => ({
              data: { name: "Old Name" },
              error: null,
            }),
          }),
        }),
      }),
    } as unknown as SupabaseClient;

    const seeder = new TrackedSeeder(mockClient, "run-123");
    await seeder.mutate("public", "workspace", "ws-1", "name", "New Name");

    const manifestInsert = insertedRows.find((r) => r.table === "simulation.mutation_manifest");
    expect(manifestInsert).toBeDefined();
    expect(manifestInsert.data.original_value).toBe('"Old Name"');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

- [ ] **Step 3: Implement TrackedSeeder**

The `TrackedSeeder` class wraps a Supabase client. Every `insert()` also writes to `simulation.seed_manifest`. Every `mutate()` reads the original value first, writes it to `simulation.mutation_manifest`, then performs the update.

- [ ] **Step 4: Run tests to verify they pass**

- [ ] **Step 5: Create Sjohuset seed data**

`sjohuset-seed.ts` — Uses `TrackedSeeder` to create all Sjohuset data for each dimension. This file imports the scenario config and creates the actual rows (departments, profiles, contracts, etc.).

- [ ] **Step 6: Commit**

```bash
git add services/simulator/src/seed/
git commit -m "feat(simulation): implement tracked seeder with manifest logging

Every insert tracked in seed_manifest, every mutation in mutation_manifest.
Sjohuset seed data for all cascade dimensions.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: Cleanup Engine (TDD)

**Files:**

- Create: `services/simulator/src/seed/cleanup.ts`
- Create: `services/simulator/src/seed/cleanup.test.ts`

Manifest-driven cleanup. Mutations restored first, then seeds deleted in reverse FK order.

- [ ] **Step 1: Write failing tests**

Test: mutations are restored (UPDATE with original_value), seeds are deleted in reverse order, FK violations are retried.

- [ ] **Step 2: Run tests to verify they fail**

- [ ] **Step 3: Implement cleanup engine**

Key logic:

- Phase 1: Group `mutation_manifest` by `(target_schema, target_table, target_pk)`. Issue one UPDATE per row with all original values. If current value != mutated_value, skip that column (someone else changed it).
- Phase 2: Read `seed_manifest` in reverse `created_at` order. DELETE each row. If FK violation, queue for retry.
- Phase 3: Two-pass retry for FK failures.
- Track progress in `simulation.cleanup_job`.

- [ ] **Step 4: Run tests to verify they pass**

- [ ] **Step 5: Commit**

```bash
git add services/simulator/src/seed/cleanup.ts services/simulator/src/seed/cleanup.test.ts
git commit -m "feat(simulation): implement manifest-driven cleanup engine

Grouped mutation rollback, reverse-FK seed deletion, two-pass retry.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: Timeline Engine (TDD)

**Files:**

- Create: `services/simulator/src/engine/timeline.ts`
- Create: `services/simulator/src/engine/timeline.test.ts`

The timeline engine manages the tick loop: reads current sim time from the clock, finds due events, dispatches them (directly in system_proof, to Director in demo).

- [ ] **Step 1: Write failing tests**

Test: pending events whose `simTimeMs <= currentSimTime` are returned. Events are dispatched in order. Paused state returns no events.

- [ ] **Step 2: Run tests to verify they fail**

- [ ] **Step 3: Implement timeline engine**

```typescript
// services/simulator/src/engine/timeline.ts
export function getDueEvents(events: TimelineEvent[], currentSimTimeMs: number): TimelineEvent[] {
  return events
    .filter((e) => e.status === "scheduled" && e.simTimeMs <= currentSimTimeMs)
    .sort((a, b) => a.simTimeMs - b.simTimeMs);
}
```

Plus the tick loop that:

1. Reads clock segments from DB
2. Computes current sim time
3. Finds due events
4. Dispatches them (updates status to `dispatched`)
5. Sleeps for tick interval based on speed

- [ ] **Step 4: Run tests to verify they pass**

- [ ] **Step 5: Commit**

```bash
git add services/simulator/src/engine/timeline.ts services/simulator/src/engine/timeline.test.ts
git commit -m "feat(simulation): implement timeline engine with tick loop

Dispatches due events based on segmented clock. Supports pause/resume.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Phase 3: API + System Proof

### Task 9: Coverage Tracker (TDD)

**Files:**

- Create: `services/simulator/src/analysis/coverage-tracker.ts`
- Create: `services/simulator/src/analysis/coverage-tracker.test.ts`

Registry-backed coverage accounting. Computes expected coverage at run start from source-of-truth registries, then tracks fired events during execution.

- [ ] **Step 1: Write failing tests**

```typescript
// services/simulator/src/analysis/coverage-tracker.test.ts
import { describe, it, expect } from "vitest";
import { CoverageTracker } from "./coverage-tracker.js";

describe("CoverageTracker", () => {
  it("initializes with expected events from scenario", () => {
    const tracker = new CoverageTracker({
      telemetryEvents: ["shift created", "session opened"],
      actionTypes: ["assign_task", "upsert_session"],
      engineProcesses: ["onboarding_journey"],
      cascadeDimensions: ["D1", "D2"],
    });
    expect(tracker.summary().telemetry.expected).toBe(2);
    expect(tracker.summary().telemetry.fired).toBe(0);
    expect(tracker.summary().telemetry.pct).toBe(0);
  });

  it("tracks fired telemetry events", () => {
    const tracker = new CoverageTracker({
      telemetryEvents: ["shift created", "session opened"],
      actionTypes: [],
      engineProcesses: [],
      cascadeDimensions: [],
    });
    tracker.recordTelemetry("shift created");
    expect(tracker.summary().telemetry.fired).toBe(1);
    expect(tracker.summary().telemetry.pct).toBe(50);
  });

  it("ignores duplicate fires", () => {
    const tracker = new CoverageTracker({
      telemetryEvents: ["shift created"],
      actionTypes: [],
      engineProcesses: [],
      cascadeDimensions: [],
    });
    tracker.recordTelemetry("shift created");
    tracker.recordTelemetry("shift created");
    expect(tracker.summary().telemetry.fired).toBe(1);
  });

  it("tracks dimension coverage", () => {
    const tracker = new CoverageTracker({
      telemetryEvents: [],
      actionTypes: [],
      engineProcesses: [],
      cascadeDimensions: ["D1", "D2", "D3"],
    });
    tracker.recordDimension("D1");
    tracker.recordDimension("D2");
    const s = tracker.summary();
    expect(s.dimensions.covered).toEqual(["D1", "D2"]);
    expect(s.dimensions.missing).toEqual(["D3"]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd services/simulator && pnpm test -- src/analysis/coverage-tracker.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement coverage tracker**

```typescript
// services/simulator/src/analysis/coverage-tracker.ts

interface CoverageInit {
  telemetryEvents: string[];
  actionTypes: string[];
  engineProcesses: string[];
  cascadeDimensions: string[];
}

export class CoverageTracker {
  private expectedTelemetry: Set<string>;
  private firedTelemetry = new Set<string>();
  private expectedActions: Set<string>;
  private firedActions = new Set<string>();
  private expectedProcesses: Set<string>;
  private firedProcesses = new Set<string>();
  private expectedDimensions: Set<string>;
  private coveredDimensions = new Set<string>();

  constructor(init: CoverageInit) {
    this.expectedTelemetry = new Set(init.telemetryEvents);
    this.expectedActions = new Set(init.actionTypes);
    this.expectedProcesses = new Set(init.engineProcesses);
    this.expectedDimensions = new Set(init.cascadeDimensions);
  }

  recordTelemetry(event: string) {
    if (this.expectedTelemetry.has(event)) this.firedTelemetry.add(event);
  }

  recordActionType(action: string) {
    if (this.expectedActions.has(action)) this.firedActions.add(action);
  }

  recordProcess(process: string) {
    if (this.expectedProcesses.has(process)) this.firedProcesses.add(process);
  }

  recordDimension(dimension: string) {
    if (this.expectedDimensions.has(dimension)) this.coveredDimensions.add(dimension);
  }

  summary() {
    const pct = (fired: number, expected: number) =>
      expected === 0 ? 100 : Math.round((fired / expected) * 100);

    return {
      telemetry: {
        fired: this.firedTelemetry.size,
        expected: this.expectedTelemetry.size,
        pct: pct(this.firedTelemetry.size, this.expectedTelemetry.size),
      },
      actionTypes: {
        fired: this.firedActions.size,
        expected: this.expectedActions.size,
        pct: pct(this.firedActions.size, this.expectedActions.size),
      },
      engineProcesses: {
        triggered: this.firedProcesses.size,
        expected: this.expectedProcesses.size,
        pct: pct(this.firedProcesses.size, this.expectedProcesses.size),
      },
      dimensions: {
        covered: [...this.coveredDimensions].sort(),
        missing: [...this.expectedDimensions].filter((d) => !this.coveredDimensions.has(d)).sort(),
      },
    };
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd services/simulator && pnpm test -- src/analysis/coverage-tracker.test.ts`
Expected: All 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add services/simulator/src/analysis/coverage-tracker.ts services/simulator/src/analysis/coverage-tracker.test.ts
git commit -m "feat(simulation): implement registry-backed coverage tracker with TDD

Tracks telemetry events, action types, engine processes, and cascade
dimensions against scenario expectations. No hardcoded counts.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Phase 3: API + System Proof

### Task 10: API Routes

**Files:**

- Create: `services/simulator/src/routes/runs.ts`
- Create: `services/simulator/src/routes/internal.ts`
- Modify: `services/simulator/src/index.ts` (add routes)

Public and internal endpoints per spec Section 7.

- [ ] **Step 1: Implement public routes**

`POST /runs` — Create run, start preflight → diagnose → seed → run pipeline.
`GET /runs` — List all runs.
`GET /runs/:id` — Run status with coverage.
`PATCH /runs/:id` — Pause/resume/speed.
`DELETE /runs/:id` — Stop + cleanup.
`GET /runs/:id/report` — Gap report.
`GET /runs/:id/timeline` — Timeline events.
`GET /runs/:id/events` — SSE stream.
`GET /runs/:id/cleanup` — Cleanup status.
`POST /runs/:id/cleanup` — Manual retry.

- [ ] **Step 2: Implement internal routes**

Agent heartbeat, event ack/complete/fail, agent command. These are only used by the Director agent in demo mode.

- [ ] **Step 3: Wire routes into main app**

- [ ] **Step 4: Test health + POST /runs manually**

Run: `cd services/simulator && pnpm dev &`
Then: `curl -X POST http://localhost:5013/runs -H 'Content-Type: application/json' -d '{"mode":"system_proof","workspace_id":null,"scenario":"sjohuset","scope":["onboarding","staffing"]}'`
Expected: JSON with run ID and status "preflight".

- [ ] **Step 5: Commit**

```bash
git add services/simulator/src/routes/ services/simulator/src/index.ts
git commit -m "feat(simulation): implement API routes (public + internal)

11 public endpoints + 5 internal swarm coordination endpoints.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 11: SSE Stream

**Files:**

- Create: `services/simulator/src/sse/stream.ts`

Server-Sent Events broadcasting for the floating UI panel.

- [ ] **Step 1: Implement SSE broadcaster**

```typescript
// services/simulator/src/sse/stream.ts
import { Context } from "hono";
import { streamSSE } from "hono/streaming";

export type SimEvent = {
  event: string;
  data: Record<string, unknown>;
};

/** Per-run event bus. UI subscribes, engine publishes. */
const runStreams = new Map<string, Set<(event: SimEvent) => void>>();

export function publishEvent(runId: string, event: SimEvent) {
  const listeners = runStreams.get(runId);
  if (!listeners) return;
  for (const fn of listeners) fn(event);
}

export function handleSSE(c: Context, runId: string) {
  return streamSSE(c, async (stream) => {
    const listener = (event: SimEvent) => {
      stream.writeSSE({ event: event.event, data: JSON.stringify(event.data) });
    };

    if (!runStreams.has(runId)) runStreams.set(runId, new Set());
    runStreams.get(runId)!.add(listener);

    stream.onAbort(() => {
      runStreams.get(runId)?.delete(listener);
    });

    // Keep connection alive
    while (true) {
      await stream.sleep(30_000);
    }
  });
}
```

- [ ] **Step 2: Wire into GET /runs/:id/events route**

- [ ] **Step 3: Test manually with curl**

Run: `curl -N http://localhost:5013/runs/<id>/events`
Expected: SSE connection stays open, receives heartbeat pings.

- [ ] **Step 4: Commit**

```bash
git add services/simulator/src/sse/
git commit -m "feat(simulation): implement SSE event streaming

Per-run event bus for real-time UI updates.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 12: System Proof Executor

**Files:**

- Create: `services/simulator/src/engine/system-proof.ts`
- Create: `services/simulator/src/engine/system-proof.test.ts`

The deterministic executor for CI mode. Processes timeline events sequentially, calls business logic directly, asserts telemetry emissions.

- [ ] **Step 1: Write failing tests**

Test: given a minimal scenario (1 act, 2 events), the executor processes all events, marks them completed, and reports coverage.

- [ ] **Step 2: Run tests to verify they fail**

- [ ] **Step 3: Implement system proof executor**

The executor:

1. Loads timeline events from DB
2. For each event in sim_time order:
   a. Calls the appropriate business function (seed department, evaluate rules, etc.)
   b. Checks telemetry was emitted (subscribe to emit events)
   c. Marks event as completed/failed
3. Generates coverage report

- [ ] **Step 4: Run tests to verify they pass**

- [ ] **Step 5: Add `simulate:test` script to root package.json**

```json
"simulate:test": "pnpm --filter @smartout/simulator run start -- --mode=system_proof"
```

- [ ] **Step 6: Commit**

```bash
git add services/simulator/src/engine/system-proof.ts services/simulator/src/engine/system-proof.test.ts package.json
git commit -m "feat(simulation): implement system proof executor for CI mode

Deterministic sequential execution, telemetry assertion, coverage report.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Phase 4: Floating UI Panel

### Task 13: SSE Hook + Panel Components

**Files:**

- Create: `apps/web/src/components/simulation/useSimulationStream.ts`
- Create: `apps/web/src/components/simulation/SimulationPanel.tsx`
- Create: `apps/web/src/components/simulation/ActIndicator.tsx`
- Create: `apps/web/src/components/simulation/CoverageCounters.tsx`
- Create: `apps/web/src/components/simulation/EventFeed.tsx`
- Create: `apps/web/src/components/simulation/TimeWarpControls.tsx`

**Important:** Read `docs/design/ren-og-varm-styleguide.html` before implementing any UI. Follow "Ren og Varm" design system. Spring physics: stiffness 35, damping 22, mass 2. Fonts: Instrument Serif for act names, Geist Sans for data, Geist Mono for timestamps. Lucide icons only.

- [ ] **Step 1: Create SSE hook**

`useSimulationStream(runId)` — Connects to `GET /runs/:id/events` SSE endpoint. Returns reactive state: current act, coverage, event feed, agents.

- [ ] **Step 2: Create TimeWarpControls**

Buttons for 1x / 2x / Pause. Calls `PATCH /runs/:id` with speed changes.

- [ ] **Step 3: Create ActIndicator**

Shows current act name + progress bar. Animated transitions between acts.

- [ ] **Step 4: Create CoverageCounters**

Live counters: telemetry fired/expected, dimensions covered/total.

- [ ] **Step 5: Create EventFeed**

Scrolling list of last 20 events from SSE stream. Color-coded by event type.

- [ ] **Step 6: Create SimulationPanel**

Floating panel (bottom-right, like chat widget). Contains all sub-components. Only renders when a simulation run is active for the current workspace. Framer Motion open/close with spring physics.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/components/simulation/
git commit -m "feat(simulation): add floating UI panel for demo mode

SimulationPanel with SSE hook, timewarp controls, act indicator,
coverage counters, and scrolling event feed. Ren og Varm design.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 14: Mount Panel in Dashboard

**Files:**

- Modify: `apps/web/src/components/dashboard/DashboardShell.tsx` (add SimulationPanel)

- [ ] **Step 1: Add SimulationPanel to DashboardShell**

Conditionally render `<SimulationPanel />` when the user's workspace has an active simulation run. Use `dynamic` import to avoid loading simulation code for non-simulation users.

- [ ] **Step 2: Test manually**

Start a demo run via API, open dashboard, verify panel appears.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/dashboard/DashboardShell.tsx
git commit -m "feat(simulation): mount floating panel in DashboardShell

Lazy-loaded, only renders when active simulation run exists.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Phase 5: AI Swarm (Demo Mode)

### Task 15: Swarm Persona Definitions

**Files:**

- Create: `services/simulator/src/swarm/personas.ts`
- Create: `services/simulator/src/swarm/personas.test.ts`

Define the 5 persona agents + Director. Each persona has auth setup (creates real Supabase auth user), interaction boundaries, and task dispatch protocol.

- [ ] **Step 1: Define persona configs**

Map each persona to: display name, role, department, which acts they participate in, what tools/APIs they use.

- [ ] **Step 2: Implement auth user creation/cleanup**

For demo mode: create real Supabase auth users with `supabase.auth.admin.createUser()`. Track in seed_manifest. Clean up on simulation end.

- [ ] **Step 3: Write tests**

Test: persona creates user, persona gets JWT, persona has correct role.

- [ ] **Step 4: Run tests**

- [ ] **Step 5: Commit**

```bash
git add services/simulator/src/swarm/
git commit -m "feat(simulation): define swarm personas with auth user lifecycle

5 personas + Director. Real Supabase auth users for honest RLS testing.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 16: Director Agent + Demo Executor

**Files:**

- Create: `services/simulator/src/swarm/director.ts`
- Create: `services/simulator/src/engine/demo-executor.ts`

The Director subscribes to the SSE stream, receives timeline events, dispatches to persona agents via the internal API.

- [ ] **Step 1: Implement Director protocol**

The Director:

1. Subscribes to `GET /runs/:id/events`
2. On `act_start`: reads act config, prepares persona tasks
3. Dispatches to personas via internal API
4. Waits for ack/complete/fail
5. Reports progress

- [ ] **Step 2: Implement demo executor**

Like system-proof but uses the timeline engine's real-time tick loop + SSE publishing. Dispatches events to the Director instead of executing directly.

- [ ] **Step 3: Add `simulate:demo` script to root package.json**

- [ ] **Step 4: Test manually**

Start demo run, verify SSE stream shows events, verify Director dispatches to personas.

- [ ] **Step 5: Commit**

```bash
git add services/simulator/src/swarm/director.ts services/simulator/src/engine/demo-executor.ts package.json
git commit -m "feat(simulation): implement Director agent and demo executor

Real-time timeline with SSE dispatch to swarm personas.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Phase 6: Integration + Polish

### Task 17: Docker Compose + Integration Test

**Files:**

- Modify: `infra/docker-compose.yml` (add simulator service)
- Create: `services/simulator/Dockerfile`
- Create: `services/simulator/test/integration.test.ts`

- [ ] **Step 1: Create Dockerfile**

Follow stage-engine pattern: multi-stage build, tsx for dev, node for prod.

- [ ] **Step 2: Add to Docker Compose**

```yaml
simulator:
  build:
    context: ../
    dockerfile: services/simulator/Dockerfile
  ports:
    - "5013:5013"
  environment:
    - SUPABASE_URL=${SUPABASE_URL}
    - SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY}
    - STAGE_ENGINE_URL=http://stage-engine:5010
    - SIMULATOR_PORT=5013
  networks:
    - smartout-internal
```

- [ ] **Step 3: Write integration test**

Test the full flow: create run → diagnose → seed → run (system_proof, max speed) → verify coverage → cleanup → verify workspace is clean.

- [ ] **Step 4: Run integration test**

Run: `cd services/simulator && pnpm test -- test/integration.test.ts`
Expected: Full cycle completes. Coverage report shows non-zero values. Cleanup leaves no residual data.

- [ ] **Step 5: Run typecheck**

Run: `pnpm turbo typecheck`
Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add infra/docker-compose.yml services/simulator/Dockerfile services/simulator/test/
git commit -m "feat(simulation): add Docker Compose + integration test

Full cycle: create → diagnose → seed → run → cleanup → verify clean.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Dependency Graph

```
Task 1 (migration)
  ├── Task 2 (scaffold) ──┐
  ├── Task 3 (clock)      ├── Task 5 (gap analysis) ──┐
  └── Task 4 (scenario)   ├── Task 6 (seeder)         ├── Task 9 (API routes) ──┐
                           ├── Task 7 (cleanup)        │                         ├── Task 10 (SSE) ──── Task 12 (UI panel) ── Task 13 (mount)
                           └── Task 8 (timeline) ──────┘                         ├── Task 11 (sys proof)
                                                                                  └── Task 14 (personas) ── Task 15 (Director)
                                                                                                                              └── Task 16 (Docker + integration)
```

## Parallelization Opportunities

- **After Task 1:** Tasks 2, 3, 4 can run in parallel (3 worktrees)
- **After Phase 1:** Tasks 5, 6, 7 can run in parallel (3 worktrees)
- **After Phase 3:** Tasks 12+13 and 14+15 can run in parallel (2 worktrees)

## Notes for Workers

- **Always read the spec** before implementing: `docs/superpowers/specs/2026-03-23-sjohuset-simulator-design.md`
- **Telemetry event names** use space-separated format: `"shift created"` not `"shift.created"`. Check `packages/telemetry/src/registry.ts`.
- **Never hardcode counts.** Coverage expectations come from the scenario config, which derives from registries.
- **The `simulation` schema has NO RLS.** All access goes through the Hono service.
- **The DashboardShell** is in `apps/web/src/components/dashboard/DashboardShell.tsx`. Read it before modifying.
- **Follow existing Hono patterns** from `services/stage-engine/src/index.ts`.
- **Run `pnpm turbo typecheck`** before any commit to catch type errors early.
