"use client";

import { useState, useContext } from "react";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { SeasonSelector } from "./_components/SeasonSelector";
import { BudgetSetupTab } from "./_components/BudgetSetupTab";
import { DayFactorsTab } from "./_components/DayFactorsTab";
import { HourFactorsTab } from "./_components/HourFactorsTab";
import { SeasonOverviewTab } from "./_components/SeasonOverviewTab";
import { SeasonManagementCard } from "./_components/SeasonManagementCard";
import { useDayFactors, useHourFactors, useSeasonBudget, useSeasons } from "./_hooks";
import { PlanningEventsTab } from "./_components/PlanningEventsTab";
import { PlanningCycleSelector } from "./_components/PlanningCycleSelector";
import {
  Target,
  BarChart3,
  Clock,
  LayoutDashboard,
  CalendarDays,
  Play,
  Archive,
  Loader2,
} from "lucide-react";
import { isSeasonSetupReady } from "./_definitions/season-planning";

type SeasonTab = "overview" | "budget" | "day-factors" | "hour-factors" | "events";

const TABS: { id: SeasonTab; label: string; icon: typeof Target }[] = [
  { id: "overview", label: "Oversikt", icon: LayoutDashboard },
  { id: "budget", label: "Budsjett", icon: Target },
  { id: "day-factors", label: "Dagfaktorer", icon: BarChart3 },
  { id: "hour-factors", label: "Timefaktorer", icon: Clock },
  { id: "events", label: "Hendelser", icon: CalendarDays },
];

export default function SeasonPage() {
  const { isDark } = useContext(DashboardContext);
  const [activeTab, setActiveTab] = useState<SeasonTab>("overview");
  const [selectedSeasonId, setSelectedSeasonId] = useState<string | null>(null);

  const { seasons, activateSeason, archiveSeason } = useSeasons();
  const { budget } = useSeasonBudget(selectedSeasonId);
  const { dayFactors } = useDayFactors(budget?.season_budget_id ?? null);
  const { hourFactors } = useHourFactors(budget?.season_budget_id ?? null);
  const selectedSeason = seasons.find((s) => s.season_id === selectedSeasonId);
  const isBudgetLocked = budget?.status === "locked";

  const setupStatus = {
    hasBudget: Boolean(budget),
    hasDayFactors: dayFactors.length > 0,
    hasHourFactors: hourFactors.length > 0,
  };
  const isReady = isSeasonSetupReady(setupStatus);

  return (
    <div className="z-10 flex-1 overflow-y-auto px-10 pt-8 pb-20">
      {/* Header */}
      <div className="mb-6">
        <h1
          className={`mb-2 text-3xl font-extrabold tracking-tight ${isDark ? "text-white" : "text-zinc-900"}`}
        >
          Sesongplanlegging
          <span className="ml-3 rounded border border-blue-500/20 bg-blue-500/10 px-2 py-1 text-xs font-bold text-blue-400">
            MODULE 15
          </span>
        </h1>
        <p className={`text-sm ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>
          Sett omsetningsmål, dagfaktorer og timefaktorer for sesongen. Systemet beregner daglige
          mål og bemanningsbehov.
        </p>
      </div>

      {/* Season selector */}
      <div className="mb-6">
        <SeasonSelector
          selectedSeasonId={selectedSeasonId}
          onSelect={setSelectedSeasonId}
          isDark={isDark}
        />
      </div>

      {/* Planning cycle selector */}
      <div className="mb-6">
        <PlanningCycleSelector selectedSeasonId={selectedSeasonId} isDark={isDark} />
      </div>

      <div className="mb-6">
        <SeasonManagementCard
          isDark={isDark}
          onSeasonCreated={(seasonId) => {
            setSelectedSeasonId(seasonId);
            setActiveTab("budget");
          }}
        />
      </div>

      {!selectedSeasonId ? (
        <div
          className={`flex flex-1 flex-col items-center justify-center rounded-2xl border-2 border-dashed p-12 ${
            isDark ? "border-zinc-800 bg-zinc-900/20" : "border-zinc-300 bg-zinc-50"
          }`}
        >
          <p className={`text-sm ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>
            Velg en sesong for å starte planlegging.
          </p>
        </div>
      ) : (
        <>
          {/* Tab navigation */}
          <div
            className={`mb-6 flex gap-1 rounded-xl border p-1 ${
              isDark ? "border-zinc-800 bg-zinc-900/50" : "border-zinc-200 bg-zinc-100"
            }`}
          >
            {TABS.map((tab) => {
              const isActive = activeTab === tab.id;
              const Icon = tab.icon;

              // Disable overview if no budget exists yet
              const isDisabled = tab.id === "overview" && !budget;
              // Disable factor tabs if no budget exists
              const needsBudget =
                (tab.id === "day-factors" || tab.id === "hour-factors") && !budget;

              return (
                <button
                  key={tab.id}
                  onClick={() => !isDisabled && !needsBudget && setActiveTab(tab.id)}
                  disabled={isDisabled || needsBudget}
                  className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
                    isActive
                      ? isDark
                        ? "bg-zinc-800 text-white shadow"
                        : "bg-white text-zinc-900 shadow"
                      : isDisabled || needsBudget
                        ? isDark
                          ? "cursor-not-allowed text-zinc-700"
                          : "cursor-not-allowed text-zinc-300"
                        : isDark
                          ? "text-zinc-400 hover:text-white"
                          : "text-zinc-500 hover:text-zinc-900"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {budget && (
            <div
              className={`mb-6 flex items-center justify-between gap-4 rounded-xl border px-4 py-3 text-sm ${
                isDark
                  ? "border-zinc-800 bg-zinc-900/40 text-zinc-400"
                  : "border-zinc-200 bg-zinc-50 text-zinc-600"
              }`}
            >
              <span>
                Oppsettstatus: Budsjett {setupStatus.hasBudget ? "OK" : "Mangler"} - Dagfaktorer{" "}
                {setupStatus.hasDayFactors ? "OK" : "Mangler"} - Timefaktorer{" "}
                {setupStatus.hasHourFactors ? "OK" : "Mangler"} -{" "}
                <strong>{isReady ? "Klar for drift" : "Ferdigstill oppsett"}</strong>
                {isBudgetLocked ? " - Budsjett er låst" : ""}
              </span>

              <div className="flex items-center gap-2">
                {selectedSeason?.status === "draft" && (
                  <button
                    onClick={() => activateSeason.mutate(selectedSeasonId!)}
                    disabled={activateSeason.isPending || !isReady}
                    title={!isReady ? "Fullfør oppsett først" : "Aktiver sesong"}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-emerald-500 disabled:opacity-50"
                  >
                    {activateSeason.isPending ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Play className="h-3.5 w-3.5" />
                    )}
                    Aktiver sesong
                  </button>
                )}
                {selectedSeason?.status === "active" && (
                  <button
                    onClick={() => archiveSeason.mutate(selectedSeasonId!)}
                    disabled={archiveSeason.isPending}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-600 px-3 py-1.5 text-xs font-bold text-zinc-300 transition-colors hover:bg-zinc-800 disabled:opacity-50"
                  >
                    {archiveSeason.isPending ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Archive className="h-3.5 w-3.5" />
                    )}
                    Arkiver sesong
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Tab content */}
          {activeTab === "overview" && budget && (
            <SeasonOverviewTab
              seasonId={selectedSeasonId}
              seasonBudgetId={budget.season_budget_id}
              seasonStartDate={selectedSeason?.start_date ?? null}
              seasonEndDate={selectedSeason?.end_date ?? null}
              isDark={isDark}
            />
          )}
          {activeTab === "budget" && <BudgetSetupTab seasonId={selectedSeasonId} isDark={isDark} />}
          {activeTab === "day-factors" && budget && (
            <DayFactorsTab
              seasonBudgetId={budget.season_budget_id}
              isDark={isDark}
              isReadOnly={isBudgetLocked}
            />
          )}
          {activeTab === "hour-factors" && budget && (
            <HourFactorsTab
              seasonBudgetId={budget.season_budget_id}
              isDark={isDark}
              isReadOnly={isBudgetLocked}
            />
          )}
          {activeTab === "events" && (
            <PlanningEventsTab seasonId={selectedSeasonId} isDark={isDark} />
          )}
        </>
      )}
    </div>
  );
}
