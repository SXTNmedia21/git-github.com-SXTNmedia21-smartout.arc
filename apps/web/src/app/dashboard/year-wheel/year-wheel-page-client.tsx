/**
 * Year Wheel page — the primary season planning interface.
 *
 * Three-column shell per spec §3 (2026-04-20 redesign):
 *   ┌─ YearWheelTopbar ─────────────────────────────────────────────┐
 *   │ SeasonSidebar │ Main (headline + YearCanvas + Legend + AI) │ CompanionRail │
 *   └───────────────────────────────────────────────────────────────┘
 *
 * Year state lives in the URL (`?year=`) so navigation is back/forward-friendly
 * and shareable. Filter lives in local state — it's ephemeral per visit.
 *
 * Draw-to-create flow: YearCanvas detects the drag, emits
 * `season draw_completed` itself (Phase 3.6), then calls `onDrawCreate` with
 * the ISO dates. This page opens SeasonQuickCreateSheet, which on submit
 * routes to `/dashboard/season/[id]?tab=budget`. Abandoning the sheet fires
 * `season draw_cancelled` with reason `sheet_abandoned`.
 *
 * Client island per ADR-0115: the server `page.tsx` wraps this in
 * <Suspense> and gates access via resolveDashboardContext(). All
 * TanStack Query hooks and canvas interaction live here.
 */

"use client";

import { useContext, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

import { emit, nonEmpty } from "@smartout/telemetry";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { useWorkspaceOptional } from "@/lib/workspace-context";

import { YearWheelTopbar } from "./_components/shell/YearWheelTopbar";
import { SeasonSidebar } from "./_components/shell/SeasonSidebar";
import { CompanionRail } from "./_components/shell/CompanionRail";
import { LegendChip } from "./_components/shell/LegendChip";
import { AiSuggestionCard } from "./_components/shell/AiSuggestionCard";
import { YearCanvas } from "./_components/canvas/YearCanvas";
import { SeasonQuickCreateSheet } from "./_components/SeasonQuickCreateSheet";
import { useSeasons, usePlanningEvents, useSeasonsSeededState } from "./_hooks";

type FilterKey = "all" | "active" | "draft" | "archived";

export function YearWheelPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Workspace + profile context — matches the pattern used by the _hooks
  // wrappers (useSeasons etc.), so we don't need page.tsx to pass them down.
  const { profileId } = useContext(DashboardContext);
  const ctx = useWorkspaceOptional();
  const workspaceId = ctx?.workspace.workspace_id ?? null;

  // Year is URL-driven so deep-links and browser back/forward both work.
  const urlYear = searchParams.get("year");
  const year =
    urlYear && /^\d{4}$/.test(urlYear) ? parseInt(urlYear, 10) : new Date().getUTCFullYear();

  const [filter, setFilter] = useState<FilterKey>("all");
  const [quickCreate, setQuickCreate] = useState<{ start: string; end: string } | null>(null);

  // Alt+N shortcut: quick-open the season sheet with a 7-day range starting
  // today. Skips if the sheet is already open so we don't stomp on an
  // in-progress draft. Registered globally on window — the year-wheel page
  // is the only route that mounts this handler, so there's no cross-page
  // collision.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey && e.key.toLowerCase() === "n" && !quickCreate) {
        e.preventDefault();
        const today = new Date();
        const plus7 = new Date(today.getTime() + 7 * 86400000);
        const fmt = (d: Date) =>
          `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
        setQuickCreate({ start: fmt(today), end: fmt(plus7) });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [quickCreate]);

  // Seasons returns { seasons, ... } (not { data }). Events likewise returns
  // { events, ... } — both scoped to workspace via the hook wrappers.
  const { seasons } = useSeasons();
  // usePlanningEvents accepts an optional planning_cycle_id; passing undefined
  // yields all events for the workspace. The canvas owns year filtering
  // (events outside the visible year fall off-canvas via xForDate).
  const { events } = usePlanningEvents();
  // M4 — seasons that already have a seeded D1 fanout (department_operating_hours
  // rows pinned to the season_id). Feeds the SeasonSidebar "Seedet" pill.
  const { seededSet } = useSeasonsSeededState();

  const filteredSeasons = seasons.filter((s) => {
    if (filter === "all") return true;
    return s.status === filter;
  });

  const handleYearChange = (next: number) => {
    const params = new URLSearchParams(searchParams);
    params.set("year", String(next));
    router.push(`/dashboard/year-wheel?${params.toString()}`);
    if (workspaceId && profileId) {
      void emit({
        event: "season year_navigated",
        workspace_id: nonEmpty(workspaceId, "workspace_id"),
        actor_id: nonEmpty(profileId, "actor_id"),
        properties: {
          data: {
            from_year: year,
            to_year: next,
            direction: next > year ? "forward" : "backward",
          },
        },
      });
    }
  };

  const handleFilterChange = (next: FilterKey) => {
    setFilter(next);
    if (workspaceId && profileId) {
      void emit({
        event: "season sidebar_filter_changed",
        workspace_id: nonEmpty(workspaceId, "workspace_id"),
        actor_id: nonEmpty(profileId, "actor_id"),
        properties: { data: { filter: next } },
      });
    }
  };

  const handleNewSeasonHint = () => {
    toast.info("Klikk og dra i lerretet for å tegne en sesong.");
  };

  const handleSelectSeason = (id: string) => {
    const season = seasons.find((s) => s.season_id === id);
    router.push(`/dashboard/season/${id}?tab=budget`);
    if (workspaceId && profileId) {
      void emit({
        event: "season block_clicked",
        workspace_id: nonEmpty(workspaceId, "workspace_id"),
        actor_id: nonEmpty(profileId, "actor_id"),
        properties: {
          entity: {
            entity_type: "season",
            entity_id: id,
            entity_label: season?.name ?? "",
          },
          data: { season_name: season?.name ?? "", year },
        },
      });
    }
  };

  const handleSelectEvent = (id: string) => {
    // No dedicated PlanningEventDialog exists yet (Phase 7 will build one).
    // Spec §6 allows: "emit and show a toast" as the interim behaviour.
    const ev = events.find((e) => e.planning_event_id === id);
    if (workspaceId && profileId) {
      // entity_type is the enum of supported EntityType values — no
      // "planning_event" member exists, so we tag the pin click as
      // belonging to the parent `season` (matches the old page's
      // pattern and keeps the event shape valid).
      void emit({
        event: "season pin_clicked",
        workspace_id: nonEmpty(workspaceId, "workspace_id"),
        actor_id: nonEmpty(profileId, "actor_id"),
        properties: {
          entity: {
            entity_type: "season",
            entity_id: id,
            entity_label: ev?.name ?? "",
          },
          data: { event_name: ev?.name ?? "", year },
        },
      });
    }
    if (ev) {
      toast(ev.name, {
        description: `${ev.event_date} · ${ev.category}`,
      });
    }
  };

  const handleDrawCreate = ({ start, end }: { start: string; end: string }) => {
    // YearCanvas already emits `season draw_completed` internally (Phase 3.6).
    // No duplicate emit here.
    setQuickCreate({ start, end });
  };

  const handleQuickCreateAbandon = (reason: "sheet_abandoned") => {
    if (workspaceId && profileId) {
      void emit({
        event: "season draw_cancelled",
        workspace_id: nonEmpty(workspaceId, "workspace_id"),
        actor_id: nonEmpty(profileId, "actor_id"),
        properties: { data: { reason } },
      });
    }
  };

  return (
    <div className="bg-background text-foreground flex h-screen flex-col">
      <YearWheelTopbar
        year={year}
        onYearChange={handleYearChange}
        onNewSeasonHint={handleNewSeasonHint}
      />
      <div className="flex min-h-0 flex-1">
        <SeasonSidebar
          seasons={seasons}
          selectedId={null}
          filter={filter}
          onSelect={handleSelectSeason}
          onFilterChange={handleFilterChange}
          year={year}
          seededSet={seededSet}
        />
        <main className="flex min-w-0 flex-1 flex-col gap-4 overflow-auto p-6">
          <div>
            <h2 className="font-heading mb-1 text-[40px] font-normal tracking-[-0.025em] italic">
              Hele året i ett blikk
            </h2>
            <p className="text-muted-foreground max-w-[680px] text-sm leading-relaxed">
              Ikke-sesong er <b className="text-foreground font-medium">Normal drift</b> — arvet fra
              workspace. Fargede blokker overstyrer lokalt. Klikk og dra for å tegne nye sesonger.
            </p>
          </div>
          <YearCanvas
            year={year}
            seasons={filteredSeasons}
            events={events}
            selectedId={null}
            onSelectSeason={handleSelectSeason}
            onSelectEvent={handleSelectEvent}
            onDrawCreate={handleDrawCreate}
            workspaceId={workspaceId ?? ""}
            profileId={profileId}
          />
          <LegendChip />
          <AiSuggestionCard />
        </main>
        <CompanionRail seasons={seasons} events={events} year={year} />
      </div>
      {quickCreate && (
        <SeasonQuickCreateSheet
          open={quickCreate !== null}
          onOpenChange={(open) => {
            if (!open) setQuickCreate(null);
          }}
          initialStart={quickCreate.start}
          initialEnd={quickCreate.end}
          year={year}
          onAbandon={handleQuickCreateAbandon}
        />
      )}
    </div>
  );
}
