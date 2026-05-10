/**
 * useAudienceResolver unit tests.
 *
 * Tests the queryFn logic directly (project convention: vitest runs in node env,
 * no @testing-library/react / renderHook installed). We mock useQuery to capture
 * the queryFn, then invoke it directly against a mock Supabase client.
 *
 * Three cases exercised:
 *   - kind="all"         → queries profile table, maps profile_ids
 *   - kind="department"  → short-circuits on empty departmentIds
 *   - kind="individuals" → deduplicates without DB call
 */

import { describe, it, expect, vi } from "vitest";
import type { AudienceKind } from "../use-audience-resolver";

// ---------------------------------------------------------------------------
// Capture slot for the queryFn passed to useQuery
// ---------------------------------------------------------------------------
let capturedQueryFn: (() => Promise<unknown>) | null = null;

vi.mock("@tanstack/react-query", () => ({
  useQuery: (options: { queryFn: () => Promise<unknown> }) => {
    capturedQueryFn = options.queryFn;
    return { isSuccess: false, data: undefined, isLoading: true };
  },
}));

vi.mock("@/lib/workspace-context", () => ({
  useWorkspace: () => ({ workspace: { workspace_id: "ws-test-1" } }),
}));

// ---------------------------------------------------------------------------
// Supabase mock holder — swapped per-test
// ---------------------------------------------------------------------------
// eslint-disable-next-line prefer-const
let supabaseOverride: unknown = null;

vi.mock("@smartout/supabase/client", () => ({
  createClient: () => supabaseOverride,
}));

// ---------------------------------------------------------------------------
// Chainable Supabase mock builder
//
// The "all" path ends with .eq().eq() — the final .eq() must be awaitable.
// We make each method in the chain return a resolved-like object:
//   { then: resolveWithData } (a custom thenable) AND all chain methods.
// This satisfies `await supabase.from(...).select(...).eq(...).eq(...)`.
// ---------------------------------------------------------------------------
function makeChain(resolvedData: { data: unknown; error: null }) {
  const thenable = {
    then: (onfulfilled: ((v: typeof resolvedData) => unknown) | null | undefined) =>
      Promise.resolve(resolvedData).then(onfulfilled ?? undefined),
  };

  const chain: Record<string, unknown> = {
    ...thenable,
    select: vi.fn(),
    eq: vi.fn(),
    in: vi.fn(),
    is: vi.fn(),
    limit: vi.fn().mockResolvedValue(resolvedData),
  };

  // Each method returns the chain (chainable + thenable)
  chain.select = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.in = vi.fn().mockReturnValue(chain);
  chain.is = vi.fn().mockReturnValue(chain);

  return chain;
}

function makeSupaMock(resolvedData: { data: unknown; error: null }) {
  const chain = makeChain(resolvedData);
  return {
    from: vi.fn().mockReturnValue(chain),
    schema: vi.fn().mockReturnValue({ from: vi.fn().mockReturnValue(chain) }),
  };
}

// ---------------------------------------------------------------------------
// Import hook AFTER all mocks are registered
// ---------------------------------------------------------------------------
const { useAudienceResolver } = await import("../use-audience-resolver");

// ---------------------------------------------------------------------------
// Helper: run hook (captures queryFn) → invoke queryFn → return result
// ---------------------------------------------------------------------------
async function resolveAudience(input: Parameters<typeof useAudienceResolver>[0]) {
  capturedQueryFn = null;
  useAudienceResolver(input);
  if (!capturedQueryFn) throw new Error("queryFn was not captured");
  // Snapshot before clearing — TS narrows to `() => Promise<unknown>` after the
  // null-check guard, but assigning to capturedQueryFn=null after confuses CFA.
  const fn = capturedQueryFn as () => Promise<unknown>;
  capturedQueryFn = null;
  return fn() as Promise<{ profileIds: string[]; count: number; kind: AudienceKind }>;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("useAudienceResolver", () => {
  it("returns all workspace profiles for kind='all'", async () => {
    const profileData = [
      { profile_id: "p1", display_name: "Sofia" },
      { profile_id: "p2", display_name: "Maja" },
    ];
    supabaseOverride = makeSupaMock({ data: profileData, error: null });

    const result = await resolveAudience({ kind: "all" });

    expect(result.profileIds).toEqual(["p1", "p2"]);
    expect(result.count).toBe(2);
    expect(result.kind).toBe("all");
  });

  it("returns empty list for department kind with no selected ids", async () => {
    // No supabase call expected — short-circuits on empty array
    const result = await resolveAudience({ kind: "department", departmentIds: [] });

    expect(result.profileIds).toEqual([]);
    expect(result.count).toBe(0);
    expect(result.kind).toBe("department");
  });

  it("returns deduped profile ids for individuals kind", async () => {
    // No supabase call expected — pure deduplication
    const result = await resolveAudience({
      kind: "individuals",
      profileIds: ["p1", "p1", "p3"],
    });

    expect(result.profileIds).toEqual(["p1", "p3"]);
    expect(result.count).toBe(2);
    expect(result.kind).toBe("individuals");
  });
});
