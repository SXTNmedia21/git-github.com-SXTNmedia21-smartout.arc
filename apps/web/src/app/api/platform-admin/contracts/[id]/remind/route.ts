import { NextResponse } from "next/server";
import { createAdminClient } from "@smartout/supabase/admin";
import type { Json } from "@smartout/supabase";
import { getSuperAdminId, logPlatformAction } from "@/lib/platform-admin";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const adminId = await getSuperAdminId();
  if (!adminId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const admin = createAdminClient();

  // Verify contract exists and is in a remindable state
  const { data: contract, error } = await admin
    .from("contract")
    .select("contract_id, status, workspace_id, recipient_email")
    .eq("contract_id", id)
    .single();

  if (error || !contract) {
    return NextResponse.json({ error: "Contract not found" }, { status: 404 });
  }

  if (!["sent", "viewed"].includes(contract.status)) {
    return NextResponse.json(
      { error: `Cannot remind for contract in status: ${contract.status}` },
      { status: 400 },
    );
  }

  // Log a manual reminder request (no email delivery yet — placeholder for future integration)
  await admin.from("contract_event").insert({
    contract_id: id,
    workspace_id: contract.workspace_id,
    event_type: "reminder_requested",
    actor_type: "user",
    actor_id: adminId,
    details: { type: "manual_reminder", recipient: contract.recipient_email } as unknown as Json,
  });

  await logPlatformAction(adminId, "request_contract_reminder", "contract", id, {
    recipient_email: contract.recipient_email,
  });

  return NextResponse.json({ data: { contract_id: id, reminder: "requested" } });
}
