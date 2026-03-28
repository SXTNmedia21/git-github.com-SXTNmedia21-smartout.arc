---
title: "Module Zero to Production"
status: draft
updated: 2026-04-11
created: 2026-04-11
module: all
tags: [plan, module-zero, journey-runner, production]
---

# Module Zero to Production — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Close all 10 gaps from STATE.md, build the journey runner pipeline, and implement 24 journeys — taking Smartout from admin-only prototype to employee-facing production system.

**Architecture:** Four-week Module Zero builds foundational infrastructure (event backbone, completion tracking, session lifecycle, employee UI). Week 5 adds the journey runner — a CLI tool that reads journey specs, spawns Claude Code agents with execution contracts, and verifies results via typecheck + lint + Playwright. Weeks 6-10 execute journeys in dependency order.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript strict, Tailwind v4, shadcn/ui, Supabase (PostgreSQL 17, Edge Functions), TanStack Query, Playwright, pnpm workspaces, Turborepo

**Source docs:** `docs/STATE.md` (10 gaps), `docs/modules/journey/SMARTOUT_JOURNEY_REGISTRY.md` (68 journeys), `docs/modules/journey/SMARTOUT_JOURNEY_DEEP_SPEC.md` (J-019 gold standard)

---

## Dependency Graph

```
Week 1: Event Backbone (Gap 1, 2)
    |
    v
Week 2: Completion Tracking + Session Tables (Gap 3, 4, 10)
    |
    v
Week 3: Process Wiring + Auto-Generation (Gap 5, 6, 10)
    |
    v
Week 4: Employee UI + Handbook Reader (Gap 7, 8, 9)
    |
    v
Week 5: Journey Runner + E2E Helpers
    |
    v
Weeks 6-10: Journey Implementations (24 journeys)
```

---

# PHASE 1: MODULE ZERO (Weeks 1-4)

---

## Week 1: Event Backbone (Gap 1, 2)

**Goal:** One `emit()` call drives analytics + audit + workflow automation. Any UI mutation creates an `engine_event`.

---

### Task 1.1: Add engine_event destination to telemetry

**Files:**

- Create: `packages/telemetry/src/providers/engine-event.ts`
- Modify: `packages/telemetry/src/registry.ts`
- Modify: `packages/telemetry/src/emit.ts`

**Step 1: Create engine-event provider**

```typescript
// packages/telemetry/src/providers/engine-event.ts
import { createClient } from "@supabase/supabase-js";
import type { BaseEvent } from "../registry";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/**
 * Maps telemetry event names (space-separated) to engine event_types (dot notation).
 * Example: "shift published" -> "shift.published"
 */
function toEngineEventType(eventName: string): string {
  return eventName.replace(/\s+/g, ".");
}

export async function sendToEngine(event: BaseEvent & { event: string }): Promise<void> {
  // Only run server-side (service role key required)
  if (typeof window !== "undefined" || !supabaseServiceKey) return;

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  await supabase.functions.invoke("engine-dispatch", {
    body: {
      event_type: toEngineEventType(event.event),
      workspace_id: event.workspace_id,
      payload: {
        actor_id: event.actor_id,
        ...(event as Record<string, unknown>).properties,
      },
      idempotency_key: event.correlation_id ?? undefined,
    },
  });
}
```

**Step 2: Add "engine_event" destination to registry**

In `packages/telemetry/src/registry.ts`:

1. Add to `EventDestination` type:

```typescript
export type EventDestination = "posthog" | "logger" | "activity_trail" | "engine_event";
```

2. Add `"engine_event"` to every event's destinations array in `EVENT_ROUTING` that has `"activity_trail"` (all mutation events should drive the engine):

```typescript
"department created": {
  destinations: ["posthog", "logger", "activity_trail", "engine_event"],
  category: "org_structure",
},
// ... same pattern for all mutation events
```

**Step 3: Wire provider into emit()**

In `packages/telemetry/src/emit.ts`, import and call `sendToEngine` when destination includes `"engine_event"`:

```typescript
import { sendToEngine } from "./providers/engine-event";

// In the dispatch function, add case:
if (destinations.includes("engine_event")) {
  promises.push(sendToEngine(event));
}
```

**Step 4: Run typecheck**

Run: `pnpm turbo typecheck --filter=telemetry`
Expected: PASS with 0 errors

**Step 5: Commit**

```bash
git add packages/telemetry/src/providers/engine-event.ts packages/telemetry/src/registry.ts packages/telemetry/src/emit.ts
git commit -m "feat(telemetry): add engine_event as fourth destination"
```

---

### Task 1.2: Expand telemetry event registry

**Files:**

- Modify: `packages/telemetry/src/registry.ts`

**Step 1: Add new event interfaces and routing entries**

Add these event types to the registry (after existing events, before `SmartoutEvent` union):

```typescript
// ─── Scheduling Events (expanded) ───────────────
export interface ShiftPublished extends BaseEvent {
  event: "shift published";
  properties: {
    entity: EntityRef;
    data: { dates: string[]; department_ids: string[]; shift_count: number };
  };
}

// ─── Operations Events ──────────────────────────
export interface SessionOpened extends BaseEvent {
  event: "session opened";
  properties: { entity: EntityRef; data: { department_id: string; date: string } };
}

export interface SessionPendingSignoff extends BaseEvent {
  event: "session pending_signoff";
  properties: { entity: EntityRef; data: { department_id: string; date: string } };
}

export interface SessionClosed extends BaseEvent {
  event: "session closed";
  properties: { entity: EntityRef; data: { department_id: string; date: string } };
}

// ─── Invitation Events ──────────────────────────
export interface InvitationAccepted extends BaseEvent {
  event: "invitation accepted";
  properties: { entity: EntityRef; data: { profile_id: string; workspace_id: string } };
}

// ─── Training Events ────────────────────────────
export interface ProtocolAssigned extends BaseEvent {
  event: "protocol assigned";
  properties: { entity: EntityRef; data: { protocol_id: string; profile_id: string } };
}

export interface ProtocolStepCompleted extends BaseEvent {
  event: "protocol step_completed";
  properties: { entity: EntityRef; data: { procedure_step_id: string; profile_id: string } };
}

export interface ProtocolCompleted extends BaseEvent {
  event: "protocol completed";
  properties: { entity: EntityRef; data: { protocol_assignment_id: string; profile_id: string } };
}

// ─── Reconciliation Events ──────────────────────
export interface ReconciliationSubmitted extends BaseEvent {
  event: "reconciliation submitted";
  properties: { entity: EntityRef; data: { reconciliation_id: string } };
}

export interface ReconciliationAdminAction extends BaseEvent {
  event: "reconciliation admin_action";
  properties: {
    entity: EntityRef;
    data: { reconciliation_id: string; action: "approved" | "rejected" };
  };
}

// ─── Document Events ────────────────────────────
export interface HandbookChapterSaved extends BaseEvent {
  event: "handbook chapter_saved";
  properties: { entity: EntityRef; data: { chapter_key: string } };
}

// ─── Session Hook Events ────────────────────────
export interface SessionHookFired extends BaseEvent {
  event: "session hook_fired";
  properties: { entity: EntityRef; data: { hook_type: string; session_id: string } };
}

export interface SessionTaskCompleted extends BaseEvent {
  event: "session task_completed";
  properties: { entity: EntityRef; data: { task_id: string; profile_id: string } };
}
```

2. Add all new types to the `SmartoutEvent` union.

3. Add routing entries for each new event:

```typescript
"shift published": {
  destinations: ["posthog", "logger", "activity_trail", "engine_event"],
  category: "scheduling",
},
"session opened": {
  destinations: ["logger", "activity_trail", "engine_event"],
  category: "operations",
},
"session pending_signoff": {
  destinations: ["logger", "activity_trail", "engine_event"],
  category: "operations",
},
"session closed": {
  destinations: ["logger", "activity_trail", "engine_event"],
  category: "operations",
},
"invitation accepted": {
  destinations: ["posthog", "logger", "activity_trail", "engine_event"],
  category: "onboarding",
},
"protocol assigned": {
  destinations: ["logger", "activity_trail", "engine_event"],
  category: "training",
},
"protocol step_completed": {
  destinations: ["logger", "activity_trail", "engine_event"],
  category: "training",
},
"protocol completed": {
  destinations: ["posthog", "logger", "activity_trail", "engine_event"],
  category: "training",
},
"reconciliation submitted": {
  destinations: ["logger", "activity_trail", "engine_event"],
  category: "operations",
},
"reconciliation admin_action": {
  destinations: ["logger", "activity_trail", "engine_event"],
  category: "operations",
},
"handbook chapter_saved": {
  destinations: ["logger", "activity_trail", "engine_event"],
  category: "system",
},
"session hook_fired": {
  destinations: ["logger", "engine_event"],
  category: "operations",
},
"session task_completed": {
  destinations: ["logger", "activity_trail", "engine_event"],
  category: "operations",
},
```

**Step 2: Run typecheck**

Run: `pnpm turbo typecheck --filter=telemetry`
Expected: PASS

**Step 3: Commit**

```bash
git add packages/telemetry/src/registry.ts
git commit -m "feat(telemetry): add 13 new domain events for engine integration"
```

---

### Task 1.3: Wire emit() into existing TanStack Query mutations

**Files:**

- Modify: All files in `apps/web/src/app/dashboard/schedule/_hooks/` that contain `useMutation`
- Modify: All files in `apps/web/src/app/dashboard/_hooks/` that contain `useMutation`

**Step 1: Find all mutation hooks**

Run: `grep -rn "useMutation" apps/web/src/app/dashboard/ --include="*.ts" --include="*.tsx" -l`

For EACH file found, add `emit()` call in `onSuccess`. Pattern:

```typescript
import { emit } from "@smartout/telemetry";

// In useMutation onSuccess:
onSuccess: (data, variables) => {
  emit({
    event: "shift created",  // match the event name from registry
    workspace_id: workspaceId,
    actor_id: profileId,
    properties: {
      entity: { entity_type: "shift", entity_id: data.id, entity_label: "..." },
      data: { /* relevant fields */ },
    },
  });
  queryClient.invalidateQueries({ queryKey: [...] });
},
```

**Important:** Do NOT add emit() to queries, only to mutations (create, update, delete, publish).

**Step 2: Wire publish shifts specifically**

The publish mutation in schedule hooks must emit `"shift published"` with dates and department_ids in the payload. This is the critical event that triggers department session creation (Week 3).

**Step 3: Run typecheck**

Run: `pnpm turbo typecheck --filter=web`
Expected: PASS

**Step 4: Commit**

```bash
git add apps/web/src/app/dashboard/
git commit -m "feat(web): wire emit() into all TanStack Query mutations"
```

---

### Task 1.4: End-to-end verification

**Step 1: Start local Supabase**

Run: `npx supabase start`

**Step 2: Start web app**

Run: `pnpm --filter web dev`

**Step 3: Manual test**

1. Create a shift in the schedule planner
2. Check `engine_event` table: `SELECT * FROM engine_event ORDER BY fired_at DESC LIMIT 5;`
3. Verify event_type = `shift.created` and payload contains shift data
4. Publish shifts for a date
5. Verify `shift.published` event appears in `engine_event`

**Step 4: Commit verification note**

```bash
git commit --allow-empty -m "chore: verify event backbone end-to-end — emit() -> engine_event working"
```

---

## Week 2: Completion Tracking + Session Infrastructure (Gap 3, 4, 10)

**Goal:** All tracking tables exist. Protocol assignments can record real progress. Sessions have hooks and tasks.

---

### Task 2.1: Create enums migration

**Files:**

- Create: `supabase/migrations/20260412100000_session_enums.sql`

**Step 1: Write migration**

```sql
SET search_path TO public, extensions;

-- Session hook timing types
CREATE TYPE session_hook_type AS ENUM (
  'pre_open', 'open', 'scheduled', 'pre_close', 'close'
);

-- Session task lifecycle
CREATE TYPE session_task_status AS ENUM (
  'pending', 'available', 'in_progress', 'completed', 'skipped', 'overdue', 'escalated'
);

-- Session note categories
CREATE TYPE session_note_type AS ENUM (
  'handoff', 'closing', 'general'
);
```

**Step 2: Apply migration**

Run: `npx supabase db reset` (or `npx supabase migration up` if DB has data to preserve)

**Step 3: Commit**

```bash
git add supabase/migrations/20260412100000_session_enums.sql
git commit -m "feat(db): add session_hook_type, session_task_status, session_note_type enums"
```

---

### Task 2.2: Create engine_state_step table

**Files:**

- Create: `supabase/migrations/20260412100100_engine_state_step.sql`

**Step 1: Write migration**

```sql
SET search_path TO public, extensions;

CREATE TABLE IF NOT EXISTS public.engine_state_step (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  state_id        UUID NOT NULL REFERENCES engine_state(id) ON DELETE CASCADE,
  step_order      INTEGER NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'active', 'completed', 'skipped', 'failed')),
  action_type     TEXT NOT NULL,
  action_payload  JSONB NOT NULL DEFAULT '{}',
  condition       JSONB,
  assignee_rule   TEXT,
  completed_by    UUID REFERENCES profile(profile_id),
  completed_at    TIMESTAMPTZ,
  result          JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_state_step_order UNIQUE (state_id, step_order)
);

ALTER TABLE engine_state_step ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read_engine_state_step" ON engine_state_step
FOR SELECT USING (
  state_id IN (SELECT id FROM engine_state)
);
CREATE POLICY "manage_engine_state_step" ON engine_state_step
FOR ALL USING (auth.role() = 'service_role');

CREATE INDEX idx_engine_state_step_state ON engine_state_step (state_id, step_order);
CREATE INDEX idx_engine_state_step_status ON engine_state_step (state_id, status)
  WHERE status IN ('pending', 'active');

CREATE TRIGGER set_updated_at_engine_state_step
  BEFORE UPDATE ON engine_state_step
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
```

**Step 2: Apply and verify**

Run: `npx supabase db reset`

**Step 3: Commit**

```bash
git add supabase/migrations/20260412100100_engine_state_step.sql
git commit -m "feat(db): add engine_state_step for per-step instance tracking (Gap 4)"
```

---

### Task 2.3: Create completion tracking tables

**Files:**

- Create: `supabase/migrations/20260412100200_completion_tracking.sql`

**Step 1: Write migration**

```sql
SET search_path TO public, extensions;

-- ── Knowledge Test Attempt ──────────────────────────────────
CREATE TABLE IF NOT EXISTS public.knowledge_test_attempt (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id        UUID NOT NULL REFERENCES workspace(workspace_id),
  profile_id          UUID NOT NULL REFERENCES profile(profile_id),
  knowledge_test_id   UUID NOT NULL REFERENCES knowledge_test(id),
  protocol_assignment_id UUID REFERENCES protocol_assignment(id),
  score               NUMERIC(5,2),
  passed              BOOLEAN NOT NULL DEFAULT false,
  answers             JSONB NOT NULL DEFAULT '{}',
  attempted_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE knowledge_test_attempt ENABLE ROW LEVEL SECURITY;
CREATE POLICY "jwt_read_kta" ON knowledge_test_attempt
FOR SELECT USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));
CREATE POLICY "jwt_insert_kta" ON knowledge_test_attempt
FOR INSERT WITH CHECK (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));
CREATE POLICY "service_manage_kta" ON knowledge_test_attempt
FOR ALL USING (auth.role() = 'service_role');

CREATE INDEX idx_kta_profile ON knowledge_test_attempt (profile_id, knowledge_test_id);
CREATE INDEX idx_kta_assignment ON knowledge_test_attempt (protocol_assignment_id);

-- ── Confirmation Signature ──────────────────────────────────
CREATE TABLE IF NOT EXISTS public.confirmation_signature (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id        UUID NOT NULL REFERENCES workspace(workspace_id),
  profile_id          UUID NOT NULL REFERENCES profile(profile_id),
  confirmation_id     UUID NOT NULL REFERENCES confirmation(id),
  protocol_assignment_id UUID REFERENCES protocol_assignment(id),
  signed_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  signature_data      JSONB NOT NULL DEFAULT '{}',
  ip_address          INET,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE confirmation_signature ENABLE ROW LEVEL SECURITY;
CREATE POLICY "jwt_read_cs" ON confirmation_signature
FOR SELECT USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));
CREATE POLICY "jwt_insert_cs" ON confirmation_signature
FOR INSERT WITH CHECK (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));
CREATE POLICY "service_manage_cs" ON confirmation_signature
FOR ALL USING (auth.role() = 'service_role');

CREATE INDEX idx_cs_profile ON confirmation_signature (profile_id, confirmation_id);

-- ── Procedure Step Completion ───────────────────────────────
CREATE TABLE IF NOT EXISTS public.procedure_step_completion (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id           UUID NOT NULL REFERENCES workspace(workspace_id),
  profile_id             UUID NOT NULL REFERENCES profile(profile_id),
  procedure_step_id      UUID NOT NULL REFERENCES procedure_step(id),
  protocol_assignment_id UUID REFERENCES protocol_assignment(id),
  completed_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  evidence               JSONB,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_step_completion UNIQUE (profile_id, procedure_step_id, protocol_assignment_id)
);

ALTER TABLE procedure_step_completion ENABLE ROW LEVEL SECURITY;
CREATE POLICY "jwt_read_psc" ON procedure_step_completion
FOR SELECT USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));
CREATE POLICY "jwt_insert_psc" ON procedure_step_completion
FOR INSERT WITH CHECK (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));
CREATE POLICY "service_manage_psc" ON procedure_step_completion
FOR ALL USING (auth.role() = 'service_role');

CREATE INDEX idx_psc_profile ON procedure_step_completion (profile_id, protocol_assignment_id);
```

**Step 2: Apply and verify**

Run: `npx supabase db reset`

**Step 3: Commit**

```bash
git add supabase/migrations/20260412100200_completion_tracking.sql
git commit -m "feat(db): add knowledge_test_attempt, confirmation_signature, procedure_step_completion (Gap 3)"
```

---

### Task 2.4: Create session infrastructure tables

**Files:**

- Create: `supabase/migrations/20260412100300_session_infrastructure.sql`

**Step 1: Write migration**

```sql
SET search_path TO public, extensions;

-- ── Session Hook ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.session_hook (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id        UUID NOT NULL REFERENCES workspace(workspace_id),
  department_id       UUID NOT NULL REFERENCES department(department_id),
  hook_type           session_hook_type NOT NULL,
  trigger_offset_min  INTEGER NOT NULL DEFAULT 0,
  repeat_interval_min INTEGER,
  linked_procedure_id UUID REFERENCES procedure(id),
  linked_routine_id   UUID REFERENCES routine(id),
  is_active           BOOLEAN NOT NULL DEFAULT true,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE session_hook ENABLE ROW LEVEL SECURITY;
CREATE POLICY "jwt_read_sh" ON session_hook
FOR SELECT USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));
CREATE POLICY "jwt_manage_sh" ON session_hook
FOR ALL USING (
  workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
  AND is_admin_in_workspace(auth.uid(), workspace_id)
);
CREATE POLICY "service_manage_sh" ON session_hook
FOR ALL USING (auth.role() = 'service_role');

CREATE INDEX idx_session_hook_dept ON session_hook (department_id, hook_type) WHERE is_active;

-- ── Session Task ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.session_task (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id          UUID NOT NULL REFERENCES workspace(workspace_id),
  department_session_id UUID NOT NULL REFERENCES department_session(id),
  session_hook_id       UUID REFERENCES session_hook(id),
  title                 TEXT NOT NULL,
  description           TEXT,
  status                session_task_status NOT NULL DEFAULT 'pending',
  assigned_to           UUID REFERENCES profile(profile_id),
  completed_by          UUID REFERENCES profile(profile_id),
  completed_at          TIMESTAMPTZ,
  evidence              JSONB,
  compliance_required   BOOLEAN NOT NULL DEFAULT false,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE session_task ENABLE ROW LEVEL SECURITY;
CREATE POLICY "jwt_read_st" ON session_task
FOR SELECT USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));
CREATE POLICY "jwt_update_st" ON session_task
FOR UPDATE USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));
CREATE POLICY "service_manage_st" ON session_task
FOR ALL USING (auth.role() = 'service_role');

CREATE INDEX idx_session_task_session ON session_task (department_session_id, status);
CREATE INDEX idx_session_task_assignee ON session_task (assigned_to, status)
  WHERE status IN ('pending', 'available', 'in_progress');

-- ── Session Note ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.session_note (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id          UUID NOT NULL REFERENCES workspace(workspace_id),
  department_session_id UUID NOT NULL REFERENCES department_session(id),
  note_type             session_note_type NOT NULL DEFAULT 'general',
  content               TEXT NOT NULL,
  created_by            UUID NOT NULL REFERENCES profile(profile_id),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE session_note ENABLE ROW LEVEL SECURITY;
CREATE POLICY "jwt_read_sn" ON session_note
FOR SELECT USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));
CREATE POLICY "jwt_insert_sn" ON session_note
FOR INSERT WITH CHECK (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));
CREATE POLICY "service_manage_sn" ON session_note
FOR ALL USING (auth.role() = 'service_role');

CREATE INDEX idx_session_note_session ON session_note (department_session_id);

-- ── Triggers ────────────────────────────────────────────────
CREATE TRIGGER set_updated_at_session_hook
  BEFORE UPDATE ON session_hook FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_updated_at_session_task
  BEFORE UPDATE ON session_task FOR EACH ROW EXECUTE FUNCTION set_updated_at();
```

**Step 2: Apply and verify**

Run: `npx supabase db reset`

**Step 3: Regenerate types**

Run: `npx supabase gen types typescript --local > packages/supabase/src/database.types.ts`

**Step 4: Run typecheck**

Run: `pnpm turbo typecheck`
Expected: PASS (new types are additive, no breaking changes)

**Step 5: Commit**

```bash
git add supabase/migrations/20260412100300_session_infrastructure.sql packages/supabase/src/database.types.ts
git commit -m "feat(db): add session_hook, session_task, session_note tables (Gap 10)"
```

---

## Week 3: Process Wiring + Auto-Generation (Gap 5, 6, 10)

**Goal:** Events trigger real workflows. Department sessions auto-create. Invites assign protocols. Readiness scores are real.

---

### Task 3.1: Implement engine-dispatch action handlers

**Files:**

- Modify: `supabase/functions/engine-dispatch/index.ts`

**Step 1: Add getStepsForState helper**

Add this function before `executeStep`:

```typescript
async function getStepsForState(
  supabase: ReturnType<typeof createClient>,
  state: EngineState,
): Promise<EngineStep[]> {
  const { data: dynamicSteps } = await supabase
    .from("engine_state_step")
    .select("step_order, action_type, action_payload, condition, assignee_rule")
    .eq("state_id", state.id)
    .order("step_order");

  if (dynamicSteps && dynamicSteps.length > 0) {
    return dynamicSteps.map((s) => ({
      id: state.id,
      process_id: state.process_id,
      step_order: s.step_order,
      step_group: null,
      action_type: s.action_type,
      action_payload: s.action_payload ?? {},
      condition: s.condition,
      assignee_rule: s.assignee_rule,
    }));
  }

  return (state.steps_snapshot ?? []) as EngineStep[];
}
```

**Step 2: Replace all `state.steps_snapshot ?? []` references**

Replace the 3 occurrences at lines ~252, ~322, ~378 with `await getStepsForState(supabase, state)`. The `executeStep` function signature must become `async` (it already is).

**Step 3: Implement real handlers in the switch statement**

Replace the stub block (lines 367-406) with individual handlers:

```typescript
case "assign_task": {
  const payload = step.action_payload as Record<string, unknown>;
  // Create session_task if department_session context exists
  if (state.entity_type === "department_session" && state.entity_id) {
    await supabase.from("session_task").insert({
      workspace_id: state.workspace_id,
      department_session_id: state.entity_id,
      title: (payload.task as string) ?? "Task",
      description: payload.description as string,
      status: "available",
      assigned_to: state.assignee_id,
      compliance_required: false,
    });
  }
  await advanceToNextStep(supabase, state, step);
  break;
}

case "send_notification": {
  const payload = step.action_payload as Record<string, unknown>;
  await supabase.from("notification_queue").insert({
    workspace_id: state.workspace_id,
    profile_id: state.assignee_id,
    channel: payload.channel ?? "push",
    template: payload.template,
    data: { state_id: state.id, ...(payload as object) },
    status: "pending",
  });
  await advanceToNextStep(supabase, state, step);
  break;
}

case "update_entity": {
  const payload = step.action_payload as Record<string, unknown>;
  const entity = payload.entity as string;
  const setValues = payload.set as Record<string, unknown>;
  // Allowlist of tables that can be updated
  const allowed = ["daily_reconciliation", "department_session", "profile", "protocol_assignment"];
  if (allowed.includes(entity) && state.entity_id) {
    await supabase.from(entity).update({
      ...setValues,
      updated_at: new Date().toISOString(),
    }).eq("id", state.entity_id);
  }
  await advanceToNextStep(supabase, state, step);
  break;
}

case "create_deviation": {
  const payload = step.action_payload as Record<string, unknown>;
  const condition = payload.condition as string;
  const ctx = state.context as Record<string, unknown>;
  // Only create if condition met
  if (!condition || ctx[condition]) {
    await supabase.from("deviation").insert({
      workspace_id: state.workspace_id,
      domain: payload.domain ?? "system",
      severity: payload.severity ?? "medium",
      description: payload.description,
      department_session_id: state.entity_id,
      status: "open",
    });
  }
  await advanceToNextStep(supabase, state, step);
  break;
}

case "validate_settlement": {
  // Call validate-settlement Edge Function
  if (state.entity_id) {
    await supabase.functions.invoke("validate-settlement", {
      body: { reconciliation_id: state.entity_id, workspace_id: state.workspace_id },
    });
  }
  await advanceToNextStep(supabase, state, step);
  break;
}

case "lock_checkout": {
  // UI-driven gatekeeper — engine just records the gate is active
  await advanceToNextStep(supabase, state, step);
  break;
}

case "schedule_control": {
  // Reserved for future schedule automation
  await advanceToNextStep(supabase, state, step);
  break;
}

case "start_process": {
  const payload = step.action_payload as Record<string, unknown>;
  const subProcessId = payload.process_id as string;
  if (subProcessId) {
    // Fetch and start sub-process
    const { data: subSteps } = await supabase
      .from("engine_step").select("*")
      .eq("process_id", subProcessId).order("step_order");

    await supabase.from("engine_state").insert({
      process_id: subProcessId,
      workspace_id: state.workspace_id,
      status: "active",
      current_step: 1,
      entity_type: state.entity_type,
      entity_id: state.entity_id,
      context: state.context,
      steps_snapshot: subSteps ?? [],
      depth: state.depth + 1,
      parent_state_id: state.id,
    });
  }
  await advanceToNextStep(supabase, state, step);
  break;
}

case "upsert_session": {
  const ctx = state.context as Record<string, unknown>;
  const dates = (ctx.dates as string[]) ?? [new Date().toISOString().split("T")[0]];
  const deptIds = (ctx.department_ids as string[]) ?? [];

  for (const date of dates) {
    for (const deptId of deptIds) {
      await supabase.from("department_session").upsert({
        workspace_id: state.workspace_id,
        department_id: deptId,
        session_date: date,
        status: "upcoming",
      }, { onConflict: "workspace_id,department_id,session_date" });
    }
  }
  await advanceToNextStep(supabase, state, step);
  break;
}

case "create_session_task": {
  const payload = step.action_payload as Record<string, unknown>;
  const sessionId = (state.context as Record<string, unknown>).department_session_id as string;
  const hookId = (state.context as Record<string, unknown>).session_hook_id as string;

  if (sessionId) {
    await supabase.from("session_task").insert({
      workspace_id: state.workspace_id,
      department_session_id: sessionId,
      session_hook_id: hookId ?? null,
      title: payload.title as string ?? "Task",
      description: payload.description as string,
      status: "available",
      assigned_to: state.assignee_id,
      compliance_required: (payload.compliance_required as boolean) ?? false,
    });
  }
  await advanceToNextStep(supabase, state, step);
  break;
}

case "generate_steps": {
  // Dynamic step generation for training protocols
  const source = (step.action_payload as Record<string, unknown>).source as string;
  if (source === "protocol_assignment") {
    const assignmentId = (state.context as Record<string, unknown>).protocol_assignment_id as string;

    const { data: assignment } = await supabase
      .from("protocol_assignment").select(`
        protocol:protocol_id (
          procedure(id, title, procedure_step(id, step_order)),
          knowledge_test(id, title),
          confirmation(id, title)
        )
      `).eq("id", assignmentId).single();

    const generated: Array<{
      state_id: string; step_order: number; status: string;
      action_type: string; action_payload: Record<string, unknown>;
    }> = [];
    let order = 1;

    for (const proc of (assignment as any)?.protocol?.procedure ?? []) {
      for (const ps of proc.procedure_step ?? []) {
        generated.push({
          state_id: state.id, step_order: order++, status: "pending",
          action_type: "present_content",
          action_payload: { procedure_id: proc.id, procedure_step_id: ps.id },
        });
      }
    }
    for (const test of (assignment as any)?.protocol?.knowledge_test ?? []) {
      generated.push({
        state_id: state.id, step_order: order++, status: "pending",
        action_type: "administer_test",
        action_payload: { knowledge_test_id: test.id },
      });
    }
    for (const conf of (assignment as any)?.protocol?.confirmation ?? []) {
      generated.push({
        state_id: state.id, step_order: order++, status: "pending",
        action_type: "collect_signature",
        action_payload: { confirmation_id: conf.id },
      });
    }
    generated.push({
      state_id: state.id, step_order: order++, status: "pending",
      action_type: "check_readiness", action_payload: {},
    });

    if (generated.length > 0) {
      await supabase.from("engine_state_step").insert(generated);
      await supabase.from("engine_state").update({
        current_step: 1, updated_at: new Date().toISOString(),
      }).eq("id", state.id);
      // Execute first generated step
      const first = generated[0];
      await executeStep(supabase, { ...state, current_step: 1 }, {
        id: state.id, process_id: state.process_id, step_order: 1,
        step_group: null, action_type: first.action_type,
        action_payload: first.action_payload, condition: null, assignee_rule: null,
      });
    }
  }
  break;
}

case "present_content":
case "administer_test":
case "collect_signature": {
  // Employee-driven steps — set state to waiting, employee UI drives completion
  await supabase.from("engine_state_step").update({
    status: "active", updated_at: new Date().toISOString(),
  }).eq("state_id", state.id).eq("step_order", step.step_order);

  await supabase.from("engine_state").update({
    status: "waiting", updated_at: new Date().toISOString(),
  }).eq("id", state.id);
  break;
}

case "check_readiness": {
  // Compute readiness from completion tables
  const assignmentId = (state.context as Record<string, unknown>).protocol_assignment_id as string;
  if (assignmentId) {
    await supabase.from("protocol_assignment").update({
      status: "completed", updated_at: new Date().toISOString(),
    }).eq("id", assignmentId);
  }
  await advanceToNextStep(supabase, state, step);
  break;
}
```

**Step 4: Extract advanceToNextStep helper**

```typescript
async function advanceToNextStep(
  supabase: ReturnType<typeof createClient>,
  state: EngineState,
  step: EngineStep,
): Promise<void> {
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

**Step 5: Run typecheck and test**

Run: `pnpm turbo typecheck`
Manual test: emit a `department_session.pending_signoff` event and verify DailyClose process starts and creates tasks.

**Step 6: Commit**

```bash
git add supabase/functions/engine-dispatch/index.ts
git commit -m "feat(engine): implement all action_type handlers in engine-dispatch"
```

---

### Task 3.2: Seed process templates

**Files:**

- Create: `supabase/migrations/20260412200000_seed_session_lifecycle.sql`
- Create: `supabase/migrations/20260412200100_seed_onboarding_process.sql`
- Create: `supabase/migrations/20260412200200_seed_training_protocol.sql`
- Create: `supabase/migrations/20260412200300_seed_session_hook_dispatcher.sql`

Each seed follows the pattern of `20260304300000_seed_daily_close_process.sql`. See brainstorming notes for step details:

- `department_session_lifecycle`: 4 steps (upsert_session, schedule_hooks, wait_for_event, update_entity). Trigger: `shift.published`.
- `onboarding_journey`: 6 steps (assign_default_protocols, present_content, wait, check_readiness, update_entity, send_notification). Trigger: `invitation.accepted`.
- `training_protocol`: 1 meta-step (generate_steps with source=protocol_assignment). Trigger: `protocol.assigned`.
- `session_hook_dispatcher`: 3 steps (create_session_task, send_notification, wait_for_event). Trigger: `session.hook_fired`.

**Commit after each seed file.**

---

### Task 3.3: Create fire-delayed-triggers Edge Function

**Files:**

- Create: `supabase/functions/fire-delayed-triggers/index.ts`
- Modify: `supabase/config.toml` (add `verify_jwt = false`)

**Step 1: Write the Edge Function**

```typescript
import { createClient } from "jsr:@supabase/supabase-js@2";

Deno.serve(async (req) => {
  // Auth: same pattern as watchdog functions
  const cronSecret = Deno.env.get("WATCHDOG_CRON_SECRET");
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${cronSecret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: due } = await supabase
    .from("engine_delayed_trigger")
    .select("*, trigger:trigger_id(*)")
    .eq("fired", false)
    .lte("fire_at", new Date().toISOString())
    .order("fire_at")
    .limit(50);

  if (!due || due.length === 0) {
    return new Response(JSON.stringify({ fired: 0 }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  const ids = due.map((d: any) => d.id);
  await supabase.from("engine_delayed_trigger").update({ fired: true }).in("id", ids);

  let fired = 0;
  for (const d of due) {
    const trigger = d.trigger as Record<string, unknown>;
    const res = await supabase.functions.invoke("engine-dispatch", {
      body: {
        event_type: trigger.event_type,
        workspace_id: d.workspace_id,
        payload: {
          delayed_trigger_id: d.id,
          original_event_id: d.event_id,
        },
      },
    });
    if (!res.error) fired++;
  }

  return new Response(JSON.stringify({ fired, total: due.length }), {
    headers: { "Content-Type": "application/json" },
  });
});
```

**Step 2: Add to config.toml**

```toml
[functions.fire-delayed-triggers]
verify_jwt = false
```

**Step 3: Commit**

```bash
git add supabase/functions/fire-delayed-triggers/ supabase/config.toml
git commit -m "feat(engine): add fire-delayed-triggers Edge Function for timed hooks"
```

---

### Task 3.4: Update DailyClose seed with Step 0

**Files:**

- Create: `supabase/migrations/20260412200400_daily_close_step_zero.sql`

Add a step 0 to the DailyClose process that creates `daily_reconciliation` and `shift_approval` records:

```sql
-- Shift existing steps: renumber 1-10 to 2-11
-- Insert new step 0 as step 1: create_entity for daily_reconciliation
-- This ensures reconciliation exists before the close flow begins
```

**Commit after writing.**

---

### Task 3.5: Fix readiness computation

**Files:**

- Modify: `apps/web/src/app/dashboard/_hooks/use-protocol-journey.ts`

Replace the hardcoded `isCompleted: false` at line ~80 with a real query against `procedure_step_completion`, `knowledge_test_attempt`, and `confirmation_signature` tables. Compute:

```typescript
const completedSteps = procedureStepCompletions.length;
const totalSteps = totalProcedureSteps;
const passedTests = testAttempts.filter((a) => a.passed).length;
const totalTests = totalKnowledgeTests;
const signedConfirmations = confirmationSignatures.length;
const totalConfirmations = totalConfirmations;

const readinessScore =
  totalSteps + totalTests + totalConfirmations > 0
    ? (completedSteps + passedTests + signedConfirmations) /
      (totalSteps + totalTests + totalConfirmations)
    : 0;

const isCompleted = readinessScore === 1;
```

**Commit after implementing.**

---

## Week 4: Employee UI + Handbook Reader (Gap 7, 8, 9)

**Goal:** Employees can see their shifts, do their training, read the handbook.

---

### Task 4.1: Build /dashboard/my-schedule

**Files:**

- Create: `apps/web/src/app/dashboard/my-schedule/page.tsx`
- Create: `apps/web/src/app/dashboard/my-schedule/_components/MyWeekView.tsx`
- Create: `apps/web/src/app/dashboard/my-schedule/_hooks/use-my-shifts.ts`

Query published shifts for the current profile. Show today + upcoming week. Reuse existing schedule display patterns from `apps/web/src/app/dashboard/schedule/`.

**Existing code to reuse:**

- `apps/web/src/app/dashboard/schedule/_hooks/use-shifts.ts` — shift query pattern
- `apps/web/src/app/dashboard/schedule/_hooks/use-week-range.ts` — week navigation
- `components/ui/card.tsx`, `components/ui/badge.tsx` — shift cards
- `components/dashboard/DashboardCard.tsx` — card wrapper

---

### Task 4.2: Build /dashboard/my-training

**Files:**

- Create: `apps/web/src/app/dashboard/my-training/page.tsx`
- Create: `apps/web/src/app/dashboard/my-training/_components/ProtocolList.tsx`
- Create: `apps/web/src/app/dashboard/my-training/_components/ProcedureStepper.tsx`
- Create: `apps/web/src/app/dashboard/my-training/_components/KnowledgeTestView.tsx`
- Create: `apps/web/src/app/dashboard/my-training/_components/ConfirmationSign.tsx`
- Create: `apps/web/src/app/dashboard/my-training/_hooks/use-assigned-protocols.ts`
- Create: `apps/web/src/app/dashboard/my-training/_hooks/use-step-completion.ts`

**Existing code to reuse:**

- `apps/web/src/app/dashboard/_hooks/use-protocol-journey.ts` — protocol assignment query
- `apps/web/src/app/dashboard/_hooks/use-governance-overview.ts` — governance data
- `components/ui/progress.tsx` — progress bars
- `components/dashboard/SignalCard.tsx` — metric display
- `components/platform-admin/data-table.tsx` — DataTable (if list view needed)

---

### Task 4.3: Build employee handbook reader

**Files:**

- Create: `apps/web/src/app/dashboard/handbook/page.tsx`
- Create: `apps/web/src/app/dashboard/handbook/_components/ChapterReader.tsx`
- Create: `apps/web/src/app/dashboard/handbook/_hooks/use-handbook-chapters.ts`

Render Tiptap JSON as read-only HTML. Navigate 10 chapters. Query `handbook_chapter` table.

**Existing code to reuse:**

- `apps/web/src/app/dashboard/_components/document-mode/` — Tiptap editor (reference for JSON rendering)
- `components/ui/scroll-area.tsx` — chapter navigation sidebar

---

### Task 4.4: Build governance CRUD (Gap 9)

**Files:**

- Create: `apps/web/src/app/dashboard/governance/_components/PolicyForm.tsx`
- Create: `apps/web/src/app/dashboard/governance/_components/ProtocolForm.tsx`
- Create: `apps/web/src/app/dashboard/governance/_components/ProcedureBuilder.tsx`
- Create: `apps/web/src/app/dashboard/governance/_components/KnowledgeTestBuilder.tsx`
- Create: `apps/web/src/app/dashboard/governance/_components/ConfirmationForm.tsx`
- Create: `apps/web/src/app/dashboard/governance/_hooks/use-governance-mutations.ts`

Standard admin CRUD forms for policies, protocols, procedures (with step builder), knowledge tests, confirmations. All tables already exist (00003_governance_tables.sql).

**Existing code to reuse:**

- `apps/web/src/app/dashboard/governance/` — existing read-only overview
- `components/platform-admin/data-table.tsx` — DataTable for list views
- `components/platform-admin/confirmation-dialog.tsx` — delete confirmations
- `components/ui/dialog.tsx`, `components/ui/sheet.tsx` — form containers

---

### Task 4.5: Wire handbook save to RAG pipeline

**Files:**

- Modify: `apps/web/src/app/dashboard/_components/document-mode/DocumentModeCanvas.tsx` (or wherever chapter save happens)

On chapter save, emit `"handbook chapter_saved"` event. Add an engine trigger that chunks Tiptap JSON into `workspace_doc_chunk` for agent RAG search.

---

### Task 4.6: Regenerate types and verify

Run: `npx supabase gen types typescript --local > packages/supabase/src/database.types.ts`
Run: `pnpm turbo typecheck`
Expected: PASS

```bash
git add packages/supabase/src/database.types.ts
git commit -m "chore: regenerate database types after Module Zero"
```

---

# PHASE 2: JOURNEY RUNNER (Week 5)

---

## Week 5: Journey Runner Infrastructure

**Goal:** CLI tool that reads journey specs, checks infrastructure, spawns agents with execution contracts, and verifies results.

---

### Task 5.1: Create E2E test helpers

**Files:**

- Create: `apps/e2e/helpers/seed.ts`
- Create: `apps/e2e/helpers/auth.ts`
- Create: `apps/e2e/helpers/cleanup.ts`

**Step 1: Write seed helpers**

```typescript
// apps/e2e/helpers/seed.ts
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL ?? "http://127.0.0.1:54321",
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
);

export async function seedWorkspace(
  overrides: Partial<{
    name: string;
    slug: string;
  }> = {},
) {
  const { data } = await supabase
    .from("workspace")
    .insert({
      name: overrides.name ?? "Test Workspace",
      slug: overrides.slug ?? `test-${Date.now()}`,
    })
    .select()
    .single();
  return data!;
}

export async function seedProfile(
  workspaceId: string,
  overrides: Partial<{
    role: string;
    status: string;
    first_name: string;
    last_name: string;
  }> = {},
) {
  const { data } = await supabase
    .from("profile")
    .insert({
      workspace_id: workspaceId,
      role: overrides.role ?? "employee",
      status: overrides.status ?? "active",
      first_name: overrides.first_name ?? "Test",
      last_name: overrides.last_name ?? "Employee",
    })
    .select()
    .single();
  return data!;
}

export async function seedDepartment(
  workspaceId: string,
  overrides: Partial<{
    name: string;
    color: string;
  }> = {},
) {
  const { data } = await supabase
    .from("department")
    .insert({
      workspace_id: workspaceId,
      name: overrides.name ?? "Kitchen",
      color: overrides.color ?? "#ef4444",
    })
    .select()
    .single();
  return data!;
}

export async function seedShift(
  workspaceId: string,
  overrides: {
    profile_id: string;
    department_id: string;
    shift_date: string;
    start_time: string;
    end_time: string;
    status?: string;
    is_published?: boolean;
  },
) {
  const { data } = await supabase
    .from("schedule_shift")
    .insert({
      workspace_id: workspaceId,
      ...overrides,
      status: overrides.status ?? "published",
      is_published: overrides.is_published ?? true,
    })
    .select()
    .single();
  return data!;
}

export async function seedProtocol(
  workspaceId: string,
  overrides: Partial<{
    name: string;
    policy_id: string;
  }> = {},
) {
  const { data } = await supabase
    .from("protocol")
    .insert({
      workspace_id: workspaceId,
      name: overrides.name ?? "Test Protocol",
      policy_id: overrides.policy_id,
      status: "active",
    })
    .select()
    .single();
  return data!;
}

export async function seedProtocolAssignment(overrides: {
  protocol_id: string;
  profile_id: string;
}) {
  const { data } = await supabase
    .from("protocol_assignment")
    .insert({
      ...overrides,
      status: "pending",
    })
    .select()
    .single();
  return data!;
}

export async function seedDepartmentSession(
  workspaceId: string,
  overrides: {
    department_id: string;
    session_date: string;
    status?: string;
  },
) {
  const { data } = await supabase
    .from("department_session")
    .insert({
      workspace_id: workspaceId,
      ...overrides,
      status: overrides.status ?? "upcoming",
    })
    .select()
    .single();
  return data!;
}

export async function seedPolicy(
  workspaceId: string,
  overrides: Partial<{
    name: string;
    type: string;
  }> = {},
) {
  const { data } = await supabase
    .from("policy")
    .insert({
      workspace_id: workspaceId,
      name: overrides.name ?? "Test Policy",
      type: overrides.type ?? "operational",
    })
    .select()
    .single();
  return data!;
}

export { supabase };
```

**Step 2: Write auth helpers**

```typescript
// apps/e2e/helpers/auth.ts
import type { Page } from "@playwright/test";

const TEST_EMAIL = process.env.E2E_EMAIL ?? "admin@smartout.local";
const TEST_PASSWORD = process.env.E2E_PASSWORD ?? "password123";

export async function loginAsAdmin(page: Page) {
  await page.goto("/login");
  await page.fill('input[type="email"]', TEST_EMAIL);
  await page.fill('input[type="password"]', TEST_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL("**/dashboard**", { timeout: 15000 });
}

export async function loginAsEmployee(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL("**/dashboard**", { timeout: 15000 });
}
```

**Step 3: Write cleanup helper**

```typescript
// apps/e2e/helpers/cleanup.ts
import { supabase } from "./seed";

export async function cleanupTestData(workspaceId: string) {
  // Delete in reverse FK order
  await supabase.from("session_task").delete().eq("workspace_id", workspaceId);
  await supabase.from("session_note").delete().eq("workspace_id", workspaceId);
  await supabase.from("procedure_step_completion").delete().eq("workspace_id", workspaceId);
  await supabase.from("knowledge_test_attempt").delete().eq("workspace_id", workspaceId);
  await supabase.from("confirmation_signature").delete().eq("workspace_id", workspaceId);
  await supabase.from("schedule_shift").delete().eq("workspace_id", workspaceId);
  await supabase.from("department_session").delete().eq("workspace_id", workspaceId);
  await supabase.from("protocol_assignment").delete().match({ protocol_id: workspaceId }); // adjust as needed
  await supabase.from("profile").delete().eq("workspace_id", workspaceId);
  await supabase.from("department").delete().eq("workspace_id", workspaceId);
}
```

**Step 4: Commit**

```bash
git add apps/e2e/helpers/
git commit -m "feat(e2e): add standardized seed, auth, and cleanup test helpers"
```

---

### Task 5.2: Create journey runner script

**Files:**

- Create: `scripts/journey-runner.ts`
- Create: `scripts/journey-runner/contract-template.md`
- Create: `scripts/journey-runner/reusable-components.ts`

The full script is documented in the brainstorming session. Key additions from skarpningar:

**5.2a: Reusable components scanner**

```typescript
// scripts/journey-runner/reusable-components.ts
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

interface ReusableComponent {
  path: string;
  name: string;
  description: string;
}

const MODULE_TO_DIRS: Record<string, string[]> = {
  scheduling: ["schedule/_components", "schedule/_hooks"],
  operations: ["close/_components", "close/_hooks", "reconciliation/"],
  training: ["governance/", "my-training/"],
  org: ["organization/"],
  communication: ["chat/"],
  all: ["_components/", "_hooks/", "../../components/dashboard/", "../../components/ui/"],
};

export function findReusableComponents(module: string): ReusableComponent[] {
  const dirs = [...(MODULE_TO_DIRS[module] ?? []), ...MODULE_TO_DIRS.all];
  const components: ReusableComponent[] = [];

  // Always include shared components
  const sharedComponents: ReusableComponent[] = [
    {
      path: "components/dashboard/SignalCard.tsx",
      name: "SignalCard",
      description: "Metric card with good/warning/critical status styling",
    },
    {
      path: "components/dashboard/DashboardCard.tsx",
      name: "DashboardCard",
      description: "Standard card wrapper for dashboard content",
    },
    {
      path: "components/dashboard/DashboardShell.tsx",
      name: "DashboardShell",
      description: "Main dashboard layout with sidebar, breadcrumbs, context",
    },
    {
      path: "components/dashboard/EmployeeDashboard.tsx",
      name: "EmployeeDashboard",
      description: "Employee landing page — shifts, readiness, open shifts",
    },
    {
      path: "components/platform-admin/data-table.tsx",
      name: "DataTable",
      description: "Reusable TanStack Table with sorting, filtering, pagination",
    },
    {
      path: "components/platform-admin/confirmation-dialog.tsx",
      name: "ConfirmationDialog",
      description: "Type-to-confirm destructive action dialog",
    },
    {
      path: "components/platform-admin/status-badge.tsx",
      name: "StatusBadge",
      description: "Colored status indicator badge",
    },
    {
      path: "components/dashboard/ActionStrip.tsx",
      name: "ActionStrip",
      description: "Quick-action buttons strip below header",
    },
    {
      path: "components/dashboard/GlobalSearchPalette.tsx",
      name: "GlobalSearchPalette",
      description: "Cmd+K search palette",
    },
    {
      path: "components/dashboard/WorkspaceSwitcher.tsx",
      name: "WorkspaceSwitcher",
      description: "Workspace selector dropdown",
    },
    {
      path: "components/dashboard/SeasonCard.tsx",
      name: "SeasonCard",
      description: "Active season display card",
    },
    {
      path: "components/contract-editor/contract-editor.tsx",
      name: "ContractEditor",
      description: "Tiptap-based rich text editor",
    },
  ];
  components.push(...sharedComponents);

  // Add module-specific hooks
  for (const dir of dirs) {
    const basePath = `apps/web/src/app/dashboard/${dir}`;
    try {
      const files = execSync(`find ${basePath} -name "*.ts" -o -name "*.tsx" 2>/dev/null`, {
        encoding: "utf-8",
      });
      for (const file of files.trim().split("\n").filter(Boolean)) {
        const name =
          file
            .split("/")
            .pop()
            ?.replace(/\.(ts|tsx)$/, "") ?? "";
        if (name.startsWith("use-") || name.startsWith("Use")) {
          const content = readFileSync(file, "utf-8").slice(0, 200);
          const desc = content.match(/\/\*\*\s*\n\s*\*\s*(.+)/)?.[1] ?? `Hook: ${name}`;
          components.push({ path: file.replace("apps/web/src/", ""), name, description: desc });
        }
      }
    } catch {
      /* dir doesn't exist */
    }
  }

  return components;
}
```

**5.2b: Contract template with "Existing Code to Reuse" section**

````markdown
<!-- scripts/journey-runner/contract-template.md -->

# Execution Contract: {{JOURNEY_ID}} — {{JOURNEY_TITLE}}

## Source of Truth

- Journey spec: `docs/modules/journey/SMARTOUT_JOURNEY_DEEP_SPEC.md`
- Journey registry: `docs/modules/journey/SMARTOUT_JOURNEY_REGISTRY.md`
- Project conventions: `CLAUDE.md`
- Database schema: `packages/supabase/src/database.types.ts`

## What You Are Building

{{JOURNEY_SUMMARY}}

### Classification

- Module: {{MODULE}} | Actor: {{ACTOR}} | Platform: {{PLATFORM}} | Priority: {{PRIORITY}}

### Steps

{{STEPS}}

### Tables

READ: {{DATA_READS}}
WRITE: {{DATA_WRITES}}

### Events to Emit

{{EVENTS}}

## Existing Code to Reuse

**CRITICAL: Do NOT create new components if these exist. Import and use them.**

{{REUSABLE_COMPONENTS}}

### E2E Test Helpers (MANDATORY)

Import from `apps/e2e/helpers/`:

- `seedProfile(workspaceId)` — create test employee
- `seedShift(workspaceId, { profile_id, department_id, shift_date, start_time, end_time })`
- `seedDepartment(workspaceId)` — create test department
- `seedProtocol(workspaceId)` — create test protocol
- `seedProtocolAssignment({ protocol_id, profile_id })`
- `seedDepartmentSession(workspaceId, { department_id, session_date })`
- `seedPolicy(workspaceId)` — create test policy
- `loginAsAdmin(page)` — login with test admin
- `loginAsEmployee(page, email, password)` — login as specific employee
- `cleanupTestData(workspaceId)` — delete all test data

Example:

```typescript
import { seedProfile, seedShift, seedDepartment } from "../helpers/seed";
import { loginAsEmployee } from "../helpers/auth";
import { cleanupTestData } from "../helpers/cleanup";

test.beforeEach(async () => {
  workspace = await seedWorkspace();
  department = await seedDepartment(workspace.workspace_id);
  profile = await seedProfile(workspace.workspace_id, { role: "employee" });
});

test.afterEach(async () => {
  await cleanupTestData(workspace.workspace_id);
});
```
````

## Implementation Rules

1. Read CLAUDE.md — follow ALL conventions
2. Read existing code in same module before creating new files
3. Use `database.types.ts` generated types — never hand-type DB types
4. TypeScript strict, no `any`, no hardcoded colors, no hardcoded Norwegian text
5. Server Components default, `"use client"` as deep as possible
6. shadcn/ui (new-york style) for all UI
7. TanStack Query for data fetching
8. Every mutation must call `emit()` from `@smartout/telemetry`
9. All `data-testid` attributes from spec MUST be present
10. E2E tests MUST use helpers from `apps/e2e/helpers/` — never create ad-hoc seed functions

## File Locations

- Page: `apps/web/src/app/dashboard/{{ROUTE}}/page.tsx`
- Components: `apps/web/src/app/dashboard/{{ROUTE}}/_components/`
- Hooks: `apps/web/src/app/dashboard/{{ROUTE}}/_hooks/`
- E2E: `apps/e2e/tests/{{JOURNEY_SLUG}}.spec.ts`

## Verification (run ALL before reporting done)

- [ ] `pnpm turbo typecheck` — 0 errors
- [ ] `pnpm turbo lint --filter=web` — 0 errors
- [ ] `pnpm --filter e2e test:e2e -- --grep "{{JOURNEY_ID}}"` — all pass
- [ ] Every `data-testid` from spec exists in code
- [ ] Every `emit()` call exists for every mutation

## Completion

Commit: `feat({{MODULE}}): implement {{JOURNEY_ID}} {{JOURNEY_TITLE}}`
Report format:

```
JOURNEY: {{JOURNEY_ID}}
STATUS: pass | partial | fail
TYPECHECK: pass | fail
LINT: pass | fail
E2E: N/M passing
NOTES: [anything reviewer should know]
```

Do NOT merge. Leave on feature branch for review.

````

**5.2c: Journey runner writes to journey table**

In the `reportResult` function, add Supabase write:

```typescript
async function reportResult(result: RunResult): Promise<void> {
  // ... existing console + file output ...

  // Write to journey table (if it exists)
  try {
    const supabase = createClient(
      process.env.SUPABASE_URL ?? "http://127.0.0.1:54321",
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );

    // Find journey by slug pattern (J-030 -> journey with matching title/slug)
    const journeySlug = result.journeyId.toLowerCase().replace("j-", "j-");
    const { data: journey } = await supabase
      .from("journey")
      .select("journey_id, status")
      .ilike("slug", `%${journeySlug.replace("j-", "")}%`)
      .single();

    if (journey) {
      // Update last_test_result
      await supabase.from("journey").update({
        last_test_result: result.status === "pass" ? "pass" : "fail",
        last_test_run_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq("journey_id", journey.journey_id);

      // Insert test run record
      await supabase.from("journey_test_run").insert({
        journey_id: journey.journey_id,
        workspace_id: journey.workspace_id,
        result: result.status === "pass" ? "pass" : "fail",
        duration_ms: result.duration,
        error_message: result.error ?? null,
        test_output: result.verification as any,
        test_type: "automated",
      });

      // Auto-advance status if all pass
      if (result.status === "pass" && journey.status === "building") {
        await supabase.from("journey").update({
          status: "ready_test",
          updated_at: new Date().toISOString(),
        }).eq("journey_id", journey.journey_id);

        await supabase.from("journey_event").insert({
          journey_id: journey.journey_id,
          workspace_id: journey.workspace_id,
          event_type: "status_change",
          from_status: "building",
          to_status: "ready_test",
          metadata: { automated: true, run_result: result.status },
        });
      }
    }
  } catch (e) {
    console.warn("Could not update journey table:", e);
  }
}
````

**Step 2: Add package.json scripts**

In root `package.json`:

```json
"journey:run": "tsx scripts/journey-runner.ts",
"journey:dry-run": "tsx scripts/journey-runner.ts --dry-run",
"journey:verify": "tsx scripts/journey-runner.ts --verify-only"
```

**Step 3: Commit**

```bash
git add scripts/journey-runner.ts scripts/journey-runner/ package.json
git commit -m "feat(tooling): add journey runner CLI with execution contracts and verification"
```

---

# PHASE 3: JOURNEY IMPLEMENTATIONS (Weeks 6-10)

Each journey below is executed by the journey runner. The order respects dependencies.

---

## Week 6: Governance + Training Foundation

| Order | Journey                          | Priority | Dependency                       |
| ----- | -------------------------------- | -------- | -------------------------------- |
| 1     | J-058 Create Policy & Protocol   | P0       | None (tables exist)              |
| 2     | J-032 Take Knowledge Test        | P0       | Knowledge test table from Week 2 |
| 3     | J-031 Sign Confirmation          | P0       | Confirmation table from Week 2   |
| 4     | J-030 Complete Training Protocol | P0       | J-058 + J-032 + J-031            |

Run: `pnpm journey:run J-058 J-032 J-031 J-030`

---

## Week 7: Employee Core

| Order | Journey                              | Priority | Dependency                    |
| ----- | ------------------------------------ | -------- | ----------------------------- |
| 5     | J-011 Check My Schedule              | P0       | /my-schedule from Week 4      |
| 6     | J-046 View Employee Dashboard        | P1       | EmployeeDashboard exists      |
| 7     | J-002 Employee Accepts Invite        | P0       | Protocol pipeline from Week 3 |
| 8     | J-006 Admin Reviews Trainee Progress | P0       | Readiness scores from Week 3  |

Run: `pnpm journey:run J-011 J-046 J-002 J-006`

---

## Week 8: Operations + Readiness

| Order | Journey                           | Priority | Dependency                    |
| ----- | --------------------------------- | -------- | ----------------------------- |
| 9     | J-025 Sign Off Department Session | P1       | Session lifecycle from Week 3 |
| 10    | J-033 Check Readiness Dashboard   | P0       | Readiness fix from Week 3     |
| 11    | J-016 Handle Sick Call            | P0       | Schedule + absence flow       |
| 12    | J-022 Create Ad-Hoc Task          | P1       | schedule_day_task exists      |

Run: `pnpm journey:run J-025 J-033 J-016 J-022`

---

## Week 9: Communication + People

| Order | Journey                           | Priority | Dependency              |
| ----- | --------------------------------- | -------- | ----------------------- |
| 13    | J-043 Send Workspace Announcement | P1       | Chat tables exist       |
| 14    | J-042 Team Chat During Shift      | P1       | Chat tables exist       |
| 15    | J-007 Bulk Invite Employees       | P1       | Invitation table exists |
| 16    | J-008 Employee Offboarding        | P1       | Profile management      |

Run: `pnpm journey:run J-043 J-042 J-007 J-008`

---

## Week 10: Contracts + Reports + Settings

| Order | Journey                                  | Priority | Dependency                 |
| ----- | ---------------------------------------- | -------- | -------------------------- |
| 17    | J-060 Create Employment Contract         | P1       | employment_contract exists |
| 18    | J-061 Sign Employment Contract           | P1       | DocuSeal integration       |
| 19    | J-051 GDPR Data Export                   | P1       | Data access query          |
| 20    | J-047 Generate Operations Report         | P1       | All operations data exists |
| 21    | J-049 Configure Workspace Settings       | P0       | Settings page partial      |
| 22    | J-018 View Shift History                 | P1       | Schedule data exists       |
| 23    | J-044 Configure Notification Preferences | P2       | Simple form                |
| 24    | J-059 AI-Assisted Governance             | P1       | J-058 done                 |

Run: `pnpm journey:run J-060 J-061 J-051 J-047 J-049 J-018 J-044 J-059`

---

# APPENDIX

## A. Reusable Components Inventory

Agents MUST check this list before creating new components.

### Dashboard Components (`apps/web/src/components/dashboard/`)

| Component           | File                      | Use for                            |
| ------------------- | ------------------------- | ---------------------------------- |
| SignalCard          | `SignalCard.tsx`          | Metric cards with status colors    |
| DashboardCard       | `DashboardCard.tsx`       | Standard content card wrapper      |
| DashboardShell      | `DashboardShell.tsx`      | Main layout with sidebar + context |
| AdminDashboard      | `AdminDashboard.tsx`      | Admin view router (30 lines)       |
| EmployeeDashboard   | `EmployeeDashboard.tsx`   | Employee landing page              |
| ActionStrip         | `ActionStrip.tsx`         | Quick-action buttons               |
| TacticalView        | `TacticalView.tsx`        | Weekly ops overview                |
| StrategicView       | `StrategicView.tsx`       | KPI dashboard                      |
| ReconciliationView  | `ReconciliationView.tsx`  | Daily reconciliation               |
| ActivityView        | `ActivityView.tsx`        | Activity trail feed                |
| GuardianView        | `GuardianView.tsx`        | Real-time monitoring               |
| GlobalSearchPalette | `GlobalSearchPalette.tsx` | Cmd+K search                       |
| SeasonCard          | `SeasonCard.tsx`          | Season display                     |
| WorkspaceSwitcher   | `WorkspaceSwitcher.tsx`   | Workspace dropdown                 |

### Platform Admin (`apps/web/src/components/platform-admin/`)

| Component          | File                      | Use for                       |
| ------------------ | ------------------------- | ----------------------------- |
| DataTable          | `data-table.tsx`          | Any sortable/filterable table |
| ConfirmationDialog | `confirmation-dialog.tsx` | Destructive action confirm    |
| StatusBadge        | `status-badge.tsx`        | Any status indicator          |
| KpiCard            | `kpi-card.tsx`            | KPI metric display            |

### Dashboard Hooks (`apps/web/src/app/dashboard/_hooks/`)

| Hook                    | Use for                          |
| ----------------------- | -------------------------------- |
| use-protocol-journey    | Protocol assignments + readiness |
| use-governance-overview | Governance data aggregation      |
| use-staffing-coverage   | Staff coverage metrics           |
| use-kpi-targets         | KPI target queries               |
| use-budget              | Budget data                      |
| use-active-season       | Current season                   |
| use-department-shifts   | Shifts by department             |
| use-training-readiness  | Training completion data         |

### Schedule Hooks (`apps/web/src/app/dashboard/schedule/_hooks/`)

| Hook                  | Use for                      |
| --------------------- | ---------------------------- |
| use-shifts            | Shift CRUD + queries         |
| use-employees         | Employee roster              |
| use-week-range        | Week navigation state        |
| use-absences          | Absence data                 |
| use-templates         | Schedule templates           |
| use-schedule-realtime | Realtime shift subscriptions |
| use-day-content       | Day-level aggregated data    |
| use-open-shifts       | Available open shifts        |

### UI Components (`apps/web/src/components/ui/`)

Full shadcn/ui set: accordion, alert-dialog, avatar, badge, button, card, checkbox, collapsible, command, dialog, dropdown-menu, input, label, popover, progress, scroll-area, select, separator, sheet, switch, table, tabs, textarea, toggle, tooltip.

## B. Verification Commands

```bash
# Type check entire monorepo
pnpm turbo typecheck

# Lint web app only
pnpm turbo lint --filter=web

# Run specific journey E2E test
pnpm --filter e2e test:e2e -- --grep "J-030"

# Run all E2E tests
pnpm --filter e2e test:e2e

# Regenerate DB types after migration
npx supabase gen types typescript --local > packages/supabase/src/database.types.ts

# Reset local Supabase (applies all migrations fresh)
npx supabase db reset

# Start local dev
npx supabase start && pnpm --filter web dev
```

## C. Migration Order Summary

```
20260412100000_session_enums.sql           ← no deps
20260412100100_engine_state_step.sql       ← depends on engine_state
20260412100200_completion_tracking.sql     ← depends on profile, protocol, procedure_step, knowledge_test, confirmation
20260412100300_session_infrastructure.sql  ← depends on enums (100000), department_session, department, profile
20260412200000_seed_session_lifecycle.sql   ← depends on engine_process
20260412200100_seed_onboarding_process.sql ← depends on engine_process
20260412200200_seed_training_protocol.sql  ← depends on engine_process
20260412200300_seed_session_hook_dispatcher.sql ← depends on engine_process
20260412200400_daily_close_step_zero.sql   ← depends on daily_close seed
```

All migrations are sequential by timestamp. No circular dependencies.
