// packages/ai/src/capabilities/payroll/__tests__/tariff-tools.test.ts
//
// Phase 7f (2026-05-17) — unit tests for payroll tariff delegation tools.
//
// Tests verify:
//   T1. setup_workspace_tariff — happy path: no existing binding → cascade OK → emit + return
//   T2. setup_workspace_tariff — TARIFF_ALREADY_BOUND when active binding exists
//   T3. setup_workspace_tariff — L-0177 fail-fast on empty workspaceId
//   T4. change_workspace_tariff — happy path: existing binding → cascade OK → emit + return
//   T5. change_workspace_tariff — NO_EXISTING_BINDING when no active binding
//   T6. add_supplement_override — happy path: cascade OK → emit + return
//   T7. add_supplement_override — SUPPLEMENT_BELOW_TARIFF_FLOOR passed through from cascade
//   T8. setup_workspace_tariff — INVALID_WORKSPACE cross-workspace block (ADR-0151)
//   T9. change_workspace_tariff — derives TARIFF_REVISION vs UNION_CHANGE classifier
//   T10. add_supplement_override — L-0177 fail-fast on empty profileId

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  setupWorkspaceTariffTool,
  changeWorkspaceTariffTool,
  addSupplementOverrideTool,
} from "../tariff-tools.js";
import type { AgentToolContext } from "../../types.js";
import type { NonEmptyString } from "@smartout/telemetry/server";

// ─── Mock telemetry ──────────────────────────────────────────────────────────
vi.mock("@smartout/telemetry", () => ({
  emit: vi.fn().mockResolvedValue(undefined),
  nonEmpty: (v: string) => v,
}));

const { emit } = await import("@smartout/telemetry");

// ─── Mock cascade tools ──────────────────────────────────────────────────────
// We mock at the module level so payroll tools use our controlled cascade responses.
vi.mock("../../cascade/tools.js", () => ({
  bindWorkspaceUnionTool: {
    execute: vi.fn(),
  },
  addSupplementRuleTool: {
    execute: vi.fn(),
  },
}));

const { bindWorkspaceUnionTool, addSupplementRuleTool } = await import("../../cascade/tools.js");

// ─── Mock mutateWithGate ─────────────────────────────────────────────────────
// mutateWithGate wraps exec in a gate. For unit tests we want to pass the gate
// and run exec directly so we can test tool logic without a DB.
vi.mock("../../_shared/mutate-with-gate.js", async () => {
  const actual = await vi.importActual<typeof import("../../_shared/mutate-with-gate.js")>(
    "../../_shared/mutate-with-gate.js",
  );
  return {
    ...actual,
    // Override: run exec() directly with a dummy supabase, no real gate_action RPC needed.
    mutateWithGate: vi
      .fn()
      .mockImplementation(
        async (_client: unknown, args: { exec: (db: unknown) => Promise<unknown> }) => {
          const result = await args.exec(_client);
          return {
            ok: true,
            result,
            gateEvaluationId: "test-gate-id",
            correlationId: "test-corr-id",
          };
        },
      ),
    MutateWithGateDenied: actual.MutateWithGateDenied,
    MutateWithGateError: actual.MutateWithGateError,
  };
});

// ─── Fixture UUIDs ──────────────────────────────────────────────────────────

const WORKSPACE_A = "aaaaaaaa-0000-0000-0000-000000000001" as NonEmptyString;
const ADMIN_PROFILE = "00000000-0000-0000-0000-000000000010" as NonEmptyString;
const BINDING_ID_OLD = "bind0000-0000-0000-0000-000000000001";
const BINDING_ID_NEW = "bind0000-0000-0000-0000-000000000002";
const SUPPLEMENT_RULE_ID = "supp0000-0000-0000-0000-000000000001";
// Stable cascade emit id returned by the mock cascade tool — lets us assert
// that payroll tools echo the TRUE cascade emit id back (Phase 7h).
const CASCADE_EMIT_ID_BIND = "c45cade0-bind-0000-0000-000000000001";
const CASCADE_EMIT_ID_SUPP = "c45cade0-supp-0000-0000-000000000001";

// ─── Supabase mock helpers ───────────────────────────────────────────────────

/** Build a supabase mock whose .from() chain returns the given rows. */
function makeSupabaseMockWithBindings(
  existingRows: Array<Record<string, string>>,
): AgentToolContext["supabaseAdmin"] {
  return {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: existingRows, error: null }),
    }),
    rpc: vi.fn().mockResolvedValue({ data: {}, error: null }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

/** Build a minimal ctx with the given supabase mock. */
function makeCtx(overrides: Partial<AgentToolContext> = {}): AgentToolContext {
  return {
    workspaceId: WORKSPACE_A,
    profileId: ADMIN_PROFILE,
    userId: "user-admin",
    sessionId: "test-session",
    channel: "chat",
    supabaseAdmin: makeSupabaseMockWithBindings([]),
    ...overrides,
  };
}

// ─── Standard cascade mock responses ────────────────────────────────────────

function bindOkResult(bindingId = BINDING_ID_NEW, effectiveFrom = "2026-06-01"): string {
  return JSON.stringify({
    ok: true,
    workspace_union_binding_id: bindingId,
    effective_from: effectiveFrom,
    // Phase 7h: cascade tool now returns its own emit id so payroll layer can
    // echo the TRUE cascade correlation_id instead of pre-generating a new UUID.
    cascade_emit_id: CASCADE_EMIT_ID_BIND,
  });
}

function supplementOkResult(ruleId = SUPPLEMENT_RULE_ID): string {
  return JSON.stringify({
    ok: true,
    supplement_rule_id: ruleId,
    // Phase 7h: cascade tool now returns its own emit id.
    cascade_emit_id: CASCADE_EMIT_ID_SUPP,
  });
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("payroll tariff delegation tools (Phase 7f, ADR-0356)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── T1: setup_workspace_tariff happy path ───────────────────────────────

  it("T1: setup_workspace_tariff — no existing binding → cascade OK → emits + returns binding", async () => {
    vi.mocked(bindWorkspaceUnionTool.execute).mockResolvedValue(bindOkResult());

    const ctx = makeCtx({
      supabaseAdmin: makeSupabaseMockWithBindings([]), // no existing binding
    });

    const raw = await setupWorkspaceTariffTool.execute(
      {
        workspace_id: WORKSPACE_A,
        union_id: "taro-79",
        law_version: "2024-2026",
        official_effective_date: "2026-06-01",
        derivation_snapshot_id: null,
      },
      ctx,
    );

    const result = JSON.parse(raw) as {
      ok: boolean;
      workspace_union_binding_id: string;
      effective_from: string;
      cascade_emit_id: string | null;
    };
    expect(result.ok).toBe(true);
    expect(result.workspace_union_binding_id).toBe(BINDING_ID_NEW);
    expect(result.effective_from).toBe("2026-06-01");
    // Phase 7h: cascade_emit_id MUST match what the cascade mock returned (not a
    // newly generated UUID). This verifies the true round-trip — payroll tool reads
    // cascade's own emit id rather than pre-generating an unrelated UUID.
    expect(result.cascade_emit_id).toBe(CASCADE_EMIT_ID_BIND);

    // Cascade tool called with caller_capability='payroll' and BOOTSTRAP classifier.
    expect(bindWorkspaceUnionTool.execute).toHaveBeenCalledOnce();
    const cascadeInput = vi.mocked(bindWorkspaceUnionTool.execute).mock.calls[0]![0];
    expect(cascadeInput.caller_capability).toBe("payroll");
    expect(cascadeInput.amendment_classifier).toBe("BOOTSTRAP");

    // Payroll emit with audit-symmetry fields.
    expect(emit).toHaveBeenCalledOnce();
    const emitCall = vi.mocked(emit).mock.calls[0]![0] as {
      event: string;
      properties: {
        data: { actor_capability: string; delegated_via: string; amendment_classifier: string };
      };
    };
    expect(emitCall.event).toBe("payroll.workspace_tariff_setup");
    expect(emitCall.properties.data.actor_capability).toBe("payroll");
    expect(emitCall.properties.data.delegated_via).toBe("cascade");
    expect(emitCall.properties.data.amendment_classifier).toBe("BOOTSTRAP");
  });

  // ── T2: setup_workspace_tariff — TARIFF_ALREADY_BOUND ──────────────────

  it("T2: setup_workspace_tariff — existing active binding → TARIFF_ALREADY_BOUND, cascade NOT called", async () => {
    const ctx = makeCtx({
      supabaseAdmin: makeSupabaseMockWithBindings([
        { workspace_union_binding_id: BINDING_ID_OLD }, // existing binding present
      ]),
    });

    const raw = await setupWorkspaceTariffTool.execute(
      {
        workspace_id: WORKSPACE_A,
        union_id: "taro-79",
        law_version: "2024-2026",
        official_effective_date: "2026-06-01",
        derivation_snapshot_id: null,
      },
      ctx,
    );

    const result = JSON.parse(raw) as { ok: boolean; code: string; existing_binding_id: string };
    expect(result.ok).toBe(false);
    expect(result.code).toBe("TARIFF_ALREADY_BOUND");
    expect(result.existing_binding_id).toBe(BINDING_ID_OLD);

    // Cascade tool must NOT be called — we short-circuit before delegation.
    expect(bindWorkspaceUnionTool.execute).not.toHaveBeenCalled();
    // No telemetry emitted for a blocked operation.
    expect(emit).not.toHaveBeenCalled();
  });

  // ── T3: setup_workspace_tariff — L-0177 fail-fast ──────────────────────

  it("T3: setup_workspace_tariff — empty workspaceId → MISSING_PROFILE_CONTEXT (L-0177)", async () => {
    const ctx = makeCtx({ workspaceId: "" as NonEmptyString });

    const raw = await setupWorkspaceTariffTool.execute(
      {
        workspace_id: WORKSPACE_A,
        union_id: "taro-79",
        law_version: "2024-2026",
        official_effective_date: "2026-06-01",
        derivation_snapshot_id: null,
      },
      ctx,
    );

    const result = JSON.parse(raw) as { ok: boolean; code: string };
    expect(result.ok).toBe(false);
    expect(result.code).toBe("MISSING_PROFILE_CONTEXT");

    // Neither cascade tool nor gate called when ctx is invalid.
    expect(bindWorkspaceUnionTool.execute).not.toHaveBeenCalled();
    expect(emit).not.toHaveBeenCalled();
  });

  // ── T4: change_workspace_tariff happy path ──────────────────────────────

  it("T4: change_workspace_tariff — existing binding → cascade OK → emits + returns old+new IDs", async () => {
    vi.mocked(bindWorkspaceUnionTool.execute).mockResolvedValue(
      bindOkResult(BINDING_ID_NEW, "2026-07-01"),
    );

    const ctx = makeCtx({
      supabaseAdmin: makeSupabaseMockWithBindings([
        {
          workspace_union_binding_id: BINDING_ID_OLD,
          union_id: "taro-79",
          law_version: "2024-2026",
        },
      ]),
    });

    const raw = await changeWorkspaceTariffTool.execute(
      {
        workspace_id: WORKSPACE_A,
        new_union_id: "taro-79",
        new_law_version: "2026-2028",
        official_effective_date: "2026-07-01",
        derivation_snapshot_id: null,
        reason: "New Riksavtalen 2026",
      },
      ctx,
    );

    const result = JSON.parse(raw) as {
      ok: boolean;
      old_workspace_union_binding_id: string;
      new_workspace_union_binding_id: string;
      effective_from: string;
      amendment_classifier: string;
      cascade_emit_id: string | null;
    };
    expect(result.ok).toBe(true);
    expect(result.old_workspace_union_binding_id).toBe(BINDING_ID_OLD);
    expect(result.new_workspace_union_binding_id).toBe(BINDING_ID_NEW);
    expect(result.effective_from).toBe("2026-07-01");
    // Same union (taro-79), new law_version (2024-2026 → 2026-2028) hits Lovsen
    // classifier Rule 7 (Riksavtalen §4 carve-out) → UP. Replaces previous
    // TARIFF_REVISION semantic string when inline heuristic shipped.
    expect(result.amendment_classifier).toBe("UP");
    // Phase 7h: cascade_emit_id MUST match what cascade mock returned.
    expect(result.cascade_emit_id).toBe(CASCADE_EMIT_ID_BIND);

    // Cascade tool called with 'UP' classifier + caller_capability='payroll'.
    const cascadeInput = vi.mocked(bindWorkspaceUnionTool.execute).mock.calls[0]![0];
    expect(cascadeInput.caller_capability).toBe("payroll");
    expect(cascadeInput.amendment_classifier).toBe("UP");

    // Payroll emit with audit-symmetry.
    const emitCall = vi.mocked(emit).mock.calls[0]![0] as {
      event: string;
      properties: {
        data: {
          actor_capability: string;
          delegated_via: string;
          amendment_classifier: string;
          reason: string | null;
        };
      };
    };
    expect(emitCall.event).toBe("payroll.workspace_tariff_changed");
    expect(emitCall.properties.data.actor_capability).toBe("payroll");
    expect(emitCall.properties.data.delegated_via).toBe("cascade");
    expect(emitCall.properties.data.reason).toBe("New Riksavtalen 2026");
  });

  // ── T5: change_workspace_tariff — NO_EXISTING_BINDING ──────────────────

  it("T5: change_workspace_tariff — no active binding → NO_EXISTING_BINDING, cascade NOT called", async () => {
    const ctx = makeCtx({
      supabaseAdmin: makeSupabaseMockWithBindings([]), // no active binding
    });

    const raw = await changeWorkspaceTariffTool.execute(
      {
        workspace_id: WORKSPACE_A,
        new_union_id: "taro-79",
        new_law_version: "2026-2028",
        official_effective_date: "2026-07-01",
        derivation_snapshot_id: null,
      },
      ctx,
    );

    const result = JSON.parse(raw) as { ok: boolean; code: string };
    expect(result.ok).toBe(false);
    expect(result.code).toBe("NO_EXISTING_BINDING");

    expect(bindWorkspaceUnionTool.execute).not.toHaveBeenCalled();
    expect(emit).not.toHaveBeenCalled();
  });

  // ── T6: add_supplement_override happy path ──────────────────────────────

  it("T6: add_supplement_override — cascade OK → emits + returns supplement_rule_id", async () => {
    vi.mocked(addSupplementRuleTool.execute).mockResolvedValue(supplementOkResult());

    const ctx = makeCtx();

    const raw = await addSupplementOverrideTool.execute(
      {
        workspace_id: WORKSPACE_A,
        name: "Kveldstillegg etter kl 22",
        supplement_type: "day_based",
        rate_value: 30,
        rate_type: "percentage",
        tariff_rate_table_id: null,
        paragraf_ref: "§6",
        match_predicate: { hour_gte: 22 },
        valid_from: null,
        valid_until: null,
      },
      ctx,
    );

    const result = JSON.parse(raw) as {
      ok: boolean;
      supplement_rule_id: string;
      cascade_emit_id: string | null;
    };
    expect(result.ok).toBe(true);
    expect(result.supplement_rule_id).toBe(SUPPLEMENT_RULE_ID);
    // Phase 7h: cascade_emit_id MUST match what cascade mock returned.
    expect(result.cascade_emit_id).toBe(CASCADE_EMIT_ID_SUPP);

    // Cascade tool called with caller_capability='payroll'.
    const cascadeInput = vi.mocked(addSupplementRuleTool.execute).mock.calls[0]![0];
    expect(cascadeInput.caller_capability).toBe("payroll");

    // Payroll emit with audit-symmetry.
    const emitCall = vi.mocked(emit).mock.calls[0]![0] as {
      event: string;
      properties: { data: { actor_capability: string; delegated_via: string } };
    };
    expect(emitCall.event).toBe("payroll.supplement_override_added");
    expect(emitCall.properties.data.actor_capability).toBe("payroll");
    expect(emitCall.properties.data.delegated_via).toBe("cascade");
  });

  // ── T7: add_supplement_override — SUPPLEMENT_BELOW_TARIFF_FLOOR pass-through

  it("T7: add_supplement_override — SUPPLEMENT_BELOW_TARIFF_FLOOR passed through from cascade verbatim", async () => {
    const belowFloorResult = JSON.stringify({
      ok: false,
      code: "SUPPLEMENT_BELOW_TARIFF_FLOOR",
      aml_ref: "§14-15",
      floor: 27,
      proposed: 20,
      message: "supplement rate below tariff minimum for tariff-bound workspace",
    });
    vi.mocked(addSupplementRuleTool.execute).mockResolvedValue(belowFloorResult);

    const ctx = makeCtx();

    const raw = await addSupplementOverrideTool.execute(
      {
        workspace_id: WORKSPACE_A,
        name: "Kveldstillegg under gulv",
        supplement_type: "day_based",
        rate_value: 20, // below floor of 27
        rate_type: "percentage",
        tariff_rate_table_id: null,
        paragraf_ref: null,
        match_predicate: {},
        valid_from: null,
        valid_until: null,
      },
      ctx,
    );

    const result = JSON.parse(raw) as {
      ok: boolean;
      code: string;
      aml_ref: string;
      floor: number;
      proposed: number;
    };
    expect(result.ok).toBe(false);
    expect(result.code).toBe("SUPPLEMENT_BELOW_TARIFF_FLOOR");
    expect(result.aml_ref).toBe("§14-15");
    expect(result.floor).toBe(27);
    expect(result.proposed).toBe(20);

    // No telemetry emitted for rejected operation.
    expect(emit).not.toHaveBeenCalled();
  });

  // ── T8: setup_workspace_tariff — INVALID_WORKSPACE cross-workspace block ──

  it("T8: setup_workspace_tariff — body workspace_id !== ctx.workspaceId → INVALID_WORKSPACE (ADR-0151)", async () => {
    const ctx = makeCtx({ workspaceId: WORKSPACE_A });
    const OTHER_WORKSPACE = "bbbbbbbb-0000-0000-0000-000000000002";

    const raw = await setupWorkspaceTariffTool.execute(
      {
        workspace_id: OTHER_WORKSPACE, // mismatch
        union_id: "taro-79",
        law_version: "2024-2026",
        official_effective_date: "2026-06-01",
        derivation_snapshot_id: null,
      },
      ctx,
    );

    const result = JSON.parse(raw) as { ok: boolean; code: string };
    expect(result.ok).toBe(false);
    expect(result.code).toBe("INVALID_WORKSPACE");

    expect(bindWorkspaceUnionTool.execute).not.toHaveBeenCalled();
    expect(emit).not.toHaveBeenCalled();
  });

  // ── T9: change_workspace_tariff — Lovsen classifier wiring ────────────────
  // Updated 2026-05-17 (Phase 7d Track 5): inline TARIFF_REVISION/UNION_CHANGE
  // heuristic replaced with legal.classifyAmendmentLogic (Aml. §14-6 + Riksavtalen
  // §4 rule matrix). Different-union path → classifier Rule 6 → MATERIAL.
  // Cascade BLOCKS MATERIAL in production (AMENDMENT_BLOCKED §14-6(m)) but the
  // mock returns ok unconditionally — so we assert the MATERIAL value flows
  // through to both cascade input and payroll output.

  it("T9: change_workspace_tariff — different union_id → MATERIAL classifier (Aml. §14-6 bokstav m)", async () => {
    vi.mocked(bindWorkspaceUnionTool.execute).mockResolvedValue(
      bindOkResult(BINDING_ID_NEW, "2026-08-01"),
    );

    const ctx = makeCtx({
      supabaseAdmin: makeSupabaseMockWithBindings([
        // Old binding: taro-79 (Riksavtalen)
        {
          workspace_union_binding_id: BINDING_ID_OLD,
          union_id: "taro-79",
          law_version: "2024-2026",
        },
      ]),
    });

    const raw = await changeWorkspaceTariffTool.execute(
      {
        workspace_id: WORKSPACE_A,
        new_union_id: "taro-226", // different union → classifier Rule 6 → MATERIAL
        new_law_version: "2024-2026",
        official_effective_date: "2026-08-01",
        derivation_snapshot_id: null,
      },
      ctx,
    );

    const result = JSON.parse(raw) as { ok: boolean; amendment_classifier: string };
    expect(result.ok).toBe(true);
    expect(result.amendment_classifier).toBe("MATERIAL");

    // Verify cascade was called with the classifier output (MATERIAL).
    // In production cascade BLOCKS MATERIAL — mock here returns ok to
    // verify wiring. Real-world flow: amendment-handler picks up MATERIAL.
    const cascadeInput = vi.mocked(bindWorkspaceUnionTool.execute).mock.calls[0]![0];
    expect(cascadeInput.amendment_classifier).toBe("MATERIAL");
  });

  // ── T10: add_supplement_override — L-0177 empty profileId ────────────────

  it("T10: add_supplement_override — empty profileId → MISSING_PROFILE_CONTEXT (L-0177)", async () => {
    const ctx = makeCtx({ profileId: "" as NonEmptyString });

    const raw = await addSupplementOverrideTool.execute(
      {
        workspace_id: WORKSPACE_A,
        name: "Test tillegg",
        supplement_type: "normal",
        rate_value: 50,
        rate_type: "percentage",
        tariff_rate_table_id: null,
        paragraf_ref: null,
        match_predicate: {},
        valid_from: null,
        valid_until: null,
      },
      ctx,
    );

    const result = JSON.parse(raw) as { ok: boolean; code: string };
    expect(result.ok).toBe(false);
    expect(result.code).toBe("MISSING_PROFILE_CONTEXT");

    expect(addSupplementRuleTool.execute).not.toHaveBeenCalled();
    expect(emit).not.toHaveBeenCalled();
  });
});
