/**
 * BFF POST /api/tips/set-pot
 *
 * Registers a tip pool for a department session and calculates the initial
 * distribution. Fronts the `tips.set_pot` capability (suggest/manager).
 *
 * Phase 2 — BFF mutation body. Council verdict 2026-04-29 (ADR-0229):
 * BFF owns writes directly. Capability skeletons stay not_implemented (ADR-0196).
 *
 * Write sequence (all-or-nothing — fail before any emit):
 *   1. Resolve active tip_policy for session's department + date.
 *   2. Query shifts for the session's department + date.
 *   3. Call calculate(amount_nok, shifts, policy) → Distribution[].
 *   4. INSERT tip_pool (status='recorded') → pool_id.
 *   5. Bulk INSERT tip_distribution rows (status='calculated').
 *   6. Emit tip_pool created (4 destinations).
 *   7. Emit N × tip_distribution calculated (2 destinations).
 *   8. Return 200.
 *
 * Schema deviation (confirmed 2026-04-29, migration read):
 *   - schedule_shift has NO department_session_id column. Shifts are
 *     linked via department_id + shift_date = department_session.session_date.
 *   - schedule_shift actor column is employee_id (= profile FK), not profile_id.
 *   - schedule_shift hours column is work_hours (not hours_worked).
 *   - department_session date column is session_date (not business_date).
 *   Documented in commit body per brief requirement.
 *
 * Invariants:
 *   - ADR-0151: workspace_id + profile_id server-derived; never from body.
 *   - ADR-0078 / ADR-0163: tips PII-adjacent payroll — chat-only, no voice.
 *   - ADR-0099 / ADR-0201: gate_action before any mutation.
 *   - ADR-0196 invariant 11: no emit before DB writes commit. No partial emit.
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
import { calculate } from "@smartout/ai/capabilities/tips/calculate";
import type { Policy, Shift } from "@smartout/ai/capabilities/tips/calculate";

// Mirrors tipsSetPotTool.schema — no identity fields (ADR-0151).
const RequestSchema = z.object({
  department_session_id: z.string().uuid("department_session_id must be a valid UUID"),
  amount_nok: z.number().min(0, "amount_nok must be >= 0"),
  notes: z.string().optional(),
});

export const runtime = "nodejs";

export async function POST(request: NextRequest): Promise<NextResponse> {
  // 0. Same-origin guard.
  const cors = rejectCrossOrigin(request);
  if (cors) return cors;

  // 1. Auth — cookie (web) or Bearer (mobile). Derives workspace + profile
  //    server-side per ADR-0151. Never trust body for identity.
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

  // 3. C4 authority gate (ADR-0099 / ADR-0201). Channel is "chat" because
  //    tips are PII-adjacent payroll data (ADR-0078 / ADR-0163).
  const gate = await gateAction({
    workspaceId: auth.workspaceId,
    capability: "tips.set_pot",
    channel: "chat",
    actorProfileId: auth.profileId,
    actionType: "insert",
  });
  if (!gate.allow) {
    return NextResponse.json(
      { ok: false, error: `capability_disabled: ${gate.reason ?? "forbidden"}` },
      { status: 403 },
    );
  }

  // Four-eyes check (Delta 11 from fact-check). Default requires_four_eyes=false.
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

  // 4. Load department_session → department_id + session_date.
  //    Admin client: service-role read bypasses RLS on department_session for
  //    cross-table reads. Workspace-scope asserted via auth.workspaceId below.
  const admin = createAdminClient();

  const { data: session, error: sessionErr } = await admin
    .from("department_session")
    .select("department_session_id, department_id, session_date, workspace_id")
    .eq("department_session_id", body.department_session_id)
    .eq("workspace_id", auth.workspaceId) // scope guard
    .maybeSingle();

  if (sessionErr || !session) {
    return NextResponse.json({ ok: false, error: "session_not_found" }, { status: 404 });
  }

  // 5. Load active tip_policy for department + session date.
  //    tip_policy uses active_from/active_to date range (not TIMESTAMPTZ).
  const { data: policyRow, error: policyErr } = await admin
    .from("tip_policy")
    .select("id, method, workspace_id")
    .eq("workspace_id", auth.workspaceId)
    .eq("department_id", session.department_id)
    .lte("active_from", session.session_date)
    .or(`active_to.is.null,active_to.gte.${session.session_date}`)
    .order("active_from", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (policyErr || !policyRow) {
    return NextResponse.json({ ok: false, error: "no_active_policy" }, { status: 422 });
  }

  // 6. Build Policy object — load role weights for by_role method.
  let policy: Policy;
  if (policyRow.method === "by_role") {
    const { data: weightRows, error: weightErr } = await admin
      .from("tip_role_weight")
      .select("role, weight")
      .eq("policy_id", policyRow.id);

    if (weightErr) {
      return NextResponse.json({ ok: false, error: "policy_weights_unavailable" }, { status: 500 });
    }

    const weights: Record<string, number> = {};
    for (const w of weightRows ?? []) {
      weights[w.role] = Number(w.weight);
    }
    policy = { method: "by_role", weights };
  } else {
    policy = { method: policyRow.method as "equal" | "by_hours" };
  }

  // 7. Load shifts for the session's department + date.
  //    Schema deviation: schedule_shift has no department_session_id.
  //    Join: department_id (Cascade D1 column, migration 20260421100350)
  //    + shift_date = session.session_date.
  //    Actor column: employee_id (FK to profile.profile_id).
  //    Hours column: work_hours (not hours_worked).
  const { data: shiftRows, error: shiftErr } = await admin
    .from("schedule_shift")
    .select("schedule_shift_id, employee_id, role, work_hours")
    .eq("workspace_id", auth.workspaceId)
    .eq("department_id", session.department_id)
    .eq("shift_date", session.session_date)
    .not("employee_id", "is", null); // exclude unassigned shifts

  if (shiftErr) {
    return NextResponse.json({ ok: false, error: "shifts_unavailable" }, { status: 500 });
  }

  const shifts: Shift[] = (shiftRows ?? []).map((s) => ({
    profile_id: s.employee_id as string,
    role: s.role,
    hours_worked: Number(s.work_hours),
  }));

  if (shifts.length === 0) {
    return NextResponse.json({ ok: false, error: "no_shifts" }, { status: 422 });
  }

  // 8. Calculate distribution (pure, no side effects).
  const distributions = calculate(body.amount_nok, shifts, policy);

  if (distributions.length === 0) {
    // All points were zero (e.g. all work_hours=0 with by_hours policy).
    return NextResponse.json({ ok: false, error: "no_shifts" }, { status: 422 });
  }

  // 9. INSERT tip_pool (recorded status).
  //    ADR-0196 inv 11: DB writes complete before any emit.
  const { data: pool, error: poolErr } = await admin
    .from("tip_pool")
    .insert({
      workspace_id: auth.workspaceId,
      department_session_id: body.department_session_id,
      policy_id: policyRow.id,
      amount_nok: body.amount_nok,
      currency: "NOK",
      status: "recorded" as const,
      recorded_by: auth.profileId,
      notes: body.notes ?? null,
    })
    .select("id")
    .single();

  if (poolErr || !pool) {
    // UNIQUE violation: department_session_id already has a pool.
    if (poolErr?.code === "23505") {
      return NextResponse.json({ ok: false, error: "pool_exists" }, { status: 409 });
    }
    return NextResponse.json(
      { ok: false, error: poolErr?.message ?? "pool_insert_error" },
      { status: 500 },
    );
  }

  const poolId = pool.id;

  // 10. Bulk INSERT tip_distribution rows.
  //     shift_id references schedule_shift.schedule_shift_id (FK).
  //     Build shift_id lookup map.
  const shiftIdByProfile: Record<string, string> = {};
  for (const s of shiftRows ?? []) {
    if (s.employee_id) shiftIdByProfile[s.employee_id] = s.schedule_shift_id;
  }

  const distributionInserts = distributions.map((d) => ({
    workspace_id: auth.workspaceId,
    pool_id: poolId,
    profile_id: d.profile_id,
    shift_id: shiftIdByProfile[d.profile_id] ?? null,
    role: d.role,
    hours_worked: d.hours_worked,
    weight_applied: d.weight_applied,
    algorithm_snapshot: d.algorithm_snapshot,
    calculated_amount: d.calculated_amount,
    status: "calculated" as const,
  }));

  const { data: distRows, error: distErr } = await admin
    .from("tip_distribution")
    .insert(distributionInserts)
    .select("id, profile_id, calculated_amount, weight_applied");

  if (distErr || !distRows) {
    // Distribution insert failed — pool is orphaned. In production this
    // should be wrapped in a DB transaction. Since Supabase JS does not
    // expose multi-statement transactions, we attempt a compensating DELETE.
    await admin.from("tip_pool").delete().eq("id", poolId);
    return NextResponse.json(
      { ok: false, error: distErr?.message ?? "distribution_insert_error" },
      { status: 500 },
    );
  }

  // 11. Emit AFTER all DB writes succeed (ADR-0196 invariant 11).
  //
  //     tip_pool created — 4 destinations (posthog + logger + activity_trail + engine_event).
  //     Payload schema from packages/telemetry/src/registry.ts:5734-5749.
  void emit({
    event: "tip_pool created",
    workspace_id: nonEmpty(auth.workspaceId, "workspace_id"),
    actor_id: nonEmpty(auth.profileId, "actor_id"),
    properties: {
      entity: {
        entity_type: "tip_pool",
        entity_id: poolId,
        entity_label: `Tips-pot — ${session.session_date}`,
      },
      data: {
        pool_id: poolId,
        department_session_id: body.department_session_id,
        amount_nok: body.amount_nok,
        distribution_count: distRows.length,
        algorithm: policyRow.method as "equal" | "by_hours" | "by_role",
      },
    },
  });

  //     tip_distribution calculated — 2 destinations (logger + engine_event).
  //     High-volume: one per employee. Payload: registry.ts:5752-5767.
  for (const row of distRows) {
    void emit({
      event: "tip_distribution calculated",
      workspace_id: nonEmpty(auth.workspaceId, "workspace_id"),
      actor_id: nonEmpty(auth.profileId, "actor_id"),
      properties: {
        entity: {
          entity_type: "tip_distribution",
          entity_id: row.id,
          entity_label: `Distribusjon — ${row.profile_id}`,
        },
        data: {
          pool_id: poolId,
          distribution_id: row.id,
          profile_id: row.profile_id,
          calculated_amount: Number(row.calculated_amount),
          weight_applied: Number(row.weight_applied),
        },
      },
    });
  }

  // 12. Return 200.
  const totalCalculated = distributions.reduce((sum, d) => sum + d.calculated_amount, 0);

  return NextResponse.json({
    ok: true,
    pool_id: poolId,
    distribution_count: distRows.length,
    total_calculated: Math.round(totalCalculated * 100) / 100,
    surface: auth.surface,
  });
}
