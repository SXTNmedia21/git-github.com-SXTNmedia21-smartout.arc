/**
 * POST /api/employment-contracts/[id]/regenerate — Re-derive terms from framework.
 *
 * Loads the draft contract, re-runs resolveComposition for the contract's profile,
 * and updates the contract with fresh framework_snapshot and suggested terms.
 * Only draft contracts can be regenerated.
 */

import { NextResponse } from "next/server";
import { createClient } from "@smartout/supabase/server";
import { emit, nonEmpty } from "@smartout/telemetry";
import { resolveComposition, type CompositionInput } from "@smartout/utils";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── Role gate: load contract workspace, then verify admin/owner ──────
  const { data: contractCheck } = await supabase
    .from("employment_contract")
    .select("workspace_id")
    .eq("contract_id", id)
    .single();

  if (!contractCheck) {
    return NextResponse.json({ error: "Contract not found" }, { status: 404 });
  }

  const { data: actorProfile } = await supabase
    .from("profile")
    .select("profile_id, role")
    .eq("user_id", user.id)
    .eq("workspace_id", contractCheck.workspace_id)
    .single();

  if (!actorProfile || !["admin", "owner"].includes(actorProfile.role)) {
    return NextResponse.json({ error: "Forbidden: admin or owner role required" }, { status: 403 });
  }

  // ── Load the existing contract ────────────────────────────────────────
  const { data: contract, error: loadError } = await supabase
    .from("employment_contract")
    .select(
      "contract_id, status, workspace_id, profile_id, framework_snapshot, employment_category, employment_percentage, position_title",
    )
    .eq("contract_id", id)
    .single();

  if (loadError || !contract) {
    return NextResponse.json({ error: "Contract not found" }, { status: 404 });
  }

  if (contract.status !== "draft") {
    return NextResponse.json({ error: "Only draft contracts can be regenerated" }, { status: 400 });
  }

  // ── Re-run composition derivation ─────────────────────────────────────
  const previousSnapshot = contract.framework_snapshot as {
    snapshot_date?: string;
    framework_id?: string;
  } | null;

  const compositionInput: CompositionInput = {
    employment_category: (contract.employment_category ??
      "fast") as CompositionInput["employment_category"],
    employment_percentage: contract.employment_percentage ?? 100,
    position_title: contract.position_title ?? "",
  };

  const proposal = await resolveComposition(
    supabase,
    contract.workspace_id,
    contract.profile_id,
    compositionInput,
  );

  // ── Update the contract with fresh terms + snapshot ───────────────────
  const { error: updateError } = await supabase
    .from("employment_contract")
    .update({
      framework_snapshot: proposal.framework_snapshot,
      position_title: proposal.employment_terms.position_title || undefined,
      hourly_rate: proposal.employment_terms.hourly_rate,
      monthly_salary: proposal.employment_terms.monthly_salary,
      employment_percentage: proposal.employment_terms.employment_percentage,
    })
    .eq("contract_id", id);

  if (updateError) {
    return NextResponse.json(
      { error: `Failed to update contract: ${updateError.message}` },
      { status: 500 },
    );
  }

  // ── Emit telemetry ────────────────────────────────────────────────────
  void emit({
    event: "contract regenerated",
    workspace_id: nonEmpty(contract.workspace_id, "workspace_id"),
    actor_id: nonEmpty(actorProfile.profile_id, "actor_id"),
    properties: {
      entity: { entity_type: "employment_contract", entity_id: id },
      data: {
        framework_id: proposal.framework_snapshot.framework_id,
        previous_snapshot_date: previousSnapshot?.snapshot_date ?? "",
      },
    },
  });

  return NextResponse.json({
    regenerated: true,
    contract_id: id,
    proposal,
  });
}
