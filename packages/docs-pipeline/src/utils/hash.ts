// ============================================
// hash.ts
// SHA-256 hashing utilities for file and content deduplication.
// Used by the ingestion pipeline to detect changed documents
// and skip re-embedding unchanged content.
// Connected to: src/commands/ingest.ts (change detection)
// ============================================

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

/**
 * Computes a SHA-256 hash of a file's contents.
 *
 * Why: We compare file hashes against stored hashes in the database
 * to detect which documents have changed since the last ingest run.
 *
 * @param filePath - Absolute path to the file
 * @returns Hex-encoded SHA-256 hash string
 */
export async function hashFile(filePath: string): Promise<string> {
  const content = await readFile(filePath, "utf-8");
  return hashString(content);
}

/**
 * Computes a SHA-256 hash of a string.
 *
 * Why: Used for content-level deduplication — if a chunk's content
 * hasn't changed, we skip re-generating its embedding.
 *
 * @param content - The string to hash
 * @returns Hex-encoded SHA-256 hash string
 */
export function hashString(content: string): string {
  return createHash("sha256").update(content, "utf-8").digest("hex");
}
