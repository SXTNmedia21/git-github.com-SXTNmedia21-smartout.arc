// packages/ai/src/context/__tests__/memory-writer.test.ts
//
// Phase A3 coverage for the producer-side helper that writes to engine_memory.
// Verifies that the helper:
//   1. rejects empty content
//   2. rejects PII-looking content (personnummer, bank numbers)
//   3. rejects missing workspace/profile ids
//   4. clamps importance to [0, 1]
//   5. inserts with the correct row shape on the happy path
//   6. surfaces DB errors without throwing

import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { saveMemory } from "../memory-writer.js";

type InsertCall = { table: string; row: Record<string, unknown> };

function makeSupabase(opts: {
  insertResult?: { data: { id: string } | null; error: { message: string } | null };
  capture?: InsertCall[];
}): SupabaseClient {
  const result = opts.insertResult ?? { data: { id: "mem-1" }, error: null };
  const captures = opts.capture ?? [];

  const api = {
    from(table: string) {
      return {
        insert(row: Record<string, unknown>) {
          captures.push({ table, row });
          return {
            select() {
              return {
                single: vi.fn(async () => result),
              };
            },
          };
        },
      };
    },
  };

  return api as unknown as SupabaseClient;
}

describe("saveMemory", () => {
  it("inserts a well-formed row on the happy path", async () => {
    const captures: InsertCall[] = [];
    const sb = makeSupabase({ capture: captures });

    const result = await saveMemory({
      supabaseAdmin: sb,
      workspaceId: "w-1",
      profileId: "p-1",
      content: "Jeg foretrekker kveldsvakter",
      memoryType: "preference",
      scope: "personal",
      importance: 0.7,
    });

    expect(result).toEqual({ ok: true, id: "mem-1" });
    expect(captures).toHaveLength(1);
    expect(captures[0]!.table).toBe("engine_memory");
    expect(captures[0]!.row).toMatchObject({
      workspace_id: "w-1",
      profile_id: "p-1",
      content: "Jeg foretrekker kveldsvakter",
      memory_type: "preference",
      scope: "personal",
      importance: 0.7,
    });
  });

  it("clamps importance above 1", async () => {
    const captures: InsertCall[] = [];
    const sb = makeSupabase({ capture: captures });

    await saveMemory({
      supabaseAdmin: sb,
      workspaceId: "w-1",
      profileId: "p-1",
      content: "Noe viktig",
      importance: 5,
    });

    expect(captures[0]!.row.importance).toBe(1);
  });

  it("clamps importance below 0", async () => {
    const captures: InsertCall[] = [];
    const sb = makeSupabase({ capture: captures });

    await saveMemory({
      supabaseAdmin: sb,
      workspaceId: "w-1",
      profileId: "p-1",
      content: "Noe",
      importance: -0.3,
    });

    expect(captures[0]!.row.importance).toBe(0);
  });

  it("rejects empty content", async () => {
    const captures: InsertCall[] = [];
    const sb = makeSupabase({ capture: captures });

    const result = await saveMemory({
      supabaseAdmin: sb,
      workspaceId: "w-1",
      profileId: "p-1",
      content: "   ",
    });

    expect(result).toEqual({ ok: false, reason: "empty_content" });
    expect(captures).toHaveLength(0);
  });

  it("rejects missing workspace id", async () => {
    const captures: InsertCall[] = [];
    const sb = makeSupabase({ capture: captures });

    const result = await saveMemory({
      supabaseAdmin: sb,
      workspaceId: "",
      profileId: "p-1",
      content: "hei",
    });

    expect(result).toEqual({ ok: false, reason: "invalid_ids" });
    expect(captures).toHaveLength(0);
  });

  it("rejects missing profile id", async () => {
    const captures: InsertCall[] = [];
    const sb = makeSupabase({ capture: captures });

    const result = await saveMemory({
      supabaseAdmin: sb,
      workspaceId: "w-1",
      profileId: "",
      content: "hei",
    });

    expect(result).toEqual({ ok: false, reason: "invalid_ids" });
    expect(captures).toHaveLength(0);
  });

  it("blocks Norwegian personnummer patterns", async () => {
    const captures: InsertCall[] = [];
    const sb = makeSupabase({ capture: captures });

    const result = await saveMemory({
      supabaseAdmin: sb,
      workspaceId: "w-1",
      profileId: "p-1",
      content: "Mitt personnummer er 12345612345",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("pii_blocked");
    expect(captures).toHaveLength(0);
  });

  it("blocks bank-account-looking numbers", async () => {
    const captures: InsertCall[] = [];
    const sb = makeSupabase({ capture: captures });

    const result = await saveMemory({
      supabaseAdmin: sb,
      workspaceId: "w-1",
      profileId: "p-1",
      content: "Konto: 1234.56.78901",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("pii_blocked");
    expect(captures).toHaveLength(0);
  });

  it("surfaces DB errors without throwing", async () => {
    const sb = makeSupabase({
      insertResult: { data: null, error: { message: "RLS denied" } },
    });

    const result = await saveMemory({
      supabaseAdmin: sb,
      workspaceId: "w-1",
      profileId: "p-1",
      content: "Noe greit",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("db_error");
      expect(result.detail).toBe("RLS denied");
    }
  });

  it("applies scope default of 'personal' when omitted", async () => {
    const captures: InsertCall[] = [];
    const sb = makeSupabase({ capture: captures });

    await saveMemory({
      supabaseAdmin: sb,
      workspaceId: "w-1",
      profileId: "p-1",
      content: "hei",
    });

    expect(captures[0]!.row.scope).toBe("personal");
  });

  it("applies memory_type default of 'fact' when omitted", async () => {
    const captures: InsertCall[] = [];
    const sb = makeSupabase({ capture: captures });

    await saveMemory({
      supabaseAdmin: sb,
      workspaceId: "w-1",
      profileId: "p-1",
      content: "hei",
    });

    expect(captures[0]!.row.memory_type).toBe("fact");
  });
});
