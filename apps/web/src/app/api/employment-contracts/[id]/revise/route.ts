/**
 * POST /api/employment-contracts/[id]/revise — Create a revision of an existing contract.
 *
 * ADR-0082: versioning starts at "sent". A new employment_contract row is created
 * copying the current terms but with parent_contract_id pointing to the original,
 * and status reset to "draft". The original contract is NOT modified.
 */

import { NextResponse } from "next/server";
import { createClient } from "@smartout/supabase/server";
import { emit, nonEmpty } from "@smartout/telemetry";
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
  const { data: existing, error: loadError } = await supabase
    .from("employment_contract")
    .select(
      `contract_id, status, workspace_id, profile_id,
       position_title, hourly_rate, monthly_salary,
       employment_percentage, employment_category, employment_form,
       start_date, end_date, agreed_weekly_hours,
       framework_snapshot, compliance_overrides`,
    )
    .eq("contract_id", id)
    .single();

  if (loadError || !existing) {
    return NextResponse.json({ error: "Contract not found" }, { status: 404 });
  }

  // Only sent, signed, or pending_data contracts can be revised
  const revisableStatuses = ["sent", "signed", "pending_data"];
  if (!revisableStatuses.includes(existing.status)) {
    return NextResponse.json(
      { error: `Cannot revise a contract with status "${existing.status}"` },
      { status: 400 },
    );
  }

  // ── Count existing revisions to determine revision number ─────────────
  const { count } = await supabase
    .from("employment_contract")
    .select("contract_id", { count: "exact", head: true })
    .eq("parent_contract_id", id);

  const revisionNumber = (count ?? 0) + 1;

  // ── Create the new revision row ───────────────────────────────────────
  const { data: revision, error: insertError } = await supabase
    .from("employment_contract")
    .insert({
      workspace_id: existing.workspace_id,
      profile_id: existing.profile_id,
      position_title: existing.position_title,
      hourly_rate: existing.hourly_rate,
      monthly_salary: existing.monthly_salary,
      employment_percentage: existing.employment_percentage ?? 100,
      employment_category: existing.employment_category,
      employment_form: existing.employment_form,
      start_date: existing.start_date,
      end_date: existing.end_date,
      agreed_weekly_hours: existing.agreed_weekly_hours,
      framework_snapshot: existing.framework_snapshot,
      compliance_overrides: existing.compliance_overrides,
      parent_contract_id: id,
      status: "draft",
      created_by: user.id,
    })
    .select("contract_id")
    .single();

  if (insertError || !revision) {
    return NextResponse.json(
      { error: `Failed to create revision: ${insertError?.message ?? "unknown"}` },
      { status: 500 },
    );
  }

  // ── Emit telemetry ────────────────────────────────────────────────────
  void emit({
    event: "contract revision created",
    workspace_id: nonEmpty(existing.workspace_id, "workspace_id"),
    actor_id: nonEmpty(actorProfile.profile_id, "actor_id"),
    properties: {
      entity: { entity_type: "employment_contract", entity_id: revision.contract_id },
      data: {
        parent_contract_id: id,
        revision_number: revisionNumber,
      },
    },
  });

  return NextResponse.json({
    revised: true,
    new_contract_id: revision.contract_id,
  });
}
