// ============================================
// save-template-dialog.tsx
// Dialog for saving the shifts of a specific day as a reusable template.
// MODULE_03 §13.1: Templates can optionally include staff assignments.
// Connected to: schedule-context.tsx (SAVE_DAY_AS_TEMPLATE action)
// Connected to: day-context-menu.tsx (opens this dialog)
// ============================================
"use client";

import { useContext, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

import { DashboardContext } from "@/components/dashboard/DashboardShell";

import type { Shift } from "./schedule-types";
import { useShifts } from "../_hooks/use-shifts";
import { useSaveTemplate } from "../_hooks/use-templates";
import { useWeekRange } from "../_hooks/use-week-range";

// ── Props ───────────────────────────────────────────────────

type SaveTemplateDialogProps = {
  dateId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/**
 * Dialog for saving a day's shifts as a reusable template.
 * Shows a name field, department field, staff-inclusion toggle,
 * and a preview of how many shifts will be saved.
 *
 * @param dateId - The day to save as template
 * @param open - Controlled open state
 * @param onOpenChange - Callback when open state changes
 * @returns shadcn Dialog component
 */
export function SaveTemplateDialog({ dateId, open, onOpenChange }: SaveTemplateDialogProps) {
  const { weekStart, weekEnd } = useWeekRange();
  const { data: shifts = [] as Shift[] } = useShifts(weekStart, weekEnd);
  const saveTemplateMutation = useSaveTemplate();
  const { profileId } = useContext(DashboardContext);

  const [name, setName] = useState("");
  const [department, setDepartment] = useState("");
  const [includeAssignments, setIncludeAssignments] = useState(false);

  const dayShifts = shifts.filter((s: Shift) => s.dateId === dateId);
  const shiftCount = dayShifts.length;

  /** Resets form fields to defaults. */
  function resetForm() {
    setName("");
    setDepartment("");
    setIncludeAssignments(false);
  }

  /** Creates a template from the day's shifts and saves via mutation. */
  function handleSave() {
    if (!name.trim()) return;

    const templateShifts = dayShifts.map(
      ({
        id: _id,
        dateId: _dateId,
        createdAt: _c,
        updatedAt: _u,
        isPublished: _p,
        ...rest
      }: Shift) => ({
        ...rest,
        employeeId: includeAssignments ? rest.employeeId : null,
        status: "created" as const,
      }),
    );

    saveTemplateMutation.mutate({
      id: crypto.randomUUID(),
      name: name.trim(),
      department: department.trim(),
      shifts: templateShifts,
      includeAssignments,
      createdBy: profileId ?? "",
    });

    resetForm();
    onOpenChange(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!value) resetForm();
        onOpenChange(value);
      }}
    >
      <DialogContent className="gap-0 p-0 sm:max-w-md">
        <div className="border-border relative overflow-hidden rounded-t-lg border-b px-6 pt-6 pb-4">
          <div className="absolute top-0 left-0 h-1 w-full bg-violet-500" />
          <DialogHeader>
            <DialogTitle>Lagre dag som mal</DialogTitle>
            <DialogDescription>
              Lagre dagens {shiftCount} {shiftCount === 1 ? "vakt" : "vakter"} som en gjenbrukbar
              mal.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="grid gap-4 px-6 py-4">
          {/* Template name */}
          <div className="grid gap-2">
            <Label htmlFor="template-name">Navn</Label>
            <Input
              id="template-name"
              placeholder="F.eks. Standard fredagsvakt"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          {/* Department */}
          <div className="grid gap-2">
            <Label htmlFor="template-dept">Avdeling</Label>
            <Input
              id="template-dept"
              placeholder="F.eks. Kjokken"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
            />
          </div>

          {/* Include staff toggle */}
          <div className="border-border flex items-center justify-between rounded-lg border p-3">
            <div className="space-y-0.5">
              <Label htmlFor="include-staff">Inkluder ansattilordninger</Label>
              <p className="text-muted-foreground text-xs">
                Lagre hvilke ansatte som er tilordnet hver vakt
              </p>
            </div>
            <Switch
              id="include-staff"
              checked={includeAssignments}
              onCheckedChange={setIncludeAssignments}
            />
          </div>

          {/* Preview */}
          <div className="bg-muted/50 text-muted-foreground rounded-lg p-3 text-sm">
            {shiftCount} {shiftCount === 1 ? "vakt" : "vakter"} vil bli lagret i malen
            {includeAssignments ? " med ansattilordninger" : ""}.
          </div>
        </div>

        <DialogFooter className="border-border border-t px-6 py-4">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Avbryt
          </Button>
          <Button
            size="sm"
            className="bg-violet-600 text-white hover:bg-violet-700"
            onClick={handleSave}
            disabled={!name.trim()}
          >
            Lagre mal
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
