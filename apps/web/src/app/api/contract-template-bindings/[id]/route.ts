/**
 * GET    /api/contract-template-bindings/[id] — Fetch a single binding with template join.
 * PUT    /api/contract-template-bindings/[id] — Update binding fields (is_active, priority, template_id).
 * DELETE /api/contract-template-bindings/[id] — Remove a binding.
 */

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@smartout/supabase/server";
import { z } from "zod";
import { emit } from "@smartout/telemetry";

type RouteContext = { params: Promise<{ id: string }> };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function resolveBindingAndActor(id: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const { data: binding, error: fetchError } = await supabase
    .from("contract_template_binding")
    .select(
      "id, workspace_id, template_id, employment_category, employee_group_id, priority, is_active, created_at, updated_at, contract_template(template_id, name, employment_category, is_system)",
    )
    .eq("id", id)
    .single();

  if (fetchError || !binding) {
    return { error: NextResponse.json({ error: "Binding not found" }, { status: 404 }) };
  }

  const { data: actorProfile } = await supabase
    .from("profile")
    .select("profile_id, role")
    .eq("user_id", user.id)
    .eq("workspace_id", binding.workspace_id)
    .single();

  return { supabase, binding, actorProfile };
}

// ---------------------------------------------------------------------------
// GET — fetch a single binding
// ---------------------------------------------------------------------------

export async function GET(
  _request: NextRequest,
  { params }: RouteContext,
) {
  const { id } = await params;
  const result = await resolveBindingAndActor(id);

  if ("error" in result && result.error) return result.error;
  const { binding } = result as Exclude<typeof result, { error: NextResponse }>;

  return NextResponse.json({ data: binding });
}

// ---------------------------------------------------------------------------
// PUT — update binding (is_active, priority, template_id)
// ---------------------------------------------------------------------------

const updateSchema = z.object({
  is_active: z.boolean().optional(),
  priority: z.number().int().min(0).optional(),
  template_id: z.string().uuid().optional(),
});

export async function PUT(
  request: NextRequest,
  { params }: RouteContext,
) {
  const { id } = await params;

  const body: unknown = await request.json();
  const parsed = updateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const result = await resolveBindingAndActor(id);
  if ("error" in result && result.error) return result.error;
  const { supabase, binding, actorProfile } = result as Exclude<
    typeof result,
    { error: NextResponse }
  >;

  if (!actorProfile || !["admin", "owner"].includes(actorProfile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: updated, error: updateError } = await supabase
    .from("contract_template_binding")
    .update(parsed.data)
    .eq("id", id)
    .select(
      "id, workspace_id, template_id, employment_category, employee_group_id, priority, is_active, created_at, updated_at, contract_template(template_id, name, employment_category, is_system)",
    )
    .single();

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  await emit({
    event: "template_binding updated",
    workspace_id: binding.workspace_id,
    actor_id: actorProfile.profile_id,
    properties: {
      entity: { entity_type: "contract_template_binding", entity_id: id },
      data: {
        ...parsed.data,
        employment_category: binding.employment_category,
        employee_group_id: binding.employee_group_id,
      },
    },
  });

  return NextResponse.json({ data: updated });
}

// ---------------------------------------------------------------------------
// DELETE — remove a binding
// ---------------------------------------------------------------------------

export async function DELETE(
  _request: NextRequest,
  { params }: RouteContext,
) {
  const { id } = await params;
  const result = await resolveBindingAndActor(id);

  if ("error" in result && result.error) return result.error;
  const { supabase, binding, actorProfile } = result as Exclude<
    typeof result,
    { error: NextResponse }
  >;

  if (!actorProfile || !["admin", "owner"].includes(actorProfile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { error: deleteError } = await supabase
    .from("contract_template_binding")
    .delete()
    .eq("id", id);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  await emit({
    event: "template_binding deleted",
    workspace_id: binding.workspace_id,
    actor_id: actorProfile.profile_id,
    properties: {
      entity: { entity_type: "contract_template_binding", entity_id: id },
      data: {
        template_id: binding.template_id,
        employment_category: binding.employment_category,
        employee_group_id: binding.employee_group_id,
      },
    },
  });

  return NextResponse.json({ deleted: true });
}
