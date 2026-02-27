import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createAdminClient } from "@smartout/supabase/admin";
import { getSuperAdminId, logPlatformAction } from "@/lib/platform-admin";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const adminId = await getSuperAdminId();
  if (!adminId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { slug } = await params;
  const admin = createAdminClient();

  // Get current config
  const { data: config, error: fetchError } = await admin
    .from("landing_config")
    .select("config_id, config_json, version")
    .eq("slug", slug)
    .single();

  if (fetchError || !config) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const newVersion = config.version + 1;

  // Publish with optimistic locking — version must match to prevent race conditions
  const { data: updated, error: publishError } = await admin
    .from("landing_config")
    .update({
      published_json: config.config_json,
      status: "published",
      version: newVersion,
      published_at: new Date().toISOString(),
      published_by: adminId,
      updated_by: adminId,
    })
    .eq("slug", slug)
    .eq("version", config.version) // optimistic lock
    .select("config_id")
    .single();

  if (publishError || !updated) {
    return NextResponse.json(
      { error: "Conflict — config was modified by another request" },
      { status: 409 },
    );
  }

  // Save version snapshot after successful publish
  const { error: versionError } = await admin.from("landing_config_version").insert({
    config_id: config.config_id,
    version: newVersion,
    config_json: config.config_json,
    created_by: adminId,
  });

  if (versionError) {
    return NextResponse.json({ error: versionError.message }, { status: 500 });
  }

  await logPlatformAction(adminId, "publish_config", "config", config.config_id, {
    slug,
    version: newVersion,
  });

  return NextResponse.json({ success: true, version: newVersion });
}
