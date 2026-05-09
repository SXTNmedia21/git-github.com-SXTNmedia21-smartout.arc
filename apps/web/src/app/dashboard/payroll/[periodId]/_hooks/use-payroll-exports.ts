/**
 * Hooks for payroll CSV export.
 *
 * useRecentExports(periodId)
 *   — GET /api/payroll/exports?periodId=<uuid>
 *   — Returns last 10 export_event rows for the period.
 *   — Returns [] on empty (L-0177: no throw on empty list).
 *
 * useExportPeriod()
 *   — Mutation that:
 *       1. Calls server action exportPeriodCsv (gate + parameter validation)
 *       2. On ok: POSTs to BFF /api/payroll/export-period with credentials (cookie)
 *          to receive the CSV stream
 *       3. Triggers browser download via blob + <a download> click
 *       4. Invalidates useRecentExports so the new event appears
 *   — Telemetry: emitted server-side by the BFF route (ADR-0134). No client emit.
 *
 * ADR-0133: web-only authoring surface.
 * ADR-0134: BFF owns telemetry — no client emit in this hook.
 * L-0176 compliance: docstring written after body verified.
 */
"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { ExportEventRow } from "@/app/api/payroll/exports/route";
import { exportPeriodCsv } from "../_actions/export-actions";

// ─── Query key ─────────────────────────────────────────────────────────────

const exportKeys = {
  recentExports: (periodId: string) => ["payroll", "exports", periodId] as const,
};

// ─── Types ──────────────────────────────────────────────────────────────────

export type { ExportEventRow };

export type ExportPeriodInput = {
  periodId: string;
  variant: "aggregate" | "audit";
  includeUnmasked: boolean;
};

export type ExportPeriodResult = {
  eventId: string;
  filename: string;
};

// ─── useRecentExports ───────────────────────────────────────────────────────

async function fetchRecentExports(periodId: string): Promise<ExportEventRow[]> {
  const res = await fetch(`/api/payroll/exports?periodId=${encodeURIComponent(periodId)}`);
  if (!res.ok) {
    // L-0177: surface error via throw (not silent fallback)
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? "Kunne ikke hente eksporthistorikk");
  }
  const data = (await res.json()) as ExportEventRow[];
  return Array.isArray(data) ? data : [];
}

export function useRecentExports(periodId: string) {
  return useQuery<ExportEventRow[]>({
    queryKey: exportKeys.recentExports(periodId),
    queryFn: () => fetchRecentExports(periodId),
    staleTime: 30 * 1000, // 30s — exports change after each download
    retry: 1,
    enabled: !!periodId,
  });
}

// ─── useExportPeriod ────────────────────────────────────────────────────────

/**
 * Trigger browser download by creating a hidden <a> element.
 * Blob approach: no page navigation, works with in-memory CSV bytes.
 */
function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => URL.revokeObjectURL(url), 5_000);
}

async function runExportPeriod(input: ExportPeriodInput): Promise<ExportPeriodResult> {
  // Step 1: Server action — validates parameters and provides the BFF route URL.
  const actionResult = await exportPeriodCsv(input.periodId, input.variant, input.includeUnmasked);

  if (!actionResult.ok) {
    throw new Error(actionResult.error ?? "Eksport feilet");
  }

  // Step 2: POST to BFF streaming route with same-origin credentials (cookie auth).
  // The BFF handles: gate → verify period locked → fetch rows → generate CSV →
  // INSERT export_event → stream CSV bytes.
  const bffRes = await fetch(actionResult.downloadUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({
      period_id: input.periodId,
      variant: input.variant,
      include_unmasked: input.includeUnmasked,
    }),
  });

  if (!bffRes.ok) {
    const errorBody = (await bffRes.json().catch(() => ({}))) as { error?: string };
    throw new Error(
      errorBody.error === "period_not_locked"
        ? "Perioden er ikke låst — lås perioden først."
        : (errorBody.error ?? `Eksportfeil (HTTP ${bffRes.status})`),
    );
  }

  // Step 3: Extract event ID from response header
  const eventId = bffRes.headers.get("X-Export-Event-Id") ?? actionResult.eventId;

  // Step 4: Derive filename from Content-Disposition
  const disposition = bffRes.headers.get("content-disposition") ?? "";
  const filenameMatch = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/.exec(disposition);
  const filename =
    filenameMatch?.[1]?.replace(/['"]/g, "") ??
    `payroll-${input.periodId.slice(0, 8)}-${input.variant}.csv`;

  // Step 5: Get CSV bytes and trigger download
  const blob = await bffRes.blob();
  triggerBlobDownload(blob, filename);

  return { eventId, filename };
}

export function useExportPeriod() {
  const queryClient = useQueryClient();

  return useMutation<ExportPeriodResult, Error, ExportPeriodInput>({
    mutationFn: runExportPeriod,
    onSuccess: (_, variables) => {
      toast.success("Eksport klar — nedlasting starter.");
      // Invalidate recent exports so the new event appears immediately
      void queryClient.invalidateQueries({
        queryKey: exportKeys.recentExports(variables.periodId),
      });
    },
    onError: (err) => {
      toast.error(err.message ?? "Eksport feilet — prøv igjen.");
    },
  });
}
