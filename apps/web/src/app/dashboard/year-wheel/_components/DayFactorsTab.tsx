"use client";

import { useState, useEffect, useMemo } from "react";
import { useTranslation } from "@smartout/i18n";
import { useDayFactors, DEFAULT_DAY_FACTORS, WEEKDAY_LABELS } from "../_hooks";
import {
  BUDGET_SETUP_LIMITS,
  getDayFactorTemplate,
  type DayFactorTemplateId,
} from "../_definitions/season-planning";
import { toast } from "sonner";

type Props = {
  seasonBudgetId: string;
  isReadOnly?: boolean;
};

export function DayFactorsTab({ seasonBudgetId, isReadOnly = false }: Props) {
  const { t } = useTranslation("dashboard");
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
    if (num < BUDGET_SETUP_LIMITS.dayFactor.min || num > BUDGET_SETUP_LIMITS.dayFactor.max) return;
    setFactors((prev) => prev.map((f) => (f.weekday === weekday ? { ...f, factor: num } : f)));
  };

  const handleSave = () => {
    if (isReadOnly) {
      toast.error(t("yearWheel.budget_locked"));
      return;
    }
    saveDayFactors.mutate(factors);
  };

  const applyTemplate = (template: DayFactorTemplateId) => {
    if (isReadOnly) {
      toast.error(t("yearWheel.budget_locked"));
      return;
    }
    setFactors(getDayFactorTemplate(template));
  };

  if (isLoading) {
    return <div className="border-border bg-card h-64 animate-pulse rounded-2xl border p-6" />;
  }

  return (
    <div className="border-border bg-card rounded-2xl border p-6">
      <div className="mb-6 flex items-center justify-between">
        <h3 className="text-foreground text-lg font-bold">{t("yearWheel.day_factors")}</h3>
        <div className="flex gap-2">
          {(["restaurant", "hotel", "event", "flat"] as const).map((tpl) => (
            <button
              key={tpl}
              onClick={() => applyTemplate(tpl)}
              disabled={isReadOnly}
              className="border-border text-muted-foreground hover:bg-accent hover:text-accent-foreground rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors"
            >
              {tpl === "restaurant"
                ? t("yearWheel.template_restaurant")
                : tpl === "hotel"
                  ? t("yearWheel.template_hotel")
                  : tpl === "event"
                    ? t("yearWheel.template_event")
                    : t("yearWheel.template_flat")}
            </button>
          ))}
        </div>
      </div>

      <p className="text-muted-foreground mb-6 text-sm">
        {t("yearWheel.day_factors_help")}
      </p>

      <div className="space-y-3">
        {factors.map((f) => {
          const barWidth = (f.factor / maxFactor) * 100;
          return (
            <div key={f.weekday} className="flex items-center gap-4">
              <span className="text-muted-foreground w-10 text-sm font-bold">
                {WEEKDAY_LABELS[f.weekday]}
              </span>
              <div className="flex-1">
                <div className="bg-muted h-8 rounded-lg">
                  <div
                    className="bg-chart-1/20 flex h-full items-center rounded-lg px-3 transition-all"
                    style={{ width: `${barWidth}%` }}
                  >
                    <span className="text-chart-1 text-xs font-bold">{f.factor.toFixed(1)}x</span>
                  </div>
                </div>
              </div>
              <input
                type="number"
                value={f.factor}
                onChange={(e) => updateFactor(f.weekday, e.target.value)}
                step="0.1"
                min={BUDGET_SETUP_LIMITS.dayFactor.min}
                max={BUDGET_SETUP_LIMITS.dayFactor.max}
                disabled={isReadOnly}
                className="border-input bg-background text-foreground focus:border-primary w-16 rounded-lg border px-2 py-1.5 text-center text-sm font-medium outline-none"
              />
            </div>
          );
        })}
      </div>

      <div className="mt-6 flex justify-end">
        <button
          onClick={handleSave}
          disabled={saveDayFactors.isPending || isReadOnly}
          className="bg-primary text-primary-foreground rounded-lg px-4 py-2 text-sm font-bold transition-colors hover:opacity-90 disabled:opacity-50"
        >
          {saveDayFactors.isPending ? t("yearWheel.saving") : t("yearWheel.save_day_factors")}
        </button>
      </div>
    </div>
  );
}
