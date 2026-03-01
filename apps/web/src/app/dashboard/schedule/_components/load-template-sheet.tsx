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

import type { Shift, ShiftTemplate } from "./schedule-types";
import { useShifts } from "../_hooks/use-shifts";
import { useTemplates, useLoadTemplate } from "../_hooks/use-templates";
import { useWeekRange } from "../_hooks/use-week-range";

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
  const { weekStart, weekEnd } = useWeekRange();
  const { data: shifts = [] as Shift[] } = useShifts(weekStart, weekEnd);
  const { data: templates = [] as ShiftTemplate[] } = useTemplates();
  const loadTemplateMutation = useLoadTemplate(weekStart);

  // Confirmation dialog state for conflict warning
  const [confirmTemplateId, setConfirmTemplateId] = useState<string | null>(null);

  const existingShifts = shifts.filter((s) => s.dateId === dateId);
  const hasExistingShifts = existingShifts.length > 0;

  // Group templates by department
  const grouped = templates.reduce<Record<string, typeof templates>>((acc, template) => {
    const dept = template.department || "Ingen avdeling";
    if (!acc[dept]) acc[dept] = [];
    acc[dept].push(template);
    return acc;
  }, {});

  /**
   * Computes the time range string for a template's shifts.
   * Finds the earliest start and latest end across all shifts.
   */
  function getTimeRange(templateShifts: (typeof templates)[number]["shifts"]): string {
    if (templateShifts.length === 0) return "--";
    const starts = templateShifts.map((s) => s.startTime).sort();
    const ends = templateShifts.map((s) => s.endTime).sort();
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

  /** Loads template shifts as real shifts and closes the sheet. */
  function applyTemplate(templateId: string) {
    const template = templates.find((t) => t.id === templateId);
    if (!template) return;

    const newShifts = template.shifts.map((s) => ({
      id: `shift_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      employeeId: s.employeeId,
      dateId,
      role: s.role,
      startTime: s.startTime,
      endTime: s.endTime,
      workHours: s.workHours,
      status: "created" as const,
      dayCategory: s.dayCategory,
      zone: s.zone,
      indicator: s.indicator,
      isPublished: false,
      breaks: s.breaks,
      notes: s.notes,
    }));

    loadTemplateMutation.mutate({ template, shifts: newShifts });
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
            <SheetDescription>Velg en mal for a legge til vakter pa denne dagen.</SheetDescription>
          </SheetHeader>

          <ScrollArea className="mt-6 h-[calc(100vh-10rem)]">
            {templates.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <BookOpen className="text-muted-foreground/50 mb-3 h-10 w-10" />
                <p className="text-muted-foreground text-sm">Ingen maler lagret enna.</p>
                <p className="text-muted-foreground/70 text-xs">
                  Bruk &quot;Lagre som mal&quot; fra dagmenyen for a opprette en.
                </p>
              </div>
            ) : (
              <div className="space-y-6 pr-4">
                {Object.entries(grouped).map(([dept, templates]) => (
                  <div key={dept}>
                    <h3 className="text-muted-foreground mb-3 text-xs font-medium tracking-wider uppercase">
                      {dept}
                    </h3>

                    <div className="space-y-2">
                      {templates.map((template) => (
                        <div
                          key={template.id}
                          className="border-border hover:bg-muted/50 flex items-center justify-between rounded-lg border p-3 transition-colors"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="text-foreground truncate text-sm font-medium">
                              {template.name}
                            </p>
                            <div className="text-muted-foreground mt-1 flex items-center gap-3 text-xs">
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
              {existingShifts.length === 1 ? "vakt" : "vakter"}. Malen vil legge til nye vakter i
              tillegg til de eksisterende.
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
