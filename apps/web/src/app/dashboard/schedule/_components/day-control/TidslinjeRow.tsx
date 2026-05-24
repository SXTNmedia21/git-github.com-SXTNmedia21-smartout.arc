"use client";

import { Activity, AlertTriangle, CalendarCheck, Clock, FileText, ListTodo } from "lucide-react";
import { cn } from "@smartout/ui";
import type { DayEvent, DayEventType } from "@/app/dashboard/_hooks/use-day-timeline-events";

// ---------------------------------------------------------------------------
// Type-to-icon and type-to-label maps (Task Manager prototype recipe)
// ---------------------------------------------------------------------------

const TYPE_ICON: Record<DayEventType, typeof Clock> = {
  booking: CalendarCheck,
  task: ListTodo,
  hook: Activity,
  deviation: AlertTriangle,
  checkin: Clock,
  checkout: Clock,
  note: FileText,
};

const TYPE_LABEL: Record<DayEventType, string> = {
  booking: "Booking",
  task: "Oppgave",
  hook: "Hook",
  deviation: "Avvik",
  checkin: "Innsjekk",
  checkout: "Utsjekk",
  note: "Notat",
};

// ---------------------------------------------------------------------------
// Static class strings — computed once, ADR-0361/0366 compliant (no oklch
// literals, no hardcoded color utilities such as text-zinc-* or bg-orange-*).
// ---------------------------------------------------------------------------

const ROW_BASE = cn(
  "flex w-full items-center gap-3 rounded-2xl border border-border bg-card p-3 text-left",
  "transition-colors hover:bg-muted/30 hover:border-border/80",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
);

const BADGE_BASE = cn(
  "inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5",
  "text-[10px] font-bold tracking-widest uppercase text-muted-foreground",
);

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type Props = {
  event: DayEvent;
  onClick?: (event: DayEvent) => void;
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * TidslinjeRow — one event in the slim TidslinjeTab list.
 *
 * Visual contract: Task Manager prototype TaskCard (simplified for bottom-sheet
 * density). Layout: time → type-badge → title. Click opens EntityDrawer
 * (inherited from DashboardShell globally).
 *
 * WHY compact: bottom-sheet has a 75vh budget; expect 8–15 visible rows. Every
 * pixel of vertical space matters — no avatar, no subtitle in the primary row.
 *
 * a11y: rendered as <button> so it is keyboard-focusable; focus ring satisfies
 * WCAG 2.4.7 (focus visible) without naked outline-none.
 */
export function TidslinjeRow({ event, onClick }: Props) {
  const Icon = TYPE_ICON[event.type] ?? Clock;
  const label = TYPE_LABEL[event.type] ?? event.type;

  // `event.time` is always HH:MM produced by hhmm() in use-day-timeline-events.
  // Hook fallback can be a hook_type string — slice(0,5) is safe for both.
  const timeShort = event.time.slice(0, 5);

  return (
    <button type="button" onClick={() => onClick?.(event)} className={ROW_BASE}>
      {/* Fixed-width time column keeps all rows vertically aligned */}
      <span className="text-muted-foreground min-w-[44px] font-mono text-xs tabular-nums">
        {timeShort}
      </span>

      {/* Type badge: icon + uppercase label */}
      <span className={BADGE_BASE}>
        <Icon className="h-3 w-3" aria-hidden />
        {label}
      </span>

      {/* Title — truncated to single line; full text available in EntityDrawer */}
      <span className="text-foreground flex-1 truncate text-sm font-medium">
        {event.title || "(uten tittel)"}
      </span>
    </button>
  );
}
