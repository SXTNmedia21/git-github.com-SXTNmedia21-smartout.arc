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
import type { PositionRow } from "./types";
import { COLOR_PRESETS, ICON_PRESETS, toSlug } from "./types";
import { ICON_COMPONENTS, ROLE_OPTIONS } from "./constants";

type EditPositionDialogProps = {
  position: PositionRow;
  isDark: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: () => Promise<void>;
};

export function EditPositionDialog({
  position,
  isDark,
  open,
  onOpenChange,
  onSave,
}: EditPositionDialogProps) {
  const [name, setName] = useState(position.name);
  const [description, setDescription] = useState(position.description ?? "");
  const [minimumRole, setMinimumRole] = useState(position.minimum_role ?? "employee");
  const [selectedColor, setSelectedColor] = useState<string | null>(position.color);
  const [selectedIcon, setSelectedIcon] = useState<string | null>(position.icon);
  const [saving, setSaving] = useState(false);

  const inputClass = `w-full rounded-lg border px-4 py-2.5 text-sm transition-all focus:outline-none focus:ring-1 ${
    isDark
      ? "border-zinc-800 bg-zinc-950 text-white placeholder:text-zinc-600 focus:border-orange-500/50 focus:ring-orange-500/50"
      : "border-zinc-200 bg-white text-zinc-900 placeholder:text-zinc-400 focus:border-orange-500/50 focus:ring-orange-500/50"
  }`;

  const labelClass = `mb-1.5 block text-xs font-semibold tracking-wider uppercase ${
    isDark ? "text-zinc-400" : "text-zinc-500"
  }`;

  async function handleSave() {
    if (!name.trim()) {
      toast.error("Position name is required");
      return;
    }

    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("position")
      .update({
        name: name.trim(),
        slug: toSlug(name),
        description: description.trim() || null,
        minimum_role: minimumRole,
        color: selectedColor,
        icon: selectedIcon,
      })
      .eq("position_id", position.position_id);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success(`Position "${name.trim()}" updated`);
      onOpenChange(false);
      await onSave();
    }
    setSaving(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={
          isDark
            ? "border-zinc-800 bg-zinc-950 text-white"
            : "border-zinc-200 bg-white text-zinc-900"
        }
      >
        <DialogHeader>
          <DialogTitle>Edit Position</DialogTitle>
          <DialogDescription className={isDark ? "text-zinc-400" : "text-zinc-500"}>
            Update position details.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <label className={labelClass}>Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Head Chef, Bartender, Server"
              className={inputClass}
              autoFocus
            />
          </div>

          <div>
            <label className={labelClass}>Minimum Role *</label>
            <select
              value={minimumRole}
              onChange={(e) => setMinimumRole(e.target.value)}
              className={`${inputClass} appearance-none`}
            >
              {ROLE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClass}>Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What does this position entail?"
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
                        : isDark
                          ? "border-zinc-800 bg-zinc-900 text-zinc-500 hover:border-zinc-700 hover:text-zinc-300"
                          : "border-zinc-200 bg-zinc-50 text-zinc-400 hover:border-zinc-300 hover:text-zinc-600"
                    }`}
                  >
                    <PresetIcon className="h-4 w-4" />
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <DialogFooter>
          <button
            onClick={() => onOpenChange(false)}
            className={`rounded-lg border px-4 py-2 text-sm font-semibold transition-colors ${
              isDark
                ? "border-zinc-700 bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
            }`}
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
