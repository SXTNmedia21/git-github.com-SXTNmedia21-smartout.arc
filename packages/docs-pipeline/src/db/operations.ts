// ============================================
// operations.ts
// Database operations for the docs pipeline.
// Handles reading existing hashes, deleting stale chunks,
// and batch-inserting new chunks.
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
