/**
 * BFF POST /api/tips/approve-distribution
 *
 * Approves a tip pool, locking all distributions and making them visible
 * to employees. Fronts the `tips.approve_distribution` capability
 * (confirm/manager).
 *
 * Phase 2 — BFF mutation body. Council verdict 2026-04-29 (ADR-0229):
 * BFF owns writes directly. The SECURITY DEFINER RPC `approve_tip_pool`
 * handles the atomic pool + distribution state transition (migration
 * 20260429010000_approve_tip_pool_rpc.sql). Capability skeletons stay
 * not_implemented (ADR-0196 invariant 11 — no phantom emit from skeleton).
 *
 * Write sequence:
 *   1. Call SECURITY DEFINER RPC approve_tip_pool(pool_id, actor_profile_id).
 *      RPC atomically: asserts workspace match + state='recorded', flips
 *      distributions to 'approved' (BEFORE pool update to avoid RLS race),
 *      flips pool to 'approved', returns jsonb summary.
 *   2. Map RPC SQLSTATE 'P0001' messages to HTTP error codes.
 *   3. Emit tip_pool approved (4 destinations).
 *      DB trigger payroll_tip_distribution_recalc_trg fires on the approved
 *      tip_distribution rows (INSERT status='approved' path), emitting
 *      payroll.recalc_triggered_by_tip_distribution into engine_event for audit.
 *   4. Synchronously POST to /api/payroll/recalculate-period (Pattern B, ADR-0293).
 *      Resolves period_id via department_session.session_date. Recalc failure
 *      is best-effort — approval is canonical; non-200 logged, 200 returned.
 *   5. Return 200 with RPC summary.
 *
 * Invariants:
 *   - ADR-0151: workspace_id + profile_id server-derived; never from body.
 *   - ADR-0078 / ADR-0163: tips PII-adjacent payroll — chat-only, no voice.
 *   - ADR-0099 / ADR-0201: gate_action before any mutation.
 *   - ADR-0196 invariant 11: no emit before RPC returns success.
 *   - ADR-0132: mobile routes through this BFF.
 *   - ADR-0229: BFF owns writes; SECURITY DEFINER RPC for atomic approval.
 *   - ADR-0293: Pattern B sync-chain recalculate-period after approval.
 */
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";

import { gateAction } from "@/app/dashboard/_actions/_shared";
import { rejectCrossOrigin, resolveTipsAuth } from "@/app/api/tips/_shared";
import { createAdminClient } from "@smartout/supabase/admin";
import { emit, nonEmpty } from "@smartout/telemetry";

// Mirrors tipsApproveDistributionTool.schema — no identity fields (ADR-0151).
const RequestSchema = z.object({
  pool_id: z.string().uuid("pool_id must be a valid UUID"),
});

// Shape returned by the SECURITY DEFINER RPC (approve_tip_pool).
type RpcResult = {
  pool_id: string;
  department_session_id: string;
  total_distributed: number;
  distribution_count: number;
  adjustment_count: number;
  algorithm: string;
};

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

  // 4. Call SECURITY DEFINER RPC — handles atomic pool + distribution approval.
  //    Uses admin client (service_role) for cleaner telemetry and to ensure
  //    the RPC runs without JWT-row-level filtering inside the function body.
  //    The RPC body itself validates workspace membership and pool state.
  //    ADR-0229: RPC is the only correct path for this transition.
  const admin = createAdminClient();

  const { data: rpcData, error: rpcError } = await admin.rpc("approve_tip_pool", {
    p_pool_id: body.pool_id,
    p_actor_profile_id: auth.profileId,
  });

  if (rpcError) {
    // Map SQLSTATE 'P0001' RAISE EXCEPTION messages to HTTP codes.
    // PostgreSQL RAISE EXCEPTION with ERRCODE 'P0001' surfaces the message
    // text via error.message from the Supabase client.
    const msg = rpcError.message ?? "";

    if (msg.includes("invalid_state")) {
      return NextResponse.json({ ok: false, error: "invalid_state" }, { status: 409 });
    }
    if (msg.includes("already_approved")) {
      return NextResponse.json({ ok: false, error: "already_approved" }, { status: 409 });
    }
    if (msg.includes("workspace_mismatch")) {
      return NextResponse.json({ ok: false, error: "workspace_mismatch" }, { status: 403 });
    }
    if (msg.includes("pool_not_found")) {
      return NextResponse.json({ ok: false, error: "pool_not_found" }, { status: 404 });
    }

    // Unknown PG error.
    console.error("[tips/approve-distribution] RPC error:", rpcError);
    return NextResponse.json({ ok: false, error: "rpc_error" }, { status: 500 });
  }

  // RPC returns jsonb — cast from unknown.
  const result = rpcData as unknown as RpcResult;

  // 5. Emit AFTER RPC returns success (ADR-0196 invariant 11).
  //    tip_pool approved — 4 destinations: posthog + logger + activity_trail + engine_event.
  //    Payload schema from packages/telemetry/src/registry.ts:5789-5805.
  void emit({
    event: "tip_pool approved",
    workspace_id: nonEmpty(auth.workspaceId, "workspace_id"),
    actor_id: nonEmpty(auth.profileId, "actor_id"),
    properties: {
      entity: {
        entity_type: "tip_pool",
        entity_id: body.pool_id,
        entity_label: `Tips-godkjenning — ${result.department_session_id ?? body.pool_id}`,
      },
      data: {
        pool_id: body.pool_id,
        department_session_id: result.department_session_id,
        total_distributed: Number(result.total_distributed),
        distribution_count: Number(result.distribution_count),
        adjustment_count: Number(result.adjustment_count),
      },
    },
  });

  // 6. Pattern B sync-chain — trigger payroll recalc immediately (ADR-0293).
  //    The DB trigger payroll_tip_distribution_recalc_trg fires on the
  //    approved tip_distribution rows, emitting payroll.recalc_triggered_by_tip_distribution
  //    into engine_event. No engine_dispatch consumer exists today (T7.1 GAP),
  //    so we resolve the payroll period and call recalculate-period synchronously.
  //
  //    Resolution path: pool_id → department_session.session_date →
  //    payroll.period WHERE lte(start_date, session_date) AND gte(end_date, session_date).
  //
  //    Idempotency: approval is canonical. Recalc failure = best-effort sync.
  //    Non-200 recalc is logged but 200 is returned to caller (ADR-0293).
  let periodId: string | null = null;
  if (result.department_session_id) {
    const { data: session } = await admin
      .from("department_session")
      .select("session_date, workspace_id")
      .eq("id", result.department_session_id)
      .eq("workspace_id", auth.workspaceId)
      .maybeSingle();

    if (session?.session_date) {
      const sessionDate = session.session_date.slice(0, 10);
      const { data: period } = await admin
        .schema("payroll")
        .from("period")
        .select("id, status")
        .eq("workspace_id", auth.workspaceId)
        .lte("start_date", sessionDate)
        .gte("end_date", sessionDate)
        .maybeSingle();

      if (period && period.status !== "locked" && period.status !== "approved") {
        periodId = period.id;
      }
    }
  }

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
        "[tips/approve-distribution] Pattern B recalc failed (approval committed)",
        recalcBody,
      );
      // Approval is canonical — return 200 with warning (ADR-0293).
      return NextResponse.json({
        ok: true,
        pool_id: body.pool_id,
        department_session_id: result.department_session_id,
        total_distributed: Number(result.total_distributed),
        distribution_count: Number(result.distribution_count),
        adjustment_count: Number(result.adjustment_count),
        surface: auth.surface,
        recalc_warning: "Tips godkjent men lønnsomregningen feilet — kjør manuelt.",
      });
    }
  }

  // 7. Return 200 with full RPC summary.
  return NextResponse.json({
    ok: true,
    pool_id: body.pool_id,
    department_session_id: result.department_session_id,
    total_distributed: Number(result.total_distributed),
    distribution_count: Number(result.distribution_count),
    adjustment_count: Number(result.adjustment_count),
    surface: auth.surface,
  });
}
