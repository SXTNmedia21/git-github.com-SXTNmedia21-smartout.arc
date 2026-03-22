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

export async function resendInvitation(
  workspaceId: string,
  invitationId: string,
) {
  const supabase = await getClient();

  // Fetch the original invitation details
  const { data: original, error: fetchError } = await supabase
    .from("invitation")
    .select("email, phone, first_name, last_name, role, department_ids, team_ids, invite_type")
    .eq("invitation_id", invitationId)
    .eq("status", "pending")
    .single();

  if (fetchError || !original) {
    throw new Error("Invitation not found or already accepted/cancelled");
  }

  // Cancel the old invitation
  const { error: cancelError } = await supabase
    .from("invitation")
    .update({ status: "cancelled" } satisfies TablesUpdate<"invitation">)
    .eq("invitation_id", invitationId);

  if (cancelError) throw new Error(cancelError.message);

  // Create a new invitation with fresh token via Edge Function
  const { data, error } = await supabase.functions.invoke("create-invitation", {
    body: {
      workspace_id: workspaceId,
      invite_type: original.invite_type ?? "email",
      email: original.email,
      phone: original.phone,
      role: original.role,
    },
  });

  if (error) throw new Error(`Failed to resend: ${error.message}`);
  return data;
}

export async function reactivateProfile(profileId: string, workspaceId: string) {
  const supabase = await getClient();
  const { error } = await supabase
    .from("profile")
    .update({ status: "active", is_active: true } satisfies TablesUpdate<"profile">)
    .eq("profile_id", profileId)
    .eq("workspace_id", workspaceId);

  if (error) throw new Error(error.message);
}

export async function bulkUpdateProfiles(
  profileIds: string[],
  workspaceId: string,
  updates: Record<string, unknown>,
) {
  const supabase = await getClient();
  const { error } = await supabase
    .from("profile")
    .update(updates)
    .in("profile_id", profileIds)
    .eq("workspace_id", workspaceId);

  if (error) throw new Error(error.message);
}
