// PATCH /api/observer-requests/[id]?action=claim|approve|reject
// Task 14 (Phase 1 governance/training MVP). See ADR-0103.
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createClient } from "@smartout/supabase/server";
import { emit } from "@smartout/telemetry";
import { z } from "zod";

const actionSchema = z.enum(["claim", "approve", "reject"]);
const bodySchema = z
  .object({
    notes: z.string().max(2000).optional(),
  })
  .optional();

const ALLOWED_ROLES = ["manager", "admin", "owner"] as const;

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const actionParam = request.nextUrl.searchParams.get("action");
  const parsedAction = actionSchema.safeParse(actionParam);
  if (!parsedAction.success) {
    return NextResponse.json(
      { error: "Invalid action: expected claim|approve|reject" },
      { status: 400 },
    );
  }
  const action = parsedAction.data;

  const rawBody = await request.json().catch(() => undefined);
  const parsedBody = bodySchema.safeParse(rawBody);
  if (!parsedBody.success) {
    return NextResponse.json({ error: parsedBody.error.flatten() }, { status: 400 });
  }
  const notes = parsedBody.data?.notes;

  // Fetch observer_request to get its workspace_id for role check + emit context.
  const { data: obReq } = await supabase
    .from("observer_request")
    .select("observer_request_id, workspace_id, status")
    .eq("observer_request_id", id)
    .single();

  if (!obReq) {
    return NextResponse.json({ error: "Observer request not found" }, { status: 404 });
  }

  const { data: callerProfile } = await supabase
    .from("profile")
    .select("profile_id, role")
    .eq("user_id", user.id)
    .eq("workspace_id", obReq.workspace_id)
    .single();

  if (
    !callerProfile ||
    !ALLOWED_ROLES.includes(callerProfile.role as (typeof ALLOWED_ROLES)[number])
  ) {
    return NextResponse.json(
      { error: "Forbidden: manager, admin, or owner role required" },
      { status: 403 },
    );
  }

  const now = new Date().toISOString();

  if (action === "claim") {
    const { error } = await supabase
      .from("observer_request")
      .update({
        status: "claimed",
        observer_profile_id: callerProfile.profile_id,
        claimed_at: now,
      })
      .eq("observer_request_id", id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    void emit({
      event: "observer_request claimed",
      workspace_id: obReq.workspace_id,
      actor_id: user.id,
      properties: {
        entity: { entity_type: "observer_request" as const, entity_id: id },
        data: { observer_profile_id: callerProfile.profile_id },
      },
    });

    return NextResponse.json({ observer_request_id: id, status: "claimed" });
  }

  // approve | reject
  const nextStatus = action === "approve" ? "approved" : "rejected";
  const { error } = await supabase
    .from("observer_request")
    .update({
      status: nextStatus,
      resolved_at: now,
      ...(notes !== undefined ? { notes } : {}),
    })
    .eq("observer_request_id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  void emit({
    event: "observer_request resolved",
    workspace_id: obReq.workspace_id,
    actor_id: user.id,
    properties: {
      entity: { entity_type: "observer_request" as const, entity_id: id },
      data: { resolution: nextStatus as "approved" | "rejected" },
    },
  });

  return NextResponse.json({ observer_request_id: id, status: nextStatus });
}
