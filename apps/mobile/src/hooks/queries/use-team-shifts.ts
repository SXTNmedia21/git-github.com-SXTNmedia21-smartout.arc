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

/** Valid Department slugs (mirrors the union in types.ts). */
const KNOWN_DEPT_SLUGS = new Set<Department>([
  "kjokken",
  "sal",
  "bar",
  "event",
  "kitchen",
  "operations",
  "service",
]);

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
  // ADR-0430 M4: zone dropped from schedule_shift — zone display deferred to zones[]
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

/** Supabase join shape for profile rows.
 *  profile has ONLY display_name (CLAUDE.md trap, no first_name/last_name/color
 *  columns) — derive firstName/lastName client-side via split, color falls
 *  back to department-derived color.
 */
type ProfileRow = {
  profile_id: string;
  display_name: string | null;
};

/** Supabase join shape for position → department */
type PositionRow = {
  department: {
    department_id: string;
    slug: string;
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
  // ADR-0430 M4: zone removed from schedule_shift
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
    // Try active profile first, fall back to ANY profile for this user.
    // .maybeSingle() returns null instead of throwing PGRST116 on zero rows —
    // critical for seed data where is_active may not be set.
    const { data: activeProf, error: activeErr } = await supabase
      .from("profile")
      .select("profile_id")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();
    if (activeErr) throw activeErr;
    if (activeProf) {
      resolvedProfileId = activeProf.profile_id;
    } else {
      // Fallback: any profile (covers seed users w/o is_active=true)
      const { data: anyProf, error: anyErr } = await supabase
        .from("profile")
        .select("profile_id")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();
      if (anyErr) throw anyErr;
      if (!anyProf) throw new Error("Profile not found");
      resolvedProfileId = anyProf.profile_id;
    }
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
      employee_id,
      profile:employee_id (
        profile_id,
        display_name
      ),
      position:position_id (
        department:department_id (
          department_id,
          slug,
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
    // profile has only display_name (CLAUDE.md trap) — split for parts.
    const parts = (prof?.display_name ?? "").trim().split(/\s+/).filter(Boolean);
    const firstName = parts[0] ?? "";
    const lastName = parts.length > 1 ? parts[parts.length - 1]! : "";
    const ownerName =
      firstName && lastName ? `${firstName} ${lastName.charAt(0)}.` : firstName || "Ukjent";
    const ownerInitials =
      firstName && lastName
        ? `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase()
        : firstName
          ? firstName.slice(0, 2).toUpperCase()
          : "??";

    // Dept resolved via position → department (canonical per ADR-0266 §Implementation contract).
    // Read department.slug directly from DB — no substring heuristic (dropped 2026-05-18).
    const dept = row.position?.department;
    const rawSlug = dept?.slug;
    let deptSlug: Department = "kjokken"; // conservative fallback for null position
    if (rawSlug) {
      if (KNOWN_DEPT_SLUGS.has(rawSlug as Department)) {
        deptSlug = rawSlug as Department;
      } else {
        // Fail-loud per L-0177 pattern: slug exists in DB but is not in the union.
        // Operator must add it to the Department union and design-token palette.
        console.warn(
          `[useTeamShifts] Unknown department.slug "${rawSlug}" — falling back to "kjokken". ` +
            "Add to Department union in types.ts and color token in native.ts.",
        );
      }
    }
    // Prefer DB-stored color; fall back to design-token constant
    const deptColor = dept?.color ?? deptColorFor(deptSlug);
    // No per-profile color column — always fall back to dept color.
    const ownerColor = deptColor;

    return {
      id: row.schedule_shift_id,
      date: dayOfMonth(row.shift_date),
      shiftDate: row.shift_date,
      time: formatTimeRange(row.start_time, row.end_time),
      title: row.role,
      role: row.role,
      // ADR-0430 M4: zone dropped — isShiftLead derived from role string
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
