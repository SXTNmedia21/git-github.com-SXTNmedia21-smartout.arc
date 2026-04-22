/**
 * BFF tests for POST /api/botsson/recorder/whisper (ADR-0185).
 *
 * Locks five contracts:
 * 1. 401 when unauthenticated.
 * 2. 400 when body is invalid (missing session_id or empty content).
 * 3. 403 when actor is not admin/owner.
 * 4. 403 when C4 authority recorder.whisper is "disabled" (ADR-0185 default).
 * 5. 200 happy path — INSERT agent_session_whisper + emit recorder.whisper_created.
 *
 * ADR-0151: admin_profile_id is resolved server-side.
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
const WHISPER_ID = "55555555-5555-4555-8555-555555555555";

function makeReq(body: unknown): Request {
  return new Request("http://localhost/api/botsson/recorder/whisper", {
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

describe("POST /api/botsson/recorder/whisper", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    mockSupabase({ user: null });
    const { POST } = await import("../route");
    const res = await POST(makeReq({ session_id: SESSION_ID, content: "hi" }));
    expect(res.status).toBe(401);
    expect(emitMock).not.toHaveBeenCalled();
  });

  it("returns 400 when session_id is missing", async () => {
    mockSupabase({
      user: { id: "u1" },
      profile: { profile_id: PROFILE_ID, workspace_id: WS_ID, role: "admin" },
    });
    const { POST } = await import("../route");
    const res = await POST(makeReq({ content: "only content" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when content is empty", async () => {
    mockSupabase({
      user: { id: "u1" },
      profile: { profile_id: PROFILE_ID, workspace_id: WS_ID, role: "admin" },
    });
    const { POST } = await import("../route");
    const res = await POST(makeReq({ session_id: SESSION_ID, content: "" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when content exceeds 2000 chars", async () => {
    mockSupabase({
      user: { id: "u1" },
      profile: { profile_id: PROFILE_ID, workspace_id: WS_ID, role: "admin" },
    });
    const { POST } = await import("../route");
    const res = await POST(makeReq({ session_id: SESSION_ID, content: "x".repeat(2001) }));
    expect(res.status).toBe(400);
  });

  it("returns 403 when actor is employee", async () => {
    mockSupabase({
      user: { id: "u1" },
      profile: { profile_id: PROFILE_ID, workspace_id: WS_ID, role: "employee" },
    });
    const { POST } = await import("../route");
    const res = await POST(makeReq({ session_id: SESSION_ID, content: "hi" }));
    expect(res.status).toBe(403);
  });

  it("returns 403 when recorder.whisper authority is disabled", async () => {
    mockSupabase({
      user: { id: "u1" },
      profile: { profile_id: PROFILE_ID, workspace_id: WS_ID, role: "admin" },
      authorityLevel: "disabled",
    });
    const { POST } = await import("../route");
    const res = await POST(makeReq({ session_id: SESSION_ID, content: "note" }));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toMatch(/disabled/i);
    expect(emitMock).not.toHaveBeenCalled();
  });

  it("returns 403 when no recorder.whisper authority row exists (default closed)", async () => {
    mockSupabase({
      user: { id: "u1" },
      profile: { profile_id: PROFILE_ID, workspace_id: WS_ID, role: "admin" },
      authorityLevel: null,
    });
    const { POST } = await import("../route");
    const res = await POST(makeReq({ session_id: SESSION_ID, content: "note" }));
    expect(res.status).toBe(403);
  });

  it("happy path: inserts whisper + emits recorder.whisper_created", async () => {
    const { insertQuery } = mockSupabase({
      user: { id: "u1" },
      profile: { profile_id: PROFILE_ID, workspace_id: WS_ID, role: "admin" },
      authorityLevel: "confirm",
      insertResult: {
        data: {
          id: WHISPER_ID,
          session_id: SESSION_ID,
          created_at: "2026-04-22T10:00:00Z",
        },
        error: null,
      },
    });

    const { POST } = await import("../route");
    const res = await POST(makeReq({ session_id: SESSION_ID, content: "ask about the deviation" }));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe(WHISPER_ID);

    expect(insertQuery.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        session_id: SESSION_ID,
        workspace_id: WS_ID,
        admin_profile_id: PROFILE_ID,
        content: "ask about the deviation",
      }),
    );

    expect(emitMock).toHaveBeenCalledTimes(1);
    const ev = emitMock.mock.calls[0]![0];
    expect(ev.event).toBe("recorder.whisper_created");
    expect(ev.workspace_id).toBe(WS_ID);
    expect(ev.actor_id).toBe(PROFILE_ID);
    expect(ev.properties.data.session_id).toBe(SESSION_ID);
    expect(ev.properties.data.whisper_id).toBe(WHISPER_ID);
    expect(ev.properties.data.content_length).toBe("ask about the deviation".length);
  });
});
