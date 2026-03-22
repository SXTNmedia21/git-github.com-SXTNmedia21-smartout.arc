/**
 * Trust label determination for payroll figures.
 *
 * Determines confidence level (estimate/recorded/settled) for displaying
 * earnings based on data source and shift phase.
 *
 * Trust tiers:
 * - estimate: preliminary calculation, shown with "~" prefix, requires disclaimer
 * - recorded: verified time entry data, no prefix
 * - settled: canonical payroll source (payslip, ledger), no prefix
 */

export type TrustTier = "estimate" | "recorded" | "settled";
export type DataSource =
  | "calculated"
  | "time_entry"
  | "payroll_period"
  | "absence_quota"
  | "timebank_entry";
export type ShiftPhase = "no_shift" | "before_shift" | "during_shift" | "after_shift";

export type TrustLabelInput = {
  phase: ShiftPhase;
  dataSource: DataSource;
};

export type TrustLabelResult = {
  tier: TrustTier;
  label: string; // Norwegian display label
  prefix: string; // "~" for estimates, "" otherwise
  showDisclaimer: boolean;
};

/**
 * Determine trust tier, label, prefix, and disclaimer flag for a monetary figure.
 *
 * Resolution rules:
 * 1. payroll_period or absence_quota → always settled (canonical DB sources)
 * 2. timebank_entry → always settled (append-only ledger)
 * 3. time_entry → always recorded (actual punched hours)
 * 4. calculated with before_shift or during_shift → estimate
 * 5. calculated with after_shift → recorded (derived from time_entry data)
 * 6. default (calculated with no_shift) → estimate
 */
export function getTrustLabel(input: TrustLabelInput): TrustLabelResult {
  const { phase, dataSource } = input;

  // Rule 1: payroll_period or absence_quota → always settled
  if (dataSource === "payroll_period" || dataSource === "absence_quota") {
    return {
      tier: "settled",
      label: "Avregnet i lønn",
      prefix: "",
      showDisclaimer: false,
    };
  }

  // Rule 2: timebank_entry → always settled
  if (dataSource === "timebank_entry") {
    return {
      tier: "settled",
      label: "Avregnet i lønn",
      prefix: "",
      showDisclaimer: false,
    };
  }

  // Rule 3: time_entry → always recorded
  if (dataSource === "time_entry") {
    return {
      tier: "recorded",
      label: "Registrert tid",
      prefix: "",
      showDisclaimer: false,
    };
  }

  // Rules 4-6: calculated source depends on phase
  if (dataSource === "calculated") {
    // Rule 5: calculated with after_shift → recorded
    if (phase === "after_shift") {
      return {
        tier: "recorded",
        label: "Registrert tid",
        prefix: "",
        showDisclaimer: false,
      };
    }

    // Rule 4: calculated with before_shift or during_shift → estimate
    if (phase === "before_shift" || phase === "during_shift") {
      return {
        tier: "estimate",
        label: "Foreløpig estimat",
        prefix: "~",
        showDisclaimer: true,
      };
    }

    // Rule 6: default (calculated with no_shift) → estimate
    return {
      tier: "estimate",
      label: "Foreløpig estimat",
      prefix: "~",
      showDisclaimer: true,
    };
  }

  // Fallback (should not reach here with valid types, but defensive)
  return {
    tier: "estimate",
    label: "Foreløpig estimat",
    prefix: "~",
    showDisclaimer: true,
  };
}
