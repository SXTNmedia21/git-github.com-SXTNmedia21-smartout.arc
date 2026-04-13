/**
 * DELETE /api/contract-template-bindings/[id] — Remove a binding.
 */

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@smartout/supabase/server";
import { emit } from "@smartout/telemetry";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: binding, error: fetchError } = await supabase
    .from("contract_template_binding")
    .select("id, workspace_id, template_id, employment_category, employee_group_id")
    .eq("id", id)
    .single();

  if (fetchError || !binding) {
    return NextResponse.json({ error: "Binding not found" }, { status: 404 });
  }

  const { data: actorProfile } = await supabase
    .from("profile")
    .select("profile_id, role")
    .eq("user_id", user.id)
    .eq("workspace_id", binding.workspace_id)
    .single();

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
