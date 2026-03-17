import { supabaseAdmin } from "../lib/supabase.js";
import type { GuardianEvent, GuardianServerMessage } from "../types/guardian.js";

/** Minimal WebSocket interface — works with both `ws` library and Hono WSContext */
type GuardianSocket = {
  send(data: string | ArrayBuffer | Uint8Array): void;
  readyState: number;
  close?(code?: number, reason?: string): void;
};

type ClientInfo = {
  ws: GuardianSocket;
  workspaceId: string;
  subscribedSessions: Set<string>;
};

const clients: Set<ClientInfo> = new Set();

/**
 * Register a new WebSocket client for a workspace.
 */
export function addClient(ws: GuardianSocket, workspaceId: string): ClientInfo {
  const client: ClientInfo = { ws, workspaceId, subscribedSessions: new Set() };
  clients.add(client);
  return client;
}

/**
 * Remove a disconnected client.
 */
export function removeClient(client: ClientInfo): void {
  clients.delete(client);
}

/**
 * Subscribe a client to events for a specific session.
 */
export function subscribeSession(client: ClientInfo, sessionId: string): void {
  client.subscribedSessions.add(sessionId);
}

/**
 * Unsubscribe a client from a session.
 */
export function unsubscribeSession(client: ClientInfo, sessionId: string): void {
  client.subscribedSessions.delete(sessionId);
}

/**
 * Emit a guardian event. Broadcasts to subscribed WebSocket clients
 * and persists to guardian_log (async, non-blocking).
 */
export function emitGuardianEvent(event: Omit<GuardianEvent, "type" | "timestamp">): void {
  const fullEvent: GuardianEvent = {
    ...event,
    type: "event",
    timestamp: new Date().toISOString(),
  };

  // Broadcast to subscribed clients
  for (const client of clients) {
    if (client.workspaceId !== event.workspace_id) continue;

    // Send if client subscribes to this session OR has no subscriptions (gets all)
    if (client.subscribedSessions.size === 0 || client.subscribedSessions.has(event.session_id)) {
      send(client.ws, fullEvent);
    }
  }

  // Persist to guardian_log (fire-and-forget)
  persistEvent(fullEvent).catch((err) => {
    console.error("[guardian-bus] Failed to persist event:", err);
  });
}

/**
 * Send active sessions list to a client.
 */
export async function sendSessionList(client: ClientInfo): Promise<void> {
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
        ? ((s.context as Record<string, Record<string, string>>).profile.first_name ?? "Unknown")
        : "Unknown",
      channel: s.channel ?? "unknown",
      status: s.status,
      current_stage: s.current_stage_id,
      started_at: s.created_at,
    })),
  };

  send(client.ws, msg);
}

/** Helper: send JSON to WebSocket (readyState 1 = OPEN) */
function send(ws: GuardianSocket, msg: GuardianServerMessage): void {
  if (ws.readyState === 1) {
    ws.send(JSON.stringify(msg));
  }
}

/** Persist event to guardian_log table */
async function persistEvent(event: GuardianEvent): Promise<void> {
  await supabaseAdmin.from("guardian_log").insert({
    workspace_id: event.workspace_id,
    session_id: event.session_id,
    event_type: event.event_type,
    actor: event.actor,
    summary: event.summary,
    data: event.data,
  });
}
