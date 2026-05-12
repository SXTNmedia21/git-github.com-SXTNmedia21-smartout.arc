import { describe, it, expect } from "vitest";
import { aggregatePeriod } from "../src/aggregate-period.js";
import type {
  SnapshottedShiftCost,
  ManualSupplementInput,
  TipDistributionInput,
} from "../src/types.js";
import { nokToOre, oreToNok } from "../src/cents.js";

function makeSnapshot(
  profileId: string,
  shiftId: string,
  baseOre: bigint,
  suppOre: bigint,
): SnapshottedShiftCost {
  return {
    shift_id: shiftId,
    profile_id: profileId,
    workspace_id: "ws-test",
    tariff_rate_snapshot: [],
    base_pay_ore: baseOre,
    total_supplements_ore: suppOre,
    total_ore: baseOre + suppOre,
    lines: [
      {
        pay_code: "base_hourly",
        description: "Base",
        hours: 8,
        rate_nok: 200,
        amount_ore: baseOre,
        supplement_rule_id: null,
        provenance: {},
      },
      ...(suppOre > 0n
        ? [
            {
              pay_code: "normal-rule-001",
              description: "Tillegg",
              hours: 2,
              rate_nok: 42.41,
              amount_ore: suppOre,
              supplement_rule_id: "rule-001",
              provenance: {},
            },
          ]
        : []),
    ],
  };
}

describe("aggregatePeriod", () => {
  it("aggregates single profile correctly", () => {
    const snapshots = [
      makeSnapshot("prof-001", "sh-001", 100000n, 5000n),
      makeSnapshot("prof-001", "sh-002", 90000n, 4000n),
    ];
    const result = aggregatePeriod(snapshots, [], [], "period-001");
    expect(result.length).toBe(1);
    expect(result[0]!.gross_amount_ore).toBe(199000n); // (100000+5000) + (90000+4000)
    expect(result[0]!.total_ore).toBe(199000n);
    expect(result[0]!.shift_ids).toEqual(["sh-001", "sh-002"]);
  });

  it("aggregates two profiles separately", () => {
    const snapshots = [
      makeSnapshot("prof-001", "sh-001", 100000n, 0n),
      makeSnapshot("prof-002", "sh-002", 80000n, 0n),
    ];
    const result = aggregatePeriod(snapshots, [], [], "period-001");
    expect(result.length).toBe(2);
    const p1 = result.find((r) => r.profile_id === "prof-001");
    const p2 = result.find((r) => r.profile_id === "prof-002");
    expect(p1!.gross_amount_ore).toBe(100000n);
    expect(p2!.gross_amount_ore).toBe(80000n);
  });

  it("adds manual supplements to total", () => {
    const snapshots = [makeSnapshot("prof-001", "sh-001", 100000n, 0n)];
    const manuals: ManualSupplementInput[] = [
      {
        id: "ms-001",
        schedule_shift_id: "sh-001",
        profile_id: "prof-001",
        workspace_id: "ws-test",
        amount: 150.0,
        salary_code: "drikkepenger",
        description: "Tips",
        supplement_rule_id: null,
      },
    ];
    const result = aggregatePeriod(snapshots, manuals, [], "period-001");
    expect(result[0]!.manual_supplement_ore).toBe(nokToOre(150.0));
    expect(result[0]!.total_ore).toBe(100000n + nokToOre(150.0));
  });

  it("merges approved tip distributions correctly", () => {
    const snapshots = [makeSnapshot("prof-001", "sh-001", 100000n, 0n)];
    const tips: TipDistributionInput[] = [
      {
        id: "td-001",
        profile_id: "prof-001",
        workspace_id: "ws-test",
        pool_id: "pool-001",
        calculated_amount: 500.0,
        adjusted_amount: null,
        payroll_period_id: "period-001",
        status: "approved",
      },
    ];
    const result = aggregatePeriod(snapshots, [], tips, "period-001");
    expect(result[0]!.tips_amount_ore).toBe(nokToOre(500.0));
    expect(result[0]!.total_ore).toBe(100000n + nokToOre(500.0));
    const tipLine = result[0]!.lines.find((l) => l.pay_code === "tip_payout");
    expect(tipLine).toBeDefined();
  });

  it("uses adjusted_amount when present for tips", () => {
    const snapshots = [makeSnapshot("prof-001", "sh-001", 100000n, 0n)];
    const tips: TipDistributionInput[] = [
      {
        id: "td-001",
        profile_id: "prof-001",
        workspace_id: "ws-test",
        pool_id: "pool-001",
        calculated_amount: 500.0,
        adjusted_amount: 450.0,
        payroll_period_id: "period-001",
        status: "approved",
      },
    ];
    const result = aggregatePeriod(snapshots, [], tips, "period-001");
    expect(result[0]!.tips_amount_ore).toBe(nokToOre(450.0)); // uses adjusted
  });

  it("does NOT include pending tip distributions", () => {
    const snapshots = [makeSnapshot("prof-001", "sh-001", 100000n, 0n)];
    const tips: TipDistributionInput[] = [
      {
        id: "td-001",
        profile_id: "prof-001",
        workspace_id: "ws-test",
        pool_id: "pool-001",
        calculated_amount: 500.0,
        adjusted_amount: null,
        payroll_period_id: "period-001",
        status: "pending",
      },
    ];
    const result = aggregatePeriod(snapshots, [], tips, "period-001");
    expect(result[0]!.tips_amount_ore).toBe(0n);
  });

  it("applies monthly salary override", () => {
    const snapshots = [makeSnapshot("prof-001", "sh-001", 0n, 0n)]; // base=0 for monthly
    const monthlySalary = new Map([["prof-001", 450000n]]); // 4500.00 NOK
    const result = aggregatePeriod(snapshots, [], [], "period-001", monthlySalary);
    expect(result[0]!.gross_amount_ore).toBe(450000n);
  });
});
