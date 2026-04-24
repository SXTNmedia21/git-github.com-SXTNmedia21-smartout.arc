import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "@smartout/i18n";

import { createClient } from "@smartout/supabase/client";
import { emit, nonEmpty } from "@smartout/telemetry";

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

export type CreateSeasonInput = {
  name: string;
  // Required: the quick-create sheet always pre-fills both from the canvas
  // draw. `duplicateYear` uses a direct INSERT (not this mutation) so it
  // doesn't constrain this shape. See docs/superpowers/plans/2026-04-20-year-wheel-redesign.md §7.1.
  startDate: string;
  endDate: string;
  color?: string | null;
  planningCycleId?: string | null;
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
          color: input.color ?? null,
          planning_cycle_id: input.planningCycleId ?? null,
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
        workspace_id: wsId ? nonEmpty(wsId, "workspace_id") : null,
        actor_id: nonEmpty(profileId ?? "unknown", "actor_id"),
        properties: {
          entity: {
            entity_type: "season",
            entity_id: data.season_id,
            entity_label: name,
          },
          data: {
            name,
            status: "draft",
            color: data.color ?? null,
            planning_cycle_id: data.planning_cycle_id ?? null,
          },
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

  // NOTE: `activateSeason` mutation deleted per ADR-0200 §Cutover (L-0098 flip).
  // The old client-side path (browser confirm prompt + 3-step archive→activate +
  // bypassable gate) was broken by design. Callers now invoke `activateSeasonAction`
  // Server Action directly (see
  // `apps/web/src/app/dashboard/year-wheel/_components/SeasonActivationProposalModal.tsx`).
  // Package boundary: `@smartout/year-wheel` does NOT depend on `@smartout/web`, so
  // wrapping the Server Action here is forbidden. The Modal owns the UX (preview +
  // authority gate + typed-error rendering), and the Server Action emits canonically
  // server-side. Invalidation of the 'seasons' query key on success is handled by
  // the Modal's parent (year-wheel or season page) via `queryClient.invalidateQueries`.

  // NOTE: `archiveSeason` mutation deleted per M5.3 cleanup (L-0098 flip).
  // The old client-side path bypassed `gateAction` (ADR-0099/0196 violation) by
  // issuing a direct `supabase.from("season").update(...)` without the authority
  // gate. M4 added `archiveSeasonAction` Server Action but left this orphan
  // exported. Zero consumers at deletion time. Callers now invoke
  // `archiveSeasonAction` Server Action directly (see
  // `apps/web/src/app/dashboard/year-wheel/_actions/archive-season-action.ts`).
  // Package boundary: `@smartout/year-wheel` does NOT depend on `@smartout/web`, so
  // wrapping the Server Action here is forbidden. Consumers own the UX (authority
  // gate + typed-error rendering) and invalidation of the 'seasons' query key.

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
        workspace_id: wsId ? nonEmpty(wsId, "workspace_id") : null,
        actor_id: nonEmpty(profileId ?? "unknown", "actor_id"),
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
        workspace_id: wsId ? nonEmpty(wsId, "workspace_id") : null,
        actor_id: nonEmpty(profileId ?? "unknown", "actor_id"),
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
