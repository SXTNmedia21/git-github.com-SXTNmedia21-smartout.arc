/**
 * POST /api/contract-templates/blank — Create empty workspace template.
 *
 * Use case: admin wants to author a contract from scratch instead of forking
 * a K1a system template. Inserts a row with empty content_html, no lineage.
 * Caller publishes via /api/contract-templates/[id]/publish when ready.
 *
 * RLS: workspace admin/owner only.
 */

import { NextResponse } from "next/server";
import { createClient } from "@smartout/supabase/server";
import { z } from "zod";
import { emit, nonEmpty } from "@smartout/telemetry";

const blankSchema = z.object({
  workspace_id: z.string().uuid(),
  name: z.string().min(1).max(200),
  description: z.string().max(500).optional(),
});

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();
    const parsed = blankSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { workspace_id, name, description } = parsed.data;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: actorProfile } = await supabase
      .from("profile")
      .select("profile_id, role")
      .eq("user_id", user.id)
      .eq("workspace_id", workspace_id)
      .single();

    if (!actorProfile || !["admin", "owner"].includes(actorProfile.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data: created, error: insertError } = await supabase
      .from("contract_template")
      .insert({
        name,
        description: description ?? null,
        workspace_id,
        contract_type: "employee",
        language: "nb",
        content_html: "<p></p>",
        content_css: null,
        header_html: null,
        footer_html: null,
        placeholders: [],
        employment_category: null,
        is_system: false,
        is_active: true,
        version: 1,
        created_by: user.id,
        source_template_id: null,
        source_template_version: null,
        forked_at: null,
        published_at: null,
        deprecated_at: null,
      })
      .select("template_id, name")
      .single();

    if (insertError || !created) {
      return NextResponse.json(
        { error: `Failed to create: ${insertError?.message ?? "unknown"}` },
        { status: 500 },
      );
    }

    await emit({
      event: "contract_template created",
      workspace_id: nonEmpty(workspace_id, "workspace_id"),
      actor_id: nonEmpty(actorProfile.profile_id, "actor_id"),
      properties: {
        entity: { entity_type: "contract_template", entity_id: created.template_id },
        data: {
          source_scope: "blank",
          name: created.name,
        },
      },
    });

    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
