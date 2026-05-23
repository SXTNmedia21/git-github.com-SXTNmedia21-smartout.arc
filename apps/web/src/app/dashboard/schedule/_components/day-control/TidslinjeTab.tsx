// ============================================
// day-control/TidslinjeTab.tsx
// Slim chronological day-timeline tab for DayControlPanel bottom-sheet.
// Assembles TidslinjeChipBar (location filter) + TidslinjeRow list.
// Closes L-0340: wires emit() for tidslinje_tab_opened + tidslinje_filter_changed.
// Connected to: DayControlPanel.tsx, TidslinjeChipBar.tsx, TidslinjeRow.tsx
//
// Why this exists: bottom-sheet 75vh constraint = no gantt, no multi-strip.
// Flat chronological card list + location chip-bar filter is the right model
// (council 2026-05-23 + L-0338: surface duplication ≠ authority fragmentation).
//
// Read-only V1: all writes route through stage-engine capability tools.
// DnD re-time deferred per G19a/b/c (separate capability sortie).
// ============================================
"use client";

import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "@smartout/i18n";
import { emit, nonEmpty } from "@smartout/telemetry";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@smartout/supabase/client";
import { useEntityDrawerOptional } from "@/components/dashboard/entity-drawer/EntityDrawerContext";
import { useWorkspaceOptional } from "@/lib/workspace-context";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import {
  useDayTimelineEvents,
  type DayEvent,
} from "@/app/dashboard/_hooks/use-day-timeline-events";
import { useDayLines } from "@/components/day/_hooks/use-day-lines";
import { useDaySession } from "./use-day-session";
import { TidslinjeChipBar, type LocationChip } from "./TidslinjeChipBar";
import { TidslinjeRow } from "./TidslinjeRow";
import { Skeleton } from "@/components/ui/skeleton";

// ── L-0177 fail-fast emit wrappers ─────────────────────────────────────────
//
// Every emit() MUST verify workspace_id + profile_id are non-empty strings
// before firing. Per ADR-0134 and mobile telemetry contract: empty-string
// fallbacks are forbidden — they silently corrupt activity_trail and
// engine_event routing.
//
// emitNonEmpty checks both IDs before calling the typed event-specific
// helpers below. The wrapper name is visible in tests; each call-site passes
// the literal event name as its first arg so the L-0340 CI grep can find it.

function emitNonEmpty(check: { wsId: string; profId: string }, fire: () => void): void {
  // Fail-fast — return without emitting when IDs are missing or empty
  if (typeof check.wsId !== "string" || check.wsId.length === 0) return;
  if (typeof check.profId !== "string" || check.profId.length === 0) return;
  fire();
}

/**
 * TidslinjeTab — slim purpose-built day timeline for DayControlPanel.
 *
 * Why: bottom-sheet 75vh constraint precludes a gantt or multi-strip. A flat
 * chronological card list with a chip-bar location filter is the right model
 * (council 2026-05-23 + L-0338: surface duplication ≠ authority fragmentation).
 *
 * Session resolution: replicates T7's two-query pattern from DayControlPanel.
 * No snapshot.session shape exists (T7 discovery). Query 1 → first active
 * department for workspace. Query 2 → department_session for that dept + date.
 *
 * Read-only V1: no mutation hooks. All writes route through stage-engine
 * capability tools. DnD re-time deferred per G19a/b/c.
 *
 * Telemetry: closes L-0340. Two events wired here:
 *   • tidslinje_tab_opened — emitted once on mount when all IDs resolve
 *   • tidslinje_filter_changed — emitted on every location chip toggle + clear-all
 */
export function TidslinjeTab() {
  const { t } = useTranslation("dashboard");
  const dashCtx = useContext(DashboardContext);
  // profileId sourced from DashboardContext (line 306 — null default, populated by DashboardShell)
  const profileId = dashCtx?.profileId ?? "";
  const ws = useWorkspaceOptional();
  const workspaceId = ws?.workspace.workspace_id ?? "";
  const drawer = useEntityDrawerOptional();
  const { dateId } = useDaySession();

  // ── T7 session-resolution pattern ──────────────────────────────────────
  // Snapshot has no .session sub-object (T7 discovery). Two-query approach
  // replicates DayControlPanel.tsx lines 116-151 verbatim.
  const supabase = useMemo(() => createClient(), []);

  const { data: firstDept } = useQuery({
    queryKey: ["tidslinje-tab-dept", workspaceId],
    queryFn: async () => {
      const { data } = await supabase
        .from("department")
        .select("department_id, name")
        .eq("workspace_id", workspaceId)
        .eq("is_active", true)
        .order("sort_order", { ascending: true })
        .limit(1)
        .maybeSingle();
      return data ?? null;
    },
    enabled: !!workspaceId,
    staleTime: 5 * 60 * 1000,
  });

  const { data: activeSessionId } = useQuery({
    queryKey: ["tidslinje-tab-session", firstDept?.department_id, dateId],
    queryFn: async () => {
      const { data } = await supabase
        .from("department_session")
        .select("department_session_id")
        .eq("department_id", firstDept!.department_id)
        .eq("session_date", dateId)
        .maybeSingle();
      return data?.department_session_id ?? null;
    },
    enabled: !!firstDept?.department_id && !!dateId,
    staleTime: 60 * 1000,
  });

  const sessionId = activeSessionId ?? null;
  const departmentId = firstDept?.department_id ?? null;

  // ── Data hooks ──────────────────────────────────────────────────────────
  const eventsQ = useDayTimelineEvents({
    workspaceId: workspaceId || null,
    departmentId: departmentId ?? null,
    sessionId: sessionId ?? null,
    dateISO: dateId,
  });

  const dayLinesQ = useDayLines({
    workspaceId: workspaceId || null,
    date: dateId,
    departmentIds: departmentId ? [departmentId] : [],
  });

  // ── Location chip state ─────────────────────────────────────────────────
  const [selectedLocations, setSelectedLocations] = useState<Set<string>>(new Set());

  const locations: LocationChip[] = useMemo(() => {
    const map = new Map<string, LocationChip>();
    for (const dl of dayLinesQ.data ?? []) {
      const id = dl.location_id;
      const name = dl.location_name;
      if (id && !map.has(id)) map.set(id, { id, name: name || id });
    }
    return Array.from(map.values());
  }, [dayLinesQ.data]);

  // ── Filtered event list ─────────────────────────────────────────────────
  // When no location filter is active, show all events.
  // DayEvent has no `location_id` field in V1 — location filtering is a
  // placeholder that will become meaningful once location_id is added to
  // the DayEvent shape (follow-up sortie). For now: chip-bar renders
  // location chips but filtering falls back to showing all (no-op filter).
  const filteredEvents = useMemo(() => {
    return (eventsQ.data ?? []) as DayEvent[];
  }, [eventsQ.data]);

  // ── Telemetry: mount once when IDs resolve (L-0340, event 1) ───────────
  const emittedRef = useRef(false);
  useEffect(() => {
    if (emittedRef.current) return;
    if (!workspaceId || !profileId || !sessionId || !dateId) return;
    emittedRef.current = true;
    emitNonEmpty(
      { wsId: workspaceId, profId: profileId },
      () =>
        // Literal event name — L-0340 grep visible
        void emit({
          event: "tidslinje_tab_opened",
          workspace_id: nonEmpty(workspaceId, "workspace_id"),
          actor_id: nonEmpty(profileId, "actor_id"),
          properties: {
            data: {
              workspace_id: workspaceId,
              profile_id: profileId,
              department_session_id: sessionId,
              date_iso: dateId,
            },
          },
        }),
    );
  }, [workspaceId, profileId, sessionId, dateId]);

  // ── Location chip handlers (L-0340, event 2) ───────────────────────────
  const handleToggleLocation = useCallback(
    (locId: string) => {
      setSelectedLocations((current) => {
        const next = new Set(current);
        const wasActive = next.has(locId);
        if (wasActive) next.delete(locId);
        else next.add(locId);
        emitNonEmpty(
          { wsId: workspaceId, profId: profileId },
          () =>
            // Literal event name — L-0340 grep visible
            void emit({
              event: "tidslinje_filter_changed",
              workspace_id: nonEmpty(workspaceId, "workspace_id"),
              actor_id: nonEmpty(profileId, "actor_id"),
              properties: {
                data: {
                  workspace_id: workspaceId,
                  profile_id: profileId,
                  department_session_id: sessionId ?? "",
                  filter_type: "location",
                  filter_value: locId,
                  active: !wasActive,
                },
              },
            }),
        );
        return next;
      });
    },
    [workspaceId, profileId, sessionId],
  );

  const handleClearLocations = useCallback(() => {
    if (selectedLocations.size === 0) return;
    setSelectedLocations(new Set());
    emitNonEmpty(
      { wsId: workspaceId, profId: profileId },
      () =>
        // Literal event name — L-0340 grep visible
        void emit({
          event: "tidslinje_filter_changed",
          workspace_id: nonEmpty(workspaceId, "workspace_id"),
          actor_id: nonEmpty(profileId, "actor_id"),
          properties: {
            data: {
              workspace_id: workspaceId,
              profile_id: profileId,
              department_session_id: sessionId ?? "",
              filter_type: "location",
              filter_value: "__ALL__",
              active: true,
            },
          },
        }),
    );
  }, [workspaceId, profileId, sessionId, selectedLocations.size]);

  // ── Row click → EntityDrawer ────────────────────────────────────────────
  const handleRowClick = useCallback(
    (event: DayEvent) => {
      if (!drawer) return;
      if (event.type === "task") {
        drawer.openDrawer("cascade_task", event.refId);
      } else if (event.type === "checkin" || event.type === "checkout") {
        drawer.openDrawer("shift", event.refId);
      } else if (event.type === "deviation") {
        drawer.openDrawer("deviation", event.refId);
      }
      // booking / note / hook: no matching EntityType yet — silent no-op
    },
    [drawer],
  );

  // ── Loading skeleton ────────────────────────────────────────────────────
  if (eventsQ.isLoading || dayLinesQ.isLoading) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-7 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="flex h-full flex-col gap-4">
      <TidslinjeChipBar
        locations={locations}
        selectedLocations={selectedLocations}
        onToggleLocation={handleToggleLocation}
        onClearAll={handleClearLocations}
      />
      <div className="flex flex-1 flex-col gap-2 overflow-y-auto">
        {filteredEvents.length === 0 ? (
          <div className="text-muted-foreground py-12 text-center text-sm">
            {t("tidslinje.empty_state")}
          </div>
        ) : (
          filteredEvents.map((e) => <TidslinjeRow key={e.id} event={e} onClick={handleRowClick} />)
        )}
      </div>
    </div>
  );
}
