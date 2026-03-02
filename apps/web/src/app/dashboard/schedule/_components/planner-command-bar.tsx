"use client";

import React, { useContext, useRef, useState } from "react";
import {
  CalendarDays,
  Filter,
  Users,
  Briefcase,
  Network,
  MapPin,
  ChevronDown,
  Check,
  Rows3,
} from "lucide-react";
import { DashboardContext, type ScheduleViewMode } from "@/components/dashboard/DashboardShell";

type PlannerCommandBarProps = {
  isDark: boolean;
  filterSituation: string;
  setFilterSituation: (value: string) => void;
};

export function PlannerCommandBar({
  isDark,
  filterSituation,
  setFilterSituation,
}: PlannerCommandBarProps) {
  const {
    scheduleView,
    setScheduleView,
    activeLocation,
    setActiveLocation,
    scheduleCompactMode,
    setScheduleCompactMode,
  } = useContext(DashboardContext);

  return (
    <div
      className={`z-20 flex shrink-0 flex-wrap items-center justify-between border-b border-white/[0.04] px-6 py-2.5 ${isDark ? "bg-[#0a0a0c]/80" : "bg-white/80"} backdrop-blur-md print:hidden`}
    >
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="flex items-center gap-2 text-sm font-black tracking-tight xl:text-base">
          <CalendarDays className="h-5 w-5 text-orange-500" />
          Vaktplan
        </h1>
        <div className={`hidden h-4 w-px sm:block ${isDark ? "bg-white/10" : "bg-zinc-300"}`} />

        {/* Location selector */}
        <LocationPopover isDark={isDark} value={activeLocation} onChange={setActiveLocation} />

        <div className={`hidden h-4 w-px sm:block ${isDark ? "bg-white/10" : "bg-zinc-300"}`} />

        {/* Filter popovers: Ansatt, Jobb, Team, Lokasjon */}
        <div className="flex items-center gap-1">
          <ViewFilterButton
            isDark={isDark}
            icon={<Users className="h-3.5 w-3.5" />}
            label="Ansatt"
            isActive={scheduleView === "ansatt"}
            onClick={() => setScheduleView("ansatt")}
          />
          <ViewFilterButton
            isDark={isDark}
            icon={<Briefcase className="h-3.5 w-3.5" />}
            label="Jobb"
            isActive={scheduleView === "jobb"}
            onClick={() => setScheduleView("jobb")}
          />
          <ViewFilterButton
            isDark={isDark}
            icon={<Network className="h-3.5 w-3.5" />}
            label="Team"
            isActive={scheduleView === "team"}
            onClick={() => setScheduleView("team")}
          />
        </div>

        <div className={`hidden h-4 w-px sm:block ${isDark ? "bg-white/10" : "bg-zinc-300"}`} />

        {/* Compact mode toggle */}
        <button
          onClick={() => setScheduleCompactMode(!scheduleCompactMode)}
          className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold transition-all ${
            scheduleCompactMode
              ? isDark
                ? "bg-zinc-800 text-white shadow-sm"
                : "bg-white text-zinc-900 shadow-sm"
              : isDark
                ? "text-zinc-500 hover:bg-white/5 hover:text-zinc-300"
                : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700"
          }`}
        >
          <Rows3 className={`h-3.5 w-3.5 ${scheduleCompactMode ? "text-orange-500" : ""}`} />
          Kompakt
        </button>
      </div>

      <div className="mt-2 flex items-center gap-2 sm:mt-0">
        <Filter className="h-3.5 w-3.5 text-zinc-500" />
        <div className="flex rounded-lg border border-white/10 bg-white/5 p-0.5">
          {["Alle", "Selskap", "Krise", "Normal"].map((situation) => (
            <button
              key={situation}
              onClick={() => setFilterSituation(situation)}
              className={`rounded-md px-2.5 py-1 text-[10px] font-bold transition-all ${
                filterSituation === situation
                  ? isDark
                    ? "bg-zinc-800/80 text-zinc-200 shadow-sm"
                    : "bg-white text-zinc-900 shadow-sm"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {situation}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ViewFilterButton — compact icon+label toggle for Ansatt/Jobb/Team
// ---------------------------------------------------------------------------
function ViewFilterButton({
  isDark,
  icon,
  label,
  isActive,
  onClick,
}: {
  isDark: boolean;
  icon: React.ReactNode;
  label: string;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold transition-all ${
        isActive
          ? isDark
            ? "bg-zinc-800 text-white shadow-sm"
            : "bg-white text-zinc-900 shadow-sm"
          : isDark
            ? "text-zinc-500 hover:bg-white/5 hover:text-zinc-300"
            : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700"
      }`}
    >
      <span className={isActive ? "text-orange-500" : ""}>{icon}</span>
      {label}
    </button>
  );
}

// ---------------------------------------------------------------------------
// LocationPopover — dropdown selector for active location
// ---------------------------------------------------------------------------
const LOCATIONS = ["Alle Lokasjoner", "Hovedrestaurant", "Bar & Lounge", "Uteservering", "Kjøkken"];

function LocationPopover({
  isDark,
  value,
  onChange,
}: {
  isDark: boolean;
  value: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  React.useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-bold transition-all ${
          isDark
            ? "border-white/10 bg-white/5 text-zinc-300 hover:border-white/20"
            : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300"
        }`}
      >
        <MapPin className="h-3.5 w-3.5 text-orange-500" />
        {value}
        <ChevronDown className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div
          className={`absolute top-full left-0 z-[9999] mt-1 w-52 rounded-xl border p-1 shadow-xl ${
            isDark
              ? "border-white/10 bg-[#111113]/95 backdrop-blur-xl"
              : "border-zinc-200 bg-white shadow-lg"
          } animate-in fade-in slide-in-from-top-1`}
        >
          {LOCATIONS.map((loc) => (
            <button
              key={loc}
              onClick={() => {
                onChange(loc);
                setOpen(false);
              }}
              className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
                value === loc
                  ? isDark
                    ? "bg-orange-500/10 text-orange-400"
                    : "bg-orange-50 text-orange-600"
                  : isDark
                    ? "text-zinc-400 hover:bg-white/5 hover:text-white"
                    : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900"
              }`}
            >
              {loc}
              {value === loc && <Check className="h-3.5 w-3.5" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
