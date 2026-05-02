/**
 * guardian-notify — Signal → notification bridge.
 *
 * Runs every 30 minutes. Finds critical active signals and notifies workspace admins.
 * Falls back to logging if SendGrid is not configured.
 */

import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AdminProfile {
  profile_id: string;
  full_name: string | null;
  user_identity: { email: string | null } | null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Auth: cron secret bearer token
  const authHeader = req.headers.get("authorization");
  const cronSecret = Deno.env.get("WATCHDOG_CRON_SECRET");
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const sendgridKey = Deno.env.get("SENDGRID_API_KEY");
  const senderEmail = Deno.env.get("SENDGRID_SENDER_EMAIL") ?? "noreply@smartout.ai";

  // 1. Find critical active signals
  const { data: criticalSignals, error: signalErr } = await supabase
    .from("guardian_signal")
    .select("*")
    .eq("severity", "critical")
    .eq("status", "active")
    .order("created_at", { ascending: true });

  if (signalErr) {
    return new Response(JSON.stringify({ status: "error", error: signalErr.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!criticalSignals || criticalSignals.length === 0) {
    return new Response(
      JSON.stringify({ status: "ok", message: "No critical signals to notify", notified: 0 }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  // Group signals by workspace
  const byWorkspace = new Map<string, typeof criticalSignals>();
  for (const signal of criticalSignals) {
    const list = byWorkspace.get(signal.workspace_id) ?? [];
    list.push(signal);
    byWorkspace.set(signal.workspace_id, list);
  }

  let notified = 0;
  let emailsSent = 0;
  const errors: string[] = [];

  for (const [workspaceId, signals] of byWorkspace) {
    // 2. Find admin/owner profiles for this workspace
    const { data: admins, error: adminErr } = (await supabase
      .from("profile")
      .select("profile_id, full_name, user_identity(email)")
      .eq("workspace_id", workspaceId)
      .in("role", ["admin", "owner"])
      .eq("status", "active")) as { data: AdminProfile[] | null; error: typeof adminErr };

    if (adminErr || !admins || admins.length === 0) {
      errors.push(`workspace ${workspaceId.slice(0, 8)}: no admins found`);
      continue;
    }

    // 3. Send notifications
    if (sendgridKey) {
      // SendGrid email notification
      const adminEmails = admins
        .map((a) => {
          const identity = a.user_identity as unknown as { email: string | null } | null;
          return identity?.email;
        })
        .filter((e): e is string => !!e);

      if (adminEmails.length > 0) {
        const signalSummary = signals
          .map(
            (s) => `- [${s.severity.toUpperCase()}] ${s.title}: ${s.description ?? "No details"}`,
          )
          .join("\n");

        try {
          const sgResponse = await fetch("https://api.sendgrid.com/v3/mail/send", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${sendgridKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              personalizations: [{ to: adminEmails.map((email) => ({ email })) }],
              from: { email: senderEmail, name: "Smartout Guardian" },
              subject: `[Guardian] ${signals.length} critical signal(s) in your workspace`,
              content: [
                {
                  type: "text/plain",
                  value: `Guardian has detected ${signals.length} critical signal(s):\n\n${signalSummary}\n\nLog in to your dashboard to review and take action.`,
                },
              ],
            }),
          });

          if (sgResponse.ok) {
            emailsSent += adminEmails.length;
          } else {
            const errText = await sgResponse.text();
            errors.push(`sendgrid: ${sgResponse.status} — ${errText.slice(0, 200)}`);
          }
        } catch (e) {
          errors.push(`sendgrid: ${String(e)}`);
        }
      }
    } else {
      // No SendGrid — log only
      console.log(
        `[guardian-notify] ${signals.length} critical signal(s) in workspace ${workspaceId.slice(0, 8)}, ` +
          `admins: ${admins.map((a) => a.full_name ?? a.profile_id.slice(0, 8)).join(", ")}`,
      );
    }

    // 4. Mark signals as acknowledged (auto-notified)
    const signalIds = signals.map((s) => s.id);
    const { error: updateErr } = await supabase
      .from("guardian_signal")
      .update({
        status: "acknowledged",
        acknowledged_at: new Date().toISOString(),
        data: { auto_notified: true, notified_at: new Date().toISOString() },
      })
      .in("id", signalIds);

    if (updateErr) {
      errors.push(`update signals: ${updateErr.message}`);
    } else {
      notified += signals.length;
    }

    // 5. Log the notification in guardian_log
    const logEntries = signals.map((s) => ({
      workspace_id: workspaceId,
      session_id: s.entity_id ?? "00000000-0000-0000-0000-000000000000",
      event_type: "guardian.notify",
      actor: "guardian" as const,
      summary: `Auto-notified admins about critical signal: ${s.title}`,
      data: {
        signal_id: s.id,
        signal_type: s.signal_type,
        admin_count: admins.length,
        email_sent: !!sendgridKey,
      },
    }));

    await supabase.from("guardian_log").insert(logEntries);
  }

  return new Response(
    JSON.stringify({
      status: errors.length > 0 ? "partial" : "ok",
      timestamp: new Date().toISOString(),
      critical_signals: criticalSignals.length,
      notified,
      emails_sent: emailsSent,
      sendgrid_configured: !!sendgridKey,
      errors: errors.length > 0 ? errors : undefined,
    }),
    {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
});
