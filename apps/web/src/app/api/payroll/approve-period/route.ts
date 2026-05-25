/**
 * BFF POST /api/payroll/approve-period
 *
 * Approves a locked payroll period. Closes P0 GAP-SIM-B02 — terminal state
 * for the payroll period lifecycle (open → locked → approved → exported).
 *
 * Enforces:
 *   1. gate_action (confirm-level, admin-only, chat channel)
 *   2. Period must be in "locked" status — cannot approve from open or re-approve
 *   3. Sets status→"approved", approved_at, approved_by
 *   4. Emits payroll.period_approved (mirrors period_locked shape)
 *
 * Returns:
 *   { ok: true, period_id } on success
 *   { ok: false, error: "period_not_locked", status } if not in locked state
 *   { ok: false, error: "..." } for other failures (403, 404)
 *
 * ADR-0099: gate_action before any write
 * ADR-0151: workspace_id + profile_id derived server-side
 * ADR-0078: chat channel only (payroll = Høy-PII)
 * ADR-0134: emit() with non-empty workspace_id + actor_id
 */
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";

import { gateAction } from "@/app/dashboard/_actions/_shared";
import { rejectCrossOrigin, resolvePayrollAuth } from "@/app/api/payroll/_shared";
import { createAdminClient } from "@smartout/supabase/admin";
import { emit, nonEmpty } from "@smartout/telemetry";

export const runtime = "nodejs";

const RequestSchema = z.object({
  workspace_id: z.string().uuid().describe("UUID of the workspace context (UI-resolved)"),
  period_id: z.string().uuid(),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  const cors = rejectCrossOrigin(request);
  if (cors) return cors;

  // ─── Input validation (workspace_id needed before auth resolve) ────────────
  let body: z.infer<typeof RequestSchema>;
  try {
    body = RequestSchema.parse(await request.json());
  } catch (err) {
    const message =
      err instanceof z.ZodError ? (err.errors[0]?.message ?? "Invalid body") : "Invalid body";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }

  // ─── Identity (ADR-0151: server-derived, validated against requested workspace) ──
  const auth = await resolvePayrollAuth(request, body.workspace_id);
  if (!auth) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  // Gate — confirm-level, admin, chat channel (ADR-0099 + ADR-0078)
  const gate = await gateAction({
    workspaceId: auth.workspaceId,
    capability: "payroll",
    channel: "chat",
    actorProfileId: auth.profileId,
    actionType: "approve_period",
    entityId: body.period_id,
  });
  if (!gate.allow) {
    return NextResponse.json(
      { ok: false, error: `forbidden: ${gate.reason ?? "denied"}` },
      { status: 403 },
    );
  }

  const admin = createAdminClient();

  // Verify period belongs to workspace — fail-fast (L-0177)
  const { data: period, error: periodErr } = await admin
    .schema("payroll")
    .from("period")
    .select("id, status, start_date, end_date")
    .eq("id", body.period_id)
    .eq("workspace_id", auth.workspaceId)
    .maybeSingle();

  if (periodErr || !period) {
    return NextResponse.json({ ok: false, error: "period_not_found" }, { status: 404 });
  }

  // Hard gate: only locked periods may be approved. Bokf §13 audit trail
  // requires explicit lock step before approval. Reject open + already-
  // approved + exported with 409 conflict.
  if (period.status !== "locked") {
    return NextResponse.json(
      { ok: false, error: "period_not_locked", status: period.status },
      { status: 409 },
    );
  }

  // Fetch profiles_count + total_lines for the approved emit. Same shape
  // as period_locked emit so downstream subscribers can use either event
  // as a fan-out trigger.
  const { data: calcRows } = await admin
    .schema("payroll")
    .from("calculation")
    .select("profile_id, id")
    .eq("period_id", body.period_id)
    .eq("workspace_id", auth.workspaceId);

  const affectedProfileIds = [...new Set((calcRows ?? []).map((c) => c.profile_id))];
  const profilesCount = affectedProfileIds.length;
  const totalLines = calcRows?.length ?? 0;

  // Approve the period
  const { error: updateErr } = await admin
    .schema("payroll")
    .from("period")
    .update({
      status: "approved",
      approved_at: new Date().toISOString(),
      approved_by: auth.profileId,
    })
    .eq("id", body.period_id)
    .eq("workspace_id", auth.workspaceId);

  if (updateErr) {
    return NextResponse.json({ ok: false, error: updateErr.message }, { status: 500 });
  }

  void emit({
    event: "payroll.period_approved",
    workspace_id: nonEmpty(auth.workspaceId, "workspace_id"),
    actor_id: nonEmpty(auth.profileId, "actor_id"),
    properties: {
      entity: {
        entity_type: "payroll_period" as const,
        entity_id: body.period_id,
      },
      data: {
        period_id: body.period_id,
        period_start: period.start_date,
        period_end: period.end_date,
        profiles_count: profilesCount,
        total_lines: totalLines,
        affected_profile_ids: affectedProfileIds,
        approved_by_profile_id: auth.profileId,
        gate_evaluation_id: null,
      },
    },
  });

  return NextResponse.json({ ok: true, period_id: body.period_id });
}
