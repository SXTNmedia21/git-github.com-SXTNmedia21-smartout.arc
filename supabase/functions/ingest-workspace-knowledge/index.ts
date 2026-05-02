/**
 * ingest-workspace-knowledge — K1b Knowledge Ingestion Edge Function
 *
 * Fetches workspace content (handbook_chapter, policy, protocol), chunks it by
 * heading boundaries, generates embeddings via OpenRouter, and upserts into
 * workspace_doc_chunk for RAG retrieval.
 *
 * Called by: engine-dispatch (action_type: ingest_knowledge), Setup wizard, or directly.
 * Auth: service_role token OR authenticated user with workspace access.
 */

import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// --- Types ---

type SourceType = "handbook_chapter" | "policy" | "protocol";

interface SourceRecord {
  id: string;
  type: SourceType;
  title: string;
  content: string; // plain text after extraction
}

interface ChunkResult {
  source_type: SourceType;
  source_id: string;
  chunk_index: number;
  content: string;
  embedding: number[];
  content_hash: string;
}

// --- TipTap JSON → plain text ---

interface TipTapNode {
  type?: string;
  text?: string;
  content?: TipTapNode[];
}

function extractTipTapText(node: TipTapNode): string {
  if (node.type === "text" && node.text) return node.text;
  if (!node.content) return "";

  const parts = node.content.map((child) => extractTipTapText(child));

  // Block-level nodes get a newline separator so heading boundaries are preserved
  const blockTypes = new Set([
    "paragraph",
    "heading",
    "blockquote",
    "listItem",
    "bulletList",
    "orderedList",
    "codeBlock",
    "horizontalRule",
  ]);
  if (node.type && blockTypes.has(node.type)) {
    return parts.join("") + "\n";
  }

  return parts.join("");
}

// --- Chunking by heading boundaries (max ~1200 tokens ≈ 4800 chars) ---

const MAX_CHUNK_CHARS = 4800;

function chunkByHeadings(text: string): string[] {
  // Split on lines that look like markdown headings (# Heading) or double-newlines
  const lines = text.split("\n");
  const chunks: string[] = [];
  let current = "";

  for (const line of lines) {
    const isHeading = /^#{1,4}\s/.test(line);

    if (isHeading && current.trim().length > 0) {
      // Start a new chunk at each heading, but only if current chunk has content
      chunks.push(current.trim());
      current = line + "\n";
    } else {
      current += line + "\n";

      // Hard-split if we exceed the max size — prevents oversized chunks
      if (current.length > MAX_CHUNK_CHARS) {
        chunks.push(current.trim());
        current = "";
      }
    }
  }

  if (current.trim().length > 0) {
    chunks.push(current.trim());
  }

  return chunks.filter((c) => c.length > 0);
}

// --- SHA-256 hash of text content ---

async function hashContent(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

// --- OpenRouter embeddings (batch up to 100 texts at a time) ---

async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  const openRouterKey = Deno.env.get("OPENROUTER_API_KEY");
  if (!openRouterKey) throw new Error("OPENROUTER_API_KEY is not set");

  const allEmbeddings: number[][] = [];

  // Process in batches of 100 (OpenRouter limit)
  for (let i = 0; i < texts.length; i += 100) {
    const batch = texts.slice(i, i + 100);

    const response = await fetch("https://openrouter.ai/api/v1/embeddings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openRouterKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openai/text-embedding-3-small",
        input: batch,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenRouter embedding request failed: ${response.status} — ${errorText}`);
    }

    const result = await response.json();
    const batchEmbeddings = result.data.map((item: { embedding: number[] }) => item.embedding);
    allEmbeddings.push(...batchEmbeddings);
  }

  return allEmbeddings;
}

// --- Main handler ---

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Validate Authorization header is present before reading body
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Missing authorization" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 401,
    });
  }

  try {
    const body = await req.json();
    const {
      workspace_id,
      force = false,
      source_type = null,
      source_id = null,
      trigger = null,
    } = body as {
      workspace_id?: string;
      force?: boolean;
      source_type?: SourceType | null;
      source_id?: string | null;
      trigger?: "create" | "update" | "delete" | null;
    };

    if (!workspace_id) {
      return new Response(JSON.stringify({ error: "workspace_id is required" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    // M2.3 — source-targeted DELETE path. When governance Server Action emits
    // governance.content_updated with trigger='delete', engine-dispatch routes
    // here. Remove all chunks for the (source_type, source_id) tuple. No
    // re-embed needed — the source row is gone (or about to be).
    if (trigger === "delete" && source_type && source_id) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, serviceKey);

      const { error: delErr } = await supabase
        .from("workspace_doc_chunk")
        .delete()
        .eq("workspace_id", workspace_id)
        .eq("source_type", source_type)
        .eq("source_id", source_id);

      if (delErr) {
        return new Response(
          JSON.stringify({ status: "error", error: delErr.message }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 500,
          },
        );
      }

      return new Response(
        JSON.stringify({
          status: "ok",
          mode: "delete",
          source_type,
          source_id,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        },
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // --- Auth validation ---
    // Accept service_role directly, otherwise validate user has workspace access
    const callerToken = authHeader.replace("Bearer ", "");
    const isServiceRole = callerToken === serviceKey;

    if (!isServiceRole) {
      // Validate the JWT and check workspace membership
      const userClient = createClient(supabaseUrl, callerToken);
      const {
        data: { user },
      } = await userClient.auth.getUser();

      if (!user) {
        return new Response(JSON.stringify({ error: "Invalid or expired token" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 401,
        });
      }

      // Verify the user actually belongs to this workspace
      const { data: membership } = await userClient
        .from("profile")
        .select("profile_id")
        .eq("workspace_id", workspace_id)
        .eq("user_id", user.id)
        .maybeSingle();

      if (!membership) {
        return new Response(JSON.stringify({ error: "No access to this workspace" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 403,
        });
      }
    }

    // Use service role for all subsequent DB operations — we've already validated access
    const supabase = createClient(supabaseUrl, serviceKey);

    // --- Fetch source records from the 3 tables ---
    // M2.3: when source_type + source_id are provided (governance.content_updated
    // path), fetch ONLY that single row instead of scanning the workspace.
    // Falls through to workspace-wide ingest when filters are absent.

    const isSourceTargeted = Boolean(source_type && source_id);

    let handbookData: Array<{ handbook_chapter_id: string; title: string; content: unknown }> = [];
    let policyData: Array<{ policy_id: string; name: string; statement: string }> = [];
    let protocolData: Array<{ protocol_id: string; name: string; description: string | null }> = [];

    if (isSourceTargeted && source_type === "handbook_chapter") {
      const { data } = await supabase
        .from("handbook_chapter")
        .select("handbook_chapter_id, title, content")
        .eq("workspace_id", workspace_id)
        .eq("handbook_chapter_id", source_id);
      handbookData = data ?? [];
    } else if (isSourceTargeted && source_type === "policy") {
      const { data } = await supabase
        .from("policy")
        .select("policy_id, name, statement")
        .eq("workspace_id", workspace_id)
        .eq("policy_id", source_id);
      policyData = data ?? [];
    } else if (isSourceTargeted && source_type === "protocol") {
      const { data } = await supabase
        .from("protocol")
        .select("protocol_id, name, description")
        .eq("workspace_id", workspace_id)
        .eq("protocol_id", source_id);
      protocolData = data ?? [];
    } else {
      const [handbookResult, policyResult, protocolResult] = await Promise.all([
        supabase
          .from("handbook_chapter")
          .select("handbook_chapter_id, title, content")
          .eq("workspace_id", workspace_id),

        supabase
          .from("policy")
          .select("policy_id, name, statement")
          .eq("workspace_id", workspace_id),

        supabase
          .from("protocol")
          .select("protocol_id, name, description")
          .eq("workspace_id", workspace_id),
      ]);
      handbookData = handbookResult.data ?? [];
      policyData = policyResult.data ?? [];
      protocolData = protocolResult.data ?? [];
    }

    const handbookResult = { data: handbookData };
    const policyResult = { data: policyData };
    const protocolResult = { data: protocolData };

    const sources: SourceRecord[] = [];

    for (const chapter of handbookResult.data ?? []) {
      // handbook_chapter.content is TipTap JSON — extract to plain text
      let plainText = "";
      try {
        const doc =
          typeof chapter.content === "string" ? JSON.parse(chapter.content) : chapter.content;
        plainText = extractTipTapText(doc as TipTapNode).trim();
      } catch {
        // If content isn't valid TipTap, fall back to stringifying it
        plainText = String(chapter.content ?? "");
      }

      if (plainText.length > 0) {
        sources.push({
          id: chapter.handbook_chapter_id,
          type: "handbook_chapter",
          title: chapter.title,
          content: plainText,
        });
      }
    }

    for (const policy of policyResult.data ?? []) {
      const text = (policy.statement ?? "").trim();
      if (text.length > 0) {
        sources.push({
          id: policy.policy_id,
          type: "policy",
          title: policy.name,
          content: text,
        });
      }
    }

    for (const protocol of protocolResult.data ?? []) {
      const text = (protocol.description ?? "").trim();
      if (text.length > 0) {
        sources.push({
          id: protocol.protocol_id,
          type: "protocol",
          title: protocol.name,
          content: text,
        });
      }
    }

    // --- Load existing chunk hashes to detect unchanged content ---

    const { data: existingChunks } = await supabase
      .from("workspace_doc_chunk")
      .select("source_type, source_id, content_hash")
      .eq("workspace_id", workspace_id);

    // Build a map of "source_type:source_id" → Set of existing hashes
    const existingHashMap = new Map<string, Set<string>>();
    for (const chunk of existingChunks ?? []) {
      const key = `${chunk.source_type}:${chunk.source_id}`;
      if (!existingHashMap.has(key)) existingHashMap.set(key, new Set());
      existingHashMap.get(key)!.add(chunk.content_hash);
    }

    // --- Determine which sources have changed ---

    const sourcesToProcess: SourceRecord[] = [];

    await Promise.all(
      sources.map(async (source) => {
        const fullHash = await hashContent(source.content);
        const key = `${source.type}:${source.id}`;
        const existingHashes = existingHashMap.get(key);

        // Process if forced, or if we have no chunks yet, or if the content hash changed
        const hasChanges = !existingHashes || !existingHashes.has(fullHash);

        if (force || hasChanges) {
          sourcesToProcess.push(source);
        }
      }),
    );

    if (sourcesToProcess.length === 0) {
      return new Response(
        JSON.stringify({
          status: "skipped",
          sources: 0,
          chunks: 0,
          message: "All content is up to date",
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        },
      );
    }

    // --- Chunk all sources that need processing ---

    const allChunkData: Array<{ source: SourceRecord; chunkText: string; chunkIndex: number }> = [];

    for (const source of sourcesToProcess) {
      const chunks = chunkByHeadings(source.content);
      chunks.forEach((chunkText, chunkIndex) => {
        allChunkData.push({ source, chunkText, chunkIndex });
      });
    }

    // --- Generate embeddings for all chunks in one batched call ---

    const chunkTexts = allChunkData.map(({ chunkText }) => chunkText);
    const embeddings = await generateEmbeddings(chunkTexts);

    // --- Build final chunk records with hashes ---

    const chunkRecords = await Promise.all(
      allChunkData.map(async ({ source, chunkText, chunkIndex }, i) => {
        const contentHash = await hashContent(chunkText);
        const sourcePath = `${source.type}/${source.id}`;
        const sourceHash = await hashContent(source.content);
        const tokenCount = Math.ceil(chunkText.length / 4);
        return {
          workspace_id,
          source_type: source.type,
          source_id: source.id,
          source_path: sourcePath,
          source_hash: sourceHash,
          chunk_index: chunkIndex,
          title: source.title,
          content: chunkText,
          token_count: tokenCount,
          embedding: JSON.stringify(embeddings[i]),
          content_hash: contentHash,
          metadata: { title: source.title, source_id: source.id },
        };
      }),
    );

    // --- Replace stale chunks transactionally (M2.3 T11 — insert-then-delete-old) ---
    // Prior implementation deleted-then-inserted, which created a partial-failure
    // window: if generateEmbeddings or insert errored mid-run, deletes had
    // already committed and the source's chunks were missing entirely. New flow:
    //
    //   1. Insert new rows under a temporary chunk_index offset (10000+)
    //   2. Delete old rows (chunk_index < 10000)
    //   3. Renumber temporary rows back to chunk_index 0..N
    //
    // If step 1 fails, no deletes happen — prior chunks intact. If step 2/3
    // fails after step 1, prior chunks remain alongside new (high chunk_index)
    // ones — searchKnowledge still returns valid results, manual cleanup possible.
    // True transactionality requires an RPC; this is the closest ergonomic
    // approximation without one.

    const TEMP_CHUNK_OFFSET = 10000;

    const tempChunkRecords = chunkRecords.map((r) => ({
      ...r,
      chunk_index: r.chunk_index + TEMP_CHUNK_OFFSET,
    }));

    // Step 1: insert new rows at temp chunk_index — fails atomically if embeddings
    // or insert error. Old chunks untouched at this point.
    const { error: insertError } = await supabase
      .from("workspace_doc_chunk")
      .insert(tempChunkRecords);

    if (insertError) {
      throw new Error(`Failed to insert chunks: ${insertError.message}`);
    }

    const sourceIdsToReplace = sourcesToProcess.map((s) => ({
      source_type: s.type,
      source_id: s.id,
    }));

    // Step 2: delete old rows (chunk_index < TEMP_CHUNK_OFFSET) for replaced sources.
    await Promise.all(
      sourceIdsToReplace.map(({ source_type, source_id }) =>
        supabase
          .from("workspace_doc_chunk")
          .delete()
          .eq("workspace_id", workspace_id)
          .eq("source_type", source_type)
          .eq("source_id", source_id)
          .lt("chunk_index", TEMP_CHUNK_OFFSET),
      ),
    );

    // Step 3: renumber temp rows back to canonical chunk_index 0..N. We update
    // each row by chunk_index since (workspace_id, source_type, source_id,
    // chunk_index) is the canonical identity. Done sequentially per (source) to
    // avoid PK collisions.
    await Promise.all(
      tempChunkRecords.map((r) =>
        supabase
          .from("workspace_doc_chunk")
          .update({ chunk_index: r.chunk_index - TEMP_CHUNK_OFFSET })
          .eq("workspace_id", workspace_id)
          .eq("source_type", r.source_type)
          .eq("source_id", r.source_id)
          .eq("chunk_index", r.chunk_index),
      ),
    );

    // --- Log completion to activity_trail ---

    try {
      await supabase.from("activity_trail").insert({
        workspace_id,
        event: "knowledge ingestion_completed",
        actor_id: "system",
        properties: { sources: sourcesToProcess.length, chunks: chunkRecords.length },
      });
    } catch {
      // Non-fatal — don't let audit log failure break the response
    }

    return new Response(
      JSON.stringify({
        status: "ok",
        sources: sourcesToProcess.length,
        chunks: chunkRecords.length,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      },
    );
  } catch (error: unknown) {
    console.error("ingest-workspace-knowledge error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      },
    );
  }
});
