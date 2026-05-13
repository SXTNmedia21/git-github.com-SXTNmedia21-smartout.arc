/**
 * BFF auth-path tests for /api/emma/chat (ADR-0132).
 *
 * Locks two contracts:
 * 1. Bearer (mobile) auth path — validates token via admin client, does NOT
 *    call getSession(). The raw token IS the access_token forwarded to
 *    stage-engine.
 * 2. Cookie (web) auth path — uses createClient() session as before.
 *
 * Also locks the status-passthrough contract (401/403/404/409 from
 * stage-engine surface to mobile per agent-coord council R1, hop 7).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const { createClientMock, createAdminClientMock, fetchMock } = vi.hoisted(() => ({
  createClientMock: vi.fn(),
  createAdminClientMock: vi.fn(),
  fetchMock: vi.fn(),
}));

vi.mock("@smartout/supabase/server", () => ({
  createClient: createClientMock,
}));

vi.mock("@smartout/supabase/admin", () => ({
  createAdminClient: createAdminClientMock,
}));

vi.mock("@/env", () => ({
  env: {
    STAGE_ENGINE_URL: "http://stage-engine.test",
    STAGE_ENGINE_API_KEY: "test-key",
  },
}));

vi.stubGlobal("fetch", fetchMock);

// Minimal valid request body
const VALID_BODY = {
  workspaceId: "11111111-1111-4111-8111-111111111111",
  userMessage: "Hva er neste vakt?",
};

const PROFILE_ROW = {
  profile_id: "33333333-3333-4333-8333-333333333333",
  role: "employee",
  status: "active",
};

// Chainable proxy mock that handles BOTH:
//   - The auth profile lookup: from("profile").select().eq("user_id",x).eq("workspace_id",y).maybeSingle()
//     → returns PROFILE_ROW (so auth path resolves and route reaches stage-engine fetch).
//   - The S4 workforce-bootstrap snapshot in botsson-context-snapshot.ts (workspace + season + binding +
//     planning_cycle + employees/shifts/absences/sessions). Snapshot is fail-soft (ADR-0297, route.ts:226)
//     so empty/null returns are fine — chat still proxies to stage-engine.
// Behavior keyed by table name: profile.maybeSingle() → PROFILE_ROW; all other tables → null/[].
function makeProfileQueryMock() {
  const buildChain = (table: string): Record<string, unknown> => {
    const chain: Record<string, unknown> = {};
    chain.select = vi.fn().mockImplementation(() => chain);
    chain.eq = vi.fn().mockImplementation(() => chain);
    chain.gte = vi.fn().mockImplementation(() => chain);
    chain.lte = vi.fn().mockImplementation(() => chain);
    chain.in = vi.fn().mockImplementation(() => chain);
    chain.order = vi.fn().mockImplementation(() => chain);
    chain.limit = vi.fn().mockImplementation(() => chain);
    chain.maybeSingle = vi
      .fn()
      .mockResolvedValue(
        table === "profile" ? { data: PROFILE_ROW, error: null } : { data: null, error: null },
      );
    chain.single = vi.fn().mockResolvedValue({ data: null, error: null });
    // Thenable for await-without-terminal (snapshot's .limit() array queries).
    chain.then = (resolve: (v: { data: unknown[]; error: null }) => void) =>
      resolve({ data: [], error: null });
    return chain;
  };
  return { from: vi.fn().mockImplementation((table: string) => buildChain(table)) };
}

function makeRequest(opts: { authHeader?: string; body?: unknown } = {}) {
  const body = opts.body ?? VALID_BODY;
  return {
    headers: {
      get: (name: string) =>
        name.toLowerCase() === "authorization" ? (opts.authHeader ?? null) : null,
    },
    json: async () => body,
  } as unknown as import("next/server").NextRequest;
}

describe("/api/emma/chat — auth paths (ADR-0132)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("Bearer path: validates via admin.auth.getUser(token) — does NOT call getSession()", async () => {
    const adminGetUserMock = vi
      .fn()
      .mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
    const adminProfile = makeProfileQueryMock();
    createAdminClientMock.mockReturnValue({
      auth: { getUser: adminGetUserMock },
      from: adminProfile.from,
    });
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ session_id: "sess-1", response: "Hei!" }),
    });

    const { POST } = await import("../route");
    const res = await POST(makeRequest({ authHeader: "Bearer token-abc" }));

    // Cookie client never called on Bearer path
    expect(createClientMock).not.toHaveBeenCalled();
    // Token validated via admin
    expect(adminGetUserMock).toHaveBeenCalledWith("token-abc");
    // Stage-engine receives the raw token as user_jwt
    const stageEngineCall = fetchMock.mock.calls[0]!;
    const stageEngineBody = JSON.parse(stageEngineCall[1].body);
    expect(stageEngineBody.user_jwt).toBe("token-abc");
    expect(stageEngineBody.channel).toBe("chat"); // forced server-side
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.text).toBe("Hei!");
    expect(data.authMethod).toBe("bearer");
  });

  it("Cookie path: uses createClient() session.access_token as user_jwt", async () => {
    const cookieGetUser = vi.fn().mockResolvedValue({
      data: { user: { id: "user-2" } },
      error: null,
    });
    const cookieGetSession = vi.fn().mockResolvedValue({
      data: { session: { access_token: "cookie-jwt-xyz" } },
      error: null,
    });
    createClientMock.mockResolvedValue({
      auth: { getUser: cookieGetUser, getSession: cookieGetSession },
    });
    const adminProfile = makeProfileQueryMock();
    createAdminClientMock.mockReturnValue({
      auth: { getUser: vi.fn() },
      from: adminProfile.from,
    });
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ session_id: "sess-2", response: "OK" }),
    });

    const { POST } = await import("../route");
    const res = await POST(makeRequest({ authHeader: undefined }));

    expect(createClientMock).toHaveBeenCalledOnce();
    const stageEngineBody = JSON.parse(fetchMock.mock.calls[0]![1].body);
    expect(stageEngineBody.user_jwt).toBe("cookie-jwt-xyz");
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.authMethod).toBe("cookie");
  });

  it("Bearer path: returns 401 when admin.auth.getUser rejects the token", async () => {
    createAdminClientMock.mockReturnValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: { message: "expired" } }),
      },
      from: vi.fn(),
    });

    const { POST } = await import("../route");
    const res = await POST(makeRequest({ authHeader: "Bearer bad-token" }));

    expect(res.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("Status passthrough: stage-engine 403 surfaces as 403 (not 500)", async () => {
    createAdminClientMock.mockReturnValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "u" } }, error: null }) },
      from: makeProfileQueryMock().from,
    });
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 403,
      json: async () => ({ error: "FORBIDDEN", message: "workspace mismatch" }),
    });

    const { POST } = await import("../route");
    const res = await POST(makeRequest({ authHeader: "Bearer t" }));

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe("FORBIDDEN");
    expect(body.message).toBe("workspace mismatch");
  });

  it("Status passthrough: stage-engine 404 (session not found) surfaces as 404", async () => {
    createAdminClientMock.mockReturnValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "u" } }, error: null }) },
      from: makeProfileQueryMock().from,
    });
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: async () => ({ error: "NOT_FOUND", message: "session expired" }),
    });

    const { POST } = await import("../route");
    const res = await POST(makeRequest({ authHeader: "Bearer t" }));

    expect(res.status).toBe(404);
  });

  it("Status passthrough: stage-engine 500 surfaces as 500 (no leak of internal status)", async () => {
    createAdminClientMock.mockReturnValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "u" } }, error: null }) },
      from: makeProfileQueryMock().from,
    });
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 502,
      json: async () => ({ error: "BAD_GATEWAY", message: "upstream" }),
    });

    const { POST } = await import("../route");
    const res = await POST(makeRequest({ authHeader: "Bearer t" }));

    expect(res.status).toBe(500); // 502 collapses to 500 (only 401/403/404/409 pass through)
  });

  it('Channel forcing: server always sends channel: "chat" to stage-engine', async () => {
    createAdminClientMock.mockReturnValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "u" } }, error: null }) },
      from: makeProfileQueryMock().from,
    });
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ session_id: "s", response: "ok" }),
    });

    const { POST } = await import("../route");
    // Even if the client tries to inject channel, schema rejects it (no channel
    // field in RequestSchema) — this test verifies the forced value reaches engine.
    await POST(makeRequest({ authHeader: "Bearer t" }));

    const stageEngineBody = JSON.parse(fetchMock.mock.calls[0]![1].body);
    expect(stageEngineBody.channel).toBe("chat");
  });
});
