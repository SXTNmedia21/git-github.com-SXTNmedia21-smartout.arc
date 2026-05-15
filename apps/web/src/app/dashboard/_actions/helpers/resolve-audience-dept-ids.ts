// =============================================================================
// resolve-audience-dept-ids.ts
// Server-only helper — maps audience JSONB to the SET of department_ids it touches.
//
// WHY: The create-targeted-note-action Server Action needs to classify whether
//   an audience is "own-dept" or "cross-dept" BEFORE calling gateAction().
//   This helper performs the DB joins required to resolve team_ids → dept_id,
//   shift_ids → dept_id, and profile_ids → dept_id (via profile.department_id).
//
// REUSE: Track F's Edge Function (note-fanout-scheduler/audience-resolver.ts)
//   contains its own copy of the Supabase query logic because Edge Functions
//   run in Deno and cannot import from apps/web. The JSONB shape contract is
//   shared via @smartout/types noteAudienceSchema (packages/types/src/session-note.ts).
//
// CALLER CONTRACT:
//   - adminClient must be createAdminClient() — service role, not user JWT.
//   - Returns a deduplicated Set<string> of dept UUIDs.
//   - Rows whose entities no longer exist (deleted team, shift, profile)
//     are silently omitted — caller decides if empty set is an error.
// =============================================================================

import type { SupabaseClient } from "@supabase/supabase-js";
import type { NoteAudience } from "@smartout/types";

/**
 * Resolves an audience JSONB to the set of department_ids it references.
 * Performs DB joins via service-role client:
 *   - audience.dept_ids   → returned as-is
 *   - audience.team_ids   → JOIN team.department_id
 *   - audience.shift_ids  → JOIN schedule_shift.department_id
 *   - audience.profile_ids → JOIN profile.department_id
 *
 * Used by create-targeted-note-action to classify cross-department audience
 * for the C4 gate (ADR-0333) BEFORE inserting the note.
 */
export async function resolveAudienceDeptIds(
  audience: NoteAudience,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  adminClient: SupabaseClient<any>,
): Promise<Set<string>> {
  const deptIds = new Set<string>();

  // 1. Explicit dept_ids — add directly.
  for (const id of audience.dept_ids ?? []) {
    deptIds.add(id);
  }

  // 2. team_ids → JOIN team.department_id
  if ((audience.team_ids ?? []).length > 0) {
    const { data: teamRows } = await adminClient
      .from("team")
      .select("department_id")
      .in("team_id", audience.team_ids!);
    for (const row of teamRows ?? []) {
      if (row.department_id) deptIds.add(row.department_id);
    }
  }

  // 3. shift_ids → JOIN schedule_shift.department_id
  if ((audience.shift_ids ?? []).length > 0) {
    const { data: shiftRows } = await adminClient
      .from("schedule_shift")
      .select("department_id")
      .in("schedule_shift_id", audience.shift_ids!);
    for (const row of shiftRows ?? []) {
      if (row.department_id) deptIds.add(row.department_id);
    }
  }

  // 4. profile_ids → JOIN profile.department_id (profile column is `department_id`)
  if ((audience.profile_ids ?? []).length > 0) {
    const { data: profileRows } = await adminClient
      .from("profile")
      .select("department_id")
      .in("profile_id", audience.profile_ids!);
    for (const row of profileRows ?? []) {
      if (row.department_id) deptIds.add(row.department_id);
    }
  }

  return deptIds;
}
