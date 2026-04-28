/**
 * queries.ts — Server-side data fetches for /dashboard/help.
 *
 * All queries use the JWT-scoped Supabase client (createClient) so that RLS
 * enforces workspace isolation automatically. Every query is wrapped with
 * `cache()` for request-level deduplication per ADR-0115 (RSC migration
 * pattern). The page calls `resolveDashboardContext()` first so the heavy
 * auth lookup is already cached by the time these run.
 *
 * helpdesk queries use the admin client because channel RLS restricts
 * visibility to channel_members — but a user who lands on /help may not yet
 * be a member of the helpdesk channel (that's the point). Admin read is safe
 * here because we always scope to workspace_id derived from the auth session.
 */

import { cache } from "react";
import { createClient } from "@smartout/supabase/server";
import { createAdminClient } from "@smartout/supabase/admin";

// ── Types ──────────────────────────────────────────────────────────────────

export type HelpProfileContext = {
  profileId: string;
  workspaceId: string;
  firstName: string | null;
  role: "employee" | "manager" | "admin" | "owner" | "system" | null;
};

export type HelpHelpdeskChannel = {
  id: string;
  name: string | null;
};

// ── Queries ────────────────────────────────────────────────────────────────

/**
 * Fetch the bare minimum profile fields needed to personalize the help page.
 * Returns null if the user is not authenticated or has no active profile in
 * this workspace.
 *
 * Cached: layout already calls `getUser()` + `getProfileInWorkspace()` so
 * the auth.getUser() round-trip is deduplicated across the request.
 */
export const getHelpProfileContext = cache(async (): Promise<HelpProfileContext | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  // Deviation from plan: profile.first_name does not exist — profile uses
  // display_name (single full-name field). We derive firstName by taking the
  // first space-delimited token, which covers "Ola Normann" → "Ola".
  const { data: profile } = await supabase
    .from("profile")
    .select("profile_id, workspace_id, display_name, role")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  if (!profile) return null;

  const firstName = profile.display_name?.split(" ")[0] ?? null;

  return {
    profileId: profile.profile_id,
    workspaceId: profile.workspace_id,
    firstName,
    role: (profile.role as HelpProfileContext["role"]) ?? null,
  };
});

/**
 * Find the first helpdesk-enabled channel in the workspace.
 *
 * PanicBar needs the desk_channel_id to route the ticket correctly. We take
 * the first result ordered by created_at so the workspace setup order is
 * deterministic (most setups have exactly one helpdesk channel). When no
 * helpdesk channel exists, PanicBar renders in degraded mode (falls back to
 * a mailto link).
 *
 * Uses admin client: channel_jwt_select RLS requires channel membership,
 * but the requester may not yet be a member. Workspace scoping via
 * workspace_id (derived from auth session) preserves tenant isolation.
 */
export const getHelpdeskChannel = cache(
  async (workspaceId: string): Promise<HelpHelpdeskChannel | null> => {
    const admin = createAdminClient();

    const { data } = await admin
      .from("channel")
      .select("id, name")
      .eq("workspace_id", workspaceId)
      .eq("helpdesk_enabled", true)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (!data) return null;
    return { id: data.id, name: data.name ?? null };
  },
);
