/**
 * helpdesk_query capability tools — unit tests.
 *
 * Uses the schema-validated Supabase mock (L-0087). Unknown columns in
 * `.select(...)` / `.insert({...})` / `.update({...})` throw immediately
 * with a table-qualified error message, preventing L-0081's echo-mock
 * trap where typo'd column names silently passed tests.
 */

import { describe, it, expect, vi } from "vitest";
import { nonEmpty } from "@smartout/telemetry/server";
import type { AgentToolContext } from "../../types.js";
import { openTicket, listMyQueue, getTicket, resolveTicket } from "../tools.js";
import { mockSupabase } from "../../__tests__/supabase-mock.js";

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

function makeCtx(overrides: Partial<AgentToolContext> = {}): AgentToolContext {
  return {
    workspaceId: nonEmpty(WORKSPACE_ID, "workspaceId"),
    profileId: nonEmpty(PROFILE_ID, "profileId"),
    sessionId: "session-1",
    supabaseAdmin: mockSupabase({}),
    channel: "chat",
    ...overrides,
  };
}

describe("openTicket", () => {
  it("creates a sub-channel + ticket state for private-mode helpdesk (legacy desk path)", async () => {
    // Legacy 'desk' row with privacy_mode='private_per_requester' (the
    // backfilled shape). Two `.from('channel')` calls: first reads the
    // desk, second inserts the sub-channel.
    const sb = mockSupabase({
      channel: [
        {
          data: {
            id: DESK_CHANNEL_ID,
            workspace_id: WORKSPACE_ID,
            channel_type: "desk",
            helpdesk_enabled: true,
            privacy_mode: "private_per_requester",
            responsible_profile_id: REP_PROFILE_ID,
            name: "HR Desk",
          },
          error: null,
        },
        { data: { id: THREAD_CHANNEL_ID }, error: null },
      ],
      channel_member: { data: null, error: null },
      engine_state: { data: { id: TICKET_ID }, error: null },
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

  it("reuses the helpdesk channel as conversation for public-mode helpdesk (ADR-0165)", async () => {
    // Public mode — no sub-channel spawn. Only one `.from('channel')` read,
    // and engine_state.entity_id MUST equal DESK_CHANNEL_ID (ADR-0165 Rule 4).
    const sb = mockSupabase({
      channel: {
        data: {
          id: DESK_CHANNEL_ID,
          workspace_id: WORKSPACE_ID,
          channel_type: "custom",
          helpdesk_enabled: true,
          privacy_mode: "public",
          responsible_profile_id: REP_PROFILE_ID,
          name: "#bar",
        },
        error: null,
      },
      engine_state: { data: { id: TICKET_ID }, error: null },
    });

    const result = await openTicket.execute(
      { desk_channel_id: DESK_CHANNEL_ID, summary: "How do I register a sick day?" },
      makeCtx({ supabaseAdmin: sb }),
    );

    const parsed = JSON.parse(result);
    expect(parsed.ticket_id).toBe(TICKET_ID);
    // Conversation is the helpdesk channel itself — no spawn, no separate id.
    expect(parsed.channel_id).toBe(DESK_CHANNEL_ID);
    expect(parsed.assignee_profile_id).toBe(REP_PROFILE_ID);
  });

  it("rejects when channel is not a helpdesk", async () => {
    const sb = mockSupabase({
      channel: {
        data: {
          id: DESK_CHANNEL_ID,
          workspace_id: WORKSPACE_ID,
          channel_type: "custom",
          helpdesk_enabled: false,
          privacy_mode: null,
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
    expect(result).toContain("not a helpdesk");
  });

  it("rejects when helpdesk has no responsible owner", async () => {
    const sb = mockSupabase({
      channel: {
        data: {
          id: DESK_CHANNEL_ID,
          workspace_id: WORKSPACE_ID,
          channel_type: "desk",
          helpdesk_enabled: true,
          privacy_mode: "private_per_requester",
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
          helpdesk_enabled: true,
          privacy_mode: "private_per_requester",
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
            started_at: "2026-04-20T10:00:00Z",
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
          started_at: "2026-04-20T10:00:00Z",
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
    const sb = mockSupabase({
      engine_state: {
        data: {
          id: TICKET_ID,
          workspace_id: WORKSPACE_ID,
          entity_id: THREAD_CHANNEL_ID,
          assignee_id: REP_PROFILE_ID, // not PROFILE_ID
          status: "waiting",
          context: { summary: "Q" },
        },
        error: null,
      },
      workspace: { data: { company_id: "55555555-5555-5555-5555-555555555555" }, error: null },
      company_member: { data: { role: "member" }, error: null },
    });
    const result = await resolveTicket.execute(
      { ticket_id: TICKET_ID },
      makeCtx({ supabaseAdmin: sb, userId: "11111111-1111-1111-1111-111111111111" }),
    );
    expect(result).toContain("Only the assignee");
  });

  it("hard-fails when caller is not assignee and has no userId", async () => {
    const sb = mockSupabase({
      engine_state: {
        data: {
          id: TICKET_ID,
          workspace_id: WORKSPACE_ID,
          entity_id: THREAD_CHANNEL_ID,
          assignee_id: REP_PROFILE_ID,
          status: "waiting",
          context: {},
        },
        error: null,
      },
    });
    const result = await resolveTicket.execute(
      { ticket_id: TICKET_ID },
      makeCtx({ supabaseAdmin: sb }), // userId undefined
    );
    expect(result).toContain("session has no user identity");
  });

  it("rejects cross-company admin privilege escalation", async () => {
    const sb = mockSupabase({
      engine_state: {
        data: {
          id: TICKET_ID,
          workspace_id: WORKSPACE_ID,
          entity_id: THREAD_CHANNEL_ID,
          assignee_id: REP_PROFILE_ID,
          status: "waiting",
          context: {},
        },
        error: null,
      },
      workspace: { data: { company_id: "55555555-5555-5555-5555-555555555555" }, error: null },
      // User IS admin but in a DIFFERENT company — scoped query returns null.
      company_member: { data: null, error: null },
    });
    const result = await resolveTicket.execute(
      { ticket_id: TICKET_ID },
      makeCtx({ supabaseAdmin: sb, userId: "11111111-1111-1111-1111-111111111111" }),
    );
    expect(result).toContain("Only the assignee or an admin");
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

  // L-0079 regression guard — terminal engine_state transitions outside
  // engine-dispatch MUST stamp completed_at. The schema-validated mock
  // throws on unknown columns, so if somebody removes completed_at from
  // the update payload the existing success tests continue to pass but
  // SLA / reporting queries silently drop the row.
  it("stamps completed_at on the update payload (L-0079)", async () => {
    const sb = mockSupabase({
      engine_state: {
        data: {
          id: TICKET_ID,
          workspace_id: WORKSPACE_ID,
          entity_id: THREAD_CHANNEL_ID,
          assignee_id: PROFILE_ID,
          status: "waiting",
          context: {},
        },
        error: null,
      },
    });

    // mockSupabase's from() produces a fresh proxy per call, so wrap it
    // and accumulate every update payload across invocations into a
    // captured list. We then assert the final status='complete' update
    // carries the completed_at stamp.
    const updatePayloads: Array<Record<string, unknown>> = [];
    const originalFrom = sb.from;
    sb.from = vi.fn((name: string) => {
      const builder = originalFrom(name) as unknown as {
        update: (row: Record<string, unknown>) => unknown;
      };
      const originalUpdate = builder.update.bind(builder);
      builder.update = ((row: Record<string, unknown>) => {
        if (name === "engine_state") updatePayloads.push(row);
        return originalUpdate(row);
      }) as typeof builder.update;
      return builder as never;
    }) as typeof sb.from;

    const result = await resolveTicket.execute(
      { ticket_id: TICKET_ID, resolution_note: "done" },
      makeCtx({ supabaseAdmin: sb }),
    );
    expect(JSON.parse(result).resolved).toBe(true);

    const terminalUpdate = updatePayloads.find((row) => row.status === "complete");
    expect(terminalUpdate).toBeDefined();
    expect(typeof terminalUpdate?.completed_at).toBe("string");
    expect(typeof terminalUpdate?.updated_at).toBe("string");
  });
});

// ── L-0087 regression guard ────────────────────────────────────────
describe("supabase-mock schema validation (L-0087 guard)", () => {
  it("throws when select references unknown column", async () => {
    const sb = mockSupabase({
      engine_state: { data: { id: TICKET_ID }, error: null },
    });
    // Simulate a test writer making the L-0081 mistake of using `created_at`
    // (doesn't exist on engine_state) instead of `started_at`. The mock must
    // throw loudly rather than echo the invalid column back.
    expect(() => sb.from("engine_state").select("id, created_at")).toThrow(
      /unknown column 'created_at' on table 'engine_state'/,
    );
  });

  it("throws when insert references unknown column", () => {
    const sb = mockSupabase({
      channel: { data: { id: DESK_CHANNEL_ID }, error: null },
    });
    // If a test tries to insert a column that doesn't exist (e.g. the
    // rejected `engine_state_id` back-reference from the Progressive
    // Channel council), the mock must throw.
    expect(() =>
      sb.from("channel").insert({
        id: DESK_CHANNEL_ID,
        workspace_id: WORKSPACE_ID,
        channel_type: "desk",
        engine_state_id: TICKET_ID, // NOT in schema — Council rejected this column
      }),
    ).toThrow(/insert on 'channel' with unknown column 'engine_state_id'/);
  });

  it("accepts known columns from the Progressive Channel schema", () => {
    const sb = mockSupabase({
      channel: { data: { id: DESK_CHANNEL_ID }, error: null },
    });
    // New ADR-0165 columns must be accepted.
    expect(() =>
      sb.from("channel").insert({
        id: DESK_CHANNEL_ID,
        workspace_id: WORKSPACE_ID,
        channel_type: "custom",
        helpdesk_enabled: true,
        privacy_mode: "public",
        responsible_profile_id: REP_PROFILE_ID,
      }),
    ).not.toThrow();
  });
});
