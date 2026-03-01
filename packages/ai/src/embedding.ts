// ============================================
// embedding.ts
// Query embedding helper for RAG retrieval.
// Generates a single embedding vector for a search query,
// used by doc retrieval tools to find relevant documentation.
// Connected to: src/tools/docs.ts (uses this for search queries)
// Connected to: ADR-0031 (embedding model decision)
// ============================================

import { openai } from "@ai-sdk/openai";
import { embed } from "ai";

/** Must match the embedding model used in the ingestion pipeline */
const EMBEDDING_MODEL = "text-embedding-3-small";

/**
 * Generates a single embedding vector for a search query.
 *
 * Why: The RAG pipeline needs to convert natural language queries
 * into the same vector space as the stored document chunks.
 * Uses the same model as ingestion to ensure compatibility.
 *
 * @param text - The search query text
 * @returns 1536-dimensional embedding vector
 * @throws Error if OPENAI_API_KEY is missing or API call fails
 */
export async function getQueryEmbedding(text: string): Promise<number[]> {
  const { embedding } = await embed({
    model: openai.embedding(EMBEDDING_MODEL),
    value: text,
  });

  return embedding;
}
