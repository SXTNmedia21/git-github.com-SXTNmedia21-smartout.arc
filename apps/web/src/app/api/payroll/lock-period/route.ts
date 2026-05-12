/**
 * BFF POST /api/payroll/lock-period
 *
 * Locks a payroll period. Enforces:
 *   1. gate_action (confirm-level, admin-only, chat channel)
 *   2. No unacknowledged deviations of severity=error (hard block)
 *   3. Period must be in "open" status (not already locked/approved)
 *   4. Sets status→"locked", locked_at, locked_by
 *   5. Emits payroll.period_locked
 *
 * Returns:
 *   { ok: true, period_id } on success
 *   { ok: false, error: "unacked_errors", unacked: N } if errors unacknowledged
 *   { ok: false, error: "..." } for other failures (403, 404, 409 already locked)
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
    actionType: "lock_period",
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

  if (period.status !== "open") {
    return NextResponse.json(
      { ok: false, error: "period_already_locked", status: period.status },
      { status: 409 },
    );
  }

  // Hard block: unacknowledged error-severity deviations — fetch rows (not just count)
  // so we can include check_codes in the emit per PayrollDeviationBlockedApproval shape.
  const { data: unackedDevs, error: devErr } = await admin
    .schema("payroll")
    .from("deviation")
    .select("id, check_id")
    .eq("period_id", body.period_id)
    .eq("workspace_id", auth.workspaceId)
    .eq("severity", "error")
    .is("acknowledged_at", null);

  if (devErr) {
    return NextResponse.json({ ok: false, error: "deviation_check_failed" }, { status: 500 });
  }

  if ((unackedDevs?.length ?? 0) > 0) {
    const checkCodes = (unackedDevs ?? []).map((d) => d.check_id);

    void emit({
      event: "payroll.deviation_blocked_approval",
      workspace_id: nonEmpty(auth.workspaceId, "workspace_id"),
      actor_id: nonEmpty(auth.profileId, "actor_id"),
      properties: {
        entity: {
          entity_type: "payroll_period" as const,
          entity_id: body.period_id,
        },
        data: {
          period_id: body.period_id,
          blocking_deviation_count: unackedDevs!.length,
          check_codes: checkCodes,
        },
      },
    });

    return NextResponse.json(
      { ok: false, error: "unacked_errors", unacked: unackedDevs!.length },
      { status: 409 },
    );
  }

  // Fetch profiles_count + total_lines for the locked emit
  // Also used to populate affected_profile_ids for the period-locked-handler invoke.
  const { data: calcRows } = await admin
    .schema("payroll")
    .from("calculation")
    .select("profile_id, id")
    .eq("period_id", body.period_id)
    .eq("workspace_id", auth.workspaceId);

  const affectedProfileIds = [...new Set((calcRows ?? []).map((c) => c.profile_id))];
  const profilesCount = affectedProfileIds.length;
  const totalLines = calcRows?.length ?? 0;

  // Lock the period
  const { error: updateErr } = await admin
    .schema("payroll")
    .from("period")
    .update({
      status: "locked",
      locked_at: new Date().toISOString(),
      locked_by: auth.profileId,
    })
    .eq("id", body.period_id)
    .eq("workspace_id", auth.workspaceId);

  if (updateErr) {
    return NextResponse.json({ ok: false, error: updateErr.message }, { status: 500 });
  }

  void emit({
    event: "payroll.period_locked",
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
        locked_by_profile_id: auth.profileId,
        gate_evaluation_id: null,
      },
    },
  });

  // Pattern B (ADR-0293): invoke the notification handler directly from the BFF,
  // post-emit. No engine_process blueprint subscribes to payroll.period_locked —
  // direct invoke is the correct approach (matches sync-recalc precedent).
  // Failure is best-effort: emit already fired and provides audit trail.
  const periodLabel = String(period.start_date).slice(0, 7); // "yyyy-MM"
  try {
    await admin.functions.invoke("payroll-period-locked-handler", {
      body: {
        workspace_id: auth.workspaceId,
        period_id: body.period_id,
        period_label: periodLabel,
        affected_profile_ids: affectedProfileIds,
      },
    });
  } catch (invokeErr) {
    // Notification failure does not fail the lock — audit trail covers it.
    console.error("[lock-period] payroll-period-locked-handler invoke failed:", invokeErr);
  }

  return NextResponse.json({ ok: true, period_id: body.period_id });
}
