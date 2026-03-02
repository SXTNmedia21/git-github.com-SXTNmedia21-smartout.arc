"use client";

import React from "react";
import {
  AlertCircle,
  Circle,
  Clock,
  ListTodo,
  MapPin,
  PlayCircle,
  CheckCircle2,
} from "lucide-react";

type OpenShiftCardViewProps = {
  isDark: boolean;
  isDragging: boolean;
  title: string;
  time: string;
};

export const OpenShiftCardView = React.memo(function OpenShiftCardView({
  isDark,
  isDragging,
  title,
  time,
}: OpenShiftCardViewProps) {
  return (
    <div
      className={`p-3 ${isDark ? "bg-amber-500/[0.03]" : "bg-white"} group cursor-grab rounded-xl border border-dashed border-amber-500/25 shadow-sm transition-[opacity,transform,background-color,border-color] duration-200 ease-out will-change-transform hover:border-amber-500/40 hover:bg-amber-500/[0.06] active:cursor-grabbing ${isDragging ? "scale-[0.98] opacity-35" : "scale-100 opacity-100"}`}
    >
      <h4
        className={`text-sm font-bold ${isDark ? "text-white" : "text-zinc-900"} mb-1 transition-colors group-hover:text-zinc-300`}
      >
        {title}
      </h4>
      <div className="flex items-center gap-1.5 text-xs font-medium text-zinc-500">
        <Clock className="h-3 w-3" />
        {time}
      </div>
    </div>
  );
});

type ShiftStatus = "draft" | "published" | "active" | "completed";
type ShiftIndicator = "blue" | "emerald" | "purple" | "orange";

type ShiftCardViewProps = {
  isDark: boolean;
  isDragging: boolean;
  role: string;
  time: string;
  status: string;
  indicator: string;
  zone?: string;
  isCompact?: boolean;
};

const SHIFT_STATUS_STYLES: Record<ShiftStatus, string> = {
  draft: "border-dashed border-orange-500/20 bg-orange-500/[0.03]",
  published: "border-white/[0.06] bg-white/[0.015]",
  active: "border-emerald-500/40 bg-emerald-500/8 shadow-[0_0_15px_rgba(16,185,129,0.1)]",
  completed: "border-white/[0.03] bg-transparent opacity-50",
};

const SHIFT_INDICATOR_STYLES: Record<ShiftIndicator, string> = {
  blue: "bg-blue-400/40",
  emerald: "bg-emerald-400/40",
  purple: "bg-purple-400/40",
  orange: "bg-orange-400/40",
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

function ShiftStatusIcon({ status, isDark }: { status: ShiftStatus; isDark: boolean }) {
  if (status === "draft") return <AlertCircle className="h-3.5 w-3.5 text-orange-400/60" />;
  if (status === "published")
    return <Circle className={`h-3.5 w-3.5 ${isDark ? "text-zinc-500" : "text-zinc-400"}`} />;
  if (status === "active") return <PlayCircle className="h-3.5 w-3.5 text-emerald-400/60" />;
  return <CheckCircle2 className="h-3.5 w-3.5 text-zinc-600" />;
}

export const ShiftCardView = React.memo(function ShiftCardView({
  isDark,
  isDragging,
  role,
  time,
  status,
  indicator,
  zone,
  isCompact,
}: ShiftCardViewProps) {
  const normalizedStatus = normalizeShiftStatus(status);
  const normalizedIndicator = normalizeShiftIndicator(indicator);

  if (isCompact) {
    return (
      <div
        className={`group relative flex cursor-grab items-center gap-2 rounded-md border px-2 py-1 transition-[opacity,transform,background-color,border-color] duration-200 ease-out hover:border-white/15 active:cursor-grabbing ${isDark ? "hover:bg-white/5" : "hover:bg-zinc-100"} select-none ${SHIFT_STATUS_STYLES[normalizedStatus]} overflow-visible will-change-transform ${isDragging ? "scale-[0.98] opacity-35" : "scale-100 opacity-100"}`}
      >
        <div
          className={`absolute top-1 bottom-1 left-0 w-0.5 rounded-r-full ${SHIFT_INDICATOR_STYLES[normalizedIndicator]}`}
        />
        <span
          className={`text-[11px] font-semibold ${isDark ? "text-white" : "text-zinc-900"} truncate pl-1 leading-tight`}
        >
          {role}
        </span>
        <span className="ml-auto shrink-0 text-[10px] font-medium text-zinc-500">{time}</span>
      </div>
    );
  }

  return (
    <div
      className={`group relative flex cursor-grab flex-col gap-2.5 rounded-lg border p-2.5 transition-[opacity,transform,background-color,border-color] duration-200 ease-out hover:border-white/15 active:cursor-grabbing xl:p-3 ${isDark ? "hover:bg-white/5" : "hover:bg-zinc-100"} select-none ${SHIFT_STATUS_STYLES[normalizedStatus]} overflow-visible will-change-transform ${isDragging ? "scale-[0.98] opacity-35" : "scale-100 opacity-100"}`}
    >
      <div
        className={`absolute top-2.5 bottom-2.5 left-0 w-1 rounded-r-full ${SHIFT_INDICATOR_STYLES[normalizedIndicator]}`}
      />

      <div className="relative z-10 flex w-full items-start justify-between">
        <div className="min-w-0 pr-2">
          <span
            className={`text-sm font-semibold ${isDark ? "text-white" : "text-zinc-900"} line-clamp-1 block truncate leading-tight transition-colors group-hover:text-zinc-300`}
          >
            {role}
          </span>
          {zone ? (
            <div
              className={`text-[11px] ${isDark ? "text-zinc-500" : "text-zinc-500"} mt-1 flex items-center gap-1 whitespace-nowrap`}
            >
              <MapPin className="h-3 w-3 shrink-0" />
              <span className="truncate">{zone}</span>
            </div>
          ) : null}
        </div>

        <div className="relative flex h-5 w-5 shrink-0 items-center justify-center">
          <ShiftStatusIcon status={normalizedStatus} isDark={isDark} />
        </div>
      </div>

      <div
        className={`flex items-center gap-1.5 text-xs ${isDark ? "text-zinc-500" : "text-zinc-500"} relative z-10 mt-auto font-medium`}
      >
        <Clock
          className={`h-3.5 w-3.5 text-zinc-500 group-hover:${isDark ? "text-zinc-400" : "text-zinc-600"}`}
        />
        {time}
      </div>
    </div>
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
  isDark,
  isDragging,
  title,
  hours,
  routines,
}: TemplateCardViewProps) {
  return (
    <div
      className={`p-3 ${isDark ? "bg-[#151518]" : "bg-white"} border ${isDark ? "border-dashed border-zinc-700" : "border-dashed border-zinc-300"} group cursor-grab rounded-xl shadow-sm transition-[opacity,transform,background-color,border-color] duration-200 ease-out will-change-transform hover:border-orange-500/50 hover:bg-orange-500/5 active:cursor-grabbing ${isDragging ? "scale-[0.98] opacity-35" : "scale-100 opacity-100"}`}
    >
      <div className="mb-1.5 flex items-start justify-between">
        <h4
          className={`text-xs font-bold ${isDark ? "text-white" : "text-zinc-900"} transition-colors group-hover:text-orange-400`}
        >
          {title}
        </h4>
        <span className="rounded bg-orange-500/10 px-1.5 py-0.5 text-[8px] leading-none font-black tracking-widest text-orange-400 uppercase">
          Mal
        </span>
      </div>
      <div className="flex items-center justify-between text-[10px] font-medium text-zinc-500">
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
