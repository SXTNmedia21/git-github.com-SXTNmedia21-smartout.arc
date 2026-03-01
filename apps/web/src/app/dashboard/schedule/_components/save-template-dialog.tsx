// ============================================
// save-template-dialog.tsx
// Dialog for saving the shifts of a specific day as a reusable template.
// MODULE_03 §13.1: Templates can optionally include staff assignments.
// Connected to: schedule-context.tsx (SAVE_DAY_AS_TEMPLATE action)
// Connected to: day-context-menu.tsx (opens this dialog)
// ============================================
"use client";

import { useState } from "react";

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

import { useSchedule } from "./schedule-context";

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
  const { dispatch, computed } = useSchedule();

  const [name, setName] = useState("");
  const [department, setDepartment] = useState("");
  const [includeAssignments, setIncludeAssignments] = useState(false);

  const dayShifts = computed.getShiftsForDay(dateId);
  const shiftCount = dayShifts.length;

  /** Resets form fields to defaults. */
  function resetForm() {
    setName("");
    setDepartment("");
    setIncludeAssignments(false);
  }

  /** Dispatches the save action and closes the dialog. */
  function handleSave() {
    if (!name.trim()) return;

    dispatch({
      type: "SAVE_DAY_AS_TEMPLATE",
      payload: {
        dateId,
        name: name.trim(),
        department: department.trim(),
        includeAssignments,
      },
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Lagre dag som mal</DialogTitle>
          <DialogDescription>
            Lagre dagens {shiftCount} {shiftCount === 1 ? "vakt" : "vakter"} som en
            gjenbrukbar mal.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
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
          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <div className="space-y-0.5">
              <Label htmlFor="include-staff">Inkluder ansattilordninger</Label>
              <p className="text-xs text-muted-foreground">
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
          <div className="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
            {shiftCount} {shiftCount === 1 ? "vakt" : "vakter"} vil bli lagret i malen
            {includeAssignments ? " med ansattilordninger" : ""}.
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Avbryt
          </Button>
          <Button onClick={handleSave} disabled={!name.trim()}>
            Lagre mal
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
