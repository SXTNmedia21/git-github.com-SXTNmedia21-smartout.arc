"use client";

/**
 * TaskBlock — a single positioned task on the Manager Timeline day-line.
 *
 * Ported from docs/domains/day-session/day-planner/project/timeline-chart.jsx
 * lines 134-188. Key deviations from the prototype:
 *
 *  - No inline OKLCH literals (ADR-0366). Area accent color is inherited via
 *    CSS custom property `--area-color` set by AreaBand (Task 3.6). The block
 *    references it through `border-[color:var(--area-color,var(--border))]`.
 *  - No drag handlers in V1 — DnD deferred to V2 per G19a/b/c.
 *  - `aria-label` includes title + start–end times for keyboard/screen-reader.
 *  - `type="button"` on root element so click is always accessible.
 *  - Top/height derived from `hmToMin` (sibling timeMath) — same math as
 *    prototype's `window.hmToMin`, now typed + imported.
 *  - Time-range meta row only shown when computed height >= 36 px.
 */

import { cn } from "@/lib/utils";
import { hmToMin, DAY_START_HOUR } from "./timeMath";

// ─── Types ────────────────────────────────────────────────────────────────────

export type TaskStatus = "upcoming" | "in_progress" | "done" | "missed";
export type TaskPriority = "low" | "med" | "high";

export type TimelineTask = {
  id: string;
  title: string;
  start: string; // "HH:MM"
  end: string; // "HH:MM"
  status?: TaskStatus;
  priority?: TaskPriority;
  flagged?: boolean;
  recurring?: string | null;
  emp?: string | null;
  /** Area (department) id — used by AreaBand to filter tasks per band. */
  area?: string | null;
};

type Props = {
  task: TimelineTask;
  /** Pixels per hour — supplied by chart composer (Task 3.7). */
  pxPerHour: number;
  /** Zero-based column index when multiple tasks overlap an area band. */
  col?: number;
  /** Total overlapping columns in this band — used for width partitioning. */
  totalCols?: number;
  /** Called with the full task when the user activates the block. */
  onClick?: (task: TimelineTask) => void;
};

// ─── TaskBlock ────────────────────────────────────────────────────────────────

/**
 * Positioned absolutely within its parent area-band column.
 *
 * Layout math (matches prototype lines 137-142):
 *   top    = (startMin - DAY_START) / 60 * pxPerHour
 *   height = max(20, (endMin - startMin) / 60 * pxPerHour) - 2px gutter
 *   width  = 100% / totalCols
 *   left   = col * width%
 *
 * Color: accent inherited from `--area-color` set by parent AreaBand. Never
 * inline OKLCH (ADR-0366 + ADR-0361).
 */
export function TaskBlock({ task, pxPerHour, col = 0, totalCols = 1, onClick }: Props) {
  const startMin = hmToMin(task.start);
  const endMin = hmToMin(task.end);

  // Offset from day start (06:00) in pixels
  const top = ((startMin - DAY_START_HOUR * 60) / 60) * pxPerHour;
  // Minimum 20px so very short tasks remain tappable; -2 for inter-block gutter
  const height = Math.max(20, ((endMin - startMin) / 60) * pxPerHour - 2);

  const widthPct = 100 / (totalCols ?? 1);
  const leftPct = (col ?? 0) * widthPct;

  // Inline only for runtime layout math — no colors here (ADR-0366)
  const style: React.CSSProperties = {
    position: "absolute",
    top,
    height,
    // Match prototype: `calc(N% + 4px)` left gutter, `calc(N% - 8px)` width
    left: `calc(${leftPct}% + 4px)`,
    width: `calc(${widthPct}% - 8px)`,
  };

  const tiny = height < 36;

  const ariaLabel = `${task.title} ${task.start}–${task.end}`;

  return (
    <button
      type="button"
      aria-label={ariaLabel}
      title={task.title}
      className={cn(
        // Base layout
        "absolute overflow-hidden rounded-md border px-2 py-1 text-left text-xs",
        // Accent border uses inherited CSS var from AreaBand — no OKLCH literal
        "border-[color:var(--area-color,var(--border))]",
        // Subtle area-tinted background
        "bg-card",
        // Text colours from design tokens — no hardcoded values
        "text-foreground",
        // Interaction states
        "focus-visible:ring-ring cursor-pointer transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:outline-none",
        // Status modifier — consumed by CSS in chart stylesheet or Tailwind variants
        `s-${task.status ?? "upcoming"}`,
        // Priority modifier
        task.priority ? `p-${task.priority}` : undefined,
        // Flagged
        task.flagged ? "flagged" : undefined,
        // Tiny — hides meta row via CSS class when height < 36
        tiny ? "tiny" : undefined,
      )}
      style={style}
      onClick={() => onClick?.(task)}
    >
      {/* Title — always visible */}
      <div className="truncate leading-tight font-medium">{task.title}</div>

      {/* Time range + recurring badge — only when block is tall enough */}
      {!tiny && (
        <div className="text-muted-foreground mt-0.5 flex items-center gap-0.5 text-[0.6rem]">
          <span>{task.start}</span>
          <span aria-hidden="true">–</span>
          <span>{task.end}</span>
          {task.recurring && (
            <span className="ml-auto tracking-wide uppercase opacity-70">{task.recurring}</span>
          )}
        </div>
      )}

      {/* Flagged deviation indicator */}
      {task.flagged && (
        <div
          aria-label="Avvik flagget"
          className="text-destructive absolute top-1 right-1 text-[0.6rem] font-bold"
        >
          !
        </div>
      )}
    </button>
  );
}
