import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@smartout/supabase/admin";
import { getSuperAdminId, logPlatformAction } from "@/lib/platform-admin";
import { emit } from "@smartout/telemetry";
import {
  resolveAudience,
  filterSuppressed,
  classifyEmail,
  checkRateLimit,
  isOutboundEmailEnabled,
  createEmailJob,
  sendSmsBatch,
  RECIPIENT_HARD_CAP,
  RECIPIENT_SOFT_CAP,
  type AudienceFilter,
  type EmailTemplate,
  type SendGridTemplateData,
} from "@smartout/notifications";
import type { Json } from "@smartout/supabase";

const CommunicationChannelSchema = z.enum(["email", "sms", "push", "in_app", "channel_message"]);

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

const TemplateDataSchema = z.object({
  header: z.string(),
  main_title: z.string().optional(),
  message: z.string().optional(),
  subTitle: z.string().optional(),
  message2: z.string().optional(),
  items: z
    .array(
      z.object({
        image: z.string().optional(),
        title: z.string(),
        description: z.string().optional(),
        benefits: z.array(z.string()).optional(),
        link: z.string().optional(),
      }),
    )
    .optional(),
  linkText: z.string().optional(),
  link: z.string().optional(),
  footer_title: z.string().optional(),
  footer_message: z.string().optional(),
  hero_image: z.string().optional(),
});

const SendRequestSchema = z.object({
  channels: z.array(CommunicationChannelSchema).min(1).default(["email"]),
  audience: AudienceFilterSchema,
  template: z
    .enum([
      "platform-announcement",
      "workspace-notification",
      "trial-reminder",
      "payment-reminder",
      "contract-reminder",
      "sendgrid-dynamic",
    ])
    .optional()
    .default("platform-announcement"),
  subject: z.string().min(1).max(200),
  message: z.string().max(10000).optional(),
  confirmed: z.boolean().optional(),
  idempotencyKey: z.string().optional(),
  sendgridTemplateId: z.string().optional(),
  templateData: TemplateDataSchema.optional(),
  campaignId: z.string().uuid().optional(),
  // Push-specific
  pushTitle: z.string().max(100).optional(),
  pushBody: z.string().max(300).optional(),
  actionUrl: z.string().optional(),
  // SMS-specific
  smsBody: z.string().max(1600).optional(),
  // In-app specific
  inAppTitle: z.string().max(200).optional(),
  inAppBody: z.string().max(1000).optional(),
  inAppMode: z.enum(["training", "work", "community"]).optional().default("work"),
  inAppPriority: z.enum(["0", "1", "2"]).optional().default("0"),
  inAppIconType: z.string().optional().default("info"),
  // Scheduling
  scheduledFor: z.string().datetime().optional(),
  // Priority override — allows bypassing quiet hours for critical messages
  overrideQuietHours: z.boolean().optional().default(false),
});

type ChannelResult = {
  channel: string;
  recipientCount: number;
  sentCount: number;
  failedCount: number;
  error?: string;
};

export async function POST(request: NextRequest) {
  const adminId = await getSuperAdminId();
  if (!adminId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json().catch(() => null);
  const parsed = SendRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const {
    channels,
    audience,
    template,
    subject,
    message,
    confirmed,
    idempotencyKey,
    sendgridTemplateId,
    templateData,
    campaignId,
    pushTitle,
    pushBody,
    actionUrl,
    smsBody,
    inAppTitle,
    inAppBody,
    inAppMode,
    inAppPriority,
    inAppIconType,
    scheduledFor,
    overrideQuietHours,
  } = parsed.data;

  const admin = createAdminClient();

  // Idempotency check
  if (idempotencyKey) {
    const { data: existing } = await admin
      .from("platform_communication_log")
      .select("communication_id, status")
      .eq("idempotency_key", idempotencyKey)
      .maybeSingle();
    if (existing) {
      return NextResponse.json(
        {
          error: "Duplicate send",
          jobId: (existing as { communication_id: string }).communication_id,
        },
        { status: 409 },
      );
    }
  }

  // Resolve audience
  let recipients;
  try {
    recipients = await resolveAudience(admin, audience as AudienceFilter);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to resolve audience" },
      { status: 400 },
    );
  }

  if (recipients.length === 0) {
    return NextResponse.json({ error: "No recipients match the audience filter" }, { status: 400 });
  }

  if (recipients.length > RECIPIENT_HARD_CAP) {
    return NextResponse.json(
      { error: `Recipient count (${recipients.length}) exceeds maximum of ${RECIPIENT_HARD_CAP}` },
      { status: 400 },
    );
  }

  if (recipients.length > RECIPIENT_SOFT_CAP && !confirmed) {
    return NextResponse.json(
      {
        error: `Send to ${recipients.length} recipients requires confirmation`,
        recipientCount: recipients.length,
        requiresConfirmation: true,
      },
      { status: 400 },
    );
  }

  const sharedCampaignId = campaignId ?? (channels.length > 1 ? crypto.randomUUID() : undefined);

  // If scheduled, save as queued and return without dispatching
  if (scheduledFor) {
    const scheduledAt = new Date(scheduledFor);
    if (scheduledAt <= new Date()) {
      return NextResponse.json({ error: "Scheduled time must be in the future" }, { status: 400 });
    }

    const queuedIds: string[] = [];
    for (const channel of channels) {
      const { data: commLog } = await admin
        .from("platform_communication_log")
        .insert({
          super_admin_id: adminId,
          subject,
          message_body: message ?? "",
          template: channel === "email" ? template : channel,
          classification:
            channel === "email" ? classifyEmail(template as EmailTemplate) : "broadcast",
          audience_filter: audience as unknown as Json,
          workspace_id:
            audience.type === "workspace"
              ? audience.workspaceId
              : audience.type === "department"
                ? audience.workspaceId
                : null,
          idempotency_key: idempotencyKey ? `${idempotencyKey}-${channel}` : null,
          recipient_count: recipients.length,
          status: "queued",
          channel,
          campaign_id: sharedCampaignId ?? null,
          scheduled_for: scheduledFor,
          sendgrid_template_id:
            channel === "email" && sendgridTemplateId ? sendgridTemplateId : null,
          template_data:
            channel === "email" && templateData ? (templateData as unknown as Json) : null,
        } as never)
        .select("communication_id")
        .single();
      if (commLog) queuedIds.push((commLog as { communication_id: string }).communication_id);
    }

    await logPlatformAction(
      adminId,
      "schedule_communication",
      "communication",
      sharedCampaignId ?? queuedIds[0] ?? null,
      {
        channels,
        recipientCount: recipients.length,
        scheduledFor,
        campaignId: sharedCampaignId,
      },
    );

    return NextResponse.json({
      scheduled: true,
      scheduledFor,
      campaignId: sharedCampaignId,
      queuedIds,
      recipientCount: recipients.length,
      channels,
    });
  }

  const channelResults: ChannelResult[] = [];

  // Process each channel (immediate send)
  for (const channel of channels) {
    const commLogData = {
      super_admin_id: adminId,
      subject,
      message_body: message ?? "",
      template: channel === "email" ? template : channel,
      classification: channel === "email" ? classifyEmail(template as EmailTemplate) : "broadcast",
      audience_filter: audience as unknown as Json,
      workspace_id:
        audience.type === "workspace"
          ? audience.workspaceId
          : audience.type === "department"
            ? audience.workspaceId
            : null,
      idempotency_key: idempotencyKey ? `${idempotencyKey}-${channel}` : null,
      recipient_count: recipients.length,
      status: "sending",
      channel,
      campaign_id: sharedCampaignId ?? null,
      sendgrid_template_id: channel === "email" && sendgridTemplateId ? sendgridTemplateId : null,
      template_data: channel === "email" && templateData ? (templateData as unknown as Json) : null,
    };

    const { data: commLog, error: logError } = await admin
      .from("platform_communication_log")
      .insert(commLogData as never)
      .select("communication_id")
      .single();

    if (logError || !commLog) {
      channelResults.push({
        channel,
        recipientCount: 0,
        sentCount: 0,
        failedCount: 0,
        error: `Failed to create log: ${logError?.message ?? "unknown"}`,
      });
      continue;
    }

    const jobId = (commLog as { communication_id: string }).communication_id;

    try {
      const result = await dispatchChannel(channel, admin, recipients, {
        adminId,
        subject,
        message: message ?? "",
        template: template as EmailTemplate,
        sendgridTemplateId,
        templateData: templateData as SendGridTemplateData | undefined,
        pushTitle: pushTitle ?? subject,
        pushBody: pushBody ?? message ?? "",
        actionUrl: actionUrl ?? "",
        smsBody: smsBody ?? message ?? "",
        inAppTitle: inAppTitle ?? subject,
        inAppBody: inAppBody ?? message ?? "",
        inAppMode: inAppMode as "training" | "work" | "community",
        inAppPriority: Number(inAppPriority) as 0 | 1 | 2,
        inAppIconType: inAppIconType ?? "info",
        audience: audience as AudienceFilter,
      });

      const finalStatus = result.failedCount > 0 && result.sentCount === 0 ? "failed" : "sent";
      await admin
        .from("platform_communication_log")
        .update({
          status: finalStatus,
          sent_count: result.sentCount,
          failed_count: result.failedCount,
          updated_at: new Date().toISOString(),
        } as never)
        .eq("communication_id", jobId);

      // Insert per-channel result
      await admin.from("platform_communication_channel_result" as never).insert({
        communication_id: jobId,
        channel,
        recipient_count: recipients.length,
        sent_count: result.sentCount,
        failed_count: result.failedCount,
        provider: result.provider,
      } as never);

      channelResults.push({
        channel,
        recipientCount: recipients.length,
        sentCount: result.sentCount,
        failedCount: result.failedCount,
      });
    } catch (err) {
      await admin
        .from("platform_communication_log")
        .update({ status: "failed", updated_at: new Date().toISOString() } as never)
        .eq("communication_id", jobId);

      channelResults.push({
        channel,
        recipientCount: recipients.length,
        sentCount: 0,
        failedCount: recipients.length,
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  // Audit + telemetry
  const totalSent = channelResults.reduce((sum, r) => sum + r.sentCount, 0);
  const totalFailed = channelResults.reduce((sum, r) => sum + r.failedCount, 0);

  await logPlatformAction(
    adminId,
    "send_communication",
    "communication",
    sharedCampaignId ?? channelResults[0]?.channel ?? "unknown",
    {
      channels,
      recipientCount: recipients.length,
      totalSent,
      totalFailed,
      campaignId: sharedCampaignId,
    },
  );

  void emit({
    event: "communication sent",
    workspace_id:
      audience.type === "workspace"
        ? audience.workspaceId
        : audience.type === "department"
          ? audience.workspaceId
          : "platform",
    actor_id: adminId,
    properties: {
      data: {
        communication_id: sharedCampaignId ?? "",
        template: channels.includes("email") ? template : (channels[0] ?? "multi"),
        classification: "broadcast",
        recipient_count: recipients.length,
        sent_count: totalSent,
        failed_count: totalFailed,
      },
    },
  });

  return NextResponse.json({
    campaignId: sharedCampaignId,
    channels: channelResults,
    recipientCount: recipients.length,
    totalSent,
    totalFailed,
  });
}

// Channel dispatch logic

type DispatchOptions = {
  adminId: string;
  subject: string;
  message: string;
  template: EmailTemplate;
  sendgridTemplateId?: string;
  templateData?: SendGridTemplateData;
  pushTitle: string;
  pushBody: string;
  actionUrl: string;
  smsBody: string;
  inAppTitle: string;
  inAppBody: string;
  inAppMode: "training" | "work" | "community";
  inAppPriority: 0 | 1 | 2;
  inAppIconType: string;
  audience: AudienceFilter;
};

type DispatchResult = {
  sentCount: number;
  failedCount: number;
  provider: string;
};

async function dispatchChannel(
  channel: string,
  admin: ReturnType<typeof createAdminClient>,
  recipients: Array<{
    email: string;
    name: string;
    userId: string;
    workspaceId?: string;
    locale: string;
  }>,
  opts: DispatchOptions,
): Promise<DispatchResult> {
  switch (channel) {
    case "email":
      return dispatchEmail(admin, recipients, opts);
    case "sms":
      return dispatchSms(admin, recipients, opts);
    case "push":
      return dispatchPush(admin, recipients, opts);
    case "in_app":
      return dispatchInApp(admin, recipients, opts);
    default:
      throw new Error(`Unsupported channel: ${channel}`);
  }
}

async function dispatchEmail(
  admin: ReturnType<typeof createAdminClient>,
  recipients: Array<{ email: string; name: string; userId: string; locale: string }>,
  opts: DispatchOptions,
): Promise<DispatchResult> {
  // Kill switch
  const enabled = await isOutboundEmailEnabled(admin);
  if (!enabled) throw new Error("Email sending is temporarily disabled");

  // Rate limit
  const classification = classifyEmail(opts.template);
  const rateResult = await checkRateLimit(opts.adminId, classification);
  if (!rateResult.allowed) throw new Error(rateResult.reason ?? "Rate limit exceeded");

  // Filter suppressed
  const suppressedEmails = await filterSuppressed(
    admin,
    recipients.map((r) => r.email),
  );
  const suppressedSet = new Set(suppressedEmails.map((e: string) => e.toLowerCase()));
  const activeRecipients = recipients.filter((r) => !suppressedSet.has(r.email.toLowerCase()));

  if (activeRecipients.length === 0) throw new Error("All recipients are suppressed");

  const isDynamic =
    opts.template === "sendgrid-dynamic" && opts.sendgridTemplateId && opts.templateData;

  const result = await createEmailJob(admin, {
    template: opts.template,
    variables: { subject: opts.subject, message: opts.message, title: opts.subject },
    audience: opts.audience,
    adminId: opts.adminId,
    ...(isDynamic
      ? { sendgridTemplateId: opts.sendgridTemplateId, templateData: opts.templateData }
      : {}),
  });

  return { sentCount: result.sentCount, failedCount: result.failedCount, provider: "sendgrid" };
}

async function dispatchSms(
  admin: ReturnType<typeof createAdminClient>,
  recipients: Array<{ userId: string }>,
  opts: DispatchOptions,
): Promise<DispatchResult> {
  // Resolve phone numbers from user_identity
  const userIds = recipients.map((r) => r.userId);
  const { data: identities } = await admin
    .from("user_identity")
    .select("user_id, phone")
    .in("user_id", userIds);

  const phoneRecipients = (identities ?? [])
    .filter((u): u is typeof u & { phone: string } => Boolean(u.phone))
    .map((u) => ({ phone: u.phone, body: opts.smsBody }));

  if (phoneRecipients.length === 0) {
    return { sentCount: 0, failedCount: recipients.length, provider: "twilio" };
  }

  const result = await sendSmsBatch(phoneRecipients, admin);
  return {
    sentCount: result.sent,
    failedCount: result.failed,
    provider: "twilio",
  };
}

async function dispatchPush(
  admin: ReturnType<typeof createAdminClient>,
  recipients: Array<{ userId: string; workspaceId?: string }>,
  opts: DispatchOptions,
): Promise<DispatchResult> {
  // Fetch push tokens for all recipients
  const userIds = recipients.map((r) => r.userId);
  const { data: profiles } = await admin
    .from("profile")
    .select("profile_id, user_id, workspace_id, expo_push_token")
    .in("user_id", userIds)
    .not("expo_push_token", "is", null);

  if (!profiles || profiles.length === 0) {
    return { sentCount: 0, failedCount: recipients.length, provider: "expo" };
  }

  // Batch send via Expo Push API
  const messages = profiles
    .filter((p): p is typeof p & { expo_push_token: string } => Boolean(p.expo_push_token))
    .map((p) => ({
      to: p.expo_push_token,
      title: opts.pushTitle,
      body: opts.pushBody,
      sound: "default" as const,
      priority: "high" as const,
      data: {
        event: "platform_broadcast",
        action_url: opts.actionUrl,
      },
      channelId: "default",
    }));

  if (messages.length === 0) {
    return { sentCount: 0, failedCount: recipients.length, provider: "expo" };
  }

  // Send in chunks of 100 (Expo limit)
  let sentCount = 0;
  let failedCount = 0;

  for (let i = 0; i < messages.length; i += 100) {
    const chunk = messages.slice(i, i + 100);
    try {
      const res = await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
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

  // Count recipients with no push token as failed
  failedCount += recipients.length - profiles.length;

  return { sentCount, failedCount, provider: "expo" };
}

async function dispatchInApp(
  admin: ReturnType<typeof createAdminClient>,
  recipients: Array<{ userId: string; workspaceId?: string }>,
  opts: DispatchOptions,
): Promise<DispatchResult> {
  // Get workspace IDs for recipients who need them
  const recipientWorkspaces = new Map<string, string>();
  for (const r of recipients) {
    if (r.workspaceId) recipientWorkspaces.set(r.userId, r.workspaceId);
  }

  // For recipients without workspace, try to find one
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

  // Insert notification_outbox rows
  const outboxRows = recipients
    .filter((r) => recipientWorkspaces.has(r.userId))
    .map((r) => ({
      workspace_id: recipientWorkspaces.get(r.userId)!,
      recipient_id: r.userId,
      mode: opts.inAppMode,
      priority: opts.inAppPriority,
      title: opts.inAppTitle,
      body: opts.inAppBody,
      action_url: opts.actionUrl || null,
      metadata: {
        event_key: "platform.broadcast",
        icon_type: opts.inAppIconType,
        source: "platform_admin",
      },
      allowed_channels: ["in_app"],
    }));

  if (outboxRows.length === 0) {
    return { sentCount: 0, failedCount: recipients.length, provider: "internal" };
  }

  // Batch insert (Supabase supports bulk insert)
  const { error } = await admin.from("notification_outbox" as never).insert(outboxRows as never);

  if (error) {
    throw new Error(`Failed to insert in-app notifications: ${error.message}`);
  }

  return {
    sentCount: outboxRows.length,
    failedCount: recipients.length - outboxRows.length,
    provider: "internal",
  };
}
