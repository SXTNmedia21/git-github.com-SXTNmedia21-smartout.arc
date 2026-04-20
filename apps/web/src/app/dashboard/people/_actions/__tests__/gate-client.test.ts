/**
 * gate-client.test.ts
 *
 * Unit tests for `gatedUpdate` / `gatedDelete` PK-column behaviour
 * (ADR-0091 WP3 + Wave 2A `entityIdColumn`-required flip).
 *
 * These tests exercise the REAL `gatedUpdate` / `gatedDelete` (not a
 * wholesale mock) against a hand-rolled `SupabaseGateClient` stub so we
 * can observe which column was passed to `.eq(...)`. This is the only
 * layer that proves the blocker fix — `people-actions.test.ts` mocks
 * `gatedUpdate` itself and cannot see the column.
 *
 * Wave 2A (2026-04-18) flipped `GateContext.entityIdColumn` from
 * optional-with-`"id"`-default to required. The "defaults to 'id'"
 * codepath no longer exists, so the prior tests asserting that default
 * have been rewritten as:
 *   1. Positive tests that verify the supplied `entityIdColumn` is used
 *      correctly (both generic `"id"` and Smartout `"{table}_id"`).
 *   2. Type-level `@ts-expect-error` assertions that constructing a
 *      `GateContext` without `entityIdColumn` is a compile-time error.
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
    // NOTE: entityIdColumn is REQUIRED post-Wave-2A. Each test sets it
    // explicitly; the compile-time enforcement is asserted below.
    entityIdColumn: "profile_id",
  };

  it("uses `.eq('id', entityId)` when entityIdColumn is 'id' — generic table path", async () => {
    const { client, eqCalls } = buildClientStub({
      rpcResponse: { data: { allowed: true, outcome: "applied" }, error: null },
      writeResponse: { data: [{ id: "x" }], error: null },
    });

    const ctx: GateContext = { ...baseCtx, entityIdColumn: "id" };
    await gatedUpdate(client, "generic_table", { role: "manager" }, ctx);

    expect(eqCalls).toHaveLength(1);
    expect(eqCalls[0]).toEqual({ column: "id", value: "prof-1" });
  });

  it("uses entityIdColumn when provided — Smartout `{table}_id` convention", async () => {
    const { client, eqCalls } = buildClientStub({
      rpcResponse: { data: { allowed: true, outcome: "applied" }, error: null },
      writeResponse: { data: [{ profile_id: "prof-1" }], error: null },
    });

    const ctx: GateContext = { ...baseCtx, entityIdColumn: "profile_id" };
    await gatedUpdate(client, "profile", { role: "manager" }, ctx);

    expect(eqCalls).toHaveLength(1);
    expect(eqCalls[0]).toEqual({ column: "profile_id", value: "prof-1" });
  });

  it("requires entityIdColumn at compile time — omitting it is a TS error", () => {
    // @ts-expect-error — entityIdColumn is required; omitting it must fail typecheck.
    const _bad: GateContext = {
      entityType: "profile",
      entityId: "prof-1",
      workspaceId: "ws-1",
      capability: "profile:update:role",
      currentData: { profile_id: "prof-1" },
    };
    // Reference `_bad` so TS doesn't elide the block before the ts-expect-error fires.
    expect(_bad).toBeDefined();
  });
});

describe("gatedDelete PK column", () => {
  const baseCtx: GateContext = {
    entityType: "profile",
    entityId: "prof-1",
    workspaceId: "ws-1",
    capability: "profile:delete",
    currentData: { profile_id: "prof-1" },
    entityIdColumn: "profile_id",
  };

  it("uses `.eq('id', entityId)` when entityIdColumn is 'id' — generic table path", async () => {
    const { client, eqCalls } = buildClientStub({
      rpcResponse: { data: { allowed: true, outcome: "applied" }, error: null },
      writeResponse: { data: [{ id: "x" }], error: null },
    });

    const ctx: GateContext = { ...baseCtx, entityIdColumn: "id" };
    await gatedDelete(client, "generic_table", ctx);

    expect(eqCalls).toHaveLength(1);
    expect(eqCalls[0]).toEqual({ column: "id", value: "prof-1" });
  });

  it("uses entityIdColumn when provided — Smartout `{table}_id` convention", async () => {
    const { client, eqCalls } = buildClientStub({
      rpcResponse: { data: { allowed: true, outcome: "applied" }, error: null },
      writeResponse: { data: [{ profile_id: "prof-1" }], error: null },
    });

    const ctx: GateContext = { ...baseCtx, entityIdColumn: "profile_id" };
    await gatedDelete(client, "profile", ctx);

    expect(eqCalls).toHaveLength(1);
    expect(eqCalls[0]).toEqual({ column: "profile_id", value: "prof-1" });
  });

  it("requires entityIdColumn at compile time — omitting it is a TS error", () => {
    // @ts-expect-error — entityIdColumn is required; omitting it must fail typecheck.
    const _bad: GateContext = {
      entityType: "profile",
      entityId: "prof-1",
      workspaceId: "ws-1",
      capability: "profile:delete",
      currentData: { profile_id: "prof-1" },
    };
    expect(_bad).toBeDefined();
  });
});
