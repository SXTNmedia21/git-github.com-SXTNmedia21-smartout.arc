# Agent Harness Phase 1: Foundation — Implementation Plan (v2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Working directory:** `/home/sxtnl/dev/smartout.ai/`

**Goal:** Add hook registry, context view, model provider, token tracking, session durability, and lane serialization to the stage-engine — the infrastructure layer that Phase 2 (subagents) and Phase 3 (Arena UI) build upon.

**Architecture:** Seven hook points intercept the agent pipeline in `routeAgentMessage()`. Context View wraps existing `collectContext()` with a sliding window over a new append-only event log. SessionLane serializes concurrent requests per session. Model provider centralizes model strings. Token tracking logs all LLM usage via an observe hook. All new code lives in `services/stage-engine/src/` except one Supabase migration. This is agent-chat-only infrastructure.

**Tech Stack:** TypeScript, Hono, Vitest, Supabase (PostgreSQL), Vercel AI SDK, Zod

**Spec:** `docs/superpowers/specs/2026-04-09-agent-harness-foundation-design.md`

---

## File Structure

### New files (8)

| File | Responsibility |
|------|---------------|
| `services/stage-engine/src/hooks/registry.ts` | HookRegistry class — register, unregister, run hooks by name with typed payloads |
| `services/stage-engine/src/hooks/builtin.ts` | 4 built-in hooks: pii-channel-guard, telemetry-observer, memory-save, budget-guard |
| `services/stage-engine/src/core/context-view.ts` | ContextView class — assemble LLM context window over event log + collectContext() |
| `services/stage-engine/src/core/model-provider.ts` | `resolveModel()` — centralized model string resolution |
| `services/stage-engine/src/core/session-lane.ts` | SessionLane class — per-session promise queue for serialization |
| `services/stage-engine/src/core/event-log.ts` | `appendSessionEvent()` + `getSessionEvents()` — read/write helpers for engine_session_event |
| `services/stage-engine/src/tools/session-events.ts` | `get_session_events` Botsson tool — lets the agent query its own event log |
| `supabase/migrations/20260409120000_agent_harness_foundation.sql` | DB migration: engine_session_event table, engine_token_log table, budget columns on engine_sessions |

### Modified files (5)

| File | Change |
|------|--------|
| `services/stage-engine/src/index.ts` | Instantiate HookRegistry, register built-in hooks, set SessionLane on context |
| `services/stage-engine/src/core/agent-router.ts` | Add 7 hook call sites, use ContextView.assemble(), use resolveModel(), append session events |
| `services/stage-engine/src/routes/agent/chat.ts` | Wrap handler body in `sessionLane.run()`, pass hooks + contextView |
| `services/stage-engine/src/core/stage-manager.ts` | Emit `session:completing` hook before session completion |
| `packages/telemetry/src/registry.ts` | Register 4 new agent events (subagent events deferred to Phase 2) |

### Test files (5)

| File | What it tests |
|------|--------------|
| `services/stage-engine/src/hooks/__tests__/registry.test.ts` | HookRegistry: register, priority ordering, guard blocking, transform composition, observe non-blocking |
| `services/stage-engine/src/core/__tests__/context-view.test.ts` | ContextView: assemble within budget, sliding window, priority ranking |
| `services/stage-engine/src/core/__tests__/session-lane.test.ts` | SessionLane: serialization, concurrent requests, cleanup |
| `services/stage-engine/src/core/__tests__/event-log.test.ts` | appendSessionEvent + getSessionEvents: write and read events |
| `services/stage-engine/src/core/__tests__/model-provider.test.ts` | resolveModel: defaults, capability overrides |

---

## Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/20260409120000_agent_harness_foundation.sql`

- [ ] **Step 1: Write the migration file**

```sql
-- Agent Harness Foundation (Phase 1)
-- New tables: engine_session_event, engine_token_log
-- New columns on engine_sessions: total_turns, total_tokens, max_turns, max_tokens
-- Scope: agent chat infrastructure only.

-- engine_session_event — append-only internal replay journal for agent chat
-- NOT a duplicate of guardian_log. Boundary:
--   guardian_log = external audit trail (what users see in guardian panel)
--   engine_session_event = internal crash-recovery journal (replay log, never surfaced to users)
-- No updated_at — this is append-only, rows are never updated.
CREATE TABLE engine_session_event (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  UUID NOT NULL REFERENCES workspace(workspace_id),
  session_id    UUID NOT NULL REFERENCES engine_sessions(id) ON DELETE CASCADE,
  event_type    TEXT NOT NULL,
  payload       JSONB NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_session_event_session ON engine_session_event(session_id, created_at);

ALTER TABLE engine_session_event ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace members can view session events"
  ON engine_session_event FOR SELECT
  USING (workspace_id IN (
    SELECT workspace_id FROM company_member WHERE user_id = auth.uid()
  ));

CREATE POLICY "service_role_session_events"
  ON engine_session_event FOR ALL
  USING (
    current_setting('request.jwt.claims', true)::json ->> 'role' = 'service_role'
    OR workspace_id::text = current_setting('app.current_workspace_id', true)
  )
  WITH CHECK (
    current_setting('request.jwt.claims', true)::json ->> 'role' = 'service_role'
    OR workspace_id::text = current_setting('app.current_workspace_id', true)
  );

-- engine_token_log — all LLM token usage per workspace/profile/session
-- No updated_at — this is append-only, rows are never updated.
CREATE TABLE engine_token_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  UUID NOT NULL REFERENCES workspace(workspace_id),
  profile_id    UUID NOT NULL REFERENCES profile(profile_id),
  session_id    UUID REFERENCES engine_sessions(id) ON DELETE SET NULL,
  model         TEXT NOT NULL,
  input_tokens  INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  total_tokens  INTEGER NOT NULL DEFAULT 0,
  source        TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_token_log_workspace ON engine_token_log(workspace_id, created_at);
CREATE INDEX idx_token_log_profile ON engine_token_log(profile_id, created_at);

ALTER TABLE engine_token_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace members can view token logs"
  ON engine_token_log FOR SELECT
  USING (workspace_id IN (
    SELECT workspace_id FROM company_member WHERE user_id = auth.uid()
  ));

CREATE POLICY "service_role_token_logs"
  ON engine_token_log FOR ALL
  USING (
    current_setting('request.jwt.claims', true)::json ->> 'role' = 'service_role'
    OR workspace_id::text = current_setting('app.current_workspace_id', true)
  )
  WITH CHECK (
    current_setting('request.jwt.claims', true)::json ->> 'role' = 'service_role'
    OR workspace_id::text = current_setting('app.current_workspace_id', true)
  );

-- Budget tracking columns on engine_sessions
ALTER TABLE engine_sessions ADD COLUMN IF NOT EXISTS total_turns INTEGER NOT NULL DEFAULT 0;
ALTER TABLE engine_sessions ADD COLUMN IF NOT EXISTS total_tokens INTEGER NOT NULL DEFAULT 0;
ALTER TABLE engine_sessions ADD COLUMN IF NOT EXISTS max_turns INTEGER;
ALTER TABLE engine_sessions ADD COLUMN IF NOT EXISTS max_tokens INTEGER;
```

- [ ] **Step 2: Apply the migration locally**

Run: `npx supabase db reset`
Expected: Migration applies cleanly, no errors.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260409120000_agent_harness_foundation.sql
git commit -m "feat(db): add engine_session_event, engine_token_log tables and budget columns

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Hook Registry

**Files:**
- Create: `services/stage-engine/src/hooks/registry.ts`
- Test: `services/stage-engine/src/hooks/__tests__/registry.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `services/stage-engine/src/hooks/__tests__/registry.test.ts`:

```typescript
/**
 * registry.test.ts
 * Unit tests for HookRegistry — the priority-based event dispatcher
 * that intercepts the agent pipeline at 7 hook points.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HookRegistry } from "../registry.js";

describe("HookRegistry", () => {
  let registry: HookRegistry;

  beforeEach(() => {
    registry = new HookRegistry();
  });

  describe("register and run", () => {
    it("runs a registered guard hook and returns blocked=false when no block", async () => {
      const handler = vi.fn().mockResolvedValue({ block: false });
      registry.register({
        name: "message:received",
        handler,
        priority: 0,
        type: "guard",
      });

      const result = await registry.run("message:received", {
        message: "hello",
        sessionId: "s1",
        channel: "chat",
      });

      expect(handler).toHaveBeenCalledOnce();
      expect(result.blocked).toBe(false);
    });

    it("returns blocked=true with reason when a guard blocks", async () => {
      registry.register({
        name: "message:received",
        handler: async () => ({ block: true, reason: "PII detected" }),
        priority: 0,
        type: "guard",
      });

      const result = await registry.run("message:received", {
        message: "my SSN is 123",
        sessionId: "s1",
        channel: "voice",
      });

      expect(result.blocked).toBe(true);
      expect(result.reason).toBe("PII detected");
    });
  });

  describe("priority ordering", () => {
    it("runs higher-priority guard hooks first", async () => {
      const order: number[] = [];

      registry.register({
        name: "message:received",
        handler: async () => { order.push(10); return { block: false }; },
        priority: 10,
        type: "guard",
      });
      registry.register({
        name: "message:received",
        handler: async () => { order.push(5); return { block: false }; },
        priority: 5,
        type: "guard",
      });
      registry.register({
        name: "message:received",
        handler: async () => { order.push(20); return { block: false }; },
        priority: 20,
        type: "guard",
      });

      await registry.run("message:received", {
        message: "test",
        sessionId: "s1",
        channel: "chat",
      });

      // Guard hooks run sequentially in priority order (highest first)
      expect(order).toEqual([20, 10, 5]);
    });
  });

  describe("guard stops pipeline", () => {
    it("stops running subsequent hooks after a guard blocks", async () => {
      const secondHandler = vi.fn();

      registry.register({
        name: "message:received",
        handler: async () => ({ block: true, reason: "blocked" }),
        priority: 10,
        type: "guard",
      });
      registry.register({
        name: "message:received",
        handler: secondHandler,
        priority: 5,
        type: "guard",
      });

      await registry.run("message:received", {
        message: "test",
        sessionId: "s1",
        channel: "chat",
      });

      expect(secondHandler).not.toHaveBeenCalled();
    });
  });

  describe("transform hooks", () => {
    it("transforms modify the payload for subsequent hooks", async () => {
      registry.register({
        name: "llm:before",
        handler: async (payload) => {
          payload.systemPrompt = payload.systemPrompt + " [enriched]";
        },
        priority: 10,
        type: "transform",
      });

      const payload = { systemPrompt: "base prompt", tools: {}, messages: [], sessionId: "s1" };
      const result = await registry.run("llm:before", payload);
      expect(result.payload.systemPrompt).toBe("base prompt [enriched]");
    });
  });

  describe("observe hooks", () => {
    it("observe hooks do not block the pipeline on errors", async () => {
      registry.register({
        name: "llm:after",
        handler: async () => { throw new Error("telemetry crash"); },
        priority: 0,
        type: "observe",
      });

      // Should NOT throw — observers are fire-and-forget
      const result = await registry.run("llm:after", {
        result: {} as never,
        sessionId: "s1",
        tokensUsed: 100,
      });

      expect(result.blocked).toBe(false);
    });
  });

  describe("unregister", () => {
    it("removes a previously registered hook", async () => {
      const handler = vi.fn();
      registry.register({
        name: "message:received",
        handler,
        priority: 0,
        type: "observe",
      });
      registry.unregister("message:received", handler);

      await registry.run("message:received", {
        message: "test",
        sessionId: "s1",
        channel: "chat",
      });

      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe("no hooks registered", () => {
    it("returns blocked=false with unmodified payload", async () => {
      const payload = { message: "hello", sessionId: "s1", channel: "chat" as const };
      const result = await registry.run("message:received", payload);
      expect(result.blocked).toBe(false);
      expect(result.payload).toBe(payload);
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd services/stage-engine && npx vitest run src/hooks/__tests__/registry.test.ts`
Expected: FAIL — module `../registry.js` not found

- [ ] **Step 3: Write the HookRegistry implementation**

Create `services/stage-engine/src/hooks/registry.ts`:

```typescript
// registry.ts — Priority-based event dispatcher for the agent chat pipeline.
// Hooks intercept 7 points: message:received, intent:classified,
// context:collected, tools:selected, llm:before, llm:after, session:completing.
// Guard hooks can block, Transform hooks modify payloads, Observe hooks are fire-and-forget.

import type { IntentResult } from "@smartout/ai/router/intent-classifier";
import type { AgentContext } from "@smartout/ai/context/types";
import type { SessionChannel } from "../types/session.js";

export type HookPayloadMap = {
  "message:received": { message: string; sessionId: string; channel: SessionChannel };
  "intent:classified": { intent: IntentResult; sessionId: string };
  "context:collected": { context: AgentContext; sessionId: string };
  "tools:selected": { tools: ReadonlyArray<unknown>; intent: IntentResult };
  "llm:before": { systemPrompt: string; tools: Record<string, unknown>; messages: Array<unknown>; sessionId: string };
  "llm:after": { result: unknown; sessionId: string; tokensUsed: number };
  "session:completing": { sessionId: string; summary?: string };
};

export type HookName = keyof HookPayloadMap;
export type HookResult = { block: false } | { block: true; reason: string };

export type HookHandler<N extends HookName> = (
  payload: HookPayloadMap[N],
) => Promise<HookResult | void> | HookResult | void;

export interface Hook<N extends HookName = HookName> {
  name: N;
  handler: HookHandler<N>;
  priority: number;
  type: "guard" | "transform" | "observe";
}

type RunResult<N extends HookName> = {
  blocked: boolean;
  reason?: string;
  payload: HookPayloadMap[N];
};

export class HookRegistry {
  private hooks = new Map<HookName, Array<Hook<HookName>>>();

  register<N extends HookName>(hook: Hook<N>): void {
    const list = this.hooks.get(hook.name) ?? [];
    list.push(hook as Hook<HookName>);
    list.sort((a, b) => b.priority - a.priority);
    this.hooks.set(hook.name, list);
  }

  unregister<N extends HookName>(name: N, handler: HookHandler<N>): void {
    const list = this.hooks.get(name);
    if (!list) return;
    const idx = list.findIndex((h) => h.handler === handler);
    if (idx !== -1) list.splice(idx, 1);
  }

  // Transform hooks mutate payload in-place. The same payload object is returned
  // in RunResult.payload. Callers should use RunResult.payload to read post-transform
  // state, not their original variable reference (even though they're the same object
  // today — this convention makes the data flow explicit and survives future refactors).
  async run<N extends HookName>(name: N, payload: HookPayloadMap[N]): Promise<RunResult<N>> {
    const list = (this.hooks.get(name) ?? []) as Array<Hook<N>>;
    if (list.length === 0) return { blocked: false, payload };

    // Guard + Transform hooks run sequentially (awaited), highest priority first
    const sequential = list.filter((h) => h.type !== "observe");
    // Observe hooks fire via Promise.allSettled (non-blocking, zero pipeline latency)
    const observers = list.filter((h) => h.type === "observe");

    for (const hook of sequential) {
      const result = await hook.handler(payload);
      if (result && "block" in result && result.block) {
        return { blocked: true, reason: result.reason, payload };
      }
    }

    if (observers.length > 0) {
      Promise.allSettled(
        observers.map((h) => Promise.resolve(h.handler(payload))),
      ).then((results) => {
        for (const r of results) {
          if (r.status === "rejected") {
            console.error(`[hooks] Observe hook error on "${name}":`, r.reason);
          }
        }
      });
    }

    return { blocked: false, payload };
  }
}
```

Note: `llm:before` payload now includes `sessionId` — required for budget-guard to check session limits.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd services/stage-engine && npx vitest run src/hooks/__tests__/registry.test.ts`
Expected: All 7 tests PASS

- [ ] **Step 5: Commit**

```bash
git add services/stage-engine/src/hooks/registry.ts services/stage-engine/src/hooks/__tests__/registry.test.ts
git commit -m "feat(stage-engine): add HookRegistry with typed payloads

Priority-based event dispatcher for the agent pipeline. Supports
guard (blocking), transform (payload mutation), and observe
(fire-and-forget via Promise.allSettled) hook types.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Model Provider

**Files:**
- Create: `services/stage-engine/src/core/model-provider.ts`
- Test: `services/stage-engine/src/core/__tests__/model-provider.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `services/stage-engine/src/core/__tests__/model-provider.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { resolveModel } from "../model-provider.js";

describe("resolveModel", () => {
  it("returns default model for chat", () => {
    expect(resolveModel({ sessionType: "chat" })).toBe("anthropic/claude-sonnet-4.6");
  });

  it("returns default model for subagent", () => {
    expect(resolveModel({ sessionType: "subagent" })).toBe("anthropic/claude-sonnet-4.6");
  });

  it("returns default model for classifier", () => {
    expect(resolveModel({ sessionType: "classifier" })).toBe("anthropic/claude-sonnet-4.6");
  });

  it("accepts optional capability without changing default", () => {
    expect(resolveModel({ sessionType: "chat", capability: "contract" })).toBe("anthropic/claude-sonnet-4.6");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd services/stage-engine && npx vitest run src/core/__tests__/model-provider.test.ts`

- [ ] **Step 3: Write the implementation**

Create `services/stage-engine/src/core/model-provider.ts`:

```typescript
// model-provider.ts — Centralized model string resolution.
// One place to update when new models drop. Replaces all hardcoded model strings.

const DEFAULT_MODEL = "anthropic/claude-sonnet-4.6";

type ModelContext = {
  capability?: string;
  workspaceId?: string;
  sessionType: "chat" | "subagent" | "classifier";
};

export function resolveModel(ctx: ModelContext): string {
  return DEFAULT_MODEL;
}

export type { ModelContext };
```

- [ ] **Step 4: Run tests — Expected: All 4 PASS**

- [ ] **Step 5: Commit**

```bash
git add services/stage-engine/src/core/model-provider.ts services/stage-engine/src/core/__tests__/model-provider.test.ts
git commit -m "feat(stage-engine): add resolveModel() for centralized model selection

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Session Lane

**Files:**
- Create: `services/stage-engine/src/core/session-lane.ts`
- Test: `services/stage-engine/src/core/__tests__/session-lane.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `services/stage-engine/src/core/__tests__/session-lane.test.ts`:

```typescript
import { beforeEach, describe, expect, it } from "vitest";
import { SessionLane } from "../session-lane.js";

describe("SessionLane", () => {
  let lane: SessionLane;
  beforeEach(() => { lane = new SessionLane(); });

  it("runs a single task and returns its result", async () => {
    const result = await lane.run("s1", async () => "done");
    expect(result).toBe("done");
  });

  it("serializes concurrent tasks for the same session", async () => {
    const order: number[] = [];
    const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

    const p1 = lane.run("s1", async () => { await delay(30); order.push(1); return 1; });
    const p2 = lane.run("s1", async () => { order.push(2); return 2; });

    const [r1, r2] = await Promise.all([p1, p2]);
    expect(order).toEqual([1, 2]);
    expect(r1).toBe(1);
    expect(r2).toBe(2);
  });

  it("runs tasks for different sessions in parallel", async () => {
    const order: string[] = [];
    const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

    const p1 = lane.run("s1", async () => { await delay(30); order.push("s1"); });
    const p2 = lane.run("s2", async () => { order.push("s2"); });

    await Promise.all([p1, p2]);
    expect(order).toEqual(["s2", "s1"]);
  });

  it("propagates errors from tasks", async () => {
    await expect(lane.run("s1", async () => { throw new Error("boom"); })).rejects.toThrow("boom");
  });

  it("continues processing after a failed task", async () => {
    await lane.run("s1", async () => { throw new Error("fail"); }).catch(() => {});
    const result = await lane.run("s1", async () => "recovered");
    expect(result).toBe("recovered");
  });

  it("cleans up queue entries after completion", async () => {
    await lane.run("s1", async () => "done");
    await new Promise((r) => setTimeout(r, 0));
    expect((lane as unknown as { queues: Map<string, unknown> }).queues.size).toBe(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

- [ ] **Step 3: Write the implementation**

Create `services/stage-engine/src/core/session-lane.ts`:

```typescript
// session-lane.ts — Per-session promise queue that serializes concurrent agent chat requests.
// In-memory only. On process restart, queue state is lost — crash recovery relies
// on engine_session_event replay, not on SessionLane state.

export class SessionLane {
  private queues = new Map<string, Promise<unknown>>();

  async run<T>(sessionId: string, fn: () => Promise<T>): Promise<T> {
    const prev = this.queues.get(sessionId) ?? Promise.resolve();
    // Wait for previous to settle (ignore its error), then run fn
    const next = prev.catch(() => undefined).then(() => fn());

    // Store a swallowed version so next caller chains off a resolved promise
    const swallowed = next.catch(() => {});
    this.queues.set(sessionId, swallowed);

    // Cleanup after settle: only delete if we're still the latest entry
    swallowed.finally(() => {
      if (this.queues.get(sessionId) === swallowed) this.queues.delete(sessionId);
    });

    return next;
  }
}
```

- [ ] **Step 4: Run tests — Expected: All 6 PASS**

- [ ] **Step 5: Commit**

```bash
git add services/stage-engine/src/core/session-lane.ts services/stage-engine/src/core/__tests__/session-lane.test.ts
git commit -m "feat(stage-engine): add SessionLane for per-session request serialization

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Event Log Helpers

**Files:**
- Create: `services/stage-engine/src/core/event-log.ts`
- Test: `services/stage-engine/src/core/__tests__/event-log.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `services/stage-engine/src/core/__tests__/event-log.test.ts`:

```typescript
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockInsert, mockFrom } = vi.hoisted(() => ({
  mockInsert: vi.fn().mockReturnValue({ error: null }),
  mockFrom: vi.fn(),
}));

vi.mock("../lib/supabase.js", () => ({
  supabaseAdmin: {
    from: mockFrom.mockImplementation(() => ({
      insert: mockInsert,
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({
              data: [{ event_type: "user_message", payload: { text: "hi" }, created_at: "2026-01-01" }],
              error: null,
            }),
          }),
        }),
      }),
    })),
  },
}));

import { appendSessionEvent, getSessionEvents } from "../event-log.js";

describe("appendSessionEvent", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("inserts an event with the correct shape", async () => {
    await appendSessionEvent({ sessionId: "s1", workspaceId: "w1", eventType: "user_message", payload: { text: "hello" } });
    expect(mockInsert).toHaveBeenCalledWith({
      session_id: "s1", workspace_id: "w1", event_type: "user_message", payload: { text: "hello" },
    });
  });
});

describe("getSessionEvents", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("queries events for a session", async () => {
    const result = await getSessionEvents({ sessionId: "s1", limit: 20 });
    expect(mockFrom).toHaveBeenCalledWith("engine_session_event");
    expect(result).toHaveLength(1);
    expect(result[0].event_type).toBe("user_message");
  });
});
```

Note: The mock uses `.mockResolvedValue()` on `.limit()` — no manual thenable needed. When `eventTypes` is not provided, the code `await`s the query directly (without `.in()`), so `.limit()` must return a Promise-like. `mockResolvedValue` satisfies this.

- [ ] **Step 2: Run tests to verify they fail**

- [ ] **Step 3: Write the implementation**

Create `services/stage-engine/src/core/event-log.ts`:

```typescript
// event-log.ts — Read/write helpers for engine_session_event (append-only replay journal).
// The event log is NEVER pruned or compacted — it is the source of truth for agent chat replay.

import { supabaseAdmin } from "../lib/supabase.js";

type AppendParams = {
  sessionId: string;
  workspaceId: string;
  eventType: string;
  payload: Record<string, unknown>;
};

type QueryParams = {
  sessionId: string;
  eventTypes?: string[];
  limit?: number;
};

type SessionEvent = {
  event_type: string;
  payload: Record<string, unknown>;
  created_at: string;
};

export async function appendSessionEvent(params: AppendParams): Promise<void> {
  const { error } = await supabaseAdmin.from("engine_session_event").insert({
    session_id: params.sessionId,
    workspace_id: params.workspaceId,
    event_type: params.eventType,
    payload: params.payload,
  });
  if (error) console.error("[event-log] Failed to append event:", error.message);
}

export async function getSessionEvents(params: QueryParams): Promise<SessionEvent[]> {
  let query = supabaseAdmin
    .from("engine_session_event")
    .select("event_type, payload, created_at")
    .eq("session_id", params.sessionId)
    .order("created_at", { ascending: true })
    .limit(params.limit ?? 20);

  if (params.eventTypes?.length) {
    query = query.in("event_type", params.eventTypes);
  }

  const { data, error } = await query;
  if (error) {
    console.error("[event-log] Failed to read events:", error.message);
    return [];
  }
  return (data ?? []) as SessionEvent[];
}

export type { SessionEvent, AppendParams, QueryParams };
```

- [ ] **Step 4: Run tests — Expected: All 2 PASS**

- [ ] **Step 5: Commit**

```bash
git add services/stage-engine/src/core/event-log.ts services/stage-engine/src/core/__tests__/event-log.test.ts
git commit -m "feat(stage-engine): add event log read/write helpers

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Context View

**Files:**
- Create: `services/stage-engine/src/core/context-view.ts`
- Test: `services/stage-engine/src/core/__tests__/context-view.test.ts`

**Verified:** `collectContext()` signature in `packages/ai/src/context/collector.ts:36-42` takes `{ workspaceId, profileId, situation, authority, supabaseAdmin }` — ContextView.assemble() passes exactly these fields.

- [ ] **Step 1: Write the failing tests**

Create `services/stage-engine/src/core/__tests__/context-view.test.ts`:

```typescript
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockCollectContext } = vi.hoisted(() => ({ mockCollectContext: vi.fn() }));

vi.mock("@smartout/ai/context/collector", () => ({ collectContext: mockCollectContext }));

import { ContextView } from "../context-view.js";

const baseParams = {
  workspaceId: "w1", profileId: "p1", situation: "general" as const,
  authority: "confirm" as const, sessionId: "s1", supabaseAdmin: {} as never,
  conversationHistory: [] as Array<{ role: string; content: string }>,
};

describe("ContextView", () => {
  let view: ContextView;

  beforeEach(() => {
    vi.clearAllMocks();
    view = new ContextView({ tokenBudget: 12000 });
    mockCollectContext.mockResolvedValue({
      profile: { display_name: "Test" }, currentTime: "Monday 10:00", relevantMemories: [],
    });
  });

  it("assembles context with domain data and empty conversation", async () => {
    const result = await view.assemble(baseParams);
    expect(result.domainContext).toBeDefined();
    expect(result.recentTurns).toEqual([]);
    expect(result.olderContextPointer).toBeNull();
    expect(mockCollectContext).toHaveBeenCalledOnce();
  });

  it("includes last 5 turns verbatim from conversation history", async () => {
    const history = Array.from({ length: 7 }, (_, i) => ({
      role: i % 2 === 0 ? "user" : "assistant", content: `message ${i}`,
    }));
    const result = await view.assemble({ ...baseParams, conversationHistory: history });
    expect(result.recentTurns).toHaveLength(5);
    expect(result.recentTurns[0].content).toBe("message 2");
    expect(result.olderContextPointer).toContain("get_session_events");
  });

  it("returns all turns when conversation has 5 or fewer", async () => {
    const history = [{ role: "user", content: "hi" }, { role: "assistant", content: "hello" }];
    const result = await view.assemble({ ...baseParams, conversationHistory: history });
    expect(result.recentTurns).toHaveLength(2);
    expect(result.olderContextPointer).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

- [ ] **Step 3: Write the implementation**

Create `services/stage-engine/src/core/context-view.ts`:

```typescript
// context-view.ts — Assembles what goes into the LLM context window for each agent chat turn.
// Design principle: Irreversible compaction is a trap. The event log is the source of truth.
// Context View computes a WINDOW — it never replaces, summarizes, or drops events.

import { collectContext } from "@smartout/ai/context/collector";
import type { AgentContext } from "@smartout/ai/context/types";
import type { Situation } from "@smartout/ai/capabilities/types";
import type { AuthorityLevel } from "./authority.js";
import type { SupabaseClient } from "@supabase/supabase-js";

const RECENT_TURNS_WINDOW = 5;
const OLDER_CONTEXT_NOTE =
  "Eldre samtalehistorikk er tilgjengelig. Bruk get_session_events for a hente tidligere turns.";

type ContextParams = {
  workspaceId: string;
  profileId: string;
  situation: Situation;
  authority: AuthorityLevel;
  sessionId: string;
  supabaseAdmin: SupabaseClient;
  conversationHistory: Array<{ role: string; content: string }>;
};

type AssembledContext = {
  domainContext: AgentContext;
  recentTurns: Array<{ role: string; content: string }>;
  olderContextPointer: string | null;
};

export class ContextView {
  private tokenBudget: number;

  constructor(options?: { tokenBudget?: number }) {
    this.tokenBudget = options?.tokenBudget ?? 12000;
  }

  async assemble(params: ContextParams): Promise<AssembledContext> {
    const domainContext = await collectContext({
      workspaceId: params.workspaceId,
      profileId: params.profileId,
      situation: params.situation,
      authority: params.authority,
      supabaseAdmin: params.supabaseAdmin,
    });

    const history = params.conversationHistory;
    const hasOlderTurns = history.length > RECENT_TURNS_WINDOW;
    const recentTurns = hasOlderTurns ? history.slice(-RECENT_TURNS_WINDOW) : history;
    const olderContextPointer = hasOlderTurns ? OLDER_CONTEXT_NOTE : null;

    return { domainContext, recentTurns, olderContextPointer };
  }
}

export type { AssembledContext, ContextParams };
```

- [ ] **Step 4: Run tests — Expected: All 3 PASS**

- [ ] **Step 5: Commit**

```bash
git add services/stage-engine/src/core/context-view.ts services/stage-engine/src/core/__tests__/context-view.test.ts
git commit -m "feat(stage-engine): add ContextView for sliding window context assembly

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: get_session_events Tool

**Files:**
- Create: `services/stage-engine/src/tools/session-events.ts`

- [ ] **Step 1: Write the tool implementation**

Create `services/stage-engine/src/tools/session-events.ts`:

```typescript
// session-events.ts — Botsson tool: get_session_events
// Lets the agent query its own event log when Context View truncates older turns.

import { z } from "zod";
import { getSessionEvents } from "../core/event-log.js";

const schema = z.object({
  from_turn: z.number().int().min(0).optional().describe("Start from this turn number (0-indexed)"),
  to_turn: z.number().int().optional().describe("End at this turn number (exclusive)"),
  event_types: z.array(z.string()).optional().describe("Filter by event types"),
  limit: z.number().int().max(50).default(20).describe("Max events to return (default 20, max 50)"),
});

type ToolContext = { sessionId: string; workspaceId: string; supabaseAdmin: unknown };

export const sessionEventsTool = {
  name: "get_session_events",
  description:
    "Retrieve past events from this conversation session. " +
    "Use when you need to recall what happened earlier — " +
    "tool calls, user messages, stage advances, subagent results.",
  schema,
  execute: async (params: z.infer<typeof schema>, ctx: ToolContext): Promise<string> => {
    const events = await getSessionEvents({
      sessionId: ctx.sessionId,
      eventTypes: params.event_types,
      limit: params.limit,
    });
    return JSON.stringify(events);
  },
};
```

- [ ] **Step 2: Commit**

```bash
git add services/stage-engine/src/tools/session-events.ts
git commit -m "feat(stage-engine): add get_session_events Botsson tool

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: Built-in Hooks

**Files:**
- Create: `services/stage-engine/src/hooks/builtin.ts`
- Modify: `services/stage-engine/src/types/session.ts`

- [ ] **Step 0: Extend Session type with budget columns**

The `Session` type in `services/stage-engine/src/types/session.ts:91-113` does NOT have the 4 new columns from Task 1. `getSession()` does `select("*")` so runtime data is fine, but TypeScript will error.

Read `services/stage-engine/src/types/session.ts` and add these 4 fields to the `Session` type, after `updated_at`:

```typescript
  // Budget tracking (agent harness Phase 1)
  total_turns: number;
  total_tokens: number;
  max_turns: number | null;
  max_tokens: number | null;
```

- [ ] **Step 1: Write the built-in hooks**

Create `services/stage-engine/src/hooks/builtin.ts`:

```typescript
// builtin.ts — Built-in hooks registered at stage-engine startup.
// Core agent chat pipeline behaviors: PII protection, telemetry, memory, budget.

import type { Hook, HookPayloadMap } from "./registry.js";
import { getSession } from "../core/session-manager.js";

export const piiChannelGuard: Hook<"tools:selected"> = {
  name: "tools:selected",
  type: "guard",
  priority: 100,
  handler: async (_payload) => {
    // Full PII channel guard requires session channel context in payload.
    // tools:selected payload doesn't carry channel — requires extended context
    // which will be added when the payload map is extended in a follow-up.
    // ADR-0078 enforcement currently lives at process/capability level.
    return { block: false };
  },
};

export const telemetryObserver: Hook<"llm:after"> = {
  name: "llm:after",
  type: "observe",
  priority: 0,
  handler: async (payload) => {
    console.log(
      `[telemetry] LLM call: session=${payload.sessionId}, tokens=${payload.tokensUsed}`,
    );
  },
};

export const memorySave: Hook<"session:completing"> = {
  name: "session:completing",
  type: "observe",
  priority: 0,
  handler: async (payload) => {
    console.log(`[memory] Session completing: ${payload.sessionId}`);
  },
};

/**
 * Budget Guard — blocks LLM calls when session has exceeded its budget.
 * Checks total_turns and total_tokens against max_turns and max_tokens.
 * sessionId is available on the llm:before payload.
 */
export const budgetGuard: Hook<"llm:before"> = {
  name: "llm:before",
  type: "guard",
  priority: 90,
  handler: async (payload) => {
    const session = await getSession(payload.sessionId);
    if (!session) return { block: false };

    if (session.max_tokens && session.total_tokens >= session.max_tokens) {
      return { block: true, reason: "Session token budget exhausted" };
    }
    if (session.max_turns && session.total_turns >= session.max_turns) {
      return { block: true, reason: "Session turn limit reached" };
    }
    return { block: false };
  },
};

export function getBuiltinHooks(): Array<Hook<keyof HookPayloadMap>> {
  return [
    piiChannelGuard as Hook<keyof HookPayloadMap>,
    telemetryObserver as Hook<keyof HookPayloadMap>,
    memorySave as Hook<keyof HookPayloadMap>,
    budgetGuard as Hook<keyof HookPayloadMap>,
  ];
}
```

- [ ] **Step 2: Commit**

```bash
git add services/stage-engine/src/hooks/builtin.ts
git commit -m "feat(stage-engine): add built-in hooks for PII guard, telemetry, budget, memory

Budget guard fully implemented: checks session.max_tokens/max_turns.
PII guard is a stub until tools:selected payload carries channel context.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: Wire Everything into agent-router.ts

This is the integration task — 11 precise edits to `services/stage-engine/src/core/agent-router.ts`.

**Current file state:** 161 lines. Key landmarks:
- Lines 9-25: imports
- Lines 27-38: getOpenRouter() helper
- Lines 40-48: AgentRouterInput type
- Lines 59-161: routeAgentMessage() body
- Line 74-76: classifyIntent call uses `{ apiKey: getSecrets().openrouterApiKey ?? undefined }`
- Line 91: authority default is `"read_only"` (not `"suggest"` as plan v1 stated)
- Line 94-100: collectContext() call
- Line 105: priorOnboarding cast to `AgentContext["priorOnboarding"]`
- Line 121: buffered actions format is `a.action`, not `a`
- Line 145: hardcoded `"anthropic/claude-sonnet-4"`

- [ ] **Step 1: Read the current file and verify AI SDK usage field**

Run: Read `services/stage-engine/src/core/agent-router.ts` (full, 161 lines)

Verify the landmarks above match. If the file has changed since plan was written, adjust edits accordingly.

Also verify: AI SDK v6 (`"ai": "^6.0.103"` in package.json) `generateText` returns `result.usage.totalTokens` (number). The plan uses `result.usage?.totalTokens ?? 0`. If the field name is different in the installed version, adjust all 3 occurrences (llm:after hook, appendSessionEvent, tokens_used).

- [ ] **Step 2: Add new imports**

After line 25 (`import type { AgentChatResponse, ConversationTurn } from "../types/agent.js";`), insert:

```typescript
import { appendSessionEvent } from "./event-log.js";
import { resolveModel } from "./model-provider.js";
import type { HookRegistry } from "../hooks/registry.js";
import type { ContextView } from "./context-view.js";
```

- [ ] **Step 3: Extend AgentRouterInput type**

Replace lines 40-48:

old:
```typescript
type AgentRouterInput = {
  message: string;
  sessionId: string;
  workspaceId: string;
  profileId: string;
  userId?: string;
  conversationHistory: ConversationTurn[];
  situation?: Situation;
};
```

new:
```typescript
type AgentRouterInput = {
  message: string;
  sessionId: string;
  workspaceId: string;
  profileId: string;
  userId?: string;
  conversationHistory: ConversationTurn[];
  situation?: Situation;
  hooks: HookRegistry;
  contextView: ContextView;
};
```

- [ ] **Step 4: Replace routeAgentMessage() body**

Replace the entire function body (lines 59-161) with:

```typescript
export async function routeAgentMessage(input: AgentRouterInput): Promise<AgentChatResponse> {
  const {
    message,
    sessionId,
    workspaceId,
    profileId,
    userId,
    conversationHistory,
    situation = "general",
    hooks,
    contextView,
  } = input;

  // Hook: message:received
  const msgResult = await hooks.run("message:received", {
    message,
    sessionId,
    channel: "chat",
  });
  if (msgResult.blocked) {
    return { session_id: sessionId, response: msgResult.reason ?? "Message blocked." };
  }

  // Step 1: Load authority config
  const authorityConfig = await loadAuthorityConfig(workspaceId);

  // Step 2: Classify intent
  const intent = await classifyIntent(message, "", {
    apiKey: getSecrets().openrouterApiKey ?? undefined,
  });

  // Hook: intent:classified
  await hooks.run("intent:classified", { intent, sessionId });

  // Determine situation from intent if not explicitly provided
  const resolvedSituation: Situation =
    situation !== "general"
      ? situation
      : intent.capability === "schedule"
        ? "scheduling"
        : intent.capability === "training"
          ? "training"
          : intent.capability === "operations"
            ? "operations"
            : "general";

  // Determine authority for the matched capability
  const authority = authorityConfig[intent.capability] ?? "read_only";

  // Step 3: Collect context via ContextView (wraps collectContext + sliding window)
  const assembled = await contextView.assemble({
    workspaceId,
    profileId,
    situation: resolvedSituation,
    authority,
    sessionId,
    supabaseAdmin,
    conversationHistory: conversationHistory.map((t) => ({
      role: t.role,
      content: t.content,
    })),
  });
  const ctx = assembled.domainContext;

  // Hook: context:collected
  await hooks.run("context:collected", { context: ctx, sessionId });

  // Step 3b: Inject prior onboarding context (Lise -> Botsson handoff)
  const onboardingCtx = await loadOnboardingContext(profileId, workspaceId);
  if (onboardingCtx) {
    ctx.priorOnboarding = onboardingCtx.prior_onboarding as AgentContext["priorOnboarding"];
  }

  // Step 4: Select tools based on intent + authority
  const selectedTools = selectTools(intent, authorityConfig);

  // Hook: tools:selected
  await hooks.run("tools:selected", { tools: selectedTools, intent });

  // Step 5: Build posture-aware system prompt
  const systemPrompt = buildBotssonPromptFromContext(
    ctx,
    selectedTools.map((t) => `${t.name}: ${t.description}`),
  );

  // Inject buffered user actions from WebSocket into the message
  const bufferedActions = getBufferedActions(sessionId);
  let augmentedMessage = message;
  if (bufferedActions.length > 0) {
    const actionSummary = bufferedActions.map((a) => JSON.stringify(a.action)).join(", ");
    augmentedMessage = `[UI events since last turn: ${actionSummary}]\n\n${message}`;
  }

  // Build conversation messages — use sliding window from ContextView
  const messages = assembled.recentTurns.map((turn) => ({
    role: turn.role as "user" | "assistant",
    content: turn.content,
  }));
  messages.push({ role: "user", content: augmentedMessage });

  // Add older context pointer if present
  const llmSystemPrompt = assembled.olderContextPointer
    ? `${systemPrompt}\n\n${assembled.olderContextPointer}`
    : systemPrompt;

  // Hook: llm:before (includes sessionId for budget guard)
  const beforeResult = await hooks.run("llm:before", {
    systemPrompt: llmSystemPrompt,
    tools: {},
    messages,
    sessionId,
  });
  if (beforeResult.blocked) {
    return { session_id: sessionId, response: beforeResult.reason ?? "Request blocked." };
  }

  // IMPORTANT: Use beforeResult.payload (not llmSystemPrompt/messages directly)
  // because transform hooks may have mutated the payload in-place.
  // Step 6: Run LLM with tools
  const toolContext = {
    workspaceId,
    profileId,
    userId,
    sessionId,
    supabaseAdmin,
    broadcast: (event: unknown) => broadcastToSession(sessionId, event as MissionProtocolMessage),
  };

  const vercelTools = toVercelTools(selectedTools, toolContext);

  const result = await generateText({
    model: getOpenRouter()(resolveModel({ sessionType: "chat" })),
    system: beforeResult.payload.systemPrompt,
    messages: beforeResult.payload.messages as Array<{ role: "user" | "assistant"; content: string }>,
    tools: vercelTools,
    stopWhen: stepCountIs(5),
  });

  // Hook: llm:after (fire-and-forget for telemetry — no await)
  hooks.run("llm:after", {
    result,
    sessionId,
    tokensUsed: result.usage?.totalTokens ?? 0,
  });

  // Append event to session log (fire-and-forget — no await)
  appendSessionEvent({
    sessionId,
    workspaceId,
    eventType: "agent_response",
    payload: {
      intent: intent.capability,
      confidence: intent.confidence,
      tokens_used: result.usage?.totalTokens ?? 0,
    },
  });

  // Step 7: Return response
  return {
    session_id: sessionId,
    response: result.text,
    intent: {
      capability: intent.capability,
      confidence: intent.confidence,
    },
  };
}
```

Key differences from original:
1. Destructures `hooks` and `contextView` from input
2. `message:received` hook before anything — blocks return early
3. `intent:classified` hook after classifyIntent
4. `contextView.assemble()` replaces direct `collectContext()` call
5. `context:collected` hook after assembly
6. `tools:selected` hook after selectTools
7. Messages built from `assembled.recentTurns` (sliding window) instead of full `conversationHistory`
8. `assembled.olderContextPointer` appended to system prompt
9. `llm:before` hook with sessionId — blocks return early
10. `resolveModel()` replaces hardcoded model string
11. `llm:after` hook (fire-and-forget, no await)
12. `appendSessionEvent()` (fire-and-forget, no await)
13. Uses `beforeResult.payload.systemPrompt` and `beforeResult.payload.messages` (post-transform)

All preserved behaviors: authority loading, situation resolution, onboarding injection, buffered actions format (`a.action`), authority default (`"read_only"`).

- [ ] **Step 5: Run existing tests**

Run: `cd services/stage-engine && npx vitest run`
Expected: admin-router tests should still pass (separate function). If other tests import `routeAgentMessage`, they'll need `hooks` and `contextView` params added to their mocks.

- [ ] **Step 6: Commit**

```bash
git add services/stage-engine/src/core/agent-router.ts
git commit -m "feat(stage-engine): wire hooks, context view, model provider into agent router

Adds 7 hook call sites to routeAgentMessage():
message:received, intent:classified, context:collected, tools:selected,
llm:before, llm:after, session:completing. Uses ContextView for sliding
window, resolveModel() for model string, appendSessionEvent() for logging.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 10: Wire SessionLane into chat.ts

**Files:**
- Modify: `services/stage-engine/src/routes/agent/chat.ts`

**Current file state:** 153 lines. Key landmarks:
- Line 25: `const agentChat = new Hono<{ Variables: { auth: AuthContext } }>();`
- Lines 38-151: POST handler
- Lines 54-101: session loading/creation (sessionId determined by line 101)
- Lines 103-109: append user turn
- Lines 111-118: emit guardian event
- Lines 120-128: routeAgentMessage call
- Lines 130-136: append assistant turn
- Lines 138-148: emit assistant guardian event
- Line 150: return `c.json(response, 200)`

- [ ] **Step 1: Read the current file**

Run: Read `services/stage-engine/src/routes/agent/chat.ts` (full, 153 lines)

- [ ] **Step 2: Add imports**

After line 22 (`import type { AuthContext } from "../../types/auth.js";`), add:

```typescript
import type { SessionLane } from "../../core/session-lane.js";
import type { HookRegistry } from "../../hooks/registry.js";
import type { ContextView } from "../../core/context-view.js";
```

- [ ] **Step 3: Update Hono generic type**

Replace line 25:

old:
```typescript
const agentChat = new Hono<{ Variables: { auth: AuthContext } }>();
```

new:
```typescript
const agentChat = new Hono<{
  Variables: {
    auth: AuthContext;
    sessionLane: SessionLane;
    hookRegistry: HookRegistry;
    contextView: ContextView;
  };
}>();
```

- [ ] **Step 4: Wrap handler body in sessionLane.run() and pass hooks**

After `sessionId = session.id;` (line 100) and the closing `}` of the if/else block (line 101), wrap everything from line 103 to 150 in the lane.

**Scope note:** `conversationHistory` is declared at line 56 (`let conversationHistory: ConversationTurn[] = []`) and populated inside the if/else block (line 83: `getConversationHistory(result.session)` or stays `[]` for new sessions). It is already in scope for the lane callback — do NOT re-declare or move it.

Replace lines 103-150 with:

```typescript
  // All session-mutating operations MUST be inside lane.run() to serialize
  // concurrent requests for the same session.
  const lane = c.get("sessionLane");
  return await lane.run(sessionId, async () => {
    // Append user turn
    const userTurn: ConversationTurn = {
      role: "user",
      content: body.message,
      timestamp: new Date().toISOString(),
    };
    await appendConversationTurn(sessionId, userTurn);

    emitGuardianEvent({
      session_id: sessionId,
      workspace_id: workspaceId,
      event_type: "user.message",
      actor: "user",
      summary: body.message.length > 100 ? body.message.slice(0, 100) + "\u2026" : body.message,
      data: { text: body.message, channel: body.channel },
    });

    // Route message through agent pipeline (with hooks and context view)
    const response = await routeAgentMessage({
      message: body.message,
      sessionId,
      workspaceId,
      profileId: body.profile_id,
      userId: auth.userId,
      conversationHistory,
      hooks: c.get("hookRegistry"),
      contextView: c.get("contextView"),
    });

    // Append assistant turn
    const assistantTurn: ConversationTurn = {
      role: "assistant",
      content: response.response,
      timestamp: new Date().toISOString(),
    };
    await appendConversationTurn(sessionId, assistantTurn);

    emitGuardianEvent({
      session_id: sessionId,
      workspace_id: workspaceId,
      event_type: "agent.response",
      actor: "agent",
      summary:
        response.response.length > 100
          ? response.response.slice(0, 100) + "\u2026"
          : response.response,
      data: { text: response.response, intent: response.intent },
    });

    return c.json(response, 200);
  });
```

The `return c.json(response, 200)` at line 150 is now inside the lane callback. The handler returns the lane's result directly.

- [ ] **Step 5: Run tests**

Run: `cd services/stage-engine && npx vitest run`

- [ ] **Step 6: Commit**

```bash
git add services/stage-engine/src/routes/agent/chat.ts
git commit -m "feat(stage-engine): wrap chat handler in SessionLane, pass hooks to router

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 11: Wire Everything in index.ts

**Files:**
- Modify: `services/stage-engine/src/index.ts`

**Current file state:** 170 lines. Key landmarks:
- Lines 9-31: imports
- Line 34: `await loadSecrets();`
- Line 36: `const app = new Hono();`
- Lines 42-49: middleware (logger, ws skip, telegram skip, authMiddleware)

- [ ] **Step 1: Read the current file**

Run: Read `services/stage-engine/src/index.ts` (full, 170 lines)

- [ ] **Step 2: Add imports**

After line 31 (`import { relayToTelegram } from "./core/telegram-bridge.js";`), add:

```typescript
import { HookRegistry } from "./hooks/registry.js";
import { getBuiltinHooks } from "./hooks/builtin.js";
import { SessionLane } from "./core/session-lane.js";
import { ContextView } from "./core/context-view.js";
import type { AuthContext } from "./types/auth.js";
```

- [ ] **Step 3: Initialize harness components**

After `await loadSecrets();` (line 34), add:

```typescript
// Agent Harness — instantiate core components
const hookRegistry = new HookRegistry();
for (const hook of getBuiltinHooks()) hookRegistry.register(hook);
const sessionLane = new SessionLane();
const contextView = new ContextView();
```

- [ ] **Step 4: Update Hono app type and inject middleware**

Replace line 36:

old:
```typescript
const app = new Hono();
```

new:
```typescript
type AppVariables = {
  auth: AuthContext;
  sessionLane: SessionLane;
  hookRegistry: HookRegistry;
  contextView: ContextView;
};
const app = new Hono<{ Variables: AppVariables }>();
```

After `app.use("*", authMiddleware);` (line 49), add:

```typescript
// Inject harness components into Hono context for route handlers
app.use("*", async (c, next) => {
  c.set("sessionLane", sessionLane);
  c.set("hookRegistry", hookRegistry);
  c.set("contextView", contextView);
  await next();
});
```

- [ ] **Step 5: Verify startup**

Run: `cd services/stage-engine && npx tsx src/index.ts`
Expected: "Stage Engine running on port 5010". Ctrl+C after confirming.
If env vars are missing, that's expected in dev — check for TypeScript/import errors only.

- [ ] **Step 6: Run all tests**

Run: `cd services/stage-engine && npx vitest run`

- [ ] **Step 7: Commit**

```bash
git add services/stage-engine/src/index.ts
git commit -m "feat(stage-engine): initialize harness components at startup

Instantiates HookRegistry (with built-in hooks), SessionLane, and
ContextView at startup. Typed Hono app variables. Injects via middleware.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 12: Register Telemetry Events

**Files:**
- Modify: `packages/telemetry/src/registry.ts`

Phase 1 registers 4 events. The 3 subagent events (`agent.subagent_spawned`, `agent.subagent_completed`, `agent.subagent_failed`) are deferred to Phase 2 when the delegation mechanism ships.

- [ ] **Step 1: Find the agent events section**

Run: `grep -n "agent\." packages/telemetry/src/registry.ts | head -20`

- [ ] **Step 2: Add 4 new event interfaces**

Add after the existing agent event interfaces:

```typescript
// Agent Harness events (Phase 1). Subagent events (spawned/completed/failed) deferred to Phase 2.
export interface AgentHookBlocked extends BaseEvent {
  event: "agent.hook_blocked";
  properties: { hook_name: string; hook_type: string; reason: string; session_id: string };
}
export interface AgentContextWindowTruncated extends BaseEvent {
  event: "agent.context_window_truncated";
  properties: { session_id: string; dropped_fragments: number; token_budget: number };
}
export interface AgentBudgetExhausted extends BaseEvent {
  event: "agent.budget_exhausted";
  properties: { session_id: string; total_tokens: number; max_tokens: number | null; total_turns: number; max_turns: number | null };
}
export interface AgentTokensUsed extends BaseEvent {
  event: "agent.tokens_used";
  properties: { session_id: string; model: string; input_tokens: number; output_tokens: number; total_tokens: number; source: string };
}
```

- [ ] **Step 3: Add EventMeta entries**

Find the event metadata map and add:

```typescript
"agent.hook_blocked": { destinations: ["posthog", "activity_trail"], category: "agent" },
"agent.context_window_truncated": { destinations: ["posthog"], category: "agent" },
"agent.budget_exhausted": { destinations: ["posthog", "activity_trail"], category: "agent" },
"agent.tokens_used": { destinations: ["posthog"], category: "agent" },
```

- [ ] **Step 4: Run typecheck**

Run: `pnpm turbo typecheck --filter=@smartout/telemetry`

- [ ] **Step 5: Commit**

```bash
git add packages/telemetry/src/registry.ts
git commit -m "feat(telemetry): register 4 agent harness events (Phase 1)

Adds agent.hook_blocked, agent.context_window_truncated,
agent.budget_exhausted, agent.tokens_used. Subagent events deferred to Phase 2.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 13: Full Integration Verification

- [ ] **Step 1: Run all stage-engine tests**

Run: `cd services/stage-engine && npx vitest run`

- [ ] **Step 2: Run monorepo typecheck**

Run: `pnpm turbo typecheck`

- [ ] **Step 3: Run monorepo lint**

Run: `pnpm lint`

- [ ] **Step 4: Fix any issues**

Common issues to check:
- Import paths missing `.js` extension (ESM requires it)
- Type mismatches between HookPayloadMap and actual usage
- Supabase mock shapes in existing tests
- `result.usage?.totalTokens` was already verified in Task 9 Step 1 (AI SDK v6, correct field name)

- [ ] **Step 5: Final commit if fixes needed**

```bash
git add -A
git commit -m "fix(stage-engine): resolve typecheck and lint issues from harness integration

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 14: Write ADR

**Files:**
- Create: `docs/decisions/XXXX-agent-harness-foundation.md` (where XXXX = next sequential number)
- Modify: `docs/decisions/0000-decision-log.md`

- [ ] **Step 0: Determine next ADR number**

Run: `ls docs/decisions/ | grep -E "^[0-9]{4}" | sort -r | head -3`
Use the next sequential number after the highest existing one.

- [ ] **Step 1: Write the ADR using template at `docs/templates/decision.md`**

- **Status:** Accepted
- **Context:** Stage Engine needs hook interception, context management, session durability, and token tracking to evolve from simple agent router to full harness.
- **Decision:** Adopt Anthropic Brain/Hands/Session architecture with 7 pipeline hooks, sliding-window Context View (no compaction), append-only session event log, centralized model provider, SessionLane, token logging.
- **Consequences:** All agent-mode LLM calls go through hooks. Model strings centralized. Token usage tracked. Session state recoverable. Phase 2/3 build on this.

- [ ] **Step 2: Register in decision log**

Add entry to `docs/decisions/0000-decision-log.md`.

- [ ] **Step 3: Commit**

```bash
git add docs/decisions/
git commit -m "docs(decisions): add ADR for Agent Harness Foundation

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Dependency Graph

```
Task 1 (migration)           — no deps
Task 2 (hook registry)       — no deps
Task 3 (model provider)      — no deps
Task 4 (session lane)        — no deps
Task 5 (event log)           — needs Task 1
Task 6 (context view)        — needs Task 5
Task 7 (session events tool) — needs Task 5
Task 8 (builtin hooks)       — needs Task 2
Task 9 (agent-router wiring) — needs Tasks 2, 3, 5, 6
Task 10+11 (chat.ts + index.ts) — needs Tasks 2, 4, 6, 8, 9 (co-dependent, do together)
Task 12 (telemetry events)   — no deps
Task 13 (verification)       — needs all previous
Task 14 (ADR)                — best after Task 13
```

**Co-dependency note:** Task 10 (chat.ts) consumes `c.get("hookRegistry")` etc., which requires Task 11 (index.ts) to set them on Hono context. Task 11 defines the `AppVariables` type that Task 10's Hono generic uses. They are two sides of the same coin — **execute Task 11 first** (injection), then Task 10 (consumption), or do them in a single commit.

**Parallelizable waves:**
- **Wave 1:** Tasks 1, 2, 3, 4, 12 (all independent)
- **Wave 2:** Tasks 5, 8 (depend on Wave 1)
- **Wave 3:** Tasks 6, 7 (depend on Task 5)
- **Wave 4:** Task 9 first, then Tasks 10+11 together (integration)
- **Wave 5:** Task 13 (verification)
- **Wave 6:** Task 14 (ADR)
