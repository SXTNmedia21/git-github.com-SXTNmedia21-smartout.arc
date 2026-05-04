"use client";

import { useState, useEffect } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@smartout/ui";
import { Switch } from "@/components/ui/switch";
import { Input } from "@smartout/ui";
import { Label } from "@smartout/ui";
import { useTranslation } from "@smartout/i18n";
import {
  useWorkspaceOperatingHours,
  type WorkspaceHoursEntry,
} from "../_hooks/use-workspace-operating-hours";

type Props = {
  /**
   * When true, omits the h3 title + description (drawer-mode renders its own header).
   * Used by CascadeTaskTab inline-editor per ADR-0218.
   */
  hideHeader?: boolean;
};

export function OpeningHoursSettings({ hideHeader = false }: Props = {}) {
  const { t } = useTranslation("dashboard");
  const { hours, isSaved, isLoading, upsertHours } = useWorkspaceOperatingHours();
  const [localHours, setLocalHours] = useState<WorkspaceHoursEntry[]>(hours);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    setLocalHours(hours);
    setHasChanges(false);
  }, [hours]);

  function updateDay(index: number, updates: Partial<WorkspaceHoursEntry>) {
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
      {!hideHeader && (
        <div>
          <h3 className="text-foreground text-lg font-semibold">{t("settings_hours.title")}</h3>
          <p className="text-muted-foreground mt-1 text-sm">{t("settings_hours.description")}</p>
        </div>
      )}

      {!isSaved && (
        <div className="border-warning/30 bg-warning/5 flex items-start gap-3 rounded-lg border p-4">
          <AlertTriangle className="text-warning mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="text-foreground text-sm font-medium">{t("settings_hours.not_saved")}</p>
            <p className="text-muted-foreground mt-0.5 text-xs">
              {t("settings_hours.not_saved_desc")}
            </p>
          </div>
        </div>
      )}

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
                {entry.is_closed ? t("settings_hours.closed") : t("settings_hours.open")}
              </Label>
            </div>

            {entry.is_closed ? (
              <span className="text-muted-foreground ml-4 text-sm">
                {t("settings_hours.closed")}
              </span>
            ) : (
              <div className="ml-4 flex items-center gap-2">
                <Input
                  type="time"
                  value={entry.open_time}
                  onChange={(e) => updateDay(index, { open_time: e.target.value })}
                  className="w-32"
                />
                <span className="text-muted-foreground text-sm">–</span>
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
        <Button
          onClick={handleSave}
          disabled={(hasChanges === false && isSaved) || upsertHours.isPending}
        >
          {upsertHours.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {t("settings_hours.saving")}
            </>
          ) : (
            t("settings_hours.save")
          )}
        </Button>
        {hasChanges && (
          <span className="text-muted-foreground text-xs">{t("settings_hours.unsaved")}</span>
        )}
      </div>
    </div>
  );
}
