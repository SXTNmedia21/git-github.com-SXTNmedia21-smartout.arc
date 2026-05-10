/**
 * ExportTab — CSV + PDF lønnsgrunnlag export surface for a locked payroll period.
 *
 * Layout:
 *   Section 1 — "CSV-eksport"
 *     - Variant radio group: "Aggregert" (default) | "Audit (med provenance)"
 *     - Toggle: "Inkluder upålitt PII (admin-only)" — hidden if !isAdmin
 *       - Turning ON → opens UnmaskedConfirmDialog; toggle only stays ON after confirm
 *     - Download button "Last ned CSV"
 *       - Disabled if period.status !== 'locked' — shows helper text "Lås perioden først"
 *
 *   Section 2 — "PDF lønnsgrunnlag (per ansatt)"
 *     - Button "Generer PDF for alle ansatte" — bundle generation (disabled if not locked)
 *     - After success: inline list of generated files with per-file signed URL
 *
 *   Section 3 — "Eksporthistorikk"
 *     - Last 10 export_event rows via useRecentExports
 *
 * ADR-0133: web-only authoring surface (managers + admins only).
 * ADR-0134: telemetry emitted server-side by BFF — no client emit here.
 * ADR-0078: Høy-PII — unmasked toggle requires explicit confirm; server enforces.
 * ADR-0151: workspace_id and profile_id never sent from client; BFF derives from session.
 * Nordic Split: bg-background, text-foreground, border-border — no hardcoded colours.
 *
 * L-0176 compliance: docstring written after body verified.
 */
"use client";

import type { JSX } from "react";
import { useState } from "react";
import { format, parseISO } from "date-fns";
import { nb } from "date-fns/locale";
import { Download, FileText, Lock, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { useRecentExports, useExportPeriod } from "../_hooks/use-payroll-exports";
import {
  useGenerateBundle,
  type GenerateBundleResult,
  type PdfBundleFile,
} from "../_hooks/use-payroll-lonnsgrunnlag";
import { UnmaskedConfirmDialog } from "./UnmaskedConfirmDialog";
import type { ExportEventRow } from "@/app/api/payroll/exports/route";

// ─── Types ──────────────────────────────────────────────────────────────────

export type ExportTabProps = {
  periodId: string;
  periodStatus: string;
  isAdmin: boolean;
  /** Passed to PDF bundle hook for routing context (BFF re-validates from session). */
  workspaceId?: string;
  /** Profile ID of the current user — used as actorId in PDF mutations. */
  actorId?: string;
};

type ExportVariant = "aggregate" | "audit";

// ─── Helpers ────────────────────────────────────────────────────────────────

function variantLabel(variant: "aggregate" | "audit" | null): string {
  if (variant === "aggregate") return "Aggregert";
  if (variant === "audit") return "Audit";
  return "—";
}

function formatExportedAt(iso: string): string {
  try {
    return format(parseISO(iso), "d. MMM yyyy HH:mm", { locale: nb });
  } catch {
    return iso;
  }
}

// ─── PDF file row ────────────────────────────────────────────────────────────

function PdfFileRow({ file }: { file: PdfBundleFile }): JSX.Element {
  return (
    <li className="border-border flex items-center gap-3 border-b py-2.5 last:border-0">
      <FileText className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0" />
      <span className="text-foreground min-w-0 flex-1 truncate font-mono text-xs">
        {file.path.split("/").at(-1)}
      </span>
      <a
        href={file.signed_url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-primary hover:text-primary/80 flex shrink-0 items-center gap-1 text-xs font-medium transition-colors"
        aria-label={`Last ned PDF for profil ${file.profile_id}`}
      >
        <Download className="h-3 w-3" />
        Last ned
      </a>
    </li>
  );
}

// ─── Recent export row ───────────────────────────────────────────────────────

function ExportHistoryRow({ row }: { row: ExportEventRow }): JSX.Element {
  return (
    <li className="border-border flex items-center gap-3 border-b py-3 last:border-0">
      <FileText className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-foreground text-sm font-medium">{variantLabel(row.variant)}</span>
          {row.masked === false && (
            <Badge variant="destructive" className="text-xs">
              Upålitt PII
            </Badge>
          )}
          {row.status === "completed" && (
            <Badge variant="outline" className="text-xs">
              Fullført
            </Badge>
          )}
          {row.status === "failed" && (
            <Badge variant="destructive" className="text-xs">
              Feilet
            </Badge>
          )}
        </div>
        <p className="text-muted-foreground mt-0.5 text-xs">
          {formatExportedAt(row.exported_at)}
          {row.row_count !== null && ` · ${row.row_count} rader`}
        </p>
      </div>
    </li>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

export function ExportTab({
  periodId,
  periodStatus,
  isAdmin,
  workspaceId = "",
  actorId = "",
}: ExportTabProps): JSX.Element {
  const [variant, setVariant] = useState<ExportVariant>("aggregate");
  const [includeUnmasked, setIncludeUnmasked] = useState(false);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);

  // PDF bundle state — generated files shown inline after success
  const [pdfBundleFiles, setPdfBundleFiles] = useState<PdfBundleFile[]>([]);

  const { data: recentExports, isLoading: isLoadingExports } = useRecentExports(
    periodId,
    workspaceId,
  );
  const { mutate: exportPeriod, isPending: isExporting } = useExportPeriod();
  const { mutate: generateBundle, isPending: isGeneratingBundle } = useGenerateBundle();

  const isLocked = periodStatus === "locked";

  // ─── Unmasked toggle handler ────────────────────────────────────────────
  function handleUnmaskedToggle(checked: boolean): void {
    if (checked) {
      // Open confirm dialog — do not flip state until confirmed
      setConfirmDialogOpen(true);
    } else {
      setIncludeUnmasked(false);
    }
  }

  function handleConfirmUnmasked(): void {
    setIncludeUnmasked(true);
    setConfirmDialogOpen(false);
  }

  function handleCancelUnmasked(): void {
    // User cancelled — keep toggle OFF
    setIncludeUnmasked(false);
    setConfirmDialogOpen(false);
  }

  // ─── Download handler (CSV) ──────────────────────────────────────────────
  function handleDownload(): void {
    exportPeriod({ workspaceId, periodId, variant, includeUnmasked });
  }

  // ─── PDF bundle handler ──────────────────────────────────────────────────
  function handleGenerateBundle(): void {
    generateBundle(
      { periodId, workspaceId, actorId },
      {
        onSuccess: (data: GenerateBundleResult) => {
          setPdfBundleFiles(data.files);
        },
      },
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* ─── Header ──────────────────────────────────────────────────────── */}
      <div>
        <p className="text-muted-foreground font-mono text-[10.5px] font-medium tracking-widest uppercase">
          Lønnsperiode
        </p>
        <h2 className="font-heading text-foreground mt-1 text-2xl tracking-tight">CSV-eksport</h2>
      </div>

      {/* ─── Export form card ─────────────────────────────────────────────── */}
      <div className="bg-card border-border rounded-xl border p-5">
        <div className="flex flex-col gap-5">
          {/* Variant selector */}
          <div>
            <Label className="text-foreground mb-3 block text-sm font-medium">Eksportformat</Label>
            <RadioGroup
              value={variant}
              onValueChange={(v) => setVariant(v as ExportVariant)}
              className="flex flex-col gap-2 sm:flex-row"
            >
              <label
                className={`flex cursor-pointer items-start gap-3 rounded-lg border-[1.5px] p-4 transition-colors ${
                  variant === "aggregate"
                    ? "border-[oklch(0.65_0.22_40)] bg-[oklch(0.65_0.22_40_/_0.04)]"
                    : "border-border bg-background hover:bg-muted"
                }`}
              >
                <RadioGroupItem value="aggregate" id="variant-aggregate" className="mt-0.5" />
                <div>
                  <span className="text-foreground text-sm font-medium">Aggregert</span>
                  <p className="text-muted-foreground mt-0.5 text-xs leading-relaxed">
                    1 rad per ansatt — summer for perioden. Anbefalt for lønnsoppgjør.
                  </p>
                </div>
              </label>

              <label
                className={`flex cursor-pointer items-start gap-3 rounded-lg border-[1.5px] p-4 transition-colors ${
                  variant === "audit"
                    ? "border-[oklch(0.65_0.22_40)] bg-[oklch(0.65_0.22_40_/_0.04)]"
                    : "border-border bg-background hover:bg-muted"
                }`}
              >
                <RadioGroupItem value="audit" id="variant-audit" className="mt-0.5" />
                <div>
                  <span className="text-foreground text-sm font-medium">
                    Audit (med provenance)
                  </span>
                  <p className="text-muted-foreground mt-0.5 text-xs leading-relaxed">
                    1 rad per beregningslinje — inkluderer regel-ID, tariff-versjon og §-referanse.
                  </p>
                </div>
              </label>
            </RadioGroup>
          </div>

          {/* Unmasked PII toggle — admin only */}
          {isAdmin && (
            <div className="border-border flex items-center justify-between rounded-lg border p-4">
              <div className="flex items-center gap-3">
                <ShieldAlert className="text-muted-foreground h-4 w-4 shrink-0" />
                <div>
                  <p className="text-foreground text-sm font-medium">Inkluder upålitt PII</p>
                  <p className="text-muted-foreground text-xs">
                    Personnummer og bankkonto i klartekst — logges til revisjons-sporet
                  </p>
                </div>
              </div>
              <Switch
                checked={includeUnmasked}
                onCheckedChange={handleUnmaskedToggle}
                aria-label="Inkluder upålitt PII"
              />
            </div>
          )}

          {/* Download button + lock guard */}
          <div className="flex flex-col gap-2">
            {!isLocked && (
              <div className="bg-muted flex items-center gap-2 rounded-lg px-3.5 py-3">
                <Lock className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
                <p className="text-muted-foreground text-xs">
                  Lås perioden først for å aktivere CSV-eksport.
                </p>
              </div>
            )}
            <Button
              onClick={handleDownload}
              disabled={!isLocked || isExporting}
              className="w-full gap-2 sm:w-auto"
            >
              <Download className="h-4 w-4" />
              {isExporting ? "Genererer…" : "Last ned CSV"}
            </Button>
          </div>
        </div>
      </div>

      {/* ─── PDF lønnsgrunnlag section ────────────────────────────────────── */}
      <div className="bg-card border-border rounded-xl border p-5">
        <div className="mb-4">
          <h3 className="text-foreground text-sm font-semibold">PDF lønnsgrunnlag (per ansatt)</h3>
          <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
            1 PDF per ansatt, lastet opp til sikker lagring. Signert URL for nedlasting. Filnavn:{" "}
            <span className="font-mono">{"{workspace_id}/{period_id}/{profile_id}.pdf"}</span>
          </p>
        </div>

        {!isLocked && (
          <div className="bg-muted mb-3 flex items-center gap-2 rounded-lg px-3.5 py-3">
            <Lock className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
            <p className="text-muted-foreground text-xs">
              Lås perioden først for å aktivere PDF-generering.
            </p>
          </div>
        )}

        <Button
          onClick={handleGenerateBundle}
          disabled={!isLocked || isGeneratingBundle}
          variant="outline"
          className="w-full gap-2 sm:w-auto"
        >
          <Download className="h-4 w-4" />
          {isGeneratingBundle ? "Genererer PDFer…" : "Generer PDF for alle ansatte"}
        </Button>

        {/* Generated file list — shown after successful generation */}
        {pdfBundleFiles.length > 0 && (
          <div className="mt-4">
            <p className="text-muted-foreground mb-2 text-xs font-medium">
              {pdfBundleFiles.length} PDFer generert
            </p>
            <div className="bg-background border-border rounded-lg border px-4">
              <ul>
                {pdfBundleFiles.map((file) => (
                  <PdfFileRow key={file.profile_id} file={file} />
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>

      {/* ─── Recent exports ───────────────────────────────────────────────── */}
      <div>
        <h3 className="text-foreground mb-3 text-sm font-semibold">Eksporthistorikk</h3>

        {isLoadingExports ? (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full rounded-lg" />
            ))}
          </div>
        ) : recentExports && recentExports.length > 0 ? (
          <div className="bg-card border-border rounded-xl border px-4">
            <ul>
              {recentExports.map((row) => (
                <ExportHistoryRow key={row.id} row={row} />
              ))}
            </ul>
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">Ingen eksporter for denne perioden ennå.</p>
        )}
      </div>

      {/* Unmasked confirm dialog */}
      <UnmaskedConfirmDialog
        open={confirmDialogOpen}
        onConfirm={handleConfirmUnmasked}
        onCancel={handleCancelUnmasked}
      />
    </div>
  );
}
