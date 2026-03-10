// ============================================
// ReportInsightDrawer.tsx
// Side drawer for report-card insights and variable tuning.
// Opens when users click cards in the reports sections.
// ============================================

"use client";

import { useMemo } from "react";
import { SlidersHorizontal } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import type { ReportInsightCard } from "./report-insight-types";

type ReportInsightDrawerProps = {
  isDark: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  insight: ReportInsightCard | null;
  onFactorChange: (cardId: string, factorId: string, value: number) => void;
  onResetCard: (cardId: string) => void;
};

/**
 * Renders insight details and editable controls for selected report cards.
 */
export function ReportInsightDrawer({
  isDark,
  open,
  onOpenChange,
  insight,
  onFactorChange,
  onResetCard,
}: ReportInsightDrawerProps) {
  const impactScore = useMemo(() => {
    if (!insight || insight.factors.length === 0) return 0;

    const score =
      insight.factors.reduce((sum, factor) => {
        const range = factor.max - factor.min;
        if (range <= 0) return sum;
        const normalized = (factor.value - factor.min) / range;
        return sum + normalized;
      }, 0) / insight.factors.length;

    return Math.round(score * 100);
  }, [insight]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        className={`flex w-[460px] flex-col gap-5 p-0 sm:max-w-[460px] ${
          isDark
            ? "border-zinc-800 bg-zinc-950 text-zinc-100"
            : "border-zinc-200 bg-white text-zinc-900"
        }`}
      >
        <SheetHeader
          className={`border-b px-6 py-5 ${isDark ? "border-zinc-800" : "border-zinc-200"}`}
        >
          <SheetTitle className="flex items-center gap-2 text-base">
            <SlidersHorizontal className="h-4 w-4" />
            Innsikter og variabler
          </SheetTitle>
        </SheetHeader>

        {!insight ? (
          <div className="px-6 py-2 text-sm text-zinc-500">Velg et kort for å se detaljer.</div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-6 pb-6">
            <div
              className={`rounded-xl border p-4 ${
                isDark ? "border-zinc-800 bg-zinc-900/40" : "border-zinc-200 bg-zinc-50"
              }`}
            >
              <h3 className={`text-sm font-bold ${isDark ? "text-zinc-100" : "text-zinc-900"}`}>
                {insight.title}
              </h3>
              <p className={`mt-1 text-xs ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>
                {insight.summary}
              </p>
              <p
                className={`mt-3 inline-flex rounded-md px-2 py-1 text-[11px] font-semibold ${
                  isDark ? "bg-blue-500/10 text-blue-300" : "bg-blue-50 text-blue-700"
                }`}
              >
                Simulert effekt: {impactScore}%
              </p>
            </div>

            <div className="space-y-4">
              {insight.factors.map((factor) => (
                <div key={factor.id}>
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <label
                      className={`text-xs font-semibold ${isDark ? "text-zinc-300" : "text-zinc-700"}`}
                    >
                      {factor.label}
                    </label>
                    <span className={`text-xs ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>
                      {factor.value}
                      {factor.unit ? ` ${factor.unit}` : ""}
                    </span>
                  </div>

                  <input
                    type="range"
                    min={factor.min}
                    max={factor.max}
                    step={factor.step}
                    value={factor.value}
                    onChange={(event) =>
                      onFactorChange(insight.cardId, factor.id, Number(event.target.value))
                    }
                    className="w-full"
                  />

                  <div className="mt-2">
                    <input
                      type="number"
                      min={factor.min}
                      max={factor.max}
                      step={factor.step}
                      value={factor.value}
                      onChange={(event) =>
                        onFactorChange(insight.cardId, factor.id, Number(event.target.value))
                      }
                      className={`w-full rounded-lg border px-3 py-2 text-sm outline-none ${
                        isDark
                          ? "border-zinc-700 bg-zinc-900 text-zinc-100 focus:border-blue-500"
                          : "border-zinc-300 bg-white text-zinc-900 focus:border-blue-500"
                      }`}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-2 flex justify-end">
              <Button variant="outline" onClick={() => onResetCard(insight.cardId)}>
                Reset variabler
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
