"use client";

import { useState, useEffect, useMemo } from "react";
import { useDayFactors, DEFAULT_DAY_FACTORS, WEEKDAY_LABELS } from "../_hooks";

type Props = {
  seasonBudgetId: string;
  isDark: boolean;
};

export function DayFactorsTab({ seasonBudgetId, isDark }: Props) {
  const { dayFactors, isLoading, saveDayFactors } = useDayFactors(seasonBudgetId);

  const [factors, setFactors] =
    useState<{ weekday: number; factor: number }[]>(DEFAULT_DAY_FACTORS);

  // Sync with loaded data
  useEffect(() => {
    if (dayFactors.length > 0) {
      setFactors(dayFactors.map((df) => ({ weekday: df.weekday, factor: df.factor })));
    }
  }, [dayFactors]);

  const maxFactor = useMemo(() => Math.max(...factors.map((f) => f.factor), 1), [factors]);

  const updateFactor = (weekday: number, value: string) => {
    const num = parseFloat(value);
    if (isNaN(num) || num <= 0) return;
    setFactors((prev) => prev.map((f) => (f.weekday === weekday ? { ...f, factor: num } : f)));
  };

  const handleSave = () => {
    saveDayFactors.mutate(factors);
  };

  const applyTemplate = (template: "restaurant" | "hotel" | "flat") => {
    const templates: Record<string, { weekday: number; factor: number }[]> = {
      restaurant: DEFAULT_DAY_FACTORS,
      hotel: [
        { weekday: 0, factor: 1.0 },
        { weekday: 1, factor: 1.0 },
        { weekday: 2, factor: 1.1 },
        { weekday: 3, factor: 1.1 },
        { weekday: 4, factor: 1.3 },
        { weekday: 5, factor: 1.4 },
        { weekday: 6, factor: 1.1 },
      ],
      flat: Array.from({ length: 7 }, (_, i) => ({ weekday: i, factor: 1.0 })),
    };
    setFactors(templates[template]!);
  };

  const cardClass = isDark
    ? "rounded-2xl border border-zinc-800 bg-[#0c0c0e] p-6"
    : "rounded-2xl border border-zinc-200 bg-white p-6";

  if (isLoading) {
    return <div className={`${cardClass} h-64 animate-pulse`} />;
  }

  return (
    <div className={cardClass}>
      <div className="mb-6 flex items-center justify-between">
        <h3 className={`text-lg font-bold ${isDark ? "text-white" : "text-zinc-900"}`}>
          Dagfaktorer
        </h3>
        <div className="flex gap-2">
          {(["restaurant", "hotel", "flat"] as const).map((t) => (
            <button
              key={t}
              onClick={() => applyTemplate(t)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                isDark
                  ? "border border-zinc-700 text-zinc-400 hover:bg-zinc-800 hover:text-white"
                  : "border border-zinc-300 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
              }`}
            >
              {t === "restaurant" ? "Restaurant" : t === "hotel" ? "Hotell" : "Flat"}
            </button>
          ))}
        </div>
      </div>

      <p className={`mb-6 text-sm ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>
        Relative vekter per ukedag. Høyere = mer omsetning forventet. Systemet normaliserer
        automatisk.
      </p>

      <div className="space-y-3">
        {factors.map((f) => {
          const barWidth = (f.factor / maxFactor) * 100;
          return (
            <div key={f.weekday} className="flex items-center gap-4">
              <span
                className={`w-10 text-sm font-bold ${isDark ? "text-zinc-400" : "text-zinc-500"}`}
              >
                {WEEKDAY_LABELS[f.weekday]}
              </span>
              <div className="flex-1">
                <div className={`h-8 rounded-lg ${isDark ? "bg-zinc-900" : "bg-zinc-100"}`}>
                  <div
                    className="flex h-full items-center rounded-lg bg-blue-600/20 px-3 transition-all"
                    style={{ width: `${barWidth}%` }}
                  >
                    <span className="text-xs font-bold text-blue-400">{f.factor.toFixed(1)}x</span>
                  </div>
                </div>
              </div>
              <input
                type="number"
                value={f.factor}
                onChange={(e) => updateFactor(f.weekday, e.target.value)}
                step="0.1"
                min="0.1"
                className={`w-20 rounded-lg border px-3 py-1.5 text-center text-sm font-medium outline-none ${
                  isDark
                    ? "border-zinc-700 bg-zinc-900 text-white focus:border-blue-500"
                    : "border-zinc-300 bg-white text-zinc-900 focus:border-blue-500"
                }`}
              />
            </div>
          );
        })}
      </div>

      <div className="mt-8 flex justify-end">
        <button
          onClick={handleSave}
          disabled={saveDayFactors.isPending}
          className="rounded-xl bg-blue-600 px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-blue-500 disabled:opacity-50"
        >
          {saveDayFactors.isPending ? "Lagrer..." : "Lagre dagfaktorer"}
        </button>
      </div>
    </div>
  );
}
