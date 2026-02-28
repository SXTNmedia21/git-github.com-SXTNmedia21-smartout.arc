import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createAdminClient } from "@smartout/supabase/admin";
import { getSuperAdminId } from "@/lib/platform-admin";

// Types are now available in database.types.ts after migration 20260228230000

// ---------------------------------------------------------------------------
// GET — Key detail with rotation versions and usage summary
// ---------------------------------------------------------------------------

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const adminId = await getSuperAdminId();
  if (!adminId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const admin = createAdminClient();

  // Fetch key detail and usage data in parallel
  const [keyResult, usageResult] = await Promise.all([
    admin
      .from("platform_api_key")
      .select(
        "id, workspace_id, company_id, name, description, key_type, environment, key_prefix, version, rotation_number, scopes, rate_limit_per_minute, allowed_ips, last_used_at, demoted_at, grace_period_ends_at, revoked_at, expires_at, created_at, updated_at",
      )
      .eq("id", id)
      .single(),

    admin.from("platform_api_key_usage").select("request_count, error_count").eq("api_key_id", id),
  ]);

  if (keyResult.error || !keyResult.data) {
    if (keyResult.error?.code === "PGRST116") {
      return NextResponse.json({ error: "Key not found" }, { status: 404 });
    }
    return NextResponse.json(
      { error: keyResult.error?.message ?? "Failed to fetch key" },
      { status: 500 },
    );
  }

  const key = keyResult.data;

  // Fetch all rotation versions for the same workspace + type + env group
  let versionsQuery = admin
    .from("platform_api_key")
    .select(
      "id, key_prefix, version, rotation_number, demoted_at, grace_period_ends_at, revoked_at, created_at",
    )
    .eq("key_type", key.key_type)
    .eq("environment", key.environment)
    .order("rotation_number", { ascending: false });

  if (key.workspace_id) {
    versionsQuery = versionsQuery.eq("workspace_id", key.workspace_id);
  } else {
    versionsQuery = versionsQuery.is("workspace_id", null);
  }

  const { data: allVersions } = await versionsQuery;

  // Aggregate usage
  const usageRows = usageResult.data ?? [];
  const totalRequests = usageRows.reduce((sum, row) => sum + (row.request_count ?? 0), 0);
  const totalErrors = usageRows.reduce((sum, row) => sum + (row.error_count ?? 0), 0);

  // Resolve workspace name
  let workspaceName: string | null = null;
  if (key.workspace_id) {
    const { data: workspace } = await admin
      .from("workspace")
      .select("name")
      .eq("workspace_id", key.workspace_id)
      .single();
    workspaceName = workspace?.name ?? null;
  }

  return NextResponse.json({
    data: {
      ...key,
      workspace_name: workspaceName,
      versions: allVersions ?? [],
      usage_summary: {
        total_requests: totalRequests,
        total_errors: totalErrors,
        bucket_count: usageRows.length,
      },
    },
  });
}
