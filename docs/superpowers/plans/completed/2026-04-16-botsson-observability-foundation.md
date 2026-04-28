---
title: Botsson Observability Foundation — P0 Implementation Plan
status: ready
created: 2026-04-16
updated: 2026-04-16
module: ai-agent
tags: [botsson, stage-engine, telemetry, observability, logging, pg-notify]
---

# Botsson Observability Foundation — P0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Botsson's runtime observable, debuggable, and honest. Replace `console.*` with structured logger + requestId, wire Sentry, auto-emit telemetry from every tool invocation, replace in-process guardian-bus with pg `LISTEN/NOTIFY`, clean up authority double-decision, and expose a Health Ribbon endpoint.

**Architecture:** Two substrate layers first (logger + typed errors), then one adapter change (`toVercelTools`) auto-instruments all 14 capabilities. Guardian-bus moves from in-process `Set` to Postgres `LISTEN/NOTIFY` on `activity_trail` (pattern already exists for Telegram bridge in `stage-engine/src/index.ts:91-138`). Authority downgrade stops being re-derived post-`gate_action`.

**Tech Stack:** Hono, pino (new), @sentry/node (new), `@smartout/telemetry` (existing, currently unused by stage-engine), `@openrouter/ai-sdk-provider`, Vercel AI SDK, Supabase Postgres 17 with `pg_notify`.

**Source:** Council review 2026-04-16 (`docs/council/COUNCIL-LOG.md`), supersedes parts of `docs/superpowers/specs/2026-04-09-agent-harness-foundation-design.md` (see spec status header). Six P0 items bundled because they must land together before Agent Trust Gate unblocks new capabilities.

**Out of scope (deferred to P1/P2 per council):**
- Haiku classifier swap (P1, needs eval-harness baseline)
- `loadRecentMemories()` wiring into router (P1)
- Turn N-5 summarizer (P1)
- `engine_session_event` projection (P2)
- Ultravox voice→activity_trail parity (P2)
- Diagnostic Drawer UI (P2)

**Risk gates before merge:**
1. Verify `activity_trail` partitioning and retention before Phase 3 lands (4-5× write volume increase expected).
2. Feature-flag the guardian-bus→pg_notify cutover (Phase 5) for 1-week dual-write window.
3. Do NOT drop `guardian_log` writes yet — backwards compat until P2 decides the audit↔replay split.

---

## File Structure

**New files:**
- `services/stage-engine/src/lib/logger.ts` — pino instance + requestId-bound child logger
- `services/stage-engine/src/lib/errors.ts` — `StageEngineError` base + 5 typed subclasses
- `services/stage-engine/src/lib/sentry.ts` — Sentry init + `captureWithContext()` helper
- `services/stage-engine/src/middleware/request-id.ts` — generates UUID, sets on Hono context, adds `x-request-id` response header
- `services/stage-engine/src/core/pg-notify-bus.ts` — replaces `guardian-bus.ts` (in-process Set → pg LISTEN)
- `services/stage-engine/src/routes/metrics.ts` — `GET /metrics/health` for Health Ribbon
- `services/stage-engine/src/__tests__/telemetry-adapter.test.ts` — integration test: tool call → activity_trail row
- `supabase/migrations/20260416120000_activity_trail_pg_notify.sql` — AFTER INSERT trigger → `pg_notify('botsson_events', …)`
- `docs/decisions/0084-guardian-bus-pg-listen-notify.md` — ADR
- `docs/decisions/0087-runtime-telemetry-standard.md` — ADR (governance doc for the rest)

**Modified files:**
- `services/stage-engine/src/index.ts` — init Sentry, mount requestId middleware, register metrics route, swap guardian-bus import
- `services/stage-engine/src/middleware/error-handler.ts` — use logger + Sentry, tag `requestId` + `session_id` + `workspace_id`
- `services/stage-engine/src/core/agent-router.ts` — use logger, typed errors around `gate_action`, drop `applyMinRoleDowngrade`, use `gate.downgrade_to` for matched capability only
- `services/stage-engine/src/routes/agent/chat.ts` — replace `emitGuardianEvent()` with `emit()` from `@smartout/telemetry`
- `packages/ai/src/adapters/vercel-ai.ts` — wrap `execute` with auto-emit + latency measurement
- `packages/telemetry/src/registry.ts` — register 6 new `botsson.*` + `agent.*` events
- `services/stage-engine/package.json` — add `pino`, `@sentry/node`, remove unused deps if any
- `services/stage-engine/src/core/{session-manager,guardian-evaluator,calendar-guardian,stage-manager}.ts` — replace `console.*` with logger (scoped per task)

**Deleted files (end of Phase 5, cutover complete):**
- `services/stage-engine/src/core/guardian-bus.ts` — replaced by pg-notify-bus.ts

---

## Phase 0: ADR-0087 — Runtime Telemetry Standard

Governance first. This ADR anchors every later decision.

### Task 0.1: Write ADR-0087

**Files:**
- Create: `docs/decisions/0087-runtime-telemetry-standard.md`

- [ ] **Step 1: Copy template**

```bash
cp /home/sxtnl/dev/smartout.ai/docs/templates/decision.md \
   /home/sxtnl/dev/smartout.ai/docs/decisions/0087-runtime-telemetry-standard.md
```

- [ ] **Step 2: Fill ADR**

Replace template with:

```markdown
---
title: ADR-0087 — Runtime Telemetry Standard for services/
status: accepted
created: 2026-04-16
updated: 2026-04-16
module: observability
tags: [adr, telemetry, logging, runtime]
---

# ADR-0087 — Runtime Telemetry Standard for services/

## Context

Council review 2026-04-16 found stage-engine has **0** imports of `@smartout/telemetry`, 64 `console.*` calls, no requestId propagation, no Sentry wiring, and 11 of 14 capabilities missing `emit()`. The runtime is the largest mutation surface in the system and is currently exempt from the "no mutation without emit" law.

## Decision

Every service under `services/` MUST adopt the following four primitives:

1. **Structured logger** — pino instance with JSON output. One line per event. Required fields: `requestId`, `service`, `level`, `time`, `msg`. Context-bound via Hono per-request child logger.

2. **requestId middleware** — UUID generated at request entry, set on Hono context, propagated to every supabase call, every `emit()` payload (via `correlation_id` field already in `BaseEvent`), and every log line. Response header `x-request-id` returned to clients.

3. **Typed errors** — `StageEngineError` base with `code`, `httpStatus`, `context`. Concrete subclasses: `AuthorityDenied`, `ToolFailure`, `ClassifierTimeout`, `SchemaCacheStale`, `GateActionFailed`. Error handler maps `code` → `httpStatus`, logs with full context, reports to Sentry for `>=500`.

4. **Mandatory `emit()`** — every capability tool invocation emits `botsson.tool_invoked` with `{ capability, tool, latency_ms, success, requestId }`. Auto-emitted via `toVercelTools` adapter. Individual capabilities never call `emit()` manually for tool-invocation telemetry — only for domain events.

## Consequences

**Positive:** Observable runtime. Root-cause-able 500s. Cost/latency per capability becomes queryable. C4 authority decisions auditable via `gate_evaluation_id` correlation.

**Negative:** 4-5× write volume to `activity_trail` in the first month. Must verify partitioning and retention before Phase 3 of the Botsson Observability Foundation plan lands.

**Neutral:** `emitGuardianEvent()` deprecated but not removed in P0. Removed in P2 when `engine_session_event` projection ships (see ADR-0085 when written).

## Scope

Applies to all services under `services/` — `stage-engine`, `contract-service`, `shift-mcp`, `interview-mcp`, `scrapling` (if/when migrated from Python). This ADR does NOT mandate retroactive rewrite — only new code and code touched by the Botsson Observability Foundation plan.

## Related

- Supersedes in spirit parts of ADR-0083 (engine_session_event as own emitter — see ADR-0085 when written)
- Closes observability gaps identified in Council 2026-04-16
- Learning 0034: "A capability without emit() is invisible to the cascade"
```

- [ ] **Step 3: Register ADR**

Append one line to `docs/decisions/0000-decision-log.md`:

```markdown
| 0087 | Runtime Telemetry Standard for services/ | accepted | 2026-04-16 | Every service: pino logger, requestId middleware, typed errors, mandatory emit() via toVercelTools adapter. |
```

- [ ] **Step 4: Commit**

```bash
cd /home/sxtnl/dev/smartout.ai
git add docs/decisions/0087-runtime-telemetry-standard.md docs/decisions/0000-decision-log.md
git commit -m "$(cat <<'EOF'
docs(adr): ADR-0087 runtime telemetry standard for services/

Anchors Botsson Observability Foundation work. Mandates pino logger,
requestId middleware, typed errors, and auto-emit via toVercelTools
adapter for all services under services/.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 1: Observability Substrate

### Task 1.1: Install dependencies in stage-engine

**Files:**
- Modify: `services/stage-engine/package.json`

- [ ] **Step 1: Add pino + Sentry**

```bash
cd /home/sxtnl/dev/smartout.ai/services/stage-engine
pnpm add pino pino-pretty @sentry/node
```

Expected: `pino@^9`, `@sentry/node@^8`, `pino-pretty@^11` added to dependencies.

- [ ] **Step 2: Verify install**

```bash
cd /home/sxtnl/dev/smartout.ai
pnpm turbo build --filter=stage-engine
```

Expected: build succeeds, no missing-dep errors.

- [ ] **Step 3: Commit**

```bash
git add services/stage-engine/package.json pnpm-lock.yaml
git commit -m "chore(stage-engine): add pino + @sentry/node for telemetry substrate

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

### Task 1.2: Create logger module

**Files:**
- Create: `services/stage-engine/src/lib/logger.ts`
- Test: `services/stage-engine/src/lib/__tests__/logger.test.ts`

- [ ] **Step 1: Write failing test**

```ts
// services/stage-engine/src/lib/__tests__/logger.test.ts
import { describe, it, expect, vi } from "vitest";
import { baseLogger, childLogger } from "../logger.js";

describe("logger", () => {
  it("baseLogger exposes info/warn/error methods", () => {
    expect(typeof baseLogger.info).toBe("function");
    expect(typeof baseLogger.warn).toBe("function");
    expect(typeof baseLogger.error).toBe("function");
  });

  it("childLogger binds requestId to every log line", () => {
    const spy = vi.spyOn(process.stdout, "write");
    const log = childLogger({ requestId: "req_abc123" });
    log.info("hello");
    const output = spy.mock.calls.map((c) => String(c[0])).join("");
    expect(output).toContain("req_abc123");
    spy.mockRestore();
  });
});
```

- [ ] **Step 2: Run — expect fail**

```bash
cd /home/sxtnl/dev/smartout.ai
pnpm --filter stage-engine test logger
```

Expected: FAIL — `Cannot find module '../logger.js'`.

- [ ] **Step 3: Implement logger**

```ts
// services/stage-engine/src/lib/logger.ts
import pino from "pino";

const isDev = process.env.NODE_ENV !== "production";

export const baseLogger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  base: { service: "stage-engine" },
  ...(isDev
    ? { transport: { target: "pino-pretty", options: { colorize: true, translateTime: "HH:MM:ss" } } }
    : {}),
});

export type LogContext = {
  requestId?: string;
  sessionId?: string;
  workspaceId?: string;
  profileId?: string;
};

export function childLogger(ctx: LogContext) {
  return baseLogger.child(ctx);
}
```

- [ ] **Step 4: Run — expect pass**

```bash
pnpm --filter stage-engine test logger
```

Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add services/stage-engine/src/lib/logger.ts services/stage-engine/src/lib/__tests__/logger.test.ts
git commit -m "feat(stage-engine): pino logger with context-bound children

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

### Task 1.3: Create requestId middleware

**Files:**
- Create: `services/stage-engine/src/middleware/request-id.ts`
- Test: `services/stage-engine/src/middleware/__tests__/request-id.test.ts`

- [ ] **Step 1: Write failing test**

```ts
// services/stage-engine/src/middleware/__tests__/request-id.test.ts
import { describe, it, expect } from "vitest";
import { Hono } from "hono";
import { requestIdMiddleware } from "../request-id.js";

describe("requestIdMiddleware", () => {
  it("sets x-request-id header and context var", async () => {
    const app = new Hono();
    app.use(requestIdMiddleware);
    app.get("/", (c) => c.text(c.get("requestId" as never) as string));
    const res = await app.request("/");
    const body = await res.text();
    expect(body).toMatch(/^[0-9a-f-]{36}$/);
    expect(res.headers.get("x-request-id")).toBe(body);
  });

  it("honors incoming x-request-id header", async () => {
    const app = new Hono();
    app.use(requestIdMiddleware);
    app.get("/", (c) => c.text(c.get("requestId" as never) as string));
    const res = await app.request("/", { headers: { "x-request-id": "req_incoming" } });
    expect(await res.text()).toBe("req_incoming");
    expect(res.headers.get("x-request-id")).toBe("req_incoming");
  });
});
```

- [ ] **Step 2: Run — expect fail**

```bash
pnpm --filter stage-engine test request-id
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement middleware**

```ts
// services/stage-engine/src/middleware/request-id.ts
import type { MiddlewareHandler } from "hono";
import { randomUUID } from "node:crypto";

export const requestIdMiddleware: MiddlewareHandler = async (c, next) => {
  const incoming = c.req.header("x-request-id");
  const requestId = incoming && incoming.length < 200 ? incoming : randomUUID();
  c.set("requestId" as never, requestId);
  c.header("x-request-id", requestId);
  await next();
};
```

- [ ] **Step 4: Run — expect pass**

```bash
pnpm --filter stage-engine test request-id
```

Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add services/stage-engine/src/middleware/request-id.ts services/stage-engine/src/middleware/__tests__/request-id.test.ts
git commit -m "feat(stage-engine): request-id middleware honours inbound header

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

### Task 1.4: Wire Sentry

**Files:**
- Create: `services/stage-engine/src/lib/sentry.ts`

- [ ] **Step 1: Create Sentry module**

```ts
// services/stage-engine/src/lib/sentry.ts
import * as Sentry from "@sentry/node";
import { baseLogger } from "./logger.js";

let initialized = false;

export function initSentry(): void {
  if (initialized) return;
  const dsn = process.env.SENTRY_DSN_STAGE_ENGINE;
  if (!dsn) {
    baseLogger.warn("SENTRY_DSN_STAGE_ENGINE not set — Sentry disabled");
    return;
  }
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV ?? "development",
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 0,
    release: process.env.STAGE_ENGINE_RELEASE,
  });
  initialized = true;
  baseLogger.info("Sentry initialized");
}

export function captureWithContext(err: unknown, ctx: Record<string, unknown>): void {
  if (!initialized) return;
  Sentry.withScope((scope) => {
    for (const [k, v] of Object.entries(ctx)) {
      scope.setTag(k, String(v));
    }
    Sentry.captureException(err);
  });
}
```

- [ ] **Step 2: Add env var to template**

```bash
grep -q SENTRY_DSN_STAGE_ENGINE /home/sxtnl/dev/smartout.ai/.env.template || \
  echo 'SENTRY_DSN_STAGE_ENGINE=op://smartout_ai/sentry/stage-engine-dsn' >> /home/sxtnl/dev/smartout.ai/.env.template
```

- [ ] **Step 3: Commit**

```bash
cd /home/sxtnl/dev/smartout.ai
git add services/stage-engine/src/lib/sentry.ts .env.template
git commit -m "feat(stage-engine): Sentry init + captureWithContext helper

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

### Task 1.5: Mount middleware + Sentry in index.ts

**Files:**
- Modify: `services/stage-engine/src/index.ts:40-60`

- [ ] **Step 1: Add imports + init calls**

Edit `services/stage-engine/src/index.ts`. Add after existing imports (around line 32):

```ts
import { initSentry } from "./lib/sentry.js";
import { requestIdMiddleware } from "./middleware/request-id.js";
import { baseLogger } from "./lib/logger.js";
```

Remove the `import { logger } from "hono/logger";` line (Hono's default logger is replaced by pino).

After `await loadSecrets();` (line 35), add:

```ts
initSentry();
```

Replace the `app.use(logger());` call with:

```ts
app.use(requestIdMiddleware);
```

Replace the `console.log(`Stage Engine running on port ${info.port}`);` with:

```ts
baseLogger.info({ port: info.port }, "Stage Engine running");
```

- [ ] **Step 2: Build + start locally**

```bash
cd /home/sxtnl/dev/smartout.ai
pnpm --filter stage-engine build
op run --env-file=services/stage-engine/.env.template -- node services/stage-engine/dist/index.js &
sleep 2
curl -s -i http://localhost:5010/health | grep -i x-request-id
kill %1
```

Expected: response contains `x-request-id: <uuid>` header.

- [ ] **Step 3: Commit**

```bash
git add services/stage-engine/src/index.ts
git commit -m "feat(stage-engine): mount requestId middleware and Sentry

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

### Task 1.6: Replace error-handler.ts

**Files:**
- Modify: `services/stage-engine/src/middleware/error-handler.ts`

- [ ] **Step 1: Rewrite error handler**

Replace entire file content with:

```ts
import type { Context } from "hono";
import type { ErrorResponse } from "../types/api.js";
import { StageEngineError } from "../lib/errors.js";
import { childLogger } from "../lib/logger.js";
import { captureWithContext } from "../lib/sentry.js";

export function onError(err: Error, c: Context): Response {
  const requestId = (c.get("requestId" as never) as string | undefined) ?? "unknown";
  const log = childLogger({ requestId });

  if (err instanceof StageEngineError) {
    log.warn(
      { code: err.code, httpStatus: err.httpStatus, ctx: err.context, method: c.req.method, path: c.req.path },
      err.message,
    );
    if (err.httpStatus >= 500) captureWithContext(err, { code: err.code, requestId });
    return c.json<ErrorResponse>(
      { error: err.code, message: err.message, status: err.httpStatus },
      err.httpStatus as never,
    );
  }

  log.error({ err: { message: err.message, stack: err.stack }, method: c.req.method, path: c.req.path }, "unhandled error");
  captureWithContext(err, { requestId });
  return c.json<ErrorResponse>(
    { error: "INTERNAL_ERROR", message: "An unexpected error occurred", status: 500 },
    500,
  );
}
```

Note: `StageEngineError` comes in Task 2.1. Typecheck will fail until then — OK for now, typecheck runs in Task 2 finish.

- [ ] **Step 2: Commit (typecheck intentionally deferred)**

```bash
git add services/stage-engine/src/middleware/error-handler.ts
git commit -m "refactor(stage-engine): structured error handler with Sentry

Depends on Task 2.1 (StageEngineError) for full typecheck.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Phase 2: Typed Errors

### Task 2.1: Create error classes

**Files:**
- Create: `services/stage-engine/src/lib/errors.ts`
- Test: `services/stage-engine/src/lib/__tests__/errors.test.ts`

- [ ] **Step 1: Write failing test**

```ts
// services/stage-engine/src/lib/__tests__/errors.test.ts
import { describe, it, expect } from "vitest";
import {
  StageEngineError,
  AuthorityDenied,
  ToolFailure,
  ClassifierTimeout,
  SchemaCacheStale,
  GateActionFailed,
} from "../errors.js";

describe("errors", () => {
  it("AuthorityDenied has code + 403", () => {
    const e = new AuthorityDenied("blocked", { capability: "contract" });
    expect(e).toBeInstanceOf(StageEngineError);
    expect(e.code).toBe("AUTHORITY_DENIED");
    expect(e.httpStatus).toBe(403);
    expect(e.context).toEqual({ capability: "contract" });
  });

  it("ToolFailure has code + 500", () => {
    const e = new ToolFailure("oops", { tool: "search_profiles" });
    expect(e.code).toBe("TOOL_FAILURE");
    expect(e.httpStatus).toBe(500);
  });

  it("ClassifierTimeout is 504", () => {
    expect(new ClassifierTimeout("timeout").httpStatus).toBe(504);
  });

  it("SchemaCacheStale is 503 + retryable flag", () => {
    const e = new SchemaCacheStale("PGRST002");
    expect(e.httpStatus).toBe(503);
    expect(e.retryable).toBe(true);
  });

  it("GateActionFailed is 502", () => {
    expect(new GateActionFailed("rpc down").httpStatus).toBe(502);
  });
});
```

- [ ] **Step 2: Run — expect fail**

```bash
pnpm --filter stage-engine test errors
```

Expected: FAIL — module missing.

- [ ] **Step 3: Implement errors**

```ts
// services/stage-engine/src/lib/errors.ts
export class StageEngineError extends Error {
  readonly code: string;
  readonly httpStatus: number;
  readonly context?: Record<string, unknown>;

  constructor(code: string, httpStatus: number, message: string, context?: Record<string, unknown>) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.httpStatus = httpStatus;
    this.context = context;
  }
}

export class AuthorityDenied extends StageEngineError {
  constructor(message: string, context?: Record<string, unknown>) {
    super("AUTHORITY_DENIED", 403, message, context);
  }
}

export class ToolFailure extends StageEngineError {
  constructor(message: string, context?: Record<string, unknown>) {
    super("TOOL_FAILURE", 500, message, context);
  }
}

export class ClassifierTimeout extends StageEngineError {
  constructor(message: string, context?: Record<string, unknown>) {
    super("CLASSIFIER_TIMEOUT", 504, message, context);
  }
}

export class SchemaCacheStale extends StageEngineError {
  readonly retryable = true;
  constructor(message: string, context?: Record<string, unknown>) {
    super("SCHEMA_CACHE_STALE", 503, message, context);
  }
}

export class GateActionFailed extends StageEngineError {
  constructor(message: string, context?: Record<string, unknown>) {
    super("GATE_ACTION_FAILED", 502, message, context);
  }
}
```

- [ ] **Step 4: Run — expect pass + typecheck error-handler.ts**

```bash
pnpm --filter stage-engine test errors
pnpm --filter stage-engine typecheck
```

Expected: tests PASS, typecheck PASS (closes Task 1.6 debt).

- [ ] **Step 5: Commit**

```bash
git add services/stage-engine/src/lib/errors.ts services/stage-engine/src/lib/__tests__/errors.test.ts
git commit -m "feat(stage-engine): typed StageEngineError hierarchy (5 subclasses)

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

### Task 2.2: Throw typed errors from agent-router

**Files:**
- Modify: `services/stage-engine/src/core/agent-router.ts:89-114`

- [ ] **Step 1: Wrap gate_action with typed error**

Edit `agent-router.ts`. Replace the `gate_action` block (lines 89-98) with:

```ts
const { data: gateResult, error: gateError } = await supabaseAdmin.rpc("gate_action", {
  p_workspace_id: workspaceId,
  p_capability: intent.capability,
  p_channel: channel ?? "chat",
  p_actor_profile_id: profileId,
  p_action_type: "agent_chat",
});
if (gateError) {
  if (gateError.code === "PGRST002" || /schema cache/i.test(gateError.message)) {
    throw new SchemaCacheStale(`gate_action: ${gateError.message}`, { capability: intent.capability });
  }
  throw new GateActionFailed(`gate_action RPC failed: ${gateError.message}`, {
    capability: intent.capability,
    workspaceId,
  });
}
```

Add imports at top of file:

```ts
import { GateActionFailed, SchemaCacheStale } from "../lib/errors.js";
```

- [ ] **Step 2: Run typecheck + tests**

```bash
pnpm --filter stage-engine typecheck
pnpm --filter stage-engine test
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add services/stage-engine/src/core/agent-router.ts
git commit -m "refactor(stage-engine): throw typed errors from agent-router

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Phase 3: Auto-emit from `toVercelTools` Adapter

### Task 3.1: Register telemetry events

**Files:**
- Modify: `packages/telemetry/src/registry.ts`

- [ ] **Step 1: Find `agent` category section**

```bash
grep -n "category.*agent" /home/sxtnl/dev/smartout.ai/packages/telemetry/src/registry.ts | head -20
```

Locate the block where existing `agent.*` events are defined.

- [ ] **Step 2: Add 6 new events**

Append to the `EVENT_ROUTING` map (find the agent-category block):

```ts
"botsson.turn_started": {
  destinations: ["logger", "activity_trail"],
  category: "agent",
},
"botsson.turn_completed": {
  destinations: ["posthog", "logger", "activity_trail"],
  category: "agent",
},
"botsson.intent_classified": {
  destinations: ["posthog", "activity_trail"],
  category: "agent",
},
"botsson.tool_invoked": {
  destinations: ["posthog", "activity_trail"],
  category: "agent",
},
"botsson.tool_failed": {
  destinations: ["posthog", "logger", "activity_trail"],
  category: "agent",
},
"botsson.step_cap_hit": {
  destinations: ["posthog", "logger", "activity_trail"],
  category: "agent",
},
```

Add corresponding entries to the `SmartoutEvent` discriminated union in the same file. Example shape:

```ts
| {
    event: "botsson.tool_invoked";
    workspace_id: string;
    actor_id: string;
    correlation_id?: string;
    capability: string;
    tool: string;
    latency_ms: number;
    success: boolean;
    session_id: string;
  }
// ... repeat for other 5 events
```

- [ ] **Step 3: Typecheck + build**

```bash
pnpm --filter @smartout/telemetry typecheck
pnpm --filter @smartout/telemetry build
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add packages/telemetry/src/registry.ts
git commit -m "feat(telemetry): register 6 botsson.* runtime events

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

### Task 3.2: Wrap toVercelTools with auto-emit

**Files:**
- Modify: `packages/ai/src/adapters/vercel-ai.ts`
- Test: `packages/ai/src/adapters/__tests__/vercel-ai.test.ts`

- [ ] **Step 1: Write failing test**

```ts
// packages/ai/src/adapters/__tests__/vercel-ai.test.ts
import { describe, it, expect, vi } from "vitest";
import { toVercelTools } from "../vercel-ai.js";
import * as telemetry from "@smartout/telemetry";
import { z } from "zod";

describe("toVercelTools auto-emit", () => {
  it("emits botsson.tool_invoked on success", async () => {
    const emitSpy = vi.spyOn(telemetry, "emit").mockResolvedValue();
    const tools = toVercelTools(
      [{
        name: "test_tool",
        description: "t",
        capability: "schedule",
        schema: z.object({ x: z.number() }),
        execute: async () => "ok",
      }],
      { workspaceId: "w1", profileId: "p1", sessionId: "s1" },
    );
    await tools.test_tool.execute({ x: 1 });
    expect(emitSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "botsson.tool_invoked",
        capability: "schedule",
        tool: "test_tool",
        success: true,
      }),
    );
  });

  it("emits botsson.tool_failed on throw", async () => {
    const emitSpy = vi.spyOn(telemetry, "emit").mockResolvedValue();
    const tools = toVercelTools(
      [{
        name: "bad",
        description: "t",
        capability: "schedule",
        schema: z.object({}),
        execute: async () => { throw new Error("boom"); },
      }],
      { workspaceId: "w1", profileId: "p1", sessionId: "s1" },
    );
    await expect(tools.bad.execute({})).rejects.toThrow("boom");
    expect(emitSpy).toHaveBeenCalledWith(
      expect.objectContaining({ event: "botsson.tool_failed", tool: "bad" }),
    );
  });
});
```

- [ ] **Step 2: Run — expect fail**

```bash
pnpm --filter @smartout/ai test vercel-ai
```

Expected: FAIL — existing adapter does not emit.

- [ ] **Step 3: Rewrite adapter**

Replace `packages/ai/src/adapters/vercel-ai.ts` with:

```ts
// packages/ai/src/adapters/vercel-ai.ts
import { tool } from "ai";
import { emit } from "@smartout/telemetry";
import type { SmartoutTool } from "../types.js";

type EmitContext = {
  workspaceId: string;
  profileId: string;
  sessionId: string;
  requestId?: string;
};

/**
 * Converts SmartoutTool[] to Vercel AI SDK tool format.
 * Auto-emits botsson.tool_invoked / botsson.tool_failed per ADR-0087.
 */
export function toVercelTools<TCtx extends EmitContext>(
  tools: ReadonlyArray<SmartoutTool<TCtx>>,
  ctx: TCtx,
) {
  return Object.fromEntries(
    tools.map((t) => [
      t.name,
      tool({
        description: t.description,
        inputSchema: t.schema,
        execute: async (params) => {
          const start = Date.now();
          try {
            const result = await t.execute(params, ctx);
            await emit({
              event: "botsson.tool_invoked",
              workspace_id: ctx.workspaceId,
              actor_id: ctx.profileId,
              correlation_id: ctx.requestId,
              capability: t.capability ?? "unknown",
              tool: t.name,
              latency_ms: Date.now() - start,
              success: true,
              session_id: ctx.sessionId,
            });
            return result;
          } catch (err) {
            await emit({
              event: "botsson.tool_failed",
              workspace_id: ctx.workspaceId,
              actor_id: ctx.profileId,
              correlation_id: ctx.requestId,
              capability: t.capability ?? "unknown",
              tool: t.name,
              latency_ms: Date.now() - start,
              error_message: err instanceof Error ? err.message : String(err),
              session_id: ctx.sessionId,
            });
            throw err;
          }
        },
      }),
    ]),
  );
}
```

- [ ] **Step 4: Add `capability` field to SmartoutTool type**

Check `packages/ai/src/types.ts` for the `SmartoutTool` definition. Add an optional `capability?: string` field if not present:

```ts
export type SmartoutTool<TCtx = unknown> = {
  name: string;
  description: string;
  capability?: string; // Added for telemetry routing (ADR-0087)
  schema: z.ZodTypeAny;
  execute: (params: unknown, ctx: TCtx) => Promise<unknown>;
};
```

Then in each capability's tool registration file, add `capability` to every tool. Easiest route: scan `packages/ai/src/capabilities/*/tools.ts` and add `capability: "schedule"` (or matching name) to each tool object literal.

- [ ] **Step 5: Run tests — expect pass**

```bash
pnpm --filter @smartout/ai test vercel-ai
pnpm --filter @smartout/ai typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/ai/src/adapters/vercel-ai.ts packages/ai/src/adapters/__tests__/vercel-ai.test.ts packages/ai/src/types.ts packages/ai/src/capabilities/*/tools.ts
git commit -m "feat(ai): auto-emit tool_invoked/tool_failed from toVercelTools adapter

Closes 14 capabilities in one adapter change per ADR-0087.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

### Task 3.3: Integration test — tool call → activity_trail

**Files:**
- Create: `services/stage-engine/src/__tests__/telemetry-integration.test.ts`

- [ ] **Step 1: Write integration test**

```ts
// services/stage-engine/src/__tests__/telemetry-integration.test.ts
import { describe, it, expect, beforeAll } from "vitest";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL ?? "http://127.0.0.1:54321",
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
);

describe("telemetry integration", () => {
  it("tool invocation writes activity_trail row within 2s", async () => {
    const beforeCount = await supabase
      .from("activity_trail")
      .select("*", { count: "exact", head: true })
      .eq("event", "botsson.tool_invoked");

    const res = await fetch("http://localhost:5010/agent/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.STAGE_ENGINE_API_KEY ?? "",
      },
      body: JSON.stringify({
        message: "Når jobber jeg neste uke?",
        profile_id: process.env.TEST_PROFILE_ID,
        channel: "chat",
      }),
    });
    expect(res.ok).toBe(true);

    await new Promise((r) => setTimeout(r, 2000));

    const afterCount = await supabase
      .from("activity_trail")
      .select("*", { count: "exact", head: true })
      .eq("event", "botsson.tool_invoked");

    expect(afterCount.count).toBeGreaterThan(beforeCount.count ?? 0);
  }, 15_000);
});
```

- [ ] **Step 2: Run locally against Supabase Local**

```bash
cd /home/sxtnl/dev/smartout.ai
op run --env-file=.env.template -- pnpm --filter stage-engine test telemetry-integration
```

Expected: PASS. If FAIL — check activity_trail RLS; writes go through service role key.

- [ ] **Step 3: Commit**

```bash
git add services/stage-engine/src/__tests__/telemetry-integration.test.ts
git commit -m "test(stage-engine): integration test for tool_invoked → activity_trail

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

### Task 3.4: Replace emitGuardianEvent in chat.ts

**Files:**
- Modify: `services/stage-engine/src/routes/agent/chat.ts:118-125, 148-158`

- [ ] **Step 1: Replace both emitGuardianEvent calls with emit**

In `chat.ts`, at line 118 (user message event):

```ts
await emit({
  event: "botsson.turn_started",
  workspace_id: workspaceId,
  actor_id: body.profile_id,
  correlation_id: c.get("requestId" as never) as string | undefined,
  session_id: sessionId,
  message_preview: body.message.length > 100 ? body.message.slice(0, 100) + "…" : body.message,
  channel: body.channel,
});
```

At line 148 (agent response event):

```ts
await emit({
  event: "botsson.turn_completed",
  workspace_id: workspaceId,
  actor_id: body.profile_id,
  correlation_id: c.get("requestId" as never) as string | undefined,
  session_id: sessionId,
  intent_capability: response.intent.capability,
  intent_confidence: response.intent.confidence,
  response_preview: response.response.length > 100 ? response.response.slice(0, 100) + "…" : response.response,
});
```

Update import at top:

```ts
import { emit } from "@smartout/telemetry";
// Keep existing emitGuardianEvent import during dual-write window (Phase 5)
import { emitGuardianEvent } from "../../core/guardian-bus.js";
```

Keep `emitGuardianEvent` calls for now — Phase 5 removes them.

- [ ] **Step 2: Typecheck + rebuild**

```bash
pnpm --filter stage-engine typecheck
pnpm --filter stage-engine build
```

- [ ] **Step 3: Commit**

```bash
git add services/stage-engine/src/routes/agent/chat.ts
git commit -m "feat(stage-engine): dual-emit turn events via telemetry + guardian-bus

Guardian-bus calls retained until Phase 5 cutover.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Phase 4: Authority Cleanup

### Task 4.1: Remove `applyMinRoleDowngrade` from router

**Files:**
- Modify: `services/stage-engine/src/core/agent-router.ts:116-132`

- [ ] **Step 1: Simplify authority resolution**

Replace the block (lines 116-132) with:

```ts
// Authority for the matched capability = what gate_action decided.
// The advisory authority map is no longer re-derived post-gate (Council 2026-04-16).
const authority = (gate.downgrade_to ?? rawAuthority.levels[intent.capability] ?? "read_only") as AuthorityLevel;
const authorityConfig: Record<string, AuthorityLevel> = {
  ...rawAuthority.levels,
  [intent.capability]: authority,
};
```

Remove the import of `applyMinRoleDowngrade`:

```ts
// DELETE this line:
import { applyMinRoleDowngrade } from "@smartout/ai/router/min-role";
```

Remove the `profile` lookup at lines 118-123 if no longer needed for tool-selector args. If `selectTools` requires role, fetch from existing `ctx.profile` instead.

- [ ] **Step 2: Typecheck**

```bash
pnpm --filter stage-engine typecheck
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add services/stage-engine/src/core/agent-router.ts
git commit -m "refactor(stage-engine): trust gate_action, drop post-hoc authority downgrade

Council 2026-04-16: applyMinRoleDowngrade was re-deriving a decision
gate_action already made. Tool selection now uses gate.downgrade_to
directly for the matched capability.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Phase 5: Guardian-bus → pg LISTEN/NOTIFY

### Task 5.1: Migration — AFTER INSERT trigger on activity_trail

**Files:**
- Create: `supabase/migrations/20260416120000_activity_trail_pg_notify.sql`

- [ ] **Step 1: Write migration**

```sql
-- supabase/migrations/20260416120000_activity_trail_pg_notify.sql
-- ADR-0084: Guardian event delivery via Postgres LISTEN/NOTIFY.
-- Supersedes in-process guardian-bus EventEmitter (Learning 0025).

CREATE OR REPLACE FUNCTION notify_botsson_event()
RETURNS TRIGGER AS $$
DECLARE
  payload JSON;
BEGIN
  -- Only notify for botsson.* and agent.* events (not all activity_trail rows)
  IF NEW.event NOT LIKE 'botsson.%' AND NEW.event NOT LIKE 'agent.%' THEN
    RETURN NEW;
  END IF;

  payload := json_build_object(
    'event', NEW.event,
    'workspace_id', NEW.workspace_id,
    'actor_id', NEW.actor_id,
    'session_id', NEW.payload->>'session_id',
    'payload', NEW.payload,
    'created_at', NEW.created_at
  );

  PERFORM pg_notify('botsson_events', payload::text);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS activity_trail_notify_botsson ON activity_trail;
CREATE TRIGGER activity_trail_notify_botsson
  AFTER INSERT ON activity_trail
  FOR EACH ROW EXECUTE FUNCTION notify_botsson_event();

COMMENT ON FUNCTION notify_botsson_event IS
  'Fires pg_notify(''botsson_events'', ...) for every botsson.*/agent.* row. Consumed by stage-engine pg-notify-bus.';
```

- [ ] **Step 2: Apply locally**

```bash
cd /home/sxtnl/dev/smartout.ai
npx supabase migration up --local
```

Expected: migration applies cleanly.

- [ ] **Step 3: Verify**

```bash
npx supabase db --local psql -c "SELECT tgname FROM pg_trigger WHERE tgname = 'activity_trail_notify_botsson';"
```

Expected: one row returned.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260416120000_activity_trail_pg_notify.sql
git commit -m "feat(db): pg_notify trigger on activity_trail for botsson.*/agent.* events

ADR-0084: replaces in-process guardian-bus. Stage-engine listens on
'botsson_events' channel and broadcasts to WebSocket subscribers.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

### Task 5.2: Create pg-notify-bus.ts

**Files:**
- Create: `services/stage-engine/src/core/pg-notify-bus.ts`

- [ ] **Step 1: Implement listener + broadcaster**

```ts
// services/stage-engine/src/core/pg-notify-bus.ts
// ADR-0084: Postgres LISTEN/NOTIFY replaces in-process guardian-bus.
// Pattern mirrors the Telegram bridge listener in src/index.ts.

import type { Client } from "pg";
import { baseLogger } from "../lib/logger.js";

type BotssonSocket = {
  send(data: string): void;
  readyState: number;
};

type ClientInfo = {
  ws: BotssonSocket;
  workspaceId: string;
  subscribedSessions: Set<string>;
};

const clients: Set<ClientInfo> = new Set();
let pgClient: Client | null = null;

export function addClient(ws: BotssonSocket, workspaceId: string): ClientInfo {
  const client: ClientInfo = { ws, workspaceId, subscribedSessions: new Set() };
  clients.add(client);
  return client;
}

export function removeClient(client: ClientInfo): void {
  clients.delete(client);
}

export function subscribeSession(client: ClientInfo, sessionId: string): void {
  client.subscribedSessions.add(sessionId);
}

export function unsubscribeSession(client: ClientInfo, sessionId: string): void {
  client.subscribedSessions.delete(sessionId);
}

/** Start LISTEN and route notifications to subscribed WebSockets. */
export async function startPgNotifyBus(): Promise<void> {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    baseLogger.warn("DATABASE_URL not set — pg-notify-bus disabled, guardian UI will not receive events");
    return;
  }
  const { Client } = await import("pg");
  pgClient = new Client({ connectionString: dbUrl });
  await pgClient.connect();
  await pgClient.query("LISTEN botsson_events");
  baseLogger.info("pg-notify-bus listening on channel 'botsson_events'");

  pgClient.on("notification", (msg) => {
    if (msg.channel !== "botsson_events" || !msg.payload) return;
    try {
      const event = JSON.parse(msg.payload) as {
        event: string;
        workspace_id: string;
        session_id: string | null;
        payload: Record<string, unknown>;
        created_at: string;
      };
      for (const c of clients) {
        if (c.workspaceId !== event.workspace_id) continue;
        if (c.subscribedSessions.size > 0 && event.session_id && !c.subscribedSessions.has(event.session_id)) continue;
        if (c.ws.readyState !== 1) continue;
        c.ws.send(JSON.stringify({ type: "event", ...event }));
      }
    } catch (err) {
      baseLogger.error({ err }, "pg-notify-bus parse error");
    }
  });

  pgClient.on("error", (err) => {
    baseLogger.error({ err }, "pg-notify-bus connection error — reconnecting in 5s");
    pgClient = null;
    setTimeout(() => void startPgNotifyBus(), 5000);
  });
}
```

- [ ] **Step 2: Typecheck**

```bash
pnpm --filter stage-engine typecheck
```

- [ ] **Step 3: Commit**

```bash
git add services/stage-engine/src/core/pg-notify-bus.ts
git commit -m "feat(stage-engine): pg-notify-bus replacement for guardian-bus

ADR-0084. Mirrors Telegram bridge LISTEN/NOTIFY pattern.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

### Task 5.3: Feature flag + dual-emit

**Files:**
- Modify: `services/stage-engine/src/index.ts`
- Modify: `services/stage-engine/src/routes/guardian.ts` (or wherever guardian WebSocket uses addClient)

- [ ] **Step 1: Add feature flag**

In `services/stage-engine/src/config.ts`, add:

```ts
USE_PG_NOTIFY_BUS: process.env.USE_PG_NOTIFY_BUS === "true",
```

- [ ] **Step 2: Start pg-notify-bus conditionally**

In `services/stage-engine/src/index.ts`, after `setupPgNotifyListener()`:

```ts
if (config.USE_PG_NOTIFY_BUS) {
  const { startPgNotifyBus } = await import("./core/pg-notify-bus.js");
  await startPgNotifyBus();
  baseLogger.info("pg-notify-bus ENABLED (dual-write window)");
}
```

- [ ] **Step 3: Dual-broadcast in guardian route**

Wherever `addClient(ws, workspaceId)` is called for guardian WebSocket (in `routes/guardian.ts`), also register with pg-notify-bus when flag is on:

```ts
const guardianBusClient = addClient(ws, workspaceId);
let pgNotifyClient = null;
if (config.USE_PG_NOTIFY_BUS) {
  const pgBus = await import("../core/pg-notify-bus.js");
  pgNotifyClient = pgBus.addClient(ws, workspaceId);
}
// ... on close: remove from both
```

- [ ] **Step 4: Commit**

```bash
git add services/stage-engine/src/config.ts services/stage-engine/src/index.ts services/stage-engine/src/routes/guardian.ts
git commit -m "feat(stage-engine): feature-flagged dual-write guardian-bus + pg-notify-bus

Enable with USE_PG_NOTIFY_BUS=true. Both bus types receive the same
WebSocket clients during the 1-week cutover window.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

### Task 5.4: Cutover (7 days later — flag flip)

**Files:**
- Modify: `services/stage-engine/src/index.ts`
- Modify: `services/stage-engine/src/routes/agent/chat.ts`
- Delete: `services/stage-engine/src/core/guardian-bus.ts`

- [ ] **Step 1: Verify metrics — 7 days of dual-write data**

```bash
npx supabase db --local psql -c "
  SELECT date_trunc('day', created_at) d, count(*)
  FROM activity_trail
  WHERE event LIKE 'botsson.%'
  GROUP BY 1 ORDER BY 1 DESC LIMIT 7;
"
```

Expected: 7 days of non-zero counts showing the pg_notify path is active.

- [ ] **Step 2: Flip default to on**

In `config.ts`, change default:

```ts
USE_PG_NOTIFY_BUS: process.env.USE_PG_NOTIFY_BUS !== "false", // default on
```

Remove remaining `emitGuardianEvent` imports and calls from `chat.ts`.

- [ ] **Step 3: Delete guardian-bus.ts**

```bash
rm services/stage-engine/src/core/guardian-bus.ts
```

Remove its import from `index.ts` (the WS connection-manager or similar).

- [ ] **Step 4: Typecheck + test**

```bash
pnpm --filter stage-engine typecheck
pnpm --filter stage-engine test
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A services/stage-engine/
git commit -m "refactor(stage-engine): cut over to pg-notify-bus, delete guardian-bus

ADR-0084 cutover complete. Learning 0025 RESOLVED.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

### Task 5.5: Write ADR-0084 + update Learning 0025

**Files:**
- Create: `docs/decisions/0084-guardian-bus-pg-listen-notify.md`
- Modify: `docs/learnings/0025-stage-engine-websocket-vercel-blocker.md`

- [ ] **Step 1: Write ADR**

```markdown
---
title: ADR-0084 — Guardian event delivery via pg LISTEN/NOTIFY
status: accepted
created: 2026-04-16
updated: 2026-04-16
module: ai-agent
tags: [adr, stage-engine, guardian, pg-notify, event-delivery]
---

# ADR-0084 — Guardian event delivery via pg LISTEN/NOTIFY

## Context

Council 2026-04-16 flagged that `services/stage-engine/src/core/guardian-bus.ts` uses an in-process `Set<ClientInfo>` to broadcast events to WebSocket subscribers. Learning 0025 identified this as a hard blocker for horizontal scaling (Vercel Fluid Compute or any multi-instance setup would silently drop cross-instance events).

## Decision

Replace in-process guardian-bus with Postgres `LISTEN/NOTIFY`:

1. AFTER INSERT trigger on `activity_trail` fires `pg_notify('botsson_events', …)` for `botsson.*` and `agent.*` events.
2. Stage-engine instances run `LISTEN botsson_events` and broadcast to their own WebSocket subscribers.
3. Any instance can write to `activity_trail`; every instance receives notifications. No in-process SPOF.

Pattern mirrors the existing Telegram bridge listener (`services/stage-engine/src/index.ts:91-138`).

## Consequences

- **Positive:** Horizontal-scalable. Learning 0025 closed. One write path (`emit()` → `activity_trail`) feeds both audit and live UI.
- **Negative:** Adds a pg client per instance. Slightly higher connection count.
- **Neutral:** pg_notify payloads are <8KB (PostgreSQL limit); all botsson events fit comfortably.

## Related

- Supersedes: in-process guardian-bus pattern
- Resolves: Learning 0025
- Enables: horizontal scaling of stage-engine
```

- [ ] **Step 2: Update Learning 0025**

Append to `docs/learnings/0025-stage-engine-websocket-vercel-blocker.md`:

```markdown
## Update 2026-04-16 — RESOLVED by ADR-0084

In-process guardian-bus replaced with pg `LISTEN/NOTIFY` on `activity_trail`. Pattern mirrors Telegram bridge. Stage-engine is now horizontally scalable from an event-delivery perspective. WebSocket routes themselves still require sticky sessions; that remains in scope for the Vercel migration discussion if it resurfaces.
```

- [ ] **Step 3: Register ADR**

Append to `docs/decisions/0000-decision-log.md`:

```markdown
| 0084 | Guardian event delivery via pg LISTEN/NOTIFY | accepted | 2026-04-16 | Replace in-process guardian-bus Set<> with Postgres pg_notify on activity_trail. Resolves Learning 0025. |
```

- [ ] **Step 4: Commit**

```bash
git add docs/decisions/0084-guardian-bus-pg-listen-notify.md docs/learnings/0025-stage-engine-websocket-vercel-blocker.md docs/decisions/0000-decision-log.md
git commit -m "docs(adr): ADR-0084 pg LISTEN/NOTIFY for guardian events; close L-0025

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Phase 6: Health Ribbon Backend

### Task 6.1: Create metrics route

**Files:**
- Create: `services/stage-engine/src/routes/metrics.ts`
- Test: `services/stage-engine/src/routes/__tests__/metrics.test.ts`

- [ ] **Step 1: Write failing test**

```ts
// services/stage-engine/src/routes/__tests__/metrics.test.ts
import { describe, it, expect, vi } from "vitest";
import { Hono } from "hono";
import { metricsRoute } from "../metrics.js";

describe("metrics route", () => {
  it("GET /metrics/health returns 4 metrics", async () => {
    const app = new Hono();
    app.route("/", metricsRoute);
    const res = await app.request("/metrics/health");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("uptime_seconds");
    expect(body).toHaveProperty("error_rate_5m");
    expect(body).toHaveProperty("p95_turn_latency_ms");
    expect(body).toHaveProperty("active_sessions");
  });
});
```

- [ ] **Step 2: Run — expect fail**

```bash
pnpm --filter stage-engine test metrics
```

- [ ] **Step 3: Implement route**

```ts
// services/stage-engine/src/routes/metrics.ts
import { Hono } from "hono";
import { supabaseAdmin } from "../lib/supabase.js";
import { baseLogger } from "../lib/logger.js";

const metricsRoute = new Hono();
const startedAt = Date.now();

// 30s in-memory cache to avoid hot-query on activity_trail
let cache: { at: number; data: unknown } | null = null;
const CACHE_MS = 30_000;

metricsRoute.get("/metrics/health", async (c) => {
  if (cache && Date.now() - cache.at < CACHE_MS) {
    return c.json(cache.data);
  }

  const fiveMinAgo = new Date(Date.now() - 5 * 60_000).toISOString();

  const [errorAgg, latencyAgg, sessionsAgg] = await Promise.all([
    supabaseAdmin.rpc("stage_engine_error_rate_5m"),
    supabaseAdmin.rpc("stage_engine_p95_latency_5m"),
    supabaseAdmin.from("engine_sessions").select("*", { count: "exact", head: true }).eq("status", "active"),
  ]);

  if (errorAgg.error) baseLogger.warn({ err: errorAgg.error }, "error_rate query failed");
  if (latencyAgg.error) baseLogger.warn({ err: latencyAgg.error }, "latency query failed");

  const data = {
    uptime_seconds: Math.floor((Date.now() - startedAt) / 1000),
    error_rate_5m: Number(errorAgg.data ?? 0),
    p95_turn_latency_ms: Number(latencyAgg.data ?? 0),
    active_sessions: sessionsAgg.count ?? 0,
    window: { from: fiveMinAgo, to: new Date().toISOString() },
  };

  cache = { at: Date.now(), data };
  return c.json(data);
});

export { metricsRoute };
```

- [ ] **Step 4: Run — expect pass**

Note: the two RPCs are created in Task 6.2. Test mocks both.

```bash
pnpm --filter stage-engine test metrics
```

- [ ] **Step 5: Commit**

```bash
git add services/stage-engine/src/routes/metrics.ts services/stage-engine/src/routes/__tests__/metrics.test.ts
git commit -m "feat(stage-engine): GET /metrics/health for Health Ribbon

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

### Task 6.2: Migration — error-rate + p95 latency RPCs

**Files:**
- Create: `supabase/migrations/20260416130000_stage_engine_metrics_rpcs.sql`

- [ ] **Step 1: Write migration**

```sql
-- supabase/migrations/20260416130000_stage_engine_metrics_rpcs.sql
-- Health Ribbon metrics aggregations over activity_trail.

CREATE OR REPLACE FUNCTION stage_engine_error_rate_5m()
RETURNS NUMERIC AS $$
  WITH w AS (
    SELECT event, count(*) AS n
    FROM activity_trail
    WHERE created_at >= now() - interval '5 minutes'
      AND (event LIKE 'botsson.%' OR event LIKE 'agent.%')
    GROUP BY event
  )
  SELECT
    COALESCE(
      (SELECT sum(n) FROM w WHERE event IN ('botsson.tool_failed', 'agent.error'))::numeric /
      NULLIF((SELECT sum(n) FROM w), 0),
      0
    )
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION stage_engine_p95_latency_5m()
RETURNS NUMERIC AS $$
  SELECT COALESCE(
    percentile_cont(0.95) WITHIN GROUP (
      ORDER BY (payload->>'latency_ms')::numeric
    ),
    0
  )
  FROM activity_trail
  WHERE created_at >= now() - interval '5 minutes'
    AND event = 'botsson.tool_invoked'
    AND payload ? 'latency_ms'
$$ LANGUAGE sql STABLE;

GRANT EXECUTE ON FUNCTION stage_engine_error_rate_5m() TO service_role;
GRANT EXECUTE ON FUNCTION stage_engine_p95_latency_5m() TO service_role;
```

- [ ] **Step 2: Apply + verify**

```bash
cd /home/sxtnl/dev/smartout.ai
npx supabase migration up --local
npx supabase db --local psql -c "SELECT stage_engine_error_rate_5m(), stage_engine_p95_latency_5m();"
```

Expected: two numeric values (0/0 if no events in the window).

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260416130000_stage_engine_metrics_rpcs.sql
git commit -m "feat(db): RPCs for Health Ribbon — error_rate_5m + p95_latency_5m

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

### Task 6.3: Mount metrics route in index.ts

**Files:**
- Modify: `services/stage-engine/src/index.ts`

- [ ] **Step 1: Register route**

Add import:

```ts
import { metricsRoute } from "./routes/metrics.js";
```

Mount after other routes:

```ts
app.route("/", metricsRoute);
```

- [ ] **Step 2: Smoke test**

```bash
pnpm --filter stage-engine build
op run --env-file=services/stage-engine/.env.template -- node services/stage-engine/dist/index.js &
sleep 2
curl -s http://localhost:5010/metrics/health | jq .
kill %1
```

Expected: JSON with `uptime_seconds`, `error_rate_5m`, `p95_turn_latency_ms`, `active_sessions`.

- [ ] **Step 3: Commit**

```bash
git add services/stage-engine/src/index.ts
git commit -m "feat(stage-engine): mount /metrics/health route

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Phase 7: Replace console.* in core/ (scoped sweep)

Do NOT bulk-replace. One file per task. Each task: read file, swap `console.log/error/warn` for `log.info/error/warn` using a childLogger with relevant context (sessionId, workspaceId when available).

### Task 7.1: session-manager.ts

**Files:**
- Modify: `services/stage-engine/src/core/session-manager.ts`

- [ ] **Step 1: Replace console.* calls**

Find all `console.log|console.error|console.warn` in the file. At top of file:

```ts
import { baseLogger } from "../lib/logger.js";
const log = baseLogger.child({ module: "session-manager" });
```

Replace `console.error("[session-manager] ...")` with `log.error({ ...ctx }, "...")` and similar for info/warn. Keep messages identical — only change the emitter.

- [ ] **Step 2: Typecheck**

```bash
pnpm --filter stage-engine typecheck
```

- [ ] **Step 3: Commit**

```bash
git add services/stage-engine/src/core/session-manager.ts
git commit -m "refactor(stage-engine): pino logger in session-manager

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

### Task 7.2: guardian-evaluator.ts

Same pattern as 7.1.

### Task 7.3: calendar-guardian.ts

Same pattern as 7.1. Additionally wrap the `supabase.from("engine_sessions").select(...)` call in a try/catch that throws `SchemaCacheStale` on `PGRST002` — this closes the retry-storm bug.

```ts
try {
  const { data, error } = await supabase.from("engine_sessions").select("...");
  if (error) {
    if (error.code === "PGRST002") {
      log.warn({ errorCode: error.code }, "schema cache stale — will back off");
      await new Promise((r) => setTimeout(r, 5000)); // linear 5s backoff; next tick recovers
      return;
    }
    throw error;
  }
  // ... existing logic
} catch (err) {
  log.error({ err }, "calendar-guardian tick failed");
}
```

### Task 7.4: stage-manager.ts, operations-evaluator.ts, telegram-bridge.ts

Same pattern.

---

## Phase 8: Learnings + Final Verification

### Task 8.1: Write Learning 0033, 0034, 0035

**Files:**
- Create: `docs/learnings/0033-two-llm-calls-without-observability.md`
- Create: `docs/learnings/0034-capability-without-emit-invisible.md`
- Create: `docs/learnings/0035-in-process-event-bus-spof.md`

- [ ] **Step 1: Write each learning**

Use `docs/templates/learning.md`. One file per learning. Content from Council synthesis:

- **0033** — "Two LLM calls with no observability is one LLM call you can't debug." Classifier + generator both on sonnet-4.6, no token/latency metrics. Fix shipping in Phase 3 (emit) + P1 (Haiku swap behind eval-harness).
- **0034** — "A capability without emit() is invisible to the cascade. Authority decisions cannot be audited backwards." Tie to Agent Trust Gate FAIL in Council 2026-04-16. Fix shipping via toVercelTools adapter in Task 3.2.
- **0035** — "In-process event buses on a single Node instance look like architecture but behave like a SPOF." The 19h-uptime-zero-work bug. Resolved by ADR-0084.

Register all three in `docs/learnings/0000-learning-log.md`.

- [ ] **Step 2: Commit**

```bash
git add docs/learnings/
git commit -m "docs(learnings): 0033 + 0034 + 0035 from Council 2026-04-16 Botsson review

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

### Task 8.2: Full typecheck + test + smoke

- [ ] **Step 1: Full repo typecheck**

```bash
pnpm turbo typecheck
```

Expected: 0 errors.

- [ ] **Step 2: Full repo test**

```bash
pnpm turbo test
```

Expected: all green (new tests added in 1.2, 1.3, 2.1, 3.2, 3.3, 6.1).

- [ ] **Step 3: End-to-end smoke**

Start Supabase Local + stage-engine + web. Send a chat message via BotssonChat. Verify:

1. `activity_trail` has rows for `botsson.turn_started`, `botsson.tool_invoked` (if tools fired), `botsson.turn_completed`.
2. `/metrics/health` returns non-zero `active_sessions`.
3. Guardian UI WebSocket receives events (open devtools, check frames).
4. `x-request-id` header present on every stage-engine response.
5. Force an error (invalid capability → gate_action denies): verify 403 with `AUTHORITY_DENIED` code and structured log line in stage-engine stdout.

- [ ] **Step 4: Final commit + PR prep**

```bash
git log --oneline main..HEAD | head -30
```

Open PR from `feat/botsson-observability-foundation` to `development`. Use the rollout plan from this doc as PR description.

### Task 8.3: Update COUNCIL-LOG

**Files:**
- Modify: `docs/council/COUNCIL-LOG.md`

- [ ] **Step 1: Append row**

```markdown
| 2026-04-16 | Botsson Runtime Review (harness/inference/logging) | post-implementation | APPROVE WITH CHANGES | steward, supervisor, system-agent-coordinator, frontend-designer | ADR-0084, ADR-0085 (pending), ADR-0086 (pending), ADR-0087 | Learnings 0033, 0034, 0035. L-0025 RESOLVED | Agent Trust Gate FAIL — 11/14 capabilities no emit(). P0 roadmap = Botsson Observability Foundation plan (docs/superpowers/plans/2026-04-16-botsson-observability-foundation.md). Model policy to move from hardcoded sonnet-4.6 to engine_authority_config (ADR-0086, P1). |
```

- [ ] **Step 2: Commit**

```bash
git add docs/council/COUNCIL-LOG.md
git commit -m "docs(council): log Botsson Runtime Review 2026-04-16

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Success Criteria

- [ ] `grep -rE "console\.(log|error|warn)" services/stage-engine/src/core/` returns 0 matches
- [ ] `grep -r "from \"@smartout/telemetry\"" services/stage-engine/src/` returns ≥3 matches
- [ ] `grep -r "capability:" packages/ai/src/capabilities/*/tools.ts | wc -l` returns ≥14
- [ ] `curl localhost:5010/metrics/health` returns all 4 metrics
- [ ] `curl -i localhost:5010/health` has `x-request-id` header
- [ ] `activity_trail` receives `botsson.tool_invoked` rows during integration test
- [ ] `pg_trigger` shows `activity_trail_notify_botsson` active
- [ ] Guardian WebSocket receives events via pg_notify path (verified 7 days dual-write)
- [ ] `guardian-bus.ts` deleted
- [ ] ADR-0084, ADR-0087 accepted + registered
- [ ] Learnings 0033-0035 written; L-0025 marked RESOLVED
- [ ] No existing tests regress
- [ ] `pnpm turbo typecheck` passes clean

---

## Rollback Plan

Each phase is behind its own commits. Rollback order:

1. **Phase 5 rollback** — set `USE_PG_NOTIFY_BUS=false`; redeploy. Guardian-bus still in place (not deleted until Task 5.4). If already deleted: revert Task 5.4 commit.
2. **Phase 3 rollback** — `toVercelTools` adapter auto-emit is additive (doesn't break tool calls); low risk. If activity_trail write volume overwhelms DB: set a feature flag `TELEMETRY_TOOL_AUTOEMIT=false` (add in adapter if concerns arise).
3. **Phase 4 rollback** — revert the `agent-router.ts` commit restoring `applyMinRoleDowngrade`.
4. **Phases 1/2** — substrate; rolling back undoes all downstream work. Avoid.

**Do not roll back Phase 0 (ADR-0087).** ADRs remain as records even if implementation reverts.
