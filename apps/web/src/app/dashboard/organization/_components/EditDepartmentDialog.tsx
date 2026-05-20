import { useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import type { DepartmentRow, ProfileRow } from "./types";
import { COLOR_PRESETS, ICON_PRESETS, toSlug } from "./types";
import { ICON_COMPONENTS } from "./constants";
import { updateDepartmentAction } from "@/app/dashboard/_actions/update-department-action";

type EditDepartmentDialogProps = {
  department: DepartmentRow;
  profiles: ProfileRow[];
  isDark: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: () => Promise<void>;
};

export function EditDepartmentDialog({
  department,
  profiles,
  isDark,
  open,
  onOpenChange,
  onSave,
}: EditDepartmentDialogProps) {
  const [name, setName] = useState(department.name);
  const [description, setDescription] = useState(department.description ?? "");
  const [selectedColor, setSelectedColor] = useState<string | null>(department.color);
  const [selectedIcon, setSelectedIcon] = useState<string | null>(department.icon);
  const [managerProfileId, setManagerProfileId] = useState<string | null>(
    department.manager_profile_id,
  );
  const [saving, setSaving] = useState(false);

  const inputClass =
    "w-full rounded-lg border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground transition-all focus:border-orange-500/50 focus:outline-none focus:ring-1 focus:ring-orange-500/50";

  const labelClass =
    "mb-1.5 block text-xs font-semibold tracking-wider uppercase text-muted-foreground";

  async function handleSave() {
    if (!name.trim()) {
      toast.error("Department name is required");
      return;
    }

    setSaving(true);

    // Server Action path — gated (organization.update_department), workspace-scoped
    // server-side, and emits "department updated" telemetry (council B2 fix).
    // Replaces the former browser-direct supabase.from("department").update() which
    // had no gate, no emit, and no workspace_id pin (ADR-0099, ADR-0134, L-0177).
    const result = await updateDepartmentAction({
      departmentId: department.department_id,
      name: name.trim(),
      slug: toSlug(name),
      description: description.trim() || null,
      color: selectedColor,
      icon: selectedIcon,
      managerProfileId: managerProfileId,
    });

    if (!result.ok) {
      toast.error(result.error);
    } else {
      toast.success(`Department "${name.trim()}" updated`);
      onOpenChange(false);
      await onSave();
    }
    setSaving(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-border bg-background text-foreground">
        <DialogHeader>
          <DialogTitle>Edit Department</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Update department details.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <label className={labelClass}>Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Kitchen, Bar, Service"
              className={inputClass}
              autoFocus
            />
          </div>

          <div>
            <label className={labelClass}>Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What does this department handle?"
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

          <div>
            <label className={labelClass}>Icon</label>
            <div className="grid grid-cols-6 gap-2">
              {ICON_PRESETS.map((preset) => {
                const PresetIcon = ICON_COMPONENTS[preset.key];
                if (!PresetIcon) return null;
                const isSelected = selectedIcon === preset.key;
                return (
                  <button
                    key={preset.key}
                    type="button"
                    onClick={() => setSelectedIcon(isSelected ? null : preset.key)}
                    title={preset.label}
                    className={`flex h-9 w-full items-center justify-center rounded-lg border transition-all ${
                      isSelected
                        ? isDark
                          ? "border-orange-500/50 bg-orange-500/10 text-orange-400"
                          : "border-orange-300 bg-orange-50 text-orange-600"
                        : "border-border bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                    }`}
                  >
                    <PresetIcon className="h-4 w-4" />
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className={labelClass}>Department Manager</label>
            <select
              value={managerProfileId ?? ""}
              onChange={(e) => setManagerProfileId(e.target.value || null)}
              className={`${inputClass} appearance-none`}
            >
              <option value="">No manager assigned</option>
              {profiles.map((p) => (
                <option key={p.profile_id} value={p.profile_id}>
                  {p.display_name} ({p.role})
                </option>
              ))}
            </select>
          </div>

          {name.trim() && (
            <div className="border-border bg-muted rounded-lg border p-3">
              <span className="text-muted-foreground text-[10px] font-bold tracking-widest uppercase">
                Preview slug
              </span>
              <p className="text-foreground font-mono text-sm">{toSlug(name)}</p>
            </div>
          )}
        </div>

        <DialogFooter>
          <button
            onClick={() => onOpenChange(false)}
            className="border-border bg-muted text-foreground hover:bg-accent hover:text-accent-foreground rounded-lg border px-4 py-2 text-sm font-semibold transition-colors"
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
