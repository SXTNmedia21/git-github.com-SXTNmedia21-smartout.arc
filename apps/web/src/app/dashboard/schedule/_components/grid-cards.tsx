"use client";

import React, { useContext, useRef, useState } from "react";
import { AlertCircle, Ban } from "lucide-react";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { ShiftCardView, OpenShiftCardView, TemplateCardView } from "./draggable-card-views";

// ---------------------------------------------------------------------------
// Time helpers for resize handles
// ---------------------------------------------------------------------------
/** Parse "HH:MM" to total minutes. */
function parseTime(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

/** Format total minutes back to "HH:MM". Wraps at 24h. */
function formatTime(mins: number): string {
  const wrapped = ((mins % 1440) + 1440) % 1440;
  const h = Math.floor(wrapped / 60);
  const m = wrapped % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Time step for each resize drag increment (minutes). */
const RESIZE_STEP = 15;
/** Pixels of drag movement per time step. */
const PX_PER_STEP = 12;

// ---------------------------------------------------------------------------
// ShiftCard — thin useDraggable wrapper, delegates to memoized ShiftCardView
// ---------------------------------------------------------------------------
export function ShiftCard({
  role,
  time,
  status,
  indicator,
  zone,
  id,
  startTime,
  endTime,
  onClick,
  onTimeChange,
  isCompact,
}: {
  role: string;
  time: string;
  status: string;
  indicator: string;
  zone?: string;
  id?: string;
  startTime?: string;
  endTime?: string;
  /** Called when the card is clicked (not dragged). Opens shift detail modal. */
  onClick?: (e: React.MouseEvent) => void;
  /** Called when start/end time is changed via resize handles. */
  onTimeChange?: (newStart: string, newEnd: string) => void;
  isCompact?: boolean;
}) {
  const { isDark } = useContext(DashboardContext);
  const defaultId = React.useId();
  const draggableId = id || defaultId;

  // Keep per-card logic lightweight: no global key listeners here.
  // Resize handles stop propagation, so dragging still works normally.
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: draggableId,
    data: { role, time, status, indicator, type: "shift", shiftId: id },
  });

  // ── Resize drag state ──────────────────────────────────────
  const [resizeSide, setResizeSide] = useState<"start" | "end" | null>(null);
  const [resizePreview, setResizePreview] = useState<{ start: string; end: string } | null>(null);
  const dragOriginX = useRef(0);
  const originalTimes = useRef({ start: "", end: "" });

  const handleResizeStart = (side: "start" | "end", e: React.PointerEvent) => {
    if (!startTime || !endTime || !onTimeChange) return;
    e.preventDefault();
    e.stopPropagation();
    setResizeSide(side);
    dragOriginX.current = e.clientX;
    originalTimes.current = { start: startTime, end: endTime };
    setResizePreview({ start: startTime, end: endTime });

    const onMove = (ev: PointerEvent) => {
      const dx = ev.clientX - dragOriginX.current;
      const steps = Math.round(dx / PX_PER_STEP);
      const delta = steps * RESIZE_STEP;

      if (side === "start") {
        const newStart = parseTime(originalTimes.current.start) + delta;
        const endMins = parseTime(originalTimes.current.end);
        // Don't let start go past end - 15min
        if (newStart < endMins) {
          setResizePreview({ start: formatTime(newStart), end: originalTimes.current.end });
        }
      } else {
        const newEnd = parseTime(originalTimes.current.end) + delta;
        const startMins = parseTime(originalTimes.current.start);
        // Don't let end go before start + 15min
        if (newEnd > startMins) {
          setResizePreview({ start: originalTimes.current.start, end: formatTime(newEnd) });
        }
      }
    };

    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      setResizeSide(null);
      // Commit the change
      setResizePreview((prev) => {
        if (prev && (prev.start !== startTime || prev.end !== endTime)) {
          onTimeChange(prev.start, prev.end);
        }
        return null;
      });
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const style = transform
    ? {
        transform: CSS.Translate.toString(transform),
        zIndex: 50,
        position: "relative" as const,
      }
    : undefined;

  /**
   * Handles click on the shift card.
   * Only fires if the card wasn't dragged (no transform).
   */
  const handleClick = (e: React.MouseEvent) => {
    if (!isDragging && !transform && onClick) {
      e.stopPropagation();
      onClick(e);
    }
  };

  const showHandles = !isDragging && !!startTime && !!endTime && !!onTimeChange;
  const displayTime = resizePreview ? `${resizePreview.start} - ${resizePreview.end}` : time;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onClick={handleClick}
      className={`group cursor-pointer ${showHandles ? "relative" : ""}`}
    >
      {/* Left resize handle (start time) */}
      {showHandles && (
        <div
          className={`absolute top-1 bottom-1 left-0 z-20 flex w-3 cursor-col-resize items-center justify-center rounded-l-md opacity-0 transition-colors group-hover:opacity-100 ${resizeSide === "start" ? "bg-orange-500/30 opacity-100" : "bg-orange-500/10 hover:bg-orange-500/20"}`}
          onPointerDown={(e) => handleResizeStart("start", e)}
        >
          <div className="h-4 w-0.5 rounded-full bg-orange-400/60" />
        </div>
      )}

      {/* Right resize handle (end time) */}
      {showHandles && (
        <div
          className={`absolute top-1 right-0 bottom-1 z-20 flex w-3 cursor-col-resize items-center justify-center rounded-r-md opacity-0 transition-colors group-hover:opacity-100 ${resizeSide === "end" ? "bg-orange-500/30 opacity-100" : "bg-orange-500/10 hover:bg-orange-500/20"}`}
          onPointerDown={(e) => handleResizeStart("end", e)}
        >
          <div className="h-4 w-0.5 rounded-full bg-orange-400/60" />
        </div>
      )}

      {/* Resize preview tooltip */}
      {resizePreview && (
        <div className="bg-popover border-border absolute -top-7 left-1/2 z-30 -translate-x-1/2 rounded border px-2 py-0.5 text-[10px] font-bold whitespace-nowrap text-orange-400 shadow-lg">
          {resizePreview.start} - {resizePreview.end}
        </div>
      )}

      <ShiftCardView
        isDark={isDark}
        isDragging={isDragging}
        role={role}
        time={displayTime}
        status={status}
        indicator={indicator}
        zone={zone}
        isCompact={isCompact}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// OpenShiftCard — thin useDraggable wrapper
// ---------------------------------------------------------------------------
export function OpenShiftCard({ id, title, time }: { id: string; title: string; time: string }) {
  const { isDark } = useContext(DashboardContext);
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id,
    data: { title, time, type: "open-shift" },
  });

  const style = transform
    ? {
        transform: CSS.Translate.toString(transform),
        zIndex: 50,
        position: "relative" as const,
      }
    : undefined;

  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes}>
      <OpenShiftCardView isDark={isDark} isDragging={isDragging} title={title} time={time} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// TemplateCard — thin useDraggable wrapper
// ---------------------------------------------------------------------------
export function TemplateCard({
  id,
  title,
  hours,
  routines,
}: {
  id: string;
  title: string;
  team: string;
  hours: string;
  routines: number;
}) {
  const { isDark } = useContext(DashboardContext);
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id,
    data: {
      role: title,
      time: hours,
      status: "draft",
      indicator: "yellow",
      type: "shift-template",
      templateId: id,
    },
  });

  const style = transform
    ? {
        transform: CSS.Translate.toString(transform),
        zIndex: 50,
        position: "relative" as const,
      }
    : undefined;

  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes}>
      <TemplateCardView
        isDark={isDark}
        isDragging={isDragging}
        title={title}
        hours={hours}
        routines={routines}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// AbsenceCard — no DnD, pure presentation
// ---------------------------------------------------------------------------
export const AbsenceCard = React.memo(function AbsenceCard({
  type,
  reason,
  isCompact,
}: {
  type: "Sykdom" | "Ferie" | "Avspasering";
  reason?: string;
  isCompact?: boolean;
}) {
  const isSick = type === "Sykdom";

  if (isCompact) {
    return (
      <div
        className={`relative flex h-7 w-full shrink-0 items-center rounded-md border px-2 transition-all ${
          isSick
            ? "border-rose-500/40 bg-rose-500/15 shadow-[0_0_10px_rgba(244,63,94,0.1)]"
            : "border-blue-500/15 bg-blue-500/[0.04]"
        }`}
      >
        {isSick ? (
          <AlertCircle className="mr-1.5 h-3 w-3 shrink-0 text-rose-400" />
        ) : (
          <Ban className="mr-1.5 h-3 w-3 shrink-0 text-blue-400/50" />
        )}
        <span
          className={`truncate text-[10px] leading-none font-black tracking-tight ${isSick ? "text-rose-400" : "text-blue-400/70"}`}
        >
          {type}
        </span>
        <div className="absolute inset-0 z-10 hidden cursor-not-allowed sm:block" />
      </div>
    );
  }

  return (
    <div
      className={`relative flex h-[46px] w-full shrink-0 items-center rounded-lg border px-2.5 py-1.5 transition-all xl:h-[50px] ${
        isSick
          ? "bg-stripes-rose border-rose-500/40 bg-rose-500/15 shadow-[0_0_10px_rgba(244,63,94,0.1)]"
          : "bg-stripes-blue border-blue-500/15 bg-blue-500/[0.04]"
      }`}
    >
      {isSick ? (
        <AlertCircle className="mr-2 h-4 w-4 shrink-0 text-rose-400" />
      ) : (
        <Ban className="mr-2 h-4 w-4 shrink-0 text-blue-400/50" />
      )}

      <div className="flex min-w-0 flex-col truncate pr-1">
        <h4
          className={`truncate text-xs leading-none font-black tracking-tight xl:text-[13px] ${isSick ? "text-rose-400" : "text-blue-400/70"}`}
        >
          {type}
        </h4>
        {reason ? (
          <p
            className={`mt-1 truncate text-[11px] leading-none font-bold tracking-widest uppercase ${isSick ? "text-rose-500/80" : "text-blue-500/50"}`}
          >
            {reason}
          </p>
        ) : null}
      </div>

      <div className="absolute inset-0 z-10 hidden cursor-not-allowed sm:block" />
    </div>
  );
});
