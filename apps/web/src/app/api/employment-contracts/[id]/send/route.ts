/**
 * POST /api/employment-contracts/[id]/send — Send a draft employment contract.
 *
 * Snapshots the active framework rules, checks whether the employee's PII is
 * complete, and transitions the contract to either "pending_data" (if PII is
 * missing) or "sent" (if all data is present).
 *
 * When data is missing the route also creates an engine_state for the
 * "contract_data_intake" process and schedules 3 delayed escalation triggers
 * (day 3, 7, 10).
 *
 * ADR-0076: composition as cascade derivation.
 * ADR-0077: PII handling — intake flow for missing data.
 */

import { NextResponse } from "next/server";
import { createClient } from "@smartout/supabase/server";
import { emit } from "@smartout/telemetry";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── Step 0: Load the contract first to get workspace_id for role check ─
  const { data: contractCheck } = await supabase
    .from("employment_contract")
    .select("workspace_id")
    .eq("contract_id", id)
    .single();

  if (!contractCheck) {
    return NextResponse.json({ error: "Contract not found" }, { status: 404 });
  }

  // ── Role gate: require admin or owner ─────────────────────────────────
  const { data: actorProfile } = await supabase
    .from("profile")
    .select("profile_id, role")
    .eq("user_id", user.id)
    .eq("workspace_id", contractCheck.workspace_id)
    .single();

  if (!actorProfile || !["admin", "owner"].includes(actorProfile.role)) {
    return NextResponse.json({ error: "Forbidden: admin or owner role required" }, { status: 403 });
  }

  // ── Step 1: Load the employment contract ──────────────────────────────
  const { data: contract, error: contractError } = await supabase
    .from("employment_contract")
    .select("contract_id, status, workspace_id, profile_id")
    .eq("contract_id", id)
    .single();

  if (contractError || !contract) {
    return NextResponse.json({ error: "Contract not found" }, { status: 404 });
  }

  if (contract.status !== "draft") {
    return NextResponse.json({ error: "Only draft contracts can be sent" }, { status: 400 });
  }

  const { workspace_id, profile_id } = contract;

  // ── Step 2: Snapshot framework rules ──────────────────────────────────
  const { data: binding } = await supabase
    .from("workspace_framework_binding")
    .select("framework_id, regulatory_framework(name, version)")
    .eq("workspace_id", workspace_id)
    .eq("is_active", true)
    .single();

  if (!binding) {
    return NextResponse.json(
      { error: "No active framework binding for workspace" },
      { status: 400 },
    );
  }

  const frameworkId = binding.framework_id;
  const frameworkInfo = binding.regulatory_framework as unknown as {
    name: string;
    version: string;
  } | null;

  const { data: rules } = await supabase
    .from("framework_rule")
    .select("rule_id, rule_type, description, severity, code, category")
    .eq("framework_id", frameworkId);

  const frameworkSnapshot = {
    framework_id: frameworkId,
    framework_name: frameworkInfo?.name ?? "Unknown",
    snapshot_date: new Date().toISOString(),
    rules: (rules ?? []).map((r) => ({
      rule_id: r.rule_id,
      rule_type: r.rule_type,
      description: r.description,
      enforcement_level: r.severity,
    })),
  };

  // ── Step 3: Check placeholder status (PII completeness) ───────────────
  const { data: profile } = await supabase
    .from("profile")
    .select("personal_number, bank_account, address_line_1, postal_code")
    .eq("profile_id", profile_id)
    .eq("workspace_id", workspace_id)
    .single();

  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  const missingGroups: string[] = [];
  if (!profile.personal_number) missingGroups.push("personal_number");
  if (!profile.bank_account) missingGroups.push("bank_account");
  if (!profile.address_line_1 || !profile.postal_code) missingGroups.push("address");

  const allDataPresent = missingGroups.length === 0;
  const newStatus = allDataPresent ? "sent" : "pending_data";

  // ── Step 4: Update the contract with snapshot + new status ────────────
  const { error: updateError } = await supabase
    .from("employment_contract")
    .update({
      status: newStatus as "sent" | "pending_data",
      framework_snapshot: frameworkSnapshot,
    })
    .eq("contract_id", id);

  if (updateError) {
    return NextResponse.json(
      { error: `Failed to update contract: ${updateError.message}` },
      { status: 500 },
    );
  }

  // ── Step 5: Create engine_state for the appropriate process ───────────
  const processName = allDataPresent ? "contract_signing" : "contract_data_intake";

  // Look up the engine_process by its TEXT primary key (id)
  const { data: process } = await supabase
    .from("engine_process")
    .select("id")
    .eq("id", processName)
    .single();

  if (process) {
    await supabase.from("engine_state").insert({
      process_id: process.id,
      entity_type: "employment_contract",
      entity_id: id,
      workspace_id,
      status: "running",
      context: { profile_id, missing_groups: missingGroups },
    });
  }

  // ── Step 6: Schedule delayed escalation triggers (pending_data only) ──
  if (!allDataPresent && process) {
    // Find the escalation trigger and event for this process
    const { data: trigger } = await supabase
      .from("engine_trigger")
      .select("id")
      .eq("process_id", process.id)
      .limit(1)
      .single();

    const { data: event } = await supabase
      .from("engine_event")
      .select("id")
      .eq("event_name", "contract intake escalated")
      .limit(1)
      .single();

    if (trigger && event) {
      const now = new Date();
      const delays = [3, 7, 10]; // days

      const rows = delays.map((days) => {
        const fireAt = new Date(now);
        fireAt.setDate(fireAt.getDate() + days);
        return {
          trigger_id: trigger.id,
          event_id: event.id,
          workspace_id,
          fire_at: fireAt.toISOString(),
          fired: false,
        };
      });

      await supabase.from("engine_delayed_trigger").insert(rows);
    }
  }

  // ── Step 7: Emit telemetry ────────────────────────────────────────────
  void emit({
    event: "contract composed",
    workspace_id,
    actor_id: actorProfile.profile_id,
    properties: {
      entity: { entity_type: "employment_contract", entity_id: id },
      data: {
        template_id: "",
        profile_id,
        framework_id: frameworkId,
        override_count: 0,
        blocker_count: missingGroups.length,
      },
    },
  });

  if (!allDataPresent) {
    void emit({
      event: "contract intake started",
      workspace_id,
      actor_id: actorProfile.profile_id,
      properties: {
        entity: { entity_type: "employment_contract", entity_id: id },
        data: { contract_id: id, missing_groups: missingGroups },
      },
    });
  } else {
    void emit({
      event: "contract sent",
      workspace_id,
      actor_id: actorProfile.profile_id,
      properties: {
        entity: { entity_type: "employment_contract", entity_id: id },
        data: { recipient_email: "", expires_at: "" },
      },
    });
  }

  return NextResponse.json({
    sent: true,
    status: newStatus,
    contract_id: id,
  });
}
