import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AgentToolContext } from "../../types.js";
import { openTicket, listMyQueue, getTicket, resolveTicket } from "../tools.js";

// Shared telemetry mock — emit() is async and must not throw.
vi.mock("@smartout/telemetry", () => ({
  emit: vi.fn().mockResolvedValue(undefined),
}));

const WORKSPACE_ID = "10000000-0000-0000-0000-000000000001";
const PROFILE_ID = "20000000-0000-0000-0000-000000000001";
const REP_PROFILE_ID = "20000000-0000-0000-0000-000000000002";
const DESK_CHANNEL_ID = "30000000-0000-0000-0000-000000000001";
const THREAD_CHANNEL_ID = "30000000-0000-0000-0000-000000000002";
const TICKET_ID = "40000000-0000-0000-0000-000000000001";

type MockRow = Record<string, unknown>;

/**
 * Chainable stub that mirrors the subset of PostgrestQueryBuilder we use.
 * Each call returns the same proxy so `.eq(...).eq(...).single()` works.
 */
function chainable(result: { data: MockRow | MockRow[] | null; error: unknown | null }) {
  const proxy: Record<string, unknown> = {};
  const methods = [
    "select",
    "insert",
    "update",
    "delete",
    "eq",
    "in",
    "order",
    "limit",
    "maybeSingle",
  ];
  for (const m of methods) proxy[m] = vi.fn().mockReturnValue(proxy);
  proxy.single = vi.fn().mockResolvedValue(result);
  // Terminal awaits on `select` / `insert` / `update` without `.single()`:
  (proxy as { then?: (resolve: (r: typeof result) => void) => void }).then = (resolve) =>
    resolve(result);
  return proxy;
}

function mockSupabase(
  tables: Record<string, { data: MockRow | MockRow[] | null; error: unknown | null }>,
): SupabaseClient {
  const from = vi.fn((name: string) => {
    const table = tables[name];
    if (!table) {
      return chainable({ data: null, error: { message: `unknown table ${name}` } });
    }
    return chainable(table);
  });
  return { from } as unknown as SupabaseClient;
}

function makeCtx(overrides: Partial<AgentToolContext> = {}): AgentToolContext {
  return {
    workspaceId: WORKSPACE_ID,
    profileId: PROFILE_ID,
    sessionId: "session-1",
    supabaseAdmin: mockSupabase({}),
    channel: "chat",
    ...overrides,
  };
}

describe("openTicket", () => {
  it("creates conversation + ticket state when desk has owner", async () => {
    const sb = mockSupabase({
      channel: {
        data: {
          id: DESK_CHANNEL_ID,
          workspace_id: WORKSPACE_ID,
          channel_type: "desk",
          responsible_profile_id: REP_PROFILE_ID,
          name: "HR Desk",
        },
        error: null,
      },
      channel_member: { data: null, error: null },
      engine_state: { data: { id: TICKET_ID }, error: null },
    });
    // Override channel table for second call (insert thread) and subsequent calls:
    let channelCall = 0;
    (sb.from as unknown as ReturnType<typeof vi.fn>).mockImplementation((name: string) => {
      if (name === "channel") {
        channelCall++;
        if (channelCall === 1) {
          return chainable({
            data: {
              id: DESK_CHANNEL_ID,
              workspace_id: WORKSPACE_ID,
              channel_type: "desk",
              responsible_profile_id: REP_PROFILE_ID,
              name: "HR Desk",
            },
            error: null,
          });
        }
        return chainable({ data: { id: THREAD_CHANNEL_ID }, error: null });
      }
      if (name === "channel_member") return chainable({ data: null, error: null });
      if (name === "engine_state") return chainable({ data: { id: TICKET_ID }, error: null });
      return chainable({ data: null, error: { message: `unknown ${name}` } });
    });

    const result = await openTicket.execute(
      { desk_channel_id: DESK_CHANNEL_ID, summary: "How do I register a sick day?" },
      makeCtx({ supabaseAdmin: sb }),
    );

    const parsed = JSON.parse(result);
    expect(parsed.ticket_id).toBe(TICKET_ID);
    expect(parsed.channel_id).toBe(THREAD_CHANNEL_ID);
    expect(parsed.assignee_profile_id).toBe(REP_PROFILE_ID);
  });

  it("rejects when channel is not a desk", async () => {
    const sb = mockSupabase({
      channel: {
        data: {
          id: DESK_CHANNEL_ID,
          workspace_id: WORKSPACE_ID,
          channel_type: "custom",
          responsible_profile_id: null,
          name: "Random",
        },
        error: null,
      },
    });
    const result = await openTicket.execute(
      { desk_channel_id: DESK_CHANNEL_ID, summary: "test" },
      makeCtx({ supabaseAdmin: sb }),
    );
    expect(result).toContain("not a desk");
  });

  it("rejects when desk has no responsible owner", async () => {
    const sb = mockSupabase({
      channel: {
        data: {
          id: DESK_CHANNEL_ID,
          workspace_id: WORKSPACE_ID,
          channel_type: "desk",
          responsible_profile_id: null,
          name: "Orphan Desk",
        },
        error: null,
      },
    });
    const result = await openTicket.execute(
      { desk_channel_id: DESK_CHANNEL_ID, summary: "test" },
      makeCtx({ supabaseAdmin: sb }),
    );
    expect(result).toContain("no responsible representative");
  });

  it("rejects cross-workspace access", async () => {
    const otherWorkspace = "99999999-9999-9999-9999-999999999999";
    const sb = mockSupabase({
      channel: {
        data: {
          id: DESK_CHANNEL_ID,
          workspace_id: otherWorkspace,
          channel_type: "desk",
          responsible_profile_id: REP_PROFILE_ID,
          name: "Foreign Desk",
        },
        error: null,
      },
    });
    const result = await openTicket.execute(
      { desk_channel_id: DESK_CHANNEL_ID, summary: "test" },
      makeCtx({ supabaseAdmin: sb }),
    );
    expect(result).toContain("different workspace");
  });
});

describe("listMyQueue", () => {
  it("returns tickets assigned to current profile", async () => {
    const sb = mockSupabase({
      engine_state: {
        data: [
          {
            id: TICKET_ID,
            entity_id: THREAD_CHANNEL_ID,
            status: "waiting",
            current_step: 1,
            context: { summary: "Test query" },
            created_at: "2026-04-20T10:00:00Z",
          },
        ],
        error: null,
      },
    });
    const result = await listMyQueue.execute({ limit: 20 }, makeCtx({ supabaseAdmin: sb }));
    const parsed = JSON.parse(result);
    expect(parsed.count).toBe(1);
    expect(parsed.tickets[0].ticket_id).toBe(TICKET_ID);
    expect(parsed.tickets[0].summary).toBe("Test query");
  });

  it("returns empty list gracefully", async () => {
    const sb = mockSupabase({ engine_state: { data: [], error: null } });
    const result = await listMyQueue.execute({ limit: 20 }, makeCtx({ supabaseAdmin: sb }));
    expect(JSON.parse(result).count).toBe(0);
  });
});

describe("getTicket", () => {
  it("returns ticket details", async () => {
    const sb = mockSupabase({
      engine_state: {
        data: {
          id: TICKET_ID,
          entity_id: THREAD_CHANNEL_ID,
          status: "waiting",
          assignee_id: REP_PROFILE_ID,
          context: {
            summary: "A query",
            desk_channel_id: DESK_CHANNEL_ID,
            requester_profile_id: PROFILE_ID,
          },
          created_at: "2026-04-20T10:00:00Z",
          updated_at: "2026-04-20T10:00:00Z",
        },
        error: null,
      },
    });
    const result = await getTicket.execute(
      { ticket_id: TICKET_ID },
      makeCtx({ supabaseAdmin: sb }),
    );
    const parsed = JSON.parse(result);
    expect(parsed.ticket_id).toBe(TICKET_ID);
    expect(parsed.channel_id).toBe(THREAD_CHANNEL_ID);
    expect(parsed.summary).toBe("A query");
    expect(parsed.assignee_profile_id).toBe(REP_PROFILE_ID);
  });

  it("returns error when ticket not found", async () => {
    const sb = mockSupabase({ engine_state: { data: null, error: { message: "No rows" } } });
    const result = await getTicket.execute(
      { ticket_id: TICKET_ID },
      makeCtx({ supabaseAdmin: sb }),
    );
    expect(result).toContain("not found");
  });
});

describe("resolveTicket", () => {
  it("resolves when caller is assignee", async () => {
    const sb = mockSupabase({
      engine_state: {
        data: {
          id: TICKET_ID,
          workspace_id: WORKSPACE_ID,
          entity_id: THREAD_CHANNEL_ID,
          assignee_id: PROFILE_ID,
          status: "waiting",
          context: { summary: "Q" },
        },
        error: null,
      },
    });
    const result = await resolveTicket.execute(
      { ticket_id: TICKET_ID, resolution_note: "Answered in thread" },
      makeCtx({ supabaseAdmin: sb }),
    );
    const parsed = JSON.parse(result);
    expect(parsed.resolved).toBe(true);
  });

  it("rejects when caller is neither assignee nor admin", async () => {
    const sb = mockSupabase({});
    (sb.from as unknown as ReturnType<typeof vi.fn>).mockImplementation((name: string) => {
      if (name === "engine_state") {
        return chainable({
          data: {
            id: TICKET_ID,
            workspace_id: WORKSPACE_ID,
            entity_id: THREAD_CHANNEL_ID,
            assignee_id: REP_PROFILE_ID, // not PROFILE_ID
            status: "waiting",
            context: { summary: "Q" },
          },
          error: null,
        });
      }
      if (name === "company_member") {
        return chainable({ data: { role: "member" }, error: null });
      }
      return chainable({ data: null, error: { message: "unknown" } });
    });
    const result = await resolveTicket.execute(
      { ticket_id: TICKET_ID },
      makeCtx({ supabaseAdmin: sb, userId: "user-1" }),
    );
    expect(result).toContain("Only the assignee");
  });

  it("rejects cross-workspace ticket", async () => {
    const sb = mockSupabase({
      engine_state: {
        data: {
          id: TICKET_ID,
          workspace_id: "99999999-9999-9999-9999-999999999999",
          entity_id: THREAD_CHANNEL_ID,
          assignee_id: PROFILE_ID,
          status: "waiting",
          context: {},
        },
        error: null,
      },
    });
    const result = await resolveTicket.execute(
      { ticket_id: TICKET_ID },
      makeCtx({ supabaseAdmin: sb }),
    );
    expect(result).toContain("different workspace");
  });

  it("rejects already-resolved ticket", async () => {
    const sb = mockSupabase({
      engine_state: {
        data: {
          id: TICKET_ID,
          workspace_id: WORKSPACE_ID,
          entity_id: THREAD_CHANNEL_ID,
          assignee_id: PROFILE_ID,
          status: "complete",
          context: {},
        },
        error: null,
      },
    });
    const result = await resolveTicket.execute(
      { ticket_id: TICKET_ID },
      makeCtx({ supabaseAdmin: sb }),
    );
    expect(result).toContain("already resolved");
  });
});
