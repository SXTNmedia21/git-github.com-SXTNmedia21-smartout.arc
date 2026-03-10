---
title: "Journey Engine Implementation Plan"
status: draft
updated: 2026-03-08
created: 2026-03-08
module: core
tags: [journey, engine, events, compile, e2e]
---

# Journey Engine Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the runtime Journey Engine that compiles journey definitions into engine_process blueprints, instruments UI with semantic events, and tracks user progress per-step through engine_state — proven with two end-to-end journeys (Sign Up + Configure Workspace).

**Architecture:** Journey PM table (`journey`) links to runtime via FK `engine_process_id`. A pure compile function converts `journey` + `journey_step` rows into `engine_process` + `engine_step` + `engine_trigger` structs. UI emits semantic step-events via `emit()` → engine-dispatch matches events to waiting `engine_state` instances using condition-match + entity-isolation. Per-step tracking via `engine_state_step` enables idle detection and portal visibility.

**Tech Stack:** Supabase (PostgreSQL, Edge Functions), TypeScript, Next.js (App Router), `@smartout/telemetry` emit(), Playwright E2E

---

## Critical Context for All Tasks

### Files You Must Read First

| File                                                           | Why                                                                |
| -------------------------------------------------------------- | ------------------------------------------------------------------ |
| `CLAUDE.md`                                                    | Project conventions, commit rules, code standards                  |
| `packages/telemetry/src/registry.ts`                           | Event registry — all events, routing config, TypeScript interfaces |
| `packages/telemetry/src/providers/engine-event.ts`             | How events reach engine-dispatch (server direct / client relay)    |
| `supabase/functions/engine-dispatch/index.ts`                  | All 16 action handlers, trigger matching, resumption logic         |
| `packages/ai/src/engine/condition-evaluator.ts`                | evaluateCondition — match, step_status, all, any operators         |
| `supabase/migrations/20260304100000_engine_process_tables.sql` | Engine schema: 6 tables                                            |
| `supabase/migrations/20260301140000_journey_system.sql`        | Journey PM schema: 4 tables, 7 enums                               |

### Architecture Invariants

1. **`emit()` is the ONLY event emitter.** No parallel event systems. Telemetry emit() → 4 destinations.
2. **engine_event.event_type uses dot notation.** `toDotNotation()` in engine-event.ts converts "shift published" → "shift.published". Engine-dispatch matches on dot notation.
3. **engine_process.id is TEXT PK** (human-readable: "daily_close", "signup_onboarding").
4. **engine_state has a UNIQUE partial index** on (entity_type, entity_id, process_id) WHERE status IN ('pending', 'active', 'waiting'). No duplicate active processes per entity.
5. **service_role manages all engine tables.** RLS policies: SELECT for workspace members, ALL for service_role.
6. **Conventional commits required.** Format: `type(scope): description`

### How emit() Works

```typescript
// In registry.ts — event name uses space notation
export interface SignupCompleted extends BaseEvent {
  event: "signup completed";
  properties: { data: { user_identity_id: string } };
}

// In EVENT_ROUTING — routes to destinations
"signup completed": {
  destinations: ["posthog", "logger", "activity_trail", "engine_event"],
  category: "onboarding",
}

// engine-event.ts converts to dot notation before dispatch:
// "signup completed" → "signup.completed" → POST engine-dispatch
```

### BaseEvent.workspace_id is nullable

`BaseEvent.workspace_id` is `string | null` (changed in Task 1.4). Pre-workspace events (signup.completed) pass `null`. The engine-event provider passes `null` through to engine-dispatch. Engine-dispatch accepts NULL workspace_id (Task 1.3/1.6). **Never use empty string `""` — it fails UUID constraint.**

### How engine-dispatch Resumption Works (current)

```typescript
// 1. Event arrives → recorded in engine_event
// 2. Match active triggers → create new engine_states
// 3. Scan ALL waiting engine_states in workspace:
const { data: waitingStates } = await supabase
  .from("engine_state")
  .select("*")
  .eq("workspace_id", workspace_id)
  .eq("status", "waiting");

// 4. For each waiting state, check if current step matches event:
if (
  currentStep?.action_type === "wait_for_event" &&
  currentStep.action_payload?.event === event_type
  // ← NO condition check, NO entity filtering (this is what we fix)
)
```

---

## Phase 1: Foundation

All 8 tasks in this phase are independent — run them in parallel.

---

### Task 1.1: Migration — journey.engine_process_id FK

**Files:**

- Create: `supabase/migrations/YYYYMMDDHHMMSS_journey_engine_process_link.sql`

**Step 1: Write the migration**

```sql
SET search_path TO public, extensions;

-- Link journey PM table to engine runtime
ALTER TABLE journey ADD COLUMN IF NOT EXISTS engine_process_id TEXT REFERENCES engine_process(id);

-- Compile metadata — used by compile function to generate engine_process + triggers
ALTER TABLE journey ADD COLUMN IF NOT EXISTS trigger_event TEXT;      -- e.g. "signup.completed"
ALTER TABLE journey ADD COLUMN IF NOT EXISTS step_event_type TEXT;    -- e.g. "onboarding.step_completed"
ALTER TABLE journey ADD COLUMN IF NOT EXISTS entity_type TEXT;        -- e.g. "user_identity"

-- Index for join queries in Journey Portal
CREATE INDEX IF NOT EXISTS idx_journey_engine_process ON journey(engine_process_id)
  WHERE engine_process_id IS NOT NULL;

COMMENT ON COLUMN journey.engine_process_id IS 'FK to engine_process. Set by compile. NULL = not yet compiled.';
COMMENT ON COLUMN journey.trigger_event IS 'Engine event_type that starts this journey (dot notation). Used by compile.';
COMMENT ON COLUMN journey.step_event_type IS 'Default event_type for wait_for_event steps (dot notation). Used by compile.';
COMMENT ON COLUMN journey.entity_type IS 'Entity type for engine_state tracking. Used by compile.';
```

**Step 2: Apply migration locally**

Run: `npx supabase db reset` or `npx supabase migration up`
Expected: Migration applies without error.

**Step 3: Verify column exists**

Run: `npx supabase db lint` (no errors)
Verify: `journey` table has `engine_process_id` column.

**Step 4: Regenerate types**

Run: `npx supabase gen types typescript --local > packages/supabase/src/database.types.ts`
Verify: `database.types.ts` includes `engine_process_id: string | null` on journey table type.

**Step 5: Commit**

```bash
git add supabase/migrations/YYYYMMDDHHMMSS_journey_engine_process_link.sql packages/supabase/src/database.types.ts
git commit -m "feat(journey): add engine_process_id FK to journey table"
```

---

### Task 1.2: Migration — journey_step override columns

**Files:**

- Create: `supabase/migrations/YYYYMMDDHHMMSS_journey_step_overrides.sql`

**Step 1: Write the migration**

```sql
SET search_path TO public, extensions;

-- Slug for condition matching — compile reads this directly, never generates from title
ALTER TABLE journey_step ADD COLUMN IF NOT EXISTS slug TEXT;

-- Allow journey_step to override default wait_for_event behavior
-- Used for non-standard steps like send_notification, update_entity
ALTER TABLE journey_step ADD COLUMN IF NOT EXISTS action_type_override TEXT;
ALTER TABLE journey_step ADD COLUMN IF NOT EXISTS action_payload_override JSONB;

COMMENT ON COLUMN journey_step.slug IS 'Machine-readable step ID used in engine condition matching. Must match what emit() sends as step_id.';
COMMENT ON COLUMN journey_step.action_type_override IS 'If set, compile uses this instead of default wait_for_event.';
COMMENT ON COLUMN journey_step.action_payload_override IS 'If set, compile uses this as action_payload instead of generating one.';
```

**Step 2: Apply + regen types** (same as 1.1)

**Step 3: Commit**

```bash
git add supabase/migrations/YYYYMMDDHHMMSS_journey_step_overrides.sql packages/supabase/src/database.types.ts
git commit -m "feat(journey): add action_type/payload override columns to journey_step"
```

---

### Task 1.3: Migration — engine_event.workspace_id nullable + RLS

**Files:**

- Create: `supabase/migrations/YYYYMMDDHHMMSS_engine_event_nullable_workspace.sql`

**Context:** `signup.completed` is a pre-workspace event — user_identity exists but workspace does not. engine_event.workspace_id is currently NOT NULL. We need it nullable for pre-workspace events.

**Step 1: Write the migration**

```sql
SET search_path TO public, extensions;

-- Allow pre-workspace events (signup.completed emitted before workspace exists)
ALTER TABLE engine_event ALTER COLUMN workspace_id DROP NOT NULL;

-- RLS: allow users to read their own pre-workspace events
DROP POLICY IF EXISTS "read_own_pre_workspace_events" ON engine_event;
CREATE POLICY "read_own_pre_workspace_events" ON engine_event
  FOR SELECT USING (
    workspace_id IS NULL
    AND payload->>'actor_id' = auth.uid()::text
  );

COMMENT ON COLUMN engine_event.workspace_id IS 'NULL for pre-workspace events (e.g. signup.completed). All other events must have workspace_id.';
```

**Step 2: Verify engine-dispatch handles NULL workspace_id**

Read: `supabase/functions/engine-dispatch/index.ts:158`
Current validation: `if (!event_type || !workspace_id)` → returns 400.
This MUST be loosened to allow NULL workspace_id.

Update the validation (this change is in Task 1.5-1.8 scope — flag it but don't change engine-dispatch here):

```typescript
// BEFORE:
if (!event_type || !workspace_id) {
// AFTER:
if (!event_type) {
```

⚠️ **NOTE:** engine-dispatch validation change happens in Tasks 1.5-1.8. This migration only handles the schema + RLS side.

**Step 3: Apply + regen types**

**Step 4: Commit**

```bash
git add supabase/migrations/YYYYMMDDHHMMSS_engine_event_nullable_workspace.sql packages/supabase/src/database.types.ts
git commit -m "feat(engine): make engine_event.workspace_id nullable for pre-workspace events"
```

---

### Task 1.4: Registry — 5 new semantic events

**Files:**

- Modify: `packages/telemetry/src/registry.ts`

**Step 0: Make BaseEvent.workspace_id nullable**

In `registry.ts`, change BaseEvent (line 2-7):

```typescript
// BEFORE:
export interface BaseEvent {
  workspace_id: string;
  // ...
}

// AFTER:
export interface BaseEvent {
  workspace_id: string | null;
  // ...
}
```

Then update `packages/telemetry/src/providers/engine-event.ts` `buildPayload()` to pass null through:

```typescript
function buildPayload(event: SmartoutEvent) {
  const eventType = toDotNotation(event.event);
  return {
    event_type: eventType,
    workspace_id: event.workspace_id || null, // Convert "" to null, pass null through
    payload: {
      actor_id: event.actor_id,
      correlation_id: event.correlation_id,
      ...event.properties,
    },
    idempotency_key: `${eventType}-${event.workspace_id ?? "no-ws"}-${event.timestamp ?? new Date().toISOString()}`,
  };
}
```

⚠️ **Impact check:** All existing `emit()` callers pass `workspace_id: string`. Adding `| null` is backwards-compatible — existing code still compiles. Only new pre-workspace events use `null`.

Check ALL providers (posthog, logger, activity_trail) handle null workspace_id gracefully. PostHog accepts null properties. Logger just logs. activity_trail has workspace_id NOT NULL — either skip INSERT for null workspace, or make it nullable too. **Read activity_trail schema before deciding.**

**Step 1: Add TypeScript interfaces**

Add AFTER `HandbookChapterSaved` interface (line ~345) and BEFORE `SmartoutEvent` union:

```typescript
// ─── Journey: Signup + Onboarding ──────────────────
export interface SignupCompleted extends BaseEvent {
  event: "signup completed";
  properties: {
    data: {
      user_identity_id: string;
    };
  };
}

export interface OnboardingStepCompleted extends BaseEvent {
  event: "onboarding step_completed";
  properties: {
    data: {
      step_id: string;
      step_index: number;
      user_identity_id: string;
    };
  };
}

export interface WorkspaceCreated extends BaseEvent {
  event: "workspace created";
  properties: {
    data: {
      workspace_id: string;
      user_identity_id: string;
    };
  };
}

// ─── Journey: Workspace Setup Wizard ───────────────
export interface WizardStepCompleted extends BaseEvent {
  event: "wizard step_completed";
  properties: {
    data: {
      step_id: string;
      step_index: number;
    };
  };
}

export interface WizardCompleted extends BaseEvent {
  event: "wizard completed";
  properties: {
    data: {
      workspace_id: string;
    };
  };
}
```

**Step 2: Add to SmartoutEvent union**

```typescript
export type SmartoutEvent =
  // ... existing ...
  | HandbookChapterSaved
  | SignupCompleted
  | OnboardingStepCompleted
  | WorkspaceCreated
  | WizardStepCompleted
  | WizardCompleted
  | PageViewed
  | ButtonClicked;
```

**Step 3: Add routing entries**

Add to `EVENT_ROUTING`:

```typescript
"signup completed": {
  destinations: ["posthog", "logger", "activity_trail", "engine_event"],
  category: "onboarding",
},
"onboarding step_completed": {
  destinations: ["posthog", "logger", "engine_event"],
  category: "onboarding",
},
"workspace created": {
  destinations: ["posthog", "logger", "activity_trail", "engine_event"],
  category: "onboarding",
},
"wizard step_completed": {
  destinations: ["posthog", "logger", "engine_event"],
  category: "onboarding",
},
"wizard completed": {
  destinations: ["posthog", "logger", "activity_trail", "engine_event"],
  category: "onboarding",
},
```

**Step 4: Typecheck**

Run: `pnpm --filter @smartout/telemetry tsc --noEmit`
Expected: 0 errors.

**Step 5: Commit**

```bash
git add packages/telemetry/src/registry.ts
git commit -m "feat(telemetry): add 5 journey events — signup, onboarding, workspace, wizard"
```

---

### Task 1.5: Engine-dispatch — condition-match in resumption

**Files:**

- Modify: `supabase/functions/engine-dispatch/index.ts`

**Context:** Current resumption (line ~335) checks only `event_type`. Must also check `condition` so that `wait_for_event("onboarding.step_completed", match: {step_id: "business"})` only resumes when the event payload actually has `step_id: "business"`.

**Step 1: Read engine-dispatch/index.ts fully before editing**

Understand:

- `evaluateCondition()` at line ~40 (duplicated from packages/ai)
- Resumption loop at line ~322-368
- The match at line ~335-338

**Step 2: Update resumption condition check**

Find this block (~line 335-338):

```typescript
if (
  currentStep?.action_type === "wait_for_event" &&
  (currentStep.action_payload as Record<string, unknown>)?.event === event_type
)
```

Replace with:

```typescript
if (
  currentStep?.action_type === "wait_for_event" &&
  (currentStep.action_payload as Record<string, unknown>)?.event === event_type &&
  evaluateCondition(currentStep.condition, (payload ?? {}) as Record<string, unknown>)
)
```

This is backwards-compatible: existing wait_for_event steps without condition have `condition: null`, and `evaluateCondition(null, ctx)` returns `true`.

**Step 3: Commit** (will be combined with 1.6-1.8 in a single engine-dispatch commit)

---

### Task 1.6: Engine-dispatch — match_state operator + entity filtering

**Files:**

- Modify: `supabase/functions/engine-dispatch/index.ts`
- Modify: `packages/ai/src/engine/condition-evaluator.ts`

**Context:** Without entity filtering, one user's event resumes ALL waiting states for that event type across the workspace. We need:

1. Entity isolation: event entity_id must match state entity_id
2. `match_state` operator for cross-entity events (J1 step 9: workspace.created has workspace entity_id but must match signup_onboarding which has user_identity entity_id)

**Step 1: Add match_state to condition-evaluator.ts**

File: `packages/ai/src/engine/condition-evaluator.ts`

Current signature:

```typescript
export function evaluateCondition(condition: unknown, context: Context): boolean;
```

New signature:

```typescript
type Context = Record<string, unknown>;

export function evaluateCondition(
  condition: unknown,
  context: Context,
  stateContext?: Context,
): boolean;
```

Add AFTER the `"any"` handler (line ~27), BEFORE the `return false`:

```typescript
if ("match_state" in cond) {
  const matchState = cond.match_state as Record<string, string>;
  if (!stateContext) return false;
  return Object.entries(matchState).every(
    ([payloadKey, stateKey]) => context[payloadKey] === stateContext[stateKey],
  );
}
```

Also update `"all"` and `"any"` recursive calls to pass `stateContext`:

```typescript
if ("all" in cond) {
  const conditions = cond.all as unknown[];
  return conditions.every((c) => evaluateCondition(c, context, stateContext));
}

if ("any" in cond) {
  const conditions = cond.any as unknown[];
  return conditions.some((c) => evaluateCondition(c, context, stateContext));
}
```

**Step 2: Mirror match_state in engine-dispatch evaluateCondition**

The engine-dispatch Edge Function has its OWN copy of `evaluateCondition` (lines ~40-67). Update it identically:

```typescript
function evaluateCondition(
  condition: unknown,
  context: Record<string, unknown>,
  stateContext?: Record<string, unknown>,
): boolean {
  // ... existing match, step_status handlers ...

  if ("match_state" in cond) {
    const matchState = cond.match_state as Record<string, string>;
    if (!stateContext) return false;
    return Object.entries(matchState).every(
      ([payloadKey, stateKey]) => context[payloadKey] === stateContext[stateKey],
    );
  }

  if ("all" in cond) {
    const conditions = cond.all as unknown[];
    return conditions.every((c) => evaluateCondition(c, context, stateContext));
  }

  if ("any" in cond) {
    const conditions = cond.any as unknown[];
    return conditions.some((c) => evaluateCondition(c, context, stateContext));
  }

  return false;
}
```

**Step 3: Update resumption loop with entity filtering**

Replace the entire resumption condition from Task 1.5 with the final version:

```typescript
// Build state context for match_state evaluation
const stateCtx: Record<string, unknown> = {
  entity_id: state.entity_id,
  entity_type: state.entity_type,
  ...state.context,
};

const conditionMatch = evaluateCondition(
  currentStep.condition,
  (payload ?? {}) as Record<string, unknown>,
  stateCtx,
);

const entityMatch =
  state.entity_id === null ||
  state.entity_id === ((payload as Record<string, unknown>)?.entity_id ?? null);

const hasMatchState =
  currentStep.condition != null &&
  "match_state" in (currentStep.condition as Record<string, unknown>);

if (
  currentStep?.action_type === "wait_for_event" &&
  (currentStep.action_payload as Record<string, unknown>)?.event === event_type &&
  conditionMatch &&
  (entityMatch || hasMatchState)
)
```

**Logic table:**

| Scenario                                  | conditionMatch | entityMatch | hasMatchState | Result |
| ----------------------------------------- | -------------- | ----------- | ------------- | ------ |
| Steps 1-8: right user, right step_id      | true           | true        | false         | RESUME |
| Steps 1-8: right user, wrong step_id      | false          | true        | false         | SKIP   |
| Steps 1-8: wrong user, right step_id      | true           | false       | false         | SKIP   |
| Step 9: right user_identity_id in payload | true           | false       | true          | RESUME |
| Step 9: wrong user_identity_id            | false          | false       | true          | SKIP   |

**Step 4: Loosen workspace_id validation**

At line ~158, change:

```typescript
if (!event_type || !workspace_id) {
```

to:

```typescript
if (!event_type) {
```

And update trigger matching to handle NULL workspace_id (line ~214-216):

```typescript
const { data: triggers, error: trigErr } = await supabase
  .from("engine_trigger")
  .select("*")
  .eq("event_type", event_type)
  .eq("is_active", true);
```

No change needed — global triggers (workspace_id=NULL) already match. The workspace filter at line ~235 already handles this: `if (t.workspace_id && t.workspace_id !== workspace_id) return false;` — if event workspace_id is null/undefined and trigger workspace_id is null, this passes.

For waiting state scan — need to handle NULL workspace_id:

```typescript
// If workspace_id provided, filter by it. Otherwise scan all waiting states
// (pre-workspace events like signup.completed)
let waitingQuery = supabase.from("engine_state").select("*").eq("status", "waiting");

if (workspace_id) {
  waitingQuery = waitingQuery.eq("workspace_id", workspace_id);
}

const { data: waitingStates } = await waitingQuery;
```

⚠️ **Important:** For pre-workspace events (workspace_id=NULL), entity filtering is CRITICAL — without workspace scoping, entity_id match is the only isolation. This is safe because signup.completed events always carry entity_id (user_identity_id).

**Step 5: Commit** (combined with 1.5, 1.7, 1.8)

---

### Task 1.7: Engine-dispatch — engine_state_step at process start

**Files:**

- Modify: `supabase/functions/engine-dispatch/index.ts`

**Context:** Currently engine-dispatch creates `engine_state` with `steps_snapshot` but does NOT create `engine_state_step` rows. Training processes use `generate_steps` handler to create them dynamically. Compiled journey processes have static steps — they need `engine_state_step` rows at start for per-step tracking.

**Step 1: Add state_step creation after engine_state INSERT**

Find the block after `engine_state` INSERT (around line ~281-298). After the INSERT and BEFORE `executeStep`, add:

```typescript
// Create engine_state_step rows for static step tracking
// Skip if process uses generate_steps (those create steps dynamically)
const hasGenerateSteps = (steps ?? []).some(
  (s: Record<string, unknown>) => s.action_type === "generate_steps",
);

if (state && steps && steps.length > 0 && !hasGenerateSteps) {
  const stateSteps = steps.map((s: Record<string, unknown>) => ({
    state_id: state.id,
    step_order: s.step_order as number,
    status: (s.step_order as number) === 1 ? "active" : "pending",
    action_type: s.action_type as string,
    action_payload: s.action_payload ?? {},
    condition: s.condition ?? null,
    assignee_rule: s.assignee_rule ?? null,
  }));
  await supabase.from("engine_state_step").insert(stateSteps);
}
```

**Step 2: Commit** (combined with 1.5, 1.6, 1.8)

---

### Task 1.8: Engine-dispatch — step status in advanceToNextStep

**Files:**

- Modify: `supabase/functions/engine-dispatch/index.ts`

**Context:** `advanceToNextStep()` records results in `engine_state.result` but does NOT update `engine_state_step` status. We need per-step completion timestamps for portal tracking and idle detection.

**Step 1: Update advanceToNextStep**

Find `advanceToNextStep()` (around line ~105). Add step status updates:

```typescript
async function advanceToNextStep(
  supabase: ReturnType<typeof createClient>,
  state: EngineState,
  step: EngineStep,
): Promise<void> {
  // Mark current step as completed in engine_state_step
  await supabase
    .from("engine_state_step")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
    })
    .eq("state_id", state.id)
    .eq("step_order", step.step_order);

  const stepResult = {
    ...((state.result ?? {}) as Record<string, unknown>),
    [step.step_order]: {
      status: "complete",
      action_type: step.action_type,
      completed_at: new Date().toISOString(),
    },
  };
  const nextOrder = step.step_order + 1;
  const allSteps = await getStepsForState(supabase, state);
  const nextStep = allSteps.find((s) => s.step_order === nextOrder);

  if (nextStep) {
    // Mark next step as active
    await supabase
      .from("engine_state_step")
      .update({ status: "active", updated_at: new Date().toISOString() })
      .eq("state_id", state.id)
      .eq("step_order", nextStep.step_order);

    await supabase
      .from("engine_state")
      .update({
        current_step: nextOrder,
        result: stepResult,
        updated_at: new Date().toISOString(),
      })
      .eq("id", state.id);
    await executeStep(
      supabase,
      { ...state, current_step: nextOrder, result: stepResult },
      nextStep,
    );
  } else {
    await supabase
      .from("engine_state")
      .update({
        status: "complete",
        result: stepResult,
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", state.id);
  }
}
```

Note: The `engine_state_step` updates are fire-and-forget — if the row doesn't exist (e.g. old process without static steps), the UPDATE matches 0 rows and silently succeeds. Backwards-compatible.

**Step 2: Commit all engine-dispatch changes (1.5 + 1.6 + 1.7 + 1.8)**

```bash
git add supabase/functions/engine-dispatch/index.ts packages/ai/src/engine/condition-evaluator.ts
git commit -m "feat(engine): condition-match, entity filtering, match_state operator, step tracking in engine-dispatch"
```

---

### Task 1.9: Deploy engine-dispatch Edge Function

**Depends on:** Tasks 1.5–1.8 committed.

**⚠️ This is a production-affecting deploy. Confirm with user before running.**

**Step 1: Deploy**

Run: `npx supabase functions deploy engine-dispatch --project-ref <ref>`

Expected: Deployment succeeds, function size ~870-900kB.

**Step 2: Smoke test**

```bash
curl -X POST https://<project-ref>.supabase.co/functions/v1/engine-dispatch \
  -H "Authorization: Bearer <service_role_key>" \
  -H "Content-Type: application/json" \
  -d '{"event_type": "test.smoke", "workspace_id": null, "payload": {}}'
```

Expected: `{ "event_id": "...", "triggers_matched": 0, "results": [], "waiting_resumed": 0 }`

(No triggers match "test.smoke" — we just verify the function is reachable and handles NULL workspace_id.)

**Step 3: Commit** (nothing to commit — deploy only)

---

## Phase 2: Compile + Event Instrumentation

Depends on Phase 1. Tasks 2.1-2.4 (compile) can run in parallel with 2.5-2.8 (emit instrumentation).

---

### Task 2.1: Compile pure function

**Files:**

- Create: `packages/ai/src/journey/compile.ts`

**Read first:**

- `supabase/migrations/20260301140000_journey_system.sql` — journey + journey_step schema
- `supabase/migrations/20260304100000_engine_process_tables.sql` — engine_process + engine_step + engine_trigger schema
- `packages/supabase/src/database.types.ts` — generated types

**Step 1: Create the file**

```typescript
/**
 * Journey Compiler — converts journey PM definitions into engine runtime structs.
 *
 * Pure function. No DB access. Called by server action or CLI.
 *
 * Input: journey + steps + metadata
 * Output: engine_process + engine_steps + engine_trigger (ready for INSERT)
 */

export interface CompileInput {
  /** Journey slug — becomes engine_process.id */
  journeySlug: string;
  /** Human-readable name */
  journeyName: string;
  /** Description */
  journeyDescription: string | null;
  /** Steps from journey_step table, ordered by step_order */
  steps: CompileStepInput[];
  /** Event that starts this journey */
  triggerEvent: string;
  /** Default event type for wait_for_event steps (e.g. "onboarding.step_completed") */
  stepEventType: string;
  /** Entity type for engine_state (e.g. "user_identity", "workspace") */
  entityType: string;
  /** Workspace-scoped or global (null) */
  workspaceId: string | null;
}

export interface CompileStepInput {
  /** Step slug from journey_step.slug — read directly, never generated from title.
   *  Must match what emit() sends as step_id in event payload. */
  slug: string;
  /** Display order */
  stepOrder: number;
  /** Override action_type (null = default wait_for_event) */
  actionTypeOverride: string | null;
  /** Override action_payload (null = generated from stepEventType + slug) */
  actionPayloadOverride: Record<string, unknown> | null;
}

export interface CompileOutput {
  process: {
    id: string;
    name: string;
    description: string | null;
    workspace_id: string | null;
    is_active: boolean;
    max_steps: number;
  };
  steps: Array<{
    process_id: string;
    step_order: number;
    action_type: string;
    action_payload: Record<string, unknown>;
    condition: Record<string, unknown> | null;
    assignee_rule: string | null;
  }>;
  trigger: {
    event_type: string;
    process_id: string;
    condition: Record<string, unknown> | null;
    delay_seconds: number;
    is_active: boolean;
    workspace_id: string | null;
  };
}

export function compileJourney(input: CompileInput): CompileOutput {
  const processId = input.journeySlug;

  const steps = input.steps.map((step) => {
    if (step.actionTypeOverride) {
      // Override: use provided action_type + payload, no auto-condition
      return {
        process_id: processId,
        step_order: step.stepOrder,
        action_type: step.actionTypeOverride,
        action_payload: step.actionPayloadOverride ?? {},
        condition: null,
        assignee_rule: null,
      };
    }

    // Default: wait_for_event with condition match on step slug
    return {
      process_id: processId,
      step_order: step.stepOrder,
      action_type: "wait_for_event",
      action_payload: { event: input.stepEventType },
      condition: { match: { step_id: step.slug } },
      assignee_rule: null,
    };
  });

  return {
    process: {
      id: processId,
      name: input.journeyName,
      description: input.journeyDescription,
      workspace_id: input.workspaceId,
      is_active: true,
      max_steps: Math.max(50, input.steps.length + 10),
    },
    steps,
    trigger: {
      event_type: input.triggerEvent,
      process_id: processId,
      condition: null,
      delay_seconds: 0,
      is_active: true,
      workspace_id: input.workspaceId,
    },
  };
}
```

**Step 2: Typecheck**

Run: `pnpm --filter @smartout/ai tsc --noEmit`
Expected: 0 errors.

**Step 3: Commit**

```bash
git add packages/ai/src/journey/compile.ts
git commit -m "feat(ai): add journey compile pure function"
```

---

### Task 2.2: Server action — compile in Journey Portal

**Files:**

- Create: `apps/web/src/app/platform-admin/journeys/actions/compile.ts`

**Read first:**

- `packages/ai/src/journey/compile.ts` (Task 2.1)
- `apps/web/src/app/platform-admin/journeys/[id]/page.tsx` — journey detail page
- `apps/web/src/app/platform-admin/journeys/[id]/_components/journey-detail-client.tsx` — client component

**Step 1: Create server action**

```typescript
"use server";

import { createClient } from "@smartout/supabase/server";
import {
  compileJourney,
  type CompileInput,
  type CompileStepInput,
} from "@smartout/ai/journey/compile";

interface CompileResult {
  success: boolean;
  processId?: string;
  stepsCreated?: number;
  error?: string;
}

export async function compileJourneyAction(journeyId: string): Promise<CompileResult> {
  const supabase = await createClient();

  // 1. Fetch journey + steps
  const { data: journey, error: journeyErr } = await supabase
    .from("journey")
    .select(
      "journey_id, slug, title, trigger_event, step_event_type, entity_type, module, workspace_id",
    )
    .eq("journey_id", journeyId)
    .single();

  if (journeyErr || !journey) {
    return { success: false, error: `Journey not found: ${journeyErr?.message}` };
  }

  const { data: steps, error: stepsErr } = await supabase
    .from("journey_step")
    .select(
      "journey_step_id, step_order, title, slug, action_type_override, action_payload_override",
    )
    .eq("journey_id", journeyId)
    .order("step_order");

  if (stepsErr) {
    return { success: false, error: `Failed to fetch steps: ${stepsErr.message}` };
  }

  if (!steps || steps.length === 0) {
    return { success: false, error: "Journey has no steps. Add steps before compiling." };
  }

  // 2. Build compile input — metadata comes from journey columns directly
  if (!journey.trigger_event || !journey.step_event_type || !journey.entity_type) {
    return {
      success: false,
      error:
        "Journey must have trigger_event, step_event_type, and entity_type set before compiling.",
    };
  }

  const compileSteps: CompileStepInput[] = steps.map((s) => {
    if (!s.slug) {
      throw new Error(
        `journey_step "${s.title}" (order ${s.step_order}) is missing slug. Set it before compiling.`,
      );
    }
    return {
      slug: s.slug,
      stepOrder: s.step_order,
      actionTypeOverride: s.action_type_override,
      actionPayloadOverride: s.action_payload_override as Record<string, unknown> | null,
    };
  });

  const input: CompileInput = {
    journeySlug: journey.slug,
    journeyName: journey.title,
    journeyDescription: null,
    steps: compileSteps,
    triggerEvent: journey.trigger_event,
    stepEventType: journey.step_event_type,
    entityType: journey.entity_type,
    workspaceId: null, // Global process (not workspace-scoped)
  };

  const output = compileJourney(input);

  // 3. UPSERT engine_process
  const { error: processErr } = await supabase
    .from("engine_process")
    .upsert(output.process, { onConflict: "id" });

  if (processErr) {
    return { success: false, error: `Failed to upsert engine_process: ${processErr.message}` };
  }

  // 4. DELETE + INSERT engine_steps (replace all for this process)
  await supabase.from("engine_step").delete().eq("process_id", output.process.id);

  const { error: stepsInsertErr } = await supabase.from("engine_step").insert(output.steps);

  if (stepsInsertErr) {
    return { success: false, error: `Failed to insert engine_steps: ${stepsInsertErr.message}` };
  }

  // 5. UPSERT engine_trigger (delete existing for this process, then insert)
  await supabase.from("engine_trigger").delete().eq("process_id", output.process.id);

  const { error: triggerErr } = await supabase.from("engine_trigger").insert(output.trigger);

  if (triggerErr) {
    return { success: false, error: `Failed to insert engine_trigger: ${triggerErr.message}` };
  }

  // 6. Update journey: link to engine_process + set status
  const { error: updateErr } = await supabase
    .from("journey")
    .update({
      engine_process_id: output.process.id,
      status: "ready_test",
    })
    .eq("journey_id", journeyId);

  if (updateErr) {
    return { success: false, error: `Failed to update journey: ${updateErr.message}` };
  }

  return {
    success: true,
    processId: output.process.id,
    stepsCreated: output.steps.length,
  };
}
```

**Step 2: Verify package exports**

Check that `@smartout/ai/journey/compile` is importable. May need to update `packages/ai/package.json` exports or `packages/ai/src/index.ts`.

**Step 3: Typecheck**

Run: `pnpm --filter web tsc --noEmit`

**Step 4: Commit**

```bash
git add apps/web/src/app/platform-admin/journeys/actions/compile.ts
git commit -m "feat(journey): add compile server action for Journey Portal"
```

---

### Task 2.3: Seed — signup_onboarding engine_process

**Files:**

- Create: `supabase/migrations/YYYYMMDDHHMMSS_seed_signup_onboarding_process.sql`

**Context:** This seeds the engine_process for Journey 1. In production, compile would generate this. We seed it manually to verify the engine works end-to-end without depending on the compile UI.

**Step 1: Write the seed migration**

```sql
SET search_path TO public, extensions;

-- ── signup_onboarding process ────────────────────────────────
-- Journey 1: Sign Up + Create Workspace
-- Triggered by: signup.completed
-- Entity: user_identity
-- Steps: 8 onboarding sections + workspace.created + notification

INSERT INTO engine_process (id, name, description, workspace_id, is_active, max_steps)
VALUES (
  'signup_onboarding',
  'Sign Up & Create Workspace',
  'Tracks user from signup through onboarding wizard to workspace creation. 10 steps: 8 sections + workspace finalize + notification.',
  NULL,  -- global process
  true,
  50
) ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  updated_at = now();

-- Delete existing steps to allow re-seeding
DELETE FROM engine_step WHERE process_id = 'signup_onboarding';

-- Steps 1-8: wait for each onboarding section
INSERT INTO engine_step (process_id, step_order, action_type, action_payload, condition) VALUES
  ('signup_onboarding', 1, 'wait_for_event',
    '{"event": "onboarding.step_completed"}'::jsonb,
    '{"match": {"step_id": "hero"}}'::jsonb),
  ('signup_onboarding', 2, 'wait_for_event',
    '{"event": "onboarding.step_completed"}'::jsonb,
    '{"match": {"step_id": "business"}}'::jsonb),
  ('signup_onboarding', 3, 'wait_for_event',
    '{"event": "onboarding.step_completed"}'::jsonb,
    '{"match": {"step_id": "departments"}}'::jsonb),
  ('signup_onboarding', 4, 'wait_for_event',
    '{"event": "onboarding.step_completed"}'::jsonb,
    '{"match": {"step_id": "locations"}}'::jsonb),
  ('signup_onboarding', 5, 'wait_for_event',
    '{"event": "onboarding.step_completed"}'::jsonb,
    '{"match": {"step_id": "procedures"}}'::jsonb),
  ('signup_onboarding', 6, 'wait_for_event',
    '{"event": "onboarding.step_completed"}'::jsonb,
    '{"match": {"step_id": "season"}}'::jsonb),
  ('signup_onboarding', 7, 'wait_for_event',
    '{"event": "onboarding.step_completed"}'::jsonb,
    '{"match": {"step_id": "contract"}}'::jsonb),
  ('signup_onboarding', 8, 'wait_for_event',
    '{"event": "onboarding.step_completed"}'::jsonb,
    '{"match": {"step_id": "welcome"}}'::jsonb),

  -- Step 9: wait for workspace.created (cross-entity — uses match_state)
  ('signup_onboarding', 9, 'wait_for_event',
    '{"event": "workspace.created"}'::jsonb,
    '{"match_state": {"user_identity_id": "entity_id"}}'::jsonb),

  -- Step 10: send notification (STUB — console.log only until notification_queue exists)
  ('signup_onboarding', 10, 'send_notification',
    '{"template": "workspace_ready"}'::jsonb,
    NULL);

-- Trigger: signup.completed → start signup_onboarding
DELETE FROM engine_trigger WHERE process_id = 'signup_onboarding';

INSERT INTO engine_trigger (event_type, process_id, condition, delay_seconds, is_active, workspace_id)
VALUES ('signup.completed', 'signup_onboarding', NULL, 0, true, NULL);

COMMENT ON TABLE engine_process IS 'signup_onboarding: 10 steps. Step 9 uses match_state for cross-entity workspace.created matching. Step 10 send_notification is a STUB.';
```

**Step 2: Apply migration**

Run: `npx supabase db reset` or `npx supabase migration up`

**Step 3: Verify**

```sql
SELECT id, name, is_active FROM engine_process WHERE id = 'signup_onboarding';
SELECT step_order, action_type, condition FROM engine_step WHERE process_id = 'signup_onboarding' ORDER BY step_order;
SELECT event_type, process_id FROM engine_trigger WHERE process_id = 'signup_onboarding';
```

**Step 4: Commit**

```bash
git add supabase/migrations/YYYYMMDDHHMMSS_seed_signup_onboarding_process.sql
git commit -m "feat(engine): seed signup_onboarding process — 10 steps, cross-entity match_state"
```

---

### Task 2.4: Seed — workspace_setup engine_process

**Files:**

- Create: `supabase/migrations/YYYYMMDDHHMMSS_seed_workspace_setup_process.sql`

**Step 1: Write the seed migration**

```sql
SET search_path TO public, extensions;

-- ── workspace_setup process ──────────────────────────────────
-- Journey 2: Configure Workspace
-- Triggered by: workspace.created (end of Journey 1)
-- Entity: workspace

INSERT INTO engine_process (id, name, description, workspace_id, is_active, max_steps)
VALUES (
  'workspace_setup',
  'Configure Workspace',
  'Tracks admin through workspace setup wizard. 9 steps matching wizard sections.',
  NULL,
  true,
  50
) ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  updated_at = now();

DELETE FROM engine_step WHERE process_id = 'workspace_setup';

INSERT INTO engine_step (process_id, step_order, action_type, action_payload, condition) VALUES
  ('workspace_setup', 1, 'wait_for_event',
    '{"event": "wizard.step_completed"}'::jsonb,
    '{"match": {"step_id": "welcome"}}'::jsonb),
  ('workspace_setup', 2, 'wait_for_event',
    '{"event": "wizard.step_completed"}'::jsonb,
    '{"match": {"step_id": "document-drop"}}'::jsonb),
  ('workspace_setup', 3, 'wait_for_event',
    '{"event": "wizard.step_completed"}'::jsonb,
    '{"match": {"step_id": "governance"}}'::jsonb),
  ('workspace_setup', 4, 'wait_for_event',
    '{"event": "wizard.step_completed"}'::jsonb,
    '{"match": {"step_id": "payroll"}}'::jsonb),
  ('workspace_setup', 5, 'wait_for_event',
    '{"event": "wizard.step_completed"}'::jsonb,
    '{"match": {"step_id": "employment"}}'::jsonb),
  ('workspace_setup', 6, 'wait_for_event',
    '{"event": "wizard.step_completed"}'::jsonb,
    '{"match": {"step_id": "team"}}'::jsonb),
  ('workspace_setup', 7, 'wait_for_event',
    '{"event": "wizard.step_completed"}'::jsonb,
    '{"match": {"step_id": "shift-template"}}'::jsonb),
  ('workspace_setup', 8, 'wait_for_event',
    '{"event": "wizard.step_completed"}'::jsonb,
    '{"match": {"step_id": "season"}}'::jsonb),
  ('workspace_setup', 9, 'wait_for_event',
    '{"event": "wizard.step_completed"}'::jsonb,
    '{"match": {"step_id": "handbook"}}'::jsonb);

-- Trigger: workspace.created → start workspace_setup
DELETE FROM engine_trigger WHERE process_id = 'workspace_setup';

INSERT INTO engine_trigger (event_type, process_id, condition, delay_seconds, is_active, workspace_id)
VALUES ('workspace.created', 'workspace_setup', NULL, 0, true, NULL);
```

**Step 2: Apply + verify + commit** (same pattern as 2.3)

```bash
git add supabase/migrations/YYYYMMDDHHMMSS_seed_workspace_setup_process.sql
git commit -m "feat(engine): seed workspace_setup process — 9 wizard steps"
```

---

### Task 2.5: Emit signup.completed in auth callback

**Files:**

- Modify: `apps/web/src/app/api/auth/callback/route.ts`

**Read first:** The current file (21 lines). See "Critical Context" above for how emit() works.

**Current code:**

```typescript
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }
  return NextResponse.redirect(`${origin}/login?error=Invalid_link`);
}
```

**Step 1: Add emit() after successful auth exchange**

```typescript
import { createClient } from "@smartout/supabase/server";
import { NextResponse } from "next/server";
import { emit } from "@smartout/telemetry";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Get user identity for event emission
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        // Emit signup.completed — triggers signup_onboarding engine process
        // workspace_id is null because workspace doesn't exist yet (pre-workspace event).
        // engine_event.workspace_id is nullable (migration 1.3).
        // BaseEvent.workspace_id accepts string | null (Task 1.4).
        try {
          await emit({
            event: "signup completed",
            workspace_id: null,
            actor_id: user.id,
            properties: {
              data: {
                user_identity_id: user.id,
              },
            },
          });
        } catch (e) {
          // Non-blocking: don't fail auth callback if event emission fails
          console.error("[auth/callback] Failed to emit signup.completed:", e);
        }
      }

      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=Invalid_link`);
}
```

⚠️ **workspace_id:** Pass `null` (not `""`). BaseEvent.workspace_id is `string | null` after Task 1.4. The engine-event provider converts null/empty to null in the dispatch payload (Task 1.4). Engine-dispatch accepts NULL workspace_id (Task 1.3/1.6).

**Step 2: Verify emit() import path**

Check: `packages/telemetry/src/index.ts` — does it export `emit`?

**Step 3: Typecheck + commit**

```bash
git add apps/web/src/app/api/auth/callback/route.ts
git commit -m "feat(journey): emit signup.completed in auth callback"
```

---

### Task 2.6: Emit onboarding.step_completed in sections

**Files:**

- Modify: `apps/web/src/app/onboarding/hooks/useOnboardingState.ts` (line ~285, `completeSection`)

**Context:** `completeSection(section)` is called by every onboarding section when user advances. Single emit point — no need to touch individual sections.

**Step 1: Add emit() to completeSection**

Find `completeSection` (line ~285):

```typescript
const completeSection = useCallback(
  (section: OnboardingSection) => {
    setSections((prev) => {
      // ...
    });
    // ...
  },
  [save],
);
```

Add emit after state update:

```typescript
import { emit } from "@smartout/telemetry";
import { VISIBLE_SECTIONS } from "../types";

const completeSection = useCallback(
  (section: OnboardingSection) => {
    setSections((prev) => {
      const idx = ONBOARDING_SECTIONS.indexOf(section);
      return prev.map((s, i) => {
        if (i === idx) return { ...s, status: "completed" as const };
        if (i === idx + 1) return { ...s, status: "active" as const };
        return s;
      });
    });

    // Emit journey event — drives engine_state advancement
    const stepIndex = VISIBLE_SECTIONS.indexOf(section);
    if (userId) {
      emit({
        event: "onboarding step_completed",
        workspace_id: onboardingWorkspaceId ?? null,
        actor_id: userId,
        properties: {
          data: {
            step_id: section,
            step_index: stepIndex,
            user_identity_id: userId,
          },
        },
      }).catch((e) => console.error("[onboarding] emit failed:", e));
    }

    const nextIdx = ONBOARDING_SECTIONS.indexOf(section) + 1;
    const next = ONBOARDING_SECTIONS[nextIdx];
    if (next) {
      setCurrentSection(next);
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => save(next), SAVE_DEBOUNCE_MS);
    }
  },
  [save, userId, onboardingWorkspaceId],
);
```

Note: `emit()` is async but fire-and-forget — `.catch()` logs errors without blocking UI. `userId` comes from hook state (check what's available in `useOnboardingState`).

**Step 2: Verify userId is available in scope**

Read the hook carefully. `userId` should be available from `useOnboardingState` — it's used in `provisionWorkspace` already.

**Step 3: Typecheck + commit**

```bash
git add apps/web/src/app/onboarding/hooks/useOnboardingState.ts
git commit -m "feat(journey): emit onboarding.step_completed in completeSection"
```

---

### Task 2.7: Emit workspace.created in finalize

**Files:**

- Modify: `apps/web/src/app/onboarding/hooks/useOnboardingState.ts` (line ~629, `finalize`)

**Step 1: Add emit() after successful finalize**

Find the finalize callback (~line 629). After the workspace is created and before return, add:

```typescript
// After workspaceId is set and slug is retrieved:

// Emit workspace.created — triggers workspace_setup engine process (Journey 2)
// Also advances signup_onboarding step 9 (match_state on user_identity_id)
try {
  await emit({
    event: "workspace created",
    workspace_id: workspaceId,
    actor_id: userId!,
    properties: {
      data: {
        workspace_id: workspaceId,
        user_identity_id: userId!,
      },
    },
  });
} catch (e) {
  console.error("[onboarding] Failed to emit workspace.created:", e);
}
```

⚠️ **Critical:** The payload MUST include both `workspace_id` (entity_id for Journey 2) AND `user_identity_id` (for match_state on Journey 1 step 9). Without `user_identity_id`, step 9 of signup_onboarding will never resume.

**Step 2: Find the exact insertion point**

The emit goes AFTER the workspace is fully created (after `finalize_onboarding_workspace` RPC succeeds and slug is fetched) but BEFORE the return statement.

**Step 3: Typecheck + commit**

```bash
git add apps/web/src/app/onboarding/hooks/useOnboardingState.ts
git commit -m "feat(journey): emit workspace.created in finalize — chains J1→J2"
```

---

### Task 2.8: Emit wizard events (replace button clicked)

**Files:**

- Modify: `apps/web/src/components/dashboard/WorkspaceSetupWizard.tsx`
- Modify wizard step files that currently emit `button clicked`:
  - `ShiftTemplateSetupStep.tsx` (trackingId: shift-template-created)
  - `TeamSetupStep.tsx` (trackingId: team-invitation-sent)
  - `DocumentDropStep.tsx` (trackingId: setup-documents-analyzed)
  - `EmploymentSetupStep.tsx` (trackingId: employment-terms-saved)
  - `HandbookSetupStep.tsx` (trackingId: handbook-chapter-saved)
  - `PayrollSetupStep.tsx` (trackingId: payroll-setup-saved)
  - `SeasonSetupStep.tsx` (trackingId: season-created)

**Read first:**

- `apps/web/src/components/dashboard/WorkspaceSetupWizard.tsx` — understand step lifecycle, state management
- Each step file listed above — find the existing `emit()` calls

**Step 1: Find the step-completion callback in WorkspaceSetupWizard**

Look for where steps advance (e.g. `goToNext`, `setCurrentStep`, `onComplete` callback). The emit should go in the central step-advance function, NOT in each individual step file. One emit point, like `completeSection` in onboarding.

If there is no central callback (each step advances independently), add `wizard.step_completed` emit in each step file where `button clicked` currently is — replacing it, not adding alongside.

**Step 2: Replace button clicked with wizard.step_completed**

For each step file, find:

```typescript
emit({
  event: "button clicked",
  workspace_id,
  actor_id,
  properties: { trackingId: "xxx" },
});
```

Replace with:

```typescript
emit({
  event: "wizard step_completed",
  workspace_id,
  actor_id,
  properties: {
    data: {
      step_id: "document-drop", // match the wizard step ID
      step_index: 1, // match the step number
    },
  },
});
```

**Step 3: Add wizard.completed after last step**

In the last step (HandbookSetupStep) or in the wizard's final callback, add:

```typescript
emit({
  event: "wizard completed",
  workspace_id,
  actor_id,
  properties: {
    data: {
      workspace_id,
    },
  },
});
```

**Step 4: Typecheck + commit**

```bash
git add apps/web/src/components/dashboard/WorkspaceSetupWizard.tsx
# + all modified step files
git commit -m "feat(journey): replace button clicked with wizard.step_completed + wizard.completed"
```

---

## Phase 3: E2E + Verification

Depends on Phase 1 + 2.

---

### Task 3.1: J1 E2E test — signup → onboarding → workspace

**Files:**

- Create: `apps/e2e/tests/journey-signup-onboarding.spec.ts`

**Read first:**

- `apps/e2e/helpers/auth.ts` — loginAsAdmin pattern
- `apps/e2e/helpers/seed.ts` — service-role client, seed helpers
- `apps/e2e/tests/signup-flow.spec.ts` — existing test patterns
- `apps/web/src/app/onboarding/types.ts` — VISIBLE_SECTIONS

**Step 1: Write the test**

```typescript
import { test, expect } from "@playwright/test";
import { supabase } from "../helpers/seed";

test.describe("journey:signup_onboarding", () => {
  let testEmail: string;
  let testPassword: string;
  let userId: string;

  test.beforeEach(async () => {
    // Create pre-confirmed user via admin API (skips email verification)
    testEmail = `e2e-journey-${Date.now()}@smartout.local`;
    testPassword = "TestPassword123!";

    const { data, error } = await supabase.auth.admin.createUser({
      email: testEmail,
      password: testPassword,
      email_confirm: true,
    });

    if (error) throw new Error(`Failed to create test user: ${error.message}`);
    userId = data.user.id;
  });

  test.afterEach(async () => {
    // Cleanup: delete test user (cascades to user_identity, engine_states)
    if (userId) {
      await supabase.auth.admin.deleteUser(userId);
    }
  });

  test("completes onboarding and creates engine_state", async ({ page }) => {
    test.setTimeout(90_000);

    // 1. Login
    await page.goto("/login");
    await page.locator('input[type="email"]').fill(testEmail);
    await page.locator('input[type="password"]').fill(testPassword);
    await page.locator('button[type="submit"]').click();

    // 2. Should redirect to onboarding (new user, no workspace)
    await page.waitForURL("**/onboarding**", { timeout: 15_000 });

    // 3. Complete hero section
    await expect(page.locator('[data-section="hero"]')).toBeVisible({ timeout: 10_000 });
    const heroNext = page.locator('[data-section="hero"] button:has-text("Kom i gang")');
    if (await heroNext.isVisible()) {
      await heroNext.click();
    }

    // 4. Complete business section (minimum: company name)
    await expect(page.locator('[data-section="business"]')).toBeVisible({ timeout: 10_000 });
    const nameInput = page
      .locator('[data-section="business"] input[placeholder*="bedrift"]')
      .first();
    if (await nameInput.isVisible()) {
      await nameInput.fill("E2E Test Company");
    }
    const businessNext = page
      .locator(
        '[data-section="business"] button:has-text("Neste"), [data-section="business"] button:has-text("Bekreft")',
      )
      .first();
    if (await businessNext.isVisible()) {
      await businessNext.click();
    }

    // 5-8. Navigate through remaining sections
    // Each section: wait for visible, click next/confirm
    for (const section of [
      "departments",
      "locations",
      "procedures",
      "season",
      "contract",
      "welcome",
    ]) {
      const sectionEl = page.locator(`[data-section="${section}"]`);
      // Scroll into view if needed
      await sectionEl.scrollIntoViewIfNeeded();
      await expect(sectionEl).toBeVisible({ timeout: 10_000 });

      // Find and click the advance button
      const nextBtn = sectionEl
        .locator(
          'button:has-text("Neste"), button:has-text("Fullfør"), button:has-text("Bekreft"), button:has-text("Hopp over")',
        )
        .first();
      if (await nextBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await nextBtn.click();
      }
    }

    // 9. Wait for redirect to dashboard (finalize creates workspace)
    await page.waitForURL("**/dashboard**", { timeout: 30_000 });

    // 10. DB assertions via service role
    // Check engine_state for signup_onboarding
    const { data: states } = await supabase
      .from("engine_state")
      .select("id, status, process_id, entity_id, completed_at")
      .eq("process_id", "signup_onboarding")
      .eq("entity_id", userId);

    expect(states).toBeTruthy();
    expect(states!.length).toBeGreaterThanOrEqual(1);

    const signupState = states![0];
    expect(signupState.status).toBe("complete");
    expect(signupState.completed_at).toBeTruthy();

    // Check engine_state_steps all completed
    const { data: stateSteps } = await supabase
      .from("engine_state_step")
      .select("step_order, status, completed_at")
      .eq("state_id", signupState.id)
      .order("step_order");

    expect(stateSteps).toBeTruthy();
    expect(stateSteps!.length).toBe(10);
    for (const step of stateSteps!) {
      expect(step.status).toBe("completed");
      expect(step.completed_at).toBeTruthy();
    }

    // Check workspace_setup was triggered by workspace.created
    const { data: setupStates } = await supabase
      .from("engine_state")
      .select("id, status, process_id")
      .eq("process_id", "workspace_setup");

    expect(setupStates).toBeTruthy();
    expect(setupStates!.length).toBeGreaterThanOrEqual(1);
    // workspace_setup should be active or waiting (step 1)
    expect(["active", "waiting"]).toContain(setupStates![0].status);
  });
});
```

⚠️ **This test is a scaffold.** The exact button selectors depend on the actual UI. The agent implementing this MUST read the onboarding sections to find correct selectors. Use `data-testid` if available, otherwise text content.

**Step 2: Run the test**

Run: `cd apps/e2e && npx playwright test tests/journey-signup-onboarding.spec.ts --headed`

**Step 3: Debug and fix selectors until test passes**

**Step 4: Commit**

```bash
git add apps/e2e/tests/journey-signup-onboarding.spec.ts
git commit -m "test(journey): E2E test for signup → onboarding → engine_state complete"
```

---

### Task 3.2: J2 E2E test — workspace setup wizard

**Files:**

- Create: `apps/e2e/tests/journey-workspace-setup.spec.ts`

**Context:** J2 is independent of J1. Seed a workspace + user directly. DO NOT depend on J1 test passing.

**Step 1: Write the test**

```typescript
import { test, expect } from "@playwright/test";
import { supabase, seedWorkspace, seedProfile } from "../helpers/seed";

test.describe("journey:workspace_setup", () => {
  let workspaceId: string;
  let userId: string;
  let testEmail: string;
  let testPassword: string;

  test.beforeEach(async () => {
    // Seed workspace + user directly
    testEmail = `e2e-setup-${Date.now()}@smartout.local`;
    testPassword = "TestPassword123!";

    // Create auth user
    const { data: authUser, error: authErr } = await supabase.auth.admin.createUser({
      email: testEmail,
      password: testPassword,
      email_confirm: true,
    });
    if (authErr) throw new Error(`Auth: ${authErr.message}`);
    userId = authUser.user.id;

    // Seed workspace
    const ws = await seedWorkspace({ name: "E2E Setup Test" });
    workspaceId = ws.workspace_id;

    // Seed profile (owner role)
    await seedProfile(workspaceId, {
      user_id: userId,
      role: "owner",
      display_name: "E2E Owner",
    });

    // Seed engine_state for workspace_setup (simulates workspace.created trigger)
    // Get steps from engine_step
    const { data: steps } = await supabase
      .from("engine_step")
      .select("*")
      .eq("process_id", "workspace_setup")
      .order("step_order");

    // Create engine_state
    const { data: engineState } = await supabase
      .from("engine_state")
      .insert({
        process_id: "workspace_setup",
        workspace_id: workspaceId,
        status: "waiting",
        current_step: 1,
        entity_type: "workspace",
        entity_id: workspaceId,
        context: {},
        steps_snapshot: steps ?? [],
      })
      .select()
      .single();

    // Create engine_state_step rows
    if (engineState && steps) {
      const stateSteps = steps.map((s: Record<string, unknown>) => ({
        state_id: engineState.id,
        step_order: s.step_order,
        status: (s.step_order as number) === 1 ? "active" : "pending",
        action_type: s.action_type,
        action_payload: s.action_payload ?? {},
        condition: s.condition ?? null,
      }));
      await supabase.from("engine_state_step").insert(stateSteps);
    }
  });

  test.afterEach(async () => {
    if (userId) await supabase.auth.admin.deleteUser(userId);
    // Workspace cleanup cascades via FK
    if (workspaceId) {
      await supabase.from("engine_state").delete().eq("workspace_id", workspaceId);
      await supabase.from("workspace").delete().eq("workspace_id", workspaceId);
    }
  });

  test("completes all wizard steps and engine_state is complete", async ({ page }) => {
    test.setTimeout(90_000);

    // Login
    await page.goto("/login");
    await page.locator('input[type="email"]').fill(testEmail);
    await page.locator('input[type="password"]').fill(testPassword);
    await page.locator('button[type="submit"]').click();
    await page.waitForURL("**/dashboard**", { timeout: 15_000 });

    // Wizard should show (empty workspace)
    await expect(page.locator('text="Oppsett av arbeidsrom"')).toBeVisible({ timeout: 15_000 });

    // Navigate through all 9 steps
    // Step IDs: welcome, document-drop, governance, payroll, employment, team, shift-template, season, handbook
    // Each step: find and click the primary action / next button
    // The exact selectors depend on the wizard UI — agent must read WorkspaceSetupWizard.tsx

    // ... (scaffold — agent fills in actual selectors)

    // DB assertions
    const { data: states } = await supabase
      .from("engine_state")
      .select("id, status, completed_at")
      .eq("process_id", "workspace_setup")
      .eq("entity_id", workspaceId);

    expect(states).toBeTruthy();
    expect(states![0].status).toBe("complete");
    expect(states![0].completed_at).toBeTruthy();
  });
});
```

**Step 2: Run + debug + commit** (same pattern as 3.1)

```bash
git add apps/e2e/tests/journey-workspace-setup.spec.ts
git commit -m "test(journey): E2E test for workspace setup wizard → engine_state complete"
```

---

### Task 3.3: Journey Playwright reporter

**Files:**

- Create: `apps/e2e/reporters/journey-reporter.ts`

**Step 1: Write the reporter**

```typescript
import type { Reporter, FullResult, TestCase, TestResult } from "@playwright/test/reporter";
import { createClient } from "@supabase/supabase-js";

const JOURNEY_TAG_PREFIX = "journey:";

class JourneyReporter implements Reporter {
  private results: Array<{
    journeySlug: string;
    passed: boolean;
    durationMs: number;
    errorMessage?: string;
  }> = [];

  onTestEnd(test: TestCase, result: TestResult) {
    // Check if test is tagged with journey: prefix
    const journeyTag = test.parent?.title?.startsWith(JOURNEY_TAG_PREFIX)
      ? test.parent.title.slice(JOURNEY_TAG_PREFIX.length)
      : null;

    if (!journeyTag) return;

    this.results.push({
      journeySlug: journeyTag,
      passed: result.status === "passed",
      durationMs: result.duration,
      errorMessage: result.error?.message,
    });
  }

  async onEnd(_result: FullResult) {
    if (this.results.length === 0) return;

    const url = process.env.SUPABASE_URL ?? "http://127.0.0.1:54321";
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!key) {
      console.warn(
        "[JourneyReporter] No SUPABASE_SERVICE_ROLE_KEY — skipping journey_test_run insert",
      );
      return;
    }

    const supabase = createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    for (const r of this.results) {
      // Find journey by slug
      const { data: journey } = await supabase
        .from("journey")
        .select("journey_id, workspace_id")
        .eq("slug", r.journeySlug)
        .maybeSingle();

      if (!journey) {
        console.warn(`[JourneyReporter] Journey not found for slug: ${r.journeySlug}`);
        continue;
      }

      await supabase.from("journey_test_run").insert({
        journey_id: journey.journey_id,
        workspace_id: journey.workspace_id,
        result: r.passed ? "pass" : "fail",
        duration_ms: r.durationMs,
        error_message: r.errorMessage ?? null,
        test_output: { source: "playwright", timestamp: new Date().toISOString() },
      });
    }

    console.log(`[JourneyReporter] Wrote ${this.results.length} journey test results`);
  }
}

export default JourneyReporter;
```

**Step 2: Register in playwright.config.ts**

Add to reporter array:

```typescript
reporter: [
  ["html"],
  ["./reporters/journey-reporter.ts"],
],
```

**Step 3: Commit**

```bash
git add apps/e2e/reporters/journey-reporter.ts apps/e2e/playwright.config.ts
git commit -m "feat(e2e): add JourneyReporter — writes test results to journey_test_run"
```

---

### Task 3.4: Journey Portal — Compile button

**Files:**

- Modify: `apps/web/src/app/platform-admin/journeys/[id]/_components/journey-detail-client.tsx`

**Read first:** The existing component to understand its structure.

**Step 1: Add Compile button**

Import the server action and add a button:

```typescript
import { compileJourneyAction } from "../../actions/compile";

// In the component, add:
const [compiling, setCompiling] = useState(false);
const [compileResult, setCompileResult] = useState<{ success: boolean; error?: string } | null>(null);

async function handleCompile() {
  setCompiling(true);
  setCompileResult(null);
  const result = await compileJourneyAction(journey.journey_id);
  setCompileResult(result);
  setCompiling(false);
  if (result.success) {
    router.refresh(); // Refresh to show updated status
  }
}

// In JSX, add button near status changer:
<Button
  onClick={handleCompile}
  disabled={compiling || journey.status === "active"}
  variant="outline"
>
  {compiling ? "Kompilerer..." : "Compile til Engine"}
</Button>
{compileResult && !compileResult.success && (
  <p className="text-sm text-destructive">{compileResult.error}</p>
)}
{compileResult?.success && (
  <p className="text-sm text-muted-foreground">
    Kompilert: {compileResult.stepsCreated} steg → engine_process
  </p>
)}
```

**Step 2: Typecheck + commit**

```bash
git add apps/web/src/app/platform-admin/journeys/[id]/_components/journey-detail-client.tsx
git commit -m "feat(journey): add Compile button to Journey Portal detail view"
```

---

### Task 3.5: Journey Portal — runtime status view

**Files:**

- Modify: `apps/web/src/app/platform-admin/journeys/[id]/_components/journey-detail-client.tsx`

**Step 1: Add runtime stats section**

Query engine_state + engine_state_step for this journey's engine_process_id:

```typescript
// Fetch runtime data if journey has engine_process_id
const [runtimeStats, setRuntimeStats] = useState<{
  activeCount: number;
  completedCount: number;
  stuckCount: number;
  stepBreakdown: Array<{ step_order: number; active: number; completed: number }>;
} | null>(null);

useEffect(() => {
  if (!journey.engine_process_id) return;

  async function fetchStats() {
    const { data: states } = await supabase
      .from("engine_state")
      .select("id, status, current_step")
      .eq("process_id", journey.engine_process_id);

    if (!states) return;

    const active = states.filter((s) => ["active", "waiting"].includes(s.status)).length;
    const completed = states.filter((s) => s.status === "complete").length;
    const stuck = states.filter((s) => s.status === "escalated" || s.status === "failed").length;

    setRuntimeStats({
      activeCount: active,
      completedCount: completed,
      stuckCount: stuck,
      stepBreakdown: [],
    });
  }

  fetchStats();
}, [journey.engine_process_id]);
```

Render as simple stats cards:

```tsx
{
  runtimeStats && (
    <div className="grid grid-cols-3 gap-4">
      <div className="rounded-lg border p-4">
        <p className="text-muted-foreground text-sm">Aktive</p>
        <p className="text-2xl font-bold">{runtimeStats.activeCount}</p>
      </div>
      <div className="rounded-lg border p-4">
        <p className="text-muted-foreground text-sm">Fullført</p>
        <p className="text-2xl font-bold">{runtimeStats.completedCount}</p>
      </div>
      <div className="rounded-lg border p-4">
        <p className="text-muted-foreground text-sm">Blokkert</p>
        <p className="text-destructive text-2xl font-bold">{runtimeStats.stuckCount}</p>
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add apps/web/src/app/platform-admin/journeys/[id]/_components/journey-detail-client.tsx
git commit -m "feat(journey): add runtime stats to Journey Portal detail view"
```

---

## Phase 4: Hardening (post-J1+J2 happy path)

> Design only — not blocking J1+J2 launch. Implement after Phase 3 passes.

### Task 4.1: US-6 Error handling

**Schema changes:**

```sql
ALTER TABLE engine_state_step ADD COLUMN max_retries INTEGER NOT NULL DEFAULT 3;
ALTER TABLE engine_state_step ADD COLUMN retry_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE engine_state_step ADD COLUMN retry_delay_seconds INTEGER NOT NULL DEFAULT 30;
ALTER TABLE engine_state_step ADD COLUMN last_error JSONB;
```

**Engine-dispatch changes:** try/catch around executeStep. Recoverable errors → retry via engine_delayed_trigger. Non-recoverable → status=blocked.

### Task 4.2: US-7 Idle detection + escalation

**Schema changes:**

```sql
ALTER TABLE engine_process ADD COLUMN idle_threshold_minutes INTEGER DEFAULT 30;
ALTER TABLE engine_process ADD COLUMN escalation_rules JSONB;
```

**Cron job:** Scan engine_state_step with status=active and updated_at older than threshold. Emit `journey.step_idle` event.

### Task 4.3: US-8 A/B variant mapping (future)

**Schema:** New `journey_engine_variant` mapping table. Replace nullable FK with proper variant tracking.

---

## Dependency Graph

```
Phase 1 (parallel):
  1.1 ──┐
  1.2 ──┤
  1.3 ──┼── Phase 2 (compile + emit)
  1.4 ──┤
  1.5 ──┤
  1.6 ──┼── 1.9 (deploy) ──┐
  1.7 ──┤                   │
  1.8 ──┘                   │
                             ↓
Phase 2:                     │
  2.1 → 2.2 (compile)       │
  2.1 → 2.3 (seed J1)       │
  2.1 → 2.4 (seed J2)       │
  2.5 ← 1.3 + 1.4 + 1.9 ───┤
  2.6 ← 1.4 + 1.9 ──────────┤
  2.7 ← 1.4 + 1.9 ──────────┤
  2.8 ← 1.4 + 1.9 ──────────┘
                             ↓
Phase 3:
  3.1 ← 2.3 + 2.5 + 2.6 + 2.7
  3.2 ← 2.4 + 2.8
  3.3 (parallel — no deps)
  3.4 ← 2.2
  3.5 ← 1.7 + 1.8
                             ↓
Phase 4 (after Phase 3 green):
  4.1, 4.2, 4.3
```

## Parallel Agent Assignment

| Agent   | Tasks              | Rationale                                             |
| ------- | ------------------ | ----------------------------------------------------- |
| Agent A | 1.1, 1.2, 1.3      | Migrations (independent, same skill)                  |
| Agent B | 1.4                | Registry.ts (standalone, no DB)                       |
| Agent C | 1.5, 1.6, 1.7, 1.8 | Engine-dispatch (single file, interdependent changes) |
| Agent D | 2.1                | Compile function (standalone package)                 |
| Agent E | 2.5, 2.6, 2.7      | Onboarding emit (same hook file)                      |
| Agent F | 2.8                | Wizard emit (separate file set)                       |
| Agent G | 2.3, 2.4           | Seed migrations (independent)                         |
| Agent H | 3.1, 3.2           | E2E tests (independent of each other)                 |
| Agent I | 3.3, 3.4, 3.5      | Portal + reporter (independent)                       |

**Total: 9 parallel agents across 3 phases. Phase 1 = 3 parallel agents. Phase 2 = 4 parallel agents. Phase 3 = 2 parallel agents.**
