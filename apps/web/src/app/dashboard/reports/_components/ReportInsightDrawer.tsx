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
      <SheetContent className="border-border bg-card text-foreground flex w-[460px] flex-col gap-5 p-0 sm:max-w-[460px]">
        <SheetHeader className="border-border border-b px-6 py-5">
          <SheetTitle className="flex items-center gap-2 text-base">
            <SlidersHorizontal className="h-4 w-4" />
            Innsikter og variabler
          </SheetTitle>
        </SheetHeader>

        {!insight ? (
          <div className="text-muted-foreground px-6 py-2 text-sm">
            Velg et kort for å se detaljer.
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-6 pb-6">
            <div className="border-border bg-muted/40 rounded-xl border p-4">
              <h3 className="text-foreground text-sm font-bold">{insight.title}</h3>
              <p className="text-muted-foreground mt-1 text-xs">{insight.summary}</p>
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
                    <label className="text-foreground text-xs font-semibold">{factor.label}</label>
                    <span className="text-muted-foreground text-xs">
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
                      className="border-border bg-muted text-foreground w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-blue-500"
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
