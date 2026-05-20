"use client";

import React from "react";
import { Clock, ListTodo } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { DensityStrip, type ScheduleDensityTier } from "./density-strip";
import { formatTimeShort, formatTimeFull } from "../_utils/format-time";
import { SHIFT_INDICATOR_STYLES, type ShiftIndicator } from "./shift-indicator-styles";
export { SHIFT_INDICATOR_STYLES } from "./shift-indicator-styles";

type OpenShiftCardViewProps = {
  isDark: boolean;
  isDragging: boolean;
  title: string;
  time: string;
};

export const OpenShiftCardView = React.memo(function OpenShiftCardView({
  isDark: _isDark,
  isDragging,
  title,
  time,
}: OpenShiftCardViewProps) {
  return (
    <div
      className={`group cursor-grab rounded-xl border border-dashed border-amber-500/40 bg-amber-500/5 p-3 shadow-sm transition-[opacity,transform,background-color,border-color] duration-200 ease-out will-change-transform hover:border-amber-500/60 hover:bg-amber-500/10 active:cursor-grabbing ${isDragging ? "scale-[0.98] opacity-35" : "scale-100 opacity-100"}`}
    >
      <h4 className="text-foreground group-hover:text-foreground/70 mb-1 text-sm font-bold transition-colors">
        {title}
      </h4>
      <div className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium">
        <Clock className="h-3 w-3" />
        {time}
      </div>
    </div>
  );
});

type ShiftStatus = "draft" | "published" | "active" | "completed";

type ShiftCardViewProps = {
  isDark: boolean;
  isDragging: boolean;
  role: string;
  time: string;
  status: string;
  indicator: string;
  zone?: string;
  isCompact?: boolean;
  confirmedAt?: string;
  /** When true, the DensityStrip rail switches to bg-destructive (C2 conflict signal). */
  hasConflict?: boolean;
  /** Density tier used to determine strip width. Defaults to "default". */
  tier?: ScheduleDensityTier;
  /** Raw start time (HH:mm) — used by compact DensityStrip + formatTimeShort. */
  startTime?: string;
  /** Raw end time (HH:mm) — used by compact DensityStrip + formatTimeShort. */
  endTime?: string;
  /** Number of shifts in the same cell — when >1 the default tier renders denser. */
  cellShiftCount?: number;
  /** Punch-in timestamp (ISO) — shown in tooltip when shift is active/completed. */
  punchInAt?: string | null;
  /** Punch-out timestamp (ISO) — shown in tooltip when shift is clocked-out. */
  punchOutAt?: string | null;
  /** Employee name — shown in tooltip header. Null/empty when open shift. */
  employeeName?: string;
  /** Total scheduled hours for this shift — shown alongside time in tooltip. */
  workHours?: number;
};

const SHIFT_STATUS_STYLES: Record<ShiftStatus, string> = {
  draft:
    "border-dashed border-orange-500/30 bg-orange-500/5 dark:border-orange-500/20 dark:bg-orange-500/[0.03]",
  published: "border-border bg-card shadow-sm hover:border-foreground/20",
  active:
    "border-emerald-500/40 bg-emerald-500/10 shadow-[0_0_15px_rgba(16,185,129,0.1)] dark:bg-emerald-500/5",
  completed: "border-border/50 bg-muted/30 opacity-60 dark:bg-transparent",
};

function normalizeShiftStatus(status: string): ShiftStatus {
  if (
    status === "draft" ||
    status === "published" ||
    status === "active" ||
    status === "completed"
  ) {
    return status;
  }
  return "published";
}

function formatWorkHours(h: number): string {
  if (Number.isInteger(h)) return `${h} t`;
  return `${h.toFixed(1).replace(".", ",")} t`;
}

function formatPunchTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString("nb-NO", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return iso;
  }
}

function normalizeShiftIndicator(indicator: string): ShiftIndicator {
  if (
    indicator === "blue" ||
    indicator === "emerald" ||
    indicator === "purple" ||
    indicator === "orange"
  ) {
    return indicator;
  }
  return "orange";
}

export const ShiftCardView = React.memo(function ShiftCardView({
  isDark: _isDark,
  isDragging,
  role,
  time,
  status,
  indicator,
  zone,
  isCompact,
  confirmedAt,
  hasConflict = false,
  tier,
  startTime,
  endTime,
  cellShiftCount = 1,
  punchInAt,
  punchOutAt,
  employeeName,
  workHours,
}: ShiftCardViewProps) {
  const normalizedStatus = normalizeShiftStatus(status);
  const normalizedIndicator = normalizeShiftIndicator(indicator);
  const isPublishedOrLater = normalizedStatus === "published" || normalizedStatus === "active";

  // Derive effective tier — isCompact + tier from parent. Compact density → "compact" strip width.
  const effectiveTier: ScheduleDensityTier = tier ?? (isCompact ? "compact" : "default");

  // Compact time display — use formatTimeShort when startTime/endTime available
  const compactTime = startTime && endTime ? formatTimeShort(startTime, endTime) : time;
  const fullTime = startTime && endTime ? formatTimeFull(startTime, endTime) : time;

  if (isCompact) {
    return (
      <div
        className={`group hover:bg-muted relative flex cursor-grab items-center gap-2 rounded-md border px-2 py-1 transition-[opacity,transform,background-color,border-color] duration-200 ease-out select-none active:cursor-grabbing ${SHIFT_STATUS_STYLES[normalizedStatus]} overflow-hidden will-change-transform ${isDragging ? "scale-[0.98] opacity-35" : "scale-100 opacity-100"}`}
        data-testid="schedule-shift-card"
      >
        <DensityStrip
          indicator={normalizedIndicator}
          hasConflict={hasConflict}
          tier={effectiveTier}
        />
        <span className="text-foreground truncate pl-1 text-[11px] leading-tight font-semibold">
          {role}
        </span>
        <div className="ml-auto flex shrink-0 items-center gap-1">
          {isPublishedOrLater && (
            <div
              className={`h-1.5 w-1.5 rounded-full ${confirmedAt ? "bg-emerald-400" : "bg-amber-400"}`}
              title={confirmedAt ? "Bekreftet" : "Venter på bekreftelse"}
            />
          )}
          <span className="text-muted-foreground text-[10px] font-medium" title={fullTime}>
            {compactTime}
          </span>
        </div>
      </div>
    );
  }

  // Status dot color — replaces former ShiftStatusIcon 5x5 box.
  // draft = amber/dashed (card bg already signals), published+unconfirmed = amber,
  // published+confirmed = emerald, active = emerald, completed = muted.
  const statusDotClass =
    normalizedStatus === "completed"
      ? "bg-muted-foreground/30"
      : normalizedStatus === "active"
        ? "bg-emerald-400"
        : confirmedAt
          ? "bg-emerald-400"
          : "bg-amber-400";
  const statusLabel =
    normalizedStatus === "draft"
      ? "Utkast"
      : normalizedStatus === "completed"
        ? "Fullført"
        : normalizedStatus === "active"
          ? "Pågående"
          : confirmedAt
            ? "Bekreftet"
            : "Venter på bekreftelse";

  // When 2+ shifts share a cell, drop the optional zone row + tighten padding.
  // This keeps both cards visible in a 100px row without clipping.
  const isDense = cellShiftCount > 1;
  const showZoneRow = !isDense && Boolean(zone);

  return (
    <TooltipProvider delayDuration={400}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(
              "group hover:bg-muted relative flex cursor-grab flex-col justify-center gap-0.5 rounded-lg border transition-[opacity,transform,background-color,border-color] duration-200 ease-out select-none active:cursor-grabbing",
              isDense ? "px-2 py-1" : "px-2.5 py-1.5",
              SHIFT_STATUS_STYLES[normalizedStatus],
              "overflow-hidden will-change-transform",
              isDragging ? "scale-[0.98] opacity-35" : "scale-100 opacity-100",
            )}
            data-testid="schedule-shift-card"
          >
            <DensityStrip
              indicator={normalizedIndicator}
              hasConflict={hasConflict}
              tier={effectiveTier}
            />

            <div className="relative z-10 flex items-baseline gap-2 pl-1.5">
              <span className="text-foreground group-hover:text-foreground/70 line-clamp-1 min-w-0 flex-1 truncate text-sm leading-tight font-semibold transition-colors">
                {role}
              </span>
              <span className="text-muted-foreground shrink-0 text-[11px] font-medium tabular-nums">
                {compactTime}
              </span>
              <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", statusDotClass)} />
            </div>

            {showZoneRow ? (
              <span className="text-muted-foreground line-clamp-1 truncate pl-1.5 text-[11px] leading-tight">
                {zone}
              </span>
            ) : null}
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" align="start" className="max-w-xs">
          <div className="flex flex-col gap-1">
            <div className="text-sm font-bold">{role}</div>
            {employeeName ? (
              <div className="text-[11px] opacity-80">{employeeName}</div>
            ) : (
              <div className="text-[11px] italic opacity-70">Åpen vakt</div>
            )}
            <div className="flex items-center gap-2 text-[11px] tabular-nums opacity-80">
              <span>{fullTime}</span>
              {typeof workHours === "number" && workHours > 0 ? (
                <>
                  <span className="opacity-50">·</span>
                  <span>{formatWorkHours(workHours)}</span>
                </>
              ) : null}
            </div>
            {zone ? <div className="text-[11px] opacity-80">{zone}</div> : null}
            <div className="mt-0.5 flex items-center gap-1.5 text-[11px]">
              <span className={cn("h-1.5 w-1.5 rounded-full", statusDotClass)} />
              <span>{statusLabel}</span>
            </div>
            {punchInAt ? (
              <div className="border-primary-foreground/15 mt-1 border-t pt-1 text-[11px] tabular-nums opacity-80">
                <div>Stempla inn {formatPunchTime(punchInAt)}</div>
                {punchOutAt ? <div>Stempla ut {formatPunchTime(punchOutAt)}</div> : null}
              </div>
            ) : null}
            {hasConflict ? (
              <div className="text-destructive-foreground bg-destructive/90 -mx-3 mt-1.5 -mb-1.5 px-3 py-1 text-[10px] font-bold">
                ⚠ Overlappende vakt samme dag
              </div>
            ) : null}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
});

type TemplateCardViewProps = {
  isDark: boolean;
  isDragging: boolean;
  title: string;
  hours: string;
  routines: number;
};

export const TemplateCardView = React.memo(function TemplateCardView({
  isDark: _isDark,
  isDragging,
  title,
  hours,
  routines,
}: TemplateCardViewProps) {
  return (
    <div
      className={`group border-border bg-background cursor-grab rounded-xl border border-dashed p-3 shadow-sm transition-[opacity,transform,background-color,border-color] duration-200 ease-out will-change-transform hover:border-orange-500/50 hover:bg-orange-500/5 active:cursor-grabbing ${isDragging ? "scale-[0.98] opacity-35" : "scale-100 opacity-100"}`}
    >
      <div className="mb-1.5 flex items-start justify-between">
        <h4 className="text-foreground text-xs font-bold transition-colors group-hover:text-orange-400">
          {title}
        </h4>
        <span className="rounded bg-orange-500/10 px-1.5 py-0.5 text-[8px] leading-none font-black tracking-widest text-orange-400 uppercase">
          Mal
        </span>
      </div>
      <div className="text-muted-foreground flex items-center justify-between text-[10px] font-medium">
        <div className="flex items-center gap-1">
          <Clock className="h-3 w-3" /> {hours}
        </div>
        <div
          className="flex items-center gap-1"
          title={`${routines} faste rutiner knyttet til vakt`}
        >
          <ListTodo className="h-3 w-3 text-emerald-500/70" /> {routines} rutiner
        </div>
      </div>
    </div>
  );
});
