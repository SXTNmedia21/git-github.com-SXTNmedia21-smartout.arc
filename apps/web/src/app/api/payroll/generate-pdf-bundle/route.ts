/**
 * BFF POST /api/payroll/generate-pdf-bundle
 *
 * Admin: generate a per-employee PDF lønnsgrunnlag bundle for a locked payroll
 * period. Each employee gets one PDF; all are uploaded to the
 * payroll-lonnsgrunnlag storage bucket. Returns signed download URLs (24h) for
 * immediate use in the admin list view.
 *
 * Pipeline:
 *   1. rejectCrossOrigin
 *   2. resolvePayrollAuth (server-derived identity — ADR-0151)
 *   3. gateAction (admin role, capability=payroll, actionType=generate_pdf_bundle)
 *   4. Verify period belongs to workspace and is 'locked' (ADR-0151, L-0177)
 *   5. Fetch aggregate rows (latest calculation_version per profile)
 *   6. Fetch PII + display_name
 *   7. generateBundlePdfs() — sequential render, <5s for 12 employees
 *   8. Upload each PDF to payroll-lonnsgrunnlag bucket (upsert=true for idempotency)
 *   9. INSERT payroll.export_event (format='pdf', Bokføringsloven §13)
 *   10. Pre-sign URLs (24h admin expiry)
 *   11. emit payroll.lonnsgrunnlag_generated
 *   12. Return { event_id, files: [{ profile_id, path, signed_url, sha256 }] }
 *
 * On failure: emit payroll.lonnsgrunnlag_generation_failed, return 5xx.
 *
 * ADR compliance (body verified before docstring — L-0176):
 *   ADR-0151 — workspace_id + profile_id derived server-side via resolvePayrollAuth
 *   ADR-0204 — gateAction before write
 *   ADR-0240 — writes only to payroll.export_event + storage.objects (RLS-scoped)
 *   ADR-0134 — emit() with non-null workspaceId + actorId (nonEmpty asserts)
 *   L-0177   — fail fast on period not found, wrong workspace, not locked
 *   L-0176   — body implemented before this docstring
 *   ADR-0078 — payroll = Høy-PII; channel pinned to "chat" at BFF layer
 *   ADR-0294 — storage path convention: {workspace_id}/{period_id}/{profile_id}.pdf
 *   Bokføringsloven §13 — export_event is append-only (RLS blocks UPDATE/DELETE for JWT users)
 */
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";

import { gateAction } from "@/app/dashboard/_actions/_shared";
import { rejectCrossOrigin, resolvePayrollAuth } from "@/app/api/payroll/_shared";
import { createAdminClient } from "@smartout/supabase/admin";
import { emit, nonEmpty } from "@smartout/telemetry";
import {
  generateBundlePdfs,
  computeFileHash,
  computeFeriepengerBasis,
} from "@smartout/payroll-export";
import type { AggregateRow, LonnsgrunnlagPdfOptions } from "@smartout/payroll-export";

export const runtime = "nodejs";

const RequestSchema = z.object({
  workspace_id: z.string().uuid().describe("UUID of the workspace context (UI-resolved)"),
  period_id: z.string().uuid().describe("UUID of the payroll period to export (must be locked)"),
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
    actionType: "generate_pdf_bundle",
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
    .select("id, status, start_date, end_date, workspace_id")
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
        detail: `Periode er ${String(period.status)} — PDF-generering krever låst periode.`,
      },
      { status: 409 },
    );
  }

  // ─── Step 3: Fetch workspace metadata for PDF header ──────────────────────
  const { data: workspace, error: wsErr } = await admin
    .from("workspace")
    .select("slug, name, company:company_id(org_number)")
    .eq("workspace_id", auth.workspaceId)
    .maybeSingle();

  if (wsErr || !workspace) {
    return NextResponse.json({ ok: false, error: "workspace_not_found" }, { status: 404 });
  }

  // ─── Step 4: Fetch aggregate rows (latest calculation_version per profile) ─
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
    await emitFailure(auth.workspaceId, auth.profileId, body.period_id, "db_error");
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

  // ─── Step 5: Fetch PII + display_name ─────────────────────────────────────
  // personal_number + bank_account live on profile table (Phase 5 council fix 1aa646181).
  // employee_payroll_profile does NOT have personal_id_number / bank_account_number.
  const profileIds = latestCalcs.map((c) => c.profile_id);

  const { data: profiles, error: profErr } = await admin
    .from("profile")
    .select("profile_id, display_name, personal_number, bank_account")
    .in("profile_id", profileIds)
    .eq("workspace_id", auth.workspaceId);

  if (profErr) {
    await emitFailure(auth.workspaceId, auth.profileId, body.period_id, "db_error");
    return NextResponse.json({ ok: false, error: "db_error" }, { status: 500 });
  }

  const profileMap = new Map((profiles ?? []).map((p) => [p.profile_id, p]));

  // Fetch holiday_allowance_pct from employee_payroll_profile (ADR-0295: basis compute).
  // Default to 12 (Riksavtalen) for any profile without a payroll record.
  const { data: payrollProfiles } = await admin
    .from("employee_payroll_profile")
    .select("profile_id, holiday_allowance_pct")
    .in("profile_id", profileIds)
    .eq("workspace_id", auth.workspaceId);

  const payrollProfileMap = new Map(
    ((payrollProfiles ?? []) as { profile_id: string; holiday_allowance_pct: number | null }[]).map(
      (p) => [p.profile_id, p],
    ),
  );

  const exportedAt = new Date();
  const periodLabel = String(period.start_date).slice(0, 7); // "yyyy-MM"
  const workspaceSlug =
    (workspace as { slug?: string | null }).slug ?? auth.workspaceId.slice(0, 8);

  // Track per-profile feriepenger inputs for post-loop emit (ADR-0295).
  type FeriepengerEmitInput = {
    profile_id: string;
    basePay: number;
    pctApplied: number;
    basisAmount: number;
  };
  const feriepengerEmits: FeriepengerEmitInput[] = [];

  const aggregateRows: AggregateRow[] = latestCalcs.map((c) => {
    const prof = profileMap.get(c.profile_id);
    const payrollProf = payrollProfileMap.get(c.profile_id);
    const basePay = Number(c.base_pay ?? 0);
    const pctApplied = Number(payrollProf?.holiday_allowance_pct ?? 12);
    const basisAmount = computeFeriepengerBasis({
      basePayTotal: basePay,
      holidayAllowancePct: pctApplied,
    });
    feriepengerEmits.push({ profile_id: c.profile_id, basePay, pctApplied, basisAmount });
    return {
      profile_id: c.profile_id,
      profile_name: prof?.display_name ?? c.profile_id,
      personnummer: (prof as { personal_number?: string | null })?.personal_number ?? null,
      bankkonto: (prof as { bank_account?: string | null })?.bank_account ?? null,
      base_pay: basePay,
      total_supplements: Number(c.total_supplements ?? 0),
      total_deductions: Number(c.total_deductions ?? 0),
      total_pay: Number(c.total_pay ?? 0),
      taxable_pay: Number(c.total_pay ?? 0),
      // ADR-0295: basis = base_pay × holiday_allowance_pct / 100.
      // Per-employee override from employee_payroll_profile; default 12 (Riksavtalen).
      feriepenger_basis: basisAmount,
    } satisfies AggregateRow;
  });

  // ─── Step 5b: Emit feriepenger basis computed per profile (ADR-0295) ─────
  // Emitted per-employee — logger + activity_trail only (high-frequency; PostHog excluded).
  {
    const wsId = nonEmpty(auth.workspaceId, "workspaceId");
    const actorId = nonEmpty(auth.profileId, "profileId");
    await Promise.allSettled(
      feriepengerEmits.map((f) =>
        emit({
          event: "payroll.feriepenger_basis_computed",
          workspace_id: wsId,
          actor_id: actorId,
          properties: {
            entity: { entity_type: "payroll_period" as const, entity_id: body.period_id },
            data: {
              workspace_id: auth.workspaceId,
              period_id: body.period_id,
              profile_id: f.profile_id,
              basis_amount: f.basisAmount,
              pct_applied: f.pctApplied,
              base_pay_total: f.basePay,
              channel: "system" as const,
            },
          },
        }),
      ),
    );
  }

  // ─── Step 6: Generate PDF bundle ──────────────────────────────────────────
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
    includeUnmasked: true, // Admin bundle: always unmasked (lønnsgrunnlag is PII-bearing by design)
    generatedAt: exportedAt.toISOString(),
  };

  let pdfBundle: Awaited<ReturnType<typeof generateBundlePdfs>>;
  try {
    pdfBundle = await generateBundlePdfs(aggregateRows, pdfOpts);
  } catch (renderErr) {
    await emitFailure(auth.workspaceId, auth.profileId, body.period_id, "render_error");
    console.error("[generate-pdf-bundle] renderToBuffer threw:", renderErr);
    return NextResponse.json({ ok: false, error: "render_error" }, { status: 500 });
  }

  // ─── Step 7: Upload each PDF to storage bucket ───────────────────────────
  // Path convention: {workspace_id}/{period_id}/{profile_id}.pdf (ADR-0294).
  const uploadResults: { profile_id: string; path: string; sha256: string; signed_url: string }[] =
    [];

  for (const item of pdfBundle) {
    const storagePath = `${auth.workspaceId}/${body.period_id}/${item.profile_id}.pdf`;

    const { error: uploadErr } = await admin.storage
      .from("payroll-lonnsgrunnlag")
      .upload(storagePath, item.buffer, {
        contentType: "application/pdf",
        upsert: true,
      });

    if (uploadErr) {
      await emitFailure(auth.workspaceId, auth.profileId, body.period_id, "storage_upload_failed");
      return NextResponse.json(
        {
          ok: false,
          error: "storage_upload_failed",
          detail: `Feil ved opplasting av PDF for profil ${item.profile_id}: ${uploadErr.message}`,
        },
        { status: 500 },
      );
    }

    // Pre-sign URL with admin expiry (24h) for direct download from list view.
    const { data: signedUrlData, error: signedUrlErr } = await admin.storage
      .from("payroll-lonnsgrunnlag")
      .createSignedUrl(storagePath, 86400);

    if (signedUrlErr || !signedUrlData?.signedUrl) {
      await emitFailure(auth.workspaceId, auth.profileId, body.period_id, "storage_upload_failed");
      return NextResponse.json({ ok: false, error: "signed_url_failed" }, { status: 500 });
    }

    uploadResults.push({
      profile_id: item.profile_id,
      path: storagePath,
      sha256: item.sha256,
      signed_url: signedUrlData.signedUrl,
    });
  }

  // ─── Step 8: INSERT payroll.export_event (Bokføringsloven §13) ────────────
  const combinedHash = computeFileHash(pdfBundle.map((b) => b.sha256).join("\n"));
  const idempotencyKey = `${body.period_id}-pdf-${exportedAt.toISOString()}`;

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
      masked: false, // Admin bundle is always unmasked
      file_hash: combinedHash,
      idempotency_key: idempotencyKey,
      row_count: pdfBundle.length,
    })
    .select("id")
    .single();

  if (exportErr || !exportEvent) {
    const isIdempotencyConflict = (exportErr as { code?: string } | null)?.code === "23505";
    if (isIdempotencyConflict) {
      return NextResponse.json({ ok: false, error: "duplicate_export" }, { status: 409 });
    }
    await emitFailure(auth.workspaceId, auth.profileId, body.period_id, "db_write_failed");
    return NextResponse.json({ ok: false, error: "db_write_failed" }, { status: 500 });
  }

  // ─── Step 9: Emit telemetry (ADR-0134) ────────────────────────────────────
  const wsId = nonEmpty(auth.workspaceId, "workspaceId");
  const actorId = nonEmpty(auth.profileId, "profileId");
  const exportEventId = String((exportEvent as { id: string }).id);

  await emit({
    event: "payroll.lonnsgrunnlag_generated",
    workspace_id: wsId,
    actor_id: actorId,
    properties: {
      entity: { entity_type: "payroll_export_event" as const, entity_id: exportEventId },
      data: {
        export_event_id: exportEventId,
        period_id: body.period_id,
        profile_count: pdfBundle.length,
        format: "pdf",
        masked: false,
      },
    },
  });

  return NextResponse.json({
    ok: true,
    event_id: exportEventId,
    files: uploadResults,
  });
}

// ── Internal helper ────────────────────────────────────────────────────────────

async function emitFailure(
  workspaceId: string,
  profileId: string,
  periodId: string,
  errorCode: string,
): Promise<void> {
  try {
    const wsId = nonEmpty(workspaceId, "workspaceId");
    const actorId = nonEmpty(profileId, "profileId");
    await emit({
      event: "payroll.lonnsgrunnlag_generation_failed",
      workspace_id: wsId,
      actor_id: actorId,
      properties: {
        entity: {
          entity_type: "payroll_export_event" as const,
          entity_id: periodId,
        },
        data: {
          period_id: periodId,
          error_code: errorCode,
        },
      },
    });
  } catch {
    // Telemetry failure is non-fatal.
  }
}
