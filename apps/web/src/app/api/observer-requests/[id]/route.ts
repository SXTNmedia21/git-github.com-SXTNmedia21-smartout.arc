// PATCH /api/observer-requests/[id]?action=claim|approve|reject
// Task 14 (Phase 1 governance/training MVP). See ADR-0099 (unified authority
// gate), ADR-0101 (four-eyes), ADR-0103 (observer_request). All role checks
// route through gate_action; four-eyes approvals route through change_proposal.
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createClient } from "@smartout/supabase/server";
import { createAdminClient } from "@smartout/supabase/admin";
import { emit, nonEmpty } from "@smartout/telemetry";
import { z } from "zod";

const actionSchema = z.enum(["claim", "approve", "reject"]);
const bodySchema = z.object({ notes: z.string().max(2000).optional() }).optional();

type GateResult = {
  allow: boolean;
  reason: string | null;
  downgrade_to: string | null;
  min_role_required: string | null;
  channel_allowed: boolean;
  four_eyes_required: boolean;
  approvers_needed: number;
};

function normalizeGate(data: unknown): GateResult {
  const row = (data ?? {}) as Record<string, unknown>;
  return {
    allow: row.allow === true,
    reason: (row.reason as string | null) ?? null,
    downgrade_to: (row.downgrade_to as string | null) ?? null,
    min_role_required: (row.min_role_required as string | null) ?? null,
    channel_allowed: row.channel_allowed !== false,
    four_eyes_required: row.four_eyes_required === true,
    approvers_needed: Number(row.approvers_needed ?? 0),
  };
}

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

  const admin = createAdminClient();

  // Load observer_request + joined protocol.evidence_tier for four-eyes branch.
  const { data: obReq } = await admin
    .from("observer_request")
    .select(
      "observer_request_id, workspace_id, status, protocol_assignment_id, protocol_assignment:protocol_assignment_id(protocol_id, protocol:protocol_id(evidence_tier))",
    )
    .eq("observer_request_id", id)
    .single();
  if (!obReq) {
    return NextResponse.json({ error: "Observer request not found" }, { status: 404 });
  }

  // PostgREST typing collapses the nested join into arrays or objects depending
  // on codegen; handle both shapes defensively.
  const assignmentJoin = Array.isArray(
    (obReq as { protocol_assignment: unknown }).protocol_assignment,
  )
    ? (obReq as unknown as { protocol_assignment: Array<{ protocol: unknown }> })
        .protocol_assignment[0]
    : (obReq as unknown as { protocol_assignment: { protocol: unknown } | null })
        .protocol_assignment;
  const protocolJoin =
    assignmentJoin == null
      ? null
      : Array.isArray((assignmentJoin as { protocol: unknown }).protocol)
        ? ((assignmentJoin as { protocol: Array<{ evidence_tier?: string }> }).protocol[0] ?? null)
        : ((assignmentJoin as { protocol: { evidence_tier?: string } | null }).protocol ?? null);
  const evidenceTier = (protocolJoin?.evidence_tier as string | undefined) ?? null;

  const { data: callerProfile } = await admin
    .from("profile")
    .select("profile_id")
    .eq("user_id", user.id)
    .eq("workspace_id", obReq.workspace_id)
    .single();
  if (!callerProfile) {
    return NextResponse.json({ error: "Forbidden: not a member of workspace" }, { status: 403 });
  }

  const actionType = action === "claim" ? "update" : action;

  const { data: gateData, error: gateErr } = await admin.rpc("gate_action", {
    p_workspace_id: obReq.workspace_id,
    // Inlined ternary (not a `capability` local) so authority-seed-parity can
    // statically extract BOTH literals — ADR-0189 CI gate.
    p_capability: action === "claim" ? "observer_request.claim" : "observer_request.approve",
    p_channel: "system",
    p_actor_profile_id: callerProfile.profile_id,
    p_action_type: actionType,
    p_approvers_present: [callerProfile.profile_id],
  });
  if (gateErr) {
    return NextResponse.json({ error: `gate_action failed: ${gateErr.message}` }, { status: 500 });
  }
  const gate = normalizeGate(gateData);

  // Four-eyes branch: approve on a four_eyes-tier protocol must route through
  // change_proposal. Single manager cannot approve directly (ADR-0101).
  if (
    action === "approve" &&
    gate.allow === false &&
    gate.reason === "four_eyes_required" &&
    evidenceTier === "four_eyes"
  ) {
    const { data: proposal, error: proposalErr } = await admin
      .from("change_proposal")
      .insert({
        workspace_id: obReq.workspace_id,
        initiated_by: callerProfile.profile_id,
        trigger_type: "manual_override",
        trigger_entity_type: "observer_request",
        trigger_entity_id: obReq.observer_request_id,
        changes: {
          observer_request_id: obReq.observer_request_id,
          action: "approve",
          notes: notes ?? null,
        },
        approval_required: true,
      })
      .select("change_proposal_id")
      .single();
    if (proposalErr || !proposal) {
      return NextResponse.json(
        { error: proposalErr?.message ?? "Failed to create change_proposal" },
        { status: 500 },
      );
    }

    void emit({
      event: "approval requested",
      workspace_id: nonEmpty(obReq.workspace_id, "workspace_id"),
      actor_id: nonEmpty(user.id, "actor_id"),
      properties: {
        entity: { entity_type: "change_proposal" as const, entity_id: proposal.change_proposal_id },
        data: { approvers_needed: gate.approvers_needed || 2 },
      },
    });

    return NextResponse.json(
      {
        observer_request_id: id,
        status: obReq.status,
        change_proposal_id: proposal.change_proposal_id,
        four_eyes_required: true,
      },
      { status: 202 },
    );
  }

  if (!gate.allow) {
    return NextResponse.json(
      { error: "Forbidden", reason: gate.reason, min_role_required: gate.min_role_required },
      { status: 403 },
    );
  }

  const now = new Date().toISOString();

  if (action === "claim") {
    const { error } = await admin
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
      workspace_id: nonEmpty(obReq.workspace_id, "workspace_id"),
      actor_id: nonEmpty(user.id, "actor_id"),
      properties: {
        entity: { entity_type: "observer_request" as const, entity_id: id },
        data: { observer_profile_id: callerProfile.profile_id },
      },
    });

    return NextResponse.json({ observer_request_id: id, status: "claimed" });
  }

  const nextStatus = action === "approve" ? "approved" : "rejected";
  const { error } = await admin
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
    workspace_id: nonEmpty(obReq.workspace_id, "workspace_id"),
    actor_id: nonEmpty(user.id, "actor_id"),
    properties: {
      entity: { entity_type: "observer_request" as const, entity_id: id },
      data: { resolution: nextStatus as "approved" | "rejected" },
    },
  });

  return NextResponse.json({ observer_request_id: id, status: nextStatus });
}
