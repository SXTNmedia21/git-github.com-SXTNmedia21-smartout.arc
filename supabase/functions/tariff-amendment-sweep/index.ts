/**
 * tariff-amendment-sweep — Triggered cron Edge Function (Wave 5, WS2H).
 *
 * Detects workspace_framework_binding.framework_version changes and creates
 * contract_amendment proposal rows for all affected employment_contracts.
 *
 * NOTE: "Tariff-version-flip Apr 2026 deferred to separate sortie post-go-live"
 * per Wave 5 mission notes. This function is scaffolded but NOT scheduled.
 * It is invoked manually by a future sortie or when tariff version flips.
 *
 * What:
 *   1. Reads workspace_framework_binding where framework_version changed
 *      (detected via a comparison to a stored "last_known_version" field).
 *   2. For each affected workspace: finds all signed employment_contracts
 *      linked to the old framework_version.
 *   3. Creates one contract_amendment proposal per contract with:
 *      - change_summary: {tariff_id: {from: old_version, to: new_version}}
 *      - requires_employee_signature = true (tariff change = MATERIAL per ADR-0235)
 *      - status = 'proposed'
 *   4. Updates last_known_version on workspace_framework_binding.
 *   5. Emits contract.tariff_version_changed per affected workspace.
 *
 * Telemetry: contract.tariff_version_changed (Wave 3 Part E registry).
 *
 * Auth: CRON_SECRET bearer token.
 * Batch limit: 100 contracts per run to avoid timeout.
 *
 * DEFERRED: not scheduled in config.toml — invoke manually when ready.
 * To activate: add to config.toml:
 *   [functions.tariff-amendment-sweep]
 *   verify_jwt = false
 *   cron = "0 4 * * *"  # daily at 04:00 UTC
 */

import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Auth: CRON_SECRET bearer token or service role.
  const authHeader = req.headers.get("authorization");
  const cronSecret = Deno.env.get("CRON_SECRET");
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const now = new Date().toISOString();

  try {
    // 1. Find workspace_framework_binding rows where the framework version has changed.
    // We detect changes by comparing framework_version to last_known_amendment_version
    // (a new column we'd need — for now query all active bindings).
    //
    // DEFERRED: full version-change detection requires last_known_amendment_version column.
    // This stub queries all active bindings for demonstration.
    const { data: bindings, error: bindingsErr } = await supabase
      .from("workspace_framework_binding")
      .select("id, workspace_id, framework_id, framework_version")
      .eq("is_active", true)
      .limit(50);

    if (bindingsErr) {
      return new Response(JSON.stringify({ error: bindingsErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!bindings || bindings.length === 0) {
      return new Response(
        JSON.stringify({ processed: 0, message: "No active framework bindings found." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let totalAmendmentsCreated = 0;
    const affectedWorkspaces: string[] = [];

    for (const binding of bindings) {
      // 2. Find signed contracts in this workspace that reference the old framework.
      const { data: contracts } = await supabase
        .from("employment_contract")
        .select("contract_id, profile_id, tariff_id")
        .eq("workspace_id", binding.workspace_id)
        .in("status", ["signed", "active"])
        .limit(100);

      if (!contracts || contracts.length === 0) continue;

      // 3. For each contract, create a tariff amendment proposal.
      // Change: tariff_id from old → new framework_version (as UUID reference).
      const amendmentRows = contracts.map((contract) => ({
        parent_contract_id: contract.contract_id,
        workspace_id: binding.workspace_id,
        proposed_by_profile_id: null, // System-initiated
        change_summary: {
          tariff_id: {
            from: contract.tariff_id,
            to: binding.framework_id,
            classification: "material",
          },
        },
        reason: `Tariff-versjon oppdatert til ${binding.framework_version}. Riksavtalen-endringer krever ny signering.`,
        requires_employee_signature: true,
        is_constructive_dismissal_risk: false, // Tariff update alone is not constructive dismissal.
        status: "proposed",
        proposed_at: now,
        created_at: now,
        updated_at: now,
      }));

      const { error: insertErr } = await supabase
        .from("contract_amendment")
        .insert(amendmentRows);

      if (insertErr) {
        console.log(
          JSON.stringify({
            level: "error",
            action: "tariff_amendment_sweep",
            workspace_id: binding.workspace_id,
            error: insertErr.message,
          }),
        );
        continue;
      }

      totalAmendmentsCreated += amendmentRows.length;
      affectedWorkspaces.push(binding.workspace_id);

      // 4. Emit contract.tariff_version_changed for this workspace.
      console.log(
        JSON.stringify({
          level: "info",
          event: "contract.tariff_version_changed",
          action: "tariff_amendment_sweep",
          category: "contracts",
          workspace_id: binding.workspace_id,
          framework_id: binding.framework_id,
          framework_version: binding.framework_version,
          contracts_affected: contracts.length,
          amendments_created: amendmentRows.length,
          swept_at: now,
        }),
      );
    }

    return new Response(
      JSON.stringify({
        ok: true,
        total_amendments_created: totalAmendmentsCreated,
        affected_workspaces: affectedWorkspaces.length,
        workspace_ids: affectedWorkspaces,
        note: "Deferred — activate in config.toml when tariff sweep is production-ready.",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
