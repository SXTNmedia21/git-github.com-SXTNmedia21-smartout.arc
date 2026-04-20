/**
 * POST /api/contract-templates/copy — Clone a system template to workspace.
 *
 * Creates a workspace-owned copy of an immutable system template.
 * The copy gets is_system=false and the caller's workspace_id.
 */

import { NextResponse } from "next/server";
import { createClient } from "@smartout/supabase/server";
import { z } from "zod";
import { emit } from "@smartout/telemetry";

const copySchema = z.object({
  workspace_id: z.string().uuid(),
  system_template_id: z.string().uuid(),
  name: z.string().min(1).max(200),
  description: z.string().max(500).optional(),
});

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();
    const parsed = copySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { workspace_id, system_template_id, name, description } = parsed.data;

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Role gate
    const { data: actorProfile } = await supabase
      .from("profile")
      .select("profile_id, role")
      .eq("user_id", user.id)
      .eq("workspace_id", workspace_id)
      .single();

    if (!actorProfile || !["admin", "owner"].includes(actorProfile.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Load source template
    const { data: source, error: sourceError } = await supabase
      .from("contract_template")
      .select("*")
      .eq("template_id", system_template_id)
      .eq("is_system", true)
      .single();

    if (sourceError || !source) {
      return NextResponse.json({ error: "System template not found" }, { status: 404 });
    }

    // Insert workspace copy
    const { data: copy, error: copyError } = await supabase
      .from("contract_template")
      .insert({
        name,
        description: description ?? source.description,
        workspace_id,
        contract_type: source.contract_type,
        language: source.language,
        content_html: source.content_html,
        content_css: source.content_css,
        header_html: source.header_html,
        footer_html: source.footer_html,
        placeholders: source.placeholders,
        employment_category: source.employment_category,
        is_system: false,
        is_active: true,
        version: 1,
        created_by: actorProfile.profile_id,
      })
      .select("template_id, name")
      .single();

    if (copyError || !copy) {
      return NextResponse.json(
        { error: `Failed to copy: ${copyError?.message ?? "unknown"}` },
        { status: 500 },
      );
    }

    await emit({
      event: "contract_template copied",
      workspace_id,
      actor_id: actorProfile.profile_id,
      properties: {
        entity: { entity_type: "contract_template", entity_id: copy.template_id },
        data: { source_template_id: system_template_id, name: copy.name },
      },
    });

    return NextResponse.json(copy, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
