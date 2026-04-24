"use client";

/**
 * Department offset tab — shows workspace base hours and lets admin set
 * per-day offsets. Writes to department_operating_hours with computed
 * absolute times and stored offsets.
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { Loader2, Clock, Info } from "lucide-react";
import { Button } from "@smartout/ui";
import { Input } from "@smartout/ui";
import { useTranslation } from "@smartout/i18n";
import { createClient } from "@smartout/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useWorkspaceOptional } from "@/lib/workspace-context";
import { emit, nonEmpty } from "@smartout/telemetry";
import { toast } from "sonner";
import { dashboardKeys } from "@/app/dashboard/_hooks/dashboard-keys";

type DayEntry = {
  day_of_week: number;
  day_name: string;
  base_open: string;
  base_close: string;
  base_closed: boolean;
  open_offset: number;
  close_offset: number;
};

const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function addMinutes(time: string, minutes: number): string {
  const [h, m] = time.split(":").map(Number);
  const total = h! * 60 + m! + minutes;
  const clampedH = Math.max(0, Math.min(23, Math.floor(total / 60)));
  const clampedM = Math.max(0, Math.min(59, total % 60));
  return `${String(clampedH).padStart(2, "0")}:${String(clampedM).padStart(2, "0")}`;
}

type Props = {
  departmentId: string;
  profileId: string;
  isDark: boolean;
};

export function DepartmentHoursTab({ departmentId, profileId, isDark: _isDark }: Props) {
  const { t } = useTranslation("dashboard");
  const ctx = useWorkspaceOptional();
  const wsId = ctx?.workspace.workspace_id;
  const supabase = createClient();
  const queryClient = useQueryClient();

  const baseQuery = useQuery({
    queryKey: dashboardKeys.workspaceOperatingHours(wsId ?? "none"),
    queryFn: async () => {
      const { data } = await supabase
        .from("workspace_operating_hours")
        .select("day_of_week, open_time, close_time, is_closed")
        .eq("workspace_id", wsId!);
      return data ?? [];
    },
    enabled: !!wsId,
    staleTime: 10 * 60_000,
  });

  const deptQuery = useQuery({
    queryKey: ["department-hours-offset", wsId, departmentId],
    queryFn: async () => {
      const { data } = await supabase
        .from("department_operating_hours")
        .select("day_of_week, open_offset_minutes, close_offset_minutes")
        .eq("workspace_id", wsId!)
        .eq("department_id", departmentId)
        .is("location_id", null)
        .is("season_id", null);
      return data ?? [];
    },
    enabled: !!wsId,
    staleTime: 10 * 60_000,
  });

  const hasDeptRows = (deptQuery.data?.length ?? 0) > 0;
  const hasBaseHours = (baseQuery.data?.length ?? 0) > 0;

  const entries: DayEntry[] = useMemo(() => {
    const baseMap = new Map<
      number,
      { open_time: string | null; close_time: string | null; is_closed: boolean | null }
    >();
    for (const row of baseQuery.data ?? []) {
      baseMap.set(row.day_of_week, row);
    }
    const deptMap = new Map<
      number,
      { open_offset_minutes: number | null; close_offset_minutes: number | null }
    >();
    for (const row of deptQuery.data ?? []) {
      deptMap.set(row.day_of_week, row);
    }
    return DAY_NAMES.map((name, i) => {
      const base = baseMap.get(i);
      const dept = deptMap.get(i);
      return {
        day_of_week: i,
        day_name: name,
        base_open: base?.open_time ?? "08:00",
        base_close: base?.close_time ?? "22:00",
        base_closed: base?.is_closed ?? false,
        open_offset: dept?.open_offset_minutes ?? 0,
        close_offset: dept?.close_offset_minutes ?? 0,
      } satisfies DayEntry;
    });
  }, [baseQuery.data, deptQuery.data]);

  const [localEntries, setLocalEntries] = useState<DayEntry[]>(entries);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    setLocalEntries(entries);
    setHasChanges(false);
  }, [entries]);

  const updateOffset = useCallback(
    (dayIndex: number, field: "open_offset" | "close_offset", value: number) => {
      setLocalEntries((prev) =>
        prev.map((e, i) => (i === dayIndex ? { ...e, [field]: value } : e)),
      );
      setHasChanges(true);
    },
    [],
  );

  const saveMutation = useMutation({
    mutationFn: async (entriesToSave: DayEntry[]) => {
      const rows = entriesToSave.map((e) => ({
        workspace_id: wsId!,
        department_id: departmentId,
        location_id: null,
        season_id: null,
        day_of_week: e.day_of_week,
        open_time: e.base_closed ? null : addMinutes(e.base_open, e.open_offset),
        close_time: e.base_closed ? null : addMinutes(e.base_close, e.close_offset),
        is_closed: e.base_closed,
        open_offset_minutes: e.open_offset,
        close_offset_minutes: e.close_offset,
        is_derived: false,
        updated_at: new Date().toISOString(),
      }));

      const { error } = await supabase.from("department_operating_hours").upsert(rows, {
        onConflict: "department_id,location_id,season_id,day_of_week",
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      void emit({
        event: "operating_hours updated",
        workspace_id: (wsId ?? null) ? nonEmpty(wsId ?? null, "workspace_id") : null,
        actor_id: nonEmpty(profileId, "actor_id"),
        properties: { data: {} },
      });
      queryClient.invalidateQueries({ queryKey: ["department-hours-offset", wsId, departmentId] });
      queryClient.invalidateQueries({ queryKey: dashboardKeys.cascadeTasks(wsId!) });
      toast.success(t("department_hours.saved"));
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  if (baseQuery.isLoading || deptQuery.isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (!hasBaseHours) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border bg-muted p-12">
        <Clock className="mb-4 h-8 w-8 text-muted-foreground" />
        <p className="text-sm font-medium text-muted-foreground">
          {t("department_hours.inherits")}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {t("settings_hours.not_saved_desc")}
        </p>
      </div>
    );
  }

  const cardBase =
    "rounded-2xl border border-border bg-card p-5 transition-all hover:bg-accent";

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-bold text-foreground">{t("department_hours.title")}</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          {t("department_hours.description")}
        </p>
      </div>

      {!hasDeptRows && (
        <div className="flex items-start gap-2 rounded-lg border border-blue-500/20 bg-blue-500/5 p-3">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-400" />
          <p className="text-xs text-blue-300">{t("department_hours.inherits")}</p>
        </div>
      )}

      <div className="space-y-3">
        {localEntries.map((entry, index) => {
          const resultOpen = addMinutes(entry.base_open, entry.open_offset);
          const resultClose = addMinutes(entry.base_close, entry.close_offset);

          return (
            <div key={entry.day_of_week} className={cardBase}>
              <div className="flex items-center justify-between">
                <span className="w-24 text-sm font-medium text-foreground">
                  {entry.day_name}
                </span>

                {entry.base_closed ? (
                  <span className="text-muted-foreground text-sm">
                    {t("settings_hours.closed")}
                  </span>
                ) : (
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold tracking-wider uppercase text-muted-foreground">
                        {t("department_hours.open_offset")}
                      </span>
                      <Input
                        type="number"
                        value={entry.open_offset}
                        onChange={(e) => updateOffset(index, "open_offset", Number(e.target.value))}
                        className="w-20 text-center"
                        step={15}
                      />
                      <span className="text-muted-foreground text-xs">min</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold tracking-wider uppercase text-muted-foreground">
                        {t("department_hours.close_offset")}
                      </span>
                      <Input
                        type="number"
                        value={entry.close_offset}
                        onChange={(e) =>
                          updateOffset(index, "close_offset", Number(e.target.value))
                        }
                        className="w-20 text-center"
                        step={15}
                      />
                      <span className="text-muted-foreground text-xs">min</span>
                    </div>

                    <div className="ml-2 rounded-md bg-muted px-2 py-1 font-mono text-xs text-foreground">
                      {resultOpen}–{resultClose}
                    </div>
                  </div>
                )}
              </div>

              {!entry.base_closed && (
                <div className="mt-1 text-[10px] text-muted-foreground">
                  {t("department_hours.base_reference")}: {entry.base_open}–{entry.base_close}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <Button
        onClick={() => saveMutation.mutate(localEntries)}
        disabled={(!hasChanges && hasDeptRows) || saveMutation.isPending}
      >
        {saveMutation.isPending ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {t("department_hours.saving")}
          </>
        ) : (
          t("department_hours.save")
        )}
      </Button>
    </div>
  );
}
