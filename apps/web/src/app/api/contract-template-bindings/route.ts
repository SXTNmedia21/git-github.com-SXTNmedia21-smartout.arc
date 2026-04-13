/**
 * GET  /api/contract-template-bindings?workspace_id=...&employee_group_id=...
 * POST /api/contract-template-bindings — Create a new binding.
 */

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@smartout/supabase/server";
import { z } from "zod";
import { emit } from "@smartout/telemetry";

const createSchema = z.object({
  workspace_id: z.string().uuid(),
  template_id: z.string().uuid(),
  employment_category: z.enum(["fast", "deltid", "tilkalling"]),
  employee_group_id: z.string().uuid().nullable().optional().default(null),
  priority: z.number().int().min(0).optional().default(0),
});

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const workspaceId = searchParams.get("workspace_id");

  if (!workspaceId) {
    return NextResponse.json({ error: "workspace_id required" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let query = supabase
    .from("contract_template_binding")
    .select("*, contract_template(template_id, name, employment_category, is_system)")
    .eq("workspace_id", workspaceId)
    .order("priority", { ascending: false });

  const employeeGroupId = searchParams.get("employee_group_id");
  if (employeeGroupId) {
    query = query.eq("employee_group_id", employeeGroupId);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
}

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();
    const parsed = createSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { workspace_id, template_id, employment_category, employee_group_id, priority } =
      parsed.data;

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: actorProfile } = await supabase
      .from("profile")
      .select("profile_id, role")
      .eq("user_id", user.id)
      .eq("workspace_id", workspace_id)
      .single();

    if (!actorProfile || !["admin", "owner"].includes(actorProfile.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data, error } = await supabase
      .from("contract_template_binding")
      .upsert(
        {
          workspace_id,
          template_id,
          employment_category,
          employee_group_id: employee_group_id ?? null,
          priority,
          is_active: true,
        },
        { onConflict: "workspace_id,employment_category,employee_group_id" },
      )
      .select("id, template_id, employment_category, employee_group_id")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    await emit({
      event: "template_binding created",
      workspace_id,
      actor_id: actorProfile.profile_id,
      properties: {
        entity: { entity_type: "contract_template_binding", entity_id: data.id },
        data: { template_id, employment_category, employee_group_id },
      },
    });

    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
