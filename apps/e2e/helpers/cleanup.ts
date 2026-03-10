import { supabase } from "./seed";

/**
 * Delete all test data for a workspace in reverse FK order.
 *
 * Only tables that actually exist in the database are included.
 * Tables referencing department_session (daily_reconciliation, deviation, waste_log)
 * and schedule_shift (shift_approval, deviation) are deleted first.
 */
export async function cleanupTestData(workspaceId: string): Promise<void> {
  // Tables that reference department_session via session_id
  const sessionDependents = ["daily_reconciliation", "deviation", "waste_log"] as const;

  // Tables that reference schedule_shift
  const shiftDependents = ["shift_approval"] as const;

  // Core tables in reverse FK order
  const coreTables = [
    "protocol_assignment", // no workspace_id — filter via profile join below
    "schedule_shift",
    "department_session",
    "protocol",
    "policy",
    "profile",
    "department",
  ] as const;

  // 1. Delete session dependents (they have workspace_id or join through session)
  for (const table of sessionDependents) {
    const { error } = await supabase.from(table).delete().eq("workspace_id", workspaceId);

    if (error) {
      console.warn(`cleanup ${table}: ${error.message}`);
    }
  }

  // 2. Delete shift dependents
  for (const table of shiftDependents) {
    const { error } = await supabase.from(table).delete().eq("workspace_id", workspaceId);

    if (error) {
      console.warn(`cleanup ${table}: ${error.message}`);
    }
  }

  // 3. Delete protocol_assignment via profile join
  //    protocol_assignment has no workspace_id — get profile_ids first
  const { data: profiles } = await supabase
    .from("profile")
    .select("profile_id")
    .eq("workspace_id", workspaceId);

  if (profiles && profiles.length > 0) {
    const profileIds = profiles.map((p) => p.profile_id);
    const { error } = await supabase
      .from("protocol_assignment")
      .delete()
      .in("profile_id", profileIds);

    if (error) {
      console.warn(`cleanup protocol_assignment: ${error.message}`);
    }
  }

  // 4. Delete core tables (skip protocol_assignment — already handled)
  const remainingCoreTables = [
    "schedule_shift",
    "department_session",
    "protocol",
    "policy",
    "profile",
    "department",
  ] as const;

  for (const table of remainingCoreTables) {
    const { error } = await supabase.from(table).delete().eq("workspace_id", workspaceId);

    if (error) {
      console.warn(`cleanup ${table}: ${error.message}`);
    }
  }

  // 5. Delete the workspace itself
  const { error } = await supabase.from("workspace").delete().eq("workspace_id", workspaceId);

  if (error) {
    console.warn(`cleanup workspace: ${error.message}`);
  }
}
