import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@smartout/supabase/admin";
import { getSuperAdminId, logPlatformAction } from "@/lib/platform-admin";

const UpdateSchema = z.object({
  workspaceId: z.string().uuid(),
  companyId: z.string().uuid().optional(),
  workspace: z
    .object({
      name: z.string().min(1).max(200).optional(),
      description: z.string().max(2000).optional(),
      city: z.string().max(100).optional(),
      address_line_1: z.string().max(200).optional(),
      address_line_2: z.string().max(200).optional(),
      postal_code: z.string().max(20).optional(),
      phone: z.string().max(50).optional(),
      email: z.string().max(200).optional(),
      slogan: z.string().max(200).optional(),
      short_description: z.string().max(280).optional(),
      brand_color: z.string().max(7).optional(),
      communication_tone: z.string().max(20).optional(),
      timezone: z.string().max(50).optional(),
    })
    .optional(),
  company: z
    .object({
      name: z.string().max(200).optional(),
      legal_name: z.string().max(200).optional(),
      org_number: z.string().max(50).optional(),
      city: z.string().max(100).optional(),
      industry: z.string().max(100).optional(),
      email: z.string().max(200).optional(),
      phone: z.string().max(50).optional(),
      website: z.string().max(500).optional(),
      billing_email: z.string().max(200).optional(),
      address_line_1: z.string().max(200).optional(),
      postal_code: z.string().max(20).optional(),
      daglig_leder: z.string().max(200).optional(),
    })
    .optional(),
});

export async function PATCH(req: NextRequest) {
  const adminId = await getSuperAdminId();
  if (!adminId) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const body = await req.json();
  const parsed = UpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { workspaceId, companyId, workspace, company } = parsed.data;
  const admin = createAdminClient();

  if (workspace) {
    const updates: Record<string, string> = {};
    for (const [key, val] of Object.entries(workspace)) {
      if (val !== undefined && val !== "") updates[key] = val;
    }
    if (Object.keys(updates).length > 0) {
      const { error } = await admin
        .from("workspace")
        .update(updates)
        .eq("workspace_id", workspaceId);
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }
  }

  if (companyId && company) {
    const updates: Record<string, string> = {};
    for (const [key, val] of Object.entries(company)) {
      if (val !== undefined) updates[key] = val;
    }
    if (Object.keys(updates).length > 0) {
      const { error } = await admin.from("company").update(updates).eq("company_id", companyId);
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }
  }

  await logPlatformAction(adminId, "workspace_updated", "workspace", workspaceId, {
    workspace,
    company,
  });

  return NextResponse.json({ ok: true });
}
