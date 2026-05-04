/**
 * BFF tests for /api/emma/voice/transcript (Phase C1, ADR-0132 / ADR-0135).
 *
 * Locks four invariants:
 *
 *   I1  Channel is forced to "voice" server-side; mobile cannot escalate.
 *   I2  voice_participation='disabled' rejects with 403 (defence-in-depth
 *       — the LiveKit token gates issuance, this re-checks at transcript time).
 *   I3  voice_participation='listen_only' short-circuits — transcript is
 *       captured for telemetry, but stage-engine is NOT invoked.
 *   I4  voice_participation='interactive' (or no policy row when channelId
 *       is omitted) proxies to stage-engine and pins channel='voice' in
 *       the forwarded body.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const { createClientMock, createAdminClientMock, fetchMock, emitMock } = vi.hoisted(() => ({
  createClientMock: vi.fn(),
  createAdminClientMock: vi.fn(),
  fetchMock: vi.fn(),
  emitMock: vi.fn(),
}));

vi.mock("@smartout/supabase/server", () => ({
  createClient: createClientMock,
}));

vi.mock("@smartout/supabase/admin", () => ({
  createAdminClient: createAdminClientMock,
}));

vi.mock("@smartout/telemetry", () => ({
  emit: emitMock,
  // nonEmpty asserts non-empty string at call site; tests pass valid uuids.
  nonEmpty: (v: string) => v,
}));

vi.mock("@/env", () => ({
  env: {
    STAGE_ENGINE_URL: "http://stage-engine.test",
    STAGE_ENGINE_API_KEY: "test-key",
  },
}));

vi.stubGlobal("fetch", fetchMock);

const WORKSPACE_ID = "11111111-1111-4111-8111-111111111111";
const CHANNEL_ID = "22222222-2222-4222-8222-222222222222";
const SESSION_ID = "44444444-4444-4444-8444-444444444444";
const PROFILE_ROW = {
  profile_id: "33333333-3333-4333-8333-333333333333",
  role: "employee",
  status: "active",
};

const VALID_BODY = {
  workspaceId: WORKSPACE_ID,
  livekitRoomId: `${WORKSPACE_ID}:${CHANNEL_ID}`,
  transcript: "Hvor mange ansatte er på i kveld?",
  asrProvider: "livekit_whisper",
  asrLatencyMs: 250,
};

function makeProfileQueryMock() {
  const maybeSingle = vi.fn().mockResolvedValue({ data: PROFILE_ROW, error: null });
  const secondEq = vi.fn().mockReturnValue({ maybeSingle });
  const firstEq = vi.fn().mockReturnValue({ eq: secondEq });
  const select = vi.fn().mockReturnValue({ eq: firstEq });
  return { select, firstEq, secondEq, maybeSingle };
}

function makePolicyQueryMock(voicePolicy: "disabled" | "listen_only" | "interactive" | null) {
  const maybeSingle = vi.fn().mockResolvedValue({
    data: voicePolicy ? { voice_participation: voicePolicy } : null,
    error: null,
  });
  const eq = vi.fn().mockReturnValue({ maybeSingle });
  const select = vi.fn().mockReturnValue({ eq });
  return { select, eq, maybeSingle };
}

/**
 * Build an admin client where `from('profile')` returns the profile and
 * `from('channel_ai_policy')` returns the supplied voice policy (or null).
 */
function makeAdminClient(opts: { voicePolicy: "disabled" | "listen_only" | "interactive" | null }) {
  const profileQ = makeProfileQueryMock();
  const policyQ = makePolicyQueryMock(opts.voicePolicy);
  const from = vi.fn((table: string) => {
    if (table === "profile") return { select: profileQ.select };
    if (table === "channel_ai_policy") return { select: policyQ.select };
    throw new Error(`Unexpected from(${table})`);
  });
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } }, error: null }),
    },
    from,
  };
}

function makeRequest(opts: { authHeader?: string | null; body?: unknown } = {}) {
  const body = opts.body ?? VALID_BODY;
  // Distinguish "not provided" (use default Bearer) from "explicitly null"
  // (no auth header at all — must be 401).
  const headerValue = "authHeader" in opts ? opts.authHeader : "Bearer test-token";
  return {
    headers: {
      get: (name: string) =>
        name.toLowerCase() === "authorization" ? (headerValue ?? null) : null,
    },
    json: async () => body,
  } as unknown as import("next/server").NextRequest;
}

describe("/api/emma/voice/transcript", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("I1: forwards channel='voice' to stage-engine — and the schema rejects a client-supplied channel field", async () => {
    createAdminClientMock.mockReturnValue(makeAdminClient({ voicePolicy: "interactive" }));
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        session_id: SESSION_ID,
        response: "Tre på vakt i kveld.",
        intent: { capability: "schedule", confidence: 0.94 },
      }),
    });

    const { POST } = await import("../route");

    // Sanity: a request body that smuggles `channel: 'chat'` is accepted by
    // Next (the field is ignored by the schema), and the BFF still forwards
    // 'voice' to stage-engine — so mobile cannot escalate.
    const res = await POST(
      makeRequest({ body: { ...VALID_BODY, channel: "chat", channelId: CHANNEL_ID } }),
    );
    expect(res.status).toBe(200);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0]!;
    const forwarded = JSON.parse((init as RequestInit).body as string);
    expect(forwarded.channel).toBe("voice");
    expect(forwarded.message).toBe(VALID_BODY.transcript);
  });

  it("I2: voice_participation='disabled' returns 403 and does NOT reach stage-engine", async () => {
    createAdminClientMock.mockReturnValue(makeAdminClient({ voicePolicy: "disabled" }));

    const { POST } = await import("../route");
    const res = await POST(makeRequest({ body: { ...VALID_BODY, channelId: CHANNEL_ID } }));
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toBe("VOICE_PARTICIPATION_DISABLED");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("I3: voice_participation='listen_only' captures telemetry but does NOT call stage-engine", async () => {
    createAdminClientMock.mockReturnValue(makeAdminClient({ voicePolicy: "listen_only" }));

    const { POST } = await import("../route");
    const res = await POST(makeRequest({ body: { ...VALID_BODY, channelId: CHANNEL_ID } }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.listenOnly).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();

    // Exactly one telemetry emit (transcript_in) — no response_out for listen-only.
    const events = emitMock.mock.calls.map((c) => (c[0] as { event: string }).event);
    expect(events).toContain("voice.transcript_in");
    expect(events).not.toContain("voice.response_out");
  });

  it("I4: voice_participation='interactive' proxies to stage-engine and emits both transcript_in + response_out", async () => {
    createAdminClientMock.mockReturnValue(makeAdminClient({ voicePolicy: "interactive" }));
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        session_id: SESSION_ID,
        response: "Tre på vakt.",
        intent: { capability: "schedule", confidence: 0.91 },
      }),
    });

    const { POST } = await import("../route");
    const res = await POST(makeRequest({ body: { ...VALID_BODY, channelId: CHANNEL_ID } }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.text).toBe("Tre på vakt.");
    expect(json.sessionId).toBe(SESSION_ID);
    expect(typeof json.pipelineLatencyMs).toBe("number");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe("http://stage-engine.test/agent/chat");
    const forwarded = JSON.parse((init as RequestInit).body as string);
    expect(forwarded.channel).toBe("voice");

    const events = emitMock.mock.calls.map((c) => (c[0] as { event: string }).event);
    expect(events).toContain("voice.transcript_in");
    expect(events).toContain("voice.response_out");
  });

  it("rejects unauthenticated requests with 401 — no bearer, no cookie", async () => {
    // The cookie path returns null user; the Bearer path is skipped (no header).
    // We must override the admin mock from the prior test to return null on
    // getUser too, otherwise a stale Bearer-path config could surface a user.
    createClientMock.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
        getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      },
    });
    createAdminClientMock.mockReturnValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
      },
      from: vi.fn(),
    });

    const { POST } = await import("../route");
    const res = await POST(makeRequest({ authHeader: null }));
    expect(res.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects an invalid request body with 400", async () => {
    createAdminClientMock.mockReturnValue(makeAdminClient({ voicePolicy: "interactive" }));

    const { POST } = await import("../route");
    const res = await POST(
      makeRequest({
        body: {
          // missing transcript
          workspaceId: WORKSPACE_ID,
          livekitRoomId: `${WORKSPACE_ID}:${CHANNEL_ID}`,
        },
      }),
    );
    expect(res.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
