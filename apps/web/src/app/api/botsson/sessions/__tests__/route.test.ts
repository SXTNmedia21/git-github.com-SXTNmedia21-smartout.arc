/**
 * Tests for GET /api/botsson/sessions
 *
 * Locked contracts (4 cases):
 * a. 401 when getServerContext returns null
 * b. 403 fail-fast on missing/empty workspace_id or profile_id (L-0177 — 3 sub-cases)
 * c. Supabase query filters: mode='agent', channel='chat', is_archived=false,
 *    workspace_id, profile_id; ordered DESC created_at; limited 50
 * d. collected_data.conversation mapping — turn_count from array length,
 *    last_turn_at from last entry timestamp OR updated_at fallback when empty
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

// Hoist mocks so they are available at module evaluation time
const { getServerContextMock, createClientMock } = vi.hoisted(() => ({
  getServerContextMock: vi.fn(),
  createClientMock: vi.fn(),
}));

vi.mock("@/lib/auth/get-server-context", () => ({
  getServerContext: getServerContextMock,
}));

vi.mock("@smartout/supabase/server", () => ({
  createClient: createClientMock,
}));

import { GET } from "../route";

// ─── Helpers ───────────────────────────────────────────────────
const WS_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PROFILE_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function authedCtx(overrides?: {
  workspace_id?: string | null;
  profile_id?: string | null;
  profile?: null;
}) {
  if (overrides?.profile === null) {
    return {
      user: { id: "user-1" },
      profile: null,
      accessToken: undefined,
      authMethod: "cookie" as const,
    };
  }
  return {
    user: { id: "user-1" },
    profile: {
      profile_id: overrides?.profile_id ?? PROFILE_ID,
      workspace_id: overrides?.workspace_id ?? WS_ID,
      role: "employee",
    },
    accessToken: undefined,
    authMethod: "cookie" as const,
  };
}

/** Build a chainable Supabase mock that tracks which methods were called */
function makeSupabaseMock(resolvedData: unknown[], resolvedError: unknown = null) {
  const eqSpy = vi.fn().mockReturnThis();
  const orderSpy = vi.fn().mockReturnThis();
  const limitSpy = vi.fn().mockResolvedValue({ data: resolvedData, error: resolvedError });

  const mock = {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: eqSpy,
        order: orderSpy,
        limit: limitSpy,
      }),
    }),
    _spies: { eqSpy, orderSpy, limitSpy },
  };

  // Chain: eq().eq().eq().eq().eq().order().limit()
  eqSpy.mockReturnValue({
    eq: eqSpy,
    order: orderSpy,
    limit: limitSpy,
  });
  orderSpy.mockReturnValue({
    eq: eqSpy,
    order: orderSpy,
    limit: limitSpy,
  });

  return mock;
}

function makeReq() {
  return new Request("http://localhost/api/botsson/sessions") as never;
}

// ─── Tests ─────────────────────────────────────────────────────
describe("GET /api/botsson/sessions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── (a) 401 when unauthenticated ──────────────────────────────
  it("(a) returns 401 when getServerContext returns null", async () => {
    getServerContextMock.mockResolvedValue(null);

    const res = await GET(makeReq());

    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("unauthenticated");
  });

  // ── (b) 403 fail-fast — L-0177 three sub-cases ───────────────
  it("(b1) returns 403 when ctx.profile is null", async () => {
    getServerContextMock.mockResolvedValue(authedCtx({ profile: null }));

    const res = await GET(makeReq());

    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("no_workspace_profile");
  });

  it("(b2) returns 403 when workspace_id is empty string", async () => {
    getServerContextMock.mockResolvedValue(authedCtx({ workspace_id: "" }));

    const res = await GET(makeReq());

    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("no_workspace_profile");
  });

  it("(b3) returns 403 when profile_id is empty string", async () => {
    getServerContextMock.mockResolvedValue(authedCtx({ profile_id: "" }));

    const res = await GET(makeReq());

    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("no_workspace_profile");
  });

  // ── (c) Query filter shape ────────────────────────────────────
  it("(c) applies correct predicates: mode=agent, channel=chat, is_archived=false, workspace+profile scope, DESC order, limit 50", async () => {
    getServerContextMock.mockResolvedValue(authedCtx());

    const { mock: supabaseMock, eqCalls, orderCalls, limitCalls } = buildInspectableMock([]);
    createClientMock.mockResolvedValue(supabaseMock);

    await GET(makeReq());

    // Verify all five eq() predicates fired
    const eqPairs = eqCalls.map(([col, val]: [string, unknown]) => `${col}=${String(val)}`);
    expect(eqPairs).toContain(`workspace_id=${WS_ID}`);
    expect(eqPairs).toContain(`profile_id=${PROFILE_ID}`);
    expect(eqPairs).toContain("mode=agent");
    expect(eqPairs).toContain("channel=chat");
    expect(eqPairs).toContain("is_archived=false");

    // Verify ordering
    expect(orderCalls[0]).toEqual(["created_at", { ascending: false }]);

    // Verify limit
    expect(limitCalls[0]).toEqual([50]);
  });

  // ── (d) collected_data mapping ────────────────────────────────
  it("(d1) maps turn_count from conversation array length and last_turn_at from last entry timestamp", async () => {
    getServerContextMock.mockResolvedValue(authedCtx());

    const rows = [
      {
        id: "session-1",
        summary: "My first chat",
        created_at: "2026-05-10T10:00:00Z",
        updated_at: "2026-05-10T10:05:00Z",
        channel: "chat",
        mode: "agent",
        status: "complete",
        is_archived: false,
        collected_data: {
          conversation: [
            { role: "user", content: "Hello", timestamp: "2026-05-10T10:01:00Z" },
            { role: "assistant", content: "Hi there!", timestamp: "2026-05-10T10:02:00Z" },
          ],
        },
      },
    ];

    createClientMock.mockResolvedValue(buildSimpleMock(rows));

    const res = await GET(makeReq());
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      sessions: Array<{ turn_count: number; last_turn_at: string; summary: string }>;
    };

    expect(body.sessions).toHaveLength(1);
    expect(body.sessions[0]!.turn_count).toBe(2);
    expect(body.sessions[0]!.last_turn_at).toBe("2026-05-10T10:02:00Z");
    expect(body.sessions[0]!.summary).toBe("My first chat");
  });

  it("(d2) falls back to updated_at for last_turn_at when conversation array is empty", async () => {
    getServerContextMock.mockResolvedValue(authedCtx());

    const rows = [
      {
        id: "session-2",
        summary: null,
        created_at: "2026-05-10T09:00:00Z",
        updated_at: "2026-05-10T09:30:00Z",
        channel: "chat",
        mode: "agent",
        status: "active",
        is_archived: false,
        collected_data: { conversation: [] },
      },
    ];

    createClientMock.mockResolvedValue(buildSimpleMock(rows));

    const res = await GET(makeReq());
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      sessions: Array<{ turn_count: number; last_turn_at: string }>;
    };

    expect(body.sessions[0]!.turn_count).toBe(0);
    expect(body.sessions[0]!.last_turn_at).toBe("2026-05-10T09:30:00Z");
  });
});

// ─── Mock factory helpers ───────────────────────────────────────

/** Simple mock for data-shape assertions (no spy tracking on eq/order/limit) */
function buildSimpleMock(rows: unknown[]) {
  return {
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            eq: () => ({
              eq: () => ({
                eq: () => ({
                  order: () => ({
                    limit: () => Promise.resolve({ data: rows, error: null }),
                  }),
                }),
              }),
            }),
          }),
        }),
      }),
    }),
  };
}

/** Inspectable mock that records eq/order/limit call arguments for (c) assertion */
function buildInspectableMock(rows: unknown[]) {
  const eqCalls: [string, unknown][] = [];
  const orderCalls: [string, unknown][] = [];
  const limitCalls: [number][] = [];

  const limitFn = vi.fn((...args: [number]) => {
    limitCalls.push(args);
    return Promise.resolve({ data: rows, error: null });
  });

  const orderFn = vi.fn((...args: [string, unknown]) => {
    orderCalls.push(args);
    return { eq: eqFn, order: orderFn, limit: limitFn };
  });

  const eqFn = vi.fn((...args: [string, unknown]) => {
    eqCalls.push(args);
    return { eq: eqFn, order: orderFn, limit: limitFn };
  });

  const mock = {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: eqFn,
      }),
    }),
  };

  return { mock, eqCalls, orderCalls, limitCalls };
}
