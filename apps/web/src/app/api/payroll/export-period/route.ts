/**
 * BFF POST /api/payroll/export-period
 *
 * Streams a payroll period CSV to the client. Two variants:
 *   - 'aggregate': one row per profile (total pay, PII masked by default)
 *   - 'audit': one row per calculation row with rule provenance (Bokføringsloven §13)
 *
 * Architecture choice (Wave B T3.3 coordination):
 *   The server action exportPeriodCsv() triggers THIS route indirectly:
 *   the server action returns { ok: true, downloadUrl: "/api/payroll/export-period" }
 *   with signed intent, and the client POSTs here to receive the CSV stream.
 *   Alternatively the client calls this route directly after server-action gate check.
 *   See T3.3 for the chosen pattern (server-action returns eventId + client streams).
 *
 *   This route is the ONLY CSV byte emitter — it runs the full pipeline
 *   (gate → verify → fetch rows → generateCsv → INSERT export_event → stream).
 *   The capability tool (T3.1) uses the same pipeline for voice/chat surface.
 *   No duplication: both surfaces call the same underlying helpers.
 *
 * Response:
 *   200 — Content-Type: text/csv; charset=utf-8
 *         Content-Disposition: attachment; filename="<slug>-<period>-<variant>-<ts>.csv"
 *         Body: BOM + CSV (BOM already included by generateCsv)
 *   400 — invalid input
 *   401 — not authenticated
 *   403 — gate denied
 *   404 — period not found in workspace
 *   409 — period not locked / duplicate idempotency key
 *   500 — generator or DB error → emits payroll.csv_export_failed
 *
 * ADR compliance (body verified before docstring — L-0176):
 *   ADR-0151 — workspace_id + profile_id derived server-side via resolvePayrollAuth; never from body
 *   ADR-0204 — gateAction before write
 *   ADR-0240 — only writes to payroll.export_event (payroll schema only)
 *   ADR-0134 — emit() with non-null workspaceId + actorId (nonEmpty asserts)
 *   L-0177   — fail fast on row-not-found (period, workspace) — no silent fallback
 *   L-0176   — body implemented before this docstring was written
 *   Bokføringsloven §13 — export_event is append-only (RLS blocks UPDATE/DELETE for JWT users)
 *   ADR-0078 — payroll = Høy-PII; channel pinned to "chat" at BFF layer
 */
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";

import { gateAction } from "@/app/dashboard/_actions/_shared";
import { rejectCrossOrigin, resolvePayrollAuth } from "@/app/api/payroll/_shared";
import { createAdminClient } from "@smartout/supabase/admin";
import { emit, nonEmpty } from "@smartout/telemetry";
import {
  generateCsv,
  generateFilename,
  computeFileHash,
  computeFeriepengerBasis,
} from "@smartout/payroll-export";
import type { AggregateRow, AuditRow, ExportOptions } from "@smartout/payroll-export";

export const runtime = "nodejs";

const RequestSchema = z.object({
  workspace_id: z.string().uuid().describe("UUID of the workspace context (UI-resolved)"),
  period_id: z.string().uuid().describe("UUID of the payroll period to export (must be locked)"),
  variant: z.enum(["aggregate", "audit"]).describe("CSV export variant"),
  include_unmasked: z
    .boolean()
    .default(false)
    .describe("When true, PII (personnummer, bankkonto) is exported as raw values"),
});

export async function POST(request: NextRequest): Promise<NextResponse | Response> {
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
  const auth = await resolvePayrollAuth(request, body.workspace_id);
  if (!auth) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  // ─── Authority gate (ADR-0204, ADR-0099, ADR-0078) ────────────────────────
  // Channel pinned to "chat" at BFF layer — payroll is Høy-PII (ADR-0078).
  const gate = await gateAction({
    workspaceId: auth.workspaceId,
    capability: "payroll",
    channel: "chat",
    actorProfileId: auth.profileId,
    actionType: "export_period",
    entityId: body.period_id,
  });
  if (!gate.allow) {
    return NextResponse.json(
      { ok: false, error: `forbidden: ${gate.reason ?? "denied"}` },
      { status: 403 },
    );
  }

  const admin = createAdminClient();

  // ─── Step 1: Verify period belongs to workspace (ADR-0151, L-0177) ─────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: period, error: periodErr } = await (admin.schema("payroll") as any)
    .from("period")
    .select("id, status, start_date, workspace_id")
    .eq("id", body.period_id)
    .eq("workspace_id", auth.workspaceId)
    .maybeSingle();

  if (periodErr || !period) {
    // L-0177: fail fast — no silent fallback.
    return NextResponse.json({ ok: false, error: "period_not_found" }, { status: 404 });
  }

  // ─── Step 2: Reject if period is not locked ────────────────────────────────
  if (period.status !== "locked") {
    return NextResponse.json(
      {
        ok: false,
        error: "period_not_locked",
        detail: `Periode er ${String(period.status)} — eksport krever låst periode.`,
      },
      { status: 409 },
    );
  }

  // ─── Step 3: Fetch workspace slug for filename generation ──────────────────
  const { data: workspace, error: wsErr } = await admin
    .from("workspace")
    .select("slug")
    .eq("workspace_id", auth.workspaceId)
    .maybeSingle();

  if (wsErr || !workspace) {
    return NextResponse.json({ ok: false, error: "workspace_not_found" }, { status: 404 });
  }

  const exportedAt = new Date();
  const periodLabel = String(period.start_date).slice(0, 7); // "yyyy-MM"
  const workspaceSlug = workspace.slug ?? auth.workspaceId.slice(0, 8);

  // ─── Step 4: Fetch rows for the chosen variant ─────────────────────────────
  let csvRows: AggregateRow[] | AuditRow[];

  if (body.variant === "aggregate") {
    // Aggregate: latest calculation_version per profile.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: calcs, error: calcErr } = await (admin.schema("payroll") as any)
      .from("calculation")
      .select(
        "id, profile_id, base_pay, total_supplements, total_deductions, total_pay, calculation_version",
      )
      .eq("workspace_id", auth.workspaceId)
      .eq("period_id", body.period_id)
      .order("calculation_version", { ascending: false });

    if (calcErr) {
      await emitFailure(auth.workspaceId, auth.profileId, body.period_id, body.variant, "db_error");
      return NextResponse.json({ ok: false, error: "db_error" }, { status: 500 });
    }

    type CalcRow = {
      id: string;
      profile_id: string;
      base_pay: number | null;
      total_supplements: number | null;
      total_deductions: number | null;
      total_pay: number | null;
      calculation_version: number | null;
    };

    // De-duplicate: keep only the highest calculation_version per profile.
    const seen = new Set<string>();
    const latestCalcs = ((calcs ?? []) as CalcRow[]).filter((c) => {
      if (seen.has(c.profile_id)) return false;
      seen.add(c.profile_id);
      return true;
    });

    if (latestCalcs.length === 0) {
      return NextResponse.json({ ok: false, error: "no_rows" }, { status: 404 });
    }

    // Fetch PII + display_name.
    // personal_number + bank_account live on profile table (Phase 5 council fix 1aa646181).
    // employee_payroll_profile does NOT have personal_id_number / bank_account_number.
    const profileIds = latestCalcs.map((c) => c.profile_id);
    const { data: profiles, error: profErr } = await admin
      .from("profile")
      .select("profile_id, display_name, personal_number, bank_account")
      .in("profile_id", profileIds)
      .eq("workspace_id", auth.workspaceId);

    if (profErr) {
      await emitFailure(auth.workspaceId, auth.profileId, body.period_id, body.variant, "db_error");
      return NextResponse.json({ ok: false, error: "db_error" }, { status: 500 });
    }

    const profileMap = new Map((profiles ?? []).map((p) => [p.profile_id, p]));

    // Fetch holiday_allowance_pct for feriepenger basis (ADR-0295).
    const { data: payrollProfiles } = await admin
      .from("employee_payroll_profile")
      .select("profile_id, holiday_allowance_pct")
      .in("profile_id", profileIds)
      .eq("workspace_id", auth.workspaceId);

    const payrollProfileMap = new Map(
      (
        (payrollProfiles ?? []) as { profile_id: string; holiday_allowance_pct: number | null }[]
      ).map((p) => [p.profile_id, p]),
    );

    csvRows = latestCalcs.map((c) => {
      const prof = profileMap.get(c.profile_id);
      const payrollProf = payrollProfileMap.get(c.profile_id);
      const basePay = Number(c.base_pay ?? 0);
      return {
        profile_id: c.profile_id,
        profile_name: prof?.display_name ?? c.profile_id,
        personnummer: (prof as { personal_number?: string | null })?.personal_number ?? null,
        bankkonto: (prof as { bank_account?: string | null })?.bank_account ?? null,
        base_pay: basePay,
        total_supplements: Number(c.total_supplements ?? 0),
        total_deductions: Number(c.total_deductions ?? 0),
        total_pay: Number(c.total_pay ?? 0),
        taxable_pay: Number(c.total_pay ?? 0), // Phase 1 proxy
        // ADR-0295: basis = base_pay × holiday_allowance_pct / 100.
        feriepenger_basis: computeFeriepengerBasis({
          basePayTotal: basePay,
          holidayAllowancePct: Number(payrollProf?.holiday_allowance_pct ?? 12),
        }),
      } satisfies AggregateRow;
    });
  } else {
    // Audit: 1 row per calculation row with provenance from shift_pay_calculation_event.
    // NB: provenance is NOT a column on payroll.calculation today —
    // audit data lives on shift_pay_calculation_event (joined below via eventMap).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: calcs, error: calcErr } = await (admin.schema("payroll") as any)
      .from("calculation")
      .select(
        "id, profile_id, base_pay, total_supplements, total_deductions, total_pay, " +
          "calculation_version, schedule_shift_id, shift_date",
      )
      .eq("workspace_id", auth.workspaceId)
      .eq("period_id", body.period_id)
      .order("profile_id")
      .order("calculation_version", { ascending: false });

    if (calcErr) {
      await emitFailure(auth.workspaceId, auth.profileId, body.period_id, body.variant, "db_error");
      return NextResponse.json({ ok: false, error: "db_error" }, { status: 500 });
    }

    type AuditCalcRow = {
      id: string;
      profile_id: string;
      base_pay: number | null;
      total_supplements: number | null;
      total_deductions: number | null;
      total_pay: number | null;
      calculation_version: number | null;
      schedule_shift_id: string;
      shift_date: string;
    };

    const typedCalcs = (calcs ?? []) as unknown as AuditCalcRow[];

    if (typedCalcs.length === 0) {
      return NextResponse.json({ ok: false, error: "no_rows" }, { status: 404 });
    }

    // Fetch latest shift_pay_calculation_event per shift for provenance.
    const shiftIds = [...new Set(typedCalcs.map((c) => c.schedule_shift_id))];
    const { data: events } = await admin
      .from("shift_pay_calculation_event")
      .select("id, shift_id, rule_type, source_text_applied, derivation_version")
      .in("shift_id", shiftIds)
      .eq("workspace_id", auth.workspaceId)
      .is("superseded_by_event_id", null)
      .order("derivation_version", { ascending: false });

    type ShiftEvent = {
      id: string;
      shift_id: string;
      rule_type: string | null;
      source_text_applied: string | null;
      derivation_version: number | null;
    };
    const safeEvents = (events ?? []) as unknown as ShiftEvent[];
    const eventMap = new Map<string, ShiftEvent>();
    for (const ev of safeEvents) {
      if (!eventMap.has(ev.shift_id)) eventMap.set(ev.shift_id, ev);
    }

    // Fetch PII + display_name.
    // personal_number + bank_account live on profile table (Phase 5 council fix 1aa646181).
    // employee_payroll_profile does NOT have personal_id_number / bank_account_number.
    const profileIds = [...new Set(typedCalcs.map((c) => c.profile_id))];
    const { data: profiles } = await admin
      .from("profile")
      .select("profile_id, display_name, personal_number, bank_account")
      .in("profile_id", profileIds)
      .eq("workspace_id", auth.workspaceId);

    const profileMap = new Map((profiles ?? []).map((p) => [p.profile_id, p]));

    // Fetch holiday_allowance_pct for feriepenger basis (ADR-0295).
    const { data: auditPayrollProfiles } = await admin
      .from("employee_payroll_profile")
      .select("profile_id, holiday_allowance_pct")
      .in("profile_id", profileIds)
      .eq("workspace_id", auth.workspaceId);

    const auditPayrollProfileMap = new Map(
      (
        (auditPayrollProfiles ?? []) as {
          profile_id: string;
          holiday_allowance_pct: number | null;
        }[]
      ).map((p) => [p.profile_id, p]),
    );

    csvRows = typedCalcs.map((c) => {
      const prof = profileMap.get(c.profile_id);
      const ev = eventMap.get(c.schedule_shift_id);
      const auditPayrollProf = auditPayrollProfileMap.get(c.profile_id);
      const auditBasePay = Number(c.base_pay ?? 0);
      return {
        profile_id: c.profile_id,
        profile_name: prof?.display_name ?? c.profile_id,
        personnummer: (prof as { personal_number?: string | null })?.personal_number ?? null,
        bankkonto: (prof as { bank_account?: string | null })?.bank_account ?? null,
        base_pay: auditBasePay,
        total_supplements: Number(c.total_supplements ?? 0),
        total_deductions: Number(c.total_deductions ?? 0),
        total_pay: Number(c.total_pay ?? 0),
        taxable_pay: Number(c.total_pay ?? 0),
        // ADR-0295: basis = base_pay × holiday_allowance_pct / 100.
        feriepenger_basis: computeFeriepengerBasis({
          basePayTotal: auditBasePay,
          holidayAllowancePct: Number(auditPayrollProf?.holiday_allowance_pct ?? 12),
        }),
        // Audit columns (provenance from shift_pay_calculation_event only — no .provenance col on calculation):
        calculation_line_id: c.id,
        shift_id: c.schedule_shift_id,
        shift_date: c.shift_date,
        rule_id: ev?.rule_type ?? null,
        tariff_version: null,
        paragraf: ev?.source_text_applied ?? null,
        rule_amount: Number(c.total_pay ?? 0),
        derivation_version: c.calculation_version ?? 1,
      } satisfies AuditRow;
    });
  }

  // ─── Step 5: Generate CSV (pure, deterministic) ────────────────────────────
  const opts: ExportOptions = {
    variant: body.variant,
    includeUnmasked: body.include_unmasked,
    workspaceSlug,
    periodLabel,
    exportedAt,
  };

  let csv: string;
  try {
    csv = generateCsv(csvRows, opts);
  } catch (genErr) {
    await emitFailure(
      auth.workspaceId,
      auth.profileId,
      body.period_id,
      body.variant,
      "generator_error",
    );
    console.error("[export-period] generateCsv threw:", genErr);
    return NextResponse.json({ ok: false, error: "generator_error" }, { status: 500 });
  }

  if (!csv) {
    return NextResponse.json({ ok: false, error: "no_rows" }, { status: 404 });
  }

  const filename = generateFilename(opts);
  const fileHash = computeFileHash(csv);
  const rowCount = csvRows.length;

  // ─── Step 6: INSERT payroll.export_event (Bokføringsloven §13) ────────────
  const idempotencyKey = `${body.period_id}-${body.variant}-${exportedAt.toISOString()}`;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: exportEvent, error: exportErr } = await (admin.schema("payroll") as any)
    .from("export_event")
    .insert({
      workspace_id: auth.workspaceId,
      period_id: body.period_id,
      exported_by: auth.profileId,
      export_format: "csv",
      status: "completed",
      started_at: exportedAt.toISOString(),
      completed_at: new Date().toISOString(),
      variant: body.variant,
      masked: !body.include_unmasked,
      file_hash: fileHash,
      idempotency_key: idempotencyKey,
      row_count: rowCount,
    })
    .select("id")
    .single();

  if (exportErr || !exportEvent) {
    const isIdempotencyConflict = (exportErr as { code?: string } | null)?.code === "23505";
    if (isIdempotencyConflict) {
      return NextResponse.json({ ok: false, error: "duplicate_export" }, { status: 409 });
    }
    await emitFailure(
      auth.workspaceId,
      auth.profileId,
      body.period_id,
      body.variant,
      "db_write_failed",
    );
    return NextResponse.json({ ok: false, error: "db_write_failed" }, { status: 500 });
  }

  // ─── Step 7: Emit telemetry (ADR-0134) ────────────────────────────────────
  const wsId = nonEmpty(auth.workspaceId, "workspaceId");
  const actorId = nonEmpty(auth.profileId, "profileId");
  const exportEventId = String((exportEvent as { id: string }).id);

  await emit({
    event: "payroll.csv_exported",
    workspace_id: wsId,
    actor_id: actorId,
    properties: {
      entity: { entity_type: "payroll_export_event" as const, entity_id: exportEventId },
      data: {
        export_event_id: exportEventId,
        period_id: body.period_id,
        variant: body.variant,
        masked: !body.include_unmasked,
        row_count: rowCount,
      },
    },
  });

  if (body.include_unmasked) {
    await emit({
      event: "payroll.csv_export_unmasked",
      workspace_id: wsId,
      actor_id: actorId,
      properties: {
        entity: { entity_type: "payroll_export_event" as const, entity_id: exportEventId },
        data: {
          export_event_id: exportEventId,
          period_id: body.period_id,
          variant: body.variant,
          row_count: rowCount,
        },
      },
    });
  }

  // ─── Step 8: Stream CSV response ──────────────────────────────────────────
  // generateCsv already prepends BOM_UTF8. Do NOT double-prepend.
  // Content-Disposition with filename uses ASCII-safe filename (no colons).
  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "X-Export-Event-Id": exportEventId,
      "X-Row-Count": String(rowCount),
      // Prevent caching — each export is a unique point-in-time snapshot.
      "Cache-Control": "no-store",
    },
  });
}

// ── Internal helper ────────────────────────────────────────────────────────────

async function emitFailure(
  workspaceId: string,
  profileId: string,
  periodId: string,
  variant: "aggregate" | "audit",
  errorCode: string,
): Promise<void> {
  try {
    const wsId = nonEmpty(workspaceId, "workspaceId");
    const actorId = nonEmpty(profileId, "profileId");
    await emit({
      event: "payroll.csv_export_failed",
      workspace_id: wsId,
      actor_id: actorId,
      properties: {
        entity: {
          entity_type: "payroll_export_event" as const,
          entity_id: periodId, // no export_event.id yet when failure occurs pre-INSERT
        },
        data: {
          period_id: periodId,
          variant,
          error_code: errorCode,
        },
      },
    });
  } catch {
    // Telemetry failure is non-fatal — swallow so primary error path isn't masked.
  }
}
