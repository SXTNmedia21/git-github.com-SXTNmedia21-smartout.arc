/**
 * ExportTab — CSV export surface for a locked payroll period.
 *
 * Layout:
 *   - Header: "CSV-eksport"
 *   - Variant radio group: "Aggregert" (default) | "Audit (med provenance)"
 *   - Toggle: "Inkluder upålitt PII (admin-only)" — hidden if !isAdmin
 *     - Turning ON → opens UnmaskedConfirmDialog; toggle only stays ON after confirm
 *   - Download button "Last ned CSV"
 *     - Disabled if period.status !== 'locked' — shows helper text "Lås perioden først"
 *   - Recent exports section: last 10 export_event rows via useRecentExports
 *
 * ADR-0133: web-only authoring surface (managers + admins only).
 * ADR-0134: telemetry emitted server-side by capability tool — no client emit here.
 * ADR-0078: Høy-PII — unmasked toggle requires explicit confirm; server enforces.
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
import { UnmaskedConfirmDialog } from "./UnmaskedConfirmDialog";
import type { ExportEventRow } from "@/app/api/payroll/exports/route";

// ─── Types ──────────────────────────────────────────────────────────────────

export type ExportTabProps = {
  periodId: string;
  periodStatus: string;
  isAdmin: boolean;
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

export function ExportTab({ periodId, periodStatus, isAdmin }: ExportTabProps): JSX.Element {
  const [variant, setVariant] = useState<ExportVariant>("aggregate");
  const [includeUnmasked, setIncludeUnmasked] = useState(false);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);

  const { data: recentExports, isLoading: isLoadingExports } = useRecentExports(periodId);
  const { mutate: exportPeriod, isPending: isExporting } = useExportPeriod();

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

  // ─── Download handler ────────────────────────────────────────────────────
  function handleDownload(): void {
    exportPeriod({ periodId, variant, includeUnmasked });
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
