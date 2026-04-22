// ============================================
// pg-notify-bus.ts
// Phase A6 (Campaign Botsson Arena) · ADR-0186
//
// Postgres LISTEN/NOTIFY replacement for the in-process guardian-bus
// EventEmitter. Each stage-engine instance runs a `LISTEN guardian_events`
// loop; any INSERT into `guardian_log` fires a pg_notify that every
// instance receives. Each instance then broadcasts to its own subscribed
// WebSocket clients.
//
// Pattern mirrors the existing telegram_bridge listener in
// services/stage-engine/src/index.ts (setupPgNotifyListener).
//
// Producers (emitGuardianEvent in guardian-bus.ts) write to guardian_log.
// The DB trigger from 20260422120000_guardian_log_pg_notify.sql broadcasts
// to this channel. This module owns the consumer side only.
// ============================================

import { baseLogger } from "../lib/logger.js";

/** Minimal WebSocket interface — works with both `ws` library and Hono WSContext. */
export type GuardianSocket = {
  send(data: string): void;
  readyState: number;
  close?(code?: number, reason?: string): void;
};

type ClientInfo = {
  ws: GuardianSocket;
  workspaceId: string;
  subscribedSessions: Set<string>;
};

/** Event shape produced by the pg_notify payload (matches guardian_log columns). */
export type GuardianNotifyEvent = {
  id: string;
  workspace_id: string;
  session_id: string;
  event_type: string;
  actor: "system" | "agent" | "user" | "guardian" | "admin";
  summary: string;
  data: Record<string, unknown>;
  created_at: string;
};

// Module-scoped client registry. One Set per process — events from the DB
// fan out here, so horizontal scaling means each instance keeps its own
// subscribers and the DB notifies all instances.
const clients: Set<ClientInfo> = new Set();

// Raw pg client holder — typed via dynamic import so the module can be
// loaded without `pg` being initialized (tests never start the listener).
let pgClient: import("pg").Client | null = null;
let listenerStarted = false;
let shuttingDown = false;

/** Register a WebSocket client scoped to a workspace. */
export function addClient(ws: GuardianSocket, workspaceId: string): ClientInfo {
  const client: ClientInfo = { ws, workspaceId, subscribedSessions: new Set() };
  clients.add(client);
  return client;
}

/** Remove a disconnected client. */
export function removeClient(client: ClientInfo): void {
  clients.delete(client);
}

/** Subscribe a client to events for a specific session. */
export function subscribeSession(client: ClientInfo, sessionId: string): void {
  client.subscribedSessions.add(sessionId);
}

/** Unsubscribe a client from a session. */
export function unsubscribeSession(client: ClientInfo, sessionId: string): void {
  client.subscribedSessions.delete(sessionId);
}

/**
 * Broadcast an event to all matching in-process WebSocket clients.
 *
 * Matching rules:
 *   - workspace_id MUST equal the client's workspaceId.
 *   - If the client has no session subscriptions, it receives all
 *     workspace events (dashboard overview mode).
 *   - Otherwise it only receives events for subscribed sessions.
 *
 * Sockets that are not OPEN (readyState !== 1) are skipped silently —
 * the close handler in the WS route is responsible for removeClient().
 */
export function broadcastGuardianEvent(event: GuardianNotifyEvent): void {
  const envelope = JSON.stringify({ type: "event", ...event });

  for (const client of clients) {
    if (client.workspaceId !== event.workspace_id) continue;

    const hasSubs = client.subscribedSessions.size > 0;
    if (hasSubs && !client.subscribedSessions.has(event.session_id)) continue;

    if (client.ws.readyState !== 1) continue;

    try {
      client.ws.send(envelope);
    } catch (err) {
      baseLogger.warn({ err }, "[pg-notify-bus] ws.send failed, client will be reaped on close");
    }
  }
}

/**
 * Start LISTEN and route notifications to subscribed WebSockets.
 *
 * Reconnects automatically on error with a 5s backoff (unless shutdown
 * is in progress). Idempotent — safe to call multiple times; subsequent
 * calls are no-ops while a connection is live.
 */
export async function startPgNotifyBus(): Promise<void> {
  if (listenerStarted && pgClient) return;

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    baseLogger.warn("[pg-notify-bus] DATABASE_URL not set — guardian event broadcast disabled");
    return;
  }

  try {
    const { Client } = await import("pg");
    const client = new Client({ connectionString: dbUrl });
    pgClient = client;
    await client.connect();
    await client.query("LISTEN guardian_events");
    listenerStarted = true;
    baseLogger.info("[pg-notify-bus] listening on channel 'guardian_events'");

    client.on("notification", (msg: { channel: string; payload?: string }) => {
      if (msg.channel !== "guardian_events" || !msg.payload) return;
      try {
        const event = JSON.parse(msg.payload) as GuardianNotifyEvent;
        broadcastGuardianEvent(event);
      } catch (err) {
        baseLogger.error({ err, payload: msg.payload }, "[pg-notify-bus] parse error");
      }
    });

    client.on("error", (err: Error) => {
      baseLogger.warn({ err }, "[pg-notify-bus] pg connection error — reconnecting in 5s");
      listenerStarted = false;
      pgClient = null;
      if (!shuttingDown) {
        setTimeout(() => void startPgNotifyBus(), 5000);
      }
    });
  } catch (err) {
    baseLogger.warn({ err }, "[pg-notify-bus] setup failed");
    listenerStarted = false;
    pgClient = null;
  }
}

/**
 * Gracefully close the LISTEN client. Called from the process shutdown hook.
 */
export async function stopPgNotifyBus(): Promise<void> {
  shuttingDown = true;
  if (pgClient) {
    try {
      await pgClient.end();
      baseLogger.info("[pg-notify-bus] pg client closed");
    } catch (err) {
      baseLogger.warn({ err }, "[pg-notify-bus] pg client close failed");
    }
    pgClient = null;
  }
  listenerStarted = false;
}

/** @internal — test-only: wipes client registry between unit tests. */
export function _resetClientsForTest(): void {
  clients.clear();
}
