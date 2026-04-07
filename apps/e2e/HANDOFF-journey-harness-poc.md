---
title: "Journey Harness PoC HANDOFF"
status: in_progress
updated: 2026-04-07
created: 2026-04-07
module: ai-agent
tags: [journey, harness, poc, handoff]
---

# Journey Harness PoC HANDOFF

> Build agent: orchestrator-driven execution of `docs/superpowers/plans/2026-04-06-journey-harness-poc.md`.
> Branch: `feat/journey-harness-poc`. Worktree: `/home/sxtnl/dev/wt-1`.

## Task Tracking

- [x] Task 0 — Prerequisite verification (BLOCKING)
- [ ] Task 1 — Register telemetry events
- [ ] Task 2 — Add `journey_health` to guardian Zod enum
- [ ] Task 3 — Seed Journey 03 engine_process
- [ ] Task 4 — Server Actions for telemetry emit
- [ ] Task 5 — Wire Server Actions into MyWeekView
- [ ] Task 6 — Stuck-detector Edge Function
- [ ] Task 7 — pg_cron schedule + push trigger
- [ ] Task 8 — Update EVENT-SEQUENCE.md
- [ ] Task 9 — End-to-end test
- [ ] Task 10 — Finalize / push

## Prerequisite Findings (Task 0)

### Step 0.1 — Worktree + HANDFOFF created

- Worktree: `/home/sxtnl/dev/wt-1` (already existed; not recreated per orchestrator override)
- Branch: `feat/journey-harness-poc` (verified clean, based on `development`)
- HANDOFF file created with today's date `2026-04-07`

### Step 0.2 — engine-dispatch resume-waiting matcher reads `event` key (G1 fix verified)

`supabase/functions/engine-dispatch/index.ts` line **411** reads verbatim:

```ts
(currentStep.action_payload as Record<string, unknown>)?.event === event_type &&
```

The matcher reads `action_payload.event` and compares it to the incoming `event_type`. **Confirms spec C3.** Cross-check against existing seed `supabase/migrations/20260304300000_seed_daily_close_process.sql` line 71:

```sql
('daily_close', 7, NULL, 'wait_for_event', '{
  "event": "reconciliation.admin_action",
  ...
```

Existing seed uses key `event`. The Journey 03 seed must use the same key.

### Step 0.3 — `dispatch_push_notification()` exists with expected signature

`supabase/migrations/20260418120000_push_dispatch_triggers.sql` lines 13–20:

```sql
CREATE OR REPLACE FUNCTION public.dispatch_push_notification(
  p_event TEXT,
  p_profile_id UUID,
  p_workspace_id UUID,
  p_title TEXT,
  p_body TEXT,
  p_data JSONB DEFAULT '{}'::JSONB
)
```

Matches plan exactly. Returns VOID, LANGUAGE plpgsql, SECURITY DEFINER.

### Step 0.4 — pg_cron NOT enabled in Supabase Local; pg_net IS available

- `supabase/config.toml` has no explicit `[db.extensions]` block — extensions follow Supabase Local defaults.
- `supabase/migrations/20260328225650_notification_outbox_auto_dispatch.sql` line 3 explicitly states: "pg_cron is not available in Supabase Local".
- `pg_net` IS available — used in production by `dispatch_push_notification` itself.
- Existing pattern in repo: cron registrations are wrapped in `IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN ... ELSE RAISE NOTICE ...` (e.g. `20260428100100_daily_session_replenish_cron.sql`, `20260324220000_notification_table.sql`).
- **Decision:** Plan's Step 7.1 already uses this exact guard pattern. Stuck-detector will be invoked manually for the PoC test (Step 9.10), as the plan instructs.

### Step 0.5 — engine-event provider client-side dev short-circuit (G2 fix verified)

`packages/telemetry/src/providers/engine-event.ts` line **78** (NOT 74 as the plan states — line numbers shifted, logic identical):

```ts
if (process.env.NODE_ENV === "development") return;
```

This guard sits inside the client-side branch starting at line 75: `if (_g["window"] !== undefined) {`. The server-side path at lines 96–98 runs unconditionally:

```ts
const supabase = getServiceClient();
const { error } = await supabase.functions.invoke("engine-dispatch", { body });
```

**Confirms spec C6.** All PoC `emit()` calls must originate server-side (Server Actions).

### Step 0.6 — Employee-facing web shifts route exists at `apps/web/src/app/dashboard/my-schedule/`

- `apps/web/src/app/dashboard/my-schedule/page.tsx` — exists, **is `"use client"`**, renders `<MyWeekView />`
- `apps/web/src/app/dashboard/my-schedule/_components/MyWeekView.tsx` — the client component to wire Server Actions into (per plan Task 5)
- `apps/web/src/app/dashboard/my-schedule/_hooks/` — exists
- `apps/web/src/app/dashboard/my-schedule/loading.tsx` — exists

Since `page.tsx` is `"use client"`, we cannot emit from a Server Component there. Plan's strategy is correct: create `apps/web/src/app/dashboard/my-schedule/actions.ts` Server Actions and call them from `MyWeekView` (client).

### Step 0.7 — `guardian_signal` schema verified

`supabase/migrations/20260314000000_guardian_signal.sql` columns:

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | gen_random_uuid() |
| `workspace_id` | UUID NOT NULL | FK workspace |
| `signal_type` | TEXT NOT NULL | |
| `domain` | TEXT NOT NULL | **plain TEXT, not enum** — `journey_health` requires no DB change |
| `severity` | TEXT NOT NULL | 'info' \| 'warning' \| 'critical' |
| `entity_type` | TEXT | |
| `entity_id` | UUID | |
| `entity_label` | TEXT | |
| `title` | TEXT NOT NULL | |
| `description` | TEXT | |
| `data` | JSONB | default `{}` |
| `status` | TEXT NOT NULL | default `'active'` |
| `acknowledged_by` / `acknowledged_at` / `resolved_at` / `source_check_id` | | |
| `created_at` / `updated_at` / `expires_at` | TIMESTAMPTZ | |

The plan's Edge Function INSERT (Task 6.1) uses `workspace_id, domain, entity_type, entity_id, signal_type, severity, title, description, status` — all valid columns. ✓

### Step 0.8 — `idx_engine_state_unique_active` exists

`supabase/migrations/20260304100000_engine_process_tables.sql` lines 184–186:

```sql
CREATE UNIQUE INDEX IF NOT EXISTS idx_engine_state_unique_active
  ON engine_state (entity_type, entity_id, process_id)
  WHERE status IN ('pending', 'active', 'waiting');
```

Matches expected. This index makes C2's payload contract load-bearing.

### Step 0.9 — `registry.ts` patterns inspected

- `ActionVerb` union: lines 115–182. `"viewed"` is at line 130. New verbs `list_viewed` and `detail_viewed` will be inserted after it.
- `EntityRef` interface (line 42) has `entity_type`, `entity_id`, `entity_label?`. Existing `ShiftCreated/Updated/Deleted` (lines 319–352) wrap this as `properties.entity: EntityRef` (nested form).
- **CRITICAL DIVERGENCE — documented and intentional:** The new `ShiftListViewed` and `ShiftDetailViewed` interfaces use a **flat** shape (`properties.entity_type`, `properties.entity_id`) per spec C2. This is REQUIRED because `engine-dispatch/index.ts:399` reads `(payload as Record<string, unknown>)?.entity_id` from the top of the payload object, and `engine-event.ts` builds `payload` as `{ actor_id, correlation_id, ...event.properties }` — spreading `properties` flat. If we used the nested `EntityRef` form, `payload.entity_id` would be `undefined` and the unique-active dedupe would not work (G1-adjacent failure mode). The plan's Task 1.2 spec is correct on this point.
- `SmartoutEvent` discriminated union: lines 2458–2724. Shift-related events are at lines 2465–2481. New entries will be added adjacent.
- `EVENT_ROUTING`: starts at line 2728. `"shift created"` is at line 2746. The four destinations `["posthog", "logger", "activity_trail", "engine_event"]` and `category: "scheduling"` is the canonical pattern to copy.

### Task 0 Outcome: ALL 8 PREREQUISITES PASS

No blockers. Both council-caught bugs (G1 payload key, G2 client-side dev short-circuit) are confirmed fixed in current codebase. Proceeding to Task 1.
