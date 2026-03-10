// ============================================
// day-control/BudgetTab.tsx
// Budget perspective tab: revenue target, labor/food cost, YoY comparison.
// Uses mock data until per-day budget hook is available.
// ============================================
"use client";

import { useContext } from "react";
import { TrendingUp, TrendingDown } from "lucide-react";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { SectionHeader, KpiCard, formatNok } from "./shared";

export function BudgetTab({ dateId: _dateId }: { dateId: string | null }) {
  const { isDark } = useContext(DashboardContext);

  // Mock budget data — will be replaced with useBudget hook
  const budget = {
    revenueTarget: 42000,
    laborTarget: 12600,
    foodCostTarget: 12180,
    lastYearRevenue: 38500,
    lastYearLabor: 11200,
  };

  const laborPct =
    budget.revenueTarget > 0 ? ((budget.laborTarget / budget.revenueTarget) * 100).toFixed(1) : "0";
  const foodPct =
    budget.revenueTarget > 0
      ? ((budget.foodCostTarget / budget.revenueTarget) * 100).toFixed(1)
      : "0";
  const yoyChange =
    budget.lastYearRevenue > 0
      ? (((budget.revenueTarget - budget.lastYearRevenue) / budget.lastYearRevenue) * 100).toFixed(
          1,
        )
      : "0";
  const yoyPositive = Number(yoyChange) >= 0;

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 space-y-6 duration-200">
      {/* Target KPIs */}
      <section>
        <SectionHeader label="Budsjettmål" />
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <KpiCard label="Omsetning" value={formatNok(budget.revenueTarget)} />
          <KpiCard label="Lønnskostnad" value={`${formatNok(budget.laborTarget)} (${laborPct}%)`} />
          <KpiCard
            label="Varekostnad"
            value={`${formatNok(budget.foodCostTarget)} (${foodPct}%)`}
          />
        </div>
      </section>

      {/* Year-over-year comparison */}
      <section>
        <SectionHeader label="Mot i fjor" />
        <div
          className={`rounded-xl border p-4 ${isDark ? "border-border bg-muted/20" : "border-border bg-card"}`}
        >
          <div className="mb-3 flex items-center justify-between">
            <span className="text-muted-foreground text-xs font-bold">Omsetning</span>
            <span
              className={`flex items-center gap-1 text-xs font-bold ${yoyPositive ? "text-emerald-500" : "text-red-500"}`}
            >
              {yoyPositive ? (
                <TrendingUp className="h-3 w-3" />
              ) : (
                <TrendingDown className="h-3 w-3" />
              )}
              {yoyPositive ? "+" : ""}
              {yoyChange}%
            </span>
          </div>
          {/* Stacked bar */}
          <div className="space-y-2">
            <div>
              <div className="text-muted-foreground mb-1 flex justify-between text-[10px]">
                <span>I år (mål)</span>
                <span>{formatNok(budget.revenueTarget)}</span>
              </div>
              <div className="bg-muted/30 h-5 w-full overflow-hidden rounded-lg">
                <div className="h-full bg-indigo-500 transition-all" style={{ width: "100%" }} />
              </div>
            </div>
            <div>
              <div className="text-muted-foreground mb-1 flex justify-between text-[10px]">
                <span>I fjor</span>
                <span>{formatNok(budget.lastYearRevenue)}</span>
              </div>
              <div className="bg-muted/30 h-5 w-full overflow-hidden rounded-lg">
                <div
                  className="bg-muted-foreground/40 h-full transition-all"
                  style={{
                    width: `${(budget.lastYearRevenue / budget.revenueTarget) * 100}%`,
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Cost breakdown */}
      <section>
        <SectionHeader label="Kostnadsfordeling" />
        <div
          className={`rounded-xl border p-4 ${isDark ? "border-border bg-muted/20" : "border-border bg-card"}`}
        >
          <div className="space-y-3">
            <CostRow
              label="Lønn"
              amount={budget.laborTarget}
              pct={Number(laborPct)}
              color="bg-blue-500"
            />
            <CostRow
              label="Varekost"
              amount={budget.foodCostTarget}
              pct={Number(foodPct)}
              color="bg-amber-500"
            />
            <CostRow
              label="Margin"
              amount={budget.revenueTarget - budget.laborTarget - budget.foodCostTarget}
              pct={100 - Number(laborPct) - Number(foodPct)}
              color="bg-emerald-500"
            />
          </div>
        </div>
      </section>
    </div>
  );
}

function CostRow({
  label,
  amount,
  pct,
  color,
}: {
  label: string;
  amount: number;
  pct: number;
  color: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-muted-foreground w-20 text-xs font-bold">{label}</span>
      <div className="bg-muted/30 h-3 flex-1 overflow-hidden rounded-full">
        <div className={`h-full ${color} transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-foreground w-20 text-right text-xs font-bold">{formatNok(amount)}</span>
      <span className="text-muted-foreground w-10 text-right text-[10px]">{pct.toFixed(0)}%</span>
    </div>
  );
}
