// ============================================
// operations.ts
// Database operations for the docs pipeline.
// Handles reading existing hashes, deleting stale chunks,
// batch-inserting new chunks, and duplicate detection.
// Connected to: src/db/client.ts (Supabase client)
// Connected to: src/commands/ingest.ts (orchestrates these operations)
// ============================================

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Chunk } from "../chunking/chunker";

/** Batch size for insert operations to avoid hitting payload limits */
const INSERT_BATCH_SIZE = 50;

/**
 * Fetches existing source hashes from the database.
 *
 * Why: We compare stored hashes against file hashes on disk
 * to determine which documents have changed and need re-embedding.
 *
 * @param supabase - Service-role Supabase client
 * @returns Map of source_path → source_hash for all stored documents
 */
export async function getExistingHashes(supabase: SupabaseClient): Promise<Map<string, string>> {
  const hashMap = new Map<string, string>();
  let offset = 0;
  const pageSize = 1000;

  // Paginate through all records to build the hash map
  while (true) {
    const { data, error } = await supabase
      .from("platform_doc_chunk")
      .select("source_path, source_hash")
      .range(offset, offset + pageSize - 1);

    if (error) {
      throw new Error(`Failed to fetch existing hashes: ${error.message}`);
    }

    if (!data || data.length === 0) break;

    for (const row of data) {
      // Only store the first occurrence per source_path
      // (all chunks from the same file share the same source_hash)
      if (!hashMap.has(row.source_path)) {
        hashMap.set(row.source_path, row.source_hash);
      }
    }

    if (data.length < pageSize) break;
    offset += pageSize;
  }

  return hashMap;
}

/**
 * Deletes all chunks for the given source paths.
 *
 * Why: When a document changes, we delete all its old chunks
 * before inserting the new ones. This is simpler and safer
 * than trying to diff individual chunks.
 *
 * @param supabase - Service-role Supabase client
 * @param paths - Array of source_path values to delete
 */
export async function deleteChunksForPaths(
  supabase: SupabaseClient,
  paths: string[],
): Promise<void> {
  if (paths.length === 0) return;

  // Delete in batches to avoid oversized queries
  for (let i = 0; i < paths.length; i += INSERT_BATCH_SIZE) {
    const batch = paths.slice(i, i + INSERT_BATCH_SIZE);
    const { error } = await supabase.from("platform_doc_chunk").delete().in("source_path", batch);

    if (error) {
      throw new Error(`Failed to delete chunks: ${error.message}`);
    }
  }
}

/**
 * Row shape for inserting into platform_doc_chunk.
 */
type InsertRow = {
  source_path: string;
  source_hash: string;
  content_hash: string;
  doc_type: string;
  chunk_index: number;
  section_title: string | null;
  content: string;
  token_count: number;
  metadata: Record<string, unknown>;
  embedding: number[] | null;
};

/**
 * Inserts chunks into the database in batches.
 *
 * Why: Large documents may produce many chunks. Batching at 50
 * keeps payload sizes reasonable and avoids timeouts.
 *
 * @param supabase - Service-role Supabase client
 * @param chunks - Array of chunks with embeddings attached
 */
export async function insertChunks(
  supabase: SupabaseClient,
  chunks: Array<Chunk & { embedding: number[] | null }>,
): Promise<void> {
  if (chunks.length === 0) return;

  // Convert chunks to database row format
  const rows: InsertRow[] = chunks.map((chunk) => ({
    source_path: chunk.sourcePath,
    source_hash: chunk.sourceHash,
    content_hash: chunk.contentHash,
    doc_type: chunk.docType,
    chunk_index: chunk.chunkIndex,
    section_title: chunk.sectionTitle,
    content: chunk.content,
    token_count: chunk.tokenCount,
    metadata: chunk.metadata,
    embedding: chunk.embedding,
  }));

  // Insert in batches
  for (let i = 0; i < rows.length; i += INSERT_BATCH_SIZE) {
    const batch = rows.slice(i, i + INSERT_BATCH_SIZE);
    const { error } = await supabase.from("platform_doc_chunk").insert(batch);

    if (error) {
      throw new Error(`Failed to insert chunk batch (${i}-${i + batch.length}): ${error.message}`);
    }
  }
}

/**
 * Exact duplicate: same content_hash, different source_path.
 */
export type ExactDuplicate = {
  contentHash: string;
  paths: string[];
};

/**
 * Finds chunks with identical content_hash but different source paths.
 *
 * Why: Exact duplicates waste embedding storage and can confuse
 * retrieval results. This helps identify copy-pasted content
 * that should be consolidated.
 *
 * @param supabase - Service-role Supabase client
 * @returns Array of duplicate groups (same content, different files)
 */
export async function findExactDuplicates(supabase: SupabaseClient): Promise<ExactDuplicate[]> {
  // Fetch all content hashes and source paths
  const allChunks: Array<{ content_hash: string; source_path: string }> = [];
  let offset = 0;
  const pageSize = 1000;

  while (true) {
    const { data, error } = await supabase
      .from("platform_doc_chunk")
      .select("content_hash, source_path")
      .range(offset, offset + pageSize - 1);

    if (error) {
      throw new Error(`Failed to check for duplicates: ${error.message}`);
    }

    if (!data || data.length === 0) break;
    allChunks.push(...data);
    if (data.length < pageSize) break;
    offset += pageSize;
  }

  // Group by content_hash, collecting unique source_paths
  const groups = new Map<string, Set<string>>();
  for (const chunk of allChunks) {
    const existing = groups.get(chunk.content_hash) ?? new Set<string>();
    existing.add(chunk.source_path);
    groups.set(chunk.content_hash, existing);
  }

  // Return groups that appear in more than one source file
  const duplicates: ExactDuplicate[] = [];
  for (const [contentHash, paths] of groups) {
    if (paths.size > 1) {
      duplicates.push({ contentHash, paths: [...paths] });
    }
  }

  return duplicates;
}

/**
 * Semantic duplicate: high cosine similarity between chunks from different files.
 */
export type SemanticDuplicate = {
  path1: string;
  path2: string;
  similarity: number;
};

/**
 * Finds semantically similar chunks from different source files.
 *
 * Why: Even without identical content, very similar chunks
 * (e.g., slightly reworded paragraphs) indicate potential
 * doc consolidation opportunities.
 *
 * Note: This performs a pairwise comparison which is O(n^2).
 * For large datasets (>1000 chunks), consider sampling.
 *
 * @param supabase - Service-role Supabase client
 * @param threshold - Minimum similarity score (0-1, default 0.96)
 * @returns Array of semantic duplicate pairs
 */
export async function findSemanticDuplicates(
  supabase: SupabaseClient,
  threshold: number = 0.96,
): Promise<SemanticDuplicate[]> {
  // Fetch a sample of chunks with embeddings for comparison
  const { data, error } = await supabase
    .from("platform_doc_chunk")
    .select("chunk_id, source_path, embedding")
    .not("embedding", "is", null)
    .limit(500);

  if (error) {
    console.log(`   Semantic duplicate check failed: ${error.message}`);
    return [];
  }

  if (!data || data.length < 2) return [];

  // Pairwise cosine similarity comparison
  const duplicates: SemanticDuplicate[] = [];

  for (let i = 0; i < data.length; i++) {
    for (let j = i + 1; j < data.length; j++) {
      const a = data[i]!;
      const b = data[j]!;

      // Skip chunks from the same file
      if (a.source_path === b.source_path) continue;

      // Skip if embeddings are missing
      if (!a.embedding || !b.embedding) continue;

      const similarity = cosineSimilarity(
        a.embedding as unknown as number[],
        b.embedding as unknown as number[],
      );

      if (similarity >= threshold) {
        duplicates.push({
          path1: a.source_path,
          path2: b.source_path,
          similarity: Math.round(similarity * 1000) / 1000,
        });
      }
    }
  }

  return duplicates;
}

/**
 * Computes cosine similarity between two vectors.
 *
 * @returns Similarity score between 0 and 1
 */
function cosineSimilarity(a: number[], b: number[]): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    const ai = a[i] ?? 0;
    const bi = b[i] ?? 0;
    dotProduct += ai * bi;
    normA += ai * ai;
    normB += bi * bi;
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) return 0;

  return dotProduct / denominator;
}
