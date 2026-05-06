"use client";

/**
 * useTeamAvailability — web-side team availability query for
 * WebDayControl RosterTab and AddShiftDialog (Sortie 3 tasks M/N).
 *
 * ADR-0132 web-side BFF rule: goes through the same-origin POST
 * `/api/availability/query` endpoint (not a direct `supabase.from(
 * "employee_availability")` call). Same-origin cookies carry the user
 * session — no Authorization header needed — and `credentials:
 * "include"` is set for belt-and-braces.
 *
 * BFF gates on `availability.query_others` (chat-only per ADR-0202)
 * and re-derives identity server-side (ADR-0176 Invariant 3).
 *
 * Input `departmentId` is an optional filter; when provided the hook
 * resolves dept→profile_ids with a lightweight `profile` query
 * (JWT RLS-scoped) before hitting the BFF. When omitted, the BFF
 * returns the whole workspace (bounded by RLS).
 *
 * Output mirrors the plan's `TeamAvailabilityResult` shape:
 *   - `profiles[*].availability_rules` — raw BFF rows, preserved so the
 *     caller (RosterTab/AddShiftDialog) can re-evaluate or re-render.
 *   - `profiles[*].daily_status` — resolved single-day status for
 *     `dateISO`: `'available' | 'unavailable' | 'preferred'`. DB enum
 *     is `preference_type ∈ {unavailable, preferred, blocked}`; for UI
 *     we fold `blocked → unavailable` (stronger intent, same visual).
 *     Plan's `'absent'` value is intentionally NOT emitted here — that
 *     represents `schedule_absence` rows (vacation/sick), a separate
 *     source this hook does not consume. Declared in the type for
 *     forward compatibility with a future absence-aware selector.
 *
 * Daily-resolution logic ports the minimal RRULE matcher from
 * `apps/mobile/src/hooks/queries/use-my-availability.ts` (FREQ=WEEKLY;
 * BYDAY=<codes>). Other FREQ values fall through as "available". A
 * shared `rrule` helper is not yet extracted — when one lands, both
 * web and mobile should migrate together.
 *
 * Precedence (strongest wins): blocked > unavailable > preferred >
 * available.
 */
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { createClient } from "@smartout/supabase/client";

export type PreferenceType = "unavailable" | "preferred" | "blocked";

export type DailyStatus = "available" | "unavailable" | "preferred" | "absent"; // reserved — not emitted from this hook (see header).

export interface AvailabilityRule {
  id: string;
  valid_from: string; // ISO YYYY-MM-DD
  valid_to: string | null;
  rrule: string | null;
  preference_type: PreferenceType;
  reason?: string;
}

export interface TeamAvailabilityProfile {
  profile_id: string;
  display_name: string;
  daily_status: DailyStatus;
  reason?: string;
  availability_rules: AvailabilityRule[];
}

export interface TeamAvailabilityResult {
  profiles: TeamAvailabilityProfile[];
}

export interface UseTeamAvailabilityInput {
  workspaceId: string;
  departmentId?: string;
  dateISO: string; // ISO YYYY-MM-DD, single day
}

// ---------------------------------------------------------------------
// BFF response shape (see apps/web/src/app/api/availability/query/route.ts)
// ---------------------------------------------------------------------
interface BffRow {
  id: string;
  workspace_id: string;
  profile_id: string;
  valid_from: string;
  valid_to: string | null;
  rrule: string | null;
  preference_type: PreferenceType;
  reason: string | null;
  created_at: string;
  updated_at: string;
  created_by: string;
}

interface BffQueryResponse {
  ok: boolean;
  rows?: BffRow[];
  error?: string;
  surface?: string;
}

// ---------------------------------------------------------------------
// Day-resolution (ported from mobile use-my-availability)
// ---------------------------------------------------------------------
const STATUS_RANK: Record<"available" | "unavailable" | "preferred" | "blocked", number> = {
  available: 0,
  preferred: 1,
  unavailable: 2,
  blocked: 3,
};

const BYDAY_TO_DOW: Record<string, number> = {
  SU: 0,
  MO: 1,
  TU: 2,
  WE: 3,
  TH: 4,
  FR: 5,
  SA: 6,
};

function parseIsoDate(s: string): Date {
  const [y, m, d] = s.split("-").map((p) => Number(p));
  return new Date(y ?? 0, (m ?? 1) - 1, d ?? 1);
}

function rruleMatchesDate(rrule: string, date: Date): boolean {
  const parts: Record<string, string> = {};
  for (const part of rrule.split(";")) {
    const [k, v] = part.split("=");
    if (k && v) parts[k.toUpperCase()] = v.toUpperCase();
  }
  if (parts.FREQ !== "WEEKLY") return false;
  const byday = parts.BYDAY;
  if (!byday) return false;
  const codes = byday.split(",").map((c) => c.trim());
  const dow = date.getDay();
  return codes.some((c) => BYDAY_TO_DOW[c] === dow);
}

function isRuleActiveOn(rule: BffRow, date: Date): boolean {
  const from = parseIsoDate(rule.valid_from);
  if (date < from) return false;
  if (rule.valid_to) {
    const to = parseIsoDate(rule.valid_to);
    if (date > to) return false;
  }
  if (rule.rrule) {
    return rruleMatchesDate(rule.rrule, date);
  }
  return true;
}

function resolveDayStatus(
  rules: BffRow[],
  dateISO: string,
): { status: "available" | "unavailable" | "preferred"; reason?: string } {
  const date = parseIsoDate(dateISO);
  let winningPref: "available" | PreferenceType = "available";
  let winningReason: string | null = null;

  for (const rule of rules) {
    if (!isRuleActiveOn(rule, date)) continue;
    const currRank = STATUS_RANK[rule.preference_type];
    const winRank = winningPref === "available" ? STATUS_RANK.available : STATUS_RANK[winningPref];
    if (currRank > winRank) {
      winningPref = rule.preference_type;
      winningReason = rule.reason;
    }
  }

  // Fold DB `blocked` → UI `unavailable` (stronger intent, same visual).
  const uiStatus: "available" | "unavailable" | "preferred" =
    winningPref === "blocked"
      ? "unavailable"
      : winningPref === "available"
        ? "available"
        : winningPref;

  return winningReason ? { status: uiStatus, reason: winningReason } : { status: uiStatus };
}

// ---------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------
async function fetchTeamAvailability(
  input: UseTeamAvailabilityInput,
): Promise<TeamAvailabilityResult> {
  const supabase = createClient();

  // 1) Resolve department → profile_ids (optional filter).
  let profileIdsFilter: string[] | undefined;
  if (input.departmentId) {
    const { data: deptProfiles, error: dpErr } = await supabase
      .from("profile")
      .select("profile_id")
      .eq("workspace_id", input.workspaceId)
      .eq("department_id", input.departmentId)
      .limit(500);
    if (dpErr) throw new Error(dpErr.message);
    profileIdsFilter = (deptProfiles ?? [])
      .map((p) => p.profile_id)
      .filter((id): id is string => Boolean(id));
    // Empty department → no profiles — short-circuit with empty result.
    if (profileIdsFilter.length === 0) {
      return { profiles: [] };
    }
  }

  // 2) Hit BFF for availability rows covering the single day.
  const body: Record<string, unknown> = {
    start_date: input.dateISO,
    end_date: input.dateISO,
  };
  if (profileIdsFilter) body.profile_ids = profileIdsFilter;

  const res = await fetch("/api/availability/query", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  let parsed: BffQueryResponse | null = null;
  try {
    parsed = (await res.json()) as BffQueryResponse;
  } catch {
    /* ignore — handled below */
  }

  if (!res.ok || !parsed?.ok) {
    throw new Error(parsed?.error ?? `BFF ${res.status}`);
  }

  const rows = parsed.rows ?? [];

  // 3) Build the profile set we want in the result. If a department
  //    filter was used, include every member even if they have no rules
  //    (so RosterTab can render "available" for the whole team). If no
  //    filter, return only profiles that have rows — the BFF does not
  //    expose a whole-workspace roster and this hook is not the place
  //    to enumerate it.
  const profileIds = new Set<string>();
  if (profileIdsFilter) {
    for (const id of profileIdsFilter) profileIds.add(id);
  }
  for (const row of rows) profileIds.add(row.profile_id);

  if (profileIds.size === 0) {
    return { profiles: [] };
  }

  // 4) Fetch display names for the resolved profile set.
  const { data: profileRows, error: profErr } = await supabase
    .from("profile")
    .select("profile_id, display_name")
    .in("profile_id", Array.from(profileIds))
    .eq("workspace_id", input.workspaceId);
  if (profErr) throw new Error(profErr.message);

  const nameMap = new Map<string, string>();
  for (const p of profileRows ?? []) {
    if (p.profile_id) nameMap.set(p.profile_id, p.display_name ?? "");
  }

  // 5) Group rows by profile and resolve daily status.
  const rowsByProfile = new Map<string, BffRow[]>();
  for (const row of rows) {
    const bucket = rowsByProfile.get(row.profile_id) ?? [];
    bucket.push(row);
    rowsByProfile.set(row.profile_id, bucket);
  }

  const profiles: TeamAvailabilityProfile[] = [];
  for (const pid of profileIds) {
    const profileRows = rowsByProfile.get(pid) ?? [];
    const resolved = resolveDayStatus(profileRows, input.dateISO);
    const profile: TeamAvailabilityProfile = {
      profile_id: pid,
      display_name: nameMap.get(pid) ?? "",
      daily_status: resolved.status,
      availability_rules: profileRows.map((r) => {
        const rule: AvailabilityRule = {
          id: r.id,
          valid_from: r.valid_from,
          valid_to: r.valid_to,
          rrule: r.rrule,
          preference_type: r.preference_type,
        };
        if (r.reason !== null) rule.reason = r.reason;
        return rule;
      }),
    };
    if (resolved.reason !== undefined) profile.reason = resolved.reason;
    profiles.push(profile);
  }

  // Stable order: by display_name, then profile_id.
  profiles.sort((a, b) => {
    const n = a.display_name.localeCompare(b.display_name, "nb");
    return n !== 0 ? n : a.profile_id.localeCompare(b.profile_id);
  });

  return { profiles };
}

export function useTeamAvailability(
  input: UseTeamAvailabilityInput,
): UseQueryResult<TeamAvailabilityResult> {
  return useQuery<TeamAvailabilityResult>({
    queryKey: ["team-availability", input.workspaceId, input.departmentId ?? null, input.dateISO],
    queryFn: () => fetchTeamAvailability(input),
    enabled: Boolean(input.workspaceId) && Boolean(input.dateISO),
    staleTime: 60_000,
  });
}
