/**
 * BFF tests for POST /api/botsson/recorder/flag-session (ADR-0185 Phase 2a).
 *
 * Flags an entire session — updates every agent_session_recording row for
 * session_id AND workspace_id with is_flagged=true + flag_reason +
 * flagged_by_profile_id. Complements the per-turn /flag endpoint.
 *
 * Called from:
 *   - AdminActionDrawer "Flag hele sesjonen" (admin, workspace-scoped)
 *   - Arena LogView hover-flag (Phase 2b composition — will pass session_id
 *     once the UI is rewired to include it; until then the Zod check rejects
 *     the call and the alert-fallback fires)
 *
 * Locks contracts:
 * 1. 401 when unauthenticated.
 * 2. 400 when body is invalid (missing session_id OR reason too long).
 * 3. 403 when actor is not admin/owner.
 * 4. 404 when no turns match in the actor's workspace.
 * 5. 200 happy path — updates flagged_turn_count + emits recorder.session_flagged.
 *
 * ADR-0151: flagged_by_profile_id is resolved server-side from auth.uid().
 * ADR-0152: emit() fires with non-empty workspace_id + actor_id.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const { createClientMock, emitMock } = vi.hoisted(() => ({
  createClientMock: vi.fn(),
  emitMock: vi.fn(),
}));

vi.mock("@smartout/supabase/server", () => ({ createClient: createClientMock }));
vi.mock("@smartout/telemetry", () => ({ emit: emitMock, nonEmpty: (v: string) => v }));

const WS_ID = "11111111-1111-4111-8111-111111111111";
const PROFILE_ID = "22222222-2222-4222-8222-222222222222";
const SESSION_ID = "44444444-4444-4444-8444-444444444444";
const TURN_A = "55555555-5555-4555-8555-555555555555";
const TURN_B = "66666666-6666-4666-8666-666666666666";

function makeReq(body: unknown): Request {
  return new Request("http://localhost/api/botsson/recorder/flag-session", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

type QueryResult = { data: unknown; error: unknown };

function mockSupabase(opts: {
  user: { id: string } | null;
  profile?: { profile_id: string; workspace_id: string; role: string } | null;
  updateResult?: QueryResult;
}) {
  const getUser = vi.fn().mockResolvedValue({ data: { user: opts.user }, error: null });

  const profileQuery = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: opts.profile ?? null, error: null }),
  };

  // UPDATE ... WHERE session_id=$1 AND workspace_id=$2 RETURNING id
  const updateQuery = {
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    select: vi.fn().mockResolvedValue(opts.updateResult ?? { data: [], error: null }),
  };

  const from = vi.fn((table: string) => {
    if (table === "profile") return profileQuery;
    if (table === "agent_session_recording") return updateQuery;
    throw new Error(`Unexpected table: ${table}`);
  });

  createClientMock.mockResolvedValue({ auth: { getUser }, from });
  return { from, profileQuery, updateQuery };
}

describe("POST /api/botsson/recorder/flag-session", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    mockSupabase({ user: null });
    const { POST } = await import("../route");
    const res = await POST(makeReq({ session_id: SESSION_ID, reason: "nope" }));
    expect(res.status).toBe(401);
    expect(emitMock).not.toHaveBeenCalled();
  });

  it("returns 400 when session_id is missing", async () => {
    mockSupabase({
      user: { id: "u1" },
      profile: { profile_id: PROFILE_ID, workspace_id: WS_ID, role: "admin" },
    });
    const { POST } = await import("../route");
    const res = await POST(makeReq({ reason: "something" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when reason is missing", async () => {
    mockSupabase({
      user: { id: "u1" },
      profile: { profile_id: PROFILE_ID, workspace_id: WS_ID, role: "admin" },
    });
    const { POST } = await import("../route");
    const res = await POST(makeReq({ session_id: SESSION_ID }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when reason exceeds 500 chars", async () => {
    mockSupabase({
      user: { id: "u1" },
      profile: { profile_id: PROFILE_ID, workspace_id: WS_ID, role: "admin" },
    });
    const { POST } = await import("../route");
    const res = await POST(makeReq({ session_id: SESSION_ID, reason: "x".repeat(501) }));
    expect(res.status).toBe(400);
  });

  it("returns 403 when actor is not admin or owner", async () => {
    mockSupabase({
      user: { id: "u1" },
      profile: { profile_id: PROFILE_ID, workspace_id: WS_ID, role: "employee" },
    });
    const { POST } = await import("../route");
    const res = await POST(makeReq({ session_id: SESSION_ID, reason: "x" }));
    expect(res.status).toBe(403);
    expect(emitMock).not.toHaveBeenCalled();
  });

  it("returns 404 when session has no matching turns in workspace", async () => {
    mockSupabase({
      user: { id: "u1" },
      profile: { profile_id: PROFILE_ID, workspace_id: WS_ID, role: "admin" },
      updateResult: { data: [], error: null },
    });
    const { POST } = await import("../route");
    const res = await POST(makeReq({ session_id: SESSION_ID, reason: "x" }));
    expect(res.status).toBe(404);
    expect(emitMock).not.toHaveBeenCalled();
  });

  it("happy path: flags all turns + emits recorder.session_flagged with turn count", async () => {
    const { updateQuery } = mockSupabase({
      user: { id: "u1" },
      profile: { profile_id: PROFILE_ID, workspace_id: WS_ID, role: "admin" },
      updateResult: {
        data: [{ id: TURN_A }, { id: TURN_B }],
        error: null,
      },
    });

    const { POST } = await import("../route");
    const res = await POST(
      makeReq({
        session_id: SESSION_ID,
        reason: "cost runaway",
        entry_type: "tool_call",
        entry_content: "get_today_shifts",
        timestamp: 1714000000,
      }),
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.flagged_turn_count).toBe(2);
    expect(body.session_id).toBe(SESSION_ID);

    // update called with flagged fields + scoped by session AND workspace
    expect(updateQuery.update).toHaveBeenCalledWith(
      expect.objectContaining({
        is_flagged: true,
        flag_reason: "cost runaway",
        flagged_by_profile_id: PROFILE_ID,
      }),
    );

    expect(emitMock).toHaveBeenCalledTimes(1);
    const ev = emitMock.mock.calls[0]![0];
    expect(ev.event).toBe("recorder.session_flagged");
    expect(ev.workspace_id).toBe(WS_ID);
    expect(ev.actor_id).toBe(PROFILE_ID);
    expect(ev.properties.data.session_id).toBe(SESSION_ID);
    expect(ev.properties.data.flagged_turn_count).toBe(2);
    expect(ev.properties.data.reason).toBe("cost runaway");
    // Optional metadata from LogView passes through for audit context.
    expect(ev.properties.data.entry_type).toBe("tool_call");
  });

  it("owner role is also allowed", async () => {
    mockSupabase({
      user: { id: "u1" },
      profile: { profile_id: PROFILE_ID, workspace_id: WS_ID, role: "owner" },
      updateResult: { data: [{ id: TURN_A }], error: null },
    });
    const { POST } = await import("../route");
    const res = await POST(makeReq({ session_id: SESSION_ID, reason: "x" }));
    expect(res.status).toBe(200);
  });
});
