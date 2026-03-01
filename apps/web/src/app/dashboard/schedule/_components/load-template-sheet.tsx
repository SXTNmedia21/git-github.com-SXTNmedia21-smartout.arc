// ============================================
// load-template-sheet.tsx
// Sheet (slide from right) for browsing and applying shift templates.
// Templates are grouped by department and show shift details.
// Connected to: schedule-context.tsx (templates state, LOAD_TEMPLATE action)
// Connected to: day-context-menu.tsx (opens this sheet)
// ============================================
"use client";

import { useState } from "react";
import { BookOpen, Clock, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { useSchedule } from "./schedule-context";

// ── Props ───────────────────────────────────────────────────

type LoadTemplateSheetProps = {
  dateId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/**
 * Side sheet for browsing saved shift templates grouped by department.
 * Each template shows name, shift count, and time range.
 * Warns when the target day already has shifts (conflict).
 *
 * @param dateId - The target day to apply the template to
 * @param open - Controlled open state
 * @param onOpenChange - Callback when open state changes
 * @returns shadcn Sheet sliding from the right
 */
export function LoadTemplateSheet({ dateId, open, onOpenChange }: LoadTemplateSheetProps) {
  const { state, dispatch, computed } = useSchedule();

  // Confirmation dialog state for conflict warning
  const [confirmTemplateId, setConfirmTemplateId] = useState<string | null>(null);

  const existingShifts = computed.getShiftsForDay(dateId);
  const hasExistingShifts = existingShifts.length > 0;

  // Group templates by department
  const grouped = state.templates.reduce<Record<string, typeof state.templates>>(
    (acc, template) => {
      const dept = template.department || "Ingen avdeling";
      if (!acc[dept]) acc[dept] = [];
      acc[dept].push(template);
      return acc;
    },
    {},
  );

  /**
   * Computes the time range string for a template's shifts.
   * Finds the earliest start and latest end across all shifts.
   */
  function getTimeRange(shifts: typeof state.templates[number]["shifts"]): string {
    if (shifts.length === 0) return "--";
    const starts = shifts.map((s) => s.startTime).sort();
    const ends = shifts.map((s) => s.endTime).sort();
    return `${starts[0]} - ${ends[ends.length - 1]}`;
  }

  /**
   * Handles the "Bruk mal" button click.
   * Shows a confirmation dialog if the day already has shifts.
   */
  function handleApply(templateId: string) {
    if (hasExistingShifts) {
      setConfirmTemplateId(templateId);
    } else {
      applyTemplate(templateId);
    }
  }

  /** Dispatches LOAD_TEMPLATE and closes the sheet. */
  function applyTemplate(templateId: string) {
    dispatch({
      type: "LOAD_TEMPLATE",
      payload: { templateId, targetDateId: dateId },
    });
    setConfirmTemplateId(null);
    onOpenChange(false);
  }

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              Last inn mal
            </SheetTitle>
            <SheetDescription>
              Velg en mal for a legge til vakter pa denne dagen.
            </SheetDescription>
          </SheetHeader>

          <ScrollArea className="mt-6 h-[calc(100vh-10rem)]">
            {state.templates.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <BookOpen className="mb-3 h-10 w-10 text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">
                  Ingen maler lagret enna.
                </p>
                <p className="text-xs text-muted-foreground/70">
                  Bruk &quot;Lagre som mal&quot; fra dagmenyen for a opprette en.
                </p>
              </div>
            ) : (
              <div className="space-y-6 pr-4">
                {Object.entries(grouped).map(([dept, templates]) => (
                  <div key={dept}>
                    <h3 className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      {dept}
                    </h3>

                    <div className="space-y-2">
                      {templates.map((template) => (
                        <div
                          key={template.id}
                          className="flex items-center justify-between rounded-lg border border-border p-3 transition-colors hover:bg-muted/50"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-foreground">
                              {template.name}
                            </p>
                            <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Users className="h-3 w-3" />
                                {template.shifts.length}{" "}
                                {template.shifts.length === 1 ? "vakt" : "vakter"}
                              </span>
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {getTimeRange(template.shifts)}
                              </span>
                            </div>
                          </div>

                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => handleApply(template.id)}
                          >
                            Bruk mal
                          </Button>
                        </div>
                      ))}
                    </div>

                    <Separator className="mt-4" />
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </SheetContent>
      </Sheet>

      {/* Conflict confirmation dialog */}
      <Dialog
        open={confirmTemplateId !== null}
        onOpenChange={(value) => {
          if (!value) setConfirmTemplateId(null);
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Erstatt eksisterende vakter?</DialogTitle>
            <DialogDescription>
              Denne dagen har allerede {existingShifts.length}{" "}
              {existingShifts.length === 1 ? "vakt" : "vakter"}.
              Malen vil legge til nye vakter i tillegg til de eksisterende.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmTemplateId(null)}>
              Avbryt
            </Button>
            <Button onClick={() => confirmTemplateId && applyTemplate(confirmTemplateId)}>
              Legg til likevel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
