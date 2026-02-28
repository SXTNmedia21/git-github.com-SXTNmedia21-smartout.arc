"use server";

import { createClient } from "@smartout/supabase/server";
import type { Database, TablesUpdate } from "@smartout/supabase";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Typed helper to get a server client with proper Database generics. */
async function getClient(): Promise<SupabaseClient<Database>> {
  return (await createClient()) as unknown as SupabaseClient<Database>;
}

export async function updateProfileRole(
  profileId: string,
  workspaceId: string,
  newRole: NonNullable<TablesUpdate<"profile">["role"]>,
) {
  const supabase = await getClient();
  const { error } = await supabase
    .from("profile")
    .update({ role: newRole })
    .eq("profile_id", profileId)
    .eq("workspace_id", workspaceId);

  if (error) throw new Error(error.message);
}

export async function updateProfileDepartment(
  profileId: string,
  workspaceId: string,
  departmentId: string,
) {
  const supabase = await getClient();
  const { error } = await supabase
    .from("profile")
    .update({ department_id: departmentId })
    .eq("profile_id", profileId)
    .eq("workspace_id", workspaceId);

  if (error) throw new Error(error.message);
}

export async function deactivateProfile(profileId: string, workspaceId: string) {
  const supabase = await getClient();
  const { error } = await supabase
    .from("profile")
    .update({ status: "offboarding", is_active: false } satisfies TablesUpdate<"profile">)
    .eq("profile_id", profileId)
    .eq("workspace_id", workspaceId);

  if (error) throw new Error(error.message);
}

export async function resetUserPassword(email: string) {
  const supabase = await getClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email);
  if (error) throw new Error(error.message);
}

export async function cancelInvitation(invitationId: string) {
  const supabase = await getClient();
  const { error } = await supabase
    .from("invitation")
    .update({ status: "cancelled" } satisfies TablesUpdate<"invitation">)
    .eq("invitation_id", invitationId);

  if (error) throw new Error(error.message);
}
