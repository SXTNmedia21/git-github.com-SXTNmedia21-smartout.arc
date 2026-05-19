"use client";

// =============================================================================
// ClusterMarker.tsx
//
// Renders a single cluster marker on DayTimelineStrip when 2+ events fall
// within the same 15-min bucket. Shows the dominant event type's shape with a
// badge count overlay. Click opens a Radix Popover listing all N events —
// clicking an item delegates to the parent onSelect handler.
//
// Telemetry: emits ui.dagslinjen.cluster_expanded on popover open.
// A11y: marker has aria-label; each popover item has its own aria-label.
// testids: timeline-cluster-<bucketIdx> on marker; timeline-cluster-item-<event.id> on items.
// =============================================================================

import { useState } from "react";
import { cn } from "@smartout/ui";
import { emit, nonEmpty } from "@smartout/telemetry";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { EVENT_TYPE_META, type ShapeKind } from "./event-types";
import type { DayEvent, DayEventType } from "@/app/dashboard/_hooks/use-day-timeline-events";
import { useContext } from "react";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { useWorkspaceOptional } from "@/lib/workspace-context";

// ─── Dominant-type picker ────────────────────────────────────────────────────

function pickDominantType(events: DayEvent[]): DayEventType {
  const freq: Partial<Record<DayEventType, number>> = {};
  for (const e of events) {
    freq[e.type] = (freq[e.type] ?? 0) + 1;
  }
  let best: DayEventType = events[0]?.type ?? "booking";
  let bestCount = 0;
  for (const [type, count] of Object.entries(freq) as [DayEventType, number][]) {
    if (count > bestCount) {
      bestCount = count;
      best = type;
    }
  }
  return best;
}

// ─── Shape renderer (mirrors DayTimelineStrip's <Marker>) ────────────────────

function ClusterShape({
  shape,
  fill,
  ring,
  iconColor,
  Icon,
}: {
  shape: ShapeKind;
  fill: string;
  ring: string;
  iconColor: string;
  Icon: typeof import("lucide-react").Calendar;
}) {
  if (shape === "dot") {
    return (
      <span
        className={cn(
          "border-background flex h-6 w-6 items-center justify-center rounded-full border-2 shadow-sm ring-4",
          fill,
          ring,
        )}
      >
        <Icon className={cn("h-3 w-3", iconColor)} />
      </span>
    );
  }
  if (shape === "ring") {
    return (
      <span
        className={cn(
          "border-background flex h-6 w-6 items-center justify-center rounded-full border-2 shadow-sm ring-2",
          fill,
          ring,
        )}
      >
        <Icon className={cn("h-3 w-3", iconColor)} />
      </span>
    );
  }
  if (shape === "diamond") {
    return (
      <span
        className={cn(
          "border-background flex h-6 w-6 rotate-45 items-center justify-center border-2 shadow-sm",
          fill,
          "ring-2",
          ring,
        )}
      >
        <Icon className={cn("h-3 w-3 -rotate-45", iconColor)} />
      </span>
    );
  }
  if (shape === "flag") {
    return (
      <span
        className={cn(
          "border-background flex h-6 w-7 items-center justify-center rounded-l-sm rounded-r-md border-2 shadow-sm ring-2",
          fill,
          ring,
        )}
      >
        <Icon className={cn("h-3 w-3", iconColor)} />
      </span>
    );
  }
  if (shape === "arrow-down") {
    return (
      <span
        className={cn(
          "border-background relative flex h-6 w-6 items-center justify-center rounded-t-md border-2 shadow-sm ring-2",
          fill,
          ring,
        )}
        style={{ clipPath: "polygon(0 0, 100% 0, 100% 60%, 50% 100%, 0 60%)" }}
      >
        <Icon className={cn("h-3 w-3", iconColor)} />
      </span>
    );
  }
  // arrow-up
  return (
    <span
      className={cn(
        "border-background relative flex h-6 w-6 items-center justify-center rounded-b-md border-2 shadow-sm ring-2",
        fill,
        ring,
      )}
      style={{ clipPath: "polygon(50% 0, 100% 40%, 100% 100%, 0 100%, 0 40%)" }}
    >
      <Icon className={cn("h-3 w-3", iconColor)} />
    </span>
  );
}

// ─── Public component ─────────────────────────────────────────────────────────

export type ClusterMarkerProps = {
  events: DayEvent[];
  pct: number;
  offsetY: string;
  onSelect: (e: DayEvent) => void;
  /** Bucket index — used for testid and aria-label anchoring. */
  bucketIdx: number;
  departmentId: string;
  sessionId: string;
  bucketStartHHMM: string;
  bucketEndHHMM: string;
};

export function ClusterMarker({
  events,
  pct,
  offsetY,
  onSelect,
  bucketIdx,
  departmentId,
  sessionId,
  bucketStartHHMM,
  bucketEndHHMM,
}: ClusterMarkerProps) {
  const [open, setOpen] = useState(false);

  const dashCtx = useContext(DashboardContext);
  const wsCtx = useWorkspaceOptional();
  const actorId = dashCtx?.profileId ?? null;
  const workspaceId = wsCtx?.workspace.workspace_id ?? null;

  const dominantType = pickDominantType(events);
  const meta = EVENT_TYPE_META[dominantType];
  const Icon = meta.icon;
  const count = events.length;

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next && actorId && workspaceId) {
      // Telemetry: fire-and-forget; non-blocking. ADR-0134 requires non-null IDs.
      void emit({
        event: "ui.dagslinjen.cluster_expanded",
        workspace_id: nonEmpty(workspaceId, "workspace_id"),
        actor_id: nonEmpty(actorId, "actor_id"),
        properties: {
          data: {
            bucketStart: bucketStartHHMM,
            eventCount: count,
            departmentId,
            sessionId,
          },
        },
      });
    }
  }

  function handleItemClick(e: DayEvent) {
    onSelect(e);
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          data-testid={`timeline-cluster-${bucketIdx}`}
          aria-label={`${count} hendelser mellom ${bucketStartHHMM} og ${bucketEndHHMM}`}
          className={cn(
            "absolute top-1/2 z-20 transition-transform",
            "hover:scale-125 focus-visible:scale-125 focus-visible:outline-none",
            "focus-visible:ring-ring focus-visible:rounded-full focus-visible:ring-2 focus-visible:ring-offset-1",
          )}
          style={{
            left: `${pct}%`,
            transform: `translate(-50%, calc(-50% + ${offsetY}))`,
          }}
        >
          {/* Dominant-type shape */}
          <span className="relative block">
            <ClusterShape
              shape={meta.shape}
              fill={meta.stripFill}
              ring={meta.stripRing}
              iconColor={meta.stripIconColor}
              Icon={Icon}
            />
            {/* Count badge — top-right */}
            <span
              aria-hidden
              className={cn(
                "absolute -top-2 -right-2 flex h-4 min-w-4 items-center justify-center",
                "bg-foreground text-background rounded-full px-1 text-[10px] font-bold tabular-nums",
                "ring-background ring-1",
              )}
            >
              {count}
            </span>
          </span>
        </button>
      </PopoverTrigger>

      <PopoverContent className="w-56 p-0" align="start" sideOffset={6}>
        {/* Header */}
        <div className="border-border border-b px-3 py-2">
          <p className="text-muted-foreground text-[11px] font-medium">
            {bucketStartHHMM}–{bucketEndHHMM} · {count} hendelser
          </p>
        </div>

        {/* Event list */}
        <div className="py-1">
          {events.map((e) => {
            const eMeta = EVENT_TYPE_META[e.type];
            const EIcon = eMeta.icon;
            return (
              <button
                key={e.id}
                type="button"
                data-testid={`timeline-cluster-item-${e.id}`}
                aria-label={`${e.time} — ${e.title}`}
                onClick={() => handleItemClick(e)}
                className={cn(
                  "hover:bg-muted focus-visible:bg-muted w-full px-3 py-2",
                  "flex items-center gap-2 text-left",
                  "transition-colors focus-visible:outline-none",
                )}
              >
                <EIcon className={cn("h-3.5 w-3.5 shrink-0", eMeta.listIconColor)} aria-hidden />
                <span className="flex min-w-0 flex-col">
                  <span className="text-foreground truncate text-[12px] leading-tight font-medium">
                    {e.title}
                  </span>
                  <span className="text-muted-foreground font-mono text-[10px] tabular-nums">
                    {e.time}
                    {e.actor ? ` · ${e.actor}` : ""}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
