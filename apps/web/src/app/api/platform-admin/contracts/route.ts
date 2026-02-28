import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@smartout/supabase/admin";
import type { Json } from "@smartout/supabase";
import { getSuperAdminId, logPlatformAction } from "@/lib/platform-admin";

const CreateContractSchema = z.object({
  template_id: z.string().uuid(),
  company_id: z.string().uuid().optional(),
  recipient_name: z.string().min(1),
  recipient_email: z.string().email(),
  title: z.string().optional(),
  notes: z.string().optional(),
});

export async function GET(request: NextRequest) {
  const adminId = await getSuperAdminId();
  if (!adminId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const admin = createAdminClient();
  const type = request.nextUrl.searchParams.get("type");

  if (type === "templates") {
    const { data, error } = await admin
      .from("contract_template")
      .select("template_id, name, contract_type, description")
      .eq("is_active", true)
      .order("name");

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data });
  }

  if (type === "companies") {
    const { data, error } = await admin.from("company").select("company_id, name").order("name");

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data });
  }

  return NextResponse.json({ error: "Invalid type parameter" }, { status: 400 });
}

export async function POST(request: NextRequest) {
  const adminId = await getSuperAdminId();
  if (!adminId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = CreateContractSchema.safeParse(await request.json());
  if (!body.success) {
    return NextResponse.json({ error: body.error.flatten().fieldErrors }, { status: 400 });
  }

  const admin = createAdminClient();

  // Fetch the template
  const { data: template, error: templateError } = await admin
    .from("contract_template")
    .select("template_id, name, contract_type, content_html, placeholders")
    .eq("template_id", body.data.template_id)
    .single();

  if (templateError || !template) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }

  // Create the contract record
  const contractTitle = body.data.title || `${template.name} - ${body.data.recipient_name}`;
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

  const { data: contract, error: createError } = await admin
    .from("contract")
    .insert({
      template_id: body.data.template_id,
      company_id: body.data.company_id || null,
      title: contractTitle,
      contract_type: template.contract_type,
      status: "draft",
      recipient_name: body.data.recipient_name,
      recipient_email: body.data.recipient_email,
      resolved_html: template.content_html,
      expires_at: expiresAt,
      metadata: (body.data.notes ? { internal_notes: body.data.notes } : {}) as unknown as Json,
      created_by: adminId,
      created_at: now,
      updated_at: now,
    })
    .select("contract_id")
    .single();

  if (createError || !contract) {
    return NextResponse.json(
      { error: createError?.message || "Failed to create contract" },
      { status: 500 },
    );
  }

  await logPlatformAction(adminId, "create_contract", "contract", contract.contract_id, {
    template_id: body.data.template_id,
    recipient_email: body.data.recipient_email,
  });

  return NextResponse.json({ data: contract }, { status: 201 });
}
