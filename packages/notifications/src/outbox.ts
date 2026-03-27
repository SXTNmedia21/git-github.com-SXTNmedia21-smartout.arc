/**
 * Outbox helper — inserts a single notification into notification_outbox.
 * Resolves static config from the event registry, interpolates all templates,
 * and writes a fully-formed row. The outbox consumer Edge Function handles
 * fan-out to push/email/sms/in_app channels.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { getEventConfig, interpolateTemplate } from "./event-config";

type OutboxInsert = {
  workspace_id: string;
  recipient_id: string;
  event_key: string;
  metadata: Record<string, unknown>;
  priority_override?: 0 | 1 | 2;
};

/**
 * Insert a notification into the outbox.
 * Resolves event config from registry, interpolates templates,
 * and builds the outbox row.
 */
export async function insertOutboxNotification(
  supabase: SupabaseClient,
  input: OutboxInsert,
): Promise<{ error: Error | null }> {
  const config = getEventConfig(input.event_key);
  if (!config) {
    return { error: new Error(`Unknown event_key: ${input.event_key}`) };
  }

  const groupKey = config.group_key_template
    ? interpolateTemplate(config.group_key_template, input.metadata)
    : null;

  const { error } = await supabase.from("notification_outbox").insert({
    workspace_id: input.workspace_id,
    recipient_id: input.recipient_id,
    mode: config.mode,
    priority: input.priority_override ?? config.default_priority,
    title: interpolateTemplate(config.title_template, input.metadata),
    body: interpolateTemplate(config.body_template, input.metadata),
    action_url: interpolateTemplate(config.action_url_template, input.metadata),
    metadata: {
      event_key: input.event_key,
      group_key: groupKey,
      icon_type: config.icon_type,
      ...input.metadata,
    },
    allowed_channels: config.allowed_channels,
  });

  return { error: error ? new Error(error.message) : null };
}
