import { createClient } from "jsr:@supabase/supabase-js@2";

Deno.serve(async (req) => {
  // Auth: require cron secret for scheduled invocations
  const authHeader = req.headers.get("authorization");
  const cronSecret = Deno.env.get("WATCHDOG_CRON_SECRET");
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const now = new Date().toISOString();
    const results: Record<string, number> = {};

    // 1. Trial expirations -> suspended
    const { data: expiredTrials } = await supabase
      .from("workspace")
      .select("workspace_id")
      .eq("contract_status", "pending_contract")
      .lt("trial_ends_at", now)
      .is("override_access", false);

    if (expiredTrials?.length) {
      await supabase
        .from("workspace")
        .update({
          contract_status: "suspended",
          suspended_at: now,
          grace_period_ends: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
          updated_at: now,
        })
        .in(
          "workspace_id",
          expiredTrials.map((w: { workspace_id: string }) => w.workspace_id),
        );
      results.trials_expired = expiredTrials.length;
    }

    // 2. Grace period expirations -> deactivated
    const { data: expiredGrace } = await supabase
      .from("workspace")
      .select("workspace_id")
      .eq("contract_status", "suspended")
      .lt("grace_period_ends", now)
      .is("override_access", false);

    if (expiredGrace?.length) {
      await supabase
        .from("workspace")
        .update({
          contract_status: "deactivated",
          deactivated_at: now,
          updated_at: now,
        })
        .in(
          "workspace_id",
          expiredGrace.map((w: { workspace_id: string }) => w.workspace_id),
        );
      results.grace_expired = expiredGrace.length;
    }

    // 3. Contract signing deadline expirations
    const { data: expiredContracts } = await supabase
      .from("contract")
      .select("contract_id")
      .in("status", ["sent", "viewed"])
      .lt("expires_at", now);

    if (expiredContracts?.length) {
      const ids = expiredContracts.map((c: { contract_id: string }) => c.contract_id);
      await supabase
        .from("contract")
        .update({ status: "expired", updated_at: now })
        .in("contract_id", ids);

      // Cancel their reminders
      await supabase
        .from("contract_reminder")
        .update({ status: "skipped", skip_reason: "contract_expired" })
        .in("contract_id", ids)
        .eq("status", "scheduled");

      results.contracts_expired = expiredContracts.length;
    }

    // 4. Reminder drain — process scheduled reminders that are due
    const { data: dueReminders } = await supabase
      .from("contract_reminder")
      .select("id, contract_id, workspace_id, template_key, metadata")
      .eq("status", "scheduled")
      .lte("scheduled_at", now);

    let remindersSent = 0;
    if (dueReminders?.length) {
      for (const reminder of dueReminders) {
        // Check that the contract is still in 'sent' status (not yet signed/declined/expired)
        const { data: contract } = await supabase
          .from("contract")
          .select("contract_id, status, workspace_id, recipient_name, recipient_email, created_by")
          .eq("contract_id", reminder.contract_id)
          .single();

        if (!contract || !["sent", "viewed"].includes(contract.status)) {
          // Contract no longer needs a reminder — skip
          await supabase
            .from("contract_reminder")
            .update({ status: "skipped", skip_reason: `contract_${contract?.status ?? "not_found"}` })
            .eq("id", reminder.id);
          continue;
        }

        // Resolve employee profile for the notification
        const wsId = reminder.workspace_id ?? contract.workspace_id;
        let recipientId: string | null = null;

        if (contract.recipient_email && wsId) {
          const { data: profile } = await supabase
            .from("user_identity")
            .select("id")
            .eq("email", contract.recipient_email)
            .single();

          if (profile) {
            const { data: prof } = await supabase
              .from("profile")
              .select("profile_id")
              .eq("user_id", profile.id)
              .eq("workspace_id", wsId)
              .single();
            recipientId = prof?.profile_id ?? null;
          }
        }

        if (recipientId && wsId) {
          // Insert notification_outbox row for the reminder
          await supabase.from("notification_outbox").insert({
            workspace_id: wsId,
            recipient_id: recipientId,
            mode: "work",
            priority: 1,
            title: "Påminnelse: Signer kontrakt",
            body: "Du har en kontrakt som venter på signering",
            action_url: "/dashboard/people/contracts",
            metadata: {
              event_key: "contract.reminder_due",
              icon_type: "contract",
              contract_id: reminder.contract_id,
              employee_name: contract.recipient_name ?? "Ansatt",
              template_key: reminder.template_key,
            },
            allowed_channels: ["email", "push"],
            status: "pending",
            scheduled_for: now,
          });
          remindersSent++;
        }

        // Mark reminder as sent
        await supabase
          .from("contract_reminder")
          .update({ status: "sent", sent_at: now })
          .eq("id", reminder.id);
      }
      results.reminders_sent = remindersSent;
    }

    return new Response(
      JSON.stringify({
        success: true,
        processed_at: now,
        results,
      }),
      { headers: { "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("[contract-lifecycle] Unhandled error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
