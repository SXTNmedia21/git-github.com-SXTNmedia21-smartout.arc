// ============================================
// types.ts
// Shared types for the validation system.
// Defines the common result shape used by all validation rules.
// Connected to: all validation/*.ts files
// ============================================

/**
 * Severity levels for validation results.
 * "fail" blocks the pipeline (non-zero exit).
 * "warn" is informational unless --strict is used.
 */
export type Severity = "fail" | "warn";

/**
 * A single validation finding.
 */
export type ValidationResult = {
  /** Which rule produced this result */
  rule: string;
  /** Severity level */
  severity: Severity;
  /** File path relative to project root */
  file: string;
  /** Human-readable description of the issue */
  message: string;
};
