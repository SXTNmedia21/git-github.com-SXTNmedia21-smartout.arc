"use server";

import { z } from "zod";
import { createAdminClient } from "@smartout/supabase/admin";
import { emit, nonEmpty } from "@smartout/telemetry";
import { emitAnnouncementPublished } from "@smartout/ai/capabilities/communication/emit-announcement-events";
import { revalidatePath } from "next/cache";
import { resolveCurrentProfile, gateAction } from "./_shared";
import { hasMinimumRole, detectPii } from "./_shared-utils";

const BroadcastSchema = z.object({
  type: z.enum(["alert", "reminder", "note"]),
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(4000),
  recipientIds: z.array(z.string().uuid()).optional(),
  departmentId: z.string().uuid().optional(),
  sessionId: z.string().uuid().optional(),
});

export type SendBroadcastInput = z.infer<typeof BroadcastSchema>;
export type SendBroadcastResult =
  | { ok: true; channelId: string; messageId: string }
  | { ok: false; error: string };

/**
 * Server Action for WebDayControl Melding tab.
 *
 * Resolves-or-creates the workspace-scoped `news` channel, inserts an
 * `announcement` message, encodes broadcast metadata (type, title,
 * department_id, session_id) into `channel_message.system_data` JSONB per
 * ADR-0156 § broadcast-type-encoding — no new column, no silent schema drift.
 * `session_id` links the broadcast to the D6 session so daily audit trails
 * can reconstruct "what was broadcast during this day" (Steward Gate 3
 * provenance completeness).
 *
 * Runs PII guardrail per ADR-0077, and emits `communication.broadcast_sent`
 * via the telemetry registry (`properties.metadata` shape — registry-defined
 * for communication category).
 */
export async function sendBroadcastAction(input: SendBroadcastInput): Promise<SendBroadcastResult> {
  const parsed = BroadcastSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Invalid input." };
  }

  const profile = await resolveCurrentProfile();
  if (!profile) return { ok: false, error: "Not authenticated." };

  // Belt-and-braces: inline role check + canonical gate_action (ADR-0099).
  // Once broadcast.send is seeded for all workspaces, inline check removes.
  if (!hasMinimumRole(profile.role, "manager")) {
    return {
      ok: false,
      error: "Kun ledere og admins kan sende broadcasts.",
    };
  }

  const gate = await gateAction({
    workspaceId: profile.workspaceId,
    capability: "broadcast.send",
    channel: "chat",
    actorProfileId: profile.profileId,
    actionType: "send",
  });
  if (!gate.allow) return { ok: false, error: `Avvist: ${gate.reason ?? "forbidden"}` };
  if (gate.downgrade_to === "suggest") {
    return { ok: false, error: "Rollen din er under minstekravet for broadcast." };
  }

  // PII guardrail — ADR-0077 blocks Norwegian PII in broadcast channels
  const piiHit = detectPii(`${parsed.data.title}\n${parsed.data.body}`);
  if (piiHit) {
    return {
      ok: false,
      error: `Meldingen inneholder ${piiHit}. Personlige detaljer må ikke sendes i broadcast-kanal. Bruk direkte-melding i stedet.`,
    };
  }

  // Service-role client: `channel_jwt_insert` RLS permits only
  // `channel_type IN ('custom','direct')` — 'news' is blocked under user JWT.
  // `channel_message_jwt_insert` requires channel_member row for sender; no
  // auto-join for news. Post-impl R1 fix: bypass RLS after role + workspace
  // checks (resolveCurrentProfile + hasMinimumRole above guarantee caller
  // authority; admin client writes with workspace_id from server-derived profile).
  const supabase = createAdminClient();

  // Resolve-or-create the workspace news channel (matches useSendBroadcast pattern).
  // Channel resolution stays here; only the message write goes through RPC.
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

  // V2 RPC migration: delegate to publish_announcement_atomic (Track C M4).
  // Defense-in-depth: broadcast.send capability gate above already fired and
  // passed — this RPC layer is the second gate. Both gates are intentional per
  // audit-symmetry requirements; activity-trail documents both authorization
  // events. Title + body encoded in content field per ADR-0156; broadcast_type
  // + session/department context preserved in system_data JSONB.
  const { data: rpcData, error: rpcErr } = await supabase.rpc("publish_announcement_atomic", {
    p_workspace_id: profile.workspaceId,
    p_actor_profile_id: profile.profileId,
    p_channel_id: channelId,
    p_content: `**${parsed.data.title}**\n\n${parsed.data.body}`,
    p_visibility_scope:
      (parsed.data.recipientIds?.length ?? 0) > 0 ? "targeted_members" : "all_members",
    p_target_profile_ids: parsed.data.recipientIds ?? [],
    p_system_data: {
      broadcast_type: parsed.data.type,
      title: parsed.data.title,
      department_id: parsed.data.departmentId ?? null,
      session_id: parsed.data.sessionId ?? null,
    },
    p_kind: "workspace_news",
    p_tier: "work",
    p_tags: [],
    p_linked_entity_type: null,
    p_linked_entity_id: null,
    p_client_message_id: crypto.randomUUID(),
  });

  if (rpcErr || !rpcData)
    return { ok: false, error: rpcErr?.message ?? "Publisering via RPC mislyktes." };

  const msg = { id: rpcData as string };

  await emit({
    event: "communication.broadcast_sent",
    workspace_id: nonEmpty(profile.workspaceId, "workspace_id"),
    actor_id: nonEmpty(profile.profileId, "actor_id"),
    properties: {
      metadata: {
        source: "day_control_broadcast",
        recipient_count: parsed.data.recipientIds?.length ?? 0,
        channel_id: channelId,
      },
    },
  });
  // Note: registry shape for communication.broadcast_sent uses
  // `properties.metadata` (not `data`) and routes to activity_trail +
  // posthog only — activity-trail provider expects entity ref which is
  // absent by design for this event (broadcast is a channel_message whose
  // activity belongs in channel_event audit, not activity_trail rows).

  // V2 channel.message.sent with announcement properties via shared helper (spec §9.b).
  // Day-control server action defaults: kind='workspace_news', tier='work' per §9 table.
  await emitAnnouncementPublished({
    workspace_id: nonEmpty(profile.workspaceId, "workspace_id"),
    actor_id: nonEmpty(profile.profileId, "actor_id"),
    message_id: msg.id,
    channel_id: channelId,
    origin_type: "system",
    kind: "workspace_news",
    tier: "work",
    target_profile_count: parsed.data.recipientIds?.length ?? 0,
    visibility_scope:
      (parsed.data.recipientIds?.length ?? 0) > 0 ? "targeted_members" : "all_members",
  });

  revalidatePath("/dashboard");
  return { ok: true, channelId, messageId: msg.id };
}
