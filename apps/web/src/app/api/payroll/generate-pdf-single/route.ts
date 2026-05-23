/**
 * BFF POST /api/payroll/generate-pdf-single
 *
 * Admin or employee: generate a single PDF lønnsgrunnlag for one profile in a
 * locked payroll period. Uploads to payroll-lonnsgrunnlag storage bucket and
 * returns a signed download URL.
 *
 * Access rules:
 *   - Employee: profile_id in body MUST match session-derived profile_id (ADR-0151).
 *     Enforced server-side; mismatch → 403.
 *   - Admin: profile_id can be any profile in the workspace.
 *
 * Pipeline:
 *   1. rejectCrossOrigin
 *   2. resolvePayrollAuth (server-derived identity — ADR-0151)
 *   3. Input validation (Zod)
 *   4. gateAction (admin or employee self)
 *   5. Role-based profile_id validation (ADR-0151, L-0177)
 *   6. Verify period belongs to workspace and is 'locked'
 *   7. Fetch single-profile aggregate row
 *   8. generateLonnsgrunnlagPdf() — single-employee render
 *   9. Upload to storage bucket (upsert=true for idempotency)
 *   10. INSERT payroll.export_event
 *   11. Generate signed URL (1h employee / 24h admin)
 *   12. emit payroll.lonnsgrunnlag_generated + payroll.lonnsgrunnlag_url_granted
 *   13. Return { event_id, signed_url, expires_at, profile_id }
 *
 * ADR compliance (body verified before docstring — L-0176):
 *   ADR-0151 — workspace_id derived server-side; profile_id verified against session
 *   ADR-0204 — gateAction before write
 *   ADR-0240 — writes only to payroll.export_event + storage.objects (RLS-scoped)
 *   ADR-0134 — emit() with non-null workspaceId + actorId (nonEmpty asserts)
 *   L-0177   — fail fast on period not found, profile mismatch, row not found
 *   L-0176   — body implemented before this docstring
 *   ADR-0078 — payroll = Høy-PII; channel pinned to "chat" at BFF layer
 *   ADR-0294 — storage path: {workspace_id}/{period_id}/{profile_id}.pdf
 *   Bokføringsloven §13 — export_event append-only
 */
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";

import { gateAction } from "@/app/dashboard/_actions/_shared";
import { rejectCrossOrigin, resolvePayrollAuth } from "@/app/api/payroll/_shared";
import { createAdminClient } from "@smartout/supabase/admin";
import { emit, nonEmpty } from "@smartout/telemetry";
import {
  generateLonnsgrunnlagPdf,
  computeFileHash,
  computeFeriepengerBasis,
} from "@smartout/payroll-export";
import type { AggregateRow, LonnsgrunnlagPdfOptions } from "@smartout/payroll-export";

export const runtime = "nodejs";

const RequestSchema = z.object({
  workspace_id: z.string().uuid().describe("UUID of the workspace context (UI-resolved)"),
  period_id: z.string().uuid().describe("UUID of the payroll period (must be locked)"),
  profile_id: z.string().uuid().describe("Employee profile_id to generate PDF for"),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  // ─── CORS guard ───────────────────────────────────────────────────────────
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
  const gate = await gateAction({
    workspaceId: auth.workspaceId,
    capability: "payroll",
    channel: "chat",
    actorProfileId: auth.profileId,
    actionType: "generate_pdf_single",
    entityId: body.profile_id,
  });
  if (!gate.allow) {
    return NextResponse.json(
      { ok: false, error: `forbidden: ${gate.reason ?? "denied"}` },
      { status: 403 },
    );
  }

  const admin = createAdminClient();

  // ─── Step 1: Determine caller role to enforce access rules (ADR-0151) ─────
  const { data: callerProfile } = await admin
    .from("profile")
    .select("role")
    .eq("profile_id", auth.profileId)
    .eq("workspace_id", auth.workspaceId)
    .maybeSingle();

  const callerRole = (callerProfile as { role?: string } | null)?.role ?? "employee";
  const isAdmin = callerRole === "admin" || callerRole === "owner" || callerRole === "manager";

  // Employee: profile_id in body MUST match session profile_id.
  // L-0177: fail fast, no silent fallback.
  if (!isAdmin && body.profile_id !== auth.profileId) {
    return NextResponse.json(
      {
        ok: false,
        error: "access_denied",
        detail: "Du kan kun generere ditt eget lønnsgrunnlag.",
      },
      { status: 403 },
    );
  }

  // Admin: verify target profile is in this workspace (ADR-0151 forgery defence).
  if (isAdmin) {
    const { data: targetProfile } = await admin
      .from("profile")
      .select("profile_id")
      .eq("profile_id", body.profile_id)
      .eq("workspace_id", auth.workspaceId)
      .maybeSingle();

    if (!targetProfile) {
      return NextResponse.json({ ok: false, error: "profile_not_found" }, { status: 404 });
    }
  }

  // ─── Step 2: Verify period belongs to workspace (ADR-0151, L-0177) ─────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: period, error: periodErr } = await (admin.schema("payroll") as any)
    .from("period")
    .select("id, status, start_date, end_date, workspace_id")
    .eq("id", body.period_id)
    .eq("workspace_id", auth.workspaceId)
    .maybeSingle();

  if (periodErr || !period) {
    return NextResponse.json({ ok: false, error: "period_not_found" }, { status: 404 });
  }

  // A lønnsgrunnlag PDF can be generated from any period at or past lock — the
  // data is frozen once locked, and the employee's payslip list surfaces
  // approved/exported periods (use-payslips SETTLED_STATUSES). Gating on
  // 'locked' only meant a settled payslip could never produce its own PDF.
  const PDF_ELIGIBLE_STATUSES = ["locked", "approved", "exported"] as const;
  if (!PDF_ELIGIBLE_STATUSES.includes(period.status as (typeof PDF_ELIGIBLE_STATUSES)[number])) {
    return NextResponse.json(
      {
        ok: false,
        error: "period_not_locked",
        detail: `Periode er ${String(period.status)} — PDF-generering krever låst (eller senere) periode.`,
      },
      { status: 409 },
    );
  }

  // ─── Step 3: Fetch workspace metadata for PDF header ──────────────────────
  // org_number lives on `company` table (not workspace). Embed via FK.
  const { data: workspace, error: wsErr } = await admin
    .from("workspace")
    .select("slug, name, company:company_id(org_number)")
    .eq("workspace_id", auth.workspaceId)
    .maybeSingle();

  if (wsErr || !workspace) {
    return NextResponse.json({ ok: false, error: "workspace_not_found" }, { status: 404 });
  }

  // ─── Step 4: Fetch single-profile aggregate row ────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: calcs, error: calcErr } = await (admin.schema("payroll") as any)
    .from("calculation")
    .select(
      "id, profile_id, base_pay, total_supplements, total_deductions, total_pay, calculation_version",
    )
    .eq("workspace_id", auth.workspaceId)
    .eq("period_id", body.period_id)
    .eq("profile_id", body.profile_id)
    .order("calculation_version", { ascending: false })
    .limit(1);

  if (calcErr) {
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

  const singleCalc = ((calcs ?? []) as CalcRow[])[0] ?? null;
  if (!singleCalc) {
    return NextResponse.json(
      { ok: false, error: "no_rows", detail: "Ingen beregningsrad funnet for denne profilen." },
      { status: 404 },
    );
  }

  // ─── Step 5: Fetch PII + display_name ─────────────────────────────────────
  // personal_number + bank_account live on profile table (Phase 5 council fix 1aa646181).
  // employee_payroll_profile does NOT have personal_id_number / bank_account_number.
  const { data: profileData, error: profErr } = await admin
    .from("profile")
    .select("profile_id, display_name, personal_number, bank_account")
    .eq("profile_id", body.profile_id)
    .eq("workspace_id", auth.workspaceId)
    .maybeSingle();

  if (profErr) {
    return NextResponse.json({ ok: false, error: "db_error" }, { status: 500 });
  }

  // Fetch holiday_allowance_pct for feriepenger basis (ADR-0295).
  const { data: payrollProfile } = await admin
    .from("employee_payroll_profile")
    .select("holiday_allowance_pct")
    .eq("profile_id", body.profile_id)
    .eq("workspace_id", auth.workspaceId)
    .maybeSingle();

  const singleBasePay = Number(singleCalc.base_pay ?? 0);
  const singlePctApplied = Number(
    (payrollProfile as { holiday_allowance_pct?: number | null } | null)?.holiday_allowance_pct ??
      12,
  );
  const singleFeriepengerBasis = computeFeriepengerBasis({
    basePayTotal: singleBasePay,
    holidayAllowancePct: singlePctApplied,
  });

  const aggregateRow: AggregateRow = {
    profile_id: singleCalc.profile_id,
    profile_name: profileData?.display_name ?? singleCalc.profile_id,
    personnummer: (profileData as { personal_number?: string | null })?.personal_number ?? null,
    bankkonto: (profileData as { bank_account?: string | null })?.bank_account ?? null,
    base_pay: singleBasePay,
    total_supplements: Number(singleCalc.total_supplements ?? 0),
    total_deductions: Number(singleCalc.total_deductions ?? 0),
    total_pay: Number(singleCalc.total_pay ?? 0),
    taxable_pay: Number(singleCalc.total_pay ?? 0),
    // ADR-0295: basis = base_pay × holiday_allowance_pct / 100.
    // Per-employee override from employee_payroll_profile; default 12 (Riksavtalen).
    feriepenger_basis: singleFeriepengerBasis,
  };

  // ─── Step 5b: Emit feriepenger basis computed (ADR-0295) ─────────────────
  // Emitted per-employee at each BFF compute site — logger + activity_trail only.
  await emit({
    event: "payroll.feriepenger_basis_computed",
    workspace_id: nonEmpty(auth.workspaceId, "workspaceId"),
    actor_id: nonEmpty(auth.profileId, "profileId"),
    properties: {
      entity: { entity_type: "payroll_period" as const, entity_id: body.period_id },
      data: {
        workspace_id: auth.workspaceId,
        period_id: body.period_id,
        profile_id: body.profile_id,
        basis_amount: singleFeriepengerBasis,
        pct_applied: singlePctApplied,
        base_pay_total: singleBasePay,
        channel: "system" as const,
      },
    },
  });

  // ─── Step 6: Generate single PDF ──────────────────────────────────────────
  const exportedAt = new Date();
  const periodLabel = String(period.start_date).slice(0, 7);
  const workspaceSlug =
    (workspace as { slug?: string | null }).slug ?? auth.workspaceId.slice(0, 8);

  const pdfOpts: LonnsgrunnlagPdfOptions = {
    workspaceOrgnr:
      (workspace as { company?: { org_number?: string | null } | null }).company?.org_number ??
      "000000000",
    workspaceName: (workspace as { name?: string | null }).name ?? workspaceSlug,
    periodStartDate: String(period.start_date),
    periodEndDate: String(period.end_date),
    periodId: body.period_id,
    workspaceSlug,
    periodLabel,
    exportedAt,
    includeUnmasked: true, // lønnsgrunnlag always contains actual PII (personnummer/bankkonto)
    generatedAt: exportedAt.toISOString(),
  };

  let pdfResult: Awaited<ReturnType<typeof generateLonnsgrunnlagPdf>>;
  try {
    pdfResult = await generateLonnsgrunnlagPdf(aggregateRow, pdfOpts);
  } catch (renderErr) {
    console.error("[generate-pdf-single] renderToBuffer threw:", renderErr);
    return NextResponse.json({ ok: false, error: "render_error" }, { status: 500 });
  }

  // ─── Step 7: Upload to storage bucket ────────────────────────────────────
  const storagePath = `${auth.workspaceId}/${body.period_id}/${body.profile_id}.pdf`;

  const { error: uploadErr } = await admin.storage
    .from("payroll-lonnsgrunnlag")
    .upload(storagePath, pdfResult.buffer, {
      contentType: "application/pdf",
      upsert: true,
    });

  if (uploadErr) {
    return NextResponse.json(
      {
        ok: false,
        error: "storage_upload_failed",
        detail: uploadErr.message,
      },
      { status: 500 },
    );
  }

  // ─── Step 8: INSERT payroll.export_event (Bokføringsloven §13) ────────────
  const fileHash = computeFileHash(pdfResult.sha256);
  const idempotencyKey = `${body.period_id}-pdf-single-${body.profile_id}-${exportedAt.toISOString()}`;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: exportEvent, error: exportErr } = await (admin.schema("payroll") as any)
    .from("export_event")
    .insert({
      workspace_id: auth.workspaceId,
      period_id: body.period_id,
      exported_by: auth.profileId,
      export_format: "pdf",
      status: "completed",
      started_at: exportedAt.toISOString(),
      completed_at: new Date().toISOString(),
      variant: "aggregate",
      masked: false,
      file_hash: fileHash,
      idempotency_key: idempotencyKey,
      row_count: 1,
    })
    .select("id")
    .single();

  if (exportErr || !exportEvent) {
    const isIdempotencyConflict = (exportErr as { code?: string } | null)?.code === "23505";
    if (isIdempotencyConflict) {
      return NextResponse.json({ ok: false, error: "duplicate_export" }, { status: 409 });
    }
    return NextResponse.json({ ok: false, error: "db_write_failed" }, { status: 500 });
  }

  // ─── Step 9: Generate signed URL ─────────────────────────────────────────
  const expiresInSeconds = isAdmin ? 86400 : 3600;
  const { data: signedUrlData, error: signedUrlErr } = await admin.storage
    .from("payroll-lonnsgrunnlag")
    .createSignedUrl(storagePath, expiresInSeconds);

  if (signedUrlErr || !signedUrlData?.signedUrl) {
    return NextResponse.json({ ok: false, error: "signed_url_failed" }, { status: 500 });
  }

  const expiresAt = new Date(Date.now() + expiresInSeconds * 1000).toISOString();
  const exportEventId = String((exportEvent as { id: string }).id);

  // ─── Step 10: Emit telemetry (ADR-0134) ───────────────────────────────────
  const wsId = nonEmpty(auth.workspaceId, "workspaceId");
  const actorId = nonEmpty(auth.profileId, "profileId");

  await emit({
    event: "payroll.lonnsgrunnlag_generated",
    workspace_id: wsId,
    actor_id: actorId,
    properties: {
      entity: { entity_type: "payroll_export_event" as const, entity_id: exportEventId },
      data: {
        export_event_id: exportEventId,
        period_id: body.period_id,
        profile_count: 1,
        format: "pdf",
        masked: false,
      },
    },
  });

  await emit({
    event: "payroll.lonnsgrunnlag_url_granted",
    workspace_id: wsId,
    actor_id: actorId,
    properties: {
      entity: { entity_type: "payroll_export_event" as const, entity_id: exportEventId },
      data: {
        export_event_id: exportEventId,
        profile_id: body.profile_id,
        expires_in_seconds: expiresInSeconds,
        granted_to: isAdmin ? "admin" : "employee",
      },
    },
  });

  return NextResponse.json({
    ok: true,
    event_id: exportEventId,
    signed_url: signedUrlData.signedUrl,
    expires_at: expiresAt,
    profile_id: body.profile_id,
  });
}
