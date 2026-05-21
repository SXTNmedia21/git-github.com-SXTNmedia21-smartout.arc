// packages/ai/src/capabilities/payroll/__tests__/update-payroll-profile.test.ts
//
// Phase 5 TB2 (2026-05-08) — unit tests for update_payroll_profile tax-card extension.
// Tests verify:
//   - Happy path: tax fields written, tax_card_fetched_at auto-set, telemetry correct
//   - Mixed update: salary + tax fields in one call
//   - Schema refinements: type vs field consistency enforced by Zod .refine()
//   - Clear: all tax fields set to null still sets tax_card_fetched_at
//
// Column note: canonical DB column is `tax_percentage`. This file uses `tax_percentage`
// throughout. query_tax_card column name corrected in TB3 (2026-05-08).

import { describe, it, expect, vi, beforeEach } from "vitest";
import { updatePayrollProfile } from "../tools.js";
import type { AgentToolContext } from "../../types.js";
import type { NonEmptyString } from "@smartout/telemetry/server";

// Suppress real telemetry — captured via mock assertion below.
vi.mock("@smartout/telemetry", () => ({
  emit: vi.fn().mockResolvedValue(undefined),
  nonEmpty: (v: string) => v,
}));

const { emit } = await import("@smartout/telemetry");

// ─── Helper types ────────────────────────────────────────────────────────────

type UpdateEmitProps = {
  event: string;
  workspace_id: string;
  actor_id: string;
  properties: {
    entity: { entity_type: string; entity_id: string };
    data: {
      target_profile_id: string;
      fields_updated: string[];
      gate_evaluation_id: string | null;
      fields_changed: string[];
      tax_fields_touched: boolean;
    };
  };
};
function asUpdateEmit(call: unknown): UpdateEmitProps {
  return call as UpdateEmitProps;
}

// ─── Fixture UUIDs ──────────────────────────────────────────────────────────

const WORKSPACE_A = "aaaaaaaa-0000-0000-0000-000000000001" as NonEmptyString;
const ADMIN_PROFILE = "00000000-0000-0000-0000-000000000010" as NonEmptyString;
const TARGET_PROFILE = "00000000-0000-0000-0000-000000000020";
const PAYROLL_PROFILE_ID = "pp000000-0000-0000-0000-000000000001";
const EVAL_ID = "eval-00000000-0000-0000-0000-000000000099";

// ─── Mock helpers ────────────────────────────────────────────────────────────

type MockRpcResult = { data: Record<string, unknown>; error: null };

// gate_action allow shape (Pathway A).
function allowGate(evalId = EVAL_ID): MockRpcResult {
  return {
    data: {
      allow: true,
      reason: null,
      channel_allowed: true,
      downgrade_to: null,
      min_role_required: "admin",
      four_eyes_required: false,
      approvers_needed: 0,
      approvers_present: [],
      gate_evaluation_id: evalId,
    },
    error: null,
  };
}

// cascade_gate_write allow shape (Pathway B).
// Must use `allowed` (not `allow`) and include `outcome` so gatedMutation
// correctly branches to the domain-write path.
function allowCascade(evalId = EVAL_ID): MockRpcResult {
  return {
    data: {
      allowed: true,
      outcome: "applied",
      reason: "no-active-framework",
      gate_evaluation_id: evalId,
    },
    error: null,
  };
}

/**
 * Build a Supabase mock that handles the mutateWithGate composition
 * orchestrator (ADR-0204) call sequence:
 *
 *   1. rpc("gate_action", ...)       → Pathway A allow
 *   2. from("gate_evaluation")       → stampCorrelation (best-effort, swallowed)
 *   3. rpc("cascade_gate_write", ...) → Pathway B allow
 *   4. from("employee_payroll_profile") .select/.eq/.single  → profileResult (workspace verify)
 *   5. from("employee_payroll_profile") .update/.eq/.select/.single → updateResult (exec)
 *   6. from("gate_evaluation")       → optional stampCorrelation row2 (swallowed)
 *
 * The from() mock is table-aware (not call-count–based) so intermediate
 * gate_evaluation stamp calls inserted by the orchestrator don't shift
 * the count and mis-route the profile/update queries.
 */
function makeSupabaseMock(
  rpcResult: MockRpcResult,
  profileResult: { data: Record<string, unknown> | null; error: { message: string } | null },
  updateResult: { data: Record<string, unknown> | null; error: { message: string } | null },
): AgentToolContext["supabaseAdmin"] {
  // Track how many times employee_payroll_profile has been queried so we
  // can distinguish the select (workspace verify) from the update (exec).
  let payrollProfileCallCount = 0;

  return {
    // Discriminate gate_action vs cascade_gate_write — each pathway
    // expects a distinct response shape (L-0133 / ADR-0204).
    rpc: vi.fn().mockImplementation((fn: string) => {
      if (fn === "cascade_gate_write") return Promise.resolve(allowCascade());
      // gate_action (and any other RPC) uses the caller-supplied result.
      return Promise.resolve(rpcResult);
    }),
    from: vi.fn().mockImplementation((table: string) => {
      if (table === "gate_evaluation") {
        // stampCorrelation — best-effort; errors are swallowed by the
        // orchestrator so returning a no-op thenable is sufficient.
        const noop = {
          update: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          then: (resolve: (v: unknown) => void) => resolve({ data: null, error: null }),
        };
        return noop;
      }
      if (table === "employee_payroll_profile") {
        payrollProfileCallCount += 1;
        if (payrollProfileCallCount === 1) {
          // Workspace verification query (.select/.eq/.single)
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue(profileResult),
          };
        }
        // Domain update inside exec (.update/.eq/.select/.single)
        return {
          update: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          select: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue(updateResult),
        };
      }
      // Unknown table — return a silent no-op builder.
      return {
        select: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
      };
    }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

function makeCtx(
  overrides: Partial<AgentToolContext> & { supabaseAdmin?: AgentToolContext["supabaseAdmin"] } = {},
): AgentToolContext {
  return {
    workspaceId: WORKSPACE_A,
    profileId: ADMIN_PROFILE,
    userId: "user-admin",
    sessionId: "test-session",
    channel: "chat",
    supabaseAdmin: makeSupabaseMock(
      allowGate(),
      { data: { id: PAYROLL_PROFILE_ID, workspace_id: WORKSPACE_A }, error: null },
      { data: { id: PAYROLL_PROFILE_ID }, error: null },
    ),
    ...overrides,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("update_payroll_profile — tax-card extension (TB2)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Test 1: happy path — tax fields only ────────────────────────────────

  it("happy path tax fields only: writes tax fields, sets tax_card_fetched_at, correct telemetry", async () => {
    // Capture the update payload to verify tax_card_fetched_at is set.
    let capturedUpdatePayload: Record<string, unknown> | null = null;
    const updateMock = vi.fn().mockImplementation((payload: Record<string, unknown>) => {
      capturedUpdatePayload = payload;
      return {
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: { id: PAYROLL_PROFILE_ID }, error: null }),
      };
    });

    let payrollCallCount1 = 0;
    const supabaseMock = {
      // Discriminate gate_action vs cascade_gate_write (ADR-0204 composition
      // orchestrator calls both; each expects a distinct response shape).
      rpc: vi.fn().mockImplementation((fn: string) => {
        if (fn === "cascade_gate_write") return Promise.resolve(allowCascade());
        return Promise.resolve(allowGate());
      }),
      from: vi.fn().mockImplementation((table: string) => {
        if (table === "gate_evaluation") {
          // stampCorrelation — best-effort, errors swallowed by orchestrator.
          return {
            update: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            then: (resolve: (v: unknown) => void) => resolve({ data: null, error: null }),
          };
        }
        if (table === "employee_payroll_profile") {
          payrollCallCount1 += 1;
          if (payrollCallCount1 === 1) {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({
                data: { id: PAYROLL_PROFILE_ID, workspace_id: WORKSPACE_A },
                error: null,
              }),
            };
          }
          return {
            update: updateMock,
            eq: vi.fn().mockReturnThis(),
            select: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: { id: PAYROLL_PROFILE_ID }, error: null }),
          };
        }
        return {
          select: vi.fn().mockReturnThis(),
          update: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
        };
      }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;

    const ctx = makeCtx({ supabaseAdmin: supabaseMock });

    const raw = await updatePayrollProfile.execute(
      {
        profile_id: TARGET_PROFILE,
        tax_card_type: "percentage",
        tax_percentage: 22,
        tax_card_year: 2026,
      },
      ctx,
    );

    const result = JSON.parse(raw) as { ok: boolean };
    expect(result.ok).toBe(true);

    // tax_card_fetched_at must have been included in the payload.
    expect(capturedUpdatePayload).not.toBeNull();
    expect(capturedUpdatePayload!.tax_card_fetched_at).toBeDefined();
    expect(typeof capturedUpdatePayload!.tax_card_fetched_at).toBe("string");

    // Telemetry: mutateWithGate emits gate_evaluated internally (ADR-0204 SS-4)
    // and the tool emits payroll.update_payroll_profile — 2 calls total.
    expect(emit).toHaveBeenCalledTimes(2);
    const allCalls = vi.mocked(emit).mock.calls.map((c) => asUpdateEmit(c[0]));
    const emitCall = allCalls.find((c) => c.event === "payroll.update_payroll_profile")!;
    expect(emitCall).toBeDefined();
    expect(emitCall.properties.data.tax_fields_touched).toBe(true);
    expect(emitCall.properties.data.fields_changed).toContain("tax_card_type");
    expect(emitCall.properties.data.fields_changed).toContain("tax_percentage");
    expect(emitCall.properties.data.fields_changed).toContain("tax_card_year");
    // tax_municipality_code dropped (ADR-0250 deferral — column does not exist in DB).
    expect(emitCall.properties.data.fields_changed).not.toContain("tax_municipality_code");
    // tax_card_fetched_at is internal — should NOT appear in fields_updated.
    expect(emitCall.properties.data.fields_updated).not.toContain("tax_card_fetched_at");
    expect(emitCall.properties.data.gate_evaluation_id).toBe(EVAL_ID);
  });

  // ── Test 2: mixed update — salary + tax fields ──────────────────────────

  it("mixed update: salary + table tax card — all fields written, fields_changed includes both", async () => {
    const ctx = makeCtx();

    const raw = await updatePayrollProfile.execute(
      {
        profile_id: TARGET_PROFILE,
        monthly_salary: 40000,
        tax_card_type: "table",
        tax_table_number: "7150",
        tax_card_year: 2026,
      },
      ctx,
    );

    const result = JSON.parse(raw) as { ok: boolean };
    expect(result.ok).toBe(true);

    // mutateWithGate emits gate_evaluated internally (ADR-0204 SS-4) + tool emits
    // payroll.update_payroll_profile — 2 calls total.
    expect(emit).toHaveBeenCalledTimes(2);
    const allCalls2 = vi.mocked(emit).mock.calls.map((c) => asUpdateEmit(c[0]));
    const emitCall = allCalls2.find((c) => c.event === "payroll.update_payroll_profile")!;
    expect(emitCall).toBeDefined();
    expect(emitCall.properties.data.tax_fields_touched).toBe(true);
    expect(emitCall.properties.data.fields_changed).toContain("monthly_salary");
    expect(emitCall.properties.data.fields_changed).toContain("tax_card_type");
    expect(emitCall.properties.data.fields_changed).toContain("tax_table_number");
    expect(emitCall.properties.data.fields_changed).toContain("tax_card_year");
    // tax_percentage not in params → not in fields_changed.
    expect(emitCall.properties.data.fields_changed).not.toContain("tax_percentage");
  });

  // ── Test 3: schema refinement — percentage type without rate ────────────

  it("schema refinement: tax_card_type=percentage without tax_percentage → Zod parse fails", () => {
    const schema = updatePayrollProfile.schema;

    const parseResult = schema.safeParse({
      profile_id: TARGET_PROFILE,
      tax_card_type: "percentage",
      // tax_percentage deliberately omitted
      tax_card_year: 2026,
    });

    expect(parseResult.success).toBe(false);
    if (!parseResult.success) {
      const msg = parseResult.error.issues.map((i) => i.message).join("|");
      expect(msg).toContain("Inkonsistent skattekort-data");
    }
  });

  // ── Test 4: schema refinement — tax fields without year ─────────────────

  it("schema refinement: tax fields set without tax_card_year → Zod parse fails", () => {
    const schema = updatePayrollProfile.schema;

    const parseResult = schema.safeParse({
      profile_id: TARGET_PROFILE,
      tax_card_type: "percentage",
      tax_percentage: 22,
      // tax_card_year deliberately omitted
    });

    expect(parseResult.success).toBe(false);
    if (!parseResult.success) {
      const msg = parseResult.error.issues.map((i) => i.message).join("|");
      expect(msg).toContain("Inkonsistent skattekort-data");
    }
  });

  // ── Test 5: clear tax card — null values still set tax_card_fetched_at ──

  it("clear tax card: all 5 tax fields=null → columns cleared, tax_card_fetched_at still set", async () => {
    let capturedUpdatePayload: Record<string, unknown> | null = null;

    let payrollCallCount5 = 0;
    const supabaseMock = {
      // Discriminate gate_action vs cascade_gate_write (ADR-0204 composition
      // orchestrator calls both; each expects a distinct response shape).
      rpc: vi.fn().mockImplementation((fn: string) => {
        if (fn === "cascade_gate_write") return Promise.resolve(allowCascade());
        return Promise.resolve(allowGate());
      }),
      from: vi.fn().mockImplementation((table: string) => {
        if (table === "gate_evaluation") {
          // stampCorrelation — best-effort, errors swallowed by orchestrator.
          return {
            update: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            then: (resolve: (v: unknown) => void) => resolve({ data: null, error: null }),
          };
        }
        if (table === "employee_payroll_profile") {
          payrollCallCount5 += 1;
          if (payrollCallCount5 === 1) {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({
                data: { id: PAYROLL_PROFILE_ID, workspace_id: WORKSPACE_A },
                error: null,
              }),
            };
          }
          return {
            update: vi.fn().mockImplementation((payload: Record<string, unknown>) => {
              capturedUpdatePayload = payload;
              return {
                eq: vi.fn().mockReturnThis(),
                select: vi.fn().mockReturnThis(),
                single: vi
                  .fn()
                  .mockResolvedValue({ data: { id: PAYROLL_PROFILE_ID }, error: null }),
              };
            }),
          };
        }
        return {
          select: vi.fn().mockReturnThis(),
          update: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
        };
      }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;

    const ctx = makeCtx({ supabaseAdmin: supabaseMock });

    const raw = await updatePayrollProfile.execute(
      {
        profile_id: TARGET_PROFILE,
        tax_card_type: null,
        tax_table_number: null,
        tax_percentage: null,
        // tax_card_year: null is the tricky case — refine requires year when OTHER
        // tax fields are non-undefined, but setting year=null means it IS provided.
        // With all fields null, the refine checks: anyTaxSet=true (all are non-undefined),
        // tax_card_year === null → return false → FAILS refine.
        //
        // Design decision: clearing all fields still needs a year (we record WHEN it was
        // cleared). Pass year=2026 to satisfy the refine.
        tax_card_year: 2026,
        // tax_municipality_code dropped (ADR-0250 deferral — column does not exist in DB).
      },
      ctx,
    );

    const result = JSON.parse(raw) as { ok: boolean };
    expect(result.ok).toBe(true);

    // Payload: null values written for the tax columns.
    expect(capturedUpdatePayload).not.toBeNull();
    expect(capturedUpdatePayload!.tax_card_type).toBeNull();
    expect(capturedUpdatePayload!.tax_table_number).toBeNull();
    expect(capturedUpdatePayload!.tax_percentage).toBeNull();
    // tax_municipality_code must NOT appear in payload (column dropped).
    expect(capturedUpdatePayload!.tax_municipality_code).toBeUndefined();
    // tax_card_fetched_at MUST still be set (records the clear-action timestamp).
    expect(capturedUpdatePayload!.tax_card_fetched_at).toBeDefined();

    // Telemetry: mutateWithGate emits gate_evaluated internally (ADR-0204 SS-4)
    // + tool emits payroll.update_payroll_profile — 2 calls total.
    expect(emit).toHaveBeenCalledTimes(2);
    const allCalls5 = vi.mocked(emit).mock.calls.map((c) => asUpdateEmit(c[0]));
    const emitCall = allCalls5.find((c) => c.event === "payroll.update_payroll_profile")!;
    expect(emitCall).toBeDefined();
    expect(emitCall.properties.data.tax_fields_touched).toBe(true);
  });
});
