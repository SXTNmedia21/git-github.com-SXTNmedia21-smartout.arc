/**
 * POST /api/contracts/[id]/amend/[amendmentId]/accept — employee accepts amendment.
 *
 * DB schema: contract_amendment.status enum = pending | pending_employee_signature | accepted | rejected | expired.
 * signed_by_employee_at column exists. No 'proposed' status — use 'accepted'.
 *
 * ADR-0151: workspace_id resolved from JWT.
 * Telemetry: contract.amendment_signed (Wave 3 registry).
 */

import { NextResponse } from "next/server";
import { createClient } from "@smartout/supabase/server";
import { createAdminClient } from "@smartout/supabase/admin";
import { emit, nonEmpty } from "@smartout/telemetry";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string; amendmentId: string }> },
) {
  const { id: contractId, amendmentId } = await params;

  // Auth (ADR-0151).
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: callerProfile } = await supabase
    .from("profile")
    .select("profile_id, workspace_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!callerProfile?.workspace_id) {
    return NextResponse.json({ error: "Profile not found" }, { status: 403 });
  }

  const admin = createAdminClient();
  const now = new Date().toISOString();

  // Load and verify amendment — use contract_id not parent_contract_id.
  const { data: amendment, error: amendErr } = await admin
    .from("contract_amendment")
    .select("id, contract_id, workspace_id, requires_employee_signature, status")
    .eq("id", amendmentId)
    .eq("contract_id", contractId)
    .eq("workspace_id", callerProfile.workspace_id)
    .maybeSingle();

  if (amendErr || !amendment) {
    return NextResponse.json({ error: "Amendment ikke funnet." }, { status: 404 });
  }

  if (amendment.status === "accepted") {
    return NextResponse.json({ error: "Amendment er allerede akseptert." }, { status: 400 });
  }

  // Update to accepted.
  const { error: updateErr } = await admin
    .from("contract_amendment")
    .update({
      status: "accepted",
      signed_by_employee_at: now,
      updated_at: now,
    })
    .eq("id", amendmentId)
    .eq("workspace_id", callerProfile.workspace_id);

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  // Telemetry: contract.amendment_signed.
  void emit({
    event: "contract.amendment_signed",
    workspace_id: nonEmpty(callerProfile.workspace_id, "workspace_id"),
    actor_id: nonEmpty(callerProfile.profile_id, "actor_id"),
    properties: {
      entity: { entity_type: "employment_contract" as const, entity_id: contractId },
      data: {
        amendment_id: amendmentId,
        contract_id: contractId,
        signed_by: "employee" as const,
      },
    },
  });

  return NextResponse.json({
    ok: true,
    amendment_id: amendmentId,
    status: "accepted",
    requires_docuseal_resigning: amendment.requires_employee_signature,
    message: amendment.requires_employee_signature
      ? "Endring godkjent — du vil motta en e-post for signering."
      : "Endring effektuert — kontrakt oppdatert.",
  });
}
