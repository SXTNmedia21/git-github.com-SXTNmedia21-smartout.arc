/**
 * BFF POST /api/tips/approve-distribution
 *
 * Approves a tip pool, locking all distributions and making them visible
 * to employees. Fronts the `tips.approve_distribution` capability
 * (confirm/manager).
 *
 * Phase 1 — BFF wire only. Capability body (Phase 2) returns
 * `{ ok: false, error: "not_implemented" }`. The gate check runs correctly.
 *
 * Approval transitions pool.status recorded → approved and sets
 * approved_by + approved_at + algorithm_version_at_approval on tip_pool.
 * Child tip_distribution rows flip to status='approved' in the same tx.
 * Once approved, pool + distributions are RLS-UPDATE-locked (Delta 7,
 * fact-check). tip_adjustment_log remains INSERT-only (audit, immutable).
 *
 * Invariants:
 *   - ADR-0151: workspace_id + profile_id server-derived; never from body.
 *   - ADR-0078 / ADR-0163: chat-only. Voice forbidden for tips (payroll PII).
 *   - ADR-0099 / ADR-0201: gate_action before any mutation.
 *   - ADR-0132: mobile routes through this BFF.
 *
 * Body schema mirrors `tipsApproveDistributionTool.schema`.
 */
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";

import { gateAction } from "@/app/dashboard/_actions/_shared";
import { rejectCrossOrigin, resolveTipsAuth } from "@/app/api/tips/_shared";

// Mirrors tipsApproveDistributionTool.schema — no identity fields (ADR-0151).
const RequestSchema = z.object({
  pool_id: z.string().uuid("pool_id must be a valid UUID"),
});

export const runtime = "nodejs";

export async function POST(request: NextRequest): Promise<NextResponse> {
  // 0. Same-origin guard.
  const cors = rejectCrossOrigin(request);
  if (cors) return cors;

  // 1. Auth — cookie (web) or Bearer (mobile). Server-derived identity
  //    per ADR-0151. Body must NOT carry workspace_id or profile_id.
  const auth = await resolveTipsAuth(request);
  if (!auth) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  // 2. Validate body. No identity fields.
  let body: z.infer<typeof RequestSchema>;
  try {
    const raw = await request.json();
    body = RequestSchema.parse(raw);
  } catch (err) {
    const message =
      err instanceof z.ZodError
        ? (err.errors[0]?.message ?? "Invalid request body")
        : "Invalid request body";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }

  // 3. C4 authority gate (ADR-0099 / ADR-0201). Channel pinned to "chat"
  //    per ADR-0078 (tips = payroll PII-adjacent, no voice).
  const gate = await gateAction({
    workspaceId: auth.workspaceId,
    capability: "tips.approve_distribution",
    channel: "chat",
    actorProfileId: auth.profileId,
    actionType: "update",
    entityId: body.pool_id,
  });
  if (!gate.allow) {
    return NextResponse.json(
      { ok: false, error: `capability_disabled: ${gate.reason ?? "forbidden"}` },
      { status: 403 },
    );
  }

  // Four-eyes check (Delta 11). Default requires_four_eyes=false for
  // tips.approve_distribution; surfaced here for when admin enables it.
  if (gate.four_eyes_required) {
    return NextResponse.json(
      {
        ok: false,
        error: "four_eyes_required",
        approvers_needed: gate.approvers_needed,
      },
      { status: 403 },
    );
  }

  // 4. Phase 1: capability body lands in Phase 2. Passes not_implemented
  //    back so the BFF→capability wire is provably connected.
  //    Phase 2 performs (in one transaction):
  //      UPDATE tip_pool SET status='approved', approved_by=$1, approved_at=now(),
  //             algorithm_version_at_approval=$2 WHERE id=$3 AND status='recorded'
  //      UPDATE tip_distribution SET status='approved' WHERE pool_id=$3
  //    Telemetry (emit "tip_pool approved") stays in capability layer.
  //
  //    already_approved error: phase 2 will surface { ok:false, error:"already_approved" }
  //    when pool.status is not 'recorded' (Delta 7 / state machine §10).
  return NextResponse.json(
    {
      ok: false,
      error: "not_implemented",
      note: "Phase 2 (tips-leader-flows) will fill the capability body",
      surface: auth.surface,
    },
    { status: 501 },
  );
}
