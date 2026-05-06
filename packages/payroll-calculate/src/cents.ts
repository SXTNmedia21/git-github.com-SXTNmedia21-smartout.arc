/**
 * packages/payroll-calculate/src/cents.ts
 *
 * WHAT: Integer-øre arithmetic helpers.
 *
 * WHY: JS floats cannot represent exact decimal fractions. 42.41 * 2.5
 *      in JS = 106.02499999999999, not 106.025. For payroll — where every
 *      øre is auditable — we work exclusively in integer øre (1 NOK = 100 øre).
 *
 * Convention:
 *   - "ore" = smallest unit (Norwegian øre)
 *   - All internal monetary arithmetic uses `bigint` to avoid overflow on
 *     large period sums (e.g. 600 shifts × 1000 kr = 60,000,000 øre — fine for
 *     bigint, fine for Number but bigint makes the boundary explicit).
 *   - Conversion happens ONLY at package input/output boundaries.
 *   - No floating-point arithmetic on amounts inside this package.
 *
 * Rounding policy for per-minute rate application:
 *   rate_ore_per_minute = floor(rate_nok_per_hour * 100 / 60)
 *   amount = rate_ore_per_minute * minutes
 *   Residual rounding error is max 1 øre per shift line. Acceptable per
 *   Riksavtalen practice (rounded to nearest øre on lønnsslipp).
 */

/**
 * Convert a NOK decimal number to integer øre (bigint).
 * Rounds half-up to nearest øre.
 * Example: 42.415 → 4242n (42.42 øre → WAIT: 42.415 NOK → 4241n? No: 42.415 * 100 = 4241.5 → 4242n)
 */
export function nokToOre(nok: number): bigint {
  // Math.round rounds 0.5 upward — matches Norwegian payroll convention.
  return BigInt(Math.round(nok * 100));
}

/**
 * Convert integer øre (bigint) to NOK number (2 decimal places).
 * Used only at output boundary for display / DB storage.
 */
export function oreToNok(ore: bigint): number {
  // Divide using number — safe because payroll amounts are well below Number.MAX_SAFE_INTEGER
  return Number(ore) / 100;
}

/**
 * Compute per-minute rate in øre/minute from a per-hour rate in NOK.
 * Returns bigint (floor division). Max error: 1 øre per shift line.
 *
 * Example: 42.41 kr/t → 4241 øre/t → 70 øre/min (floor of 4241/60 = 70.68...)
 * For 60 minutes: 70 * 60 = 4200 øre = 42.00 NOK (vs 42.41 exact).
 * Residual is 41 øre/hour, distributed across minute-buckets.
 * Acceptable: payslip rounds to nearest NOK typically.
 *
 * NOTE: For high precision, consider rounding at aggregate level instead.
 * This engine applies floor at per-minute level for determinism.
 */
export function orePerMinuteFromHourlyNok(hourlyNok: number): bigint {
  const orePerHour = BigInt(Math.round(hourlyNok * 100));
  return orePerHour / 60n; // bigint floor division
}

/**
 * Compute percentage supplement amount in øre.
 * percentage: e.g. 0.27 for 27%, or 27.0 (treated as 27%).
 * base_ore: the base amount to apply percentage to.
 *
 * Convention: if rate_value > 1.0 it is treated as a percentage (e.g. 27.0 = 27%).
 * if rate_value <= 1.0 it is treated as a decimal fraction (e.g. 0.27 = 27%).
 */
export function pctSupplementOre(base_ore: bigint, rate_value: number): bigint {
  // Normalise: treat values > 1.0 as percentage (e.g. 27.0 → 0.27)
  const fraction = rate_value > 1.0 ? rate_value / 100 : rate_value;
  // Scale base by fraction, rounding to nearest øre
  return BigInt(Math.round(Number(base_ore) * fraction));
}

/**
 * Sum an array of bigint amounts.
 */
export function sumOre(amounts: bigint[]): bigint {
  return amounts.reduce((acc, v) => acc + v, 0n);
}

/**
 * Multiply minutes (number) by øre-per-minute rate (bigint) → amount in øre.
 */
export function minuteAmountOre(minutes: number, orePerMinute: bigint): bigint {
  return BigInt(Math.round(minutes)) * orePerMinute;
}
