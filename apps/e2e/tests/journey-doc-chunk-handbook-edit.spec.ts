/**
 * journey-doc-chunk-handbook-edit.spec.ts — M2.3 Journey 1
 *
 * Verifies that updating a handbook_chapter content via service-role UPDATE,
 * followed by an engine_event emission with event_type='governance.content_updated',
 * triggers re-ingestion and workspace_doc_chunk content update within 35 seconds.
 *
 * This test validates the auto-update pipeline for handbook content:
 * 1. Admin auth (implicit via service-role ops; test runs unauthenticated)
 * 2. Seed handbook_chapter with OLD content
 * 3. Pre-seed workspace_doc_chunk to simulate "already ingested" state
 * 4. Update handbook_chapter content to NEW value via service-role
 * 5. Emit engine_event with governance.content_updated trigger
 * 6. Poll workspace_doc_chunk until content matches NEW value or timeout
 * 7. Assert successful update or fail with diagnostics
 *
 * Note: This test does NOT call the handbook edit Server Action directly.
 * Instead, it simulates the result (content update + event emission) to keep
 * the test deterministic and decouple from UI/Server Action behavior.
 *
 * Approach: Direct service-role ops + polling. If engine-dispatch worker is not
 * running in test env, the ingest may not fire; fall back to test.skip with reason.
 */

import { test, expect } from "@playwright/test";
import { supabase } from "../helpers/seed";
import { v4 as uuidv4 } from "uuid";
import crypto from "crypto";

const HQ_WORKSPACE_ID = "b0000000-0000-0000-0000-000000000000"; // Seed workspace
const ADMIN_PROFILE_ID = "a0000000-0000-0000-0000-000000000000"; // Seed admin profile

function computeHash(text: string): string {
  return crypto.createHash("sha256").update(text).digest("hex");
}

function createHandbookContent(text: string): object {
  return {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [{ type: "text", text }],
      },
    ],
  };
}

test("handbook edit triggers workspace_doc_chunk auto-update via engine_event", async () => {
  test.setTimeout(60_000);

  const chapterId = uuidv4();
  const chapterKey = `test-handbook-m2.3-${chapterId.slice(0, 8)}`;
  const oldContent = "VAKTSTART KL 09 - Møt opp 15 minutter før skiftet starter";
  const newContent = "VAKTSTART KL 08 - Møt opp 30 minutter før skiftet starter";

  try {
    // -------------------------------------------------------------------------
    // Step 1: Clean up any leftover test data
    // -------------------------------------------------------------------------
    await supabase
      .from("workspace_doc_chunk")
      .delete()
      .eq("workspace_id", HQ_WORKSPACE_ID)
      .like("source_path", `%${chapterKey}%`);

    await supabase
      .from("handbook_chapter")
      .delete()
      .eq("workspace_id", HQ_WORKSPACE_ID)
      .eq("chapter_key", chapterKey);

    // -------------------------------------------------------------------------
    // Step 2: Seed handbook_chapter with OLD content
    // -------------------------------------------------------------------------
    const insertRes = await supabase.from("handbook_chapter").insert({
      handbook_chapter_id: chapterId,
      workspace_id: HQ_WORKSPACE_ID,
      chapter_key: chapterKey,
      title: "Test Handbook Chapter",
      content: createHandbookContent(oldContent),
    });

    expect(insertRes.error).toBeNull();

    // -------------------------------------------------------------------------
    // Step 3: Pre-seed workspace_doc_chunk with OLD content
    // (simulates "already ingested" state)
    // -------------------------------------------------------------------------
    const oldHash = computeHash(oldContent);
    const sourceHash = computeHash(chapterKey);

    const chunkInsertRes = await supabase.from("workspace_doc_chunk").insert({
      workspace_id: HQ_WORKSPACE_ID,
      source_type: "handbook_chapter",
      source_id: chapterId,
      source_path: `/handbook/${chapterKey}`,
      source_hash: sourceHash,
      content: oldContent,
      content_hash: oldHash,
      title: "Test Handbook Chapter",
      token_count: 20,
      metadata: {
        chapter_key: chapterKey,
        source_type: "handbook_chapter",
      },
    });

    expect(chunkInsertRes.error).toBeNull();

    // -------------------------------------------------------------------------
    // Step 4: Update handbook_chapter content to NEW value
    // -------------------------------------------------------------------------
    const updateRes = await supabase
      .from("handbook_chapter")
      .update({
        content: createHandbookContent(newContent),
        updated_at: new Date().toISOString(),
        updated_by: ADMIN_PROFILE_ID,
      })
      .eq("handbook_chapter_id", chapterId);

    expect(updateRes.error).toBeNull();

    // -------------------------------------------------------------------------
    // Step 5: Emit engine_event to trigger re-ingestion
    // (simulates the emit() call from Server Action)
    // -------------------------------------------------------------------------
    const eventRes = await supabase.from("engine_event").insert({
      event_type: "governance.content_updated",
      workspace_id: HQ_WORKSPACE_ID,
      payload: {
        source_type: "handbook_chapter",
        source_id: chapterId,
        trigger: "update",
        actor_id: ADMIN_PROFILE_ID,
        workspace_id: HQ_WORKSPACE_ID,
      },
    });

    expect(eventRes.error).toBeNull();

    // -------------------------------------------------------------------------
    // Step 6: Poll workspace_doc_chunk for updated content
    // (up to 35s with 1s interval, per M2.3 spec)
    // -------------------------------------------------------------------------
    const maxAttempts = 35;
    let attempt = 0;
    let found = false;
    let chunkCount = 0;

    while (attempt < maxAttempts && !found) {
      await new Promise((resolve) => setTimeout(resolve, 1000)); // 1s poll interval
      attempt += 1;

      const { data: chunks, error } = await supabase
        .from("workspace_doc_chunk")
        .select("content, content_hash")
        .eq("workspace_id", HQ_WORKSPACE_ID)
        .eq("source_id", chapterId);

      if (error) {
        console.error(`Poll attempt ${attempt}: query error`, error);
        continue;
      }

      chunkCount = chunks?.length ?? 0;

      if (chunks && chunks.length > 0) {
        for (const chunk of chunks) {
          if (chunk.content.includes(newContent)) {
            found = true;
            break;
          }
        }
      }

      if (attempt % 5 === 0) {
        console.log(`Poll attempt ${attempt}: ${chunkCount} chunk(s), found=${found}`);
      }
    }

    // -------------------------------------------------------------------------
    // Step 7: Assert successful update within window
    // -------------------------------------------------------------------------
    if (!found) {
      const { data: diagChunks } = await supabase
        .from("workspace_doc_chunk")
        .select("content, content_hash, source_id")
        .eq("workspace_id", HQ_WORKSPACE_ID)
        .eq("source_id", chapterId)
        .limit(5);

      const diagnostics = {
        message: `Timeout: workspace_doc_chunk not updated within ${maxAttempts}s`,
        expectedContent: newContent,
        foundChunks: chunkCount,
        chunkSample: diagChunks?.map((c) => ({
          content: c.content.slice(0, 50),
          hash: c.content_hash,
        })),
      };

      console.error("TIMEOUT DIAGNOSTICS:", JSON.stringify(diagnostics, null, 2));
    }

    expect(found).toBeTruthy();
  } finally {
    // -------------------------------------------------------------------------
    // Cleanup: delete seeded rows
    // -------------------------------------------------------------------------
    try {
      await supabase
        .from("workspace_doc_chunk")
        .delete()
        .eq("workspace_id", HQ_WORKSPACE_ID)
        .eq("source_id", chapterId);

      await supabase.from("handbook_chapter").delete().eq("handbook_chapter_id", chapterId);
    } catch (err) {
      console.error("Cleanup error:", err);
    }
  }
});
