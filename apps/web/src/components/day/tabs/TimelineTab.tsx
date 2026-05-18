"use client";

import { useContext, useState, useCallback, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Info, PlusCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { type UiPhase, getPhaseBoundaries } from "@smartout/utils";
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
import { SlotPicker, type SlotPickerAction } from "@/components/day/SlotPicker";
import { FreeFormChipDialog } from "@/components/day/FreeFormChipDialog";
import { TimelineTopBar } from "@/components/day/TimelineTopBar";
import { ShiftStartDialog } from "@/components/day/ShiftStartDialog";
import { AddTaskDialog } from "@/components/day/AddTaskDialog";
import { DeviationDialog } from "@/app/dashboard/operations/_components/DeviationDialog";
import { ReservationSheet } from "@/components/dashboard/cockpit/sheets/ReservationSheet";
import { DailyNoteSheet } from "@/components/dashboard/cockpit/sheets/DailyNoteSheet";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import type { WorkspaceRole } from "@/lib/context/bootstrap-contract";
import { useDayTimelineScope } from "@/app/dashboard/_hooks/use-day-timeline-scope";
import { useTimelineSelection } from "@/components/day/use-timeline-selection";
import type { TimelineTemplateItemT } from "@smartout/types";
import { Skeleton } from "@/components/ui/skeleton";
import { NoSessionCTA } from "@/components/day/NoSessionCTA";
import { DayLineStrip } from "@/components/day/DayLineStrip";
import { DayLineCreateSheet } from "@/components/day/DayLineCreateSheet";
import { AggregatedDayLineList } from "@/components/day/AggregatedDayLineList";
import { useDayLines } from "@/components/day/_hooks/use-day-lines";

// Local type for slot-picker anchor — time + whether it is open.
type SlotPickerState = {
  open: boolean;
  time: string;
};

const CLOSED_SLOT_PICKER: SlotPickerState = { open: false, time: "" };

// Draft free-form chip: in-memory only until template is saved.
type DraftChip = {
  label: string;
  time: string;
};

// ── Session status adapter ────────────────────────────────────────────────────
// DepartmentSessionRow.status uses a richer enum than deriveDayLineStatus expects.
// Map to the simple three-way union the helper understands.
type SimpleSessionStatus = "draft" | "open" | "closed";

function toSimpleSessionStatus(status: DepartmentSessionRow["status"]): SimpleSessionStatus {
  if (status === "upcoming") return "draft";
  if (status === "active" || status === "pending_signoff") return "open";
  return "closed"; // closed | missed
}

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

  const selection = useTimelineSelection();
  const [slotPicker, setSlotPicker] = useState<SlotPickerState>(CLOSED_SLOT_PICKER);
  // Anchor rect for SlotPicker — set on hit-zone click so popover opens
  // exactly under the cursor instead of attached to the full-width strip.
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  // In-memory draft chips — free-form items added by user, not yet saved as template
  const [draftChips, setDraftChips] = useState<DraftChip[]>([]);
  const [freeFormDialogOpen, setFreeFormDialogOpen] = useState(false);
  const [freeFormTime, setFreeFormTime] = useState<string>("--:--");

  // ─── Sheet / dialog open-state ───────────────────────────────────────────────
  const [slotTime, setSlotTime] = useState<string>("--:--");
  const [bookingOpen, setBookingOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [shiftStartOpen, setShiftStartOpen] = useState(false);
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [avvikDialogOpen, setAvvikDialogOpen] = useState(false);
  const [dayLineCreateOpen, setDayLineCreateOpen] = useState(false);

  // Manager and above can write; employees get read-only strip.
  const canEdit = role !== null && role !== undefined && role !== "employee";

  // Phase boundaries — computed from session bounds for phase-tinting bands on the strip.
  // Memoised: recomputes only when session open/close changes.
  const phaseBoundaries = useMemo(
    () =>
      getPhaseBoundaries({
        plannedOpen: session.plannedOpen,
        plannedClose: session.plannedClose,
      }),
    [session.plannedOpen, session.plannedClose],
  );

  // Scope filter (URL search-param ?scope=type:<id>)
  const { scope } = useDayTimelineScope();
  const teamId = scope.type === "team" ? scope.id : null;
  const shiftId = scope.type === "shift" ? scope.id : null;
  const isLocationScope = scope.type === "location";

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

  // ─── Multi-strip day_line query ───────────────────────────────────────────────
  const dayLines = useDayLines({
    workspaceId,
    date: dateISO,
    departmentIds: [departmentId],
  });

  const simpleSessionStatus = toSimpleSessionStatus(session.status);
  // Reconciliation lock: not yet wired — future sortie will query
  // daily_reconciliation.locked_at. Default false until then.
  const reconciliationLocked = false;

  function refreshEvents() {
    qc.invalidateQueries({ queryKey: ["day-control", "timeline-events"] });
  }

  function handleSelectFromStrip(e: DayEvent) {
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
    // Toggle: clicking the same event again clears selection
    if (selection.selectedId === e.id) {
      selection.clear();
    } else {
      selection.selectFromStrip(e);
    }
  }

  function handleSelectFromList(e: DayEvent) {
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
    // Toggle: clicking the same event again clears selection
    if (selection.selectedId === e.id) {
      selection.clear();
    } else {
      selection.selectFromList(e);
    }
  }

  function handleSlotClick(time: string, rect: DOMRect) {
    if (!canEdit) return;
    setAnchorRect(rect);
    setSlotPicker({ open: true, time });
  }

  function handleSlotPickerOpenChange(open: boolean) {
    setSlotPicker((prev) => ({ ...prev, open }));
    if (!open) setAnchorRect(null);
  }

  const handleSlotPickerAction = useCallback((action: SlotPickerAction, time: string) => {
    setSlotTime(time);
    switch (action) {
      case "shift":
        setShiftStartOpen(true);
        break;
      case "task":
        setTaskDialogOpen(true);
        break;
      case "note":
        setNoteOpen(true);
        break;
      case "deviation":
        setAvvikDialogOpen(true);
        break;
      case "hook":
        // Hook dialog not yet built — opens AddTask as nearest proxy for now.
        // T6/T7 will wire a dedicated HookDialog once the session_hook form lands.
        setTaskDialogOpen(true);
        break;
      case "free_form":
        setFreeFormTime(time);
        setFreeFormDialogOpen(true);
        break;
    }
  }, []);

  // ─── DayLineStrip slot-action dispatcher ─────────────────────────────────────
  // Receives (action, time, dayLineId) from a DayLineStrip child.
  // dayLineId is available for future dialog context (CT3+ will use it).
  const handleDayLineSlotAction = useCallback(
    (action: SlotPickerAction, time: string, _dayLineId: string) => {
      handleSlotPickerAction(action, time);
    },
    [handleSlotPickerAction],
  );

  function handleAddDraftChip(label: string, time: string) {
    setDraftChips((prev) => [...prev, { label, time }]);
  }

  // Derive canvas items from draft chips (for SaveTemplateDialog preview)
  const canvasItems: TimelineTemplateItemT[] = draftChips.map((chip) => ({
    kind: "free_form" as const,
    time_hhmm: chip.time.match(/^\d{2}:\d{2}$/) ? chip.time : "00:00",
    duration_min: null,
    payload: { label: chip.label },
  }));

  if (events.isLoading) {
    return <div className="text-muted-foreground text-[13px]">Laster tidslinjen…</div>;
  }

  const data = events.data ?? [];
  // Coerce role to WorkspaceRole | null for picker prop
  const pickerRole = (role ?? null) as WorkspaceRole | null;
  const dayLineRows = dayLines.data ?? [];

  return (
    <div className="scrollbar-thin flex h-full min-h-0 flex-1 flex-col overflow-y-auto pr-1">
      <div className="grid gap-3">
        {/* Sticky strip — never disappears while event-list scrolls below */}
        <div className="sticky top-0 z-20 pb-1">
          {/* Timeline Top Bar — scope filter + saved timelines dropdown */}
          {workspaceId && (
            <div className="mb-2">
              <TimelineTopBar
                workspaceId={workspaceId}
                dateISO={dateISO}
                ownDepartmentId={ownDeptForFilter}
                profileId={profileId ?? ""}
                scope={scope}
                departmentId={departmentId}
                sessionId={session.sessionId}
                canvasItems={canvasItems}
              />
            </div>
          )}

          {/* Location scope warning — shown below TopBar when location filter is active */}
          {isLocationScope && (
            <div
              role="alert"
              aria-live="polite"
              className="mb-2 flex items-start gap-2 rounded border border-[oklch(0.82_0.08_65)] bg-[oklch(0.96_0.03_65)] px-3 py-2 text-[11px] leading-snug text-[oklch(0.35_0.10_55)]"
            >
              <Info className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" aria-hidden />
              <span>
                Lokasjonsfilter viser kun vakter — hooks/oppgaver/notater er ikke lokasjons-merket.
              </span>
            </div>
          )}

          {/* Controlled popover anchored at the click coordinate.
              DayTimelineStrip's hit-zone onClick provides the clicked button's
              bounding rect; we render an invisible 1×1 span at that rect and
              hand it to SlotPicker as the popover anchor. Menu opens under the
              cursor instead of attached to the full-width strip wrapper. */}
          <div className="relative w-full">
            <DayTimelineStrip
              events={data}
              startHHMM={session.plannedOpen}
              endHHMM={session.plannedClose}
              dateISO={dateISO}
              onSelect={handleSelectFromStrip}
              editable={canEdit}
              onSlotClick={handleSlotClick}
              highlightedId={selection.selectedId}
              pulseSource={selection.pulseSource}
              departmentId={departmentId}
              sessionId={session.sessionId}
              phaseBoundaries={phaseBoundaries}
            />
          </div>
          <SlotPicker
            open={slotPicker.open}
            onOpenChange={handleSlotPickerOpenChange}
            time={slotPicker.time || "--:--"}
            isLocationScope={isLocationScope}
            role={pickerRole}
            onAction={handleSlotPickerAction}
            anchor={
              anchorRect ? (
                <span
                  aria-hidden
                  style={{
                    position: "fixed",
                    left: anchorRect.left + anchorRect.width / 2,
                    top: anchorRect.top,
                    width: 1,
                    height: anchorRect.height,
                    pointerEvents: "none",
                  }}
                />
              ) : null
            }
          />
        </div>

        {/* ─── Multi-strip DayLine section ─────────────────────────────────── */}

        {/* "Ny dagslinje" trigger — visible when canEdit and session is not closed */}
        {canEdit && session.status !== "closed" && workspaceId && (
          <div className="flex justify-end" data-testid="day-line-create-trigger-row">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs"
              onClick={() => setDayLineCreateOpen(true)}
              data-testid="day-line-create-trigger"
            >
              <PlusCircle className="h-3.5 w-3.5" />
              Ny dagslinje
            </Button>
          </div>
        )}

        {dayLines.isLoading && (
          <div
            className="flex flex-col gap-2"
            data-testid="timeline-tab-loading"
            aria-label="Laster dagslinjer…"
          >
            <Skeleton className="h-12 w-full rounded-[--radius]" />
            <Skeleton className="h-12 w-full rounded-[--radius]" />
          </div>
        )}

        {!dayLines.isLoading && dayLineRows.length === 0 && workspaceId && (
          // NoSessionCTA reused as empty state — no day_lines exist for this date/dept.
          // departmentName is not available directly on session; use departmentId as fallback
          // until CT3 wires a richer context. The CTA itself shows date context.
          <div data-testid="timeline-tab-no-lines">
            <NoSessionCTA
              departmentId={departmentId}
              departmentName={session.departmentName}
              dateISO={dateISO}
              onOpened={() => {
                qc.invalidateQueries({ queryKey: ["day-line"] });
              }}
            />
          </div>
        )}

        {/* Location scope: show aggregated overview across all day_lines for this date */}
        {!dayLines.isLoading && isLocationScope && workspaceId && (
          <AggregatedDayLineList
            workspaceId={workspaceId}
            date={dateISO}
          />
        )}

        {!dayLines.isLoading && !isLocationScope && dayLineRows.length > 0 && (
          <div className="flex flex-col gap-3" data-testid="timeline-tab-strips">
            {dayLineRows.map((line) => (
              <DayLineStrip
                key={line.day_line_id}
                line={line}
                sessionStatus={simpleSessionStatus}
                reconciliationLocked={reconciliationLocked}
                canEdit={canEdit}
                role={pickerRole}
                onSlotAction={handleDayLineSlotAction}
              />
            ))}
          </div>
        )}

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
          event={selection.selectedEvent}
          onClose={selection.clear}
          onSaved={() => {
            refreshEvents();
          }}
        />

        <DayEventList
          events={data}
          highlightedId={selection.selectedId}
          onEventClick={handleSelectFromList}
          pulseSource={selection.pulseSource}
          departmentId={departmentId}
          sessionId={session.sessionId}
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

      {/* ── Deviation dialog — SlotPicker "Avvik" path ──────────── */}
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

      {/* ── FreeFormChipDialog — SlotPicker "Fri tekst" path ──────────── */}
      <FreeFormChipDialog
        open={freeFormDialogOpen}
        onOpenChange={setFreeFormDialogOpen}
        time={freeFormTime}
        onAdd={handleAddDraftChip}
      />

      {/* ── DayLineCreateSheet — "Ny dagslinje" path ──────────────────── */}
      {workspaceId && session.sessionId && (
        <DayLineCreateSheet
          open={dayLineCreateOpen}
          onOpenChange={setDayLineCreateOpen}
          departmentId={departmentId}
          departmentSessionId={session.sessionId}
        />
      )}
    </div>
  );
}
