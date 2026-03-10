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
  RECIPIENT_HARD_CAP,
  RECIPIENT_SOFT_CAP,
  type AudienceFilter,
  type EmailTemplate,
  type SendGridTemplateData,
} from "@smartout/notifications";
import type { Json } from "@smartout/supabase";

const AudienceFilterSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("all_users") }),
  z.object({ type: z.literal("super_admins") }),
  z.object({ type: z.literal("workspace"), workspaceId: z.string().uuid() }),
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
  audience: AudienceFilterSchema,
  template: z.enum([
    "platform-announcement",
    "workspace-notification",
    "trial-reminder",
    "payment-reminder",
    "contract-reminder",
    "sendgrid-dynamic",
  ]),
  subject: z.string().min(1).max(200),
  message: z.string().max(10000).optional(),
  confirmed: z.boolean().optional(),
  idempotencyKey: z.string().optional(),
  sendgridTemplateId: z.string().optional(),
  templateData: TemplateDataSchema.optional(),
  multilingual: z.boolean().default(false),
});

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
    audience,
    template,
    subject,
    message,
    confirmed,
    idempotencyKey,
    sendgridTemplateId,
    templateData,
  } = parsed.data;
  const isDynamic = template === "sendgrid-dynamic" && sendgridTemplateId && templateData;
  const admin = createAdminClient();

  // Kill switch
  const enabled = await isOutboundEmailEnabled(admin);
  if (!enabled) {
    return NextResponse.json({ error: "Email sending is temporarily disabled" }, { status: 503 });
  }

  // Rate limit
  const classification = classifyEmail(template as EmailTemplate);
  const rateResult = await checkRateLimit(adminId, classification);
  if (!rateResult.allowed) {
    return NextResponse.json(
      { error: rateResult.reason ?? "Rate limit exceeded" },
      { status: 429 },
    );
  }

  // Idempotency check
  if (idempotencyKey) {
    const { data: existing } = await admin
      .from("platform_communication_log" as never)
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

  // Filter suppressed
  const suppressedEmails = await filterSuppressed(
    admin,
    recipients.map((r: { email: string }) => r.email),
  );
  const suppressedSet = new Set(suppressedEmails.map((e: string) => e.toLowerCase()));
  const activeRecipients = recipients.filter(
    (r: { email: string }) => !suppressedSet.has(r.email.toLowerCase()),
  );

  if (activeRecipients.length === 0) {
    return NextResponse.json({ error: "All recipients are suppressed" }, { status: 400 });
  }

  // Create communication log
  const { data: commLog, error: logError } = await admin
    .from("platform_communication_log" as never)
    .insert({
      super_admin_id: adminId,
      subject,
      message_body: message ?? "",
      template,
      classification,
      audience_filter: audience as unknown as Json,
      workspace_id: audience.type === "workspace" ? audience.workspaceId : null,
      idempotency_key: idempotencyKey ?? null,
      recipient_count: activeRecipients.length,
      status: "sending",
      sendgrid_template_id: sendgridTemplateId ?? null,
      template_data: templateData ? (templateData as unknown as Json) : null,
    } as never)
    .select("communication_id")
    .single();

  if (logError || !commLog) {
    return NextResponse.json({ error: "Failed to create communication log" }, { status: 500 });
  }

  const jobId = (commLog as { communication_id: string }).communication_id;

  // Create recipient entries (include locale for multilingual sending)
  const recipientRows = activeRecipients.map(
    (r: { userId: string; email: string; name: string; locale: string }) => ({
      communication_id: jobId,
      user_id: r.userId,
      email: r.email,
      name: r.name,
      status: "pending",
      locale: r.locale ?? "no",
    }),
  );

  await admin.from("platform_communication_recipient" as never).insert(recipientRows as never);

  // Send emails
  try {
    const result = await createEmailJob(admin, {
      template: template as EmailTemplate,
      variables: { subject, message: message ?? "", title: subject },
      audience: audience as AudienceFilter,
      adminId,
      ...(isDynamic
        ? {
            sendgridTemplateId,
            templateData: templateData as SendGridTemplateData,
          }
        : {}),
    });

    // Update communication log
    const finalStatus = result.failedCount > 0 && result.sentCount === 0 ? "failed" : "sent";
    await admin
      .from("platform_communication_log" as never)
      .update({
        status: finalStatus,
        sent_count: result.sentCount,
        failed_count: result.failedCount,
        updated_at: new Date().toISOString(),
      } as never)
      .eq("communication_id", jobId);

    // Update recipient statuses
    await admin
      .from("platform_communication_recipient" as never)
      .update({ status: "sent", sent_at: new Date().toISOString() } as never)
      .eq("communication_id", jobId)
      .eq("status", "pending");

    // Audit log
    await logPlatformAction(adminId, "send_communication", "communication", jobId, {
      template,
      classification,
      recipientCount: activeRecipients.length,
      sentCount: result.sentCount,
      failedCount: result.failedCount,
    });

    void emit({
      event: "communication sent",
      workspace_id: audience.type === "workspace" ? audience.workspaceId : "platform",
      actor_id: adminId,
      properties: {
        data: {
          communication_id: jobId,
          template,
          classification,
          recipient_count: activeRecipients.length,
          sent_count: result.sentCount,
          failed_count: result.failedCount,
        },
      },
    });

    return NextResponse.json({
      jobId,
      status: finalStatus,
      recipientCount: activeRecipients.length,
      sentCount: result.sentCount,
      failedCount: result.failedCount,
    });
  } catch (err) {
    await admin
      .from("platform_communication_log" as never)
      .update({ status: "failed", updated_at: new Date().toISOString() } as never)
      .eq("communication_id", jobId);

    void emit({
      event: "communication failed",
      workspace_id: audience.type === "workspace" ? audience.workspaceId : "platform",
      actor_id: adminId,
      properties: {
        data: {
          communication_id: jobId,
          template,
          error: err instanceof Error ? err.message : "Unknown error",
        },
      },
    });

    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Send failed" },
      { status: 500 },
    );
  }
}
