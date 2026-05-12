// =============================================================================
// helpers/engine-world-harness.ts
//
// Assertion helpers for the engine-world capability harness E2E spec.
// Extends botsson-harness.ts with engine_world-specific polling helpers.
//
// Capability contract:
//   - read_surface / read_surface_class are READ-ONLY — no emit (L-0094).
//     They do NOT produce botsson.tool_invoked rows in activity_trail.
//   - report_observation is a gated WRITE — emits:
//       "engine_world observation_written" (always on success)
//       "engine_world status_changed" (when prior_status != new status)
//     via packages/telemetry. activity_trail rows use dot-form event names
//     (packages/telemetry/src/providers/engine-event.ts toDotNotation).
//
// ADR refs: ADR-0281 (engine_world), ADR-0290 (platform RPC),
//           ADR-0184 (recorder flush interval), ADR-0099 (gate_action),
//           ADR-0078 (channel guard), ADR-0134 (telemetry),
//           ADR-0151 (server-side workspace derivation).
// =============================================================================

import { expect } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  SEED_PROFILE_ID,
  SEED_WORKSPACE_ID,
  assertActivityTrailEvent,
  assertRecordingPhase,
  dumpStageEngineLogs,
} from "./botsson-harness";
import { supabase } from "./seed";

export { SEED_PROFILE_ID, SEED_WORKSPACE_ID };

// ---------------------------------------------------------------------------
// Admin client (for cleanup + direct DB assertions)
// ---------------------------------------------------------------------------

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

export function createEngineWorldAdminClient(): SupabaseClient {
  if (!SERVICE_KEY) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not set. " + "Ensure apps/e2e/.env.local is populated.",
    );
  }
  return createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// ---------------------------------------------------------------------------
// Poll helper
// ---------------------------------------------------------------------------

type PollOptions = {
  timeoutMs?: number;
  intervalMs?: number;
};

async function pollUntil<T>(
  fn: () => Promise<T | null | undefined>,
  opts: PollOptions = {},
): Promise<T> {
  const { timeoutMs = 20_000, intervalMs = 600 } = opts;
  const deadline = Date.now() + timeoutMs;
  let last: T | null | undefined = null;
  while (Date.now() < deadline) {
    last = await fn();
    if (last != null) return last;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error(`pollUntil: timed out after ${timeoutMs}ms`);
}

// ---------------------------------------------------------------------------
// Cleanup helpers
// ---------------------------------------------------------------------------

/** Delete engine_world rows seeded by this test run (scoped by prefix). */
export async function cleanupEngineWorldRows(db: SupabaseClient, prefix: string): Promise<void> {
  await db.from("engine_world").delete().like("surface_id", `${prefix}%`);
}

/** Clean up sessions for the seed profile created since sinceIso. */
export async function cleanupEngineWorldSessions(sinceIso: string): Promise<void> {
  const { data: sessions } = await supabase
    .from("engine_sessions")
    .select("id")
    .eq("profile_id", SEED_PROFILE_ID)
    .eq("workspace_id", SEED_WORKSPACE_ID)
    .gte("created_at", sinceIso);

  if (!sessions || sessions.length === 0) return;

  const ids = sessions.map((s: { id: string }) => s.id);
  await supabase.from("agent_session_recording").delete().in("session_id", ids);
  await supabase.from("engine_sessions").delete().in("id", ids);
}

// ---------------------------------------------------------------------------
// Session resolution helper
// ---------------------------------------------------------------------------

/** Resolve session ID from BFF response body or DB fallback. */
export async function resolveEngineWorldSessionId(
  bffBody: { sessionId?: string },
  sinceIso: string,
): Promise<string | null> {
  if (bffBody.sessionId) return bffBody.sessionId;

  const { data } = await supabase
    .from("engine_sessions")
    .select("id")
    .eq("profile_id", SEED_PROFILE_ID)
    .eq("workspace_id", SEED_WORKSPACE_ID)
    .gte("created_at", sinceIso)
    .order("created_at", { ascending: false })
    .limit(1);

  return (data as Array<{ id: string }> | null)?.[0]?.id ?? null;
}

// ---------------------------------------------------------------------------
// Classifier assertion
// ---------------------------------------------------------------------------

/**
 * Assert the intent classifier routed to engine_world for a given session.
 * Polls agent_session_recording for a classifier_output row.
 */
export async function assertEngineWorldClassified(
  sessionId: string,
  sinceIso: string,
  poll?: PollOptions,
): Promise<void> {
  const row = await assertRecordingPhase({
    sessionId,
    phase: "classifier_output",
    turnKind: "user_input",
    contentPredicate: (c) => {
      const content = c as Record<string, unknown>;
      return typeof content?.intent === "string" && content.intent === "engine_world";
    },
    sinceIso,
    poll: poll ?? { timeoutMs: 25_000 },
  });

  const content = row.content_redacted as Record<string, unknown>;
  expect(content.intent, "classifier must route to engine_world").toBe("engine_world");
}

// ---------------------------------------------------------------------------
// Tool invocation assertion (read tools — no activity_trail row expected)
// ---------------------------------------------------------------------------

/**
 * Assert a tool_call recording exists for the given tool name.
 * engine_world read tools produce a tool_call row in agent_session_recording
 * (phase='tool_call', turn_kind='tool_result') but do NOT write to activity_trail
 * because read tools never emit (L-0094).
 */
export type ToolCallRow = {
  id: string;
  session_id: string;
  phase: string;
  turn_kind: string;
  content_redacted: unknown;
  created_at: string;
};

export async function assertEngineWorldToolCall(opts: {
  sessionId: string;
  toolName: string;
  sinceIso: string;
  poll?: PollOptions;
}): Promise<ToolCallRow> {
  let result: ToolCallRow | undefined;
  try {
    result = await pollUntil(
      async () => {
        const { data } = await supabase
          .from("agent_session_recording")
          .select("id, session_id, phase, turn_kind, content_redacted, created_at")
          .eq("session_id", opts.sessionId)
          .in("phase", ["tool_call", "post_turn", "llm_response"])
          .gte("created_at", opts.sinceIso)
          .order("created_at", { ascending: false })
          .limit(20);

        if (!data || data.length === 0) return null;

        // Match any row where content_redacted contains the tool name.
        const matching = data.find((row) => {
          const text = JSON.stringify(row.content_redacted ?? "").toLowerCase();
          return text.includes(opts.toolName);
        });

        return (matching as ToolCallRow | undefined) ?? null;
      },
      opts.poll ?? { timeoutMs: 25_000 },
    );
  } catch {
    const { data: all } = await supabase
      .from("agent_session_recording")
      .select("phase, turn_kind, content_redacted, created_at")
      .eq("session_id", opts.sessionId)
      .order("created_at", { ascending: true })
      .limit(30);

    const dump = JSON.stringify(all ?? [], null, 2);
    const stageLog = await dumpStageEngineLogs();

    expect(
      null,
      `assertEngineWorldToolCall: no recording row containing tool "${opts.toolName}" ` +
        `for session ${opts.sessionId}.\n\nAll rows:\n${dump}\n\nStage-engine:\n${stageLog}`,
    ).not.toBeNull();
    throw new Error("unreachable");
  }

  return result;
}

// ---------------------------------------------------------------------------
// report_observation: activity_trail assertion
// ---------------------------------------------------------------------------

/**
 * Assert activity_trail has the engine_world observation_written event.
 * Uses space-form name per council F1 (existing registry names).
 */
export async function assertObservationWrittenTrail(opts: {
  sinceIso: string;
  surfaceId?: string;
  poll?: PollOptions;
}): Promise<void> {
  await assertActivityTrailEvent({
    event: "engine_world observation_written",
    sinceIso: opts.sinceIso,
    dataPredicate: opts.surfaceId
      ? (d) => {
          const data = d as Record<string, unknown>;
          const inner = data?.data as Record<string, unknown> | undefined;
          return inner?.surface_id === opts.surfaceId;
        }
      : undefined,
    poll: opts.poll ?? { timeoutMs: 25_000 },
  });
}

// ---------------------------------------------------------------------------
// report_observation: DB row assertion
// ---------------------------------------------------------------------------

export type EngineWorldRow = {
  surface_id: string;
  surface_type: string;
  status: string;
  workspace_id: string | null;
  observed_by: string;
  ttl_seconds: number;
  observed_at: string;
};

/**
 * Poll until engine_world has a row matching the given surface_id.
 * Returns the row when found. Fails loud with recent rows if not found.
 */
export async function assertEngineWorldRow(opts: {
  db: SupabaseClient;
  surfaceId: string;
  expectedStatus?: string;
  expectedWorkspaceId?: string | null;
  poll?: PollOptions;
}): Promise<EngineWorldRow> {
  let result: EngineWorldRow | undefined;
  try {
    result = await pollUntil(
      async () => {
        const { data } = await opts.db
          .from("engine_world")
          .select(
            "surface_id, surface_type, status, workspace_id, observed_by, ttl_seconds, observed_at",
          )
          .eq("surface_id", opts.surfaceId)
          .maybeSingle();

        if (!data) return null;
        if (opts.expectedStatus && data.status !== opts.expectedStatus) return null;

        return data as EngineWorldRow;
      },
      opts.poll ?? { timeoutMs: 25_000 },
    );
  } catch {
    const { data: recent } = await opts.db
      .from("engine_world")
      .select("surface_id, status, workspace_id, observed_at")
      .order("observed_at", { ascending: false })
      .limit(5);

    expect(
      null,
      `assertEngineWorldRow: surface "${opts.surfaceId}" not found in engine_world ` +
        (opts.expectedStatus ? `with status="${opts.expectedStatus}". ` : ". ") +
        `Recent rows:\n${JSON.stringify(recent ?? [], null, 2)}`,
    ).not.toBeNull();
    throw new Error("unreachable");
  }

  return result;
}
