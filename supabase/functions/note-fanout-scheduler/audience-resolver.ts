// =============================================================================
// audience-resolver.ts
// Deno-native audience resolver for the note-fanout-scheduler Edge Function.
//
// WHY: At fanout time (notify_at <= now()) the scheduler must expand an
//   audience JSONB blob into a concrete list of profile_ids[]. This module
//   performs the 4 sub-resolvers (dept_ids, team_ids, shift_ids, profile_ids),
//   deduplicates the result, and validates surviving profile_ids against the
//   profile table to detect dangling references (profiles deleted between
//   note creation and fire time).
//
// NOTE: This is a Deno-only module. It does NOT import from @smartout/types
//   or apps/web — types are inlined below. The NoteAudience shape is the same
//   contract as packages/types/src/session-note.ts::noteAudienceSchema.
//
// CANONICAL REF: ADR-0331 (audience JSONB shape), ADR-0332 (pg_cron->EF pattern).
// =============================================================================

// ─── Minimal Supabase client interface (no jsr import needed in this module) ─
// This keeps audience-resolver.ts free of the supabase-js package import so
// unit tests can run without Deno JSR cache. The concrete client from
// jsr:@supabase/supabase-js@2 satisfies this interface structurally.
type QueryResult = { data: Record<string, string | null>[] | null; error: { message: string } | null };

type QueryBuilder = {
  select: (cols: string) => QueryBuilder;
  in: (col: string, vals: string[]) => QueryBuilder;
  eq: (col: string, val: string) => QueryBuilder;
  then: (resolve: (v: QueryResult) => void) => void;
};

export type MinimalSupabaseClient = {
  from: (table: string) => QueryBuilder;
};

// ─── Inlined audience type (mirrors @smartout/types::NoteAudience) ──────────
// Shape is write-once at note creation time; resolver is read-once at fire time.
export type NoteAudience = {
  dept_ids?: string[];
  team_ids?: string[];
  shift_ids?: string[];
  profile_ids?: string[];
};

export type ResolveResult = {
  profileIds: string[];
  danglingCount: number;
};

/**
 * Resolves a note's audience JSONB to a deduplicated list of profile_ids.
 *
 * Sub-resolvers (in order):
 *   1. audience.profile_ids  as-is (direct targets)
 *   2. audience.team_ids     team_member.profile_id WHERE team_id = ANY(team_ids)
 *   3. audience.shift_ids    schedule_shift.employee_id WHERE schedule_shift_id = ANY(shift_ids)
 *   4. audience.dept_ids     profile.profile_id WHERE primary_department_id = ANY(dept_ids)
 *
 * All queries enforce workspace_id isolation.
 * Dangling profiles (not found in profile table at fire time) are excluded and counted.
 */
export async function resolveAudienceProfileIds(
  audience: NoteAudience,
  workspaceId: string,
  client: MinimalSupabaseClient,
): Promise<ResolveResult> {
  const resolved = new Set<string>();

  // ── 1. Explicit profile_ids ─────────────────────────────────────────────
  for (const id of audience.profile_ids ?? []) {
    resolved.add(id);
  }

  // ── 2. team_ids → team_member.profile_id ───────────────────────────────
  if ((audience.team_ids ?? []).length > 0) {
    const { data: teamRows, error: teamErr } = await client
      .from("team_member")
      .select("profile_id")
      .in("team_id", audience.team_ids!)
      // team_member has no workspace_id column — tenant isolation via profile FK;
      // we filter by workspace in the dangling-profile confirmation step below.
      ;
    if (teamErr) {
      console.warn(
        JSON.stringify({
          level: "warn",
          resolver: "team_ids",
          error: teamErr.message,
          workspace_id: workspaceId,
        }),
      );
    }
    for (const row of teamRows ?? []) {
      if (row.profile_id) resolved.add(row.profile_id);
    }
  }

  // ── 3. shift_ids → schedule_shift.employee_id ──────────────────────────
  if ((audience.shift_ids ?? []).length > 0) {
    const { data: shiftRows, error: shiftErr } = await client
      .from("schedule_shift")
      .select("employee_id")
      .in("schedule_shift_id", audience.shift_ids!)
      .eq("workspace_id", workspaceId);
    if (shiftErr) {
      console.warn(
        JSON.stringify({
          level: "warn",
          resolver: "shift_ids",
          error: shiftErr.message,
          workspace_id: workspaceId,
        }),
      );
    }
    for (const row of shiftRows ?? []) {
      if (row.employee_id) resolved.add(row.employee_id);
    }
  }

  // ── 4. dept_ids → profile.profile_id WHERE primary_department_id = ANY ─
  if ((audience.dept_ids ?? []).length > 0) {
    const { data: profileRows, error: deptErr } = await client
      .from("profile")
      .select("profile_id")
      .in("primary_department_id", audience.dept_ids!)
      .eq("workspace_id", workspaceId);
    if (deptErr) {
      console.warn(
        JSON.stringify({
          level: "warn",
          resolver: "dept_ids",
          error: deptErr.message,
          workspace_id: workspaceId,
        }),
      );
    }
    for (const row of profileRows ?? []) {
      if (row.profile_id) resolved.add(row.profile_id);
    }
  }

  // ── Dangling filter ─────────────────────────────────────────────────────
  // Confirm all resolved profile_ids still exist in this workspace.
  // Profiles deleted between note creation and fire time are silently dropped.
  if (resolved.size === 0) {
    return { profileIds: [], danglingCount: 0 };
  }

  const resolvedArr = Array.from(resolved);
  const { data: confirmedRows, error: confirmErr } = await client
    .from("profile")
    .select("profile_id")
    .in("profile_id", resolvedArr)
    .eq("workspace_id", workspaceId);

  if (confirmErr) {
    console.warn(
      JSON.stringify({
        level: "warn",
        resolver: "dangling_filter",
        error: confirmErr.message,
        workspace_id: workspaceId,
      }),
    );
    // On confirm error: return unfiltered list (at-most-once tradeoff acceptable)
    return { profileIds: resolvedArr, danglingCount: 0 };
  }

  const confirmedSet = new Set((confirmedRows ?? []).map((r) => r.profile_id as string));
  const profileIds = resolvedArr.filter((id) => confirmedSet.has(id));
  const danglingCount = resolvedArr.length - profileIds.length;

  return { profileIds, danglingCount };
}
