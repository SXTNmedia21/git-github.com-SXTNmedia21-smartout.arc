// packages/ai/src/capabilities/tips/calculate.ts
// Pure tip distribution function — no side effects, no DB writes.
// Sum invariant: sum(amounts) === amount_nok (rounding remainder assigned to
// the highest-points employee to preserve the exact total).
//
// Binding ADRs: none (pure utility). Referenced by tips capability tools.

export type Shift = {
  profile_id: string;
  role: string;
  hours_worked: number;
};

export type Policy =
  | { method: "equal" }
  | { method: "by_hours" }
  | { method: "by_role"; weights: Record<string, number> };

export type Distribution = {
  profile_id: string;
  role: string;
  hours_worked: number;
  /** Effective weight used in the allocation (1.0 for equal/by_hours baseline). */
  weight_applied: number;
  /** Final amount in NOK, rounded to 2dp. Satisfies sum = amount_nok. */
  calculated_amount: number;
  /** Snapshot for audit — persisted alongside the distribution row. */
  algorithm_snapshot: {
    method: "equal" | "by_hours" | "by_role";
    weights: Record<string, number> | null;
    total_points: number;
  };
};

/**
 * Distribute `amountNok` across `shifts` according to `policy`.
 *
 * Returns [] when:
 *   - shifts is empty
 *   - total weighted points are zero (e.g. all hours_worked = 0 with by_hours)
 *
 * Sum invariant: sum(result[].calculated_amount) === amountNok (within float
 * precision at 2dp). Rounding remainder is assigned to the highest-points
 * employee.
 */
export function calculate(amountNok: number, shifts: Shift[], policy: Policy): Distribution[] {
  if (shifts.length === 0) return [];

  const weighted = shifts.map((s) => {
    let weight: number;
    if (policy.method === "equal") {
      weight = 1;
    } else if (policy.method === "by_hours") {
      weight = 1;
    } else {
      // by_role: unknown roles default to 1.0 (ADR-friendly; avoids zero-out)
      weight = policy.weights[s.role] ?? 1.0;
    }

    const points = policy.method === "equal" ? 1 : s.hours_worked * weight;
    return { ...s, weight_applied: weight, points };
  });

  const totalPoints = weighted.reduce((sum, w) => sum + w.points, 0);
  if (totalPoints === 0) return [];

  const snapshot = {
    method: policy.method,
    weights:
      policy.method === "by_role"
        ? (policy as { method: "by_role"; weights: Record<string, number> }).weights
        : null,
    total_points: totalPoints,
  };

  // Calculate raw amounts (2dp rounded)
  const raw = weighted.map((w) => ({
    ...w,
    calculated_amount: Math.round(((amountNok * w.points) / totalPoints) * 100) / 100,
  }));

  // Apply remainder to highest-points employee to preserve sum invariant
  const allocated = raw.reduce((s, r) => s + r.calculated_amount, 0);
  const remainder = Math.round((amountNok - allocated) * 100) / 100;
  if (remainder !== 0) {
    const top = raw.reduce((a, b) => (b.points > a.points ? b : a));
    top.calculated_amount = Math.round((top.calculated_amount + remainder) * 100) / 100;
  }

  return raw.map((r) => ({
    profile_id: r.profile_id,
    role: r.role,
    hours_worked: r.hours_worked,
    weight_applied: r.weight_applied,
    calculated_amount: r.calculated_amount,
    algorithm_snapshot: snapshot,
  }));
}
