// ============================================
// day-control/BudgetTab.tsx
// Budget perspective tab: revenue target, labor/food cost, YoY comparison.
// Fetches real budget data from workspace_budget via useScheduleBudget.
// ============================================
"use client";

import { useContext } from "react";
import { TrendingUp, TrendingDown, Loader2 } from "lucide-react";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { useWorkspaceOptional } from "@/lib/workspace-context";
import { SectionHeader, KpiCard, formatNok } from "./shared";
import { useScheduleBudget } from "../../_hooks/useScheduleBudget";

export function BudgetTab({ dateId }: { dateId: string | null }) {
  const { isDark } = useContext(DashboardContext);
  const ctx = useWorkspaceOptional();
  const workspaceId = ctx?.workspace.workspace_id;

  const { data: budgetTargets, isLoading } = useScheduleBudget(
    workspaceId,
    dateId ?? "",
    dateId ?? "",
  );

  if (isLoading) {
    return (
      <div className="flex h-40 items-center justify-center">
        <Loader2 className="text-muted-foreground h-5 w-5 animate-spin" />
      </div>
    );
  }

  const todayBudget = budgetTargets?.[0];

  if (!todayBudget) {
    return (
      <div className="flex h-40 items-center justify-center">
        <p className="text-muted-foreground text-sm">
          Ingen budsjett satt for denne dagen. Sett opp sesongbudsjett under Årshjul.
        </p>
      </div>
    );
  }

  // Build budget object from real data (food cost not in workspace_budget — show as 0)
  const budget = {
    revenueTarget: todayBudget.targetRevenue,
    laborTarget: todayBudget.targetLaborCost,
    foodCostTarget: 0,
    lastYearRevenue: 0,
    lastYearLabor: 0,
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
