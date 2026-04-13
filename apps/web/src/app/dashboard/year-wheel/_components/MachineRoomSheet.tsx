/**
 * MachineRoomSheet — the budget/factor editing interface behind progressive disclosure.
 *
 * Opened from the SeasonDrawer via "Rediger vekting" button.
 * Contains three collapsible sections: Budget, Day Factors, Hour Factors.
 * This is the "technical" layer that most users won't need daily,
 * but managers can access when configuring season parameters.
 *
 * Uses Accordion instead of nested Sheet to avoid Radix Dialog focus trap conflicts
 * (per council recommendation about nested Sheet risk).
 */

"use client";

import { useTranslation } from "@smartout/i18n";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { BudgetSetupTab } from "./BudgetSetupTab";
import { DayFactorsTab } from "./DayFactorsTab";
import { HourFactorsTab } from "./HourFactorsTab";
import { Target, BarChart3, Clock } from "lucide-react";

type MachineRoomSheetProps = {
  seasonId: string;
  seasonBudgetId: string;
  budgetStatus: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isDark: boolean;
};

export function MachineRoomSheet({
  seasonId,
  seasonBudgetId,
  budgetStatus,
  open,
  onOpenChange,
  isDark,
}: MachineRoomSheetProps) {
  const { t } = useTranslation("dashboard");
  const isReadOnly = budgetStatus === "locked";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className={`w-full overflow-y-auto sm:max-w-2xl ${
          isDark ? "border-zinc-800 bg-zinc-950" : "border-zinc-200 bg-white"
        }`}
      >
        <SheetHeader className="border-b border-zinc-800/50 pb-4">
          <SheetTitle className={`font-heading text-lg ${isDark ? "text-white" : "text-zinc-900"}`}>
            Maskinrom
          </SheetTitle>
          <SheetDescription className={`text-xs ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>
            Budsjett, dagfaktorer og timefaktorer for sesongen.
          </SheetDescription>
        </SheetHeader>

        <Accordion type="multiple" defaultValue={["budget"]} className="mt-4">
          <AccordionItem value="budget">
            <AccordionTrigger
              className={`text-sm font-medium ${isDark ? "text-zinc-300" : "text-zinc-700"}`}
            >
              <span className="flex items-center gap-2">
                <Target className="h-4 w-4" />
                {t("yearWheel.tab_budget")}
              </span>
            </AccordionTrigger>
            <AccordionContent>
              <BudgetSetupTab seasonId={seasonId} isDark={isDark} />
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="day-factors">
            <AccordionTrigger
              className={`text-sm font-medium ${isDark ? "text-zinc-300" : "text-zinc-700"}`}
            >
              <span className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                {t("yearWheel.tab_day_factors")}
              </span>
            </AccordionTrigger>
            <AccordionContent>
              <DayFactorsTab
                seasonBudgetId={seasonBudgetId}
                isDark={isDark}
                isReadOnly={isReadOnly}
              />
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="hour-factors">
            <AccordionTrigger
              className={`text-sm font-medium ${isDark ? "text-zinc-300" : "text-zinc-700"}`}
            >
              <span className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                {t("yearWheel.tab_hour_factors")}
              </span>
            </AccordionTrigger>
            <AccordionContent>
              <HourFactorsTab
                seasonBudgetId={seasonBudgetId}
                isDark={isDark}
                isReadOnly={isReadOnly}
              />
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </SheetContent>
    </Sheet>
  );
}
