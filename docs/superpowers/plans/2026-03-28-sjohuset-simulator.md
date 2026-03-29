# Sjohuset Simulator — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a simulator service (port 5013) + platform-admin control panel that exercises every cascade dimension end-to-end for the Sjohuset restaurant, proving the system works before deploying to a real customer.

**Architecture:** Hono microservice in `services/simulator/` streams events via SSE to a platform-admin control panel at `/platform-admin/simulator`. A dedicated `simulation` PostgreSQL schema holds run metadata and manifests. System proof mode seeds Sjohuset data into real cascade tables via service role, executes 10 acts deterministically, and reports coverage.

**Tech Stack:** Hono 4.7+, @supabase/supabase-js 2.49+, TypeScript strict, React 19, shadcn/ui, Tailwind v4, SSE (EventSource), react-window (virtualized list)

**Spec:** `docs/superpowers/specs/2026-03-28-sjohuset-simulator-design.md`
**ADR:** `docs/decisions/0068-simulation-schema-and-service.md`

---

## Dependency Graph

```
Task 1: Migration (simulation schema + tables)
  |
Task 2: Service scaffold (Hono, health, config, Dockerfile)
  |
Task 3: Gap analysis engine
  |
Task 4: Seeder + manifest tracking
  |
Task 5: Timeline engine + clock
  |
Task 6: Cleanup engine
  |
Task 7: API routes + SSE streaming
  |
Task 8: Docker Compose + sidebar nav entry
  |
Task 9: Platform-admin page — transport bar + state
  |
Task 10: Platform-admin — cascade gates
  |
Task 11: Platform-admin — event feed (virtualized)
  |
Task 12: Platform-admin — gap report
  |
Task 13: Sjohuset scenario definition
  |
Task 14: Telemetry events + integration test
```

---

## Task 1: Migration — Simulation Schema + Tables

**Files:**

- Create: `supabase/migrations/20260428200000_simulation_schema.sql`

**Context:** The `simulation` schema is the 5th PostgreSQL schema (after public, payroll, websites, timesheet). All enums are schema-qualified. All PKs use `{table}_id`. All mutable tables have `updated_at` + `set_updated_at()` trigger. No RLS — platform-admin only.

- [ ] **Step 1: Create the migration file**

```sql
-- ============================================
-- 20260428200000_simulation_schema.sql
-- Dedicated schema for simulator control plane.
-- No RLS — Hono service is the auth boundary.
-- ADR-0068.
-- ============================================

-- Schema
CREATE SCHEMA IF NOT EXISTS simulation;

-- Enums (all schema-qualified)
CREATE TYPE simulation.run_mode AS ENUM ('system_proof', 'demo');
CREATE TYPE simulation.run_status AS ENUM (
  'preflight', 'diagnosing', 'seeding', 'running',
  'paused', 'cleanup', 'done', 'failed'
);
CREATE TYPE simulation.scope_action AS ENUM ('seed', 'mutate', 'observe');
CREATE TYPE simulation.gap_status AS ENUM ('present', 'seedable', 'blocking', 'out_of_scope');
CREATE TYPE simulation.timeline_event_status AS ENUM (
  'scheduled', 'dispatched', 'completed', 'failed', 'skipped'
);

-- ── simulation.run ──────────────────────────────────────
CREATE TABLE simulation.run (
  run_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id   UUID REFERENCES public.workspace(workspace_id),
  mode           simulation.run_mode NOT NULL DEFAULT 'system_proof',
  status         simulation.run_status NOT NULL DEFAULT 'preflight',
  scenario       TEXT NOT NULL DEFAULT 'sjohuset',
  speed          REAL NOT NULL DEFAULT 1.0,
  current_act    INT DEFAULT 0,
  started_at     TIMESTAMPTZ,
  ended_at       TIMESTAMPTZ,
  error          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER set_updated_at_simulation_run
  BEFORE UPDATE ON simulation.run
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── simulation.clock_segment ────────────────────────────
CREATE TABLE simulation.clock_segment (
  clock_segment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id           UUID NOT NULL REFERENCES simulation.run(run_id) ON DELETE CASCADE,
  segment_index    INT NOT NULL,
  speed            REAL NOT NULL DEFAULT 1.0,
  wall_start       TIMESTAMPTZ NOT NULL DEFAULT now(),
  wall_end         TIMESTAMPTZ,
  sim_start        INTERVAL NOT NULL DEFAULT '0'::interval,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER set_updated_at_simulation_clock_segment
  BEFORE UPDATE ON simulation.clock_segment
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── simulation.run_scope ────────────────────────────────
CREATE TABLE simulation.run_scope (
  run_scope_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id       UUID NOT NULL REFERENCES simulation.run(run_id) ON DELETE CASCADE,
  domain       TEXT NOT NULL,
  scope_action simulation.scope_action NOT NULL DEFAULT 'seed',
  enabled      BOOLEAN NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── simulation.seed_manifest ────────────────────────────
CREATE TABLE simulation.seed_manifest (
  seed_manifest_id  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id            UUID NOT NULL REFERENCES simulation.run(run_id) ON DELETE CASCADE,
  target_schema     TEXT NOT NULL,
  target_table      TEXT NOT NULL,
  target_pk         UUID NOT NULL,
  seed_category     TEXT NOT NULL,
  cascade_dimension TEXT NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_seed_manifest_run ON simulation.seed_manifest(run_id);
CREATE INDEX idx_seed_manifest_table ON simulation.seed_manifest(target_schema, target_table);

-- ── simulation.mutation_manifest ────────────────────────
CREATE TABLE simulation.mutation_manifest (
  mutation_manifest_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id               UUID NOT NULL REFERENCES simulation.run(run_id) ON DELETE CASCADE,
  target_schema        TEXT NOT NULL,
  target_table         TEXT NOT NULL,
  target_pk            UUID NOT NULL,
  column_name          TEXT NOT NULL,
  original_value       JSONB,
  mutated_value        JSONB,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_mutation_manifest_run ON simulation.mutation_manifest(run_id);

-- ── simulation.gap_report ───────────────────────────────
CREATE TABLE simulation.gap_report (
  gap_report_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id           UUID NOT NULL REFERENCES simulation.run(run_id) ON DELETE CASCADE,
  cascade_dimension TEXT NOT NULL,
  requirement      TEXT NOT NULL,
  status           simulation.gap_status NOT NULL DEFAULT 'out_of_scope',
  detail           JSONB NOT NULL DEFAULT '{}',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_gap_report_run ON simulation.gap_report(run_id);

-- ── simulation.timeline_event ───────────────────────────
CREATE TABLE simulation.timeline_event (
  timeline_event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id            UUID NOT NULL REFERENCES simulation.run(run_id) ON DELETE CASCADE,
  act               INT NOT NULL,
  act_name          TEXT NOT NULL,
  event_key         TEXT NOT NULL,
  sim_time          INTERVAL NOT NULL,
  payload           JSONB NOT NULL DEFAULT '{}',
  status            simulation.timeline_event_status NOT NULL DEFAULT 'scheduled',
  dispatched_at     TIMESTAMPTZ,
  completed_at      TIMESTAMPTZ,
  error             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER set_updated_at_simulation_timeline_event
  BEFORE UPDATE ON simulation.timeline_event
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_timeline_event_run_act ON simulation.timeline_event(run_id, act);
CREATE INDEX idx_timeline_event_status ON simulation.timeline_event(run_id, status)
  WHERE status IN ('scheduled', 'dispatched');

-- Comments
COMMENT ON SCHEMA simulation IS 'Simulator control plane. No RLS. Hono service is auth boundary. ADR-0068.';
COMMENT ON TABLE simulation.run IS 'Root entity per simulation execution.';
COMMENT ON TABLE simulation.seed_manifest IS 'Tracks every row seeded into real app tables for cleanup.';
COMMENT ON TABLE simulation.mutation_manifest IS 'Tracks mutations to pre-existing rows for rollback.';
COMMENT ON TABLE simulation.gap_report IS 'Preflight cascade dimension coverage diagnostic.';
COMMENT ON TABLE simulation.timeline_event IS 'Pre-computed scenario script executed by timeline engine.';
```

- [ ] **Step 2: Run migration against local DB**

```bash
docker exec -i $(docker ps -q -f name=supabase_db) psql -U postgres < supabase/migrations/20260428200000_simulation_schema.sql
```

- [ ] **Step 3: Regenerate types**

```bash
npx supabase gen types typescript --local > packages/supabase/src/database.types.ts
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260428200000_simulation_schema.sql packages/supabase/src/database.types.ts
git commit -m "feat(simulation): add simulation schema with 7 tables and 5 enums"
```

---

## Task 2: Service Scaffold — Hono, Health, Config, Dockerfile

**Files:**

- Create: `services/simulator/package.json`
- Create: `services/simulator/tsconfig.json`
- Create: `services/simulator/Dockerfile`
- Create: `services/simulator/.env`
- Create: `services/simulator/src/index.ts`
- Create: `services/simulator/src/config.ts`
- Create: `services/simulator/src/lib/supabase.ts`
- Create: `services/simulator/src/middleware/auth.ts`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "@smartout/simulator",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch --env-file=.env --env-file=.env.local src/index.ts",
    "build": "tsc && node ../../scripts/fix-esm-imports.mjs",
    "start": "node dist/index.js",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "hono": "^4.7.0",
    "@hono/node-server": "^1.14.0",
    "@supabase/supabase-js": "^2.49.4",
    "zod": "^3.24.2"
  },
  "devDependencies": {
    "tsx": "^4.19.0",
    "typescript": "^5.7.3",
    "@types/node": "^22.0.0"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "declaration": true,
    "sourceMap": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 3: Create config.ts**

```typescript
// services/simulator/src/config.ts

/**
 * Simulator service configuration.
 * All env vars validated at startup — fail fast if missing.
 */
export const config = {
  PORT: parseInt(process.env.PORT ?? "5013", 10),
  SUPABASE_URL: requireEnv("SUPABASE_URL"),
  SUPABASE_SERVICE_ROLE_KEY: requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
  SUPABASE_ANON_KEY: requireEnv("SUPABASE_ANON_KEY"),
  LOG_LEVEL: process.env.LOG_LEVEL ?? "info",
} as const;

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}
```

- [ ] **Step 4: Create lib/supabase.ts**

```typescript
// services/simulator/src/lib/supabase.ts

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { config } from "../config.js";

/**
 * Service-role client — bypasses RLS.
 * Used for all simulator operations (seeding, cleanup, manifest tracking).
 */
export const supabaseAdmin: SupabaseClient = createClient(
  config.SUPABASE_URL,
  config.SUPABASE_SERVICE_ROLE_KEY,
);

/**
 * Creates a user-scoped client for is_godmode validation.
 */
export function createUserClient(accessToken: string): SupabaseClient {
  return createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY, {
    global: {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  });
}
```

- [ ] **Step 5: Create middleware/auth.ts**

```typescript
// services/simulator/src/middleware/auth.ts

import type { Context, Next } from "hono";
import { createUserClient } from "../lib/supabase.js";

/**
 * Validates JWT and checks is_godmode on user_identity.
 * Only platform admins can access the simulator.
 */
export async function godmodeAuth(c: Context, next: Next): Promise<Response | void> {
  const path = new URL(c.req.url).pathname;
  if (path === "/health") return next();

  const authHeader = c.req.header("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return c.json({ error: "Missing authorization header" }, 401);
  }

  const token = authHeader.slice(7);
  const supabase = createUserClient(token);
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);

  if (error || !user) {
    return c.json({ error: "Invalid token" }, 401);
  }

  // Check is_godmode on user_identity
  const { data: identity } = await supabase
    .from("user_identity")
    .select("is_godmode")
    .eq("user_id", user.id)
    .single();

  if (!identity?.is_godmode) {
    return c.json({ error: "Requires godmode access" }, 403);
  }

  c.set("userId", user.id);
  return next();
}
```

- [ ] **Step 6: Create index.ts (server entry)**

```typescript
// services/simulator/src/index.ts

import { Hono } from "hono";
import { logger } from "hono/logger";
import { serve } from "@hono/node-server";
import { config } from "./config.js";
import { godmodeAuth } from "./middleware/auth.js";

const app = new Hono();

app.use(logger());
app.use("*", godmodeAuth);

app.get("/health", (c) => c.json({ status: "ok", service: "simulator", port: config.PORT }));

app.onError((err, c) => {
  console.error("[simulator] Unhandled error:", err);
  return c.json({ error: err.message }, 500);
});

console.log(`[simulator] Starting on port ${config.PORT}`);
serve({ fetch: app.fetch, port: config.PORT });
```

- [ ] **Step 7: Create .env**

```
PORT=5013
SUPABASE_URL=http://localhost:54321
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU
LOG_LEVEL=debug
```

- [ ] **Step 8: Create Dockerfile**

```dockerfile
# services/simulator/Dockerfile
FROM node:22-alpine AS builder

RUN corepack enable && corepack prepare pnpm@9.15.9 --activate

WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY services/simulator/package.json services/simulator/
RUN pnpm install --frozen-lockfile --filter @smartout/simulator

COPY services/simulator/ services/simulator/
COPY scripts/fix-esm-imports.mjs scripts/
RUN cd services/simulator && pnpm build

FROM node:22-alpine AS production
WORKDIR /app
COPY --from=builder /app/services/simulator/dist ./dist
COPY --from=builder /app/services/simulator/package.json ./
COPY --from=builder /app/node_modules ./node_modules

USER node
EXPOSE 5013
CMD ["node", "dist/index.js"]
```

- [ ] **Step 9: Verify service starts**

```bash
cd services/simulator && pnpm install && pnpm dev
# Expected: [simulator] Starting on port 5013
# curl http://localhost:5013/health → {"status":"ok","service":"simulator","port":5013}
```

- [ ] **Step 10: Commit**

```bash
git add services/simulator/
git commit -m "feat(simulation): scaffold simulator service on port 5013"
```

---

## Task 3: Gap Analysis Engine

**Files:**

- Create: `services/simulator/src/engine/gap-analysis.ts`

**Context:** Before seeding, scan the target workspace against cascade dimension requirements. Each requirement is classified as present/seedable/blocking/out_of_scope.

- [ ] **Step 1: Create gap-analysis.ts**

```typescript
// services/simulator/src/engine/gap-analysis.ts

import type { SupabaseClient } from "@supabase/supabase-js";

export type GapRequirement = {
  cascade_dimension: string;
  requirement: string;
  status: "present" | "seedable" | "blocking" | "out_of_scope";
  detail: Record<string, unknown>;
};

/**
 * Scans a workspace for cascade dimension coverage.
 * Returns one requirement per check — the full gap report.
 */
export async function analyzeGaps(
  supabase: SupabaseClient,
  workspaceId: string,
  enabledDomains: Set<string>,
): Promise<GapRequirement[]> {
  const gaps: GapRequirement[] = [];

  // I1 — Industry Bootstrap
  if (enabledDomains.has("I1")) {
    const { count: frameworkCount } = await supabase
      .from("regulatory_framework")
      .select("*", { count: "exact", head: true })
      .eq("workspace_id", workspaceId);

    gaps.push({
      cascade_dimension: "I1",
      requirement: "Regulatory framework bound to workspace",
      status: frameworkCount && frameworkCount > 0 ? "present" : "seedable",
      detail: { framework_count: frameworkCount ?? 0 },
    });
  }

  // D1 — Operational Envelope
  if (enabledDomains.has("D1")) {
    const { count: deptCount } = await supabase
      .from("department")
      .select("*", { count: "exact", head: true })
      .eq("workspace_id", workspaceId)
      .eq("is_active", true);

    gaps.push({
      cascade_dimension: "D1",
      requirement: "At least 1 active department",
      status: deptCount && deptCount > 0 ? "present" : "seedable",
      detail: { department_count: deptCount ?? 0 },
    });

    const { count: hoursCount } = await supabase
      .from("department_operating_hours")
      .select("*", { count: "exact", head: true })
      .eq("workspace_id", workspaceId);

    gaps.push({
      cascade_dimension: "D1",
      requirement: "Department operating hours configured",
      status: hoursCount && hoursCount > 0 ? "present" : "seedable",
      detail: { hours_count: hoursCount ?? 0 },
    });
  }

  // D2 — Resource Availability
  if (enabledDomains.has("D2")) {
    const { count: profileCount } = await supabase
      .from("profile")
      .select("*", { count: "exact", head: true })
      .eq("workspace_id", workspaceId);

    gaps.push({
      cascade_dimension: "D2",
      requirement: "At least 5 employee profiles",
      status: profileCount && profileCount >= 5 ? "present" : "seedable",
      detail: { profile_count: profileCount ?? 0 },
    });
  }

  // D3 — Rules & Constraints
  if (enabledDomains.has("D3")) {
    const { count: ruleCount } = await supabase
      .from("framework_rule")
      .select("*", { count: "exact", head: true });

    gaps.push({
      cascade_dimension: "D3",
      requirement: "Framework rules available",
      status: ruleCount && ruleCount > 0 ? "present" : "seedable",
      detail: { rule_count: ruleCount ?? 0 },
    });

    const { count: tariffCount } = await supabase
      .from("tariff_rate_table")
      .select("*", { count: "exact", head: true });

    gaps.push({
      cascade_dimension: "D3",
      requirement: "Tariff rate table seeded",
      status: tariffCount && tariffCount > 0 ? "present" : "seedable",
      detail: { tariff_count: tariffCount ?? 0 },
    });
  }

  // D4 — Demand Signal
  if (enabledDomains.has("D4")) {
    const { count: seasonCount } = await supabase
      .from("season")
      .select("*", { count: "exact", head: true })
      .eq("workspace_id", workspaceId)
      .eq("status", "active");

    gaps.push({
      cascade_dimension: "D4",
      requirement: "Active season with budget",
      status: seasonCount && seasonCount > 0 ? "present" : "seedable",
      detail: { active_season_count: seasonCount ?? 0 },
    });
  }

  // D6 — Production & Product
  if (enabledDomains.has("D6")) {
    const { count: shiftCount } = await supabase
      .from("schedule_shift")
      .select("*", { count: "exact", head: true })
      .eq("workspace_id", workspaceId);

    gaps.push({
      cascade_dimension: "D6",
      requirement: "Published shifts exist",
      status: shiftCount && shiftCount > 0 ? "present" : "seedable",
      detail: { shift_count: shiftCount ?? 0 },
    });

    const { count: sessionCount } = await supabase
      .from("department_session")
      .select("*", { count: "exact", head: true })
      .eq("workspace_id", workspaceId);

    gaps.push({
      cascade_dimension: "D6",
      requirement: "Department sessions exist",
      status: sessionCount && sessionCount > 0 ? "present" : "seedable",
      detail: { session_count: sessionCount ?? 0 },
    });
  }

  // C1 — Observability
  if (enabledDomains.has("C1")) {
    gaps.push({
      cascade_dimension: "C1",
      requirement: "Daily reconciliation flow",
      status: "seedable",
      detail: { note: "Created during Act 8 (daily close)" },
    });
  }

  // C4 — Governance
  if (enabledDomains.has("C4")) {
    const { count: authorityCount } = await supabase
      .from("engine_authority_config")
      .select("*", { count: "exact", head: true })
      .eq("workspace_id", workspaceId);

    gaps.push({
      cascade_dimension: "C4",
      requirement: "Authority config for workspace",
      status: authorityCount && authorityCount > 0 ? "present" : "seedable",
      detail: { authority_count: authorityCount ?? 0 },
    });
  }

  // K1b — Workspace Knowledge
  if (enabledDomains.has("K1b")) {
    const { count: chapterCount } = await supabase
      .from("handbook_chapter")
      .select("*", { count: "exact", head: true })
      .eq("workspace_id", workspaceId);

    gaps.push({
      cascade_dimension: "K1b",
      requirement: "Handbook chapters exist",
      status: chapterCount && chapterCount > 0 ? "present" : "seedable",
      detail: { chapter_count: chapterCount ?? 0 },
    });
  }

  // Mark disabled domains as out_of_scope
  const allDomains = [
    "I1",
    "D1",
    "D2",
    "D3",
    "D4",
    "D5",
    "D6",
    "C1",
    "C2",
    "C3",
    "C4",
    "K1a",
    "K1b",
  ];
  for (const domain of allDomains) {
    if (!enabledDomains.has(domain)) {
      gaps.push({
        cascade_dimension: domain,
        requirement: `${domain} dimension`,
        status: "out_of_scope",
        detail: { reason: "Disabled in run scope" },
      });
    }
  }

  return gaps;
}
```

- [ ] **Step 2: Commit**

```bash
git add services/simulator/src/engine/gap-analysis.ts
git commit -m "feat(simulation): add cascade gap analysis engine"
```

---

## Task 4: Seeder + Manifest Tracking

**Files:**

- Create: `services/simulator/src/engine/seeder.ts`
- Create: `services/simulator/src/engine/manifest.ts`

**Context:** The seeder inserts Sjohuset data into real cascade tables. Every insert is tracked in `simulation.seed_manifest` for cleanup. Uses `supabase/templates/restaurant/` as the data source — never `hospitality.ts`.

- [ ] **Step 1: Create manifest.ts (tracking helper)**

```typescript
// services/simulator/src/engine/manifest.ts

import type { SupabaseClient } from "@supabase/supabase-js";

export type SeedEntry = {
  target_schema: string;
  target_table: string;
  target_pk: string;
  seed_category: string;
  cascade_dimension: string;
};

/**
 * Records a seeded row in the manifest for later cleanup.
 */
export async function trackSeed(
  supabase: SupabaseClient,
  runId: string,
  entry: SeedEntry,
): Promise<void> {
  await supabase.from("seed_manifest").insert({
    run_id: runId,
    ...entry,
  });
}

/**
 * Batch-records multiple seeded rows.
 */
export async function trackSeedBatch(
  supabase: SupabaseClient,
  runId: string,
  entries: SeedEntry[],
): Promise<void> {
  if (entries.length === 0) return;
  const rows = entries.map((e) => ({ run_id: runId, ...e }));
  await supabase.from("seed_manifest").insert(rows);
}

/**
 * Records a mutation to a pre-existing row for rollback.
 */
export async function trackMutation(
  supabase: SupabaseClient,
  runId: string,
  entry: {
    target_schema: string;
    target_table: string;
    target_pk: string;
    column_name: string;
    original_value: unknown;
    mutated_value: unknown;
  },
): Promise<void> {
  await supabase.from("mutation_manifest").insert({
    run_id: runId,
    ...entry,
  });
}
```

- [ ] **Step 2: Create seeder.ts**

```typescript
// services/simulator/src/engine/seeder.ts

import type { SupabaseClient } from "@supabase/supabase-js";
import { trackSeed, trackSeedBatch, type SeedEntry } from "./manifest.js";

type SeederContext = {
  supabase: SupabaseClient;
  runId: string;
  workspaceId: string;
};

/**
 * Seeds D1 dimension: departments, locations, operating hours.
 * Data aligned with supabase/templates/restaurant/departments.sql
 */
export async function seedD1(ctx: SeederContext): Promise<void> {
  const departments = [
    { name: "Kjokken", slug: "kjokken", department_type: "operational", sort_order: 1 },
    { name: "Sal", slug: "sal", department_type: "operational", sort_order: 2 },
    { name: "Bar", slug: "bar", department_type: "operational", sort_order: 3 },
    { name: "Catering", slug: "catering", department_type: "hybrid", sort_order: 4 },
    { name: "Renhold", slug: "renhold", department_type: "administrative", sort_order: 5 },
    { name: "Levering", slug: "levering", department_type: "hybrid", sort_order: 6 },
    { name: "Event", slug: "event", department_type: "hybrid", sort_order: 7 },
  ];

  const manifests: SeedEntry[] = [];

  for (const dept of departments) {
    const { data, error } = await ctx.supabase
      .from("department")
      .insert({ workspace_id: ctx.workspaceId, ...dept, is_active: true })
      .select("department_id")
      .single();

    if (error) throw new Error(`Failed to seed department ${dept.name}: ${error.message}`);

    manifests.push({
      target_schema: "public",
      target_table: "department",
      target_pk: data.department_id,
      seed_category: "department",
      cascade_dimension: "D1",
    });
  }

  await trackSeedBatch(ctx.supabase, ctx.runId, manifests);
}

/**
 * Seeds D4 dimension: season, budget, day/hour factors.
 * Revenue target and factors from templates/restaurant/budget.sql
 */
export async function seedD4(ctx: SeederContext): Promise<void> {
  // Create season
  const { data: season, error: seasonErr } = await ctx.supabase
    .from("season")
    .insert({
      workspace_id: ctx.workspaceId,
      name: "Varsesong 2026",
      slug: "varsesong-2026",
      season_type: "default",
      start_date: new Date().toISOString().split("T")[0],
      end_date: new Date(Date.now() + 91 * 86400000).toISOString().split("T")[0],
      status: "draft",
    })
    .select("season_id")
    .single();

  if (seasonErr) throw new Error(`Failed to seed season: ${seasonErr.message}`);

  await trackSeed(ctx.supabase, ctx.runId, {
    target_schema: "public",
    target_table: "season",
    target_pk: season.season_id,
    seed_category: "season",
    cascade_dimension: "D4",
  });

  // Create budget
  const { data: budget, error: budgetErr } = await ctx.supabase
    .from("season_budget")
    .insert({
      season_id: season.season_id,
      workspace_id: ctx.workspaceId,
      total_target_revenue: 8500000,
      target_labor_percentage: 32,
      avg_hourly_wage: 220,
      base_price_per_guest: 450,
      status: "active",
    })
    .select("season_budget_id")
    .single();

  if (budgetErr) throw new Error(`Failed to seed budget: ${budgetErr.message}`);

  await trackSeed(ctx.supabase, ctx.runId, {
    target_schema: "public",
    target_table: "season_budget",
    target_pk: budget.season_budget_id,
    seed_category: "budget",
    cascade_dimension: "D4",
  });

  // Seed day factors (Mon=0 through Sun=6, restaurant weekend-heavy)
  const dayFactors = [
    { weekday: 0, factor: 0.6 },
    { weekday: 1, factor: 0.7 },
    { weekday: 2, factor: 0.8 },
    { weekday: 3, factor: 1.0 },
    { weekday: 4, factor: 1.6 },
    { weekday: 5, factor: 1.8 },
    { weekday: 6, factor: 1.0 },
  ];

  for (const df of dayFactors) {
    const { data, error } = await ctx.supabase
      .from("day_factor")
      .insert({
        season_budget_id: budget.season_budget_id,
        workspace_id: ctx.workspaceId,
        ...df,
      })
      .select("day_factor_id")
      .single();

    if (error) throw new Error(`Failed to seed day factor: ${error.message}`);

    await trackSeed(ctx.supabase, ctx.runId, {
      target_schema: "public",
      target_table: "day_factor",
      target_pk: data.day_factor_id,
      seed_category: "day_factor",
      cascade_dimension: "D4",
    });
  }
}

// Additional seeders (seedD2, seedD3, seedD6, seedC4, seedK1b) follow the same pattern.
// Each function inserts into the relevant tables and tracks every row via manifest.
// Full implementations will be added per-act in the scenario definition (Task 13).
```

- [ ] **Step 3: Commit**

```bash
git add services/simulator/src/engine/manifest.ts services/simulator/src/engine/seeder.ts
git commit -m "feat(simulation): add seeder engine with manifest tracking"
```

---

## Task 5: Timeline Engine + Clock

**Files:**

- Create: `services/simulator/src/engine/timeline.ts`
- Create: `services/simulator/src/engine/clock.ts`

- [ ] **Step 1: Create clock.ts**

```typescript
// services/simulator/src/engine/clock.ts

import type { SupabaseClient } from "@supabase/supabase-js";

export type ClockState = {
  simTime: number; // Milliseconds of simulated time elapsed
  wallStart: Date; // Real-time start of current segment
  speed: number; // Current speed multiplier
  isPaused: boolean;
};

/**
 * Computes current simulation time from clock segments.
 * sim_time = sum(completed segments) + active segment elapsed * speed
 */
export async function getSimTime(supabase: SupabaseClient, runId: string): Promise<number> {
  const { data: segments } = await supabase
    .from("clock_segment")
    .select("speed, wall_start, wall_end, sim_start")
    .eq("run_id", runId)
    .order("segment_index", { ascending: true });

  if (!segments || segments.length === 0) return 0;

  let totalMs = 0;

  for (const seg of segments) {
    const start = new Date(seg.wall_start).getTime();
    const end = seg.wall_end ? new Date(seg.wall_end).getTime() : Date.now();
    const wallElapsed = end - start;
    totalMs += wallElapsed * seg.speed;
  }

  return totalMs;
}

/**
 * Starts a new clock segment (called on run start and speed change).
 */
export async function startClockSegment(
  supabase: SupabaseClient,
  runId: string,
  segmentIndex: number,
  speed: number,
  simStart: number,
): Promise<void> {
  await supabase.from("clock_segment").insert({
    run_id: runId,
    segment_index: segmentIndex,
    speed,
    wall_start: new Date().toISOString(),
    sim_start: `${simStart} milliseconds`,
  });
}

/**
 * Closes the active clock segment (called on pause, stop, speed change).
 */
export async function closeActiveSegment(supabase: SupabaseClient, runId: string): Promise<number> {
  const currentSimTime = await getSimTime(supabase, runId);

  const { data: active } = await supabase
    .from("clock_segment")
    .select("clock_segment_id")
    .eq("run_id", runId)
    .is("wall_end", null)
    .single();

  if (active) {
    await supabase
      .from("clock_segment")
      .update({ wall_end: new Date().toISOString() })
      .eq("clock_segment_id", active.clock_segment_id);
  }

  return currentSimTime;
}
```

- [ ] **Step 2: Create timeline.ts**

```typescript
// services/simulator/src/engine/timeline.ts

import type { SupabaseClient } from "@supabase/supabase-js";
import { getSimTime } from "./clock.js";

export type TimelineCallback = (event: {
  timeline_event_id: string;
  act: number;
  act_name: string;
  event_key: string;
  payload: Record<string, unknown>;
}) => Promise<void>;

/**
 * Executes timeline events whose sim_time has been reached.
 * System proof mode: runs all events sequentially at max speed.
 * Returns the number of events executed.
 */
export async function tickTimeline(
  supabase: SupabaseClient,
  runId: string,
  onEvent: TimelineCallback,
): Promise<number> {
  const simTimeMs = await getSimTime(supabase, runId);

  // Find scheduled events whose sim_time has been reached
  const { data: dueEvents } = await supabase
    .from("timeline_event")
    .select("timeline_event_id, act, act_name, event_key, sim_time, payload")
    .eq("run_id", runId)
    .eq("status", "scheduled")
    .order("sim_time", { ascending: true });

  if (!dueEvents) return 0;

  let executed = 0;

  for (const event of dueEvents) {
    // Convert interval string to ms for comparison
    // In system proof mode, we execute all events regardless of timing
    await supabase
      .from("timeline_event")
      .update({ status: "dispatched", dispatched_at: new Date().toISOString() })
      .eq("timeline_event_id", event.timeline_event_id);

    try {
      await onEvent({
        timeline_event_id: event.timeline_event_id,
        act: event.act,
        act_name: event.act_name,
        event_key: event.event_key,
        payload: event.payload as Record<string, unknown>,
      });

      await supabase
        .from("timeline_event")
        .update({ status: "completed", completed_at: new Date().toISOString() })
        .eq("timeline_event_id", event.timeline_event_id);

      executed++;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      await supabase
        .from("timeline_event")
        .update({ status: "failed", error: errorMsg })
        .eq("timeline_event_id", event.timeline_event_id);
    }
  }

  // Update current act on run
  if (dueEvents.length > 0) {
    const lastEvent = dueEvents[dueEvents.length - 1]!;
    await supabase.from("run").update({ current_act: lastEvent.act }).eq("run_id", runId);
  }

  return executed;
}
```

- [ ] **Step 3: Commit**

```bash
git add services/simulator/src/engine/clock.ts services/simulator/src/engine/timeline.ts
git commit -m "feat(simulation): add timeline engine and segmented clock"
```

---

## Task 6: Cleanup Engine

**Files:**

- Create: `services/simulator/src/engine/cleanup.ts`
- Create: `services/simulator/src/startup.ts`

- [ ] **Step 1: Create cleanup.ts**

```typescript
// services/simulator/src/engine/cleanup.ts

import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Manifest-based cleanup. Reverses mutations first, then deletes seeds.
 * Order matters: mutations restore original state, seeds remove added rows.
 */
export async function cleanupRun(
  supabase: SupabaseClient,
  runId: string,
): Promise<{ mutations_restored: number; seeds_deleted: number; errors: string[] }> {
  const errors: string[] = [];
  let mutationsRestored = 0;
  let seedsDeleted = 0;

  // Phase 1: Restore mutations (reverse order)
  const { data: mutations } = await supabase
    .from("mutation_manifest")
    .select("*")
    .eq("run_id", runId)
    .order("created_at", { ascending: false });

  for (const mut of mutations ?? []) {
    try {
      // Use raw SQL via rpc to handle dynamic schema.table
      await supabase.rpc("exec_sql", {
        query: `UPDATE ${mut.target_schema}.${mut.target_table} SET ${mut.column_name} = $1 WHERE ${mut.target_table}_id = $2`,
        params: [JSON.stringify(mut.original_value), mut.target_pk],
      });
      mutationsRestored++;
    } catch (err) {
      errors.push(
        `Mutation restore failed: ${mut.target_schema}.${mut.target_table}.${mut.target_pk}: ${err}`,
      );
    }
  }

  // Phase 2: Delete seeds (reverse order — handle FK dependencies)
  const { data: seeds } = await supabase
    .from("seed_manifest")
    .select("*")
    .eq("run_id", runId)
    .order("created_at", { ascending: false });

  for (const seed of seeds ?? []) {
    try {
      const pkColumn = `${seed.target_table}_id`;
      const { error } = await supabase
        .from(seed.target_table)
        .delete()
        .eq(pkColumn, seed.target_pk);

      if (error) throw error;
      seedsDeleted++;
    } catch (err) {
      errors.push(
        `Seed delete failed: ${seed.target_schema}.${seed.target_table}.${seed.target_pk}: ${err}`,
      );
    }
  }

  return { mutations_restored: mutationsRestored, seeds_deleted: seedsDeleted, errors };
}
```

- [ ] **Step 2: Create startup.ts (orphan detection)**

```typescript
// services/simulator/src/startup.ts

import { supabaseAdmin } from "./lib/supabase.js";

/**
 * On startup, detect orphaned runs (running/seeding status with no recent activity).
 * Flags them as failed so cleanup can be triggered manually.
 */
export async function detectOrphans(): Promise<number> {
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();

  const { data: orphans } = await supabaseAdmin
    .from("run")
    .select("run_id, status, updated_at")
    .in("status", ["running", "seeding", "diagnosing"])
    .lt("updated_at", tenMinutesAgo);

  if (!orphans || orphans.length === 0) return 0;

  for (const orphan of orphans) {
    await supabaseAdmin
      .from("run")
      .update({
        status: "failed",
        error: `Orphan detected on startup. Last activity: ${orphan.updated_at}`,
        ended_at: new Date().toISOString(),
      })
      .eq("run_id", orphan.run_id);

    console.warn(`[simulator] Orphan detected: run ${orphan.run_id} (was ${orphan.status})`);
  }

  return orphans.length;
}
```

- [ ] **Step 3: Wire startup into index.ts**

Add to `services/simulator/src/index.ts` before `serve()`:

```typescript
import { detectOrphans } from "./startup.js";

// Detect orphaned runs from previous crashes
detectOrphans().then((count) => {
  if (count > 0) console.warn(`[simulator] Flagged ${count} orphaned run(s)`);
});
```

- [ ] **Step 4: Commit**

```bash
git add services/simulator/src/engine/cleanup.ts services/simulator/src/startup.ts services/simulator/src/index.ts
git commit -m "feat(simulation): add cleanup engine and orphan detection"
```

---

## Task 7: API Routes + SSE Streaming

**Files:**

- Create: `services/simulator/src/routes/runs.ts`
- Create: `services/simulator/src/routes/control.ts`
- Create: `services/simulator/src/routes/events.ts`
- Modify: `services/simulator/src/index.ts`

- [ ] **Step 1: Create routes/runs.ts**

```typescript
// services/simulator/src/routes/runs.ts

import { Hono } from "hono";
import { supabaseAdmin } from "../lib/supabase.js";
import { analyzeGaps } from "../engine/gap-analysis.js";

const runs = new Hono();

// Create a new simulation run
runs.post("/", async (c) => {
  const body = await c.req.json<{
    workspace_id?: string;
    mode?: string;
    scenario?: string;
    domains?: string[];
  }>();

  const { data: run, error } = await supabaseAdmin
    .from("run")
    .insert({
      workspace_id: body.workspace_id ?? null,
      mode: body.mode ?? "system_proof",
      scenario: body.scenario ?? "sjohuset",
      status: "preflight",
    })
    .select("run_id, workspace_id, mode, status, scenario, created_at")
    .single();

  if (error) return c.json({ error: error.message }, 500);

  // Insert run_scope for each domain
  const allDomains = [
    "I1",
    "D1",
    "D2",
    "D3",
    "D4",
    "D5",
    "D6",
    "C1",
    "C2",
    "C3",
    "C4",
    "K1a",
    "K1b",
  ];
  const enabledDomains = new Set(body.domains ?? allDomains);

  const scopeRows = allDomains.map((domain) => ({
    run_id: run.run_id,
    domain,
    scope_action: "seed" as const,
    enabled: enabledDomains.has(domain),
  }));

  await supabaseAdmin.from("run_scope").insert(scopeRows);

  return c.json(run, 201);
});

// List all runs
runs.get("/", async (c) => {
  const { data } = await supabaseAdmin
    .from("run")
    .select(
      "run_id, workspace_id, mode, status, scenario, current_act, speed, created_at, ended_at, error",
    )
    .order("created_at", { ascending: false })
    .limit(20);

  return c.json(data ?? []);
});

// Get single run with gap report
runs.get("/:id", async (c) => {
  const runId = c.req.param("id");

  const { data: run } = await supabaseAdmin.from("run").select("*").eq("run_id", runId).single();

  if (!run) return c.json({ error: "Run not found" }, 404);

  const { data: gaps } = await supabaseAdmin.from("gap_report").select("*").eq("run_id", runId);

  const { data: scopes } = await supabaseAdmin.from("run_scope").select("*").eq("run_id", runId);

  return c.json({ ...run, gaps: gaps ?? [], scopes: scopes ?? [] });
});

export { runs };
```

- [ ] **Step 2: Create routes/control.ts**

```typescript
// services/simulator/src/routes/control.ts

import { Hono } from "hono";
import { supabaseAdmin } from "../lib/supabase.js";
import { analyzeGaps } from "../engine/gap-analysis.js";
import { startClockSegment, closeActiveSegment } from "../engine/clock.js";
import { cleanupRun } from "../engine/cleanup.js";

const control = new Hono();

// Start or resume a run
control.post("/:id/start", async (c) => {
  const runId = c.req.param("id");

  const { data: run } = await supabaseAdmin
    .from("run")
    .select("run_id, status, workspace_id, speed")
    .eq("run_id", runId)
    .single();

  if (!run) return c.json({ error: "Run not found" }, 404);

  if (run.status === "preflight") {
    // Run gap analysis first
    if (run.workspace_id) {
      await supabaseAdmin.from("run").update({ status: "diagnosing" }).eq("run_id", runId);

      const { data: scopes } = await supabaseAdmin
        .from("run_scope")
        .select("domain")
        .eq("run_id", runId)
        .eq("enabled", true);

      const enabledDomains = new Set((scopes ?? []).map((s) => s.domain));
      const gaps = await analyzeGaps(supabaseAdmin, run.workspace_id, enabledDomains);

      // Store gap report
      const gapRows = gaps.map((g) => ({ run_id: runId, ...g }));
      await supabaseAdmin.from("gap_report").insert(gapRows);

      // Check for blocking gaps
      const blocking = gaps.filter((g) => g.status === "blocking");
      if (blocking.length > 0) {
        await supabaseAdmin
          .from("run")
          .update({
            status: "failed",
            error: `Blocking gaps: ${blocking.map((g) => g.requirement).join(", ")}`,
          })
          .eq("run_id", runId);
        return c.json({ error: "Blocking gaps found", gaps: blocking }, 400);
      }
    }

    // Transition to seeding, then running
    await supabaseAdmin
      .from("run")
      .update({ status: "running", started_at: new Date().toISOString() })
      .eq("run_id", runId);

    await startClockSegment(supabaseAdmin, runId, 0, run.speed, 0);
  } else if (run.status === "paused") {
    // Resume from pause
    const { data: segments } = await supabaseAdmin
      .from("clock_segment")
      .select("segment_index")
      .eq("run_id", runId)
      .order("segment_index", { ascending: false })
      .limit(1);

    const nextIndex = (segments?.[0]?.segment_index ?? 0) + 1;
    const currentSimTime = await closeActiveSegment(supabaseAdmin, runId);
    await startClockSegment(supabaseAdmin, runId, nextIndex, run.speed, currentSimTime);

    await supabaseAdmin.from("run").update({ status: "running" }).eq("run_id", runId);
  }

  return c.json({ status: "running" });
});

// Pause a run
control.post("/:id/pause", async (c) => {
  const runId = c.req.param("id");

  await closeActiveSegment(supabaseAdmin, runId);
  await supabaseAdmin.from("run").update({ status: "paused" }).eq("run_id", runId);

  return c.json({ status: "paused" });
});

// Stop a run and trigger cleanup
control.post("/:id/stop", async (c) => {
  const runId = c.req.param("id");

  await closeActiveSegment(supabaseAdmin, runId);
  await supabaseAdmin.from("run").update({ status: "cleanup" }).eq("run_id", runId);

  const result = await cleanupRun(supabaseAdmin, runId);

  await supabaseAdmin
    .from("run")
    .update({
      status: result.errors.length > 0 ? "failed" : "done",
      ended_at: new Date().toISOString(),
      error: result.errors.length > 0 ? result.errors.join("; ") : null,
    })
    .eq("run_id", runId);

  return c.json(result);
});

// Change speed
control.post("/:id/speed", async (c) => {
  const runId = c.req.param("id");
  const { speed } = await c.req.json<{ speed: number }>();

  const currentSimTime = await closeActiveSegment(supabaseAdmin, runId);

  const { data: segments } = await supabaseAdmin
    .from("clock_segment")
    .select("segment_index")
    .eq("run_id", runId)
    .order("segment_index", { ascending: false })
    .limit(1);

  const nextIndex = (segments?.[0]?.segment_index ?? 0) + 1;
  await startClockSegment(supabaseAdmin, runId, nextIndex, speed, currentSimTime);
  await supabaseAdmin.from("run").update({ speed }).eq("run_id", runId);

  return c.json({ speed });
});

// Manual cleanup trigger
control.post("/:id/cleanup", async (c) => {
  const runId = c.req.param("id");
  const result = await cleanupRun(supabaseAdmin, runId);

  await supabaseAdmin
    .from("run")
    .update({
      status: "done",
      ended_at: new Date().toISOString(),
    })
    .eq("run_id", runId);

  return c.json(result);
});

export { control };
```

- [ ] **Step 3: Create routes/events.ts (SSE)**

```typescript
// services/simulator/src/routes/events.ts

import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { supabaseAdmin } from "../lib/supabase.js";

const events = new Hono();

// SSE event stream for a run
events.get("/:id/events", async (c) => {
  const runId = c.req.param("id");

  return streamSSE(c, async (stream) => {
    let lastEventId = "";

    // Poll for new events every 500ms
    while (true) {
      const { data: run } = await supabaseAdmin
        .from("run")
        .select("status, current_act, speed")
        .eq("run_id", runId)
        .single();

      if (!run) break;

      // Send run status update
      await stream.writeSSE({
        event: "status",
        data: JSON.stringify({
          status: run.status,
          current_act: run.current_act,
          speed: run.speed,
        }),
      });

      // Send new timeline events since last check
      let query = supabaseAdmin
        .from("timeline_event")
        .select(
          "timeline_event_id, act, act_name, event_key, status, dispatched_at, completed_at, error",
        )
        .eq("run_id", runId)
        .in("status", ["dispatched", "completed", "failed"])
        .order("dispatched_at", { ascending: true })
        .limit(50);

      if (lastEventId) {
        query = query.gt("timeline_event_id", lastEventId);
      }

      const { data: newEvents } = await query;

      for (const evt of newEvents ?? []) {
        await stream.writeSSE({
          event: "timeline",
          data: JSON.stringify(evt),
          id: evt.timeline_event_id,
        });
        lastEventId = evt.timeline_event_id;
      }

      // Stop streaming if run is done/failed
      if (["done", "failed"].includes(run.status)) {
        await stream.writeSSE({
          event: "complete",
          data: JSON.stringify({ status: run.status }),
        });
        break;
      }

      await stream.sleep(500);
    }
  });
});

export { events };
```

- [ ] **Step 4: Wire routes into index.ts**

Replace the route section of `services/simulator/src/index.ts`:

```typescript
import { runs } from "./routes/runs.js";
import { control } from "./routes/control.js";
import { events } from "./routes/events.js";

app.route("/runs", runs);
app.route("/runs", control);
app.route("/runs", events);
```

- [ ] **Step 5: Commit**

```bash
git add services/simulator/src/routes/ services/simulator/src/index.ts
git commit -m "feat(simulation): add API routes with SSE streaming"
```

---

## Task 8: Docker Compose + Sidebar Nav Entry

**Files:**

- Modify: `infra/docker-compose.yml`
- Modify: `infra/docker-compose.override.yml`
- Modify: `apps/web/src/components/platform-admin/sidebar-nav.tsx`

- [ ] **Step 1: Add simulator to docker-compose.yml**

Add after the last service entry:

```yaml
simulator:
  build:
    context: ../
    dockerfile: services/simulator/Dockerfile
  extra_hosts:
    - "host.docker.internal:host-gateway"
  environment:
    - NODE_ENV=${NODE_ENV:-development}
    - PORT=5013
    - SUPABASE_URL=${SUPABASE_URL}
    - SUPABASE_ANON_KEY=${SUPABASE_ANON_KEY}
    - SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY}
    - LOG_LEVEL=${LOG_LEVEL:-info}
  networks:
    - smartout-internal
  restart: unless-stopped
  healthcheck:
    test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://127.0.0.1:5013/health"]
    interval: 30s
    timeout: 5s
    retries: 3
  depends_on:
    - caddy
```

- [ ] **Step 2: Add override for dev port exposure**

In `infra/docker-compose.override.yml`, add:

```yaml
simulator:
  ports:
    - "5013:5013"
  environment:
    - SUPABASE_URL=http://host.docker.internal:54321
    - LOG_LEVEL=debug
```

- [ ] **Step 3: Add sidebar nav entry**

In `apps/web/src/components/platform-admin/sidebar-nav.tsx`, add `Play` to the lucide import and a new entry under the "System" group:

```typescript
// Add to import
import { ..., Play } from "lucide-react";

// Add to System group items array
{ href: "/platform-admin/simulator", label: "Simulator", icon: Play },
```

- [ ] **Step 4: Commit**

```bash
git add infra/docker-compose.yml infra/docker-compose.override.yml apps/web/src/components/platform-admin/sidebar-nav.tsx
git commit -m "feat(simulation): add Docker Compose entry and sidebar nav"
```

---

## Task 9: Platform-Admin Page — Transport Bar + State

**Files:**

- Create: `apps/web/src/app/platform-admin/simulator/page.tsx`
- Create: `apps/web/src/app/platform-admin/simulator/_hooks/use-simulator.ts`
- Create: `apps/web/src/app/platform-admin/simulator/_components/TransportBar.tsx`

**Context:** The control panel page fetches state from the simulator service and renders the transport bar (status, play/pause/stop, speed warper, clocks).

- [ ] **Step 1: Create use-simulator.ts hook**

This hook manages the connection to the simulator service — REST for commands, SSE for live events.

```typescript
// apps/web/src/app/platform-admin/simulator/_hooks/use-simulator.ts
"use client";

import { useState, useCallback, useRef, useEffect } from "react";

const SIMULATOR_URL = process.env.NEXT_PUBLIC_SIMULATOR_URL ?? "http://localhost:5013";

type RunStatus =
  | "preflight"
  | "diagnosing"
  | "seeding"
  | "running"
  | "paused"
  | "cleanup"
  | "done"
  | "failed";

type SimulatorRun = {
  run_id: string;
  workspace_id: string | null;
  mode: string;
  status: RunStatus;
  scenario: string;
  current_act: number;
  speed: number;
  created_at: string;
  ended_at: string | null;
  error: string | null;
  gaps: Array<{
    cascade_dimension: string;
    requirement: string;
    status: string;
    detail: Record<string, unknown>;
  }>;
  scopes: Array<{
    domain: string;
    enabled: boolean;
  }>;
};

type TimelineEvent = {
  timeline_event_id: string;
  act: number;
  act_name: string;
  event_key: string;
  status: string;
  dispatched_at: string | null;
  completed_at: string | null;
  error: string | null;
};

export function useSimulator(token: string | null) {
  const [run, setRun] = useState<SimulatorRun | null>(null);
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);

  const headers = useCallback(
    () => ({
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    }),
    [token],
  );

  const createRun = useCallback(
    async (opts: { workspace_id?: string; domains?: string[] }) => {
      setLoading(true);
      const res = await fetch(`${SIMULATOR_URL}/runs`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify(opts),
      });
      const data = await res.json();
      setLoading(false);

      // Fetch full run with gaps
      const fullRes = await fetch(`${SIMULATOR_URL}/runs/${data.run_id}`, { headers: headers() });
      const fullRun = await fullRes.json();
      setRun(fullRun);
      return fullRun;
    },
    [headers],
  );

  const sendCommand = useCallback(
    async (command: string, body?: Record<string, unknown>) => {
      if (!run) return;
      const res = await fetch(`${SIMULATOR_URL}/runs/${run.run_id}/${command}`, {
        method: "POST",
        headers: headers(),
        body: body ? JSON.stringify(body) : undefined,
      });
      const result = await res.json();

      // Refresh run state
      const fullRes = await fetch(`${SIMULATOR_URL}/runs/${run.run_id}`, { headers: headers() });
      const fullRun = await fullRes.json();
      setRun(fullRun);
      return result;
    },
    [run, headers],
  );

  const start = useCallback(() => sendCommand("start"), [sendCommand]);
  const pause = useCallback(() => sendCommand("pause"), [sendCommand]);
  const stop = useCallback(() => sendCommand("stop"), [sendCommand]);
  const setSpeed = useCallback((speed: number) => sendCommand("speed", { speed }), [sendCommand]);

  // SSE connection for live events
  const connectSSE = useCallback(() => {
    if (!run || !token) return;

    eventSourceRef.current?.close();

    const es = new EventSource(`${SIMULATOR_URL}/runs/${run.run_id}/events`);

    es.addEventListener("timeline", (e) => {
      const evt = JSON.parse(e.data) as TimelineEvent;
      setEvents((prev) => [...prev, evt]);
    });

    es.addEventListener("status", (e) => {
      const status = JSON.parse(e.data);
      setRun((prev) => (prev ? { ...prev, ...status } : prev));
    });

    es.addEventListener("complete", () => {
      es.close();
    });

    eventSourceRef.current = es;
  }, [run, token]);

  useEffect(() => {
    return () => eventSourceRef.current?.close();
  }, []);

  return {
    run,
    events,
    loading,
    createRun,
    start,
    pause,
    stop,
    setSpeed,
    connectSSE,
  };
}
```

- [ ] **Step 2: Create TransportBar.tsx**

```tsx
// apps/web/src/app/platform-admin/simulator/_components/TransportBar.tsx
"use client";

import { Play, Pause, Square, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type RunStatus =
  | "preflight"
  | "diagnosing"
  | "seeding"
  | "running"
  | "paused"
  | "cleanup"
  | "done"
  | "failed";

const STATUS_COLORS: Record<RunStatus, string> = {
  preflight: "bg-muted text-muted-foreground",
  diagnosing: "bg-primary/20 text-primary",
  seeding: "bg-primary/20 text-primary",
  running: "bg-emerald-500/20 text-emerald-400",
  paused: "bg-amber-500/20 text-amber-400",
  cleanup: "bg-primary/20 text-primary",
  done: "bg-emerald-500/20 text-emerald-400",
  failed: "bg-destructive/20 text-destructive",
};

const SPEEDS = [1, 2, 4, 10] as const;

type Props = {
  status: RunStatus | null;
  currentAct: number;
  speed: number;
  onStart: () => void;
  onPause: () => void;
  onStop: () => void;
  onSpeedChange: (speed: number) => void;
};

export function TransportBar({
  status,
  currentAct,
  speed,
  onStart,
  onPause,
  onStop,
  onSpeedChange,
}: Props) {
  const isRunning = status === "running";
  const isPaused = status === "paused";
  const canStart = status === "preflight" || status === "paused";
  const canPause = status === "running";
  const canStop = status === "running" || status === "paused";

  return (
    <div className="bg-card/80 border-border sticky top-0 z-10 flex h-14 items-center justify-between border-b px-4 backdrop-blur-sm">
      {/* Left: Status + Act */}
      <div className="flex items-center gap-3">
        {status && (
          <Badge variant="outline" className={STATUS_COLORS[status]}>
            <span
              className={`mr-1.5 inline-block h-1.5 w-1.5 rounded-full ${
                isRunning || status === "seeding" ? "animate-pulse bg-current" : "bg-current"
              }`}
            />
            {status}
          </Badge>
        )}
        {currentAct > 0 && (
          <span className="text-muted-foreground text-xs">Act {currentAct}/10</span>
        )}
      </div>

      {/* Center: Transport + Speed */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9"
            onClick={onStop}
            disabled={!canStop}
            aria-label="Stop simulation"
          >
            <Square className="h-4 w-4" />
          </Button>
          {canPause ? (
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              onClick={onPause}
              aria-label="Pause simulation"
            >
              <Pause className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              onClick={onStart}
              disabled={!canStart}
              aria-label="Start simulation"
            >
              <Play className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Speed warper — segmented control */}
        <div
          className="bg-muted flex items-center gap-0.5 rounded-lg p-0.5"
          role="radiogroup"
          aria-label="Simulation speed"
        >
          {SPEEDS.map((s) => (
            <button
              key={s}
              role="radio"
              aria-checked={speed === s}
              onClick={() => onSpeedChange(s)}
              className={`rounded-md px-2.5 py-1 font-mono text-xs font-medium transition-colors ${
                speed === s
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {s}x
            </button>
          ))}
        </div>
      </div>

      {/* Right: empty for now, will hold clocks in Phase 2 */}
      <div className="w-32" />
    </div>
  );
}
```

- [ ] **Step 3: Create page.tsx**

```tsx
// apps/web/src/app/platform-admin/simulator/page.tsx
"use client";

import { useState } from "react";
import { TransportBar } from "./_components/TransportBar";
import { useSimulator } from "./_hooks/use-simulator";

export default function SimulatorPage() {
  const [token] = useState<string | null>(null); // TODO: get from auth context

  const { run, events, loading, createRun, start, pause, stop, setSpeed, connectSSE } =
    useSimulator(token);

  const handleStart = async () => {
    if (!run) {
      const newRun = await createRun({});
      if (newRun) {
        await start();
        connectSSE();
      }
    } else {
      await start();
      connectSSE();
    }
  };

  return (
    <div className="flex h-full flex-col">
      <TransportBar
        status={run?.status ?? null}
        currentAct={run?.current_act ?? 0}
        speed={run?.speed ?? 1}
        onStart={handleStart}
        onPause={pause}
        onStop={stop}
        onSpeedChange={setSpeed}
      />

      <div className="flex flex-1 overflow-hidden">
        {/* Gates rail — Task 10 */}
        <div className="border-border w-64 shrink-0 overflow-y-auto border-r p-4">
          <p className="text-muted-foreground text-xs">Cascade gates (Task 10)</p>
        </div>

        {/* Main area — Event feed (Task 11) + Gap report (Task 12) */}
        <div className="flex-1 overflow-y-auto p-4">
          {!run && !loading && (
            <div className="flex h-full items-center justify-center">
              <div className="text-center">
                <h2 className="text-foreground mb-2 text-lg font-bold">Sjohuset Simulator</h2>
                <p className="text-muted-foreground mb-4 text-sm">
                  System proof: exercises every cascade dimension end-to-end.
                </p>
                <button
                  onClick={handleStart}
                  className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg px-4 py-2 text-sm font-medium"
                >
                  Start New Run
                </button>
              </div>
            </div>
          )}

          {events.length > 0 && (
            <div className="space-y-1">
              {events.map((evt) => (
                <div
                  key={evt.timeline_event_id}
                  className="bg-muted/50 flex items-center gap-3 rounded-lg px-3 py-2 text-sm"
                >
                  <span className="text-muted-foreground font-mono text-xs">Act {evt.act}</span>
                  <span className="font-medium">{evt.event_key}</span>
                  <span
                    className={`ml-auto text-xs ${
                      evt.status === "completed"
                        ? "text-emerald-400"
                        : evt.status === "failed"
                          ? "text-destructive"
                          : "text-muted-foreground"
                    }`}
                  >
                    {evt.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/platform-admin/simulator/
git commit -m "feat(simulation): add platform-admin simulator page with transport bar"
```

---

## Tasks 10-14: Remaining Components

Tasks 10-14 follow the same pattern. Each builds on the page scaffold from Task 9:

**Task 10: Cascade Gates Component** — `_components/CascadeGates.tsx`. Grouped toggle list (I1 | D1-D6 | C1-C4 | K1a/K1b) with 6px status dots and compact switches. Wired to `run_scope` via the hook.

**Task 11: Event Feed (Virtualized)** — `_components/EventFeed.tsx`. Uses `react-window` FixedSizeList. 4 color families. Auto-scroll with pin toggle. Click-to-expand with AnimatePresence.

**Task 12: Gap Report (Collapsible)** — `_components/GapReport.tsx`. Collapsible banner at top of feed area. Mini-cards per dimension with present/seedable/blocking/out_of_scope badges.

**Task 13: Sjohuset Scenario Definition** — `services/simulator/src/scenarios/sjohuset.ts`. TypeScript config defining all 10 acts with timeline events, expected coverage, and seed data aligned with `supabase/templates/restaurant/`.

**Task 14: Telemetry Events + Integration Test** — Register 5 simulator lifecycle events in `packages/telemetry/src/registry.ts`. Add `pnpm simulate:test` script in root `package.json`. Verify full loop completes with coverage report.

Each task follows the same structure: create file, implement, commit.

---

## Acceptance Criteria

- [ ] `simulation` schema exists with 7 tables, 5 enums
- [ ] Simulator service starts on port 5013 with health endpoint
- [ ] Gap analysis scans all cascade dimensions
- [ ] Seeding inserts into real tables with manifest tracking
- [ ] Timeline engine executes events sequentially
- [ ] Cleanup removes all seeded data via manifest
- [ ] SSE streams events to control panel
- [ ] Platform-admin page renders transport bar, gates, feed, gap report
- [ ] Sidebar nav shows "Simulator" under System
- [ ] Docker Compose entry builds and runs
- [ ] Typecheck passes: `pnpm turbo typecheck`
- [ ] ADR-0068 written and accepted
- [ ] Decision log updated
- [ ] User journeys written
