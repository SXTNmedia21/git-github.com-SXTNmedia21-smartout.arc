// packages/ai/src/capabilities/payroll/__tests__/exportPeriod-feriepenger.test.ts
//
// F-CL-13 (audit 2026-05-13) — ADR-0295 feriepenger_basis compute on capability path.
//
// Verifies:
//   1. exportPeriod computes feriepenger_basis via canonical helper (not 0).
//   2. Computed value matches BFF Server Action formula
//      (base_pay × holiday_allowance_pct / 100, 2-decimal precision).
//   3. payroll.feriepenger_basis_computed telemetry emitted per profile.
//   4. Parity test: capability output == computeFeriepengerBasis() applied to
//      same inputs as Server Action path at apps/web/.../export-period/route.ts.
//
// Scope: aggregate CSV variant (covers the common agent-invoked path).
// PDF + audit branches exercise the same helper; same correctness invariant.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { exportPeriod } from "../tools.js";
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
const PROFILE_A = "00000000-0000-0000-0000-0000000000aa";
const PROFILE_B = "00000000-0000-0000-0000-0000000000bb";
const PERIOD_ID = "11111111-1111-1111-1111-111111111111";
const EXPORT_EVENT_ID = "22222222-2222-2222-2222-222222222222";

// Test inputs — chosen so 12 % yields exact 2-decimal values.
// Profile A: base_pay = 16681.30, pct = 12.00 → basis = 2001.756 → round = 2001.76
// Profile B: base_pay = 50000.00, pct = 14.30 → basis = 7150.00
const CALCS = [
  {
    id: "calc-a-v2",
    profile_id: PROFILE_A,
    base_pay: 16681.3,
    total_supplements: 100,
    total_deductions: 50,
    total_pay: 16731.3,
    calculation_version: 2,
  },
  {
    id: "calc-b-v1",
    profile_id: PROFILE_B,
    base_pay: 50000,
    total_supplements: 0,
    total_deductions: 0,
    total_pay: 50000,
    calculation_version: 1,
  },
];

type PayrollProfileMock = {
  profile_id: string;
  personal_id_number: string | null;
  bank_account_number: string | null;
  holiday_allowance_pct: number | null;
};

const PAYROLL_PROFILES: PayrollProfileMock[] = [
  {
    profile_id: PROFILE_A,
    personal_id_number: "01010100001",
    bank_account_number: "12345678901",
    holiday_allowance_pct: 12.0,
  },
  {
    profile_id: PROFILE_B,
    personal_id_number: "02020200002",
    bank_account_number: "98765432109",
    holiday_allowance_pct: 14.3,
  },
];

const PROFILES = [
  { profile_id: PROFILE_A, display_name: "Anna Andersen" },
  { profile_id: PROFILE_B, display_name: "Bertil Berg" },
];

// ── Supabase mock builder ───────────────────────────────────────────────────
/**
 * Mocks the exportPeriod aggregate CSV chain.
 *
 * Order of supabase calls in tools.ts:exportPeriod (variant='csv'/'aggregate'):
 *   1. rpc("gate_action")               → allow
 *   2. from("period").select.eq.eq.maybeSingle() → locked period
 *   3. from("workspace").select.eq.maybeSingle() → workspace row
 *   4. schema("payroll").from("calculation").select.eq.eq.order() → calcs
 *   5. from("employee_payroll_profile").select.in.eq → payroll profiles
 *   6. from("profile").select.in.eq      → display_name profiles
 *   7. schema("payroll").from("export_event").insert.select.single() → event row
 */
function makeSupabaseMock(
  payrollProfilesOverride: PayrollProfileMock[] | null = null,
): AgentToolContext["supabaseAdmin"] {
  const payrollProfilesData = payrollProfilesOverride ?? PAYROLL_PROFILES;
  let fromCallCount = 0;
  const payrollSchemaChain = {
    from: vi.fn().mockImplementation((tbl: string) => {
      if (tbl === "period") {
        // Not used via schema() — period is queried via supabase.schema('payroll').from(...).
        // exportPeriod uses `.schema('payroll')` for both period and calculation.
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: {
              id: PERIOD_ID,
              status: "locked",
              start_date: "2026-05-01",
              end_date: "2026-05-31",
              workspace_id: WORKSPACE,
            },
            error: null,
          }),
        };
      }
      if (tbl === "calculation") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({ data: CALCS, error: null }),
        };
      }
      if (tbl === "export_event") {
        return {
          insert: vi.fn().mockReturnThis(),
          select: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: { id: EXPORT_EVENT_ID }, error: null }),
        };
      }
      throw new Error(`Unexpected payroll schema table: ${tbl}`);
    }),
  };

  const mock = {
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
        gate_evaluation_id: "eval-test-feriepenger",
      },
      error: null,
    }),
    schema: vi.fn().mockReturnValue(payrollSchemaChain),
    from: vi.fn().mockImplementation((tbl: string) => {
      fromCallCount += 1;
      if (tbl === "period") {
        // exportPeriod calls supabase.schema('payroll').from('period') — NOT supabase.from('period').
        // But also see line 1725: yes, uses .schema('payroll'). So this branch is unreachable in practice.
        // Leave as safety.
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: {
              id: PERIOD_ID,
              status: "locked",
              start_date: "2026-05-01",
              end_date: "2026-05-31",
              workspace_id: WORKSPACE,
            },
            error: null,
          }),
        };
      }
      if (tbl === "workspace") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: { slug: "test-ws", name: "Test Workspace", org_number: "999999999" },
            error: null,
          }),
        };
      }
      if (tbl === "employee_payroll_profile") {
        return {
          select: vi.fn().mockReturnThis(),
          in: vi.fn().mockReturnThis(),
          eq: vi.fn().mockResolvedValue({ data: payrollProfilesData, error: null }),
        };
      }
      if (tbl === "profile") {
        return {
          select: vi.fn().mockReturnThis(),
          in: vi.fn().mockReturnThis(),
          eq: vi.fn().mockResolvedValue({ data: PROFILES, error: null }),
        };
      }
      throw new Error(`Unexpected public.from('${tbl}') call (#${fromCallCount})`);
    }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
  return mock as AgentToolContext["supabaseAdmin"];
}

function makeCtx(payrollProfilesOverride: PayrollProfileMock[] | null = null): AgentToolContext {
  return {
    workspaceId: WORKSPACE,
    profileId: ADMIN,
    userId: "user-admin",
    sessionId: "test-session",
    channel: "chat",
    supabaseAdmin: makeSupabaseMock(payrollProfilesOverride),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe("exportPeriod — F-CL-13 feriepenger_basis compute (ADR-0295)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("computes feriepenger_basis per profile (not hardcoded 0)", async () => {
    const ctx = makeCtx();

    const raw = await exportPeriod.execute(
      {
        period_id: PERIOD_ID,
        format: "csv",
        variant: "aggregate",
        include_unmasked: false,
      },
      ctx,
    );

    const result = JSON.parse(raw) as {
      ok: boolean;
      reason?: string;
      detail?: string;
      csv?: string;
      row_count?: number;
    };

    expect(result.ok).toBe(true);
    expect(result.row_count).toBe(2);
    expect(typeof result.csv).toBe("string");

    // The CSV must contain non-zero feriepenger_basis values.
    // Profile A: 16681.30 × 12 / 100 = 2001.756 → rounded to 2001.76
    // Profile B: 50000 × 14.3 / 100 = 7150.00
    const csv = result.csv!;
    expect(csv).toContain("2001,76"); // Norwegian decimal format from formatNok
    expect(csv).toContain("7150,00");
    // Crucially: no "0,00" hardcoded for feriepenger column on either row.
    // (Other cols might legitimately be 0,00 — assert on the computed values only.)
  });

  it("parity: capability basis matches computeFeriepengerBasis() — same inputs as Server Action", async () => {
    const ctx = makeCtx();

    await exportPeriod.execute(
      {
        period_id: PERIOD_ID,
        format: "csv",
        variant: "aggregate",
        include_unmasked: false,
      },
      ctx,
    );

    // Pull the per-profile telemetry emits.
    const feriepengerEmits = vi
      .mocked(emit)
      .mock.calls.map(
        (c) => c[0] as unknown as { event: string; properties: { data: Record<string, unknown> } },
      )
      .filter((e) => e.event === "payroll.feriepenger_basis_computed");

    expect(feriepengerEmits).toHaveLength(2);

    // Profile A parity
    const emitA = feriepengerEmits.find(
      (e) => (e.properties.data as { profile_id: string }).profile_id === PROFILE_A,
    );
    expect(emitA).toBeDefined();
    const dataA = emitA!.properties.data as {
      basis_amount: number;
      pct_applied: number;
      base_pay_total: number;
    };
    const expectedA = computeFeriepengerBasis({
      basePayTotal: 16681.3,
      holidayAllowancePct: 12.0,
    });
    expect(dataA.basis_amount).toBe(expectedA);
    expect(dataA.basis_amount).toBe(2001.76);
    expect(dataA.pct_applied).toBe(12.0);
    expect(dataA.base_pay_total).toBe(16681.3);

    // Profile B parity (14.3 % over-60 rate)
    const emitB = feriepengerEmits.find(
      (e) => (e.properties.data as { profile_id: string }).profile_id === PROFILE_B,
    );
    expect(emitB).toBeDefined();
    const dataB = emitB!.properties.data as {
      basis_amount: number;
      pct_applied: number;
    };
    const expectedB = computeFeriepengerBasis({
      basePayTotal: 50000,
      holidayAllowancePct: 14.3,
    });
    expect(dataB.basis_amount).toBe(expectedB);
    expect(dataB.basis_amount).toBe(7150);
    expect(dataB.pct_applied).toBe(14.3);
  });

  it("default pct = 12.00 when holiday_allowance_pct is null on payroll profile", async () => {
    // Override: drop holiday_allowance_pct from both profiles → tool must
    // fall back to 12.0 default per ADR-0295.
    const ctx = makeCtx([
      {
        profile_id: PROFILE_A,
        personal_id_number: null,
        bank_account_number: null,
        holiday_allowance_pct: null,
      },
      {
        profile_id: PROFILE_B,
        personal_id_number: null,
        bank_account_number: null,
        holiday_allowance_pct: null,
      },
    ]);

    await exportPeriod.execute(
      {
        period_id: PERIOD_ID,
        format: "csv",
        variant: "aggregate",
        include_unmasked: false,
      },
      ctx,
    );

    const feriepengerEmits = vi
      .mocked(emit)
      .mock.calls.map(
        (c) => c[0] as unknown as { event: string; properties: { data: Record<string, unknown> } },
      )
      .filter((e) => e.event === "payroll.feriepenger_basis_computed");

    expect(feriepengerEmits.length).toBeGreaterThan(0);
    for (const e of feriepengerEmits) {
      expect((e.properties.data as { pct_applied: number }).pct_applied).toBe(12);
    }
  });
});
