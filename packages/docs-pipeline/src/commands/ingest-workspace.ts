// ============================================
// ingest-workspace.ts
// Workspace ingestion command for the docs pipeline.
// Reads handbook_chapter, policy, protocol, procedure from Supabase,
// chunks the content, and upserts into workspace_doc_chunk.
// Connected to: src/db/operations.ts (upsertWorkspaceChunks)
// Connected to: src/chunking/chunker.ts (document chunking)
// Connected to: src/embedding/client.ts (OpenRouter embeddings)
// ============================================

import { getServiceClient } from "../db/client";
import { chunkDocument } from "../chunking/chunker";
import { hashString } from "../utils/hash";
import { upsertWorkspaceChunks } from "../db/operations";
import { generateEmbeddings } from "../embedding/client";
import { estimateTokens } from "../utils/tokens";

/**
 * Options for the workspace ingest command.
 */
export type WorkspaceIngestOptions = {
  /** Workspace ID to ingest content for */
  workspaceId: string;
  /** Re-process all content regardless of hash changes */
  force: boolean;
  /** Log what would happen without making changes */
  dryRun: boolean;
};

/**
 * Source tables to read workspace content from.
 * Each entry maps a Supabase table to the fields we need.
 */
const WORKSPACE_SOURCES = [
  {
    table: "handbook_chapter",
    sourceType: "handbook",
    titleField: "title",
    contentField: "content",
    idField: "id",
  },
  {
    table: "policy",
    sourceType: "policy",
    titleField: "title",
    contentField: "content",
    idField: "policy_id",
  },
  {
    table: "protocol",
    sourceType: "protocol",
    titleField: "title",
    contentField: "content",
    idField: "protocol_id",
  },
  {
    table: "procedure",
    sourceType: "procedure",
    titleField: "title",
    contentField: "content",
    idField: "procedure_id",
  },
] as const;

/**
 * A row fetched from one of the workspace source tables.
 */
type SourceRow = {
  id: string;
  title: string;
  content: string;
  sourceType: string;
  sourcePath: string;
};

/**
 * Fetches all content rows from a workspace source table.
 *
 * Why: We query each governance table separately because they have
 * different schemas and ID column names. The result is normalized
 * into a common SourceRow shape for uniform processing.
 */
async function fetchSourceRows(
  supabase: ReturnType<typeof getServiceClient>,
  workspaceId: string,
  source: (typeof WORKSPACE_SOURCES)[number],
): Promise<SourceRow[]> {
  const { data, error } = await supabase
    .from(source.table)
    .select(`${source.idField}, ${source.titleField}, ${source.contentField}`)
    .eq("workspace_id", workspaceId);

  if (error) {
    throw new Error(`Failed to fetch ${source.table}: ${error.message}`);
  }

  if (!data || data.length === 0) return [];

  return (data as Record<string, unknown>[]).map((row) => ({
    id: String(row[source.idField]),
    title: String(row[source.titleField] ?? "Untitled"),
    content: String(row[source.contentField] ?? ""),
    sourceType: source.sourceType,
    sourcePath: `${source.sourceType}/${row[source.idField]}`,
  }));
}

/**
 * Runs the workspace content ingestion pipeline.
 *
 * Why: Workspace-specific content (handbook chapters, policies, protocols,
 * procedures) needs to be chunked and embedded for contextual search
 * within a workspace. This is separate from the platform docs pipeline
 * because workspace content lives in Supabase tables, not on disk.
 *
 * Steps:
 * 1. Fetch content from handbook_chapter, policy, protocol, procedure
 * 2. Hash each row and compare against stored hashes (skip unchanged)
 * 3. Chunk changed content using the standard chunker
 * 4. Generate embeddings
 * 5. Upsert chunks into workspace_doc_chunk
 */
export async function runWorkspaceIngest(options: WorkspaceIngestOptions): Promise<void> {
  const { workspaceId, force, dryRun } = options;

  console.log(`\n📚 Workspace Content Ingestion`);
  console.log(`   Workspace: ${workspaceId} | Force: ${force} | Dry Run: ${dryRun}\n`);

  const supabase = getServiceClient();

  // Step 1: Fetch all content from source tables
  const allRows: SourceRow[] = [];

  for (const source of WORKSPACE_SOURCES) {
    const rows = await fetchSourceRows(supabase, workspaceId, source);
    console.log(`   ${source.table}: ${rows.length} rows`);
    allRows.push(...rows);
  }

  console.log(`\n   Total source rows: ${allRows.length}\n`);

  if (allRows.length === 0) {
    console.log("   No content to process. Done.\n");
    return;
  }

  // Step 2: Hash content and determine what changed
  const rowsWithHashes = allRows
    .filter((row) => row.content.trim().length > 0)
    .map((row) => ({
      ...row,
      contentHash: hashString(row.content),
    }));

  // Fetch existing hashes from workspace_doc_chunk for this workspace
  let existingHashes = new Map<string, string>();
  if (!force && !dryRun) {
    existingHashes = await getExistingWorkspaceHashes(supabase, workspaceId);
  }

  const changedRows = force
    ? rowsWithHashes
    : rowsWithHashes.filter((row) => {
        const existing = existingHashes.get(row.sourcePath);
        return existing !== row.contentHash;
      });

  console.log(
    `   Changed: ${changedRows.length} | Unchanged: ${rowsWithHashes.length - changedRows.length}\n`,
  );

  if (changedRows.length === 0) {
    console.log("   Everything up to date. 0 changes needed.\n");
    return;
  }

  // Step 3: Chunk changed content
  type WorkspaceChunkRow = {
    workspace_id: string;
    source_type: string;
    source_path: string;
    source_hash: string;
    content_hash: string;
    chunk_index: number;
    title: string | null;
    content: string;
    token_count: number;
    metadata: Record<string, unknown>;
    embedding: number[] | null;
  };

  const allChunks: WorkspaceChunkRow[] = [];

  for (const row of changedRows) {
    const chunks = chunkDocument(row.content, row.sourcePath, row.contentHash);

    for (const chunk of chunks) {
      allChunks.push({
        workspace_id: workspaceId,
        source_type: row.sourceType,
        source_path: row.sourcePath,
        source_hash: row.contentHash,
        content_hash: chunk.contentHash,
        chunk_index: chunk.chunkIndex,
        title: row.title,
        content: chunk.content,
        token_count: chunk.tokenCount,
        metadata: {
          ...chunk.metadata,
          source_id: row.id,
          source_type: row.sourceType,
        },
        embedding: null,
      });
    }

    console.log(`   Chunked: ${row.sourcePath} (${row.title}) -> ${chunks.length} chunks`);
  }

  console.log(`\n   Total chunks: ${allChunks.length}\n`);

  if (dryRun) {
    console.log(`   [DRY RUN] Would upsert ${allChunks.length} chunks into workspace_doc_chunk`);
    for (const row of changedRows) {
      console.log(`     - ${row.sourcePath} (${row.title})`);
    }
    console.log();
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

  // Step 5: Upsert into workspace_doc_chunk
  console.log(`   Upserting ${chunksWithEmbeddings.length} chunks...`);
  await upsertWorkspaceChunks(supabase, chunksWithEmbeddings);

  console.log(
    `\n   Done! Processed ${changedRows.length} sources into ${chunksWithEmbeddings.length} chunks.\n`,
  );
}

/**
 * Fetches existing source hashes from workspace_doc_chunk for a workspace.
 *
 * Why: We compare stored hashes against content hashes to skip
 * re-embedding unchanged content.
 */
async function getExistingWorkspaceHashes(
  supabase: ReturnType<typeof getServiceClient>,
  workspaceId: string,
): Promise<Map<string, string>> {
  const hashMap = new Map<string, string>();
  let offset = 0;
  const pageSize = 1000;

  while (true) {
    // workspace_doc_chunk may not be in database.types.ts yet — cast to any
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = (await (supabase as any)
      .from("workspace_doc_chunk")
      .select("source_path, source_hash")
      .eq("workspace_id", workspaceId)
      .range(offset, offset + pageSize - 1)) as {
      data: Array<{ source_path: string; source_hash: string }> | null;
      error: { message: string } | null;
    };

    if (error) {
      throw new Error(`Failed to fetch existing workspace hashes: ${error.message}`);
    }

    if (!data || data.length === 0) break;

    for (const row of data) {
      if (!hashMap.has(row.source_path)) {
        hashMap.set(row.source_path, row.source_hash);
      }
    }

    if (data.length < pageSize) break;
    offset += pageSize;
  }

  return hashMap;
}
