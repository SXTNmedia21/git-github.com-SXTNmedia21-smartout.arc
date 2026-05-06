import { createClient } from "@supabase/supabase-js";
import type { SmartoutEvent, EventMeta } from "../registry";

// Since this is purely internal/immutable, we use the Service Role to skip RLS
const getSupabaseClient = () => {
  return createClient(
    process.env.SUPABASE_URL || (process.env.NEXT_PUBLIC_SUPABASE_URL as string),
    process.env.SUPABASE_SERVICE_ROLE_KEY as string,
  );
};

/**
 * Resolve an activity_trail entity reference from event properties.
 *
 * Accepts two shapes (S1.1 / ADR-0175):
 *   1. Nested legacy shape: `props.entity = { entity_type, entity_id, entity_label }`.
 *   2. Flat shape: `props.entity_type`, `props.entity_id`, `props.entity_label`
 *      on `properties` directly. Used by journey events (`journey run_started`, etc.)
 *      and anything that adopts the flat convention going forward.
 *
 * Nested wins when both are present. Returns `null` when the required pair
 * (`entity_type`, `entity_id`) cannot be resolved from either shape.
 *
 * Pure — no IO, safe to unit-test without Supabase. Exported for
 * `__tests__/activity-trail.flat.test.ts`.
 */
export function resolveEntityRef(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  props: any,
): { entity_type: string; entity_id: string; entity_label?: string } | null {
  const candidate = props?.entity ?? {
    entity_type: props?.entity_type,
    entity_id: props?.entity_id,
    entity_label: props?.entity_label,
  };

  if (!candidate || !candidate.entity_type || !candidate.entity_id) {
    return null;
  }

  return {
    entity_type: candidate.entity_type,
    entity_id: candidate.entity_id,
    entity_label: candidate.entity_label,
  };
}

/**
 * Resolves the activity trail actor to a workspace profile ID.
 * Why: some server actions emit auth user IDs, while activity_trail stores profile IDs.
 *
 * @returns The matching profile ID for the workspace, or null when none can be resolved
 */
async function resolveActorProfileId(
  supabase: ReturnType<typeof getSupabaseClient>,
  event: SmartoutEvent,
): Promise<string | null> {
  if (!event.actor_id || !event.workspace_id) {
    return null;
  }

  const { data: directProfile } = await supabase
    .from("profile")
    .select("profile_id")
    .eq("profile_id", event.actor_id)
    .eq("workspace_id", event.workspace_id)
    .maybeSingle();

  if (directProfile?.profile_id) {
    return directProfile.profile_id;
  }

  const { data: profileByUser } = await supabase
    .from("profile")
    .select("profile_id")
    .eq("user_id", event.actor_id)
    .eq("workspace_id", event.workspace_id)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  return profileByUser?.profile_id ?? null;
}

export async function writeActivityTrail(event: SmartoutEvent, meta: EventMeta): Promise<void> {
  // Platform-scoped event — audit handled by billing_activity_log destination per
  // ADR-0262 amendment. activity_trail is workspace-scoped; settlement runs span
  // multiple workspaces and legitimately emit with workspace_id: null.
  // This is a deliberate routing boundary, NOT an error condition.
  //
  // ADR-0290 Phase 2A note: activity_trail now accepts actor_kind='platform' rows
  // with null workspace_id — BUT those rows are written directly by
  // engine_world_observe_platform (a SECURITY DEFINER RPC), not through this
  // emit() path. The early-return here is intentionally retained: emit() events
  // with workspace_id=null route to PostHog+Logger only (per ADR-0262 routing
  // boundary for settlement-span events). If a future emit()-path event needs a
  // platform activity_trail row, it must carry actor_kind explicitly and this
  // guard must be revised with a new ADR. Do not remove this return without that.
  if (event.workspace_id === null) {
    return;
  }

  // We can loosely assume standard props to map to our explicit DB columns
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const props = event.properties as any;

  // S1.1 (2026-04-22): both nested `entity` block (legacy) AND flat
  // entity_type/entity_id/entity_label are accepted. Journey events
  // (ADR-0175) use the flat shape; existing events continue to use nested.
  // See resolveEntityRef() above.
  const entity = resolveEntityRef(props);

  if (!entity) {
    console.warn(
      `[telemetry] Expected entity reference (nested 'entity' or flat entity_type/entity_id) for event "${event.event}" but none was found. Activity trail rejected.`,
    );
    return;
  }

  // Example extraction logic: "shift updated" -> "updated"
  const parts = event.event.split(" ");
  const actionVerb = parts[parts.length - 1];

  const supabase = getSupabaseClient();
  const actorProfileId = await resolveActorProfileId(supabase, event);

  if (!actorProfileId) {
    console.warn(
      `[telemetry] Could not resolve actor profile for "${event.event}" in workspace "${event.workspace_id}". Activity trail rejected.`,
    );
    return;
  }

  const { error } = await supabase.from("activity_trail").insert({
    workspace_id: event.workspace_id,
    actor_id: actorProfileId,
    event: event.event,
    action_verb: actionVerb,
    category: meta.category,
    entity_type: entity.entity_type,
    entity_id: entity.entity_id,
    entity_label: entity.entity_label,
    data: props.data ?? {},
    changes: props.changes ?? {},
    correlation_id: event.correlation_id,
    source: props.source ?? "web",
  });

  if (error) {
    // Failing to write to Audit Trail doesn't break user flow,
    // but we log it locally for server remediation.
    console.error(`[telemetry.activity_trail] Insertion failed for ${event.event}:`, error);
  }
}
