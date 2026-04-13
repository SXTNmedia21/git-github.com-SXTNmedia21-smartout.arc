"use client";

import { useState, useEffect } from "react";
import { useTranslation } from "@smartout/i18n";
import { useSeasonBudget } from "../_hooks";
import {
  BUDGET_SETUP_LIMITS,
  SEASON_BUDGET_STATUS_OPTIONS,
  type SeasonBudgetStatus,
} from "../_definitions/season-planning";
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
      toast.error(`${label} må være mellom ${limits.min} og ${limits.max}`);
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
      toast.error(t("yearWheel.total_revenue_target") + " må være et positivt tall");
      return;
    }

    const validations = [
      validateNumberInRange("Total omsetningsmål", target, BUDGET_SETUP_LIMITS.totalTargetRevenue),
      validateNumberInRange("Mål lønnsandel", labor, BUDGET_SETUP_LIMITS.targetLaborPercentage),
      validateNumberInRange("Gj.snitt timeslønn", wage, BUDGET_SETUP_LIMITS.avgHourlyWage),
      validateNumberInRange("Snittpris per gjest", price, BUDGET_SETUP_LIMITS.basePricePerGuest),
      validateNumberInRange(
        "Sesong prisfaktor",
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
        Status styrer redigering: <strong>Draft/Active</strong> kan endres, <strong>Locked</strong>{" "}
        er skrivebeskyttet.
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
            placeholder="f.eks. 5000000"
            min={BUDGET_SETUP_LIMITS.totalTargetRevenue.min}
            max={BUDGET_SETUP_LIMITS.totalTargetRevenue.max}
            disabled={isLocked}
            className="border-input bg-background text-foreground focus:border-primary w-full rounded-lg border px-3 py-2.5 text-sm outline-none"
          />
          <p className="text-muted-foreground mt-1 text-xs">Totalt for hele sesongen</p>
        </div>

        <div>
          <label className="text-muted-foreground mb-1.5 block text-[10px] font-bold tracking-wider uppercase">
            Mål lønnsandel (%)
          </label>
          <input
            type="number"
            value={laborPct}
            onChange={(e) => setLaborPct(e.target.value)}
            placeholder="30"
            min={BUDGET_SETUP_LIMITS.targetLaborPercentage.min}
            max={BUDGET_SETUP_LIMITS.targetLaborPercentage.max}
            disabled={isLocked}
            className="border-input bg-background text-foreground focus:border-primary w-full rounded-lg border px-3 py-2.5 text-sm outline-none"
          />
          <p className="text-muted-foreground mt-1 text-xs">
            Andel av omsetning til lønn (typisk 25-35%)
          </p>
        </div>

        <div>
          <label className="text-muted-foreground mb-1.5 block text-[10px] font-bold tracking-wider uppercase">
            Gj.snitt timeslønn (NOK)
          </label>
          <input
            type="number"
            value={hourlyWage}
            onChange={(e) => setHourlyWage(e.target.value)}
            placeholder="f.eks. 220"
            min={BUDGET_SETUP_LIMITS.avgHourlyWage.min}
            max={BUDGET_SETUP_LIMITS.avgHourlyWage.max}
            disabled={isLocked}
            className="border-input bg-background text-foreground focus:border-primary w-full rounded-lg border px-3 py-2.5 text-sm outline-none"
          />
          <p className="text-muted-foreground mt-1 text-xs">Brukes til bemanningsberegning</p>
        </div>

        <div>
          <label className="text-muted-foreground mb-1.5 block text-[10px] font-bold tracking-wider uppercase">
            Snittpris per gjest (NOK)
          </label>
          <input
            type="number"
            value={basePrice}
            onChange={(e) => setBasePrice(e.target.value)}
            placeholder="f.eks. 450"
            min={BUDGET_SETUP_LIMITS.basePricePerGuest.min}
            max={BUDGET_SETUP_LIMITS.basePricePerGuest.max}
            disabled={isLocked}
            className="border-input bg-background text-foreground focus:border-primary w-full rounded-lg border px-3 py-2.5 text-sm outline-none"
          />
          <p className="text-muted-foreground mt-1 text-xs">Gjennomsnittlig kuvert uten drikke</p>
        </div>

        <div>
          <label className="text-muted-foreground mb-1.5 block text-[10px] font-bold tracking-wider uppercase">
            Sesong prisfaktor
          </label>
          <input
            type="number"
            value={seasonPriceFactor}
            onChange={(e) => setSeasonPriceFactor(e.target.value)}
            placeholder="1.0"
            step="0.1"
            min={BUDGET_SETUP_LIMITS.seasonPriceFactor.min}
            max={BUDGET_SETUP_LIMITS.seasonPriceFactor.max}
            disabled={isLocked}
            className="border-input bg-background text-foreground focus:border-primary w-full rounded-lg border px-3 py-2.5 text-sm outline-none"
          />
          <p className="text-muted-foreground mt-1 text-xs">
            Multipliserer snittpris per gjest i sesongen
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
