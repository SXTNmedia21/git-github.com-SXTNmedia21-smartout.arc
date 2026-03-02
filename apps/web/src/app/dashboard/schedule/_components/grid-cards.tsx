"use client";

import React, { useContext } from "react";
import { AlertCircle, Ban } from "lucide-react";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { ShiftCardView, OpenShiftCardView, TemplateCardView } from "./draggable-card-views";

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
  onClick,
}: {
  role: string;
  time: string;
  status: string;
  indicator: string;
  zone?: string;
  id?: string;
  /** Called when the card is clicked (not dragged). Opens shift detail modal. */
  onClick?: () => void;
}) {
  const { isDark } = useContext(DashboardContext);
  const defaultId = React.useId();
  const draggableId = id || defaultId;

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: draggableId,
    data: { role, time, status, indicator, type: "shift", shiftId: id },
  });

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
      onClick();
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onClick={handleClick}
      className="cursor-pointer"
    >
      <ShiftCardView
        isDark={isDark}
        isDragging={isDragging}
        role={role}
        time={time}
        status={status}
        indicator={indicator}
        zone={zone}
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
}: {
  type: "Sykdom" | "Ferie" | "Avspasering";
  reason?: string;
}) {
  const isSick = type === "Sykdom";

  return (
    <div
      className={`relative flex h-[46px] w-full shrink-0 items-center rounded-lg border px-2.5 py-1.5 transition-all xl:h-[50px] ${
        isSick
          ? 'border-rose-500/40 bg-rose-500/15 bg-[url("/diagonal-stripes-rose.svg")] bg-repeat shadow-[0_0_10px_rgba(244,63,94,0.1)]'
          : 'border-blue-500/15 bg-blue-500/[0.04] bg-[url("/diagonal-stripes-blue.svg")] bg-repeat'
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
