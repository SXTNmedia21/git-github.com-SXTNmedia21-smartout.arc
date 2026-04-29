/**
 * kb_query capability tools — unit tests.
 *
 * ADR-0221: KB capability registration as merge gate (G1).
 * Three tests cover the contract surface of searchKb:
 *   1. Empty / whitespace query → returns { ok: false, error: 'empty_query' }
 *      without calling the embedding layer.
 *   2. Happy path → getQueryEmbedding called, RPC called, results returned.
 *   3. RPC error → returns { ok: false, error: 'rpc_failed', details: <message> }.
 *
 * Note: getQueryEmbedding is mocked via vi.mock("../../embedding.js") so
 * no OPENROUTER_API_KEY is required. The supabase mock captures rpc() calls
 * inline — no TABLE_SCHEMAS dependency needed (kb_query touches only rpc,
 * never from()).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { nonEmpty } from "@smartout/telemetry/server";
import { searchKb } from "../tools.js";
import type { AgentToolContext } from "../../types.js";

// Mock the embedding layer so tests never need OPENROUTER_API_KEY.
// Path is relative to the test file (3 levels up from __tests__/ → kb_query/ → capabilities/ → src/).
// The mock is in module scope and reset via vi.mocked() in each test.
vi.mock("../../../embedding.js", () => ({
  getQueryEmbedding: vi.fn().mockResolvedValue([0.1, 0.2, 0.3]),
}));

const WORKSPACE_ID = "10000000-0000-0000-0000-000000000001";
const PROFILE_ID = "20000000-0000-0000-0000-000000000001";

// Import after vi.mock so the mocked module is in scope for assertions.
const { getQueryEmbedding } = await import("../../../embedding.js");

/** Build a minimal AgentToolContext with a custom rpc() mock. */
function makeCtx(
  rpcImpl: (
    fn: string,
    args: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: unknown }>,
  overrides: Partial<AgentToolContext> = {},
): AgentToolContext {
  const supabaseAdmin = {
    rpc: vi.fn((fn: string, args: Record<string, unknown>) => rpcImpl(fn, args)),
  } as unknown as SupabaseClient;

  return {
    workspaceId: nonEmpty(WORKSPACE_ID, "workspaceId"),
    profileId: nonEmpty(PROFILE_ID, "profileId"),
    sessionId: "session-1",
    channel: "chat",
    supabaseAdmin,
    ...overrides,
  };
}

describe("searchKb", () => {
  beforeEach(() => {
    vi.mocked(getQueryEmbedding).mockResolvedValue([0.1, 0.2, 0.3]);
  });

  it("returns empty_query error without calling embedding for blank input", async () => {
    const ctx = makeCtx(async () => ({ data: null, error: null }));

    const result = await searchKb.execute(
      { query: "   ", matchCount: 5, matchThreshold: 0.5 },
      ctx,
    );

    const parsed = JSON.parse(result);
    expect(parsed.ok).toBe(false);
    expect(parsed.error).toBe("empty_query");

    // Embedding must not be called for empty/whitespace queries.
    expect(vi.mocked(getQueryEmbedding)).not.toHaveBeenCalled();
  });

  it("returns matched results on happy path", async () => {
    const mockChunks = [
      {
        chunk_id: "chunk-1",
        source_type: "handbook",
        source_path: "/handbook/onboarding",
        title: "Onboarding",
        content: "Welcome to the team. This section covers your first week.",
        similarity: 0.87,
      },
      {
        chunk_id: "chunk-2",
        source_type: "policy",
        source_path: "/policy/sick-leave",
        title: "Sick Leave Policy",
        content: "Employees must notify their manager before their shift starts.",
        similarity: 0.75,
      },
    ];

    const ctx = makeCtx(async (_fn, _args) => ({ data: mockChunks, error: null }));

    const result = await searchKb.execute(
      { query: "Hva er prosedyren for sykmelding?", matchCount: 5, matchThreshold: 0.5 },
      ctx,
    );

    const parsed = JSON.parse(result);
    expect(parsed.ok).toBe(true);
    expect(parsed.results).toHaveLength(2);

    const first = parsed.results[0];
    expect(first.chunk_id).toBe("chunk-1");
    expect(first.source_type).toBe("handbook");
    expect(first.title).toBe("Onboarding");
    expect(first.similarity).toBe(0.87);

    // getQueryEmbedding must have been called with the trimmed query.
    expect(vi.mocked(getQueryEmbedding)).toHaveBeenCalledWith("Hva er prosedyren for sykmelding?");

    // RPC must have been called with the correct workspace_id.
    const rpcMock = ctx.supabaseAdmin.rpc as ReturnType<typeof vi.fn>;
    expect(rpcMock).toHaveBeenCalledWith(
      "match_workspace_docs",
      expect.objectContaining({ p_workspace_id: WORKSPACE_ID }),
    );
  });

  it("returns rpc_failed error when RPC returns an error", async () => {
    const ctx = makeCtx(async () => ({
      data: null,
      error: { message: "function match_workspace_docs does not exist" },
    }));

    const result = await searchKb.execute(
      { query: "Kontraktsvilkår for sesongansatte", matchCount: 3, matchThreshold: 0.4 },
      ctx,
    );

    const parsed = JSON.parse(result);
    expect(parsed.ok).toBe(false);
    expect(parsed.error).toBe("rpc_failed");
    expect(parsed.details).toContain("match_workspace_docs");
  });
});
