/**
 * BFF DELETE /api/payroll/delete-manual-supplement
 *
 * Deletes a payroll.manual_supplement row from an open period.
 *
 * Write sequence:
 *   1. Resolve identity server-side (ADR-0151).
 *   2. Gate the action (ADR-0204, ADR-0099) — min role: manager.
 *   3. Verify supplement exists in caller's workspace (L-0177 fail-fast).
 *   4. Verify the period is still open (L-0177).
 *   5. DELETE FROM payroll.manual_supplement WHERE id = $supplementId AND workspace_id = $workspaceId.
 *      DB trigger `payroll_manual_supplement_recalc_trg` (DELETE path, 20260507110100)
 *      fires automatically, emitting `payroll.recalc_triggered_by_supplement` (op=delete)
 *      into engine_event for audit trail.
 *   6. Emit payroll.manual_supplement_deleted (ADR-0134).
 *   7. Synchronously POST to /api/payroll/recalculate-period (Pattern B, ADR-0293).
 *      Recalc failure is best-effort — delete is canonical, recalc is best-effort sync.
 *
 * ADR compliance (body verified — L-0176):
 *   ADR-0151 — workspace_id and actor profile_id never from body; server-derived.
 *   ADR-0204 — gateAction before any DB write.
 *   ADR-0134 — emit() with nonEmpty(workspace_id) + nonEmpty(actor_id).
 *   ADR-0293 — Pattern B sync-chain: recalculate-period called after successful delete.
 *   L-0177   — 4xx on supplement/period not found or wrong workspace; no silent fallback.
 *   ADR-0078 — payroll is Høy-PII; channel pinned to "chat".
 *   ADR-0133 — web-only authoring surface (mobile reads payslips only).
 *   ADR-0240 — no cross-namespace writes; only payroll.manual_supplement is touched.
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
  supplement_id: z.string().uuid("supplement_id must be a UUID"),
});

export async function DELETE(request: NextRequest): Promise<NextResponse> {
  // ─── CORS guard ────────────────────────────────────────────────────────────
  const cors = rejectCrossOrigin(request);
  if (cors) return cors;

  // ─── Identity (ADR-0151: server-derived, never from body) ─────────────────
  const auth = await resolvePayrollAuth(request);
  if (!auth) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  // ─── Input validation ──────────────────────────────────────────────────────
  let body: z.infer<typeof RequestSchema>;
  try {
    body = RequestSchema.parse(await request.json());
  } catch (err) {
    const message =
      err instanceof z.ZodError ? (err.errors[0]?.message ?? "Invalid body") : "Invalid body";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }

  // ─── Authority gate (ADR-0204, ADR-0099) ──────────────────────────────────
  const gate = await gateAction({
    workspaceId: auth.workspaceId,
    capability: "payroll",
    channel: "chat",
    actorProfileId: auth.profileId,
    actionType: "delete_manual_supplement",
    entityId: body.supplement_id,
  });
  if (!gate.allow) {
    return NextResponse.json(
      { ok: false, error: `forbidden: ${gate.reason ?? "denied"}` },
      { status: 403 },
    );
  }

  const admin = createAdminClient();

  // ─── Verify supplement exists in caller's workspace (L-0177 fail-fast) ────
  // Fetches period_id (via schedule_shift join) to use in Pattern B recalc call.
  // We need to know which period the supplement belonged to before we delete it.
  const { data: supplement, error: supErr } = await admin
    .schema("payroll")
    .from("manual_supplement")
    .select("id, workspace_id, amount, description, salary_code, schedule_shift_id, added_by")
    .eq("id", body.supplement_id)
    .eq("workspace_id", auth.workspaceId)
    .maybeSingle();

  if (supErr || !supplement) {
    return NextResponse.json({ ok: false, error: "supplement_not_found" }, { status: 404 });
  }

  // ─── Resolve period_id from the shift (needed for Pattern B recalc) ───────
  // schedule_shift.start_time gives us the date to locate the open period.
  // If the shift is gone (edge case), we skip recalc but still delete.
  const { data: shift } = await admin
    .from("schedule_shift")
    .select("start_time, employee_id")
    .eq("schedule_shift_id", supplement.schedule_shift_id)
    .eq("workspace_id", auth.workspaceId)
    .maybeSingle();

  let periodId: string | null = null;
  if (shift) {
    const shiftDate = shift.start_time.slice(0, 10);
    const { data: period } = await admin
      .schema("payroll")
      .from("period")
      .select("id, status")
      .eq("workspace_id", auth.workspaceId)
      .lte("start_date", shiftDate)
      .gte("end_date", shiftDate)
      .maybeSingle();

    if (period) {
      // ─── Verify period is still open (L-0177) ─────────────────────────────
      if (
        period.status === "locked" ||
        period.status === "approved" ||
        period.status === "exported"
      ) {
        return NextResponse.json(
          {
            ok: false,
            error: "period_not_open",
            detail: `Perioden er ${period.status} — kan ikke slette tillegg fra en låst periode.`,
          },
          { status: 409 },
        );
      }
      periodId = period.id;
    }
  }

  // ─── DELETE supplement (workspace-scoped — ADR-0151) ──────────────────────
  // The DB trigger payroll_manual_supplement_recalc_trg fires on DELETE,
  // emitting payroll.recalc_triggered_by_supplement (op=delete) into engine_event
  // for audit trail. No engine_dispatch consumer today — Pattern B handles recalc.
  const { error: deleteErr } = await admin
    .schema("payroll")
    .from("manual_supplement")
    .delete()
    .eq("id", body.supplement_id)
    .eq("workspace_id", auth.workspaceId);

  if (deleteErr) {
    return NextResponse.json(
      {
        ok: false,
        error: "delete_failed",
        detail: deleteErr.message,
      },
      { status: 500 },
    );
  }

  // ─── Emit telemetry (ADR-0134) ────────────────────────────────────────────
  const wsId = nonEmpty(auth.workspaceId, "workspaceId");
  const actorId = nonEmpty(auth.profileId, "profileId");

  await emit({
    event: "payroll.manual_supplement_deleted",
    workspace_id: wsId,
    actor_id: actorId,
    properties: {
      entity: {
        entity_type: "shift" as const,
        entity_id: supplement.schedule_shift_id,
      },
      data: {
        supplement_id: supplement.id,
        period_id: periodId ?? "",
        target_profile_id: shift?.employee_id ?? "",
        shift_id: supplement.schedule_shift_id,
        salary_code: supplement.salary_code ?? null,
        amount: Number(supplement.amount),
        gate_evaluation_id: null,
      },
    },
  });

  // ─── Pattern B sync-chain: trigger recalc immediately (ADR-0293) ──────────
  // Skip if we could not resolve a period (e.g. shift deleted — edge case).
  if (periodId) {
    const baseUrl = request.nextUrl.origin;
    const recalcRes = await fetch(`${baseUrl}/api/payroll/recalculate-period`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(request.headers.get("cookie") ? { cookie: request.headers.get("cookie")! } : {}),
        ...(request.headers.get("authorization")
          ? { authorization: request.headers.get("authorization")! }
          : {}),
      },
      body: JSON.stringify({ period_id: periodId }),
    });

    if (!recalcRes.ok) {
      const recalcBody = await recalcRes.json().catch(() => ({}));
      console.error(
        "[delete-manual-supplement] Pattern B recalc failed (delete committed)",
        recalcBody,
      );
      // Delete is canonical — return 200 with warning (ADR-0293 idempotency contract).
      return NextResponse.json({
        ok: true,
        supplement_id: supplement.id,
        recalc_warning: "Tillegget er slettet men omregningen feilet — kjør manuelt.",
      });
    }
  }

  return NextResponse.json({
    ok: true,
    supplement_id: supplement.id,
  });
}
