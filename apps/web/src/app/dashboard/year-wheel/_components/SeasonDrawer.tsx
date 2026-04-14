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
import { useSeasonBudget } from "../_hooks";
import { Clock, LayoutDashboard, Target, ShieldCheck, Settings2 } from "lucide-react";
import type { Season } from "../_hooks";

type SeasonDrawerProps = {
  season: Season | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

type DrawerTab = "overview" | "hours" | "goals" | "procedures";

const DRAWER_TABS: { id: DrawerTab; labelKey: string; icon: typeof LayoutDashboard }[] = [
  { id: "overview", labelKey: "yearWheel.tab_overview", icon: LayoutDashboard },
  { id: "hours", labelKey: "yearWheel.tab_hours", icon: Clock },
  { id: "goals", labelKey: "yearWheel.tab_goals", icon: Target },
  { id: "procedures", labelKey: "yearWheel.tab_procedures", icon: ShieldCheck },
];

export function SeasonDrawer({ season, open, onOpenChange }: SeasonDrawerProps) {
  const { t } = useTranslation("dashboard");
  const [activeTab, setActiveTab] = useState<DrawerTab>("overview");
  const [machineRoomOpen, setMachineRoomOpen] = useState(false);

  const { budget } = useSeasonBudget(season?.season_id ?? null);

  if (!season) return null;

  const statusLabel =
    season.status === "active"
      ? t("yearWheel.active")
      : season.status === "draft"
        ? t("yearWheel.draft")
        : t("yearWheel.archived");

  // Semantic color per status — uses CSS variable tokens
  const statusColor =
    season.status === "active"
      ? "text-success"
      : season.status === "draft"
        ? "text-warning"
        : "text-muted-foreground";

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          className="border-border bg-card w-full overflow-y-auto sm:max-w-xl"
        >
          <SheetHeader className="border-border/50 border-b pb-4">
            <div className="flex items-center gap-3">
              <SheetTitle className="font-heading text-card-foreground text-lg">
                {season.name}
              </SheetTitle>
              <span className={`text-xs font-bold tracking-wide uppercase ${statusColor}`}>
                {statusLabel}
              </span>
            </div>
            <SheetDescription className="text-muted-foreground text-xs">
              {season.start_date && season.end_date
                ? `${new Date(season.start_date).toLocaleDateString("nb-NO")} – ${new Date(season.end_date).toLocaleDateString("nb-NO")}`
                : t("yearWheel.no_dates_set")}
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
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
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
              className="border-border text-muted-foreground hover:bg-accent hover:text-accent-foreground mb-4 flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition-colors"
            >
              <Settings2 className="h-3.5 w-3.5" />
              {t("yearWheel.edit_weighting")}
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
                />
              ) : (
                <p className="text-muted-foreground py-8 text-center text-sm">
                  {t("yearWheel.empty_budget")}
                </p>
              ))}
            {activeTab === "hours" && <SeasonHoursTab seasonId={season.season_id} />}
            {activeTab === "goals" && <SeasonGoalsTab seasonId={season.season_id} />}
            {activeTab === "procedures" && <SeasonProceduresTab seasonId={season.season_id} />}
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
        />
      )}
    </>
  );
}
