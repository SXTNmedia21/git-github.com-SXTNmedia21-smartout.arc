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
import { COLOR_PRESETS, toSlug } from "./types";

type CreateZoneDialogProps = {
  locationId: string;
  locationName: string;
  workspaceId: string;
  existingCount: number;
  isDark: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: () => Promise<void>;
};

export function CreateZoneDialog({
  locationId,
  locationName,
  workspaceId,
  existingCount,
  isDark,
  open,
  onOpenChange,
  onSave,
}: CreateZoneDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [capacity, setCapacity] = useState("");
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const inputClass =
    "w-full rounded-lg border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground transition-all focus:border-orange-500/50 focus:outline-none focus:ring-1 focus:ring-orange-500/50";

  const labelClass =
    "mb-1.5 block text-xs font-semibold tracking-wider uppercase text-muted-foreground";

  function resetForm() {
    setName("");
    setDescription("");
    setCapacity("");
    setSelectedColor(null);
  }

  async function handleCreate() {
    if (!name.trim()) {
      toast.error("Zone name is required");
      return;
    }

    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.from("zone").insert({
      name: name.trim(),
      slug: toSlug(name),
      description: description.trim() || null,
      capacity: capacity ? parseInt(capacity, 10) : null,
      color: selectedColor,
      location_id: locationId,
      workspace_id: workspaceId,
      is_active: true,
      sort_order: existingCount,
    });

    if (error) {
      toast.error(error.message);
    } else {
      toast.success(`Zone "${name.trim()}" created in ${locationName}`);
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
      <DialogContent className="border-border bg-background text-foreground">
        <DialogHeader>
          <DialogTitle>Add Zone</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Create a new zone in {locationName}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <label className={labelClass}>Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Section A, Patio, VIP Area"
              className={inputClass}
              autoFocus
            />
          </div>

          <div>
            <label className={labelClass}>Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this zone used for?"
              rows={2}
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>Capacity</label>
            <input
              type="number"
              value={capacity}
              onChange={(e) => setCapacity(e.target.value)}
              placeholder="Max people"
              min={0}
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
            onClick={() => {
              onOpenChange(false);
              resetForm();
            }}
            className="border-border bg-muted text-foreground hover:bg-accent hover:text-accent-foreground rounded-lg border px-4 py-2 text-sm font-semibold transition-colors"
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
