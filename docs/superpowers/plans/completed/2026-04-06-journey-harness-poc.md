---
title: "Journey Harness PoC — Implementation Plan"
status: ready
updated: 2026-04-06
created: 2026-04-06
module: ai-agent
tags: [journey, harness, poc, plan]
---

# Journey Harness PoC Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prove the Journey Harness chain end-to-end for Journey 03 (Sjekke vakter): web emit → engine_event → engine_state created and advanced → guardian_signal on stuck → push notification rescue.

**Architecture:** Use the existing Event Engine (`engine_process` + `engine_state` + `engine_state_step`) with `wait_for_event` step advancement. Telemetry events route through the canonical `emit()` function via Server Actions (avoids client-side dev short-circuit). A dedicated Edge Function on pg_cron polls for stuck states. A trigger on `guardian_signal` fires `dispatch_push_notification()`.

**Tech Stack:** Next.js App Router (Server Actions), TypeScript strict, Supabase (PostgreSQL + Edge Functions + pg_cron + pg_net), `@smartout/telemetry`, Zod schemas.

**Spec:** `docs/superpowers/specs/2026-04-06-journey-harness-poc-instruction.md`

**Branch:** `feat/journey-harness-poc` (work in a worktree, never on `development`)

---

## File Structure

### Files to create

| Path | Responsibility |
|------|----------------|
| `supabase/migrations/20260406150000_journey_03_poc_seed.sql` | Seeds `engine_process`, `engine_step`, and `engine_trigger` for Journey 03 |
| `supabase/migrations/20260406150100_guardian_signal_push_trigger.sql` | DB trigger on `guardian_signal` INSERT that fires `dispatch_push_notification()` for `domain = 'journey_health'` |
| `supabase/functions/journey-stuck-detector/index.ts` | Edge Function: queries stuck `engine_state` rows and inserts `guardian_signal` |
| `apps/web/src/app/dashboard/my-schedule/actions.ts` | Server Actions: `markShiftListViewed()`, `markShiftDetailViewed()` — call `emit()` server-side |

### Files to modify

| Path | Change |
|------|--------|
| `packages/telemetry/src/registry.ts` | Add `list_viewed` and `detail_viewed` to `ActionVerb`; add `ShiftListViewed` and `ShiftDetailViewed` interfaces; add to `SmartoutEvent` union; add `EVENT_ROUTING` entries |
| `packages/ai/src/capabilities/guardian/tools.ts` | Add `journey_health` to the Zod `domain` enum (line 13) |
| `apps/web/src/app/dashboard/my-schedule/_components/MyWeekView.tsx` | Call `markShiftListViewed()` Server Action on mount; call `markShiftDetailViewed()` on shift card click |
| `apps/mobile/store-listing/journeys/03-check-shifts/EVENT-SEQUENCE.md` | Replace `page_viewed (shifts)` and `button_clicked (shift_detail)` with `shift list_viewed` and `shift detail_viewed` |

### Files NOT to touch

```
apps/mobile/                              ← Phase 2 (per spec C1)
services/stage-engine/                    ← separate scope
apps/web/src/app/platform-admin/          ← no UI changes
packages/ai/src/journey/compile.ts        ← read for patterns, don't modify
supabase/migrations/*journey_system*      ← dev-tracking tables, hands off
.claude/agents/journey-inference.md       ← agent definition, separate ticket
docs/decisions/                           ← council handles ADRs
```

---

## Task 0: Prerequisite Verification (BLOCKING — run before any code)

The build agent must verify all 8 prerequisites from the spec and document findings in `apps/e2e/HANDOFF-journey-harness-poc.md` before writing any code. If any item fails, STOP and report.

**Files:**
- Create: `apps/e2e/HANDOFF-journey-harness-poc.md`

- [ ] **Step 0.1: Create the worktree and HANDOFF file**

```bash
cd ~/dev/smartout.ai
git worktree add ../wt-N feat/journey-harness-poc
cd ../wt-N
mkdir -p apps/e2e
cat > apps/e2e/HANDOFF-journey-harness-poc.md <<'EOF'
---
title: "Journey Harness PoC HANDOFF"
status: in_progress
updated: 2026-04-06
created: 2026-04-06
module: ai-agent
tags: [journey, harness, poc, handoff]
---

# Journey Harness PoC HANDOFF

## Prerequisite Findings (Task 0)

(filled in by build agent)
EOF
```

- [ ] **Step 0.2: Verify engine-dispatch resume-waiting logic and quote line 411**

Read `supabase/functions/engine-dispatch/index.ts` lines 370-461.

Quote line 411 verbatim in HANDOFF. Expected line:
```ts
(currentStep.action_payload as Record<string, unknown>)?.event === event_type &&
```

If the matcher reads any other key (`event_type`, `event_name`, etc.), the spec is wrong — STOP and report.

Cross-check against existing seed:
```bash
grep -A1 "wait_for_event" supabase/migrations/20260304300000_seed_daily_close_process.sql
```
Expected: `'{ "event": "reconciliation.admin_action", ...'`

- [ ] **Step 0.3: Verify `dispatch_push_notification()` exists with expected signature**

```bash
grep -A8 "CREATE OR REPLACE FUNCTION public.dispatch_push_notification" supabase/migrations/20260418120000_push_dispatch_triggers.sql
```

Expected signature in HANDOFF:
```sql
dispatch_push_notification(
  p_event TEXT,
  p_profile_id UUID,
  p_workspace_id UUID,
  p_title TEXT,
  p_body TEXT,
  p_data JSONB DEFAULT '{}'::JSONB
)
```

- [ ] **Step 0.4: Verify pg_cron and pg_net extensions in Supabase Local**

```bash
npx supabase status
grep -A5 "\\[db.extensions\\]" supabase/config.toml || true
```

Or in psql:
```sql
SELECT extname FROM pg_extension WHERE extname IN ('pg_cron', 'pg_net');
```

Expected: both present. If missing, document fallback (manual invocation of `journey-stuck-detector`).

- [ ] **Step 0.5: Confirm engine-event provider dev-mode short-circuit**

Read `packages/telemetry/src/providers/engine-event.ts` lines 71-90. Quote line 74 verbatim in HANDOFF:
```ts
if (process.env.NODE_ENV === "development") return;
```

Confirm: this guard only affects the client-side path (`typeof window !== "undefined"` block). Server-side path at lines 92-98 runs unconditionally.

- [ ] **Step 0.6: Identify employee-facing web shifts route**

```bash
ls apps/web/src/app/dashboard/my-schedule/
cat apps/web/src/app/dashboard/my-schedule/page.tsx
```

Expected: `page.tsx` exists. Note in HANDOFF whether it's a Server Component or `"use client"`. The plan assumes `MyWeekView.tsx` is the client component that needs to call Server Actions.

If `apps/web/src/app/dashboard/my-schedule/` does not exist, STOP — Journey 03 has no employee-facing web surface and the PoC needs to pivot.

- [ ] **Step 0.7: Verify `guardian_signal` table schema**

```bash
cat supabase/migrations/20260314000000_guardian_signal.sql
```

Expected columns: `id`, `workspace_id`, `domain` (TEXT), `entity_type`, `entity_id`, `entity_label`, `signal_type`, `severity`, `title`, `description`, `status`, `created_at`, `expires_at`. Note exact column names in HANDOFF.

- [ ] **Step 0.8: Verify engine_state unique-active index**

```bash
grep -A3 "idx_engine_state_unique_active" supabase/migrations/20260304100000_engine_process_tables.sql
```

Expected:
```sql
CREATE UNIQUE INDEX idx_engine_state_unique_active
  ON engine_state (entity_type, entity_id, process_id)
  WHERE status IN ('pending', 'active', 'waiting');
```

- [ ] **Step 0.9: Inspect `registry.ts` ActionVerb pattern and EVENT_ROUTING entries for shift events**

```bash
grep -n "ActionVerb\|shift created\|shift updated\|EVENT_ROUTING" packages/telemetry/src/registry.ts | head -20
```

Note in HANDOFF: the existing pattern for `shift created` is the template to follow.

- [ ] **Step 0.10: Commit the HANDOFF**

```bash
git add apps/e2e/HANDOFF-journey-harness-poc.md
git commit -m "docs(handoff): journey harness poc prerequisite findings"
```

---

## Task 1: Register `shift list_viewed` and `shift detail_viewed` in telemetry

**Files:**
- Modify: `packages/telemetry/src/registry.ts`

- [ ] **Step 1.1: Add `list_viewed` and `detail_viewed` to `ActionVerb` union**

Find the `ActionVerb` type (around line 115-182). Add the two new verbs after `"viewed"` on line 130:

```ts
export type ActionVerb =
  | "created"
  | "updated"
  // ... existing verbs ...
  | "viewed"
  | "list_viewed"
  | "detail_viewed"
  | "exported"
  // ... rest ...
```

- [ ] **Step 1.2: Add `ShiftListViewed` and `ShiftDetailViewed` interfaces**

Find the `// ─── Scheduling Events ───` section (around line 318). Add after `ShiftDeleted` (around line 352):

```ts
export interface ShiftListViewed extends BaseEvent {
  event: "shift list_viewed";
  properties: {
    entity_type: "profile";
    entity_id: string;
    week_start?: string;
  };
}

export interface ShiftDetailViewed extends BaseEvent {
  event: "shift detail_viewed";
  properties: {
    entity_type: "profile";
    entity_id: string;
    shift_id: string;
  };
}
```

The `entity_type` and `entity_id` fields are MANDATORY per spec C2 — without them, `engine-dispatch` writes NULL into `engine_state.entity_type/entity_id` and the unique-active index cannot dedupe.

- [ ] **Step 1.3: Add the two new types to `SmartoutEvent` discriminated union**

Find the `SmartoutEvent` union (around line 2700-2724). Add the two new types alphabetically near the other shift events. Look for where `ShiftCreated` or `ShiftUpdated` appears in the union and add adjacent:

```ts
  | ShiftListViewed
  | ShiftDetailViewed
```

If `ShiftCreated` is not in the union (only `EnrichmentCorrected` etc. are visible), add the two new types at the end of the union before the closing semicolon.

- [ ] **Step 1.4: Add `EVENT_ROUTING` entries**

Find the `EVENT_ROUTING` map (line 2728+). Find the existing `"shift created"` entry (around line 2746). Add the two new entries after `"shift completed"`:

```ts
  "shift list_viewed": {
    destinations: ["posthog", "logger", "activity_trail", "engine_event"],
    category: "scheduling",
  },
  "shift detail_viewed": {
    destinations: ["posthog", "logger", "activity_trail", "engine_event"],
    category: "scheduling",
  },
```

All four destinations are required per spec (routing to only `engine_event` would break analytics and audit trail).

- [ ] **Step 1.5: Run typecheck on telemetry package**

```bash
cd packages/telemetry
node_modules/.bin/tsc --noEmit
```

Expected: 0 errors. If the `SmartoutEvent` union complains, ensure both new interfaces are added in Step 1.3.

- [ ] **Step 1.6: Run typecheck on the workspace**

```bash
cd ../..
node_modules/.bin/tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 1.7: Commit**

```bash
git add packages/telemetry/src/registry.ts
git commit -m "feat(telemetry): register shift list_viewed and shift detail_viewed events"
```

---

## Task 2: Add `journey_health` to guardian tools Zod enum

**Files:**
- Modify: `packages/ai/src/capabilities/guardian/tools.ts`

- [ ] **Step 2.1: Update the domain enum**

Find line 12-15 in `packages/ai/src/capabilities/guardian/tools.ts`:

```ts
    domain: z
      .enum(["readiness", "workspace_maturity", "agent_behavior"])
      .optional()
      .describe("Filter by signal domain"),
```

Change to:
```ts
    domain: z
      .enum(["readiness", "workspace_maturity", "agent_behavior", "journey_health"])
      .optional()
      .describe("Filter by signal domain"),
```

If there are other Zod enums in the same file referencing `domain` (e.g. for create/update guardian tools), update them all to include `journey_health`.

- [ ] **Step 2.2: Run typecheck**

```bash
node_modules/.bin/tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 2.3: Commit**

```bash
git add packages/ai/src/capabilities/guardian/tools.ts
git commit -m "feat(guardian): add journey_health domain to signals enum"
```

---

## Task 3: Seed Journey 03 engine_process

**Files:**
- Create: `supabase/migrations/20260406150000_journey_03_poc_seed.sql`

- [ ] **Step 3.1: Write the migration**

```sql
SET search_path TO public, extensions;

-- ============================================
-- 20260406150000_journey_03_poc_seed.sql
-- Seeds the Journey 03 (Sjekke vakter) PoC engine_process,
-- engine_step rows, and engine_trigger.
-- See: docs/superpowers/specs/2026-04-06-journey-harness-poc-instruction.md
--
-- IMPORTANT: action_payload uses key `event` (NOT `event_type`).
-- Verified at engine-dispatch/index.ts:411:
--   (currentStep.action_payload as Record<string, unknown>)?.event === event_type
-- ============================================

-- ── Process ────────────────────────────────────────────────

INSERT INTO engine_process (id, name, description) VALUES
('journey_03_check_shifts', 'Journey 03 — Sjekke vakter',
 'PoC: tracks employee progress through opening shifts list and viewing a shift detail. Two wait_for_event steps. Stuck on step 1 >24h triggers guardian_signal.')
ON CONFLICT (id) DO NOTHING;

-- ── Steps ──────────────────────────────────────────────────

INSERT INTO engine_step (process_id, step_order, action_type, action_payload, assignee_rule) VALUES
-- Step 1: Wait for the user to open the shifts list (first event creates the state, this step matches immediately)
('journey_03_check_shifts', 1, 'wait_for_event', '{
  "event": "shift.list_viewed",
  "description": "Employee opened the shifts list page"
}', null),

-- Step 2: Wait for the user to open a specific shift detail
('journey_03_check_shifts', 2, 'wait_for_event', '{
  "event": "shift.detail_viewed",
  "description": "Employee tapped a specific shift to see details"
}', null)
ON CONFLICT (process_id, step_order) DO NOTHING;

-- ── Trigger ────────────────────────────────────────────────
-- ONE trigger on shift.list_viewed (dot form). When this event arrives,
-- engine-dispatch creates an engine_state with entity_type/entity_id from
-- the payload, then immediately runs step 1 which matches the same event
-- and advances to step 2 (waiting for shift.detail_viewed).

INSERT INTO engine_trigger (event_type, process_id, condition, is_active)
SELECT 'shift.list_viewed', 'journey_03_check_shifts', null, true
WHERE NOT EXISTS (
  SELECT 1 FROM engine_trigger
  WHERE event_type = 'shift.list_viewed' AND process_id = 'journey_03_check_shifts'
);

COMMENT ON COLUMN engine_process.id IS 'Process ID. Use snake_case. journey_03_check_shifts is the PoC for the Journey Harness.';
```

- [ ] **Step 3.2: Apply the migration locally**

```bash
npx supabase db reset --local
# OR if you don't want to reset:
# npx supabase migration up
```

Expected: migration applies cleanly. No errors.

- [ ] **Step 3.3: Verify the seed**

```sql
-- Run via npx supabase db push or psql
SELECT id, name FROM engine_process WHERE id = 'journey_03_check_shifts';
SELECT step_order, action_type, action_payload->>'event' FROM engine_step
  WHERE process_id = 'journey_03_check_shifts' ORDER BY step_order;
SELECT event_type, process_id FROM engine_trigger
  WHERE process_id = 'journey_03_check_shifts';
```

Expected:
- 1 process row
- 2 step rows: step 1 → `shift.list_viewed`, step 2 → `shift.detail_viewed`
- 1 trigger row: `shift.list_viewed` → `journey_03_check_shifts`

- [ ] **Step 3.4: Commit**

```bash
git add supabase/migrations/20260406150000_journey_03_poc_seed.sql
git commit -m "feat(engine): seed journey 03 process with wait_for_event steps"
```

---

## Task 4: Server Actions for telemetry emit

**Files:**
- Create: `apps/web/src/app/dashboard/my-schedule/actions.ts`

- [ ] **Step 4.1: Write the Server Actions file**

```ts
"use server";

// Server Actions for Journey Harness PoC.
// These wrap emit() calls so they originate server-side, bypassing
// the client-side dev-mode short-circuit at engine-event.ts:74.
// See: docs/superpowers/specs/2026-04-06-journey-harness-poc-instruction.md (C6)

import { emit } from "@smartout/telemetry";
import { createClient } from "@/lib/supabase/server";

/**
 * Records that the employee opened their shifts list.
 * Called from MyWeekView client component on mount.
 */
export async function markShiftListViewed(weekStart?: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  // Resolve the user's profile + workspace
  const { data: profile } = await supabase
    .from("profile")
    .select("profile_id, workspace_id")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  if (!profile) return;

  await emit({
    event: "shift list_viewed",
    workspace_id: profile.workspace_id,
    actor_id: profile.profile_id,
    properties: {
      entity_type: "profile",
      entity_id: profile.profile_id,
      week_start: weekStart,
    },
  });
}

/**
 * Records that the employee opened a specific shift detail.
 * Called from MyWeekView client component on shift card click.
 */
export async function markShiftDetailViewed(shiftId: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { data: profile } = await supabase
    .from("profile")
    .select("profile_id, workspace_id")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  if (!profile) return;

  await emit({
    event: "shift detail_viewed",
    workspace_id: profile.workspace_id,
    actor_id: profile.profile_id,
    properties: {
      entity_type: "profile",
      entity_id: profile.profile_id,
      shift_id: shiftId,
    },
  });
}
```

**Note:** The build agent must verify the import path for the Supabase server client. Common patterns:
- `@/lib/supabase/server` (most common)
- `@/utils/supabase/server`
- Inspect `apps/web/src/lib/` or `apps/web/src/utils/` for the actual location.

If `createClient()` from server-side has a different name (e.g. `createServerSupabaseClient`), use that instead.

- [ ] **Step 4.2: Verify the import path for the Supabase server client**

```bash
grep -rn "use server\|createClient" apps/web/src/lib/supabase/ 2>/dev/null | head -5
ls apps/web/src/lib/supabase/ 2>/dev/null
```

Update the import in actions.ts if the path differs from `@/lib/supabase/server`.

- [ ] **Step 4.3: Run typecheck**

```bash
cd apps/web
node_modules/.bin/tsc --noEmit
```

Expected: 0 errors. If the Supabase client has different async/await patterns (e.g. `cookies()` is sync vs async), adjust accordingly.

- [ ] **Step 4.4: Commit**

```bash
cd ../..
git add apps/web/src/app/dashboard/my-schedule/actions.ts
git commit -m "feat(my-schedule): add server actions for journey harness telemetry"
```

---

## Task 5: Wire Server Actions into MyWeekView client component

**Files:**
- Modify: `apps/web/src/app/dashboard/my-schedule/_components/MyWeekView.tsx`

- [ ] **Step 5.1: Read MyWeekView.tsx to understand current structure**

```bash
cat apps/web/src/app/dashboard/my-schedule/_components/MyWeekView.tsx
```

Identify:
- Where the component mounts (useEffect on mount)
- Where shift cards are rendered (the click handler that opens detail)
- Whether there's a `weekStart` state or prop

- [ ] **Step 5.2: Add `markShiftListViewed` call on mount**

At the top of the component, add the import:
```ts
import { markShiftListViewed, markShiftDetailViewed } from "../actions";
```

Add a `useEffect` that fires once on mount (and on weekStart change if relevant):
```tsx
useEffect(() => {
  // Journey Harness PoC: emit shift list_viewed via Server Action
  // (server-side emit is required — client-side emit() short-circuits in dev)
  void markShiftListViewed(weekStart);
}, [weekStart]);
```

If `weekStart` doesn't exist, omit the dependency and arg. If the component already has a mount effect, add the call inside it instead of creating a new one.

- [ ] **Step 5.3: Add `markShiftDetailViewed` call on shift card click**

Find the click handler that opens shift detail. Add the Server Action call:
```tsx
const handleShiftClick = (shift: ScheduleShift) => {
  void markShiftDetailViewed(shift.schedule_shift_id);
  // ... existing logic to open detail
};
```

If the click handler is inline JSX, extract it or call the action inside the inline handler:
```tsx
onClick={() => {
  void markShiftDetailViewed(shift.schedule_shift_id);
  // existing logic
}}
```

- [ ] **Step 5.4: Run typecheck**

```bash
cd apps/web
node_modules/.bin/tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 5.5: Commit**

```bash
cd ../..
git add apps/web/src/app/dashboard/my-schedule/_components/MyWeekView.tsx
git commit -m "feat(my-schedule): wire journey harness server actions into MyWeekView"
```

---

## Task 6: Stuck-detector Edge Function

**Files:**
- Create: `supabase/functions/journey-stuck-detector/index.ts`

- [ ] **Step 6.1: Write the Edge Function**

```ts
// supabase/functions/journey-stuck-detector/index.ts
//
// PoC: Detects engine_state instances stuck on Journey 03 step 1 for >24h
// and writes guardian_signal rows with domain='journey_health'.
//
// Triggered by pg_cron hourly. Idempotent — won't create duplicate signals
// within a 24h window for the same entity.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const STALE_THRESHOLD_HOURS = 24;
const PROCESS_ID = "journey_03_check_shifts";

serve(async (_req) => {
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  // 1. Find stuck states
  const cutoff = new Date(
    Date.now() - STALE_THRESHOLD_HOURS * 60 * 60 * 1000,
  ).toISOString();

  const { data: stuckStates, error: queryError } = await supabase
    .from("engine_state")
    .select("id, entity_id, entity_type, workspace_id, current_step, updated_at")
    .eq("process_id", PROCESS_ID)
    .eq("current_step", 1)
    .eq("status", "waiting")
    .lt("updated_at", cutoff);

  if (queryError) {
    return new Response(
      JSON.stringify({ error: queryError.message }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  if (!stuckStates || stuckStates.length === 0) {
    return new Response(
      JSON.stringify({ checked: 0, signals_created: 0 }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }

  // 2. For each stuck state, check idempotency and insert signal
  let created = 0;
  for (const state of stuckStates) {
    if (!state.entity_id || !state.workspace_id) continue;

    // Idempotency: skip if a signal was already created for this entity
    // within the last 24 hours
    const idempotencyCutoff = new Date(
      Date.now() - 24 * 60 * 60 * 1000,
    ).toISOString();

    const { data: existing } = await supabase
      .from("guardian_signal")
      .select("id")
      .eq("entity_id", state.entity_id)
      .eq("domain", "journey_health")
      .gt("created_at", idempotencyCutoff)
      .limit(1);

    if (existing && existing.length > 0) continue;

    const { error: insertError } = await supabase
      .from("guardian_signal")
      .insert({
        workspace_id: state.workspace_id,
        domain: "journey_health",
        entity_type: "profile",
        entity_id: state.entity_id,
        signal_type: "journey_stalled",
        severity: "info",
        title: "Journey 03 stalled",
        description: `Employee opened the shifts list but never tapped a specific shift within ${STALE_THRESHOLD_HOURS}h. Send a rescue prompt to guide them to the next step.`,
        status: "active",
      });

    if (!insertError) created++;
  }

  return new Response(
    JSON.stringify({ checked: stuckStates.length, signals_created: created }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
});
```

- [ ] **Step 6.2: Verify guardian_signal column names match Step 0.7 findings**

If the actual `guardian_signal` schema differs (e.g. different column names for `signal_type`, `severity`, `status`), adjust the INSERT accordingly.

- [ ] **Step 6.3: Deploy locally and test invocation**

```bash
npx supabase functions serve journey-stuck-detector --no-verify-jwt &
# In another shell:
curl -X POST http://127.0.0.1:54321/functions/v1/journey-stuck-detector \
  -H "Content-Type: application/json"
```

Expected response: `{"checked": 0, "signals_created": 0}` (no stuck states yet).

- [ ] **Step 6.4: Commit**

```bash
git add supabase/functions/journey-stuck-detector/index.ts
git commit -m "feat(functions): add journey-stuck-detector edge function"
```

---

## Task 7: pg_cron schedule + guardian_signal push trigger

**Files:**
- Create: `supabase/migrations/20260406150100_guardian_signal_push_trigger.sql`

- [ ] **Step 7.1: Write the migration**

```sql
SET search_path TO public, extensions;

-- ============================================
-- 20260406150100_guardian_signal_push_trigger.sql
-- 1. pg_cron schedule for journey-stuck-detector (hourly)
-- 2. Trigger on guardian_signal INSERT that fires push notification
--    when domain = 'journey_health'
-- ============================================

-- ── pg_cron schedule for stuck detection ───────────────────
-- Skips silently if pg_cron is not enabled in this environment.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'journey-stuck-detector-hourly',
      '0 * * * *',
      $cron$
        SELECT net.http_post(
          url := current_setting('app.supabase_url', true) || '/functions/v1/journey-stuck-detector',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)
          ),
          body := '{}'::jsonb
        );
      $cron$
    );
  ELSE
    RAISE NOTICE 'pg_cron not enabled — journey-stuck-detector must be invoked manually';
  END IF;
END $$;

-- ── Trigger: guardian_signal INSERT → push notification ────
-- When a journey_health signal is inserted, send a push notification
-- to the affected profile with the rescue prompt content.

CREATE OR REPLACE FUNCTION public.trigger_journey_health_push()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only fire for journey_health signals targeting a specific profile
  IF NEW.domain = 'journey_health' AND NEW.entity_type = 'profile' AND NEW.entity_id IS NOT NULL THEN
    PERFORM dispatch_push_notification(
      'journey_rescue',
      NEW.entity_id,
      NEW.workspace_id,
      'Sjekk vaktene dine 📋',
      'Du har åpnet vaktlisten — trykk på en vakt for å se detaljer som tid, avdeling og hvem du jobber med.',
      jsonb_build_object(
        'journey_id', 'journey_03_check_shifts',
        'deep_link', '/dashboard/my-schedule',
        'rescue_gate', 'gate_2'
      )
    );
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.trigger_journey_health_push IS
  'PoC: Fires push notification when a guardian_signal with domain=journey_health is inserted. Rescue content is hardcoded for Journey 03 — i18n debt logged for follow-up.';

DROP TRIGGER IF EXISTS guardian_signal_journey_health_push ON public.guardian_signal;
CREATE TRIGGER guardian_signal_journey_health_push
  AFTER INSERT ON public.guardian_signal
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_journey_health_push();
```

- [ ] **Step 7.2: Apply the migration**

```bash
npx supabase migration up
```

Expected: migration applies cleanly. If pg_cron is not enabled, expect a NOTICE but no error.

- [ ] **Step 7.3: Verify the trigger exists**

```sql
SELECT tgname FROM pg_trigger WHERE tgname = 'guardian_signal_journey_health_push';
```

Expected: 1 row.

- [ ] **Step 7.4: Commit**

```bash
git add supabase/migrations/20260406150100_guardian_signal_push_trigger.sql
git commit -m "feat(engine): pg_cron schedule + push trigger for journey health signals"
```

---

## Task 8: Update EVENT-SEQUENCE.md to reflect new event names

**Files:**
- Modify: `apps/mobile/store-listing/journeys/03-check-shifts/EVENT-SEQUENCE.md`

- [ ] **Step 8.1: Read the current file**

```bash
cat apps/mobile/store-listing/journeys/03-check-shifts/EVENT-SEQUENCE.md
```

- [ ] **Step 8.2: Replace `page_viewed (shifts)` and `button_clicked (shift_detail)` with new event names**

Update the timeline table and success criteria to use:
- `shift list_viewed` (instead of `page_viewed (shifts)`)
- `shift detail_viewed` (instead of `button_clicked (shift_detail)`)

Update the failure scenarios table similarly.

- [ ] **Step 8.3: Commit**

```bash
git add apps/mobile/store-listing/journeys/03-check-shifts/EVENT-SEQUENCE.md
git commit -m "docs(journey-03): update EVENT-SEQUENCE to use shift list_viewed/detail_viewed"
```

---

## Task 9: End-to-end test the chain

This is the Definition of Done verification. Use Supabase Local. Test by hand — no Playwright for this PoC.

**Files:**
- None (verification only)

- [ ] **Step 9.1: Reset Supabase Local to a clean state**

```bash
npx supabase db reset --local
```

Wait for the seed to complete.

- [ ] **Step 9.2: Identify a test profile**

```sql
SELECT profile_id, workspace_id, display_name FROM profile WHERE is_active = true LIMIT 1;
```

Note the `profile_id` and `workspace_id` for the test.

- [ ] **Step 9.3: Start the web dev server with NODE_ENV unset**

```bash
cd apps/web
NODE_ENV=production pnpm dev
```

Or use the standard `pnpm dev` and confirm via logs that emit calls reach the server-side path.

- [ ] **Step 9.4: Log in as the test profile and open `/dashboard/my-schedule`**

Open the route in a browser. The page should render and `markShiftListViewed()` should fire.

- [ ] **Step 9.5: Verify engine_event row created**

```sql
SELECT id, event_type, payload->>'entity_type' AS entity_type, payload->>'entity_id' AS entity_id, created_at
FROM engine_event
WHERE event_type = 'shift.list_viewed'
ORDER BY created_at DESC LIMIT 1;
```

Expected: 1 row with `entity_type = 'profile'`, `entity_id = <test profile_id>`.

If empty: emit didn't reach server. Check that `markShiftListViewed()` is called from the Server Action and the page renders.

- [ ] **Step 9.6: Verify engine_state created**

```sql
SELECT id, process_id, current_step, status, entity_type, entity_id, updated_at
FROM engine_state
WHERE process_id = 'journey_03_check_shifts'
ORDER BY created_at DESC LIMIT 1;
```

Expected: 1 row with `current_step = 2`, `status = 'waiting'`, `entity_type = 'profile'`, `entity_id = <test profile_id>`.

If `current_step = 1`: step 1 didn't advance. Verify `engine_step.action_payload` uses key `event` not `event_type`.

If multiple rows: the unique-active index is not enforcing. Check Step 0.8 findings.

- [ ] **Step 9.7: Click a shift card in MyWeekView**

This should fire `markShiftDetailViewed(shiftId)`.

- [ ] **Step 9.8: Verify the engine_state advanced to complete**

```sql
SELECT id, process_id, current_step, status, completed_at
FROM engine_state
WHERE process_id = 'journey_03_check_shifts'
ORDER BY updated_at DESC LIMIT 1;
```

Expected: same row from Step 9.6, now with `status = 'complete'` and `completed_at` set.

- [ ] **Step 9.9: Verify NO duplicate engine_state rows**

```sql
SELECT COUNT(*) FROM engine_state
WHERE entity_id = '<test profile_id>'
  AND process_id = 'journey_03_check_shifts';
```

Expected: 1. If 2: the entity payload contract was violated — go back to Task 1/4 and fix.

- [ ] **Step 9.10: Test the stuck-detection rescue path**

Create a fresh stuck state by:

```sql
-- Reset for the rescue test
DELETE FROM guardian_signal WHERE domain = 'journey_health' AND entity_id = '<test profile_id>';

UPDATE engine_state
SET current_step = 1,
    status = 'waiting',
    updated_at = NOW() - INTERVAL '25 hours'
WHERE entity_id = '<test profile_id>'
  AND process_id = 'journey_03_check_shifts';
```

Then invoke the stuck detector:

```bash
curl -X POST http://127.0.0.1:54321/functions/v1/journey-stuck-detector \
  -H "Content-Type: application/json"
```

Expected response: `{"checked": 1, "signals_created": 1}`.

- [ ] **Step 9.11: Verify guardian_signal was created**

```sql
SELECT id, domain, entity_id, title, status, created_at
FROM guardian_signal
WHERE domain = 'journey_health'
  AND entity_id = '<test profile_id>'
ORDER BY created_at DESC LIMIT 1;
```

Expected: 1 row with `domain = 'journey_health'`, `title = 'Journey 03 stalled'`.

- [ ] **Step 9.12: Verify the push trigger fired**

Check for the `RAISE NOTICE` from `dispatch_push_notification` in Supabase logs:

```bash
npx supabase logs db | grep "push-dispatch" | tail -5
```

In local dev without push secrets configured, expected: `NOTICE: push-dispatch: missing config, skipping (event=journey_rescue, profile=<test profile_id>)`.

This proves the trigger fired and called `dispatch_push_notification()` correctly. Production would actually send the push.

- [ ] **Step 9.13: Test idempotency**

Invoke the stuck detector again immediately:

```bash
curl -X POST http://127.0.0.1:54321/functions/v1/journey-stuck-detector
```

Expected: `{"checked": 1, "signals_created": 0}` — the existing signal within the 24h window prevents duplicates.

- [ ] **Step 9.14: Update HANDOFF with DoD verification**

Add a "Definition of Done — Verified" section to `apps/e2e/HANDOFF-journey-harness-poc.md` listing all 10 DoD criteria from the spec with ✓ or ✗ and evidence (query output, log snippet).

- [ ] **Step 9.15: Commit HANDOFF**

```bash
git add apps/e2e/HANDOFF-journey-harness-poc.md
git commit -m "docs(handoff): journey 03 PoC end-to-end verified"
```

---

## Task 10: Finalize and prepare for review

**Files:**
- None (cleanup only)

- [ ] **Step 10.1: Run full typecheck**

```bash
node_modules/.bin/tsc --noEmit
cd apps/web && node_modules/.bin/tsc --noEmit && cd ../..
```

Expected: 0 errors in both.

- [ ] **Step 10.2: Run lint**

```bash
pnpm lint
```

Expected: 0 errors.

- [ ] **Step 10.3: Confirm all 10 DoD criteria are met**

Cross-reference HANDOFF against the spec's Definition of Done section. Every criterion must have evidence.

- [ ] **Step 10.4: Push branch and prepare for review**

```bash
git push -u origin feat/journey-harness-poc
```

Report back to orchestrator with:
- Branch URL
- HANDOFF file content
- DoD verification table

---

## Failure Modes to Watch For

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| `engine_state` never created | Trigger doesn't match — check `event_type` value uses dot form | Step 3.1 |
| `engine_state` stuck at `current_step = 1` forever | `action_payload` uses `event_type` instead of `event` | Step 3.1 — verify payload key |
| Two `engine_state` rows for same profile | Entity payload missing — emit didn't include `entity_type`/`entity_id` | Task 1 step 1.2, Task 4 |
| `engine_event` table empty after page open | Client-side emit short-circuit — emit didn't run server-side | Task 4/5 — must use Server Action |
| `guardian_signal` never created by stuck detector | Idempotency or query filter wrong | Task 6 step 6.1 |
| Push trigger doesn't fire | Trigger condition wrong, or `domain` filter mismatch | Task 7 step 7.1 |
| pg_cron schedule fails to install | Extension not enabled in local Supabase | Step 0.4 — document and invoke manually |

---

## Spec Coverage Verification

Every spec requirement maps to a task in this plan:

| Spec section | Tasks |
|--------------|-------|
| C1 (web-only scope) | Task 4-5 (Server Actions in `apps/web/`) |
| C2 (entity payload) | Task 1.2, Task 4 |
| C3 (wait_for_event advancement) | Task 3.1 |
| C4 (event name format) | Task 1.2 (space form), Task 3.1 (dot form) |
| C5 (stuck detection runtime) | Task 6, Task 7 |
| C6 (server-side emit) | Task 4 (Server Actions), Task 5 (wiring) |
| Section 1 (telemetry registry) | Task 1 |
| Section 2 (engine_process seed) | Task 3 |
| Section 3 (stuck detector) | Task 6 |
| Section 4 (rescue delivery) | Task 7 |
| Prerequisite Check (8 items) | Task 0 |
| Definition of Done (10 items) | Task 9 |
