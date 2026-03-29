"use client";

// StaffingCoverageBar — compact 7-day shift fill-rate chart.
// Each vertical bar represents one day; height is proportional to fill percentage.
// Clicking a bar opens a popover with a plain-language summary of unassigned shifts.

import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { RefreshCw } from "lucide-react";
import { useTranslation } from "@smartout/i18n";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { useStaffingCoverage, getCurrentWeekStart } from "@/app/dashboard/_hooks";

// Ambient spring — Nordic Split spec
const AMBIENT_SPRING = {
  type: "spring" as const,
  stiffness: 40,
  damping: 22,
  mass: 2.2,
};

// Maximum bar height in pixels
const BAR_MAX_PX = 80;

// Bar width fixed at 8px per spec
const BAR_WIDTH = "w-2";

/** Maps fill percent to a Tailwind background color class. */
function barColor(fillPercent: number): string {
  if (fillPercent >= 80) return "bg-emerald-500";
  if (fillPercent >= 60) return "bg-amber-500";
  return "bg-red-500";
}

type BarPopoverProps = {
  date: string;
  dayLabel: string;
  totalShifts: number;
  assignedShifts: number;
  fillPercent: number;
  children: React.ReactNode;
};

/** Single bar with click-to-popover showing unfilled shift summary. */
function BarPopover({
  date,
  dayLabel,
  totalShifts,
  assignedShifts,
  fillPercent,
  children,
}: BarPopoverProps) {
  const [open, setOpen] = useState(false);

  const unassigned = totalShifts - assignedShifts;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`${dayLabel}: ${fillPercent}% bemannet`}
          className="flex flex-col items-center gap-1 focus:outline-none"
        >
          {children}
        </button>
      </PopoverTrigger>
      <PopoverContent align="center" className="w-44 p-3 text-xs">
        <p className="font-semibold">{date}</p>
        <p className="text-muted-foreground mt-1">
          {assignedShifts} av {totalShifts} vakter bemannet
        </p>
        {unassigned > 0 && (
          <p className="text-destructive mt-0.5">
            {unassigned} {unassigned === 1 ? "vakt mangler" : "vakter mangler"} bemanning
          </p>
        )}
      </PopoverContent>
    </Popover>
  );
}

/**
 * StaffingCoverageBar — 7-day fill-rate overview in a compact bar chart.
 *
 * Why: Managers need an instant visual scan of upcoming staffing gaps without
 * opening the full schedule view. Color coding makes critical days obvious.
 */
export function StaffingCoverageBar() {
  const { t } = useTranslation("dashboard");
  const weekStart = getCurrentWeekStart();
  const { data, isLoading, isError, refetch } = useStaffingCoverage(weekStart);
  const prefersReduced = useReducedMotion();

  // ── Error state ────────────────────────────────────────────────────────────
  if (isError) {
    return (
      <div className="space-y-2">
        <p className="text-muted-foreground text-xs font-medium">
          {t("interactive.coverage_title")}
        </p>
        <div className="flex flex-col items-start gap-1">
          <p className="text-muted-foreground text-xs">{t("interactive.coverage_error")}</p>
          <button
            type="button"
            onClick={() => void refetch()}
            className="text-primary flex items-center gap-1.5 text-xs"
          >
            <RefreshCw className="h-3 w-3" />
            {t("interactive.feed_reconnect")}
          </button>
        </div>
      </div>
    );
  }

  const days = data ?? [];
  const hasData = days.some((d) => d.totalShifts > 0);

  return (
    <div className="space-y-2">
      {/* Title */}
      <p className="text-muted-foreground text-xs font-medium">{t("interactive.coverage_title")}</p>

      {/* Bar row */}
      <div className="flex items-end gap-2">
        {isLoading
          ? // Loading skeleton — 7 gray bars
            Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="flex flex-col items-center gap-1">
                <div
                  className="bg-muted w-2 animate-pulse rounded-sm"
                  style={{ height: `${BAR_MAX_PX * 0.5}px` }}
                />
                <span className="text-muted-foreground w-7 text-center text-[10px]">—</span>
              </div>
            ))
          : days.map((day) => {
              const barHeight = hasData
                ? Math.max(4, Math.round((day.fillPercent / 100) * BAR_MAX_PX))
                : BAR_MAX_PX * 0.2; // flat empty bars when no shift data

              const color = hasData ? barColor(day.fillPercent) : "bg-muted";

              return (
                <BarPopover
                  key={day.date}
                  date={day.date}
                  dayLabel={day.dayLabel}
                  totalShifts={day.totalShifts}
                  assignedShifts={day.assignedShifts}
                  fillPercent={day.fillPercent}
                >
                  {/* Animated bar — instant when reduced motion is preferred */}
                  <motion.div
                    className={`${BAR_WIDTH} rounded-sm ${color}`}
                    initial={prefersReduced ? false : { height: 0 }}
                    animate={{
                      height: barHeight,
                      transition: prefersReduced ? { duration: 0 } : AMBIENT_SPRING,
                    }}
                    aria-hidden="true"
                  />

                  {/* Day label */}
                  <span className="text-muted-foreground w-7 text-center text-[10px]">
                    {day.dayLabel.slice(0, 3)}
                  </span>

                  {/* Fill percentage */}
                  <span
                    className={`w-7 text-center text-[10px] tabular-nums ${
                      hasData && day.fillPercent < 80
                        ? "text-destructive font-medium"
                        : "text-muted-foreground"
                    }`}
                  >
                    {hasData ? `${day.fillPercent}%` : "—"}
                  </span>
                </BarPopover>
              );
            })}
      </div>

      {/* No-data empty state */}
      {!isLoading && !hasData && (
        <p className="text-muted-foreground text-xs">{t("interactive.no_shift_data")}</p>
      )}
    </div>
  );
}
