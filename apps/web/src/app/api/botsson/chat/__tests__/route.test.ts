/**
 * route.test.ts — ADR-0151 forge-test for POST /api/botsson/chat
 *
 * SE-02-01 finding: body.primeContext.profileId was interpolated into the LLM
 * context prefix without server-verification. An admin could forge a different
 * employee's profile_id to inject false identity into LLM history.
 *
 * Fix: the route now server-verifies the body-supplied profileId against the
 * workspace membership table. Only the server-verified value is used in the
 * LLM context. Forged or non-existent profile IDs are silently dropped.
 *
 * These tests verify:
 *   1. Forged body.primeContext.profileId (not in workspace) → context line OMITTED
 *   2. Valid body.primeContext.profileId (server-verified) → context line INCLUDED
 *   3. The server-verified profile_id (not body value) is used in the forward payload
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
