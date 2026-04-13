// ============================================
// PlanningCycleSelector.tsx
// Compact dropdown for selecting or creating a planning cycle
// and linking it to the currently selected season.
// Sits below SeasonSelector in the season page header area.
// ============================================
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Archive, CalendarRange, ChevronDown, Check, Loader2, Play, Plus } from "lucide-react";
import { usePlanningCycles } from "../_hooks/use-planning-cycles";
import { useSeasons } from "../_hooks";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { PlanningCycleStatus } from "@/lib/cascade/types";

// UI Events:
// - action: openDropdown (click trigger row)
// - action: selectCycle(cycleId) (click cycle row — links to season)
// - action: unlinkCycle (click already-linked cycle — sets null)
// - action: showCreateForm (click "Ny planperiode" button)
// - action: createCycle (submit create form)
// - action: closeDropdown (click outside, Escape key)

type Props = {
  selectedSeasonId: string | null;
  isDark: boolean;
};

/**
 * Format a YYYY-MM-DD date string to Norwegian short format.
 * Example: "2026-01-15" -> "15. jan 2026"
 */
function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("nb-NO", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function getYearFromDate(dateStr: string) {
  return new Date(dateStr + "T00:00:00").getFullYear().toString();
}

/**
 * Status badge color mapping — 3-level isDark pattern.
 */
function statusBadgeClass(status: PlanningCycleStatus, isDark: boolean): string {
  switch (status) {
    case "active":
      return isDark
        ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
        : "border-emerald-200 bg-emerald-50 text-emerald-600";
    case "archived":
      return isDark
        ? "border-amber-500/20 bg-amber-500/10 text-amber-400"
        : "border-amber-200 bg-amber-50 text-amber-600";
    default:
      // draft
      return isDark
        ? "border-zinc-500/20 bg-zinc-500/10 text-zinc-400"
        : "border-zinc-300 bg-zinc-100 text-zinc-500";
  }
}

export function PlanningCycleSelector({ selectedSeasonId, isDark }: Props) {
  const { cycles, isLoading, createCycle, linkSeasonToCycle, activateCycle, archiveCycle } =
    usePlanningCycles();
  const { seasons } = useSeasons();

  const [isOpen, setIsOpen] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  // Create form state
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [revenueTarget, setRevenueTarget] = useState("");

  const dropdownRef = useRef<HTMLDivElement>(null);

  // Resolve the currently linked cycle from season data
  const selectedSeason = seasons.find((s) => s.season_id === selectedSeasonId);
  const linkedCycleId = selectedSeason?.planning_cycle_id ?? null;
  const linkedCycle = cycles.find((c) => c.planning_cycle_id === linkedCycleId);

  // Close on Escape
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape") {
      setIsOpen(false);
      setShowCreate(false);
    }
  }, []);

  // Close on click outside
  const handleClickOutside = useCallback((e: MouseEvent) => {
    if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
      setIsOpen(false);
      setShowCreate(false);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen, handleKeyDown, handleClickOutside]);

  // Handle cycle selection — toggle link/unlink
  function handleSelectCycle(cycleId: string) {
    if (!selectedSeasonId) return;
    const newCycleId = cycleId === linkedCycleId ? null : cycleId;
    linkSeasonToCycle.mutate({ seasonId: selectedSeasonId, cycleId: newCycleId });
    setIsOpen(false);
  }

  // Handle create form submission
  function handleCreate() {
    if (!name.trim() || !startDate || !endDate || !selectedSeasonId) return;
    const target = revenueTarget ? Number(revenueTarget) : null;

    createCycle.mutate(
      {
        name: name.trim(),
        start_date: startDate,
        end_date: endDate,
        total_revenue_target: target,
      },
      {
        onSuccess: (data) => {
          // Auto-link to current season after creation
          linkSeasonToCycle.mutate({
            seasonId: selectedSeasonId,
            cycleId: data.planning_cycle_id,
          });
          // Reset form
          setName("");
          setStartDate("");
          setEndDate("");
          setRevenueTarget("");
          setShowCreate(false);
          setIsOpen(false);
        },
      },
    );
  }

  // --- Styling ---
  const triggerClass = isDark
    ? "border-zinc-800 bg-[#0c0c0e] hover:bg-zinc-800/50 text-zinc-300"
    : "border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-700";

  const dropdownClass = isDark
    ? "rounded-xl border border-zinc-800 bg-[#0c0c0e] shadow-lg"
    : "rounded-xl border border-zinc-200 bg-white shadow-lg";

  const itemClass = isDark
    ? "rounded-lg px-3 py-2 hover:bg-zinc-800/50 cursor-pointer transition-colors"
    : "rounded-lg px-3 py-2 hover:bg-zinc-100 cursor-pointer transition-colors";

  const labelClass = isDark ? "text-zinc-400" : "text-zinc-500";
  const inputClass = isDark
    ? "border-zinc-700 bg-zinc-900 text-white"
    : "border-zinc-300 bg-white text-zinc-900";

  // Loading skeleton
  if (isLoading) {
    return (
      <div
        className={`h-8 w-56 animate-pulse rounded-lg ${isDark ? "bg-zinc-800/50" : "bg-zinc-200"}`}
      />
    );
  }

  // No season selected — nothing to link to
  if (!selectedSeasonId) return null;

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger row */}
      <button
        type="button"
        onClick={() => {
          setIsOpen((prev) => !prev);
          if (isOpen) setShowCreate(false);
        }}
        className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${triggerClass}`}
      >
        <CalendarRange className="h-[16px] w-[16px] shrink-0 opacity-60" />
        <span className={`text-xs font-semibold ${labelClass}`}>Planperiode:</span>
        <span className={`truncate ${isDark ? "text-white" : "text-zinc-900"}`}>
          {linkedCycle ? linkedCycle.name : "Ingen"}
        </span>
        <ChevronDown
          className={`h-[14px] w-[14px] shrink-0 opacity-50 transition-transform ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div
          className={`animate-in fade-in slide-in-from-top-2 absolute top-full left-0 z-50 mt-1.5 w-80 duration-200 ${dropdownClass}`}
        >
          {showCreate ? (
            /* --- Create form --- */
            <div className="space-y-3 p-4">
              <p className={`text-xs font-bold tracking-wider uppercase ${labelClass}`}>
                Ny planperiode
              </p>

              <div className="space-y-2">
                <div>
                  <label className={`mb-1 block text-xs font-semibold ${labelClass}`}>Navn</label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="F.eks. V\u00e5r 2026"
                    className={`h-8 text-sm ${inputClass}`}
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className={`mb-1 block text-xs font-semibold ${labelClass}`}>Fra</label>
                    <Input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className={`h-8 text-sm ${inputClass}`}
                    />
                  </div>
                  <div>
                    <label className={`mb-1 block text-xs font-semibold ${labelClass}`}>Til</label>
                    <Input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className={`h-8 text-sm ${inputClass}`}
                    />
                  </div>
                </div>

                <div>
                  <label className={`mb-1 block text-xs font-semibold ${labelClass}`}>
                    Omsetningsm\u00e5l (NOK, valgfritt)
                  </label>
                  <Input
                    type="number"
                    value={revenueTarget}
                    onChange={(e) => setRevenueTarget(e.target.value)}
                    placeholder="0"
                    className={`h-8 text-sm ${inputClass}`}
                  />
                </div>
              </div>

              {/* Divider */}
              <div className={`h-px w-full ${isDark ? "bg-zinc-800/50" : "bg-zinc-200"}`} />

              <div className="flex items-center justify-end gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowCreate(false)}
                  className="h-7 text-xs"
                >
                  Avbryt
                </Button>
                <Button
                  size="sm"
                  onClick={handleCreate}
                  disabled={!name.trim() || !startDate || !endDate || createCycle.isPending}
                  className="h-7 bg-gradient-to-r from-orange-600 to-rose-600 text-xs text-white hover:opacity-90"
                >
                  {createCycle.isPending ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null}
                  Opprett
                </Button>
              </div>
            </div>
          ) : (
            /* --- Cycle list --- */
            <div className="p-2">
              {cycles.length === 0 ? (
                <p className={`px-3 py-3 text-center text-xs ${labelClass}`}>
                  Ingen planperioder opprettet.
                </p>
              ) : (
                <div className="max-h-60 space-y-2 overflow-y-auto pr-1">
                  {(() => {
                    const cyclesByYear = cycles.reduce(
                      (acc, cycle) => {
                        const year = getYearFromDate(cycle.start_date);
                        if (!acc[year]) acc[year] = [];
                        acc[year].push(cycle);
                        return acc;
                      },
                      {} as Record<string, typeof cycles>,
                    );

                    return Object.entries(cyclesByYear)
                      .sort(([yearA], [yearB]) => Number(yearB) - Number(yearA))
                      .map(([year, yearCycles]) => (
                        <div key={year}>
                          <div
                            className={`px-3 py-1 text-[10px] font-bold tracking-wider uppercase ${labelClass}`}
                          >
                            {year}
                          </div>
                          <div className="space-y-0.5">
                            {yearCycles.map((cycle) => {
                              const isLinked = cycle.planning_cycle_id === linkedCycleId;
                              return (
                                <div
                                  key={cycle.planning_cycle_id}
                                  onClick={() => handleSelectCycle(cycle.planning_cycle_id)}
                                  title={`Velg ${cycle.name} (${formatDate(cycle.start_date)} - ${formatDate(cycle.end_date)})`}
                                  className={`${itemClass} flex items-center gap-2`}
                                >
                                  {/* Checkmark column */}
                                  <div className="flex h-4 w-4 shrink-0 items-center justify-center">
                                    {isLinked ? (
                                      <Check
                                        className={`h-[14px] w-[14px] ${isDark ? "text-orange-400" : "text-orange-600"}`}
                                      />
                                    ) : null}
                                  </div>

                                  {/* Cycle info */}
                                  <div className="min-w-0 flex-1">
                                    <p
                                      className={`truncate text-sm font-semibold ${isDark ? "text-white" : "text-zinc-900"}`}
                                    >
                                      {cycle.name}
                                    </p>
                                    <p className={`text-xs ${labelClass}`}>
                                      {formatDate(cycle.start_date)} &mdash;{" "}
                                      {formatDate(cycle.end_date)}
                                    </p>
                                  </div>

                                  {/* Status badge + lifecycle actions */}
                                  <div className="flex shrink-0 items-center gap-1">
                                    <span
                                      className={`rounded border px-1.5 py-0.5 text-[10px] font-bold uppercase ${statusBadgeClass(cycle.status, isDark)}`}
                                    >
                                      {cycle.status}
                                    </span>
                                    {cycle.status === "draft" ? (
                                      <button
                                        type="button"
                                        aria-label="Aktiver planperiode"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          activateCycle.mutate(cycle.planning_cycle_id);
                                        }}
                                        className={
                                          isDark
                                            ? "rounded-md p-1 text-zinc-400 hover:bg-zinc-800/80 hover:text-emerald-400"
                                            : "rounded-md p-1 text-zinc-500 hover:bg-zinc-100 hover:text-emerald-600"
                                        }
                                      >
                                        <Play className="h-3.5 w-3.5" />
                                      </button>
                                    ) : null}
                                    {cycle.status === "active" ? (
                                      <button
                                        type="button"
                                        aria-label="Arkiver planperiode"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          if (!window.confirm("Arkivere denne planperioden?"))
                                            return;
                                          archiveCycle.mutate(cycle.planning_cycle_id);
                                        }}
                                        className={
                                          isDark
                                            ? "rounded-md p-1 text-zinc-400 hover:bg-zinc-800/80 hover:text-amber-400"
                                            : "rounded-md p-1 text-zinc-500 hover:bg-zinc-100 hover:text-amber-600"
                                        }
                                      >
                                        <Archive className="h-3.5 w-3.5" />
                                      </button>
                                    ) : null}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ));
                  })()}
                </div>
              )}

              {/* Divider */}
              <div className={`my-1.5 h-px w-full ${isDark ? "bg-zinc-800/50" : "bg-zinc-200"}`} />

              {/* Create button */}
              <button
                type="button"
                onClick={() => setShowCreate(true)}
                className={`flex w-full items-center gap-2 ${itemClass}`}
              >
                <Plus
                  className={`h-[14px] w-[14px] ${isDark ? "text-orange-400" : "text-orange-600"}`}
                />
                <span
                  className={`text-sm font-semibold ${isDark ? "text-orange-400" : "text-orange-600"}`}
                >
                  Ny planperiode
                </span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
