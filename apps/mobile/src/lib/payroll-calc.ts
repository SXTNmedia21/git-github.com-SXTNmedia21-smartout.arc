/**
 * Pure function for shift earnings calculation.
 *
 * Calculates base pay (hourly rate × worked hours) plus supplements.
 * Two supplement types:
 * - fixed_per_hour: amount = hours × rate (e.g., evening premium kr/hour)
 * - percentage: amount = hourlyRate × hours × (rate / 100) (e.g., 100% bonus)
 *
 * No DB, no async, no side effects. Numbers only.
 */

export type SupplementEarning = {
  type: string;
  hours: number;
  rate: number;
  rateType: "fixed_per_hour" | "percentage";
};

export type EarningsInput = {
  hourlyRate: number;
  workedMinutes: number;
  supplements: SupplementEarning[];
};

export type EarningsResult = {
  basePay: number;
  supplementPay: number;
  total: number;
  supplementDetails: { type: string; amount: number }[];
};

export function calculateShiftEarnings(input: EarningsInput): EarningsResult {
  const { hourlyRate, workedMinutes, supplements } = input;

  // Base pay: hourly rate × hours worked
  const basePay = hourlyRate * (workedMinutes / 60);

  // Calculate each supplement
  const supplementDetails: { type: string; amount: number }[] = [];
  let supplementPay = 0;

  for (const supplement of supplements) {
    let amount = 0;

    if (supplement.rateType === "fixed_per_hour") {
      // Fixed amount per hour of supplement
      amount = supplement.hours * supplement.rate;
    } else if (supplement.rateType === "percentage") {
      // Percentage of hourly rate
      amount = hourlyRate * supplement.hours * (supplement.rate / 100);
    }

    supplementDetails.push({
      type: supplement.type,
      amount,
    });

    supplementPay += amount;
  }

  const total = basePay + supplementPay;

  return {
    basePay,
    supplementPay,
    total,
    supplementDetails,
  };
}
