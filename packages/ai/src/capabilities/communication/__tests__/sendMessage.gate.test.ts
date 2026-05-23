// packages/ai/src/capabilities/communication/__tests__/sendMessage.gate.test.ts
//
// ADR-0287 gate_action coverage for the `sendMessage` tool.
//
// Verifies that callGateAction is evaluated BEFORE the channel_message INSERT,
// and that the tool fails-closed on any non-granted outcome.
//
// Three test cases (matching the three declared journeys in the plan):
//   1. granted   — callGateAction returns allow:true → INSERT called, emit called.
//   2. denied (channel-restricted) — callGateAction allow:false + channelAllowed:false
//                  → NO INSERT, NO emit, voice-deny copy returned.
//   3. denied (missing seed / default-deny) — callGateAction allow:false + reason string
//                  → NO INSERT, NO emit, descriptive error returned.
//
// Mock strategy mirrors legal/__tests__/tools.test.ts and
// memory/__tests__/tools.test.ts: supabase chain stubbed inline,
// callGateAction mocked via vi.mock("../gate.js"), emit mocked via
// vi.mock("@smartout/telemetry").

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

// ── Import AFTER mocks ─────────────────────────────────────────────────────

import { sendMessage } from "../tools.js";
import { callGateAction } from "../gate.js";
import { emit } from "@smartout/telemetry";

// ── Helpers ───────────────────────────────────────────────────────────────

const CHANNEL_ID = "00000000-0000-0000-0000-000000000001";
// Cast to NonEmptyString (brand type from @smartout/telemetry/server). We avoid
// importing the brand at test-file level since the dist may not be built in CI
// for this worktree — the cast is safe: these strings are statically non-empty.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const WORKSPACE_ID = "00000000-0000-0000-0000-000000000002" as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const PROFILE_ID = "00000000-0000-0000-0000-000000000003" as any;
const MESSAGE_ID = "00000000-0000-0000-0000-000000000004";

type InsertCapture = { table: string; row: Record<string, unknown> };

/**
 * Build a minimal SupabaseClient stub.
 *
 * `insertCaptures` collects every `.from(table).insert(row)` call so tests
 * can assert INSERT was (or was not) fired.
 *
 * The channel_member query always returns a valid member row so the existing
 * membership check never blocks — we want to test the gate layer in isolation.
 */
function makeSupabase(insertCaptures: InsertCapture[] = []): SupabaseClient {
  return {
    from(table: string) {
      if (table === "channel_member") {
        // Membership check — return a valid member so that guard passes.
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
        // isAiAllowedInChannel reads channel_ai_policy. Return a permissive
        // policy (proactive) so the ADR-0163 layer never blocks the gate tests.
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

// ── Tests ─────────────────────────────────────────────────────────────────

describe("sendMessage — ADR-0287 gate_action integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset callGateAction to the default allow response after each test.
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
  });

  it("TC-1 (granted): callGateAction allow=true → INSERT fires, emit fires", async () => {
    const insertCaptures: InsertCapture[] = [];
    const ctx = makeCtx({ supabaseAdmin: makeSupabase(insertCaptures) });

    const raw = await sendMessage.execute(
      { channel_id: CHANNEL_ID, content: "Hello world", is_proactive: false, confirm: true },
      ctx,
    );

    // Gate must have been called with correct capability + channel.
    expect(callGateAction).toHaveBeenCalledOnce();
    const [, , , gateArgs] = vi.mocked(callGateAction).mock.calls[0]!;
    expect(gateArgs.capability).toBe("communication");
    expect(gateArgs.actionType).toBe("send_message");
    expect(gateArgs.channel).toBe("chat");

    // INSERT fired exactly once on channel_message.
    expect(insertCaptures).toHaveLength(1);
    expect(insertCaptures[0]!.table).toBe("channel_message");
    expect(insertCaptures[0]!.row).toMatchObject({
      channel_id: CHANNEL_ID,
      workspace_id: WORKSPACE_ID,
      sender_id: PROFILE_ID,
      content: "Hello world",
    });

    // emit fired twice: channel.message.sent + inline_confirm_card.confirmed (Phase 2-a, ADR-0403).
    expect(emit).toHaveBeenCalledTimes(2);

    // Tool returned success JSON.
    const parsed = JSON.parse(raw) as { sent: boolean };
    expect(parsed.sent).toBe(true);
  });

  it("TC-2 (denied, channel-restricted): gate allow=false + channelAllowed=false → no INSERT, no emit, voice-deny copy", async () => {
    vi.mocked(callGateAction).mockResolvedValueOnce({
      allow: false,
      reason: "channel-restricted",
      channelAllowed: false,
      downgradeTo: null,
      minRoleRequired: null,
      requiresFourEyes: false,
      approversNeeded: 0,
      approversPresent: [],
      gateEvaluationId: null,
    });

    const insertCaptures: InsertCapture[] = [];
    const ctx = makeCtx({
      channel: "voice",
      supabaseAdmin: makeSupabase(insertCaptures),
    });

    const result = await sendMessage.execute(
      { channel_id: CHANNEL_ID, content: "Sending on voice", is_proactive: false, confirm: false },
      ctx,
    );

    // No INSERT, no emit.
    expect(insertCaptures).toHaveLength(0);
    expect(emit).not.toHaveBeenCalled();

    // Voice-deny copy — must mention chat or voice.
    expect(result).toMatch(/voice channel/i);
    expect(result).toMatch(/chat/i);
  });

  it("TC-3 (denied, missing seed / default-deny): gate allow=false + reason string → no INSERT, no emit, descriptive error", async () => {
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

    const result = await sendMessage.execute(
      { channel_id: CHANNEL_ID, content: "Some message", is_proactive: false, confirm: false },
      ctx,
    );

    // No INSERT, no emit.
    expect(insertCaptures).toHaveLength(0);
    expect(emit).not.toHaveBeenCalled();

    // Descriptive error containing the reason string.
    expect(result).toMatch(/authority gate/i);
    expect(result).toContain("default-deny-missing-seed");
  });
});
