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
      className={`p-3 ${isDark ? "bg-[#0a0a0c]" : "bg-white"} group cursor-grab rounded-xl border border-white/5 shadow-sm transition-[opacity,transform,background-color,border-color] duration-200 ease-out will-change-transform hover:border-white/10 hover:bg-white/5 active:cursor-grabbing ${isDragging ? "scale-[0.98] opacity-35" : "scale-100 opacity-100"}`}
    >
      <h4
        className={`text-[13px] font-bold ${isDark ? "text-white" : "text-zinc-900"} mb-1 transition-colors group-hover:text-orange-400`}
      >
        {title}
      </h4>
      <div className="flex items-center gap-1.5 text-[11px] font-medium text-zinc-500">
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
};

const SHIFT_STATUS_STYLES: Record<ShiftStatus, string> = {
  draft: "border-orange-500/30 bg-orange-500/5",
  published: "border-white/10 bg-[#0a0a0c]",
  active: "border-emerald-500/50 bg-emerald-500/10 shadow-[0_0_15px_rgba(16,185,129,0.1)]",
  completed: "border-white/5 bg-[#050505] opacity-60",
};

const SHIFT_INDICATOR_STYLES: Record<ShiftIndicator, string> = {
  blue: "bg-blue-400 shadow-[0_0_10px_rgba(96,165,250,0.5)]",
  emerald: "bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.5)]",
  purple: "bg-purple-400 shadow-[0_0_10px_rgba(167,139,250,0.5)]",
  orange: "bg-orange-400 shadow-[0_0_10px_rgba(251,146,60,0.5)]",
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
  if (status === "draft") return <AlertCircle className="h-3 w-3 text-orange-400" />;
  if (status === "published")
    return <Circle className={`h-3 w-3 ${isDark ? "text-zinc-400" : "text-zinc-600"}`} />;
  if (status === "active") return <PlayCircle className="h-3 w-3 text-emerald-400" />;
  return <CheckCircle2 className="h-3 w-3 text-zinc-600" />;
}

export const ShiftCardView = React.memo(function ShiftCardView({
  isDark,
  isDragging,
  role,
  time,
  status,
  indicator,
  zone,
}: ShiftCardViewProps) {
  const normalizedStatus = normalizeShiftStatus(status);
  const normalizedIndicator = normalizeShiftIndicator(indicator);

  return (
    <div
      className={`group relative flex cursor-grab flex-col gap-2 rounded-lg border p-2 transition-[opacity,transform,background-color,border-color] duration-200 ease-out hover:border-white/30 active:cursor-grabbing xl:p-2.5 ${isDark ? "hover:bg-white/5" : "hover:bg-zinc-100"} select-none ${SHIFT_STATUS_STYLES[normalizedStatus]} overflow-visible will-change-transform ${isDragging ? "scale-[0.98] opacity-35" : "scale-100 opacity-100"}`}
    >
      <div
        className={`absolute top-2 bottom-2 left-0 w-0.5 rounded-r-full ${SHIFT_INDICATOR_STYLES[normalizedIndicator]}`}
      />

      <div className="relative z-10 flex w-full items-start justify-between">
        <div className="min-w-0 pr-2">
          <span
            className={`text-[10px] font-bold xl:text-xs ${isDark ? "text-white" : "text-zinc-900"} line-clamp-1 block truncate leading-tight transition-colors group-hover:text-amber-400`}
          >
            {role}
          </span>
          {zone ? (
            <div
              className={`text-[9px] ${isDark ? "text-zinc-400" : "text-zinc-600"} mt-0.5 flex items-center gap-1 whitespace-nowrap`}
            >
              <MapPin className="h-2.5 w-2.5 shrink-0" />
              <span className="truncate">{zone}</span>
            </div>
          ) : null}
        </div>

        <div className="relative flex h-4 w-4 shrink-0 items-center justify-center">
          <ShiftStatusIcon status={normalizedStatus} isDark={isDark} />
        </div>
      </div>

      <div
        className={`flex items-center gap-1.5 text-[9px] xl:text-[10px] ${isDark ? "text-zinc-400" : "text-zinc-600"} relative z-10 mt-auto font-medium`}
      >
        <Clock
          className={`h-3 w-3 text-zinc-500 group-hover:${isDark ? "text-zinc-400" : "text-zinc-600"}`}
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
