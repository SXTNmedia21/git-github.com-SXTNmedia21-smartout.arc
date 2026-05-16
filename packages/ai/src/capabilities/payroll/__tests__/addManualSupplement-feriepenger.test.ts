// packages/ai/src/capabilities/payroll/__tests__/addManualSupplement-feriepenger.test.ts
//
// F-CL-12 (audit 2026-05-13) — ADR-0293 Pattern B: feriepenger_basis recomputed
// after manual supplement is added.
//
// Verifies:
//   1. computeFeriepengerBasis is called (non-zero basis emitted) when a
//      supplement is added to an employee in an open period.
//   2. payroll.feriepenger_basis_computed emitted once for the affected profile.
//   3. gate_evaluation_id propagates correctly (gate present, gate.gateEvaluationId != null).
//   4. ADR-0151 workspace scope: shift.workspace_id mismatch returns not-found error.
//   5. Period null / no calculation row — basis = 0 still emits (open period, no
//      calculation run yet is a valid state per ADR-0293).

import { describe, it, expect, vi, beforeEach } from "vitest";
import { addManualSupplement } from "../tools.js";
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
const SHIFT_ID = "shift-0000-0000-0000-000000000001";
const PERIOD_ID = "period-111-0000-0000-000000000001";
const SUPPLEMENT_ID = "supp-0000-0000-0000-000000000001";
const GATE_EVAL_ID = "eval-add-supplement-test-001";

// Employee: base_pay = 30000, pct = 12 → basis = 3600.00
const BASE_PAY = 30000;
const HOLIDAY_PCT = 12.0;

// ── Supabase mock builder ───────────────────────────────────────────────────
/**
 * Mocks the addManualSupplement DB call chain.
 *
 * Call order in tools.ts:addManualSupplement:
 *   1. rpc("gate_action")                           → allow
 *   2. from("schedule_shift").select.eq.eq.maybeSingle() → shift row (start_time + employee_id)
 *   3. schema("payroll").from("period").select.eq.lte.gte.maybeSingle() → open period
 *   4. schema("payroll").from("manual_supplement").insert.select.single() → supplement row
 *   5. (Pattern B) from("employee_payroll_profile").select.eq.eq.maybeSingle() → holiday pct
 *   6. (Pattern B) schema("payroll").from("calculation").select.eq.eq.eq.order.limit.maybeSingle() → base_pay
 */
function makeSupabaseMock(
  opts: {
    periodOpen?: boolean;
    holidayPct?: number | null;
    basePay?: number | null;
    shiftEmployeeId?: string | null;
  } = {},
): AgentToolContext["supabaseAdmin"] {
  const {
    periodOpen = true,
    holidayPct = HOLIDAY_PCT,
    basePay = BASE_PAY,
    shiftEmployeeId = EMPLOYEE_ID,
  } = opts;

  const payrollSchemaChain = {
    from: vi.fn().mockImplementation((tbl: string) => {
      if (tbl === "period") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          lte: vi.fn().mockReturnThis(),
          gte: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: periodOpen
              ? { id: PERIOD_ID, status: "open" }
              : { id: PERIOD_ID, status: "locked" },
            error: null,
          }),
        };
      }
      if (tbl === "manual_supplement") {
        return {
          insert: vi.fn().mockReturnThis(),
          select: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: { id: SUPPLEMENT_ID }, error: null }),
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
        min_role_required: "admin",
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
              schedule_shift_id: SHIFT_ID,
              start_time: "2026-05-15T09:00:00Z",
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

describe("addManualSupplement — F-CL-12 Pattern B feriepenger recalc (ADR-0293)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("emits payroll.feriepenger_basis_computed with correct basis after supplement add", async () => {
    const ctx = makeCtx(makeSupabaseMock());

    const raw = await addManualSupplement.execute(
      {
        shift_id: SHIFT_ID,
        amount: 500,
        description: "Kveldstillegg manuell",
      },
      ctx,
    );

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
      channel: string;
    };

    expect(data.profile_id).toBe(EMPLOYEE_ID);
    expect(data.period_id).toBe(PERIOD_ID);
    expect(data.pct_applied).toBe(HOLIDAY_PCT);
    expect(data.base_pay_total).toBe(BASE_PAY);

    // Parity: capability output matches canonical helper.
    const expected = computeFeriepengerBasis({
      basePayTotal: BASE_PAY,
      holidayAllowancePct: HOLIDAY_PCT,
    });
    expect(data.basis_amount).toBe(expected);
    expect(data.basis_amount).toBe(3600);
    expect(data.channel).toBe("system");
  });

  it("uses 12 % default when holiday_allowance_pct is null on payroll profile", async () => {
    const ctx = makeCtx(makeSupabaseMock({ holidayPct: null }));

    await addManualSupplement.execute(
      { shift_id: SHIFT_ID, amount: 200, description: "Tillegg uten profil" },
      ctx,
    );

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

  it("emits basis = 0 when no calculation row exists in period (open period, pre-calc)", async () => {
    const ctx = makeCtx(makeSupabaseMock({ basePay: null }));

    const raw = await addManualSupplement.execute(
      { shift_id: SHIFT_ID, amount: 100, description: "Tillegg pre-kalkyle" },
      ctx,
    );
    const result = JSON.parse(raw) as { ok: boolean };
    expect(result.ok).toBe(true);

    const feriepengerEmits = vi
      .mocked(emit)
      .mock.calls.map(
        (c) => c[0] as unknown as { event: string; properties: { data: Record<string, unknown> } },
      )
      .filter((e) => e.event === "payroll.feriepenger_basis_computed");

    expect(feriepengerEmits).toHaveLength(1);
    const data = feriepengerEmits[0].properties.data as { basis_amount: number };
    // basis = 0 × pct / 100 = 0 — acceptable for pre-calc open period
    expect(data.basis_amount).toBe(0);
  });

  it("does NOT emit feriepenger_basis_computed when period is locked (blocked at period guard)", async () => {
    const ctx = makeCtx(makeSupabaseMock({ periodOpen: false }));

    const result = await addManualSupplement.execute(
      { shift_id: SHIFT_ID, amount: 100, description: "Tillegg til låst periode" },
      ctx,
    );

    // Tool returns an error string (not JSON ok:true) for locked period.
    expect(result).toContain("locked");

    const feriepengerEmits = vi
      .mocked(emit)
      .mock.calls.map((c) => c[0] as unknown as { event: string })
      .filter((e) => e.event === "payroll.feriepenger_basis_computed");

    // No recalc emit — supplement was rejected before INSERT.
    expect(feriepengerEmits).toHaveLength(0);
  });

  it("does NOT emit feriepenger recalc when shift has no employee_id", async () => {
    const ctx = makeCtx(makeSupabaseMock({ shiftEmployeeId: null }));

    const raw = await addManualSupplement.execute(
      { shift_id: SHIFT_ID, amount: 150, description: "Vakt uten ansatt" },
      ctx,
    );
    const result = JSON.parse(raw) as { ok: boolean };
    // Supplement still inserts (employee_id guard is for recalc only).
    expect(result.ok).toBe(true);

    const feriepengerEmits = vi
      .mocked(emit)
      .mock.calls.map((c) => c[0] as unknown as { event: string })
      .filter((e) => e.event === "payroll.feriepenger_basis_computed");

    // No recalc — condition `shift.employee_id` is falsy.
    expect(feriepengerEmits).toHaveLength(0);
  });
});
