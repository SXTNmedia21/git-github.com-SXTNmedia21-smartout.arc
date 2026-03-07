// ============================================
// ingest.ts
// Main ingestion command for the docs pipeline.
// Discovers markdown files, hashes them, diffs against DB,
// chunks changed files, generates embeddings, and inserts.
// Connected to: src/db/operations.ts (database layer)
// Connected to: src/chunking/chunker.ts (document chunking)
// Connected to: src/embedding/client.ts (OpenRouter embeddings)
// ============================================

import fg from "fast-glob";
import { readFile } from "node:fs/promises";
import { resolve, relative } from "node:path";
import { findProjectRoot } from "../utils/root";
import { hashString } from "../utils/hash";
import { chunkDocument } from "../chunking/chunker";
import { getServiceClient } from "../db/client";
import {
  getExistingHashes,
  getExistingWorkspaceHashes,
  deleteWorkspaceChunksForPaths,
  deleteChunksForPaths,
  insertChunks,
  findExactDuplicates,
  findSemanticDuplicates,
  upsertWorkspaceChunks,
} from "../db/operations";
import { generateEmbeddings } from "../embedding/client";
import { acquireLock, releaseLock } from "../locking/ingest-lock";
import type { Chunk } from "../chunking/chunker";

/**
 * Options for the ingest command.
 */
export type IngestOptions = {
  /** Re-process all files regardless of hash changes */
  force: boolean;
  /** Log what would happen without making changes */
  dryRun: boolean;
  /** Change detection mode: filesystem (default), git, or workspace */
  mode: "filesystem" | "git" | "workspace";
  /** Git ref to diff against (only used in git mode) */
  gitRef: string;
  /** Optional workspace filter (workspace mode only). If omitted, ingests all workspaces. */
  workspaceId?: string;
  /** Threshold for semantic duplicate warnings (0-1) */
  duplicateThreshold: number;
};

type WorkspaceSourceType = "handbook_chapter" | "policy" | "protocol" | "procedure";

type WorkspaceSourceDocument = {
  workspaceId: string;
  sourceId: string;
  sourceType: WorkspaceSourceType;
  sourcePath: string;
  sourceHash: string;
  title: string;
  content: string;
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
  const docsDir = resolve(findProjectRoot(), "docs");
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
  const cwd = findProjectRoot();

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
  const { force, dryRun, mode, gitRef, duplicateThreshold } = options;

  console.log(`\n📚 Documentation Ingestion Pipeline`);
  console.log(`   Mode: ${mode} | Force: ${force} | Dry Run: ${dryRun}\n`);

  let lockAcquired = false;

  // Acquire lock for write operations (skip for dry-run)
  if (!dryRun) {
    lockAcquired = acquireLock(`ingest --mode ${mode}${force ? " --force" : ""}`);
    if (!lockAcquired) {
      console.log("   Cannot acquire lock. Another ingest process is running.\n");
      process.exitCode = 1;
      return;
    }
  }

  try {
    if (mode === "workspace") {
      await runWorkspaceIngestMode(options);
      return;
    }

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
    const projectRoot = resolve(findProjectRoot());
    const fileData: Array<{ path: string; relativePath: string; content: string; hash: string }> =
      [];

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

    // Step 6: Check for duplicates
    console.log("   Checking for duplicates...");
    const exactDupes = await findExactDuplicates(supabase);
    if (exactDupes.length > 0) {
      console.log(`\n   ⚠ Found ${exactDupes.length} exact duplicate groups:`);
      for (const dupe of exactDupes) {
        console.log(`     Content hash ${dupe.contentHash.slice(0, 12)}... appears in:`);
        for (const path of dupe.paths) {
          console.log(`       - ${path}`);
        }
      }
    }

    const semanticDupes = await findSemanticDuplicates(supabase, duplicateThreshold);
    if (semanticDupes.length > 0) {
      console.log(
        `\n   ⚠ Found ${semanticDupes.length} semantic duplicate pairs (>= ${duplicateThreshold}):`,
      );
      for (const dupe of semanticDupes) {
        console.log(`     ${dupe.path1} <-> ${dupe.path2} (${dupe.similarity})`);
      }
    }

    if (exactDupes.length === 0 && semanticDupes.length === 0) {
      console.log("   No duplicates found.");
    }

    console.log(
      `\n   Done! Processed ${changedFiles.length} files into ${chunksWithEmbeddings.length} chunks.\n`,
    );
  } finally {
    if (lockAcquired) {
      releaseLock();
    }
  }
}

/**
 * Runs workspace table ingestion and upserts chunks into workspace_doc_chunk.
 *
 * Why: Workspace knowledge lives in database tables (not files on disk), so
 * workspace mode reads source rows from Supabase, chunks content with the same
 * chunker strategy, and writes workspace-scoped chunks for semantic retrieval.
 *
 * @param options - Ingest configuration with workspace mode selected
 */
async function runWorkspaceIngestMode(options: IngestOptions): Promise<void> {
  const { force, dryRun, workspaceId } = options;
  const supabase = getServiceClient();

  const workspaceIds = await discoverWorkspaceIds(supabase, workspaceId);
  if (workspaceIds.length === 0) {
    console.log("   No workspaces found for workspace ingestion.\n");
    return;
  }

  console.log(
    `   Workspace scope: ${workspaceId ? workspaceId : "all"} (${workspaceIds.length} workspace(s))\n`,
  );

  let totalSources = 0;
  let totalChangedSources = 0;
  const workspaceRows: Array<{
    workspace_id: string;
    source_type: WorkspaceSourceType;
    source_id: string | null;
    source_path: string;
    source_hash: string;
    content_hash: string;
    chunk_index: number;
    title: string | null;
    content: string;
    token_count: number;
    metadata: Record<string, unknown>;
    embedding: number[] | null;
  }> = [];

  for (const currentWorkspaceId of workspaceIds) {
    const sourceDocs = await fetchWorkspaceSourceDocuments(supabase, currentWorkspaceId);
    totalSources += sourceDocs.length;

    let existingHashes = new Map<string, string>();
    if (!force) {
      existingHashes = await getExistingWorkspaceHashes(supabase, currentWorkspaceId);
    }

    const changedSources = force
      ? sourceDocs
      : sourceDocs.filter((source) => existingHashes.get(source.sourcePath) !== source.sourceHash);
    const currentSourcePaths = new Set(sourceDocs.map((source) => source.sourcePath));
    const removedSourcePaths = [...existingHashes.keys()].filter(
      (path) => !currentSourcePaths.has(path),
    );
    totalChangedSources += changedSources.length;

    console.log(
      `   Workspace ${currentWorkspaceId}: Sources ${sourceDocs.length} | Changed ${changedSources.length} | Removed ${removedSourcePaths.length}`,
    );

    if (!dryRun) {
      await deleteWorkspaceChunksForPaths(supabase, currentWorkspaceId, [
        ...changedSources.map((source) => source.sourcePath),
        ...removedSourcePaths,
      ]);
    }

    for (const source of changedSources) {
      const chunks = chunkDocument(source.content, source.sourcePath, source.sourceHash);
      for (const chunk of chunks) {
        workspaceRows.push({
          workspace_id: source.workspaceId,
          source_type: source.sourceType,
          source_id: source.sourceId,
          source_path: source.sourcePath,
          source_hash: source.sourceHash,
          content_hash: chunk.contentHash,
          chunk_index: chunk.chunkIndex,
          title: source.title,
          content: chunk.content,
          token_count: chunk.tokenCount,
          metadata: {
            ...chunk.metadata,
            workspace_id: source.workspaceId,
            source_id: source.sourceId,
            source_type: source.sourceType,
          },
          embedding: null,
        });
      }
    }
  }

  console.log(
    `\n   Workspace sources: ${totalSources} | Changed sources: ${totalChangedSources} | Chunks: ${workspaceRows.length}\n`,
  );

  if (workspaceRows.length === 0) {
    console.log("   Everything up to date. 0 changes needed.\n");
    return;
  }

  if (dryRun) {
    console.log(`   [DRY RUN] Would generate ${workspaceRows.length} embeddings`);
    console.log(
      `   [DRY RUN] Would upsert ${workspaceRows.length} rows into workspace_doc_chunk\n`,
    );
    return;
  }

  console.log("   Generating embeddings...");
  const embeddings = await generateEmbeddings(workspaceRows.map((row) => row.content));
  console.log(`   Generated ${embeddings.length} embeddings\n`);

  const rowsWithEmbeddings = workspaceRows.map((row, index) => ({
    ...row,
    embedding: embeddings[index] ?? null,
  }));

  console.log(`   Upserting ${rowsWithEmbeddings.length} workspace chunks...`);
  await upsertWorkspaceChunks(supabase, rowsWithEmbeddings);

  console.log(
    `\n   Done! Processed ${totalChangedSources} sources into ${rowsWithEmbeddings.length} chunks.\n`,
  );
}

/**
 * Resolves workspace IDs for workspace ingestion.
 *
 * Why: `--workspace-id` enables targeted ingest, while the default should
 * process all workspaces to keep workspace_doc_chunk globally up to date.
 *
 * @param supabase - Service-role Supabase client
 * @param workspaceIdFilter - Optional single workspace filter
 * @returns Workspace IDs to ingest
 */
async function discoverWorkspaceIds(
  supabase: ReturnType<typeof getServiceClient>,
  workspaceIdFilter?: string,
): Promise<string[]> {
  if (workspaceIdFilter) {
    return [workspaceIdFilter];
  }

  const { data, error } = await supabase.from("workspace").select("workspace_id");
  if (error) {
    throw new Error(`Failed to discover workspaces: ${error.message}`);
  }

  return (data ?? []).map((row) => row.workspace_id);
}

/**
 * Fetches handbook/policy/protocol/procedure source documents for one workspace.
 *
 * Why: Workspace mode must embed governance knowledge directly from tables
 * instead of markdown files so semantic retrieval can include company-specific
 * operational context.
 *
 * @param supabase - Service-role Supabase client
 * @param workspaceId - Workspace ID to fetch source content for
 * @returns Normalized workspace source documents
 */
async function fetchWorkspaceSourceDocuments(
  supabase: ReturnType<typeof getServiceClient>,
  workspaceId: string,
): Promise<WorkspaceSourceDocument[]> {
  const sources: WorkspaceSourceDocument[] = [];

  const handbookResult = await supabase
    .from("handbook_chapter")
    .select("handbook_chapter_id, title, content")
    .eq("workspace_id", workspaceId);
  if (handbookResult.error) {
    throw new Error(`Failed to fetch handbook_chapter rows: ${handbookResult.error.message}`);
  }

  for (const row of handbookResult.data ?? []) {
    const body = toPlainText(row.content);
    const content = buildWorkspaceMarkdown(row.title, body);
    if (!content) continue;
    const sourcePath = `handbook_chapter/${row.handbook_chapter_id}`;
    sources.push({
      workspaceId,
      sourceId: row.handbook_chapter_id,
      sourceType: "handbook_chapter",
      sourcePath,
      sourceHash: hashString(content),
      title: row.title ?? "Untitled handbook chapter",
      content,
    });
  }

  const policyResult = await supabase
    .from("policy")
    .select("policy_id, name, description, statement")
    .eq("workspace_id", workspaceId);
  if (policyResult.error) {
    throw new Error(`Failed to fetch policy rows: ${policyResult.error.message}`);
  }

  for (const row of policyResult.data ?? []) {
    const body = [row.statement, row.description].filter((value) => Boolean(value)).join("\n\n");
    const content = buildWorkspaceMarkdown(row.name, body);
    if (!content) continue;
    const sourcePath = `policy/${row.policy_id}`;
    sources.push({
      workspaceId,
      sourceId: row.policy_id,
      sourceType: "policy",
      sourcePath,
      sourceHash: hashString(content),
      title: row.name,
      content,
    });
  }

  const protocolResult = await supabase
    .from("protocol")
    .select("protocol_id, name, description")
    .eq("workspace_id", workspaceId);
  if (protocolResult.error) {
    throw new Error(`Failed to fetch protocol rows: ${protocolResult.error.message}`);
  }

  const protocolIds: string[] = [];
  for (const row of protocolResult.data ?? []) {
    protocolIds.push(row.protocol_id);
    const content = buildWorkspaceMarkdown(row.name, row.description ?? "");
    if (!content) continue;
    const sourcePath = `protocol/${row.protocol_id}`;
    sources.push({
      workspaceId,
      sourceId: row.protocol_id,
      sourceType: "protocol",
      sourcePath,
      sourceHash: hashString(content),
      title: row.name,
      content,
    });
  }

  for (let index = 0; index < protocolIds.length; index += 200) {
    const protocolIdBatch = protocolIds.slice(index, index + 200);
    const procedureResult = await supabase
      .from("procedure")
      .select("procedure_id, protocol_id, name, description")
      .in("protocol_id", protocolIdBatch);

    if (procedureResult.error) {
      throw new Error(`Failed to fetch procedure rows: ${procedureResult.error.message}`);
    }

    for (const row of procedureResult.data ?? []) {
      const content = buildWorkspaceMarkdown(row.name, row.description ?? "");
      if (!content) continue;
      const sourcePath = `procedure/${row.procedure_id}`;
      sources.push({
        workspaceId,
        sourceId: row.procedure_id,
        sourceType: "procedure",
        sourcePath,
        sourceHash: hashString(content),
        title: row.name,
        content,
      });
    }
  }

  return sources;
}

/**
 * Converts a JSON/string field from Supabase into plain text for chunking.
 *
 * @param value - Raw value fetched from Supabase
 * @returns String representation that preserves content semantics
 */
function toPlainText(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }

  if (value === null || value === undefined) {
    return "";
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

/**
 * Builds a markdown-shaped source body for a workspace record.
 *
 * Why: The shared chunker expects markdown-like structure, so we normalize
 * table records into title + body text before splitting into chunks.
 *
 * @param title - Source title or name
 * @param body - Source body text
 * @returns Normalized markdown text
 */
function buildWorkspaceMarkdown(title: string | null | undefined, body: string): string {
  const trimmedTitle = title?.trim() ?? "";
  const trimmedBody = body.trim();

  if (!trimmedTitle && !trimmedBody) {
    return "";
  }

  if (!trimmedTitle) {
    return trimmedBody;
  }

  if (!trimmedBody) {
    return `# ${trimmedTitle}`;
  }

  return `# ${trimmedTitle}\n\n${trimmedBody}`;
}
