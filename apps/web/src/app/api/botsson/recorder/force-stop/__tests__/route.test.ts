/**
 * BFF tests for POST /api/botsson/recorder/force-stop (ADR-0185 Phase 2a).
 *
 * Implementation choice: force-stop inserts an auto-generated whisper into
 * agent_session_whisper with the content "System note: Previous turn
 * interrupted by admin. Begin fresh." The next prompt-builder rebuild picks
 * it up through the existing unconsumed-whisper path (see prompt-builder.ts
 * buildStagePromptWithWhispers).
 *
 * Why not update session_lane.status='interrupted'? SessionLane is an
 * in-memory promise queue in stage-engine (services/stage-engine/src/core/
 * session-lane.ts) — there is no `session_lane` table. ADR-0185's
 * "session_lane.status='interrupted'" phrasing is aspirational. The ADR's
 * operational intent ("next turn gets an auto-generated system-note") maps
 * 1:1 to the whisper injection pipe that already works.
 *
 * Locks contracts:
 * 1. 401 when unauthenticated.
 * 2. 400 when body is invalid.
 * 3. 403 when actor is not admin/owner.
 * 4. 403 when C4 authority recorder.force_stop is "disabled".
 * 5. 200 happy path — inserts whisper + emits recorder.session_force_stopped.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const { createClientMock, emitMock } = vi.hoisted(() => ({
  createClientMock: vi.fn(),
  emitMock: vi.fn(),
}));

vi.mock("@smartout/supabase/server", () => ({ createClient: createClientMock }));
vi.mock("@smartout/telemetry", () => ({ emit: emitMock }));

const WS_ID = "11111111-1111-4111-8111-111111111111";
const PROFILE_ID = "22222222-2222-4222-8222-222222222222";
const SESSION_ID = "44444444-4444-4444-8444-444444444444";
const WHISPER_ID = "77777777-7777-4777-8777-777777777777";

function makeReq(body: unknown): Request {
  return new Request("http://localhost/api/botsson/recorder/force-stop", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

type QueryResult = { data: unknown; error: unknown };

function mockSupabase(opts: {
  user: { id: string } | null;
  profile?: { profile_id: string; workspace_id: string; role: string } | null;
  authorityLevel?: string | null;
  insertResult?: QueryResult;
}) {
  const getUser = vi.fn().mockResolvedValue({ data: { user: opts.user }, error: null });

  const profileQuery = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: opts.profile ?? null, error: null }),
  };

  const authorityQuery = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({
      data: opts.authorityLevel === null ? null : { level: opts.authorityLevel ?? "confirm" },
      error: null,
    }),
  };

  const insertQuery = {
    insert: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(opts.insertResult ?? { data: null, error: null }),
  };

  const from = vi.fn((table: string) => {
    if (table === "profile") return profileQuery;
    if (table === "engine_authority_config") return authorityQuery;
    if (table === "agent_session_whisper") return insertQuery;
    throw new Error(`Unexpected table: ${table}`);
  });

  createClientMock.mockResolvedValue({ auth: { getUser }, from });
  return { from, profileQuery, authorityQuery, insertQuery };
}

describe("POST /api/botsson/recorder/force-stop", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    mockSupabase({ user: null });
    const { POST } = await import("../route");
    const res = await POST(makeReq({ session_id: SESSION_ID }));
    expect(res.status).toBe(401);
    expect(emitMock).not.toHaveBeenCalled();
  });

  it("returns 400 when session_id is missing", async () => {
    mockSupabase({
      user: { id: "u1" },
      profile: { profile_id: PROFILE_ID, workspace_id: WS_ID, role: "admin" },
    });
    const { POST } = await import("../route");
    const res = await POST(makeReq({ reason: "nope" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when session_id is not a UUID", async () => {
    mockSupabase({
      user: { id: "u1" },
      profile: { profile_id: PROFILE_ID, workspace_id: WS_ID, role: "admin" },
    });
    const { POST } = await import("../route");
    const res = await POST(makeReq({ session_id: "not-a-uuid" }));
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

  it("returns 403 when actor is employee", async () => {
    mockSupabase({
      user: { id: "u1" },
      profile: { profile_id: PROFILE_ID, workspace_id: WS_ID, role: "employee" },
    });
    const { POST } = await import("../route");
    const res = await POST(makeReq({ session_id: SESSION_ID }));
    expect(res.status).toBe(403);
    expect(emitMock).not.toHaveBeenCalled();
  });

  it("returns 403 when recorder.force_stop authority is disabled", async () => {
    mockSupabase({
      user: { id: "u1" },
      profile: { profile_id: PROFILE_ID, workspace_id: WS_ID, role: "admin" },
      authorityLevel: "disabled",
    });
    const { POST } = await import("../route");
    const res = await POST(makeReq({ session_id: SESSION_ID }));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toMatch(/disabled/i);
    expect(emitMock).not.toHaveBeenCalled();
  });

  it("returns 403 when no force_stop authority row exists (default closed)", async () => {
    mockSupabase({
      user: { id: "u1" },
      profile: { profile_id: PROFILE_ID, workspace_id: WS_ID, role: "admin" },
      authorityLevel: null,
    });
    const { POST } = await import("../route");
    const res = await POST(makeReq({ session_id: SESSION_ID }));
    expect(res.status).toBe(403);
  });

  it("happy path: inserts system-note whisper + emits recorder.session_force_stopped", async () => {
    const { insertQuery, authorityQuery } = mockSupabase({
      user: { id: "u1" },
      profile: { profile_id: PROFILE_ID, workspace_id: WS_ID, role: "admin" },
      authorityLevel: "confirm",
      insertResult: {
        data: { id: WHISPER_ID, session_id: SESSION_ID },
        error: null,
      },
    });

    const { POST } = await import("../route");
    const res = await POST(makeReq({ session_id: SESSION_ID, reason: "cost runaway" }));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.session_id).toBe(SESSION_ID);
    expect(body.whisper_id).toBe(WHISPER_ID);

    // Gated through the correct capability.
    expect(authorityQuery.eq).toHaveBeenCalledWith("capability", "recorder.force_stop");

    // Auto-generated system-note content matches ADR-0185 § Force-stop phrasing.
    expect(insertQuery.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        session_id: SESSION_ID,
        workspace_id: WS_ID,
        admin_profile_id: PROFILE_ID,
        content: expect.stringContaining("interrupted by admin"),
      }),
    );

    expect(emitMock).toHaveBeenCalledTimes(1);
    const ev = emitMock.mock.calls[0]![0];
    expect(ev.event).toBe("recorder.session_force_stopped");
    expect(ev.workspace_id).toBe(WS_ID);
    expect(ev.actor_id).toBe(PROFILE_ID);
    expect(ev.properties.data.session_id).toBe(SESSION_ID);
    expect(ev.properties.data.whisper_id).toBe(WHISPER_ID);
    expect(ev.properties.data.reason).toBe("cost runaway");
  });

  it("reason is optional (defaults to empty string in emit)", async () => {
    mockSupabase({
      user: { id: "u1" },
      profile: { profile_id: PROFILE_ID, workspace_id: WS_ID, role: "admin" },
      authorityLevel: "confirm",
      insertResult: { data: { id: WHISPER_ID, session_id: SESSION_ID }, error: null },
    });
    const { POST } = await import("../route");
    const res = await POST(makeReq({ session_id: SESSION_ID }));
    expect(res.status).toBe(200);
    const ev = emitMock.mock.calls[0]![0];
    expect(ev.properties.data.reason).toBe("");
  });
});
