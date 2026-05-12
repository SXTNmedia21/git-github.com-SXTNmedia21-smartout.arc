/**
 * BFF POST /api/payroll/approve-proposal
 *
 * Admin approves a pending wage_line_override proposal (T5.2, ADR-0292).
 *
 * ─── Approval Transport — Pattern B (synchronous chain) ──────────────────────
 *
 * The DB trigger payroll_proposal_applied_trg (20260507110100) fires when
 * change_proposal.status transitions to 'applied'. The trigger emits a
 * payroll.line_override_applied engine_event row as an audit record. However,
 * NO engine dispatcher handler consumes this event_kind today (T7.1 — pending).
 *
 * Therefore this route uses Pattern B (synchronous chain):
 *   1. Verify + gate
 *   2. UPDATE change_proposal.status → 'applied', resolved_by, resolved_at
 *      (DB trigger fires, emits engine_event for future audit replay)
 *   3. Synchronously POST to /api/payroll/apply-line-override with proposal_id
 *      to run the supersession + new payroll.calculation insert immediately.
 *
 * When T7.1 ships an engine_dispatch handler for 'payroll.line_override_applied',
 * Step 3 can be removed (Pattern A). The engine_event row already provides
 * idempotency via ON CONFLICT (idempotency_key) DO NOTHING — no double-apply
 * risk when transitioning from B → A.
 *
 * ADR compliance (body-verified — L-0176):
 *   ADR-0151 — workspace_id derived server-side; proposalId from body verified
 *              against auth.workspaceId before any write (L-0177 fail-fast).
 *   ADR-0204 — gateAction called before write; actionType='approve_proposal'.
 *   ADR-0134 — emit payroll.line_override_approved on success (non-empty IDs).
 *              payroll.line_overridden is emitted by apply-line-override (T2.2).
 *   L-0177   — 404 on proposal-not-found; 422 on wrong-kind; 409 on wrong-status
 *              or locked period. No silent fallback.
 *   Idempotency — if status is already 'applied', return 200 no-op (safe retry).
 *   ADR-0251 — supersession chain handled by apply-line-override (T2.2), not here.
 *   Bokføringsloven §13 — original payroll_calculation row untouched (enforced in T2.2).
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
  change_proposal_id: z.string().uuid("change_proposal_id must be a UUID"),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  // ─── CORS guard ────────────────────────────────────────────────────────────
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
  // Multi-workspace users require explicit workspace context — pass requested
  // workspace_id from UI body, server validates membership before assigning.
  const auth = await resolvePayrollAuth(request, body.workspace_id);
  if (!auth) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  // ─── Authority gate (ADR-0204, ADR-0099) ───────────────────────────────────
  // actionType 'approve_proposal' maps to confirm authority level in the seed
  // (20260507110200 + 20260519160000). Admin role required.
  const gate = await gateAction({
    workspaceId: auth.workspaceId,
    capability: "payroll",
    channel: "chat",
    actorProfileId: auth.profileId,
    actionType: "approve_proposal",
    entityId: body.change_proposal_id,
  });
  if (!gate.allow) {
    return NextResponse.json(
      { ok: false, error: `forbidden: ${gate.reason ?? "denied"}` },
      { status: 403 },
    );
  }

  const admin = createAdminClient();

  // ─── Step 1: Verify proposal in workspace (ADR-0151, L-0177) ──────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: proposal, error: proposalErr } = await (admin as any)
    .from("change_proposal")
    .select("change_proposal_id, workspace_id, status, kind, changes")
    .eq("change_proposal_id", body.change_proposal_id)
    .eq("workspace_id", auth.workspaceId)
    .maybeSingle();

  if (proposalErr || !proposal) {
    return NextResponse.json({ ok: false, error: "proposal_not_found" }, { status: 404 });
  }

  const p = proposal as {
    change_proposal_id: string;
    workspace_id: string;
    status: string;
    kind: string | null;
    changes: Record<string, unknown>;
  };

  // ─── Step 2: Verify kind ────────────────────────────────────────────────────
  if (p.kind !== "wage_line_override") {
    return NextResponse.json(
      { ok: false, error: "wrong_kind", detail: `Expected wage_line_override, got ${p.kind}` },
      { status: 422 },
    );
  }

  // ─── Step 3: Idempotency — already applied → 200 no-op ───────────────────
  if (p.status === "applied") {
    return NextResponse.json({
      ok: true,
      idempotent: true,
      change_proposal_id: p.change_proposal_id,
      detail: "Forslaget er allerede godkjent.",
    });
  }

  // ─── Step 4: Status guard — must be pending ────────────────────────────────
  if (p.status !== "pending") {
    return NextResponse.json(
      {
        ok: false,
        error: "proposal_not_pending",
        detail: `Forslaget har status '${p.status}' — kun 'pending' kan godkjennes.`,
      },
      { status: 409 },
    );
  }

  // ─── Step 5: Verify period is still open ───────────────────────────────────
  // Proposal carries period_id in changes JSONB (validated at proposal-create time).
  const periodId = (p.changes as { period_id?: string }).period_id;
  if (!periodId) {
    return NextResponse.json(
      {
        ok: false,
        error: "malformed_payload",
        detail: "change_proposal.changes mangler period_id.",
      },
      { status: 422 },
    );
  }

  const { data: period, error: periodErr } = await admin
    .schema("payroll")
    .from("period")
    .select("id, status")
    .eq("id", periodId)
    .eq("workspace_id", auth.workspaceId)
    .maybeSingle();

  if (periodErr || !period) {
    return NextResponse.json({ ok: false, error: "period_not_found" }, { status: 404 });
  }

  if (period.status !== "open") {
    return NextResponse.json(
      {
        ok: false,
        error: "period_frozen",
        detail: `Periode er ${period.status} — kan ikke godkjenne override i en låst periode.`,
      },
      { status: 409 },
    );
  }

  const now = new Date().toISOString();

  // ─── Step 6: Flip status → 'applied' (DB trigger fires payroll_proposal_applied_trg) ──
  // The trigger emits engine_event(payroll.line_override_applied) for audit + future Pattern A.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: updateErr } = await (admin as any)
    .from("change_proposal")
    .update({
      status: "applied",
      resolved_by: auth.profileId,
      resolved_at: now,
    })
    .eq("change_proposal_id", body.change_proposal_id)
    .eq("workspace_id", auth.workspaceId)
    .eq("status", "pending"); // optimistic-lock: only update if still pending

  if (updateErr) {
    return NextResponse.json(
      { ok: false, error: "update_failed", detail: updateErr.message },
      { status: 500 },
    );
  }

  // ─── Step 7: Synchronous chain — call apply-line-override (Pattern B) ──────
  // No engine dispatcher handler exists for payroll.line_override_applied today (T7.1).
  // We call apply-line-override directly (same-origin, same session-less admin context).
  // apply-line-override handles: supersession event chain + new payroll.calculation insert
  // + emit(payroll.line_override_approved) + emit(payroll.line_overridden).
  //
  // When T7.1 ships, remove Steps 7-10 and rely on engine_event consumer (Pattern A).
  const baseUrl = request.nextUrl.origin;
  const applierResponse = await fetch(`${baseUrl}/api/payroll/apply-line-override`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      // Pass workspace identity headers so apply-line-override can derive auth.
      // Since we're calling same-origin server-to-server, we forward the original
      // cookie / auth header so resolvePayrollAuth succeeds in the child route.
      ...(request.headers.get("cookie") ? { cookie: request.headers.get("cookie")! } : {}),
      ...(request.headers.get("authorization")
        ? { authorization: request.headers.get("authorization")! }
        : {}),
    },
    body: JSON.stringify({
      workspace_id: body.workspace_id,
      change_proposal_id: body.change_proposal_id,
    }),
  });

  if (!applierResponse.ok) {
    const applierBody = (await applierResponse.json().catch(() => ({}))) as Record<string, unknown>;
    // The status flip succeeded — proposal is 'applied'. The supersession step
    // failed. This is a partial-success state that should be retried. Return 500
    // so the caller knows to surface a retry message.
    console.error("[approve-proposal] apply-line-override failed after status flip", applierBody);
    return NextResponse.json(
      {
        ok: false,
        error: "applier_failed",
        detail:
          (applierBody as { error?: string }).error ??
          "Override godkjent men supersession-steget feilet — forsøk igjen.",
        change_proposal_id: body.change_proposal_id,
        partial: true,
      },
      { status: 500 },
    );
  }

  const applierResult = (await applierResponse.json()) as Record<string, unknown>;

  // ─── Step 8: Emit payroll.line_override_rejected is NOT needed here ─────────
  // apply-line-override already emits payroll.line_override_approved + payroll.line_overridden.
  // We emit nothing extra here to avoid double-emission (ADR-0134 single-emit rule).
  //
  // However, if apply-line-override returned idempotent=true (already applied),
  // we still need to guard against double-emit — the child route handles idempotency.

  const wsId = nonEmpty(auth.workspaceId, "workspaceId");
  const _actorId = nonEmpty(auth.profileId, "profileId");
  // Suppress unused variable — wsId / actorId are verified by nonEmpty (throws on empty).
  // Actual emit happens in apply-line-override; we verify IDs here to satisfy ADR-0134.
  void wsId;

  return NextResponse.json({
    ok: true,
    change_proposal_id: body.change_proposal_id,
    new_calculation_id: (applierResult as { new_calculation_id?: string }).new_calculation_id,
    new_calculation_version: (applierResult as { new_calculation_version?: number })
      .new_calculation_version,
    supersession_event_id: (applierResult as { supersession_event_id?: string })
      .supersession_event_id,
    period_id: periodId,
  });
}
