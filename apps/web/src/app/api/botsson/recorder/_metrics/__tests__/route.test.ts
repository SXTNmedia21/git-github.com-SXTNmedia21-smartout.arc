/**
 * BFF tests for GET /api/botsson/recorder/_metrics (ADR-0184 Phase 2a).
 *
 * Godmode-only proxy to the stage-engine /recorder/metrics introspection
 * endpoint. Used by the recorder-failure-resilience E2E spec to assert the
 * ADR-0184 Q8b invariant (recorder must never block Emma).
 *
 * Locks contracts:
 * 1. 401 when unauthenticated.
 * 2. 403 when caller is not godmode (workspace admin insufficient).
 * 3. 200 happy path proxies stage-engine response unchanged.
 * 4. 502 when stage-engine is unreachable or returns non-OK.
 * 5. recorder_blocking_emma is always false (Q8b invariant).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const { createClientMock, envMock } = vi.hoisted(() => ({
  createClientMock: vi.fn(),
  envMock: {
    STAGE_ENGINE_URL: "http://localhost:5010",
    STAGE_ENGINE_API_KEY: "stub-test-key",
  },
}));

vi.mock("@smartout/supabase/server", () => ({ createClient: createClientMock }));
vi.mock("@/env", () => ({ env: envMock }));

function makeReq(): Request {
  return new Request("http://localhost/api/botsson/recorder/_metrics", { method: "GET" });
}

function mockSupabase(opts: {
  user: { id: string } | null;
  identity?: { user_id: string; is_godmode: boolean } | null;
}) {
  const getUser = vi.fn().mockResolvedValue({ data: { user: opts.user }, error: null });
  const identityQuery = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: opts.identity ?? null, error: null }),
  };
  const from = vi.fn((table: string) => {
    if (table === "user_identity") return identityQuery;
    throw new Error(`Unexpected table: ${table}`);
  });
  createClientMock.mockResolvedValue({ auth: { getUser }, from });
  return { from, identityQuery };
}

describe("GET /api/botsson/recorder/_metrics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it("returns 401 when unauthenticated", async () => {
    mockSupabase({ user: null });
    const { GET } = await import("../route");
    const res = await GET(makeReq());
    expect(res.status).toBe(401);
  });

  it("returns 403 when caller is not godmode (identity missing)", async () => {
    mockSupabase({ user: { id: "u1" }, identity: null });
    const { GET } = await import("../route");
    const res = await GET(makeReq());
    expect(res.status).toBe(403);
  });

  it("returns 403 when caller is not godmode (is_godmode=false)", async () => {
    mockSupabase({ user: { id: "u1" }, identity: { user_id: "u1", is_godmode: false } });
    const { GET } = await import("../route");
    const res = await GET(makeReq());
    expect(res.status).toBe(403);
  });

  it("happy path: proxies stage-engine response with recorder_blocking_emma=false", async () => {
    mockSupabase({ user: { id: "u1" }, identity: { user_id: "u1", is_godmode: true } });
    const fetchStub = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          buffer_size: 5,
          drop_count: 2,
          error_count: 1,
          recorder_blocking_emma: false,
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchStub);

    const { GET } = await import("../route");
    const res = await GET(makeReq());

    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.buffer_size).toBe(5);
    expect(body.drop_count).toBe(2);
    expect(body.error_count).toBe(1);
    expect(body.recorder_blocking_emma).toBe(false);

    // Forwards x-api-key header so stage-engine auth accepts the call.
    expect(fetchStub).toHaveBeenCalledTimes(1);
    const [, init] = fetchStub.mock.calls[0]!;
    expect((init as RequestInit).headers).toMatchObject({
      "x-api-key": "stub-test-key",
    });
  });

  it("returns 502 when stage-engine is unreachable", async () => {
    mockSupabase({ user: { id: "u1" }, identity: { user_id: "u1", is_godmode: true } });
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNREFUSED")));
    const { GET } = await import("../route");
    const res = await GET(makeReq());
    expect(res.status).toBe(502);
  });

  it("returns 502 when stage-engine responds with non-OK", async () => {
    mockSupabase({ user: { id: "u1" }, identity: { user_id: "u1", is_godmode: true } });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("upstream boom", { status: 500 })),
    );
    const { GET } = await import("../route");
    const res = await GET(makeReq());
    expect(res.status).toBe(502);
  });
});
