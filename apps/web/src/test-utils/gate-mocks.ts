/**
 * gate-mocks.ts
 *
 * Shared Vitest helpers for Server Actions that wrap the gated-write
 * helpers from `@smartout/supabase/gate-client`. Consolidates the
 * mock patterns that emerged from the ADR-0091 WP3 people-actions pilot
 * so Wave 2A+ test suites (season-actions, capability-actions, etc.)
 * don't redefine them per-file.
 *
 * Usage:
 *
 *   import { makeGateSpies, makeFakeSupabaseClient, makeGateDeniedError }
 *     from "@/test-utils/gate-mocks";
 *
 *   const spies = makeGateSpies();
 *   vi.mock("@smartout/supabase/gate-client", async () => {
 *     const actual = await vi.importActual<
 *       typeof import("@smartout/supabase/gate-client")
 *     >("@smartout/supabase/gate-client");
 *     return { ...actual, ...spies };
 *   });
 *
 *   // In a test:
 *   spies.gatedUpdate.mockRejectedValueOnce(
 *     makeGateDeniedError({ outcome: "proposed", proposalId: "prop-1" }),
 *   );
 *
 * These helpers intentionally do NOT install any `vi.mock` calls
 * themselves — `vi.mock` is hoisted per-file and must be declared at
 * the test module's top level. Callers wire the spies into their own
 * `vi.mock` factory.
 */

import { vi, type Mock } from "vitest";
import {
  GateDeniedError,
  type GatedWriteResult,
  type SupabaseGateClient,
} from "@smartout/supabase/gate-client";

/**
 * Default "applied" outcome returned by every `makeGateSpies()` spy until
 * a test overrides it with `.mockResolvedValueOnce(...)` or `.mockRejectedValueOnce(...)`.
 */
const DEFAULT_APPLIED_RESULT: GatedWriteResult<Record<string, unknown>> = {
  data: [],
  outcome: "applied",
  exceptionReason: null,
};

/**
 * Build a set of `vi.fn()` spies for the three gated-write helpers. Each
 * resolves to `{ data: [], outcome: 'applied', exceptionReason: null }` by
 * default — i.e. the "gate let the write through" happy path.
 *
 * Tests override individual spies with `mockResolvedValueOnce` (for
 * exception outcomes) or `mockRejectedValueOnce(makeGateDeniedError(...))`
 * for proposed / blocked branches.
 *
 * Returned spies are typed as loose `Mock` (not the full generic helper
 * signature) so call-site tests don't have to fight the generics when
 * asserting `.mock.calls[0]`.
 */
export function makeGateSpies(): {
  gatedInsert: Mock;
  gatedUpdate: Mock;
  gatedDelete: Mock;
} {
  return {
    gatedInsert: vi.fn().mockResolvedValue(DEFAULT_APPLIED_RESULT),
    gatedUpdate: vi.fn().mockResolvedValue(DEFAULT_APPLIED_RESULT),
    gatedDelete: vi.fn().mockResolvedValue(DEFAULT_APPLIED_RESULT),
  };
}

/**
 * Build a `GateDeniedError` for the proposed / blocked test branches.
 * Mirrors the constructor signature from `@smartout/supabase/gate-client`
 * with sensible defaults so tests can write:
 *
 *   makeGateDeniedError({ outcome: "proposed" })
 *   makeGateDeniedError({ outcome: "blocked", reason: "authority-missing" })
 */
export function makeGateDeniedError(
  opts: {
    outcome?: "proposed" | "blocked";
    proposalId?: string | null;
    reason?: string | null;
  } = {},
): GateDeniedError {
  const outcome = opts.outcome ?? "proposed";
  return new GateDeniedError({
    outcome,
    proposalId: opts.proposalId ?? (outcome === "proposed" ? "prop-test-1" : null),
    reason: opts.reason ?? (outcome === "blocked" ? "gate-blocked-default" : null),
  });
}

/**
 * Minimal structural shim for `SupabaseGateClient`. Satisfies the
 * `rpc` + `from` surface but does not implement fluent-builder chains;
 * tests that exercise `.from().select().eq()...` should use
 * `buildSupabaseMock` / `buildClientStub` (see people-actions.test.ts +
 * gate-client.test.ts) which layer richer stubs on top.
 *
 * This is the fallback for action tests that mock `gatedUpdate` /
 * `gatedInsert` wholesale — the action sees a client, hands it to the
 * spy, and nothing else inspects it.
 */
export function makeFakeSupabaseClient(): SupabaseGateClient {
  const rpc = vi.fn().mockResolvedValue({ data: { allowed: true }, error: null });
  const from = vi.fn(() => ({
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
  }));

  return {
    // `rpc` / `from` on `SupabaseGateClient` have complex overloaded types;
    // the cast is intentional — tests don't consume the overloads.
    rpc: rpc as unknown as SupabaseGateClient["rpc"],
    from,
  };
}
