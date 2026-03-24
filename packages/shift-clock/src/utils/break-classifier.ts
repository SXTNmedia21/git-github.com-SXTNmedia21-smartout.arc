/**
 * break-classifier.ts — Determines whether a break is paid or unpaid.
 * Evaluates workspace break rules against minutes worked so far.
 * Paid rules take priority over unpaid rules when both match.
 */

import type { BreakClassification } from "../types";

export type BreakRule = {
  id: string;
  name: string;
  triggerType: "after_duration" | "time_of_day";
  triggerMinutes: number;
  durationMinutes: number;
  isPaid: boolean;
};

export function classifyBreak(workMinutes: number, rules: BreakRule[]): BreakClassification {
  // Paid rules take priority — check if any paid rule's threshold has been reached.
  const matchingPaid = rules.find(
    (r) => r.isPaid && r.triggerType === "after_duration" && workMinutes >= r.triggerMinutes,
  );
  if (matchingPaid) {
    return { isPaid: true, ruleId: matchingPaid.id, ruleName: matchingPaid.name };
  }

  // Fall back to the first unpaid rule whose threshold has been reached.
  const matchingUnpaid = rules.find(
    (r) => !r.isPaid && r.triggerType === "after_duration" && workMinutes >= r.triggerMinutes,
  );
  if (matchingUnpaid) {
    return { isPaid: false, ruleId: matchingUnpaid.id, ruleName: matchingUnpaid.name };
  }

  // No rule matched — break is unpaid with no associated rule.
  return { isPaid: false, ruleId: null, ruleName: null };
}
