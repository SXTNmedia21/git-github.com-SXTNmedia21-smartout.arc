// ============================================
// chat-harness-pipeline.test.ts
// Route-level integration test for the /agent/chat endpoint.
// Verifies the HarnessAdapter pipeline wiring (ADR-0327 Phase 3 + Phase 3.5):
//   - HARNESS_ADAPTER_CHAT flag OFF → resolver not called; existing path runs
//   - Flag ON + no client_tools → resolver called with null; bundle passed to router
//   - Flag ON + client_tools array → resolver called with array; bundle passed to router
//   - ResolverNotImplementedError caught → graceful fallback, 200
//   - Generic error caught → graceful fallback, 200
//   - workspace_id in harnessUserContext comes from auth, not body
//   - client_tool_calls in routeAgentMessage response propagated to HTTP response
//   - client_tool_results in request body seeds conversation history before routeAgentMessage
//
// Mocked: resolveChatTools, harnessAdapterChatEnabled, routeAgentMessage,
//         createAgentSession, appendConversationTurn, getConversationHistory,
//         emit (@smartout/telemetry), emitGuardianEvent, deriveProfileId,
//         supabaseAdmin, sessionLane.
// NOT mocked: Hono routing + request parsing (that is the integration layer
// under test — we want Zod validation + middleware wiring to run for real).
// ============================================

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Hono } from "hono";
import type { AuthContext } from "../../../types/auth.js";
import type { AppVariables } from "../../../types/app-env.js";
import { SessionLane } from "../../../core/session-lane.js";

// ━━━ Hoisted mock values (must be before vi.mock factories) ━━━━━━━━━━━━━━━━━

const { mockResolveChatTools, mockHarnessEnabled, mockRouteAgentMessage } = vi.hoisted(() => {
  return {
    mockResolveChatTools: vi.fn(),
    mockHarnessEnabled: vi.fn(),
    mockRouteAgentMessage: vi.fn(),
  };
});

// ━━━ Module mocks ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// Mock the resolver module — the entire unit under test for flag + resolution.
vi.mock("../../../core/chat-tool-resolver.js", () => ({
  harnessAdapterChatEnabled: mockHarnessEnabled,
  resolveChatTools: mockResolveChatTools,
  // ResolverNotImplementedError must be a real class so instanceof checks work.
  ResolverNotImplementedError: class ResolverNotImplementedError extends Error {
    constructor(message: string) {
      super(message);
      this.name = "ResolverNotImplementedError";
    }
  },
}));

// Mock the downstream agent-router — we don't want real LLM calls.
vi.mock("../../../core/agent-router.js", () => ({
  routeAgentMessage: mockRouteAgentMessage,
}));

// Mock session lifecycle so tests never touch DB.
vi.mock("../../../core/agent-session.js", () => ({
  createAgentSession: vi.fn().mockResolvedValue({
    id: "session-test-uuid",
    status: "active",
    workspace_id: "ws-auth",
    collected_data: {},
  }),
  loadAgentSession: vi.fn().mockResolvedValue({
    ok: true,
    session: {
      id: "session-test-uuid",
      status: "active",
      collected_data: {},
    },
  }),
  appendConversationTurn: vi.fn().mockResolvedValue(undefined),
  getConversationHistory: vi.fn().mockReturnValue([]),
}));

// Mock telemetry — fire-and-forget; no real event system in tests.
vi.mock("@smartout/telemetry", async (orig) => {
  const actual = (await orig()) as typeof import("@smartout/telemetry");
  return {
    ...actual,
    emit: vi.fn().mockResolvedValue({ ok: true }),
  };
});

// Mock guardian bus — no real pg notify in tests.
vi.mock("../../../core/guardian-bus.js", () => ({
  emitGuardianEvent: vi.fn(),
}));

// Mock profile derivation — returns a predictable server-derived profile_id.
vi.mock("../../../core/derive-profile-id.js", () => ({
  deriveProfileId: vi.fn().mockResolvedValue("profile-auth-derived"),
  ActorDerivationError: class ActorDerivationError extends Error {
    constructor(message: string) {
      super(message);
      this.name = "ActorDerivationError";
    }
  },
}));

// Mock supabase — no real DB in tests.
vi.mock("../../../lib/supabase.js", () => ({
  supabaseAdmin: {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    }),
  },
  createUserClient: vi.fn(),
}));

// Mock logger — silence info/warn/error during test runs.
vi.mock("../../../lib/logger.js", () => ({
  baseLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// ━━━ Import AFTER mocks ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { agentChat } from "../chat.js";

// ━━━ Test-app builder ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Builds a minimal Hono app that mounts the agentChat router with auth +
 * sessionLane middleware pre-populated — exactly what the full index.ts does,
 * but without all the other routes, DB connections, and Sentry.
 */
function buildTestApp(authOverrides: Partial<AuthContext> = {}) {
  const app = new Hono<{ Variables: AppVariables & { auth: AuthContext } }>();

  const authCtx: AuthContext = {
    method: "jwt",
    workspaceId: "ws-auth",
    userId: "user-auth",
    ...authOverrides,
  };

  const sessionLane = new SessionLane();

  // Inject auth + sessionLane before route handler (same order as index.ts).
  app.use("*", async (c, next) => {
    c.set("auth", authCtx);
    c.set("requestId", "test-request-id");
    c.set("sessionLane", sessionLane);
    await next();
  });

  app.route("/", agentChat);

  return app;
}

/**
 * Minimal valid /agent/chat request body (all required fields per chatSchema).
 */
function makeChatBody(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    message: "Hello, Botsson",
    channel: "chat",
    ...overrides,
  });
}

/**
 * Minimal valid ToolBundle returned by a successful resolveChatTools call.
 */
function makeToolBundle() {
  return {
    bundle: {
      definitions: [],
      implementations: {},
      systemPromptSlices: [],
      authority: {
        workspace_id: "ws-auth",
        channel: "chat" as const,
        role: "employee" as const,
        blockedTools: [],
        gateActionMisses: [],
      },
    },
    viaHarnessAdapter: true,
    clientToolCollisions: [],
  };
}

// ━━━ Setup / teardown ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

beforeEach(() => {
  vi.clearAllMocks();

  // Default routeAgentMessage: returns a minimal successful AgentChatResponse.
  mockRouteAgentMessage.mockResolvedValue({
    response: "Hei! Alt er bra.",
    session_id: "session-test-uuid",
    intent: { capability: "general", confidence: 0.9 },
  });
});

// ━━━ Tests ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe("POST /agent/chat — HarnessAdapter pipeline wiring (ADR-0327 Phase 3 + Phase 3.5)", () => {
  // ── Test 1: flag OFF ────────────────────────────────────────────────────────

  it("flag OFF: resolveChatTools NOT called; routeAgentMessage called; response 200", async () => {
    // Arrange: flag is off.
    mockHarnessEnabled.mockReturnValue(false);

    const app = buildTestApp();
    const res = await app.request("/agent/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: makeChatBody(),
    });

    // Assert: request succeeds on existing path.
    expect(res.status).toBe(200);

    // Resolver must NOT have been called when flag is off.
    expect(mockResolveChatTools).not.toHaveBeenCalled();

    // Downstream routeAgentMessage MUST have been called (existing path still runs).
    expect(mockRouteAgentMessage).toHaveBeenCalledOnce();
  });

  // ── Test 2: flag ON, no client_tools — bundle passed to routeAgentMessage ────

  it("flag ON + no client_tools: resolveChatTools called with clientTools: null; bundle passed to router; response 200", async () => {
    // Arrange: flag on, resolver returns success with a non-empty bundle.
    mockHarnessEnabled.mockReturnValue(true);
    const bundlePayload = makeToolBundle();
    mockResolveChatTools.mockResolvedValue(bundlePayload);

    const app = buildTestApp();
    const res = await app.request("/agent/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: makeChatBody({ page_route: "/dashboard/schedule" }),
    });

    expect(res.status).toBe(200);

    // Resolver must have been called with null clientTools (no client_tools in body).
    expect(mockResolveChatTools).toHaveBeenCalledOnce();
    const resolverInput = mockResolveChatTools.mock.calls[0][0] as {
      pageRoute: string | null;
      clientTools: unknown;
      userContext: { workspace_id: string; profile_id: string; role: string };
    };
    expect(resolverInput.clientTools).toBeNull();
    expect(resolverInput.pageRoute).toBe("/dashboard/schedule");

    // Phase 3.5 D1: bundle MUST be passed to routeAgentMessage (closes DEAD-PIPE-ADR-0327-C1).
    expect(mockRouteAgentMessage).toHaveBeenCalledOnce();
    const routerInput = mockRouteAgentMessage.mock.calls[0][0] as {
      bundle: typeof bundlePayload.bundle | undefined;
    };
    expect(routerInput.bundle).toBeDefined();
    expect(routerInput.bundle).toStrictEqual(bundlePayload.bundle);
  });

  // ── Test 3: flag ON, client_tools array — bundle + clientToolNames passed ────

  it("flag ON + client_tools array: resolveChatTools called with the array; bundle + clientToolNames passed to router; response 200", async () => {
    // Arrange: flag on, resolver handles merged tools.
    mockHarnessEnabled.mockReturnValue(true);
    const bundlePayload = makeToolBundle();
    mockResolveChatTools.mockResolvedValue({
      ...bundlePayload,
      clientToolCollisions: [],
    });

    const clientTools = [
      {
        temporaryTool: {
          modelToolName: "navigateTo",
          description: "Navigate to a dashboard page",
          dynamicParameters: [],
          client: {},
        },
      },
    ];

    const app = buildTestApp();
    const res = await app.request("/agent/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: makeChatBody({ client_tools: clientTools }),
    });

    expect(res.status).toBe(200);

    expect(mockResolveChatTools).toHaveBeenCalledOnce();
    const resolverInput = mockResolveChatTools.mock.calls[0][0] as {
      clientTools: typeof clientTools | null;
    };
    // Resolver received the full client_tools array from the request body.
    expect(resolverInput.clientTools).toHaveLength(1);
    expect(resolverInput.clientTools?.[0]?.temporaryTool.modelToolName).toBe("navigateTo");

    // Phase 3.5 D1: bundle AND clientToolNames must be passed to routeAgentMessage.
    expect(mockRouteAgentMessage).toHaveBeenCalledOnce();
    const routerInput = mockRouteAgentMessage.mock.calls[0][0] as {
      bundle: typeof bundlePayload.bundle | undefined;
      clientToolNames: Set<string> | undefined;
    };
    expect(routerInput.bundle).toBeDefined();
    // clientToolNames must contain the client_tools modelToolName(s).
    expect(routerInput.clientToolNames).toBeDefined();
    expect(routerInput.clientToolNames?.has("navigateTo")).toBe(true);
  });

  // ── Test 4: ResolverNotImplementedError → graceful fallback ─────────────────

  it("ResolverNotImplementedError caught: falls back to existing path; response 200", async () => {
    // Arrange: flag on, resolver throws the sentinel error.
    mockHarnessEnabled.mockReturnValue(true);

    const { ResolverNotImplementedError } = await import("../../../core/chat-tool-resolver.js");
    mockResolveChatTools.mockRejectedValue(
      new ResolverNotImplementedError("D1 resolver stub — not yet implemented"),
    );

    const app = buildTestApp();
    const res = await app.request("/agent/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: makeChatBody(),
    });

    // Must NOT surface a 500 — graceful degradation to existing path.
    expect(res.status).toBe(200);

    // Resolver was attempted.
    expect(mockResolveChatTools).toHaveBeenCalledOnce();

    // Fallback path ran successfully after the catch.
    expect(mockRouteAgentMessage).toHaveBeenCalledOnce();

    // Logger warned (not errored) — sentinel is expected, not a crash.
    const { baseLogger } = await import("../../../lib/logger.js");
    expect(vi.mocked(baseLogger.warn)).toHaveBeenCalledOnce();
    expect(vi.mocked(baseLogger.error)).not.toHaveBeenCalled();
  });

  // ── Test 5: generic Error → graceful fallback ────────────────────────────────

  it("generic Error from resolver caught: falls back to existing path; response 200, no 500 leak", async () => {
    // Arrange: flag on, resolver throws an unexpected error.
    mockHarnessEnabled.mockReturnValue(true);
    mockResolveChatTools.mockRejectedValue(new Error("harness adapter unavailable"));

    const app = buildTestApp();
    const res = await app.request("/agent/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: makeChatBody(),
    });

    // Must NOT bubble up as 500.
    expect(res.status).toBe(200);

    expect(mockResolveChatTools).toHaveBeenCalledOnce();
    expect(mockRouteAgentMessage).toHaveBeenCalledOnce();

    // Logger errored (not warned) — unexpected errors are higher severity.
    const { baseLogger } = await import("../../../lib/logger.js");
    expect(vi.mocked(baseLogger.error)).toHaveBeenCalledOnce();
    expect(vi.mocked(baseLogger.warn)).not.toHaveBeenCalled();
  });

  // ── Test 6 (bonus): workspace_id in harnessUserContext comes from auth, not body ───

  it("harnessUserContext.workspace_id is server-derived from auth, not from body (ADR-0151)", async () => {
    // Arrange: flag on, resolver resolves successfully.
    mockHarnessEnabled.mockReturnValue(true);
    mockResolveChatTools.mockResolvedValue(makeToolBundle());

    // App with auth.workspaceId = "ws-auth" (server-derived).
    // Body sends a workspace_context.workspace_id that DIFFERS — should be ignored
    // for the harnessUserContext (chat path uses auth.workspaceId as effectiveWorkspaceId).
    const app = buildTestApp({ workspaceId: "ws-auth", userId: "user-auth" });

    const res = await app.request("/agent/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: makeChatBody({
        // Attempt to supply a different workspace via workspace_context
        // (chat channel — this is NOT the voice path, so workspace_context is ignored).
        workspace_context: {
          workspace_id: "ws-body-attacker",
          name: "Attacker Workspace",
          niche: null,
          active_season_id: null,
          active_framework_id: null,
          planning_cycle_id: null,
        },
      }),
    });

    expect(res.status).toBe(200);
    expect(mockResolveChatTools).toHaveBeenCalledOnce();

    const resolverInput = mockResolveChatTools.mock.calls[0][0] as {
      userContext: { workspace_id: string; profile_id: string };
    };

    // workspace_id in userContext passed to resolver MUST match auth.workspaceId
    // (server-resolved), NOT the body-supplied workspace_context.workspace_id.
    expect(resolverInput.userContext.workspace_id).toBe("ws-auth");
    expect(resolverInput.userContext.workspace_id).not.toBe("ws-body-attacker");

    // profile_id in userContext MUST be the server-derived value from deriveProfileId,
    // NOT any body-supplied identifier.
    expect(resolverInput.userContext.profile_id).toBe("profile-auth-derived");
  });

  // ── Test 7: client_tool_calls in routeAgentMessage response propagated ────────

  it("client_tool_calls from routeAgentMessage propagated to HTTP response body", async () => {
    // Arrange: flag on, resolver resolves successfully.
    mockHarnessEnabled.mockReturnValue(true);
    mockResolveChatTools.mockResolvedValue(makeToolBundle());

    // routeAgentMessage returns a response that includes client_tool_calls
    // (LLM picked a client-shipped tool during the turn).
    const mockClientToolCalls = [
      {
        tool_call_id: "call_abc123",
        name: "navigateTo",
        arguments: { path: "/dashboard/schedule" },
      },
    ];
    mockRouteAgentMessage.mockResolvedValue({
      response: "Navigerer til vaktplanen...",
      session_id: "session-test-uuid",
      intent: { capability: "general", confidence: 0.9 },
      client_tool_calls: mockClientToolCalls,
    });

    const app = buildTestApp();
    const res = await app.request("/agent/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: makeChatBody(),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;

    // client_tool_calls must be present in the response JSON exactly as returned
    // by routeAgentMessage — chat.ts must pass them through unchanged.
    expect(body["client_tool_calls"]).toBeDefined();
    expect(Array.isArray(body["client_tool_calls"])).toBe(true);
    const calls = body["client_tool_calls"] as typeof mockClientToolCalls;
    expect(calls).toHaveLength(1);
    expect(calls[0]?.tool_call_id).toBe("call_abc123");
    expect(calls[0]?.name).toBe("navigateTo");
    expect((calls[0]?.arguments as Record<string, unknown>)["path"]).toBe("/dashboard/schedule");
  });

  // ── Test 8: client_tool_results seeds conversation history ───────────────────

  it("client_tool_results in request body: conversation history seeded with tool result turns before routeAgentMessage", async () => {
    // Arrange: flag off (harness not needed for this test — roundtrip seeding
    // is independent of the harness flag).
    mockHarnessEnabled.mockReturnValue(false);

    const app = buildTestApp();
    const res = await app.request("/agent/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: makeChatBody({
        client_tool_results: [
          {
            tool_call_id: "call_abc123",
            result: "/dashboard/schedule navigated",
            is_error: false,
          },
        ],
      }),
    });

    expect(res.status).toBe(200);
    expect(mockRouteAgentMessage).toHaveBeenCalledOnce();

    // Inspect what conversationHistory was passed to routeAgentMessage.
    // The base conversationHistory is [] (from mocked getConversationHistory).
    // After seeding client_tool_results, it should have 2 synthetic turns:
    //   1. assistant turn: "Client tools were called."
    //   2. user turn: "[Client tool results]\ntool_call_id=call_abc123: ..."
    const routerInput = mockRouteAgentMessage.mock.calls[0][0] as {
      conversationHistory: Array<{ role: string; content: string }>;
    };
    const hist = routerInput.conversationHistory;

    // Expect 2 synthetic turns prepended before the user message (history length = 2,
    // since base history is [] + 2 synthetic = 2).
    expect(hist).toHaveLength(2);
    expect(hist[0]?.role).toBe("assistant");
    expect(hist[0]?.content).toContain("Client tools were called");
    expect(hist[1]?.role).toBe("user");
    expect(hist[1]?.content).toContain("Client tool results");
    expect(hist[1]?.content).toContain("call_abc123");
    expect(hist[1]?.content).toContain("/dashboard/schedule navigated");
  });

  // ── Test 9: resolver error → bundle undefined, no clientToolNames ─────────────

  it("resolver error: bundle undefined in routeAgentMessage call; response 200", async () => {
    // Arrange: flag on, resolver throws. Bundle must NOT be passed.
    mockHarnessEnabled.mockReturnValue(true);
    mockResolveChatTools.mockRejectedValue(new Error("adapter crash"));

    const app = buildTestApp();
    const res = await app.request("/agent/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: makeChatBody(),
    });

    expect(res.status).toBe(200);
    expect(mockRouteAgentMessage).toHaveBeenCalledOnce();

    // When resolver errors, bundle MUST be absent (undefined) from routeAgentMessage.
    const routerInput = mockRouteAgentMessage.mock.calls[0][0] as {
      bundle: unknown;
      clientToolNames: unknown;
    };
    expect(routerInput.bundle).toBeUndefined();
    expect(routerInput.clientToolNames).toBeUndefined();
  });
});
