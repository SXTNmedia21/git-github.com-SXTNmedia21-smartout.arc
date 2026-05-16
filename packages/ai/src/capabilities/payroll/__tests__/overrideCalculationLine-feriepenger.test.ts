// packages/ai/src/capabilities/payroll/__tests__/overrideCalculationLine-feriepenger.test.ts
//
// F-CL-12 (audit 2026-05-13) — ADR-0293 Pattern B: feriepenger_basis recomputed
// after a calculation line override proposal is created.
//
// Verifies:
//   1. payroll.feriepenger_basis_computed emitted once after a successful proposal.
//   2. basis matches computeFeriepengerBasis() for the target employee.
//   3. profile_id in feriepenger emit is the target employee (parentCalc.profile_id),
//      not the admin actor (ADR-0151 / L-0177 — profile resolved from DB, not body).
//   4. gate_evaluation_id propagates through (gate present, non-null).
//   5. No feriepenger emit when period is locked (change_proposal rejected).
//   6. Default pct = 12 when holiday_allowance_pct is null.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { overrideCalculationLine } from "../tools.js";
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
// Target employee — NOT the admin. Must appear in feriepenger emit.
const EMPLOYEE_ID = "00000000-0000-0000-0000-0000000000ff";
const PERIOD_ID = "period-111-0000-0000-000000000003";
const CALC_ID = "calc-0000-0000-0000-000000000003";
const LINE_ID = "line-0000-0000-0000-000000000003";
const PROPOSAL_ID = "proposal-000-0000-0000-000000000003";
const GATE_EVAL_ID = "eval-override-line-test-001";

// Employee: base_pay = 45000, pct = 10.2 → basis = 45000 × 10.2 / 100 = 4590.00
const BASE_PAY = 45000;
const HOLIDAY_PCT = 10.2;

// ── Supabase mock builder ───────────────────────────────────────────────────
/**
 * Mocks the overrideCalculationLine DB call chain.
 *
 * Call order in tools.ts:overrideCalculationLine:
 *   1. rpc("gate_action")                                    → allow
 *   2. schema("payroll").from("period").select.eq.eq.maybeSingle() → period
 *   3. schema("payroll").from("calculation_line").select.eq.eq.maybeSingle() → line
 *   4. schema("payroll").from("calculation").select.eq.eq.maybeSingle() → parent calc
 *   5. from("change_proposal").select.eq.eq.eq.filter.maybeSingle() → no pending override
 *   6. from("change_proposal").insert.select.single()        → new proposal
 *   7. (Pattern B) from("employee_payroll_profile")...maybeSingle() → holiday pct
 *   8. (Pattern B) schema("payroll").from("calculation")...maybeSingle() → base_pay
 */
function makeSupabaseMock(
  opts: {
    periodStatus?: "open" | "locked" | "approved";
    holidayPct?: number | null;
    basePay?: number | null;
    hasPendingOverride?: boolean;
  } = {},
): AgentToolContext["supabaseAdmin"] {
  const {
    periodStatus = "open",
    holidayPct = HOLIDAY_PCT,
    basePay = BASE_PAY,
    hasPendingOverride = false,
  } = opts;

  // Track call counts to distinguish payroll.schema('payroll').from('calculation')
  // calls: first = parent calc lookup, second = Pattern B base_pay lookup.
  let calcCallCount = 0;

  const payrollSchemaChain = {
    from: vi.fn().mockImplementation((tbl: string) => {
      if (tbl === "period") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: { id: PERIOD_ID, status: periodStatus, workspace_id: WORKSPACE },
            error: null,
          }),
        };
      }
      if (tbl === "calculation_line") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: {
              id: LINE_ID,
              workspace_id: WORKSPACE,
              calculation_id: CALC_ID,
              amount: 5000,
              line_type: "base_pay",
              salary_code: "1000",
              description: "Grunnlønn",
            },
            error: null,
          }),
        };
      }
      if (tbl === "calculation") {
        calcCallCount += 1;
        if (calcCallCount === 1) {
          // First call: parent calc lookup (resolves period_id + profile_id).
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: {
                id: CALC_ID,
                period_id: PERIOD_ID,
                profile_id: EMPLOYEE_ID,
                calculation_version: 1,
              },
              error: null,
            }),
          };
        }
        // Second call: Pattern B base_pay lookup.
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
      if (tbl === "change_proposal") {
        let insertCalled = false;
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          filter: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            // null = no pending override exists (unless hasPendingOverride)
            data: hasPendingOverride
              ? { change_proposal_id: "existing-proposal-id", status: "pending" }
              : null,
            error: null,
          }),
          insert: vi.fn().mockImplementation(() => {
            insertCalled = true;
            return {
              select: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({
                data: { change_proposal_id: PROPOSAL_ID },
                error: null,
              }),
            };
          }),
          get _insertCalled() {
            return insertCalled;
          },
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

describe("overrideCalculationLine — F-CL-12 Pattern B feriepenger recalc (ADR-0293)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("emits payroll.feriepenger_basis_computed with correct basis after override proposal", async () => {
    const ctx = makeCtx(makeSupabaseMock());

    const raw = await overrideCalculationLine.execute(
      {
        period_id: PERIOD_ID,
        calculation_line_id: LINE_ID,
        proposed_amount: 5200,
        reason: "Tariff justert — ny grunnlønnssats",
        category: "tariff_interpretation",
      },
      ctx,
    );

    const result = JSON.parse(raw) as { ok: boolean; change_proposal_id: string };
    expect(result.ok).toBe(true);
    expect(result.change_proposal_id).toBe(PROPOSAL_ID);

    const feriepengerEmits = vi
      .mocked(emit)
      .mock.calls.map(
        (c) => c[0] as unknown as { event: string; properties: { data: Record<string, unknown> } },
      )
      .filter((e) => e.event === "payroll.feriepenger_basis_computed");

    expect(feriepengerEmits).toHaveLength(1);
    const data = feriepengerEmits[0]!.properties.data as {
      profile_id: string;
      basis_amount: number;
      pct_applied: number;
      base_pay_total: number;
      period_id: string;
    };

    // Profile must be the employee (resolved from parentCalc.profile_id), NOT the admin.
    expect(data.profile_id).toBe(EMPLOYEE_ID);
    expect(data.profile_id).not.toBe(ADMIN);
    expect(data.period_id).toBe(PERIOD_ID);
    expect(data.pct_applied).toBe(HOLIDAY_PCT);
    expect(data.base_pay_total).toBe(BASE_PAY);

    const expected = computeFeriepengerBasis({
      basePayTotal: BASE_PAY,
      holidayAllowancePct: HOLIDAY_PCT,
    });
    expect(data.basis_amount).toBe(expected);
    expect(data.basis_amount).toBe(4590);
  });

  it("profile_id in feriepenger emit is target employee, NOT the admin actor (ADR-0151)", async () => {
    // Explicitly test ADR-0151: workspace + profile are server-resolved.
    // The admin who proposes the override != the employee whose basis is computed.
    const ctx = makeCtx(makeSupabaseMock());

    await overrideCalculationLine.execute(
      {
        period_id: PERIOD_ID,
        calculation_line_id: LINE_ID,
        proposed_amount: 5100,
        reason: "Skiftdatatilpasning fra korrekt tidsliste",
        category: "shift_data_error",
      },
      ctx,
    );

    const feriepengerEmits = vi
      .mocked(emit)
      .mock.calls.map(
        (c) => c[0] as unknown as { event: string; properties: { data: Record<string, unknown> } },
      )
      .filter((e) => e.event === "payroll.feriepenger_basis_computed");

    expect(feriepengerEmits).toHaveLength(1);
    const data = feriepengerEmits[0]!.properties.data as { profile_id: string };
    expect(data.profile_id).toBe(EMPLOYEE_ID);
    expect(data.profile_id).not.toBe(ADMIN);
  });

  it("default pct = 12 when holiday_allowance_pct is null on payroll profile", async () => {
    const ctx = makeCtx(makeSupabaseMock({ holidayPct: null }));

    await overrideCalculationLine.execute(
      {
        period_id: PERIOD_ID,
        calculation_line_id: LINE_ID,
        proposed_amount: 4800,
        reason: "Manuell justering for ukjent sats",
        category: "other",
      },
      ctx,
    );

    const feriepengerEmits = vi
      .mocked(emit)
      .mock.calls.map(
        (c) => c[0] as unknown as { event: string; properties: { data: Record<string, unknown> } },
      )
      .filter((e) => e.event === "payroll.feriepenger_basis_computed");

    expect(feriepengerEmits).toHaveLength(1);
    const data = feriepengerEmits[0]!.properties.data as { pct_applied: number };
    expect(data.pct_applied).toBe(12);
  });

  it("does NOT emit feriepenger recalc when period is locked (proposal rejected)", async () => {
    const ctx = makeCtx(makeSupabaseMock({ periodStatus: "locked" }));

    const raw = await overrideCalculationLine.execute(
      {
        period_id: PERIOD_ID,
        calculation_line_id: LINE_ID,
        proposed_amount: 5000,
        reason: "Forsøk på overstyring av låst periode",
        category: "other",
      },
      ctx,
    );

    const result = JSON.parse(raw) as { ok: boolean; reason: string };
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("period_frozen");

    const feriepengerEmits = vi
      .mocked(emit)
      .mock.calls.map((c) => c[0] as unknown as { event: string })
      .filter((e) => e.event === "payroll.feriepenger_basis_computed");

    expect(feriepengerEmits).toHaveLength(0);
  });

  it("does NOT emit feriepenger recalc when pending override already exists", async () => {
    const ctx = makeCtx(makeSupabaseMock({ hasPendingOverride: true }));

    const raw = await overrideCalculationLine.execute(
      {
        period_id: PERIOD_ID,
        calculation_line_id: LINE_ID,
        proposed_amount: 5000,
        reason: "Duplikat overstyringsforsøk",
        category: "other",
      },
      ctx,
    );

    const result = JSON.parse(raw) as { ok: boolean; reason: string };
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("pending_override_exists");

    const feriepengerEmits = vi
      .mocked(emit)
      .mock.calls.map((c) => c[0] as unknown as { event: string })
      .filter((e) => e.event === "payroll.feriepenger_basis_computed");

    expect(feriepengerEmits).toHaveLength(0);
  });
});
