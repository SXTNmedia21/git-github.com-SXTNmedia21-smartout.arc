"use client";

/**
 * LineDrawer — per-employee drill-down for a payroll period.
 *
 * What: Sheet that opens when a row in LinesTable is clicked, showing:
 *   - Tab 1 "Vakter": each payroll.calculation row (one per shift)
 *   - Tab 2 "Linjer": each payroll.calculation_line row (salary-code level)
 *
 * Phase 2 additions (T4.1, T4.2, T3.3):
 *   - T4.1: "Overstyr linje" action button on derived lines → opens LineOverrideModal
 *   - T4.2: "Venter godkjenning" badge on lines with a pending override proposal
 *   - T3.3: "+ Manuelt tillegg" button in drawer header → opens ManualSupplementForm
 *
 * Why: ADR-0251 "100% Transparency" — every krone must trace to input + rule + rate.
 *      The drawer is the Layer-1 UI trace path described in ARCHITECTURE.md §Layer 1.
 *
 * Data: supabase anon client (RLS-scoped to authenticated user's workspace).
 *       Line override proposals fetched via usePendingOverrides (BFF, ADR-0151).
 *
 * ADR-0078: No PII in this view (timebank balances, shift times — not Høy-PII).
 * ADR-0133: Web-only authoring surface. Mobile reads via my-salary.
 * ADR-0292: Override action creates change_proposal only — payroll_calculation unchanged.
 * Nordic Split: all colours from CSS variables.
 */

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { nb } from "date-fns/locale";
import { Loader2, X, Plus, Edit2, Download, Trash2 } from "lucide-react";
import { createClient } from "@smartout/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { PayrollLine } from "../_hooks/use-payroll-lines";
import { usePendingOverrides } from "../_hooks/use-line-overrides";
import { useGenerateSingle } from "../_hooks/use-payroll-lonnsgrunnlag";
import { useManualSupplements, useDeleteManualSupplement } from "../_hooks/use-manual-supplements";
import { LineOverrideModal } from "./LineOverrideModal";
import type { OverrideLine } from "./LineOverrideModal";
import { ManualSupplementForm } from "./ManualSupplementForm";

// ─── Types ─────────────────────────────────────────────────────────────────

type CalcRow = {
  id: string;
  schedule_shift_id: string;
  scheduled_start: string;
  scheduled_end: string;
  net_working_minutes: number;
  base_rate: number;
  base_pay: number;
  total_supplements: number;
  total_deductions: number;
  total_pay: number;
  calculation_version: number;
  calculated_at: string;
};

type CalcLine = {
  id: string;
  calculation_id: string;
  salary_code: string;
  line_type: string;
  hours: number | null;
  rate: number | null;
  amount: number;
  description: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  periodId: string;
  line: PayrollLine | null;
  /** Used to guard override UI. Defaults to 'open'. */
  periodStatus?: string;
  /** Passed to ManualSupplementForm for prefill. */
  workspaceId?: string;
  /** actorId for PDF single-generation telemetry (BFF re-validates from session). */
  actorId?: string;
  /** Show "Last ned PDF" button when true and period is locked. */
  isAdmin?: boolean;
};

// ─── Helpers ───────────────────────────────────────────────────────────────

function formatNok(amount: number): string {
  return new Intl.NumberFormat("nb-NO", {
    style: "currency",
    currency: "NOK",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (m === 0) return `${h}t`;
  return `${h}t ${m}m`;
}

function formatTs(iso: string | null): string {
  if (!iso) return "—";
  try {
    return format(new Date(iso), "d. MMM HH:mm", { locale: nb });
  } catch {
    return iso;
  }
}

// LINE_TYPE_LABELS kept for the override-modal shiftDate field (legacy use only).
// The Linjer tab no longer uses this map — it renders cl.description directly
// so descriptions produced by the seed script (e.g. "Helgetillegg — lør. 03.05.")
// are shown as-is without duplication. Fix 6.
const LINE_TYPE_LABELS: Record<string, string> = {
  worked_hours: "Arbeidstimer",
  supplement: "Tillegg",
  overtime: "Overtid",
  absence: "Fravær",
  deduction: "Trekk",
  monthly_salary: "Fastlønn",
  manual_adj: "Manuell justering",
  base: "Grunnlønn",
  tip: "Drikkepenger",
  meal: "Matpenger",
};

// ─── Component ─────────────────────────────────────────────────────────────

export function LineDrawer({
  open,
  onClose,
  periodId,
  line,
  periodStatus = "open",
  workspaceId = "",
  actorId = "",
  isAdmin = false,
}: Props) {
  const [calcs, setCalcs] = useState<CalcRow[]>([]);
  const [calcLines, setCalcLines] = useState<CalcLine[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // T4.1: override modal state
  const [overrideModalOpen, setOverrideModalOpen] = useState(false);
  const [selectedOverrideLine, setSelectedOverrideLine] = useState<OverrideLine | null>(null);

  // T3.3: manual supplement modal state
  const [supplementModalOpen, setSupplementModalOpen] = useState(false);

  // T3.4: delete supplement confirm dialog state
  const [deleteSupplementId, setDeleteSupplementId] = useState<string | null>(null);
  const [deleteSupplementDesc, setDeleteSupplementDesc] = useState<string>("");

  // T4.2: pending overrides — set of calculation_line_ids with pending proposals
  const { data: pendingLineIds } = usePendingOverrides(periodId);

  // T4.3: per-profile PDF single-generation (locked periods only, admin only)
  const { mutate: generateSingle, isPending: isGeneratingSingle } = useGenerateSingle();

  // T3.4: manual supplements for this period (filtered to this profile via shift cross-ref)
  const { data: allSupplements } = useManualSupplements(periodId);
  const { mutate: deleteSupplement, isPending: isDeletingSupplement } =
    useDeleteManualSupplement(periodId);

  const isPeriodOpen = periodStatus === "open";
  const isPeriodLocked = periodStatus === "locked";

  // Filter supplements to those belonging to this profile (via shift cross-reference).
  // calcs contains all shifts for this profile+period; supplements link to shift IDs.
  const profileShiftIds = new Set(calcs.map((c) => c.schedule_shift_id));
  const profileSupplements = (allSupplements ?? []).filter((s) =>
    profileShiftIds.has(s.schedule_shift_id),
  );

  useEffect(() => {
    if (!open || !line) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    void (async () => {
      const supabase = createClient();

      // Fetch per-shift calculations for this profile + period
      const { data: calcData, error: calcErr } = await supabase
        .schema("payroll")
        .from("calculation")
        .select(
          "id, schedule_shift_id, scheduled_start, scheduled_end, net_working_minutes, base_rate, base_pay, total_supplements, total_deductions, total_pay, calculation_version, calculated_at",
        )
        .eq("period_id", periodId)
        .eq("profile_id", line.profileId)
        .order("scheduled_start", { ascending: true });

      if (cancelled) return;

      if (calcErr) {
        setError("Kunne ikke laste vaktdata.");
        setLoading(false);
        return;
      }

      const rows = (calcData ?? []) as CalcRow[];
      setCalcs(rows);

      // Fetch calculation_lines for all these calcs
      const calcIds = rows.map((r) => r.id);
      if (calcIds.length > 0) {
        const { data: lineData, error: lineErr } = await supabase
          .schema("payroll")
          .from("calculation_line")
          .select("id, calculation_id, salary_code, line_type, hours, rate, amount, description")
          .in("calculation_id", calcIds)
          .order("line_type");

        if (!cancelled && !lineErr) {
          setCalcLines((lineData ?? []) as CalcLine[]);
        }
      }

      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [open, line, periodId]);

  function handleOpenOverrideModal(cl: CalcLine) {
    const existingProposalId = pendingLineIds?.has(cl.id) ? cl.id : undefined;
    const overrideLine: OverrideLine = {
      id: cl.id,
      profileName: line?.displayName ?? "Ukjent",
      shiftDate: "—", // shift date not on calc_line; sufficient for modal context
      category: LINE_TYPE_LABELS[cl.line_type] ?? cl.line_type,
      totalPay: cl.amount,
      source: "derived",
      existingProposalId,
    };
    setSelectedOverrideLine(overrideLine);
    setOverrideModalOpen(true);
  }

  /**
   * Whether a calc_line is eligible for the override button.
   * Manual adj lines are excluded (manual_adj = already a manual entry).
   * Pending-override lines are excluded separately (badge replaces button).
   */
  function canOverride(cl: CalcLine): boolean {
    if (!isPeriodOpen) return false;
    if (cl.line_type === "manual_adj") return false;
    return true;
  }

  function handleDeleteSupplementClick(supplementId: string, description: string) {
    setDeleteSupplementId(supplementId);
    setDeleteSupplementDesc(description);
  }

  function handleDeleteSupplementConfirm() {
    if (!deleteSupplementId) return;
    deleteSupplement(
      { supplement_id: deleteSupplementId },
      {
        onSettled: () => {
          setDeleteSupplementId(null);
          setDeleteSupplementDesc("");
        },
      },
    );
  }

  return (
    <>
      <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
        <SheetContent side="right" className="flex w-full flex-col sm:max-w-2xl">
          <SheetHeader className="border-b pb-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <SheetTitle className="text-base">{line?.displayName ?? "Ansatt"}</SheetTitle>
                <p className="text-muted-foreground text-xs">
                  {line?.shiftCount ?? 0} vakter · {formatNok(line?.totalPay ?? 0)} totalt
                </p>
                {/* Fix 4: brutto disclaimer — netto beregnes av regnskapsfører */}
                <p className="text-muted-foreground mt-0.5 text-[11px]">
                  Brutto-grunnlag for lønnskjøring · Netto utbetaling beregnes av regnskapsfører
                </p>
              </div>

              <div className="flex items-center gap-2">
                {/* T3.3 — "+ Manuelt tillegg" trigger (open periods only) */}
                {isPeriodOpen && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 text-xs"
                    onClick={() => setSupplementModalOpen(true)}
                  >
                    <Plus className="h-3 w-3" />
                    Manuelt tillegg
                  </Button>
                )}

                {/* T4.3 — "Last ned PDF" trigger (locked periods + admin only) */}
                {isAdmin && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 text-xs"
                    disabled={!isPeriodLocked || isGeneratingSingle || !line?.profileId}
                    title={
                      !isPeriodLocked
                        ? "Lås perioden først"
                        : "Last ned PDF lønnsgrunnlag for denne ansatte"
                    }
                    onClick={() => {
                      if (!line?.profileId) return;
                      generateSingle({
                        periodId,
                        profileId: line.profileId,
                        workspaceId,
                        actorId,
                      });
                    }}
                  >
                    <Download className="h-3 w-3" />
                    {isGeneratingSingle ? "Genererer…" : "Last ned PDF"}
                  </Button>
                )}

                <button
                  type="button"
                  onClick={onClose}
                  className="text-muted-foreground hover:text-foreground rounded-md p-1 transition-colors"
                  aria-label="Lukk"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          </SheetHeader>

          {loading && (
            <div className="flex flex-1 items-center justify-center gap-2">
              <Loader2 className="text-muted-foreground h-5 w-5 animate-spin" />
              <span className="text-muted-foreground text-sm">Henter vaktdata…</span>
            </div>
          )}

          {!loading && error && (
            <div className="p-4">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {!loading && !error && (
            <Tabs defaultValue="shifts" className="flex flex-1 flex-col overflow-hidden">
              <TabsList className="mx-4 mt-3 w-fit">
                <TabsTrigger value="shifts">Vakter ({calcs.length})</TabsTrigger>
                <TabsTrigger value="lines">Linjer ({calcLines.length})</TabsTrigger>
              </TabsList>

              {/* ── Vakter tab ── */}
              <TabsContent value="shifts" className="flex-1 overflow-y-auto px-4 py-3">
                {calcs.length === 0 ? (
                  <p className="text-muted-foreground py-8 text-center text-sm">
                    Ingen vaktberegninger funnet.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {calcs.map((c) => (
                      <div key={c.id} className="border-border rounded-lg border p-3 text-sm">
                        {/* Shift time header */}
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-foreground font-medium">
                            {formatTs(c.scheduled_start)} – {formatTs(c.scheduled_end)}
                          </span>
                          <span className="text-muted-foreground text-xs">
                            {formatMinutes(c.net_working_minutes)}
                          </span>
                        </div>

                        {/* Pay breakdown */}
                        <div className="mt-2 grid grid-cols-4 gap-2 text-xs">
                          <div>
                            <p className="text-muted-foreground">Grunnlønn</p>
                            <p className="text-foreground tabular-nums">{formatNok(c.base_pay)}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Tillegg</p>
                            <p className="text-emerald-600 tabular-nums">
                              {c.total_supplements > 0 ? `+${formatNok(c.total_supplements)}` : "—"}
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Trekk</p>
                            <p className="text-red-600 tabular-nums">
                              {c.total_deductions > 0 ? `-${formatNok(c.total_deductions)}` : "—"}
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground font-semibold">Totalt</p>
                            <p className="text-foreground font-semibold tabular-nums">
                              {formatNok(c.total_pay)}
                            </p>
                          </div>
                        </div>

                        {/* Meta */}
                        <div className="text-muted-foreground mt-1.5 flex items-center gap-3 text-[10px]">
                          <span>v{c.calculation_version}</span>
                          <span>Sats: {formatNok(c.base_rate)}/t</span>
                          <span>Beregnet: {formatTs(c.calculated_at)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              {/* ── Linjer tab (salary-code level) ── */}
              <TabsContent value="lines" className="flex-1 overflow-y-auto px-4 py-3">
                {calcLines.length === 0 ? (
                  <p className="text-muted-foreground py-8 text-center text-sm">
                    Ingen lønnslinjer funnet.
                  </p>
                ) : (
                  <div className="space-y-1">
                    {calcLines.map((cl) => {
                      const hasPending = pendingLineIds?.has(cl.id) ?? false;
                      const overrideable = canOverride(cl);

                      return (
                        <div
                          key={cl.id}
                          className="border-border hover:bg-muted/20 flex items-center gap-2 rounded-md border px-3 py-2 text-xs transition-colors"
                        >
                          {/* Salary code */}
                          <span
                            className="text-muted-foreground w-24 shrink-0 truncate font-mono"
                            title={cl.salary_code}
                          >
                            {cl.salary_code}
                          </span>

                          {/* Description — shows full human label incl. shift context (Fix 6).
                              Falls back to line_type slug only if description is empty. */}
                          <span className="text-foreground min-w-0 flex-1 truncate">
                            {cl.description
                              ? cl.description
                              : (LINE_TYPE_LABELS[cl.line_type] ?? cl.line_type)}
                          </span>

                          {/* Hours */}
                          <span className="text-muted-foreground w-12 text-right tabular-nums">
                            {cl.hours != null ? `${cl.hours}t` : "—"}
                          </span>

                          {/* Rate */}
                          <span className="text-muted-foreground w-20 text-right tabular-nums">
                            {cl.rate != null ? formatNok(cl.rate) : "—"}
                          </span>

                          {/* Amount */}
                          <span
                            className={`w-20 text-right font-medium tabular-nums ${
                              cl.line_type === "deduction" || cl.line_type === "absence"
                                ? "text-red-600"
                                : cl.line_type === "supplement" ||
                                    cl.line_type === "overtime" ||
                                    cl.line_type === "manual_adj"
                                  ? "text-emerald-600"
                                  : "text-foreground"
                            }`}
                          >
                            {formatNok(cl.amount)}
                          </span>

                          {/* T4.2 — "Venter godkjenning" badge */}
                          {hasPending && (
                            <Badge variant="secondary" className="shrink-0 text-[10px]">
                              Venter godkjenning
                            </Badge>
                          )}

                          {/* T4.1 — "Foreslå endring" action button (admin only). Fix 5:
                              Renamed from "Overstyr" — which felt destructive/admin-scary.
                              "Foreslå endring" = creates a change_proposal for review (ADR-0292).
                              Gated to isAdmin so employees and non-admin managers don't see it. */}
                          {!hasPending && overrideable && isAdmin && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-muted-foreground hover:text-foreground h-6 shrink-0 gap-1 px-2 text-[10px]"
                              onClick={() => handleOpenOverrideModal(cl)}
                              aria-label={`Foreslå endring til linje ${cl.salary_code}`}
                            >
                              <Edit2 className="h-3 w-3" />
                              Foreslå endring
                            </Button>
                          )}

                          {/* Locked period — show disabled hint on overrideable lines */}
                          {!hasPending && !isPeriodOpen && cl.line_type !== "manual_adj" && (
                            <span className="text-muted-foreground shrink-0 text-[10px]">Låst</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* T3.4 — Manuelle tillegg (deleteable, open periods only) */}
                {profileSupplements.length > 0 && (
                  <div className="mt-4">
                    <p className="text-muted-foreground mb-1.5 px-1 text-[11px] font-medium tracking-wide uppercase">
                      Manuelle tillegg
                    </p>
                    <div className="space-y-1">
                      {profileSupplements.map((s) => (
                        <div
                          key={s.id}
                          className="border-border hover:bg-muted/20 flex items-center gap-2 rounded-md border px-3 py-2 text-xs transition-colors"
                        >
                          <span className="text-muted-foreground w-16 shrink-0 font-mono">
                            {s.salary_code ?? "—"}
                          </span>
                          <span className="text-foreground min-w-0 flex-1 truncate">
                            Manuell justering
                            {s.description ? (
                              <span className="text-muted-foreground ml-1">— {s.description}</span>
                            ) : null}
                          </span>
                          <span className="w-20 text-right font-medium text-emerald-600 tabular-nums">
                            {formatNok(s.amount)}
                          </span>
                          {isPeriodOpen ? (
                            <button
                              type="button"
                              aria-label={`Slett tillegg: ${s.description}`}
                              disabled={isDeletingSupplement}
                              onClick={() => handleDeleteSupplementClick(s.id, s.description)}
                              className="text-muted-foreground hover:text-destructive shrink-0 rounded p-1 transition-colors disabled:opacity-50"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          ) : (
                            <span
                              className="text-muted-foreground shrink-0 text-[10px]"
                              title="Perioden er låst — kan ikke slette tillegg"
                            >
                              Låst
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          )}
        </SheetContent>
      </Sheet>

      {/* T4.1 — LineOverrideModal (outside Sheet to avoid stacking context issues) */}
      <LineOverrideModal
        open={overrideModalOpen}
        onOpenChange={setOverrideModalOpen}
        periodId={periodId}
        periodStatus={periodStatus}
        line={selectedOverrideLine}
        onSuccess={() => {
          // Badge state auto-refreshes via usePendingOverrides invalidation
        }}
      />

      {/* T3.3 — ManualSupplementForm (open periods only) */}
      {isPeriodOpen && (
        <ManualSupplementForm
          open={supplementModalOpen}
          onOpenChange={setSupplementModalOpen}
          periodId={periodId}
          workspaceId={workspaceId}
          prefillProfileId={line?.profileId}
        />
      )}

      {/* T3.4 — Delete supplement confirm dialog */}
      <AlertDialog
        open={!!deleteSupplementId}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteSupplementId(null);
            setDeleteSupplementDesc("");
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Slette manuelt tillegg?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteSupplementDesc
                ? `«${deleteSupplementDesc}» — beløpet blir fjernet fra perioden og totalen omregnes.`
                : "Beløpet blir fjernet fra perioden og totalen omregnes."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingSupplement}>Avbryt</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteSupplementConfirm}
              disabled={isDeletingSupplement}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeletingSupplement ? "Sletter…" : "Slett tillegg"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
