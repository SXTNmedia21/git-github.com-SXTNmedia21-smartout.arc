/**
 * POST /api/contract-templates/[id]/rename — Rename a workspace template.
 *
 * Body: { name: string } — non-empty, ≤ 200 characters.
 * Auth: admin/owner only (same gate as publish).
 * Rejects K1a system templates (workspace_id IS NULL) with 400.
 *
 * Returns { template_id, name } on success.
 */

import { NextResponse } from "next/server";
import { createClient } from "@smartout/supabase/server";
import { emit, nonEmpty } from "@smartout/telemetry";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Parse + validate body
    const body = (await request.json().catch(() => null)) as unknown;
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
    const { name } = body as Record<string, unknown>;
    if (typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json({ error: "name must be a non-empty string" }, { status: 400 });
    }
    if (name.trim().length > 200) {
      return NextResponse.json({ error: "name must be ≤ 200 characters" }, { status: 400 });
    }
    const trimmedName = name.trim();

    // Load template — reject K1a (workspace_id IS NULL) and missing rows
    const { data: tpl, error: loadError } = await supabase
      .from("contract_template")
      .select("template_id, name, workspace_id")
      .eq("template_id", id)
      .single();

    if (loadError || !tpl) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }
    if (!tpl.workspace_id) {
      return NextResponse.json({ error: "Cannot rename a K1a system template" }, { status: 400 });
    }

    // Role check: admin or owner in this workspace only
    const { data: actorProfile } = await supabase
      .from("profile")
      .select("profile_id, role")
      .eq("user_id", user.id)
      .eq("workspace_id", tpl.workspace_id)
      .single();

    if (!actorProfile || !["admin", "owner"].includes(actorProfile.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { error: updateError } = await supabase
      .from("contract_template")
      .update({ name: trimmedName })
      .eq("template_id", id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    await emit({
      event: "contract_template renamed",
      workspace_id: nonEmpty(tpl.workspace_id, "workspace_id"),
      actor_id: nonEmpty(actorProfile.profile_id, "actor_id"),
      properties: {
        entity: {
          entity_type: "contract_template",
          entity_id: id,
          entity_label: trimmedName,
        },
        data: { from: tpl.name, to: trimmedName },
      },
    });

    return NextResponse.json({ template_id: id, name: trimmedName });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
