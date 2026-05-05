"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { UiPhase } from "@smartout/utils";
import type { DepartmentSessionRow } from "@/app/dashboard/hms/_hooks/use-department-sessions";
import {
  useDayTimelineEvents,
  type DayEvent,
} from "@/app/dashboard/_hooks/use-day-timeline-events";
import { useWorkspaceOptional } from "@/lib/workspace-context";
import { DayTimelineStrip } from "@/components/day/DayTimelineStrip";
import { DayEventList } from "@/components/day/DayEventList";
import { EventDetailPanel } from "@/components/day/EventDetailPanel";
import { useEntityDrawerOptional } from "@/components/dashboard/entity-drawer/EntityDrawerContext";

export function TimelineTab({
  session,
  phase: _phase,
  departmentId,
  dateISO,
}: {
  session: DepartmentSessionRow;
  phase: UiPhase;
  departmentId: string;
  dateISO: string;
}) {
  const wsCtx = useWorkspaceOptional();
  const workspaceId = wsCtx?.workspace.workspace_id ?? null;
  const qc = useQueryClient();
  const drawer = useEntityDrawerOptional();
  const [selected, setSelected] = useState<DayEvent | null>(null);

  const events = useDayTimelineEvents({
    workspaceId,
    departmentId,
    sessionId: session.sessionId,
    dateISO,
  });

  function refreshEvents() {
    qc.invalidateQueries({ queryKey: ["day-control", "timeline-events"] });
  }

  function handleSelect(e: DayEvent) {
    // Drawer-routable types open the entity drawer; rest fall back to inline panel.
    if (drawer) {
      if (e.type === "checkin" || e.type === "checkout") {
        drawer.openDrawer("shift", e.refId);
        return;
      }
      if (e.type === "task") {
        drawer.openDrawer("cascade_task", e.refId);
        return;
      }
      if (e.type === "deviation") {
        drawer.openDrawer("deviation", e.refId);
        return;
      }
    }
    // Toggle off if same event clicked twice
    setSelected((prev) => (prev?.id === e.id ? null : e));
  }

  if (events.isLoading) {
    return <div className="text-muted-foreground text-[13px]">Laster tidslinjen…</div>;
  }

  const data = events.data ?? [];

  return (
    <div className="scrollbar-thin flex h-full min-h-0 flex-1 flex-col overflow-y-auto pr-1">
      <div className="grid gap-3">
        {/* Sticky strip — never disappears while event-list scrolls below */}
        <div className="sticky top-0 z-20 pb-1">
          <DayTimelineStrip
            events={data}
            startHHMM={session.plannedOpen}
            endHHMM={session.plannedClose}
            dateISO={dateISO}
            onSelect={handleSelect}
          />
        </div>

        {/* Inline editor for selected event */}
        <EventDetailPanel
          event={selected}
          onClose={() => setSelected(null)}
          onSaved={() => {
            refreshEvents();
          }}
        />

        <DayEventList
          events={data}
          highlightedId={selected?.id ?? null}
          onEventClick={handleSelect}
        />
      </div>
    </div>
  );
}
