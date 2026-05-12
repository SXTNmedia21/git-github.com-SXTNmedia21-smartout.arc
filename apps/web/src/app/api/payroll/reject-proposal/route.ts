/**
 * BFF POST /api/payroll/reject-proposal
 *
 * Admin rejects a pending wage_line_override proposal (T5.2).
 *
 * On success:
 *   - change_proposal.status → 'rejected'
 *   - resolved_by + resolved_at populated
 *   - Emits payroll.line_override_rejected (ADR-0134)
 *
 * No supersession chain fires on reject — the original payroll_calculation row
 * remains unchanged. The proposal sits as 'rejected' with audit reason.
 *
 * ADR compliance (body-verified — L-0176):
 *   ADR-0151 — workspace_id derived server-side; proposal verified against workspace.
 *   ADR-0204 — gateAction called before write; actionType='reject_proposal'.
 *   ADR-0134 — emit payroll.line_override_rejected on success (non-empty IDs).
 *   L-0177   — 404 on proposal-not-found; 422 on wrong-kind; 409 on wrong-status.
 *   Idempotency — if status is already 'rejected', return 200 no-op.
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
  rejection_reason: z
    .string()
    .min(1, "Avvisningsgrunn er påkrevd")
    .max(1000, "Grunn kan ikke overstige 1000 tegn"),
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
  const gate = await gateAction({
    workspaceId: auth.workspaceId,
    capability: "payroll",
    channel: "chat",
    actorProfileId: auth.profileId,
    actionType: "reject_proposal",
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

  // ─── Step 3: Idempotency — already rejected → 200 no-op ──────────────────
  if (p.status === "rejected") {
    return NextResponse.json({
      ok: true,
      idempotent: true,
      change_proposal_id: p.change_proposal_id,
      detail: "Forslaget er allerede avvist.",
    });
  }

  // ─── Step 4: Status guard — must be pending ────────────────────────────────
  if (p.status !== "pending") {
    return NextResponse.json(
      {
        ok: false,
        error: "proposal_not_pending",
        detail: `Forslaget har status '${p.status}' — kun 'pending' kan avvises.`,
      },
      { status: 409 },
    );
  }

  const now = new Date().toISOString();
  const calculationId = (p.changes as { calculation_id?: string }).calculation_id;
  const periodId = (p.changes as { period_id?: string }).period_id;

  // ─── Step 5: UPDATE status → 'rejected' ───────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: updateErr } = await (admin as any)
    .from("change_proposal")
    .update({
      status: "rejected",
      resolved_by: auth.profileId,
      resolved_at: now,
      // Store rejection reason in changes JSONB alongside original payload fields
      changes: {
        ...(p.changes as Record<string, unknown>),
        rejection_reason: body.rejection_reason,
        rejected_by: auth.profileId,
        rejected_at: now,
      },
    })
    .eq("change_proposal_id", body.change_proposal_id)
    .eq("workspace_id", auth.workspaceId)
    .eq("status", "pending"); // optimistic-lock

  if (updateErr) {
    return NextResponse.json(
      { ok: false, error: "update_failed", detail: updateErr.message },
      { status: 500 },
    );
  }

  // ─── Step 6: Emit payroll.line_override_rejected (ADR-0134) ───────────────
  const wsId = nonEmpty(auth.workspaceId, "workspaceId");
  const actorId = nonEmpty(auth.profileId, "profileId");

  await emit({
    event: "payroll.line_override_rejected",
    workspace_id: wsId,
    actor_id: actorId,
    properties: {
      entity: {
        entity_type: "change_proposal" as const,
        entity_id: body.change_proposal_id,
      },
      data: {
        change_proposal_id: body.change_proposal_id,
        calculation_id: calculationId ?? "",
        period_id: periodId ?? "",
        resolved_by_profile_id: auth.profileId,
        rejection_reason: body.rejection_reason,
        gate_evaluation_id: null,
      },
    },
  });

  return NextResponse.json({
    ok: true,
    change_proposal_id: body.change_proposal_id,
    status: "rejected",
  });
}
