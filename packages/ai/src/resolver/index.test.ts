// packages/ai/src/resolver/index.test.ts
import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { resolveEntity } from "./index.js";

const makeClient = (returnValue: unknown, error: unknown = null) => ({
  rpc: vi.fn().mockResolvedValue({ data: returnValue, error }),
});

describe("resolveEntity", () => {
  it("returns ranked candidates from fn_fuzzy_match_entity", async () => {
    const client = makeClient([
      {
        matched_id: "11111111-1111-1111-1111-111111111111",
        matched_name: "Knut Hansen",
        confidence: 0.98,
      },
      {
        matched_id: "22222222-2222-2222-2222-222222222222",
        matched_name: "Knut Andersen",
        confidence: 0.92,
      },
    ]);
    const res = await resolveEntity({
      client: client as unknown as SupabaseClient,
      type: "profile",
      raw_name: "Knut Hansen",
      workspace_id: "00000000-0000-0000-0000-000000000000",
      threshold: 0.9,
    });
    expect(client.rpc).toHaveBeenCalledWith("fn_fuzzy_match_entity", {
      p_workspace_id: "00000000-0000-0000-0000-000000000000",
      p_entity_type: "profile",
      p_raw_name: "Knut Hansen",
      p_threshold: 0.9,
    });
    expect(res).toHaveLength(2);
    expect(res[0]!.confidence).toBe(0.98);
  });

  it("throws fail-fast on RPC error (no silent fallback per L-0177)", async () => {
    const client = makeClient(null, { message: "pg_trgm not installed" });
    await expect(
      resolveEntity({
        client: client as unknown as SupabaseClient,
        type: "department",
        raw_name: "Kjøkken",
        workspace_id: "00000000-0000-0000-0000-000000000000",
      }),
    ).rejects.toThrow(/pg_trgm not installed/);
  });

  it("returns empty array when no candidate meets threshold", async () => {
    const client = makeClient([]);
    const res = await resolveEntity({
      client: client as unknown as SupabaseClient,
      type: "location",
      raw_name: "Filial X",
      workspace_id: "00000000-0000-0000-0000-000000000000",
    });
    expect(res).toEqual([]);
  });
});
