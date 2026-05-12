// packages/ai/src/capabilities/payroll/__tests__/salary-query.test.ts
//
// SMA-344 S2a — regression tests for salary_query after rate-column schema fix.
// Verifies:
//   1. Queries employee_payroll_profile (not a phantom table)
//   2. SELECT includes all 4 new rate columns (hourly_rate, monthly_salary,
//      remuneration_type, currency)
//   3. Returns ok:true with rate data from the real schema
//
// Per L-0230 pattern: mock-spy column-arg assertion ensures SELECT string
// correctness without a live DB.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { salaryQuery } from "../tools.js";
import type { AgentToolContext } from "../../types.js";
import type { NonEmptyString } from "@smartout/telemetry/server";

// Suppress real telemetry
vi.mock("@smartout/telemetry", () => ({
  emit: vi.fn().mockResolvedValue(undefined),
  nonEmpty: (v: string) => v,
}));

// ─── Fixture UUIDs ────────────────────────────────────────────────────────────

const WORKSPACE_A = "aaaaaaaa-0000-0000-0000-000000000001" as NonEmptyString;
const ADMIN_PROFILE = "00000000-0000-0000-0000-000000000010" as NonEmptyString;
const TARGET_PROFILE = "00000000-0000-0000-0000-000000000020";

// ─── Mock helpers ─────────────────────────────────────────────────────────────

function allowGate() {
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
      gate_evaluation_id: "eval-test-01",
    },
    error: null,
  };
}

function makeCtx(supabaseAdmin: AgentToolContext["supabaseAdmin"]): AgentToolContext {
  return {
    workspaceId: WORKSPACE_A,
    profileId: ADMIN_PROFILE,
    userId: "user-admin",
    sessionId: "test-session",
    channel: "chat",
    supabaseAdmin,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("salary_query — SMA-344 schema fix", () => {
  let fromSpy: ReturnType<typeof vi.fn>;
  let selectSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();

    // Track the SELECT argument so we can assert rate columns are included
    selectSpy = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: {
              hourly_rate: 280.0,
              monthly_salary: null,
              remuneration_type: "hourly",
              currency: "NOK",
            },
            error: null,
          }),
        }),
      }),
    });

    fromSpy = vi.fn().mockImplementation((table: string) => {
      if (table === "employee_payroll_profile") {
        return { select: selectSpy };
      }
      // shift_cost_snapshot and framework_rule queries return empty results
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              gte: vi.fn().mockReturnValue({
                lte: vi.fn().mockReturnValue({
                  order: vi.fn().mockReturnValue({
                    limit: vi.fn().mockResolvedValue({ data: [], error: null }),
                  }),
                }),
              }),
            }),
          }),
        }),
      };
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rpcMock: any = vi.fn().mockResolvedValue(allowGate());

    // Attach from to rpcMock so it acts as the full supabase client
    rpcMock.from = fromSpy;

    // Reassign for test use
    selectSpy = selectSpy;
    fromSpy = fromSpy;
    Object.assign(fromSpy, { rpc: rpcMock });
  });

  it("queries employee_payroll_profile (not a phantom table)", async () => {
    const supabaseMock = {
      rpc: vi.fn().mockResolvedValue(allowGate()),
      from: fromSpy,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;

    await salaryQuery.execute({ profile_id: TARGET_PROFILE }, makeCtx(supabaseMock));

    expect(fromSpy).toHaveBeenCalledWith("employee_payroll_profile");
  });

  it("SELECT includes all 4 rate columns added in 20260601000000", async () => {
    const supabaseMock = {
      rpc: vi.fn().mockResolvedValue(allowGate()),
      from: fromSpy,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;

    await salaryQuery.execute({ profile_id: TARGET_PROFILE }, makeCtx(supabaseMock));

    // selectSpy was called on employee_payroll_profile — check columns present
    expect(selectSpy).toHaveBeenCalled();
    const selectArg: string = (selectSpy.mock.calls[0] as [string])[0];
    expect(selectArg).toContain("hourly_rate");
    expect(selectArg).toContain("monthly_salary");
    expect(selectArg).toContain("remuneration_type");
    expect(selectArg).toContain("currency");
  });

  it("returns ok:true with hourly_rate from payroll profile", async () => {
    const supabaseMock = {
      rpc: vi.fn().mockResolvedValue(allowGate()),
      from: fromSpy,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;

    const resultStr = await salaryQuery.execute(
      { profile_id: TARGET_PROFILE },
      makeCtx(supabaseMock),
    );

    const result = JSON.parse(resultStr);
    expect(result.ok).toBe(true);
    expect(result.hourly_rate).toBe(280.0);
  });
});
