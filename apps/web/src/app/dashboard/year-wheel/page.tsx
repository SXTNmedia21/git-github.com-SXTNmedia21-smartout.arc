/**
 * Year Wheel page — the primary season planning interface.
 *
 * Canvas/Blocks/Pins mental model:
 * - Canvas: the 12-month horizontal timeline grid
 * - Blocks: seasons as colored bars
 * - Pins: planning events as clickable dots
 *
 * Clicking a block selects that season and shows its detail tabs below.
 * The YearNavigation component handles year switching.
 */

"use client";

import { useState, useContext, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "@smartout/i18n";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { emit } from "@smartout/telemetry";
import { useWorkspaceOptional } from "@/lib/workspace-context";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { SeasonCreateSheet } from "./_components/SeasonCreateSheet";
import { useDayFactors, useHourFactors, useSeasonBudget, useSeasons } from "./_hooks";
import { usePlanningEvents } from "./_hooks/use-planning-events";
import { YearWheelTimeline } from "./_components/YearWheelTimeline";
import { YearNavigation } from "./_components/YearNavigation";
import { SeasonDrawer } from "./_components/SeasonDrawer";
import { Play, Archive, Loader2 } from "lucide-react";

export default function YearWheelPage() {
  const { t } = useTranslation("dashboard");
  const { isDark, profileId } = useContext(DashboardContext);
  const ctx = useWorkspaceOptional();
  const wsId = ctx?.workspace.workspace_id ?? null;

  const [currentYear, setCurrentYear] = useState(() => new Date().getFullYear());
  const [selectedSeasonId, setSelectedSeasonId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>(
    () => new Date().toISOString().split("T")[0]!,
  );
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createType, setCreateType] = useState<
    "training_slot" | "season_start" | "important_event" | "special_day"
  >("important_event");
  const [createTitle, setCreateTitle] = useState("");
  const [createEndDate, setCreateEndDate] = useState<string>("");
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [seasonSort, setSeasonSort] = useState<"start-asc" | "start-desc" | "name">("start-asc");
  const [eventSort, setEventSort] = useState<"date-asc" | "date-desc" | "name">("date-asc");
  const [timelineView, setTimelineView] = useState<"year" | "month">("year");
  const [zoomMonth, setZoomMonth] = useState(() => new Date().getMonth());

  const { seasons, activateSeason, archiveSeason, duplicateYear, createSeason, updateSeasonDates } =
    useSeasons();
  const { events, createEvent, updateEvent } = usePlanningEvents();
  const allEvents = events ?? [];

  useEffect(() => {
    if (!selectedSeasonId && seasons.length > 0) {
      const activeSeason = seasons.find((s) => s.status === "active");
      if (activeSeason) {
        setSelectedSeasonId(activeSeason.season_id);
      } else {
        setSelectedSeasonId(seasons[0]!.season_id);
      }
    }
  }, [seasons, selectedSeasonId]);

  const { budget } = useSeasonBudget(selectedSeasonId);
  const { dayFactors } = useDayFactors(budget?.season_budget_id ?? null);
  const { hourFactors } = useHourFactors(budget?.season_budget_id ?? null);
  const selectedSeason = seasons.find((s) => s.season_id === selectedSeasonId);
  const isBudgetLocked = budget?.status === "locked";

  const setupStatus = {
    hasBudget: Boolean(budget),
    hasDayFactors: dayFactors.length > 0,
    hasHourFactors: hourFactors.length > 0,
  };
  const isReady = setupStatus.hasBudget && setupStatus.hasDayFactors && setupStatus.hasHourFactors;

  const handleYearChange = useCallback(
    (newYear: number) => {
      const prevYear = currentYear;
      setCurrentYear(newYear);
      if (wsId && profileId) {
        emit({
          event: "season year_navigated",
          workspace_id: wsId,
          actor_id: profileId,
          properties: {
            data: {
              from_year: prevYear,
              to_year: newYear,
              direction: newYear > prevYear ? "forward" : "backward",
            },
          },
        });
      }
    },
    [currentYear, wsId, profileId],
  );

  const handleBlockClick = useCallback(
    (seasonId: string) => {
      setSelectedSeasonId(seasonId);
      setDrawerOpen(true);
      const season = seasons.find((s) => s.season_id === seasonId);
      if (wsId && profileId && season) {
        emit({
          event: "season block_clicked",
          workspace_id: wsId,
          actor_id: profileId,
          properties: {
            entity: { entity_type: "season", entity_id: seasonId, entity_label: season.name },
            data: { season_name: season.name, year: currentYear },
          },
        });
      }
    },
    [seasons, currentYear, wsId, profileId],
  );

  const handlePinClick = useCallback(
    (eventId: string) => {
      const ev = allEvents.find((e) => e.planning_event_id === eventId);
      if (wsId && profileId && ev) {
        emit({
          event: "season pin_clicked",
          workspace_id: wsId,
          actor_id: profileId,
          properties: {
            entity: { entity_type: "season", entity_id: eventId, entity_label: ev.name },
            data: { event_name: ev.name, year: currentYear },
          },
        });
      }
      if (ev) {
        setEditingEventId(ev.planning_event_id);
        setSelectedDate(ev.event_date);
        setCreateTitle(ev.name);
        setCreateType(ev.category === "cultural_commercial" ? "important_event" : "special_day");
        setCreateDialogOpen(true);
      }
    },
    [allEvents, currentYear, wsId, profileId],
  );

  const jumpToDate = useCallback(
    (dateIso: string) => {
      setSelectedDate(dateIso);
      const parsed = new Date(dateIso);
      if (!Number.isNaN(parsed.getTime())) {
        setZoomMonth(parsed.getMonth());
      }
      const dateYear = parsed.getFullYear();
      if (dateYear !== currentYear) {
        handleYearChange(dateYear);
      }
    },
    [currentYear, handleYearChange],
  );

  const handleSeasonEdgeCommit = useCallback(
    (seasonId: string, edge: "start" | "end", dateIso: string) => {
      if (edge === "start") {
        updateSeasonDates.mutate({ seasonId, start_date: dateIso });
      } else {
        updateSeasonDates.mutate({ seasonId, end_date: dateIso });
      }
    },
    [updateSeasonDates],
  );

  const handleCreateFromTimeline = useCallback(async () => {
    const title = createTitle.trim();
    const fallbackTitle = {
      training_slot: "Opplæringstidspunkt",
      season_start: `Sesongstart ${selectedDate}`,
      important_event: "Viktig hendelse",
      special_day: "Spesiell dag",
    }[createType];

    const finalTitle = title || fallbackTitle;

    if (createType === "season_start") {
      const createdSeason = await createSeason.mutateAsync({
        name: finalTitle,
        startDate: selectedDate,
        endDate: createEndDate || null,
      });
      setSelectedSeasonId(createdSeason.season_id);
      setDrawerOpen(true);
    } else if (editingEventId) {
      const category = createType === "important_event" ? "cultural_commercial" : "internal";
      await updateEvent.mutateAsync({
        planning_event_id: editingEventId,
        name: finalTitle,
        category,
        event_date: selectedDate,
      });
    } else {
      const category = createType === "important_event" ? "cultural_commercial" : "internal";
      await createEvent.mutateAsync({
        name: finalTitle,
        description: null,
        category,
        source: "manual",
        event_date: selectedDate,
        demand_multiplier: 1,
        planning_cycle_id: selectedSeason?.planning_cycle_id ?? null,
      });
    }

    setCreateDialogOpen(false);
    setCreateTitle("");
    setCreateEndDate("");
    setEditingEventId(null);
  }, [
    createEndDate,
    createEvent,
    createSeason,
    createTitle,
    createType,
    editingEventId,
    selectedDate,
    selectedSeason?.planning_cycle_id,
    updateEvent,
  ]);

  const sortedSeasons = useMemo(() => {
    const copy = [...seasons];
    if (seasonSort === "name") {
      copy.sort((a, b) => a.name.localeCompare(b.name));
      return copy;
    }
    copy.sort((a, b) => {
      const aDate = a.start_date ? new Date(a.start_date).getTime() : 0;
      const bDate = b.start_date ? new Date(b.start_date).getTime() : 0;
      return seasonSort === "start-asc" ? aDate - bDate : bDate - aDate;
    });
    return copy;
  }, [seasonSort, seasons]);

  const sortedEvents = useMemo(() => {
    const copy = [...allEvents];
    if (eventSort === "name") {
      copy.sort((a, b) => a.name.localeCompare(b.name));
      return copy;
    }
    copy.sort((a, b) => {
      const aDate = new Date(a.event_date).getTime();
      const bDate = new Date(b.event_date).getTime();
      return eventSort === "date-asc" ? aDate - bDate : bDate - aDate;
    });
    return copy;
  }, [allEvents, eventSort]);

  return (
    <div className="z-10 mx-auto w-full max-w-7xl flex-1 overflow-x-hidden overflow-y-auto px-6 py-6 md:px-10 lg:px-12">
      {/* Year navigation */}
      <div className="mb-6">
        <YearNavigation currentYear={currentYear} onYearChange={handleYearChange} />
      </div>

      {/* Date-first controls (MVP): date picker + June 1 quick jump */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Input
          type="date"
          value={selectedDate}
          onChange={(event) => jumpToDate(event.target.value)}
          className="w-[180px]"
          aria-label="Go to date"
        />
        <button
          onClick={() => jumpToDate(`${currentYear}-06-01`)}
          className={`rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${
            isDark
              ? "border-zinc-700 text-zinc-300 hover:bg-zinc-800"
              : "border-zinc-300 text-zinc-700 hover:bg-zinc-100"
          }`}
        >
          1. juni
        </button>
        <button
          onClick={() => jumpToDate(new Date().toISOString().split("T")[0]!)}
          className={`rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${
            isDark
              ? "border-zinc-700 text-zinc-300 hover:bg-zinc-800"
              : "border-zinc-300 text-zinc-700 hover:bg-zinc-100"
          }`}
        >
          I dag
        </button>

        <label
          className={`ml-2 flex items-center gap-2 text-xs ${isDark ? "text-zinc-400" : "text-zinc-600"}`}
        >
          <span className="shrink-0">{t("yearWheel.view_label")}</span>
          <select
            value={timelineView}
            onChange={(event) => {
              const next = event.target.value as "year" | "month";
              setTimelineView(next);
              if (next === "month") {
                setZoomMonth(new Date(selectedDate).getMonth());
              }
            }}
            className={`h-9 rounded-md border px-2 text-xs ${
              isDark
                ? "border-zinc-700 bg-zinc-900 text-zinc-100"
                : "border-zinc-300 bg-white text-zinc-900"
            }`}
          >
            <option value="year">{t("yearWheel.view_year")}</option>
            <option value="month">{t("yearWheel.view_month")}</option>
          </select>
        </label>

        {timelineView === "month" ? (
          <Input
            type="month"
            value={`${currentYear}-${String(zoomMonth + 1).padStart(2, "0")}`}
            onChange={(event) => {
              const raw = event.target.value;
              const [yStr, mStr] = raw.split("-");
              const y = Number(yStr);
              const m = Number(mStr);
              if (!y || !m || m < 1 || m > 12) return;
              handleYearChange(y);
              setZoomMonth(m - 1);
            }}
            className="w-[160px]"
            aria-label={t("yearWheel.select_month_aria")}
          />
        ) : null}
      </div>

      {/* Timeline canvas */}
      <div className="mb-8">
        <YearWheelTimeline
          seasons={seasons}
          events={allEvents}
          year={currentYear}
          viewMode={timelineView}
          zoomMonth={zoomMonth}
          onBlockClick={handleBlockClick}
          onPinClick={handlePinClick}
          focusedDate={selectedDate}
          onDateLaneClick={(dateIso) => {
            setSelectedDate(dateIso);
            setCreateDialogOpen(true);
            setCreateType("important_event");
            setCreateTitle("");
            setCreateEndDate("");
            setEditingEventId(null);
          }}
          onSeasonEdgeCommit={handleSeasonEdgeCommit}
        />
      </div>

      {/* Toolbar: global actions (season navigation removed from visible header) */}
      <div className="mb-8 flex flex-wrap items-center gap-4">
        <div className="ml-auto flex items-center gap-3">
          {/* "Duplicate Last Year" — clones seasons from previous year into current year */}
          <button
            onClick={() => {
              const sourceYear = currentYear - 1;
              const hasTargetSeasons = seasons.some(
                (s) => s.start_date && new Date(s.start_date).getFullYear() === currentYear,
              );
              if (hasTargetSeasons) {
                if (
                  !window.confirm(
                    `${currentYear} har allerede sesonger. Vil du fortsatt kopiere fra ${sourceYear}?`,
                  )
                )
                  return;
              }
              duplicateYear.mutate({ sourceYear, targetYear: currentYear });
            }}
            disabled={duplicateYear.isPending}
            title={t("yearWheel.copy_previous_year")}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-bold transition-all disabled:opacity-50 ${
              isDark
                ? "border-zinc-700 text-zinc-400 hover:bg-zinc-800"
                : "border-zinc-300 text-zinc-500 hover:bg-zinc-100"
            }`}
          >
            {duplicateYear.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
            {t("yearWheel.copy_previous_year")}
          </button>

          {budget && (
            <div className="flex items-center gap-2">
              {selectedSeason?.status === "draft" && (
                <button
                  onClick={() => activateSeason.mutate(selectedSeasonId!)}
                  disabled={activateSeason.isPending || !isReady}
                  title={
                    !isReady ? t("yearWheel.activate_tooltip") : t("yearWheel.activate_season")
                  }
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white shadow-sm transition-all hover:bg-emerald-500 active:scale-95 disabled:pointer-events-none disabled:opacity-50"
                >
                  {activateSeason.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Play className="h-4 w-4" />
                  )}
                  {isReady ? t("yearWheel.activate_season") : t("yearWheel.setup_incomplete")}
                </button>
              )}
              {selectedSeason?.status === "active" && (
                <button
                  onClick={() => archiveSeason.mutate(selectedSeasonId!)}
                  disabled={archiveSeason.isPending}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-600 px-3 py-2 text-xs font-bold text-zinc-300 shadow-sm transition-colors hover:bg-zinc-800 disabled:opacity-50"
                >
                  {archiveSeason.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Archive className="h-4 w-4" />
                  )}
                  {t("yearWheel.archive")}
                </button>
              )}
            </div>
          )}

          <SeasonCreateSheet
            onSeasonCreated={(seasonId) => {
              setSelectedSeasonId(seasonId);
              setDrawerOpen(true);
            }}
          />
        </div>
      </div>

      {/* List + sort below timeline */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div
          className={`rounded-xl border p-4 ${isDark ? "border-zinc-800 bg-zinc-900/40" : "border-zinc-200 bg-white"}`}
        >
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className={`text-sm font-semibold ${isDark ? "text-zinc-200" : "text-zinc-800"}`}>
              Sesonger
            </h3>
            <select
              value={seasonSort}
              onChange={(event) => setSeasonSort(event.target.value as typeof seasonSort)}
              className={`h-8 rounded-md border px-2 text-xs ${
                isDark
                  ? "border-zinc-700 bg-zinc-900 text-zinc-100"
                  : "border-zinc-300 bg-white text-zinc-900"
              }`}
            >
              <option value="start-asc">Startdato stigende</option>
              <option value="start-desc">Startdato synkende</option>
              <option value="name">Navn A-Å</option>
            </select>
          </div>
          <div className="max-h-64 space-y-1 overflow-auto">
            {sortedSeasons.map((season) => (
              <button
                key={season.season_id}
                onClick={() => handleBlockClick(season.season_id)}
                className={`w-full rounded-md px-3 py-2 text-left text-xs transition-colors ${
                  isDark ? "text-zinc-300 hover:bg-zinc-800" : "text-zinc-700 hover:bg-zinc-100"
                }`}
              >
                <div className="font-medium">{season.name}</div>
                <div className={isDark ? "text-zinc-500" : "text-zinc-500"}>
                  {season.start_date ?? "–"} {season.end_date ? `→ ${season.end_date}` : ""}
                </div>
              </button>
            ))}
          </div>
        </div>

        <div
          className={`rounded-xl border p-4 ${isDark ? "border-zinc-800 bg-zinc-900/40" : "border-zinc-200 bg-white"}`}
        >
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className={`text-sm font-semibold ${isDark ? "text-zinc-200" : "text-zinc-800"}`}>
              Hendelser
            </h3>
            <select
              value={eventSort}
              onChange={(event) => setEventSort(event.target.value as typeof eventSort)}
              className={`h-8 rounded-md border px-2 text-xs ${
                isDark
                  ? "border-zinc-700 bg-zinc-900 text-zinc-100"
                  : "border-zinc-300 bg-white text-zinc-900"
              }`}
            >
              <option value="date-asc">Dato stigende</option>
              <option value="date-desc">Dato synkende</option>
              <option value="name">Navn A-Å</option>
            </select>
          </div>
          <div className="max-h-64 space-y-1 overflow-auto">
            {sortedEvents.map((eventRow) => (
              <button
                key={eventRow.planning_event_id}
                onClick={() => handlePinClick(eventRow.planning_event_id)}
                className={`w-full rounded-md px-3 py-2 text-left text-xs transition-colors ${
                  isDark ? "text-zinc-300 hover:bg-zinc-800" : "text-zinc-700 hover:bg-zinc-100"
                }`}
              >
                <div className="font-medium">{eventRow.name}</div>
                <div className={isDark ? "text-zinc-500" : "text-zinc-500"}>
                  {eventRow.event_date}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Season detail drawer — opens when clicking a timeline block */}
      <SeasonDrawer
        season={selectedSeason ?? null}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
      />

      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingEventId ? "Rediger hendelse" : "Opprett fra årshjul"}</DialogTitle>
            <DialogDescription>
              Dato: {new Date(selectedDate).toLocaleDateString("nb-NO")}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <label className="text-sm font-medium" htmlFor="timeline-create-type">
              Type
            </label>
            <select
              id="timeline-create-type"
              value={createType}
              onChange={(event) => {
                setCreateType(event.target.value as typeof createType);
              }}
              className={`h-10 rounded-md border px-3 text-sm ${
                isDark
                  ? "border-zinc-700 bg-zinc-900 text-zinc-100"
                  : "border-zinc-300 bg-white text-zinc-900"
              }`}
            >
              <option value="training_slot">Opplæringstidspunkt</option>
              <option value="season_start">Sesongstart</option>
              <option value="important_event">Viktig hendelse</option>
              <option value="special_day">Spesiell dag</option>
            </select>

            <label className="text-sm font-medium" htmlFor="timeline-create-title">
              Tittel
            </label>
            <Input
              id="timeline-create-title"
              value={createTitle}
              onChange={(event) => setCreateTitle(event.target.value)}
              placeholder="Navn på hendelse eller sesong"
            />

            <label className="text-sm font-medium" htmlFor="timeline-create-date">
              Dato
            </label>
            <Input
              id="timeline-create-date"
              type="date"
              value={selectedDate}
              onChange={(event) => setSelectedDate(event.target.value)}
            />

            {createType === "season_start" && (
              <>
                <label className="text-sm font-medium" htmlFor="timeline-create-end-date">
                  Sesongslutt
                </label>
                <Input
                  id="timeline-create-end-date"
                  type="date"
                  value={createEndDate}
                  onChange={(event) => setCreateEndDate(event.target.value)}
                />
              </>
            )}
          </div>
          <DialogFooter>
            <button
              onClick={() => {
                setCreateDialogOpen(false);
                setEditingEventId(null);
              }}
              className={`rounded-md px-3 py-2 text-sm ${
                isDark ? "text-zinc-300 hover:bg-zinc-800" : "text-zinc-600 hover:bg-zinc-100"
              }`}
            >
              Avbryt
            </button>
            <button
              onClick={() => {
                void handleCreateFromTimeline();
              }}
              className="rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-500"
            >
              {editingEventId ? "Lagre" : "Opprett"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
