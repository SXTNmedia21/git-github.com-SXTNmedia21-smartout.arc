"use server";

import { createClient } from "@smartout/supabase/server";
import type { Database, TablesUpdate } from "@smartout/supabase";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isValidTransition } from "@smartout/utils";
import type { ProfileStatus } from "@smartout/utils";
import { emit } from "@smartout/telemetry";

/** Typed helper to get a server client with proper Database generics. */
async function getClient(): Promise<SupabaseClient<Database>> {
  return createClient();
}

/** Resolve the current user's profile_id for telemetry actor_id. */
async function resolveActorId(supabase: SupabaseClient<Database>): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return "unknown";
  const { data } = await supabase
    .from("profile")
    .select("profile_id")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();
  return data?.profile_id ?? "unknown";
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

  const actorId = await resolveActorId(supabase);
  void emit({
    event: "profile role updated",
    workspace_id: workspaceId,
    actor_id: actorId,
    properties: {
      entity: { entity_type: "profile", entity_id: profileId },
      data: { new_role: newRole },
    },
  });
}

export async function updateProfileDepartment(
  profileId: string,
  workspaceId: string,
  departmentId: string,
) {
  const supabase = await getClient();

  // Fetch current departments array to preserve multi-dept assignments
  const { data: current } = await supabase
    .from("profile")
    .select("departments")
    .eq("profile_id", profileId)
    .single();

  const currentDepts: string[] = (current?.departments as string[]) ?? [];
  const updatedDepts =
    currentDepts.length > 1 ? [departmentId, ...currentDepts.slice(1)] : [departmentId];

  const { error } = await supabase
    .from("profile")
    .update({ department_id: departmentId, departments: updatedDepts })
    .eq("profile_id", profileId)
    .eq("workspace_id", workspaceId);

  if (error) throw new Error(error.message);

  const actorId = await resolveActorId(supabase);
  void emit({
    event: "profile department updated",
    workspace_id: workspaceId,
    actor_id: actorId,
    properties: {
      entity: { entity_type: "profile", entity_id: profileId },
      data: { department_id: departmentId },
    },
  });
}

export async function deactivateProfile(profileId: string, workspaceId: string) {
  const supabase = await getClient();
  const { error } = await supabase
    .from("profile")
    .update({ status: "offboarding", is_active: false } satisfies TablesUpdate<"profile">)
    .eq("profile_id", profileId)
    .eq("workspace_id", workspaceId);

  if (error) throw new Error(error.message);

  const actorId = await resolveActorId(supabase);
  void emit({
    event: "profile deactivated",
    workspace_id: workspaceId,
    actor_id: actorId,
    properties: {
      entity: { entity_type: "profile", entity_id: profileId },
      data: {},
    },
  });
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

  void emit({
    event: "invitation cancelled",
    workspace_id: null,
    actor_id: await resolveActorId(supabase),
    properties: {
      entity: { entity_type: "invitation", entity_id: invitationId },
      data: { invitation_id: invitationId },
    },
  });
}

export async function resendInvitation(workspaceId: string, invitationId: string) {
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

  void emit({
    event: "invitation resent",
    workspace_id: workspaceId,
    actor_id: await resolveActorId(supabase),
    properties: {
      entity: { entity_type: "invitation", entity_id: invitationId },
      data: { invitation_id: invitationId },
    },
  });

  return data;
}

export async function sendProtocolReminder(
  profileId: string,
  assignmentId: string,
  workspaceId: string,
) {
  const supabase = await getClient();

  // Fetch protocol name for the activity log
  const { data: assignment } = await supabase
    .from("protocol_assignment")
    .select("protocol:protocol_id(name)")
    .eq("assignment_id", assignmentId)
    .single();

  const protocolName =
    (assignment?.protocol as { name: string } | null)?.name ?? "Unknown protocol";

  // Log reminder to activity_trail
  const { error } = await supabase.from("activity_trail").insert({
    workspace_id: workspaceId,
    actor_id: profileId,
    event: `Reminder sent for ${protocolName}`,
    action_verb: "sent",
    category: "training",
    entity_type: "protocol_assignment",
    entity_id: assignmentId,
    metadata: { protocol_name: protocolName, type: "reminder" },
  });

  if (error) throw new Error(error.message);

  // Dispatch notification via Edge Function — fire-and-forget, non-blocking
  await supabase.functions.invoke("process-notifications", {
    body: {
      event: "training.reminder_sent",
      workspace_id: workspaceId,
      payload: {
        profile_id: profileId,
        assignment_id: assignmentId,
        protocol_name: protocolName,
      },
    },
  });
}

export async function addToTeam(profileId: string, teamId: string) {
  const supabase = await getClient();
  const { error } = await supabase
    .from("team_member")
    .insert({ profile_id: profileId, team_id: teamId });

  if (error) throw new Error(error.message);
}

export async function removeFromTeam(profileId: string, teamId: string) {
  const supabase = await getClient();
  const { error } = await supabase
    .from("team_member")
    .delete()
    .eq("profile_id", profileId)
    .eq("team_id", teamId);

  if (error) throw new Error(error.message);
}

export async function updateProfileStatus(
  profileId: string,
  workspaceId: string,
  currentStatus: ProfileStatus,
  newStatus: ProfileStatus,
) {
  if (!isValidTransition(currentStatus, newStatus)) {
    throw new Error(`Invalid status transition: ${currentStatus} → ${newStatus}`);
  }

  const supabase = await getClient();
  const isActive = newStatus === "active" || newStatus === "trainee";
  const { error } = await supabase
    .from("profile")
    .update({ status: newStatus, is_active: isActive } satisfies TablesUpdate<"profile">)
    .eq("profile_id", profileId)
    .eq("workspace_id", workspaceId);

  if (error) throw new Error(error.message);

  const actorId = await resolveActorId(supabase);
  void emit({
    event: "profile status updated",
    workspace_id: workspaceId,
    actor_id: actorId,
    properties: {
      entity: { entity_type: "profile", entity_id: profileId },
      data: { from_status: currentStatus, to_status: newStatus },
    },
  });
}

export async function reactivateProfile(profileId: string, workspaceId: string) {
  const supabase = await getClient();
  const { error } = await supabase
    .from("profile")
    .update({ status: "active", is_active: true } satisfies TablesUpdate<"profile">)
    .eq("profile_id", profileId)
    .eq("workspace_id", workspaceId);

  if (error) throw new Error(error.message);

  const actorId = await resolveActorId(supabase);
  void emit({
    event: "profile reactivated",
    workspace_id: workspaceId,
    actor_id: actorId,
    properties: {
      entity: { entity_type: "profile", entity_id: profileId },
      data: {},
    },
  });
}

export async function updateEmergencyContact(
  profileId: string,
  emergencyName: string | null,
  emergencyPhone: string | null,
) {
  const supabase = await getClient();

  // Look up user_id from profile to update user_identity
  const { data: profile, error: fetchError } = await supabase
    .from("profile")
    .select("user_id")
    .eq("profile_id", profileId)
    .single();

  if (fetchError || !profile) throw new Error("Profile not found");

  const { error } = await supabase
    .from("user_identity")
    .update({
      emergency_contact_name: emergencyName,
      emergency_contact_phone: emergencyPhone,
    })
    .eq("user_id", profile.user_id);

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
