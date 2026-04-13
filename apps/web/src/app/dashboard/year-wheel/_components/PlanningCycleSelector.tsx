// ============================================
// PlanningCycleSelector.tsx
// Compact dropdown for selecting or creating a planning cycle
// and linking it to the currently selected season.
// Sits below SeasonSelector in the season page header area.
// ============================================
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Archive, CalendarRange, ChevronDown, Check, Loader2, Play, Plus } from "lucide-react";
import { useTranslation } from "@smartout/i18n";
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
 * Status badge color mapping using CSS semantic variables.
 * active = success, draft = warning, archived = muted.
 */
function statusBadgeClass(status: PlanningCycleStatus): string {
  switch (status) {
    case "active":
      return "border-success/20 bg-success/10 text-success";
    case "archived":
      return "border-muted-foreground/20 bg-muted text-muted-foreground";
    default:
      // draft
      return "border-warning/20 bg-warning/10 text-warning";
  }
}

export function PlanningCycleSelector({ selectedSeasonId }: Props) {
  const { t } = useTranslation("dashboard");
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

  // Loading skeleton
  if (isLoading) {
    return <div className="bg-muted h-8 w-56 animate-pulse rounded-lg" />;
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
        className="border-border bg-card text-card-foreground hover:bg-accent hover:text-accent-foreground flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors"
      >
        <CalendarRange className="h-[16px] w-[16px] shrink-0 opacity-60" />
        <span className="text-muted-foreground text-xs font-semibold">
          {t("yearWheel.planning_period")}:
        </span>
        <span className="text-foreground truncate">
          {linkedCycle ? linkedCycle.name : t("yearWheel.none")}
        </span>
        <ChevronDown
          className={`h-[14px] w-[14px] shrink-0 opacity-50 transition-transform ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="animate-in fade-in slide-in-from-top-2 border-border bg-card absolute top-full left-0 z-50 mt-1.5 w-80 rounded-xl border shadow-lg duration-200">
          {showCreate ? (
            /* --- Create form --- */
            <div className="space-y-3 p-4">
              <p className="text-muted-foreground text-xs font-bold tracking-wider uppercase">
                {t("yearWheel.new_planning_period")}
              </p>

              <div className="space-y-2">
                <div>
                  <label className="text-muted-foreground mb-1 block text-xs font-semibold">
                    {t("yearWheel.name")}
                  </label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="F.eks. Vår 2026"
                    className="border-input bg-background text-foreground h-8 text-sm"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-muted-foreground mb-1 block text-xs font-semibold">
                      {t("yearWheel.from")}
                    </label>
                    <Input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="border-input bg-background text-foreground h-8 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-muted-foreground mb-1 block text-xs font-semibold">
                      {t("yearWheel.to")}
                    </label>
                    <Input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="border-input bg-background text-foreground h-8 text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-muted-foreground mb-1 block text-xs font-semibold">
                    {t("yearWheel.revenue_target_nok")}
                  </label>
                  <Input
                    type="number"
                    value={revenueTarget}
                    onChange={(e) => setRevenueTarget(e.target.value)}
                    placeholder="0"
                    className="border-input bg-background text-foreground h-8 text-sm"
                  />
                </div>
              </div>

              {/* Divider */}
              <div className="bg-border h-px w-full" />

              <div className="flex items-center justify-end gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowCreate(false)}
                  className="h-7 text-xs"
                >
                  {t("yearWheel.cancel")}
                </Button>
                <Button
                  size="sm"
                  onClick={handleCreate}
                  disabled={!name.trim() || !startDate || !endDate || createCycle.isPending}
                  className="h-7 bg-gradient-to-r from-orange-600 to-rose-600 text-xs text-white hover:opacity-90"
                >
                  {createCycle.isPending ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null}
                  {t("yearWheel.create")}
                </Button>
              </div>
            </div>
          ) : (
            /* --- Cycle list --- */
            <div className="p-2">
              {cycles.length === 0 ? (
                <p className="text-muted-foreground px-3 py-3 text-center text-xs">
                  {t("yearWheel.no_planning_periods")}
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
                          <div className="text-muted-foreground px-3 py-1 text-[10px] font-bold tracking-wider uppercase">
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
                                  className="hover:bg-accent hover:text-accent-foreground flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 transition-colors"
                                >
                                  {/* Checkmark column */}
                                  <div className="flex h-4 w-4 shrink-0 items-center justify-center">
                                    {isLinked ? (
                                      <Check className="text-brand-orange h-[14px] w-[14px]" />
                                    ) : null}
                                  </div>

                                  {/* Cycle info */}
                                  <div className="min-w-0 flex-1">
                                    <p className="text-foreground truncate text-sm font-semibold">
                                      {cycle.name}
                                    </p>
                                    <p className="text-muted-foreground text-xs">
                                      {formatDate(cycle.start_date)} &mdash;{" "}
                                      {formatDate(cycle.end_date)}
                                    </p>
                                  </div>

                                  {/* Status badge + lifecycle actions */}
                                  <div className="flex shrink-0 items-center gap-1">
                                    <span
                                      className={`rounded border px-1.5 py-0.5 text-[10px] font-bold uppercase ${statusBadgeClass(cycle.status)}`}
                                    >
                                      {cycle.status}
                                    </span>
                                    {cycle.status === "draft" ? (
                                      <button
                                        type="button"
                                        aria-label={t("yearWheel.activate_planning_period")}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          activateCycle.mutate(cycle.planning_cycle_id);
                                        }}
                                        className="text-muted-foreground hover:bg-accent hover:text-success flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md"
                                      >
                                        <Play className="h-3.5 w-3.5" />
                                      </button>
                                    ) : null}
                                    {cycle.status === "active" ? (
                                      <button
                                        type="button"
                                        aria-label={t("yearWheel.archive")}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          if (
                                            !window.confirm(t("yearWheel.archive_planning_period"))
                                          )
                                            return;
                                          archiveCycle.mutate(cycle.planning_cycle_id);
                                        }}
                                        className="text-muted-foreground hover:bg-accent hover:text-warning flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md"
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
              <div className="bg-border my-1.5 h-px w-full" />

              {/* Create button */}
              <button
                type="button"
                onClick={() => setShowCreate(true)}
                className="hover:bg-accent hover:text-accent-foreground flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2 transition-colors"
              >
                <Plus className="text-brand-orange h-[14px] w-[14px]" />
                <span className="text-brand-orange text-sm font-semibold">
                  {t("yearWheel.new_planning_period")}
                </span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
