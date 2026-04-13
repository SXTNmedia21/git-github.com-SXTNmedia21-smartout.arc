import { NextResponse } from "next/server";
import { z } from "zod";
import { requireGodmode, logPlatformAction } from "@/lib/platform-admin";
import { resolveAudience, type AudienceFilter } from "@smartout/notifications";
import { emit } from "@smartout/telemetry";
import type { Json } from "@smartout/supabase";

const AudienceFilterSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("all_users") }),
  z.object({ type: z.literal("super_admins") }),
  z.object({
    type: z.literal("workspace"),
    workspaceId: z.string().uuid(),
    role: z.string().optional(),
    status: z.string().optional(),
  }),
  z.object({
    type: z.literal("department"),
    workspaceId: z.string().uuid(),
    departmentId: z.string().uuid(),
  }),
  z.object({ type: z.literal("role"), role: z.string() }),
  z.object({ type: z.literal("status"), status: z.string() }),
  z.object({ type: z.literal("user_ids"), userIds: z.array(z.string().uuid()) }),
]);

const InAppBroadcastSchema = z.object({
  audience: AudienceFilterSchema,
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(1000),
  actionUrl: z.string().optional(),
  mode: z.enum(["training", "work", "community"]).default("work"),
  priority: z.enum(["0", "1", "2"]).default("0"),
  iconType: z.string().default("info"),
});

export async function POST(request: Request) {
  const result = await requireGodmode();
  if (result.error) return result.error;
  const { adminId, admin } = result;

  const parsed = InAppBroadcastSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { audience, title, body, actionUrl, mode, priority, iconType } = parsed.data;

  // Resolve audience
  const recipients = await resolveAudience(admin, audience as AudienceFilter);
  if (recipients.length === 0) {
    return NextResponse.json({ error: "No recipients match the audience filter" }, { status: 400 });
  }

  // Resolve workspace IDs for recipients
  const recipientWorkspaces = new Map<string, string>();
  for (const r of recipients) {
    if (r.workspaceId) recipientWorkspaces.set(r.userId, r.workspaceId);
  }

  const needsWorkspace = recipients.filter((r) => !r.workspaceId);
  if (needsWorkspace.length > 0) {
    const { data: profiles } = await admin
      .from("profile")
      .select("user_id, workspace_id")
      .in(
        "user_id",
        needsWorkspace.map((r) => r.userId),
      )
      .eq("is_active", true);
    for (const p of profiles ?? []) {
      if (!recipientWorkspaces.has(p.user_id)) {
        recipientWorkspaces.set(p.user_id, p.workspace_id);
      }
    }
  }

  // Log communication
  const { data: commLog } = await admin
    .from("platform_communication_log")
    .insert({
      super_admin_id: adminId,
      subject: title,
      message_body: body,
      template: "in_app",
      classification: "broadcast",
      audience_filter: audience as unknown as Json,
      workspace_id: audience.type === "workspace" ? audience.workspaceId : null,
      recipient_count: recipients.length,
      status: "sending",
      channel: "in_app",
    } as never)
    .select("communication_id")
    .single();

  const jobId = (commLog as { communication_id: string } | null)?.communication_id;

  // Build outbox rows
  const outboxRows = recipients
    .filter((r) => recipientWorkspaces.has(r.userId))
    .map((r) => ({
      workspace_id: recipientWorkspaces.get(r.userId)!,
      recipient_id: r.userId,
      mode,
      priority: Number(priority),
      title,
      body,
      action_url: actionUrl || null,
      metadata: {
        event_key: "platform.broadcast",
        icon_type: iconType,
        source: "platform_admin",
      },
      allowed_channels: ["in_app"],
    }));

  let sentCount = 0;
  let failedCount = 0;

  if (outboxRows.length > 0) {
    const { error } = await admin.from("notification_outbox" as never).insert(outboxRows as never);

    if (error) {
      failedCount = recipients.length;
    } else {
      sentCount = outboxRows.length;
      failedCount = recipients.length - outboxRows.length;
    }
  } else {
    failedCount = recipients.length;
  }

  // Update log
  if (jobId) {
    await admin
      .from("platform_communication_log")
      .update({
        status: sentCount > 0 ? "sent" : "failed",
        sent_count: sentCount,
        failed_count: failedCount,
        updated_at: new Date().toISOString(),
      } as never)
      .eq("communication_id", jobId);
  }

  await logPlatformAction(adminId, "send_in_app", "communication", jobId ?? null, {
    recipientCount: recipients.length,
    sentCount,
    failedCount,
    mode,
    priority,
  });

  void emit({
    event: "communication sent",
    workspace_id: audience.type === "workspace" ? audience.workspaceId : "platform",
    actor_id: adminId,
    properties: {
      data: {
        communication_id: jobId ?? "",
        template: "in_app",
        classification: "broadcast",
        recipient_count: recipients.length,
        sent_count: sentCount,
        failed_count: failedCount,
      },
    },
  });

  return NextResponse.json({
    jobId,
    recipientCount: recipients.length,
    sentCount,
    failedCount,
  });
}
