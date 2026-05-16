"use client";

import { useContext, useState } from "react";
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
import { SlotQuickAddPopover } from "@/components/day/SlotQuickAddPopover";
import { ShiftStartDialog } from "@/components/day/ShiftStartDialog";
import { AddTaskDialog } from "@/components/day/AddTaskDialog";
import { DeviationDialog } from "@/app/dashboard/operations/_components/DeviationDialog";
import { ReservationSheet } from "@/components/dashboard/cockpit/sheets/ReservationSheet";
import { DailyNoteSheet } from "@/components/dashboard/cockpit/sheets/DailyNoteSheet";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import type { WorkspaceRole } from "@/lib/context/bootstrap-contract";
import { useDayTimelineScope } from "@/app/dashboard/_hooks/use-day-timeline-scope";
import { ScopeFilterPill } from "@/components/day/ScopeFilterPill";

// Local type for popover anchor — time + whether it is open.
type QuickAddState = {
  open: boolean;
  time: string;
};

const CLOSED_QUICK_ADD: QuickAddState = { open: false, time: "" };

export function TimelineTab({
  session,
  phase: _phase,
  departmentId,
  dateISO,
  role,
}: {
  session: DepartmentSessionRow;
  phase: UiPhase;
  departmentId: string;
  dateISO: string;
  /** Current user's workspace role — controls editable mode + popover gate */
  role?: WorkspaceRole | null;
}) {
  const wsCtx = useWorkspaceOptional();
  const workspaceId = wsCtx?.workspace.workspace_id ?? null;
  const qc = useQueryClient();
  const drawer = useEntityDrawerOptional();
  const dashCtx = useContext(DashboardContext);
  const profileId = dashCtx.profileId;

  const [selected, setSelected] = useState<DayEvent | null>(null);
  const [quickAdd, setQuickAdd] = useState<QuickAddState>(CLOSED_QUICK_ADD);

  // ─── Sheet / dialog open-state ───────────────────────────────────────────────
  const [slotTime, setSlotTime] = useState<string>("--:--");
  const [bookingOpen, setBookingOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [shiftStartOpen, setShiftStartOpen] = useState(false);
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [avvikDialogOpen, setAvvikDialogOpen] = useState(false);

  // Manager and above can write; employees get read-only strip.
  const canEdit = role !== null && role !== undefined && role !== "employee";

  // Scope filter (URL search-param ?scope=type:<id>)
  const { scope } = useDayTimelineScope();
  const teamId = scope.type === "team" ? scope.id : null;
  const shiftId = scope.type === "shift" ? scope.id : null;

  // Authority: managers restricted to own dept; admin/owner see all.
  const isRestricted = role !== null && role !== undefined && role !== "admin" && role !== "owner";
  const ownDeptForFilter = isRestricted ? departmentId : null;

  const events = useDayTimelineEvents({
    workspaceId,
    departmentId,
    sessionId: session.sessionId,
    dateISO,
    teamId,
    shiftId,
  });

  function refreshEvents() {
    qc.invalidateQueries({ queryKey: ["day-control", "timeline-events"] });
  }

  function handleSelect(e: DayEvent) {
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
    setSelected((prev) => (prev?.id === e.id ? null : e));
  }

  function handleSlotClick(time: string) {
    if (!canEdit) return;
    setQuickAdd({ open: true, time });
  }

  function handleQuickAddAction(
    action: "booking" | "note" | "task" | "deviation" | "shift_start",
    time: string,
  ) {
    setSlotTime(time);
    switch (action) {
      case "booking":
        setBookingOpen(true);
        break;
      case "note":
        setNoteOpen(true);
        break;
      case "task":
        setTaskDialogOpen(true);
        break;
      case "deviation":
        setAvvikDialogOpen(true);
        break;
      case "shift_start":
        setShiftStartOpen(true);
        break;
    }
  }

  if (events.isLoading) {
    return <div className="text-muted-foreground text-[13px]">Laster tidslinjen…</div>;
  }

  const data = events.data ?? [];
  // Coerce role to WorkspaceRole | null for popover prop
  const popoverRole = (role ?? null) as WorkspaceRole | null;

  return (
    <div className="scrollbar-thin flex h-full min-h-0 flex-1 flex-col overflow-y-auto pr-1">
      <div className="grid gap-3">
        {/* Sticky strip — never disappears while event-list scrolls below */}
        <div className="sticky top-0 z-20 pb-1">
          {/* Scope filter pill — always visible, no auth required for filtering view */}
          {workspaceId && (
            <div className="mb-2 flex items-center gap-2">
              <ScopeFilterPill
                workspaceId={workspaceId}
                dateISO={dateISO}
                ownDepartmentId={ownDeptForFilter}
                profileId={profileId ?? ""}
              />
            </div>
          )}

          {/* The popover trigger is rendered inline inside DayTimelineStrip hit-zones.
              We use a controlled popover here: DayTimelineStrip fires onSlotClick,
              which opens the popover. The popover trigger is a transparent div wrapper. */}
          <SlotQuickAddPopover
            open={quickAdd.open}
            onOpenChange={(o) => setQuickAdd((prev) => ({ ...prev, open: o }))}
            time={quickAdd.time || "--:--"}
            actorId={profileId}
            workspaceId={workspaceId}
            role={popoverRole}
            onAction={handleQuickAddAction}
          >
            {/* Transparent div so popover attaches to the strip area */}
            <div className="relative w-full">
              <DayTimelineStrip
                events={data}
                startHHMM={session.plannedOpen}
                endHHMM={session.plannedClose}
                dateISO={dateISO}
                onSelect={handleSelect}
                editable={canEdit}
                onSlotClick={handleSlotClick}
              />
            </div>
          </SlotQuickAddPopover>
        </div>

        {/* Empty state when scope filter is active but yields no events */}
        {data.length === 0 && scope.type !== "all" && (
          <p
            className="text-muted-foreground px-1 py-2 text-center text-xs"
            data-testid="timeline-empty-state"
          >
            Ingen hendelser for valgt scope
          </p>
        )}

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

      {/* ── Prefilled sheets/dialogs opened by SlotQuickAddPopover ─────────── */}

      {/* Booking: ReservationSheet with slotTime passed as defaultBookingTime.
          NOTE: defaultBookingTime is a new prop added to ReservationSheet in this sortie. */}
      <ReservationSheet
        open={bookingOpen}
        onOpenChange={setBookingOpen}
        anchorDate={dateISO}
        defaultBookingTime={slotTime}
      />

      {/* Note: DailyNoteSheet — Track E will extend it with a time + audience prop.
          For now opens with anchorDate; slotTime available once Track E ships. */}
      <DailyNoteSheet open={noteOpen} onOpenChange={setNoteOpen} anchorDate={dateISO} />

      {/* Shift start confirmation stub — action wiring in follow-up sortie */}
      <ShiftStartDialog open={shiftStartOpen} onOpenChange={setShiftStartOpen} time={slotTime} />

      {/* ── Task dialog — SlotQuickAddPopover "Oppgave" path ─────────────── */}
      {/* Controlled-open: slotTime prefills due_time hint + title.
          session.sessionId scopes hook options to the current session. */}
      <AddTaskDialog
        sessionId={session.sessionId}
        open={taskDialogOpen}
        onOpenChange={setTaskDialogOpen}
        defaultTime={slotTime !== "--:--" ? slotTime : undefined}
        defaultSessionId={session.sessionId}
      />

      {/* ── Deviation dialog — SlotQuickAddPopover "Avvik" path ──────────── */}
      {/* Controlled-open: slotTime + dateISO compose occurred_at for title context.
          workspaceId + profileId resolved from context (ADR-0151 server-derived). */}
      {workspaceId && profileId && (
        <DeviationDialog
          workspaceId={workspaceId}
          profileId={profileId}
          open={avvikDialogOpen}
          onOpenChange={setAvvikDialogOpen}
          defaultOccurredAt={slotTime !== "--:--" ? `${dateISO}T${slotTime}:00` : undefined}
          defaultDepartmentId={departmentId}
        />
      )}
    </div>
  );
}
