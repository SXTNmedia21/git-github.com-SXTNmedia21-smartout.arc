// packages/ai/src/capabilities/memory/__tests__/tools.test.ts
//
// Phase A3 + SS-1 coverage for the agent-facing save_memory tool.
//
// Phase A3 (original): gate_action + voice guard + PII block + happy path.
// SS-1 (Council 2026-04-23): replaced the inline `supabase.rpc("gate_action")`
//   call with the shared `callGateAction` wrapper from `./gate.ts`, surfacing
//   the four-eyes and downgrade-to-suggest paths that the inline variant
//   silently dropped.
//
// Scenarios covered:
//   1. Happy path (allow) — engine_memory insert fires, legacy
//      `{ success, memory_id, scope, memory_type }` fields preserved plus
//      additive `{ allowed: true, outcome: "applied" }` surface.
//   2. Channel guard — voice short-circuits before gate_action.
//   3. Deny — gate blocks, no insert, legacy `/avslått|avslatt/i` wording
//      preserved in user_message.
//   4. gate_action RPC error — fail closed, no insert.
//   5. PII content — memory-writer blocks even after gate allows.
//   6. Downgrade-to-suggest — no insert, outcome: "confirmation_required".
//   7. Four-eyes-required — no insert, outcome: "four_eyes_pending",
//      approvers_needed + approvers_present carried through. L-0133:
//      discriminator is the `four_eyes_required` boolean, NOT the reason
//      string — the fixture sets reason="approval_required" to prove the
//      tool doesn't regex-match the reason field.
//   8. Recorder hook behaviour preserved from Phase A3.

import { describe, it, expect, vi, afterEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { nonEmpty } from "@smartout/telemetry/server";
import { saveMemoryTool } from "../tools.js";
import type { AgentToolContext } from "../../types.js";
import { setRecordingHook, type RecordedTurn } from "../../../lib/recording-hook.js";

type RpcCall = { fn: string; args: Record<string, unknown> };
type InsertCall = { table: string; row: Record<string, unknown> };

function makeCtx(
  overrides: Partial<AgentToolContext> = {},
  opts: {
    rpc?: (fn: string, args: Record<string, unknown>) => { data: unknown; error: unknown };
    insertResult?: { data: { id: string } | null; error: { message: string } | null };
    capturedRpc?: RpcCall[];
    capturedInserts?: InsertCall[];
  } = {},
): AgentToolContext {
  const rpcCaptures = opts.capturedRpc ?? [];
  const insertCaptures = opts.capturedInserts ?? [];
  const insertResult = opts.insertResult ?? { data: { id: "mem-1" }, error: null };

  const supabaseAdmin = {
    rpc: vi.fn((fn: string, args: Record<string, unknown>) => {
      rpcCaptures.push({ fn, args });
      if (opts.rpc) return Promise.resolve(opts.rpc(fn, args));
      // Default — gate allows.
      return Promise.resolve({ data: { allow: true }, error: null });
    }),
    from(table: string) {
      return {
        insert(row: Record<string, unknown>) {
          insertCaptures.push({ table, row });
          return {
            select() {
              return { single: vi.fn(async () => insertResult) };
            },
          };
        },
      };
    },
  } as unknown as SupabaseClient;

  return {
    workspaceId: nonEmpty("w-1", "workspaceId"),
    profileId: nonEmpty("p-1", "profileId"),
    sessionId: "sess-1",
    channel: "chat",
    supabaseAdmin,
    ...overrides,
  };
}

describe("save_memory tool", () => {
  it("returns success on the happy path (allow → insert fires, legacy + outcome fields present)", async () => {
    const rpcCaptures: RpcCall[] = [];
    const insertCaptures: InsertCall[] = [];
    const ctx = makeCtx({}, { capturedRpc: rpcCaptures, capturedInserts: insertCaptures });

    const out = await saveMemoryTool.execute(
      {
        content: "Jeg foretrekker kveldsvakter",
        memory_type: "preference",
        scope: "personal",
        importance: 0.7,
      },
      ctx,
    );

    // gate_action was called first with the correct capability + action + entity.
    const gateCall = rpcCaptures.find((c) => c.fn === "gate_action");
    expect(gateCall).toBeDefined();
    expect(gateCall?.args.p_capability).toBe("memory");
    expect(gateCall?.args.p_action_type).toBe("save");
    expect(gateCall?.args.p_entity_id).toBe("p-1");
    expect(gateCall?.args.p_channel).toBe("chat");

    // Insert fired on engine_memory.
    expect(insertCaptures).toHaveLength(1);
    expect(insertCaptures[0]!.table).toBe("engine_memory");

    const parsed = JSON.parse(out);
    // Legacy fields preserved.
    expect(parsed.success).toBe(true);
    expect(parsed.memory_id).toBe("mem-1");
    expect(parsed.scope).toBe("personal");
    expect(parsed.memory_type).toBe("preference");
    // Additive SS-1 surface.
    expect(parsed.allowed).toBe(true);
    expect(parsed.outcome).toBe("applied");
    expect(typeof parsed.user_message).toBe("string");
  });

  it("aborts without inserting when channel is voice", async () => {
    const rpcCaptures: RpcCall[] = [];
    const insertCaptures: InsertCall[] = [];
    const ctx = makeCtx(
      { channel: "voice" },
      { capturedRpc: rpcCaptures, capturedInserts: insertCaptures },
    );

    const out = await saveMemoryTool.execute(
      {
        content: "Noe",
        memory_type: "fact",
        scope: "personal",
        importance: 0.5,
      },
      ctx,
    );

    // Channel guard must short-circuit before gate_action is called.
    expect(rpcCaptures.some((c) => c.fn === "gate_action")).toBe(false);
    expect(insertCaptures).toHaveLength(0);
    expect(out).toMatch(/chat/i);
  });

  it("aborts without inserting when gate_action denies (blocked outcome)", async () => {
    const rpcCaptures: RpcCall[] = [];
    const insertCaptures: InsertCall[] = [];
    const ctx = makeCtx(
      {},
      {
        capturedRpc: rpcCaptures,
        capturedInserts: insertCaptures,
        rpc: (fn) => {
          if (fn === "gate_action") {
            return { data: { allow: false, reason: "capability_disabled" }, error: null };
          }
          return { data: null, error: null };
        },
      },
    );

    const out = await saveMemoryTool.execute(
      {
        content: "Noe",
        memory_type: "fact",
        scope: "personal",
        importance: 0.5,
      },
      ctx,
    );

    expect(insertCaptures).toHaveLength(0);

    const parsed = JSON.parse(out);
    expect(parsed.allowed).toBe(false);
    expect(parsed.outcome).toBe("blocked");
    expect(parsed.reason).toBe("capability_disabled");
    // Legacy "Minnelagring avslått" wording preserved on the user_message
    // seam so prompt templates + regex consumers keep working.
    expect(parsed.user_message).toMatch(/avslått|avslatt/i);
    expect(parsed.user_message).toContain("capability_disabled");
  });

  it("fails closed when gate_action RPC errors", async () => {
    const insertCaptures: InsertCall[] = [];
    const ctx = makeCtx(
      {},
      {
        capturedInserts: insertCaptures,
        rpc: (fn) => {
          if (fn === "gate_action") {
            return { data: null, error: { message: "RPC timeout" } };
          }
          return { data: null, error: null };
        },
      },
    );

    const out = await saveMemoryTool.execute(
      {
        content: "Noe",
        memory_type: "fact",
        scope: "personal",
        importance: 0.5,
      },
      ctx,
    );

    // No mutation fired — wrapper fail-closed on RPC error.
    expect(insertCaptures).toHaveLength(0);

    const parsed = JSON.parse(out);
    expect(parsed.allowed).toBe(false);
    expect(parsed.outcome).toBe("blocked");
    // The wrapper sets reason = "gate_action unavailable: <msg>" — this
    // carries through into the user_message so operators can see why the
    // gate was unreachable.
    expect(parsed.reason).toContain("RPC timeout");
    expect(parsed.user_message).toContain("RPC timeout");
  });

  it("blocks PII content even after gate allows", async () => {
    const insertCaptures: InsertCall[] = [];
    const ctx = makeCtx({}, { capturedInserts: insertCaptures });

    const out = await saveMemoryTool.execute(
      {
        content: "Personnummer 12345612345",
        memory_type: "fact",
        scope: "personal",
        importance: 0.5,
      },
      ctx,
    );

    expect(insertCaptures).toHaveLength(0);
    expect(out).toMatch(/personlig informasjon/i);
  });

  it("downgrade_to=suggest: no insert, outcome=confirmation_required (SS-1)", async () => {
    const rpcCaptures: RpcCall[] = [];
    const insertCaptures: InsertCall[] = [];
    const ctx = makeCtx(
      {},
      {
        capturedRpc: rpcCaptures,
        capturedInserts: insertCaptures,
        rpc: (fn) => {
          if (fn === "gate_action") {
            return {
              data: { allow: false, downgrade_to: "suggest", reason: "downgraded" },
              error: null,
            };
          }
          return { data: null, error: null };
        },
      },
    );

    const out = await saveMemoryTool.execute(
      {
        content: "Jeg foretrekker nattvakter",
        memory_type: "preference",
        scope: "personal",
        importance: 0.6,
      },
      ctx,
    );

    // No mutation fired — downgrade-to-suggest requires user confirmation.
    expect(insertCaptures).toHaveLength(0);

    const parsed = JSON.parse(out);
    expect(parsed.allowed).toBe(false);
    expect(parsed.outcome).toBe("confirmation_required");
    expect(parsed.reason).toBe("downgraded_to_suggest");
    expect(typeof parsed.user_message).toBe("string");
  });

  it("four_eyes_required: no insert, outcome=four_eyes_pending, approvers propagated (SS-1, L-0133)", async () => {
    const rpcCaptures: RpcCall[] = [];
    const insertCaptures: InsertCall[] = [];

    // L-0133: the RPC sets `four_eyes_required: true` but `reason` is NOT
    // the string "four_eyes_required" (intentional — the RPC may carry a
    // distinct machine code like "approval_required"). The tool MUST
    // discriminate on the dedicated boolean, not on reason-string
    // pattern-matching — otherwise the four-eyes branch silently falls
    // through to "blocked" and the UI never surfaces the approver selector.
    const ctx = makeCtx(
      {},
      {
        capturedRpc: rpcCaptures,
        capturedInserts: insertCaptures,
        rpc: (fn) => {
          if (fn === "gate_action") {
            return {
              data: {
                allow: false,
                reason: "approval_required",
                four_eyes_required: true,
                approvers_needed: 2,
                approvers_present: ["p-1"],
                gate_evaluation_id: "eval-42",
              },
              error: null,
            };
          }
          return { data: null, error: null };
        },
      },
    );

    const out = await saveMemoryTool.execute(
      {
        content: "Avdelingsregelen: ingen lagerbytter uten leder.",
        memory_type: "fact",
        scope: "workspace",
        importance: 0.9,
      },
      ctx,
    );

    // No mutation fired — four-eyes gate blocks until approver joins.
    expect(insertCaptures).toHaveLength(0);

    const parsed = JSON.parse(out);
    expect(parsed.allowed).toBe(false);
    // Outgoing contract: regardless of the gate's internal reason code,
    // the tool normalises the LLM-visible reason to "four_eyes_required"
    // so prompt templates have a stable string to key off.
    expect(parsed.outcome).toBe("four_eyes_pending");
    expect(parsed.reason).toBe("four_eyes_required");
    expect(parsed.approvers_needed).toBe(2);
    expect(parsed.approvers_present).toEqual(["p-1"]);
    // gate_evaluation_id propagates for downstream audit correlation.
    expect(parsed.gate_evaluation_id).toBe("eval-42");
    expect(typeof parsed.user_message).toBe("string");
  });

  describe("recorder hook", () => {
    afterEach(() => {
      setRecordingHook(null);
    });

    it("records memory_write turn on success with memory_id + importance", async () => {
      const recorded: RecordedTurn[] = [];
      setRecordingHook((input) => recorded.push(input));

      const ctx = makeCtx();
      await saveMemoryTool.execute(
        {
          content: "Jeg foretrekker kveldsvakter",
          memory_type: "preference",
          scope: "personal",
          importance: 0.7,
        },
        ctx,
      );

      const writeTurn = recorded.find((r) => r.turnKind === "memory_write");
      expect(writeTurn).toBeTruthy();
      expect(writeTurn!.phase).toBe("post_turn");
      expect((writeTurn!.content as Record<string, unknown>).memory_id).toBe("mem-1");
      expect(writeTurn!.meta?.importance).toBe(0.7);
    });

    it("does not record when write is blocked (PII / deny / voice)", async () => {
      const recorded: RecordedTurn[] = [];
      setRecordingHook((input) => recorded.push(input));

      const ctx = makeCtx({ channel: "voice" });
      await saveMemoryTool.execute(
        { content: "Noe", memory_type: "fact", scope: "personal", importance: 0.5 },
        ctx,
      );

      expect(recorded.some((r) => r.turnKind === "memory_write")).toBe(false);
    });
  });
});
