// ============================================
// ingest.ts
// Main ingestion command for the docs pipeline.
// Discovers markdown files, hashes them, diffs against DB,
// chunks changed files, generates embeddings, and inserts.
// Connected to: src/db/operations.ts (database layer)
// Connected to: src/chunking/chunker.ts (document chunking)
// Connected to: src/embedding/client.ts (OpenAI embeddings)
// ============================================

import fg from "fast-glob";
import { readFile } from "node:fs/promises";
import { resolve, relative } from "node:path";
import { hashString } from "../utils/hash";
import { chunkDocument } from "../chunking/chunker";
import { getServiceClient } from "../db/client";
import { getExistingHashes, deleteChunksForPaths, insertChunks } from "../db/operations";
import { generateEmbeddings } from "../embedding/client";
import type { Chunk } from "../chunking/chunker";

/**
 * Options for the ingest command.
 */
export type IngestOptions = {
  /** Re-process all files regardless of hash changes */
  force: boolean;
  /** Log what would happen without making changes */
  dryRun: boolean;
  /** Change detection mode: filesystem (default) or git */
  mode: "filesystem" | "git";
  /** Git ref to diff against (only used in git mode) */
  gitRef: string;
  /** Threshold for semantic duplicate warnings (0-1) */
  duplicateThreshold: number;
};

/**
 * Discovers all markdown files in the docs/ directory.
 *
 * Why: We use fast-glob instead of Node's built-in glob because
 * the project targets Node >= 18 and Node's glob API was only
 * added in Node 22.
 *
 * @returns Array of absolute file paths
 */
async function discoverDocs(): Promise<string[]> {
  const docsDir = resolve(process.cwd(), "docs");
  const patterns = ["**/*.md"];
  const ignore = ["**/archive/**", "**/templates/**", "**/node_modules/**"];

  const files = await fg(patterns, {
    cwd: docsDir,
    absolute: true,
    ignore,
  });

  return files;
}

/**
 * Discovers changed docs using git diff.
 *
 * Why: In CI or incremental runs, we only want to process files
 * that have actually changed since a reference point (e.g., origin/main).
 *
 * @param gitRef - Git ref to diff against
 * @returns Array of absolute file paths that changed
 */
async function discoverChangedDocs(gitRef: string): Promise<string[]> {
  const { execSync } = await import("node:child_process");
  const cwd = process.cwd();

  // Get list of changed files under docs/
  const output = execSync(`git diff --name-only ${gitRef} -- docs/`, {
    cwd,
    encoding: "utf-8",
  });

  return output
    .split("\n")
    .filter((line) => line.trim().length > 0 && line.endsWith(".md"))
    .map((line) => resolve(cwd, line.trim()));
}

/**
 * Runs the document ingestion pipeline.
 *
 * Why: This is the core command that keeps the vector database
 * in sync with the docs/ directory. It's designed to be idempotent —
 * running it twice with no changes produces zero inserts.
 *
 * Steps:
 * 1. Discover markdown files
 * 2. Hash each file and compare against stored hashes
 * 3. Chunk changed/new files
 * 4. Generate embeddings for all chunks
 * 5. Delete old chunks and insert new ones
 *
 * @param options - Ingest configuration options
 */
export async function runIngest(options: IngestOptions): Promise<void> {
  const { force, dryRun, mode, gitRef } = options;

  console.log(`\n📚 Documentation Ingestion Pipeline`);
  console.log(`   Mode: ${mode} | Force: ${force} | Dry Run: ${dryRun}\n`);

  // Step 1: Discover files
  let files: string[];
  if (mode === "git") {
    console.log(`   Git ref: ${gitRef}`);
    files = await discoverChangedDocs(gitRef);
    console.log(`   Found ${files.length} changed files (git diff)\n`);
  } else {
    files = await discoverDocs();
    console.log(`   Found ${files.length} markdown files\n`);
  }

  if (files.length === 0) {
    console.log("   No files to process. Done.\n");
    return;
  }

  // Step 2: Hash files and determine what changed
  const projectRoot = resolve(process.cwd());
  const fileData: Array<{ path: string; relativePath: string; content: string; hash: string }> = [];

  for (const filePath of files) {
    const content = await readFile(filePath, "utf-8");
    const hash = hashString(content);
    const relativePath = relative(projectRoot, filePath).replace(/\\/g, "/");
    fileData.push({ path: filePath, relativePath, content, hash });
  }

  // Get existing hashes from DB (skip in dry-run without DB)
  let existingHashes = new Map<string, string>();
  if (!dryRun) {
    const supabase = getServiceClient();
    existingHashes = await getExistingHashes(supabase);
  }

  // Determine changed files
  const changedFiles = force
    ? fileData
    : fileData.filter((f) => {
        const existingHash = existingHashes.get(f.relativePath);
        return existingHash !== f.hash;
      });

  // Find removed files (in DB but not on disk)
  const diskPaths = new Set(fileData.map((f) => f.relativePath));
  const removedPaths = [...existingHashes.keys()].filter((path) => !diskPaths.has(path));

  console.log(
    `   Changed: ${changedFiles.length} | Removed: ${removedPaths.length} | Unchanged: ${fileData.length - changedFiles.length}\n`,
  );

  if (changedFiles.length === 0 && removedPaths.length === 0) {
    console.log("   Everything up to date. 0 changes needed.\n");
    return;
  }

  // Step 3: Chunk changed files
  const allChunks: Chunk[] = [];
  for (const file of changedFiles) {
    const chunks = chunkDocument(file.content, file.relativePath, file.hash);
    allChunks.push(...chunks);
    console.log(`   Chunked: ${file.relativePath} → ${chunks.length} chunks`);
  }

  console.log(`\n   Total chunks: ${allChunks.length}\n`);

  if (dryRun) {
    console.log("   [DRY RUN] Would delete chunks for:");
    for (const path of [...changedFiles.map((f) => f.relativePath), ...removedPaths]) {
      console.log(`     - ${path}`);
    }
    console.log(`   [DRY RUN] Would insert ${allChunks.length} chunks`);
    console.log(`   [DRY RUN] Would generate ${allChunks.length} embeddings\n`);
    return;
  }

  // Step 4: Generate embeddings
  console.log("   Generating embeddings...");
  const texts = allChunks.map((c) => c.content);
  const embeddings = await generateEmbeddings(texts);
  console.log(`   Generated ${embeddings.length} embeddings\n`);

  // Attach embeddings to chunks
  const chunksWithEmbeddings = allChunks.map((chunk, i) => ({
    ...chunk,
    embedding: embeddings[i] ?? null,
  }));

  // Step 5: Delete old chunks and insert new ones
  const supabase = getServiceClient();
  const pathsToDelete = [...changedFiles.map((f) => f.relativePath), ...removedPaths];

  console.log(`   Deleting ${pathsToDelete.length} source paths...`);
  await deleteChunksForPaths(supabase, pathsToDelete);

  console.log(`   Inserting ${chunksWithEmbeddings.length} chunks...`);
  await insertChunks(supabase, chunksWithEmbeddings);

  console.log(
    `\n   Done! Processed ${changedFiles.length} files into ${chunksWithEmbeddings.length} chunks.\n`,
  );
}
