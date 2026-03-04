"use client";

import { useState, useEffect } from "react";
import { useSeasonBudget } from "../_hooks";

type Props = {
  seasonId: string;
  isDark: boolean;
};

export function BudgetSetupTab({ seasonId, isDark }: Props) {
  const { budget, isLoading, upsertBudget } = useSeasonBudget(seasonId);

  const [totalTarget, setTotalTarget] = useState("");
  const [laborPct, setLaborPct] = useState("30");
  const [hourlyWage, setHourlyWage] = useState("");
  const [basePrice, setBasePrice] = useState("");

  // Sync form with loaded data
  useEffect(() => {
    if (budget) {
      setTotalTarget(String(budget.total_target_revenue));
      setLaborPct(String(Math.round(budget.target_labor_percentage * 100)));
      setHourlyWage(budget.avg_hourly_wage != null ? String(budget.avg_hourly_wage) : "");
      setBasePrice(budget.base_price_per_guest != null ? String(budget.base_price_per_guest) : "");
    }
  }, [budget]);

  const handleSave = () => {
    const target = parseFloat(totalTarget);
    if (isNaN(target) || target <= 0) return;

    upsertBudget.mutate({
      season_id: seasonId,
      total_target_revenue: target,
      target_labor_percentage: (parseFloat(laborPct) || 30) / 100,
      avg_hourly_wage: hourlyWage ? parseFloat(hourlyWage) : null,
      base_price_per_guest: basePrice ? parseFloat(basePrice) : null,
    });
  };

  const cardClass = isDark
    ? "rounded-2xl border border-zinc-800 bg-[#0c0c0e] p-6"
    : "rounded-2xl border border-zinc-200 bg-white p-6";

  const inputClass = isDark
    ? "w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-white outline-none focus:border-blue-500"
    : "w-full rounded-xl border border-zinc-300 bg-zinc-50 px-4 py-3 text-zinc-900 outline-none focus:border-blue-500";

  const labelClass = `mb-2 block text-xs font-bold tracking-wider uppercase ${isDark ? "text-zinc-500" : "text-zinc-400"}`;

  if (isLoading) {
    return <div className={`${cardClass} h-64 animate-pulse`} />;
  }

  return (
    <div className={cardClass}>
      <h3 className={`mb-6 text-lg font-bold ${isDark ? "text-white" : "text-zinc-900"}`}>
        Budsjettoppsett
      </h3>

      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <label className={labelClass}>Total omsetningsmål (NOK)</label>
          <input
            type="number"
            value={totalTarget}
            onChange={(e) => setTotalTarget(e.target.value)}
            placeholder="f.eks. 5000000"
            className={inputClass}
          />
          <p className={`mt-1 text-xs ${isDark ? "text-zinc-600" : "text-zinc-400"}`}>
            Totalt for hele sesongen
          </p>
        </div>

        <div>
          <label className={labelClass}>Mål lønnsandel (%)</label>
          <input
            type="number"
            value={laborPct}
            onChange={(e) => setLaborPct(e.target.value)}
            placeholder="30"
            min="0"
            max="100"
            className={inputClass}
          />
          <p className={`mt-1 text-xs ${isDark ? "text-zinc-600" : "text-zinc-400"}`}>
            Andel av omsetning til lønn (typisk 25-35%)
          </p>
        </div>

        <div>
          <label className={labelClass}>Gj.snitt timeslønn (NOK)</label>
          <input
            type="number"
            value={hourlyWage}
            onChange={(e) => setHourlyWage(e.target.value)}
            placeholder="f.eks. 220"
            className={inputClass}
          />
          <p className={`mt-1 text-xs ${isDark ? "text-zinc-600" : "text-zinc-400"}`}>
            Brukes til bemanningsberegning
          </p>
        </div>

        <div>
          <label className={labelClass}>Snittpris per gjest (NOK)</label>
          <input
            type="number"
            value={basePrice}
            onChange={(e) => setBasePrice(e.target.value)}
            placeholder="f.eks. 450"
            className={inputClass}
          />
          <p className={`mt-1 text-xs ${isDark ? "text-zinc-600" : "text-zinc-400"}`}>
            Gjennomsnittlig kuvert uten drikke
          </p>
        </div>
      </div>

      <div className="mt-8 flex justify-end">
        <button
          onClick={handleSave}
          disabled={upsertBudget.isPending || !totalTarget}
          className="rounded-xl bg-blue-600 px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-blue-500 disabled:opacity-50"
        >
          {upsertBudget.isPending ? "Lagrer..." : "Lagre budsjett"}
        </button>
      </div>
    </div>
  );
}
