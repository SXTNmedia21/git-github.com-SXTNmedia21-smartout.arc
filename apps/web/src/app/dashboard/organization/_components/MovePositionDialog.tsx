import { useState } from "react";
import { createClient } from "@smartout/supabase/client";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import type { PositionRow, DepartmentRow } from "./types";

type MovePositionDialogProps = {
  position: PositionRow;
  departments: DepartmentRow[];
  isDark: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: () => Promise<void>;
};

export function MovePositionDialog({
  position,
  departments,
  isDark: _isDark,
  open,
  onOpenChange,
  onSave,
}: MovePositionDialogProps) {
  const [targetDeptId, setTargetDeptId] = useState(position.department_id);
  const [saving, setSaving] = useState(false);

  const activeDepartments = departments.filter((d) => d.is_active);

  const inputClass =
    "w-full rounded-lg border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground transition-all focus:border-orange-500/50 focus:outline-none focus:ring-1 focus:ring-orange-500/50";

  const labelClass =
    "mb-1.5 block text-xs font-semibold tracking-wider uppercase text-muted-foreground";

  async function handleSave() {
    if (targetDeptId === position.department_id) {
      toast.error("Position is already in this department");
      return;
    }

    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("position")
      .update({ department_id: targetDeptId })
      .eq("position_id", position.position_id);

    if (error) {
      toast.error(error.message);
    } else {
      const targetDept = departments.find((d) => d.department_id === targetDeptId);
      toast.success(`"${position.name}" moved to ${targetDept?.name ?? "department"}`);
      onOpenChange(false);
      await onSave();
    }
    setSaving(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-border bg-background text-foreground">
        <DialogHeader>
          <DialogTitle>Move Position</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Move &ldquo;{position.name}&rdquo; to a different department.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <label className={labelClass}>Target Department *</label>
            <select
              value={targetDeptId}
              onChange={(e) => setTargetDeptId(e.target.value)}
              className={`${inputClass} appearance-none`}
            >
              {activeDepartments.map((dept) => (
                <option key={dept.department_id} value={dept.department_id}>
                  {dept.name}
                  {dept.department_id === position.department_id ? " (current)" : ""}
                </option>
              ))}
            </select>
          </div>
        </div>

        <DialogFooter>
          <button
            onClick={() => onOpenChange(false)}
            className="rounded-lg border border-border bg-muted px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || targetDeptId === position.department_id}
            className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-orange-500 disabled:opacity-50"
          >
            {saving ? "Moving..." : "Move"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
