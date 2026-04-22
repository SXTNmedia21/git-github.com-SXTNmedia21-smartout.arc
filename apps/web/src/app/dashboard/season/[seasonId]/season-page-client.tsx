"use client";

/**
 * /dashboard/season/[seasonId] — Client shell.
 *
 * Owns: submenu state (driven by ?tab=), telemetry for page-view +
 * tab-switch, data hooks that resolve the active season. Each tab is a
 * thin consumer of shared year-wheel hooks (kept in their canonical
 * location during the redesign — see Task 1.1).
 */

import { useContext, useEffect } from "react";
import { notFound, useRouter, useSearchParams } from "next/navigation";
import { emit } from "@smartout/telemetry";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { useSeasonBudget, useSeasons } from "@/app/dashboard/year-wheel/_hooks";
import { SeasonBreadcrumb } from "./_components/SeasonBreadcrumb";
import { SeasonSubmenu } from "./_components/SeasonSubmenu";
import { BudgetSetupTab } from "./_components/BudgetSetupTab";
import { DayFactorsTab } from "./_components/DayFactorsTab";
import { HourFactorsTab } from "./_components/HourFactorsTab";
import { SeasonHoursTab } from "./_components/SeasonHoursTab";
import { SeasonOverviewTab } from "./_components/SeasonOverviewTab";

export type TabKey = "budget" | "day" | "hour" | "hours" | "overview";

const VALID_TABS: readonly TabKey[] = ["budget", "day", "hour", "hours", "overview"];

type Props = {
  seasonId: string;
  initialTab: TabKey;
  workspaceId: string;
};

export function SeasonPageClient({ seasonId, initialTab, workspaceId }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { profileId } = useContext(DashboardContext);

  const { seasons, isLoading } = useSeasons();
  const season = seasons?.find((s) => s.season_id === seasonId);

  const { budget } = useSeasonBudget(seasonId);
  const seasonBudgetId = budget?.season_budget_id ?? null;

  const rawTab = searchParams.get("tab");
  const activeTab: TabKey = VALID_TABS.includes(rawTab as TabKey) ? (rawTab as TabKey) : initialTab;

  // Fire page-view telemetry when the active season resolves.
  // Uses season.start_date year so the event year matches canvas year.
  useEffect(() => {
    if (!season) return;
    void emit({
      event: "season year_wheel_viewed",
      workspace_id: workspaceId,
      actor_id: profileId ?? "",
      properties: {
        data: {
          year: season.start_date
            ? new Date(season.start_date).getUTCFullYear()
            : new Date().getUTCFullYear(),
          seasons_count: seasons?.length ?? 0,
        },
      },
    });
  }, [season, seasons, workspaceId, profileId]);

  if (isLoading) return null; // Suspense shows loading.tsx
  if (!season) notFound();

  const handleTabChange = (next: TabKey) => {
    if (next === activeTab) return;
    void emit({
      event: "season tab_changed",
      workspace_id: workspaceId,
      actor_id: profileId ?? "",
      properties: {
        entity: {
          entity_type: "season",
          entity_id: seasonId,
          entity_label: season.name,
        },
        data: { from: activeTab, to: next },
      },
    });
    const params = new URLSearchParams(searchParams);
    params.set("tab", next);
    router.push(`/dashboard/season/${seasonId}?${params.toString()}`);
  };

  const year = season.start_date
    ? new Date(season.start_date).getUTCFullYear()
    : new Date().getUTCFullYear();

  return (
    <div className="container mx-auto max-w-6xl px-6 py-8">
      <SeasonBreadcrumb year={year} seasonName={season.name} status={season.status} />
      <SeasonSubmenu active={activeTab} onChange={handleTabChange} />
      <div className="mt-6">
        {activeTab === "budget" && <BudgetSetupTab seasonId={seasonId} />}
        {activeTab === "day" && <DayFactorsTab seasonBudgetId={seasonBudgetId ?? ""} />}
        {activeTab === "hour" && <HourFactorsTab seasonBudgetId={seasonBudgetId ?? ""} />}
        {activeTab === "hours" && <SeasonHoursTab seasonId={seasonId} />}
        {activeTab === "overview" && (
          <SeasonOverviewTab
            seasonId={seasonId}
            seasonBudgetId={seasonBudgetId ?? ""}
            seasonStartDate={season.start_date}
            seasonEndDate={season.end_date}
          />
        )}
      </div>
    </div>
  );
}
