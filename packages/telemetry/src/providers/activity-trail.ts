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
  // We can loosely assume standard props to map to our explicit DB columns
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const props = event.properties as any;
  const entity = props?.entity;

  if (!entity) {
    console.warn(
      `[telemetry] Expected entity reference format for event "${event.event}" but none was found. Activity trail rejected.`,
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
