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
 *
 * getActiveHelpdeskThreadsForProfile uses the standard JWT client (not admin)
 * so RLS enforces workspace isolation. Engine_state rows are filtered by
 * workspace_id + process_id + status client-side; role determines the
 * secondary predicate on entity ownership.
 */

import { cache } from "react";
import { createClient } from "@smartout/supabase/server";
import { createAdminClient } from "@smartout/supabase/admin";

// ── Types ─────────────────────────────────────────────────────────────────

export type ActiveHelpdeskThread = {
  engineStateId: string;
  channelId: string;
  subject: string | null;
  lastMessagePreview: string | null;
  lastMessageAt: string | null;
};

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

/**
 * Return up to 5 active helpdesk threads for the given profile.
 *
 * "Active" means `engine_state.process_id = 'helpdesk_query_lifecycle'` AND
 * status is not in ('resolved', 'archived', 'cancelled'). Engine state rows
 * link to a channel via `entity_type = 'channel'` + `entity_id = channel.id`
 * (per ADR-0161/0165 unified ontology).
 *
 * `entity_id` is a polymorphic column with no named FK relation in the schema,
 * so PostgREST join syntax (`channel:entity_id(...)`) is not available. We
 * therefore use three sequential selects:
 *   1. engine_state — filtered by process_id + status + role predicate
 *   2. channel — fetched by the collected entity_id set (workspace-scoped)
 *   3. channel_message — latest non-deleted message per channel
 *
 * Role routing:
 *   - employee → threads where `context->>'requester_profile_id' = profileId`.
 *     Using the JSONB context field avoids the channel_member RLS trap (the
 *     requester may not be a member of the desk channel yet).
 *   - manager | admin | owner → channels where
 *     `responsible_profile_id = profileId`, resolved in step 2.
 *
 * Uses the JWT-scoped client — NO admin client. RLS enforces workspace
 * isolation automatically.
 *
 * Wrapped in React `cache()` for request-level deduplication (ADR-0115).
 */
export const getActiveHelpdeskThreadsForProfile = cache(
  async (
    profileId: string,
    workspaceId: string,
    role: HelpProfileContext["role"],
  ): Promise<ActiveHelpdeskThread[]> => {
    // Guard: unauthenticated callers or missing identifiers return empty list.
    if (!profileId || !workspaceId) return [];

    const supabase = await createClient();

    const INACTIVE_STATUSES = ["resolved", "archived", "cancelled"] as const;

    // ── Step 1: Fetch matching engine_state rows ──────────────────────────
    // `entity_id` is polymorphic — no named FK, so no PostgREST join.
    // We select only scalar columns; channel data is fetched in step 2.
    type StateRow = { id: string; entity_id: string | null; updated_at: string };

    let stateRows: StateRow[] = [];

    if (role === "employee") {
      // Employee sees only threads they submitted.
      // `context` is JSONB; use the PostgREST ->> filter syntax.
      const { data } = await supabase
        .from("engine_state")
        .select("id, entity_id, updated_at")
        .eq("workspace_id", workspaceId)
        .eq("process_id", "helpdesk_query_lifecycle")
        .eq("entity_type", "channel")
        .not("status", "in", `(${INACTIVE_STATUSES.join(",")})`)
        .filter("context->>requester_profile_id", "eq", profileId)
        .order("updated_at", { ascending: false })
        .limit(5);

      stateRows = (data ?? []) as StateRow[];
    } else {
      // Manager / admin / owner: fetch all active engine_state rows for the
      // workspace first, then filter by responsible_profile_id in step 2.
      // This keeps the engine_state query simple while channel data (which
      // carries responsible_profile_id) is resolved in a separate select.
      const { data } = await supabase
        .from("engine_state")
        .select("id, entity_id, updated_at")
        .eq("workspace_id", workspaceId)
        .eq("process_id", "helpdesk_query_lifecycle")
        .eq("entity_type", "channel")
        .not("status", "in", `(${INACTIVE_STATUSES.join(",")})`)
        .order("updated_at", { ascending: false })
        .limit(50); // wider initial set — filtered down after channel lookup

      stateRows = (data ?? []) as StateRow[];
    }

    if (stateRows.length === 0) return [];

    // ── Step 2: Fetch channel rows for the collected entity_ids ──────────
    const candidateChannelIds = stateRows
      .map((r) => r.entity_id)
      .filter((id): id is string => id !== null);

    const { data: channels } = await supabase
      .from("channel")
      .select("id, name, responsible_profile_id")
      .in("id", candidateChannelIds)
      .eq("workspace_id", workspaceId);

    const channelMap = new Map((channels ?? []).map((c) => [c.id, c]));

    // For admin/manager/owner: keep only channels they are responsible for,
    // then trim to 5 results ordered by the engine_state updated_at we already
    // have (stateRows is already DESC ordered).
    let filteredStateRows = stateRows.filter((r) => {
      if (!r.entity_id) return false;
      const ch = channelMap.get(r.entity_id);
      if (!ch) return false;
      if (role !== "employee") {
        // Must be the assigned responsible person.
        return ch.responsible_profile_id === profileId;
      }
      return true;
    });

    // Cap at 5 after optional post-filter.
    filteredStateRows = filteredStateRows.slice(0, 5);

    if (filteredStateRows.length === 0) return [];

    // ── Step 3: Batch-fetch the latest message per channel ───────────────
    const channelIds = filteredStateRows
      .map((r) => r.entity_id)
      .filter((id): id is string => id !== null);

    // PostgREST does not expose DISTINCT ON, so we fetch the most recent N
    // messages per channel batch and group by channel_id in JS.
    const { data: messages } = await supabase
      .from("channel_message")
      .select("channel_id, content, created_at")
      .in("channel_id", channelIds)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(channelIds.length * 10); // generous upper bound

    // Build a map: channelId → latest message row.
    const latestByChannel = new Map<string, { content: string; created_at: string }>();
    for (const msg of messages ?? []) {
      if (!latestByChannel.has(msg.channel_id)) {
        latestByChannel.set(msg.channel_id, {
          content: msg.content,
          created_at: msg.created_at,
        });
      }
    }

    // ── Step 4: Assemble the return shape ────────────────────────────────
    return filteredStateRows
      .filter((r) => r.entity_id !== null)
      .map((r) => {
        const channelId = r.entity_id as string;
        const lastMsg = latestByChannel.get(channelId) ?? null;
        const channelRow = channelMap.get(channelId) ?? null;

        return {
          engineStateId: r.id,
          channelId,
          // Use channel.name as subject — matches what /komm surfaces as the
          // thread title.
          subject: channelRow?.name ?? null,
          // Truncate preview to 120 chars so the badge stays compact.
          lastMessagePreview: lastMsg !== null ? lastMsg.content.slice(0, 120) : null,
          lastMessageAt: lastMsg?.created_at ?? null,
        } satisfies ActiveHelpdeskThread;
      });
  },
);
