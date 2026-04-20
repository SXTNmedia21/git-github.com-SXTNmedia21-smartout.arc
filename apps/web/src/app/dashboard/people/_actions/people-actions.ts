"use server";

/**
 * people-actions.ts — first pilot module for ADR-0091 WP3 call-site migration.
 *
 * All `profile` writes route through `gatedUpdate` (the thin wrapper over
 * `cascade_gate_write` RPC). When an active framework_trigger matches `profile`
 * (today: 1 trigger — working_time avg-hours check on hospitality.no.default.v1)
 * the gate returns `outcome='proposed'` and throws `GateDeniedError`; the
 * function surfaces the proposal_id back to the caller via the optional
 * `pendingProposal` field.
 *
 * Return-shape contract for gated mutations:
 *   { ok: true }                          — applied, no governance review
 *   { ok: true, pendingProposal: <uuid> } — a change_proposal was created;
 *                                           UI should render "waiting for review"
 *   { ok: false, error: <reason> }        — gate blocked or write failed
 *
 * Callers that only destructure `ok` remain backward-compatible because
 * `pendingProposal` is optional. UI-side toast wiring is tracked as a
 * follow-up PR — reviewers can surface the proposal from `activity_trail`
 * via the `profile update proposed` event until then.
 *
 * PK column: `profile` uses the Smartout `{table}_id` convention, so every
 * `GateContext` below sets `entityIdColumn: "profile_id"`. Without this,
 * `gatedUpdate` would silently match zero rows (see `gate-client.ts` JSDoc).
 */

import { createClient } from "@smartout/supabase/server";
import type { Database, TablesUpdate } from "@smartout/supabase";
import { gatedUpdate, GateDeniedError, type GateContext } from "@smartout/supabase/gate-client";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isValidTransition } from "@smartout/utils";
import type { ProfileStatus } from "@smartout/utils";
import { emit } from "@smartout/telemetry";

/** Shared return shape for gated profile mutations. */
type GatedResult = { ok: true; pendingProposal?: string } | { ok: false; error: string };

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

/**
 * Fetches the current profile row for gate-context diffing.
 * Returns `null` when the profile is not found; caller should surface a
 * `{ ok: false, error }` result.
 */
async function fetchCurrentProfile(
  supabase: SupabaseClient<Database>,
  profileId: string,
): Promise<Record<string, unknown> | null> {
  const { data, error } = await supabase
    .from("profile")
    .select("*")
    .eq("profile_id", profileId)
    .single();
  if (error || !data) return null;
  return data as unknown as Record<string, unknown>;
}

/**
 * Telemetry for `proposed` and `denied` gate outcomes is intentionally NOT
 * emitted in this pilot. Two reasons:
 *
 * 1. The gate RPC (`cascade_gate_write`) ALREADY writes a `gate_evaluation`
 *    audit row for every call and inserts a `change_proposal` row on the
 *    `proposed` path. Both rows carry actor + workspace + reason, so no data
 *    is lost.
 *
 * 2. The `@smartout/telemetry` registry does not yet declare
 *    `"profile update proposed"` / `"profile update denied"` event schemas.
 *    Adding them requires touching `packages/telemetry`, which is outside
 *    this pilot's file boundary. Follow-up PR will register both events and
 *    route them to PostHog + activity_trail so admins see proposal toasts in
 *    the audit feed.
 *
 * Caller contract in the meantime:
 *   - `{ ok: true }`                     → write applied (existing event emitted below)
 *   - `{ ok: true, pendingProposal }`    → gate proposed; reviewer sees the
 *                                           change_proposal row in the inbox
 *   - `{ ok: false, error }`             → gate blocked or non-gate error
 */

export async function updateProfileRole(
  profileId: string,
  workspaceId: string,
  newRole: NonNullable<TablesUpdate<"profile">["role"]>,
): Promise<GatedResult> {
  const supabase = await getClient();
  const actorId = await resolveActorId(supabase);

  const currentProfile = await fetchCurrentProfile(supabase, profileId);
  if (!currentProfile) return { ok: false, error: "Profile not found" };

  const patch: Record<string, unknown> = { role: newRole };
  const ctx: GateContext = {
    entityType: "profile",
    entityId: profileId,
    workspaceId,
    capability: "profile:update:role",
    actorProfileId: actorId,
    currentData: currentProfile,
    entityIdColumn: "profile_id",
  };

  try {
    await gatedUpdate(supabase, "profile", patch, ctx);
    void emit({
      event: "profile role updated",
      workspace_id: workspaceId,
      actor_id: actorId,
      properties: {
        entity: { entity_type: "profile", entity_id: profileId },
        data: { new_role: newRole },
      },
    });
    return { ok: true };
  } catch (err) {
    if (err instanceof GateDeniedError) {
      if (err.outcome === "proposed") {
        return { ok: true, pendingProposal: err.proposalId ?? undefined };
      }
      return { ok: false, error: err.reason ?? "Governance denied the update" };
    }
    return { ok: false, error: (err as Error).message };
  }
}

export async function updateProfileDepartment(
  profileId: string,
  workspaceId: string,
  departmentId: string,
): Promise<GatedResult> {
  const supabase = await getClient();
  const actorId = await resolveActorId(supabase);

  const currentProfile = await fetchCurrentProfile(supabase, profileId);
  if (!currentProfile) return { ok: false, error: "Profile not found" };

  // Preserve multi-dept assignments by re-using the existing array.
  const currentDepts: string[] = (currentProfile["departments"] as string[] | null) ?? [];
  const updatedDepts =
    currentDepts.length > 1 ? [departmentId, ...currentDepts.slice(1)] : [departmentId];

  const patch: Record<string, unknown> = {
    department_id: departmentId,
    departments: updatedDepts,
  };
  const ctx: GateContext = {
    entityType: "profile",
    entityId: profileId,
    workspaceId,
    capability: "profile:update:department",
    actorProfileId: actorId,
    currentData: currentProfile,
    entityIdColumn: "profile_id",
  };

  try {
    await gatedUpdate(supabase, "profile", patch, ctx);
    void emit({
      event: "profile department updated",
      workspace_id: workspaceId,
      actor_id: actorId,
      properties: {
        entity: { entity_type: "profile", entity_id: profileId },
        data: { department_id: departmentId },
      },
    });
    return { ok: true };
  } catch (err) {
    if (err instanceof GateDeniedError) {
      if (err.outcome === "proposed") {
        return { ok: true, pendingProposal: err.proposalId ?? undefined };
      }
      return { ok: false, error: err.reason ?? "Governance denied the update" };
    }
    return { ok: false, error: (err as Error).message };
  }
}

export async function deactivateProfile(
  profileId: string,
  workspaceId: string,
): Promise<GatedResult> {
  const supabase = await getClient();
  const actorId = await resolveActorId(supabase);

  const currentProfile = await fetchCurrentProfile(supabase, profileId);
  if (!currentProfile) return { ok: false, error: "Profile not found" };

  const patch: TablesUpdate<"profile"> = { status: "offboarding", is_active: false };
  const ctx: GateContext = {
    entityType: "profile",
    entityId: profileId,
    workspaceId,
    capability: "profile:update:status",
    actorProfileId: actorId,
    currentData: currentProfile,
    entityIdColumn: "profile_id",
  };

  try {
    await gatedUpdate(supabase, "profile", patch as Record<string, unknown>, ctx);
    void emit({
      event: "profile deactivated",
      workspace_id: workspaceId,
      actor_id: actorId,
      properties: {
        entity: { entity_type: "profile", entity_id: profileId },
        data: {},
      },
    });
    return { ok: true };
  } catch (err) {
    if (err instanceof GateDeniedError) {
      if (err.outcome === "proposed") {
        return { ok: true, pendingProposal: err.proposalId ?? undefined };
      }
      return { ok: false, error: err.reason ?? "Governance denied the update" };
    }
    return { ok: false, error: (err as Error).message };
  }
}

export async function resetUserPassword(email: string) {
  const supabase = await getClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email);
  if (error) throw new Error(error.message);
}

/**
 * Row shape for the admin InvitationStatusList. Includes every column the
 * UI needs for `deriveDisplayStatus`, sorting, filtering, and row actions.
 *
 * `token` is intentionally NOT exposed here — admins see status, not the
 * credential. The "kopier lenke" action calls a dedicated server helper
 * (or re-uses the existing `/invite/[token]` continuation URL construction
 * at row-emit time) — not a field on this row.
 */
export type AdminInvitationRow = {
  invitation_id: string;
  workspace_id: string;
  email: string | null;
  role: string;
  status: "pending" | "accepted" | "expired" | "cancelled";
  opened_at: string | null;
  expires_at: string;
  created_at: string;
  invited_by: string | null;
  invite_type: string | null;
};

/**
 * Fetches every invitation for the given workspace — all statuses, ordered
 * by `created_at desc`. Used by the admin InvitationStatusList. RLS on
 * `public.invitation` already constrains visibility to admins/managers of
 * the workspace, so we do NOT bypass with service role.
 */
export async function listWorkspaceInvitations(workspaceId: string): Promise<AdminInvitationRow[]> {
  const supabase = await getClient();
  const { data, error } = await supabase
    .from("invitation")
    .select(
      "invitation_id, workspace_id, email, role, status, opened_at, expires_at, created_at, invited_by, invite_type",
    )
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false })
    .returns<AdminInvitationRow[]>();

  if (error) {
    console.warn("[invitations] listWorkspaceInvitations failed:", error.message);
    return [];
  }
  return data ?? [];
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

/**
 * Lazily marks a `pending` invitation as `expired` when its `expires_at`
 * has already passed. Called by the admin `InvitationStatusList` on mount
 * (one call per row that looks expired-in-UI but still shows status='pending'
 * in the DB).
 *
 * Design — Auth Spec Council Q7 = b, L-0083:
 *   - No cron job. Expiry is detected lazily when an admin opens the list
 *     or an invitee opens the link. This avoids a scheduled Edge Function
 *     in P1 (deferred to P2) while keeping the enum truthful for consumers
 *     of `invitation.status`.
 *   - The single-row UPDATE is idempotent: the WHERE clause filters on
 *     `status='pending' AND expires_at < now()`, so concurrent admin tabs
 *     racing the same row will result in exactly one successful UPDATE.
 *   - We emit "invitation expired" ONLY when the UPDATE actually flipped
 *     a row (rowCount > 0). This prevents double-emit spam across tabs and
 *     satisfies L-0083: exactly one producer per event.
 *
 * ADR-0167 — the raw token never leaves the server; only the first 8 chars
 * are emitted as `token_preview`. The token is fetched here solely so we
 * can build that preview; the value is NOT returned to the client, logged,
 * or stored anywhere downstream.
 *
 * RLS applies: the action uses the user's auth context (no service role).
 * If the caller cannot UPDATE this invitation per policy, the UPDATE will
 * simply affect zero rows — safe degraded behaviour.
 */
export async function markInvitationExpired(invitationId: string): Promise<{ expired: boolean }> {
  const supabase = await getClient();

  // Single round-trip: conditional UPDATE with RETURNING. The WHERE clause
  // is the idempotency guard — duplicate calls from parallel tabs no-op.
  const { data: updated, error } = await supabase
    .from("invitation")
    .update({ status: "expired" } satisfies TablesUpdate<"invitation">)
    .eq("invitation_id", invitationId)
    .eq("status", "pending")
    .lt("expires_at", new Date().toISOString())
    .select("invitation_id, workspace_id, token, expires_at, invited_by")
    .maybeSingle();

  if (error) {
    // Never log the token. We don't have it here (we SELECTed it but bail
    // before using it on error), so the console path is safe regardless.
    console.warn("[invitations] markInvitationExpired failed:", error.message);
    return { expired: false };
  }

  // Zero rows affected → already marked expired/accepted/cancelled, or the
  // expires_at has been pushed forward. No emit fires — this is the correct
  // idempotent path per L-0083.
  if (!updated) return { expired: false };

  const actorId = await resolveActorId(supabase);

  void emit({
    event: "invitation expired",
    workspace_id: updated.workspace_id,
    actor_id: actorId,
    properties: {
      entity: { entity_type: "invitation", entity_id: updated.invitation_id },
      data: {
        invitation_id: updated.invitation_id,
        workspace_id: updated.workspace_id,
        // First 8 chars only — per ADR-0167 invitation-tokens-as-credentials.
        token_preview: updated.token.slice(0, 8),
      },
    },
  });

  return { expired: true };
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
): Promise<GatedResult> {
  if (!isValidTransition(currentStatus, newStatus)) {
    return {
      ok: false,
      error: `Invalid status transition: ${currentStatus} → ${newStatus}`,
    };
  }

  const supabase = await getClient();
  const actorId = await resolveActorId(supabase);

  const currentProfile = await fetchCurrentProfile(supabase, profileId);
  if (!currentProfile) return { ok: false, error: "Profile not found" };

  const isActive = newStatus === "active" || newStatus === "trainee";
  const patch: TablesUpdate<"profile"> = { status: newStatus, is_active: isActive };
  const ctx: GateContext = {
    entityType: "profile",
    entityId: profileId,
    workspaceId,
    capability: "profile:update:status",
    actorProfileId: actorId,
    currentData: currentProfile,
    entityIdColumn: "profile_id",
  };

  try {
    await gatedUpdate(supabase, "profile", patch as Record<string, unknown>, ctx);
    void emit({
      event: "profile status updated",
      workspace_id: workspaceId,
      actor_id: actorId,
      properties: {
        entity: { entity_type: "profile", entity_id: profileId },
        data: { from_status: currentStatus, to_status: newStatus },
      },
    });
    return { ok: true };
  } catch (err) {
    if (err instanceof GateDeniedError) {
      if (err.outcome === "proposed") {
        return { ok: true, pendingProposal: err.proposalId ?? undefined };
      }
      return { ok: false, error: err.reason ?? "Governance denied the update" };
    }
    return { ok: false, error: (err as Error).message };
  }
}

export async function reactivateProfile(
  profileId: string,
  workspaceId: string,
): Promise<GatedResult> {
  const supabase = await getClient();
  const actorId = await resolveActorId(supabase);

  const currentProfile = await fetchCurrentProfile(supabase, profileId);
  if (!currentProfile) return { ok: false, error: "Profile not found" };

  const patch: TablesUpdate<"profile"> = { status: "active", is_active: true };
  const ctx: GateContext = {
    entityType: "profile",
    entityId: profileId,
    workspaceId,
    capability: "profile:update:status",
    actorProfileId: actorId,
    currentData: currentProfile,
    entityIdColumn: "profile_id",
  };

  try {
    await gatedUpdate(supabase, "profile", patch as Record<string, unknown>, ctx);
    void emit({
      event: "profile reactivated",
      workspace_id: workspaceId,
      actor_id: actorId,
      properties: {
        entity: { entity_type: "profile", entity_id: profileId },
        data: {},
      },
    });
    return { ok: true };
  } catch (err) {
    if (err instanceof GateDeniedError) {
      if (err.outcome === "proposed") {
        return { ok: true, pendingProposal: err.proposalId ?? undefined };
      }
      return { ok: false, error: err.reason ?? "Governance denied the update" };
    }
    return { ok: false, error: (err as Error).message };
  }
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

/**
 * Bulk-update profiles. `gatedUpdate` is per-entity (requires `ctx.entityId`),
 * so bulk updates are fanned-out into sequential gated writes. Results are
 * aggregated: if ANY update is proposed, the function returns the first
 * proposal_id in `pendingProposal`; the caller can inspect `proposalIds` for
 * the full list. Individual failures short-circuit and return { ok: false }.
 */
export async function bulkUpdateProfiles(
  profileIds: string[],
  workspaceId: string,
  updates: Record<string, unknown>,
): Promise<
  { ok: true; pendingProposal?: string; proposalIds: string[] } | { ok: false; error: string }
> {
  const supabase = await getClient();
  const actorId = await resolveActorId(supabase);
  const proposalIds: string[] = [];

  for (const profileId of profileIds) {
    const currentProfile = await fetchCurrentProfile(supabase, profileId);
    if (!currentProfile) {
      return { ok: false, error: `Profile not found: ${profileId}` };
    }

    const ctx: GateContext = {
      entityType: "profile",
      entityId: profileId,
      workspaceId,
      capability: "profile:update:bulk",
      actorProfileId: actorId,
      currentData: currentProfile,
      entityIdColumn: "profile_id",
    };

    try {
      await gatedUpdate(supabase, "profile", updates, ctx);
    } catch (err) {
      if (err instanceof GateDeniedError) {
        if (err.outcome === "proposed") {
          if (err.proposalId) proposalIds.push(err.proposalId);
          continue;
        }
        return { ok: false, error: err.reason ?? "Governance denied the update" };
      }
      return { ok: false, error: (err as Error).message };
    }
  }

  return {
    ok: true,
    pendingProposal: proposalIds[0],
    proposalIds,
  };
}

/**
 * Send a passwordless login code to an employee via SMS or email.
 * Invokes the send-login-code Edge Function which generates a Supabase
 * magic link and delivers it through SendGrid (email) or Twilio (SMS).
 */
export async function sendLoginCode(
  profileId: string,
  workspaceId: string,
  channel: "email" | "sms",
) {
  const supabase = await getClient();
  const { error } = await supabase.functions.invoke("send-login-code", {
    body: { profile_id: profileId, channel },
  });

  if (error) throw new Error(error.message);

  const actorId = await resolveActorId(supabase);
  void emit({
    event: "profile login code sent",
    workspace_id: workspaceId,
    actor_id: actorId,
    properties: {
      entity: { entity_type: "profile", entity_id: profileId },
      data: { channel },
    },
  });
}
