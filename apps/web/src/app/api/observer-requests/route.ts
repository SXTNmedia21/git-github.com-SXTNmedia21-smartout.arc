// POST /api/observer-requests — create an observer_request for a protocol assignment.
// Task 14 (Phase 1 governance/training MVP). See ADR-0099 (unified authority gate)
// and ADR-0103 (observer_request). All role enforcement goes through the
// `gate_action` RPC — no inline role checks here.
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createClient } from "@smartout/supabase/server";
import { createAdminClient } from "@smartout/supabase/admin";
import { emit, nonEmpty } from "@smartout/telemetry";
import { z } from "zod";
import { gateAction } from "@/app/dashboard/_actions/_shared";

const createSchema = z.object({
  workspace_id: z.string().uuid(),
  protocol_assignment_id: z.string().uuid(),
  subject_profile_id: z.string().uuid(),
  notes: z.string().max(2000).optional(),
});

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { workspace_id, protocol_assignment_id, subject_profile_id, notes } = parsed.data;

  const admin = createAdminClient();

  // Resolve caller profile in the requested workspace (identity only; authority
  // is decided by gate_action below).
  const { data: callerProfile } = await admin
    .from("profile")
    .select("profile_id")
    .eq("user_id", user.id)
    .eq("workspace_id", workspace_id)
    .single();
  if (!callerProfile) {
    return NextResponse.json({ error: "Forbidden: not a member of workspace" }, { status: 403 });
  }

  // Validate protocol_assignment exists in caller workspace.
  const { data: assignment } = await admin
    .from("protocol_assignment")
    .select("assignment_id, workspace_id")
    .eq("assignment_id", protocol_assignment_id)
    .eq("workspace_id", workspace_id)
    .single();
  if (!assignment) {
    return NextResponse.json({ error: "Protocol assignment not found" }, { status: 404 });
  }

  // Validate subject profile belongs to the same workspace (council BLOCKER #3).
  const { data: subject } = await admin
    .from("profile")
    .select("profile_id")
    .eq("profile_id", subject_profile_id)
    .eq("workspace_id", workspace_id)
    .single();
  if (!subject) {
    return NextResponse.json({ error: "Subject profile not found in workspace" }, { status: 404 });
  }

  // Authority gate (ADR-0099) — canonical role/channel enforcement.
  // Routes through gateAction() in _shared.ts (ADR-0204 §3 compliant).
  // p_approvers_present defaults to [actor_profile_id] inside the RPC.
  const gate = await gateAction({
    workspaceId: workspace_id,
    capability: "observer_request.create",
    channel: "system",
    actorProfileId: callerProfile.profile_id,
    actionType: "create",
  });
  if (!gate.allow) {
    return NextResponse.json(
      { error: "Forbidden", reason: gate.reason, min_role_required: gate.min_role_required },
      { status: 403 },
    );
  }

  const { data: inserted, error: insertErr } = await admin
    .from("observer_request")
    .insert({
      workspace_id,
      protocol_assignment_id,
      subject_profile_id,
      notes: notes ?? null,
      status: "pending",
    })
    .select("observer_request_id")
    .single();
  if (insertErr || !inserted) {
    return NextResponse.json(
      { error: insertErr?.message ?? "Failed to create observer_request" },
      { status: 500 },
    );
  }

  void emit({
    event: "observer_request created",
    workspace_id: nonEmpty(workspace_id, "workspace_id"),
    actor_id: nonEmpty(user.id, "actor_id"),
    properties: {
      entity: {
        entity_type: "observer_request" as const,
        entity_id: inserted.observer_request_id,
      },
      data: {
        subject_profile_id,
        protocol_assignment_id,
      },
    },
  });

  return NextResponse.json({ observer_request_id: inserted.observer_request_id }, { status: 201 });
}
