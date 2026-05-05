/**
 * @smartout/lovsen-contract
 *
 * Canonical Zod schemas and TypeScript types for the Lovsen Norwegian labor-law
 * advisor agent. Import from this package when producing or consuming Lovsen
 * answers, citations, confidence objects, validation results, or amendment
 * classification results.
 *
 * Every type in this package has a Zod schema (for runtime validation) and a
 * TypeScript type derived via `z.infer<>` (for static type checking).
 *
 * See ADR-0256 (Citation Contract) and ADR-0257 (Confidence Model) for
 * the decisions that define this interface.
 */

export { CitationSchema } from "./citation.js";
export type { Citation } from "./citation.js";

export { ConfidenceLevelSchema, ConfidenceSchema } from "./confidence.js";
export type { ConfidenceLevel, Confidence } from "./confidence.js";

export {
  ClassificationSchema,
  ClassificationWarningSchema,
  ClassificationResultSchema,
} from "./classification-result.js";
export type {
  Classification,
  ClassificationWarning,
  ClassificationResult,
} from "./classification-result.js";

export {
  ValidationIssueSchema,
  ValidationResultStatusSchema,
  ValidationResultSchema,
} from "./validation-result.js";
export type {
  ValidationIssue,
  ValidationResultStatus,
  ValidationResult,
} from "./validation-result.js";

export { LovsenAnswerSchema } from "./lovsen-answer.js";
export type { LovsenAnswer } from "./lovsen-answer.js";
