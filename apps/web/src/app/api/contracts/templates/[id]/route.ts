// GET /api/contracts/templates/[id]
// Returns a single contract template including content_html for document preview.
// Restricted to admin/owner roles — raw template HTML should not be exposed to employees.
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createClient } from "@smartout/supabase/server";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  // Verify caller has admin or owner role — template content is admin-only.
  const workspaceId = request.nextUrl.searchParams.get("workspace_id");
  if (workspaceId) {
    const { data: callerProfile } = await supabase
      .from("profile")
      .select("role")
      .eq("user_id", user.id)
      .eq("workspace_id", workspaceId)
      .single();

    if (!callerProfile || (callerProfile.role !== "admin" && callerProfile.role !== "owner")) {
      return NextResponse.json(
        { error: "Forbidden: only admins and owners can view template content" },
        { status: 403 },
      );
    }
  }

  // RLS handles workspace access. Select full template including HTML content.
  // Phase 4 (drift observability) adds `version`, `deprecated_at`, `source_template_id`,
  // and `source_template_version` so the drift diff drawer and deprecated-template
  // banner can read them without a second request. `published_at` is included for
  // symmetry with the list endpoint.
  const { data, error } = await supabase
    .from("contract_template")
    .select(
      "template_id, name, description, contract_type, language, placeholders, content_html, version, deprecated_at, published_at, source_template_id, source_template_version",
    )
    .eq("template_id", id)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 404 });
  return NextResponse.json({ data });
}
