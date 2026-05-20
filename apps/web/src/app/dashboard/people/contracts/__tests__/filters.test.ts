import { describe, it, expect } from "vitest";
import {
  getContractBucket,
  groupByBucket,
  type ContractStatus,
  type DashboardBucket,
} from "../filters";

describe("getContractBucket", () => {
  const cases: [ContractStatus, DashboardBucket][] = [
    ["sent", "waiting_employee"],
    ["viewed", "waiting_employee"],
    ["pending_data", "waiting_employee"],
    ["draft", "ready_for_action"],
    ["declined", "ready_for_action"],
    ["expired", "ready_for_action"],
    ["signed", "completed"],
    ["cancelled", "completed"],
  ];

  it.each(cases)("maps %s → %s", (status, expected) => {
    expect(getContractBucket(status)).toBe(expected);
  });
});

describe("groupByBucket", () => {
  it("groups mixed statuses into correct buckets", () => {
    const contracts = [
      { id: "1", status: "draft" as ContractStatus },
      { id: "2", status: "sent" as ContractStatus },
      { id: "3", status: "signed" as ContractStatus },
      { id: "4", status: "declined" as ContractStatus },
      { id: "5", status: "pending_data" as ContractStatus },
    ];

    const result = groupByBucket(contracts);

    expect(result.waiting_employee).toHaveLength(2);
    expect(result.waiting_employee.map((c) => c.id)).toEqual(["2", "5"]);

    expect(result.ready_for_action).toHaveLength(2);
    expect(result.ready_for_action.map((c) => c.id)).toEqual(["1", "4"]);

    expect(result.completed).toHaveLength(1);
    expect(result.completed.map((c) => c.id)).toEqual(["3"]);
  });

  it("returns empty arrays for missing buckets", () => {
    const result = groupByBucket([]);

    expect(result.waiting_employee).toEqual([]);
    expect(result.ready_for_action).toEqual([]);
    expect(result.completed).toEqual([]);
  });
});
