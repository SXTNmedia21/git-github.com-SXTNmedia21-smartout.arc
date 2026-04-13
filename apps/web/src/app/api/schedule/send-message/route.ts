// ============================================
// schedule/send-message API route
// Sends schedule day messages with real SMS delivery via Twilio.
// Why: schedule compose dialog must trigger production-ready SMS sends.
// Connected to: send-message-dialog.tsx and @smartout/notifications SMS service.
// ============================================

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@smartout/supabase/server";
import { createAdminClient } from "@smartout/supabase/admin";
import { sendSmsBatch, sendEmailBatch } from "@smartout/notifications";
import { canSendScheduleMessage } from "./guards";

const SendScheduleMessageSchema = z.object({
  workspaceId: z.string().uuid(),
  dateId: z.string().min(10).max(10),
  message: z.string().min(1).max(1000),
  channels: z.array(z.enum(["sms", "push", "email"])).min(1),
  audience: z.enum(["all", "leaders", "specific"]),
  selectedEmployeeIds: z.array(z.string().uuid()).optional(),
});

/**
 * Resolves profile recipients for the given audience selection.
 * Why: centralizes recipient filtering to keep handler readable and testable.
 */
async function resolveRecipients(params: {
  admin: ReturnType<typeof createAdminClient>;
  workspaceId: string;
  audience: "all" | "leaders" | "specific";
  selectedEmployeeIds?: string[];
}) {
  const { admin, workspaceId, audience, selectedEmployeeIds } = params;
  let query = admin
    .from("profile")
    .select("profile_id, user_id, display_name, role")
    .eq("workspace_id", workspaceId)
    .in("status", ["active", "trainee"]);

  if (audience === "leaders") {
    query = query.in("role", ["manager", "admin", "owner"]);
  }
  if (audience === "specific") {
    if (!selectedEmployeeIds || selectedEmployeeIds.length === 0) return [];
    query = query.in("profile_id", selectedEmployeeIds);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

/**
 * Handles schedule compose submissions and dispatches SMS when selected.
 * Returns send statistics that the UI can present to operators.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rawBody = await request.json().catch(() => null);
  const parsed = SendScheduleMessageSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { workspaceId, message, channels, audience, selectedEmployeeIds } = parsed.data;

  // Only SMS is currently supported — guard before auth/DB work
  const unsupportedChannels = channels.filter((c) => c !== "sms");
  if (unsupportedChannels.length > 0) {
    return NextResponse.json(
      {
        error: "Unsupported channel selection: this endpoint currently supports sms only.",
        unsupportedChannels,
      },
      { status: 400 },
    );
  }

  const { data: membership, error: membershipError } = await supabase
    .from("profile")
    .select("profile_id, role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (membershipError || !membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!canSendScheduleMessage(membership.role)) {
    return NextResponse.json(
      {
        error:
          "Forbidden: insufficient authority. Only manager, admin, or owner can send schedule messages.",
      },
      { status: 403 },
    );
  }

  const admin = createAdminClient();
  const recipients = await resolveRecipients({
    admin,
    workspaceId,
    audience,
    selectedEmployeeIds,
  });

  if (recipients.length === 0) {
    return NextResponse.json(
      { error: "No recipients found for selected audience" },
      { status: 400 },
    );
  }

  const userIds = recipients.map((recipient) => recipient.user_id).filter(Boolean);
  const { data: identities, error: identityError } = await admin
    .from("user_identity")
    .select("user_id, phone, email")
    .in("user_id", userIds);

  if (identityError) {
    return NextResponse.json(
      { error: "Could not resolve recipient contact info" },
      { status: 500 },
    );
  }

  const phoneByUserId = new Map<string, string>();
  const emailByUserId = new Map<string, string>();
  for (const identity of identities ?? []) {
    if (identity.phone) phoneByUserId.set(identity.user_id, identity.phone);
    if (identity.email) emailByUserId.set(identity.user_id, identity.email);
  }

  // ── SMS ────────────────────────────────────────────────
  const smsResult = { sent: 0, failed: 0, skippedNoPhone: 0 };

  if (channels.includes("sms")) {
    const smsRecipients = recipients
      .map((r) => {
        const phone = phoneByUserId.get(r.user_id);
        return phone ? { phone, body: message } : null;
      })
      .filter((item): item is { phone: string; body: string } => item !== null);

    smsResult.skippedNoPhone = recipients.length - smsRecipients.length;

    if (smsRecipients.length > 0) {
      const result = await sendSmsBatch(smsRecipients);
      smsResult.sent = result.sent;
      smsResult.failed = result.failed;
    }
  }

  // ── Email ──────────────────────────────────────────────
  const emailResult = { sent: 0, failed: 0, skippedNoEmail: 0 };

  if (channels.includes("email")) {
    const emailRecipients = recipients
      .map((r) => {
        const email = emailByUserId.get(r.user_id);
        return email
          ? {
              email,
              subject: "Melding fra leder",
              html: `<p>${message.replace(/\n/g, "<br>")}</p>`,
            }
          : null;
      })
      .filter((item): item is { email: string; subject: string; html: string } => item !== null);

    emailResult.skippedNoEmail = recipients.length - emailRecipients.length;

    if (emailRecipients.length > 0) {
      const result = await sendEmailBatch(emailRecipients, "varsler@smartout.ai");
      emailResult.sent = result.sent;
      emailResult.failed = result.failed;
    }
  }

  return NextResponse.json({
    ok: true,
    recipients: recipients.length,
    channels,
    sms: smsResult,
    email: emailResult,
  });
}
