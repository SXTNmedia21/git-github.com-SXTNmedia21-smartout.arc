/**
 * POST /api/contracts/[id]/amend/[amendmentId]/decline — employee declines amendment.
 *
 * DB schema: status = "rejected" (not "declined"). rejected_at + rejection_reason columns.
 * ADR-0151: workspace_id resolved from JWT.
 * Telemetry: contract.amendment_declined (Wave 3 registry).
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@smartout/supabase/server";
import { createAdminClient } from "@smartout/supabase/admin";
import { emit, nonEmpty } from "@smartout/telemetry";

const DeclineBodySchema = z.object({
  reason: z.string().optional(),
});

export async function POST(
  request: Request,
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

  // Parse optional body.
  let declineReason: string | undefined;
  try {
    const body = await request.json();
    const parsed = DeclineBodySchema.safeParse(body);
    if (parsed.success) declineReason = parsed.data.reason;
  } catch {
    /* ignore — reason is optional */
  }

  const admin = createAdminClient();
  const now = new Date().toISOString();

  // Load and verify — use contract_id not parent_contract_id.
  const { data: amendment, error: amendErr } = await admin
    .from("contract_amendment")
    .select("id, contract_id, workspace_id, status")
    .eq("id", amendmentId)
    .eq("contract_id", contractId)
    .eq("workspace_id", callerProfile.workspace_id)
    .maybeSingle();

  if (amendErr || !amendment) {
    return NextResponse.json({ error: "Amendment ikke funnet." }, { status: 404 });
  }

  if (amendment.status === "rejected" || amendment.status === "accepted") {
    return NextResponse.json({ error: "Amendment er allerede behandlet." }, { status: 400 });
  }

  // Set status = 'rejected' (DB enum) — uses rejected_at + rejection_reason columns.
  const { error: updateErr } = await admin
    .from("contract_amendment")
    .update({
      status: "rejected",
      rejection_reason: declineReason ?? null,
      rejected_at: now,
      updated_at: now,
    })
    .eq("id", amendmentId)
    .eq("workspace_id", callerProfile.workspace_id);

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  // Telemetry: contract.amendment_declined.
  void emit({
    event: "contract.amendment_declined",
    workspace_id: nonEmpty(callerProfile.workspace_id, "workspace_id"),
    actor_id: nonEmpty(callerProfile.profile_id, "actor_id"),
    properties: {
      entity: { entity_type: "employment_contract" as const, entity_id: contractId },
      data: {
        amendment_id: amendmentId,
        contract_id: contractId,
        declined_by: "employee" as const,
        reason: declineReason,
      },
    },
  });

  return NextResponse.json({
    ok: true,
    amendment_id: amendmentId,
    status: "rejected",
    message: "Endring avvist — din nåværende kontrakt forblir aktiv.",
  });
}
