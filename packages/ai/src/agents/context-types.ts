// ============================================
// context-types.ts
// Shared context block types for the Botsson context pipe.
// Three blocks flow from browser → BFF → stage-engine → AgentToolContext:
//   UserContext     — who is speaking
//   WorkspaceContext — where they are (org + cascade state)
//   RouteContext    — what page/entity they are looking at
// Referenced by: services/voice-agent, services/stage-engine, apps/web BFF
// ============================================

/** Who is speaking — derived server-side from JWT + profile table. */
export type UserContext = {
  profile_id: string;
  role: "owner" | "admin" | "manager" | "employee";
  status: "trainee" | "active" | "inactive" | "offboarding";
  department_id: string | null;
  display_name: string;
  /** Resolved as profile.language_override ?? workspace.language. */
  language: "no" | "en" | "sv" | "da" | "fi";
};

/** Workspace identity + active cascade state. */
export type WorkspaceContext = {
  workspace_id: string;
  name: string;
  /** Workspace industry/niche (e.g. "restaurant", "hotel", "cafe"). */
  niche: string | null;
  /** Active season_id (status='active'), or null when no active season. */
  active_season_id: string | null;
  /** Bound regulatory framework id (is_active=true), or null when none. */
  active_framework_id: string | null;
  /** Most recent active planning_cycle_id (status='active'), or null. */
  planning_cycle_id: string | null;
};

/** Current page, query, and focused entity. */
export type RouteContext = {
  /** Current pathname, e.g. "/dashboard/schedule". */
  path: string;
  /** Parsed query params as string map. */
  query: Record<string, string>;
  /** Entity type focused on the page, e.g. "shift", "profile", "channel". */
  entity_type: string | null;
  /** Entity primary-key value (UUID). */
  entity_id: string | null;
  /** Human-readable label for the focused entity, e.g. "Fredag 19:00 Frontdesk". */
  entity_label: string | null;
};

// D2+D6 workforce snapshot delivered at session start. Botsson is a workforce
// assistant — must know employees/shifts/absences/sessions before the first turn
// (2026-05-13 directive). NOT fetched via tool-calls. Same shape on chat and voice.
// PII (ADR-0078): names, roles, departments, phones, absence types OK on both
// channels. Bank/tax/personnummer/contract details NEVER included here.
export type WorkforceEmployee = {
  profile_id: string;
  display_name: string;
  role: string;
  status: string;
  department_id: string | null;
  department_name: string | null;
  phone: string | null;
};

export type WorkforceShift = {
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

export type WorkforceAbsence = {
  absence_id: string;
  profile_id: string;
  employee_name: string | null;
  absence_type: string;
  start_date: string;
  end_date: string;
};

export type WorkforceSession = {
  session_id: string;
  department_id: string | null;
  department_name: string | null;
  status: string;
  scheduled_date: string;
};

export type WorkforceContext = {
  employees: WorkforceEmployee[];
  shifts_today: WorkforceShift[];
  shifts_tomorrow: WorkforceShift[];
  absences_active: WorkforceAbsence[];
  sessions_today: WorkforceSession[];
  /** ISO timestamp of when the BFF assembled this snapshot. */
  snapshot_at: string;
};
