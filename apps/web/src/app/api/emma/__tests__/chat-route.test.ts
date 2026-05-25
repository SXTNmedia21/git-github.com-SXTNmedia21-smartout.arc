/**
 * chat-route.test.ts — ADR-0151 profile_id server-derivation enforcement
 *
 * Verifies that POST /api/emma/chat:
 *   1. Never accepts a body-supplied profile_id (Zod strips unknown fields).
 *   2. Returns 401 when no session is present.
 *   3. Returns 403 when session OK but user has no profile in the given workspace.
 *   4. Returns 200 and forwards the SERVER-DERIVED profile_id (not a body value)
 *      to stage-engine on a valid request.
 *   5. Bearer token path (mobile) produces same derivation.
 *
 * G9 / ADR-0151: profile_id MUST be server-derived. The RequestSchema does not
 * declare a profile_id field, so any body value is silently stripped by Zod.
 * workspaceId is body-supplied but validated via profile membership — the user
 * must own a real profile in that workspace.
 *
 * L-0177: fail-fast. No silent fallback. 4xx on missing auth or missing profile.
 *
 * Note: /api/emma/chat allows any authenticated profile role (unlike botsson/chat
 * which restricts to admin/owner). No role-gate test needed here.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

// ── Stable mock for env ────────────────────────────────────────────────────
vi.mock("@/env", () => ({
  env: {
    STAGE_ENGINE_URL: "http://stage-engine.test",
    STAGE_ENGINE_API_KEY: "test-se-key",
  },
}));

// ── Supabase mocks ─────────────────────────────────────────────────────────
const mockGetUser = vi.fn();
const mockGetSession = vi.fn();
const mockAdminGetUser = vi.fn();

// Profile lookup chain. Also used for context snapshot + conversation lookup.
// We need a flexible chain because emma/chat makes multiple .from() calls.
const mockMaybySingle = vi.fn();
const profileChain = {
  select: () => profileChain,
  eq: () => profileChain,
  maybeSingle: mockMaybySingle,
};

// Track from() calls so we can return different chains per table.
let fromCallCount = 0;
const mockAdminFrom = vi.fn((_table: string) => {
  fromCallCount++;
  return profileChain;
});

vi.mock("@smartout/supabase/server", () => ({
  createClient: vi.fn(() => ({
    auth: {
      getUser: mockGetUser,
      getSession: mockGetSession,
    },
  })),
}));

vi.mock("@smartout/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({
    auth: { getUser: mockAdminGetUser },
    from: mockAdminFrom,
    // insert is used by chat_message Phase B — not tested here, use no-op
    insert: vi.fn().mockResolvedValue({ error: null }),
  })),
}));

// ── Context snapshot mock ──────────────────────────────────────────────────
vi.mock("@/lib/botsson-context-snapshot", () => ({
  assembleBotssonContext: vi.fn().mockResolvedValue({ error: "mocked" }),
  isBotssonContextError: vi.fn().mockReturnValue(true),
  stripUserContextForWire: vi.fn().mockReturnValue({}),
}));

// ── Fetch mock (stage-engine proxy) ───────────────────────────────────────
let mockFetch: ReturnType<typeof vi.fn>;

// ── Shared test data ───────────────────────────────────────────────────────
const WORKSPACE_ID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
const PROFILE_ID_A = "11111111-2222-3333-4444-555555555555";
const PROFILE_ID_B = "66666666-7777-8888-9999-aaaaaaaaaaaa";
const USER_ID_A = "user-a-uuid-0000-0000-000000000001";
const ACCESS_TOKEN = "test-bearer-token";

function makeRequest(body: Record<string, unknown>, bearerToken?: string): NextRequest {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (bearerToken) {
    headers["authorization"] = `Bearer ${bearerToken}`;
  }
  return new NextRequest("http://localhost/api/emma/chat", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

function makeValidBody(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    workspaceId: WORKSPACE_ID,
    userMessage: "Hva er mine neste vakter?",
    ...overrides,
  };
}

function makeStageEngineOk(): Response {
  return new Response(JSON.stringify({ session_id: "sess-001", response: "Her er dine vakter." }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

describe("POST /api/emma/chat — ADR-0151 profile_id server-derivation (G9)", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    fromCallCount = 0;
    mockFetch = vi.fn().mockResolvedValue(makeStageEngineOk());
    vi.stubGlobal("fetch", mockFetch);

    // Default: valid cookie session
    mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID_A } }, error: null });
    mockGetSession.mockResolvedValue({
      data: { session: { access_token: ACCESS_TOKEN } },
      error: null,
    });
    mockAdminGetUser.mockResolvedValue({ data: { user: null }, error: null });

    // Default profile: any role, active status (emma/chat allows all roles)
    mockMaybySingle.mockResolvedValue({
      data: { profile_id: PROFILE_ID_A, role: "employee", status: "active" },
      error: null,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // ── J2 Happy path ─────────────────────────────────────────────────────────
  it("J2 — valid session + no body profile_id → 200 with server-derived profile_id", async () => {
    const { POST } = await import("../chat/route");
    const req = makeRequest(makeValidBody());
    const res = await POST(req);

    expect(res.status).toBe(200);

    const fetchCall = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(fetchCall).toBeDefined();
    const sentBody = JSON.parse(fetchCall[1].body as string) as Record<string, unknown>;
    // Server-derived profile_id must be forwarded (NOT any body value)
    expect(sentBody.profile_id).toBe(PROFILE_ID_A);
  });

  // ── J1 Forgery: body profile_id silently stripped ─────────────────────────
  it("J1 — forged body profile_id (B) with session for user A → stage-engine gets A's profile_id", async () => {
    const { POST } = await import("../chat/route");
    // Attacker supplies another user's profile_id — Zod strips it (not in schema)
    const req = makeRequest(makeValidBody({ profile_id: PROFILE_ID_B }));
    const res = await POST(req);

    expect(res.status).toBe(200);

    const fetchCall = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(fetchCall).toBeDefined();
    const sentBody = JSON.parse(fetchCall[1].body as string) as Record<string, unknown>;
    // Forgery fails: stage-engine receives A's derived profile_id, not B
    expect(sentBody.profile_id).toBe(PROFILE_ID_A);
    expect(sentBody.profile_id).not.toBe(PROFILE_ID_B);
  });

  // ── L-0177 fail-fast: no session → 401 ───────────────────────────────────
  it("no session → 401 (L-0177 fail-fast, no silent fallback)", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    mockGetSession.mockResolvedValue({ data: { session: null }, error: null });

    const { POST } = await import("../chat/route");
    const req = makeRequest(makeValidBody());
    const res = await POST(req);

    expect(res.status).toBe(401);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  // ── L-0177 fail-fast: no profile in workspace → 403 ─────────────────────
  it("session OK + no profile in workspace → 403 (membership enforced)", async () => {
    mockMaybySingle.mockResolvedValue({ data: null, error: null });

    const { POST } = await import("../chat/route");
    const req = makeRequest(makeValidBody());
    const res = await POST(req);

    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/profile not found/i);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  // ── Bearer path: mobile token ─────────────────────────────────────────────
  it("Bearer token path → validates via admin.auth.getUser, derives profile server-side", async () => {
    // Simulate no cookie session — mobile sends Bearer only
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    mockGetSession.mockResolvedValue({ data: { session: null }, error: null });
    // Admin Bearer validation succeeds
    mockAdminGetUser.mockResolvedValue({ data: { user: { id: USER_ID_A } }, error: null });

    const { POST } = await import("../chat/route");
    const req = makeRequest(makeValidBody(), ACCESS_TOKEN);
    const res = await POST(req);

    expect(res.status).toBe(200);
    const fetchCall = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(fetchCall).toBeDefined();
    const sentBody = JSON.parse(fetchCall[1].body as string) as Record<string, unknown>;
    expect(sentBody.profile_id).toBe(PROFILE_ID_A);
  });

  // ── Workspace is body-supplied but validated (membership check) ───────────
  // NOTE: workspaceId derivation from a trusted server source (JWT/header)
  // is not yet implemented — there is no middleware deriving workspace from
  // subdomain for API routes. The validation is: user must own a profile in
  // body.workspaceId. A multi-workspace user can submit any of their valid
  // workspace IDs. This is a known residual gap documented in HANDOFF-G9.
  // Full ADR-0151 compliance requires workspace derivation from session or
  // subdomain header — defer to follow-up sortie with middleware scope.
  it("invalid workspaceId (no membership) → 403 (membership validation enforced)", async () => {
    // Profile lookup returns null because user has no profile in this workspace
    mockMaybySingle.mockResolvedValue({ data: null, error: null });

    const { POST } = await import("../chat/route");
    const req = makeRequest(makeValidBody({ workspaceId: "ffffffff-0000-0000-0000-000000000001" }));
    const res = await POST(req);

    expect(res.status).toBe(403);
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
