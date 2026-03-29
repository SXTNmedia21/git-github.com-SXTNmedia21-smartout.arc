"use server";

/**
 * Server actions for spokesperson assignment, approval flow, and revocation.
 *
 * Admin actions (assign, revoke) use requireAdminForWebsite — service-role
 * client for writes, admin check via RPC.
 *
 * Employee response (approve/decline) uses the user's own session: RLS policy
 * "employee_update_own_spokesperson" allows employees to update their own record.
 */

import { createClient as createServerClient } from "@smartout/supabase/server";
import { createClient } from "@supabase/supabase-js";
import { emit } from "@smartout/telemetry";
import type { ContentTask } from "@smartout/website";

// ─── Types ──────────────────────────────────────────────────────

type ActionResult = { success: true } | { success: false; error: string };

export type SpokespersonRow = {
  website_spokesperson_id: string;
  website_id: string;
  website_section_id: string;
  workspace_id: string;
  profile_id: string;
  role_title: string;
  quote: string;
  bio: string;
  status: "pending" | "approved" | "declined" | "revoked";
  decline_reason: string | null;
  assigned_at: string;
  responded_at: string | null;
  assigned_by: string;
  content_schedule: ContentTask[];
  created_at: string;
  updated_at: string;
  // Joined from profile
  profile?: {
    display_name: string;
    avatar_url: string | null;
    job_title: string | null;
    role: string;
  };
};

// ─── Helpers ────────────────────────────────────────────────────

/** Service-role client for websites schema operations. */
function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key);
}

/** Verify the caller is authenticated and is an admin in the website's workspace. */
async function requireAdminForWebsite(websiteId: string) {
  const userClient = await createServerClient();
  const {
    data: { user },
  } = await userClient.auth.getUser();

  if (!user) throw new Error("Not authenticated");

  const admin = getAdminClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: website, error } = await (admin as any)
    .schema("websites")
    .from("website")
    .select("workspace_id")
    .eq("website_id", websiteId)
    .is("deleted_at", null)
    .single();

  if (error || !website) throw new Error("Website not found");

  const { data: isAdmin } = await admin.rpc("is_admin_in_workspace", {
    p_user_id: user.id,
    p_workspace_id: (website as { workspace_id: string }).workspace_id,
  });

  if (!isAdmin) throw new Error("Insufficient permissions — workspace admin required");

  return {
    user,
    admin,
    workspaceId: (website as { workspace_id: string }).workspace_id,
  };
}

// ─── assignSpokesperson ─────────────────────────────────────────

/**
 * Assigns an employee as spokesperson for a section.
 * Creates (or replaces) the website_spokesperson record and triggers the
 * approval flow — the employee receives a notification to accept/decline.
 */
export async function assignSpokesperson(
  websiteId: string,
  sectionId: string,
  profileId: string,
  roleTitle: string,
  contentTasks: ContentTask[],
): Promise<ActionResult> {
  try {
    const { user, admin, workspaceId } = await requireAdminForWebsite(websiteId);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (admin as any).schema("websites").from("website_spokesperson").upsert(
      {
        website_id: websiteId,
        website_section_id: sectionId,
        workspace_id: workspaceId,
        profile_id: profileId,
        role_title: roleTitle,
        status: "pending",
        assigned_by: user.id,
        assigned_at: new Date().toISOString(),
        responded_at: null,
        decline_reason: null,
        content_schedule: contentTasks,
      },
      { onConflict: "website_section_id" },
    );

    if (error) return { success: false, error: error.message };

    await emit({
      event: "website spokesperson_assigned",
      workspace_id: workspaceId,
      actor_id: user.id,
      properties: {
        entity: { entity_type: "website", entity_id: websiteId },
        data: { profile_id: profileId, role_title: roleTitle },
      },
    });

    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

// ─── revokeSpokesperson ─────────────────────────────────────────

/**
 * Revokes a spokesperson assignment. Sets status to 'revoked'.
 * The employee is removed from the website section; admin should re-publish.
 */
export async function revokeSpokesperson(
  websiteId: string,
  spokespersonId: string,
): Promise<ActionResult> {
  try {
    const { user, admin, workspaceId } = await requireAdminForWebsite(websiteId);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (admin as any)
      .schema("websites")
      .from("website_spokesperson")
      .update({ status: "revoked" })
      .eq("website_spokesperson_id", spokespersonId)
      .eq("website_id", websiteId);

    if (error) return { success: false, error: error.message };

    await emit({
      event: "website spokesperson_revoked",
      workspace_id: workspaceId,
      actor_id: user.id,
      properties: {
        entity: { entity_type: "website", entity_id: websiteId },
        data: { spokesperson_id: spokespersonId },
      },
    });

    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

// ─── getSpokespersonForSection ──────────────────────────────────

/**
 * Fetches the active spokesperson record for a section, joined with profile data.
 * Returns null when no spokesperson is assigned (PGRST116 — zero rows).
 *
 * Requires the caller to be authenticated AND a member of the workspace
 * that owns this section (blocks cross-workspace access).
 */
export async function getSpokespersonForSection(
  sectionId: string,
): Promise<SpokespersonRow | null> {
  const userClient = await createServerClient();
  const {
    data: { user },
  } = await userClient.auth.getUser();

  if (!user) throw new Error("Not authenticated");

  // Admin client needed for cross-schema join (websites schema → public.profile)
  const admin = getAdminClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (admin as any)
    .schema("websites")
    .from("website_spokesperson")
    .select(
      `
      website_spokesperson_id,
      website_id,
      website_section_id,
      workspace_id,
      profile_id,
      role_title,
      quote,
      bio,
      status,
      decline_reason,
      assigned_at,
      responded_at,
      assigned_by,
      content_schedule,
      created_at,
      updated_at
    `,
    )
    .eq("website_section_id", sectionId)
    .neq("status", "revoked")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const row = data as any;

  // Verify caller is a member of this workspace (workspace_id from the record).
  // Employees get here via a push notification link — they are workspace members.
  // Admins get here from the dashboard — they are also workspace members.
  const { count: memberCount } = await userClient
    .from("profile")
    .select("*", { count: "exact", head: true })
    .eq("workspace_id", row.workspace_id)
    .eq("user_id", user.id);

  if (!memberCount) throw new Error("Access denied — not a workspace member");

  // Fetch profile separately (cross-schema join not supported via .schema())
  const { data: profile } = await admin
    .from("profile")
    .select("display_name, avatar_url, job_title, role")
    .eq("profile_id", row.profile_id)
    .single();

  return {
    ...row,
    profile: profile ?? undefined,
  } as SpokespersonRow;
}

// ─── respondToSpokesperson ──────────────────────────────────────

/**
 * Employee responds to a spokesperson invitation.
 * Uses the caller's own session — RLS policy allows employees to update
 * their own spokesperson record.
 */
export async function respondToSpokesperson(
  spokespersonId: string,
  approve: boolean,
  declineReason?: string,
): Promise<ActionResult> {
  try {
    const userClient = await createServerClient();
    const {
      data: { user },
    } = await userClient.auth.getUser();

    if (!user) throw new Error("Not authenticated");

    const newStatus = approve ? "approved" : "declined";

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: updated, error } = await (userClient as any)
      .schema("websites")
      .from("website_spokesperson")
      .update({
        status: newStatus,
        responded_at: new Date().toISOString(),
        decline_reason: approve ? null : (declineReason ?? null),
      })
      .eq("website_spokesperson_id", spokespersonId)
      .select("workspace_id, profile_id, website_id")
      .single();

    if (error) return { success: false, error: error.message };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { workspace_id, profile_id, website_id } = updated as any;

    const event = approve ? "website spokesperson_approved" : "website spokesperson_declined";

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const emitPayload: any = {
      event,
      workspace_id,
      actor_id: user.id,
      properties: {
        entity: { entity_type: "website" as const, entity_id: website_id },
        data: approve ? { profile_id } : { profile_id, reason: declineReason },
      },
    };
    await emit(emitPayload);

    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}
