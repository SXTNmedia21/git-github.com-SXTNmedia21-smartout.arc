// ============================================
// edit-template-dialog.tsx
// Dialog for editing an existing shift template.
// Pre-fills form state from the template prop and dispatches
// UPDATE_TEMPLATE on save or DELETE_TEMPLATE on delete.
// Connected to: schedule-context.tsx (dispatch UPDATE_TEMPLATE, DELETE_TEMPLATE)
// Connected to: page.tsx sidebar (triggered by clicking a TemplateCard)
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

type EditTemplateDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: ShiftTemplate;
};

/**
 * Dialog for editing an existing shift template.
 * Pre-fills form fields from the provided template.
 * Dispatches UPDATE_TEMPLATE on save and DELETE_TEMPLATE on delete.
 *
 * @param open - Whether the dialog is visible
 * @param onOpenChange - Callback to toggle dialog visibility
 * @param template - The template to edit
 */
export function EditTemplateDialog({ open, onOpenChange, template }: EditTemplateDialogProps) {
  const { dispatch } = useSchedule();

  // Pre-fill form state from existing template
  const [name, setName] = useState(template.name);
  const [department, setDepartment] = useState(template.department);
  const [shifts, setShifts] = useState<TemplateShiftRow[]>(
    template.shifts.map((s) => ({
      role: s.role,
      startTime: s.startTime,
      endTime: s.endTime,
    })),
  );
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

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
    let startMinutes = (startParts[0] ?? 0) * 60 + (startParts[1] ?? 0);
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

  /** Validates and submits the updated template. */
  const handleSubmit = () => {
    if (!name.trim() || !department.trim()) return;
    const validShifts = shifts.filter((s) => s.role.trim());
    if (validShifts.length === 0) return;

    dispatch({
      type: "UPDATE_TEMPLATE",
      payload: {
        id: template.id,
        changes: {
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
        },
      },
    });
    onOpenChange(false);
  };

  /** Deletes the template after confirmation. */
  const handleDelete = () => {
    dispatch({ type: "DELETE_TEMPLATE", payload: { id: template.id } });
    onOpenChange(false);
  };

  const isValid = name.trim() && department.trim() && shifts.some((s) => s.role.trim());

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-border bg-background sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-foreground">Rediger mal</DialogTitle>
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

        <DialogFooter className="flex items-center justify-between sm:justify-between">
          {/* Delete button on the left side of the footer */}
          <div>
            {showDeleteConfirm ? (
              <div className="flex items-center gap-2">
                <span className="text-destructive text-xs font-medium">Slett malen?</span>
                <Button variant="destructive" size="sm" onClick={handleDelete}>
                  Bekreft
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setShowDeleteConfirm(false)}>
                  Avbryt
                </Button>
              </div>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={() => setShowDeleteConfirm(true)}
              >
                <Trash2 className="mr-1 h-3.5 w-3.5" /> Slett
              </Button>
            )}
          </div>

          {/* Save/cancel on the right side */}
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
              Avbryt
            </Button>
            <Button size="sm" onClick={handleSubmit} disabled={!isValid}>
              Lagre endringer
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
