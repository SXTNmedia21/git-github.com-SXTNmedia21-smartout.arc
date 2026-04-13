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
};

export function MachineRoomSheet({
  seasonId,
  seasonBudgetId,
  budgetStatus,
  open,
  onOpenChange,
}: MachineRoomSheetProps) {
  const { t } = useTranslation("dashboard");
  const isReadOnly = budgetStatus === "locked";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="border-border bg-card w-full overflow-y-auto sm:max-w-2xl"
      >
        <SheetHeader className="border-border/50 border-b pb-4">
          <SheetTitle className="font-heading text-card-foreground text-lg">
            {t("yearWheel.machine_room")}
          </SheetTitle>
          <SheetDescription className="text-muted-foreground text-xs">
            {t("yearWheel.machine_room_description")}
          </SheetDescription>
        </SheetHeader>

        <Accordion type="multiple" defaultValue={["budget"]} className="mt-4">
          <AccordionItem value="budget">
            <AccordionTrigger className="text-foreground text-sm font-medium">
              <span className="flex items-center gap-2">
                <Target className="h-4 w-4" />
                {t("yearWheel.tab_budget")}
              </span>
            </AccordionTrigger>
            <AccordionContent>
              <BudgetSetupTab seasonId={seasonId} />
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="day-factors">
            <AccordionTrigger className="text-foreground text-sm font-medium">
              <span className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                {t("yearWheel.tab_day_factors")}
              </span>
            </AccordionTrigger>
            <AccordionContent>
              <DayFactorsTab seasonBudgetId={seasonBudgetId} isReadOnly={isReadOnly} />
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="hour-factors">
            <AccordionTrigger className="text-foreground text-sm font-medium">
              <span className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                {t("yearWheel.tab_hour_factors")}
              </span>
            </AccordionTrigger>
            <AccordionContent>
              <HourFactorsTab seasonBudgetId={seasonBudgetId} isReadOnly={isReadOnly} />
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </SheetContent>
    </Sheet>
  );
}
