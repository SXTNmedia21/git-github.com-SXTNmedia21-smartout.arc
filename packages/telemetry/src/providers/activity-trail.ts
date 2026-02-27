import { createClient } from "@supabase/supabase-js";
import type { SmartoutEvent, EventMeta } from "../registry";

// Since this is purely internal/immutable, we use the Service Role to skip RLS
const getSupabaseClient = () => {
  return createClient(
    process.env.SUPABASE_URL || (process.env.NEXT_PUBLIC_SUPABASE_URL as string),
    process.env.SUPABASE_SERVICE_ROLE_KEY as string,
  );
};

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
  const { error } = await supabase.from("activity_trail").insert({
    workspace_id: event.workspace_id,
    actor_id: event.actor_id,
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
