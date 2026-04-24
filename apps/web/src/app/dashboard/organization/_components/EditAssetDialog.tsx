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
import type { AssetRow } from "./types";
import { ICON_PRESETS, toSlug } from "./types";
import { ICON_COMPONENTS, ASSET_TYPE_OPTIONS } from "./constants";

type EditAssetDialogProps = {
  asset: AssetRow;
  isDark: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: () => Promise<void>;
};

export function EditAssetDialog({
  asset,
  isDark,
  open,
  onOpenChange,
  onSave,
}: EditAssetDialogProps) {
  const [name, setName] = useState(asset.name);
  const [description, setDescription] = useState(asset.description ?? "");
  const [assetType, setAssetType] = useState(asset.asset_type);
  const [selectedIcon, setSelectedIcon] = useState<string | null>(asset.icon);
  const [requiresTraining, setRequiresTraining] = useState(asset.requires_training);
  const [requiresRoutine, setRequiresRoutine] = useState(asset.requires_routine);
  const [saving, setSaving] = useState(false);

  const inputClass =
    "w-full rounded-lg border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground transition-all focus:border-orange-500/50 focus:outline-none focus:ring-1 focus:ring-orange-500/50";

  const labelClass =
    "mb-1.5 block text-xs font-semibold tracking-wider uppercase text-muted-foreground";

  async function handleSave() {
    if (!name.trim()) {
      toast.error("Asset name is required");
      return;
    }

    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("asset")
      .update({
        name: name.trim(),
        slug: toSlug(name),
        description: description.trim() || null,
        asset_type: assetType as "equipment" | "safety" | "storage" | "station" | "other",
        icon: selectedIcon,
        requires_training: requiresTraining,
        requires_routine: requiresRoutine,
      })
      .eq("asset_id", asset.asset_id);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success(`Asset "${name.trim()}" updated`);
      onOpenChange(false);
      await onSave();
    }
    setSaving(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-border bg-background text-foreground">
        <DialogHeader>
          <DialogTitle>Edit Asset</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Update asset details.
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
                        : "border-border bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground"
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
                className="h-4 w-4 rounded border-border text-orange-600 focus:ring-orange-500"
              />
              <span className="text-sm text-foreground">Requires training</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={requiresRoutine}
                onChange={(e) => setRequiresRoutine(e.target.checked)}
                className="h-4 w-4 rounded border-border text-orange-600 focus:ring-orange-500"
              />
              <span className="text-sm text-foreground">Requires routine</span>
            </label>
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
