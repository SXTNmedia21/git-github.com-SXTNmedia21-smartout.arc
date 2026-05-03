/**
 * citation.ts — Lovsen Citation Contract (ADR-0256)
 *
 * Every Lovsen answer cites verbatim paragraph text with cryptographic hash,
 * fetch timestamp, and source URL. This ensures legal-grade provenance and
 * prevents hallucinated law text from reaching the user.
 *
 * Reference: docs/decisions/0242-lovsen-citation-contract.md
 */

import { z } from "zod";

/**
 * A single paragraph citation from a Norwegian law or regulation source.
 *
 * - `lov`: law abbreviation, e.g. "aml", "ferielov", "otp-loven"
 * - `paragraph`: human-readable reference, e.g. "§14-6", "§10-9 fjerde ledd"
 * - `verbatim_text`: the exact text fetched from source — never summarised
 * - `hash`: SHA-256 of `verbatim_text` (hex string) — enables staleness detection
 * - `fetched_at`: ISO-8601 timestamp when the MCP server fetched this text
 * - `source_url`: canonical URL for human verification (Lovdata, Mattilsynet, etc.)
 * - `law_version`: optional law version/date string, e.g. "2024-07-01"
 */
export const CitationSchema = z.object({
  lov: z.string().min(1),
  paragraph: z.string().min(1),
  ledd: z.string().optional(),
  bokstav: z.string().optional(),
  verbatim_text: z.string().min(1),
  hash: z
    .string()
    .regex(/^[0-9a-f]{64}$/, "hash must be a 64-character lowercase hex SHA-256 string"),
  fetched_at: z.string().datetime({ message: "fetched_at must be ISO-8601 datetime" }),
  source_url: z.string().url(),
  law_version: z.string().optional(),
});

export type Citation = z.infer<typeof CitationSchema>;
