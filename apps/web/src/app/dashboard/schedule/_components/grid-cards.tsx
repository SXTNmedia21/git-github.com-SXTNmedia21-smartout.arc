"use client";

import React, { useContext } from "react";
import { AlertCircle, Ban } from "lucide-react";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { DashboardContext } from "../../layout";
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
}: {
  role: string;
  time: string;
  status: string;
  indicator: string;
  zone?: string;
  id?: string;
}) {
  const { isDark } = useContext(DashboardContext);
  const defaultId = React.useId();
  const draggableId = id || defaultId;

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: draggableId,
    data: { role, time, status, indicator, type: "shift" },
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
      className={`relative flex h-[38px] w-full shrink-0 items-center rounded-md border px-1.5 py-1 transition-all xl:h-[42px] ${
        isSick
          ? 'border-rose-500/30 bg-rose-500/10 bg-[url("/diagonal-stripes-rose.svg")] bg-repeat'
          : 'border-blue-500/30 bg-blue-500/10 bg-[url("/diagonal-stripes-blue.svg")] bg-repeat'
      }`}
    >
      {isSick ? (
        <AlertCircle className="mr-1.5 h-3.5 w-3.5 shrink-0 text-rose-400 xl:h-4 xl:w-4" />
      ) : (
        <Ban className="mr-1.5 h-3.5 w-3.5 shrink-0 text-blue-400 xl:h-4 xl:w-4" />
      )}

      <div className="flex min-w-0 flex-col truncate pr-1">
        <h4
          className={`truncate text-[10px] leading-none font-black tracking-tight xl:text-[11px] ${isSick ? "text-rose-400" : "text-blue-400"}`}
        >
          {type}
        </h4>
        {reason ? (
          <p
            className={`mt-0.5 truncate text-[7px] leading-none font-bold tracking-widest uppercase xl:text-[8px] ${isSick ? "text-rose-500/80" : "text-blue-500/80"}`}
          >
            {reason}
          </p>
        ) : null}
      </div>

      <div className="absolute inset-0 z-10 hidden cursor-not-allowed sm:block" />
    </div>
  );
});
