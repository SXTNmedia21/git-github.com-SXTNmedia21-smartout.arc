/**
 * SeasonDrawer — a slide-in Sheet wrapping Overview, Goals, and Procedures tabs
 * for a selected season.
 *
 * Opens from the right side when the user clicks a block on the timeline.
 * Provides progressive disclosure: the timeline shows the big picture,
 * the drawer shows the detail.
 *
 * Contains a "Rediger vekting" button that opens the MachineRoomSheet
 * for budget/factor editing.
 */

"use client";

import { useState } from "react";
import { useTranslation } from "@smartout/i18n";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { SeasonOverviewTab } from "./SeasonOverviewTab";
import { SeasonGoalsTab } from "./SeasonGoalsTab";
import { SeasonProceduresTab } from "./SeasonProceduresTab";
import { SeasonHoursTab } from "./SeasonHoursTab";
import { MachineRoomSheet } from "./MachineRoomSheet";
import { useSeasonBudget } from "../_hooks/use-season-budget";
import { Clock, LayoutDashboard, Target, ShieldCheck, Settings2 } from "lucide-react";
import type { Season } from "../_hooks/use-seasons";

type SeasonDrawerProps = {
  season: Season | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isDark: boolean;
};

type DrawerTab = "overview" | "hours" | "goals" | "procedures";

const DRAWER_TABS: { id: DrawerTab; labelKey: string; icon: typeof LayoutDashboard }[] = [
  { id: "overview", labelKey: "yearWheel.tab_overview", icon: LayoutDashboard },
  { id: "hours", labelKey: "yearWheel.tab_hours", icon: Clock },
  { id: "goals", labelKey: "yearWheel.tab_goals", icon: Target },
  { id: "procedures", labelKey: "yearWheel.tab_procedures", icon: ShieldCheck },
];

export function SeasonDrawer({ season, open, onOpenChange, isDark }: SeasonDrawerProps) {
  const { t } = useTranslation("dashboard");
  const [activeTab, setActiveTab] = useState<DrawerTab>("overview");
  const [machineRoomOpen, setMachineRoomOpen] = useState(false);

  const { budget } = useSeasonBudget(season?.season_id ?? null);

  if (!season) return null;

  const statusLabel =
    season.status === "active" ? "Aktiv" : season.status === "draft" ? "Utkast" : "Arkivert";

  const statusColor =
    season.status === "active"
      ? "text-emerald-500"
      : season.status === "draft"
        ? "text-amber-500"
        : "text-zinc-500";

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          className={`w-full overflow-y-auto sm:max-w-xl ${
            isDark ? "border-zinc-800 bg-zinc-950" : "border-zinc-200 bg-white"
          }`}
        >
          <SheetHeader className="border-b border-zinc-800/50 pb-4">
            <div className="flex items-center gap-3">
              <SheetTitle
                className={`font-heading text-lg ${isDark ? "text-white" : "text-zinc-900"}`}
              >
                {season.name}
              </SheetTitle>
              <span className={`text-xs font-bold tracking-wide uppercase ${statusColor}`}>
                {statusLabel}
              </span>
            </div>
            <SheetDescription className={`text-xs ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>
              {season.start_date && season.end_date
                ? `${new Date(season.start_date).toLocaleDateString("nb-NO")} – ${new Date(season.end_date).toLocaleDateString("nb-NO")}`
                : "Ingen datoer satt"}
            </SheetDescription>
          </SheetHeader>

          {/* Drawer tab navigation */}
          <div className="mt-4 mb-4 flex gap-1">
            {DRAWER_TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                    isActive
                      ? isDark
                        ? "bg-zinc-800 text-white"
                        : "bg-zinc-100 text-zinc-900"
                      : isDark
                        ? "text-zinc-500 hover:text-white"
                        : "text-zinc-400 hover:text-zinc-900"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {t(tab.labelKey)}
                </button>
              );
            })}
          </div>

          {/* "Rediger vekting" button — opens the Machine Room */}
          {budget && (
            <button
              onClick={() => setMachineRoomOpen(true)}
              className={`mb-4 flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
                isDark
                  ? "border-zinc-800 text-zinc-400 hover:bg-zinc-800 hover:text-white"
                  : "border-zinc-200 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
              }`}
            >
              <Settings2 className="h-3.5 w-3.5" />
              Rediger vekting
            </button>
          )}

          {/* Tab content */}
          <div className="pb-8">
            {activeTab === "overview" &&
              (budget ? (
                <SeasonOverviewTab
                  seasonId={season.season_id}
                  seasonBudgetId={budget.season_budget_id}
                  seasonStartDate={season.start_date}
                  seasonEndDate={season.end_date}
                  isDark={isDark}
                />
              ) : (
                <p
                  className={`py-8 text-center text-sm ${isDark ? "text-zinc-600" : "text-zinc-400"}`}
                >
                  {t("yearWheel.empty_budget")}
                </p>
              ))}
            {activeTab === "hours" && <SeasonHoursTab seasonId={season.season_id} />}
            {activeTab === "goals" && (
              <SeasonGoalsTab seasonId={season.season_id} isDark={isDark} />
            )}
            {activeTab === "procedures" && (
              <SeasonProceduresTab seasonId={season.season_id} isDark={isDark} />
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Machine Room — nested Sheet for budget/factor editing */}
      {budget && (
        <MachineRoomSheet
          seasonId={season.season_id}
          seasonBudgetId={budget.season_budget_id}
          budgetStatus={budget.status}
          open={machineRoomOpen}
          onOpenChange={setMachineRoomOpen}
          isDark={isDark}
        />
      )}
    </>
  );
}
