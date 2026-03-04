// ============================================
// embedding.ts
// Query embedding helper for RAG retrieval.
// Generates a single embedding vector for a search query,
// used by doc retrieval tools to find relevant documentation.
// Connected to: src/tools/docs.ts (uses this for search queries)
// Connected to: ADR-0031 (embedding model decision)
// ============================================

import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { embed } from "ai";

/**
 * Embedding model routed through OpenRouter.
 * Must match the model used in the ingestion pipeline
 * (packages/docs-pipeline/src/embedding/client.ts).
 */
const EMBEDDING_MODEL = "openai/text-embedding-3-small";

/**
 * Generates a single embedding vector for a search query.
 *
 * Why: The RAG pipeline needs to convert natural language queries
 * into the same vector space as the stored document chunks.
 * Uses the same model as ingestion to ensure compatibility.
 *
 * @param text - The search query text
 * @returns 1536-dimensional embedding vector
 * @throws Error if OPENROUTER_API_KEY is missing or API call fails
 */
export async function getQueryEmbedding(text: string): Promise<number[]> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is not set.");
  }

  const openrouter = createOpenRouter({ apiKey });

  const { embedding } = await embed({
    model: openrouter.textEmbeddingModel(EMBEDDING_MODEL),
    value: text,
  });

  return embedding;
}
