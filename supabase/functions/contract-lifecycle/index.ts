import { createClient } from "jsr:@supabase/supabase-js@2";

Deno.serve(async (req) => {
  // Auth: require cron secret for scheduled invocations
  const authHeader = req.headers.get("authorization");
  const cronSecret = Deno.env.get("WATCHDOG_CRON_SECRET");
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
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
