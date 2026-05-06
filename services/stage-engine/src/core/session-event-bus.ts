// ============================================
// session-event-bus.ts
// Lightweight in-process pub/sub for session lifecycle events.
//
// Why this exists (Phase 2B):
//   engine-world-writer needs to react to session lifecycle events
//   (session.started, session.ended, session.transitioned) in order to
//   maintain per-workspace session health surfaces in engine_world.
//   Guardian-bus is NOT suitable for this — it is a domain-specific façade
//   over guardian_log / pg_notify, typed to GuardianEvent semantics.
//   Extending guardian-bus would contaminate its single-responsibility contract.
//
//   This bus is intentionally minimal:
//     - No persistence (in-memory only)
//     - No retries (fire-and-forget to subscribers)
//     - No cross-instance fanout (per-process; acceptable because
//       engine-world-writer aggregates per-process metrics anyway)
//     - Subscribers MUST NOT throw — errors are caught and logged
//
// Dep-safety:
//   session-manager  → emits via emitSessionEvent   (no import from writer)
//   stage-manager    → emits via emitSessionEvent   (no import from writer)
//   engine-world-writer → subscribes via subscribeSessionEvents
//   This bus has zero imports from either writer or manager. Circular-dep-free.
// ============================================

import { baseLogger } from "../lib/logger.js";

const log = baseLogger.child({ module: "session-event-bus" });

// ─── Event shape ─────────────────────────────────────────────────────────────

export type SessionEventType = "session.started" | "session.ended" | "session.transitioned";

export interface SessionLifecycleEvent {
  event_type: SessionEventType;
  workspace_id: string;
  session_id: string;
  /** Unix epoch ms — set by emitSessionEvent, callers do not provide it. */
  ts: number;
}

// ─── Subscriber registry ─────────────────────────────────────────────────────

type SessionEventHandler = (event: SessionLifecycleEvent) => void;

const _handlers: SessionEventHandler[] = [];

/**
 * Subscribe to all session lifecycle events.
 *
 * Called once by engine-world-writer at startup. Additional subscribers are
 * supported (there is no limit) but the primary consumer is the writer.
 *
 * Returns an unsubscribe function — call it to remove the handler.
 */
export function subscribeSessionEvents(handler: SessionEventHandler): () => void {
  _handlers.push(handler);
  return () => {
    const idx = _handlers.indexOf(handler);
    if (idx !== -1) _handlers.splice(idx, 1);
  };
}

// ─── Emitter (called by session-manager + stage-manager) ─────────────────────

/**
 * Emit a session lifecycle event to all registered handlers.
 *
 * Fire-and-forget: synchronous fan-out, each handler error is caught + logged.
 * Never throws. Drops events silently if workspace_id is empty (guards against
 * agent-mode sessions that omit workspace_id).
 */
export function emitSessionEvent(
  event_type: SessionEventType,
  workspace_id: string,
  session_id: string,
): void {
  if (!workspace_id) {
    // Agent-mode sessions may have no workspace — skip silently.
    return;
  }

  const payload: SessionLifecycleEvent = {
    event_type,
    workspace_id,
    session_id,
    ts: Date.now(),
  };

  for (const handler of _handlers) {
    try {
      handler(payload);
    } catch (err) {
      log.warn({ err, event_type, session_id }, "[session-event-bus] handler threw — ignored");
    }
  }
}
