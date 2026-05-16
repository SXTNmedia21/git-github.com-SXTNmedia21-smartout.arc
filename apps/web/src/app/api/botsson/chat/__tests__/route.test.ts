/**
 * route.test.ts — Integration tests for POST /api/botsson/chat
 *
 * SE-02-01 finding: body.primeContext.profileId was interpolated into the LLM
 * context prefix without server-verification. An admin could forge a different
 * employee's profile_id to inject false identity into LLM history.
 *
 * Fix: the route now server-verifies the body-supplied profileId against the
 * workspace membership table. Only the server-verified value is used in the
 * LLM context. Forged or non-existent profile IDs are silently dropped.
 *
 * ADR-0151 forge-protection tests verify:
 *   1. Forged body.primeContext.profileId (not in workspace) → context line OMITTED
 *   2. Valid body.primeContext.profileId (server-verified) → context line INCLUDED
 *   3. The server-verified profile_id (not body value) is used in the forward payload
 *
 * Phase 3 harness client_tools tests verify:
 *   4. POST body without client_tools → forwarded WITHOUT the field
 *   5. POST body WITH client_tools array → forwarded WITH field intact (exact shape)
 *   6. Malformed client_tools (missing modelToolName) → 400 response from Zod parse
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

// ── Stable UUIDs for test fixtures ──────────────────────────────────────────
const WORKSPACE_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const ADMIN_USER_ID = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const ADMIN_PROFILE_ID = "cccccccc-cccc-cccc-cccc-cccccccccccc";
const REAL_EMPLOYEE_PROFILE_ID = "dddddddd-dddd-dddd-dddd-dddddddddddd";
const FORGED_PROFILE_ID = "ffffffff-ffff-ffff-ffff-ffffffffffff";
const EMPLOYEE_NAME = "Kari Normann";

// ── Hoisted mocks ────────────────────────────────────────────────────────────
const mockGetUser = vi.fn();
const mockGetSession = vi.fn();
const mockAdminFrom = vi.fn();
const mockFetch = vi.fn();

vi.mock("@smartout/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: {
      getUser: mockGetUser,
      getSession: mockGetSession,
    },
  })),
}));

vi.mock("@smartout/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({
    from: mockAdminFrom,
    auth: {
      // Bearer path via admin (not used in cookie-path tests)
      getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: new Error("noop") }),
    },
  })),
}));

// Mock botsson-context-snapshot so tests don't need DB access
vi.mock("@/lib/botsson-context-snapshot", () => ({
  assembleBotssonContext: vi.fn().mockResolvedValue({ error: "mocked" }),
  isBotssonContextError: vi.fn().mockReturnValue(true),
  stripUserContextForWire: vi.fn(),
}));

vi.mock("@/env", () => ({
  env: {
    STAGE_ENGINE_URL: "http://stage-engine.test",
    STAGE_ENGINE_API_KEY: "test-api-key",
  },
}));

// ── Helper builders ──────────────────────────────────────────────────────────

/**
 * Builds the DB query chain for admin.from("profile").select(...).eq(...).eq(...).maybeSingle()
 * Returns the resolved value from maybeSingle().
 */
function buildProfileChain(result: { data: unknown; error: unknown }) {
  const maybeSingle = vi.fn().mockResolvedValue(result);
  const eq2 = vi.fn().mockReturnValue({ maybeSingle });
  const eq1 = vi.fn().mockReturnValue({ eq: eq2 });
  const select = vi.fn().mockReturnValue({ eq: eq1 });
  return { select, chain: { select } };
}

/**
 * Creates the mock chain for the two separate admin.from("profile") calls:
 *   1. Admin membership check (user_id + workspace_id → returns admin profile)
 *   2. Subject profile verification (profile_id + workspace_id → returns employee or null)
 */
function buildAdminFromSequence(
  adminProfileResult: { data: unknown; error: unknown },
  subjectProfileResult: { data: unknown; error: unknown },
) {
  let callCount = 0;
  mockAdminFrom.mockImplementation(() => {
    callCount++;
    if (callCount === 1) {
      // First from("profile") → admin membership check
      const chain = buildProfileChain(adminProfileResult);
      return chain.chain;
    } else {
      // Second from("profile") → subject profile verification (SE-02-01 guard)
      const chain = buildProfileChain(subjectProfileResult);
      return chain.chain;
    }
  });
}

/** Builds a minimal NextRequest for the botsson/chat endpoint */
function buildRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest("http://localhost/api/botsson/chat", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

/** Stage-engine stub that returns a success response and captures the forwarded body */
function stageEngineSuccess() {
  let capturedBody: Record<string, unknown> | null = null;
  const fetchSpy = vi.fn().mockImplementation(async (_url: string, init: RequestInit) => {
    capturedBody = JSON.parse(init.body as string) as Record<string, unknown>;
    return new Response(JSON.stringify({ session_id: "sess-001", response: "ok", intent: null }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  });
  return { fetchSpy, getCapturedBody: () => capturedBody };
}

// ── Test setup ───────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal("fetch", mockFetch);

  // Default cookie-path auth: authenticated user
  mockGetUser.mockResolvedValue({ data: { user: { id: ADMIN_USER_ID } }, error: null });
  mockGetSession.mockResolvedValue({
    data: { session: { access_token: "jwt-token-abc" } },
    error: null,
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// ── Tests ────────────────────────────────────────────────────────────────────

describe("POST /api/botsson/chat — SE-02-01 profileId forge protection (ADR-0151)", () => {
  it("forged primeContext.profileId that does not exist in workspace is silently dropped from LLM context", async () => {
    // Forged profile_id: exists in body but NOT in the workspace
    buildAdminFromSequence(
      // Admin membership check → admin profile found
      { data: { profile_id: ADMIN_PROFILE_ID, role: "admin", status: "active" }, error: null },
      // Subject profile verification → NOT FOUND (forge rejected)
      { data: null, error: null },
    );

    const { fetchSpy, getCapturedBody } = stageEngineSuccess();
    vi.stubGlobal("fetch", fetchSpy);

    const { POST } = await import("../route");
    const req = buildRequest({
      workspaceId: WORKSPACE_ID,
      userMessage: "Hva er statusen?",
      primeContext: {
        kind: "view_employee",
        profileId: FORGED_PROFILE_ID,
        profileName: EMPLOYEE_NAME,
      },
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const body = getCapturedBody();
    // The forged profile_id must NOT appear in the message forwarded to stage-engine
    expect(body?.message).not.toContain(FORGED_PROFILE_ID);
    // The forged name must NOT appear tied to a profileId in LLM context
    expect(body?.message).not.toContain(`profile_id: ${FORGED_PROFILE_ID}`);
  });

  it("forged primeContext.profileId is ignored — stage-engine still receives correct admin profile_id", async () => {
    buildAdminFromSequence(
      { data: { profile_id: ADMIN_PROFILE_ID, role: "admin", status: "active" }, error: null },
      // Forge: subject lookup returns null (not in workspace)
      { data: null, error: null },
    );

    const { fetchSpy, getCapturedBody } = stageEngineSuccess();
    vi.stubGlobal("fetch", fetchSpy);

    const { POST } = await import("../route");
    const req = buildRequest({
      workspaceId: WORKSPACE_ID,
      userMessage: "Vis meg info",
      primeContext: {
        kind: "view_employee",
        profileId: FORGED_PROFILE_ID,
        profileName: EMPLOYEE_NAME,
      },
    });

    await POST(req);
    const body = getCapturedBody();

    // stage-engine receives the server-derived admin profile_id as profile_id field
    expect(body?.profile_id).toBe(ADMIN_PROFILE_ID);
    // The FORGED value must not appear in profile_id
    expect(body?.profile_id).not.toBe(FORGED_PROFILE_ID);
  });

  it("valid primeContext.profileId (server-verified in workspace) is included in LLM context", async () => {
    buildAdminFromSequence(
      { data: { profile_id: ADMIN_PROFILE_ID, role: "admin", status: "active" }, error: null },
      // Subject profile lookup → FOUND (real employee in workspace)
      { data: { profile_id: REAL_EMPLOYEE_PROFILE_ID }, error: null },
    );

    const { fetchSpy, getCapturedBody } = stageEngineSuccess();
    vi.stubGlobal("fetch", fetchSpy);

    const { POST } = await import("../route");
    const req = buildRequest({
      workspaceId: WORKSPACE_ID,
      userMessage: "Se på ansatt",
      primeContext: {
        kind: "view_employee",
        profileId: REAL_EMPLOYEE_PROFILE_ID,
        profileName: EMPLOYEE_NAME,
      },
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const body = getCapturedBody();
    // Server-verified employee profile_id should appear in the LLM context message
    expect(body?.message).toContain(REAL_EMPLOYEE_PROFILE_ID);
    expect(body?.message).toContain(EMPLOYEE_NAME);
  });

  it("returns 403 when caller is not admin/owner", async () => {
    // Only one from() call needed — admin check returns employee role
    mockAdminFrom.mockReturnValue(
      buildProfileChain({
        data: { profile_id: ADMIN_PROFILE_ID, role: "employee", status: "active" },
        error: null,
      }).chain,
    );

    const { POST } = await import("../route");
    const req = buildRequest({
      workspaceId: WORKSPACE_ID,
      userMessage: "Test",
    });

    const res = await POST(req);
    expect(res.status).toBe(403);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("returns 401 when not authenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: new Error("no session") });
    mockGetSession.mockResolvedValue({ data: { session: null }, error: null });

    const { POST } = await import("../route");
    const req = buildRequest({
      workspaceId: WORKSPACE_ID,
      userMessage: "Test",
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

// ── Phase 3 harness: client_tools forward tests ──────────────────────────────

describe("POST /api/botsson/chat — Phase 3 harness client_tools forwarding", () => {
  /** Minimal valid ClientToolDefinition fixture */
  const VALID_CLIENT_TOOL = {
    temporaryTool: {
      modelToolName: "navigate_to_shift",
      description: "Navigate the schedule view to a specific shift",
      dynamicParameters: [
        {
          name: "shift_id",
          location: "PARAMETER_LOCATION_BODY",
          description: "UUID of the shift to navigate to",
          required: true,
          schema: { type: "string" as const },
        },
      ],
      client: {},
    },
  };

  beforeEach(() => {
    // Default: authenticated admin
    mockGetUser.mockResolvedValue({ data: { user: { id: ADMIN_USER_ID } }, error: null });
    mockGetSession.mockResolvedValue({
      data: { session: { access_token: "jwt-token-abc" } },
      error: null,
    });

    // Single from("profile") call — admin check only (no primeContext in these tests)
    mockAdminFrom.mockReturnValue(
      buildProfileChain({
        data: { profile_id: ADMIN_PROFILE_ID, role: "admin", status: "active" },
        error: null,
      }).chain,
    );
  });

  it("POST body WITHOUT client_tools → stage-engine receives no client_tools field", async () => {
    const { fetchSpy, getCapturedBody } = stageEngineSuccess();
    vi.stubGlobal("fetch", fetchSpy);

    const { POST } = await import("../route");
    const req = buildRequest({
      workspaceId: WORKSPACE_ID,
      userMessage: "Vis meg vaktplanen",
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const forwarded = getCapturedBody();
    // Field must be absent — not forwarded as undefined or null
    expect(forwarded).not.toHaveProperty("client_tools");
  });

  it("POST body WITH client_tools array → stage-engine receives the field with exact shape", async () => {
    const { fetchSpy, getCapturedBody } = stageEngineSuccess();
    vi.stubGlobal("fetch", fetchSpy);

    const { POST } = await import("../route");
    const req = buildRequest({
      workspaceId: WORKSPACE_ID,
      userMessage: "Naviger til vakten",
      client_tools: [VALID_CLIENT_TOOL],
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const forwarded = getCapturedBody();
    // Field must be present
    expect(forwarded).toHaveProperty("client_tools");
    // Shape must be preserved verbatim — no re-encoding
    expect(forwarded?.client_tools).toEqual([VALID_CLIENT_TOOL]);
    // Verify nested fields are intact
    const tool = (forwarded?.client_tools as (typeof VALID_CLIENT_TOOL)[])[0];
    expect(tool?.temporaryTool.modelToolName).toBe("navigate_to_shift");
    expect(tool?.temporaryTool.dynamicParameters).toHaveLength(1);
    expect(tool?.temporaryTool.client).toEqual({});
  });

  it("POST body WITH empty client_tools array → stage-engine receives empty array", async () => {
    const { fetchSpy, getCapturedBody } = stageEngineSuccess();
    vi.stubGlobal("fetch", fetchSpy);

    const { POST } = await import("../route");
    const req = buildRequest({
      workspaceId: WORKSPACE_ID,
      userMessage: "Test",
      client_tools: [],
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const forwarded = getCapturedBody();
    // Explicit empty array is forwarded as-is (not stripped)
    expect(forwarded).toHaveProperty("client_tools");
    expect(forwarded?.client_tools).toEqual([]);
  });

  it("malformed client_tools (missing required modelToolName) → 400 from Zod validation", async () => {
    const { fetchSpy } = stageEngineSuccess();
    vi.stubGlobal("fetch", fetchSpy);

    const { POST } = await import("../route");
    const req = buildRequest({
      workspaceId: WORKSPACE_ID,
      userMessage: "Test",
      client_tools: [
        {
          temporaryTool: {
            // modelToolName intentionally omitted — required field
            description: "Missing modelToolName",
            dynamicParameters: [],
            client: {},
          },
        },
      ],
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    // stage-engine must NOT be called — validation rejects before proxy
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("malformed client_tools (wrong type for dynamicParameters) → 400 from Zod validation", async () => {
    const { fetchSpy } = stageEngineSuccess();
    vi.stubGlobal("fetch", fetchSpy);

    const { POST } = await import("../route");
    const req = buildRequest({
      workspaceId: WORKSPACE_ID,
      userMessage: "Test",
      client_tools: [
        {
          temporaryTool: {
            modelToolName: "some_tool",
            description: "Bad dynamicParameters",
            dynamicParameters: "not-an-array", // wrong type
            client: {},
          },
        },
      ],
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

// ── Phase 3.5b harness: client_tool roundtrip tests ───────────────────────────

describe("POST /api/botsson/chat — Phase 3.5b harness client_tool roundtrip", () => {
  /** Minimal valid ClientToolCallResult fixture */
  const VALID_TOOL_RESULT = {
    tool_call_id: "call_abc123",
    result: "Navigated to shift 123",
    is_error: false,
  };

  /** Minimal valid ClientToolCall fixture (as returned by stage-engine) */
  const STAGE_ENGINE_TOOL_CALL = {
    tool_call_id: "call_abc123",
    name: "navigate_to_shift",
    arguments: { shift_id: "shift-uuid-001" },
  };

  beforeEach(() => {
    mockGetUser.mockResolvedValue({ data: { user: { id: ADMIN_USER_ID } }, error: null });
    mockGetSession.mockResolvedValue({
      data: { session: { access_token: "jwt-token-abc" } },
      error: null,
    });

    mockAdminFrom.mockReturnValue(
      buildProfileChain({
        data: { profile_id: ADMIN_PROFILE_ID, role: "admin", status: "active" },
        error: null,
      }).chain,
    );
  });

  it("client_tool_results present in POST body → forwarded to stage-engine with field intact", async () => {
    let capturedBody: Record<string, unknown> | null = null;
    const fetchSpy = vi.fn().mockImplementation(async (_url: string, init: RequestInit) => {
      capturedBody = JSON.parse(init.body as string) as Record<string, unknown>;
      return new Response(
        JSON.stringify({ session_id: "sess-002", response: "Done", intent: null }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      );
    });
    vi.stubGlobal("fetch", fetchSpy);

    const { POST } = await import("../route");
    const req = buildRequest({
      workspaceId: WORKSPACE_ID,
      userMessage: "Continue",
      sessionId: "11111111-1111-1111-1111-111111111111",
      client_tool_results: [VALID_TOOL_RESULT],
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    // client_tool_results must be forwarded verbatim
    expect(capturedBody).toHaveProperty("client_tool_results");
    const body = capturedBody as Record<string, unknown> | null;
    expect(body?.client_tool_results).toEqual([VALID_TOOL_RESULT]);
    const result = (body?.client_tool_results as (typeof VALID_TOOL_RESULT)[])[0];
    expect(result?.tool_call_id).toBe("call_abc123");
    expect(result?.result).toBe("Navigated to shift 123");
    expect(result?.is_error).toBe(false);
  });

  it("stage-engine response with client_tool_calls → propagated to client response body", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          session_id: "sess-003",
          response: "",
          intent: null,
          client_tool_calls: [STAGE_ENGINE_TOOL_CALL],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchSpy);

    const { POST } = await import("../route");
    const req = buildRequest({
      workspaceId: WORKSPACE_ID,
      userMessage: "Naviger til vakten",
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const body = (await res.json()) as Record<string, unknown>;
    // client_tool_calls must be present in the response to the browser
    expect(body).toHaveProperty("client_tool_calls");
    expect(body.client_tool_calls).toEqual([STAGE_ENGINE_TOOL_CALL]);
    const call = (body.client_tool_calls as (typeof STAGE_ENGINE_TOOL_CALL)[])[0];
    expect(call?.tool_call_id).toBe("call_abc123");
    expect(call?.name).toBe("navigate_to_shift");
    expect(call?.arguments).toEqual({ shift_id: "shift-uuid-001" });
  });

  it("malformed client_tool_results (missing tool_call_id) → 400 from Zod validation", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const { POST } = await import("../route");
    const req = buildRequest({
      workspaceId: WORKSPACE_ID,
      userMessage: "Continue",
      client_tool_results: [
        {
          // tool_call_id intentionally omitted — required field
          result: "some result",
        },
      ],
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    // stage-engine must NOT be called — validation rejects before proxy
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
