/**
 * BFF POST /api/payroll/recalculate-period
 *
 * Orchestrator 5 of 5. Runs the full payroll pipeline sequentially:
 *   1. derive-shift-hours    (interpret + supplement evaluation)
 *   2. snapshot-period-costs (freeze tariff snapshot + audit events)
 *   3. aggregate-period      (per-profile payroll_line rows)
 *   4. run-deviation-checks  (W01–W14 deviation checks)
 *
 * Returns: { deviations, errors, total_lines, calc_duration_ms }
 *
 * This is the primary entry point for manual period recalculation. The
 * capability tool `recalculate_period` calls this route.
 *
 * ADR-0252: derivation_version incremented by derive-shift-hours step.
 * ADR-0151: workspace_id + profile_id derived server-side.
 * ADR-0099: gate_action before any write.
 * Emits: payroll.recalc_triggered after successful completion.
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
  period_id: z.string().uuid(),
});

const INTERNAL_ORIGIN_HEADER = "x-payroll-internal";

async function callOrchestrator(
  orchestratorPath: string,
  periodId: string,
  baseUrl: string,
  authHeader: string | null,
  cookieHeader: string | null,
): Promise<{ ok: boolean; error?: string; [key: string]: unknown }> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    [INTERNAL_ORIGIN_HEADER]: "recalculate-period",
  };
  if (authHeader) headers["Authorization"] = authHeader;
  if (cookieHeader) headers["Cookie"] = cookieHeader;

  const res = await fetch(`${baseUrl}${orchestratorPath}`, {
    method: "POST",
    headers,
    body: JSON.stringify({ period_id: periodId }),
  });

  const data = (await res.json()) as { ok: boolean; error?: string; [key: string]: unknown };
  return data;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  // Allow internal calls from recalculate-period itself (bypasses origin check).
  const isInternal = request.headers.get(INTERNAL_ORIGIN_HEADER) !== null;
  if (!isInternal) {
    const cors = rejectCrossOrigin(request);
    if (cors) return cors;
  }

  const auth = await resolvePayrollAuth(request);
  if (!auth) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  let body: z.infer<typeof RequestSchema>;
  try {
    body = RequestSchema.parse(await request.json());
  } catch (err) {
    const message =
      err instanceof z.ZodError ? (err.errors[0]?.message ?? "Invalid body") : "Invalid body";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }

  // Gate — admin-only, chat channel.
  const gate = await gateAction({
    workspaceId: auth.workspaceId,
    capability: "payroll",
    channel: "chat",
    actorProfileId: auth.profileId,
    actionType: "recalculate_period",
    entityId: body.period_id,
  });
  if (!gate.allow) {
    return NextResponse.json(
      { ok: false, error: `forbidden: ${gate.reason ?? "denied"}` },
      { status: 403 },
    );
  }

  const admin = createAdminClient();
  const workspaceId = auth.workspaceId;

  // Verify period belongs to workspace (ADR-0151 forgery defence — fail-fast).
  const { data: period, error: periodErr } = await admin
    .schema("payroll")
    .from("period")
    .select("id, status")
    .eq("id", body.period_id)
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (periodErr || !period) {
    return NextResponse.json({ ok: false, error: "period_not_found" }, { status: 404 });
  }
  if (period.status === "locked" || period.status === "approved") {
    return NextResponse.json(
      {
        ok: false,
        error: "period_frozen",
        detail: "Cannot recalculate a locked or approved period.",
      },
      { status: 409 },
    );
  }

  const startMs = Date.now();

  // Resolve base URL for internal sub-calls.
  const protocol = request.headers.get("x-forwarded-proto") ?? "http";
  const host = request.headers.get("host") ?? "localhost:3060";
  const baseUrl = `${protocol}://${host}`;

  const authHeader = request.headers.get("authorization");
  const cookieHeader = request.headers.get("cookie");

  // Step 1: derive-shift-hours.
  const step1 = await callOrchestrator(
    "/api/payroll/derive-shift-hours",
    body.period_id,
    baseUrl,
    authHeader,
    cookieHeader,
  );
  if (!step1.ok) {
    return NextResponse.json(
      { ok: false, error: "derive_shift_hours_failed", detail: step1.error },
      { status: 500 },
    );
  }

  // Step 2: snapshot-period-costs.
  const step2 = await callOrchestrator(
    "/api/payroll/snapshot-period-costs",
    body.period_id,
    baseUrl,
    authHeader,
    cookieHeader,
  );
  if (!step2.ok) {
    return NextResponse.json(
      { ok: false, error: "snapshot_period_costs_failed", detail: step2.error },
      { status: 500 },
    );
  }

  // Step 3: aggregate-period.
  const step3 = await callOrchestrator(
    "/api/payroll/aggregate-period",
    body.period_id,
    baseUrl,
    authHeader,
    cookieHeader,
  );
  if (!step3.ok) {
    return NextResponse.json(
      { ok: false, error: "aggregate_period_failed", detail: step3.error },
      { status: 500 },
    );
  }

  // Step 4: run-deviation-checks.
  const step4 = await callOrchestrator(
    "/api/payroll/run-deviation-checks",
    body.period_id,
    baseUrl,
    authHeader,
    cookieHeader,
  );
  if (!step4.ok) {
    return NextResponse.json(
      { ok: false, error: "run_deviation_checks_failed", detail: step4.error },
      { status: 500 },
    );
  }

  const calcDurationMs = Date.now() - startMs;

  // Emit recalc triggered event (payroll.recalc_triggered — registered in T4.3).
  void emit({
    event: "payroll.recalc_triggered",
    workspace_id: nonEmpty(workspaceId, "workspace_id"),
    actor_id: nonEmpty(auth.profileId, "actor_id"),
    properties: {
      entity: {
        entity_type: "payroll_period" as const,
        entity_id: body.period_id,
      },
      data: {
        period_id: body.period_id,
        deviations: Number(step4.deviation_count ?? 0),
        errors: Number(step4.error_count ?? 0),
        total_lines: Number(step3.lines_written ?? 0),
        calc_duration_ms: calcDurationMs,
        derivation_version:
          step1.derivation_version !== undefined ? Number(step1.derivation_version) : null,
      },
    },
  });

  return NextResponse.json({
    ok: true,
    period_id: body.period_id,
    deviations: step4.deviation_count ?? 0,
    errors: step4.error_count ?? 0,
    total_lines: step3.lines_written ?? 0,
    calc_duration_ms: calcDurationMs,
    derivation_version: step1.derivation_version ?? null,
  });
}
