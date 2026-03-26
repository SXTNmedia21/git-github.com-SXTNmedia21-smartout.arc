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
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { SCHEDULE_LAYERS } from "./schedule-layers";

type PlannerCommandBarProps = {
  isDark: boolean;
  filterSituation: string;
  setFilterSituation: (value: string) => void;
  weekSpan?: 1 | 2;
  setWeekSpan?: (v: 1 | 2) => void;
  scheduleLayout?: string;
  locationOptions?: string[];
};

export function PlannerCommandBar({
  isDark,
  filterSituation,
  setFilterSituation,
  weekSpan,
  setWeekSpan,
  scheduleLayout,
  locationOptions,
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
      className="border-border bg-background/80 relative flex shrink-0 flex-wrap items-center justify-between border-b px-4 py-1 backdrop-blur-md print:hidden"
      style={{ zIndex: SCHEDULE_LAYERS.stickyCorner + 1 }}
    >
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="flex items-center gap-1.5 text-xs font-black tracking-tight">
          <CalendarDays className="h-4 w-4 text-orange-500" />
          Vaktplan
        </h1>
        <div className="bg-border hidden h-3 w-px sm:block" />

        {/* Location selector */}
        <LocationPopover
          isDark={isDark}
          value={activeLocation}
          onChange={setActiveLocation}
          options={locationOptions}
        />

        <div className="bg-border hidden h-3 w-px sm:block" />

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

        <div className="bg-border hidden h-3 w-px sm:block" />

        {/* Compact mode toggle — only relevant for daily grid */}
        {(!scheduleLayout || scheduleLayout === "daily") && (
          <button
            onClick={() => setScheduleCompactMode(!scheduleCompactMode)}
            className={`flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-bold transition-all ${
              scheduleCompactMode
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            <Rows3 className={`h-3 w-3 ${scheduleCompactMode ? "text-orange-500" : ""}`} />
            Kompakt
          </button>
        )}
      </div>

      {/* Week span toggle */}
      {scheduleLayout !== "monthly" && weekSpan !== undefined && setWeekSpan && (
        <div
          className={`flex rounded-lg border p-0.5 ${isDark ? "border-white/10 bg-white/5" : "border-zinc-200 bg-zinc-100"}`}
        >
          <button
            onClick={() => setWeekSpan(1)}
            className={`rounded-md px-3 py-1 text-[11px] font-bold transition-all ${weekSpan === 1 ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
          >
            1 uke
          </button>
          <button
            onClick={() => setWeekSpan(2)}
            className={`rounded-md px-3 py-1 text-[11px] font-bold transition-all ${weekSpan === 2 ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
          >
            2 uker
          </button>
        </div>
      )}

      <div className="mt-1 flex items-center gap-1.5 sm:mt-0">
        <button
          onClick={() => setFilterSituation("Alle")}
          className={`rounded-md p-1 transition-colors ${filterSituation !== "Alle" ? "text-orange-400 hover:text-orange-300" : "text-muted-foreground"}`}
          title="Fjern filter"
        >
          <Filter className="h-3.5 w-3.5" />
        </button>
        <div className="border-border bg-muted flex rounded-lg border p-0.5">
          {["Alle", "Selskap", "Krise", "Normal"].map((situation) => (
            <button
              key={situation}
              onClick={() => setFilterSituation(situation)}
              className={`rounded-md px-2.5 py-1 text-[10px] font-bold transition-all ${
                filterSituation === situation
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
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
  isDark: _isDark,
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
      className={`flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-bold transition-all ${
        isActive
          ? "bg-background text-foreground shadow-sm"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
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
export function LocationPopover({
  isDark: _isDark,
  value,
  onChange,
  options,
}: {
  isDark: boolean;
  value: string;
  onChange: (v: string) => void;
  options?: string[];
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const locations = React.useMemo(
    () =>
      options && options.length > 0
        ? ["Alle Lokasjoner", ...options.filter((option) => option !== "Alle Lokasjoner")]
        : ["Alle Lokasjoner"],
    [options],
  );

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
        className="border-border bg-muted text-foreground hover:bg-muted/80 flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-bold transition-all"
      >
        <MapPin className="h-3.5 w-3.5 text-orange-500" />
        {value}
        <ChevronDown className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="animate-in fade-in slide-in-from-top-1 border-border bg-popover absolute top-full left-0 z-[9999] mt-1 w-52 rounded-xl border p-1 shadow-xl backdrop-blur-xl">
          {locations.map((loc) => (
            <button
              key={loc}
              onClick={() => {
                onChange(loc);
                setOpen(false);
              }}
              className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
                value === loc
                  ? "bg-orange-500/10 text-orange-400"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
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
