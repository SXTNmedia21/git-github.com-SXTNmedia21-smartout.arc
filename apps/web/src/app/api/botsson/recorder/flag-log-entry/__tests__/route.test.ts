/**
 * BFF tests for POST /api/botsson/recorder/flag-log-entry (ADR-0185 Phase 2b).
 *
 * User-initiated escalation from Arena LogView. Differs from /flag-session:
 *   - Any authenticated role passes (no admin/owner gate).
 *   - session_id is resolved server-side from the user's most recent turn.
 *   - No DB mutation — pure telemetry escalation.
 *
 * Locks contracts:
 * 1. 401 when unauthenticated.
 * 2. 400 when body is invalid (missing reason / entry_type / entry_content).
 * 3. 403 when no profile matches auth.uid().
 * 4. 200 happy path with resolved session_id (latest recent turn).
 * 5. 200 with session_id="" when no recent turn exists (escalation still recorded).
 * 6. Employee role passes (no role gate).
 *
 * ADR-0151: profile_id is resolved server-side from auth.uid().
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

function makeReq(body: unknown): Request {
  return new Request("http://localhost/api/botsson/recorder/flag-log-entry", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function mockSupabase(opts: {
  user: { id: string } | null;
  profile?: { profile_id: string; workspace_id: string } | null;
  latestTurn?: { session_id: string } | null;
}) {
  const getUser = vi.fn().mockResolvedValue({ data: { user: opts.user }, error: null });

  const profileQuery = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: opts.profile ?? null, error: null }),
  };

  const latestTurnQuery = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: opts.latestTurn ?? null, error: null }),
  };

  const from = vi.fn((table: string) => {
    if (table === "profile") return profileQuery;
    if (table === "agent_session_recording") return latestTurnQuery;
    throw new Error(`Unexpected table: ${table}`);
  });

  createClientMock.mockResolvedValue({ auth: { getUser }, from });
  return { from, profileQuery, latestTurnQuery };
}

const validBody = {
  entry_type: "tool_call",
  entry_content: "get_today_shifts",
  timestamp: 1714000000,
  reason: "Emma called the wrong tool",
};

describe("POST /api/botsson/recorder/flag-log-entry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    mockSupabase({ user: null });
    const { POST } = await import("../route");
    const res = await POST(makeReq(validBody));
    expect(res.status).toBe(401);
    expect(emitMock).not.toHaveBeenCalled();
  });

  it("returns 400 when reason is missing", async () => {
    mockSupabase({
      user: { id: "u1" },
      profile: { profile_id: PROFILE_ID, workspace_id: WS_ID },
    });
    const { POST } = await import("../route");
    const res = await POST(makeReq({ entry_type: "tool_call", entry_content: "x", timestamp: 1 }));
    expect(res.status).toBe(400);
    expect(emitMock).not.toHaveBeenCalled();
  });

  it("returns 400 when entry_type is missing", async () => {
    mockSupabase({
      user: { id: "u1" },
      profile: { profile_id: PROFILE_ID, workspace_id: WS_ID },
    });
    const { POST } = await import("../route");
    const res = await POST(makeReq({ entry_content: "x", timestamp: 1, reason: "r" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when reason exceeds 500 chars", async () => {
    mockSupabase({
      user: { id: "u1" },
      profile: { profile_id: PROFILE_ID, workspace_id: WS_ID },
    });
    const { POST } = await import("../route");
    const res = await POST(makeReq({ ...validBody, reason: "x".repeat(501) }));
    expect(res.status).toBe(400);
  });

  it("returns 403 when no profile matches auth.uid()", async () => {
    mockSupabase({ user: { id: "u1" }, profile: null });
    const { POST } = await import("../route");
    const res = await POST(makeReq(validBody));
    expect(res.status).toBe(403);
    expect(emitMock).not.toHaveBeenCalled();
  });

  it("happy path: resolves session_id from latest turn + emits user_flag_submitted", async () => {
    mockSupabase({
      user: { id: "u1" },
      profile: { profile_id: PROFILE_ID, workspace_id: WS_ID },
      latestTurn: { session_id: SESSION_ID },
    });

    const { POST } = await import("../route");
    const res = await POST(makeReq(validBody));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.recorded).toBe(true);
    expect(body.session_id).toBe(SESSION_ID);

    expect(emitMock).toHaveBeenCalledTimes(1);
    const ev = emitMock.mock.calls[0]![0];
    expect(ev.event).toBe("recorder.user_flag_submitted");
    expect(ev.workspace_id).toBe(WS_ID);
    expect(ev.actor_id).toBe(PROFILE_ID);
    expect(ev.properties.entity.entity_type).toBe("agent_session");
    expect(ev.properties.entity.entity_id).toBe(SESSION_ID);
    expect(ev.properties.data.session_id).toBe(SESSION_ID);
    expect(ev.properties.data.entry_type).toBe("tool_call");
    expect(ev.properties.data.entry_content).toBe("get_today_shifts");
    expect(ev.properties.data.reason).toBe("Emma called the wrong tool");
    expect(ev.properties.data.timestamp).toBe(1714000000);
  });

  it("records escalation with empty session_id when no recent turn exists", async () => {
    mockSupabase({
      user: { id: "u1" },
      profile: { profile_id: PROFILE_ID, workspace_id: WS_ID },
      latestTurn: null,
    });

    const { POST } = await import("../route");
    const res = await POST(makeReq(validBody));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.recorded).toBe(true);
    expect(body.session_id).toBe("");

    expect(emitMock).toHaveBeenCalledTimes(1);
    const ev = emitMock.mock.calls[0]![0];
    expect(ev.properties.data.session_id).toBe("");
    // entity_id falls back to "unknown" so activity_trail entity shape stays consistent.
    expect(ev.properties.entity.entity_id).toBe("unknown");
  });

  it("any authenticated role is allowed (employee, manager, admin, owner)", async () => {
    // The endpoint does NOT gate on role — unlike /flag-session.
    // This test just confirms the happy path works for a profile row with no
    // role field being read (the route never selects role).
    mockSupabase({
      user: { id: "u1" },
      profile: { profile_id: PROFILE_ID, workspace_id: WS_ID },
      latestTurn: { session_id: SESSION_ID },
    });
    const { POST } = await import("../route");
    const res = await POST(makeReq(validBody));
    expect(res.status).toBe(200);
  });
});
