import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@smartout/supabase/admin";
import type { Json } from "@smartout/supabase";
import { getSuperAdminId, logPlatformAction } from "@/lib/platform-admin";

const UpdateConfigSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  config_json: z.record(z.unknown()).optional(),
  locale: z.string().optional(),
});

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const adminId = await getSuperAdminId();
  if (!adminId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { slug } = await params;
  const admin = createAdminClient();
  const { data, error } = await admin.from("landing_config").select("*").eq("slug", slug).single();

  if (error || !data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ data });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const adminId = await getSuperAdminId();
  if (!adminId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { slug } = await params;
  const body = UpdateConfigSchema.safeParse(await request.json());
  if (!body.success) {
    return NextResponse.json({ error: body.error.flatten().fieldErrors }, { status: 400 });
  }

  const admin = createAdminClient();
  const { config_json, ...rest } = body.data;
  const { data, error } = await admin
    .from("landing_config")
    .update({
      ...rest,
      ...(config_json && { config_json: config_json as unknown as Json }),
      updated_by: adminId,
    })
    .eq("slug", slug)
    .select()
    .single();

  if (error || !data) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await logPlatformAction(adminId, "update_config", "config", data.config_id, {
    slug,
    fields: Object.keys(body.data),
  });

  return NextResponse.json({ data });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const adminId = await getSuperAdminId();
  if (!adminId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { slug } = await params;
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("landing_config")
    .update({ status: "archived", updated_by: adminId })
    .eq("slug", slug)
    .select("config_id")
    .single();

  if (error || !data) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await logPlatformAction(adminId, "archive_config", "config", data.config_id, { slug });

  return NextResponse.json({ success: true });
}
