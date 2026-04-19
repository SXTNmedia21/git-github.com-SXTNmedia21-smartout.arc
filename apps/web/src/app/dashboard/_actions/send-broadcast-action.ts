"use server";

import { z } from "zod";
import { createClient } from "@smartout/supabase/server";
import { emit } from "@smartout/telemetry";
import { revalidatePath } from "next/cache";
import { resolveCurrentProfile, hasMinimumRole, detectPii } from "./_shared";

const BroadcastSchema = z.object({
  type: z.enum(["alert", "reminder", "note"]),
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(4000),
  recipientIds: z.array(z.string().uuid()).optional(),
  departmentId: z.string().uuid().optional(),
});

export type SendBroadcastInput = z.infer<typeof BroadcastSchema>;
export type SendBroadcastResult =
  | { ok: true; channelId: string; messageId: string }
  | { ok: false; error: string };

/**
 * Server Action for WebDayControl Melding tab.
 *
 * Resolves-or-creates the workspace-scoped `news` channel, inserts an
 * `announcement` message, encodes broadcast type into `metadata.broadcast_type`
 * JSONB (ADR-0156 §broadcast-type-encoding — no new column, no silent schema
 * drift), runs PII guardrail per ADR-0077, and emits via telemetry registry.
 */
export async function sendBroadcastAction(input: SendBroadcastInput): Promise<SendBroadcastResult> {
  const parsed = BroadcastSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Invalid input." };
  }

  const profile = await resolveCurrentProfile();
  if (!profile) return { ok: false, error: "Not authenticated." };

  if (!hasMinimumRole(profile.role, "manager")) {
    return {
      ok: false,
      error: "Kun ledere og admins kan sende broadcasts.",
    };
  }

  // PII guardrail — ADR-0077 blocks Norwegian PII in broadcast channels
  const piiHit = detectPii(`${parsed.data.title}\n${parsed.data.body}`);
  if (piiHit) {
    return {
      ok: false,
      error: `Meldingen inneholder ${piiHit}. Personlige detaljer må ikke sendes i broadcast-kanal. Bruk direkte-melding i stedet.`,
    };
  }

  const supabase = await createClient();

  // Resolve-or-create the workspace news channel (matches useSendBroadcast pattern)
  const { data: existing } = await supabase
    .from("channel")
    .select("id")
    .eq("workspace_id", profile.workspaceId)
    .eq("channel_type", "news")
    .limit(1)
    .maybeSingle();

  let channelId = existing?.id;
  if (!channelId) {
    const { data: created, error: createErr } = await supabase
      .from("channel")
      .insert({
        workspace_id: profile.workspaceId,
        channel_type: "news",
        name: "Driftsmeldinger",
        created_by: profile.profileId,
      })
      .select("id")
      .single();
    if (createErr || !created)
      return { ok: false, error: createErr?.message ?? "Klarte ikke å opprette news-kanal." };
    channelId = created.id;
  }

  // channel_message has a single `content` text column. Title is encoded in
  // system_data for the rendering layer; broadcast_type encoded in system_data
  // per ADR-0156 — no new column, no silent schema drift.
  const { data: msg, error: insertErr } = await supabase
    .from("channel_message")
    .insert({
      channel_id: channelId,
      workspace_id: profile.workspaceId,
      sender_id: profile.profileId,
      content: `**${parsed.data.title}**\n\n${parsed.data.body}`,
      message_type: "announcement",
      delivery_mode: "notification_only",
      target_profile_ids: parsed.data.recipientIds ?? null,
      system_data: {
        broadcast_type: parsed.data.type,
        title: parsed.data.title,
        department_id: parsed.data.departmentId ?? null,
      },
    })
    .select("id")
    .single();

  if (insertErr || !msg) return { ok: false, error: insertErr?.message ?? "Insert mislyktes." };

  await emit({
    event: "communication.broadcast_sent",
    workspace_id: profile.workspaceId,
    actor_id: profile.profileId,
    properties: {
      metadata: {
        source: "day_control_broadcast",
        recipient_count: parsed.data.recipientIds?.length ?? 0,
        channel_id: channelId,
      },
    },
  });

  revalidatePath("/dashboard");
  return { ok: true, channelId, messageId: msg.id };
}
