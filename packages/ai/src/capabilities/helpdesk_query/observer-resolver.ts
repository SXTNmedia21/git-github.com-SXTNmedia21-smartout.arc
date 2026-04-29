// packages/ai/src/capabilities/helpdesk_query/observer-resolver.ts
//
// ADR-0233 — Smartout has no first-class escalation hierarchy. This helper
// codifies the Phase 2 PROXY chain that resolves "who should be paged when
// a helpdesk ticket breaches its SLA timer". DO NOT invent a different
// chain in another capability — reuse this helper. Phase 3 will replace it
// with a real `profile.reports_to_profile_id` model.
//
// Resolution order:
//   1. Look up the rep's PRIMARY team via `team_member.team_id` → `team`.
//      "Primary" is heuristic — most-recent membership wins. If the team's
//      `leader_profile_id` is set AND is not the rep, return that profile
//      with `resolution_path='team_leader'`.
//   2. Broadcast fallback. Pick any profile in the same workspace where
//      `role >= min_role` (excluding the rep). Stable pick: order by
//      `created_at` ASC + `profile_id` ASC. Return with
//      `resolution_path='broadcast'`.
//   3. Neither path produces a recipient. Emit
//      `helpdesk.sla.no_observer_resolved` (already registered in
//      packages/telemetry/src/registry.ts) so the silent SLA failure
//      becomes loud in operations data, then return null.
//
// PII surface: this helper reads team membership + profile roles only.
// No PII fields are read or logged. Safe to call from any channel.

import type { SupabaseClient } from "@supabase/supabase-js";
import { emit } from "@smartout/telemetry";
import { nonEmpty } from "@smartout/telemetry/server";
import type { ProfileRole } from "../types.js";

export type ResolveObserverArgs = {
  workspaceId: string;
  /** The rep on the helpdesk channel — `channel.responsible_profile_id`. */
  repProfileId: string;
  /** Minimum role for broadcast fallback — from
   *  `engine_authority_config.min_role` for capability='helpdesk_query'. */
  minRole: ProfileRole;
  /** Caller-provided supabase client. Service-role key in production
   *  (capability tools have admin scope); RLS-enforced in tests. */
  supabase: SupabaseClient;
  /** Optional ticket id for telemetry context. When unset the
   *  `helpdesk.sla.no_observer_resolved` event will use empty-string —
   *  pass when available so audit data has the link. */
  engineStateId?: string;
};

export type ResolveObserverResult =
  | {
      observer_profile_id: string;
      resolution_path: "team_leader" | "broadcast";
    }
  | {
      observer_profile_id: null;
      resolution_path: "no_observer";
    };

// Role hierarchy used for the broadcast fallback. Mirrors the
// authority-gate ranking — higher index = more privileged. NEVER reorder
// without updating engine_authority_config seeds and gate_action.
const ROLE_RANK: Record<ProfileRole, number> = {
  employee: 0,
  manager: 1,
  admin: 2,
  owner: 3,
};

/**
 * Resolve the observer profile for an SLA breach according to ADR-0233.
 * Order: team leader → broadcast → null + telemetry.
 *
 * Caller is responsible for invoking this BEFORE inserting the breach
 * trigger, so a `null` resolution can short-circuit the trigger insert
 * (fire-time would silently no-op without a recipient — see
 * 20260429100000 migration step 2 dispatcher guard note).
 */
export async function resolveObserver(args: ResolveObserverArgs): Promise<ResolveObserverResult> {
  const { workspaceId, repProfileId, minRole, supabase, engineStateId } = args;

  // ── 1. Team-leader path ───────────────────────────────────────────
  // Find the rep's most-recent team membership. The rep may sit on multiple
  // teams (cross-functional setups); we pick the most recent join as a
  // proxy for "primary team". If the team's leader is the rep themselves,
  // skip — escalation MUST go to a different person.
  const { data: memberships } = await supabase
    .from("team_member")
    .select("team_id, created_at")
    .eq("profile_id", repProfileId)
    .order("created_at", { ascending: false })
    .limit(1);

  const primaryTeamId = (memberships?.[0]?.team_id as string | undefined) ?? null;

  if (primaryTeamId) {
    const { data: teamRow } = await supabase
      .from("team")
      .select("leader_profile_id, workspace_id")
      .eq("team_id", primaryTeamId)
      .maybeSingle();

    const leaderId = (teamRow?.leader_profile_id as string | null) ?? null;
    const teamWorkspace = (teamRow?.workspace_id as string | undefined) ?? null;

    // Workspace-integrity sanity: a rep should not be a member of a team in
    // a different workspace (FK + RLS enforce this), but verify defensively
    // before returning the leader as the observer.
    if (leaderId && leaderId !== repProfileId && teamWorkspace === workspaceId) {
      return {
        observer_profile_id: leaderId,
        resolution_path: "team_leader",
      };
    }
  }

  // ── 2. Broadcast fallback ────────────────────────────────────────
  // All workspace profiles whose role >= minRole, excluding the rep.
  // Stable pick: lexicographic on created_at + profile_id. "Most recent
  // activity" was considered but adds a join (activity_trail) for marginal
  // benefit — created_at is sufficient + deterministic.
  const minRank = ROLE_RANK[minRole];
  const eligibleRoles = (Object.keys(ROLE_RANK) as ProfileRole[]).filter(
    (r) => ROLE_RANK[r] >= minRank,
  );

  const { data: candidates } = await supabase
    .from("profile")
    .select("profile_id, created_at, role")
    .eq("workspace_id", workspaceId)
    .in("role", eligibleRoles)
    .neq("profile_id", repProfileId)
    .order("created_at", { ascending: true })
    .order("profile_id", { ascending: true })
    .limit(1);

  const broadcastObserver = (candidates?.[0]?.profile_id as string | undefined) ?? null;

  if (broadcastObserver) {
    return {
      observer_profile_id: broadcastObserver,
      resolution_path: "broadcast",
    };
  }

  // ── 3. No observer resolved — emit telemetry (silent → loud) ────
  // Routes to logger + activity_trail per registry. NOT engine_event
  // (no downstream consumer) and NOT PostHog (not an analytics signal).
  await emit({
    event: "helpdesk.sla.no_observer_resolved",
    workspace_id: nonEmpty(workspaceId, "workspaceId"),
    actor_id: nonEmpty(repProfileId, "repProfileId"),
    entity: {
      entity_type: "engine_state",
      entity_id: engineStateId ?? repProfileId,
      entity_label: "helpdesk SLA observer resolution",
    },
    properties: {
      engine_state_id: engineStateId ?? "",
      workspace_id: workspaceId,
      rep_profile_id: repProfileId,
      min_role: minRole,
      attempted_paths: ["team_leader", "broadcast"],
    },
  });

  return { observer_profile_id: null, resolution_path: "no_observer" };
}
