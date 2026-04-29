/**
 * classification-result.ts — Amendment classifier output shape (ADR-0238)
 *
 * Derived from SKILL.CLASSIFYER.md §Output. ClassificationResult is the
 * canonical output of the `amendment-classifier` skill. Determines whether
 * a contract field change requires employee re-signing (MATERIAL) or can
 * be committed directly (ADMIN/DERIVED/SYSTEM), and when changes are illegal (BLOCKED).
 *
 * Reference: docs/agents/lovsen-agent/SKILL.CLASSIFYER.md
 */

import { z } from "zod";
import { ConfidenceLevelSchema } from "./confidence.js";

/**
 * Classification categories for contract field changes.
 *
 * - material: requires employee amendment + re-signing (Aml. §14-6)
 * - admin: can be committed directly by admin without re-signing
 * - derived: automatically derived from other fields, no consent needed
 * - system: internal system update, invisible to contract parties
 * - blocked: change is illegal per Aml. or Riksavtalen
 * - review_required: grey zone — manual assessment needed before commit
 */
export const ClassificationSchema = z.enum([
  "material",
  "admin",
  "derived",
  "system",
  "blocked",
  "review_required",
]);

export type Classification = z.infer<typeof ClassificationSchema>;

/**
 * A warning attached to a classification result.
 *
 * - `type`: machine-readable warning type (e.g. "employee_disadvantage")
 * - `message_no`: Norwegian-language warning message for the admin UI
 */
export const ClassificationWarningSchema = z.object({
  type: z.string().min(1),
  message_no: z.string().min(1),
});

export type ClassificationWarning = z.infer<typeof ClassificationWarningSchema>;

/**
 * Full amendment classification result from the `amendment-classifier` skill.
 *
 * - `classification`: the classification category
 * - `requires_resigning`: true when classification is MATERIAL
 * - `confidence`: HØY/MEDIUM/LAV — derived from rule-match certainty
 * - `reasoning_no`: Norwegian-language explanation of the classification decision
 * - `paragraph_references`: array of paragraph strings, e.g. ["Aml. §14-6 første ledd bokstav i"]
 * - `source_urls`: Lovdata or other URLs backing the cited paragraphs
 * - `warnings`: advisory items that do not block the change
 * - `blocked_reason`: Norwegian-language reason when classification is "blocked"; null otherwise
 * - `alternative_actions`: suggested alternatives when change is blocked or has warnings
 */
export const ClassificationResultSchema = z.object({
  classification: ClassificationSchema,
  requires_resigning: z.boolean(),
  confidence: ConfidenceLevelSchema,
  reasoning_no: z.string().min(1),
  paragraph_references: z.array(z.string()),
  source_urls: z.array(z.string().url()),
  warnings: z.array(ClassificationWarningSchema),
  blocked_reason: z.string().nullable(),
  alternative_actions: z.array(z.string()),
});

export type ClassificationResult = z.infer<typeof ClassificationResultSchema>;
