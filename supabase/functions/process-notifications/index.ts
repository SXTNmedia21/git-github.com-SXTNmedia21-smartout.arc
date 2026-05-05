/**
 * process-notifications — Outbox consumer Edge Function.
 *
 * Cron-triggered (no JWT). Fetches pending notification_outbox rows,
 * applies quiet hours + smart grouping, inserts in-app notifications,
 * and fans out to push/email/sms channels based on user preferences.
 */

import { createClient, type SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { sendSms } from "../_shared/twilio.ts";
import { getEventConfig, interpolateTemplate } from "../_shared/event-config.ts";

// ── Types ────────────────────────────────────────────────────────────

type OutboxRow = {
  id: number;
  workspace_id: string;
  recipient_id: string;
  mode: string;
  priority: number;
  title: string;
  body: string;
  action_url: string | null;
  metadata: Record<string, unknown>;
  allowed_channels: string[];
  status: string;
  error_log: string | null;
  scheduled_for: string;
  processed_at: string | null;
  created_at: string;
  retry_count: number;
};

type NotificationPref = {
  user_id: string;
  push_enabled: boolean;
  sms_enabled: boolean;
  email_enabled: boolean;
  browser_enabled: boolean;
  training_enabled: boolean;
  work_enabled: boolean;
  community_enabled: boolean;
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
  quiet_hours_timezone: string;
};

// ── Main handler ─────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const authHeader = req.headers.get("authorization");
  const cronSecret = Deno.env.get("PROCESS_NOTIFICATIONS_SECRET");
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const result = await handleRequest(supabase);
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("process-notifications fatal:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// ── Core logic ───────────────────────────────────────────────────────

async function handleRequest(supabase: SupabaseClient) {
  // Fetch pending batch
  const { data: rows, error } = await supabase.rpc("fetch_pending_outbox", {
    p_batch_size: 100,
  });

  if (error) throw new Error(`Fetch outbox failed: ${error.message}`);

  let delivered = 0;
  let failed = 0;
  let deferred = 0;
  let grouped = 0;

  for (const row of (rows ?? []) as OutboxRow[]) {
    try {
      const result = await processOutboxRow(supabase, row);
      if (result === "delivered") delivered++;
      else if (result === "deferred") deferred++;
      else if (result === "grouped") grouped++;
    } catch (err) {
      failed++;
      const msg = err instanceof Error ? err.message : "Unknown error";
      console.error(`Outbox row ${row.id} failed:`, msg);
      const newRetryCount = (row.retry_count ?? 0) + 1;
      await supabase
        .from("notification_outbox")
        .update({
          status: newRetryCount >= 3 ? "suppressed" : "failed",
          retry_count: newRetryCount,
          error_log: msg,
        })
        .eq("id", row.id);
    }
  }

  // Suppress stale rows older than 24 hours
  const staleThreshold = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count: suppressed } = await supabase
    .from("notification_outbox")
    .update({ status: "suppressed" }, { count: "exact" })
    .eq("status", "pending")
    .lt("created_at", staleThreshold);

  return { delivered, failed, deferred, grouped, suppressed: suppressed ?? 0 };
}

async function processOutboxRow(
  supabase: SupabaseClient,
  row: OutboxRow,
): Promise<"delivered" | "deferred" | "grouped"> {
  // Fetch recipient's preferences via profile -> user_id -> notification_preference
  const { data: profile } = await supabase
    .from("profile")
    .select("user_id, phone")
    .eq("profile_id", row.recipient_id)
    .single();

  let pref: NotificationPref | null = null;
  if (profile?.user_id) {
    const { data } = await supabase
      .from("notification_preference")
      .select("*")
      .eq("user_id", profile.user_id)
      .single();
    pref = data as NotificationPref | null;
  }

  // Check quiet hours — defer low-priority notifications
  if (pref && checkQuietHours(pref, new Date()) && row.priority < 2) {
    const tz = pref.quiet_hours_timezone || "Europe/Oslo";
    const tomorrow7am = getNext7am(tz);
    await supabase
      .from("notification_outbox")
      .update({ scheduled_for: tomorrow7am })
      .eq("id", row.id);
    return "deferred";
  }

  // Check mode preference — skip if user disabled this mode
  if (pref && !isModeEnabled(pref, row.mode)) {
    await supabase
      .from("notification_outbox")
      .update({ status: "delivered", processed_at: new Date().toISOString() })
      .eq("id", row.id);
    return "delivered";
  }

  // Smart grouping — merge into existing notification if same group_key within 3min
  const groupKey = row.metadata?.group_key as string | undefined;
  if (groupKey) {
    const existingId = await resolveGrouping(supabase, row, groupKey);
    if (existingId) {
      await supabase
        .from("notification_outbox")
        .update({ status: "delivered", processed_at: new Date().toISOString() })
        .eq("id", row.id);
      return "grouped";
    }
  }

  // Resolve title/body from event config registry if possible
  const eventKey = row.metadata?.event_key as string | undefined;
  const config = eventKey ? getEventConfig(eventKey) : null;

  let resolvedTitle = row.title;
  let resolvedBody = row.body;
  let resolvedActionUrl = row.action_url;
  let resolvedIconType = (row.metadata?.icon_type as string) ?? "info";

  if (config) {
    const meta = (row.metadata ?? {}) as Record<string, unknown>;
    resolvedTitle = interpolateTemplate(config.title_template, meta);
    resolvedBody = interpolateTemplate(config.body_template, meta);
    resolvedActionUrl = interpolateTemplate(config.action_url_template, meta);
    resolvedIconType = config.icon_type;
  } else if (eventKey) {
    console.warn(`[process-notifications] Unknown event_key: ${eventKey} — using raw title/body`);
  }

  // Insert in-app notification
  await supabase.from("notification").insert({
    workspace_id: row.workspace_id,
    recipient_id: row.recipient_id,
    group_key: groupKey ?? null,
    title: resolvedTitle,
    body: resolvedBody,
    action_url: resolvedActionUrl,
    icon_type: resolvedIconType,
    metadata: row.metadata,
  });

  // Fan out to external channels
  await deliverToChannels(
    supabase,
    row,
    pref,
    profile?.phone,
    resolvedTitle,
    resolvedBody,
    profile?.user_id ?? null,
  );

  // Mark as delivered
  await supabase
    .from("notification_outbox")
    .update({ status: "delivered", processed_at: new Date().toISOString() })
    .eq("id", row.id);

  return "delivered";
}

// ── Quiet hours check (pure function) ────────────────────────────────

function checkQuietHours(pref: NotificationPref, now: Date): boolean {
  if (!pref.quiet_hours_start || !pref.quiet_hours_end) return false;

  const tz = pref.quiet_hours_timezone || "Europe/Oslo";
  const localTime = now.toLocaleTimeString("en-GB", { timeZone: tz, hour12: false });
  const [h, m] = localTime.split(":").map(Number);
  const currentMinutes = h * 60 + m;

  const [sh, sm] = pref.quiet_hours_start.split(":").map(Number);
  const [eh, em] = pref.quiet_hours_end.split(":").map(Number);
  const startMin = sh * 60 + sm;
  const endMin = eh * 60 + em;

  // Handle overnight ranges (e.g. 22:00 - 07:00)
  if (startMin > endMin) {
    return currentMinutes >= startMin || currentMinutes < endMin;
  }
  return currentMinutes >= startMin && currentMinutes < endMin;
}

function getNext7am(tz: string): string {
  const now = new Date();
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  // Get tomorrow's date string in the target timezone
  const dateStr = tomorrow.toLocaleDateString("sv-SE", { timeZone: tz });

  // Get the UTC offset for the target timezone at 07:00 tomorrow
  // by comparing formatted time vs UTC time
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  // Create a reference point at 07:00 UTC on the target date
  const refUtc = new Date(`${dateStr}T07:00:00Z`);
  const parts = formatter.formatToParts(refUtc);
  const localHour = Number(parts.find((p) => p.type === "hour")?.value ?? "7");

  // The difference between local hour and 7 gives us the offset to apply
  // If local shows 8 when UTC is 7, timezone is UTC+1, so we need to subtract 1h
  const offsetHours = localHour - 7;
  const targetUtc = new Date(refUtc.getTime() - offsetHours * 60 * 60 * 1000);

  return targetUtc.toISOString();
}

// ── Smart grouping ───────────────────────────────────────────────────

async function resolveGrouping(
  supabase: SupabaseClient,
  row: OutboxRow,
  groupKey: string,
): Promise<string | null> {
  const threeMinAgo = new Date(Date.now() - 3 * 60 * 1000).toISOString();

  const { data: existing } = await supabase
    .from("notification")
    .select("id, metadata")
    .eq("recipient_id", row.recipient_id)
    .eq("group_key", groupKey)
    .eq("is_read", false)
    .gte("created_at", threeMinAgo)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (!existing) return null;

  // Increment count and update body on existing notification
  const meta = (existing.metadata as Record<string, unknown>) ?? {};
  const count = ((meta.count as number) ?? 1) + 1;

  const groupLabel =
    (row.metadata?.department_name as string) ?? (row.metadata?.channel_name as string) ?? "";
  const groupBody = groupLabel ? `${count} nye varsler i ${groupLabel}` : `${count} nye varsler`;

  await supabase
    .from("notification")
    .update({
      body: groupBody,
      metadata: { ...meta, count },
      updated_at: new Date().toISOString(),
    })
    .eq("id", existing.id);

  return existing.id;
}

// ── Channel fan-out ──────────────────────────────────────────────────

async function deliverToChannels(
  supabase: SupabaseClient,
  row: OutboxRow,
  pref: NotificationPref | null,
  phone: string | null,
  resolvedTitle: string,
  resolvedBody: string,
  profileUserId: string | null,
) {
  const channels = row.allowed_channels ?? [];

  // Push notification
  if (channels.includes("push") && (pref?.push_enabled ?? true)) {
    try {
      const pushUrl = Deno.env.get("SUPABASE_URL") + "/functions/v1/push-dispatch";
      const pushSecret = Deno.env.get("PUSH_DISPATCH_SECRET");
      await fetch(pushUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${pushSecret}`,
        },
        body: JSON.stringify({
          event: (row.metadata?.event_key as string) ?? "notification",
          profile_id: row.recipient_id,
          workspace_id: row.workspace_id,
          payload: { title: resolvedTitle, body: resolvedBody, data: {} },
        }),
      });
    } catch (err) {
      console.error("Push delivery failed:", err);
    }
  }

  // Email via SendGrid — resolve recipient email from user_identity
  if (channels.includes("email") && (pref?.email_enabled ?? true)) {
    const sgKey = Deno.env.get("SENDGRID_API_KEY");
    if (sgKey && profileUserId) {
      const { data: userRow } = await supabase
        .from("user_identity")
        .select("email")
        .eq("id", profileUserId)
        .single();

      if (userRow?.email) {
        try {
          const actionLine = row.action_url
            ? `\n\nSe mer: https://app.smartout.ai${row.action_url}`
            : "";
          await fetch("https://api.sendgrid.com/v3/mail/send", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${sgKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              personalizations: [{ to: [{ email: userRow.email }] }],
              from: { email: "varsler@smartout.ai", name: "Smartout" },
              subject: resolvedTitle,
              content: [
                {
                  type: "text/plain",
                  value: `${resolvedBody}${actionLine}`,
                },
              ],
            }),
          });
        } catch (err) {
          console.error("Email delivery failed:", err);
        }
      }
    }
  }

  // SMS — only for critical (priority 2) notifications
  if (channels.includes("sms") && (pref?.sms_enabled ?? true) && row.priority === 2) {
    if (phone) {
      const result = await sendSms(phone, `${resolvedTitle}\n${resolvedBody}`);
      if (!result.success) {
        console.error(`SMS failed for ${row.recipient_id}:`, result.error);
      }
    } else {
      console.warn(`SMS requested but no phone for recipient ${row.recipient_id}`);
    }
  }
}

// ── Helpers ──────────────────────────────────────────────────────────

function isModeEnabled(pref: NotificationPref, mode: string): boolean {
  switch (mode) {
    case "training":
      return pref.training_enabled;
    case "work":
      return pref.work_enabled;
    case "community":
      return pref.community_enabled;
    default:
      return true;
  }
}
