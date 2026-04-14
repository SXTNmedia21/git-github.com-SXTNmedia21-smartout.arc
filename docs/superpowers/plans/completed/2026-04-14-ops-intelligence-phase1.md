---
title: "AI Operations Intelligence — Phase 1 Implementation Plan"
status: draft
updated: 2026-04-14
created: 2026-04-14
module: ai
tags: [ai, operations, intelligence, phase-1, compile, triage]
---

# AI Operations Intelligence — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the `operations_intelligence` capability scaffold, COMPILE briefing tools, TRIAGE classification with three-tier alerts, Day Brief cron, and fix the existing briefing.ts importance bug.

**Architecture:** New `operations_intelligence` capability (manager/system scope) for TRIAGE tools. COMPILE tools live in existing `communication` capability (per ADR-0088). Background automation via Edge Functions triggered by pg_cron and DB triggers. All tools emit telemetry via `emit()`.

**Tech Stack:** TypeScript, Zod, Supabase Edge Functions (Deno), pg_cron, `@smartout/telemetry` emit(), `@smartout/notifications` push dispatch, sonner toasts.

**Spec:** `docs/superpowers/specs/2026-04-14-ai-operations-intelligence-design.md`
**ADR:** `docs/decisions/0088-ai-operations-intelligence-capability.md`

---

## File Map

### New Files
| Path | Responsibility |
|------|---------------|
| `supabase/migrations/YYYYMMDDHHMMSS_ops_intelligence_foundations.sql` | ALTER TYPE policy_type, ALTER CHECK engine_memory, seed authority + policy |
| `packages/ai/src/capabilities/operations-intelligence/index.ts` | Capability definition + tool exports |
| `packages/ai/src/capabilities/operations-intelligence/tools.ts` | `triage_event` tool |
| `packages/ai/src/capabilities/communication/compile-day-brief.ts` | `compile_day_brief` tool |
| `packages/ai/src/capabilities/communication/compile-preclose.ts` | `compile_preclose_summary` tool |
| `supabase/functions/ops-triage/index.ts` | Edge Function: DB-trigger-invoked event triage |
| `supabase/functions/ops-day-brief/index.ts` | Edge Function: pg_cron Day Brief sweeper |
| `supabase/migrations/YYYYMMDDHHMMSS_ops_triage_trigger.sql` | DB trigger on engine_event → ops-triage |
| `supabase/migrations/YYYYMMDDHHMMSS_ops_day_brief_cron.sql` | pg_cron registration for Day Brief |

### Modified Files
| Path | Change |
|------|--------|
| `packages/ai/src/capabilities/types.ts:5-18` | Add `operations_intelligence` to `CapabilityName` union |
| `packages/ai/src/capabilities/registry.ts` | Import + register `operationsIntelligenceCapability` |
| `packages/ai/src/capabilities/communication/index.ts` | Import + export compile tools |
| `packages/ai/src/capabilities/communication/briefing.ts:103` | Fix importance threshold: `5` → `0.5` |
| `packages/telemetry/src/registry.ts` | Add `ops.compile.*` and `ops.triage.*` event interfaces |

---

## Task 1: Database Migrations

**Files:**
- Create: `supabase/migrations/20260414230000_ops_intelligence_foundations.sql`

- [ ] **Step 1: Write the migration file**

```sql
-- ============================================
-- 20260414230000_ops_intelligence_foundations.sql
-- Foundation migrations for AI Operations Intelligence (ADR-0088).
-- 1. Extend policy_type enum with 'ai_operations'
-- 2. Extend engine_memory memory_type CHECK with 'learned_pattern', 'prediction'
-- 3. Seed engine_authority_config for operations_intelligence capability
-- 4. Seed default ai_operations policy per workspace
-- ============================================

SET search_path TO public, extensions;

-- 1. Add 'ai_operations' to policy_type enum
ALTER TYPE policy_type ADD VALUE IF NOT EXISTS 'ai_operations';

-- 2. Expand engine_memory memory_type CHECK constraint
ALTER TABLE engine_memory DROP CONSTRAINT IF EXISTS engine_memory_memory_type_check;
ALTER TABLE engine_memory ADD CONSTRAINT engine_memory_memory_type_check
  CHECK (memory_type IN ('preference', 'fact', 'summary', 'general', 'constant', 'learned_pattern', 'prediction'));

-- 3. Seed default engine_authority_config for operations_intelligence
-- One row per workspace that has an active season.
-- Default level: 'suggest' (conservative — workspace admin can elevate).
INSERT INTO engine_authority_config (workspace_id, capability, level, min_role, created_at, updated_at)
SELECT
  w.workspace_id,
  'operations_intelligence',
  'suggest',
  'manager',
  now(),
  now()
FROM workspace w
WHERE w.is_active = true
ON CONFLICT (workspace_id, capability) DO NOTHING;

-- 4. Seed default ai_operations policy per active workspace
INSERT INTO policy (workspace_id, name, description, policy_type, scope, is_active, rules_json, created_at, updated_at)
SELECT
  w.workspace_id,
  'AI Operations Configuration',
  'Default AI operations intelligence thresholds and toggles',
  'ai_operations',
  'workspace',
  true,
  '{
    "late_punchin_threshold_minutes": 10,
    "noshow_threshold_minutes": 30,
    "task_overdue_grace_minutes": 15,
    "day_brief_offset_minutes": 30,
    "shift_brief_enabled": true,
    "mid_session_digest_enabled": false,
    "triage_enabled": true,
    "alert_tier_critical_channels": ["push", "sms"],
    "alert_tier_active_channels": ["push"],
    "alert_tier_ambient_channels": ["in_app"]
  }'::jsonb,
  now(),
  now()
FROM workspace w
WHERE w.is_active = true
ON CONFLICT DO NOTHING;
```

- [ ] **Step 2: Apply migration locally**

Run: `npx supabase db reset` or `npx supabase migration up`
Expected: Migration applies without errors.

- [ ] **Step 3: Verify changes**

Run: `npx supabase db lint`
Expected: No lint errors.

Verify in SQL:
```sql
SELECT enum_range(NULL::policy_type);
-- Should include 'ai_operations'

SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = 'engine_memory_memory_type_check';
-- Should include 'learned_pattern', 'prediction'

SELECT * FROM engine_authority_config WHERE capability = 'operations_intelligence' LIMIT 1;
-- Should return a row

SELECT * FROM policy WHERE policy_type = 'ai_operations' LIMIT 1;
-- Should return a row
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260414230000_ops_intelligence_foundations.sql
git commit -m "feat(db): add ops intelligence foundations — policy_type, memory_type, authority seed

ADR-0088: extend policy_type enum with ai_operations, engine_memory
CHECK with learned_pattern and prediction, seed authority config and
default policy per workspace.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Capability Scaffold

**Files:**
- Modify: `packages/ai/src/capabilities/types.ts`
- Create: `packages/ai/src/capabilities/operations-intelligence/index.ts`
- Create: `packages/ai/src/capabilities/operations-intelligence/tools.ts`
- Modify: `packages/ai/src/capabilities/registry.ts`

- [ ] **Step 1: Add `operations_intelligence` to CapabilityName union**

In `packages/ai/src/capabilities/types.ts`, add to the union:

```typescript
export type CapabilityName =
  | "knowledge"
  | "schedule"
  | "training"
  | "operations"
  | "operations_intelligence" // ADR-0088: manager/system-scoped intelligence
  | "profile"
  | "communication"
  | "memory"
  | "payroll"
  | "ui"
  | "guardian"
  | "contract"
  | "contract_intake"
  | "shift_swap";
```

- [ ] **Step 2: Create the triage tool file**

Create `packages/ai/src/capabilities/operations-intelligence/tools.ts`:

```typescript
// packages/ai/src/capabilities/operations-intelligence/tools.ts
// ADR-0088: Operations Intelligence capability — manager/system-scoped tools.
// Phase 1: triage_event. Phase 2+3 tools added later.
import { z } from "zod";
import { defineTool } from "../../types.js";
import type { AgentToolContext } from "../types.js";

/**
 * triage_event — Classify and route an operational event.
 * On-demand tool: manager invokes during conversation to manually triage.
 * Background equivalent: ops-triage Edge Function (DB-trigger invoked).
 */
export const triageEvent = defineTool({
  name: "triage_event",
  description:
    "Classify an operational event by type, urgency, and relevance, then route to the appropriate person or channel",
  schema: z.object({
    event_type: z
      .string()
      .describe("The engine_event event_type to triage (e.g. 'deviation.reported', 'session_task.overdue')"),
    event_payload: z
      .record(z.unknown())
      .optional()
      .describe("Event payload for context enrichment"),
    department_id: z
      .string()
      .uuid()
      .optional()
      .describe("Department to scope triage. If omitted, inferred from event."),
  }),
  execute: async (params, ctx: AgentToolContext) => {
    const supabase = ctx.supabaseAdmin;

    // 1. Classify the event
    const classification = classifyEvent(params.event_type, params.event_payload);

    // 2. Determine who is on shift in this department
    const deptId = params.department_id;
    let onShiftProfiles: string[] = [];
    if (deptId) {
      const now = new Date().toISOString();
      const { data: shifts } = await supabase
        .from("schedule_shift")
        .select("employee_id")
        .eq("workspace_id", ctx.workspaceId)
        .eq("department_id", deptId)
        .lte("start_time", now)
        .gte("end_time", now)
        .in("status", ["published", "confirmed"]);
      onShiftProfiles = (shifts ?? []).map((s) => s.employee_id).filter(Boolean) as string[];
    }

    // 3. Route based on classification
    const routing = {
      classification: classification.type,
      urgency: classification.urgency,
      tier: classification.tier,
      recipients: resolveRecipients(classification, onShiftProfiles),
      channels: classification.channels,
      context: {
        on_shift_count: onShiftProfiles.length,
        event_type: params.event_type,
      },
    };

    // 4. Emit telemetry
    await supabase.from("engine_event").insert({
      workspace_id: ctx.workspaceId,
      event_type: "ops.triage.classified",
      payload: {
        ...routing,
        source: "agent_tool",
        actor_id: ctx.profileId,
        origin: "system",
      },
    });

    return JSON.stringify(routing);
  },
});

// ── Classification logic ──────────────────────────────────────────────

type EventClassification = {
  type: "information" | "action_needed" | "deviation" | "emergency";
  urgency: "immediate" | "next_break" | "end_of_shift" | "next_day";
  tier: "ambient" | "active" | "critical";
  channels: string[];
};

function classifyEvent(
  eventType: string,
  payload?: Record<string, unknown>,
): EventClassification {
  // Critical events
  if (
    eventType.includes("temperature_violation") ||
    eventType.includes("no_show") ||
    eventType.includes("safety") ||
    (payload?.severity === "critical")
  ) {
    return { type: "emergency", urgency: "immediate", tier: "critical", channels: ["push", "sms"] };
  }

  // Action-needed events
  if (
    eventType.includes("overdue") ||
    eventType.includes("deviation") ||
    eventType.includes("coverage_gap") ||
    (payload?.severity === "high")
  ) {
    return { type: "action_needed", urgency: "next_break", tier: "active", channels: ["push"] };
  }

  // Deviation events (medium severity)
  if (eventType.includes("deviation") || eventType.includes("flagged")) {
    return { type: "deviation", urgency: "end_of_shift", tier: "active", channels: ["push"] };
  }

  // Default: informational
  return { type: "information", urgency: "next_day", tier: "ambient", channels: ["in_app"] };
}

function resolveRecipients(
  classification: EventClassification,
  onShiftProfiles: string[],
): { role: string; profile_ids: string[] }[] {
  if (classification.tier === "critical") {
    return [
      { role: "on_shift", profile_ids: onShiftProfiles },
      { role: "manager", profile_ids: [] }, // resolved at delivery time via role lookup
    ];
  }
  if (classification.tier === "active") {
    return [{ role: "shift_lead", profile_ids: [] }];
  }
  return [{ role: "on_shift", profile_ids: onShiftProfiles }];
}
```

- [ ] **Step 3: Create the capability index**

Create `packages/ai/src/capabilities/operations-intelligence/index.ts`:

```typescript
// packages/ai/src/capabilities/operations-intelligence/index.ts
// ADR-0088: Operations Intelligence — manager/system-scoped capability.

import type { SmartoutTool } from "../../types.js";
import type { AgentToolContext, CapabilityDefinition } from "../types.js";
import { triageEvent } from "./tools.js";

const allTools = [triageEvent] as unknown as ReadonlyArray<SmartoutTool<AgentToolContext>>;

const readOnlyTools = [] as unknown as ReadonlyArray<SmartoutTool<AgentToolContext>>;

const suggestTools = [triageEvent] as unknown as ReadonlyArray<SmartoutTool<AgentToolContext>>;

export const operationsIntelligenceCapability: CapabilityDefinition = {
  name: "operations_intelligence",
  description:
    "Operational intelligence: event triage, anomaly monitoring, session analysis. Manager and system scope.",
  tools: allTools,
  readOnlyTools,
  suggestTools,
};
```

- [ ] **Step 4: Register in capability registry**

In `packages/ai/src/capabilities/registry.ts`, add import and registration:

```typescript
// Add import after existing imports:
import { operationsIntelligenceCapability } from "./operations-intelligence/index.js";

// Add to capabilities record:
const capabilities: Record<string, CapabilityDefinition> = {
  profile: profileCapability,
  ui: uiCapability,
  guardian: guardianCapability,
  schedule: scheduleCapability,
  operations: operationsCapability,
  communication: communicationCapability,
  contract: contractCapability,
  contract_intake: contractIntakeCapability,
  shift_swap: shiftSwapCapability,
  operations_intelligence: operationsIntelligenceCapability,
};
```

- [ ] **Step 5: Verify typecheck passes**

Run: `pnpm turbo typecheck --filter=@smartout/ai`
Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add packages/ai/src/capabilities/types.ts \
  packages/ai/src/capabilities/operations-intelligence/index.ts \
  packages/ai/src/capabilities/operations-intelligence/tools.ts \
  packages/ai/src/capabilities/registry.ts
git commit -m "feat(ai): add operations_intelligence capability scaffold with triage_event tool

ADR-0088 Phase 1: new capability for manager/system-scoped operational
intelligence. Initial tool: triage_event for classifying and routing
operational events by type, urgency, and alert tier.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: COMPILE — Day Brief Tool

**Files:**
- Create: `packages/ai/src/capabilities/communication/compile-day-brief.ts`
- Modify: `packages/ai/src/capabilities/communication/index.ts`

- [ ] **Step 1: Create the compile-day-brief tool**

Create `packages/ai/src/capabilities/communication/compile-day-brief.ts`:

```typescript
// packages/ai/src/capabilities/communication/compile-day-brief.ts
// ADR-0088: COMPILE function — Day Brief compilation.
// Lives in communication capability per ADR-0088 (COMPILE stays in communication).
import { z } from "zod";
import { defineTool } from "../../types.js";
import type { AgentToolContext } from "../types.js";

/**
 * compile_day_brief — Compile a Day Brief for a department's upcoming session.
 * Reads: previous handoff, today's schedule, pending tasks, notes, deviations.
 * Output: structured briefing JSON for rendering as dashboard card or mobile bottom sheet.
 */
export const compileDayBrief = defineTool({
  name: "compile_day_brief",
  description:
    "Compile a Day Brief for a department — previous handoff, today's schedule, pending tasks, open deviations, and announcements",
  schema: z.object({
    department_id: z.string().uuid().describe("Department to compile brief for"),
    date: z
      .string()
      .optional()
      .describe("Date in YYYY-MM-DD format. Defaults to today."),
  }),
  execute: async (params, ctx: AgentToolContext) => {
    const supabase = ctx.supabaseAdmin;
    const targetDate = params.date ?? new Date().toISOString().slice(0, 10);
    const yesterday = new Date(new Date(targetDate).getTime() - 86400000).toISOString().slice(0, 10);

    // Parallel fetches: previous handoff, today's session, shifts, pending tasks, deviations, memories
    const [handoffResult, sessionResult, shiftsResult, tasksResult, deviationsResult, memoriesResult] =
      await Promise.all([
        // Previous session handoff notes
        supabase
          .from("department_session")
          .select("handoff_notes, signed_off_by, status")
          .eq("workspace_id", ctx.workspaceId)
          .eq("department_id", params.department_id)
          .eq("session_date", yesterday)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),

        // Today's session
        supabase
          .from("department_session")
          .select(
            "department_session_id, status, planned_open, planned_close, duty_leader_id, tasks_total, tasks_completed",
          )
          .eq("workspace_id", ctx.workspaceId)
          .eq("department_id", params.department_id)
          .eq("session_date", targetDate)
          .limit(1)
          .maybeSingle(),

        // Today's shifts
        supabase
          .from("schedule_shift")
          .select("employee_id, role, start_time, end_time, status")
          .eq("workspace_id", ctx.workspaceId)
          .eq("department_id", params.department_id)
          .eq("shift_date", targetDate)
          .in("status", ["published", "confirmed"])
          .order("start_time", { ascending: true }),

        // Pending tasks for today's session
        supabase
          .from("session_task")
          .select("id, title, priority, status, due_at, task_type")
          .eq("workspace_id", ctx.workspaceId)
          .eq("status", "pending")
          .order("due_at", { ascending: true })
          .limit(20),

        // Open deviations (last 7 days)
        supabase
          .from("deviation")
          .select("deviation_id, title, severity, status, created_at")
          .eq("workspace_id", ctx.workspaceId)
          .eq("department_id", params.department_id)
          .in("status", ["open", "in_progress"])
          .order("created_at", { ascending: false })
          .limit(10),

        // Recent announcements from engine_memory (K1b)
        supabase
          .from("engine_memory")
          .select("content, memory_type, importance, created_at")
          .eq("workspace_id", ctx.workspaceId)
          .gte("importance", 0.5)
          .order("created_at", { ascending: false })
          .limit(5),
      ]);

    const brief = {
      department_id: params.department_id,
      date: targetDate,
      previous_handoff: handoffResult.data?.handoff_notes ?? null,
      previous_session_status: handoffResult.data?.status ?? null,
      session: sessionResult.data ?? null,
      shifts: {
        count: shiftsResult.data?.length ?? 0,
        schedule: (shiftsResult.data ?? []).map((s) => ({
          employee_id: s.employee_id,
          role: s.role,
          start: s.start_time,
          end: s.end_time,
        })),
      },
      pending_tasks: {
        count: tasksResult.data?.length ?? 0,
        critical: (tasksResult.data ?? []).filter((t) => t.priority === "critical").length,
        items: (tasksResult.data ?? []).slice(0, 5).map((t) => ({
          title: t.title,
          priority: t.priority,
          due_at: t.due_at,
        })),
      },
      open_deviations: {
        count: deviationsResult.data?.length ?? 0,
        items: (deviationsResult.data ?? []).map((d) => ({
          title: d.title,
          severity: d.severity,
          status: d.status,
        })),
      },
      announcements: (memoriesResult.data ?? []).map((m) => ({
        content: m.content,
        importance: m.importance,
      })),
    };

    // Emit telemetry
    await supabase.from("engine_event").insert({
      workspace_id: ctx.workspaceId,
      event_type: "ops.compile.day_brief",
      payload: {
        department_id: params.department_id,
        date: targetDate,
        shift_count: brief.shifts.count,
        task_count: brief.pending_tasks.count,
        deviation_count: brief.open_deviations.count,
        source: "agent_tool",
        actor_id: ctx.profileId,
        origin: "system",
      },
    });

    return JSON.stringify(brief);
  },
});
```

- [ ] **Step 2: Register in communication capability**

Read `packages/ai/src/capabilities/communication/index.ts` and add the import + tool to arrays:

```typescript
// Add import:
import { compileDayBrief } from "./compile-day-brief.js";

// Add to allTools array:
const allTools = [
  // ... existing tools ...
  compileDayBrief,
] as unknown as ReadonlyArray<SmartoutTool<AgentToolContext>>;

// Add to readOnlyTools (it's a read operation that compiles data):
const readOnlyTools = [
  // ... existing readOnly tools ...
  compileDayBrief,
] as unknown as ReadonlyArray<SmartoutTool<AgentToolContext>>;
```

- [ ] **Step 3: Verify typecheck**

Run: `pnpm turbo typecheck --filter=@smartout/ai`
Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add packages/ai/src/capabilities/communication/compile-day-brief.ts \
  packages/ai/src/capabilities/communication/index.ts
git commit -m "feat(ai): add compile_day_brief tool to communication capability

ADR-0088 Phase 1 COMPILE: reads previous handoff, schedule, tasks,
deviations, and K1b announcements to produce a structured Day Brief.
Emits ops.compile.day_brief telemetry.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: COMPILE — Pre-close Summary Tool

**Files:**
- Create: `packages/ai/src/capabilities/communication/compile-preclose.ts`
- Modify: `packages/ai/src/capabilities/communication/index.ts`

- [ ] **Step 1: Create the compile-preclose tool**

Create `packages/ai/src/capabilities/communication/compile-preclose.ts`:

```typescript
// packages/ai/src/capabilities/communication/compile-preclose.ts
// ADR-0088: COMPILE function — Pre-close Summary compilation.
import { z } from "zod";
import { defineTool } from "../../types.js";
import type { AgentToolContext } from "../types.js";

/**
 * compile_preclose_summary — Compile a pre-close summary for a department session.
 * Shows: tasks done vs remaining, open deviations, unsigned items, handoff prep.
 */
export const compilePreclose = defineTool({
  name: "compile_preclose_summary",
  description:
    "Compile a pre-close summary for a department session — tasks done, tasks remaining, open deviations, items needing sign-off",
  schema: z.object({
    department_id: z.string().uuid().describe("Department to compile pre-close for"),
  }),
  execute: async (params, ctx: AgentToolContext) => {
    const supabase = ctx.supabaseAdmin;
    const today = new Date().toISOString().slice(0, 10);

    // Get today's session
    const { data: session } = await supabase
      .from("department_session")
      .select("department_session_id, status, planned_close, tasks_total, tasks_completed, duty_leader_id")
      .eq("workspace_id", ctx.workspaceId)
      .eq("department_id", params.department_id)
      .eq("session_date", today)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!session) {
      return JSON.stringify({ error: "No active session found for today." });
    }

    // Parallel: incomplete tasks, deviations, required unsigned tasks
    const [incompleteTasks, deviations, requiredTasks] = await Promise.all([
      supabase
        .from("session_task")
        .select("id, title, priority, status, assigned_to, due_at")
        .eq("workspace_id", ctx.workspaceId)
        .eq("department_session_id", session.department_session_id)
        .in("status", ["pending", "in_progress", "overdue"])
        .order("priority", { ascending: true }),

      supabase
        .from("deviation")
        .select("deviation_id, title, severity, status")
        .eq("workspace_id", ctx.workspaceId)
        .eq("department_id", params.department_id)
        .eq("status", "open")
        .order("severity", { ascending: true }),

      supabase
        .from("session_task")
        .select("id, title, priority, status")
        .eq("workspace_id", ctx.workspaceId)
        .eq("department_session_id", session.department_session_id)
        .eq("is_required", true)
        .neq("status", "completed"),
    ]);

    const summary = {
      session_id: session.department_session_id,
      session_status: session.status,
      planned_close: session.planned_close,
      tasks: {
        total: session.tasks_total ?? 0,
        completed: session.tasks_completed ?? 0,
        remaining: (incompleteTasks.data ?? []).length,
        required_incomplete: (requiredTasks.data ?? []).length,
        items: (incompleteTasks.data ?? []).map((t) => ({
          id: t.id,
          title: t.title,
          priority: t.priority,
          status: t.status,
          assigned_to: t.assigned_to,
        })),
      },
      deviations: {
        open_count: (deviations.data ?? []).length,
        items: (deviations.data ?? []).map((d) => ({
          id: d.deviation_id,
          title: d.title,
          severity: d.severity,
        })),
      },
      ready_for_signoff: (requiredTasks.data ?? []).length === 0 && (deviations.data ?? []).length === 0,
    };

    // Emit telemetry
    await supabase.from("engine_event").insert({
      workspace_id: ctx.workspaceId,
      event_type: "ops.compile.preclose_summary",
      payload: {
        session_id: session.department_session_id,
        tasks_remaining: summary.tasks.remaining,
        deviations_open: summary.deviations.open_count,
        ready_for_signoff: summary.ready_for_signoff,
        source: "agent_tool",
        actor_id: ctx.profileId,
        origin: "system",
      },
    });

    return JSON.stringify(summary);
  },
});
```

- [ ] **Step 2: Register in communication capability**

In `packages/ai/src/capabilities/communication/index.ts`, add:

```typescript
import { compilePreclose } from "./compile-preclose.js";

// Add to allTools and readOnlyTools arrays alongside compileDayBrief
```

- [ ] **Step 3: Verify typecheck**

Run: `pnpm turbo typecheck --filter=@smartout/ai`
Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add packages/ai/src/capabilities/communication/compile-preclose.ts \
  packages/ai/src/capabilities/communication/index.ts
git commit -m "feat(ai): add compile_preclose_summary tool to communication capability

ADR-0088 Phase 1 COMPILE: reads session tasks, deviations, and required
items to produce a pre-close checklist. Emits ops.compile.preclose_summary.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Fix briefing.ts Importance Bug

**Files:**
- Modify: `packages/ai/src/capabilities/communication/briefing.ts:103`

- [ ] **Step 1: Fix the importance threshold**

In `packages/ai/src/capabilities/communication/briefing.ts`, line 103, change:

```typescript
// BEFORE (bug: importance column is 0.0-1.0, not integer):
.gte("importance", 5)

// AFTER:
.gte("importance", 0.5)
```

- [ ] **Step 2: Verify typecheck**

Run: `pnpm turbo typecheck --filter=@smartout/ai`
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add packages/ai/src/capabilities/communication/briefing.ts
git commit -m "fix(ai): correct importance threshold in shift briefing (0.5 not 5)

engine_memory.importance is constrained to 0.0-1.0 range. The query
was using >= 5 which always returned zero rows. Corrected to >= 0.5.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: ops-triage Edge Function

**Files:**
- Create: `supabase/functions/ops-triage/index.ts`

- [ ] **Step 1: Create the Edge Function**

Create `supabase/functions/ops-triage/index.ts`:

```typescript
/**
 * ops-triage — DB-trigger-invoked event classifier and router.
 *
 * Invoked by a DB trigger on engine_event inserts. Classifies the event
 * by type, urgency, and alert tier, then routes notifications to the
 * appropriate recipients via the notification outbox.
 *
 * Auth: WATCHDOG_CRON_SECRET bearer token (trigger-invoked pattern).
 * ADR-0088: AI Operations Intelligence Phase 1 — TRIAGE function.
 */

import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ── Classification types ──────────────────────────────────────────────

type AlertTier = "ambient" | "active" | "critical";
type Urgency = "immediate" | "next_break" | "end_of_shift" | "next_day";

type Classification = {
  type: "information" | "action_needed" | "deviation" | "emergency";
  urgency: Urgency;
  tier: AlertTier;
};

// ── Classification rules ──────────────────────────────────────────────

const CRITICAL_PATTERNS = [
  "temperature_violation",
  "no_show",
  "safety",
  "emergency",
];

const ACTIVE_PATTERNS = [
  "overdue",
  "deviation",
  "coverage_gap",
  "understaffing",
  "escalated",
];

function classify(eventType: string, payload: Record<string, unknown>): Classification {
  const type = eventType.toLowerCase();

  if (CRITICAL_PATTERNS.some((p) => type.includes(p)) || payload?.severity === "critical") {
    return { type: "emergency", urgency: "immediate", tier: "critical" };
  }

  if (ACTIVE_PATTERNS.some((p) => type.includes(p)) || payload?.severity === "high") {
    return { type: "action_needed", urgency: "next_break", tier: "active" };
  }

  if (type.includes("deviation") || type.includes("flagged")) {
    return { type: "deviation", urgency: "end_of_shift", tier: "active" };
  }

  return { type: "information", urgency: "next_day", tier: "ambient" };
}

// ── Handler ───────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const authHeader = req.headers.get("authorization");
  const cronSecret = Deno.env.get("WATCHDOG_CRON_SECRET");
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const body = await req.json();
    const eventType: string = body.event_type ?? "";
    const payload: Record<string, unknown> = body.payload ?? {};

    // Loop guard: skip system-origin events
    if (payload.origin === "system") {
      return new Response(JSON.stringify({ skipped: true, reason: "system_origin" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Skip ops.* events to prevent self-triage loops
    if (eventType.startsWith("ops.")) {
      return new Response(JSON.stringify({ skipped: true, reason: "ops_event" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const classification = classify(eventType, payload);

    // Only route active and critical events to notification outbox
    if (classification.tier !== "ambient") {
      const workspaceId = body.workspace_id ?? payload.workspace_id;
      if (workspaceId) {
        await supabase.from("notification").insert({
          workspace_id: workspaceId,
          title: `[${classification.tier.toUpperCase()}] ${eventType.replace(/[._]/g, " ")}`,
          body: JSON.stringify({ classification, event_type: eventType }),
          icon_type: classification.tier === "critical" ? "alert" : "info",
          priority: classification.tier === "critical" ? "critical" : "normal",
          target_type: "workspace",
          target_id: workspaceId,
        });
      }
    }

    // Log the triage result
    await supabase.from("engine_event").insert({
      workspace_id: body.workspace_id ?? payload.workspace_id,
      event_type: "ops.triage.classified",
      payload: {
        original_event: eventType,
        classification,
        origin: "system",
      },
    });

    return new Response(JSON.stringify({ classified: true, ...classification }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
```

- [ ] **Step 2: Commit**

```bash
git add supabase/functions/ops-triage/index.ts
git commit -m "feat(edge): add ops-triage Edge Function for event classification

ADR-0088 Phase 1 TRIAGE: classifies engine_event entries by type,
urgency, and alert tier (ambient/active/critical). Routes active and
critical events to notification outbox. Includes loop guard for
system-origin and ops.* events.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: ops-day-brief Edge Function + Cron

**Files:**
- Create: `supabase/functions/ops-day-brief/index.ts`
- Create: `supabase/migrations/20260414230100_ops_day_brief_cron.sql`

- [ ] **Step 1: Create the Day Brief cron Edge Function**

Create `supabase/functions/ops-day-brief/index.ts`:

```typescript
/**
 * ops-day-brief — Cron-triggered Day Brief compiler.
 *
 * Runs daily at 05:00 UTC (07:00 Oslo). For each workspace with an active
 * season, queries all departments with sessions today and compiles a
 * Day Brief for each. Inserts a notification per department with the brief.
 *
 * Auth: WATCHDOG_CRON_SECRET bearer token (cron-only pattern).
 * ADR-0088: AI Operations Intelligence Phase 1 — COMPILE Day Brief.
 */

import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const authHeader = req.headers.get("authorization");
  const cronSecret = Deno.env.get("WATCHDOG_CRON_SECRET");
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const today = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

    // Find all department_sessions for today across all workspaces
    const { data: sessions, error: sessionsError } = await supabase
      .from("department_session")
      .select("department_session_id, workspace_id, department_id, planned_open, planned_close, department:department_id(name)")
      .eq("session_date", today)
      .in("status", ["upcoming", "active"]);

    if (sessionsError) throw sessionsError;
    if (!sessions || sessions.length === 0) {
      return new Response(JSON.stringify({ compiled: 0, message: "No sessions today" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let compiled = 0;

    for (const session of sessions) {
      // Parallel: handoff, shifts, pending tasks, deviations
      const [handoff, shifts, tasks, deviations] = await Promise.all([
        supabase
          .from("department_session")
          .select("handoff_notes, status")
          .eq("workspace_id", session.workspace_id)
          .eq("department_id", session.department_id)
          .eq("session_date", yesterday)
          .limit(1)
          .maybeSingle(),

        supabase
          .from("schedule_shift")
          .select("employee_id, role, start_time, end_time")
          .eq("workspace_id", session.workspace_id)
          .eq("department_id", session.department_id)
          .eq("shift_date", today)
          .in("status", ["published", "confirmed"])
          .order("start_time", { ascending: true }),

        supabase
          .from("session_task")
          .select("title, priority")
          .eq("workspace_id", session.workspace_id)
          .eq("department_session_id", session.department_session_id)
          .eq("status", "pending")
          .eq("priority", "critical")
          .limit(5),

        supabase
          .from("deviation")
          .select("title, severity")
          .eq("workspace_id", session.workspace_id)
          .eq("department_id", session.department_id)
          .eq("status", "open")
          .limit(5),
      ]);

      const deptName = (session.department as { name: string } | null)?.name ?? "Department";
      const shiftCount = shifts.data?.length ?? 0;
      const criticalTasks = tasks.data?.length ?? 0;
      const openDeviations = deviations.data?.length ?? 0;
      const handoffNotes = handoff.data?.handoff_notes ?? null;

      // Build brief summary for notification
      const summaryParts: string[] = [];
      summaryParts.push(`${shiftCount} on schedule`);
      if (criticalTasks > 0) summaryParts.push(`${criticalTasks} critical tasks`);
      if (openDeviations > 0) summaryParts.push(`${openDeviations} open deviations`);
      if (handoffNotes) summaryParts.push("handoff notes from yesterday");

      // Insert notification for department managers
      await supabase.from("notification").insert({
        workspace_id: session.workspace_id,
        title: `Day Brief: ${deptName}`,
        body: summaryParts.join(" | "),
        icon_type: openDeviations > 0 || criticalTasks > 0 ? "alert" : "info",
        priority: criticalTasks > 0 ? "high" : "normal",
        target_type: "department",
        target_id: session.department_id,
        metadata: {
          type: "day_brief",
          department_id: session.department_id,
          session_id: session.department_session_id,
          shift_count: shiftCount,
          critical_tasks: criticalTasks,
          open_deviations: openDeviations,
          has_handoff: !!handoffNotes,
        },
      });

      // Emit telemetry
      await supabase.from("engine_event").insert({
        workspace_id: session.workspace_id,
        event_type: "ops.compile.day_brief",
        payload: {
          department_id: session.department_id,
          session_id: session.department_session_id,
          shift_count: shiftCount,
          critical_tasks: criticalTasks,
          open_deviations: openDeviations,
          source: "cron",
          origin: "system",
        },
      });

      compiled++;
    }

    return new Response(JSON.stringify({ compiled, total_sessions: sessions.length }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
```

- [ ] **Step 2: Create the cron migration**

Create `supabase/migrations/20260414230100_ops_day_brief_cron.sql`:

```sql
-- ============================================
-- 20260414230100_ops_day_brief_cron.sql
-- Registers pg_cron job for daily Day Brief compilation (05:00 UTC / 07:00 Oslo).
-- ADR-0088: AI Operations Intelligence Phase 1.
-- ============================================

DO $cmd$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'ops-day-brief',
      '0 5 * * *',
      $sql$SELECT net.http_post(
        url := current_setting('app.supabase_url', true) || '/functions/v1/ops-day-brief',
        headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.watchdog_cron_secret', true))
      )$sql$
    );
  END IF;
END $cmd$;
```

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/ops-day-brief/index.ts \
  supabase/migrations/20260414230100_ops_day_brief_cron.sql
git commit -m "feat(edge): add ops-day-brief cron Edge Function

ADR-0088 Phase 1 COMPILE: daily cron (05:00 UTC) sweeps all
department_sessions, compiles Day Briefs with handoff, shifts, critical
tasks, and deviations. Inserts notifications per department.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: Telemetry Registry Updates

**Files:**
- Modify: `packages/telemetry/src/registry.ts`

- [ ] **Step 1: Add ops event interfaces**

In `packages/telemetry/src/registry.ts`, add after the existing event interfaces (near the bottom of the file, before the union type):

```typescript
// ─── Operations Intelligence Events (ADR-0088) ──────────────────────

export interface OpsCompileDayBrief extends BaseEvent {
  event: "ops.compile day_brief";
  properties: {
    entity: { entity_type: "department_session"; entity_id: string };
    data: { department_id: string; shift_count: number; critical_tasks: number };
  };
}

export interface OpsCompilePreclose extends BaseEvent {
  event: "ops.compile preclose_summary";
  properties: {
    entity: { entity_type: "department_session"; entity_id: string };
    data: { tasks_remaining: number; deviations_open: number; ready_for_signoff: boolean };
  };
}

export interface OpsCompileShiftBrief extends BaseEvent {
  event: "ops.compile shift_brief";
  properties: {
    entity: { entity_type: "shift"; entity_id: string };
    data: { profile_id: string };
  };
}

export interface OpsTriageClassified extends BaseEvent {
  event: "ops.triage classified";
  properties: {
    data: {
      original_event: string;
      classification_type: string;
      urgency: string;
      tier: "ambient" | "active" | "critical";
    };
  };
}
```

Also add `"ops.compile"` and `"ops.triage"` event category options. Find the `EventCategory` type and add:

```typescript
export type EventCategory =
  | "auth"
  | "onboarding"
  // ... existing categories ...
  | "enrichment"
  | "ops_intelligence"; // ADR-0088
```

- [ ] **Step 2: Add to the SmartoutEvent union type**

Find the `SmartoutEvent` union type and add the new interfaces:

```typescript
export type SmartoutEvent =
  // ... existing event types ...
  | OpsCompileDayBrief
  | OpsCompilePreclose
  | OpsCompileShiftBrief
  | OpsTriageClassified;
```

- [ ] **Step 3: Add event metadata entries**

Find the `EVENT_META` record and add entries:

```typescript
"ops.compile day_brief": { destinations: ["logger", "engine_event"], category: "ops_intelligence" },
"ops.compile preclose_summary": { destinations: ["logger", "engine_event"], category: "ops_intelligence" },
"ops.compile shift_brief": { destinations: ["logger", "engine_event"], category: "ops_intelligence" },
"ops.triage classified": { destinations: ["logger", "engine_event"], category: "ops_intelligence" },
```

- [ ] **Step 4: Verify typecheck**

Run: `pnpm turbo typecheck --filter=@smartout/telemetry`
Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add packages/telemetry/src/registry.ts
git commit -m "feat(telemetry): register ops intelligence events in telemetry registry

ADR-0088: adds ops.compile.* and ops.triage.* event interfaces,
ops_intelligence category, and EVENT_META routing entries. All ops
events route to logger + engine_event.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: Final Typecheck + Verification

- [ ] **Step 1: Full monorepo typecheck**

Run: `pnpm turbo typecheck`
Expected: 0 errors across all packages.

- [ ] **Step 2: Verify capability count**

Run: `grep -c "Capability" packages/ai/src/capabilities/registry.ts`
Expected: 10 capabilities registered.

- [ ] **Step 3: Verify migration applies**

Run: `npx supabase db reset`
Expected: All migrations apply without errors.

- [ ] **Step 4: Verify cron registered**

After reset, run SQL:
```sql
SELECT jobname FROM cron.job WHERE jobname LIKE 'ops-%';
```
Expected: `ops-day-brief` row.

---

## Summary

| Task | What | Files |
|------|------|-------|
| 1 | DB migrations (policy_type, memory_type, seeds) | 1 migration |
| 2 | Capability scaffold (types, registry, triage tool) | 4 files |
| 3 | COMPILE: Day Brief tool | 2 files |
| 4 | COMPILE: Pre-close Summary tool | 2 files |
| 5 | Fix briefing.ts importance bug | 1 file |
| 6 | ops-triage Edge Function | 1 file |
| 7 | ops-day-brief Edge Function + cron | 2 files |
| 8 | Telemetry registry updates | 1 file |
| 9 | Final verification | 0 files (verification only) |

**Total: 9 tasks, ~14 files created/modified, 8 commits.**
