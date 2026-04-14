/**
 * SeasonHoursTab.tsx
 * Per-department operating hours configuration for a season.
 * Lets managers copy default hours as a starting point, then adjust
 * open/close times per day-of-week per department for the season.
 *
 * Connected to: useSeasonOperatingHours (data), SeasonDrawer (parent),
 * resolveEffectiveHours (cascade consumer that reads these rows)
 */

"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Clock, Copy, Trash2, ChevronDown, ChevronRight } from "lucide-react";
import { useTranslation } from "@smartout/i18n";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useWorkspaceOptional } from "@/lib/workspace-context";
import { createClient } from "@smartout/supabase/client";
import { useSeasonOperatingHours } from "../_hooks";
import { WEEKDAY_LABELS } from "../_hooks";

import type { Database } from "@smartout/supabase";

type DepartmentOperatingHoursRow =
  Database["public"]["Tables"]["department_operating_hours"]["Row"];

type SeasonHoursTabProps = {
  seasonId: string;
};

type DepartmentGroup = {
  key: string;
  department_id: string;
  location_id: string | null;
  rows: DepartmentOperatingHoursRow[];
};

/**
 * Groups operating-hour rows by department and optional location, sorted by weekday.
 */
function groupRowsByDepartment(rows: DepartmentOperatingHoursRow[]): DepartmentGroup[] {
  const map = new Map<string, DepartmentOperatingHoursRow[]>();
  for (const row of rows) {
    const key = `${row.department_id}__${row.location_id ?? "null"}`;
    const list = map.get(key);
    if (list) list.push(row);
    else map.set(key, [row]);
  }
  return [...map.entries()].map(([, groupRows]) => {
    const sorted = [...groupRows].sort((a, b) => a.day_of_week - b.day_of_week);
    const first = sorted[0]!;
    return {
      key: `${first.department_id}__${first.location_id ?? "null"}`,
      department_id: first.department_id,
      location_id: first.location_id,
      rows: sorted,
    };
  });
}

/**
 * Displays season-specific operating hours grouped by department.
 * If no season hours exist, shows a CTA to copy from default hours.
 * Each department section is collapsible and shows 7 day rows with
 * open/close time inputs.
 */
export function SeasonHoursTab({ seasonId }: SeasonHoursTabProps) {
  const { t } = useTranslation("dashboard");
  const ctx = useWorkspaceOptional();
  const wsId = ctx?.workspace.workspace_id;
  const supabase = createClient();

  const { data: departments } = useQuery({
    queryKey: ["departments", wsId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("department")
        .select("department_id, name")
        .eq("workspace_id", wsId!)
        .eq("is_active", true)
        .order("sort_order", { ascending: true });
      if (error) throw new Error(error.message);
      return data ?? [];
    },
    enabled: !!wsId,
  });

  const deptNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const d of departments ?? []) {
      m.set(d.department_id, d.name);
    }
    return m;
  }, [departments]);

  const { hours, isLoading, hasSeasonHours, copyDefaultHours, updateHours, removeSeasonHours } =
    useSeasonOperatingHours(seasonId);

  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());

  const handleCopyDefaults = () => {
    copyDefaultHours.mutate(undefined, {
      onSuccess: (count) => {
        toast.success(t("yearWheel.hours_copied", { count }));
      },
      onError: (err: Error) => {
        toast.error(err.message);
      },
    });
  };

  const handleRemoveAll = () => {
    if (!window.confirm(t("yearWheel.confirm_remove_hours"))) return;
    removeSeasonHours.mutate(undefined, {
      onSuccess: () => toast.success(t("yearWheel.hours_removed")),
      onError: (err: Error) => {
        toast.error(err.message);
      },
    });
  };

  const toggleGroup = (key: string) => {
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  if (isLoading) {
    return (
      <div className="text-muted-foreground flex items-center justify-center py-12">
        <Clock className="mr-2 h-4 w-4 animate-spin" />
        {t("yearWheel.hours_loading")}
      </div>
    );
  }

  if (!hasSeasonHours) {
    return (
      <div className="flex flex-col items-center gap-4 py-12 text-center">
        <Clock className="text-muted-foreground h-8 w-8" />
        <div>
          <p className="text-foreground text-sm font-medium">{t("yearWheel.no_season_hours")}</p>
          <p className="text-muted-foreground mt-1 text-xs">
            {t("yearWheel.no_season_hours_description")}
          </p>
        </div>
        <Button
          onClick={handleCopyDefaults}
          disabled={copyDefaultHours.isPending}
          className="gap-2"
        >
          <Copy className="h-4 w-4" />
          {copyDefaultHours.isPending
            ? t("yearWheel.hours_loading")
            : t("yearWheel.copy_default_hours")}
        </Button>
      </div>
    );
  }

  const groups = groupRowsByDepartment(hours);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-muted-foreground text-xs">{t("yearWheel.season_hours_description")}</p>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleRemoveAll}
          disabled={removeSeasonHours.isPending}
          className="text-destructive hover:text-destructive gap-1"
        >
          <Trash2 className="h-3 w-3" />
          {t("yearWheel.reset_to_defaults")}
        </Button>
      </div>

      {groups.map((group) => {
        const isExpanded = expandedKeys.has(group.key);
        const title = deptNameById.get(group.department_id) ?? group.department_id.slice(0, 8);
        const locationSuffix =
          group.location_id != null ? ` · ${t("yearWheel.hours_location_specific")}` : "";

        return (
          <div key={group.key} className="border-border bg-card rounded-lg border">
            <button
              type="button"
              onClick={() => toggleGroup(group.key)}
              className="hover:bg-accent flex w-full items-center gap-2 p-3 text-left"
            >
              {isExpanded ? (
                <ChevronDown className="text-muted-foreground h-4 w-4" />
              ) : (
                <ChevronRight className="text-muted-foreground h-4 w-4" />
              )}
              <span className="text-card-foreground text-sm font-medium">
                {title}
                {locationSuffix}
              </span>
              <span className="text-muted-foreground ml-auto text-xs">
                {group.rows.filter((r) => !r.is_closed).length}/7 {t("yearWheel.days_open")}
              </span>
            </button>

            {isExpanded && (
              <div className="border-border border-t px-3 pb-3">
                {group.rows.map((row) => {
                  const dayLabel = WEEKDAY_LABELS[row.day_of_week] ?? String(row.day_of_week);
                  return (
                    <DayRow
                      key={`${row.id}-${row.open_time ?? ""}-${row.close_time ?? ""}-${row.is_closed}`}
                      dayLabel={dayLabel}
                      row={row}
                      onUpdate={(update) => updateHours.mutate({ id: row.id, ...update })}
                    />
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

type DayRowProps = {
  dayLabel: string;
  row: DepartmentOperatingHoursRow;
  onUpdate: (update: {
    open_time?: string | null;
    close_time?: string | null;
    is_closed?: boolean;
  }) => void;
};

/**
 * Single weekday row: closed shortcut or open/close time inputs (commit on blur).
 */
function DayRow({ dayLabel, row, onUpdate }: DayRowProps) {
  const { t } = useTranslation("dashboard");
  const [openTime, setOpenTime] = useState(row.open_time ?? "");
  const [closeTime, setCloseTime] = useState(row.close_time ?? "");

  return (
    <div className="border-border/50 flex items-center gap-3 border-b py-2 last:border-0">
      <span className="text-muted-foreground w-10 text-xs font-medium">{dayLabel}</span>

      {row.is_closed ? (
        <button
          type="button"
          onClick={() => onUpdate({ is_closed: false, open_time: "10:00", close_time: "22:00" })}
          className="text-destructive text-xs hover:underline"
        >
          {t("yearWheel.hours_closed_open_hint")}
        </button>
      ) : (
        <>
          <input
            type="time"
            value={openTime}
            onChange={(e) => setOpenTime(e.target.value)}
            onBlur={() => {
              if (openTime !== (row.open_time ?? "")) onUpdate({ open_time: openTime || null });
            }}
            className="border-input bg-background text-foreground h-8 rounded border px-2 text-xs"
          />
          <span className="text-muted-foreground text-xs">—</span>
          <input
            type="time"
            value={closeTime}
            onChange={(e) => setCloseTime(e.target.value)}
            onBlur={() => {
              if (closeTime !== (row.close_time ?? "")) onUpdate({ close_time: closeTime || null });
            }}
            className="border-input bg-background text-foreground h-8 rounded border px-2 text-xs"
          />
          <button
            type="button"
            onClick={() => onUpdate({ is_closed: true })}
            className="text-muted-foreground hover:text-destructive ml-auto text-xs"
            aria-label={t("yearWheel.hours_mark_closed")}
          >
            ✕
          </button>
        </>
      )}
    </div>
  );
}
