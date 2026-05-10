/**
 * BFF POST /api/payroll/add-manual-supplement
 *
 * UI-facing route for the ManualSupplementForm (Screen 06, T3.1).
 * Inserts a payroll.manual_supplement row for a profile + period combination.
 *
 * The caller supplies a period_id + profile_id (to look up the first relevant
 * open shift in the period) and the supplement fields. The BFF:
 *   1. Resolves identity server-side (ADR-0151).
 *   2. Gates the action (ADR-0204, ADR-0099).
 *   3. Verifies the period is open in the caller's workspace (L-0177 fail-fast).
 *   4. Inserts into payroll.manual_supplement.
 *   5. Emits payroll.manual_supplement_added (ADR-0134).
 *   6. Synchronously POSTs to /api/payroll/recalculate-period (Pattern B, ADR-0293).
 *      Recalc failure does NOT roll back the supplement insert — insert is canonical,
 *      recalc is best-effort sync. Non-200 is logged but 200 is returned to caller.
 *
 * This route accepts profile_id + supplement type in the body because those are
 * data fields (who the supplement is for, not who is calling). The caller's
 * workspace_id + actor profileId are ALWAYS derived server-side (ADR-0151).
 *
 * ADR compliance (body verified before docstring — L-0176):
 *   ADR-0151 — workspace_id and actor profile_id never from body; server-derived.
 *   ADR-0204 — gateAction before any DB write.
 *   ADR-0134 — emit() with nonEmpty(workspace_id) + nonEmpty(actor_id).
 *   ADR-0293 — Pattern B sync-chain: recalculate-period called after successful insert.
 *   L-0177   — 4xx on period/profile not found; no silent fallback.
 *   ADR-0078 — payroll is Høy-PII; channel pinned to "chat".
 *   ADR-0133 — web-only authoring surface (mobile reads lønnsgrunnlag only).
 */
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";

import { gateAction } from "@/app/dashboard/_actions/_shared";
import { rejectCrossOrigin, resolvePayrollAuth } from "@/app/api/payroll/_shared";
import { createAdminClient } from "@smartout/supabase/admin";
import { emit, nonEmpty } from "@smartout/telemetry";

export const runtime = "nodejs";

const SupplementType = z.enum(["Bonus", "Forskudd", "Trekk", "Annet"]);

const RequestSchema = z.object({
  workspace_id: z.string().uuid().describe("UUID of the workspace context (UI-resolved)"),
  period_id: z.string().uuid().describe("UUID of the open payroll period"),
  profile_id: z.string().uuid().describe("Profile of the employee receiving the supplement"),
  type: SupplementType.describe("Supplement type — maps to a salary-code category"),
  amount: z.number().positive().describe("Supplement amount in NOK"),
  salary_code: z.string().optional().describe("Optional A-melding salary code, e.g. '5210'"),
  description: z
    .string()
    .min(4)
    .max(500)
    .describe("Description shown on lønnsgrunnlag — required, min 4 chars"),
  taxable: z.boolean().default(true).describe("Whether the supplement is taxable"),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .describe("Supplement date (YYYY-MM-DD) — must fall in period range"),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  // ─── CORS guard ───────────────────────────────────────────────────────────
  const cors = rejectCrossOrigin(request);
  if (cors) return cors;

  // ─── Input validation (workspace_id needed before auth resolve) ───────────
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

  // ─── Authority gate (ADR-0204, ADR-0099) ──────────────────────────────────
  const gate = await gateAction({
    workspaceId: auth.workspaceId,
    capability: "payroll",
    channel: "chat",
    actorProfileId: auth.profileId,
    actionType: "add_manual_supplement",
    entityId: body.period_id,
  });
  if (!gate.allow) {
    return NextResponse.json(
      { ok: false, error: `forbidden: ${gate.reason ?? "denied"}` },
      { status: 403 },
    );
  }

  const admin = createAdminClient();

  // ─── Verify period is open in caller's workspace (L-0177 fail-fast) ───────
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
  if (period.status === "locked" || period.status === "approved" || period.status === "exported") {
    return NextResponse.json(
      {
        ok: false,
        error: "period_not_open",
        detail: `Perioden er ${period.status} — kan ikke legge til tillegg.`,
      },
      { status: 409 },
    );
  }

  // ─── Verify date falls within period range (L-0177) ───────────────────────
  if (body.date < period.start_date || body.date > period.end_date) {
    return NextResponse.json(
      {
        ok: false,
        error: "date_outside_period",
        detail: `Datoen ${body.date} faller utenfor perioden (${period.start_date} – ${period.end_date}).`,
      },
      { status: 422 },
    );
  }

  // ─── Verify profile belongs to caller's workspace (L-0177) ────────────────
  const { data: targetProfile, error: profileErr } = await admin
    .from("profile")
    .select("profile_id, workspace_id")
    .eq("profile_id", body.profile_id)
    .eq("workspace_id", auth.workspaceId)
    .maybeSingle();

  if (profileErr || !targetProfile) {
    return NextResponse.json({ ok: false, error: "profile_not_found" }, { status: 404 });
  }

  // ─── Find a shift for this profile+date to attach the supplement to ────────
  // Best-effort: find any open shift for this profile on the given date.
  // If none exists, use a synthetic shift reference (supplement still inserts
  // with the most recent shift in the period, or null if period has no shifts).
  // schedule_shift_id is NOT NULL on the table — we must find one.
  const dayStart = `${body.date}T00:00:00`;
  const dayEnd = `${body.date}T23:59:59`;

  const { data: matchedShifts } = await admin
    .from("schedule_shift")
    .select("schedule_shift_id")
    .eq("workspace_id", auth.workspaceId)
    .eq("employee_id", body.profile_id)
    .gte("start_time", dayStart)
    .lte("start_time", dayEnd)
    .order("start_time")
    .limit(1);

  // If no shift on exact date, fall back to any shift in the period for this profile.
  let shiftId: string | null = matchedShifts?.[0]?.schedule_shift_id ?? null;

  if (!shiftId) {
    const { data: periodShifts } = await admin
      .from("schedule_shift")
      .select("schedule_shift_id")
      .eq("workspace_id", auth.workspaceId)
      .eq("employee_id", body.profile_id)
      .gte("start_time", `${period.start_date}T00:00:00`)
      .lte("start_time", `${period.end_date}T23:59:59`)
      .order("start_time")
      .limit(1);
    shiftId = periodShifts?.[0]?.schedule_shift_id ?? null;
  }

  if (!shiftId) {
    return NextResponse.json(
      {
        ok: false,
        error: "no_shift_for_profile_in_period",
        detail: "Fant ingen vakt for denne ansatte i perioden. Tillegg krever en tilknyttet vakt.",
      },
      { status: 422 },
    );
  }

  // ─── Build description with type prefix ───────────────────────────────────
  const descriptionWithType = `[${body.type}] ${body.description}`.trim();

  // ─── Insert manual supplement (payroll schema) ────────────────────────────
  const { data: supplement, error: supErr } = await admin
    .schema("payroll")
    .from("manual_supplement")
    .insert({
      workspace_id: auth.workspaceId,
      schedule_shift_id: shiftId,
      added_by: auth.profileId,
      amount: body.amount,
      description: descriptionWithType,
      salary_code: body.salary_code ?? null,
      supplement_rule_id: null,
    })
    .select("id")
    .single();

  if (supErr || !supplement) {
    return NextResponse.json(
      {
        ok: false,
        error: "insert_failed",
        detail: (supErr as { message?: string } | null)?.message ?? "Kunne ikke lagre tillegget.",
      },
      { status: 500 },
    );
  }

  // ─── Emit telemetry (ADR-0134) ────────────────────────────────────────────
  const wsId = nonEmpty(auth.workspaceId, "workspaceId");
  const actorId = nonEmpty(auth.profileId, "profileId");

  await emit({
    event: "payroll.manual_supplement_added",
    workspace_id: wsId,
    actor_id: actorId,
    properties: {
      entity: { entity_type: "shift" as const, entity_id: shiftId },
      data: {
        supplement_id: supplement.id,
        period_id: body.period_id,
        target_profile_id: body.profile_id,
        shift_id: shiftId,
        salary_code: body.salary_code ?? null,
        amount: body.amount,
        gate_evaluation_id: null,
      },
    },
  });

  // ─── Pattern B sync-chain: trigger recalc immediately (ADR-0293) ──────────
  // The DB trigger `payroll_manual_supplement_recalc_trg` (INSERT path) already
  // emits `payroll.recalc_triggered_by_supplement` into engine_event for the
  // audit trail. No engine_dispatch consumer exists today (T7.1 GAP), so we
  // call recalculate-period synchronously to give immediate consistency.
  //
  // Idempotency contract: recalc failure does NOT roll back the supplement
  // insert. The supplement row is canonical; recalc is best-effort sync.
  // On non-200, log + telemetry but still return 200 to caller.
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
    body: JSON.stringify({ workspace_id: body.workspace_id, period_id: body.period_id }),
  });

  if (!recalcRes.ok) {
    const recalcBody = await recalcRes.json().catch(() => ({}));
    console.error(
      "[add-manual-supplement] Pattern B recalc failed (supplement insert committed)",
      recalcBody,
    );
    // Return 200 — supplement is canonical, recalc is best-effort (ADR-0293).
    return NextResponse.json({
      ok: true,
      supplement_id: supplement.id,
      period_id: body.period_id,
      profile_id: body.profile_id,
      amount: body.amount,
      recalc_warning: "Tillegget er lagret men omregningen feilet — kjør manuelt.",
    });
  }

  return NextResponse.json({
    ok: true,
    supplement_id: supplement.id,
    period_id: body.period_id,
    profile_id: body.profile_id,
    amount: body.amount,
  });
}
