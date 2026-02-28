import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createAdminClient } from "@smartout/supabase/admin";
import { getSuperAdminId, logPlatformAction } from "@/lib/platform-admin";

// ---------------------------------------------------------------------------
// POST — Revoke an API key (and all related versions)
// ---------------------------------------------------------------------------

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const adminId = await getSuperAdminId();
  if (!adminId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const admin = createAdminClient();

  // Fetch the key to find its group (workspace_id + key_type + environment)
  const { data: existingKey, error: fetchError } = await admin
    .from("platform_api_key")
    .select("id, workspace_id, key_type, environment, version")
    .eq("id", id)
    .single();

  if (fetchError || !existingKey) {
    if (fetchError?.code === "PGRST116") {
      return NextResponse.json({ error: "Key not found" }, { status: 404 });
    }
    return NextResponse.json(
      { error: fetchError?.message ?? "Failed to fetch key" },
      { status: 500 },
    );
  }

  if (existingKey.version === "revoked") {
    return NextResponse.json({ error: "Key is already revoked" }, { status: 400 });
  }

  const now = new Date().toISOString();

  // Revoke all related versions (current + previous) for the same group
  let revokeQuery = admin
    .from("platform_api_key")
    .update({
      version: "revoked",
      revoked_at: now,
      updated_at: now,
    })
    .eq("key_type", existingKey.key_type)
    .eq("environment", existingKey.environment)
    .in("version", ["current", "previous"]);

  // Handle workspace_id matching (null for service keys)
  if (existingKey.workspace_id) {
    revokeQuery = revokeQuery.eq("workspace_id", existingKey.workspace_id);
  } else {
    revokeQuery = revokeQuery.is("workspace_id", null);
  }

  const { error: revokeError, count } = await revokeQuery;

  if (revokeError) {
    return NextResponse.json(
      { error: revokeError.message ?? "Failed to revoke key" },
      { status: 500 },
    );
  }

  await logPlatformAction(adminId, "revoke_api_key", "platform_api_key", id, {
    workspace_id: existingKey.workspace_id,
    key_type: existingKey.key_type,
    environment: existingKey.environment,
    versions_revoked: count ?? 0,
  });

  return NextResponse.json({
    data: {
      revoked: true,
      versions_revoked: count ?? 0,
    },
  });
}
