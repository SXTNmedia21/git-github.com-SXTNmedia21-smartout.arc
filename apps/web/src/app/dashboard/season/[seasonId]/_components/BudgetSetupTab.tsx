"use client";

import { useState, useEffect } from "react";
import { useTranslation } from "@smartout/i18n";
import { useSeasonBudget } from "@/app/dashboard/year-wheel/_hooks";
import {
  BUDGET_SETUP_LIMITS,
  SEASON_BUDGET_STATUS_OPTIONS,
  type SeasonBudgetStatus,
} from "@/app/dashboard/year-wheel/_definitions/season-planning";
import { toast } from "sonner";

type Props = {
  seasonId: string;
};

export function BudgetSetupTab({ seasonId }: Props) {
  const { t } = useTranslation("dashboard");
  const { budget, isLoading, upsertBudget } = useSeasonBudget(seasonId);

  const [totalTarget, setTotalTarget] = useState("");
  const [laborPct, setLaborPct] = useState("30");
  const [hourlyWage, setHourlyWage] = useState("");
  const [basePrice, setBasePrice] = useState("");
  const [seasonPriceFactor, setSeasonPriceFactor] = useState("1.0");
  const [status, setStatus] = useState<SeasonBudgetStatus>("draft");

  // Sync form with loaded data
  useEffect(() => {
    if (budget) {
      setTotalTarget(String(budget.total_target_revenue));
      setLaborPct(String(Math.round(budget.target_labor_percentage * 100)));
      setHourlyWage(budget.avg_hourly_wage != null ? String(budget.avg_hourly_wage) : "");
      setBasePrice(budget.base_price_per_guest != null ? String(budget.base_price_per_guest) : "");
      setSeasonPriceFactor(String(budget.season_price_factor ?? 1.0));
      setStatus(budget.status);
    }
  }, [budget]);

  const isLocked = status === "locked";

  /**
   * Validates a numeric input against defined bounds.
   */
  const validateNumberInRange = (
    label: string,
    value: number | null,
    limits: { min: number; max: number },
  ): boolean => {
    if (value == null) return true;
    if (value < limits.min || value > limits.max) {
      toast.error(t("yearWheel.validation_range", { label, min: limits.min, max: limits.max }));
      return false;
    }
    return true;
  };

  const handleSave = () => {
    if (isLocked) {
      toast.error(t("yearWheel.budget_locked"));
      return;
    }

    const target = parseFloat(totalTarget);
    const labor = parseFloat(laborPct);
    const wage = hourlyWage ? parseFloat(hourlyWage) : null;
    const price = basePrice ? parseFloat(basePrice) : null;
    const priceFactor = parseFloat(seasonPriceFactor);

    if (isNaN(target) || target <= 0) {
      toast.error(
        t("yearWheel.validation_positive_number", { label: t("yearWheel.total_revenue_target") }),
      );
      return;
    }

    const validations = [
      validateNumberInRange(
        t("yearWheel.total_revenue_target"),
        target,
        BUDGET_SETUP_LIMITS.totalTargetRevenue,
      ),
      validateNumberInRange(
        t("yearWheel.target_labor_label"),
        labor,
        BUDGET_SETUP_LIMITS.targetLaborPercentage,
      ),
      validateNumberInRange(
        t("yearWheel.avg_hourly_wage_label"),
        wage,
        BUDGET_SETUP_LIMITS.avgHourlyWage,
      ),
      validateNumberInRange(
        t("yearWheel.base_price_label"),
        price,
        BUDGET_SETUP_LIMITS.basePricePerGuest,
      ),
      validateNumberInRange(
        t("yearWheel.season_price_factor_label"),
        priceFactor,
        BUDGET_SETUP_LIMITS.seasonPriceFactor,
      ),
    ];

    if (validations.some((isValid) => !isValid)) return;

    upsertBudget.mutate({
      season_id: seasonId,
      total_target_revenue: target,
      target_labor_percentage: (labor || 30) / 100,
      avg_hourly_wage: wage,
      base_price_per_guest: price,
      season_price_factor: priceFactor || 1,
      status,
    });
  };

  if (isLoading) {
    return <div className="border-border bg-card h-64 animate-pulse rounded-2xl border p-6" />;
  }

  return (
    <div className="border-border bg-card rounded-2xl border p-6">
      <div className="mb-6 flex items-center gap-4">
        <h3 className="text-foreground text-lg font-bold">{t("yearWheel.budget_setup")}</h3>
        <div className="flex-1" />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as SeasonBudgetStatus)}
          className="border-input bg-background text-foreground focus:border-primary rounded-lg border px-3 py-1.5 text-xs font-bold tracking-wider uppercase outline-none"
        >
          {SEASON_BUDGET_STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className="border-border bg-muted text-muted-foreground mb-6 rounded-lg border px-3 py-2 text-xs">
        {t("yearWheel.budget_status_help")}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="text-muted-foreground mb-1.5 block text-[10px] font-bold tracking-wider uppercase">
            {t("yearWheel.total_revenue_target")} (NOK)
          </label>
          <input
            type="number"
            value={totalTarget}
            onChange={(e) => setTotalTarget(e.target.value)}
            placeholder={t("yearWheel.placeholder_revenue")}
            min={BUDGET_SETUP_LIMITS.totalTargetRevenue.min}
            max={BUDGET_SETUP_LIMITS.totalTargetRevenue.max}
            disabled={isLocked}
            className="border-input bg-background text-foreground focus:border-primary w-full rounded-lg border px-3 py-2.5 text-sm outline-none"
          />
          <p className="text-muted-foreground mt-1 text-xs">{t("yearWheel.budget_total_help")}</p>
        </div>

        <div>
          <label className="text-muted-foreground mb-1.5 block text-[10px] font-bold tracking-wider uppercase">
            {t("yearWheel.target_labor_label")}
          </label>
          <input
            type="number"
            value={laborPct}
            onChange={(e) => setLaborPct(e.target.value)}
            placeholder={t("yearWheel.placeholder_labor_pct")}
            min={BUDGET_SETUP_LIMITS.targetLaborPercentage.min}
            max={BUDGET_SETUP_LIMITS.targetLaborPercentage.max}
            disabled={isLocked}
            className="border-input bg-background text-foreground focus:border-primary w-full rounded-lg border px-3 py-2.5 text-sm outline-none"
          />
          <p className="text-muted-foreground mt-1 text-xs">{t("yearWheel.target_labor_help")}</p>
        </div>

        <div>
          <label className="text-muted-foreground mb-1.5 block text-[10px] font-bold tracking-wider uppercase">
            {t("yearWheel.avg_hourly_wage_label")}
          </label>
          <input
            type="number"
            value={hourlyWage}
            onChange={(e) => setHourlyWage(e.target.value)}
            placeholder={t("yearWheel.placeholder_wage")}
            min={BUDGET_SETUP_LIMITS.avgHourlyWage.min}
            max={BUDGET_SETUP_LIMITS.avgHourlyWage.max}
            disabled={isLocked}
            className="border-input bg-background text-foreground focus:border-primary w-full rounded-lg border px-3 py-2.5 text-sm outline-none"
          />
          <p className="text-muted-foreground mt-1 text-xs">
            {t("yearWheel.avg_hourly_wage_help")}
          </p>
        </div>

        <div>
          <label className="text-muted-foreground mb-1.5 block text-[10px] font-bold tracking-wider uppercase">
            {t("yearWheel.base_price_label")}
          </label>
          <input
            type="number"
            value={basePrice}
            onChange={(e) => setBasePrice(e.target.value)}
            placeholder={t("yearWheel.placeholder_price")}
            min={BUDGET_SETUP_LIMITS.basePricePerGuest.min}
            max={BUDGET_SETUP_LIMITS.basePricePerGuest.max}
            disabled={isLocked}
            className="border-input bg-background text-foreground focus:border-primary w-full rounded-lg border px-3 py-2.5 text-sm outline-none"
          />
          <p className="text-muted-foreground mt-1 text-xs">{t("yearWheel.base_price_help")}</p>
        </div>

        <div>
          <label className="text-muted-foreground mb-1.5 block text-[10px] font-bold tracking-wider uppercase">
            {t("yearWheel.season_price_factor_label")}
          </label>
          <input
            type="number"
            value={seasonPriceFactor}
            onChange={(e) => setSeasonPriceFactor(e.target.value)}
            placeholder={t("yearWheel.placeholder_factor")}
            step="0.1"
            min={BUDGET_SETUP_LIMITS.seasonPriceFactor.min}
            max={BUDGET_SETUP_LIMITS.seasonPriceFactor.max}
            disabled={isLocked}
            className="border-input bg-background text-foreground focus:border-primary w-full rounded-lg border px-3 py-2.5 text-sm outline-none"
          />
          <p className="text-muted-foreground mt-1 text-xs">
            {t("yearWheel.season_price_factor_help")}
          </p>
        </div>
      </div>

      <div className="mt-6 flex justify-end">
        <button
          onClick={handleSave}
          disabled={upsertBudget.isPending || !totalTarget}
          className="bg-primary text-primary-foreground rounded-lg px-4 py-2 text-sm font-bold transition-colors hover:opacity-90 disabled:opacity-50"
        >
          {upsertBudget.isPending ? t("yearWheel.saving") : t("yearWheel.save_budget")}
        </button>
      </div>
    </div>
  );
}
