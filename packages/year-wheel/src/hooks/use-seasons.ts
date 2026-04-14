import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "@smartout/i18n";

import { createClient } from "@smartout/supabase/client";
import { emit } from "@smartout/telemetry";

import { yearWheelKeys } from "../query-keys";
import { toast } from "sonner";

export type Season = {
  season_id: string;
  name: string;
  slug: string;
  season_type: "default" | "calendar" | "focus" | "cycle" | "custom";
  start_date: string | null;
  end_date: string | null;
  status: "draft" | "active" | "archived";
  is_default: boolean;
  color: string | null;
  icon: string | null;
  description: string | null;
  planning_cycle_id: string | null;
};

type CreateSeasonInput = {
  name: string;
  startDate?: string | null;
  endDate?: string | null;
};

type UpdateSeasonDatesInput = {
  seasonId: string;
  start_date?: string | null;
  end_date?: string | null;
};

/**
 * Converts free text into a stable slug format for season names.
 */
function toSlug(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function useSeasons(workspaceId: string | null, profileId: string | null) {
  const { t } = useTranslation("dashboard");
  const wsId = workspaceId;
  const supabase = createClient();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: yearWheelKeys.seasons(wsId ?? "none"),
    queryFn: async (): Promise<Season[]> => {
      const { data, error } = await supabase
        .from("season")
        .select(
          "season_id, name, slug, season_type, start_date, end_date, status, is_default, color, icon, description, planning_cycle_id",
        )
        .eq("workspace_id", wsId!)
        .order("start_date", { ascending: false });

      if (error) throw new Error(error.message);
      return data ?? [];
    },
    enabled: !!wsId,
    staleTime: 10 * 60 * 1000, // 10 minutes — stable season definitions
  });

  const createSeason = useMutation({
    mutationFn: async (input: CreateSeasonInput): Promise<Season> => {
      const trimmedName = input.name.trim();
      const existingSlugs = new Set((query.data ?? []).map((season) => season.slug));
      const baseSlug = toSlug(trimmedName) || "season";

      let slug = baseSlug;
      let slugSuffix = 2;
      while (existingSlugs.has(slug)) {
        slug = `${baseSlug}-${slugSuffix}`;
        slugSuffix += 1;
      }

      const { data, error } = await supabase
        .from("season")
        .insert({
          workspace_id: wsId!,
          name: trimmedName,
          slug,
          season_type: "default",
          start_date: input.startDate ?? null,
          end_date: input.endDate ?? null,
          status: "draft",
        })
        .select(
          "season_id, name, slug, season_type, start_date, end_date, status, is_default, color, icon, description, planning_cycle_id",
        )
        .single();

      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: (data, { name }) => {
      void emit({
        event: "season created",
        workspace_id: wsId ?? null,
        actor_id: profileId ?? "",
        properties: {
          entity: {
            entity_type: "season",
            entity_id: data.season_id,
            entity_label: name,
          },
          data: { name, status: "draft" },
        },
      });
      queryClient.invalidateQueries({
        queryKey: yearWheelKeys.seasons(wsId ?? "none"),
      });
      toast.success(t("yearWheel.toast_season_created"));
    },
    onError: (error: Error) => {
      toast.error(t("yearWheel.toast_season_create_error", { error: error.message }));
    },
  });

  const activateSeason = useMutation<Season | null, Error, string>({
    mutationFn: async (seasonId: string): Promise<Season | null> => {
      // Validate: budget must exist and have required fields
      const { data: budget, error: budgetError } = await supabase
        .from("season_budget")
        .select("season_budget_id, total_target_revenue, target_labor_percentage, avg_hourly_wage")
        .eq("season_id", seasonId)
        .single();

      if (budgetError || !budget) throw new Error(t("yearWheel.toast_season_missing_budget"));
      if (!budget.total_target_revenue || budget.total_target_revenue <= 0)
        throw new Error(t("yearWheel.toast_budget_missing_target"));

      // Validate: day factors must exist (keyed on season_budget_id).
      // workspace_id guard ensures we never see factors from another tenant's budget
      // if season_budget_id were ever reused across workspaces.
      const { count: dayFactorCount } = await supabase
        .from("day_factor")
        .select("*", { count: "exact", head: true })
        .eq("season_budget_id", budget.season_budget_id)
        .eq("workspace_id", wsId!);

      if (!dayFactorCount || dayFactorCount === 0)
        throw new Error(t("yearWheel.toast_season_missing_day_factors"));

      // Validate: hour factors must exist (keyed on season_budget_id)
      const { count: hourFactorCount } = await supabase
        .from("hour_factor")
        .select("*", { count: "exact", head: true })
        .eq("season_budget_id", budget.season_budget_id);

      if (!hourFactorCount || hourFactorCount === 0)
        throw new Error(t("yearWheel.toast_season_missing_hour_factors"));

      const { count: hoursCount } = await supabase
        .from("department_operating_hours")
        .select("*", { count: "exact", head: true })
        .eq("workspace_id", wsId!)
        .eq("season_id", seasonId);

      if (!hoursCount || hoursCount === 0) {
        const proceed = window.confirm(t("yearWheel.activate_no_season_hours_confirm"));
        if (!proceed) return null;
      }

      // Deactivate any currently active season in this workspace.
      // We check the error explicitly so a failed deactivation doesn't leave two
      // seasons active at the same time (partial success window).
      const { error: deactivateError } = await supabase
        .from("season")
        .update({ status: "archived" })
        .eq("workspace_id", wsId!)
        .eq("status", "active");

      if (deactivateError) throw deactivateError;

      // Activate this season
      const { data, error } = await supabase
        .from("season")
        .update({ status: "active" })
        .eq("season_id", seasonId)
        .select(
          "season_id, name, slug, season_type, start_date, end_date, status, is_default, color, icon, description, planning_cycle_id",
        )
        .single();

      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: (data) => {
      if (!data) return;
      void emit({
        event: "season activated",
        workspace_id: wsId ?? null,
        actor_id: profileId ?? "",
        properties: {
          entity: {
            entity_type: "season",
            entity_id: data.season_id,
            entity_label: data.name,
          },
          data: { status: "active" },
        },
      });
      queryClient.invalidateQueries({
        queryKey: yearWheelKeys.seasons(wsId ?? "none"),
      });
      toast.success(t("yearWheel.toast_season_activated", { name: data.name }));
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const archiveSeason = useMutation({
    mutationFn: async (seasonId: string): Promise<Season> => {
      const { data, error } = await supabase
        .from("season")
        .update({ status: "archived" })
        .eq("season_id", seasonId)
        .select(
          "season_id, name, slug, season_type, start_date, end_date, status, is_default, color, icon, description, planning_cycle_id",
        )
        .single();

      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: (data) => {
      void emit({
        event: "season archived",
        workspace_id: wsId ?? null,
        actor_id: profileId ?? "",
        properties: {
          entity: {
            entity_type: "season",
            entity_id: data.season_id,
            entity_label: data.name,
          },
          data: { status: "archived" },
        },
      });
      queryClient.invalidateQueries({
        queryKey: yearWheelKeys.seasons(wsId ?? "none"),
      });
      toast.success(t("yearWheel.toast_season_archived", { name: data.name }));
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  /**
   * Duplicates all seasons from a source year into a target year.
   * Shifts dates forward by the year difference. Also clones planning_event
   * rows for each season. Budgets and factors are NOT cloned — those need
   * fresh configuration for the new year.
   */
  const duplicateYear = useMutation({
    mutationFn: async ({
      sourceYear,
      targetYear,
    }: {
      sourceYear: number;
      targetYear: number;
    }): Promise<Season[]> => {
      const yearDiff = targetYear - sourceYear;

      const sourceSeasons = (query.data ?? []).filter((s) => {
        if (!s.start_date) return false;
        return new Date(s.start_date).getFullYear() === sourceYear;
      });

      if (sourceSeasons.length === 0) {
        throw new Error(t("yearWheel.toast_no_seasons_for_year", { year: sourceYear }));
      }

      const existingSlugs = new Set((query.data ?? []).map((s) => s.slug));
      const createdSeasons: Season[] = [];

      for (const source of sourceSeasons) {
        const newStartDate = shiftDateByYears(source.start_date, yearDiff);
        const newEndDate = source.end_date ? shiftDateByYears(source.end_date, yearDiff) : null;
        const newName = source.name.replace(String(sourceYear), String(targetYear));

        let slug = toSlug(newName) || "season";
        let suffix = 2;
        while (existingSlugs.has(slug)) {
          slug = `${toSlug(newName)}-${suffix}`;
          suffix += 1;
        }
        existingSlugs.add(slug);

        const { data: newSeason, error } = await supabase
          .from("season")
          .insert({
            workspace_id: wsId!,
            name: newName,
            slug,
            season_type: source.season_type,
            start_date: newStartDate,
            end_date: newEndDate,
            status: "draft",
            description: source.description,
            color: source.color,
            icon: source.icon,
          })
          .select(
            "season_id, name, slug, season_type, start_date, end_date, status, is_default, color, icon, description, planning_cycle_id",
          )
          .single();

        if (error) throw new Error(error.message);
        createdSeasons.push(newSeason);

        // Clone planning events for this season's planning cycle
        if (source.planning_cycle_id) {
          const { data: sourceEvents } = await supabase
            .from("planning_event")
            .select("*")
            .eq("planning_cycle_id", source.planning_cycle_id)
            .eq("workspace_id", wsId!);

          if (sourceEvents && sourceEvents.length > 0) {
            const clonedEvents = sourceEvents
              .filter((ev) => ev.event_date !== null)
              .map((ev) => ({
                workspace_id: wsId!,
                planning_cycle_id: null as string | null,
                name: ev.name,
                description: ev.description,
                category: ev.category,
                source: ev.source,
                event_date: shiftDateByYears(ev.event_date!, yearDiff)!,
                end_date: ev.end_date ? shiftDateByYears(ev.end_date, yearDiff) : null,
                demand_multiplier: ev.demand_multiplier,
                expected_covers: ev.expected_covers,
                confidence: ev.confidence,
                is_recurring: ev.is_recurring,
                recurrence_rule: ev.recurrence_rule,
              }));

            if (clonedEvents.length > 0) {
              await supabase.from("planning_event").insert(clonedEvents);
            }
          }
        }
      }

      return createdSeasons;
    },
    onSuccess: (created, { sourceYear, targetYear }) => {
      void emit({
        event: "season created",
        workspace_id: wsId ?? null,
        actor_id: profileId ?? "",
        properties: {
          entity: {
            entity_type: "season",
            entity_id: created[0]?.season_id ?? "",
            entity_label: `Duplicated ${sourceYear} → ${targetYear}`,
          },
          data: { name: `Year duplication: ${created.length} seasons`, status: "draft" },
        },
      });
      queryClient.invalidateQueries({
        queryKey: yearWheelKeys.seasons(wsId ?? "none"),
      });
      toast.success(
        t("yearWheel.toast_seasons_copied", { count: created.length, sourceYear, targetYear }),
      );
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const updateSeasonDates = useMutation({
    mutationFn: async (input: UpdateSeasonDatesInput): Promise<Season> => {
      const list = query.data ?? [];
      const current = list.find((s) => s.season_id === input.seasonId);
      if (!current) throw new Error(t("yearWheel.toast_season_not_found"));

      const nextStart = input.start_date !== undefined ? input.start_date : current.start_date;
      const nextEnd = input.end_date !== undefined ? input.end_date : current.end_date;

      if (nextStart && nextEnd && new Date(nextStart) > new Date(nextEnd)) {
        throw new Error(t("yearWheel.toast_start_before_end"));
      }

      const { data, error } = await supabase
        .from("season")
        .update({
          start_date: nextStart,
          end_date: nextEnd,
        })
        .eq("season_id", input.seasonId)
        .eq("workspace_id", wsId!)
        .select(
          "season_id, name, slug, season_type, start_date, end_date, status, is_default, color, icon, description, planning_cycle_id",
        )
        .single();

      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: (data) => {
      void emit({
        event: "season updated",
        workspace_id: wsId ?? null,
        actor_id: profileId ?? "",
        properties: {
          entity: {
            entity_type: "season",
            entity_id: data.season_id,
            entity_label: data.name,
          },
          data: {
            start_date: data.start_date,
            end_date: data.end_date,
            source: "year_wheel_resize",
          },
        },
      });
      queryClient.invalidateQueries({
        queryKey: yearWheelKeys.seasons(wsId ?? "none"),
      });
      toast.success(t("yearWheel.toast_season_dates_updated"));
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  return {
    seasons: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    createSeason,
    activateSeason,
    archiveSeason,
    duplicateYear,
    updateSeasonDates,
  };
}

/**
 * Shifts a date string by a given number of years, preserving month and day.
 * Handles Feb 29 → Feb 28 for non-leap-year targets.
 */
function shiftDateByYears(dateStr: string | null, years: number): string | null {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  date.setFullYear(date.getFullYear() + years);
  return date.toISOString().split("T")[0]!;
}
