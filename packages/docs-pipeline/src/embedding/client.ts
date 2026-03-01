// ============================================
// client.ts
// OpenAI embedding client for generating document embeddings.
// Uses text-embedding-3-small (1536 dims) via @ai-sdk/openai.
// OpenRouter doesn't support embeddings, so we call OpenAI directly.
// Connected to: src/commands/ingest.ts (called during ingestion)
// Connected to: ADR-0031 (embedding model decision)
// ============================================

import { openai } from "@ai-sdk/openai";
import { embedMany } from "ai";

/** Maximum texts per embedding API call to stay within limits */
const EMBEDDING_BATCH_SIZE = 100;

/** The embedding model specified in ADR-0031 */
const EMBEDDING_MODEL = "text-embedding-3-small";

/**
 * Generates embeddings for an array of text strings.
 *
 * Why: Each document chunk needs a vector embedding for similarity search.
 * We use OpenAI's text-embedding-3-small model (1536 dimensions) for
 * good quality at low cost (~$0.02 per million tokens).
 *
 * Auto-batches at 100 texts per API call to stay within OpenAI limits.
 *
 * @param texts - Array of text strings to embed
 * @returns Array of embedding vectors (same order as input)
 * @throws Error if OPENAI_API_KEY is missing or API call fails
 */
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];

  if (!process.env["OPENAI_API_KEY"]) {
    throw new Error("Missing OPENAI_API_KEY environment variable");
  }

  const allEmbeddings: number[][] = [];

  // Process in batches to stay within API limits
  for (let i = 0; i < texts.length; i += EMBEDDING_BATCH_SIZE) {
    const batch = texts.slice(i, i + EMBEDDING_BATCH_SIZE);

    const { embeddings } = await embedMany({
      model: openai.embedding(EMBEDDING_MODEL),
      values: batch,
    });

    allEmbeddings.push(...embeddings);
  }

  return allEmbeddings;
}
