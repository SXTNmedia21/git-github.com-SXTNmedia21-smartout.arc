import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createAdminClient } from "@smartout/supabase/admin";
import { getSuperAdminId } from "@/lib/platform-admin";
import { emit } from "@smartout/telemetry";
import { randomUUID } from "crypto";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const adminId = await getSuperAdminId();
  if (!adminId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("contract_attachment")
    .select("attachment_id, filename, mime_type, file_size, display_order, created_at")
    .eq("contract_id", id)
    .order("display_order")
    .order("created_at");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const adminId = await getSuperAdminId();
  if (!adminId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id: contractId } = await params;
  const admin = createAdminClient();

  // Verify contract exists and is draft
  const { data: contract } = await admin
    .from("contract")
    .select("contract_id, status, workspace_id")
    .eq("contract_id", contractId)
    .single();

  if (!contract) return NextResponse.json({ error: "Contract not found" }, { status: 404 });
  if (contract.status !== "draft") {
    return NextResponse.json(
      { error: "Can only add attachments to draft contracts" },
      { status: 400 },
    );
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

  const displayOrder = parseInt(formData.get("display_order") as string, 10) || 0;
  const attachmentId = randomUUID();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const storagePath = `contracts/${contractId}/${attachmentId}_${safeName}`;

  // Upload to Storage
  const buffer = Buffer.from(await file.arrayBuffer());
  const { error: uploadError } = await admin.storage
    .from("contract-attachments")
    .upload(storagePath, buffer, { contentType: file.type });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  // Insert DB record
  const { data: attachment, error: insertError } = await admin
    .from("contract_attachment")
    .insert({
      attachment_id: attachmentId,
      contract_id: contractId,
      filename: file.name,
      mime_type: file.type,
      storage_path: storagePath,
      file_size: file.size,
      display_order: displayOrder,
      created_by: adminId,
    })
    .select()
    .single();

  if (insertError) {
    // Rollback storage upload on DB failure
    await admin.storage.from("contract-attachments").remove([storagePath]);
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  void emit({
    event: "contract attachment uploaded",
    workspace_id: contract.workspace_id ?? "",
    actor_id: adminId,
    properties: {
      entity: {
        entity_type: "contract_attachment",
        entity_id: attachmentId,
        entity_label: file.name,
      },
      data: { contract_id: contractId, mime_type: file.type, file_size: file.size },
    },
  });

  return NextResponse.json({ data: attachment }, { status: 201 });
}
