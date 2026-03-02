// ============================================
// open-shift-dialog.tsx
// Dialog for creating a new open (unassigned) shift.
// Open shifts appear in the sidebar and can be
// dragged onto employee cells to assign them.
// Connected to: schedule-context.tsx (dispatch ADD_OPEN_SHIFT)
// Connected to: page.tsx sidebar (trigger from "+" button)
// ============================================
"use client";

import { useState } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCreateOpenShift } from "../_hooks/use-open-shifts";
import type { DayCategory } from "./schedule-types";

type OpenShiftDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/**
 * Dialog for creating a new open shift.
 * An open shift is unassigned and appears in the sidebar
 * until dragged onto an employee cell.
 */
export function OpenShiftDialog({ open, onOpenChange }: OpenShiftDialogProps) {
  const createOpenShift = useCreateOpenShift();

  const [title, setTitle] = useState("");
  const [role, setRole] = useState("");
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("16:00");
  const [department, setDepartment] = useState("");
  const [dayCategory, setDayCategory] = useState<DayCategory>("morning");

  /**
   * Resets form fields to defaults.
   */
  const resetForm = () => {
    setTitle("");
    setRole("");
    setStartTime("08:00");
    setEndTime("16:00");
    setDepartment("");
    setDayCategory("morning");
  };

  /**
   * Validates and submits the open shift.
   */
  const handleSubmit = () => {
    if (!title.trim()) return;

    createOpenShift.mutate({
      id: crypto.randomUUID(),
      title: title.trim(),
      startTime,
      endTime,
      department: department || undefined,
      role: role || undefined,
      dayCategory,
    });

    resetForm();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-border bg-background sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-foreground">Opprett åpen vakt</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Tittel</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="F.eks. Ekstra servitør"
              className="h-8 text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Rolle</Label>
            <Input
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder="F.eks. Servitør"
              className="h-8 text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Starttid</Label>
              <Input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Sluttid</Label>
              <Input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="h-8 text-sm"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Avdeling</Label>
            <Input
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              placeholder="F.eks. Sal & Service"
              className="h-8 text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Dagkategori</Label>
            <Select value={dayCategory} onValueChange={(v) => setDayCategory(v as DayCategory)}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="morning">Morgen</SelectItem>
                <SelectItem value="midday">Midt på dagen</SelectItem>
                <SelectItem value="afternoon">Ettermiddag</SelectItem>
                <SelectItem value="evening">Kveld</SelectItem>
                <SelectItem value="night">Natt</SelectItem>
                <SelectItem value="weekend">Helg</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Avbryt
          </Button>
          <Button size="sm" onClick={handleSubmit} disabled={!title.trim()}>
            Opprett
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
