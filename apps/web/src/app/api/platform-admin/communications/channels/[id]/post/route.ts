/**
 * POST /api/platform-admin/communications/channels/[id]/post
 *
 * Posts a message to a specific channel as a platform admin.
 * Inserts into channel_message with origin_type "system".
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireGodmode, logPlatformAction } from "@/lib/platform-admin";
import { emit, nonEmpty } from "@smartout/telemetry";
import type { Json } from "@smartout/supabase";

const PostMessageSchema = z.object({
  content: z.string().min(1).max(5000),
  message_type: z.enum(["announcement", "reminder", "text"]).default("announcement"),
  pin: z.boolean().default(false),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const result = await requireGodmode();
  if (result.error) return result.error;
  const { adminId, admin } = result;

  const { id: channelId } = await params;

  const parsed = PostMessageSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { content, message_type, pin } = parsed.data;

  // Verify channel exists and get workspace_id
  const { data: channel, error: channelError } = await admin
    .from("channel")
    .select("id, workspace_id, name, is_archived")
    .eq("id", channelId)
    .single();

  if (channelError || !channel) {
    return NextResponse.json({ error: "Channel not found" }, { status: 404 });
  }

  if (channel.is_archived) {
    return NextResponse.json({ error: "Cannot post to an archived channel" }, { status: 400 });
  }

  // Count members for telemetry
  const { count: memberCount } = await admin
    .from("channel_member")
    .select("*", { count: "exact", head: true })
    .eq("channel_id", channelId);

  const now = new Date().toISOString();

  // Insert channel message
  const { data: message, error: insertError } = await admin
    .from("channel_message")
    .insert({
      channel_id: channelId,
      workspace_id: channel.workspace_id,
      sender_id: adminId,
      content,
      message_type,
      origin_type: "system" as const,
      visibility_scope: "all_members" as const,
      delivery_mode: "timeline" as const,
      is_pinned: pin,
      pinned_at: pin ? now : null,
      pinned_by: pin ? adminId : null,
      system_data: {
        source: "platform_admin",
        admin_id: adminId,
      } as unknown as Json,
    })
    .select("id")
    .single();

  if (insertError || !message) {
    return NextResponse.json(
      { error: `Failed to post message: ${insertError?.message ?? "unknown"}` },
      { status: 500 },
    );
  }

  // Log to platform_communication_log
  await admin.from("platform_communication_log" as never).insert({
    super_admin_id: adminId,
    subject: `Channel message: ${channel.name ?? channelId}`,
    message_body: content,
    template: message_type,
    classification: "broadcast",
    workspace_id: channel.workspace_id,
    recipient_count: memberCount ?? 0,
    sent_count: memberCount ?? 0,
    failed_count: 0,
    status: "sent",
    channel: "channel_message",
  } as never);

  // Audit log
  await logPlatformAction(adminId, "post_channel_message", "channel_message", message.id, {
    channelId,
    channelName: channel.name,
    workspaceId: channel.workspace_id,
    messageType: message_type,
    pinned: pin,
    memberCount: memberCount ?? 0,
  });

  // Telemetry
  void emit({
    event: "communication sent",
    workspace_id: nonEmpty(channel.workspace_id, "workspace_id"),
    actor_id: nonEmpty(adminId, "actor_id"),
    properties: {
      data: {
        communication_id: message.id,
        template: message_type,
        classification: "channel_broadcast",
        recipient_count: memberCount ?? 0,
        sent_count: memberCount ?? 0,
        failed_count: 0,
      },
    },
  });

  return NextResponse.json({
    messageId: message.id,
    channelId,
    channelName: channel.name,
    workspaceId: channel.workspace_id,
    memberCount: memberCount ?? 0,
  });
}
