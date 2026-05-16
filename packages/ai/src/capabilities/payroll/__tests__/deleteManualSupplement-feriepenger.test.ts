// packages/ai/src/capabilities/payroll/__tests__/deleteManualSupplement-feriepenger.test.ts
//
// F-CL-12 (audit 2026-05-13) — ADR-0293 Pattern B: feriepenger_basis recomputed
// after manual supplement is deleted.
//
// F-CL-17 misattribution regression: verifies that payroll.manual_supplement_deleted
// emits target_profile_id = the employee who owned the supplement (not the admin
// actor ctx.profileId who performs the delete).
//
// Verifies:
//   1. payroll.feriepenger_basis_computed emitted once after delete.
//   2. basis matches computeFeriepengerBasis() for the employee's base_pay + pct.
//   3. F-CL-17 regression: target_profile_id in payroll.manual_supplement_deleted
//      is the employee (from shift.employee_id), NOT the admin actor.
//   4. period_id in payroll.manual_supplement_deleted is non-empty (was "" pre-fix).
//   5. No recalc emit when period is locked.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { deleteManualSupplement } from "../tools.js";
import type { AgentToolContext } from "../../types.js";
import type { NonEmptyString } from "@smartout/telemetry/server";
import { computeFeriepengerBasis } from "@smartout/payroll-export";

// ── Telemetry mock ──────────────────────────────────────────────────────────
vi.mock("@smartout/telemetry", () => ({
  emit: vi.fn().mockResolvedValue(undefined),
  nonEmpty: (v: string) => v,
}));

const { emit } = await import("@smartout/telemetry");

// ── Fixtures ────────────────────────────────────────────────────────────────
const WORKSPACE = "aaaaaaaa-0000-0000-0000-000000000001" as NonEmptyString;
const ADMIN = "00000000-0000-0000-0000-000000000010" as NonEmptyString;
const EMPLOYEE_ID = "00000000-0000-0000-0000-0000000000ee";
const SHIFT_ID = "shift-0000-0000-0000-000000000002";
const PERIOD_ID = "period-111-0000-0000-000000000002";
const SUPPLEMENT_ID = "supp-0000-0000-0000-000000000002";
const GATE_EVAL_ID = "eval-delete-supplement-test-001";

// Employee: base_pay = 25000, pct = 14.3 → basis = 25000 × 14.3 / 100 = 3575.00
const BASE_PAY = 25000;
const HOLIDAY_PCT = 14.3;

// ── Supabase mock builder ───────────────────────────────────────────────────
/**
 * Mocks the deleteManualSupplement DB call chain.
 *
 * Call order in tools.ts:deleteManualSupplement:
 *   1. rpc("gate_action")                                    → allow
 *   2. schema("payroll").from("manual_supplement").select.eq.eq.maybeSingle() → supplement row
 *   3. from("schedule_shift").select.eq.eq.maybeSingle()     → shift row (start_time + employee_id)
 *   4. schema("payroll").from("period").select.eq.lte.gte.maybeSingle() → period
 *   5. schema("payroll").from("manual_supplement").delete.eq.eq → delete
 *   6. (Pattern B) from("employee_payroll_profile").select.eq.eq.maybeSingle() → holiday pct
 *   7. (Pattern B) schema("payroll").from("calculation")...maybeSingle() → base_pay
 */
function makeSupabaseMock(
  opts: {
    periodStatus?: "open" | "locked" | "approved";
    holidayPct?: number | null;
    basePay?: number | null;
    shiftEmployeeId?: string | null;
  } = {},
): AgentToolContext["supabaseAdmin"] {
  const {
    periodStatus = "open",
    holidayPct = HOLIDAY_PCT,
    basePay = BASE_PAY,
    shiftEmployeeId = EMPLOYEE_ID,
  } = opts;

  const payrollSchemaChain = {
    from: vi.fn().mockImplementation((tbl: string) => {
      if (tbl === "manual_supplement") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: {
              id: SUPPLEMENT_ID,
              workspace_id: WORKSPACE,
              amount: 200,
              salary_code: null,
              schedule_shift_id: SHIFT_ID,
            },
            error: null,
          }),
          delete: vi.fn().mockReturnThis(),
        };
      }
      if (tbl === "period") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          lte: vi.fn().mockReturnThis(),
          gte: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: { id: PERIOD_ID, status: periodStatus },
            error: null,
          }),
        };
      }
      if (tbl === "calculation") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: basePay !== null ? { base_pay: basePay } : null,
            error: null,
          }),
        };
      }
      throw new Error(`Unexpected payroll schema table: ${tbl}`);
    }),
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mock: any = {
    rpc: vi.fn().mockResolvedValue({
      data: {
        allow: true,
        reason: null,
        channel_allowed: true,
        downgrade_to: null,
        min_role_required: "manager",
        four_eyes_required: false,
        approvers_needed: 0,
        approvers_present: [],
        gate_evaluation_id: GATE_EVAL_ID,
      },
      error: null,
    }),
    schema: vi.fn().mockReturnValue(payrollSchemaChain),
    from: vi.fn().mockImplementation((tbl: string) => {
      if (tbl === "schedule_shift") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: {
              start_time: "2026-05-15T10:00:00Z",
              employee_id: shiftEmployeeId,
            },
            error: null,
          }),
        };
      }
      if (tbl === "employee_payroll_profile") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: holidayPct !== null ? { holiday_allowance_pct: holidayPct } : null,
            error: null,
          }),
        };
      }
      throw new Error(`Unexpected public table: ${tbl}`);
    }),
  };

  return mock as AgentToolContext["supabaseAdmin"];
}

function makeCtx(supabase: AgentToolContext["supabaseAdmin"]): AgentToolContext {
  return {
    workspaceId: WORKSPACE,
    profileId: ADMIN,
    userId: "user-admin",
    sessionId: "test-session",
    channel: "chat",
    supabaseAdmin: supabase,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe("deleteManualSupplement — F-CL-12 Pattern B feriepenger recalc (ADR-0293)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("emits payroll.feriepenger_basis_computed with correct basis after supplement delete", async () => {
    const ctx = makeCtx(makeSupabaseMock());

    const raw = await deleteManualSupplement.execute({ supplement_id: SUPPLEMENT_ID }, ctx);

    const result = JSON.parse(raw) as { ok: boolean };
    expect(result.ok).toBe(true);

    const feriepengerEmits = vi
      .mocked(emit)
      .mock.calls.map(
        (c) => c[0] as unknown as { event: string; properties: { data: Record<string, unknown> } },
      )
      .filter((e) => e.event === "payroll.feriepenger_basis_computed");

    expect(feriepengerEmits).toHaveLength(1);
    const data = feriepengerEmits[0].properties.data as {
      profile_id: string;
      basis_amount: number;
      pct_applied: number;
      base_pay_total: number;
      period_id: string;
    };

    expect(data.profile_id).toBe(EMPLOYEE_ID);
    expect(data.period_id).toBe(PERIOD_ID);
    expect(data.pct_applied).toBe(HOLIDAY_PCT);
    expect(data.base_pay_total).toBe(BASE_PAY);

    const expected = computeFeriepengerBasis({
      basePayTotal: BASE_PAY,
      holidayAllowancePct: HOLIDAY_PCT,
    });
    expect(data.basis_amount).toBe(expected);
    expect(data.basis_amount).toBe(3575);
  });

  // F-CL-17 regression test — misattribution fix.
  it("F-CL-17 regression: target_profile_id is the employee, NOT the admin actor", async () => {
    const ctx = makeCtx(makeSupabaseMock());

    await deleteManualSupplement.execute({ supplement_id: SUPPLEMENT_ID }, ctx);

    const deletedEmits = vi
      .mocked(emit)
      .mock.calls.map(
        (c) => c[0] as unknown as { event: string; properties: { data: Record<string, unknown> } },
      )
      .filter((e) => e.event === "payroll.manual_supplement_deleted");

    expect(deletedEmits).toHaveLength(1);
    const data = deletedEmits[0].properties.data as {
      target_profile_id: string;
      period_id: string;
    };

    // Must be the employee who owned the supplement — NOT ctx.profileId (ADMIN).
    expect(data.target_profile_id).toBe(EMPLOYEE_ID);
    expect(data.target_profile_id).not.toBe(ADMIN);

    // F-CL-17 secondary: period_id must be non-empty (was "" before fix).
    expect(data.period_id).toBe(PERIOD_ID);
    expect(data.period_id).not.toBe("");
  });

  it("default pct = 12 when holiday_allowance_pct is null", async () => {
    const ctx = makeCtx(makeSupabaseMock({ holidayPct: null }));

    await deleteManualSupplement.execute({ supplement_id: SUPPLEMENT_ID }, ctx);

    const feriepengerEmits = vi
      .mocked(emit)
      .mock.calls.map(
        (c) => c[0] as unknown as { event: string; properties: { data: Record<string, unknown> } },
      )
      .filter((e) => e.event === "payroll.feriepenger_basis_computed");

    expect(feriepengerEmits).toHaveLength(1);
    const data = feriepengerEmits[0].properties.data as { pct_applied: number };
    expect(data.pct_applied).toBe(12);
  });

  it("does NOT emit feriepenger recalc when period is locked (delete blocked at period guard)", async () => {
    const ctx = makeCtx(makeSupabaseMock({ periodStatus: "locked" }));

    const result = await deleteManualSupplement.execute({ supplement_id: SUPPLEMENT_ID }, ctx);

    // Tool returns error string for locked period.
    expect(result).toContain("locked");

    const feriepengerEmits = vi
      .mocked(emit)
      .mock.calls.map((c) => c[0] as unknown as { event: string })
      .filter((e) => e.event === "payroll.feriepenger_basis_computed");

    expect(feriepengerEmits).toHaveLength(0);
  });

  it("falls back to ctx.profileId as target_profile_id when shift has no employee_id", async () => {
    const ctx = makeCtx(makeSupabaseMock({ shiftEmployeeId: null }));

    await deleteManualSupplement.execute({ supplement_id: SUPPLEMENT_ID }, ctx);

    const deletedEmits = vi
      .mocked(emit)
      .mock.calls.map(
        (c) => c[0] as unknown as { event: string; properties: { data: Record<string, unknown> } },
      )
      .filter((e) => e.event === "payroll.manual_supplement_deleted");

    expect(deletedEmits).toHaveLength(1);
    const data = deletedEmits[0].properties.data as { target_profile_id: string };
    // Fallback to ctx.profileId when employee_id unavailable (graceful degradation).
    expect(data.target_profile_id).toBe(ADMIN);
  });
});
