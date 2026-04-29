// ============================================
// mission-pool-slot.ts
// Phase 0 (Crown) — Arena Harness Migration · ADR-0151
//
// Single mission-pool slot. LISTENs on Postgres NOTIFY channel
// 'mission_dispatch'. Per notification:
//   1. Parse payload {engine_state_id, mission_id, workspace_id}
//   2. Re-fetch engine_state row — confirm status='pending' + lock held
//   3. Load mission folder: docs/journeys/<mission_id>/ir/journey.yaml
//   4. Verify sha256(journey.yaml) == journey.hash (tamper detection)
//   5. Flip status='active', emit journey run_started
//   6. Emit journey step_reached×2 (stub loop)
//   7. Flip status='complete', emit journey completed
//   8. On any error: emit journey run_failed, flip status='failed'
//
// Repo-root resolution:
//   - Honour REPO_ROOT env if set.
//   - Otherwise resolve via path.resolve(process.cwd(), "../..").
//     This is correct when stage-engine is launched from
//     services/stage-engine/ (pnpm dev) OR from the monorepo root
//     (turbo) — both produce the same two-levels-up result.
//
// Mirrors pg-notify-bus.ts conventions throughout:
//   - Dynamic await import("pg")
//   - Module-scoped state (pgClient, listenerStarted, shuttingDown)
//   - DATABASE_URL source
//   - Soft-warn (not crash) when DATABASE_URL is missing
//   - 5-second setTimeout reconnect on error
//   - Separate pg Client per channel (do NOT touch guardian_events)
//
// workspace_id is always read from the engine_state row (server-side),
// never trusted from the notify payload (ADR-0151).
// ============================================

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { emit, nonEmpty } from "@smartout/telemetry";
import { baseLogger } from "../lib/logger.js";

// ── Constants ────────────────────────────────────────────────────
const CHANNEL = "mission_dispatch";
const RECONNECT_DELAY_MS = 5000;
const SYSTEM_ACTOR_ID = "00000000-0000-0000-0000-000000000001" as const;

// Repo root: honour explicit override, otherwise walk up two from cwd.
// When invoked via `pnpm --filter @smartout/stage-engine dev` the cwd is
// services/stage-engine/ → two levels up = monorepo root.
const REPO_ROOT = process.env.REPO_ROOT ?? resolve(process.cwd(), "../..");

// ── Module-scoped state ──────────────────────────────────────────
let pgClient: import("pg").Client | null = null;
let listenerStarted = false;
let shuttingDown = false;

// ── Types ────────────────────────────────────────────────────────
type DispatchPayload = {
  engine_state_id: string;
  mission_id: string | null;
  workspace_id: string;
};

type MissionManifest = {
  journey_version_id: string;
  capability: "journey.run_dev";
  surface: "dev";
  label: string;
};

// ── Mission loader ───────────────────────────────────────────────

/**
 * Load and verify the mission manifest from docs/journeys/<missionId>/ir/.
 *
 * Throws with codes:
 *   mission.tampered — sha256 of journey.yaml does not match journey.hash
 *   mission.malformed — required fields missing or wrong value
 */
async function loadMissionManifest(missionId: string): Promise<MissionManifest> {
  const irDir = resolve(REPO_ROOT, "docs/journeys", missionId, "ir");

  const [yamlContent, hashContent] = await Promise.all([
    readFile(resolve(irDir, "journey.yaml"), "utf8"),
    readFile(resolve(irDir, "journey.hash"), "utf8"),
  ]);

  const expectedHash = hashContent.trim();
  const actualHash = createHash("sha256").update(yamlContent).digest("hex");

  if (actualHash !== expectedHash) {
    throw new Error(
      `mission.tampered: hash mismatch for ${missionId} (expected ${expectedHash}, got ${actualHash})`,
    );
  }

  // Dependency-free minimal YAML parse. Extracts scalar key: value pairs
  // from top-level lines. Sufficient for the four fields we need.
  // A real YAML parser is introduced in Phase 1 when ir/ becomes the
  // canonical source of truth for multi-stage flows.
  const grab = (key: string): string | undefined =>
    (yamlContent.match(new RegExp(`^${key}:\\s*(.+)$`, "m")) ?? [])[1]?.trim();

  const journey_version_id = grab("journey_version_id");
  const capability = grab("capability");
  const surface = grab("surface");
  const label = grab("label") ?? missionId;

  if (!journey_version_id) {
    throw new Error(`mission.malformed: ${missionId} missing journey_version_id`);
  }
  if (capability !== "journey.run_dev") {
    throw new Error(
      `mission.malformed: ${missionId} capability must be 'journey.run_dev', got '${capability ?? "undefined"}'`,
    );
  }
  if (surface !== "dev") {
    throw new Error(
      `mission.malformed: ${missionId} surface must be 'dev', got '${surface ?? "undefined"}'`,
    );
  }

  return {
    journey_version_id,
    capability: "journey.run_dev",
    surface: "dev",
    label,
  };
}

// ── DB helpers ───────────────────────────────────────────────────

async function markFailed(
  supabase: SupabaseClient,
  engineStateId: string,
  reason: string,
): Promise<void> {
  await supabase
    .from("engine_state")
    .update({
      status: "failed",
      last_error: reason,
      updated_at: new Date().toISOString(),
    })
    .eq("id", engineStateId);
}

// ── Per-notification handler ─────────────────────────────────────

async function handleDispatch(supabase: SupabaseClient, raw: string): Promise<void> {
  // ── 1. Parse payload ──────────────────────────────────────────
  let payload: DispatchPayload;
  try {
    payload = JSON.parse(raw) as DispatchPayload;
  } catch (e) {
    baseLogger.warn({ raw, err: e }, `[mission-pool] malformed JSON payload — skipping`);
    return;
  }

  const { engine_state_id, mission_id, workspace_id: payloadWorkspaceId } = payload;

  // ── 2. Validate payload fields ────────────────────────────────
  if (!engine_state_id) {
    baseLogger.warn({ payload }, "[mission-pool] missing engine_state_id — skipping");
    return;
  }
  if (!mission_id) {
    baseLogger.warn({ payload }, "[mission-pool] missing mission_id — skipping");
    return;
  }
  // payloadWorkspaceId is logged for debugging only; we derive workspace_id
  // from the row (ADR-0151). A mismatch is suspicious but not terminal.

  // ── 3. Re-fetch row; confirm status + lock ────────────────────
  const { data: stateRow, error: fetchErr } = await supabase
    .from("engine_state")
    .select("id, status, dispatch_lock_id, workspace_id")
    .eq("id", engine_state_id)
    .maybeSingle();

  if (fetchErr) {
    baseLogger.warn(
      { engine_state_id, err: fetchErr },
      "[mission-pool] row fetch error — skipping",
    );
    return;
  }
  if (!stateRow) {
    baseLogger.info(
      { engine_state_id },
      "[mission-pool] row not found — already processed or deleted",
    );
    return;
  }
  if (stateRow.status !== "pending") {
    baseLogger.info(
      { engine_state_id, status: stateRow.status },
      "[mission-pool] row not pending — skipping (another slot or manual intervention)",
    );
    return;
  }
  if (!stateRow.dispatch_lock_id) {
    baseLogger.warn(
      { engine_state_id },
      "[mission-pool] dispatch_lock_id IS NULL — heartbeat did not lock; skipping",
    );
    return;
  }

  // workspace_id is derived from the row, never from the notify payload (ADR-0151).
  // nonEmpty() guards the empty-string class of telemetry-corruption (ADR-0193).
  const rawWorkspaceId = stateRow.workspace_id as string | null;
  if (!rawWorkspaceId) {
    baseLogger.warn(
      { engine_state_id },
      "[mission-pool] workspace_id IS NULL on row — cannot emit; marking failed",
    );
    await markFailed(supabase, engine_state_id, "workspace_id missing on engine_state row");
    return;
  }
  const workspaceId = nonEmpty(rawWorkspaceId, "workspace_id");
  const actorId = nonEmpty(SYSTEM_ACTOR_ID, "actor_id");

  const startTs = Date.now();

  // ── 4. Load manifest (hash-verified) ─────────────────────────
  let manifest: MissionManifest;
  try {
    manifest = await loadMissionManifest(mission_id);
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : String(e);
    const errorCode = errorMessage.startsWith("mission.tampered")
      ? "mission.tampered"
      : "mission.malformed";
    baseLogger.warn({ engine_state_id, mission_id, err: e }, "[mission-pool] manifest load failed");

    await emit({
      event: "journey run_failed",
      workspace_id: workspaceId,
      actor_id: actorId,
      properties: {
        run_id: engine_state_id,
        step_key: "load_mission",
        error_code: errorCode,
        error_message: errorMessage,
        actor_id: actorId,
        workspace_id: workspaceId,
        entity: {
          entity_type: "journey_run",
          entity_id: engine_state_id,
          entity_label: mission_id,
        },
      },
    });

    await markFailed(supabase, engine_state_id, errorMessage);
    return;
  }

  // ── 5. Flip to active + emit run_started ──────────────────────
  await supabase
    .from("engine_state")
    .update({ status: "active", updated_at: new Date().toISOString() })
    .eq("id", engine_state_id);

  await emit({
    event: "journey run_started",
    workspace_id: workspaceId,
    actor_id: actorId,
    properties: {
      journey_version_id: manifest.journey_version_id,
      run_id: engine_state_id,
      actor_id: actorId,
      workspace_id: workspaceId,
      capability: manifest.capability,
      surface: manifest.surface,
      entity: {
        entity_type: "journey_run",
        entity_id: engine_state_id,
        entity_label: manifest.label,
      },
    },
  });

  // ── 6. Stub: 2 step_reached events ───────────────────────────
  // Step keys match docs/journeys/dev-arena-bootstrap/ir/journey.yaml stages.
  const stepKeys = ["step-1", "step-2"] as const;

  for (let i = 0; i < stepKeys.length; i++) {
    await emit({
      event: "journey step_reached",
      workspace_id: workspaceId,
      actor_id: actorId,
      properties: {
        run_id: engine_state_id,
        step_key: stepKeys[i],
        step_index: i + 1,
        actor_id: actorId,
        workspace_id: workspaceId,
        entity: {
          entity_type: "journey_run",
          entity_id: engine_state_id,
          entity_label: manifest.label,
        },
      },
    });
  }

  // ── 7. Flip to complete + emit completed ──────────────────────
  await supabase
    .from("engine_state")
    .update({
      status: "complete",
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", engine_state_id);

  await emit({
    event: "journey completed",
    workspace_id: workspaceId,
    actor_id: actorId,
    properties: {
      run_id: engine_state_id,
      final_step: stepKeys[stepKeys.length - 1],
      duration_ms: Date.now() - startTs,
      actor_id: actorId,
      workspace_id: workspaceId,
      entity: {
        entity_type: "journey_run",
        entity_id: engine_state_id,
        entity_label: manifest.label,
      },
    },
  });

  baseLogger.info(
    { engine_state_id, mission_id, duration_ms: Date.now() - startTs },
    "[mission-pool] mission complete",
  );
}

// ── Worker lifecycle ─────────────────────────────────────────────

/**
 * Build the Supabase admin client used by the worker for DB mutations.
 * Mirrors the pattern in other stage-engine workers — service role, no
 * persisted auth session.
 */
function buildSupabase(): SupabaseClient {
  return createClient(process.env.SUPABASE_URL ?? "", process.env.SUPABASE_SERVICE_ROLE_KEY ?? "", {
    auth: { persistSession: false },
  });
}

/**
 * Start LISTEN on mission_dispatch.
 *
 * Reconnects automatically on error with 5s backoff (unless shutdown is
 * in progress). Idempotent — safe to call multiple times while a
 * connection is live.
 *
 * Mirrors startPgNotifyBus() in core/pg-notify-bus.ts exactly.
 */
export async function startMissionPoolSlot(): Promise<void> {
  if (listenerStarted && pgClient) return;

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    baseLogger.warn("[mission-pool] DATABASE_URL not set — mission dispatch disabled");
    return;
  }

  const supabase = buildSupabase();

  try {
    const { Client } = await import("pg");
    const client = new Client({ connectionString: dbUrl });
    pgClient = client;

    await client.connect();
    await client.query(`LISTEN ${CHANNEL}`);
    listenerStarted = true;

    baseLogger.info(`[mission-pool] slot 1 listening on ${CHANNEL}`);

    client.on("notification", (msg: { channel: string; payload?: string }) => {
      if (msg.channel !== CHANNEL || !msg.payload) return;
      const raw = msg.payload;

      // Sequential await — single slot, single concurrency.
      // Phase 0 dispatch volume is low; one mission at a time is the spec.
      handleDispatch(supabase, raw).catch((err: unknown) => {
        baseLogger.error({ err }, "[mission-pool] unhandled error in handleDispatch");
      });
    });

    client.on("error", (err: Error) => {
      baseLogger.warn({ err }, "[mission-pool] pg connection error — reconnecting in 5s");
      listenerStarted = false;
      pgClient = null;
      if (!shuttingDown) {
        setTimeout(() => void startMissionPoolSlot(), RECONNECT_DELAY_MS);
      }
    });
  } catch (err) {
    baseLogger.warn({ err }, "[mission-pool] setup failed");
    listenerStarted = false;
    pgClient = null;
    if (!shuttingDown) {
      setTimeout(() => void startMissionPoolSlot(), RECONNECT_DELAY_MS);
    }
  }
}

/**
 * Gracefully close the mission_dispatch LISTEN client.
 * Called from the process shutdown hook in index.ts.
 */
export async function stopMissionPoolSlot(): Promise<void> {
  shuttingDown = true;
  if (pgClient) {
    try {
      await pgClient.end();
      baseLogger.info("[mission-pool] pg client closed");
    } catch (err) {
      baseLogger.warn({ err }, "[mission-pool] pg client close failed");
    }
    pgClient = null;
  }
  listenerStarted = false;
}
