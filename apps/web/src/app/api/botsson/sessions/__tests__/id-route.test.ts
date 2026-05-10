/**
 * Tests for GET /api/botsson/sessions/[id] and DELETE /api/botsson/sessions/[id]
 *
 * Locked contracts (4 cases):
 * a. GET returns 404 when supabase returns null data (RLS-scoped, mimics non-owned)
 * b. GET returns SessionDetail shape on success
 * c. DELETE flips is_archived to true, returns 204
 * d. DELETE emits botsson.session.archived with ADR-0152 entity discriminator
 *    (entity_type='engine_session', entity_id, entity_label from summary or
 *     first-user-turn-truncated or fallback 'Botsson chat')
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

// Hoist mocks so they are available at module evaluation time
const { getServerContextMock, createClientMock, emitMock } = vi.hoisted(() => ({
  getServerContextMock: vi.fn(),
  createClientMock: vi.fn(),
  emitMock: vi.fn(),
}));

vi.mock("@/lib/auth/get-server-context", () => ({
  getServerContext: getServerContextMock,
}));

vi.mock("@smartout/supabase/server", () => ({
  createClient: createClientMock,
}));

// nonEmpty is a branding helper — in tests, identity fn is sufficient
vi.mock("@smartout/telemetry", () => ({
  emit: emitMock,
  nonEmpty: (v: string) => v,
}));

import { GET, DELETE } from "../[id]/route";

// ─── Constants ─────────────────────────────────────────────────
const WS_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const PROFILE_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const SESSION_ID = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";

// ─── Helper: authenticated context ─────────────────────────────
function authedCtx() {
  return {
    user: { id: "user-1" },
    profile: {
      profile_id: PROFILE_ID,
      workspace_id: WS_ID,
      role: "employee",
    },
    accessToken: undefined,
    authMethod: "cookie" as const,
  };
}

// ─── Helper: build params (Next.js 15 async params) ────────────
function makeParams(id: string): { params: Promise<{ id: string }> } {
  return { params: Promise.resolve({ id }) };
}

function makeReq(method = "GET"): Request {
  return new Request(`http://localhost/api/botsson/sessions/${SESSION_ID}`, {
    method,
  }) as never;
}

// ─── Tests ─────────────────────────────────────────────────────
describe("GET /api/botsson/sessions/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── (a) 404 when session not found / not owned ────────────────
  it("(a) returns 404 when supabase returns null (RLS-scoped non-owned or missing)", async () => {
    getServerContextMock.mockResolvedValue(authedCtx());

    createClientMock.mockResolvedValue({
      from: () => ({
        select: () => ({
          eq: () => ({
            eq: () => ({
              eq: () => ({
                eq: () => ({
                  maybeSingle: () => Promise.resolve({ data: null, error: null }),
                }),
              }),
            }),
          }),
        }),
      }),
    });

    const res = await GET(makeReq() as never, makeParams(SESSION_ID));

    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("not_found");
  });

  // ── (b) Returns SessionDetail shape on success ────────────────
  it("(b) returns SessionDetail with conversation array on success", async () => {
    getServerContextMock.mockResolvedValue(authedCtx());

    const sessionRow = {
      id: SESSION_ID,
      summary: "Planning next shift",
      channel: "chat",
      mode: "agent",
      status: "complete",
      is_archived: false,
      created_at: "2026-05-10T08:00:00Z",
      updated_at: "2026-05-10T08:30:00Z",
      workspace_id: WS_ID,
      profile_id: PROFILE_ID,
      collected_data: {
        conversation: [
          { role: "user", content: "When is my next shift?", timestamp: "2026-05-10T08:01:00Z" },
          {
            role: "assistant",
            content: "Your next shift is tomorrow.",
            timestamp: "2026-05-10T08:02:00Z",
          },
        ],
      },
    };

    createClientMock.mockResolvedValue({
      from: () => ({
        select: () => ({
          eq: () => ({
            eq: () => ({
              eq: () => ({
                eq: () => ({
                  maybeSingle: () => Promise.resolve({ data: sessionRow, error: null }),
                }),
              }),
            }),
          }),
        }),
      }),
    });

    const res = await GET(makeReq() as never, makeParams(SESSION_ID));

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      id: string;
      summary: string;
      mode: string;
      status: string;
      is_archived: boolean;
      conversation: Array<{ role: string; content: string }>;
    };

    expect(body.id).toBe(SESSION_ID);
    expect(body.summary).toBe("Planning next shift");
    expect(body.mode).toBe("agent");
    expect(body.status).toBe("complete");
    expect(body.is_archived).toBe(false);
    expect(body.conversation).toHaveLength(2);
    expect(body.conversation[0]!.role).toBe("user");
    expect(body.conversation[1]!.role).toBe("assistant");
  });
});

describe("DELETE /api/botsson/sessions/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    emitMock.mockResolvedValue(undefined);
  });

  // ── (c) Flips is_archived and returns 204 ────────────────────
  it("(c) sets is_archived=true, returns 204 No Content", async () => {
    getServerContextMock.mockResolvedValue(authedCtx());

    const fetchRow = {
      id: SESSION_ID,
      summary: "Test session",
      collected_data: { conversation: [] },
    };

    // Track what payload was passed to update() to verify is_archived=true
    let capturedUpdatePayload: unknown = null;
    let fromCallCount = 0;

    createClientMock.mockResolvedValue({
      from: () => {
        fromCallCount++;
        const callNumber = fromCallCount;

        if (callNumber === 1) {
          // First from() call: select/fetch chain
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  eq: () => ({
                    eq: () => ({
                      maybeSingle: () => Promise.resolve({ data: fetchRow, error: null }),
                    }),
                  }),
                }),
              }),
            }),
          };
        } else {
          // Second from() call: update chain — update().eq().eq().eq() → Promise
          return {
            update: (payload: unknown) => {
              capturedUpdatePayload = payload;
              return {
                eq: () => ({
                  eq: () => ({
                    eq: () => Promise.resolve({ error: null }),
                  }),
                }),
              };
            },
          };
        }
      },
    });

    const res = await DELETE(makeReq("DELETE") as never, makeParams(SESSION_ID));

    expect(res.status).toBe(204);
    expect((capturedUpdatePayload as { is_archived: boolean })?.is_archived).toBe(true);
  });

  // ── (d) Emits botsson.session.archived with entity discriminator ──
  it("(d1) emits botsson.session.archived with entity_type, entity_id, entity_label from summary", async () => {
    getServerContextMock.mockResolvedValue(authedCtx());

    const fetchRow = {
      id: SESSION_ID,
      summary: "Shift planning discussion",
      collected_data: {
        conversation: [
          { role: "user", content: "When is my next shift?", timestamp: "2026-05-10T08:01:00Z" },
        ],
      },
    };

    createClientMock.mockResolvedValue(buildDeleteMock(fetchRow));

    await DELETE(makeReq("DELETE") as never, makeParams(SESSION_ID));

    expect(emitMock).toHaveBeenCalledTimes(1);
    const emitArg = emitMock.mock.calls[0]![0] as {
      event: string;
      workspace_id: string;
      actor_id: string;
      properties: {
        entity: { entity_type: string; entity_id: string; entity_label: string };
        data: { session_id: string; archived_by: string };
      };
    };

    expect(emitArg.event).toBe("botsson.session.archived");
    expect(emitArg.workspace_id).toBe(WS_ID);
    expect(emitArg.actor_id).toBe(PROFILE_ID);
    expect(emitArg.properties.entity.entity_type).toBe("agent_session");
    expect(emitArg.properties.entity.entity_id).toBe(SESSION_ID);
    // summary is present → entity_label = summary
    expect(emitArg.properties.entity.entity_label).toBe("Shift planning discussion");
    expect(emitArg.properties.data.session_id).toBe(SESSION_ID);
    expect(emitArg.properties.data.archived_by).toBe(PROFILE_ID);
  });

  it("(d2) entity_label falls back to first-user-turn slice(0,60) when summary is null", async () => {
    getServerContextMock.mockResolvedValue(authedCtx());

    const longUserMessage = "A".repeat(80); // > 60 chars — should be truncated
    const fetchRow = {
      id: SESSION_ID,
      summary: null,
      collected_data: {
        conversation: [
          { role: "user", content: longUserMessage, timestamp: "2026-05-10T08:01:00Z" },
        ],
      },
    };

    createClientMock.mockResolvedValue(buildDeleteMock(fetchRow));

    await DELETE(makeReq("DELETE") as never, makeParams(SESSION_ID));

    expect(emitMock).toHaveBeenCalledTimes(1);
    const emitArg = emitMock.mock.calls[0]![0] as {
      properties: { entity: { entity_label: string } };
    };
    // Should be truncated to 60 chars
    expect(emitArg.properties.entity.entity_label).toBe(longUserMessage.slice(0, 60));
    expect(emitArg.properties.entity.entity_label.length).toBe(60);
  });

  it("(d3) entity_label falls back to 'Botsson chat' when summary null and no user turns", async () => {
    getServerContextMock.mockResolvedValue(authedCtx());

    const fetchRow = {
      id: SESSION_ID,
      summary: null,
      collected_data: { conversation: [] },
    };

    createClientMock.mockResolvedValue(buildDeleteMock(fetchRow));

    await DELETE(makeReq("DELETE") as never, makeParams(SESSION_ID));

    expect(emitMock).toHaveBeenCalledTimes(1);
    const emitArg = emitMock.mock.calls[0]![0] as {
      properties: { entity: { entity_label: string } };
    };
    expect(emitArg.properties.entity.entity_label).toBe("Botsson chat");
  });
});

// ─── Mock factory ───────────────────────────────────────────────

/**
 * Builds a Supabase mock for DELETE tests.
 * First from().select() call → returns fetchRow (the pre-fetch).
 * Second from().update() call → returns { error: null }.
 */
function buildDeleteMock(fetchRow: unknown) {
  // Track call count to differentiate fetch vs update
  let fromCallCount = 0;

  return {
    from: () => {
      fromCallCount++;
      const callNumber = fromCallCount;

      if (callNumber === 1) {
        // First call: select/fetch
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                eq: () => ({
                  eq: () => ({
                    maybeSingle: () => Promise.resolve({ data: fetchRow, error: null }),
                  }),
                }),
              }),
            }),
          }),
        };
      } else {
        // Second call: update
        return {
          update: (_payload: unknown) => ({
            eq: () => ({
              eq: () => ({
                eq: () => Promise.resolve({ error: null }),
              }),
            }),
          }),
        };
      }
    },
  };
}
