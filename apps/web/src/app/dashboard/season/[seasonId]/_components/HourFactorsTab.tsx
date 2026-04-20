"use client";

import { useState, useEffect, useMemo } from "react";
import { useTranslation } from "@smartout/i18n";
import { useHourFactors, DEFAULT_HOUR_FACTORS } from "@/app/dashboard/year-wheel/_hooks";
import { useOperatingHours } from "@/app/dashboard/settings/_hooks/use-operating-hours";
import {
  BUDGET_SETUP_LIMITS,
  getHourFactorTemplate,
  type HourFactorTemplateId,
} from "@/app/dashboard/year-wheel/_definitions/season-planning";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { useWorkspaceOptional } from "@/lib/workspace-context";
import { createClient } from "@smartout/supabase/client";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

function parseTimeToHour(time: string): number {
  return parseInt(time.split(":")[0] ?? "0", 10);
}

type Props = {
  seasonBudgetId: string;
  isReadOnly?: boolean;
};

/**
 * Inline editor cell: the bar itself is the PopoverTrigger.
 * Replaces the old prototype's `prompt()` (a Nordic violation per spec §8.2).
 * Commit on Enter, cancel on Esc. Bar-fill uses `--brand-orange` mixed with
 * `--muted` so dark-mode doesn't render muddy brown-grey (spec §8.2).
 */
function HourFactorCell({
  hour,
  value,
  maxFactor,
  minLimit,
  maxLimit,
  disabled,
  onCommit,
  label,
  cancelLabel,
  saveLabel,
}: {
  hour: number;
  value: number;
  maxFactor: number;
  minLimit: number;
  maxLimit: number;
  disabled: boolean;
  onCommit: (next: number) => void;
  label: string;
  cancelLabel: string;
  saveLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<number>(value);

  // Keep the draft in sync if the parent value changes (e.g. template applied).
  useEffect(() => {
    setDraft(value);
  }, [value]);

  const commit = () => {
    // Clamp to the allowed factor range (spec limits). NaN collapses to current value.
    const clamped = Math.min(maxLimit, Math.max(minLimit, Number.isFinite(draft) ? draft : value));
    onCommit(clamped);
    setOpen(false);
  };

  const cancel = () => {
    setDraft(value);
    setOpen(false);
  };

  const barWidth = Math.min(100, (value / maxFactor) * 100);
  const intensity = Math.min(100, Math.max(20, (value / maxFactor) * 100));
  // Bar-fill recipe per spec §8.2: warm --brand-orange mixed against --muted
  // (NOT --border — border reads as muddy brown-grey in dark mode).
  const barFill = `color-mix(in oklab, var(--brand-orange) ${intensity.toFixed(0)}%, var(--muted))`;

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        if (disabled) return;
        setOpen(next);
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          aria-label={label}
          className="focus-visible:ring-ring bg-muted flex h-7 w-full items-center rounded-md transition-opacity outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <div
            className="flex h-full items-center rounded-md px-2 transition-all"
            style={{ width: `${barWidth}%`, background: barFill }}
          >
            <span className="text-foreground text-xs font-bold tabular-nums">
              {value.toFixed(1)}
            </span>
          </div>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-60" align="start">
        <label className="text-muted-foreground text-xs" htmlFor={`hf-${hour}`}>
          {label}
        </label>
        <Input
          id={`hf-${hour}`}
          type="number"
          step="0.1"
          min={minLimit}
          max={maxLimit}
          value={Number.isFinite(draft) ? draft : ""}
          onChange={(e) => {
            const parsed = parseFloat(e.target.value);
            setDraft(Number.isFinite(parsed) ? parsed : 0);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commit();
            }
            if (e.key === "Escape") {
              e.preventDefault();
              cancel();
            }
          }}
          autoFocus
          className="mt-1"
        />
        <div className="mt-2 flex justify-end gap-2">
          <Button size="sm" variant="ghost" onClick={cancel}>
            {cancelLabel}
          </Button>
          <Button size="sm" onClick={commit}>
            {saveLabel}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

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

  const commitFactor = (hour: number, next: number) => {
    setFactors((prev) => prev.map((f) => (f.hour === hour ? { ...f, factor: next } : f)));
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
        {t("yearWheel.hour_factors_help", { openHour, closeHour })}
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
        {factors.map((f) => (
          <div key={f.hour} className="flex items-center gap-3">
            <span className="text-muted-foreground w-12 text-right font-mono text-sm">
              {String(f.hour).padStart(2, "0")}:00
            </span>
            <div className="flex-1">
              <HourFactorCell
                hour={f.hour}
                value={f.factor}
                maxFactor={maxFactor}
                minLimit={BUDGET_SETUP_LIMITS.hourFactor.min}
                maxLimit={BUDGET_SETUP_LIMITS.hourFactor.max}
                disabled={isReadOnly}
                onCommit={(next) => commitFactor(f.hour, next)}
                label={`Faktor kl ${String(f.hour).padStart(2, "0")}:00`}
                cancelLabel={t("yearWheel.cancel")}
                saveLabel={t("yearWheel.save")}
              />
            </div>
          </div>
        ))}
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
