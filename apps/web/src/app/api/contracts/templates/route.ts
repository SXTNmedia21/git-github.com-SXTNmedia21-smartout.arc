// GET /api/contracts/templates
// Returns active employee contract templates for a workspace.
// Includes both system templates (workspace_id IS NULL) and workspace-specific templates.
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createClient } from "@smartout/supabase/server";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const workspaceId = request.nextUrl.searchParams.get("workspace_id");
  if (!workspaceId) return NextResponse.json({ error: "workspace_id required" }, { status: 400 });

  // RLS handles admin check. Query system templates (null workspace_id) + workspace-specific templates.
  // Lineage + lifecycle columns (source_template_id, source_template_version, forked_at,
  // published_at, deprecated_at) added Phase 3 to support MalerTab subtitle rendering
  // and bulk-send "only published templates" gate.
  const { data, error } = await supabase
    .from("contract_template")
    .select(
      "template_id, name, description, contract_type, language, placeholders, workspace_id, source_template_id, source_template_version, forked_at, published_at, deprecated_at",
    )
    .eq("contract_type", "employee")
    .eq("is_active", true)
    .or(`workspace_id.eq.${workspaceId},workspace_id.is.null`)
    .order("name");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}
