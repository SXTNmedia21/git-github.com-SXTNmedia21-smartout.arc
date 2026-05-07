"use client";

/**
 * LineDrawer — per-employee drill-down for a payroll period.
 *
 * What: Sheet that opens when a row in LinesTable is clicked, showing:
 *   - Tab 1 "Vakter": each payroll.calculation row (one per shift)
 *   - Tab 2 "Linjer": each payroll.calculation_line row (salary-code level)
 *
 * Why: ADR-0251 "100% Transparency" — every krone must trace to input + rule + rate.
 *      The drawer is the Layer-1 UI trace path described in ARCHITECTURE.md §Layer 1.
 *
 * Data: supabase anon client (RLS-scoped to authenticated user's workspace).
 *       Does NOT call Stage Engine — read-only display, no mutations.
 *
 * ADR-0078: No PII in this view (timebank balances, shift times — not Høy-PII).
 * ADR-0133: Web-only authoring surface. Mobile reads via my-salary.
 */

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { nb } from "date-fns/locale";
import { Loader2, X } from "lucide-react";
import { createClient } from "@smartout/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { PayrollLine } from "../_hooks/use-payroll-lines";

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

const LINE_TYPE_LABELS: Record<string, string> = {
  worked_hours: "Arbeidstimer",
  supplement: "Tillegg",
  overtime: "Overtid",
  absence: "Fravær",
  deduction: "Trekk",
  monthly_salary: "Fastlønn",
  manual_adj: "Manuell justering",
};

// ─── Component ─────────────────────────────────────────────────────────────

export function LineDrawer({ open, onClose, periodId, line }: Props) {
  const [calcs, setCalcs] = useState<CalcRow[]>([]);
  const [calcLines, setCalcLines] = useState<CalcLine[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="flex w-full flex-col sm:max-w-2xl">
        <SheetHeader className="border-b pb-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <SheetTitle className="text-base">{line?.displayName ?? "Ansatt"}</SheetTitle>
              <p className="text-muted-foreground text-xs">
                {line?.shiftCount ?? 0} vakter · {formatNok(line?.totalPay ?? 0)} totalt
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground rounded-md p-1 transition-colors"
              aria-label="Lukk"
            >
              <X className="h-4 w-4" />
            </button>
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
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-muted-foreground border-b text-left tracking-wider uppercase">
                        <th className="pr-3 pb-2 font-medium">Kode</th>
                        <th className="pr-3 pb-2 font-medium">Type</th>
                        <th className="pr-3 pb-2 text-right font-medium">Timer</th>
                        <th className="pr-3 pb-2 text-right font-medium">Sats</th>
                        <th className="pb-2 text-right font-medium">Beløp</th>
                      </tr>
                    </thead>
                    <tbody>
                      {calcLines.map((cl) => (
                        <tr
                          key={cl.id}
                          className="hover:bg-muted/30 border-b transition-colors last:border-b-0"
                        >
                          <td className="py-2 pr-3 font-mono">{cl.salary_code}</td>
                          <td className="py-2 pr-3">
                            {LINE_TYPE_LABELS[cl.line_type] ?? cl.line_type}
                            {cl.description ? (
                              <span className="text-muted-foreground ml-1 text-[10px]">
                                — {cl.description}
                              </span>
                            ) : null}
                          </td>
                          <td className="py-2 pr-3 text-right tabular-nums">
                            {cl.hours != null ? `${cl.hours}t` : "—"}
                          </td>
                          <td className="py-2 pr-3 text-right tabular-nums">
                            {cl.rate != null ? formatNok(cl.rate) : "—"}
                          </td>
                          <td
                            className={`py-2 text-right font-medium tabular-nums ${
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
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}
      </SheetContent>
    </Sheet>
  );
}
