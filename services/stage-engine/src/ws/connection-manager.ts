// services/stage-engine/src/ws/connection-manager.ts
// Manages WebSocket connections per session.
// Supports broadcasting events to all connections on a session.
// Connected to: src/routes/ws.ts (registers connections)
// Connected to: packages/ai/src/capabilities/ui/ (tools broadcast via this)

import type { WSContext } from "hono/ws";
import type { MissionProtocolMessage } from "@smartout/types";

const connections = new Map<string, Set<WSContext>>();

/** Register a WebSocket connection for a session */
export function addConnection(sessionId: string, ws: WSContext): void {
  if (!connections.has(sessionId)) {
    connections.set(sessionId, new Set());
  }
  connections.get(sessionId)!.add(ws);
  console.log(
    `[ws] Connection added for session ${sessionId} (total: ${connections.get(sessionId)!.size})`,
  );
}

/** Remove a WebSocket connection */
export function removeConnection(sessionId: string, ws: WSContext): void {
  const set = connections.get(sessionId);
  if (set) {
    set.delete(ws);
    if (set.size === 0) {
      connections.delete(sessionId);
    }
    console.log(`[ws] Connection removed for session ${sessionId}`);
  }
}

/** Broadcast an event to all connections on a session */
export function broadcastToSession(sessionId: string, event: MissionProtocolMessage): void {
  const set = connections.get(sessionId);
  if (!set || set.size === 0) return;

  const payload = JSON.stringify(event);
  for (const ws of set) {
    try {
      ws.send(payload);
    } catch {
      // Connection dead — will be cleaned up on close
    }
  }
}

/** Check if a session has any active connections */
export function hasConnections(sessionId: string): boolean {
  const set = connections.get(sessionId);
  return set !== undefined && set.size > 0;
}

/** Get count of connections for a session */
export function getConnectionCount(sessionId: string): number {
  return connections.get(sessionId)?.size ?? 0;
}
