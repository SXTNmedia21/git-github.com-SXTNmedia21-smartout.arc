/**
 * invoke-capability-tool.test.ts
 *
 * Unit tests for POST /internal/engine-dispatch/invoke-capability-tool
 * (ADR-0424 §Transport — Node-side capability tool bridge endpoint).
 *
 * Test contract:
 *  1. depth !== 0 → 400 (recursion defense)
 *  2. Unknown capability/tool → 404
 *  3. workspace_id mismatch with engine_state row → 400 + security log
 *  4. Gate denial → 200 ok:false
 *  5. Tool success → 200 ok:true + result + duration_ms + gate_evaluation_id
 *  6. Tool execute() error result → 500 ok:false
 *  7. Auth missing/wrong scope → 401
 *
 * Mocking strategy:
 *  - supabase.js mocked at module level (secrets.js bypassed via mock)
 *  - resolveCapabilityTool mocked (Phase 1 surface frozen — ADR-0173)
 *  - emit mocked (telemetry is fire-and-forget; we verify it is called)
 *  - No @smartout/ai import at module scope (avoids registry boot cost in tests)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── 1. secrets.js mock (prevents env-var validation on import) ──────────────
vi.mock("../../../secrets.js", () => ({
  getSecrets: vi.fn().mockReturnValue({
    openrouterApiKey: "test-key",
    telegramBotToken: null,
    telegramAdminChatId: null,
    telegramWebhookSecret: null,
  }),
}));

// ── 2. Hoisted mocks for supabase + resolver + emit ─────────────────────────
const {
  rpcMock,
  fromMock,
  selectMock,
  eqMock,
  singleMock,
  resolveCapabilityToolMock,
  emitMock,
  nonEmptyFn,
} = vi.hoisted(() => {
  // Single-row engine_state lookup builder (select → eq → single)
  const singleMock = vi.fn().mockResolvedValue({
    data: { workspace_id: "ws-uuid-01" },
    error: null,
  });
  const eqMock = vi.fn().mockReturnThis();
  const selectMock = vi.fn().mockReturnValue({ eq: eqMock, single: singleMock });

  return {
    rpcMock: vi.fn().mockResolvedValue({
      data: {
        allow: true,
        downgrade_to: null,
        reason: null,
        gate_evaluation_id: "gate-eval-uuid-01",
      },
      error: null,
    }),
    fromMock: vi.fn().mockReturnValue({ select: selectMock }),
    selectMock,
    eqMock,
    singleMock,
    resolveCapabilityToolMock: vi.fn(),
    emitMock: vi.fn().mockResolvedValue(undefined),
    nonEmptyFn: (s: string, field: string) => {
      if (!s) throw new Error(`${field} must be non-empty`);
      return s;
    },
  };
});

vi.mock("../../../lib/supabase.js", () => ({
  supabaseAdmin: {
    from: fromMock,
    rpc: rpcMock,
  },
  createUserClient: vi.fn(),
}));

vi.mock("@smartout/ai/engine/resolve-capability-tool", () => ({
  resolveCapabilityTool: resolveCapabilityToolMock,
}));

// Both @smartout/telemetry and @smartout/telemetry/server resolve to the same
// dist/index.js (per package.json exports). Vitest deduplicates on the resolved
// file path, so mocking one can affect the other. We mock both paths with a
// complete set of exports to avoid "No X export is defined on the mock" errors.
vi.mock("@smartout/telemetry", () => ({
  emit: emitMock,
  nonEmpty: nonEmptyFn,
}));
vi.mock("@smartout/telemetry/server", () => ({
  emit: emitMock,
  nonEmpty: nonEmptyFn,
}));

// ── 3. Import route after mocks ──────────────────────────────────────────────
import { Hono } from "hono";
import type { AuthContext } from "../../../types/auth.js";
import type { AppVariables } from "../../../types/app-env.js";
import { invokeCapabilityToolRouter } from "../invoke-capability-tool.js";

// ── 4. Helpers ───────────────────────────────────────────────────────────────

/** Mount the router under /internal/engine-dispatch (matches index.ts mounting). */
function buildApp(scopes: string[] = ["engine:invoke"]) {
  const app = new Hono<{ Variables: AppVariables & { auth: AuthContext } }>();
  // Inject auth context as middleware (simulates stage-engine authMiddleware)
  app.use("*", async (c, next) => {
    c.set("auth", { method: "api_key", scopes });
    await next();
  });
  app.route("/internal/engine-dispatch", invokeCapabilityToolRouter);
  return app;
}

const validBody = {
  capability: "schedule",
  tool: "get_my_shifts",
  args: { days: 7 },
  workspace_id: "ws-uuid-01",
  actor_profile_id: "profile-uuid-01",
  channel: "system" as const,
  engine_process_id: "proc-uuid-01",
  engine_state_id: "state-uuid-01",
  engine_state_step_id: "step-uuid-01",
  depth: 0,
};

/** POST helper */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function post(app: Hono<any>, body: unknown) {
  return app.request("/internal/engine-dispatch/invoke-capability-tool", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": "test-key" },
    body: JSON.stringify(body),
  });
}

// ── 5. Tests ─────────────────────────────────────────────────────────────────

describe("POST /internal/engine-dispatch/invoke-capability-tool", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Reset singleMock to return valid engine_state row (workspace_id matches body)
    singleMock.mockResolvedValue({
      data: { workspace_id: "ws-uuid-01" },
      error: null,
    });

    // Reset gate to allow
    rpcMock.mockResolvedValue({
      data: {
        allow: true,
        downgrade_to: null,
        reason: null,
        gate_evaluation_id: "gate-eval-uuid-01",
      },
      error: null,
    });

    // Reset resolver to return a successful tool
    resolveCapabilityToolMock.mockReturnValue({
      capabilityName: "schedule",
      toolName: "get_my_shifts",
      inputSchema: { safeParse: () => ({ success: true, data: { days: 7 } }) },
      execute: vi.fn().mockResolvedValue({ ok: true, result: "shifts here" }),
    });
  });

  // ── Test 1: depth !== 0 → 400 ──────────────────────────────────────────────
  it("rejects depth !== 0 with 400", async () => {
    const app = buildApp();
    const res = await post(app, { ...validBody, depth: 1 });
    expect(res.status).toBe(400);
    const json = await res.json() as { error: string };
    expect(json.error).toBe("DEPTH_EXCEEDED");
  });

  // ── Test 2: Unknown capability/tool → 404 ────────────────────────────────
  it("returns 404 when capability/tool not found", async () => {
    resolveCapabilityToolMock.mockReturnValue(null);
    const app = buildApp();
    const res = await post(app, validBody);
    expect(res.status).toBe(404);
    const json = await res.json() as { error: string };
    expect(json.error).toBe("TOOL_NOT_FOUND");
  });

  // ── Test 3: workspace_id mismatch → 400 + audit ──────────────────────────
  it("returns 400 when workspace_id mismatches engine_state row", async () => {
    singleMock.mockResolvedValue({
      data: { workspace_id: "ws-DIFFERENT" },
      error: null,
    });
    const app = buildApp();
    const res = await post(app, validBody);
    expect(res.status).toBe(400);
    const json = await res.json() as { error: string };
    expect(json.error).toBe("WORKSPACE_MISMATCH");
  });

  // ── Test 4: Gate denial → 200 ok:false ───────────────────────────────────
  it("returns 200 ok:false when gate denies", async () => {
    rpcMock.mockResolvedValue({
      data: {
        allow: false,
        downgrade_to: null,
        reason: "min_role_not_met",
        gate_evaluation_id: "gate-eval-denied",
      },
      error: null,
    });
    const app = buildApp();
    const res = await post(app, validBody);
    expect(res.status).toBe(200);
    const json = await res.json() as { ok: boolean; error: string; gate_evaluation_id: string };
    expect(json.ok).toBe(false);
    expect(json.error).toBe("GATE_DENIED");
    expect(json.gate_evaluation_id).toBe("gate-eval-denied");
    // telemetry must fire for denied path
    expect(emitMock).toHaveBeenCalledOnce();
    const emitArg = emitMock.mock.calls[0]?.[0] as { properties: { data: { tool_status: string } } };
    expect(emitArg.properties.data.tool_status).toBe("denied");
  });

  // ── Test 5: Tool success → 200 ok:true ────────────────────────────────────
  it("returns 200 ok:true with result and duration_ms on success", async () => {
    const app = buildApp();
    const res = await post(app, validBody);
    expect(res.status).toBe(200);
    const json = await res.json() as {
      ok: boolean;
      result: string;
      gate_evaluation_id: string;
      duration_ms: number;
    };
    expect(json.ok).toBe(true);
    expect(json.result).toBe("shifts here");
    expect(json.gate_evaluation_id).toBe("gate-eval-uuid-01");
    expect(typeof json.duration_ms).toBe("number");
    // telemetry emitted with success status
    expect(emitMock).toHaveBeenCalledOnce();
    const emitArg = emitMock.mock.calls[0]?.[0] as { properties: { data: { tool_status: string } } };
    expect(emitArg.properties.data.tool_status).toBe("success");
  });

  // ── Test 6: Tool execute() returns error → 500 ────────────────────────────
  it("returns 500 ok:false when tool execute() returns error", async () => {
    resolveCapabilityToolMock.mockReturnValue({
      capabilityName: "schedule",
      toolName: "get_my_shifts",
      inputSchema: { safeParse: () => ({ success: true, data: {} }) },
      execute: vi.fn().mockResolvedValue({ ok: false, error: "DB_ERROR: connection refused" }),
    });
    const app = buildApp();
    const res = await post(app, validBody);
    expect(res.status).toBe(500);
    const json = await res.json() as { ok: boolean; error: string };
    expect(json.ok).toBe(false);
    expect(json.error).toContain("DB_ERROR");
    // telemetry emitted with error status
    const emitArg = emitMock.mock.calls[0]?.[0] as { properties: { data: { tool_status: string } } };
    expect(emitArg.properties.data.tool_status).toBe("error");
  });

  // ── Test 7a: Missing auth → 401 ───────────────────────────────────────────
  it("returns 401 when no auth context set", async () => {
    // Build app WITHOUT injecting auth middleware
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const app = new Hono<any>();
    app.route("/internal/engine-dispatch", invokeCapabilityToolRouter);
    const res = await app.request("/internal/engine-dispatch/invoke-capability-tool", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validBody),
    });
    expect(res.status).toBe(401);
  });

  // ── Test 7b: Wrong scope → 401 ────────────────────────────────────────────
  it("returns 401 when auth scope is bff:proxy (not engine:invoke)", async () => {
    const app = buildApp(["bff:proxy"]);
    const res = await post(app, validBody);
    expect(res.status).toBe(401);
    const json = await res.json() as { error: string };
    expect(json.error).toBe("SCOPE_INSUFFICIENT");
  });

  // ── Bonus: engine_state not found → 400 ───────────────────────────────────
  it("returns 400 when engine_state row not found", async () => {
    singleMock.mockResolvedValue({ data: null, error: { message: "no rows" } });
    const app = buildApp();
    const res = await post(app, validBody);
    expect(res.status).toBe(400);
    const json = await res.json() as { error: string };
    expect(json.error).toBe("ENGINE_STATE_NOT_FOUND");
  });
});
