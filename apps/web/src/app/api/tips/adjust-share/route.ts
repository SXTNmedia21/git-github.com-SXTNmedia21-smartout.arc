/**
 * BFF POST /api/tips/adjust-share
 *
 * Adjusts a single employee's tip distribution amount with a mandatory reason.
 * Fronts the `tips.adjust_share` capability (confirm/manager).
 *
 * Phase 2 — BFF mutation body. Council verdict 2026-04-29 (ADR-0229):
 * BFF owns writes directly. Capability skeletons stay not_implemented (ADR-0196).
 *
 * Write sequence (both writes complete before any emit per ADR-0196 inv 11):
 *   1. SELECT tip_distribution + parent pool status (workspace-scoped).
 *   2. Assert pool.status='recorded'; else return pool_locked (Delta 7).
 *   3. Compute old_amount = adjusted_amount ?? calculated_amount.
 *   4. UPDATE tip_distribution SET adjusted_amount + adjustment_reason.
 *   5. INSERT tip_adjustment_log (distribution_id, changed_by, old_amount, new_amount, reason).
 *   6. Emit tip_distribution adjusted (4 destinations).
 *   7. Return 200.
 *
 * Note: Supabase JS does not expose multi-statement DB transactions.
 * Both writes are sequential within this handler. If INSERT into
 * tip_adjustment_log fails after UPDATE, the distribution row is already
 * mutated — a partially-compensating UPDATE to restore old_amount is
 * attempted on error but cannot be guaranteed atomic. A future DB-level
 * RPC (Phase 3 hardening) would wrap both in a true PG transaction.
 *
 * Invariants:
 *   - ADR-0151: workspace_id + profile_id server-derived; never from body.
 *   - ADR-0078 / ADR-0163: tips PII-adjacent payroll — chat-only, no voice.
 *   - ADR-0099 / ADR-0201: gate_action before any mutation.
 *   - ADR-0196 invariant 11: no emit before all DB writes commit.
 *   - ADR-0132: mobile routes through this BFF.
 *   - ADR-0229: BFF owns writes; capability skeletons stay not_implemented.
 */
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";

import { gateAction } from "@/app/dashboard/_actions/_shared";
import { rejectCrossOrigin, resolveTipsAuth } from "@/app/api/tips/_shared";
import { createAdminClient } from "@smartout/supabase/admin";
import { emit, nonEmpty } from "@smartout/telemetry";

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

  // 4. Load distribution + parent pool status. Workspace-scope enforced.
  const admin = createAdminClient();

  const { data: dist, error: distFetchErr } = await admin
    .from("tip_distribution")
    .select("id, pool_id, profile_id, calculated_amount, adjusted_amount, workspace_id")
    .eq("id", body.distribution_id)
    .eq("workspace_id", auth.workspaceId) // scope guard
    .maybeSingle();

  if (distFetchErr || !dist) {
    return NextResponse.json({ ok: false, error: "distribution_not_found" }, { status: 404 });
  }

  // 5. Check parent pool status. RLS UPDATE policy blocks when pool is
  //    approved/paid/voided — pre-check here for a clean error message (Delta 7).
  const { data: poolStatus, error: poolFetchErr } = await admin
    .from("tip_pool")
    .select("status")
    .eq("id", dist.pool_id)
    .eq("workspace_id", auth.workspaceId)
    .maybeSingle();

  if (poolFetchErr || !poolStatus) {
    return NextResponse.json({ ok: false, error: "pool_not_found" }, { status: 404 });
  }

  if (poolStatus.status !== "recorded") {
    return NextResponse.json({ ok: false, error: "pool_locked" }, { status: 409 });
  }

  // 6. Compute old_amount — prefer existing adjusted_amount if present.
  const oldAmount =
    dist.adjusted_amount !== null ? Number(dist.adjusted_amount) : Number(dist.calculated_amount);

  // 7. UPDATE tip_distribution — set adjusted_amount + adjustment_reason.
  //    DB CHECK chk_tip_dist_adjustment enforces both set together.
  const { error: updateErr } = await admin
    .from("tip_distribution")
    .update({
      adjusted_amount: body.new_amount,
      adjustment_reason: body.reason,
    })
    .eq("id", body.distribution_id)
    .eq("workspace_id", auth.workspaceId);

  if (updateErr) {
    // RLS UPDATE rejection: pool_id IN (SELECT id FROM tip_pool WHERE status!='approved')
    // — race condition; pool was approved between our check and this write.
    return NextResponse.json({ ok: false, error: "pool_locked" }, { status: 409 });
  }

  // 8. INSERT tip_adjustment_log — INSERT-only audit (no UPDATE/DELETE policy).
  //    If this fails, distribution is already updated. Attempt compensating
  //    revert but do not guarantee atomicity (Phase 3 hardening: wrap in RPC).
  const { error: logErr } = await admin.from("tip_adjustment_log").insert({
    workspace_id: auth.workspaceId,
    distribution_id: body.distribution_id,
    changed_by: auth.profileId,
    old_amount: oldAmount,
    new_amount: body.new_amount,
    reason: body.reason,
  });

  if (logErr) {
    // Compensating revert (best-effort, not guaranteed atomic).
    await admin
      .from("tip_distribution")
      .update({
        adjusted_amount: dist.adjusted_amount,
        adjustment_reason: null,
      })
      .eq("id", body.distribution_id)
      .eq("workspace_id", auth.workspaceId);

    return NextResponse.json(
      { ok: false, error: logErr.message ?? "log_insert_error" },
      { status: 500 },
    );
  }

  // 9. Emit AFTER both DB writes succeed (ADR-0196 invariant 11).
  //    tip_distribution adjusted — 4 destinations: posthog + logger + activity_trail + engine_event.
  //    Payload schema from packages/telemetry/src/registry.ts:5770-5787.
  void emit({
    event: "tip_distribution adjusted",
    workspace_id: nonEmpty(auth.workspaceId, "workspace_id"),
    actor_id: nonEmpty(auth.profileId, "actor_id"),
    properties: {
      entity: {
        entity_type: "tip_distribution",
        entity_id: body.distribution_id,
        entity_label: `Tips-justering — ${dist.profile_id}`,
      },
      data: {
        distribution_id: body.distribution_id,
        pool_id: dist.pool_id,
        profile_id: dist.profile_id,
        old_amount: oldAmount,
        new_amount: body.new_amount,
        reason: body.reason,
      },
    },
  });

  // 10. Return 200.
  return NextResponse.json({
    ok: true,
    distribution_id: body.distribution_id,
    old_amount: oldAmount,
    new_amount: body.new_amount,
    surface: auth.surface,
  });
}
