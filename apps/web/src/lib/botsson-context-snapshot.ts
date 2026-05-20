/**
 * Botsson session-context snapshot — shared assembly for chat + voice channels.
 *
 * Single source of truth for the three context blocks Botsson needs at session
 * start (2026-05-13 — ADR-0297 workforce bootstrap):
 *
 *   user      — caller identity (role, status, department, display name, language)
 *   workspace — workspace identity + active cascade state (season, framework, cycle)
 *   workforce — D2+D6 facts: employees, today+tomorrow shifts, absences, sessions
 *
 * Consumed by:
 *   - GET /api/botsson/voice/session-context (voice path, browser fetch)
 *   - POST /api/emma/chat   (chat path, BFF forward to stage-engine)
 *   - POST /api/botsson/chat (chat path, BFF forward to stage-engine)
 *
 * profile_id is derived server-side from (user_id, workspace_id) — never trust
 * client-supplied identity (ADR-0151).
 *
 * PII policy (ADR-0078): names, roles, departments, phones, absence types
 * INCLUDED on both channels. Bank/tax/personnummer/contract details NEVER
 * included — column whitelist enforced via explicit select() projection.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@smartout/supabase/database.types";
import type {
  UserContext,
  WorkspaceContext,
  WorkforceContext,
  WorkforceEmployee,
  WorkforceShift,
  WorkforceAbsence,
  WorkforceSession,
} from "@smartout/ai/agents/context-types";

export type BotssonContextSnapshot = {
  user: UserContext;
  workspace: WorkspaceContext;
  workforce: WorkforceContext;
};

export type BotssonContextError = { error: "PROFILE_NOT_FOUND" } | { error: "WORKSPACE_NOT_FOUND" };

export type BotssonContextResult = BotssonContextSnapshot | BotssonContextError;

type AdminClient = SupabaseClient<Database>;

export async function assembleBotssonContext(
  admin: AdminClient,
  userId: string,
  workspaceId: string,
): Promise<BotssonContextResult> {
  // 1. Resolve profile server-side (ADR-0151).
  const { data: profile, error: profileError } = await admin
    .from("profile")
    .select("profile_id, role, status, department_id, display_name, language_override")
    .eq("user_id", userId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (profileError || !profile) {
    return { error: "PROFILE_NOT_FOUND" };
  }

  // 2. Workspace + cascade state (parallel).
  const [
    { data: workspace, error: workspaceError },
    { data: activeSeason },
    { data: frameworkBinding },
    { data: activeCycle },
  ] = await Promise.all([
    admin
      .from("workspace")
      .select("workspace_id, name, language")
      .eq("workspace_id", workspaceId)
      .maybeSingle(),

    admin
      .from("season")
      .select("season_id")
      .eq("workspace_id", workspaceId)
      .eq("status", "active")
      .maybeSingle(),

    admin
      .from("workspace_framework_binding")
      .select("framework_id")
      .eq("workspace_id", workspaceId)
      .eq("is_active", true)
      .maybeSingle(),

    admin
      .from("planning_cycle")
      .select("planning_cycle_id")
      .eq("workspace_id", workspaceId)
      .eq("status", "active")
      .order("start_date", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (workspaceError || !workspace) {
    return { error: "WORKSPACE_NOT_FOUND" };
  }

  // 3. Workforce snapshot — D2+D6 in parallel. All queries scoped by
  //    workspace_id (Law 1). Failures degrade gracefully — workforce becomes
  //    an empty snapshot rather than aborting the request.
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const weekAhead = new Date(today);
  weekAhead.setDate(weekAhead.getDate() + 7);

  const todayDateOnly = today.toISOString().split("T")[0] as string;
  const tomorrowDateOnly = tomorrow.toISOString().split("T")[0] as string;
  const weekAheadISO = weekAhead.toISOString().split("T")[0] as string;

  const [employeesRes, shiftsRes, absencesRes, sessionsRes] = await Promise.all([
    admin
      .from("profile")
      .select(
        `profile_id, display_name, role, status, department_id,
         department:department_id(name),
         user_identity:user_id(phone)`,
      )
      .eq("workspace_id", workspaceId)
      .eq("is_active", true)
      .order("display_name")
      .limit(50),

    admin
      .from("schedule_shift")
      .select(
        `schedule_shift_id, employee_id, shift_date, start_time, end_time, department_id, role,
         department:department_id(name),
         position:position_id(name),
         profile:employee_id(display_name)`,
      )
      .eq("workspace_id", workspaceId)
      .gte("shift_date", todayDateOnly)
      .lte("shift_date", tomorrowDateOnly)
      .order("shift_date")
      .order("start_time")
      .limit(80),

    admin
      .from("schedule_absence")
      .select(
        `schedule_absence_id, employee_id, absence_type, start_date, end_date,
         profile:employee_id(display_name)`,
      )
      .eq("workspace_id", workspaceId)
      .lte("start_date", weekAheadISO)
      .gte("end_date", todayDateOnly)
      .limit(30),

    admin
      .from("department_session")
      .select(
        `department_session_id, department_id, status, session_date,
         department:department_id(name)`,
      )
      .eq("workspace_id", workspaceId)
      .eq("session_date", todayDateOnly)
      .in("status", ["upcoming", "active", "pending_signoff"])
      .limit(20),
  ]);

  const employees: WorkforceEmployee[] = (employeesRes.data ?? []).map((row) => {
    const dept = row.department as { name?: string } | null;
    const ident = row.user_identity as { phone?: string | null } | null;
    return {
      profile_id: row.profile_id as string,
      display_name: row.display_name as string,
      role: row.role as string,
      status: row.status as string,
      department_id: (row.department_id as string | null) ?? null,
      department_name: dept?.name ?? null,
      phone: ident?.phone ?? null,
    };
  });

  const allShifts: WorkforceShift[] = (shiftsRes.data ?? []).map((row) => {
    const dept = row.department as { name?: string } | null;
    const pos = row.position as { name?: string } | null;
    const prof = row.profile as { display_name?: string } | null;
    return {
      shift_id: row.schedule_shift_id as string,
      profile_id: (row.employee_id as string | null) ?? null,
      employee_name: prof?.display_name ?? null,
      shift_date: row.shift_date as string,
      start_time: row.start_time as string,
      end_time: row.end_time as string,
      department_id: (row.department_id as string | null) ?? null,
      department_name: dept?.name ?? null,
      position_label: pos?.name ?? (row.role as string | null) ?? null,
    };
  });

  const shiftsToday = allShifts.filter((s) => s.shift_date === todayDateOnly);
  const shiftsTomorrow = allShifts.filter((s) => s.shift_date === tomorrowDateOnly);

  const absences: WorkforceAbsence[] = (absencesRes.data ?? []).map((row) => {
    const prof = row.profile as { display_name?: string } | null;
    return {
      absence_id: row.schedule_absence_id as string,
      profile_id: row.employee_id as string,
      employee_name: prof?.display_name ?? null,
      absence_type: row.absence_type as string,
      start_date: row.start_date as string,
      end_date: row.end_date as string,
    };
  });

  const sessions: WorkforceSession[] = (sessionsRes.data ?? []).map((row) => {
    const dept = row.department as { name?: string } | null;
    return {
      session_id: row.department_session_id as string,
      department_id: (row.department_id as string | null) ?? null,
      department_name: dept?.name ?? null,
      status: row.status as string,
      scheduled_date: row.session_date as string,
    };
  });

  // 4. Assemble.
  const resolvedLanguage = (profile.language_override ?? workspace.language ?? "no") as
    | "no"
    | "en"
    | "sv"
    | "da"
    | "fi";

  const userContext: UserContext = {
    profile_id: profile.profile_id as string,
    role: profile.role as UserContext["role"],
    status: profile.status as UserContext["status"],
    department_id: (profile.department_id as string | null) ?? null,
    display_name: profile.display_name as string,
    language: resolvedLanguage,
  };

  const workspaceContext: WorkspaceContext = {
    workspace_id: workspace.workspace_id as string,
    name: workspace.name as string,
    niche: null,
    active_season_id: (activeSeason?.season_id as string | null) ?? null,
    active_framework_id: (frameworkBinding?.framework_id as string | null) ?? null,
    planning_cycle_id: (activeCycle?.planning_cycle_id as string | null) ?? null,
  };

  const workforce: WorkforceContext = {
    employees,
    shifts_today: shiftsToday,
    shifts_tomorrow: shiftsTomorrow,
    absences_active: absences,
    sessions_today: sessions,
    snapshot_at: new Date().toISOString(),
  };

  return {
    user: userContext,
    workspace: workspaceContext,
    workforce,
  };
}

export function isBotssonContextError(result: BotssonContextResult): result is BotssonContextError {
  return "error" in result;
}

/**
 * Compute a stable version token for a workforce snapshot.
 * Shape: `${workspaceId}:${profileId}:${unix_ms}` — deterministic per call, monotonic.
 * Mobile clients cache this token; on the next turn they send it back so the BFF can
 * detect drift (workforce data changed on the server) and return a refreshed snapshot.
 */
export function computeSnapshotVersion(workspaceId: string, profileId: string): string {
  return `${workspaceId}:${profileId}:${Date.now()}`;
}

/**
 * Compute a short content-hash of a snapshot payload.
 * Uses Node.js `crypto.createHash` (available in Next.js App Router edge/server).
 * Truncated to first 16 hex chars — sufficient for drift detection; not a security hash.
 *
 * Import `createHash` lazily at call-time so this module stays tree-shakeable when
 * imported in browser-only paths (where `node:crypto` is unavailable).
 */
export function computeSnapshotHash(snapshot: BotssonContextSnapshot): string {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createHash } = require("node:crypto") as typeof import("crypto");
  return createHash("sha256").update(JSON.stringify(snapshot)).digest("hex").slice(0, 16);
}

/**
 * Strip profile_id from UserContext before forwarding to stage-engine.
 * Stage-engine derives profile_id server-side (ADR-0151) — never accepts
 * a body-supplied profile_id. Use when forwarding to /agent/chat.
 */
export function stripUserContextForWire(user: UserContext): Omit<UserContext, "profile_id"> {
  return {
    role: user.role,
    status: user.status,
    department_id: user.department_id,
    display_name: user.display_name,
    language: user.language,
  };
}
