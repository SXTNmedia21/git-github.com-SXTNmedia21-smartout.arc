import "server-only";

// settlement/run.ts — main orchestrator for executeSettlementRun.
//
// Coordinates the full avstemming pipeline:
//  1. Verify accountant access for every workspace (via userClient RLS).
//  2. Insert settlement_run row (running).
//  3. Lock period for each workspace.
//  4. Compute aggregates via billing RPC.
//  5. Render 4 artifacts in parallel.
//  6. Upload to Supabase Storage bucket "settlement-artifacts".
//  7. Insert settlement_artifact rows.
//  8. Update run status → succeeded.
//  9. Emit telemetry.
//
// ⛔ NEVER bypass accountant grant check — every workspace_id must be
//    verified before any DB write.
// ⛔ NEVER mutate settlement_run except via the state transitions below.
// ⛔ NEVER leak service_role key — this module never returns client refs.
// ⛔ NEVER write closed-status from this path (post-MVP only).

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@smartout/supabase";
import { emit, nonEmpty } from "@smartout/telemetry";
import { hasAccountantAccess } from "../../accountant";
import { renderSummaryPdf } from "./render-summary-pdf";
import { renderDetailCsv } from "./render-detail-csv";
import { renderInvoiceBundlePdf } from "./render-invoice-bundle";
import { renderDiscrepancyPdf } from "./render-discrepancy-pdf";
import type {
  RunSettlementInput,
  RunSettlementResult,
  RenderedArtifact,
  SettlementSummary,
} from "./types";

type DBClient = SupabaseClient<Database>;

// ── Helpers ─────────────────────────────────────────────────────────────────

/** ISO date string from Date or string. */
function toIsoDate(d: Date | string): string {
  if (typeof d === "string") return d;
  return d.toISOString().split("T")[0]!;
}

/** Human-readable period label from period_start, e.g. "September 2026". */
function periodLabel(periodStart: string): string {
  const date = new Date(periodStart + "T00:00:00Z");
  return date.toLocaleDateString("no-NO", { year: "numeric", month: "long" });
}

/**
 * Lookup workspace → company_id for access checking.
 *
 * We must verify hasAccountantAccess(userId, company_id) per workspace.
 * The user-scoped client (RLS) can only read workspaces their company
 * grants cover, so a failed lookup → access denied.
 */
async function resolveCompanyIds(
  userClient: DBClient,
  workspaceIds: string[],
): Promise<Map<string, string>> {
  if (workspaceIds.length === 0) return new Map();

  const { data, error } = await userClient
    .from("workspace")
    .select("workspace_id, company_id")
    .in("workspace_id", workspaceIds);

  if (error) throw new Error(`resolveCompanyIds: ${error.message}`);

  const map = new Map<string, string>();
  for (const row of data ?? []) {
    if (row.workspace_id && row.company_id) {
      map.set(row.workspace_id, row.company_id);
    }
  }
  return map;
}

/**
 * Upload a RenderedArtifact to Supabase Storage.
 * Returns the storage path.
 */
async function uploadArtifact(
  serviceClient: DBClient,
  runId: string,
  artifact: RenderedArtifact,
): Promise<string> {
  const path = `${runId}/${artifact.filename}`;
  const body =
    typeof artifact.content === "string"
      ? Buffer.from(artifact.content, "utf-8")
      : artifact.content;

  const { error } = await serviceClient.storage.from("settlement-artifacts").upload(path, body, {
    contentType: artifact.contentType,
    upsert: false, // each run gets its own unique path
  });

  if (error) {
    throw new Error(`uploadArtifact(${artifact.type}): ${error.message}`);
  }

  return path;
}

// ── Main orchestrator ───────────────────────────────────────────────────────

/**
 * Execute a settlement run end-to-end.
 *
 * @param serviceClient - Service-role client for DB writes + Storage.
 *   NEVER returned or logged — stays in server memory only.
 * @param userClient - User-JWT-scoped client for RLS-enforced access check.
 * @param userId - Authenticated user_identity.user_id.
 * @param input - Period + workspace scope.
 * @returns RunSettlementResult with run_id, status, artifacts_url.
 */
export async function executeSettlementRun(
  serviceClient: DBClient,
  userClient: DBClient,
  userId: string,
  input: RunSettlementInput,
): Promise<RunSettlementResult> {
  const periodStart = toIsoDate(input.period_start);
  const periodEnd = toIsoDate(input.period_end);
  const label = periodLabel(periodStart);

  // ── 1. Verify accountant access for every workspace ──────────────────────
  //
  // Resolve workspace → company_id via user-scoped client (RLS enforces that
  // the user can only read workspaces they have grants for — a missing row
  // means access denied even before hasAccountantAccess check).
  const companyMap = await resolveCompanyIds(userClient, input.workspace_ids);

  for (const wsId of input.workspace_ids) {
    const companyId = companyMap.get(wsId);
    if (!companyId) {
      throw new Error(`access_denied: workspace ${wsId} not accessible to user ${userId}`);
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ok = await hasAccountantAccess(userClient as any, userId, companyId);
    if (!ok) {
      throw new Error(
        `access_denied: no active grant for workspace ${wsId} (company ${companyId})`,
      );
    }
  }

  // ── 2. Insert settlement_run row (status='running') ──────────────────────
  //
  // eslint-disable-next-line smartout/no-direct-supabase-write
  const { data: runRow, error: runInsertErr } = await serviceClient
    .schema("billing")
    .from("settlement_run")
    .insert({
      scope: input.scope,
      initiated_by: userId,
      period_start: periodStart,
      period_end: periodEnd,
      workspace_ids: input.workspace_ids,
      status: "running",
      summary: {} as Json,
    })
    .select("run_id")
    .single();

  if (runInsertErr || !runRow) {
    throw new Error(`settlement_run insert failed: ${runInsertErr?.message ?? "unknown"}`);
  }

  const runId: string = runRow.run_id;

  // Wrap everything in a try/catch so we can set status='failed' on error.
  try {
    // ── 3. Lock period for each workspace ───────────────────────────────────
    //
    // lock_settlement_period is idempotent — calling it when already locked
    // is a no-op. Errors on 'closed' periods propagate as throw.
    for (const wsId of input.workspace_ids) {
      const { error: lockErr } = await serviceClient
        .schema("billing")
        .rpc("lock_settlement_period", {
          p_workspace_id: wsId,
          p_period_start: periodStart,
          p_period_end: periodEnd,
          p_locked_by: userId,
        });
      if (lockErr) {
        throw new Error(`lock_settlement_period(${wsId}): ${lockErr.message}`);
      }

      // Emit period_locked per workspace.
      // company_id supplied so billing_activity_log single-company path resolves
      // without triggering fan-out (ADR-0264: period_locked is workspace-scoped).
      await emit({
        event: "settlement period_locked",
        actor_id: nonEmpty(userId, "actor_id"),
        workspace_id: nonEmpty(wsId, "workspace_id"),
        properties: {
          entity: { entity_type: "settlement_period", entity_id: wsId },
          data: {
            workspace_id: wsId,
            period_start: periodStart,
            period_end: periodEnd,
            company_id: companyMap.get(wsId), // ← ADR-0264: enables billing_activity_log path
          },
        },
      });
    }

    // ── 4. Compute aggregates ────────────────────────────────────────────────
    const { data: aggregateRaw, error: aggregateErr } = await serviceClient
      .schema("billing")
      .rpc("compute_period_aggregates", {
        p_workspace_ids: input.workspace_ids,
        p_period_start: periodStart,
        p_period_end: periodEnd,
      });

    if (aggregateErr) {
      throw new Error(`compute_period_aggregates: ${aggregateErr.message}`);
    }

    // RPC returns JSON — cast to our typed shape.
    const summary = aggregateRaw as unknown as SettlementSummary;

    // ── 4b. Derive company IDs + workspace name map for renderers ────────────
    // Invoice table has no workspace_id — renderers filter by company_id.
    // Build a company_id → workspace_name map from the companyMap + workspace query.
    const companyIds = Array.from(new Set([...companyMap.values()]));

    // Build company_id → workspace_name map for the CSV column.
    // We have workspace_id → company_id in companyMap; invert it.
    const companyToWorkspaceName = new Map<string, string>();
    for (const [wsId, companyId] of companyMap.entries()) {
      // Use workspace_id as a fallback label — workspace name resolved in summary.
      const wsLabel = companyMap.size === 1 ? wsId : wsId.slice(0, 8);
      if (!companyToWorkspaceName.has(companyId)) {
        companyToWorkspaceName.set(companyId, wsLabel);
      }
    }
    // Override with workspace_name from summary if available.
    for (const [_wsId, wsSummary] of Object.entries(summary.by_workspace)) {
      // by_workspace is keyed by workspace_id — find the matching company_id.
      const cId = companyMap.get(_wsId);
      if (cId) {
        companyToWorkspaceName.set(cId, wsSummary.workspace_name);
      }
    }

    // ── 5. Generate 4 artifacts in parallel ─────────────────────────────────
    const [summaryBuf, csvStr, bundleBuf, discrepancyBuf] = await Promise.all([
      renderSummaryPdf(summary, label),
      renderDetailCsv(serviceClient, companyIds, companyToWorkspaceName, periodStart, periodEnd),
      renderInvoiceBundlePdf(serviceClient, companyIds, periodStart, periodEnd, label),
      renderDiscrepancyPdf(summary.discrepancies, label),
    ]);

    // ── 6. Upload to Storage ─────────────────────────────────────────────────
    // Bucket "settlement-artifacts" is declarative per migration 20260522010000.
    const artifactsToUpload: RenderedArtifact[] = [
      {
        type: "summary_pdf",
        content: summaryBuf,
        contentType: "application/pdf",
        filename: "summary.pdf",
      },
      {
        type: "detail_csv",
        content: csvStr,
        contentType: "text/csv; charset=utf-8",
        filename: "detail.csv",
      },
      {
        type: "discrepancy_pdf",
        content: discrepancyBuf,
        contentType: "application/pdf",
        filename: "discrepancy.pdf",
      },
    ];

    // invoice_bundle_pdf is optional — null when 0 invoices in period.
    if (bundleBuf !== null) {
      artifactsToUpload.push({
        type: "invoice_bundle_pdf",
        content: bundleBuf,
        contentType: "application/pdf",
        filename: "invoice-bundle.pdf",
      });
    }

    // Upload all artifacts in parallel.
    const uploadedPaths = await Promise.all(
      artifactsToUpload.map((a) => uploadArtifact(serviceClient, runId, a)),
    );

    // ── 7. Insert settlement_artifact rows ──────────────────────────────────
    const artifactInserts = artifactsToUpload.map((a, i) => ({
      run_id: runId,
      artifact_type: a.type,
      storage_path: uploadedPaths[i]!,
      file_size_bytes:
        typeof a.content === "string" ? Buffer.byteLength(a.content, "utf-8") : a.content.length,
      // Strip charset suffix: "text/csv; charset=utf-8" → "text/csv" for the NOT NULL column.
      mime_type: a.contentType.split(";")[0]!.trim(),
    }));

    // eslint-disable-next-line smartout/no-direct-supabase-write
    const { error: artifactInsertErr } = await serviceClient
      .schema("billing")
      .from("settlement_artifact")
      .insert(artifactInserts);

    if (artifactInsertErr) {
      throw new Error(`settlement_artifact insert: ${artifactInsertErr.message}`);
    }

    // ── 8. Update run → succeeded ────────────────────────────────────────────
    // eslint-disable-next-line smartout/no-direct-supabase-write
    const { error: updateErr } = await serviceClient
      .schema("billing")
      .from("settlement_run")
      .update({
        status: "succeeded",
        completed_at: new Date().toISOString(),
        summary: summary as unknown as Json,
      })
      .eq("run_id", runId);

    if (updateErr) {
      throw new Error(`settlement_run update (succeeded): ${updateErr.message}`);
    }

    // ── 9. Emit telemetry ────────────────────────────────────────────────────
    // company_ids: fan-out anchor for billing_activity_log (ADR-0264).
    // workspace_id is null (run spans multiple workspaces); activity_trail
    // silently drops this event. billing_activity_log fan-out path writes
    // one row per company — Bokføringsloven §10 audit record.
    const resolvedCompanyIds = Array.from(new Set([...companyMap.values()]));
    await emit({
      event: "settlement run_completed",
      actor_id: nonEmpty(userId, "actor_id"),
      workspace_id: null,
      properties: {
        entity: { entity_type: "settlement_run", entity_id: runId },
        data: {
          run_id: runId,
          period_start: periodStart,
          period_end: periodEnd,
          workspace_count: input.workspace_ids.length,
          artifact_count: artifactInserts.length,
          company_ids: resolvedCompanyIds, // ← ADR-0264: triggers fan-out in provider
        },
      },
    });

    return {
      run_id: runId,
      status: "succeeded",
      artifacts_url: `/avstemming/${runId}`,
    };
  } catch (err) {
    // ── Error path: update run → failed ─────────────────────────────────────
    const errMessage = err instanceof Error ? err.message : String(err);

    // Best-effort — if this also fails, the original error is still thrown below.
    await serviceClient
      .schema("billing")
      .from("settlement_run")
      .update({
        status: "failed",
        completed_at: new Date().toISOString(),
        error_message: errMessage.slice(0, 1000),
      })
      .eq("run_id", runId)
      .then(({ error: e }) => {
        if (e) console.error("[settlement/run] failed to update run status to failed:", e);
      });

    // Emit run_failed (best-effort).
    // company_ids derived inline from companyMap (outer scope, line 136) —
    // ADR-0264: triggers billing_activity_log fan-out for audit coverage.
    await emit({
      event: "settlement run_failed",
      actor_id: nonEmpty(userId, "actor_id"),
      workspace_id: null,
      properties: {
        entity: { entity_type: "settlement_run", entity_id: runId },
        data: {
          run_id: runId,
          period_start: periodStart,
          period_end: periodEnd,
          error: errMessage.slice(0, 500),
          company_ids: Array.from(new Set([...companyMap.values()])), // ← ADR-0264: fan-out anchor
        },
      },
    }).catch(console.error);

    return {
      run_id: runId,
      status: "failed",
      artifacts_url: `/avstemming/${runId}`,
      error: errMessage,
    };
  }
}
