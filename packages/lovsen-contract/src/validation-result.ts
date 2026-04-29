/**
 * validation-result.ts — Aml. §14-6 validation output shape (ADR-0242)
 *
 * Derived from SKILL.AML.md §Output. ValidationResult is the canonical
 * output of the `aml-14-6-validator` skill. Every issue carries a direct
 * paragraph reference (e.g. "Aml. §14-6 første ledd bokstav f") and a
 * Norwegian remediation message.
 *
 * Reference: docs/agents/lovsen-agent/SKILL.AML.md
 */

import { z } from "zod";
import { ConfidenceLevelSchema } from "./confidence.js";

/**
 * A single validation finding for one §14-6 requirement.
 *
 * - `severity`: error blocks activation; warning is advisory
 * - `paragraph`: direct paragraph reference, e.g. "Aml. §14-6 første ledd bokstav f"
 * - `field`: the employment_contract or payroll_profile column name that failed
 * - `message_no`: Norwegian-language description of the issue
 * - `remediation`: Norwegian-language remediation instruction
 * - `confidence`: how certain Lovsen is about this finding (HØY/MEDIUM/LAV)
 */
export const ValidationIssueSchema = z.object({
  severity: z.enum(["error", "warning"]),
  paragraph: z.string().min(1),
  field: z.string().min(1),
  message_no: z.string().min(1),
  remediation: z.string().min(1),
  confidence: ConfidenceLevelSchema,
});

export type ValidationIssue = z.infer<typeof ValidationIssueSchema>;

/**
 * The result enum for §14-6 validation.
 *
 * - pass: all 16 requirements satisfied
 * - fail: one or more error-severity issues found
 * - pass_with_warnings: no errors, but warnings present
 * - skip: validation skipped (e.g. apprentice employment_form)
 * - review_required: grey zone — manual assessment needed before signing
 */
export const ValidationResultStatusSchema = z.enum([
  "pass",
  "fail",
  "pass_with_warnings",
  "skip",
  "review_required",
]);

export type ValidationResultStatus = z.infer<typeof ValidationResultStatusSchema>;

/**
 * Full §14-6 validation output from the `aml-14-6-validator` skill.
 *
 * - `validation_id`: UUID of this validation run
 * - `contract_id`: UUID of the employment_contract being validated
 * - `validated_at`: ISO-8601 timestamp of validation
 * - `validator_version`: e.g. "aml-14-6-2024-07" — tracks which §14-6 revision was used
 * - `source_url`: Lovdata URL for the §14-6 text fetched during validation
 * - `source_fetched_at`: ISO-8601 timestamp when Lovdata returned the text
 * - `result`: overall result classification
 * - `issues`: array of ValidationIssue, empty when result is "pass"
 * - `summary_no`: Norwegian-language one-line summary for the admin UI
 */
export const ValidationResultSchema = z.object({
  validation_id: z.string().uuid(),
  contract_id: z.string().uuid(),
  validated_at: z.string().datetime(),
  validator_version: z.string().min(1),
  source_url: z.string().url(),
  source_fetched_at: z.string().datetime(),
  result: ValidationResultStatusSchema,
  issues: z.array(ValidationIssueSchema),
  summary_no: z.string().min(1),
});

export type ValidationResult = z.infer<typeof ValidationResultSchema>;
