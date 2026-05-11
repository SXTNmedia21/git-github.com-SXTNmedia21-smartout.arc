// =============================================================================
// helpers/onboarding-harness.ts
//
// Onboarding-capability-specific helpers for the onboarding harness E2E spec.
//
// Responsibilities:
//   - Create / tear-down test-scoped season rows for update_season assertions.
//   - Create / tear-down test-scoped protocol rows for add_procedures assertions.
//   - Expose assertWorkspaceField() for update_business assertions.
//
// The workspace row itself (SEED_WORKSPACE_ID) is shared with the larger seed.
// We only patch fields (name/niche) in place and restore them at teardown —
// we never DELETE the workspace row.
//
// Season + protocol rows created here are cleaned up by cleanupOnboardingTestData().
// Run this in afterAll to avoid leaving test noise in the DB.
//
// ADR refs: ADR-0099 (gate_action bypassed here because we use the service-role
// client directly — tests must not call gate_action; they verify it was called
// by the production path). ADR-0134 (we do not emit here — production code emits,
// tests assert the trail row exists).
// =============================================================================

import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";
import { supabase } from "./seed";
import { SEED_PROFILE_ID, SEED_WORKSPACE_ID } from "./botsson-harness";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** ISO-tag used to identify rows created by onboarding E2E tests. */
export const ONBOARDING_E2E_TAG = "onboarding-e2e-test";

// ---------------------------------------------------------------------------
// Setup: snapshot workspace metadata before tests touch it
// ---------------------------------------------------------------------------

export type WorkspaceSnapshot = {
  name: string | null;
  niche: string | null;
  concept_description: string | null;
};

/**
 * Read current workspace metadata fields that update_business may overwrite.
 * Call once in beforeAll; pass the result to restoreWorkspaceSnapshot() in afterAll.
 */
export async function snapshotWorkspace(): Promise<WorkspaceSnapshot> {
  const { data, error } = await supabase
    .from("workspace")
    .select("name, niche, concept_description")
    .eq("workspace_id", SEED_WORKSPACE_ID)
    .single();

  if (error || !data) {
    throw new Error(`snapshotWorkspace: could not read workspace row: ${error?.message}`);
  }
  return {
    name: (data as Record<string, unknown>).name as string | null,
    niche: (data as Record<string, unknown>).niche as string | null,
    concept_description: (data as Record<string, unknown>).concept_description as string | null,
  };
}

/**
 * Restore workspace metadata to the values captured by snapshotWorkspace().
 * Should be called in afterAll to undo update_business test writes.
 */
export async function restoreWorkspaceSnapshot(snapshot: WorkspaceSnapshot): Promise<void> {
  await supabase
    .from("workspace")
    .update({
      name: snapshot.name,
      niche: snapshot.niche,
      concept_description: snapshot.concept_description,
      updated_at: new Date().toISOString(),
    })
    .eq("workspace_id", SEED_WORKSPACE_ID);
}

// ---------------------------------------------------------------------------
// Assertion: workspace field value
// ---------------------------------------------------------------------------

/**
 * Read a single field from the workspace row and assert its current value
 * matches the expected string. Non-polling — call after confirming the BFF
 * response was 200 OK (no async lag for workspace UPDATE).
 */
export async function assertWorkspaceField(field: string, expectedValue: string): Promise<void> {
  const { data, error } = await supabase
    .from("workspace")
    .select(field)
    .eq("workspace_id", SEED_WORKSPACE_ID)
    .single();

  expect(error, `assertWorkspaceField(${field}): DB query failed: ${error?.message}`).toBeNull();
  const actual = (data as unknown as Record<string, unknown>)?.[field];
  expect(
    actual,
    `assertWorkspaceField: expected workspace.${field} = "${expectedValue}", got "${String(actual)}"`,
  ).toBe(expectedValue);
}

// ---------------------------------------------------------------------------
// Assertion: season row
// ---------------------------------------------------------------------------

export type SeasonRowResult = {
  season_id: string;
  name: string;
  start_date: string;
  end_date: string;
  status: string;
  workspace_id: string;
};

/**
 * Assert that a season row with the given name exists in the workspace.
 * Polls up to 15s to tolerate async LLM → tool → DB write latency.
 */
export async function assertSeasonRow(
  seasonName: string,
  workspaceId: string = SEED_WORKSPACE_ID,
): Promise<SeasonRowResult> {
  const deadline = Date.now() + 15_000;
  let lastError: string | null = null;

  while (Date.now() < deadline) {
    const { data, error } = await supabase
      .from("season")
      .select("season_id, name, start_date, end_date, status, workspace_id")
      .eq("workspace_id", workspaceId)
      .ilike("name", `%${seasonName}%`)
      .order("created_at", { ascending: false })
      .limit(1);

    if (error) {
      lastError = error.message;
    } else if (data && data.length > 0) {
      return data[0] as SeasonRowResult;
    }

    await new Promise((r) => setTimeout(r, 600));
  }

  // Timed out — dump recent seasons for diagnosis.
  const { data: recent } = await supabase
    .from("season")
    .select("season_id, name, start_date, end_date, status, created_at")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false })
    .limit(5);

  const dump = JSON.stringify(recent ?? [], null, 2);
  expect(
    null,
    `assertSeasonRow: no season row with name containing "${seasonName}" found.\n` +
      `Last error: ${lastError ?? "none"}\n\nRecent season rows:\n${dump}`,
  ).not.toBeNull();
  throw new Error("unreachable");
}

// ---------------------------------------------------------------------------
// Assertion: protocol row (for add_procedures)
// ---------------------------------------------------------------------------

export type ProtocolRowResult = {
  protocol_id: string;
  title: string;
  status: string;
  workspace_id: string;
  created_by: string | null;
};

/**
 * Assert that a protocol row with the given title fragment exists.
 * Polls up to 15s to tolerate async write latency.
 */
export async function assertProtocolRow(
  titleFragment: string,
  workspaceId: string = SEED_WORKSPACE_ID,
): Promise<ProtocolRowResult> {
  const deadline = Date.now() + 15_000;
  let lastError: string | null = null;

  while (Date.now() < deadline) {
    const { data, error } = await supabase
      .from("protocol")
      .select("protocol_id, title, status, workspace_id, created_by")
      .eq("workspace_id", workspaceId)
      .ilike("title", `%${titleFragment}%`)
      .order("created_at", { ascending: false })
      .limit(1);

    if (error) {
      lastError = error.message;
    } else if (data && data.length > 0) {
      return data[0] as ProtocolRowResult;
    }

    await new Promise((r) => setTimeout(r, 600));
  }

  const { data: recent } = await supabase
    .from("protocol")
    .select("protocol_id, title, status, created_at")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false })
    .limit(5);

  const dump = JSON.stringify(recent ?? [], null, 2);
  expect(
    null,
    `assertProtocolRow: no protocol row with title containing "${titleFragment}".\n` +
      `Last error: ${lastError ?? "none"}\n\nRecent protocol rows:\n${dump}`,
  ).not.toBeNull();
  throw new Error("unreachable");
}

// ---------------------------------------------------------------------------
// Teardown: clean up E2E test data
// ---------------------------------------------------------------------------

/**
 * Delete season rows + season_budget rows created during onboarding E2E tests.
 * Scoped to SEED_WORKSPACE_ID — never touches other workspaces.
 *
 * Deletes ALL seasons for the seed workspace that were created during this
 * test run. We do not tag season rows; instead we delete by workspace_id
 * since the seed workspace is test-only and no production seasons should exist.
 */
export async function cleanupTestSeasons(workspaceId: string = SEED_WORKSPACE_ID): Promise<void> {
  // Fetch season IDs first so we can delete season_budget rows too.
  const { data: seasons } = await supabase
    .from("season")
    .select("season_id")
    .eq("workspace_id", workspaceId);

  if (!seasons || seasons.length === 0) return;

  const ids = seasons.map((s: Record<string, unknown>) => s.season_id as string);

  // Delete season_budget rows (FK dependency).
  await supabase.from("season_budget").delete().in("season_id", ids);

  // Delete season rows.
  await supabase.from("season").delete().in("season_id", ids);
}

/**
 * Delete protocol rows created during onboarding E2E tests.
 * Scoped to SEED_WORKSPACE_ID.
 */
export async function cleanupTestProtocols(workspaceId: string = SEED_WORKSPACE_ID): Promise<void> {
  // Delete protocols where created_by matches the seed profile (test-created rows).
  await supabase
    .from("protocol")
    .delete()
    .eq("workspace_id", workspaceId)
    .eq("created_by", SEED_PROFILE_ID);
}

// ---------------------------------------------------------------------------
// BFF chat helper for onboarding-scoped messages
// ---------------------------------------------------------------------------

export type OnboardingChatResult = {
  ok: boolean;
  status: number;
  text: string;
  sessionId: string | null;
  intent: string | null;
};

/**
 * POST /api/botsson/chat with an onboarding-context message.
 * Returns parsed body. Caller is responsible for checking ok + asserting content.
 */
export async function sendOnboardingMessage(
  page: Page,
  userMessage: string,
  sessionId?: string,
): Promise<OnboardingChatResult> {
  const body: Record<string, unknown> = {
    workspaceId: SEED_WORKSPACE_ID,
    userMessage,
  };
  if (sessionId) {
    body.sessionId = sessionId;
  }

  const res = await page.request.post("/api/botsson/chat", {
    data: body,
    headers: { "content-type": "application/json" },
  });

  const statusCode = res.status();
  let parsedBody: { text?: string; sessionId?: string; intent?: string } = {};
  try {
    parsedBody = (await res.json()) as { text?: string; sessionId?: string; intent?: string };
  } catch {
    // Non-JSON error body.
  }

  return {
    ok: res.ok(),
    status: statusCode,
    text: parsedBody.text ?? "",
    sessionId: parsedBody.sessionId ?? null,
    intent: parsedBody.intent ?? null,
  };
}
