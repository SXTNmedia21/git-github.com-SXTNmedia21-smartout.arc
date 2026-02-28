/**
 * @smartout/notifications — Audience resolution
 *
 * Resolves AudienceFilter to a deduplicated list of ResolvedRecipient.
 * All queries use service role client passed in (no client creation inside).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { AudienceFilter, ResolvedRecipient } from "./types";

function deduplicateByEmail(recipients: ResolvedRecipient[]): ResolvedRecipient[] {
  const seen = new Set<string>();
  return recipients.filter((r) => {
    const lower = r.email.toLowerCase();
    if (seen.has(lower)) return false;
    seen.add(lower);
    return true;
  });
}

async function resolveAllUsers(adminClient: SupabaseClient): Promise<ResolvedRecipient[]> {
  const { data, error } = await adminClient
    .from("user_identity")
    .select("user_id, email, first_name, last_name, preferred_language")
    .eq("is_active", true);

  if (error) throw new Error(`Failed to resolve all_users: ${error.message}`);

  return (data ?? []).map((u) => ({
    email: u.email,
    name: `${u.first_name} ${u.last_name}`.trim(),
    userId: u.user_id,
    locale: u.preferred_language ?? "no",
  }));
}

async function resolveSuperAdmins(adminClient: SupabaseClient): Promise<ResolvedRecipient[]> {
  const { data, error } = await adminClient
    .from("user_identity")
    .select("user_id, email, first_name, last_name, preferred_language")
    .eq("is_godmode", true)
    .eq("is_active", true);

  if (error) throw new Error(`Failed to resolve super_admins: ${error.message}`);

  return (data ?? []).map((u) => ({
    email: u.email,
    name: `${u.first_name} ${u.last_name}`.trim(),
    userId: u.user_id,
    locale: u.preferred_language ?? "no",
  }));
}

async function resolveByWorkspace(
  adminClient: SupabaseClient,
  workspaceId: string,
  role?: string,
  status?: string,
): Promise<ResolvedRecipient[]> {
  let query = adminClient
    .from("profile")
    .select(
      "user_id, workspace_id, role, status, display_name, user_identity!inner(email, first_name, last_name, preferred_language)",
    )
    .eq("workspace_id", workspaceId)
    .eq("is_active", true);

  if (role) query = query.eq("role", role);
  if (status) query = query.eq("status", status);

  const { data, error } = await query;

  if (error) throw new Error(`Failed to resolve workspace audience: ${error.message}`);

  return (data ?? []).map((p) => {
    const ui = p.user_identity as unknown as {
      email: string;
      first_name: string;
      last_name: string;
      preferred_language: string | null;
    };
    return {
      email: ui.email,
      name: p.display_name || `${ui.first_name} ${ui.last_name}`.trim(),
      userId: p.user_id,
      workspaceId: p.workspace_id,
      locale: ui.preferred_language ?? "no",
    };
  });
}

async function resolveByRole(
  adminClient: SupabaseClient,
  role: string,
): Promise<ResolvedRecipient[]> {
  const { data, error } = await adminClient
    .from("profile")
    .select(
      "user_id, workspace_id, display_name, user_identity!inner(email, first_name, last_name, preferred_language)",
    )
    .eq("role", role)
    .eq("is_active", true);

  if (error) throw new Error(`Failed to resolve role audience: ${error.message}`);

  return (data ?? []).map((p) => {
    const ui = p.user_identity as unknown as {
      email: string;
      first_name: string;
      last_name: string;
      preferred_language: string | null;
    };
    return {
      email: ui.email,
      name: p.display_name || `${ui.first_name} ${ui.last_name}`.trim(),
      userId: p.user_id,
      workspaceId: p.workspace_id,
      locale: ui.preferred_language ?? "no",
    };
  });
}

async function resolveByStatus(
  adminClient: SupabaseClient,
  status: string,
): Promise<ResolvedRecipient[]> {
  const { data, error } = await adminClient
    .from("profile")
    .select(
      "user_id, workspace_id, display_name, user_identity!inner(email, first_name, last_name, preferred_language)",
    )
    .eq("status", status)
    .eq("is_active", true);

  if (error) throw new Error(`Failed to resolve status audience: ${error.message}`);

  return (data ?? []).map((p) => {
    const ui = p.user_identity as unknown as {
      email: string;
      first_name: string;
      last_name: string;
      preferred_language: string | null;
    };
    return {
      email: ui.email,
      name: p.display_name || `${ui.first_name} ${ui.last_name}`.trim(),
      userId: p.user_id,
      workspaceId: p.workspace_id,
      locale: ui.preferred_language ?? "no",
    };
  });
}

async function resolveByUserIds(
  adminClient: SupabaseClient,
  userIds: string[],
): Promise<ResolvedRecipient[]> {
  const { data, error } = await adminClient
    .from("user_identity")
    .select("user_id, email, first_name, last_name, preferred_language")
    .in("user_id", userIds)
    .eq("is_active", true);

  if (error) throw new Error(`Failed to resolve user_ids audience: ${error.message}`);

  return (data ?? []).map((u) => ({
    email: u.email,
    name: `${u.first_name} ${u.last_name}`.trim(),
    userId: u.user_id,
    locale: u.preferred_language ?? "no",
  }));
}

export async function resolveAudience(
  adminClient: SupabaseClient,
  filter: AudienceFilter,
): Promise<ResolvedRecipient[]> {
  let recipients: ResolvedRecipient[];

  switch (filter.type) {
    case "all_users":
      recipients = await resolveAllUsers(adminClient);
      break;
    case "super_admins":
      recipients = await resolveSuperAdmins(adminClient);
      break;
    case "workspace":
      recipients = await resolveByWorkspace(
        adminClient,
        filter.workspaceId,
        filter.role,
        filter.status,
      );
      break;
    case "role":
      recipients = await resolveByRole(adminClient, filter.role);
      break;
    case "status":
      recipients = await resolveByStatus(adminClient, filter.status);
      break;
    case "user_ids":
      recipients = await resolveByUserIds(adminClient, filter.userIds);
      break;
  }

  return deduplicateByEmail(recipients);
}

export async function countAudience(
  adminClient: SupabaseClient,
  filter: AudienceFilter,
): Promise<number> {
  switch (filter.type) {
    case "all_users": {
      const { count, error } = await adminClient
        .from("user_identity")
        .select("user_id", { count: "exact", head: true })
        .eq("is_active", true);
      if (error) throw new Error(`Failed to count all_users: ${error.message}`);
      return count ?? 0;
    }
    case "super_admins": {
      const { count, error } = await adminClient
        .from("user_identity")
        .select("user_id", { count: "exact", head: true })
        .eq("is_godmode", true)
        .eq("is_active", true);
      if (error) throw new Error(`Failed to count super_admins: ${error.message}`);
      return count ?? 0;
    }
    case "workspace": {
      let query = adminClient
        .from("profile")
        .select("profile_id", { count: "exact", head: true })
        .eq("workspace_id", filter.workspaceId)
        .eq("is_active", true);
      if (filter.role) query = query.eq("role", filter.role);
      if (filter.status) query = query.eq("status", filter.status);
      const { count, error } = await query;
      if (error) throw new Error(`Failed to count workspace audience: ${error.message}`);
      return count ?? 0;
    }
    case "role": {
      const { count, error } = await adminClient
        .from("profile")
        .select("profile_id", { count: "exact", head: true })
        .eq("role", filter.role)
        .eq("is_active", true);
      if (error) throw new Error(`Failed to count role audience: ${error.message}`);
      return count ?? 0;
    }
    case "status": {
      const { count, error } = await adminClient
        .from("profile")
        .select("profile_id", { count: "exact", head: true })
        .eq("status", filter.status)
        .eq("is_active", true);
      if (error) throw new Error(`Failed to count status audience: ${error.message}`);
      return count ?? 0;
    }
    case "user_ids": {
      const { count, error } = await adminClient
        .from("user_identity")
        .select("user_id", { count: "exact", head: true })
        .in("user_id", filter.userIds)
        .eq("is_active", true);
      if (error) throw new Error(`Failed to count user_ids audience: ${error.message}`);
      return count ?? 0;
    }
  }
}
