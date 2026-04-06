---
title: "Journey Harness PoC — Journey 03 (Sjekke vakter)"
status: in_progress
updated: 2026-04-06
created: 2026-04-06
module: ai-agent
tags: [journey, harness, poc, council-approved]
---

# Journey 03 PoC — Agent Instruction

> Council-approved architecture (2026-04-06). Two council review rounds completed (2026-04-06): first identified 5 gaps, second verified amendments and caught 2 additional CRITICAL bugs (G1: wrong payload key, G2: client-side dev short-circuit). All 7 issues are now incorporated as **Critical Constraints C1-C6** and a strengthened **Prerequisite Check**. This PoC proves the full chain end-to-end for one journey before generalizing.

## Critical Constraints (Council-Required Amendments)

These constraints come from the council review of this instruction. Violating them will produce a broken PoC.

### C1: Scope to web-only for v1

The shared `emit()` function in `packages/telemetry/src/emit.ts` is web-first. It uses `document.cookie` for auth detection and `window.dispatchEvent(new CustomEvent(...))` — neither work in React Native. The mobile telemetry adapter is its own design problem.

**Decision:** PoC v1 instruments the **web dashboard's** shifts pages, not the mobile app. Mobile is Phase 2 with its own ADR for the offline emit strategy.

**Implication:** The "Files You Own" list below is updated to reflect web targets, not mobile.

### C2: Entity payload contract

Every telemetry event for the journey MUST include `entity_type: "profile"` and `entity_id: <profile_id>` in `properties`. Without these, `engine-dispatch` writes NULL into `engine_state.entity_type/entity_id`, the unique-active index cannot dedupe per user, and parallel journey instances will spawn duplicates.

```ts
emit({
  event: "shift list_viewed",
  workspace_id: profile.workspace_id,
  actor_id: profile.profile_id,
  properties: {
    entity_type: "profile",
    entity_id: profile.profile_id,
    // ...other props
  },
});
```

### C3: Step advancement uses `wait_for_event`, not a second trigger

The `engine_process` for Journey 03 must be designed so that:
- **Step 1**: `action_type: 'wait_for_event'`, `action_payload: { event: 'shift.list_viewed' }`
- **Step 2**: `action_type: 'wait_for_event'`, `action_payload: { event: 'shift.detail_viewed' }`

**CRITICAL: The payload key is `event`, NOT `event_type`.** Verified at `supabase/functions/engine-dispatch/index.ts:411`:
```ts
(currentStep.action_payload as Record<string, unknown>)?.event === event_type
```

The matcher reads `action_payload.event` and compares it to the incoming `event_type`. Existing seeds confirm this convention:
- `supabase/migrations/20260304300000_seed_daily_close_process.sql:71` — `'{ "event": "reconciliation.admin_action" }'`
- `supabase/migrations/20260412200100_seed_onboarding_process.sql:35` — `'{ "event": "protocol.all_completed" }'`

If you use `event_type` as the payload key instead of `event`, step 1 will enter `waiting` forever and the PoC will fail silently.

A SINGLE `engine_trigger` on `shift.list_viewed` creates the `engine_state`. Step 1 enters `waiting`, matches its event, completes, and step 2 enters `waiting`. When `shift.detail_viewed` arrives, `engine-dispatch` advances the existing waiting state — it does NOT create a new state.

**Prerequisite verification:** Before coding, the build agent must:
1. Read `supabase/functions/engine-dispatch/index.ts` lines 370-461
2. Quote line 411 verbatim in the worktree's HANDOFF to confirm the matcher reads `action_payload.event`, not `action_payload.event_type`
3. Cross-check against `seed_daily_close_process.sql:71` to confirm the convention

### C4: Event name format — registry vs trigger

- **Registry (`packages/telemetry/src/registry.ts`)** uses space form: `"shift list_viewed"`, `"shift detail_viewed"`.
- **`engine_trigger.event_type` (column)** and **`engine_step.action_payload.event` (JSON key)** use dot form: `"shift.list_viewed"`, `"shift.detail_viewed"`. Note the asymmetric naming — the trigger column is `event_type`, but the step payload JSON uses key `event` (per C3 evidence at engine-dispatch:411).
- The bridge: `packages/telemetry/src/providers/engine-event.ts` calls `toDotNotation()` which converts space-form → dot-form before writing to `engine_event`. **Do not bypass this — let the provider do the translation.**

The seed migration MUST use dot form. The mobile/web `emit()` calls MUST use space form.

### C5: Stuck detection — pick one runtime

The Guardian evaluator in Stage Engine only watches `engine_sessions`, not `engine_state`. The PoC needs a separate mechanism to detect a Journey 03 user stuck on step 1 for >24h. Pick one:

- **Option A (recommended for PoC):** A Supabase Edge Function on a pg_cron schedule (every 1h) that queries `engine_state WHERE process_id = 'journey_03_check_shifts' AND current_step = 1 AND status = 'waiting' AND updated_at < NOW() - INTERVAL '24 hours'`, then inserts into `guardian_signal`.
- **Option B:** Use `engine_delayed_trigger` IF a pg_cron job exists that polls it. The build agent must verify this runtime exists before choosing this option.

If neither runtime can be confirmed within the PoC, document it as a limitation and the guardian fires only on explicit signal (manual test).

### C6: Emit MUST originate from server-side code path

**CRITICAL:** `packages/telemetry/src/providers/engine-event.ts:74` short-circuits client-side emits in development:

```ts
if (typeof window !== "undefined") {
  if (process.env.NODE_ENV === "development") return;
  // ...client relay logic
}
```

**Implication for PoC:** Since the PoC runs in Supabase Local (`NODE_ENV=development` in Next.js dev server), every `emit()` call from a client component (`"use client"` file, `onClick` handler, `useEffect`, drawer, modal) will return immediately. The `engine_event` table never gets the row. The entire chain dies silently.

The server-side path (lines 92-98 of `engine-event.ts`) does work in dev, but ONLY if the emit originates from:
- A Server Component during render
- A Server Action invoked from the client on interaction
- A Route Handler / API route

**Required pattern for the PoC:**

For `shift list_viewed` (page render):
- Place `emit()` in the Server Component that renders the shifts page
- Emit during initial render, server-side

For `shift detail_viewed` (interaction):
- Create a Server Action (e.g. `markShiftViewed(shiftId)`) that calls `emit()` server-side
- Call the Server Action from the client on shift card click
- Do NOT call `emit()` directly from the client component

**Anti-pattern (will fail silently):**
```tsx
"use client";
function ShiftDetailDrawer() {
  useEffect(() => {
    emit({ event: "shift detail_viewed", ... }); // ← short-circuits in dev
  }, []);
}
```

**Correct pattern:**
```tsx
// app/dashboard/schedule/actions.ts
"use server";
export async function markShiftViewed(profileId: string, shiftId: string) {
  emit({ event: "shift detail_viewed", ... });
}

// app/dashboard/schedule/[id]/page.tsx (or client component)
"use client";
import { markShiftViewed } from "../actions";
// onClick={() => markShiftViewed(profile.profile_id, shift.id)}
```

**Build agent must:** Trace every `emit()` call site added in this PoC and confirm it runs server-side. List the call sites with their runtime in the HANDOFF. If any client-side emit slips through, the PoC will appear to work in production but fail in local Supabase development.

## Your Mission

Prove that the Journey Harness chain works for **Journey 03 — Sjekke vakter (Check shifts)** from telemetry emit to rescue delivery. One journey, full depth, no shortcuts.

## The Chain You Must Prove

```
[Employee taps shifts] → [emit() fires] → [activity_trail gets event]
    → [engine_trigger matches] → [engine_state created/advanced]
    → [Guardian detects stuck user] → [Rescue delivered]
```

---

## Focus Areas (YOUR scope)

### 1. Web Telemetry for Journey 03 Events (web-only for v1, see C1)

Add `emit()` calls to the **web dashboard's** shifts pages:

- `apps/web/src/app/dashboard/schedule/page.tsx` (or the route the build agent confirms is the employee shifts list)
- The shift detail page/drawer triggered from that list

**Events to emit** (use registry space form `"{entity} {verb}"`):
- `shift list_viewed` — when shifts list renders with data
- `shift detail_viewed` — when a specific shift detail is opened

**Drop `shift roster_viewed`** — the roster screen is manager-facing, not part of the employee Journey 03 (council finding).

**Registry expansion required.** In `packages/telemetry/src/registry.ts`:
- Add `list_viewed` and `detail_viewed` to the `ActionVerb` union
- Create `ShiftListViewed` and `ShiftDetailViewed` interface types extending `BaseEvent`
- Add them to the `SmartoutEvent` discriminated union
- Add routing entries in `EVENT_ROUTING` with **all four standard destinations** (`posthog`, `logger`, `activity_trail`, `engine_event`) — match the routing pattern of peer domain events like `shift created` or `shift updated`. Routing only to `engine_event` would break analytics and audit trail.

**Payload contract (C2).** Every emit MUST include in `properties`:
```ts
{
  entity_type: "profile",
  entity_id: profile.profile_id,
  // ...other domain props
}
```

### 2. Seed Journey 03 as engine_process

Seed via a migration file in `supabase/migrations/`. Use the existing journey compiler pattern in `packages/ai/src/journey/compile.ts` as reference, or write the seed SQL manually following the patterns in `20260308194433_seed_signup_onboarding_process.sql`.

**Process design (per C3 — note the payload key is `event`, NOT `event_type`):**

- `engine_process` row: `process_id = 'journey_03_check_shifts'`, descriptive title
- **Step 1**: `step_order = 1`, `action_type = 'wait_for_event'`, `action_payload = { "event": "shift.list_viewed" }`
- **Step 2**: `step_order = 2`, `action_type = 'wait_for_event'`, `action_payload = { "event": "shift.detail_viewed" }`
- **engine_trigger**: ONE row, `event_type = 'shift.list_viewed'` (dot form per C4), `process_id = 'journey_03_check_shifts'`. This trigger creates the `engine_state` instance when the first event arrives.

Note the asymmetry: `engine_trigger` uses column `event_type`, but `engine_step.action_payload` uses key `event`. Both expect dot form values.

**How advancement works (must match `engine-dispatch` behavior):**
1. User opens shifts page → web emits `shift list_viewed` → `engine-event` provider converts to `shift.list_viewed` → writes to `engine_event` table
2. `engine-dispatch` Edge Function picks up the event, matches the trigger, creates `engine_state` with `entity_type='profile'`, `entity_id=<profile_id>`, `current_step=1`
3. Step 1's `wait_for_event` action immediately matches the same incoming event → step 1 completes → step 2 enters `waiting`
4. User opens shift detail → web emits `shift detail_viewed` → reaches `engine_event` as `shift.detail_viewed`
5. `engine-dispatch` finds the existing `engine_state` for this profile in `waiting` status with a matching `wait_for_event` payload → advances step 2 → state completes

**Prerequisite check (do this first):** Read `supabase/functions/engine-dispatch/index.ts` and confirm step 4-5 logic exists. If `engine-dispatch` only creates new states from triggers but does not advance existing waiting states, the PoC has a hard prerequisite — adding this logic to `engine-dispatch`. Document the finding in your worktree's HANDOFF before writing the seed migration.

**Constraints:**
- Use space form in `registry.ts`, dot form in `engine_trigger.event_type` (column) and `engine_step.action_payload.event` (JSON key) per C4.
- Do NOT touch the existing `journey` or `journey_step` dev-tracking tables.

### 3. Stuck-Detection Mechanism (per C5)

Use **Option A** (recommended for PoC): A new Supabase Edge Function on a pg_cron schedule.

**Implementation:**
- Create `supabase/functions/journey-stuck-detector/index.ts`
- Function logic:
  ```sql
  SELECT engine_state_id, entity_id, workspace_id, current_step, updated_at
  FROM engine_state
  WHERE process_id = 'journey_03_check_shifts'
    AND current_step = 1
    AND status = 'waiting'
    AND updated_at < NOW() - INTERVAL '24 hours'
  ```
- For each row, INSERT into `guardian_signal`:
  - `domain: 'journey_health'`
  - `entity_type: 'profile'`
  - `entity_id: <engine_state.entity_id>`
  - `workspace_id: <engine_state.workspace_id>`
  - `title: 'Journey 03 stalled'`
  - `description: 'Employee opened shifts but never tapped a specific shift within 24h'`
- Schedule via pg_cron: `SELECT cron.schedule('journey-stuck-detector', '0 * * * *', $$SELECT net.http_post(...)$$);` — runs hourly
- Use idempotency: include a check `WHERE NOT EXISTS (SELECT 1 FROM guardian_signal WHERE entity_id = X AND domain = 'journey_health' AND created_at > NOW() - INTERVAL '24 hours')` to prevent duplicate signals

**Update Zod schema:** Add `"journey_health"` to the domain enum in `packages/ai/src/capabilities/guardian/tools.ts`.

**Constraints:**
- Do NOT modify the Guardian evaluator loop in `services/stage-engine/`
- Verify pg_cron is enabled in the local Supabase environment before scheduling. If not enabled, document and trigger the function manually for the PoC test
- For the PoC test, you can also bypass the 24h delay by manually updating an `engine_state.updated_at` to be older, then invoking the function

### 4. Rescue Delivery (Minimal)

For the PoC, prove one rescue delivery path:

- When `guardian_signal` is inserted with `domain = 'journey_health'`, trigger a notification via the existing `dispatch_push_notification()` PG function
- Implementation: a `BEFORE/AFTER INSERT` trigger on `guardian_signal` that checks `domain = 'journey_health'` and calls `dispatch_push_notification()`
- Rescue content from `apps/mobile/store-listing/journeys/03-check-shifts/RESCUE-PROMPTS.md` Gate 2 prompt (transcribed into the trigger or fetched via lookup)
- The notification should deep-link to the shifts page

**Verify before coding:** Confirm `dispatch_push_notification()` exists with this exact name. Search migrations: `grep -r "dispatch_push_notification" supabase/migrations/`. If the function name differs, use the actual name and document it.

**i18n debt:** Rescue content is Norwegian (from RESCUE-PROMPTS.md). Hardcoding it in the trigger is acceptable for PoC. Log to backlog: "Move rescue content into a translatable lookup table."

**Constraint:** For the PoC, push notification is fine. The council decided on a two-tier model (Botsson Breath in-app + push for absent users), but Botsson Breath is Phase 2.

---

## Boundaries (NOT your scope)

These are handled by the council session or future tickets. Do NOT touch:

| Area | Why not |
|------|---------|
| `journey` / `journey_step` DB tables | Dev-tracking artifacts, not runtime. Council decision. |
| Guardian Dashboard UI changes | Ticket 3 (after PoC proves the chain) |
| Journey Portal UI changes | Ticket 3 (after PoC) |
| Mobile Undertow/progress UI | Ticket 3 (Frontend Designer spec exists) |
| Botsson Breath rescue pattern | Ticket 4 (requires Botsson integration work) |
| Other journeys (01-02, 04-12) | Generalize after PoC works |
| `services/stage-engine/` code | Stage Engine evaluator changes are separate scope |
| `apps/web/` platform-admin pages | No UI work in this PoC |
| ADR writing | Council session handles ADRs |
| Offline emit ADR decision | PoC uses optimistic approach; formal ADR is separate |

## Files You Own

```
apps/web/src/app/dashboard/schedule/page.tsx (or correct route)  ← add emit() for list_viewed
apps/web/src/app/dashboard/schedule/[shiftId]/* (or detail route) ← add emit() for detail_viewed
packages/telemetry/src/registry.ts                                 ← register 2 new events + types + routing
supabase/migrations/YYYYMMDD_journey_03_poc_seed.sql               ← engine_process + step + trigger
supabase/migrations/YYYYMMDD_guardian_signal_push_trigger.sql      ← trigger on guardian_signal INSERT
supabase/functions/journey-stuck-detector/index.ts                 ← stuck detection EF
packages/ai/src/capabilities/guardian/tools.ts                     ← add journey_health to Zod enum
```

The build agent must confirm the exact web route paths during the prerequisite check (Section 2). The mobile equivalents are out of scope for v1 (per C1).

## Files You Must NOT Touch

```
apps/mobile/                              ← Phase 2 (per C1)
services/stage-engine/                    ← separate scope
apps/web/src/app/platform-admin/          ← no UI changes
packages/ai/src/journey/compile.ts        ← read for patterns, don't modify
supabase/migrations/*journey_system*      ← dev-tracking tables, hands off
.claude/agents/journey-inference.md       ← agent definition, separate ticket
docs/decisions/                           ← council handles ADRs
```

## Prerequisite Check (run this BEFORE writing any code)

The build agent must verify ALL of these and document findings in the worktree's HANDOFF before writing any code. If any item fails, STOP and report.

1. **`engine-dispatch` resume-waiting logic exists with the EXACT payload key.**
   - Read `supabase/functions/engine-dispatch/index.ts` lines 370-461
   - Quote line 411 verbatim in HANDOFF — must show `action_payload.event === event_type`
   - If the matcher reads any other key (`event_type`, `event_name`, etc.), the spec is wrong — STOP and report

2. **`dispatch_push_notification()` PG function exists.**
   - `grep -r "CREATE.*FUNCTION.*dispatch_push_notification" supabase/migrations/`
   - Note exact signature and required parameters

3. **pg_cron AND pg_net extensions are enabled in Supabase Local.**
   - Check `supabase/config.toml` for `[db.extensions]`
   - Both extensions are required for C5 Option A (`net.http_post` from a cron schedule)
   - If missing, document and trigger journey-stuck-detector manually for the PoC

4. **The `engine_event` provider dev-mode short-circuit is understood.**
   - Read `packages/telemetry/src/providers/engine-event.ts` lines 71-90
   - Confirm `toDotNotation()` behavior at line 15-17
   - Confirm the `NODE_ENV === "development"` short-circuit at line 74 only affects the client-side path
   - Per C6, all PoC emit calls MUST originate server-side

5. **Identify the employee-facing web shifts route.**
   - Find the actual route the employee uses to view their own shifts on web
   - Current `apps/web/src/app/dashboard/schedule/` is admin/manager-facing — verify if there's an employee equivalent
   - If NO employee-facing web shifts UI exists, STOP — Journey 03 has no web surface and the PoC must pivot

6. **`guardian_signal` table schema matches expected columns.**
   - Verify columns: `domain` (text), `entity_type`, `entity_id`, `workspace_id`, `title`, `description`, `created_at`
   - Read `supabase/migrations/20260314000000_guardian_signal.sql` to confirm

7. **`engine_state` unique-active index exists.**
   - Read `supabase/migrations/20260304100000_engine_process_tables.sql` lines 184-186
   - Confirm: `(entity_type, entity_id, process_id) WHERE status IN (...)` 
   - This index is what makes C2's payload contract load-bearing

8. **`registry.ts` Zod schema patterns.**
   - Inspect `packages/telemetry/src/registry.ts` for existing event interface + Zod patterns
   - The new events MUST follow the same pattern (interface extends BaseEvent + entry in SmartoutEvent union + EVENT_ROUTING entry)

## Definition of Done

The PoC is complete when:

1. An employee opening the shifts page **on web** emits `shift list_viewed` with `entity_type: "profile"` + `entity_id: <profile_id>` in properties — emit MUST originate server-side per C6
2. That event reaches `engine_event` (as `shift.list_viewed`) and creates an `engine_state` instance for that profile + Journey 03 process
3. The state advances: step 1 completes immediately, step 2 enters `waiting`
4. Tapping a shift detail emits `shift detail_viewed` (via Server Action per C6), which advances the SAME `engine_state` to step 2 complete (no duplicate state row)
5. Manually aging an `engine_state.updated_at` to >24h ago and invoking `journey-stuck-detector` produces a `guardian_signal` with `domain = 'journey_health'`
6. That `guardian_signal` INSERT triggers `dispatch_push_notification()` with rescue content from RESCUE-PROMPTS.md Gate 2
7. All of this works in Supabase Local (not production)
8. No duplicate `engine_state` rows for the same profile + process. **Verification query:**
   ```sql
   SELECT COUNT(*) FROM engine_state
   WHERE entity_id = '<test_profile_id>'
     AND process_id = 'journey_03_check_shifts';
   -- Must return 1, not 2
   ```
9. `apps/mobile/store-listing/journeys/03-check-shifts/EVENT-SEQUENCE.md` is updated to reference `shift list_viewed` and `shift detail_viewed` (replacing `page_viewed (shifts)` and `button_clicked (shift_detail)`) — same PR, not deferred
10. HANDOFF documents every `emit()` call site added in this PoC with its runtime location (Server Component / Server Action / Route Handler)

## Branch

Work in a worktree. Branch name: `feat/journey-harness-poc`. Do NOT work on `development` directly.
