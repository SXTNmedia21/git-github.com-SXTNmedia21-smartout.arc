"use client";

import { useState, useEffect, useMemo } from "react";
import { useTranslation } from "@smartout/i18n";
import { useHourFactors, DEFAULT_HOUR_FACTORS } from "../_hooks";
import { useOperatingHours } from "../../settings/_hooks/use-operating-hours";
import {
  BUDGET_SETUP_LIMITS,
  getHourFactorTemplate,
  type HourFactorTemplateId,
} from "../_definitions/season-planning";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { useWorkspaceOptional } from "@/lib/workspace-context";
import { createClient } from "@smartout/supabase/client";

function parseTimeToHour(time: string): number {
  return parseInt(time.split(":")[0] ?? "0", 10);
}

type Props = {
  seasonBudgetId: string;
  isReadOnly?: boolean;
};

export function HourFactorsTab({ seasonBudgetId, isReadOnly = false }: Props) {
  const { t } = useTranslation("dashboard");
  const ctx = useWorkspaceOptional();
  const wsId = ctx?.workspace.workspace_id;
  const supabase = createClient();

  const { data: departments } = useQuery({
    queryKey: ["departments", wsId],
    queryFn: async () => {
      const { data } = await supabase
        .from("department")
        .select("department_id, name")
        .eq("workspace_id", wsId!)
        .eq("is_active", true)
        .order("sort_order", { ascending: true });
      return data ?? [];
    },
    enabled: !!wsId,
  });

  const firstDeptId = departments?.[0]?.department_id;

  const {
    hourFactors,
    isLoading: loadingFactors,
    saveHourFactors,
  } = useHourFactors(seasonBudgetId);
  const { hours: operatingHours, isLoading: loadingHours } = useOperatingHours(firstDeptId);

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
      toast.error(t("yearWheel.budget_locked"));
      return;
    }
    saveHourFactors.mutate(factors);
  };

  /**
   * Applies a predefined hourly distribution template.
   */
  const applyTemplate = (template: HourFactorTemplateId) => {
    if (isReadOnly) {
      toast.error(t("yearWheel.budget_locked"));
      return;
    }
    setFactors(getHourFactorTemplate(template, openHour, closeHour));
  };

  const isLoading = loadingFactors || loadingHours;

  if (isLoading) {
    return <div className="border-border bg-card h-64 animate-pulse rounded-2xl border p-6" />;
  }

  return (
    <div className="border-border bg-card rounded-2xl border p-6">
      <h3 className="text-foreground mb-2 text-lg font-bold">{t("yearWheel.hour_factors")}</h3>
      <p className="text-muted-foreground mb-6 text-sm">
        {t("yearWheel.hour_factors_help", { open: openHour, close: closeHour })}
      </p>

      <div className="mb-6 flex gap-2">
        {(["restaurant", "dinner_peak", "flat"] as const).map((template) => (
          <button
            key={template}
            onClick={() => applyTemplate(template)}
            disabled={isReadOnly}
            className="border-border text-muted-foreground hover:bg-accent hover:text-accent-foreground rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors"
          >
            {template === "restaurant"
              ? t("yearWheel.template_restaurant")
              : template === "dinner_peak"
                ? t("yearWheel.template_dinner_peak")
                : t("yearWheel.template_flat")}
          </button>
        ))}
      </div>

      <div className="grid gap-x-8 gap-y-2 sm:grid-cols-2">
        {factors.map((f) => {
          const barWidth = (f.factor / maxFactor) * 100;
          const isPeak = f.factor >= maxFactor * 0.8;
          const barColor = isPeak ? "bg-chart-2/30" : "bg-chart-1/20";
          const textColor = isPeak ? "text-chart-2" : "text-chart-1";

          return (
            <div key={f.hour} className="flex items-center gap-3">
              <span className="text-muted-foreground w-12 text-right font-mono text-sm">
                {String(f.hour).padStart(2, "0")}:00
              </span>
              <div className="flex-1">
                <div className="bg-muted h-7 rounded-md">
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
                className="border-input bg-background text-foreground focus:border-primary w-16 rounded-lg border px-2 py-1 text-center text-sm font-medium outline-none"
              />
            </div>
          );
        })}
      </div>

      <div className="mt-6 flex justify-end">
        <button
          onClick={handleSave}
          disabled={saveHourFactors.isPending || isReadOnly}
          className="bg-primary text-primary-foreground rounded-lg px-4 py-2 text-sm font-bold transition-colors hover:opacity-90 disabled:opacity-50"
        >
          {saveHourFactors.isPending ? t("yearWheel.saving") : t("yearWheel.save_hour_factors")}
        </button>
      </div>
    </div>
  );
}
