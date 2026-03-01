// ============================================
// client.ts
// OpenRouter embedding client for generating document embeddings.
// Uses text-embedding-3-small (1536 dims) via OpenRouter.
// Connected to: src/commands/ingest.ts (called during ingestion)
// Connected to: ADR-0031 (embedding model decision)
// ============================================

import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { embedMany } from "ai";

/** Maximum texts per embedding API call to stay within limits */
const EMBEDDING_BATCH_SIZE = 100;

/**
 * The embedding model routed through OpenRouter.
 * Must match the model used in the query embedding helper
 * (packages/ai/src/embedding.ts).
 */
const EMBEDDING_MODEL = "openai/text-embedding-3-small";

/**
 * Generates embeddings for an array of text strings.
 *
 * Why: Each document chunk needs a vector embedding for similarity search.
 * We use OpenAI's text-embedding-3-small model (1536 dimensions) routed
 * through OpenRouter for good quality at low cost.
 *
 * Auto-batches at 100 texts per API call to stay within API limits.
 *
 * @param texts - Array of text strings to embed
 * @returns Array of embedding vectors (same order as input)
 * @throws Error if OPENROUTER_API_KEY is missing or API call fails
 */
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];

  const apiKey = process.env["OPENROUTER_API_KEY"];
  if (!apiKey) {
    throw new Error("Missing OPENROUTER_API_KEY environment variable");
  }

  const openrouter = createOpenRouter({ apiKey });
  const allEmbeddings: number[][] = [];

  // Process in batches to stay within API limits
  for (let i = 0; i < texts.length; i += EMBEDDING_BATCH_SIZE) {
    const batch = texts.slice(i, i + EMBEDDING_BATCH_SIZE);

    const { embeddings } = await embedMany({
      model: openrouter.textEmbeddingModel(EMBEDDING_MODEL),
      values: batch,
    });

    allEmbeddings.push(...embeddings);
  }

  return allEmbeddings;
}
