// ============================================
// context.ts
// Module-level session context state for the voice-agent.
//
// The voice-agent worker is a long-lived process. Context arrives via the
// LiveKit data channel on topic="botsson-context". The browser publishes:
//
//   1. A "context_init" message immediately after room connect, carrying
//      user + workspace blocks (fetched from BFF GET /api/botsson/voice/session-context).
//
//   2. A "context_route" message on every route change, carrying the current
//      path, query params, and focused entity (shift, profile, channel, …).
//
// The agent.ts entry point registers the DataReceived listener on ctx.room
// and calls setSessionContext() for each inbound message.
//
// callStageEngine() (when wired in a future adapter) reads
// getSessionContextSnapshot() to attach the three blocks to the request body.
// ============================================

/** Who is speaking — mirrors packages/ai/src/agents/context-types.ts UserContext. */
type UserContext = {
  profile_id: string;
  role: "owner" | "admin" | "manager" | "employee";
  status: "trainee" | "active" | "inactive" | "offboarding";
  department_id: string | null;
  display_name: string;
  language: "no" | "en" | "sv" | "da" | "fi";
};

/** Active workspace cascade state. */
type WorkspaceContext = {
  workspace_id: string;
  name: string;
  niche: string | null;
  active_season_id: string | null;
  active_framework_id: string | null;
  planning_cycle_id: string | null;
};

/** Current page + focused entity. */
type RouteContext = {
  path: string;
  query: Record<string, string>;
  entity_type: string | null;
  entity_id: string | null;
  entity_label: string | null;
};

// D2+D6 workforce snapshot. 2026-05-13 directive — Botsson is a workforce
// assistant; must know employees + today/tomorrow shifts + absences + sessions
// at session start, not via tool-calls. PII (ADR-0078): names, roles,
// departments, phones, absence types OK on both channels. Bank/tax/personnummer
// NEVER here (BFF strips them).
type WorkforceEmployee = {
  profile_id: string;
  display_name: string;
  role: string;
  status: string;
  department_id: string | null;
  department_name: string | null;
  phone: string | null;
};
type WorkforceShift = {
  shift_id: string;
  profile_id: string | null;
  employee_name: string | null;
  shift_date: string;
  start_time: string;
  end_time: string;
  department_id: string | null;
  department_name: string | null;
  position_label: string | null;
};
type WorkforceAbsence = {
  absence_id: string;
  profile_id: string;
  employee_name: string | null;
  absence_type: string;
  start_date: string;
  end_date: string;
};
type WorkforceSession = {
  session_id: string;
  department_id: string | null;
  department_name: string | null;
  status: string;
  scheduled_date: string;
};
type WorkforceContext = {
  employees: WorkforceEmployee[];
  shifts_today: WorkforceShift[];
  shifts_tomorrow: WorkforceShift[];
  absences_active: WorkforceAbsence[];
  sessions_today: WorkforceSession[];
  snapshot_at: string;
};

/** Union of all inbound data messages on topic="botsson-context". */
type ContextInitMessage = {
  type: "context_init";
  user: UserContext;
  workspace: WorkspaceContext;
  workforce?: WorkforceContext;
};

type ContextRouteMessage = {
  type: "context_route";
  path: string;
  query: Record<string, string>;
  entity_type: string | null;
  entity_id: string | null;
  entity_label: string | null;
};

type ContextMessage = ContextInitMessage | ContextRouteMessage;

/** Full session context snapshot attached to every stage-engine call. */
export type SessionContextSnapshot = {
  user: UserContext | null;
  workspace: WorkspaceContext | null;
  route: RouteContext | null;
  workforce: WorkforceContext | null;
};

// -- Module-level state (one voice session = one worker process) --

let _user: UserContext | null = null;
let _workspace: WorkspaceContext | null = null;
let _route: RouteContext | null = null;
let _workforce: WorkforceContext | null = null;

/**
 * Update context from an inbound "botsson-context" data message.
 * Called by the DataReceived listener in agent.ts.
 * Idempotent — replace cleanly on every call.
 */
export function setSessionContext(msg: ContextMessage): void {
  if (msg.type === "context_init") {
    _user = msg.user;
    _workspace = msg.workspace;
    _workforce = msg.workforce ?? null;
  } else if (msg.type === "context_route") {
    _route = {
      path: msg.path,
      query: msg.query,
      entity_type: msg.entity_type,
      entity_id: msg.entity_id,
      entity_label: msg.entity_label,
    };
  }
}

/**
 * Returns the current context snapshot.
 * All three blocks are nullable — callers must handle the not-yet-initialised case.
 */
export function getSessionContextSnapshot(): SessionContextSnapshot {
  return {
    user: _user,
    workspace: _workspace,
    route: _route,
    workforce: _workforce,
  };
}

/**
 * Parse a raw LiveKit data payload (Uint8Array) into a ContextMessage.
 * Returns null if the payload is malformed or the topic is not "botsson-context".
 *
 * The LiveKit Python/Node SDKs deliver data as a Uint8Array. We decode it as
 * UTF-8 JSON. Unknown message types are silently ignored so future message
 * additions don't break older worker builds.
 */
export function parseContextPayload(
  payload: Uint8Array,
  topic: string | undefined,
): ContextMessage | null {
  if (topic !== "botsson-context") return null;
  try {
    const text = new TextDecoder().decode(payload);
    const parsed: unknown = JSON.parse(text);
    if (!parsed || typeof parsed !== "object") return null;
    const obj = parsed as Record<string, unknown>;
    if (obj["type"] !== "context_init" && obj["type"] !== "context_route") return null;
    return obj as unknown as ContextMessage;
  } catch {
    // Malformed payload — silently discard. Never throw into the agent event loop.
    return null;
  }
}
