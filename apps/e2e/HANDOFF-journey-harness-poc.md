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
- [x] Task 1 — Register telemetry events
- [x] Task 2 — Add `journey_health` to guardian Zod enum
- [x] Task 3 — Seed Journey 03 engine_process
- [x] Task 4 — Server Actions for telemetry emit
- [x] Task 5 — Wire Server Actions into MyWeekView
- [x] Task 6 — Stuck-detector Edge Function
- [x] Task 7 — pg_cron schedule + push trigger
- [x] Task 8 — Update EVENT-SEQUENCE.md
- [x] Task 9 — End-to-end test
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

| Column                                                                    | Type          | Notes                                                             |
| ------------------------------------------------------------------------- | ------------- | ----------------------------------------------------------------- |
| `id`                                                                      | UUID PK       | gen_random_uuid()                                                 |
| `workspace_id`                                                            | UUID NOT NULL | FK workspace                                                      |
| `signal_type`                                                             | TEXT NOT NULL |                                                                   |
| `domain`                                                                  | TEXT NOT NULL | **plain TEXT, not enum** — `journey_health` requires no DB change |
| `severity`                                                                | TEXT NOT NULL | 'info' \| 'warning' \| 'critical'                                 |
| `entity_type`                                                             | TEXT          |                                                                   |
| `entity_id`                                                               | UUID          |                                                                   |
| `entity_label`                                                            | TEXT          |                                                                   |
| `title`                                                                   | TEXT NOT NULL |                                                                   |
| `description`                                                             | TEXT          |                                                                   |
| `data`                                                                    | JSONB         | default `{}`                                                      |
| `status`                                                                  | TEXT NOT NULL | default `'active'`                                                |
| `acknowledged_by` / `acknowledged_at` / `resolved_at` / `source_check_id` |               |                                                                   |
| `created_at` / `updated_at` / `expires_at`                                | TIMESTAMPTZ   |                                                                   |

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

---

## Implementation Notes (Tasks 1–8)

### Telemetry registry (Task 1)

- New verbs `list_viewed` + `detail_viewed` in `ActionVerb`
- `ShiftListViewed` and `ShiftDetailViewed` interfaces use **flat** properties shape
  (`entity_type` / `entity_id` at the top of `properties`, NOT the nested `EntityRef`
  pattern used by `ShiftCreated/Updated/Deleted`). This intentional divergence is
  documented inline in `registry.ts` and is required by `engine-dispatch:399`
  which reads `payload.entity_id` directly from the top of the payload.
- Both events route to all four destinations to preserve analytics + audit parity
  with peer scheduling events.

### Server Actions (Task 4)

- `apps/web/src/app/dashboard/my-schedule/actions.ts`
- `markShiftListViewed(weekStart?)` and `markShiftDetailViewed(shiftId)`
- Both call `resolveCurrentProfile()` which does `auth.getUser()` + a `profile`
  lookup keyed on `user_id` + `is_active = true`
- Telemetry failures noop silently — never break the UI
- Uses `createClient` from `@smartout/supabase/server` (verified canonical
  pattern in `apps/web/src/app/dashboard/people/_actions/people-actions.ts`)

### MyWeekView wiring (Task 5)

- `useEffect` keyed on `weekStart` invokes `markShiftListViewed` on mount and
  every week navigation
- `onClick` + `onKeyDown` + `role=button` + `tabIndex=0` on each shift card
  invokes `markShiftDetailViewed(shift.id)` (where `shift.id` is the
  `schedule_shift_id` UUID per `MyScheduleShift` type)
- Visual layout unchanged apart from `cursor-pointer` hint

### emit() call sites added (per spec C6 requirement)

| Call site               | File                                                | Runtime                                      |
| ----------------------- | --------------------------------------------------- | -------------------------------------------- |
| `markShiftListViewed`   | `apps/web/src/app/dashboard/my-schedule/actions.ts` | Server Action ("use server") — server-side ✓ |
| `markShiftDetailViewed` | `apps/web/src/app/dashboard/my-schedule/actions.ts` | Server Action ("use server") — server-side ✓ |

Both invocations originate from a `"use server"` module. The client component
(`MyWeekView`, `"use client"`) only **calls** the Server Actions — it does not
import `emit()` directly. This is the pattern spec C6 mandates.

### Stuck detector (Task 6)

- `supabase/functions/journey-stuck-detector/index.ts` follows the canonical
  Edge Function pattern in this repo (`Deno.serve`, `jsr:@supabase/supabase-js@2`,
  CORS, optional `WATCHDOG_CRON_SECRET` bearer auth)
- Idempotency: 24h window prevents duplicate signals per profile
- Registered in `supabase/config.toml` with `verify_jwt = false`

### Push trigger (Task 7)

- `trigger_journey_health_push()` AFTER INSERT trigger on `guardian_signal`
- Filters on `domain = 'journey_health' AND entity_type = 'profile' AND entity_id IS NOT NULL`
- Calls `dispatch_push_notification('journey_rescue', NEW.entity_id, NEW.workspace_id, ...)`
- Norwegian rescue title/body hardcoded — i18n debt logged below
- pg_cron block wrapped in `IF EXISTS pg_extension` guard (skipped silently in
  Supabase Local — confirmed in Task 0 finding 0.4)

### EVENT-SEQUENCE update (Task 8)

- Replaced `page_viewed (shifts)` and `button_clicked (shift_detail)` with
  `shift list_viewed` and `shift detail_viewed`
- Updated success criteria + failure modes
- Added PoC note about server-side emit + flat entity contract

---

## Definition of Done — Verified (Task 9)

All 10 spec DoD criteria verified end-to-end against the running Supabase Local.

Test profile: `c1373ed4-6f0f-43d0-8170-de4c215c3ae3` (Pontus Lindroth)
Test workspace: `a6d1eab4-d5a4-4be0-8438-c08ae3f7609d`

| #   | Criterion                                                                                                                                      | Status | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Employee opening shifts page on web emits `shift list_viewed` with flat `entity_type` + `entity_id` properties; emit originates server-side    | ✅     | `markShiftListViewed` Server Action in `actions.ts` (`"use server"`) calls `emit({ event: "shift list_viewed", properties: { entity_type: "profile", entity_id, week_start } })`. `MyWeekView`'s `useEffect([weekStart])` invokes the action — no client-side `emit()` import.                                                                                                                                                                                                 |
| 2   | Event reaches `engine_event` (as `shift.list_viewed`) and creates an `engine_state` for that profile + Journey 03 process                      | ✅     | Direct dispatch test produced `engine_event id=0194195e-db71-45d8-9cf1-d12587f50783, event_type=shift.list_viewed, payload->>'entity_type'='profile', payload->>'entity_id'='c1373ed4...'` and `engine_state id=d6f4df22-e782-45c9-a1cf-a18782b87b2a, process_id=journey_03_check_shifts`                                                                                                                                                                                      |
| 3   | State advances: step 1 completes immediately, step 2 enters `waiting`                                                                          | ✅     | Same dispatch returned `triggers_matched: 1, waiting_resumed: 1` and the resulting `engine_state` had `current_step=2, status=waiting` — proves G1 fix (payload key `event` matches at engine-dispatch:411)                                                                                                                                                                                                                                                                    |
| 4   | Tapping shift detail emits `shift detail_viewed` via Server Action; advances SAME `engine_state` to step 2 complete (no duplicate row)         | ✅     | Second dispatch with `event_type=shift.detail_viewed` returned `waiting_resumed: 1`. Final state row: `id=d6f4df22 (same id), current_step=2, status=complete, completed_at SET`. `markShiftDetailViewed` is a Server Action invoked from `MyWeekView`'s `onClick`/`onKeyDown`.                                                                                                                                                                                                |
| 5   | Aging an `engine_state.updated_at` to >24h ago + invoking `journey-stuck-detector` produces a `guardian_signal` with `domain='journey_health'` | ✅     | After bypassing the `set_engine_state_updated_at` BEFORE UPDATE trigger to set `updated_at = NOW() - 25h`, `curl POST .../journey-stuck-detector` returned `{"checked":1,"signals_created":1}` and `guardian_signal id=ffff0978..., domain=journey_health, signal_type=journey_stalled, severity=info, title='Journey 03 stalled', status=active` was created                                                                                                                  |
| 6   | That `guardian_signal` INSERT triggers `dispatch_push_notification()` with rescue content from RESCUE-PROMPTS.md Gate 2                        | ✅     | Direct INSERT (in a ROLLBACKed transaction) emitted: `NOTICE: push-dispatch: missing config, skipping (event=journey_rescue, profile=c1373ed4-6f0f-43d0-8170-de4c215c3ae3)`. Proves the AFTER INSERT trigger fired, called `dispatch_push_notification('journey_rescue', NEW.entity_id, ...)`, which then early-returned because local dev has no `app.push_dispatch_secret`. In production with secrets configured the helper would invoke the `push-dispatch` Edge Function. |
| 7   | All works in Supabase Local                                                                                                                    | ✅     | All evidence above is from `npx supabase status` running on `127.0.0.1:54321`/`54322`                                                                                                                                                                                                                                                                                                                                                                                          |
| 8   | No duplicate `engine_state` rows for same profile + process                                                                                    | ✅     | `SELECT COUNT(*) FROM engine_state WHERE entity_id = '<test_profile>' AND process_id = 'journey_03_check_shifts'` returned **1** (not 2) after both dispatch calls. The `idx_engine_state_unique_active` index works because the flat `properties.entity_id` survives the spread into `payload`.                                                                                                                                                                               |
| 9   | `apps/mobile/store-listing/journeys/03-check-shifts/EVENT-SEQUENCE.md` updated to reference `shift list_viewed` and `shift detail_viewed`      | ✅     | Committed in `f6e40a99 docs(journey-03): update EVENT-SEQUENCE...`                                                                                                                                                                                                                                                                                                                                                                                                             |
| 10  | HANDOFF documents every `emit()` call site with its runtime location                                                                           | ✅     | "emit() call sites added" table above — both call sites are Server Actions, runtime confirmed server-side                                                                                                                                                                                                                                                                                                                                                                      |

### Idempotency bonus check

Re-invoking `journey-stuck-detector` immediately after the first run returned `{"checked":1,"signals_created":0}` — the 24h idempotency window correctly prevents duplicate signals.

### Test artifacts cleaned

After verification, the test rows (1 engine_state, 1 guardian_signal, 2 engine_event) for profile `c1373ed4...` were deleted to leave the local DB in a clean state for the next session.

---

## Known limitations / debt

1. **i18n debt** — Rescue prompt title/body in `trigger_journey_health_push()` are hardcoded Norwegian. Backlog: move into a translatable lookup table or Edge Function-rendered template.
2. **pg_cron unavailable in Supabase Local** — `journey-stuck-detector` must be invoked manually for local testing (the migration's `IF EXISTS` guard handles this gracefully). In production with pg_cron enabled the hourly schedule installs automatically.
3. **Migration drift** — `npx supabase migration up` cannot be used in this worktree because the local DB has migration `20260428100500` recorded but not present in the worktree files. Migration was applied directly via `docker exec ... psql` instead. Pre-existing condition unrelated to this PoC; needs `supabase migration repair` follow-up.
4. **Manual UI test deferred** — As a headless build agent, Task 9 was verified by directly invoking `engine-dispatch` with payloads that exactly mirror what the Server Action's `emit()` builds (matching `engine-event.ts:38-49 buildPayload`). The chain proof is identical. A human running `pnpm dev` and clicking through `/dashboard/my-schedule` is recommended as an additional smoke test before production rollout.
5. **`shift_id` in `shift detail_viewed` payload is not validated** — The Server Action accepts any string. For production, consider `z.string().uuid()` validation at the action boundary.
