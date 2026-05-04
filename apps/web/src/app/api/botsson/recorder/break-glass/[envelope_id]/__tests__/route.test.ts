/**
 * BFF tests for GET /api/botsson/recorder/break-glass/[envelope_id]
 * (ADR-0185 § Break-glass).
 *
 * Locks five contracts:
 * 1. 401 when unauthenticated.
 * 2. 403 when caller is NOT godmode.
 * 3. 404 when decrypt_envelope returns no rows (expired or not found).
 * 4. 500 when the RPC errors.
 * 5. 200 happy path — returns { raw, pii_class, auto_redact_in_ms: 5000 }
 *    + emits admin.pii_reveal with duration_ms=5000.
 *
 * CRITICAL: the emit call is audit-mandatory — no reveal without it.
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
const ENVELOPE_ID = "66666666-6666-4666-8666-666666666666";

function makeReq(): Request {
  return new Request(`http://localhost/api/botsson/recorder/break-glass/${ENVELOPE_ID}`);
}

type RpcResult = { data: unknown; error: unknown };

function mockSupabase(opts: {
  user: { id: string } | null;
  identity?: { user_id: string; is_godmode: boolean } | null;
  profile?: { profile_id: string; workspace_id: string } | null;
  rpcResult?: RpcResult;
}) {
  const getUser = vi.fn().mockResolvedValue({ data: { user: opts.user }, error: null });

  const identityQuery = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: opts.identity ?? null, error: null }),
  };

  const profileQuery = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: opts.profile ?? null, error: null }),
  };

  const from = vi.fn((table: string) => {
    if (table === "user_identity") return identityQuery;
    if (table === "profile") return profileQuery;
    throw new Error(`Unexpected table: ${table}`);
  });

  const rpc = vi.fn().mockResolvedValue(opts.rpcResult ?? { data: null, error: null });

  createClientMock.mockResolvedValue({ auth: { getUser }, from, rpc });
  return { from, rpc, identityQuery, profileQuery };
}

describe("GET /api/botsson/recorder/break-glass/[envelope_id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    mockSupabase({ user: null });
    const { GET } = await import("../route");
    const res = await GET(makeReq(), {
      params: Promise.resolve({ envelope_id: ENVELOPE_ID }),
    });
    expect(res.status).toBe(401);
    expect(emitMock).not.toHaveBeenCalled();
  });

  it("returns 403 when user is not godmode", async () => {
    mockSupabase({
      user: { id: "u1" },
      identity: { user_id: "u1", is_godmode: false },
    });
    const { GET } = await import("../route");
    const res = await GET(makeReq(), {
      params: Promise.resolve({ envelope_id: ENVELOPE_ID }),
    });
    expect(res.status).toBe(403);
    expect(emitMock).not.toHaveBeenCalled();
  });

  it("returns 403 when user_identity row is missing entirely", async () => {
    mockSupabase({ user: { id: "u1" }, identity: null });
    const { GET } = await import("../route");
    const res = await GET(makeReq(), {
      params: Promise.resolve({ envelope_id: ENVELOPE_ID }),
    });
    expect(res.status).toBe(403);
  });

  it("returns 500 when decrypt RPC errors", async () => {
    mockSupabase({
      user: { id: "u1" },
      identity: { user_id: "u1", is_godmode: true },
      rpcResult: { data: null, error: { message: "crypto error" } },
    });
    const { GET } = await import("../route");
    const res = await GET(makeReq(), {
      params: Promise.resolve({ envelope_id: ENVELOPE_ID }),
    });
    expect(res.status).toBe(500);
    expect(emitMock).not.toHaveBeenCalled();
  });

  it("returns 404 when envelope is expired or missing (RPC returns empty)", async () => {
    mockSupabase({
      user: { id: "u1" },
      identity: { user_id: "u1", is_godmode: true },
      rpcResult: { data: [], error: null },
    });
    const { GET } = await import("../route");
    const res = await GET(makeReq(), {
      params: Promise.resolve({ envelope_id: ENVELOPE_ID }),
    });
    expect(res.status).toBe(404);
    expect(emitMock).not.toHaveBeenCalled();
  });

  it("happy path: decrypts, emits admin.pii_reveal with duration_ms=5000, returns raw", async () => {
    const { rpc } = mockSupabase({
      user: { id: "u1" },
      identity: { user_id: "u1", is_godmode: true },
      profile: { profile_id: PROFILE_ID, workspace_id: WS_ID },
      rpcResult: {
        data: [
          {
            raw: "12345678901",
            pii_class: "personnummer",
            workspace_id: WS_ID,
          },
        ],
        error: null,
      },
    });

    const { GET } = await import("../route");
    const res = await GET(makeReq(), {
      params: Promise.resolve({ envelope_id: ENVELOPE_ID }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.raw).toBe("12345678901");
    expect(body.pii_class).toBe("personnummer");
    expect(body.auto_redact_in_ms).toBe(5000);

    expect(rpc).toHaveBeenCalledWith("decrypt_envelope", { p_envelope_id: ENVELOPE_ID });

    expect(emitMock).toHaveBeenCalledTimes(1);
    const ev = emitMock.mock.calls[0]![0];
    expect(ev.event).toBe("admin.pii_reveal");
    expect(ev.workspace_id).toBe(WS_ID);
    expect(ev.actor_id).toBe(PROFILE_ID);
    expect(ev.properties.data.envelope_id).toBe(ENVELOPE_ID);
    expect(ev.properties.data.pii_class).toBe("personnummer");
    expect(ev.properties.data.duration_ms).toBe(5000);
  });

  it("RPC returns an object (not an array) — also handled", async () => {
    // Supabase supports RETURNS TABLE; it may surface as array OR object
    // depending on PostgREST version. We defend against both.
    mockSupabase({
      user: { id: "u1" },
      identity: { user_id: "u1", is_godmode: true },
      profile: { profile_id: PROFILE_ID, workspace_id: WS_ID },
      rpcResult: {
        data: {
          raw: "NO9386011117947",
          pii_class: "bank",
          workspace_id: WS_ID,
        },
        error: null,
      },
    });
    const { GET } = await import("../route");
    const res = await GET(makeReq(), {
      params: Promise.resolve({ envelope_id: ENVELOPE_ID }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.raw).toBe("NO9386011117947");
    expect(body.pii_class).toBe("bank");
    expect(emitMock).toHaveBeenCalledTimes(1);
  });
});
