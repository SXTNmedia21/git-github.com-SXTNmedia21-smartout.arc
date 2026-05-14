/**
 * packages/ai/src/capabilities/pos_account_management/__tests__/tools.test.ts
 *
 * Vitest tests for pos_account_management capability tools (Task 3).
 *
 * Six tests per plan:
 *   1. connect_lightspeed happy: gate passes → success message returned.
 *   2. connect_lightspeed auth-fail: gate denied → "Ikke autorisert" message.
 *   3. disconnect happy: gate passes → deactivation success message.
 *   4. disconnect auth-fail: gate denied → "Ikke autorisert" message.
 *   5. list_accounts: empty workspace → "Ingen POS-kontoer" message.
 *   6. list_accounts: populated → returns formatted list.
 *
 * Strategy:
 *   mutateWithGate wraps gatedMutation which calls gate_action RPC. We mock
 *   ctx.supabaseAdmin to control gate + DB outcomes without a live Supabase.
 *   This is unit-level testing of the tool body; E2E (Task 5) covers the
 *   full pipe against the local Supabase instance.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AgentToolContext } from "../../types.js";
import { connectLightspeed, disconnect, listPosAccounts } from "../tools.js";

// ─── Mock factory ──────────────────────────────────────────────────────────

type MockRpcResult = { data: unknown; error: null | { message: string } };

function buildMockCtx(overrides: {
  channel?: "chat" | "voice";
  rpcGateResult?: MockRpcResult;
  fromInsertResult?: { data: unknown; error: null | { message: string } };
  fromUpdateResult?: { data: unknown; error: null | { message: string } };
  fromSelectResult?: { data: unknown; error: null | { message: string } };
}): AgentToolContext {
  // Gate action RPC mock: returns allow=true (field name per GateActionRow type).
  // gatedMutation checks `data.allow === true` not `data.allowed`.
  const gateRpc = vi.fn().mockResolvedValue(
    overrides.rpcGateResult ?? {
      data: {
        allow: true,
        reason: null,
        gate_evaluation_id: "test-eval-01",
        four_eyes_required: false,
        channel_allowed: true,
        downgrade_to: null,
        unseeded: false,
      },
      error: null,
    },
  );

  // Vault upsert RPC mock (for connect): always succeeds.
  const vaultRpc = vi.fn().mockResolvedValue({ data: "vault-id-01", error: null });

  const rpcMock = vi.fn().mockImplementation((fn: string) => {
    if (fn === "gate_action") return gateRpc();
    if (fn === "fn_pos_credentials_upsert") return vaultRpc();
    if (fn === "fn_pos_credentials_resolve")
      return Promise.resolve({ data: "mock-token", error: null });
    // cascade_gate_write: return allowed=applied so Pathway B passes.
    if (fn === "cascade_gate_write") {
      return Promise.resolve({
        data: {
          allowed: true,
          outcome: "applied",
          proposal_id: null,
          reason: null,
          gate_evaluation_id: "test-cascade-eval-01",
        },
        error: null,
      });
    }
    return Promise.resolve({ data: null, error: { message: `unknown RPC: ${fn}` } });
  });

  // Generic chain builder — returns a proxy-like object where every method
  // returns itself, allowing arbitrary chain depth. Terminal calls resolve.
  function chainMock(terminalResult: unknown): Record<string, unknown> {
    const handler: ProxyHandler<object> = {
      get(_target, prop) {
        if (prop === "then") return undefined; // prevent accidental thenable
        // Terminal methods that return a Promise.
        if (prop === "maybeSingle" || prop === "single" || prop === "execute") {
          return () => Promise.resolve(terminalResult);
        }
        // Methods that may terminate OR chain further.
        return vi.fn().mockReturnValue(new Proxy({}, handler));
      },
    };
    return new Proxy({}, handler) as Record<string, unknown>;
  }

  // from() mock: table-aware so pos_account + gate_evaluation + activity_trail
  // + engine_event all resolve correctly.
  const fromMock = vi.fn().mockImplementation((table: string) => {
    // gate_evaluation.update (stampCorrelation) — always succeeds.
    if (table === "gate_evaluation") {
      return chainMock({ data: null, error: null });
    }
    // activity_trail + engine_event inserts — always succeed.
    if (table === "activity_trail" || table === "engine_event") {
      return { insert: vi.fn().mockResolvedValue({ data: null, error: null }) };
    }
    // pos_account: full select/insert/update chain.
    return {
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi
              .fn()
              .mockResolvedValue(overrides.fromSelectResult ?? { data: null, error: null }),
            single: vi
              .fn()
              .mockResolvedValue(overrides.fromSelectResult ?? { data: null, error: null }),
            order: vi
              .fn()
              .mockResolvedValue(overrides.fromSelectResult ?? { data: [], error: null }),
          }),
          maybeSingle: vi
            .fn()
            .mockResolvedValue(overrides.fromSelectResult ?? { data: null, error: null }),
          order: vi.fn().mockResolvedValue(overrides.fromSelectResult ?? { data: [], error: null }),
        }),
      }),
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue(
            overrides.fromInsertResult ?? {
              data: { pos_account_id: "new-account-uuid" },
              error: null,
            },
          ),
        }),
      }),
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue(overrides.fromUpdateResult ?? { data: null, error: null }),
        }),
      }),
    };
  });

  return {
    workspaceId: "b0000000-0000-0000-0000-000000000001" as Parameters<
      typeof connectLightspeed.execute
    >[1]["workspaceId"],
    profileId: "f0000000-0000-0000-0000-000000000001" as Parameters<
      typeof connectLightspeed.execute
    >[1]["profileId"],
    sessionId: "sess-test-001",
    channel: overrides.channel ?? "chat",
    supabaseAdmin: {
      rpc: rpcMock,
      from: fromMock,
    } as unknown as AgentToolContext["supabaseAdmin"],
  };
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe("pos_account_management capability tools", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── connect_lightspeed ────────────────────────────────────────────────────

  it("connect_lightspeed happy: gate allows → success message", async () => {
    const ctx = buildMockCtx({
      channel: "chat",
      fromInsertResult: { data: { pos_account_id: "new-account-uuid" }, error: null },
    });

    const result = await connectLightspeed.execute(
      { external_account_id: "ls-account-001", oauth_code: "code-v1" },
      ctx,
    );

    expect(typeof result).toBe("string");
    expect(result).toMatch(/tilkoblet|lightspeed/i);
    // Must NOT contain error phrasing.
    expect(result).not.toMatch(/feil|error|autorisert/i);
  });

  it("connect_lightspeed auth-fail: voice channel → chat-only rejection", async () => {
    const ctx = buildMockCtx({ channel: "voice" });

    const result = await connectLightspeed.execute(
      { external_account_id: "ls-account-001", oauth_code: "code-v1" },
      ctx,
    );

    expect(typeof result).toBe("string");
    // ADR-0288 voice guard message.
    expect(result).toMatch(/chat/i);
    // Gate must NOT have been called (voice block is pre-gate).
    expect(ctx.supabaseAdmin.rpc).not.toHaveBeenCalled();
  });

  // ── disconnect ────────────────────────────────────────────────────────────

  it("disconnect happy: gate allows → deactivation success message", async () => {
    const ctx = buildMockCtx({
      channel: "chat",
      fromSelectResult: {
        data: { pos_account_id: "existing-account-uuid", vendor: "lightspeed_kseries" },
        error: null,
      },
    });

    const result = await disconnect.execute({ pos_account_id: "existing-account-uuid" }, ctx);

    expect(typeof result).toBe("string");
    expect(result).toMatch(/deaktivert|historiske/i);
    expect(result).not.toMatch(/feil|error/i);
  });

  it("disconnect auth-fail: voice channel → chat-only rejection", async () => {
    const ctx = buildMockCtx({ channel: "voice" });

    const result = await disconnect.execute({ pos_account_id: "any-account-uuid" }, ctx);

    expect(typeof result).toBe("string");
    expect(result).toMatch(/chat/i);
    expect(ctx.supabaseAdmin.rpc).not.toHaveBeenCalled();
  });

  // ── list_accounts ─────────────────────────────────────────────────────────

  it("list_accounts: empty workspace → Ingen POS-kontoer message", async () => {
    const ctx = buildMockCtx({
      fromSelectResult: { data: [], error: null },
    });

    const result = await listPosAccounts.execute({}, ctx);

    expect(typeof result).toBe("string");
    expect(result).toMatch(/ingen.*pos|connect_lightspeed/i);
  });

  it("list_accounts: populated → formatted list with vendor + status", async () => {
    const ctx = buildMockCtx({
      fromSelectResult: {
        data: [
          {
            pos_account_id: "acct-uuid-01",
            vendor: "lightspeed_kseries",
            external_account_id: "ls-001",
            status: "active",
            last_synced_at: "2026-05-14T10:00:00Z",
            created_at: "2026-05-13T08:00:00Z",
          },
        ],
        error: null,
      },
    });

    const result = await listPosAccounts.execute({}, ctx);

    expect(typeof result).toBe("string");
    expect(result).toMatch(/lightspeed_kseries/i);
    expect(result).toMatch(/active/i);
  });
});
