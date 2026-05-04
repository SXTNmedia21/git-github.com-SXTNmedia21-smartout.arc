// ============================================
// guardian-bus.ts
// Phase A6 · ADR-0186 — thin façade over pg-notify-bus.ts
//
// Before: in-process EventEmitter kept a per-process Set<ClientInfo> and
// broadcast synchronously. That broke the moment stage-engine had more
// than one instance — events emitted on instance A never reached clients
// on instance B.
//
// After: this module is a compatibility shim.
//   - Client lifecycle (addClient / removeClient / subscribe…) is delegated
//     to pg-notify-bus.ts so the two modules share one registry.
//   - emitGuardianEvent() writes a row to guardian_log. The AFTER INSERT
//     trigger from migration 20260422120000 fires pg_notify('guardian_events'),
//     every LISTENing instance parses it, and broadcastGuardianEvent() fans
//     out to each instance's own WS clients.
//
// Callers import the same names as before (emitGuardianEvent, addClient,
// sendSessionList, …). No call-site changes required.
// ============================================

import { supabaseAdmin } from "../lib/supabase.js";
import { baseLogger } from "../lib/logger.js";
import type { GuardianEvent, GuardianServerMessage } from "../types/guardian.js";
import {
  addClient as pgAddClient,
  removeClient as pgRemoveClient,
  subscribeSession as pgSubscribeSession,
  unsubscribeSession as pgUnsubscribeSession,
  type GuardianSocket,
} from "./pg-notify-bus.js";

// Re-export client lifecycle — all existing import sites keep working.
export const addClient = pgAddClient;
export const removeClient = pgRemoveClient;
export const subscribeSession = pgSubscribeSession;
export const unsubscribeSession = pgUnsubscribeSession;

/**
 * Emit a guardian event.
 *
 * Writes to guardian_log; the AFTER INSERT pg_notify trigger broadcasts
 * the event to every stage-engine instance's pg-notify-bus listener,
 * which fans out to each instance's own WebSocket clients.
 *
 * Kept as a fire-and-forget function (returns void) to preserve the
 * original API — all 20+ call sites across the codebase stay unchanged.
 * Insert errors are logged via pino; there is no meaningful recovery
 * path for a missed audit row that isn't already handled by the emit()
 * telemetry contract (ADR-0116).
 */
export function emitGuardianEvent(event: Omit<GuardianEvent, "type" | "timestamp">): void {
  persistEvent(event).catch((err) => {
    baseLogger.error(
      { err, event_type: event.event_type, session_id: event.session_id },
      "[guardian-bus] Failed to persist event",
    );
  });
}

/**
 * Send the active-sessions list to a newly connected WebSocket client.
 * Unchanged from the pre-A6 implementation — purely a point-read for the
 * dashboard's initial hydration.
 */
export async function sendSessionList(client: {
  ws: GuardianSocket;
  workspaceId: string;
}): Promise<void> {
  const { data: sessions } = await supabaseAdmin
    .from("engine_sessions")
    .select("id, mission_id, channel, status, current_stage_id, created_at, context")
    .eq("workspace_id", client.workspaceId)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(50);

  if (!sessions) return;

  const msg: GuardianServerMessage = {
    type: "sessions",
    sessions: sessions.map((s) => ({
      session_id: s.id,
      mission_id: s.mission_id,
      profile_name: (s.context as Record<string, unknown>)?.profile
        ? ((s.context as Record<string, Record<string, string>>).profile.display_name ?? "Unknown")
        : "Unknown",
      channel: s.channel ?? "unknown",
      status: s.status,
      current_stage: s.current_stage_id,
      started_at: s.created_at,
    })),
  };

  if (client.ws.readyState === 1) {
    client.ws.send(JSON.stringify(msg));
  }
}

/** Persist a guardian event to guardian_log. The trigger broadcasts it. */
async function persistEvent(event: Omit<GuardianEvent, "type" | "timestamp">): Promise<void> {
  const { error } = await supabaseAdmin.from("guardian_log").insert({
    workspace_id: event.workspace_id,
    session_id: event.session_id,
    event_type: event.event_type,
    actor: event.actor,
    summary: event.summary,
    data: event.data,
  });
  if (error) throw new Error(error.message);
}
