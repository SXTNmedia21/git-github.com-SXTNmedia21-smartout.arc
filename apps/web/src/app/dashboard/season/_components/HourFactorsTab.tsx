"use client";

import { useState, useEffect, useMemo } from "react";
import { useHourFactors, DEFAULT_HOUR_FACTORS } from "../_hooks";
import { useOperatingHours } from "../../settings/_hooks/use-operating-hours";
import {
  BUDGET_SETUP_LIMITS,
  getHourFactorTemplate,
  type HourFactorTemplateId,
} from "../_definitions/season-planning";
import { toast } from "sonner";

function parseTimeToHour(time: string): number {
  return parseInt(time.split(":")[0] ?? "0", 10);
}

type Props = {
  seasonBudgetId: string;
  isDark: boolean;
  isReadOnly?: boolean;
};

export function HourFactorsTab({ seasonBudgetId, isDark, isReadOnly = false }: Props) {
  const {
    hourFactors,
    isLoading: loadingFactors,
    saveHourFactors,
  } = useHourFactors(seasonBudgetId);
  const { hours: operatingHours, isLoading: loadingHours } = useOperatingHours();

  // Derive open hours range from operating_hours table
  const { openHour, closeHour } = useMemo(() => {
    if (operatingHours.length === 0) {
      return { openHour: 10, closeHour: 22 }; // default
    }
    const openTimes = operatingHours.filter((oh) => !oh.is_closed);
    if (openTimes.length === 0) return { openHour: 10, closeHour: 22 };

    const opens = openTimes.map((oh) => parseTimeToHour(oh.open_time));
    const closes = openTimes.map((oh) => parseTimeToHour(oh.close_time));
    return {
      openHour: Math.min(...opens),
      closeHour: Math.max(...closes),
    };
  }, [operatingHours]);

  // Generate hour slots for the open range
  const hourSlots = useMemo(() => {
    const slots: number[] = [];
    for (let h = openHour; h < closeHour; h++) {
      slots.push(h);
    }
    return slots;
  }, [openHour, closeHour]);

  const [factors, setFactors] = useState<{ hour: number; factor: number }[]>([]);

  // Initialize factors from loaded data or defaults
  useEffect(() => {
    if (hourFactors.length > 0) {
      setFactors(hourFactors.map((hf) => ({ hour: hf.hour, factor: hf.factor })));
    } else {
      // Seed from defaults, filtered to open hours
      setFactors(
        hourSlots.map((h) => {
          const def = DEFAULT_HOUR_FACTORS.find((d) => d.hour === h);
          return { hour: h, factor: def?.factor ?? 1.0 };
        }),
      );
    }
  }, [hourFactors, hourSlots]);

  const maxFactor = useMemo(() => Math.max(...factors.map((f) => f.factor), 1), [factors]);

  const updateFactor = (hour: number, value: string) => {
    const num = parseFloat(value);
    if (isNaN(num) || num <= 0) return;
    if (num < BUDGET_SETUP_LIMITS.hourFactor.min || num > BUDGET_SETUP_LIMITS.hourFactor.max)
      return;
    setFactors((prev) => prev.map((f) => (f.hour === hour ? { ...f, factor: num } : f)));
  };

  const handleSave = () => {
    if (isReadOnly) {
      toast.error("Budsjettet er låst. Sett status til Draft eller Active for å redigere.");
      return;
    }
    saveHourFactors.mutate(factors);
  };

  /**
   * Applies a predefined hourly distribution template.
   */
  const applyTemplate = (template: HourFactorTemplateId) => {
    if (isReadOnly) {
      toast.error("Budsjettet er låst. Sett status til Draft eller Active for å redigere.");
      return;
    }
    setFactors(getHourFactorTemplate(template, openHour, closeHour));
  };

  const cardClass = isDark
    ? "rounded-2xl border border-zinc-800 bg-[#0c0c0e] p-6"
    : "rounded-2xl border border-zinc-200 bg-white p-6";

  const isLoading = loadingFactors || loadingHours;

  if (isLoading) {
    return <div className={`${cardClass} h-64 animate-pulse`} />;
  }

  return (
    <div className={cardClass}>
      <h3 className={`mb-2 text-lg font-bold ${isDark ? "text-white" : "text-zinc-900"}`}>
        Timefaktorer
      </h3>
      <p className={`mb-6 text-sm ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>
        Fordeling av daglig omsetning per time ({openHour}:00&ndash;{closeHour}:00). Høyere faktor =
        mer omsetning forventet den timen.
      </p>

      <div className="mb-6 flex gap-2">
        {(["restaurant", "dinner_peak", "flat"] as const).map((template) => (
          <button
            key={template}
            onClick={() => applyTemplate(template)}
            disabled={isReadOnly}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              isDark
                ? "border border-zinc-700 text-zinc-400 hover:bg-zinc-800 hover:text-white"
                : "border border-zinc-300 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
            }`}
          >
            {template === "restaurant"
              ? "Restaurant"
              : template === "dinner_peak"
                ? "Middagstopp"
                : "Flat"}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {factors.map((f) => {
          const barWidth = (f.factor / maxFactor) * 100;
          const isPeak = f.factor >= maxFactor * 0.8;
          const barColor = isPeak ? "bg-emerald-600/30" : "bg-blue-600/20";
          const textColor = isPeak ? "text-emerald-400" : "text-blue-400";

          return (
            <div key={f.hour} className="flex items-center gap-3">
              <span
                className={`w-14 text-right font-mono text-sm ${isDark ? "text-zinc-500" : "text-zinc-400"}`}
              >
                {String(f.hour).padStart(2, "0")}:00
              </span>
              <div className="flex-1">
                <div className={`h-7 rounded-md ${isDark ? "bg-zinc-900" : "bg-zinc-100"}`}>
                  <div
                    className={`flex h-full items-center rounded-md px-2 transition-all ${barColor}`}
                    style={{ width: `${barWidth}%` }}
                  >
                    <span className={`text-xs font-bold ${textColor}`}>{f.factor.toFixed(1)}</span>
                  </div>
                </div>
              </div>
              <input
                type="number"
                value={f.factor}
                onChange={(e) => updateFactor(f.hour, e.target.value)}
                step="0.1"
                min={BUDGET_SETUP_LIMITS.hourFactor.min}
                max={BUDGET_SETUP_LIMITS.hourFactor.max}
                disabled={isReadOnly}
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
          disabled={saveHourFactors.isPending || isReadOnly}
          className="rounded-xl bg-blue-600 px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-blue-500 disabled:opacity-50"
        >
          {saveHourFactors.isPending ? "Lagrer..." : "Lagre timefaktorer"}
        </button>
      </div>
    </div>
  );
}
