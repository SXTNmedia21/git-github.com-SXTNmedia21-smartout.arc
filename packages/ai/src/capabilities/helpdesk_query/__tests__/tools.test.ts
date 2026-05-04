/**
 * helpdesk_query capability tools — unit tests.
 *
 * Uses the schema-validated Supabase mock (L-0087). Unknown columns in
 * `.select(...)` / `.insert({...})` / `.update({...})` throw immediately
 * with a table-qualified error message, preventing L-0081's echo-mock
 * trap where typo'd column names silently passed tests.
 */

import { describe, it, expect, vi } from "vitest";
import { emit } from "@smartout/telemetry";
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
  // ADR-0161 single-spawn contract: openTicket NO LONGER direct-inserts
  // engine_state. It emits helpdesk.query.opened and fetches back the
  // dispatcher-spawned state via maybeSingle(). The engine_state mock
  // must return the state from the SELECT (not an INSERT response).
  // The emit mock is set up at module-level (vi.mock("@smartout/telemetry")).

  it("emits + fetches back state for private-mode helpdesk (legacy desk path)", async () => {
    // Legacy 'desk' row with privacy_mode='private_per_requester' (backfilled
    // shape). Two `.from('channel')` calls: first reads the desk, second
    // inserts the sub-channel. engine_state is a SELECT (maybeSingle) for
    // the fetch-back — returns the dispatcher-spawned state.
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
      // SELECT fetch-back — simulates the dispatcher-spawned row.
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

  it("emits + fetches back state for public-mode helpdesk (ADR-0165)", async () => {
    // Public mode — no sub-channel spawn. Only one `.from('channel')` read.
    // engine_state SELECT returns the dispatcher-spawned row immediately.
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
      // SELECT fetch-back — simulates the dispatcher-spawned row.
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

  it("returns note when dispatcher state not found within retry window", async () => {
    // Simulates a case where the dispatcher is slow (dev environment) and
    // the fetch-back returns null after all 3 retries. Tool must respond
    // gracefully with ticket_id=null and a note rather than throwing.
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
      // maybeSingle returns null — dispatcher hasn't spawned yet.
      engine_state: { data: null, error: null },
    });

    const result = await openTicket.execute(
      { desk_channel_id: DESK_CHANNEL_ID, summary: "Slow dispatcher test" },
      makeCtx({ supabaseAdmin: sb }),
    );

    const parsed = JSON.parse(result);
    expect(parsed.ticket_id).toBeNull();
    expect(parsed.channel_id).toBe(DESK_CHANNEL_ID);
    expect(parsed.note).toMatch(/list_my_queue/);
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

// ── B4 verification — Invariant 12 falsifiable artefact assertions ──
// Each of these tests fails if the capability returns a hardcoded or
// mislabelled field. The mock is seeded with distinct sentinel UUIDs;
// the assertion is exact-value match on the DB-shaped payload, not on
// the return-shape alone (per Invariant 11 — tool output must reflect
// the artefact it produced). This is the "hvem er ansvarlig?" acceptance
// contract: the capability always returns the responsible profile that
// the DB row declared — never a placeholder, never a drop.
describe("helpdesk_query — artefact assertions (B4 Invariant 12)", () => {
  // Use sentinel UUIDs that are visually distinct from the "happy path"
  // UUIDs above so a future refactor accidentally reading from the wrong
  // row produces an immediately-visible mismatch.
  const DESK_B4 = "aaaaaaaa-0000-0000-0000-000000000001";
  const OWNER_B4 = "bbbbbbbb-0000-0000-0000-000000000001";
  const REQUESTER_B4 = "cccccccc-0000-0000-0000-000000000001";
  const TICKET_B4 = "dddddddd-0000-0000-0000-000000000001";
  const THREAD_B4 = "eeeeeeee-0000-0000-0000-000000000001";

  it("getTicket returns the exact responsible_profile_id stored on the engine_state row", async () => {
    // "Hvem er ansvarlig for denne ticket?" — the acceptance question.
    // The capability MUST return OWNER_B4 (the assignee_id on the mocked
    // engine_state row), not PROFILE_ID, not REP_PROFILE_ID, not a stub.
    const sb = mockSupabase({
      engine_state: {
        data: {
          id: TICKET_B4,
          entity_id: THREAD_B4,
          status: "waiting",
          assignee_id: OWNER_B4,
          context: {
            summary: "Trenger jeg MVA-spørsmål?",
            desk_channel_id: DESK_B4,
            requester_profile_id: REQUESTER_B4,
          },
          started_at: "2026-04-24T10:00:00Z",
          updated_at: "2026-04-24T10:00:00Z",
        },
        error: null,
      },
    });

    const result = await getTicket.execute(
      { ticket_id: TICKET_B4 },
      makeCtx({ supabaseAdmin: sb }),
    );
    const parsed = JSON.parse(result);

    // Exact artefact match — the responsible (assignee) MUST be the one
    // the DB row declared, not the caller's profile, not the requester.
    expect(parsed.assignee_profile_id).toBe(OWNER_B4);
    expect(parsed.assignee_profile_id).not.toBe(PROFILE_ID); // caller
    expect(parsed.assignee_profile_id).not.toBe(REQUESTER_B4); // requester
    expect(parsed.requester_profile_id).toBe(REQUESTER_B4);
    expect(parsed.desk_channel_id).toBe(DESK_B4);
    expect(parsed.channel_id).toBe(THREAD_B4);
    expect(parsed.ticket_id).toBe(TICKET_B4);
  });

  it("openTicket emits helpdesk.query.opened with assignee_profile_id = desk.responsible_profile_id (private mode)", async () => {
    // Invariant 11 / 12 — the tool MUST produce its declared artefact in the
    // same execute() call. Per ADR-0161 single-spawn contract the artefact is
    // the EMIT payload (dispatcher consumes it and spawns engine_state). We
    // capture (a) the channel_member inserts to verify membership wiring,
    // (b) the emit() call to verify dispatcher contract: assignee_profile_id =
    // OWNER_B4 (from desk.responsible_profile_id), requester_profile_id =
    // ctx.profileId, desk_channel_id = DESK_B4, summary echoed.
    const insertedRows: Array<{ table: string; row: Record<string, unknown> }> = [];

    const sb = mockSupabase({
      channel: [
        {
          data: {
            id: DESK_B4,
            workspace_id: WORKSPACE_ID,
            channel_type: "custom",
            helpdesk_enabled: true,
            privacy_mode: "private_per_requester",
            responsible_profile_id: OWNER_B4,
            name: "HR Desk",
          },
          error: null,
        },
        { data: { id: THREAD_B4 }, error: null }, // sub-channel insert → select
      ],
      channel_member: { data: null, error: null },
      // SELECT fetch-back — simulates the dispatcher-spawned engine_state.
      engine_state: { data: { id: TICKET_B4 }, error: null },
    });

    // Wrap sb.from() to capture every .insert() payload by table name.
    // Same pattern as the L-0079 terminal-update guard above.
    const originalFrom = sb.from;
    sb.from = vi.fn((name: string) => {
      const builder = originalFrom(name) as unknown as {
        insert: (row: Record<string, unknown> | Array<Record<string, unknown>>) => unknown;
      };
      const originalInsert = builder.insert.bind(builder);
      builder.insert = ((row: Record<string, unknown> | Array<Record<string, unknown>>) => {
        if (Array.isArray(row)) {
          for (const r of row) insertedRows.push({ table: name, row: r });
        } else {
          insertedRows.push({ table: name, row });
        }
        return originalInsert(row);
      }) as typeof builder.insert;
      return builder as never;
    }) as typeof sb.from;

    // Reset emit mock so we can assert exact call shape from this test.
    vi.mocked(emit).mockClear();

    const result = await openTicket.execute(
      { desk_channel_id: DESK_B4, summary: "Spørsmål om lønn" },
      makeCtx({ profileId: nonEmpty(REQUESTER_B4, "profileId"), supabaseAdmin: sb }),
    );
    const parsed = JSON.parse(result);

    // (a) Return value match.
    expect(parsed.ticket_id).toBe(TICKET_B4);
    expect(parsed.channel_id).toBe(THREAD_B4);
    expect(parsed.assignee_profile_id).toBe(OWNER_B4);

    // (b) Artefact match — the emit payload the dispatcher consumes.
    // `assignee_profile_id` MUST be OWNER_B4 (the desk's responsible
    // profile), NOT the caller. `requester_profile_id` MUST be the caller.
    // `entity_id` MUST be the sub-channel (private mode anchors on thread).
    const opened = vi
      .mocked(emit)
      .mock.calls.find(([payload]) => payload.event === "helpdesk.query.opened");
    expect(opened).toBeDefined();
    const payload = opened![0] as {
      event: string;
      workspace_id: string;
      actor_id: string;
      entity: { entity_type: string; entity_id: string };
      properties: Record<string, unknown>;
    };
    expect(payload.workspace_id).toBe(WORKSPACE_ID);
    expect(payload.actor_id).toBe(REQUESTER_B4);
    expect(payload.entity.entity_type).toBe("channel");
    expect(payload.entity.entity_id).toBe(THREAD_B4); // private mode → sub-channel
    expect(payload.properties.assignee_profile_id).toBe(OWNER_B4);
    expect(payload.properties.requester_profile_id).toBe(REQUESTER_B4);
    expect(payload.properties.desk_channel_id).toBe(DESK_B4);
    expect(payload.properties.summary).toBe("Spørsmål om lønn");

    // (c) Two channel_member inserts: requester + rep. Both on the
    // correct thread, both in the correct workspace.
    const memberInserts = insertedRows.filter((r) => r.table === "channel_member");
    expect(memberInserts).toHaveLength(2);
    const memberProfileIds = memberInserts.map((r) => r.row.profile_id).sort();
    expect(memberProfileIds).toEqual([REQUESTER_B4, OWNER_B4].sort());
    for (const m of memberInserts) {
      expect(m.row.channel_id).toBe(THREAD_B4);
      expect(m.row.workspace_id).toBe(WORKSPACE_ID);
    }
  });

  it("openTicket in public mode anchors emit entity on the helpdesk channel itself (ADR-0165 Rule 4)", async () => {
    // Public-mode path — emit's entity.entity_id MUST equal the helpdesk
    // channel id (no sub-channel spawned). Per ADR-0161 single-spawn the
    // dispatcher consumes the emit and propagates entity_id into
    // engine_state, so anchoring the emit correctly is the artefact.
    const insertedRows: Array<{ table: string; row: Record<string, unknown> }> = [];

    const sb = mockSupabase({
      channel: {
        data: {
          id: DESK_B4,
          workspace_id: WORKSPACE_ID,
          channel_type: "custom",
          helpdesk_enabled: true,
          privacy_mode: "public",
          responsible_profile_id: OWNER_B4,
          name: "#bar",
        },
        error: null,
      },
      // SELECT fetch-back — simulates the dispatcher-spawned engine_state.
      engine_state: { data: { id: TICKET_B4 }, error: null },
    });

    const originalFrom = sb.from;
    sb.from = vi.fn((name: string) => {
      const builder = originalFrom(name) as unknown as {
        insert: (row: Record<string, unknown>) => unknown;
      };
      const originalInsert = builder.insert.bind(builder);
      builder.insert = ((row: Record<string, unknown>) => {
        insertedRows.push({ table: name, row });
        return originalInsert(row);
      }) as typeof builder.insert;
      return builder as never;
    }) as typeof sb.from;

    vi.mocked(emit).mockClear();

    await openTicket.execute(
      { desk_channel_id: DESK_B4, summary: "Hvem steller baren i kveld?" },
      makeCtx({ profileId: nonEmpty(REQUESTER_B4, "profileId"), supabaseAdmin: sb }),
    );

    // Artefact: emit anchors entity on desk itself, not a spawned thread.
    const opened = vi.mocked(emit).mock.calls.find(([p]) => p.event === "helpdesk.query.opened");
    expect(opened).toBeDefined();
    const payload = opened![0] as {
      entity: { entity_type: string; entity_id: string };
      properties: Record<string, unknown>;
    };
    expect(payload.entity.entity_type).toBe("channel");
    expect(payload.entity.entity_id).toBe(DESK_B4); // public mode → desk anchor
    expect(payload.properties.assignee_profile_id).toBe(OWNER_B4);

    // And: no channel_member inserts (public mode does not mutate
    // membership — everyone in the desk sees the thread).
    const memberInserts = insertedRows.filter((r) => r.table === "channel_member");
    expect(memberInserts).toHaveLength(0);

    // And: no new channel insert (public mode reuses the desk).
    const channelInserts = insertedRows.filter((r) => r.table === "channel");
    expect(channelInserts).toHaveLength(0);
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
