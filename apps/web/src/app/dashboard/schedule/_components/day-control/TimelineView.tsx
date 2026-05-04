// ============================================
// day-control/TimelineView.tsx
// Gantt-style timeline bar chart for shift visualization.
// Shows 06:00–23:00 with colored bars per employee shift.
// ============================================
"use client";

import { useContext, useEffect, useState, useRef } from "react";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Clock, CheckCircle2, User, FileText } from "lucide-react";

const TIMELINE_START = 6;
const TIMELINE_END = 23;
const TIMELINE_HOURS = TIMELINE_END - TIMELINE_START;

export type TimelineEntry = {
  shiftId: string;
  name: string;
  initials: string;
  avatarColor: string;
  role: string;
  startHour: number;
  endHour: number;
  time: string;
  status: string;
  notes?: string;
};

export function TimelineView({
  entries,
  onShiftClick,
  onShiftUpdate,
}: {
  entries: TimelineEntry[];
  onShiftClick: (id: string) => void;
  onShiftUpdate?: (id: string, newStartHour: number, newEndHour: number) => void;
}) {
  const { isDark } = useContext(DashboardContext);
  const hours = Array.from({ length: TIMELINE_HOURS + 1 }, (_, i) => TIMELINE_START + i);
  const containerRef = useRef<HTMLDivElement>(null);

  const [isShiftPressed, setIsShiftPressed] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Shift") setIsShiftPressed(true);
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === "Shift") setIsShiftPressed(false);
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    // Handle edge case where window loses focus while shift is pressed
    const handleBlur = () => setIsShiftPressed(false);
    window.addEventListener("blur", handleBlur);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", handleBlur);
    };
  }, []);

  // Drag state
  const [draggingState, setDraggingState] = useState<{
    id: string;
    type: "start" | "end" | "move";
    initialX: number;
    initialStartHour: number;
    initialEndHour: number;
    currentStartHour: number;
    currentEndHour: number;
  } | null>(null);

  // Handle pointer down
  const handlePointerDown = (
    e: React.PointerEvent,
    id: string,
    type: "start" | "end" | "move",
    startHour: number,
    endHour: number,
  ) => {
    if (!isShiftPressed) return;

    // Check if left click (button 0)
    if (e.button !== 0) return;

    e.preventDefault();
    e.stopPropagation();

    // Set pointer capture to window so we can drag outside the element
    const target = e.target as HTMLElement;
    target.setPointerCapture(e.pointerId);

    setDraggingState({
      id,
      type,
      initialX: e.clientX,
      initialStartHour: startHour,
      initialEndHour: endHour,
      currentStartHour: startHour,
      currentEndHour: endHour,
    });
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!draggingState || !containerRef.current) return;

    // Ensure we are tracking the pointer that started the drag
    if (!e.buttons) {
      // Mouse button released outside
      handlePointerUp(e);
      return;
    }

    const rect = containerRef.current.getBoundingClientRect();
    const widthPixels = rect.width;
    const pixelsPerHour = widthPixels / TIMELINE_HOURS;

    const deltaX = e.clientX - draggingState.initialX;
    const deltaHours = deltaX / pixelsPerHour;

    // Snap to 15 min (0.25 hours) intervals
    const snappedDelta = Math.round(deltaHours * 4) / 4;

    setDraggingState((prev) => {
      if (!prev) return null;
      let newStart = prev.initialStartHour;
      let newEnd = prev.initialEndHour;

      if (prev.type === "start") {
        newStart = Math.max(
          TIMELINE_START,
          Math.min(prev.initialEndHour - 0.5, prev.initialStartHour + snappedDelta),
        );
      } else if (prev.type === "end") {
        newEnd = Math.max(
          prev.initialStartHour + 0.5,
          prev.initialStartHour +
            Math.max(0.5, prev.initialEndHour - prev.initialStartHour + snappedDelta),
        );
      } else if (prev.type === "move") {
        const duration = prev.initialEndHour - prev.initialStartHour;
        newStart = prev.initialStartHour + snappedDelta;
        // Don't drag out of bounds left
        if (newStart < TIMELINE_START) {
          newStart = TIMELINE_START;
        }
        newEnd = newStart + duration;
      }

      return { ...prev, currentStartHour: newStart, currentEndHour: newEnd };
    });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!draggingState) return;
    const target = e.target as HTMLElement;
    if (target.hasPointerCapture(e.pointerId)) {
      target.releasePointerCapture(e.pointerId);
    }

    // Ensure we only update if there's an actual change
    if (
      draggingState.currentStartHour !== draggingState.initialStartHour ||
      draggingState.currentEndHour !== draggingState.initialEndHour
    ) {
      onShiftUpdate?.(
        draggingState.id,
        draggingState.currentStartHour,
        draggingState.currentEndHour,
      );
    }
    setDraggingState(null);
  };

  // Convert hours to "HH:MM" for hover card
  const formatTimeStr = (decimalHour: number) => {
    const wrapped = (((decimalHour * 60) % 1440) + 1440) % 1440;
    const h = Math.floor(wrapped / 60);
    const m = wrapped % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  };

  const getStatusDisplay = (status: string) => {
    switch (status) {
      case "published":
        return {
          label: "Publisert",
          badgeClass: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
        };
      case "active":
        return { label: "Aktiv", badgeClass: "bg-blue-500/10 text-blue-500 border-blue-500/20" };
      case "completed":
        return { label: "Fullført", badgeClass: "bg-muted text-muted-foreground border-border" };
      case "unpublished":
        return { label: "Avpublisert", badgeClass: "bg-red-500/10 text-red-500 border-red-500/20" };
      case "assigned":
        return {
          label: "Tildelt",
          badgeClass: "bg-orange-500/10 text-orange-500 border-orange-500/20",
        };
      case "created":
        return { label: "Kladd", badgeClass: "bg-muted text-muted-foreground border-border" };
      default:
        return { label: status, badgeClass: "bg-muted text-muted-foreground border-border" };
    }
  };

  // Current time marker
  const now = new Date();
  const currentHour = now.getHours() + now.getMinutes() / 60;
  const showNowLine = currentHour >= TIMELINE_START && currentHour <= TIMELINE_END;
  const nowPct = ((currentHour - TIMELINE_START) / TIMELINE_HOURS) * 100;

  return (
    <div
      ref={containerRef}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onPointerLeave={handlePointerUp}
      className={`overflow-x-auto rounded-xl border ${isDark ? "border-border bg-muted/20" : "border-border bg-muted/40"} relative p-3 select-none`}
    >
      {/* Hour labels */}
      <div className="mb-2 flex">
        <div className="w-24 shrink-0" />
        <div className="relative flex-1">
          <div className="flex justify-between">
            {hours.map((h) => (
              <span key={h} className="text-muted-foreground w-0 text-center text-[9px] font-bold">
                {String(h).padStart(2, "0")}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Grid lines + bars */}
      {entries.length === 0 ? (
        <p className="text-muted-foreground py-6 text-center text-xs">Ingen vakter</p>
      ) : (
        entries.map((entry) => {
          let currentStart = entry.startHour;
          let currentEnd = entry.endHour;

          // Replace with live dragging values if active
          if (draggingState && draggingState.id === entry.shiftId) {
            currentStart = draggingState.currentStartHour;
            currentEnd = draggingState.currentEndHour;
          }

          const startPct = Math.max(0, ((currentStart - TIMELINE_START) / TIMELINE_HOURS) * 100);
          const endHour = currentEnd <= currentStart ? currentEnd + 24 : currentEnd;
          const endPct = Math.min(100, ((endHour - TIMELINE_START) / TIMELINE_HOURS) * 100);
          const widthPct = endPct - startPct;

          const displayTime = formatTimeStr(currentStart) + " - " + formatTimeStr(currentEnd);

          const statusDisplay = getStatusDisplay(entry.status);

          return (
            <div key={entry.shiftId} className="group/timeline mb-1.5 flex items-center">
              {/* Avatar + name */}
              <div className="flex w-24 shrink-0 items-center gap-2 pr-2">
                <div
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border text-[7px] font-black ${entry.avatarColor}`}
                >
                  {entry.initials}
                </div>
                <span className="text-foreground/80 truncate text-[10px] font-bold">
                  {entry.name.split(" ")[0]}
                </span>
              </div>

              {/* Bar container */}
              <div
                className={`relative h-7 flex-1 rounded-md ${isDark ? "bg-muted/40" : "bg-muted"}`}
              >
                {/* Grid lines */}
                {hours.map((h) => (
                  <div
                    key={h}
                    className="bg-border/30 pointer-events-none absolute top-0 h-full w-px"
                    style={{ left: `${((h - TIMELINE_START) / TIMELINE_HOURS) * 100}%` }}
                  />
                ))}

                {/* Now marker */}
                {showNowLine && (
                  <div
                    className="pointer-events-none absolute top-0 z-10 h-full w-0.5 bg-orange-500 shadow-[0_0_6px_rgba(249,115,22,0.6)]"
                    style={{ left: `${nowPct}%` }}
                  />
                )}

                {/* Shift bar */}
                <HoverCard openDelay={200} closeDelay={100}>
                  <HoverCardTrigger asChild>
                    <div
                      className={`group/bar absolute top-1 flex h-5 items-center rounded-md shadow-sm transition-all group-hover/timeline:shadow-md ${
                        isShiftPressed
                          ? "ring-offset-background ring-2 ring-emerald-500/50 ring-offset-1"
                          : ""
                      }`}
                      style={{
                        left: `${startPct}%`,
                        width: `${Math.max(widthPct, 2)}%`,
                      }}
                    >
                      <button
                        onPointerDown={(e) => {
                          if (isShiftPressed) {
                            handlePointerDown(e, entry.shiftId, "move", currentStart, currentEnd);
                          } else {
                            onShiftClick(entry.shiftId);
                          }
                        }}
                        onPointerMove={isShiftPressed ? handlePointerMove : undefined}
                        onPointerUp={isShiftPressed ? handlePointerUp : undefined}
                        onPointerCancel={isShiftPressed ? handlePointerUp : undefined}
                        className={`absolute inset-0 z-10 h-full w-full overflow-hidden rounded-md shadow-sm transition-all ${
                          isShiftPressed
                            ? "cursor-grab bg-emerald-500/80 hover:bg-emerald-500 active:cursor-grabbing"
                            : "cursor-pointer bg-orange-500/70 group-hover/timeline:bg-orange-500/90 hover:bg-orange-500"
                        }`}
                        title={
                          isShiftPressed
                            ? "Dra for å flytte vakten"
                            : `${entry.name} — ${displayTime} — ${entry.role}`
                        }
                      >
                        <span className="pointer-events-none truncate px-1.5 text-[8px] font-bold text-white drop-shadow-sm">
                          {displayTime}
                        </span>
                      </button>

                      {/* Left (Start Time) Resize Handle */}
                      {isShiftPressed && (
                        <div
                          className="absolute top-0 left-0 z-20 flex h-full w-4 cursor-w-resize items-center justify-start rounded-l-md transition-opacity hover:bg-black/20"
                          onPointerDown={(e) =>
                            handlePointerDown(e, entry.shiftId, "start", currentStart, currentEnd)
                          }
                        >
                          <div className="pointer-events-none ml-1 h-4 w-1 rounded-full bg-white/50" />
                        </div>
                      )}

                      {/* Right (End Time) Resize Handle */}
                      {isShiftPressed && (
                        <div
                          className="absolute top-0 right-0 z-20 flex h-full w-4 cursor-e-resize items-center justify-end rounded-r-md transition-opacity hover:bg-black/20"
                          onPointerDown={(e) =>
                            handlePointerDown(e, entry.shiftId, "end", currentStart, currentEnd)
                          }
                        >
                          <div className="pointer-events-none mr-1 h-4 w-1 rounded-full bg-white/50" />
                        </div>
                      )}
                    </div>
                  </HoverCardTrigger>
                  {!isShiftPressed && (
                    <HoverCardContent
                      side="top"
                      align="start"
                      className="border-border bg-card/95 animate-in fade-in slide-in-from-bottom-2 z-50 w-64 rounded-xl p-3 shadow-lg backdrop-blur"
                    >
                      <div className="flex flex-col gap-2">
                        <div className="border-border/50 flex items-start gap-3 border-b pb-2">
                          <div
                            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border text-xs font-black ${entry.avatarColor}`}
                          >
                            {entry.initials}
                          </div>
                          <div>
                            <h4 className="text-sm leading-none font-bold">{entry.name}</h4>
                            <p className="text-muted-foreground mt-1 flex items-center gap-1 text-xs">
                              <User className="h-3 w-3" />
                              {entry.role}
                            </p>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div className="flex flex-col gap-0.5">
                            <span className="text-muted-foreground flex items-center gap-1 text-[10px] font-bold tracking-wider uppercase">
                              <Clock className="h-3 w-3" />
                              Tid
                            </span>
                            <span className="font-semibold">{displayTime}</span>
                          </div>
                          <div className="flex flex-col gap-0.5">
                            <span className="text-muted-foreground flex items-center gap-1 text-[10px] font-bold tracking-wider uppercase">
                              <CheckCircle2 className="h-3 w-3" />
                              Status
                            </span>
                            <div
                              className={`mt-0.5 inline-flex w-fit items-center rounded-md border px-2 py-0.5 text-[10px] font-bold ${statusDisplay.badgeClass}`}
                            >
                              {statusDisplay.label}
                            </div>
                          </div>
                        </div>
                        {entry.notes && (
                          <div className="border-border/50 mt-1 border-t pt-2">
                            <span className="text-muted-foreground mb-1 flex items-center gap-1 text-[10px] font-bold tracking-wider uppercase">
                              <FileText className="h-3 w-3" />
                              Notater
                            </span>
                            <p className="text-muted-foreground text-xs italic">{entry.notes}</p>
                          </div>
                        )}
                      </div>
                    </HoverCardContent>
                  )}
                </HoverCard>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
