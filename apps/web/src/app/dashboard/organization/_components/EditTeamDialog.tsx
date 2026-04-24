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
import type { TeamRow, DepartmentRow } from "./types";
import { COLOR_PRESETS, toSlug } from "./types";
import { TEAM_TYPE_CONFIG } from "./constants";

type EditTeamDialogProps = {
  team: TeamRow;
  departments: DepartmentRow[];
  isDark: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: () => Promise<void>;
};

export function EditTeamDialog({
  team,
  departments,
  isDark,
  open,
  onOpenChange,
  onSave,
}: EditTeamDialogProps) {
  const [name, setName] = useState(team.name);
  const [description, setDescription] = useState(team.description ?? "");
  const [teamType, setTeamType] = useState(team.team_type);
  const [departmentId, setDepartmentId] = useState(team.department_id ?? "");
  const [selectedColor, setSelectedColor] = useState<string | null>(team.color);
  const [saving, setSaving] = useState(false);

  const inputClass =
    "w-full rounded-lg border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground transition-all focus:border-orange-500/50 focus:outline-none focus:ring-1 focus:ring-orange-500/50";

  const labelClass =
    "mb-1.5 block text-xs font-semibold tracking-wider uppercase text-muted-foreground";

  async function handleSave() {
    if (!name.trim()) {
      toast.error("Team name is required");
      return;
    }

    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("team")
      .update({
        name: name.trim(),
        slug: toSlug(name),
        description: description.trim() || null,
        team_type: teamType as
          | "operational"
          | "access"
          | "cross_department"
          | "seasonal"
          | "custom",
        department_id: departmentId || null,
        color: selectedColor,
      })
      .eq("team_id", team.team_id);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success(`Team "${name.trim()}" updated`);
      onOpenChange(false);
      await onSave();
    }
    setSaving(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-border bg-background text-foreground">
        <DialogHeader>
          <DialogTitle>Edit Team</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Update team details.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <label className={labelClass}>Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Morning Shift, A-Team"
              className={inputClass}
              autoFocus
            />
          </div>

          <div>
            <label className={labelClass}>Team Type *</label>
            <select
              value={teamType}
              onChange={(e) => setTeamType(e.target.value)}
              className={`${inputClass} appearance-none`}
            >
              {Object.entries(TEAM_TYPE_CONFIG).map(([key, config]) => (
                <option key={key} value={key}>
                  {config.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClass}>Department (optional)</label>
            <select
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value)}
              className={`${inputClass} appearance-none`}
            >
              <option value="">No department (cross-cutting)</option>
              {departments
                .filter((d) => d.is_active)
                .map((d) => (
                  <option key={d.department_id} value={d.department_id}>
                    {d.name}
                  </option>
                ))}
            </select>
          </div>

          <div>
            <label className={labelClass}>Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this team responsible for?"
              rows={2}
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>Color</label>
            <div className="flex gap-2">
              {COLOR_PRESETS.map((color) => (
                <button
                  key={color}
                  onClick={() => setSelectedColor(selectedColor === color ? null : color)}
                  className={`h-7 w-7 rounded-full transition-all ${
                    selectedColor === color ? "ring-2 ring-white ring-offset-2" : "hover:scale-110"
                  }`}
                  style={{
                    backgroundColor: color,
                    ["--tw-ring-offset-color" as string]: isDark ? "#09090b" : "#ffffff",
                  }}
                />
              ))}
            </div>
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
            disabled={saving || !name.trim()}
            className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-orange-500 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
