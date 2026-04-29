/**
 * confidence.ts — Lovsen Confidence Model (ADR-0243)
 *
 * Dual representation: human-readable HØY/MEDIUM/LAV labels (from lovsen.md
 * §Confidence-policy, surfaced to the user) plus numeric 0..1 score for
 * downstream gating (capability layer, C4 authority, UI indicators).
 *
 * Reference: docs/decisions/0243-lovsen-confidence-model.md
 */

import { z } from "zod";

/**
 * Lovsen confidence level labels — exactly as defined in lovsen.md §Confidence-policy.
 *
 * - HØY: direct citation from law/regulation/Riksavtalen, fetched from MCP or verified in knowledge base
 * - MEDIUM: interpretation of law text or industry practice
 * - LAV: grey zone requiring lawyer assessment
 */
export const ConfidenceLevelSchema = z.enum(["HØY", "MEDIUM", "LAV"]);
export type ConfidenceLevel = z.infer<typeof ConfidenceLevelSchema>;

/**
 * Full Confidence object combining label, numeric score, and diagnostic fields.
 *
 * - `level`: HØY/MEDIUM/LAV — displayed to user
 * - `score`: 0..1 — used for downstream gating; 1.0 = maximum certainty
 * - `reasons`: array of human-readable strings explaining the confidence assessment
 * - `stale_paragraph`: true when the cited paragraph was fetched beyond freshness window
 * - `missing_data`: fields or context items that would improve the confidence score
 */
export const ConfidenceSchema = z.object({
  level: ConfidenceLevelSchema,
  score: z.number().min(0).max(1),
  reasons: z.array(z.string()),
  stale_paragraph: z.boolean(),
  missing_data: z.array(z.string()),
});

export type Confidence = z.infer<typeof ConfidenceSchema>;
