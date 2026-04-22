/**
 * BFF tests for GET /api/botsson/recorder/sessions/[id] (ADR-0184).
 *
 * Locks four contracts:
 * 1. 401 when unauthenticated.
 * 2. 404 when no turns exist (RLS may return empty for workspace mismatch too).
 * 3. 200 happy path — returns ordered turns.
 * 4. Response shape: { session_id, workspace_id, turn_count, turns }.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const { createClientMock } = vi.hoisted(() => ({
  createClientMock: vi.fn(),
}));

vi.mock("@smartout/supabase/server", () => ({ createClient: createClientMock }));

const WS_ID = "11111111-1111-4111-8111-111111111111";
const SESSION_ID = "44444444-4444-4444-8444-444444444444";

function makeReq(): Request {
  return new Request(`http://localhost/api/botsson/recorder/sessions/${SESSION_ID}`);
}

function mockSupabase(opts: { user: { id: string } | null; turns: unknown; error?: unknown }) {
  const getUser = vi.fn().mockResolvedValue({ data: { user: opts.user }, error: null });

  const query = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockResolvedValue({ data: opts.turns, error: opts.error ?? null }),
  };

  const from = vi.fn(() => query);
  createClientMock.mockResolvedValue({ auth: { getUser }, from });
  return { from, query };
}

describe("GET /api/botsson/recorder/sessions/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    mockSupabase({ user: null, turns: [] });
    const { GET } = await import("../route");
    const res = await GET(makeReq(), { params: Promise.resolve({ id: SESSION_ID }) });
    expect(res.status).toBe(401);
  });

  it("returns 404 when no turns exist for session", async () => {
    mockSupabase({ user: { id: "u1" }, turns: [] });
    const { GET } = await import("../route");
    const res = await GET(makeReq(), { params: Promise.resolve({ id: SESSION_ID }) });
    expect(res.status).toBe(404);
  });

  it("returns 404 when data is null (RLS-filtered or not found)", async () => {
    mockSupabase({ user: { id: "u1" }, turns: null });
    const { GET } = await import("../route");
    const res = await GET(makeReq(), { params: Promise.resolve({ id: SESSION_ID }) });
    expect(res.status).toBe(404);
  });

  it("returns 500 when the query errors", async () => {
    mockSupabase({
      user: { id: "u1" },
      turns: null,
      error: { message: "db boom" },
    });
    const { GET } = await import("../route");
    const res = await GET(makeReq(), { params: Promise.resolve({ id: SESSION_ID }) });
    expect(res.status).toBe(500);
  });

  it("happy path: returns ordered turns", async () => {
    const turns = [
      {
        id: "t1",
        session_id: SESSION_ID,
        workspace_id: WS_ID,
        turn_index: 0,
        turn_kind: "user_input",
        phase: "classifier_input",
      },
      {
        id: "t2",
        session_id: SESSION_ID,
        workspace_id: WS_ID,
        turn_index: 1,
        turn_kind: "agent_response",
        phase: "llm_response",
      },
    ];
    const { query } = mockSupabase({ user: { id: "u1" }, turns });

    const { GET } = await import("../route");
    const res = await GET(makeReq(), { params: Promise.resolve({ id: SESSION_ID }) });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.session_id).toBe(SESSION_ID);
    expect(body.workspace_id).toBe(WS_ID);
    expect(body.turn_count).toBe(2);
    expect(body.turns).toHaveLength(2);

    // Ensures we ordered by turn_index (asc)
    expect(query.order).toHaveBeenCalledWith("turn_index");
    // Scoped by session_id
    expect(query.eq).toHaveBeenCalledWith("session_id", SESSION_ID);
  });
});
