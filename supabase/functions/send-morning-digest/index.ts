/**
 * send-morning-digest — Cron-triggered morning email digest.
 *
 * Runs daily at 07:00 Europe/Oslo. Finds all recipients with unread
 * notifications from the last 24 hours and sends a grouped HTML email
 * via SendGrid. Skips recipients with no email or no unread items.
 *
 * Auth: MORNING_DIGEST_SECRET bearer token (cron-only pattern).
 */

import { createClient } from "jsr:@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";

const SENDGRID_API_URL = "https://api.sendgrid.com/v3/mail/send";

// ── Types ──────────────────────────────────────────────────────────────────

type NotificationRow = {
  id: string;
  title: string;
  body: string | null;
  action_url: string | null;
  icon_type: string;
};

// ── Email builder ──────────────────────────────────────────────────────────

/** Groups notifications by icon_type and renders a simple HTML email. */
function buildDigestHtml(notifications: NotificationRow[]): string {
  // Group by icon_type
  const groups = new Map<string, NotificationRow[]>();
  for (const n of notifications) {
    const bucket = groups.get(n.icon_type) ?? [];
    bucket.push(n);
    groups.set(n.icon_type, bucket);
  }

  // Human-readable label per icon_type
  const labelFor = (type: string): string => {
    const labels: Record<string, string> = {
      shift: "Vakter",
      training: "Opplæring",
      protocol: "Protokoller",
      alert: "Varsler",
      message: "Meldinger",
      system: "System",
      info: "Informasjon",
    };
    return labels[type] ?? type.charAt(0).toUpperCase() + type.slice(1);
  };

  // Build one <section> per icon_type group
  const sections = [...groups.entries()]
    .map(([type, items]) => {
      const rows = items
        .map((n) => {
          const href = n.action_url ?? "https://app.smartout.ai/dashboard/notifications";
          const body = n.body ? `<span style="color:#888;font-size:13px;"> — ${n.body}</span>` : "";
          return `<li style="margin-bottom:8px;">
            <a href="${href}" style="color:#1a1a1a;text-decoration:none;font-size:14px;">${n.title}</a>${body}
          </li>`;
        })
        .join("\n");

      return `
        <h3 style="font-size:13px;font-weight:600;color:#555;text-transform:uppercase;letter-spacing:0.05em;margin:20px 0 8px;">
          ${labelFor(type)} (${items.length})
        </h3>
        <ul style="margin:0;padding-left:16px;">${rows}</ul>`;
    })
    .join("\n");

  return `<!DOCTYPE html>
<html>
<body style="background:#f9f9f7;margin:0;padding:32px 0;">
  <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;background:#fff;border-radius:8px;padding:32px;box-shadow:0 1px 4px rgba(0,0,0,0.06);">
    <h1 style="font-size:20px;margin:0 0 8px;">God morgen!</h1>
    <p style="color:#666;margin:0 0 24px;font-size:14px;">Her er det du har gått glipp av:</p>
    ${sections}
    <hr style="border:none;border-top:1px solid #eee;margin:28px 0;">
    <p style="margin:0;font-size:13px;color:#888;">
      <a href="https://app.smartout.ai/dashboard/notifications" style="color:#1a1a1a;">Se alle varsler →</a>
    </p>
  </div>
</body>
</html>`;
}

// ── SendGrid sender ────────────────────────────────────────────────────────

async function sendEmail(
  to: string,
  subject: string,
  html: string,
  apiKey: string,
  fromEmail: string,
): Promise<void> {
  const res = await fetch(SENDGRID_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: to }] }],
      from: { email: fromEmail, name: "Smartout" },
      subject,
      content: [{ type: "text/html", value: html }],
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`SendGrid ${res.status}: ${text}`);
  }
}

// ── Handler ────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  const cors = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: cors });
  }

  // Auth: cron secret bearer token
  const authHeader = req.headers.get("authorization");
  const cronSecret = Deno.env.get("MORNING_DIGEST_SECRET");
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const SENDGRID_API_KEY = Deno.env.get("SENDGRID_API_KEY") ?? "";
  const FROM_EMAIL = Deno.env.get("SENDGRID_FROM_EMAIL") ?? "hei@smartout.ai";
  const since = new Date(Date.now() - 86400000).toISOString();

  let sent = 0;
  let skipped = 0;
  const errors: string[] = [];

  // Step 1: Distinct recipient_ids with unread notifications in last 24h
  const { data: rawRecipients, error: recipientErr } = await supabase
    .from("notification")
    .select("recipient_id")
    .eq("is_read", false)
    .gte("created_at", since);

  if (recipientErr) {
    return new Response(JSON.stringify({ status: "error", error: recipientErr.message }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const recipientIds = [...new Set((rawRecipients ?? []).map((r) => r.recipient_id))];

  // Step 2: Process each recipient
  for (const profileId of recipientIds) {
    try {
      // Fetch unread notifications for this recipient
      const { data: notifications, error: notifErr } = await supabase
        .from("notification")
        .select("id, title, body, action_url, icon_type")
        .eq("recipient_id", profileId)
        .eq("is_read", false)
        .gte("created_at", since)
        .order("created_at", { ascending: false });

      if (notifErr || !notifications?.length) {
        skipped++;
        continue;
      }

      // Fetch recipient email via profile → user_identity join
      const { data: profile, error: profileErr } = await supabase
        .from("profile")
        .select("user_id, full_name, user_identity!inner(email)")
        .eq("profile_id", profileId)
        .single();

      if (profileErr || !profile) {
        skipped++;
        continue;
      }

      // user_identity is joined as an object
      const identity = profile.user_identity as unknown as { email: string };
      const recipientEmail = identity?.email;

      if (!recipientEmail) {
        skipped++;
        continue;
      }

      if (!SENDGRID_API_KEY) {
        // No API key configured — skip silently in local dev
        skipped++;
        continue;
      }

      const html = buildDigestHtml(notifications as NotificationRow[]);
      await sendEmail(
        recipientEmail,
        "Din morgenoversikt — Smartout",
        html,
        SENDGRID_API_KEY,
        FROM_EMAIL,
      );

      sent++;
    } catch (e) {
      errors.push(`recipient ${profileId}: ${String(e)}`);
      skipped++;
    }
  }

  return new Response(
    JSON.stringify({
      status: errors.length > 0 ? "partial" : "ok",
      sent,
      skipped,
      errors: errors.length > 0 ? errors : undefined,
    }),
    { status: 200, headers: { ...cors, "Content-Type": "application/json" } },
  );
});
