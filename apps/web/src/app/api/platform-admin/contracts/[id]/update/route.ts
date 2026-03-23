import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@smartout/supabase/admin";
import type { Json } from "@smartout/supabase";
import { getSuperAdminId, logPlatformAction } from "@/lib/platform-admin";

const UpdateContractSchema = z.object({
  resolved_html: z.string().optional(),
  resolved_values: z.record(z.string()).optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const adminId = await getSuperAdminId();
  if (!adminId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = UpdateContractSchema.safeParse(await request.json());
  if (!body.success) {
    return NextResponse.json({ error: body.error.flatten().fieldErrors }, { status: 400 });
  }

  const admin = createAdminClient();

  // Only allow editing draft contracts
  const { data: contract } = await admin
    .from("contract")
    .select("contract_id, status")
    .eq("contract_id", id)
    .single();

  if (!contract) {
    return NextResponse.json({ error: "Contract not found" }, { status: 404 });
  }

  if (contract.status !== "draft") {
    return NextResponse.json({ error: "Can only edit draft contracts" }, { status: 400 });
  }

  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (body.data.resolved_html !== undefined) {
    updates.resolved_html = body.data.resolved_html;
  }
  if (body.data.resolved_values !== undefined) {
    updates.resolved_values = body.data.resolved_values as unknown as Json;
  }

  const { error } = await admin.from("contract").update(updates).eq("contract_id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await logPlatformAction(adminId, "update_contract", "contract", id, {
    fields_updated: Object.keys(updates).filter((k) => k !== "updated_at"),
  });

  return NextResponse.json({ success: true });
}
