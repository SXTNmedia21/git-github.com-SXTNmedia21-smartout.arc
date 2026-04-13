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

const PushSendSchema = z.object({
  audience: AudienceFilterSchema,
  title: z.string().min(1).max(100),
  body: z.string().min(1).max(300),
  actionUrl: z.string().optional(),
});

export async function POST(request: Request) {
  const result = await requireGodmode();
  if (result.error) return result.error;
  const { adminId, admin } = result;

  const parsed = PushSendSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { audience, title, body, actionUrl } = parsed.data;

  // Resolve audience
  const recipients = await resolveAudience(admin, audience as AudienceFilter);
  if (recipients.length === 0) {
    return NextResponse.json({ error: "No recipients match the audience filter" }, { status: 400 });
  }

  // Fetch push tokens
  const userIds = recipients.map((r) => r.userId);
  const { data: profiles } = await admin
    .from("profile")
    .select("profile_id, user_id, workspace_id, expo_push_token")
    .in("user_id", userIds)
    .not("expo_push_token", "is", null);

  const pushableProfiles = (profiles ?? []).filter(
    (p): p is typeof p & { expo_push_token: string } => Boolean(p.expo_push_token),
  );

  // Log communication
  const { data: commLog } = await admin
    .from("platform_communication_log")
    .insert({
      super_admin_id: adminId,
      subject: title,
      message_body: body,
      template: "push",
      classification: "broadcast",
      audience_filter: audience as unknown as Json,
      workspace_id: audience.type === "workspace" ? audience.workspaceId : null,
      recipient_count: recipients.length,
      status: "sending",
      channel: "push",
    } as never)
    .select("communication_id")
    .single();

  const jobId = (commLog as { communication_id: string } | null)?.communication_id;

  // Send via Expo Push API in batches of 100
  const messages = pushableProfiles.map((p) => ({
    to: p.expo_push_token,
    title,
    body,
    sound: "default" as const,
    priority: "high" as const,
    data: { event: "platform_broadcast", action_url: actionUrl ?? "" },
    channelId: "default",
  }));

  let sentCount = 0;
  let failedCount = 0;

  for (let i = 0; i < messages.length; i += 100) {
    const chunk = messages.slice(i, i + 100);
    try {
      const res = await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(chunk),
      });
      if (res.ok) {
        const data = await res.json();
        const tickets = Array.isArray(data?.data) ? data.data : [data?.data];
        for (const ticket of tickets) {
          if (ticket?.status === "ok") sentCount++;
          else failedCount++;
        }
      } else {
        failedCount += chunk.length;
      }
    } catch {
      failedCount += chunk.length;
    }
  }

  failedCount += recipients.length - pushableProfiles.length;

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

  await logPlatformAction(adminId, "send_push", "communication", jobId ?? null, {
    recipientCount: recipients.length,
    pushableCount: pushableProfiles.length,
    sentCount,
    failedCount,
  });

  void emit({
    event: "communication sent",
    workspace_id: audience.type === "workspace" ? audience.workspaceId : "platform",
    actor_id: adminId,
    properties: {
      data: {
        communication_id: jobId ?? "",
        template: "push",
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
    pushTokenCount: pushableProfiles.length,
    sentCount,
    failedCount,
  });
}
