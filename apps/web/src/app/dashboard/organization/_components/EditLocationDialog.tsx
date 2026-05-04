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
import type { LocationRow } from "./types";
import { toSlug } from "./types";
import { LOCATION_TYPE_CONFIG } from "./constants";

type EditLocationDialogProps = {
  location: LocationRow;
  isDark: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: () => Promise<void>;
};

export function EditLocationDialog({
  location,
  isDark: _isDark,
  open,
  onOpenChange,
  onSave,
}: EditLocationDialogProps) {
  const [name, setName] = useState(location.name);
  const [description, setDescription] = useState(location.description ?? "");
  const [locationType, setLocationType] = useState(location.location_type);
  const [address, setAddress] = useState(location.address ?? "");
  const [capacity, setCapacity] = useState(location.capacity?.toString() ?? "");
  const [saving, setSaving] = useState(false);

  const inputClass =
    "w-full rounded-lg border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground transition-all focus:border-orange-500/50 focus:outline-none focus:ring-1 focus:ring-orange-500/50";

  const labelClass =
    "mb-1.5 block text-xs font-semibold tracking-wider uppercase text-muted-foreground";

  async function handleSave() {
    if (!name.trim()) {
      toast.error("Location name is required");
      return;
    }

    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("location")
      .update({
        name: name.trim(),
        slug: toSlug(name),
        description: description.trim() || null,
        location_type: locationType as
          | "main"
          | "outdoor"
          | "kitchen"
          | "event"
          | "storage"
          | "other",
        address: address.trim() || null,
        capacity: capacity ? parseInt(capacity, 10) : null,
      })
      .eq("location_id", location.location_id);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success(`Location "${name.trim()}" updated`);
      onOpenChange(false);
      await onSave();
    }
    setSaving(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-border bg-background text-foreground">
        <DialogHeader>
          <DialogTitle>Edit Location</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Update location details.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <label className={labelClass}>Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Main Floor, Outdoor Terrace"
              className={inputClass}
              autoFocus
            />
          </div>

          <div>
            <label className={labelClass}>Location Type *</label>
            <select
              value={locationType}
              onChange={(e) => setLocationType(e.target.value)}
              className={`${inputClass} appearance-none`}
            >
              {Object.entries(LOCATION_TYPE_CONFIG).map(([key, config]) => (
                <option key={key} value={key}>
                  {config.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClass}>Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this location used for?"
              rows={2}
              className={inputClass}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Address</label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Street address"
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
          </div>
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
