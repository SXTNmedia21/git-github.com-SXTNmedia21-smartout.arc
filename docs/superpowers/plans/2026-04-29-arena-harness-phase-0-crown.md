---
title: "Phase 0 — Crown (Arena Harness Migration)"
id: PLAN_ARENA_HARNESS_PHASE_0_CROWN
status: draft
phase: 0
created: 2026-04-29
updated: 2026-04-29
owner: harness-builder
worktree: ~/dev/smartout.ai-wt-4
branch: feat/botsson-harness-expansion
parent_plan: docs/plans/PLAN-arena-harness-migration.md
module: MODULE_BOTSSON
tags: [harness, arena, phase-0, crown, heartbeat, tdd]
---

# Phase 0 — Crown Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build heartbeat-dispatcher + one mission-pool slot that runs ONE dummy dev-mission end-to-end, producing the canonical 5-event journey trace, with zero disruption to existing surfaces.

**Architecture:** Strictly additive. Three nullable columns on `engine_state` + one new Edge Function (`heartbeat-dispatcher`) + one new worker file in `services/stage-engine/src/workers/` + one mission folder under `docs/journeys/dev-arena-bootstrap/` + one E2E spec. Heartbeat selects scheduled rows under `FOR UPDATE SKIP LOCKED`, sets `dispatch_lock_id`, fires `pg_notify('mission_dispatch', …)`. Worker `LISTEN`s, loads mission folder, runs stub agent loop, emits terminal event. No existing files altered.

**Tech Stack:** Postgres 17 (pg_cron, pg_notify, FOR UPDATE SKIP LOCKED), Supabase Edge Functions (Deno), Hono (stage-engine worker), Playwright (E2E spec), `@smartout/telemetry` `emit()`, existing `journey run_started` / `step_reached` / `completed` event registry.

---

## Premises Confirmed Against Codebase (2026-04-29)

| Premise | Source | Implication |
|---|---|---|
| Migration tip is `20260520100000_personal_task.sql` | `ls supabase/migrations/ \| tail -1` | New migration must be `>= 20260520110000` |
| `engine_state.status` CHECK = `('pending','active','waiting','complete','failed','escalated')` | `supabase/migrations/20260304100000_engine_process_tables.sql:138` | Must drop+recreate CHECK to include `'scheduled'` |
| `engine_state` has NO `mission_id` column | Same file:129-164 | Must add `mission_id TEXT` (additive) |
| `engine_state` HAS `workspace_id NOT NULL` | Same file:133 | Server-derive per ADR-0151 from row, not payload |
| RLS already enabled on `engine_state` | Same file:166 | New columns inherit policies; no policy update required |
| pg_cron pattern proven in `daily-session-replenish` | `supabase/migrations/20260428100100_daily_session_replenish_cron.sql` | Copy `IF EXISTS pg_extension WHERE extname='pg_cron'` guard |
| Cron auth via `WATCHDOG_CRON_SECRET` bearer token | `supabase/functions/journey-stuck-detector/index.ts:33-40` | Same pattern for `heartbeat-dispatcher`; `verify_jwt = false` in `config.toml` |
| `SYSTEM_ACTOR_ID = '00000000-0000-0000-0000-000000000001'` | `journey-stuck-detector/index.ts:71` | Use as `actor_id` for non-tenant heartbeat emits |
| Telemetry events already registered | `packages/telemetry/src/registry.ts` | Reuse `journey run_started`, `journey step_reached`, `journey completed`, `journey stuck`, `journey run_failed` — no new events |

---

## File Structure

| Action | Path | Responsibility |
|---|---|---|
| Create | `apps/e2e/tests/harness-candidate-0-crown.spec.ts` | Falsifiable acceptance: insert engine_state, wait for terminal, assert 4 events + dispatch_lock_id set |
| Create | `supabase/migrations/20260520110000_engine_state_scheduling.sql` | Add `scheduled_for`, `recurrence`, `dispatch_lock_id`, `mission_id`; extend status CHECK |
| Create | `supabase/functions/heartbeat-dispatcher/index.ts` | Cron entry; SELECT FOR UPDATE SKIP LOCKED; pg_notify('mission_dispatch') |
| Modify | `supabase/functions/config.toml` | Register `[functions.heartbeat-dispatcher] verify_jwt = false` |
| Create | `supabase/migrations/20260520110100_heartbeat_dispatcher_cron.sql` | Register pg_cron job (`*/1 * * * *` for crown), guarded by `pg_extension` check |
| Create | `services/stage-engine/src/workers/mission-pool-slot.ts` | LISTEN mission_dispatch; load mission folder; verify hash; run stub loop; emit terminal |
| Modify | `services/stage-engine/src/index.ts` | Boot mission-pool slot at server start (1 slot, single concurrency) |
| Create | `docs/journeys/dev-arena-bootstrap/MISSION.md` | Persona + 3 dummy stages |
| Create | `docs/journeys/dev-arena-bootstrap/LICENSE.md` | Authority profile `internal-platform-admin`, no workspace mutations |
| Create | `docs/journeys/dev-arena-bootstrap/RESCUE-PROMPT.md` | Minimal: log error, mark failed |
| Create | `docs/journeys/dev-arena-bootstrap/FLOW.md` | 4 rows: run_started, step_reached×2, completed |
| Create | `docs/journeys/dev-arena-bootstrap/ir/journey.yaml` | Minimal IR |
| Create | `docs/journeys/dev-arena-bootstrap/ir/journey.hash` | sha256 of journey.yaml |
| Update | `docs/architecture/BOTSSON-SYSTEM-MAP.md` | Add Phase 0 row, mark scheduling cols 🟢 after merge |

---

## Task 1: Write the Failing Harness-Candidate-0 Spec (TDD Red First)

**Why first:** Plan §Hard Constraint 7 — falsifiable acceptance precedes implementation. This spec runs red, proving nothing dispatches today.

**Files:**
- Create: `apps/e2e/tests/harness-candidate-0-crown.spec.ts`

- [ ] **Step 1.1: Write the spec**

```typescript
import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

test.describe("Harness Candidate 0 — Crown", () => {
  test("heartbeat dispatches dev-arena-bootstrap mission to terminal completion", async () => {
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // 1. Pick the seed test workspace
    const { data: ws } = await admin
      .from("workspace")
      .select("workspace_id")
      .limit(1)
      .single();
    expect(ws?.workspace_id, "test workspace must exist").toBeTruthy();
    const workspaceId = ws!.workspace_id as string;

    // 2. Insert scheduled engine_state row, ready for pickup (1 minute in past)
    const { data: row, error: insertErr } = await admin
      .from("engine_state")
      .insert({
        process_id: "dev-arena-bootstrap",
        mission_id: "dev-arena-bootstrap",
        workspace_id: workspaceId,
        status: "scheduled",
        scheduled_for: new Date(Date.now() - 60_000).toISOString(),
        context: { phase: 0, source: "harness-candidate-0" },
      })
      .select("id")
      .single();
    expect(insertErr, "scheduled insert must succeed").toBeNull();
    const stateId = row!.id as string;

    // 3. Poll up to 90s for terminal status
    const deadline = Date.now() + 90_000;
    let final: { status: string; dispatch_lock_id: string | null } | null = null;
    while (Date.now() < deadline) {
      const { data } = await admin
        .from("engine_state")
        .select("status, dispatch_lock_id")
        .eq("id", stateId)
        .single();
      if (data && data.status === "complete") {
        final = data;
        break;
      }
      await new Promise((r) => setTimeout(r, 2000));
    }
    expect(final, "engine_state must reach 'complete' within 90s").not.toBeNull();
    expect(final!.dispatch_lock_id, "dispatch_lock_id must be set by heartbeat").not.toBeNull();

    // 4. Assert exact event sequence
    const { data: events } = await admin
      .from("engine_event")
      .select("event_name")
      .eq("entity_type", "engine_state")
      .eq("entity_id", stateId)
      .order("fired_at", { ascending: true });

    const names = (events ?? []).map((e) => e.event_name);
    expect(names.filter((n) => n === "journey run_started")).toHaveLength(1);
    expect(names.filter((n) => n === "journey step_reached")).toHaveLength(2);
    expect(names.filter((n) => n === "journey completed")).toHaveLength(1);
    expect(names.filter((n) => n === "journey run_failed")).toHaveLength(0);
  });
});
```

- [ ] **Step 1.2: Run spec — verify it fails RED**

Run:
```bash
pnpm --filter @smartout/e2e exec playwright test tests/harness-candidate-0-crown.spec.ts --reporter=list
```

Expected: FAIL on either insert (status='scheduled' not in CHECK + mission_id column missing) OR on terminal-status timeout (no dispatcher exists).

- [ ] **Step 1.3: Commit**

```bash
git add apps/e2e/tests/harness-candidate-0-crown.spec.ts
git commit -m "$(cat <<'EOF'
phase-0-step-1: harness-candidate-0 spec (red)

Falsifiable acceptance for Phase 0 crown. Asserts heartbeat dispatch
end-to-end: insert engine_state status='scheduled', wait 90s for
status='complete', verify dispatch_lock_id set + 4-event journey trace
(run_started + step_reached×2 + completed) emitted to engine_event.

Currently fails at insert (status='scheduled' rejected by CHECK,
mission_id column does not exist) — proving the gap. Becomes green
after Tasks 2–5 land.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Migration — Scheduling Columns + Status CHECK + mission_id

**Why:** Spec needs `status='scheduled'`, `mission_id`, `scheduled_for`, `dispatch_lock_id`. All additive on existing `engine_state`.

**Files:**
- Create: `supabase/migrations/20260520110000_engine_state_scheduling.sql`

- [ ] **Step 2.1: Write migration**

```sql
-- ============================================
-- 20260520110000_engine_state_scheduling.sql
-- Phase 0 (Crown) — heartbeat-dispatcher prerequisites.
-- Strictly additive: 4 nullable columns + extended status CHECK.
-- Existing rows unaffected (scheduled_for IS NULL, mission_id IS NULL).
-- See docs/plans/PLAN-arena-harness-migration.md §Phase 0 Step 0.1
-- and docs/superpowers/plans/2026-04-29-arena-harness-phase-0-crown.md.
-- ============================================

-- ── Columns ───────────────────────────────────────────────────
ALTER TABLE public.engine_state
  ADD COLUMN IF NOT EXISTS scheduled_for    timestamptz,
  ADD COLUMN IF NOT EXISTS recurrence       interval,
  ADD COLUMN IF NOT EXISTS dispatch_lock_id uuid,
  ADD COLUMN IF NOT EXISTS mission_id       text;

COMMENT ON COLUMN public.engine_state.scheduled_for IS
  'Heartbeat dispatch time. NULL = legacy/run-now. Past timestamp = ready for pickup.';
COMMENT ON COLUMN public.engine_state.recurrence IS
  'Re-schedule interval after terminal status. NULL = one-shot.';
COMMENT ON COLUMN public.engine_state.dispatch_lock_id IS
  'Set by heartbeat under FOR UPDATE SKIP LOCKED to prevent double-dispatch.';
COMMENT ON COLUMN public.engine_state.mission_id IS
  'Mission folder slug under docs/journeys/. Bridges engine_state and engine_sessions ontologies (B1 gap, ADR-0245).';

-- ── Extend status CHECK to include 'scheduled' ────────────────
ALTER TABLE public.engine_state
  DROP CONSTRAINT IF EXISTS engine_state_status_check;

ALTER TABLE public.engine_state
  ADD CONSTRAINT engine_state_status_check
  CHECK (status IN ('pending', 'active', 'waiting', 'complete', 'failed', 'escalated', 'scheduled'));

-- ── Dispatch index: only scheduled rows past their scheduled_for ──
CREATE INDEX IF NOT EXISTS idx_engine_state_dispatch
  ON public.engine_state (scheduled_for)
  WHERE status = 'scheduled' AND scheduled_for IS NOT NULL;

-- ── Mission index: lookup by mission slug ─────────────────────
CREATE INDEX IF NOT EXISTS idx_engine_state_mission
  ON public.engine_state (mission_id)
  WHERE mission_id IS NOT NULL;
```

- [ ] **Step 2.2: Apply locally**

Run:
```bash
docker exec -i $(docker ps -q -f name=supabase_db) psql -U postgres < supabase/migrations/20260520110000_engine_state_scheduling.sql
```

Expected output: `ALTER TABLE`, `COMMENT` ×4, `ALTER TABLE` ×2, `CREATE INDEX` ×2.

- [ ] **Step 2.3: Verify columns + constraint**

Run:
```bash
docker exec -i $(docker ps -q -f name=supabase_db) psql -U postgres -c "\d public.engine_state" | grep -E "scheduled_for|recurrence|dispatch_lock_id|mission_id|status"
```

Expected: 4 new columns visible; status check includes `'scheduled'`.

- [ ] **Step 2.4: Verify idempotency**

Run twice:
```bash
docker exec -i $(docker ps -q -f name=supabase_db) psql -U postgres < supabase/migrations/20260520110000_engine_state_scheduling.sql
```

Expected: second run emits `NOTICE: column "X" of relation "engine_state" already exists, skipping` for each column. No errors.

- [ ] **Step 2.5: Regenerate types**

Run:
```bash
npx supabase gen types typescript --local > packages/supabase/src/database.types.ts
```

Expected: diff shows new columns in `engine_state` Row/Insert/Update types.

- [ ] **Step 2.6: Commit**

```bash
git add supabase/migrations/20260520110000_engine_state_scheduling.sql packages/supabase/src/database.types.ts
git commit -m "$(cat <<'EOF'
phase-0-step-2: engine_state scheduling columns + mission_id

Adds 4 nullable columns (scheduled_for, recurrence, dispatch_lock_id,
mission_id) and extends status CHECK to allow 'scheduled'. All additive;
existing rows unaffected. mission_id bridges engine_state vs
engine_sessions ontologies (B1 phantom-consumer gap, ADR-0245 pending).

Two indexes: idx_engine_state_dispatch (partial, scheduled rows ready
for pickup) and idx_engine_state_mission (mission slug lookup).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Heartbeat-Dispatcher Edge Function

**Why:** Crown of the crown. Cron picks up scheduled rows under `FOR UPDATE SKIP LOCKED`, locks them, notifies workers.

**Files:**
- Create: `supabase/functions/heartbeat-dispatcher/index.ts`
- Modify: `supabase/functions/config.toml`
- Create: `supabase/migrations/20260520110100_heartbeat_dispatcher_cron.sql`

- [ ] **Step 3.1: Write Edge Function**

```typescript
/**
 * heartbeat-dispatcher — Phase 0 (Crown) — Arena Harness Migration
 *
 * Runs on pg_cron schedule (`*/1 * * * *` for crown). Selects up to 50
 * `engine_state` rows where `status='scheduled' AND scheduled_for <= now()`
 * under `FOR UPDATE SKIP LOCKED`. Sets `dispatch_lock_id`, flips status
 * to `'pending'`, and fires `pg_notify('mission_dispatch', json)` per row.
 *
 * Auth: bearer token must equal `WATCHDOG_CRON_SECRET`.
 * Config: `verify_jwt = false` in supabase/functions/config.toml.
 *
 * See:
 * - docs/plans/PLAN-arena-harness-migration.md §Phase 0 Step 0.2
 * - docs/superpowers/plans/2026-04-29-arena-harness-phase-0-crown.md Task 3
 * - ADR-0151 (workspace_id server-derived)
 * - ADR-0175 (telemetry events frozen)
 */

import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // ── Auth ────────────────────────────────────────────────────
  const auth = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${Deno.env.get("WATCHDOG_CRON_SECRET") ?? ""}`;
  if (!Deno.env.get("WATCHDOG_CRON_SECRET") || auth !== expected) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  // ── Pick up scheduled rows under FOR UPDATE SKIP LOCKED ─────
  // Single SQL statement: UPDATE … RETURNING avoids race between SELECT and UPDATE.
  const { data: dispatched, error } = await supabase.rpc("heartbeat_pickup", {
    p_limit: 50,
  });

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }

  // ── pg_notify per dispatched row ────────────────────────────
  // Done inside the RPC for atomicity; this loop is observability only.
  return new Response(
    JSON.stringify({
      mode: "cron",
      dispatched: (dispatched ?? []).length,
      rows: dispatched,
    }),
    { headers: { ...corsHeaders, "content-type": "application/json" } },
  );
});
```

- [ ] **Step 3.2: Add `heartbeat_pickup` RPC to migration (atomic UPDATE+NOTIFY)**

Append to `supabase/migrations/20260520110000_engine_state_scheduling.sql` (or new sub-migration):

```sql
-- ── heartbeat_pickup RPC ──────────────────────────────────────
-- Atomic SELECT FOR UPDATE SKIP LOCKED + UPDATE + pg_notify.
-- Returns dispatched rows for observability.
CREATE OR REPLACE FUNCTION public.heartbeat_pickup(p_limit int DEFAULT 50)
RETURNS TABLE(id uuid, mission_id text, workspace_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  r record;
BEGIN
  FOR r IN
    UPDATE public.engine_state es
    SET status = 'pending',
        dispatch_lock_id = gen_random_uuid(),
        updated_at = now()
    WHERE es.id IN (
      SELECT inner_es.id
      FROM public.engine_state inner_es
      WHERE inner_es.status = 'scheduled'
        AND inner_es.scheduled_for <= now()
      ORDER BY inner_es.scheduled_for ASC
      LIMIT p_limit
      FOR UPDATE SKIP LOCKED
    )
    RETURNING es.id, es.mission_id, es.workspace_id
  LOOP
    PERFORM pg_notify(
      'mission_dispatch',
      json_build_object(
        'engine_state_id', r.id,
        'mission_id', r.mission_id,
        'workspace_id', r.workspace_id
      )::text
    );
    id := r.id;
    mission_id := r.mission_id;
    workspace_id := r.workspace_id;
    RETURN NEXT;
  END LOOP;
END $$;

REVOKE ALL ON FUNCTION public.heartbeat_pickup(int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.heartbeat_pickup(int) TO service_role;
```

Re-apply the migration (idempotent due to `OR REPLACE`).

- [ ] **Step 3.3: Register function in `config.toml`**

Add at end of `supabase/functions/config.toml`:

```toml
[functions.heartbeat-dispatcher]
verify_jwt = false  # Cron-only — auth via WATCHDOG_CRON_SECRET bearer
```

- [ ] **Step 3.4: Write pg_cron migration**

`supabase/migrations/20260520110100_heartbeat_dispatcher_cron.sql`:

```sql
-- ============================================
-- 20260520110100_heartbeat_dispatcher_cron.sql
-- Phase 0 (Crown) — register pg_cron job for heartbeat-dispatcher.
-- Skipped silently in environments without pg_cron (e.g. Supabase Local).
-- Local dev uses manual invocation per Task 6.
-- ============================================

DO $cmd$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'heartbeat-dispatcher',
      '*/1 * * * *',
      $sql$SELECT net.http_post(
        url := current_setting('app.supabase_url', true) || '/functions/v1/heartbeat-dispatcher',
        headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.watchdog_cron_secret', true))
      )$sql$
    );
  ELSE
    RAISE NOTICE 'pg_cron not enabled — heartbeat-dispatcher must be invoked manually (curl from Task 6)';
  END IF;
END $cmd$;
```

- [ ] **Step 3.5: Apply both migrations + verify**

Run:
```bash
docker exec -i $(docker ps -q -f name=supabase_db) psql -U postgres < supabase/migrations/20260520110000_engine_state_scheduling.sql
docker exec -i $(docker ps -q -f name=supabase_db) psql -U postgres < supabase/migrations/20260520110100_heartbeat_dispatcher_cron.sql
docker exec -i $(docker ps -q -f name=supabase_db) psql -U postgres -c "SELECT proname FROM pg_proc WHERE proname = 'heartbeat_pickup';"
```

Expected: `heartbeat_pickup` listed once.

- [ ] **Step 3.6: Smoke-test the RPC**

Run:
```bash
docker exec -i $(docker ps -q -f name=supabase_db) psql -U postgres -c "SELECT * FROM public.heartbeat_pickup(50);"
```

Expected: empty result (no scheduled rows yet) — proves no error.

- [ ] **Step 3.7: Commit**

```bash
git add supabase/functions/heartbeat-dispatcher supabase/functions/config.toml supabase/migrations/20260520110100_heartbeat_dispatcher_cron.sql supabase/migrations/20260520110000_engine_state_scheduling.sql
git commit -m "$(cat <<'EOF'
phase-0-step-3: heartbeat-dispatcher Edge Function + heartbeat_pickup RPC

Cron-driven (`*/1 * * * *`) atomic dispatcher. heartbeat_pickup RPC
combines SELECT FOR UPDATE SKIP LOCKED + UPDATE status=pending +
dispatch_lock_id + pg_notify('mission_dispatch') in a single
transaction. Edge Function is the cron entry point only;
all dispatch logic lives in SQL for atomicity.

Auth: WATCHDOG_CRON_SECRET bearer (config.toml verify_jwt=false).
SECURITY DEFINER on RPC; EXECUTE granted to service_role only.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Mission-Pool Slot Worker

**Why:** Listens for `pg_notify('mission_dispatch')`; loads mission folder; runs stub agent loop; emits 4-event journey trace; flips terminal status.

**Files:**
- Create: `services/stage-engine/src/workers/mission-pool-slot.ts`
- Modify: `services/stage-engine/src/index.ts` (boot the slot)

- [ ] **Step 4.1: Write the worker**

```typescript
// services/stage-engine/src/workers/mission-pool-slot.ts
//
// Phase 0 (Crown) — single mission-pool slot.
// LISTENs on pg_notify channel 'mission_dispatch'. Per notification:
//   1. Fetch engine_state row by id
//   2. Load mission folder (docs/journeys/<mission_id>/)
//   3. Verify ir/journey.hash == sha256(ir/journey.yaml)
//   4. Run stub stage loop (3 dummy stages)
//   5. Emit run_started + step_reached×2 + completed
//   6. Flip engine_state.status='complete', set completed_at
//
// Guardrails:
//   - workspace_id derived from row, never from notify payload (ADR-0151)
//   - hash mismatch → emit run_failed, mark failed
//   - never advance past stages defined in mission.yaml

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { Client as PgClient } from "pg";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { emit } from "@smartout/telemetry";

const REPO_ROOT = process.env.REPO_ROOT ?? process.cwd();
const SYSTEM_ACTOR_ID = "00000000-0000-0000-0000-000000000001";

type DispatchPayload = {
  engine_state_id: string;
  mission_id: string | null;
  workspace_id: string;
};

async function loadMission(missionId: string) {
  const dir = join(REPO_ROOT, "docs/journeys", missionId);
  const yaml = await readFile(join(dir, "ir/journey.yaml"), "utf8");
  const expected = (await readFile(join(dir, "ir/journey.hash"), "utf8")).trim();
  const actual = createHash("sha256").update(yaml).digest("hex");
  if (actual !== expected) {
    throw new Error(`mission.tampered: hash mismatch for ${missionId}`);
  }
  return { dir, yaml };
}

async function runMission(
  supabase: SupabaseClient,
  payload: DispatchPayload,
): Promise<void> {
  const { engine_state_id, mission_id, workspace_id } = payload;
  if (!mission_id) {
    await markFailed(supabase, engine_state_id, "missing mission_id");
    return;
  }
  if (!workspace_id) {
    await markFailed(supabase, engine_state_id, "missing workspace_id");
    return;
  }

  // ── Fetch row to confirm it's still ours ──────────────────
  const { data: state, error: fetchErr } = await supabase
    .from("engine_state")
    .select("id, dispatch_lock_id, status")
    .eq("id", engine_state_id)
    .single();
  if (fetchErr || !state) {
    return; // row gone — nothing to do
  }
  if (state.status !== "pending") {
    return; // someone else got it
  }

  try {
    await loadMission(mission_id);
  } catch (e) {
    const reason = (e as Error).message;
    emit("journey run_failed", {
      workspaceId: workspace_id,
      actorId: SYSTEM_ACTOR_ID,
      runId: engine_state_id,
      missionId: mission_id,
      reason,
    });
    await markFailed(supabase, engine_state_id, reason);
    return;
  }

  // ── Flip to active + emit run_started ────────────────────
  await supabase
    .from("engine_state")
    .update({ status: "active", updated_at: new Date().toISOString() })
    .eq("id", engine_state_id);
  emit("journey run_started", {
    workspaceId: workspace_id,
    actorId: SYSTEM_ACTOR_ID,
    runId: engine_state_id,
    missionId: mission_id,
  });

  // ── Stub: 2 step_reached events ──────────────────────────
  for (const stepKey of ["step-1", "step-2"]) {
    emit("journey step_reached", {
      workspaceId: workspace_id,
      actorId: SYSTEM_ACTOR_ID,
      runId: engine_state_id,
      missionId: mission_id,
      stepKey,
    });
  }

  // ── Terminal: complete ───────────────────────────────────
  await supabase
    .from("engine_state")
    .update({
      status: "complete",
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", engine_state_id);
  emit("journey completed", {
    workspaceId: workspace_id,
    actorId: SYSTEM_ACTOR_ID,
    runId: engine_state_id,
    missionId: mission_id,
  });
}

async function markFailed(
  supabase: SupabaseClient,
  stateId: string,
  reason: string,
): Promise<void> {
  await supabase
    .from("engine_state")
    .update({
      status: "failed",
      last_error: reason,
      updated_at: new Date().toISOString(),
    })
    .eq("id", stateId);
}

export async function startMissionPoolSlot(): Promise<void> {
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );

  const pg = new PgClient({ connectionString: process.env.DATABASE_URL });
  await pg.connect();
  await pg.query("LISTEN mission_dispatch");

  pg.on("notification", (msg) => {
    if (msg.channel !== "mission_dispatch" || !msg.payload) return;
    let payload: DispatchPayload;
    try {
      payload = JSON.parse(msg.payload) as DispatchPayload;
    } catch {
      console.error("[mission-pool] bad payload:", msg.payload);
      return;
    }
    runMission(supabase, payload).catch((e) =>
      console.error("[mission-pool] run failed:", e),
    );
  });

  console.log("[mission-pool] slot 1 listening on mission_dispatch");
}
```

- [ ] **Step 4.2: Boot the slot from `services/stage-engine/src/index.ts`**

Add near server boot (after env validation):

```typescript
import { startMissionPoolSlot } from "./workers/mission-pool-slot.js";

// Phase 0 (Crown) — single mission-pool slot.
if (process.env.ENABLE_MISSION_POOL !== "false") {
  void startMissionPoolSlot();
}
```

- [ ] **Step 4.3: Typecheck**

Run:
```bash
pnpm --filter @smartout/stage-engine typecheck
```

Expected: 0 errors. If `pg` types missing, add: `pnpm --filter @smartout/stage-engine add -D @types/pg pg`.

- [ ] **Step 4.4: Commit**

```bash
git add services/stage-engine/src/workers/mission-pool-slot.ts services/stage-engine/src/index.ts services/stage-engine/package.json
git commit -m "$(cat <<'EOF'
phase-0-step-4: mission-pool slot worker (single concurrency)

LISTEN mission_dispatch → load mission folder → verify hash → emit
4-event journey trace → flip engine_state.status='complete'. Workspace
derived from engine_state row server-side (ADR-0151). Hash mismatch
emits journey.run_failed + marks failed.

Stub stage loop only (3 dummy steps); full FLOW broker deferred to
Phase 1+. Boot guarded by ENABLE_MISSION_POOL=true (default).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: dev-arena-bootstrap Mission Folder

**Why:** Worker needs a real mission folder + hash to verify against. Path-prefix `dev-` distinguishes from customer journeys (skip ROADMAP.md per parent plan).

**Files (all create):**
- `docs/journeys/dev-arena-bootstrap/MISSION.md`
- `docs/journeys/dev-arena-bootstrap/LICENSE.md`
- `docs/journeys/dev-arena-bootstrap/RESCUE-PROMPT.md`
- `docs/journeys/dev-arena-bootstrap/FLOW.md`
- `docs/journeys/dev-arena-bootstrap/ir/journey.yaml`
- `docs/journeys/dev-arena-bootstrap/ir/journey.hash`

- [ ] **Step 5.1: Write `MISSION.md`**

```markdown
---
title: "Dev Arena Bootstrap (Phase 0 dummy mission)"
mission_id: dev-arena-bootstrap
phase: 0
persona: harness-builder
created: 2026-04-29
updated: 2026-04-29
---

# Dev Arena Bootstrap

Smoke-test mission for the heartbeat-dispatcher → mission-pool pipeline.
Worker runs three dummy stages and emits the canonical 4-event journey
trace. No external side effects, no LLM calls, no capability invocations.

## Stages

1. **Acknowledge dispatch** — proves notify reached worker.
2. **Mid-step probe** — proves multi-step traversal increments correctly.
3. **Terminal** — proves status flip to `complete` + `journey completed`
   emit.

## Success criteria

- engine_state.status transitions: scheduled → pending → active → complete.
- engine_event sequence: run_started, step_reached, step_reached, completed.
- dispatch_lock_id is non-null after pickup.

## Acceptance

`apps/e2e/tests/harness-candidate-0-crown.spec.ts` green 3× consecutive.
```

- [ ] **Step 5.2: Write `LICENSE.md`**

```markdown
---
title: "License — dev-arena-bootstrap"
mission_id: dev-arena-bootstrap
authority_profile: internal-platform-admin
phase: 0
---

# Authority License

Phase 0 dummy mission — performs no capability calls, no shell, no DB
mutations beyond engine_state self-update. Operates at
`internal-platform-admin` scope only. No customer-data access.

## Allowed

- Update own engine_state row (status, dispatch_lock_id, completed_at).
- Emit telemetry events to engine_event/activity_trail via @smartout/telemetry.

## Denied

- Any other table mutation.
- Any capability tool invocation.
- Shell, network, filesystem outside `docs/journeys/dev-arena-bootstrap/`.
```

- [ ] **Step 5.3: Write `RESCUE-PROMPT.md`**

```markdown
---
title: "Rescue prompt — dev-arena-bootstrap"
mission_id: dev-arena-bootstrap
phase: 0
---

# Rescue

Phase 0 stub. On any error: log message, emit `journey run_failed`,
flip `engine_state.status='failed'`. No retry. No escalation.

Future phases will load real RESCUE-PROMPT into agent context.
```

- [ ] **Step 5.4: Write `FLOW.md`**

```markdown
---
title: "Flow — dev-arena-bootstrap"
mission_id: dev-arena-bootstrap
phase: 0
---

# Flow

| Step | Actor | Event              | Notes |
|------|-------|--------------------|-------|
| 0    | agent | journey run_started | Dispatcher pickup confirmed |
| 1    | agent | journey step_reached | Stub step-1 |
| 2    | agent | journey step_reached | Stub step-2 |
| 3    | agent | journey completed   | Terminal |

All events bound to `packages/telemetry/src/registry.ts`. No new events.
```

- [ ] **Step 5.5: Write `ir/journey.yaml`**

```yaml
mission_id: dev-arena-bootstrap
version: 1
phase: 0
stages:
  - id: step-1
    actor: agent
    event: journey step_reached
  - id: step-2
    actor: agent
    event: journey step_reached
  - id: complete
    actor: agent
    event: journey completed
```

- [ ] **Step 5.6: Compute and write hash**

Run:
```bash
HASH=$(sha256sum docs/journeys/dev-arena-bootstrap/ir/journey.yaml | awk '{print $1}')
printf '%s\n' "$HASH" > docs/journeys/dev-arena-bootstrap/ir/journey.hash
cat docs/journeys/dev-arena-bootstrap/ir/journey.hash
```

Expected: 64-char hex string ending with newline.

- [ ] **Step 5.7: Commit**

```bash
git add docs/journeys/dev-arena-bootstrap/
git commit -m "$(cat <<'EOF'
phase-0-step-5: dev-arena-bootstrap mission folder

Six-file minimal mission (MISSION/LICENSE/RESCUE-PROMPT/FLOW + ir/yaml +
ir/hash). Path-prefix `dev-` distinguishes from customer journeys (no
ROADMAP.md required). Three dummy stages emit run_started +
step_reached×2 + completed. No capability calls, no LLM, no side
effects. Worker verifies sha256(ir/journey.yaml) == ir/journey.hash
before boot.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Run Spec to Green — 3 Consecutive Passes

**Why:** Plan §Phase 0 gate requires 3× green. Single pass could be flake.

**Files (none modified):**

- [ ] **Step 6.1: Boot stage-engine with mission-pool enabled**

Run (in another shell):
```bash
op run --env-file=.env.template -- pnpm --filter @smartout/stage-engine dev
```

Expected log line: `[mission-pool] slot 1 listening on mission_dispatch`.

- [ ] **Step 6.2: Manual heartbeat invocation (Supabase Local has no pg_cron)**

Run:
```bash
curl -X POST "$NEXT_PUBLIC_SUPABASE_URL/functions/v1/heartbeat-dispatcher" \
  -H "Authorization: Bearer $WATCHDOG_CRON_SECRET" \
  -H "content-type: application/json"
```

Expected: `{"mode":"cron","dispatched":0,"rows":[]}` (no scheduled rows yet).

- [ ] **Step 6.3: Run spec — first pass**

Run:
```bash
pnpm --filter @smartout/e2e exec playwright test tests/harness-candidate-0-crown.spec.ts --reporter=list
```

If FAIL: read failure message. Common causes:
- `dispatched: 0` after 90s → heartbeat not running. Add a manual `curl` loop in spec, or add `setInterval` to spec polling that hits the cron URL.
- `dispatch_lock_id IS NULL` → RPC didn't UPDATE; check `heartbeat_pickup` SECURITY DEFINER + service_role grant.
- Event count off → check emit() registry binding in `packages/telemetry/src/registry.ts`. No new events allowed.
- `mission.tampered` → recompute hash (Step 5.6).

Iterate until: 1 PASS.

- [ ] **Step 6.4: Run spec — second pass**

Run same command. Expected: PASS.

- [ ] **Step 6.5: Run spec — third pass**

Run same command. Expected: PASS.

- [ ] **Step 6.6: Verify no regression on existing E2E**

Run:
```bash
pnpm turbo test:e2e --filter @smartout/e2e
```

Expected: existing suites status unchanged from `main`. (Skips on this branch are pre-existing.)

- [ ] **Step 6.7: Verify migration idempotency end-to-end**

Run:
```bash
npx supabase db reset
docker exec -i $(docker ps -q -f name=supabase_db) psql -U postgres -c "\d public.engine_state" | grep -c "scheduled_for"
```

Expected: `1` (column exists after fresh reset).

- [ ] **Step 6.8: Commit (no code change — but document the green run)**

Append a one-line entry to `docs/architecture/BOTSSON-SYSTEM-MAP.md`:

```markdown
- 2026-04-29 — Phase 0 Crown: heartbeat-dispatcher + mission-pool slot 🟢. Harness Candidate 0 green 3× consecutive.
```

```bash
git add docs/architecture/BOTSSON-SYSTEM-MAP.md
git commit -m "$(cat <<'EOF'
phase-0-step-6: harness-candidate-0 green 3× — mark crown 🟢

System-map updated. Phase 0 gate met: spec green 3 consecutive runs,
no regression on existing E2E, migration idempotent on db reset.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Phase 0 PR

**Files (none modified):**

- [ ] **Step 7.1: Verify branch state**

Run:
```bash
git log --grep "phase-0" --oneline
```

Expected: ≥ 6 commits prefixed `phase-0-step-N`.

- [ ] **Step 7.2: Push branch**

Run:
```bash
git push -u origin feat/botsson-harness-expansion
```

- [ ] **Step 7.3: Open PR to development**

Run:
```bash
gh pr create --base development --title "phase-0: arena harness crown (heartbeat dispatcher)" --body "$(cat <<'EOF'
## Summary

Phase 0 (Crown) of the Arena Harness Migration. Strictly additive:
- 4 nullable cols on `engine_state` + extended status CHECK
- `heartbeat_pickup` SQL RPC (atomic SELECT FOR UPDATE SKIP LOCKED + UPDATE + pg_notify)
- `heartbeat-dispatcher` Edge Function (cron entry point)
- `services/stage-engine/src/workers/mission-pool-slot.ts` (single LISTEN slot)
- `docs/journeys/dev-arena-bootstrap/` (6-file dummy mission)
- `apps/e2e/tests/harness-candidate-0-crown.spec.ts` (falsifiable acceptance)

No existing files altered beyond `services/stage-engine/src/index.ts` (boot hook) and `supabase/functions/config.toml` (function registration). Zero customer surface impact.

## Plan reference

- Strategic: `docs/plans/PLAN-arena-harness-migration.md` §Phase 0
- Bite-sized: `docs/superpowers/plans/2026-04-29-arena-harness-phase-0-crown.md`

## Test plan

- [x] `harness-candidate-0-crown.spec.ts` green 3× consecutive
- [x] Migration idempotent (`supabase db reset` re-applies clean)
- [x] No regression on existing E2E suite
- [x] `pnpm turbo typecheck` 0 errors

## Risks

- pg_cron is absent on Supabase Local; cron migration is a no-op there. Production cron requires `pg_cron` enabled and `app.watchdog_cron_secret` GUC set.
- `mission_id` column extends engine_state ontology (B1 gap). ADR-0245 council still pending; this column is the bridge — not a final commitment to either ontology.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 7.4: Stop. Wait for Pontus review.**

Phase 0 ends here. Phase 1 (real ADR-writer mission) starts after merge.

---

## Self-Review

**Spec coverage:**

- §Why (B1 phantom-consumer): addressed by `mission_id` column bridge in Task 2.
- §Why (no N-C worker): addressed by mission-pool slot in Task 4.
- §Hard constraint 1 (additive only): every file is new except `index.ts` boot-hook + `config.toml` registration.
- §Hard constraint 5 (workspace_id server-derived): Task 4 reads from row, never payload.
- §Hard constraint 6 (RLS on new columns): inherited from existing engine_state policies.
- §Hard constraint 7 (test first): Task 1 precedes Tasks 2–5.
- §Hard constraint 8 (phase frontmatter): every new doc has `phase: 0`.
- §Hard constraint 9 (commit prefix): every commit subject `phase-0-step-N:`.
- §Phase 0 Step 0.1 (migration): Task 2.
- §Phase 0 Step 0.2 (heartbeat EF): Task 3.
- §Phase 0 Step 0.3 (mission-pool slot): Task 4.
- §Phase 0 Step 0.4 (mission folder): Task 5.
- §Phase 0 Step 0.5 (acceptance test): Task 1 (red) + Task 6 (green 3×).
- §Phase 0 gate (5 commits + 3× green + no regression + idempotent): Tasks 6 + 7.

**Placeholder scan:** none.

**Type consistency:** `mission_id` is `TEXT` everywhere. `dispatch_lock_id` is `uuid`. `engine_state_id` consistently `uuid`. Event names quoted exactly: `journey run_started`, `journey step_reached`, `journey completed`, `journey run_failed` (space-separated, matches existing registry).

**Findings beyond strategic plan:**
1. **Status CHECK extension required.** Strategic plan did not call this out — would have failed Task 1 insert silently.
2. **`mission_id` column missing.** Strategic plan referenced `engine_state.mission_id` in pg_notify payload but no column exists. Added in Task 2.
3. **Atomic RPC over EF-side UPDATE+NOTIFY.** Reduces race risk (avoids round-trip between SELECT lock and UPDATE).
4. **RPC SECURITY DEFINER + grant** required because heartbeat-dispatcher runs as service_role but may not have direct UPDATE rights on engine_state under stricter future RLS.

---

## Execution Handoff

Plan complete and saved. Two execution options:

**1. Subagent-Driven (recommended)** — dispatch `botsson-harness-builder` subagent per task; review between tasks.

**2. Inline Execution** — execute tasks in this session using executing-plans, batch with checkpoints.

Recommend **1** for Phase 0: harness-builder agent has the system-map context + cross-cutting laws baked in, and Pontus reviews per-task vs per-batch reduces blast radius if a step needs redesign.
