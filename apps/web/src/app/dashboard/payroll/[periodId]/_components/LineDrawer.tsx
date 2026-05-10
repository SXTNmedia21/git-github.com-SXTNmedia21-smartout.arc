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

import { useEffect, useState, useMemo } from "react";
import { format, parseISO } from "date-fns";
import { nb } from "date-fns/locale";
import { Loader2, X, Plus, Edit2, Download, Trash2, Info } from "lucide-react";
import { createClient } from "@smartout/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
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

// ─── Riksavtalen paragraf texts (Fix 2) ────────────────────────────────────
// Hardcoded for the 4-5 supplement codes produced by the seed fixture and the
// live payroll engine. Key format matches "§X.Y" found in description strings.
// Extend when new supplement types are introduced.
// Source: Riksavtalen 2026 (NHO Reiseliv / Fellesforbundet).
const RIKSAVTALEN_PARAGRAFER: Record<string, string> = {
  "§3.3":
    "Helgetillegg gjelder lørdag fra kl. 12:00 og søndag hele døgnet. Sats: kr 100,00/t for voksen ufaglært (Riksavtalen 2026).",
  "§6": "Uregelmessige tillegg — kveldstillegg (kl. 18–24), helgetillegg (lør. 12–søn. 24) og helligdagstillegg. Sats fastsettes i lokale lønnsavtaler innen Riksavtalen-rammene (Riksavtalen 2026 §6).",
  "§6.1":
    "Kveldstillegg: kl. 18:00–24:00 alle hverdager og lørdag til kl. 12:00. Sats: kr 60,00/t for voksen ufaglært (Riksavtalen 2026 §6.1).",
  "§6.2":
    "Helgetillegg: lørdag fra kl. 12:00 og søndag hele døgnet. Sats: kr 100,00/t for voksen ufaglært (Riksavtalen 2026 §6.2).",
  "§6.3":
    "Helligdagstillegg: offentlige helligdager og 1. og 17. mai. Sats: kr 133,00/t for voksen ufaglært (Riksavtalen 2026 §6.3).",
  "§14-15":
    "Trekk i lønn krever lovhjemmel eller skriftlig avtale med arbeidstaker (Aml. §14-15). Uniformstrekk e.l. må være avtalt skriftlig.",
};

/**
 * Extract the first «§X.Y» or «§X» reference from a description string.
 * Returns the paragraf text from RIKSAVTALEN_PARAGRAFER if found, otherwise null.
 */
function getParagrafText(description: string): string | null {
  const match = description.match(/§(\d+\.\d+|\d+)/);
  if (!match) return null;
  const key = `§${match[1]}`;
  return RIKSAVTALEN_PARAGRAFER[key] ?? null;
}

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
  /**
   * Fix 1: tariff version label for audit stamp in drawer header.
   * E.g. "Riksavtalen 2026 v1.0 (gyldig fra 01. apr. 2026)"
   * Falls back to "Tariff: ikke konfigurert" if undefined.
   */
  frameworkLabel?: string;
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

// ─── Grouped-lines type ─────────────────────────────────────────────────────

type GroupedShift = {
  shiftId: string;
  shiftDate: string; // ISO date yyyy-MM-dd — used for sort + accordion key
  shiftLabel: string; // "Lørdag 3. mai"
  shiftTimeRange: string; // "17:00 — 23:00"
  lines: CalcLine[];
  subtotal: number;
};

/** Build accordion groups from calcs + calcLines.
 *  Returns { groups, orphans } where orphans are lines with no matching calc (tip, manual_adj without shift). */
function buildGroupedLines(
  calcs: CalcRow[],
  calcLines: CalcLine[],
): { groups: GroupedShift[]; orphans: CalcLine[] } {
  const groups: GroupedShift[] = calcs
    .map((calc) => {
      const lines = calcLines.filter((cl) => cl.calculation_id === calc.id);
      const subtotal = lines.reduce((s, cl) => s + cl.amount, 0);
      let shiftLabel = "Ukjent dato";
      let shiftTimeRange = "";
      try {
        const start = parseISO(calc.scheduled_start);
        const end = parseISO(calc.scheduled_end);
        shiftLabel = format(start, "EEEE d. MMMM", { locale: nb });
        // Capitalise first letter (date-fns nb gives lowercase weekday)
        shiftLabel = shiftLabel.charAt(0).toUpperCase() + shiftLabel.slice(1);
        shiftTimeRange = `${format(start, "HH:mm")} — ${format(end, "HH:mm")}`;
      } catch {
        // keep defaults
      }
      return {
        shiftId: calc.id,
        shiftDate: calc.scheduled_start.slice(0, 10),
        shiftLabel,
        shiftTimeRange,
        lines,
        subtotal,
      };
    })
    .sort((a, b) => a.shiftDate.localeCompare(b.shiftDate));

  const calcIdSet = new Set(calcs.map((c) => c.id));
  const orphans = calcLines.filter((cl) => !calcIdSet.has(cl.calculation_id));

  return { groups, orphans };
}

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
  frameworkLabel,
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
  const { data: pendingLineIds } = usePendingOverrides(periodId, workspaceId);

  // T4.3: per-profile PDF single-generation (locked periods only, admin only)
  const { mutate: generateSingle, isPending: isGeneratingSingle } = useGenerateSingle();

  // T3.4: manual supplements for this period (filtered to this profile via shift cross-ref)
  const { data: allSupplements } = useManualSupplements(periodId);
  const { mutate: deleteSupplement, isPending: isDeletingSupplement } =
    useDeleteManualSupplement(periodId);

  const isPeriodOpen = periodStatus === "open";
  const isPeriodLocked = periodStatus === "locked";

  // Fix 1: group calcLines by shift (accordion)
  const { groups: lineGroups, orphans: orphanLines } = useMemo(
    () => buildGroupedLines(calcs, calcLines),
    [calcs, calcLines],
  );

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
      { workspace_id: workspaceId, supplement_id: deleteSupplementId },
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
                {/* Fix 2: total prominently on its own line on mobile */}
                <p className="text-foreground text-sm font-semibold tabular-nums sm:hidden">
                  {formatNok(line?.totalPay ?? 0)}
                </p>
                <p className="text-muted-foreground text-xs">
                  {line?.shiftCount ?? 0} vakter ·{" "}
                  <span className="hidden sm:inline">{formatNok(line?.totalPay ?? 0)} · </span>
                  brutto grunnlag
                </p>
                {/* Fix 4: brutto disclaimer — netto beregnes av regnskapsfører */}
                <p className="text-muted-foreground mt-0.5 text-[11px]">
                  Brutto-grunnlag for lønnskjøring · Netto utbetaling beregnes av regnskapsfører
                </p>
                {/* Fix 1: tariff-version audit stamp (Bokføringsloven §13 / ADR-0252).
                    Shows live binding until framework_snapshot_id lands on payroll.period. */}
                <p
                  className={`mt-0.5 text-[11px] ${
                    frameworkLabel ? "text-muted-foreground" : "text-amber-500"
                  }`}
                >
                  Tariff: {frameworkLabel ?? "ikke konfigurert"} · ADR-0252
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

              {/* ── Linjer tab (salary-code level, grouped by shift) ── */}
              <TabsContent value="lines" className="flex-1 overflow-y-auto px-4 py-3">
                {calcLines.length === 0 ? (
                  <p className="text-muted-foreground py-8 text-center text-sm">
                    Ingen lønnslinjer funnet.
                  </p>
                ) : (
                  <>
                    {/* Fix 1: accordion grouped per shift */}
                    <Accordion
                      type="multiple"
                      defaultValue={lineGroups.map((g) => g.shiftId)}
                      className="space-y-1"
                    >
                      {lineGroups.map((g) => (
                        <AccordionItem
                          key={g.shiftId}
                          value={g.shiftId}
                          className="border-border rounded-md border"
                        >
                          <AccordionTrigger className="hover:bg-muted/30 rounded-md px-3 py-2 text-left hover:no-underline">
                            <div className="flex w-full items-center gap-2 pr-1 text-xs">
                              <span className="text-foreground shrink-0 font-medium">
                                {g.shiftLabel}
                              </span>
                              <span className="text-muted-foreground shrink-0">
                                {g.shiftTimeRange}
                              </span>
                              <span className="text-foreground ml-auto shrink-0 font-semibold tabular-nums">
                                {formatNok(g.subtotal)}
                              </span>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent className="px-3 pt-1 pb-2">
                            <div className="space-y-1">
                              {g.lines.map((cl) => (
                                <LineRow
                                  key={cl.id}
                                  cl={cl}
                                  hasPending={pendingLineIds?.has(cl.id) ?? false}
                                  overrideable={canOverride(cl)}
                                  isAdmin={isAdmin}
                                  isPeriodOpen={isPeriodOpen}
                                  onOverride={handleOpenOverrideModal}
                                />
                              ))}
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      ))}
                    </Accordion>

                    {/* Orphan lines: tip, manual_adj without a shift FK */}
                    {orphanLines.length > 0 && (
                      <div className="mt-4 border-t pt-3">
                        <p className="text-muted-foreground mb-2 px-1 text-[11px] font-medium tracking-wide uppercase">
                          Periode-tillegg + drikkepenger
                        </p>
                        <div className="space-y-1">
                          {orphanLines.map((cl) => (
                            <LineRow
                              key={cl.id}
                              cl={cl}
                              hasPending={pendingLineIds?.has(cl.id) ?? false}
                              overrideable={canOverride(cl)}
                              isAdmin={isAdmin}
                              isPeriodOpen={isPeriodOpen}
                              onOverride={handleOpenOverrideModal}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </>
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
        workspaceId={workspaceId}
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

// ─── LineRow — reusable per-line renderer (Fix 1 + Fix 2) ─────────────────
//
// Fix 2 (mobile): stacks salary-code + description on separate lines on small
// viewports; numbers row stays horizontal on both mobile and desktop.
// sm:flex-row restores the single-row layout on ≥640px screens.

type LineRowProps = {
  cl: CalcLine;
  hasPending: boolean;
  overrideable: boolean;
  isAdmin: boolean;
  isPeriodOpen: boolean;
  onOverride: (cl: CalcLine) => void;
};

function LineRow({
  cl,
  hasPending,
  overrideable,
  isAdmin,
  isPeriodOpen,
  onOverride,
}: LineRowProps) {
  const amountColor =
    cl.line_type === "deduction" || cl.line_type === "absence"
      ? "text-red-600"
      : cl.line_type === "supplement" ||
          cl.line_type === "overtime" ||
          cl.line_type === "manual_adj"
        ? "text-emerald-600"
        : "text-foreground";

  const paragrafText = cl.description ? getParagrafText(cl.description) : null;

  return (
    <div className="border-border hover:bg-muted/20 flex flex-col gap-1 rounded-md border px-3 py-2 text-xs transition-colors sm:flex-row sm:items-center sm:gap-2">
      {/* Salary code — full row on mobile, fixed width on desktop */}
      <span
        className="text-muted-foreground shrink-0 truncate font-mono sm:w-24"
        title={cl.salary_code}
      >
        {cl.salary_code}
      </span>

      {/* Description — full width on mobile, flex-1 on desktop */}
      <span className="text-foreground min-w-0 truncate sm:flex-1">
        {cl.description ? cl.description : (LINE_TYPE_LABELS[cl.line_type] ?? cl.line_type)}
      </span>

      {/* Regel-hjemmel tooltip (Riksavtalen §X.Y) */}
      {paragrafText && (
        <TooltipProvider delayDuration={200}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="text-muted-foreground h-3 w-3 shrink-0 cursor-help" />
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs">
              <p className="text-xs leading-relaxed">{paragrafText}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}

      {/* Numbers row — always horizontal, stays on own line on mobile, collapses into parent row on desktop */}
      <div className="flex items-center gap-3 sm:contents">
        {/* Hours */}
        {cl.hours != null && cl.rate != null && cl.rate > 0 && isAdmin ? (
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="text-muted-foreground cursor-help text-right tabular-nums underline decoration-dotted underline-offset-2 sm:w-12">
                  {cl.hours}t
                </span>
              </TooltipTrigger>
              <TooltipContent side="top">
                <p className="text-xs">
                  Eksakt: {((cl.amount / cl.rate) * 60).toFixed(0)} min (
                  {(cl.amount / cl.rate).toFixed(4)}t)
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : (
          <span className="text-muted-foreground text-right tabular-nums sm:w-12">
            {cl.hours != null ? `${cl.hours}t` : "—"}
          </span>
        )}

        {/* Rate */}
        <span className="text-muted-foreground text-right tabular-nums sm:w-20">
          {cl.rate != null ? formatNok(cl.rate) : "—"}
        </span>

        {/* Amount */}
        <span className={`text-right font-medium tabular-nums sm:w-20 ${amountColor}`}>
          {formatNok(cl.amount)}
        </span>

        {/* Override button / badge / locked */}
        {hasPending ? (
          <Badge variant="secondary" className="shrink-0 text-[10px]">
            Venter godkjenning
          </Badge>
        ) : overrideable && isAdmin ? (
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-foreground h-6 shrink-0 gap-1 px-2 text-[10px]"
            onClick={() => onOverride(cl)}
            aria-label={`Foreslå endring til linje ${cl.salary_code}`}
          >
            <Edit2 className="h-3 w-3" />
            Foreslå endring
          </Button>
        ) : !isPeriodOpen && cl.line_type !== "manual_adj" ? (
          <span className="text-muted-foreground shrink-0 text-[10px]">Låst</span>
        ) : null}
      </div>
    </div>
  );
}
