// packages/ai/src/capabilities/communication/__tests__/publishAnnouncement.test.ts
//
// Unit tests for the `publish_announcement` capability tool.
//
// Test cases covering the declared journeys in PLAN-botsson-publishannouncement-capability.md:
//   TC-1  Voice channel → in-tool reject as FIRST statement (no gate call, no INSERT)
//   TC-2  Gate denied (allow=false) → no INSERT, descriptive error
//   TC-3  confirm=false → InlineConfirmCardDescriptor returned, no INSERT,
//          emit("inline_confirm_card.shown") fires (ADR-0398 Architecture B)
//   TC-4  confirm=true + granted gate → INSERT fires, emit fires (channel.message.sent +
//          inline_confirm_card.confirmed), PII boundary holds
//   TC-5  Audience resolves to 0 → descriptive error, no INSERT
//   TC-P  Precheck gate denied → draft refused, no descriptor, no INSERT
//
// Mock strategy mirrors sendMessage.gate.test.ts:
//   - vi.mock("../gate.js")   — default allow, override per-test
//   - vi.mock("@smartout/telemetry") — emit stubbed
//   - vi.mock("../audience-resolver.js") — default non-empty audience, override per-test
//   - supabase chain stubbed inline (membership + policy + channel_message tables)

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AgentToolContext } from "../../types.js";

// ── Mocks — must be declared before the module under test is imported ──────

vi.mock("@smartout/telemetry", () => ({
  emit: vi.fn().mockResolvedValue(undefined),
  nonEmpty: (v: string) => v,
}));

// Default: gate allows. Individual tests override via mockResolvedValueOnce.
vi.mock("../gate.js", () => ({
  callGateAction: vi.fn().mockResolvedValue({
    allow: true,
    reason: null,
    channelAllowed: true,
    downgradeTo: null,
    minRoleRequired: null,
    requiresFourEyes: false,
    approversNeeded: 0,
    approversPresent: [],
    gateEvaluationId: null,
  }),
}));

// Default: resolves to 5 recipients. Override per-test for TC-5.
vi.mock("../audience-resolver.js", () => ({
  resolveAudience: vi.fn().mockResolvedValue({
    profileIds: [
      "00000000-0000-0000-0000-000000000010",
      "00000000-0000-0000-0000-000000000011",
      "00000000-0000-0000-0000-000000000012",
      "00000000-0000-0000-0000-000000000013",
      "00000000-0000-0000-0000-000000000014",
    ],
    count: 5,
    label: "Alle (5)",
  }),
}));

// ── Import AFTER mocks ─────────────────────────────────────────────────────

import { publishAnnouncement } from "../publish-announcement.js";
import { callGateAction } from "../gate.js";
import { resolveAudience } from "../audience-resolver.js";
import { emit } from "@smartout/telemetry";

// ── Helpers ───────────────────────────────────────────────────────────────

const CHANNEL_ID = "00000000-0000-0000-0000-000000000001";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const WORKSPACE_ID = "00000000-0000-0000-0000-000000000002" as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const PROFILE_ID = "00000000-0000-0000-0000-000000000003" as any;
const MESSAGE_ID = "00000000-0000-0000-0000-000000000005";

type InsertCapture = { table: string; row: Record<string, unknown> };

/**
 * Build a minimal SupabaseClient stub.
 *
 * `insertCaptures` collects every `.from(table).insert(row)` call so tests
 * can assert INSERT was (or was not) fired.
 */
function makeSupabase(insertCaptures: InsertCapture[] = []): SupabaseClient {
  return {
    // V2: publish_announcement now calls RPC instead of direct INSERT
    rpc(fnName: string, args: Record<string, unknown>) {
      if (fnName === "publish_announcement_atomic") {
        insertCaptures.push({ table: "rpc:publish_announcement_atomic", row: args });
        return Promise.resolve({ data: MESSAGE_ID, error: null });
      }
      return Promise.resolve({ data: null, error: null });
    },
    from(table: string) {
      if (table === "channel_member") {
        return {
          select() {
            return {
              eq(_col: string, _val: unknown) {
                return {
                  eq(_col2: string, _val2: unknown) {
                    return {
                      single: vi.fn().mockResolvedValue({
                        data: { id: "member-1" },
                        error: null,
                      }),
                    };
                  },
                };
              },
            };
          },
        };
      }

      if (table === "channel_ai_policy") {
        // Permissive policy so ADR-0163 layer never blocks gate tests.
        return {
          select() {
            return {
              eq(_col: string, _val: unknown) {
                return {
                  single: vi.fn().mockResolvedValue({
                    data: {
                      text_participation: "proactive",
                      voice_participation: "interactive",
                      auto_reminders: true,
                      auto_shift_prep: true,
                      auto_summarize: true,
                    },
                    error: null,
                  }),
                };
              },
            };
          },
        };
      }

      if (table === "channel_message") {
        return {
          insert(row: Record<string, unknown>) {
            insertCaptures.push({ table, row });
            return {
              select() {
                return {
                  single: vi.fn().mockResolvedValue({
                    data: {
                      id: MESSAGE_ID,
                      content: row.content,
                      created_at: "2026-05-11T00:00:00.000Z",
                    },
                    error: null,
                  }),
                };
              },
            };
          },
        };
      }

      // Fallback — should not be reached in these test cases.
      return {
        select: vi.fn().mockReturnThis(),
        insert: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
      };
    },
  } as unknown as SupabaseClient;
}

function makeCtx(overrides: Partial<AgentToolContext> = {}): AgentToolContext {
  return {
    workspaceId: WORKSPACE_ID,
    profileId: PROFILE_ID,
    sessionId: "sess-test",
    channel: "chat",
    supabaseAdmin: makeSupabase(),
    ...overrides,
  };
}

const DEFAULT_PARAMS = {
  channel_id: CHANNEL_ID,
  title: "Viktig melding",
  body: "Husk å lukke baren ordentlig i kveld.",
  audience_kind: "all" as const,
  confirm: false,
};

// ── Tests ─────────────────────────────────────────────────────────────────

describe("publishAnnouncement — capability tool", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Reset callGateAction to the default allow response
    vi.mocked(callGateAction).mockResolvedValue({
      allow: true,
      reason: null,
      channelAllowed: true,
      downgradeTo: null,
      minRoleRequired: null,
      requiresFourEyes: false,
      approversNeeded: 0,
      approversPresent: [],
      gateEvaluationId: null,
    });

    // Reset resolveAudience to default 5 recipients
    vi.mocked(resolveAudience).mockResolvedValue({
      profileIds: [
        "00000000-0000-0000-0000-000000000010",
        "00000000-0000-0000-0000-000000000011",
        "00000000-0000-0000-0000-000000000012",
        "00000000-0000-0000-0000-000000000013",
        "00000000-0000-0000-0000-000000000014",
      ],
      count: 5,
      label: "Alle (5)",
    });
  });

  it("TC-1 (voice reject): voice channel → in-tool reject BEFORE gate, no gate call, no INSERT", async () => {
    const insertCaptures: InsertCapture[] = [];
    const ctx = makeCtx({
      channel: "voice",
      supabaseAdmin: makeSupabase(insertCaptures),
    });

    const result = await publishAnnouncement.execute(DEFAULT_PARAMS, ctx);

    // Voice reject must be FIRST — gate must NOT have been called at all
    expect(callGateAction).not.toHaveBeenCalled();

    // No INSERT, no emit
    expect(insertCaptures).toHaveLength(0);
    expect(emit).not.toHaveBeenCalled();

    // Copy mentions voice and chat
    expect(result).toMatch(/voice/i);
    expect(result).toMatch(/chat/i);
  });

  it("TC-2 (gate denied): allow=false on commit gate → no INSERT, no emit, descriptive error", async () => {
    // First gate call (commit gate) denied → early return before precheck or descriptor
    vi.mocked(callGateAction).mockResolvedValueOnce({
      allow: false,
      reason: "default-deny-missing-seed",
      channelAllowed: true,
      downgradeTo: null,
      minRoleRequired: null,
      requiresFourEyes: false,
      approversNeeded: 0,
      approversPresent: [],
      gateEvaluationId: null,
    });

    const insertCaptures: InsertCapture[] = [];
    const ctx = makeCtx({ supabaseAdmin: makeSupabase(insertCaptures) });

    const result = await publishAnnouncement.execute(DEFAULT_PARAMS, ctx);

    // First gate (commit) was called; precheck gate never reached
    expect(callGateAction).toHaveBeenCalledOnce();

    // No INSERT, no emit
    expect(insertCaptures).toHaveLength(0);
    expect(emit).not.toHaveBeenCalled();

    // Descriptive error containing the reason
    expect(result).toMatch(/authority gate/i);
    expect(result).toContain("default-deny-missing-seed");
  });

  it("TC-P (precheck gate denied): commit gate passes, precheck denied → draft refused, no INSERT, no emit", async () => {
    // Commit gate passes (first call), precheck denied (second call)
    vi.mocked(callGateAction)
      .mockResolvedValueOnce({
        allow: true,
        reason: null,
        channelAllowed: true,
        downgradeTo: null,
        minRoleRequired: null,
        requiresFourEyes: false,
        approversNeeded: 0,
        approversPresent: [],
        gateEvaluationId: null,
      })
      .mockResolvedValueOnce({
        allow: false,
        reason: "insufficient-authority",
        channelAllowed: true,
        downgradeTo: null,
        minRoleRequired: "manager",
        requiresFourEyes: false,
        approversNeeded: 0,
        approversPresent: [],
        gateEvaluationId: null,
      });

    const insertCaptures: InsertCapture[] = [];
    const ctx = makeCtx({ supabaseAdmin: makeSupabase(insertCaptures) });

    const result = await publishAnnouncement.execute({ ...DEFAULT_PARAMS, confirm: false }, ctx);

    // Both gates called
    expect(callGateAction).toHaveBeenCalledTimes(2);

    // No INSERT, no emit (card was never shown)
    expect(insertCaptures).toHaveLength(0);
    expect(emit).not.toHaveBeenCalled();

    // Norwegian denial message from precheck gate
    expect(result).toMatch(/Ikke tillatt/i);
    expect(result).toContain("insufficient-authority");
  });

  it("TC-3 (confirm=false): returns InlineConfirmCardDescriptor, no INSERT, emits shown card", async () => {
    const insertCaptures: InsertCapture[] = [];
    const ctx = makeCtx({ supabaseAdmin: makeSupabase(insertCaptures) });

    const result = await publishAnnouncement.execute({ ...DEFAULT_PARAMS, confirm: false }, ctx);

    // Both gates called (commit gate + precheck gate)
    expect(callGateAction).toHaveBeenCalledTimes(2);
    // Precheck gate uses actionType "publish_announcement"
    const [, , , precheckArgs] = vi.mocked(callGateAction).mock.calls[1]!;
    expect(precheckArgs.actionType).toBe("publish_announcement");

    // No INSERT
    expect(insertCaptures).toHaveLength(0);

    // Exactly one emit: inline_confirm_card.shown
    expect(emit).toHaveBeenCalledOnce();
    const emitArgs = vi.mocked(emit).mock.calls[0]![0] as unknown as Record<string, unknown>;
    expect(emitArgs.event).toBe("inline_confirm_card.shown");
    const emitProps = emitArgs.properties as Record<string, unknown>;
    expect(emitProps.surface).toBe("announcement");
    expect(typeof emitProps.proposal_id).toBe("string");
    expect(emitProps.recipient_count).toBe(5);

    // Draft phase returned with InlineConfirmCardDescriptor
    const parsed = JSON.parse(result) as {
      phase: string;
      proposal_id: string;
      descriptor: {
        type: string;
        proposal_id: string;
        surface: string;
        draft: Record<string, unknown>;
        preview: {
          title: string;
          body_excerpt: string;
          recipient_count: number;
          metadata: Array<{ label: string; value: string }>;
        };
        actions: Array<{ id: string; label: string; variant: string }>;
        channel_constraint: string[];
        platforms: string[];
      };
      next_step: string;
    };
    expect(parsed.phase).toBe("draft");
    expect(typeof parsed.proposal_id).toBe("string");
    // proposal_id in envelope matches descriptor.proposal_id
    expect(parsed.proposal_id).toBe(parsed.descriptor.proposal_id);

    // Descriptor shape
    expect(parsed.descriptor.type).toBe("inline_confirm_card");
    expect(parsed.descriptor.surface).toBe("announcement");
    expect(parsed.descriptor.preview.title).toBe("Viktig melding");
    expect(parsed.descriptor.preview.recipient_count).toBe(5);
    expect(parsed.descriptor.channel_constraint).toEqual(["chat"]);
    expect(parsed.descriptor.platforms).toEqual(["web"]);

    // Actions: confirm + edit + cancel
    const confirmAction = parsed.descriptor.actions.find((a) => a.id === "confirm");
    const editAction = parsed.descriptor.actions.find((a) => a.id === "edit");
    const cancelAction = parsed.descriptor.actions.find((a) => a.id === "cancel");
    expect(confirmAction?.variant).toBe("primary");
    expect(editAction?.variant).toBe("ghost");
    expect(cancelAction?.variant).toBe("destructive");

    // No raw profile IDs in the draft return
    expect(JSON.stringify(parsed)).not.toContain("profileIds");
    expect(JSON.stringify(parsed)).not.toContain("target_profile_ids");

    // next_step instructs LLM to call show_proposal_card
    expect(parsed.next_step).toMatch(/show_proposal_card/i);
  });

  it("TC-4 (confirm=true, granted): INSERT fires, both emits fire, PII boundary — no raw IDs in return", async () => {
    const PROPOSAL_UUID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
    const insertCaptures: InsertCapture[] = [];
    const ctx = makeCtx({ supabaseAdmin: makeSupabase(insertCaptures) });

    const result = await publishAnnouncement.execute(
      { ...DEFAULT_PARAMS, confirm: true, proposal_id: PROPOSAL_UUID },
      ctx,
    );

    // Commit gate called (first), precheck gate also called (second) on confirm=true path
    expect(callGateAction).toHaveBeenCalledTimes(2);
    const [, , , commitGateArgs] = vi.mocked(callGateAction).mock.calls[0]!;
    expect(commitGateArgs.capability).toBe("communication");
    expect(commitGateArgs.actionType).toBe("publish_announcement_atomic");
    expect(commitGateArgs.channel).toBe("chat");
    const [, , , precheckArgs] = vi.mocked(callGateAction).mock.calls[1]!;
    expect(precheckArgs.actionType).toBe("publish_announcement");

    // V2: RPC publish_announcement_atomic fired (not direct INSERT per ADR-0369)
    expect(insertCaptures).toHaveLength(1);
    const rpcArgs = insertCaptures[0]!.row;
    expect(insertCaptures[0]!.table).toBe("rpc:publish_announcement_atomic");
    expect(rpcArgs).toMatchObject({
      p_channel_id: CHANNEL_ID,
      p_workspace_id: WORKSPACE_ID,
      p_actor_profile_id: PROFILE_ID,
      p_visibility_scope: "all_members",
      // proposal_id from params threads through as p_client_message_id (L-0330)
      p_client_message_id: PROPOSAL_UUID,
    });
    // p_content = "title\nbody"
    expect(rpcArgs.p_content).toBe("Viktig melding\nHusk å lukke baren ordentlig i kveld.");
    // all_members → empty target_profile_ids array (per V2 RPC contract)
    expect(rpcArgs.p_target_profile_ids).toEqual([]);

    // Two emits on commit path: channel.message.sent + inline_confirm_card.confirmed
    expect(emit).toHaveBeenCalledTimes(2);

    // First emit: emitAnnouncementPublished wraps channel.message.sent
    const firstEmitArgs = vi.mocked(emit).mock.calls[0]![0] as unknown as Record<string, unknown>;
    expect(firstEmitArgs.event).toBe("channel.message.sent");
    const sentProps = firstEmitArgs.properties as Record<string, unknown>;
    expect(sentProps.origin_type).toBe("agent");
    expect(sentProps.message_type).toBe("announcement");
    expect(sentProps.target_profile_count).toBe(5);
    expect(sentProps.audience_kind).toBe("all");
    expect(sentProps.notification_priority).toBe(1);
    expect(sentProps.notification_mode).toBe("work");

    // Second emit: inline_confirm_card.confirmed (ADR-0398)
    const secondEmitArgs = vi.mocked(emit).mock.calls[1]![0] as unknown as Record<string, unknown>;
    expect(secondEmitArgs.event).toBe("inline_confirm_card.confirmed");
    const confirmedProps = secondEmitArgs.properties as Record<string, unknown>;
    expect(confirmedProps.surface).toBe("announcement");
    expect(confirmedProps.proposal_id).toBe(PROPOSAL_UUID);
    expect(confirmedProps.recipient_count).toBe(5);

    // PII boundary (Council B5): return must NOT contain raw profile IDs
    const parsed = JSON.parse(result) as {
      phase: string;
      message_id: string;
      target_profile_count: number;
      audience_label: string;
    };
    expect(parsed.phase).toBe("published");
    expect(parsed.message_id).toBe(MESSAGE_ID);
    expect(parsed.target_profile_count).toBe(5);
    expect(parsed.audience_label).toBe("Alle (5)");

    // Verify raw IDs never appear in the serialized return
    expect(result).not.toContain("profileIds");
    expect(result).not.toContain("target_profile_ids");
    expect(result).not.toContain("00000000-0000-0000-0000-000000000010");
  });

  it("TC-6 (kind=celebration blocked): Zod parse fails before execute — no gate, no INSERT", async () => {
    // celebration is service-role-only (ADR-0372 §Agent Impact). Agents must not use it.
    // The Zod schema must reject it so the RPC never gets the chance to return
    // CELEBRATION_SERVICE_ROLE_ONLY. Zod rejection happens before execute() is called.
    const result = publishAnnouncement.schema.safeParse({
      channel_id: CHANNEL_ID,
      title: "Test",
      body: "Test body",
      audience_kind: "all",
      kind: "celebration",
      confirm: false,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      // Confirm the error is on the 'kind' field
      const kindError = result.error.issues.find((i) => i.path.includes("kind"));
      expect(kindError).toBeDefined();
    }
    // No gate, no INSERT — Zod rejection means execute() is never reached.
    expect(callGateAction).not.toHaveBeenCalled();
  });

  it("TC-7 (kind=system_message blocked): Zod parse fails before execute — no gate, no INSERT", async () => {
    // system_message is service-role-only (reserved for platform ops). Same protection as TC-6.
    const result = publishAnnouncement.schema.safeParse({
      channel_id: CHANNEL_ID,
      title: "System notice",
      body: "Mandatory ops notice",
      audience_kind: "all",
      kind: "system_message",
      confirm: false,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      const kindError = result.error.issues.find((i) => i.path.includes("kind"));
      expect(kindError).toBeDefined();
    }
    expect(callGateAction).not.toHaveBeenCalled();
  });

  it("TC-5 (audience=0): resolves to 0 recipients → descriptive error, no INSERT", async () => {
    vi.mocked(resolveAudience).mockResolvedValueOnce({
      profileIds: [],
      count: 0,
      label: "Avdeling (0)",
    });

    const insertCaptures: InsertCapture[] = [];
    const ctx = makeCtx({ supabaseAdmin: makeSupabase(insertCaptures) });

    const result = await publishAnnouncement.execute(
      {
        ...DEFAULT_PARAMS,
        audience_kind: "department",
        department_ids: ["00000000-0000-0000-0000-000000000099"],
        confirm: true,
      },
      ctx,
    );

    // No INSERT, no emit
    expect(insertCaptures).toHaveLength(0);
    expect(emit).not.toHaveBeenCalled();

    // Descriptive error about empty audience
    expect(result).toMatch(/0 recipients/i);
  });
});
