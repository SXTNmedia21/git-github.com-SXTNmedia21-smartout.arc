/**
 * BFF POST /api/tips/adjust-share
 *
 * Adjusts a single employee's tip distribution amount with a mandatory reason.
 * Fronts the `tips.adjust_share` capability (confirm/manager).
 *
 * Phase 1 — BFF wire only. Capability body (Phase 2) returns
 * `{ ok: false, error: "not_implemented" }`. The gate check runs correctly.
 *
 * Adjustment writes both tip_distribution.adjusted_amount + a new
 * tip_adjustment_log row in the same transaction (Delta 8, fact-check).
 * Reason must be >= 5 chars (DB CHECK — also enforced in Zod schema).
 * Pool must be status='recorded' — if approved/paid/voided, RLS UPDATE
 * policy rejects (Delta 7, fact-check).
 *
 * Invariants:
 *   - ADR-0151: workspace_id + profile_id server-derived; never from body.
 *   - ADR-0078 / ADR-0163: chat-only. Voice forbidden for tips (payroll PII).
 *   - ADR-0099 / ADR-0201: gate_action before any mutation.
 *   - ADR-0132: mobile routes through this BFF.
 *
 * Body schema mirrors `tipsAdjustShareTool.schema`.
 */
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";

import { gateAction } from "@/app/dashboard/_actions/_shared";
import { rejectCrossOrigin, resolveTipsAuth } from "@/app/api/tips/_shared";

// Mirrors tipsAdjustShareTool.schema — no identity fields (ADR-0151).
// reason min(5) matches DB CHECK constraint (Delta 12, fact-check).
const RequestSchema = z.object({
  distribution_id: z.string().uuid("distribution_id must be a valid UUID"),
  new_amount: z.number().min(0, "new_amount must be >= 0"),
  reason: z.string().min(5, "reason must be at least 5 characters"),
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
    capability: "tips.adjust_share",
    channel: "chat",
    actorProfileId: auth.profileId,
    actionType: "update",
    entityId: body.distribution_id,
  });
  if (!gate.allow) {
    return NextResponse.json(
      { ok: false, error: `capability_disabled: ${gate.reason ?? "forbidden"}` },
      { status: 403 },
    );
  }

  // Four-eyes check (Delta 11). Default requires_four_eyes=false for
  // tips.adjust_share; exposed here for when admin enables it later.
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
  //    Phase 2 performs:
  //      UPDATE tip_distribution SET adjusted_amount=$1, adjustment_reason=$2
  //      INSERT tip_adjustment_log (distribution_id, changed_by, old_amount, new_amount, reason)
  //    Both in the same transaction. Telemetry (emit "tip_distribution adjusted")
  //    stays in capability layer, NOT here.
  //
  //    pool_locked error: RLS UPDATE policy on tip_distribution checks
  //    pool.status != 'approved' — Phase 2 will surface that as
  //    { ok: false, error: "pool_locked" } (Delta 7).
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
