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
import { ICON_PRESETS, toSlug } from "./types";
import { ICON_COMPONENTS, ASSET_TYPE_OPTIONS } from "./constants";

type CreateAssetDialogProps = {
  locationId: string;
  locationName: string;
  workspaceId: string;
  existingCount: number;
  isDark: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: () => Promise<void>;
};

export function CreateAssetDialog({
  locationId,
  locationName,
  workspaceId,
  existingCount,
  isDark,
  open,
  onOpenChange,
  onSave,
}: CreateAssetDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [assetType, setAssetType] = useState("equipment");
  const [selectedIcon, setSelectedIcon] = useState<string | null>(null);
  const [requiresTraining, setRequiresTraining] = useState(false);
  const [requiresRoutine, setRequiresRoutine] = useState(false);
  const [saving, setSaving] = useState(false);

  const inputClass = `w-full rounded-lg border px-4 py-2.5 text-sm transition-all focus:outline-none focus:ring-1 ${
    isDark
      ? "border-zinc-800 bg-zinc-950 text-white placeholder:text-zinc-600 focus:border-orange-500/50 focus:ring-orange-500/50"
      : "border-zinc-200 bg-white text-zinc-900 placeholder:text-zinc-400 focus:border-orange-500/50 focus:ring-orange-500/50"
  }`;

  const labelClass = `mb-1.5 block text-xs font-semibold tracking-wider uppercase ${
    isDark ? "text-zinc-400" : "text-zinc-500"
  }`;

  function resetForm() {
    setName("");
    setDescription("");
    setAssetType("equipment");
    setSelectedIcon(null);
    setRequiresTraining(false);
    setRequiresRoutine(false);
  }

  async function handleCreate() {
    if (!name.trim()) {
      toast.error("Asset name is required");
      return;
    }

    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.from("asset").insert({
      name: name.trim(),
      slug: toSlug(name),
      description: description.trim() || null,
      asset_type: assetType,
      icon: selectedIcon,
      requires_training: requiresTraining,
      requires_routine: requiresRoutine,
      location_id: locationId,
      workspace_id: workspaceId,
      is_active: true,
      sort_order: existingCount,
    });

    if (error) {
      toast.error(error.message);
    } else {
      toast.success(`Asset "${name.trim()}" created in ${locationName}`);
      onOpenChange(false);
      resetForm();
      await onSave();
    }
    setSaving(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) resetForm();
      }}
    >
      <DialogContent
        className={
          isDark
            ? "border-zinc-800 bg-zinc-950 text-white"
            : "border-zinc-200 bg-white text-zinc-900"
        }
      >
        <DialogHeader>
          <DialogTitle>Add Asset</DialogTitle>
          <DialogDescription className={isDark ? "text-zinc-400" : "text-zinc-500"}>
            Create a new asset in {locationName}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <label className={labelClass}>Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Espresso Machine, Fire Extinguisher"
              className={inputClass}
              autoFocus
            />
          </div>

          <div>
            <label className={labelClass}>Asset Type *</label>
            <select
              value={assetType}
              onChange={(e) => setAssetType(e.target.value)}
              className={`${inputClass} appearance-none`}
            >
              {ASSET_TYPE_OPTIONS.map((opt) => (
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
              placeholder="Details about this asset"
              rows={2}
              className={inputClass}
            />
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

          <div className="flex gap-6">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={requiresTraining}
                onChange={(e) => setRequiresTraining(e.target.checked)}
                className="h-4 w-4 rounded border-zinc-300 text-orange-600 focus:ring-orange-500"
              />
              <span className={`text-sm ${isDark ? "text-zinc-300" : "text-zinc-700"}`}>
                Requires training
              </span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={requiresRoutine}
                onChange={(e) => setRequiresRoutine(e.target.checked)}
                className="h-4 w-4 rounded border-zinc-300 text-orange-600 focus:ring-orange-500"
              />
              <span className={`text-sm ${isDark ? "text-zinc-300" : "text-zinc-700"}`}>
                Requires routine
              </span>
            </label>
          </div>
        </div>

        <DialogFooter>
          <button
            onClick={() => {
              onOpenChange(false);
              resetForm();
            }}
            className={`rounded-lg border px-4 py-2 text-sm font-semibold transition-colors ${
              isDark
                ? "border-zinc-700 bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
            }`}
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={saving || !name.trim()}
            className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-orange-500 disabled:opacity-50"
          >
            {saving ? "Creating..." : "Create"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
