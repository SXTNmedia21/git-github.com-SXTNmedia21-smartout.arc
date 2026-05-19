/**
 * useTeamStaff — Fetches all active workspace profiles independent of
 * shift scope. Powers the Ansatt-dropdown in ShiftListScreen so it always
 * shows the full team, not just the staff visible in the current scope view.
 *
 * Why a sibling hook rather than extending useTeamShifts:
 *   useTeamShifts result is scope-filtered (ADR-0266); when scope='me' only
 *   the logged-in user's shifts return → staff derived from that list has 1
 *   entry. The Ansatt-dropdown must show every active team member regardless.
 *   Separate hook = separate query key = no coupling to scope state.
 *   (Plan: docs/plans/PLAN-ui-shell-staff-prefetch.md, Option A)
 *
 * RLS: profile rows are workspace-scoped via JWT — no body-supplied
 * workspace_id (L-0177). is_active filter reduces payload to current staff.
 *
 * Query key: ["team-staff", "v1"] — stable across rerenders, stale after 5 min.
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { nativeTheme } from "@smartout/design-tokens/native";
import type { Department, Staff } from "@/components/calendar/types";

const DEPT_COLORS = nativeTheme.department;

/** Canonical hex color for a dept slug, falls back to brandOrange. */
function deptColorFor(slug: Department | null | undefined): string {
  if (!slug) return "#ea7a3b";
  const key = slug as keyof typeof DEPT_COLORS;
  return (DEPT_COLORS[key] as string | undefined) ?? "#ea7a3b";
}

/** Map a DB department name to our Department union slug. */
function toDeptSlug(name: string | null | undefined): Department {
  const n = (name ?? "").toLowerCase();
  if (n.includes("kjøkken") || n.includes("kjokken") || n.includes("kitchen")) return "kjokken";
  if (n.includes("sal") || n.includes("floor") || n.includes("service")) return "sal";
  if (n.includes("bar")) return "bar";
  if (n.includes("event")) return "event";
  return "kjokken"; // safe fallback matching use-team-shifts.ts
}

/** Raw profile row returned by the Supabase select. */
type RawProfileRow = {
  profile_id: string;
  display_name: string | null;
  avatar_color: string | null;
  department: {
    department_id: string;
    name: string;
    color: string | null;
  } | null;
};

/** Map a raw profile row to the shared Staff shape. */
function mapProfileRow(row: RawProfileRow): Staff {
  // profile has only display_name (CLAUDE.md trap — no first_name/last_name columns).
  // Split client-side to derive "Firstname L." display form + initials.
  // Reuses the same logic as use-team-shifts.ts:221-232.
  const parts = (row.display_name ?? "").trim().split(/\s+/).filter(Boolean);
  const firstName = parts[0] ?? "";
  const lastName = parts.length > 1 ? parts[parts.length - 1]! : "";
  const name =
    firstName && lastName ? `${firstName} ${lastName.charAt(0)}.` : firstName || "Ukjent";
  const initials =
    firstName && lastName
      ? `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase()
      : firstName
        ? firstName.slice(0, 2).toUpperCase()
        : "??";

  const dept = row.department;
  const deptSlug = toDeptSlug(dept?.name);
  // Prefer DB-stored color; fall back to design-token constant (same pattern as
  // use-team-shifts.ts:238-240).
  const deptColor = dept?.color ?? deptColorFor(deptSlug);
  // No per-profile color column in schema — always fall back to dept color.
  const color = row.avatar_color ?? deptColor;

  return {
    id: row.profile_id,
    name,
    // role is not stored on profile directly; use dept name as a
    // human-readable substitute (consistent with how shifts build the list).
    role: dept?.name ?? deptSlug,
    dept: deptSlug,
    initials,
    color,
  };
}

async function fetchTeamStaff(): Promise<Staff[]> {
  const { data, error } = await supabase
    .from("profile")
    .select(
      "profile_id, display_name, avatar_color, department:department_id(department_id, name, color)",
    )
    .eq("is_active", true);

  if (error) throw error;
  if (!data) return [];

  return (data as unknown as RawProfileRow[]).map(mapProfileRow);
}

/**
 * Returns all active workspace profiles, independent of the current shift scope.
 * Used by ShiftListScreen's Ansatt-dropdown so the full team is always listed.
 */
export function useTeamStaff() {
  return useQuery<Staff[]>({
    queryKey: ["team-staff", "v1"],
    queryFn: fetchTeamStaff,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}
