"use client";

import { useState, useEffect } from "react";
import { Clock, Loader2 } from "lucide-react";
import { Button } from "@smartout/ui";
import { Switch } from "@/components/ui/switch";
import { Input } from "@smartout/ui";
import { Label } from "@smartout/ui";
import { useOperatingHours, type OperatingHoursEntry } from "../_hooks/use-operating-hours";

export function OpeningHoursSettings() {
  const { hours, isLoading, upsertHours } = useOperatingHours();
  const [localHours, setLocalHours] = useState<OperatingHoursEntry[]>(hours);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    setLocalHours(hours);
    setHasChanges(false);
  }, [hours]);

  function updateDay(index: number, updates: Partial<OperatingHoursEntry>) {
    setLocalHours((prev) =>
      prev.map((entry, i) => (i === index ? { ...entry, ...updates } : entry)),
    );
    setHasChanges(true);
  }

  function handleSave() {
    upsertHours.mutate(localHours);
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-foreground text-lg font-semibold">Opening Hours</h3>
        <p className="text-muted-foreground mt-1 text-sm">
          Set the default operating hours for your workspace. These are used for scheduling and
          staffing calculations.
        </p>
      </div>

      <div className="space-y-3">
        {localHours.map((entry, index) => (
          <div
            key={entry.day_of_week}
            className="bg-card border-border flex items-center gap-4 rounded-lg border p-4"
          >
            <span className="text-foreground w-24 text-sm font-medium">{entry.day_name}</span>

            <div className="flex items-center gap-2">
              <Switch
                id={`day-${entry.day_of_week}`}
                checked={!entry.is_closed}
                onCheckedChange={(checked) => updateDay(index, { is_closed: !checked })}
              />
              <Label htmlFor={`day-${entry.day_of_week}`} className="text-muted-foreground text-xs">
                {entry.is_closed ? "Closed" : "Open"}
              </Label>
            </div>

            {entry.is_closed ? (
              <span className="text-muted-foreground ml-4 text-sm">Closed</span>
            ) : (
              <div className="ml-4 flex items-center gap-2">
                <Input
                  type="time"
                  value={entry.open_time}
                  onChange={(e) => updateDay(index, { open_time: e.target.value })}
                  className="w-32"
                />
                <span className="text-muted-foreground text-sm">to</span>
                <Input
                  type="time"
                  value={entry.close_time}
                  onChange={(e) => updateDay(index, { close_time: e.target.value })}
                  className="w-32"
                />
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <Button onClick={handleSave} disabled={!hasChanges || upsertHours.isPending}>
          {upsertHours.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            "Save Changes"
          )}
        </Button>
        {hasChanges && (
          <span className="text-muted-foreground text-xs">You have unsaved changes</span>
        )}
      </div>
    </div>
  );
}
