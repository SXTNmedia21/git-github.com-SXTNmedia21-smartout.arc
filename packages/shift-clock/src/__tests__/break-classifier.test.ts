import { describe, it, expect } from "vitest";
import { classifyBreak } from "../utils/break-classifier";

const paidRule = {
  id: "rule-1",
  name: "Betalt pause",
  triggerType: "after_duration" as const,
  triggerMinutes: 330,
  durationMinutes: 30,
  isPaid: true,
};
const unpaidRule = {
  id: "rule-2",
  name: "Ubetalt pause",
  triggerType: "after_duration" as const,
  triggerMinutes: 0,
  durationMinutes: 30,
  isPaid: false,
};

describe("classifyBreak", () => {
  it("returns paid when work minutes exceed trigger threshold", () => {
    const result = classifyBreak(360, [paidRule, unpaidRule]);
    expect(result.isPaid).toBe(true);
    expect(result.ruleId).toBe("rule-1");
  });

  it("returns unpaid when work minutes below threshold", () => {
    const result = classifyBreak(120, [paidRule, unpaidRule]);
    expect(result.isPaid).toBe(false);
    expect(result.ruleId).toBe("rule-2");
  });

  it("returns unpaid with no rule when no rules match", () => {
    const result = classifyBreak(120, [paidRule]);
    expect(result.isPaid).toBe(false);
    expect(result.ruleId).toBeNull();
  });

  it("returns unpaid with no rule when rules array is empty", () => {
    const result = classifyBreak(360, []);
    expect(result.isPaid).toBe(false);
    expect(result.ruleId).toBeNull();
  });
});
