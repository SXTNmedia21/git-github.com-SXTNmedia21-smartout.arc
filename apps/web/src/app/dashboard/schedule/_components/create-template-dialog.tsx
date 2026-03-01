// ============================================
// create-template-dialog.tsx
// Dialog for creating a new shift template from scratch.
// Templates are reusable day patterns that can be dragged
// onto day headers or employee cells to populate shifts.
// Connected to: schedule-context.tsx (dispatch ADD_TEMPLATE)
// Connected to: page.tsx sidebar (trigger from "Opprett ny mal" button)
// ============================================
"use client";

import { useState } from "react";
import { Trash2, Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSchedule } from "./schedule-context";
import type { ShiftTemplate } from "./schedule-types";

type TemplateShiftRow = {
  role: string;
  startTime: string;
  endTime: string;
};

type CreateTemplateDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/**
 * Dialog for creating a new shift template from scratch.
 * Users specify a name, department, and a dynamic list of shifts
 * (role + start/end time per row). Separate from SaveTemplateDialog
 * which saves FROM an existing day.
 */
export function CreateTemplateDialog({ open, onOpenChange }: CreateTemplateDialogProps) {
  const { dispatch } = useSchedule();

  const [name, setName] = useState("");
  const [department, setDepartment] = useState("");
  const [shifts, setShifts] = useState<TemplateShiftRow[]>([
    { role: "", startTime: "08:00", endTime: "16:00" },
  ]);

  /** Resets form fields to defaults. */
  const resetForm = () => {
    setName("");
    setDepartment("");
    setShifts([{ role: "", startTime: "08:00", endTime: "16:00" }]);
  };

  /** Adds a blank shift row to the list. */
  const addShiftRow = () => {
    setShifts((prev) => [...prev, { role: "", startTime: "08:00", endTime: "16:00" }]);
  };

  /** Removes a shift row by index. */
  const removeShiftRow = (index: number) => {
    setShifts((prev) => prev.filter((_, i) => i !== index));
  };

  /** Updates a field on a specific shift row. */
  const updateShiftRow = (index: number, field: keyof TemplateShiftRow, value: string) => {
    setShifts((prev) => prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)));
  };

  /**
   * Calculates work hours from start and end time strings.
   * Handles overnight shifts (end < start).
   */
  const calculateWorkHours = (startTime: string, endTime: string): number => {
    const startParts = startTime.split(":").map(Number);
    const endParts = endTime.split(":").map(Number);
    const startMinutes = (startParts[0] ?? 0) * 60 + (startParts[1] ?? 0);
    let endMinutes = (endParts[0] ?? 0) * 60 + (endParts[1] ?? 0);
    if (endMinutes <= startMinutes) endMinutes += 24 * 60;
    return Math.max(0, (endMinutes - startMinutes) / 60);
  };

  /**
   * Determines day category from start time.
   */
  const inferDayCategory = (
    startTime: string,
  ): "morning" | "midday" | "afternoon" | "evening" | "night" => {
    const hour = parseInt(startTime.split(":")[0] ?? "0", 10);
    if (hour < 6) return "night";
    if (hour < 11) return "morning";
    if (hour < 14) return "midday";
    if (hour < 17) return "afternoon";
    if (hour < 22) return "evening";
    return "night";
  };

  /** Validates and submits the template. */
  const handleSubmit = () => {
    if (!name.trim() || !department.trim()) return;
    const validShifts = shifts.filter((s) => s.role.trim());
    if (validShifts.length === 0) return;

    const template: ShiftTemplate = {
      id: `tmpl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      name: name.trim(),
      department: department.trim(),
      shifts: validShifts.map((s) => ({
        employeeId: null,
        role: s.role.trim(),
        time: `${s.startTime} - ${s.endTime}`,
        startTime: s.startTime,
        endTime: s.endTime,
        workHours: calculateWorkHours(s.startTime, s.endTime),
        status: "created" as const,
        dayCategory: inferDayCategory(s.startTime),
        indicator: "orange",
        breaks: 30,
      })),
      includeAssignments: false,
      createdBy: "System",
      createdAt: new Date().toISOString(),
    };

    dispatch({ type: "ADD_TEMPLATE", payload: template });
    resetForm();
    onOpenChange(false);
  };

  const isValid = name.trim() && department.trim() && shifts.some((s) => s.role.trim());

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-border bg-background sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-foreground">Opprett ny mal</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Navn</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="F.eks. Åpningsvakt"
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Avdeling</Label>
              <Input
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                placeholder="F.eks. Kjøkken"
                className="h-8 text-sm"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs">Vakter i malen</Label>
            {shifts.map((row, index) => (
              <div key={index} className="flex items-center gap-2">
                <Input
                  value={row.role}
                  onChange={(e) => updateShiftRow(index, "role", e.target.value)}
                  placeholder="Rolle"
                  className="h-8 flex-1 text-sm"
                />
                <Input
                  type="time"
                  value={row.startTime}
                  onChange={(e) => updateShiftRow(index, "startTime", e.target.value)}
                  className="h-8 w-24 text-sm"
                />
                <Input
                  type="time"
                  value={row.endTime}
                  onChange={(e) => updateShiftRow(index, "endTime", e.target.value)}
                  className="h-8 w-24 text-sm"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-muted-foreground hover:text-destructive h-8 w-8 shrink-0"
                  onClick={() => removeShiftRow(index)}
                  disabled={shifts.length === 1}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              className="h-7 w-full text-xs"
              onClick={addShiftRow}
            >
              <Plus className="mr-1 h-3 w-3" /> Legg til vakt
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Avbryt
          </Button>
          <Button size="sm" onClick={handleSubmit} disabled={!isValid}>
            Opprett mal
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
