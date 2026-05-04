import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createAdminClient } from "@smartout/supabase/admin";
import { getSuperAdminId } from "@/lib/platform-admin";
import { emit, nonEmpty } from "@smartout/telemetry";
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; attachmentId: string }> },
) {
  const adminId = await getSuperAdminId();
  if (!adminId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id: contractId, attachmentId } = await params;
  const admin = createAdminClient();

  // Verify contract is draft
  const { data: contract } = await admin
    .from("contract")
    .select("contract_id, status, workspace_id")
    .eq("contract_id", contractId)
    .single();

  if (!contract) return NextResponse.json({ error: "Contract not found" }, { status: 404 });
  if (contract.status !== "draft") {
    return NextResponse.json(
      { error: "Can only delete attachments from draft contracts" },
      { status: 400 },
    );
  }

  // Fetch attachment to get storage path
  const { data: attachment } = await admin
    .from("contract_attachment")
    .select("attachment_id, filename, storage_path")
    .eq("attachment_id", attachmentId)
    .eq("contract_id", contractId)
    .single();

  if (!attachment) return NextResponse.json({ error: "Attachment not found" }, { status: 404 });

  // Delete from Storage + DB
  await admin.storage.from("contract-attachments").remove([attachment.storage_path]);

  const { error: deleteError } = await admin
    .from("contract_attachment")
    .delete()
    .eq("attachment_id", attachmentId);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  void emit({
    event: "contract attachment deleted",
    workspace_id: nonEmpty(contract.workspace_id, "workspace_id"),
    actor_id: nonEmpty(adminId, "actor_id"),
    properties: {
      entity: {
        entity_type: "contract_attachment",
        entity_id: attachmentId,
        entity_label: attachment.filename,
      },
      data: { contract_id: contractId },
    },
  });

  return NextResponse.json({ success: true });
}
