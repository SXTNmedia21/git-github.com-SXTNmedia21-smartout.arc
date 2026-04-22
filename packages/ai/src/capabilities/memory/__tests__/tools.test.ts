// packages/ai/src/capabilities/memory/__tests__/tools.test.ts
//
// Phase A3 coverage for the agent-facing save_memory tool. Verifies that:
//   1. gate_action is called first — on deny, no insert.
//   2. Voice channel is rejected (ADR-0078 layer 3).
//   3. PII content is blocked by the writer.
//   4. Happy path returns success JSON with memory_id.
//   5. gate_action RPC error fails closed.

import { describe, it, expect, vi, afterEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
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
    workspaceId: "w-1",
    profileId: "p-1",
    sessionId: "sess-1",
    channel: "chat",
    supabaseAdmin,
    ...overrides,
  };
}

describe("save_memory tool", () => {
  it("returns success on the happy path", async () => {
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

    expect(rpcCaptures.some((c) => c.fn === "gate_action")).toBe(true);
    expect(insertCaptures).toHaveLength(1);
    expect(insertCaptures[0]!.table).toBe("engine_memory");

    const parsed = JSON.parse(out);
    expect(parsed.success).toBe(true);
    expect(parsed.memory_id).toBe("mem-1");
    expect(parsed.scope).toBe("personal");
    expect(parsed.memory_type).toBe("preference");
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

  it("aborts without inserting when gate_action denies", async () => {
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
    expect(out).toMatch(/avslått|avslatt/i);
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

    expect(insertCaptures).toHaveLength(0);
    expect(out).toMatch(/RPC timeout/);
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
