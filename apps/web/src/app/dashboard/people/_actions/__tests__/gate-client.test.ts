/**
 * gate-client.test.ts
 *
 * Unit tests for `gatedUpdate` / `gatedDelete` PK-column behaviour
 * (ADR-0091 WP3, PK-column override fix).
 *
 * These tests exercise the REAL `gatedUpdate` / `gatedDelete` (not a
 * wholesale mock) against a hand-rolled `SupabaseGateClient` stub so we
 * can observe which column was passed to `.eq(...)`. This is the only
 * layer that proves the blocker fix — `people-actions.test.ts` mocks
 * `gatedUpdate` itself and cannot see the column.
 *
 * Co-located with the pilot tests because `packages/supabase` does not
 * yet have its own vitest wiring; the gate-client unit contract can move
 * to `packages/supabase/src/gate-client.test.ts` once that infra lands.
 */

import { describe, expect, it, vi } from "vitest";
import {
  gatedUpdate,
  gatedDelete,
  type SupabaseGateClient,
  type GateContext,
} from "@smartout/supabase/gate-client";

/**
 * Minimal fluent-builder stub. Records every `.eq(column, value)` call so
 * we can assert on the column name. The `.select()` terminator resolves
 * with the configured `data` / `error` payload.
 */
function buildClientStub(opts: {
  rpcResponse: { data: unknown; error: { message: string } | null };
  writeResponse: { data: unknown[]; error: { message: string } | null };
}) {
  const eqCalls: Array<{ column: string; value: unknown }> = [];
  const rpc = vi.fn().mockResolvedValue(opts.rpcResponse);

  const selectTerm = vi.fn().mockResolvedValue(opts.writeResponse);
  const eqChain = {
    select: selectTerm,
  };
  const eq = vi.fn((column: string, value: unknown) => {
    eqCalls.push({ column, value });
    return eqChain;
  });
  const update = vi.fn().mockReturnValue({ eq });
  const del = vi.fn().mockReturnValue({ eq });
  const from = vi.fn(() => ({ update, delete: del }));

  const client: SupabaseGateClient = {
    rpc: rpc as unknown as SupabaseGateClient["rpc"],
    from,
  };

  return { client, eqCalls, rpc, from, update, delete: del };
}

describe("gatedUpdate PK column", () => {
  const baseCtx: GateContext = {
    entityType: "profile",
    entityId: "prof-1",
    workspaceId: "ws-1",
    capability: "profile:update:role",
    currentData: { profile_id: "prof-1", role: "employee" },
  };

  it("defaults to `.eq('id', entityId)` when entityIdColumn is not provided", async () => {
    const { client, eqCalls } = buildClientStub({
      rpcResponse: { data: { allowed: true, outcome: "applied" }, error: null },
      writeResponse: { data: [{ id: "x" }], error: null },
    });

    await gatedUpdate(client, "generic_table", { role: "manager" }, baseCtx);

    expect(eqCalls).toHaveLength(1);
    expect(eqCalls[0]).toEqual({ column: "id", value: "prof-1" });
  });

  it("uses entityIdColumn when provided — fixes the profile_id blocker", async () => {
    const { client, eqCalls } = buildClientStub({
      rpcResponse: { data: { allowed: true, outcome: "applied" }, error: null },
      writeResponse: { data: [{ profile_id: "prof-1" }], error: null },
    });

    const ctx: GateContext = { ...baseCtx, entityIdColumn: "profile_id" };
    await gatedUpdate(client, "profile", { role: "manager" }, ctx);

    expect(eqCalls).toHaveLength(1);
    expect(eqCalls[0]).toEqual({ column: "profile_id", value: "prof-1" });
  });
});

describe("gatedDelete PK column", () => {
  const baseCtx: GateContext = {
    entityType: "profile",
    entityId: "prof-1",
    workspaceId: "ws-1",
    capability: "profile:delete",
    currentData: { profile_id: "prof-1" },
  };

  it("defaults to `.eq('id', entityId)` when entityIdColumn is not provided", async () => {
    const { client, eqCalls } = buildClientStub({
      rpcResponse: { data: { allowed: true, outcome: "applied" }, error: null },
      writeResponse: { data: [{ id: "x" }], error: null },
    });

    await gatedDelete(client, "generic_table", baseCtx);

    expect(eqCalls).toHaveLength(1);
    expect(eqCalls[0]).toEqual({ column: "id", value: "prof-1" });
  });

  it("uses entityIdColumn when provided", async () => {
    const { client, eqCalls } = buildClientStub({
      rpcResponse: { data: { allowed: true, outcome: "applied" }, error: null },
      writeResponse: { data: [{ profile_id: "prof-1" }], error: null },
    });

    const ctx: GateContext = { ...baseCtx, entityIdColumn: "profile_id" };
    await gatedDelete(client, "profile", ctx);

    expect(eqCalls).toHaveLength(1);
    expect(eqCalls[0]).toEqual({ column: "profile_id", value: "prof-1" });
  });
});
