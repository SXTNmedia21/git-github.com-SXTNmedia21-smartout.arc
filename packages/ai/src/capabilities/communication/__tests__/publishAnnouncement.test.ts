// packages/ai/src/capabilities/communication/__tests__/publishAnnouncement.test.ts
//
// Unit tests for the `publish_announcement` capability tool.
//
// Five test cases covering the declared journeys in PLAN-botsson-publishannouncement-capability.md:
//   TC-1  Voice channel → in-tool reject as FIRST statement (no gate call, no INSERT)
//   TC-2  Gate denied (allow=false) → no INSERT, descriptive error
//   TC-3  confirm=false → draft phase returned, no INSERT, no emit
//   TC-4  confirm=true + granted gate → INSERT fires, emit fires, PII boundary holds
//   TC-5  Audience resolves to 0 → descriptive error, no INSERT
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

  it("TC-2 (gate denied): allow=false → no INSERT, no emit, descriptive error", async () => {
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

    // Gate was called
    expect(callGateAction).toHaveBeenCalledOnce();

    // No INSERT, no emit
    expect(insertCaptures).toHaveLength(0);
    expect(emit).not.toHaveBeenCalled();

    // Descriptive error containing the reason
    expect(result).toMatch(/authority gate/i);
    expect(result).toContain("default-deny-missing-seed");
  });

  it("TC-3 (confirm=false): returns draft phase, no INSERT, no emit", async () => {
    const insertCaptures: InsertCapture[] = [];
    const ctx = makeCtx({ supabaseAdmin: makeSupabase(insertCaptures) });

    const result = await publishAnnouncement.execute({ ...DEFAULT_PARAMS, confirm: false }, ctx);

    // Gate was called
    expect(callGateAction).toHaveBeenCalledOnce();

    // No INSERT, no emit
    expect(insertCaptures).toHaveLength(0);
    expect(emit).not.toHaveBeenCalled();

    // Draft phase returned
    const parsed = JSON.parse(result) as {
      phase: string;
      target_profile_count: number;
      audience_label: string;
      draft: { title: string; body: string };
      next_step: string;
    };
    expect(parsed.phase).toBe("draft");
    expect(parsed.target_profile_count).toBe(5);
    expect(parsed.audience_label).toBe("Alle (5)");
    expect(parsed.draft.title).toBe("Viktig melding");
    expect(parsed.draft.body).toBe("Husk å lukke baren ordentlig i kveld.");
    // No raw profile IDs in the draft return
    expect(JSON.stringify(parsed)).not.toContain("profileIds");
    expect(JSON.stringify(parsed)).not.toContain("target_profile_ids");
  });

  it("TC-4 (confirm=true, granted): INSERT fires, emit fires, PII boundary — no raw IDs in return", async () => {
    const insertCaptures: InsertCapture[] = [];
    const ctx = makeCtx({ supabaseAdmin: makeSupabase(insertCaptures) });

    const result = await publishAnnouncement.execute({ ...DEFAULT_PARAMS, confirm: true }, ctx);

    // Gate called with correct args
    expect(callGateAction).toHaveBeenCalledOnce();
    const [, , , gateArgs] = vi.mocked(callGateAction).mock.calls[0]!;
    expect(gateArgs.capability).toBe("communication");
    expect(gateArgs.actionType).toBe("publish_announcement");
    expect(gateArgs.channel).toBe("chat");

    // INSERT fired on channel_message
    expect(insertCaptures).toHaveLength(1);
    const insertedRow = insertCaptures[0]!.row;
    expect(insertCaptures[0]!.table).toBe("channel_message");
    expect(insertedRow).toMatchObject({
      channel_id: CHANNEL_ID,
      workspace_id: WORKSPACE_ID,
      sender_id: PROFILE_ID,
      message_type: "announcement",
      visibility_scope: "all_members",
    });
    // content = "title\nbody"
    expect(insertedRow.content).toBe("Viktig melding\nHusk å lukke baren ordentlig i kveld.");
    // all_members → null target_profile_ids
    expect(insertedRow.target_profile_ids).toBeNull();

    // Emit fired once
    expect(emit).toHaveBeenCalledOnce();
    const emitArgs = vi.mocked(emit).mock.calls[0]![0] as unknown as Record<string, unknown>;
    expect(emitArgs.event).toBe("channel.message.sent");
    const props = emitArgs.properties as Record<string, unknown>;
    expect(props.origin_type).toBe("agent");
    expect(props.message_type).toBe("announcement");
    expect(props.target_profile_count).toBe(5);
    expect(props.audience_kind).toBe("all");
    expect(props.notification_priority).toBe(1);
    expect(props.notification_mode).toBe("work");

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
