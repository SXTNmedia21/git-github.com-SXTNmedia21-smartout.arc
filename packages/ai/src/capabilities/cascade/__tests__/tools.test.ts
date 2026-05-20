/**
 * packages/ai/src/capabilities/cascade/__tests__/tools.test.ts
 *
 * Vitest unit tests for cascade delegation capability tools (ADR-0356).
 *
 * Tests:
 *   bindWorkspaceUnionTool:
 *     1. Happy path — atomic RPC succeeds, emit fires with actor_capability + delegated_via
 *     2. L-0177 fail-fast — missing ctx.workspaceId → MISSING_PROFILE_CONTEXT
 *     3. L-0177 fail-fast — missing ctx.profileId → MISSING_PROFILE_CONTEXT
 *     4. Cross-workspace block — body workspace_id !== ctx.workspaceId → INVALID_WORKSPACE
 *     5. AMENDMENT_BLOCKED — classifier='MATERIAL' → AMENDMENT_BLOCKED + aml_ref §14-6(m)
 *     6. AMENDMENT_BLOCKED — classifier='ENDRINGSOPPSIGELSE' → AMENDMENT_BLOCKED
 *
 *   addSupplementRuleTool:
 *     7. Happy path — INSERT succeeds, emit fires with actor_capability + delegated_via
 *     8. Below-floor error envelope — PG error matching tariff-floor pattern →
 *        SUPPLEMENT_BELOW_TARIFF_FLOOR with parsed floor + proposed
 *     9. L-0177 fail-fast — missing ctx.workspaceId → MISSING_PROFILE_CONTEXT
 *    10. AUTHORITY_DENIED — gate denies → AUTHORITY_DENIED error envelope (ADR-0152)
 *    11. INVALID_WORKSPACE — body workspace_id !== ctx.workspaceId → INVALID_WORKSPACE
 *
 * Strategy:
 *   mutateWithGate wraps gatedMutation which calls gate_action RPC.
 *   We mock ctx.supabaseAdmin to control gate + DB outcomes.
 *   The proxy chain builder from pos_account_management tests is reused here.
 *
 * References:
 *   ADR-0356 — delegation pattern spec (gate, fail-fast, AMENDMENT_BLOCKED, delegated_via)
 *   ADR-0355 — workspace_union_binding table contract
 *   ADR-0152 — structured error envelope (SUPPLEMENT_BELOW_TARIFF_FLOOR)
 *   L-0177   — fail-fast on missing workspace_id / profile_id
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AgentToolContext } from "../../types.js";
import type { NonEmptyString } from "@smartout/telemetry/server";

// Suppress real telemetry — test assertions below check emit was called.
// Without this mock, the activity_trail provider calls createClient() with
// no SUPABASE_URL → unhandled rejection → vitest exit 1.
vi.mock("@smartout/telemetry", async () => {
  const actual = await vi.importActual<typeof import("@smartout/telemetry")>("@smartout/telemetry");
  return {
    ...actual,
    emit: vi.fn(async () => undefined),
    nonEmpty: (v: string) => v,
  };
});

import { bindWorkspaceUnionTool, addSupplementRuleTool } from "../tools.js";

// ─── Fixture UUIDs ────────────────────────────────────────────────────────────

const WORKSPACE_A = "aaaaaaaa-0000-0000-0000-000000000001" as NonEmptyString;
const WORKSPACE_B = "bbbbbbbb-0000-0000-0000-000000000002";
const ADMIN_PROFILE = "00000000-0000-0000-0000-000000000010" as NonEmptyString;
const BINDING_ID = "b1nd1ng0-0000-0000-0000-000000000001";
const RULE_ID = "ru1e0000-0000-0000-0000-000000000001";

// ─── Mock helpers ──────────────────────────────────────────────────────────────

/** Build the gate_action RPC response that allows the action. */
function allowGateData() {
  return {
    allow: true,
    reason: null,
    gate_evaluation_id: "test-eval-01",
    four_eyes_required: false,
    channel_allowed: true,
    downgrade_to: null,
    min_role_required: "admin",
    approvers_needed: 0,
    approvers_present: [],
    unseeded: false,
  };
}

/**
 * Generic chain builder — returns a Proxy where every property access returns
 * either itself (for chaining) or a resolved Promise (for terminal calls).
 * This allows arbitrary `.select().eq().maybeSingle()` chains in tool bodies.
 */
function chainMock(terminalResult: unknown): Record<string, unknown> {
  const handler: ProxyHandler<object> = {
    get(_target, prop) {
      if (prop === "then") return undefined; // prevent accidental thenable
      if (prop === "maybeSingle" || prop === "single" || prop === "execute") {
        return () => Promise.resolve(terminalResult);
      }
      return vi.fn().mockReturnValue(new Proxy({}, handler));
    },
  };
  return new Proxy({}, handler) as Record<string, unknown>;
}

/**
 * Build a supabaseAdmin mock that handles:
 *   - gate_action RPC → gateResult
 *   - cascade_gate_write RPC → allowed=true (Pathway B short-circuits)
 *   - from("workspace_union_binding") for maybeSingle + insert + update
 *   - from("supplement_rule") for insert
 *   - from("gate_evaluation"), from("activity_trail"), from("engine_event") → noop
 */
function buildMockSupabase(opts: {
  gateAllow: boolean;
  selectResult?: unknown;
  insertResult?: unknown;
  updateResult?: unknown;
  insertError?: { message: string } | null;
}): AgentToolContext["supabaseAdmin"] {
  const rpcMock = vi.fn().mockImplementation((fn: string) => {
    if (fn === "gate_action") {
      return Promise.resolve({
        data: opts.gateAllow ? allowGateData() : { allow: false, reason: "authority_denied" },
        error: null,
      });
    }
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
    // atomic switch-flow RPC (FIX 2 — ADR-0356 §"Transaction shape")
    if (fn === "bind_workspace_union_atomic") {
      if (opts.insertError) {
        return Promise.resolve({
          data: null,
          error: opts.insertError,
        });
      }
      return Promise.resolve({
        data: [
          {
            workspace_union_binding_id: BINDING_ID,
            effective_from: "2026-01-01",
          },
        ],
        error: null,
      });
    }
    return Promise.resolve({ data: null, error: { message: `unknown RPC: ${fn}` } });
  });

  const fromMock = vi.fn().mockImplementation((table: string) => {
    // gate_evaluation stamp — always succeeds
    if (table === "gate_evaluation") {
      return chainMock({ data: null, error: null });
    }
    // activity_trail + engine_event inserts — always succeed
    if (table === "activity_trail" || table === "engine_event") {
      return { insert: vi.fn().mockResolvedValue({ data: null, error: null }) };
    }
    // workspace_union_binding: maybeSingle (find active binding) + insert + update
    if (table === "workspace_union_binding") {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnThis(),
          is: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue(opts.selectResult ?? { data: null, error: null }),
        }),
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue(
              opts.insertResult ?? {
                data: {
                  workspace_union_binding_id: BINDING_ID,
                  effective_from: "2026-01-01",
                },
                error: opts.insertError ?? null,
              },
            ),
          }),
        }),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      };
    }
    // supplement_rule: insert
    if (table === "supplement_rule") {
      return {
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue(
              opts.insertResult ?? {
                data: { supplement_rule_id: RULE_ID },
                error: opts.insertError ?? null,
              },
            ),
          }),
        }),
      };
    }
    // Default: chain mock succeeds
    return chainMock({ data: null, error: null });
  });

  return {
    rpc: rpcMock,
    from: fromMock,
  } as unknown as AgentToolContext["supabaseAdmin"];
}

/** Build a well-formed AgentToolContext. */
function makeCtx(overrides: Partial<AgentToolContext> = {}): AgentToolContext {
  return {
    workspaceId: WORKSPACE_A,
    profileId: ADMIN_PROFILE,
    userId: "user-admin",
    sessionId: "test-session",
    channel: "chat",
    supabaseAdmin: buildMockSupabase({ gateAllow: true }),
    ...overrides,
  };
}

// ─── bindWorkspaceUnionTool ────────────────────────────────────────────────────

const BASE_BIND_INPUT = {
  workspace_id: WORKSPACE_A as string,
  union_id: "taro-79" as const,
  law_version: "2024-2026",
  effective_from: "2026-01-01",
  amendment_classifier: "BOOTSTRAP" as const,
  derivation_snapshot_id: null,
  caller_capability: "payroll",
};

describe("bindWorkspaceUnionTool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("T1: happy path — atomic RPC succeeds, emit fires with actor_capability + delegated_via, result includes cascade_emit_id", async () => {
    const { emit } = await import("@smartout/telemetry");
    const ctx = makeCtx({
      supabaseAdmin: buildMockSupabase({ gateAllow: true }),
    });

    const result = JSON.parse(await bindWorkspaceUnionTool.execute(BASE_BIND_INPUT, ctx));

    expect(result.ok).toBe(true);
    expect(result.workspace_union_binding_id).toBe(BINDING_ID);
    expect(result.effective_from).toBe("2026-01-01");
    // Phase 7h: cascade tool must return cascade_emit_id (the correlation_id used
    // in its own emit) so the payroll layer can read it for full audit chain.
    expect(result.cascade_emit_id).toBeDefined();
    expect(typeof result.cascade_emit_id).toBe("string");
    expect(result.cascade_emit_id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );

    // Verify emit carries BOTH actor_capability (caller) AND delegated_via (owner).
    // Both are load-bearing per ADR-0356 §"Audit trail symmetry" — auditors use
    // actor_capability + delegated_via to trace full cross-namespace provenance.
    // Also verify emit was called with the same correlation_id as cascade_emit_id.
    expect(emit).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "cascade.workspace_union_binding_created",
        correlation_id: result.cascade_emit_id,
        properties: expect.objectContaining({
          data: expect.objectContaining({
            actor_capability: "payroll",
            delegated_via: "cascade",
            workspace_union_binding_id: BINDING_ID,
            union_id: "taro-79",
          }),
        }),
      }),
    );
  });

  it("T2: L-0177 fail-fast — empty workspaceId → MISSING_PROFILE_CONTEXT", async () => {
    const ctx = makeCtx({ workspaceId: "" as NonEmptyString });
    const result = JSON.parse(await bindWorkspaceUnionTool.execute(BASE_BIND_INPUT, ctx));

    expect(result.ok).toBe(false);
    expect(result.code).toBe("MISSING_PROFILE_CONTEXT");
  });

  it("T3: L-0177 fail-fast — empty profileId → MISSING_PROFILE_CONTEXT", async () => {
    const ctx = makeCtx({ profileId: "" as NonEmptyString });
    const result = JSON.parse(await bindWorkspaceUnionTool.execute(BASE_BIND_INPUT, ctx));

    expect(result.ok).toBe(false);
    expect(result.code).toBe("MISSING_PROFILE_CONTEXT");
  });

  it("T4: cross-workspace block — body workspace_id !== ctx.workspaceId → INVALID_WORKSPACE", async () => {
    const ctx = makeCtx();
    const input = { ...BASE_BIND_INPUT, workspace_id: WORKSPACE_B };
    const result = JSON.parse(await bindWorkspaceUnionTool.execute(input, ctx));

    expect(result.ok).toBe(false);
    expect(result.code).toBe("INVALID_WORKSPACE");
  });

  it("T5: AMENDMENT_BLOCKED — classifier=MATERIAL → code + aml_ref §14-6(m)", async () => {
    const ctx = makeCtx();
    const input = {
      ...BASE_BIND_INPUT,
      amendment_classifier: "MATERIAL" as const,
    };
    const result = JSON.parse(await bindWorkspaceUnionTool.execute(input, ctx));

    expect(result.ok).toBe(false);
    expect(result.code).toBe("AMENDMENT_BLOCKED");
    expect(result.aml_ref).toBe("§14-6(m)");
  });

  it("T6: AMENDMENT_BLOCKED — classifier=ENDRINGSOPPSIGELSE → AMENDMENT_BLOCKED", async () => {
    const ctx = makeCtx();
    const input = {
      ...BASE_BIND_INPUT,
      amendment_classifier: "ENDRINGSOPPSIGELSE" as const,
    };
    const result = JSON.parse(await bindWorkspaceUnionTool.execute(input, ctx));

    expect(result.ok).toBe(false);
    expect(result.code).toBe("AMENDMENT_BLOCKED");
  });
});

// ─── addSupplementRuleTool ────────────────────────────────────────────────────

const BASE_SUPPLEMENT_INPUT = {
  workspace_id: WORKSPACE_A as string,
  name: "Kveldskveld-tillegg",
  supplement_type: "normal" as const,
  rate_value: 3200,
  rate_type: "fixed_per_hour" as const,
  tariff_rate_table_id: null,
  paragraf_ref: "§14-7 (3)",
  match_predicate: {},
  valid_from: null,
  valid_until: null,
  caller_capability: "payroll",
};

describe("addSupplementRuleTool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("T7: happy path — INSERT succeeds, emit fires with actor_capability + delegated_via, result includes cascade_emit_id", async () => {
    const { emit } = await import("@smartout/telemetry");
    const ctx = makeCtx({
      supabaseAdmin: buildMockSupabase({
        gateAllow: true,
        insertResult: {
          data: { supplement_rule_id: RULE_ID },
          error: null,
        },
      }),
    });

    const result = JSON.parse(await addSupplementRuleTool.execute(BASE_SUPPLEMENT_INPUT, ctx));

    expect(result.ok).toBe(true);
    expect(result.supplement_rule_id).toBe(RULE_ID);
    // Phase 7h: cascade tool must return cascade_emit_id (the correlation_id used
    // in its own emit) so the payroll layer can read it for full audit chain.
    expect(result.cascade_emit_id).toBeDefined();
    expect(typeof result.cascade_emit_id).toBe("string");
    expect(result.cascade_emit_id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );

    // Verify emit carries BOTH actor_capability (caller) AND delegated_via (owner).
    // Both are load-bearing per ADR-0356 §"Audit trail symmetry" — auditors use
    // actor_capability + delegated_via to trace full cross-namespace provenance.
    // Also verify emit was called with the same correlation_id as cascade_emit_id.
    expect(emit).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "cascade.supplement_rule_added",
        correlation_id: result.cascade_emit_id,
        properties: expect.objectContaining({
          data: expect.objectContaining({
            actor_capability: "payroll",
            delegated_via: "cascade",
            supplement_rule_id: RULE_ID,
            supplement_type: "normal",
            paragraf_ref: "§14-7 (3)",
          }),
        }),
      }),
    );
  });

  it("T8: below-floor error — PG error matching tariff-floor pattern → structured envelope", async () => {
    // Simulate the BEFORE INSERT trigger raising:
    // "supplement_rate_below_tariff_floor: floor=5000 proposed=3200"
    const ctx = makeCtx({
      supabaseAdmin: buildMockSupabase({
        gateAllow: true,
        insertError: {
          message: "supplement_rate_below_tariff_floor: floor=5000 proposed=3200",
        },
      }),
    });

    const result = JSON.parse(await addSupplementRuleTool.execute(BASE_SUPPLEMENT_INPUT, ctx));

    expect(result.ok).toBe(false);
    expect(result.code).toBe("SUPPLEMENT_BELOW_TARIFF_FLOOR");
    expect(result.aml_ref).toBe("§14-15");
    expect(result.floor).toBe(5000);
    expect(result.proposed).toBe(3200);
  });

  it("T9: L-0177 fail-fast — empty workspaceId → MISSING_PROFILE_CONTEXT", async () => {
    const ctx = makeCtx({ workspaceId: "" as NonEmptyString });
    const result = JSON.parse(await addSupplementRuleTool.execute(BASE_SUPPLEMENT_INPUT, ctx));

    expect(result.ok).toBe(false);
    expect(result.code).toBe("MISSING_PROFILE_CONTEXT");
  });

  it("T10: AUTHORITY_DENIED — gate denies → AUTHORITY_DENIED error envelope (ADR-0152)", async () => {
    // Gate returns allow=false — mutateWithGate throws MutateWithGateDenied.
    // Tool must surface structured AUTHORITY_DENIED envelope per ADR-0152.
    const ctx = makeCtx({
      supabaseAdmin: buildMockSupabase({ gateAllow: false }),
    });

    const result = JSON.parse(await addSupplementRuleTool.execute(BASE_SUPPLEMENT_INPUT, ctx));

    expect(result.ok).toBe(false);
    expect(result.code).toBe("AUTHORITY_DENIED");
    // No DB write should have occurred — gate fires before exec.
    expect(ctx.supabaseAdmin.from).not.toHaveBeenCalledWith("supplement_rule");
  });

  it("T11: INVALID_WORKSPACE — body workspace_id !== ctx.workspaceId → INVALID_WORKSPACE", async () => {
    // Body supplies WORKSPACE_B but ctx authenticates as WORKSPACE_A.
    // Cross-workspace mismatch is a forgery attempt — must be hard-rejected (ADR-0151).
    const ctx = makeCtx();
    const input = { ...BASE_SUPPLEMENT_INPUT, workspace_id: WORKSPACE_B };

    const result = JSON.parse(await addSupplementRuleTool.execute(input, ctx));

    expect(result.ok).toBe(false);
    expect(result.code).toBe("INVALID_WORKSPACE");
    // No gate or DB call — rejection happens before mutateWithGate.
    expect(ctx.supabaseAdmin.rpc).not.toHaveBeenCalledWith("gate_action", expect.anything());
  });
});
