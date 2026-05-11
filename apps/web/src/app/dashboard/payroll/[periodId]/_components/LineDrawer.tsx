"use client";

/**
 * LineDrawer — per-employee drill-down for a payroll period.
 *
 * What: Sheet som åpnes når en rad i LinesTable klikkes. Viser:
 *   - Tab 1 "Vakter": én CalcRow per vakt (per-shift aggregat)
 *   - Tab 2 "Linjer": CalcLine-rader (lønnsnivå), gruppert i accordion per vakt
 *
 * Sprint 4 UX-polish (Item 1–7):
 *   - Item 1: Vakter-rad klikk → bytt til Linjer-fane + scroll til + åpne accordion-gruppe
 *   - Item 2: Brutto-total dominerende i header (text-3xl font-mono font-heading)
 *   - Item 3: Skeleton-state mens data lastes
 *   - Item 4: Meningsfull tom-tilstand med "Kjør beregning"-knapp
 *   - Item 5: Mobil-responsivt (tabs min-h-[44px], header flex-col, knapper stablet)
 *   - Item 6: Vakter-rader har samme padding/border/hover som Linjer-rader
 *   - Item 7: Tooltip på "+ Manuelt tillegg"-knapp, mobil-stablet
 *
 * Earlier sprints:
 *   - T4.1: "Overstyr linje" → LineOverrideModal
 *   - T4.2: "Venter godkjenning"-badge på linjer med pending proposal
 *   - T3.3: "+ Manuelt tillegg" → ManualSupplementForm
 *
 * Why: ADR-0251 "100% Transparency" — every krone must trace to input + rule + rate.
 *
 * Data: supabase anon client (RLS-scoped to authenticated user's workspace).
 * ADR-0078: Ingen Høy-PII i dette view.
 * ADR-0133: Web-only authoring surface.
 * ADR-0292: Override action creates change_proposal only.
 * Nordic Split: all colours from CSS variables.
 */

import { useEffect, useRef, useState, useMemo } from "react";
import { format, parseISO } from "date-fns";
import { nb } from "date-fns/locale";
import { Calculator, X, Plus, Edit2, Download, Trash2, Info, Clock } from "lucide-react";
import { createClient } from "@smartout/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
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
import { ManualTimeEntryDialog } from "./ManualTimeEntryDialog";

// ─── Riksavtalen paragraf texts ─────────────────────────────────────────────
// Hardkodede tekster for de 4–5 tilleggskolene produsert av seed-fixture og
// live lønnsmotoren. Nøkkelformat matcher "§X.Y" i description-strenger.
// Kilde: Riksavtalen 2026 (NHO Reiseliv / Fellesforbundet).
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

function getParagrafText(description: string): string | null {
  const match = description.match(/§(\d+\.\d+|\d+)/);
  if (!match) return null;
  const key = `§${match[1]}`;
  return RIKSAVTALEN_PARAGRAFER[key] ?? null;
}

// ─── Types ──────────────────────────────────────────────────────────────────

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
  /** Brukes for å sperre override-UI. Standard: 'open'. */
  periodStatus?: string;
  /** Sendes til ManualSupplementForm for prefill. */
  workspaceId?: string;
  /** actorId for telemetri (BFF re-validerer fra session). */
  actorId?: string;
  /** Vis "Last ned PDF" når true og perioden er låst. */
  isAdmin?: boolean;
  /**
   * Tariff-versjonsetikett for revisjonsstempel i header.
   * Eks: "Riksavtalen 2026 v1.0 (gyldig fra 01. apr. 2026)"
   * Faller tilbake til "ikke konfigurert" hvis undefined.
   */
  frameworkLabel?: string;
  /**
   * Item 4: kalles hvis bruker trykker "Kjør beregning" fra tom-tilstand.
   * Kobler til PeriodDetailClient.handleRecalculate via LinesTable.
   */
  onRecalculate?: () => void;
};

// ─── Helpers ────────────────────────────────────────────────────────────────

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

// LINE_TYPE_LABELS: brukes kun for override-modal shiftDate (legacy).
// Linjer-fanen bruker cl.description direkte (Fix 6 Sprint 3).
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

// ─── Grouped-lines type ──────────────────────────────────────────────────────

type GroupedShift = {
  shiftId: string;
  shiftDate: string;
  shiftLabel: string;
  shiftTimeRange: string;
  lines: CalcLine[];
  subtotal: number;
};

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
        shiftLabel = shiftLabel.charAt(0).toUpperCase() + shiftLabel.slice(1);
        shiftTimeRange = `${format(start, "HH:mm")} — ${format(end, "HH:mm")}`;
      } catch {
        // behold standardverdier
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

// ─── Loading skeleton (Item 3) ───────────────────────────────────────────────

function DrawerSkeleton() {
  return (
    <div className="flex flex-1 flex-col overflow-hidden px-4">
      {/* Header-skeleton: navn + dominant number */}
      <div className="border-b pt-1 pb-4">
        <Skeleton className="mb-2 h-5 w-40" />
        <Skeleton className="mb-1.5 h-9 w-48" />
        <Skeleton className="mb-1 h-3.5 w-64" />
        <Skeleton className="h-3 w-56" />
      </div>
      {/* Tabs-skeleton */}
      <div className="mt-3 flex gap-2">
        <Skeleton className="h-9 w-24" />
        <Skeleton className="h-9 w-24" />
      </div>
      {/* Accordion-rader */}
      <div className="mt-3 space-y-2">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="border-border rounded-md border">
            <div className="flex items-center justify-between px-3 py-2.5">
              <Skeleton className="h-3.5 w-32" />
              <Skeleton className="h-3.5 w-20" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

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
  onRecalculate,
}: Props) {
  const [calcs, setCalcs] = useState<CalcRow[]>([]);
  const [calcLines, setCalcLines] = useState<CalcLine[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // T4.1: override modal
  const [overrideModalOpen, setOverrideModalOpen] = useState(false);
  const [selectedOverrideLine, setSelectedOverrideLine] = useState<OverrideLine | null>(null);

  // T3.3: manuelt tillegg modal
  const [supplementModalOpen, setSupplementModalOpen] = useState(false);

  // T3.4: slett tillegg bekreftelsesdialog
  const [deleteSupplementId, setDeleteSupplementId] = useState<string | null>(null);
  const [deleteSupplementDesc, setDeleteSupplementDesc] = useState<string>("");

  // T18: manuell tidsregistrering — "Korriger tid"-knapp på Vakter-rader
  const [timeEntryDialogCalc, setTimeEntryDialogCalc] = useState<CalcRow | null>(null);

  // Item 1: aktiv fane + target-shift for scroll-til-og-ekspander
  const [activeTab, setActiveTab] = useState<"shifts" | "lines">("shifts");
  const [highlightShiftId, setHighlightShiftId] = useState<string | null>(null);

  // Ref til accordion-container slik at vi kan scrolle til riktig gruppe (Item 1)
  const accordionRef = useRef<HTMLDivElement>(null);

  // T4.2: pending overrides
  const { data: pendingLineIds } = usePendingOverrides(periodId, workspaceId);

  // T4.3: per-profil PDF-generering (kun låste perioder + admin)
  const { mutate: generateSingle, isPending: isGeneratingSingle } = useGenerateSingle();

  // T3.4: manuelle tillegg for denne perioden
  const { data: allSupplements } = useManualSupplements(periodId);
  const { mutate: deleteSupplement, isPending: isDeletingSupplement } =
    useDeleteManualSupplement(periodId);

  const isPeriodOpen = periodStatus === "open";
  const isPeriodLocked = periodStatus === "locked";

  const { groups: lineGroups, orphans: orphanLines } = useMemo(
    () => buildGroupedLines(calcs, calcLines),
    [calcs, calcLines],
  );

  const profileShiftIds = new Set(calcs.map((c) => c.schedule_shift_id));
  const profileSupplements = (allSupplements ?? []).filter((s) =>
    profileShiftIds.has(s.schedule_shift_id),
  );

  // Reset tab og highlight ved ny profil
  useEffect(() => {
    if (open) {
      setActiveTab("shifts");
      setHighlightShiftId(null);
    }
  }, [open, line?.profileId]);

  useEffect(() => {
    if (!open || !line) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    void (async () => {
      const supabase = createClient();

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

  /**
   * Item 1: klikk på Vakter-rad → bytt til Linjer-fane og scroll til accordion-gruppe.
   * Bruker calcId direkte som accordion-nøkkel (samme som shiftId i lineGroups).
   */
  function handleShiftRowClick(calcId: string) {
    setHighlightShiftId(calcId);
    setActiveTab("lines");

    // Scroll til accordion-elementet etter fane-byttet er rendret
    requestAnimationFrame(() => {
      if (!accordionRef.current) return;
      const target = accordionRef.current.querySelector<HTMLElement>(`[data-shift-id="${calcId}"]`);
      if (target) {
        target.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  }

  function handleOpenOverrideModal(cl: CalcLine, shiftLabel?: string) {
    const existingProposalId = pendingLineIds?.has(cl.id) ? cl.id : undefined;
    const overrideLine: OverrideLine = {
      id: cl.id,
      profileName: line?.displayName ?? "Ukjent",
      shiftDate: shiftLabel ?? "—",
      category: LINE_TYPE_LABELS[cl.line_type] ?? cl.line_type,
      totalPay: cl.amount,
      source: "derived",
      existingProposalId,
    };
    setSelectedOverrideLine(overrideLine);
    setOverrideModalOpen(true);
  }

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
          {/* ── Header (Item 2: dominant brutto-total, Item 5: mobil-responsivt) ── */}
          <SheetHeader className="border-b pb-4">
            {/* Øverste rad: navn + lukk-knapp */}
            <div className="flex items-start justify-between gap-2">
              <SheetTitle className="font-heading text-lg leading-snug">
                {line?.displayName ?? "Ansatt"}
              </SheetTitle>
              <button
                type="button"
                onClick={onClose}
                className="text-muted-foreground hover:text-foreground mt-0.5 shrink-0 rounded-md p-1 transition-colors"
                aria-label="Lukk"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Dominant brutto-total (Item 2) */}
            <p className="font-heading text-foreground font-mono text-3xl leading-none font-semibold tabular-nums">
              {formatNok(line?.totalPay ?? 0)}
            </p>
            <p className="text-muted-foreground text-sm">
              brutto-grunnlag for lønnskjøring · {line?.shiftCount ?? 0} vakter
            </p>

            {/* Feriepenger-grunnlag (ADR-0295) — basis only; regnskapsfører beregner utbetaling */}
            <div className="border-border mt-1 flex items-center justify-between rounded-md border border-dashed px-2 py-1.5">
              <span className="text-muted-foreground text-[11px] italic">
                Feriepenger-grunnlag (regnskapsfører beregner)
              </span>
              <span className="text-muted-foreground font-mono text-[11px] italic tabular-nums">
                {/* ADR-0295: rate from employee_payroll_profile — never hardcoded */}
                {formatNok(
                  Math.round(
                    (line?.basePay ?? 0) * ((line?.holidayAllowancePct ?? 12) / 100) * 100,
                  ) / 100,
                )}{" "}
                NOK
              </span>
            </div>

            {/* Separator */}
            <div className="border-border my-1.5 border-t" />

            {/* Sekundær meta: tariff + disclaimer */}
            <div className="space-y-0.5">
              <p
                className={`text-[11px] ${
                  frameworkLabel ? "text-muted-foreground" : "text-amber-500"
                }`}
              >
                Tariff: {frameworkLabel ?? "ikke konfigurert"} · ADR-0252
              </p>
              <p className="text-muted-foreground text-[11px]">
                Netto utbetaling beregnes av regnskapsfører
              </p>
            </div>

            {/* Handlingsrad: knapper (Item 5: stablet på mobil, Item 7: tooltip + Plus-ikon) */}
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {/* T3.3 — "+ Manuelt tillegg" (kun åpne perioder, Item 7) */}
              {isPeriodOpen && (
                <TooltipProvider delayDuration={300}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5 text-xs"
                        onClick={() => setSupplementModalOpen(true)}
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Manuelt tillegg
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                      <p className="text-xs">Legg til bonus, forskudd, trekk eller annet</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}

              {/* T4.3 — "Last ned PDF" (låste perioder + admin) */}
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
                  <Download className="h-3.5 w-3.5" />
                  {isGeneratingSingle ? "Genererer…" : "Last ned PDF"}
                </Button>
              )}
            </div>
          </SheetHeader>

          {/* ── Skeleton mens data lastes (Item 3) ── */}
          {loading && <DrawerSkeleton />}

          {/* ── Feil-tilstand ── */}
          {!loading && error && (
            <div className="p-4">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {/* ── Hovedinnhold ── */}
          {!loading && !error && (
            <Tabs
              value={activeTab}
              onValueChange={(v) => setActiveTab(v as "shifts" | "lines")}
              className="flex flex-1 flex-col overflow-hidden"
            >
              {/* Item 5: tabs min-h-[44px] for touch-vennlig trykk */}
              <TabsList className="mx-4 mt-3 w-fit">
                <TabsTrigger value="shifts" className="min-h-[44px] sm:min-h-0">
                  Vakter ({calcs.length})
                </TabsTrigger>
                <TabsTrigger value="lines" className="min-h-[44px] sm:min-h-0">
                  Linjer ({calcLines.length})
                </TabsTrigger>
              </TabsList>

              {/* ── Vakter-fane (Item 1: klikk → bytt til Linjer + scroll) ── */}
              <TabsContent value="shifts" className="flex-1 overflow-y-auto px-4 py-3">
                {calcs.length === 0 ? (
                  /* Item 4: tom-tilstand */
                  <EmptyState onRecalculate={onRecalculate} />
                ) : (
                  <div className="space-y-2">
                    {calcs.map((c) => (
                      /* Item 6: p-3, border, hover identisk med Linjer-accordion-trigger */
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => handleShiftRowClick(c.id)}
                        className="border-border hover:bg-muted/30 w-full rounded-md border p-3 text-left text-sm transition-colors"
                        title="Klikk for å se lønnslinjene for denne vakten"
                      >
                        {/* Vakt-header: tid + varighet */}
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-foreground font-medium">
                            {formatTs(c.scheduled_start)} – {formatTs(c.scheduled_end)}
                          </span>
                          <span className="text-muted-foreground text-xs">
                            {formatMinutes(c.net_working_minutes)}
                          </span>
                        </div>

                        {/* Lønnsoversikt (Item 6: grid identisk padding/størrelse) */}
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

                        {/* Meta + hint om å klikke */}
                        <div className="text-muted-foreground mt-1.5 flex items-center justify-between gap-3 text-[10px]">
                          <div className="flex items-center gap-3">
                            <span>v{c.calculation_version}</span>
                            <span>Sats: {formatNok(c.base_rate)}/t</span>
                            <span>Beregnet: {formatTs(c.calculated_at)}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            {/* T18 — "Korriger tid" kun for åpne perioder + admin */}
                            {isPeriodOpen && isAdmin && (
                              <TooltipProvider delayDuration={300}>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <button
                                      type="button"
                                      aria-label="Korriger tidsregistrering for denne vakten"
                                      className="text-muted-foreground hover:text-foreground rounded p-0.5 transition-colors"
                                      onClick={(e) => {
                                        // Prevent the outer row-button from also firing
                                        e.stopPropagation();
                                        setTimeEntryDialogCalc(c);
                                      }}
                                    >
                                      <Clock className="h-3 w-3" aria-hidden />
                                    </button>
                                  </TooltipTrigger>
                                  <TooltipContent side="bottom">
                                    <p className="text-xs">Korriger tid</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                            <span className="hidden sm:inline">Se linjer →</span>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </TabsContent>

              {/* ── Linjer-fane (accordion gruppert per vakt) ── */}
              <TabsContent value="lines" className="flex-1 overflow-y-auto px-4 py-3">
                {calcLines.length === 0 ? (
                  /* Item 4: tom-tilstand */
                  <EmptyState onRecalculate={onRecalculate} />
                ) : (
                  <>
                    <div ref={accordionRef}>
                      <Accordion
                        type="multiple"
                        // Åpne alle som standard; highlight-ID holder seg åpen via defaultValue
                        defaultValue={lineGroups.map((g) => g.shiftId)}
                        className="space-y-1"
                      >
                        {lineGroups.map((g) => (
                          <AccordionItem
                            key={g.shiftId}
                            value={g.shiftId}
                            // data-shift-id brukes av scroll-logikken i handleShiftRowClick
                            data-shift-id={g.shiftId}
                            className={`border-border rounded-md border transition-colors ${
                              highlightShiftId === g.shiftId
                                ? "ring-primary/30 ring-2 ring-offset-1"
                                : ""
                            }`}
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
                                    shiftLabel={g.shiftLabel}
                                  />
                                ))}
                              </div>
                            </AccordionContent>
                          </AccordionItem>
                        ))}
                      </Accordion>
                    </div>

                    {/* Orphan-linjer: tips, manual_adj uten vakt-FK */}
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

                {/* T3.4 — Manuelle tillegg (sletteliste, kun åpne perioder) */}
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

      {/* T4.1 — LineOverrideModal (utenfor Sheet for å unngå stacking-problemer) */}
      <LineOverrideModal
        open={overrideModalOpen}
        onOpenChange={setOverrideModalOpen}
        workspaceId={workspaceId}
        periodId={periodId}
        periodStatus={periodStatus}
        line={selectedOverrideLine}
        onSuccess={() => {
          // Badge-state oppdateres automatisk via usePendingOverrides-invalidering
        }}
      />

      {/* T3.3 — ManualSupplementForm (kun åpne perioder) */}
      {isPeriodOpen && (
        <ManualSupplementForm
          open={supplementModalOpen}
          onOpenChange={setSupplementModalOpen}
          periodId={periodId}
          workspaceId={workspaceId}
          prefillProfileId={line?.profileId}
        />
      )}

      {/* T18 — ManualTimeEntryDialog (kun åpne perioder + admin, utenfor Sheet for å unngå stacking) */}
      {isPeriodOpen && isAdmin && timeEntryDialogCalc && line && (
        <ManualTimeEntryDialog
          open={timeEntryDialogCalc !== null}
          onOpenChange={(v) => {
            if (!v) setTimeEntryDialogCalc(null);
          }}
          shiftId={timeEntryDialogCalc.schedule_shift_id}
          scheduledStart={timeEntryDialogCalc.scheduled_start}
          scheduledEnd={timeEntryDialogCalc.scheduled_end}
          periodId={periodId}
          profileId={line.profileId}
          shiftLabel={(() => {
            try {
              const start = new Date(timeEntryDialogCalc.scheduled_start);
              const end = new Date(timeEntryDialogCalc.scheduled_end);
              return `${start.toLocaleDateString("nb-NO", { weekday: "short", day: "numeric", month: "short" })} ${start.toLocaleTimeString("nb-NO", { hour: "2-digit", minute: "2-digit" })} — ${end.toLocaleTimeString("nb-NO", { hour: "2-digit", minute: "2-digit" })}`;
            } catch {
              return undefined;
            }
          })()}
        />
      )}

      {/* T3.4 — Slett tillegg — bekreftelses-dialog */}
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

// ─── EmptyState (Item 4) ─────────────────────────────────────────────────────

function EmptyState({ onRecalculate }: { onRecalculate?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
      <Calculator className="text-muted-foreground h-10 w-10" />
      <div>
        <p className="text-foreground text-sm font-medium">Ingen lønnslinjer beregnet</p>
        <p className="text-muted-foreground mt-1 text-xs">Kjør beregning for å generere data</p>
      </div>
      {onRecalculate && (
        <Button variant="outline" size="sm" onClick={onRecalculate} className="mt-1">
          Kjør beregning
        </Button>
      )}
    </div>
  );
}

// ─── LineRow — gjenbrukbar per-linje-renderer ────────────────────────────────
//
// Sprint 3 Fix 2 (mobil): salary-code + description stables på separate linjer
// på smale viewports; sm:flex-row gjenoppretter enkelt-rad-layout på ≥640px.
// Item 6: padding/border/hover identisk med Vakter-fanen.

type LineRowProps = {
  cl: CalcLine;
  hasPending: boolean;
  overrideable: boolean;
  isAdmin: boolean;
  isPeriodOpen: boolean;
  onOverride: (cl: CalcLine, shiftLabel?: string) => void;
  shiftLabel?: string;
};

function LineRow({
  cl,
  hasPending,
  overrideable,
  isAdmin,
  isPeriodOpen,
  onOverride,
  shiftLabel,
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
      {/* Lønnsnummer — full bredde mobil, fast bredde desktop */}
      <span
        className="text-muted-foreground shrink-0 truncate font-mono sm:w-24"
        title={cl.salary_code}
      >
        {cl.salary_code}
      </span>

      {/* Beskrivelse */}
      <span className="text-foreground min-w-0 truncate sm:flex-1">
        {cl.description ? cl.description : (LINE_TYPE_LABELS[cl.line_type] ?? cl.line_type)}
      </span>

      {/* Paragraf-hjemmel tooltip */}
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

      {/* Tallrekke */}
      <div className="flex items-center gap-3 sm:contents">
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

        <span className="text-muted-foreground text-right tabular-nums sm:w-20">
          {cl.rate != null ? formatNok(cl.rate) : "—"}
        </span>

        <span className={`text-right font-medium tabular-nums sm:w-20 ${amountColor}`}>
          {formatNok(cl.amount)}
        </span>

        {hasPending ? (
          <Badge variant="secondary" className="shrink-0 text-[10px]">
            Venter godkjenning
          </Badge>
        ) : overrideable && isAdmin ? (
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-foreground h-6 shrink-0 gap-1 px-2 text-[10px]"
            onClick={() => onOverride(cl, shiftLabel)}
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
