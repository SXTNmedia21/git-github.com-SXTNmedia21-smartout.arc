// ============================================
// absence-popover.tsx
// Register absence directly from grid cell popover.
// MODULE_03 §7: Fravær popover — register absence
// from the grid, not only via the shift modal.
// Connected to: schedule-context.tsx (dispatch ADD_ABSENCE)
// Connected to: daily-grid.tsx (trigger from cell right-click)
// ============================================
"use client";

import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useScheduleUI } from "./schedule-ui-context";
import { useCreateAbsence } from "../_hooks/use-absences";
import { useWeekRange } from "../_hooks/use-week-range";
import type { AbsenceType } from "./schedule-types";

/** Norwegian labels for absence types */
const ABSENCE_OPTIONS: { value: AbsenceType; label: string }[] = [
  { value: "sick_leave", label: "Sykdom" },
  { value: "parental_leave", label: "Foreldrepermisjon" },
  { value: "vacation", label: "Ferie" },
  { value: "unpaid_leave", label: "Ulønnet permisjon" },
  { value: "military", label: "Militærtjeneste" },
  { value: "training", label: "Opplæring" },
  { value: "welfare", label: "Velferdspermisjon" },
];

/**
 * Popover for registering absence on a specific employee + day cell.
 * Opens when state.absencePopover is set.
 * Dispatches ADD_ABSENCE which auto-removes conflicting shifts.
 */
export function AbsencePopover() {
  const { absencePopover, setAbsencePopover } = useScheduleUI();
  const { weekStart } = useWeekRange();
  const createAbsence = useCreateAbsence(weekStart);
  const [absenceType, setAbsenceType] = useState<AbsenceType>("sick_leave");
  const [isFullDay, setIsFullDay] = useState(true);
  const [reason, setReason] = useState("");

  const isOpen = absencePopover !== null;

  /**
   * Handles form submission.
   * Creates absence and closes popover.
   */
  const handleSubmit = () => {
    if (!absencePopover) return;

    const nowStr = new Date().toISOString();
    createAbsence.mutate({
      id: crypto.randomUUID(),
      employeeId: absencePopover.employeeId,
      dateId: absencePopover.dateId,
      type: absenceType,
      reason: reason || undefined,
      startDate: nowStr,
      endDate: nowStr,
      isFullDay,
      status: "approved",
    });

    // Reset form
    setAbsenceType("sick_leave");
    setIsFullDay(true);
    setReason("");
    setAbsencePopover(null);
  };

  const handleClose = () => {
    setAbsencePopover(null);
  };

  return (
    <Popover open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      {/* Invisible trigger — popover is controlled programmatically */}
      <PopoverTrigger asChild>
        <span />
      </PopoverTrigger>
      <PopoverContent className="border-border bg-background w-72 space-y-4 p-4">
        <h4 className="text-foreground text-sm font-bold">Registrer fravær</h4>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-muted-foreground text-xs">Type fravær</Label>
            <Select value={absenceType} onValueChange={(v) => setAbsenceType(v as AbsenceType)}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ABSENCE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value} className="text-xs">
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between">
            <Label className="text-muted-foreground text-xs">Hele dagen</Label>
            <Switch checked={isFullDay} onCheckedChange={setIsFullDay} />
          </div>

          <div className="space-y-1.5">
            <Label className="text-muted-foreground text-xs">Grunn (valgfritt)</Label>
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Legg til grunn..."
              className="h-8 text-xs"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={handleClose}>
            Avbryt
          </Button>
          <Button size="sm" className="h-7 text-xs" onClick={handleSubmit}>
            Registrer
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
