/**
 * useTeamShifts — Fetches all published shifts in the workspace for a given week,
 * joined with profile (name, initials, avatar color) and department color.
 *
 * Used by ShiftListScreen (Phase 3d). Returns a flat array of ShiftWithProfile
 * after applying client-side scope filter per ADR-0266: RLS guarantees workspace
 * isolation; scope is product UX, not auth.
 *
 * ADR-0266 §Implementation contract:
 * - department_id on schedule_shift is NULLABLE-by-design — dept link goes
 *   through position_id → position.department_id, not shift.department_id.
 * - No body-supplied workspace_id — workspace is JWT-derived via RLS.
 * - Client-filter is canonical for read-only scope-modes.
 *
 * Query key: ["team-shifts", profileId, weekStart, scope.kind, scope.value]
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useWorkspaceStore } from "@/hooks/stores/use-workspace-store";
import { nativeTheme } from "@smartout/design-tokens/native";
import type { Scope } from "@/components/calendar/ScopeChips";
import type { Department } from "@/components/calendar/types";

const DEPT_COLORS = nativeTheme.department;

/** Canonical hex color for a dept slug, falls back to brandOrange. */
function deptColorFor(slug: Department | null | undefined): string {
  if (!slug) return "#ea7a3b";
  const key = slug as keyof typeof DEPT_COLORS;
  return (DEPT_COLORS[key] as string | undefined) ?? "#ea7a3b";
}

/** Decimal hours from HH:MM strings minus break minutes. */
function calcPlannedHours(start: string, end: string, breakMin: number): number {
  const [sh, sm] = start.split(":").map(Number) as [number, number];
  const [eh, em] = end.split(":").map(Number) as [number, number];
  let minutes = eh * 60 + em - (sh * 60 + sm);
  if (minutes < 0) minutes += 24 * 60;
  return Math.max(0, (minutes - breakMin) / 60);
}

/** "HH–HH" with :00 stripped per handoff style. */
function formatTimeRange(start: string, end: string): string {
  const fmt = (t: string) => t.slice(0, 5).replace(/:00$/, "");
  return `${fmt(start)}–${fmt(end)}`;
}

/** Day-of-month (1..31) parsed from YYYY-MM-DD, avoiding timezone shifts. */
function dayOfMonth(dateStr: string): number {
  return parseInt(dateStr.slice(8, 10), 10);
}

/** Map a DB department name to our Department union slug. */
function toDeptSlug(name: string | null | undefined): Department {
  const n = (name ?? "").toLowerCase();
  if (n.includes("kjøkken") || n.includes("kjokken") || n.includes("kitchen")) return "kjokken";
  if (n.includes("sal") || n.includes("floor") || n.includes("service")) return "sal";
  if (n.includes("bar")) return "bar";
  if (n.includes("event")) return "event";
  return "kjokken"; // safe fallback
}

export type ShiftWithProfile = {
  /** schedule_shift PK */
  id: string;
  /** Day-of-month (1..31) in the shift's month */
  date: number;
  /** ISO date string YYYY-MM-DD */
  shiftDate: string;
  /** "HH–HH" formatted, :00 stripped */
  time: string;
  /** Shift role (used as title) */
  title: string;
  role: string;
  zone: string | null;
  isShiftLead: boolean;
  /** Duration in decimal hours (for ScopeSummary totalling) */
  planned: number;
  /** profile_id of assigned employee */
  owner: string;
  /** Department slug */
  dept: Department;
  /** Dept hex color */
  deptColor: string;
  /** "Firstname L." display name */
  ownerName: string;
  /** 2-char initials for Avatar */
  ownerInitials: string;
  /** Avatar color (profile.avatar_color or dept fallback) */
  ownerColor: string;
};

type UseTeamShiftsParams = {
  /** Monday of the target week — YYYY-MM-DD */
  weekStart: string;
  /** Client-side scope filter per ADR-0266 */
  scope: Scope;
  /** profile_id of the logged-in user — used for scope='me' and isOwn detection */
  myProfileId: string | null;
};

/** Supabase join shape for profile rows */
type ProfileRow = {
  profile_id: string;
  first_name: string | null;
  last_name: string | null;
  avatar_color: string | null;
};

/** Supabase join shape for position → department */
type PositionRow = {
  department: {
    id: string;
    name: string;
    color: string | null;
  } | null;
} | null;

/** Raw row before client-side mapping */
type RawShiftRow = {
  schedule_shift_id: string;
  shift_date: string;
  start_time: string;
  end_time: string;
  breaks: number;
  role: string;
  zone: string | null;
  employee_id: string | null;
  profile: ProfileRow | null;
  position: PositionRow;
};

async function fetchTeamShifts(
  selectedProfileId: string | null,
  weekStart: string,
  scope: Scope,
  myProfileId: string | null,
): Promise<ShiftWithProfile[]> {
  // Resolve a profile_id so we can detect auth without body-supplying workspace_id.
  // RLS on schedule_shift already limits rows to the authenticated workspace (L-0177).
  let resolvedProfileId = selectedProfileId;
  if (!resolvedProfileId) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("Not authenticated");
    const { data: prof, error: profErr } = await supabase
      .from("profile")
      .select("profile_id")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .limit(1)
      .single();
    if (profErr || !prof) throw profErr ?? new Error("Profile not found");
    resolvedProfileId = prof.profile_id;
  }

  // Compute Sunday from Monday (weekStart + 6 days)
  const startDate = new Date(weekStart);
  const endDate = new Date(startDate);
  endDate.setDate(startDate.getDate() + 6);
  const weekEnd = endDate.toISOString().split("T")[0]!;

  const { data, error } = await supabase
    .from("schedule_shift")
    .select(
      `
      schedule_shift_id,
      shift_date,
      start_time,
      end_time,
      breaks,
      role,
      zone,
      employee_id,
      profile:employee_id (
        profile_id,
        first_name,
        last_name,
        avatar_color
      ),
      position:position_id (
        department:department_id (
          id,
          name,
          color
        )
      )
    `,
    )
    .eq("is_published", true)
    .gte("shift_date", weekStart)
    .lte("shift_date", weekEnd)
    .order("shift_date", { ascending: true })
    .order("start_time", { ascending: true });

  if (error) throw error;
  if (!data) return [];

  const rows = data as unknown as RawShiftRow[];

  const mapped: ShiftWithProfile[] = rows.map((row) => {
    const prof = row.profile;
    const firstName = prof?.first_name ?? "";
    const lastName = prof?.last_name ?? "";
    const ownerName =
      firstName && lastName ? `${firstName} ${lastName.charAt(0)}.` : firstName || "Ukjent";
    const ownerInitials =
      firstName && lastName
        ? `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase()
        : firstName
          ? firstName.slice(0, 2).toUpperCase()
          : "??";

    // Dept resolved via position → department (canonical per ADR-0266 §Implementation contract)
    const dept = row.position?.department;
    const deptSlug = toDeptSlug(dept?.name);
    // Prefer DB-stored color; fall back to design-token constant
    const deptColor = dept?.color ?? deptColorFor(deptSlug);
    const ownerColor = prof?.avatar_color ?? deptColor;

    return {
      id: row.schedule_shift_id,
      date: dayOfMonth(row.shift_date),
      shiftDate: row.shift_date,
      time: formatTimeRange(row.start_time, row.end_time),
      title: row.role,
      role: row.role,
      zone: row.zone,
      // isShiftLead derived from role string — no dedicated DB column on schedule_shift
      isShiftLead: row.role?.toLowerCase().includes("skiftleder") ?? false,
      planned: calcPlannedHours(row.start_time, row.end_time, row.breaks ?? 0),
      owner: row.employee_id ?? "",
      dept: deptSlug,
      deptColor,
      ownerName,
      ownerInitials,
      ownerColor,
    };
  });

  // ── Client-side scope filter (ADR-0266 §Client-filter logic) ──────────────
  // scope='me': own shifts only
  // scope='all': all workspace shifts (GDPR art.6(1)(f) berettiget interesse, ADR-0266)
  // scope='dept': filter by dept slug
  // scope='person': filter by owner profile_id
  return mapped.filter((s) => {
    switch (scope.kind) {
      case "me":
        return s.owner === (myProfileId ?? resolvedProfileId);
      case "all":
        return true;
      case "dept":
        return s.dept === scope.value;
      case "person":
        return s.owner === scope.value;
    }
  });
}

/**
 * Returns published workspace shifts for the given week, filtered by scope.
 * Data is workspace-isolated via RLS; scope is applied client-side (ADR-0266).
 */
export function useTeamShifts({ weekStart, scope, myProfileId }: UseTeamShiftsParams) {
  const selectedProfileId = useWorkspaceStore((s) => s.selectedProfileId);

  return useQuery<ShiftWithProfile[]>({
    queryKey: ["team-shifts", selectedProfileId ?? myProfileId, weekStart, scope.kind, scope.value],
    queryFn: () => fetchTeamShifts(selectedProfileId, weekStart, scope, myProfileId),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}
