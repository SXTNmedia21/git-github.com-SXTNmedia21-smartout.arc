// =============================================================================
// helpers/botsson-harness.ts
//
// Assertion helpers for the Botsson harness E2E pipe test.
// All DB reads use the service-role Supabase client from ./seed.ts.
//
// Design contract:
//   - Functions poll with timeout (default 15s) so recorder flush delay
//     does not cause false negatives.
//   - On failure each function dumps the rows it DID find so the error
//     message is actionable without reading logs separately.
//   - dumpStageEngineLogs() uses the metrics/probe endpoint — no docker exec.
//
// ADR-0184: agent_session_recording is fire-and-forget with a flush interval.
// Always use the polling helpers rather than point-in-time reads.
// =============================================================================

import { expect } from "@playwright/test";
import { execSync } from "node:child_process";
import { supabase } from "./seed";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const SEED_PROFILE_ID = "f0000000-0000-0000-0000-000000000000";
export const SEED_WORKSPACE_ID = "b0000000-0000-0000-0000-000000000000";

const STAGE_ENGINE_URL =
  process.env.STAGE_ENGINE_URL ??
  process.env.NEXT_PUBLIC_STAGE_ENGINE_URL ??
  "http://127.0.0.1:5010";

const STAGE_ENGINE_API_KEY =
  process.env.STAGE_ENGINE_API_KEY ?? "test-dev-api-key-for-local-e2e-12345";

// ---------------------------------------------------------------------------
// Stage-engine freshness check
// ---------------------------------------------------------------------------

/**
 * Assert the running stage-engine container was started AFTER the latest
 * development commit. A stale container (pre-merge code) is the bug class
 * this entire spec exists to catch.
 *
 * Throws an explicit error describing how far behind the container is.
 *
 * Set SKIP_FRESHNESS_CHECK=1 to downgrade to a warning — useful when the
 * container code matches the branch being tested but the container hasn't
 * been restarted since an unrelated development commit landed.
 */
export function assertStageEngineContainerFresh(): void {
  // Resolve the latest commit timestamp on the development branch.
  let latestCommitEpoch: number;
  try {
    const out = execSync("git log -1 --format=%ct development", {
      cwd: "/home/sxtnl/dev/smartout.ai",
      encoding: "utf-8",
    }).trim();
    latestCommitEpoch = parseInt(out, 10);
    if (isNaN(latestCommitEpoch)) throw new Error("git log returned non-numeric epoch");
  } catch (err) {
    throw new Error(
      `[freshness-check] Could not determine latest development commit time: ${String(err)}`,
    );
  }

  // Find the stage-engine container. Prefer infra-stage-engine-1 (compose default).
  let containerStartedAt: string;
  const candidateNames = ["infra-stage-engine-1", "stage-engine"];
  let found = false;
  for (const name of candidateNames) {
    try {
      containerStartedAt = execSync(`docker inspect ${name} --format '{{.State.StartedAt}}'`, {
        encoding: "utf-8",
      }).trim();
      found = true;
      break;
    } catch {
      // Try next candidate.
    }
  }
  // If neither found, try a pattern match
  if (!found) {
    try {
      const allContainers = execSync("docker ps --format '{{.Names}}'", {
        encoding: "utf-8",
      });
      const stageEngineName = allContainers
        .split("\n")
        .find((n) => n.includes("stage-engine"))
        ?.trim();
      if (!stageEngineName) {
        throw new Error("No stage-engine container found in docker ps. Is infra running?");
      }
      containerStartedAt = execSync(
        `docker inspect ${stageEngineName} --format '{{.State.StartedAt}}'`,
        { encoding: "utf-8" },
      ).trim();
    } catch (err) {
      throw new Error(`[freshness-check] Could not inspect stage-engine container: ${String(err)}`);
    }
  }

  // RFC 3339 → epoch seconds.
  const containerEpoch = Math.floor(new Date(containerStartedAt!).getTime() / 1000);
  if (isNaN(containerEpoch)) {
    throw new Error(
      `[freshness-check] Container StartedAt is not a valid date: ${containerStartedAt!}`,
    );
  }

  if (containerEpoch < latestCommitEpoch) {
    const behindSeconds = latestCommitEpoch - containerEpoch;
    const behindMinutes = Math.ceil(behindSeconds / 60);
    const msg =
      `[freshness-check] Stage-engine container started at ` +
      `${containerStartedAt!} (epoch ${containerEpoch}) which is ${behindMinutes} minute(s) ` +
      `BEFORE the latest development commit (epoch ${latestCommitEpoch}). ` +
      `Rebuild the container before running E2E: ` +
      `cd infra && docker compose build stage-engine && docker compose up -d stage-engine`;

    if (process.env.SKIP_FRESHNESS_CHECK === "1") {
      // Downgraded to warning — container code may still match branch under test.
      console.warn(`[freshness-check] WARN (bypassed): ${msg}`);
    } else {
      throw new Error(`[freshness-check] FAIL: ${msg}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Pre-flight: infrastructure health
// ---------------------------------------------------------------------------

export async function assertSupabaseLocalUp(): Promise<void> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
  // Anon key must be in apps/e2e/.env.local as SUPABASE_ANON_KEY.
  // The well-known Supabase Local demo key cannot be inlined here — husky JWT check blocks it.
  // Run: npx supabase status  →  copy "anon key" into apps/e2e/.env.local.
  const anonKey = process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

  let ok = false;
  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/`, {
      headers: { apikey: anonKey },
    });
    ok = res.status < 500;
  } catch {
    ok = false;
  }
  expect(ok, "Supabase Local is not reachable at " + supabaseUrl).toBe(true);
}

export async function assertStageEngineHealthy(): Promise<void> {
  let ok = false;
  try {
    const res = await fetch(`${STAGE_ENGINE_URL}/health`);
    ok = res.ok;
  } catch {
    ok = false;
  }
  expect(ok, `Stage-engine health endpoint unreachable at ${STAGE_ENGINE_URL}/health`).toBe(true);
}

// ---------------------------------------------------------------------------
// Scope-safe test cleanup
// ---------------------------------------------------------------------------

/**
 * Delete engine_memory rows created in this test run for the seed profile.
 * Scoped to profile_id + workspace_id — will never touch other profiles.
 */
export async function cleanupTestMemory(): Promise<void> {
  await supabase
    .from("engine_memory")
    .delete()
    .eq("profile_id", SEED_PROFILE_ID)
    .eq("workspace_id", SEED_WORKSPACE_ID);
}

/**
 * Delete ALL non-archived engine_sessions + cascading agent_session_recording
 * for the seed profile. The `sinceIso` parameter is kept for API compatibility
 * but no longer used as a filter — we want a clean slate before tests run,
 * regardless of when prior sessions were created.
 */
export async function cleanupTestSessions(_sinceIso?: string): Promise<void> {
  // Fetch ALL sessions for the seed profile (archived or not).
  const { data: sessions } = await supabase
    .from("engine_sessions")
    .select("id")
    .eq("profile_id", SEED_PROFILE_ID)
    .eq("workspace_id", SEED_WORKSPACE_ID);

  if (!sessions || sessions.length === 0) return;

  const ids = sessions.map((s) => s.id);

  // Recording rows first (FK dependency).
  await supabase.from("agent_session_recording").delete().in("session_id", ids);

  // Then sessions.
  await supabase.from("engine_sessions").delete().in("id", ids);
}

// ---------------------------------------------------------------------------
// Assertion helpers (polling)
// ---------------------------------------------------------------------------

type PollOptions = {
  /** Polling timeout in ms (default 15 000) */
  timeoutMs?: number;
  /** Polling interval in ms (default 600) */
  intervalMs?: number;
};

async function pollUntil<T>(
  fn: () => Promise<T | null | undefined>,
  opts: PollOptions = {},
): Promise<T> {
  const { timeoutMs = 15_000, intervalMs = 600 } = opts;
  const deadline = Date.now() + timeoutMs;
  let last: T | null | undefined = null;
  while (Date.now() < deadline) {
    last = await fn();
    if (last != null) return last;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error(`pollUntil: timed out after ${timeoutMs}ms (last value: ${String(last)})`);
}

// ---------------------------------------------------------------------------
// A7 — engine_memory row
// ---------------------------------------------------------------------------

export type MemoryRowResult = {
  id: string;
  content: string;
  memory_type: string;
  scope: string;
  importance: number;
  source_session_id: string | null;
  workspace_id: string;
  profile_id: string;
};

/**
 * Poll until engine_memory has a row matching the given content pattern.
 * Returns the first matching row. Fails loud with recent rows if not found.
 */
export async function assertMemoryRow(opts: {
  profileId?: string;
  workspaceId?: string;
  /** Pattern to check — row content must ILIKE this. Use '%kaffe%' style. */
  contentContains: string;
  /** Optional additional content fragment (both must match) */
  contentAlsoContains?: string;
  /** Optional memory_type filter */
  memoryType?: string;
  /** Only rows created after this ISO timestamp */
  sinceIso?: string;
  /** Polling options */
  poll?: PollOptions;
}): Promise<MemoryRowResult> {
  const profileId = opts.profileId ?? SEED_PROFILE_ID;
  const workspaceId = opts.workspaceId ?? SEED_WORKSPACE_ID;

  let result: MemoryRowResult | undefined;
  try {
    result = await pollUntil(async () => {
      let q = supabase
        .from("engine_memory")
        .select(
          "id, content, memory_type, scope, importance, source_session_id, workspace_id, profile_id",
        )
        .eq("profile_id", profileId)
        .eq("workspace_id", workspaceId)
        .ilike("content", `%${opts.contentContains}%`);

      if (opts.contentAlsoContains) {
        q = q.ilike("content", `%${opts.contentAlsoContains}%`);
      }
      if (opts.memoryType) {
        q = q.eq("memory_type", opts.memoryType);
      }
      if (opts.sinceIso) {
        q = q.gte("created_at", opts.sinceIso);
      }

      const { data } = await q.order("created_at", { ascending: false }).limit(1);
      return data && data.length > 0 ? (data[0] as MemoryRowResult) : null;
    }, opts.poll);
  } catch {
    // Timed out — build a diagnostic message.
    const { data: recent } = await supabase
      .from("engine_memory")
      .select("id, content, memory_type, scope, created_at")
      .eq("profile_id", profileId)
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false })
      .limit(5);

    const dump = JSON.stringify(recent ?? [], null, 2);
    expect(
      null,
      `assertMemoryRow: no row with content containing "${opts.contentContains}"` +
        (opts.contentAlsoContains ? ` AND "${opts.contentAlsoContains}"` : "") +
        ` found for profile ${profileId}.\n\nRecent engine_memory rows:\n${dump}`,
    ).not.toBeNull();
    throw new Error("unreachable"); // TypeScript satisfaction.
  }

  return result;
}

// ---------------------------------------------------------------------------
// A4/A5/A6 — agent_session_recording rows
// ---------------------------------------------------------------------------

export type RecordingRow = {
  id: string;
  session_id: string;
  phase: string;
  turn_kind: string;
  content_redacted: unknown;
  meta: unknown;
  created_at: string;
};

/**
 * Poll until agent_session_recording has a row with the given phase AND turn_kind
 * for the given session_id. Returns the matching row.
 *
 * Used for A4 (classifier_output), A5 (memory_write / post_turn).
 */
export async function assertRecordingPhase(opts: {
  sessionId: string;
  phase: string;
  turnKind: string;
  /** Additional JSON predicate — applied in-process after the DB fetch */
  contentPredicate?: (content: unknown) => boolean;
  sinceIso?: string;
  poll?: PollOptions;
}): Promise<RecordingRow> {
  let result: RecordingRow | undefined;
  try {
    result = await pollUntil(async () => {
      let q = supabase
        .from("agent_session_recording")
        .select("id, session_id, phase, turn_kind, content_redacted, meta, created_at")
        .eq("session_id", opts.sessionId)
        .eq("phase", opts.phase)
        .eq("turn_kind", opts.turnKind);

      if (opts.sinceIso) {
        q = q.gte("created_at", opts.sinceIso);
      }

      const { data } = await q.order("created_at", { ascending: false }).limit(10);
      if (!data || data.length === 0) return null;

      if (opts.contentPredicate) {
        const matching = data.find((row) => opts.contentPredicate!(row.content_redacted));
        return (matching as RecordingRow | undefined) ?? null;
      }
      return data[0] as RecordingRow;
    }, opts.poll);
  } catch {
    // Timed out — dump what exists for this session.
    const { data: all } = await supabase
      .from("agent_session_recording")
      .select("phase, turn_kind, content_redacted, created_at")
      .eq("session_id", opts.sessionId)
      .order("created_at", { ascending: true })
      .limit(20);

    const dump = JSON.stringify(all ?? [], null, 2);
    const stageLog = await dumpStageEngineLogs();

    expect(
      null,
      `assertRecordingPhase: no row with phase="${opts.phase}" turn_kind="${opts.turnKind}" ` +
        `for session ${opts.sessionId}.\n\nAll recording rows for session:\n${dump}` +
        `\n\nStage-engine logs:\n${stageLog}`,
    ).not.toBeNull();
    throw new Error("unreachable");
  }

  return result;
}

// ---------------------------------------------------------------------------
// A8 — activity_trail
// ---------------------------------------------------------------------------

export type ActivityTrailRow = {
  id: string;
  event: string;
  workspace_id: string | null;
  actor_id: string | null;
  data: unknown;
  created_at: string;
};

/**
 * Poll until activity_trail has a row matching event + workspace + actor.
 * Optional `dataPredicate` for checking JSON data fields.
 */
export async function assertActivityTrailEvent(opts: {
  event: string;
  workspaceId?: string;
  actorId?: string;
  dataPredicate?: (data: unknown) => boolean;
  sinceIso?: string;
  poll?: PollOptions;
}): Promise<ActivityTrailRow> {
  const workspaceId = opts.workspaceId ?? SEED_WORKSPACE_ID;
  const actorId = opts.actorId ?? SEED_PROFILE_ID;

  let result: ActivityTrailRow | undefined;
  try {
    result = await pollUntil(async () => {
      let q = supabase
        .from("activity_trail")
        .select("id, event, workspace_id, actor_id, data, created_at")
        .eq("event", opts.event)
        .eq("workspace_id", workspaceId)
        .eq("actor_id", actorId);

      if (opts.sinceIso) {
        q = q.gte("created_at", opts.sinceIso);
      }

      const { data } = await q.order("created_at", { ascending: false }).limit(10);
      if (!data || data.length === 0) return null;

      if (opts.dataPredicate) {
        const matching = data.find((row) => opts.dataPredicate!(row.data));
        return (matching as ActivityTrailRow | undefined) ?? null;
      }
      return data[0] as ActivityTrailRow;
    }, opts.poll);
  } catch {
    const { data: recent } = await supabase
      .from("activity_trail")
      .select("event, actor_id, workspace_id, created_at")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false })
      .limit(10);

    const dump = JSON.stringify(recent ?? [], null, 2);
    expect(
      null,
      `assertActivityTrailEvent: no row with event="${opts.event}" workspace=${workspaceId} actor=${actorId}.\n\n` +
        `Recent activity_trail rows:\n${dump}`,
    ).not.toBeNull();
    throw new Error("unreachable");
  }

  return result;
}

// ---------------------------------------------------------------------------
// A9 — engine_sessions.collected_data conversation shape
// ---------------------------------------------------------------------------

export type ConversationTurn = { role: string; content: string };

/**
 * Read the conversation array from engine_sessions.collected_data for the
 * given session id. Returns the parsed turns.
 */
export async function getSessionConversation(sessionId: string): Promise<ConversationTurn[]> {
  const { data, error } = await supabase
    .from("engine_sessions")
    .select("collected_data")
    .eq("id", sessionId)
    .single();

  if (error || !data) {
    throw new Error(`getSessionConversation: session ${sessionId} not found: ${error?.message}`);
  }

  const cd = data.collected_data as Record<string, unknown>;
  const conv = cd?.conversation;
  if (!Array.isArray(conv)) return [];
  return conv as ConversationTurn[];
}

// ---------------------------------------------------------------------------
// Diagnostic: dump stage-engine logs
// ---------------------------------------------------------------------------

/**
 * Fetch the last N log lines from stage-engine via the recorder metrics
 * endpoint. Falls back to docker logs if the HTTP route is unavailable.
 * Never throws — diagnostic output must not interfere with test failure path.
 */
export async function dumpStageEngineLogs(lines = 200): Promise<string> {
  // Attempt 1: docker logs (fastest, most verbose).
  try {
    const allContainers = execSync("docker ps --format '{{.Names}}'", {
      encoding: "utf-8",
      timeout: 5000,
    });
    const name = allContainers
      .split("\n")
      .find((n) => n.includes("stage-engine"))
      ?.trim();
    if (name) {
      const out = execSync(`docker logs ${name} --tail ${lines} 2>&1`, {
        encoding: "utf-8",
        timeout: 10_000,
      });
      return out;
    }
  } catch {
    // Fall through to HTTP fallback.
  }

  // Attempt 2: recorder metrics HTTP (available when docker CLI not present).
  try {
    const res = await fetch(`${STAGE_ENGINE_URL}/recorder/metrics`, {
      headers: { "x-api-key": STAGE_ENGINE_API_KEY },
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) {
      const body = await res.json();
      return `[recorder metrics] ${JSON.stringify(body, null, 2)}`;
    }
  } catch {
    // Fall through.
  }

  return "[dumpStageEngineLogs: unable to retrieve logs]";
}

// ---------------------------------------------------------------------------
// Snapshot for teardown
// ---------------------------------------------------------------------------

export type HarnessSnapshot = {
  runId: string;
  timestamp: string;
  engineMemory: unknown[];
  agentSessionRecording: unknown[];
  activityTrail: unknown[];
  engineSessions: unknown[];
};

/**
 * Snapshot test-scoped DB state for post-failure inspection.
 * Does NOT delete data. Writes to apps/e2e/snapshots/<runId>.json.
 */
export async function snapshotTestState(runId: string, sessionId?: string): Promise<void> {
  const [memoryRes, trailRes, sessionsRes, recordingRes] = await Promise.all([
    supabase
      .from("engine_memory")
      .select("*")
      .eq("profile_id", SEED_PROFILE_ID)
      .eq("workspace_id", SEED_WORKSPACE_ID)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("activity_trail")
      .select("id, event, workspace_id, actor_id, data, created_at")
      .eq("workspace_id", SEED_WORKSPACE_ID)
      .order("created_at", { ascending: false })
      .limit(30),
    supabase
      .from("engine_sessions")
      .select("id, mode, channel, status, is_archived, created_at, updated_at, collected_data")
      .eq("profile_id", SEED_PROFILE_ID)
      .eq("workspace_id", SEED_WORKSPACE_ID)
      .order("created_at", { ascending: false })
      .limit(10),
    sessionId
      ? supabase
          .from("agent_session_recording")
          .select("phase, turn_kind, content_redacted, meta, created_at")
          .eq("session_id", sessionId)
          .order("created_at", { ascending: true })
          .limit(50)
      : Promise.resolve({ data: [] }),
  ]);

  const snapshot: HarnessSnapshot = {
    runId,
    timestamp: new Date().toISOString(),
    engineMemory: memoryRes.data ?? [],
    activityTrail: trailRes.data ?? [],
    engineSessions: sessionsRes.data ?? [],
    agentSessionRecording: recordingRes.data ?? [],
  };

  const { writeFileSync, mkdirSync } = await import("node:fs");
  const { join } = await import("node:path");
  const dir = join(process.cwd(), "snapshots");
  try {
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, `${runId}.json`), JSON.stringify(snapshot, null, 2));
  } catch {
    // Snapshot write failure must never mask the actual test failure.
  }
}
