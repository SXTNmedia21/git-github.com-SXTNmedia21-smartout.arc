/**
 * BFF tests for POST /api/botsson/recorder/flag (ADR-0184 Q13).
 *
 * Locks four contracts:
 * 1. 401 when unauthenticated.
 * 2. 400 when body is invalid.
 * 3. 403 when actor is not admin/owner.
 * 4. 200 happy path — updates is_flagged + emits recorder.turn_flagged.
 *
 * ADR-0151: profile_id is resolved server-side from auth.uid() — never
 * accepted from the request body.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const { createClientMock, emitMock } = vi.hoisted(() => ({
  createClientMock: vi.fn(),
  emitMock: vi.fn(),
}));

vi.mock("@smartout/supabase/server", () => ({
  createClient: createClientMock,
}));

vi.mock("@smartout/telemetry", () => ({
  emit: emitMock,
  nonEmpty: (v: string) => v,
}));

const WS_ID = "11111111-1111-4111-8111-111111111111";
const PROFILE_ID = "22222222-2222-4222-8222-222222222222";
const TURN_ID = "33333333-3333-4333-8333-333333333333";
const SESSION_ID = "44444444-4444-4444-8444-444444444444";

function makeReq(body: unknown): Request {
  return new Request("http://localhost/api/botsson/recorder/flag", {
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

  const updateQuery = {
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(opts.updateResult ?? { data: null, error: null }),
  };

  const from = vi.fn((table: string) => {
    if (table === "profile") return profileQuery;
    if (table === "agent_session_recording") return updateQuery;
    throw new Error(`Unexpected table: ${table}`);
  });

  createClientMock.mockResolvedValue({ auth: { getUser }, from });
  return { from, profileQuery, updateQuery };
}

describe("POST /api/botsson/recorder/flag", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    mockSupabase({ user: null });
    const { POST } = await import("../route");
    const res = await POST(makeReq({ turn_id: TURN_ID }));
    expect(res.status).toBe(401);
    expect(emitMock).not.toHaveBeenCalled();
  });

  it("returns 400 when turn_id is missing", async () => {
    mockSupabase({
      user: { id: "u1" },
      profile: { profile_id: PROFILE_ID, workspace_id: WS_ID, role: "admin" },
    });
    const { POST } = await import("../route");
    const res = await POST(makeReq({ reason: "nope" }));
    expect(res.status).toBe(400);
    expect(emitMock).not.toHaveBeenCalled();
  });

  it("returns 400 when reason exceeds 500 chars", async () => {
    mockSupabase({
      user: { id: "u1" },
      profile: { profile_id: PROFILE_ID, workspace_id: WS_ID, role: "admin" },
    });
    const { POST } = await import("../route");
    const res = await POST(makeReq({ turn_id: TURN_ID, reason: "x".repeat(501) }));
    expect(res.status).toBe(400);
  });

  it("returns 403 when actor is not admin or owner", async () => {
    mockSupabase({
      user: { id: "u1" },
      profile: { profile_id: PROFILE_ID, workspace_id: WS_ID, role: "employee" },
    });
    const { POST } = await import("../route");
    const res = await POST(makeReq({ turn_id: TURN_ID }));
    expect(res.status).toBe(403);
    expect(emitMock).not.toHaveBeenCalled();
  });

  it("returns 403 when no profile is found for the user", async () => {
    mockSupabase({ user: { id: "u1" }, profile: null });
    const { POST } = await import("../route");
    const res = await POST(makeReq({ turn_id: TURN_ID }));
    expect(res.status).toBe(403);
  });

  it("happy path: flags turn + emits recorder.turn_flagged", async () => {
    const { updateQuery } = mockSupabase({
      user: { id: "u1" },
      profile: { profile_id: PROFILE_ID, workspace_id: WS_ID, role: "admin" },
      updateResult: {
        data: {
          id: TURN_ID,
          is_flagged: true,
          session_id: SESSION_ID,
          workspace_id: WS_ID,
        },
        error: null,
      },
    });

    const { POST } = await import("../route");
    const res = await POST(makeReq({ turn_id: TURN_ID, reason: "wrong day" }));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.is_flagged).toBe(true);
    expect(body.id).toBe(TURN_ID);

    // update called with flagged fields + scoped by workspace_id (NOT from body)
    expect(updateQuery.update).toHaveBeenCalledWith(
      expect.objectContaining({
        is_flagged: true,
        flag_reason: "wrong day",
        flagged_by_profile_id: PROFILE_ID,
      }),
    );

    expect(emitMock).toHaveBeenCalledTimes(1);
    const emittedEvent = emitMock.mock.calls[0]![0];
    expect(emittedEvent.event).toBe("recorder.turn_flagged");
    expect(emittedEvent.workspace_id).toBe(WS_ID);
    expect(emittedEvent.actor_id).toBe(PROFILE_ID);
    expect(emittedEvent.properties.data.turn_id).toBe(TURN_ID);
    expect(emittedEvent.properties.data.session_id).toBe(SESSION_ID);
    expect(emittedEvent.properties.data.reason).toBe("wrong day");
  });

  it("owner role is also allowed", async () => {
    mockSupabase({
      user: { id: "u1" },
      profile: { profile_id: PROFILE_ID, workspace_id: WS_ID, role: "owner" },
      updateResult: {
        data: {
          id: TURN_ID,
          is_flagged: true,
          session_id: SESSION_ID,
          workspace_id: WS_ID,
        },
        error: null,
      },
    });
    const { POST } = await import("../route");
    const res = await POST(makeReq({ turn_id: TURN_ID }));
    expect(res.status).toBe(200);
  });
});
