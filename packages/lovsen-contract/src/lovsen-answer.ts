/**
 * lovsen-answer.ts — LovsenAnswer top-level contract (ADR-0238 + ADR-0239)
 *
 * The canonical output type for any Lovsen response. Every answer must carry
 * at least one citation (proving the response is source-grounded), a confidence
 * assessment, and an explicit escalation_recommended flag.
 *
 * Optional blocks: classification (when an amendment was classified) and
 * validation (when §14-6 validation was performed).
 *
 * Reference: docs/decisions/0238-lovsen-citation-contract.md
 * Reference: docs/decisions/0239-lovsen-confidence-model.md
 */

import { z } from "zod";
import { CitationSchema } from "./citation.js";
import { ConfidenceSchema } from "./confidence.js";
import { ClassificationResultSchema } from "./classification-result.js";
import { ValidationResultSchema } from "./validation-result.js";

/**
 * The complete output contract for a Lovsen agent response.
 *
 * - `answer_no`: Norwegian-language answer text (the direct response to the user)
 * - `citations`: one or more verbatim paragraph citations (never empty — ADR-0238)
 * - `confidence`: dual confidence assessment — HØY/MEDIUM/LAV + numeric score
 * - `classification`: present when the skill classified a contract field change
 * - `validation`: present when the skill performed §14-6 validation
 * - `disclaimer`: optional legal disclaimer appended at LAV confidence or legal consequence
 * - `escalation_recommended`: true when confidence is LAV or question has legal consequence
 */
export const LovsenAnswerSchema = z.object({
  answer_no: z.string().min(1),
  citations: z.array(CitationSchema).min(1, "at least one citation is required"),
  confidence: ConfidenceSchema,
  classification: ClassificationResultSchema.optional(),
  validation: ValidationResultSchema.optional(),
  disclaimer: z.string().optional(),
  escalation_recommended: z.boolean(),
});

export type LovsenAnswer = z.infer<typeof LovsenAnswerSchema>;
