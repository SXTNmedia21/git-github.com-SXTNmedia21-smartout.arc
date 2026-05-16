"use client";

import { Calendar, CheckCircle2, AlertTriangle, StickyNote, LogIn, LogOut } from "lucide-react";
import { cn } from "@smartout/ui";
import type { DayEvent, DayEventType } from "@/app/dashboard/_hooks/use-day-timeline-events";

export type DayTimelineStripProps = {
  events: DayEvent[];
  /** Session start HH:MM. If null, falls back to 06:00. */
  startHHMM: string | null;
  /** Session end HH:MM. If null, falls back to "next day 02:00". */
  endHHMM: string | null;
  /** ISO date for "now" calculation when same day. */
  dateISO: string;
  /** Click an event marker → drill to row. */
  onSelect?: (event: DayEvent) => void;
  /**
   * When true, the time axis becomes interactive: invisible 15-min hit-zones
   * appear on hover (guide-line + pointer cursor) and clicking fires onSlotClick.
   * Defaults to false — read-only contract preserved for existing consumers.
   */
  editable?: boolean;
  /**
   * Called with the resolved HH:MM string when a time-axis slot is clicked.
   * Only fires when editable=true.
   */
  onSlotClick?: (timeHHMM: string) => void;
};

type ShapeKind = "dot" | "flag" | "diamond" | "arrow-down" | "arrow-up" | "ring";

const TYPE_META: Record<
  DayEventType,
  {
    icon: typeof Calendar;
    shape: ShapeKind;
    /** Tailwind class for fill color (use /80 for soft). */
    fill: string;
    /** Ring color for halo. */
    ring: string;
    /** Icon color (white for solid shapes, inherits when ring-only). */
    iconColor: string;
    label: string;
  }
> = {
  booking: {
    icon: Calendar,
    shape: "dot",
    fill: "bg-blue-400/90 dark:bg-blue-500/80",
    ring: "ring-blue-300/40 dark:ring-blue-500/25",
    iconColor: "text-white",
    label: "Booking",
  },
  note: {
    icon: StickyNote,
    shape: "flag",
    fill: "bg-purple-400/90 dark:bg-purple-500/80",
    ring: "ring-purple-300/40 dark:ring-purple-500/25",
    iconColor: "text-white",
    label: "Notat",
  },
  task: {
    icon: CheckCircle2,
    shape: "ring",
    fill: "bg-emerald-400/85 dark:bg-emerald-500/75",
    ring: "ring-emerald-300/40 dark:ring-emerald-500/25",
    iconColor: "text-white",
    label: "Oppgave",
  },
  deviation: {
    icon: AlertTriangle,
    shape: "diamond",
    fill: "bg-rose-400/90 dark:bg-rose-500/80",
    ring: "ring-rose-300/40 dark:ring-rose-500/25",
    iconColor: "text-white",
    label: "Avvik",
  },
  checkin: {
    icon: LogIn,
    shape: "arrow-down",
    fill: "bg-amber-400/90 dark:bg-amber-500/80",
    ring: "ring-amber-300/40 dark:ring-amber-500/25",
    iconColor: "text-white",
    label: "Innsjekk",
  },
  checkout: {
    icon: LogOut,
    shape: "arrow-up",
    fill: "bg-muted-foreground/60",
    ring: "ring-muted-foreground/20",
    iconColor: "text-background",
    label: "Utsjekk",
  },
};

function timeToMinutes(hhmm: string | null): number | null {
  if (!hhmm) return null;
  const parts = hhmm.split(":").map(Number);
  const h = parts[0];
  const m = parts[1] ?? 0;
  if (h === undefined || Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}

function Marker({
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
  Icon: typeof Calendar;
}) {
  if (shape === "dot") {
    return (
      <span
        className={cn(
          "border-background flex h-5 w-5 items-center justify-center rounded-full border-2 shadow-sm ring-4",
          fill,
          ring,
        )}
      >
        <Icon className={cn("h-2.5 w-2.5", iconColor)} />
      </span>
    );
  }
  if (shape === "ring") {
    return (
      <span
        className={cn(
          "border-background flex h-5 w-5 items-center justify-center rounded-full border-2 shadow-sm",
          fill,
          "ring-2",
          ring,
        )}
      >
        <Icon className={cn("h-2.5 w-2.5", iconColor)} />
      </span>
    );
  }
  if (shape === "diamond") {
    return (
      <span
        className={cn(
          "border-background flex h-5 w-5 rotate-45 items-center justify-center border-2 shadow-sm",
          fill,
          "ring-2",
          ring,
        )}
      >
        <Icon className={cn("h-2.5 w-2.5 -rotate-45", iconColor)} />
      </span>
    );
  }
  if (shape === "flag") {
    // Right-pointing rectangle: pin at left edge, content extends right
    return (
      <span
        className={cn(
          "border-background flex h-5 w-6 items-center justify-center rounded-l-sm rounded-r-md border-2 shadow-sm",
          fill,
          "ring-2",
          ring,
        )}
      >
        <Icon className={cn("h-2.5 w-2.5", iconColor)} />
      </span>
    );
  }
  if (shape === "arrow-down") {
    return (
      <span
        className={cn(
          "border-background relative flex h-5 w-5 items-center justify-center rounded-t-md border-2 shadow-sm",
          fill,
          "ring-2",
          ring,
        )}
        style={{ clipPath: "polygon(0 0, 100% 0, 100% 60%, 50% 100%, 0 60%)" }}
      >
        <Icon className={cn("h-2.5 w-2.5", iconColor)} />
      </span>
    );
  }
  // arrow-up
  return (
    <span
      className={cn(
        "border-background relative flex h-5 w-5 items-center justify-center rounded-b-md border-2 shadow-sm",
        fill,
        "ring-2",
        ring,
      )}
      style={{ clipPath: "polygon(50% 0, 100% 40%, 100% 100%, 0 100%, 0 40%)" }}
    >
      <Icon className={cn("h-2.5 w-2.5", iconColor)} />
    </span>
  );
}

export function DayTimelineStrip({
  events,
  startHHMM,
  endHHMM,
  dateISO,
  onSelect,
  editable = false,
  onSlotClick,
}: DayTimelineStripProps) {
  const startMin = timeToMinutes(startHHMM) ?? 6 * 60;
  let endMin = timeToMinutes(endHHMM) ?? 26 * 60;
  if (endMin <= startMin) endMin += 24 * 60;
  const span = endMin - startMin;

  // Hour ticks every 2 hours
  const ticks: { min: number; label: string }[] = [];
  for (let m = Math.ceil(startMin / 60) * 60; m <= endMin; m += 120) {
    const h = Math.floor((m % (24 * 60)) / 60);
    ticks.push({
      min: m - startMin,
      label: `${String(h).padStart(2, "0")}:00`,
    });
  }

  // Now marker
  const now = new Date();
  const todayISO = now.toISOString().slice(0, 10);
  const isToday = todayISO === dateISO;
  const nowMin = isToday ? now.getHours() * 60 + now.getMinutes() : null;
  const nowPct =
    nowMin != null && nowMin >= startMin && nowMin <= endMin
      ? ((nowMin - startMin) / span) * 100
      : null;

  // Map events to position percent + optional end percent (for duration bars).
  const positioned = events
    .map((e) => {
      const m = timeToMinutes(e.time);
      if (m == null) return null;
      let normM = m;
      if (normM < startMin && normM + 24 * 60 <= endMin) normM += 24 * 60;
      if (normM < startMin || normM > endMin) return null;
      const pct = ((normM - startMin) / span) * 100;
      let pctEnd: number | null = null;
      if (e.endTime) {
        const em = timeToMinutes(e.endTime);
        if (em != null) {
          let nem = em;
          if (nem < startMin && nem + 24 * 60 <= endMin) nem += 24 * 60;
          if (nem >= startMin && nem <= endMin) {
            pctEnd = ((nem - startMin) / span) * 100;
          }
        }
      }
      return { event: e, pct, pctEnd };
    })
    .filter((x): x is { event: DayEvent; pct: number; pctEnd: number | null } => x !== null)
    .sort((a, b) => a.pct - b.pct);

  // Simple lane assignment to avoid overlap when markers within 2% of each other
  const LANES = 3;
  const laneTails: number[] = [-100, -100, -100];
  const withLanes = positioned.map((p) => {
    let lane = 0;
    for (let i = 0; i < LANES; i++) {
      if (p.pct - (laneTails[i] ?? -100) > 2) {
        lane = i;
        break;
      }
      if (i === LANES - 1) lane = 0; // overflow → top
    }
    laneTails[lane] = p.pct;
    return { ...p, lane };
  });

  // 15-min hit-zones for editable mode.
  // Each zone covers one 15-min slot; clicking resolves the nearest HH:MM.
  const SLOT_INTERVAL = 15; // minutes
  const slots: { min: number; pct: number; label: string }[] = [];
  if (editable) {
    // Round startMin up to the nearest 15-min boundary
    const firstSlot = Math.ceil(startMin / SLOT_INTERVAL) * SLOT_INTERVAL;
    for (let m = firstSlot; m <= endMin; m += SLOT_INTERVAL) {
      const absMin = m % (24 * 60);
      const h = Math.floor(absMin / 60);
      const min = absMin % 60;
      const label = `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
      const pct = ((m - startMin) / span) * 100;
      if (pct >= 0 && pct <= 100) {
        slots.push({ min: m, pct, label });
      }
    }
  }

  return (
    <div className="bg-card border-border relative overflow-hidden rounded-2xl border p-5 shadow-sm">
      <div className="relative z-10">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-foreground text-sm font-bold tracking-tight">Dagslinjen</h3>
          <span className="text-muted-foreground font-mono text-[11px] tabular-nums">
            {startHHMM ?? "—"}–{endHHMM ?? "—"}
          </span>
        </div>

        {/* Track */}
        <div className={cn("relative h-24 select-none", editable && "cursor-crosshair")}>
          {/* Background bar */}
          <div className="border-border bg-muted/40 absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full border" />

          {/* Now marker */}
          {nowPct != null ? (
            <div
              className="absolute top-2 bottom-2 w-px bg-orange-500/60"
              style={{ left: `${nowPct}%` }}
              aria-label="Nå"
            >
              <span className="absolute -top-1 left-1/2 inline-block h-2.5 w-2.5 -translate-x-1/2 rounded-full bg-orange-500 shadow-md ring-2 ring-orange-200 dark:ring-orange-900/50" />
            </div>
          ) : null}

          {/* Hour ticks */}
          {ticks.map((t) => {
            const pct = (t.min / span) * 100;
            return (
              <div
                key={t.label}
                className="absolute top-1/2 -translate-y-1/2"
                style={{ left: `${pct}%` }}
              >
                <span
                  aria-hidden
                  className="bg-border/60 absolute top-0 h-2 w-px -translate-x-1/2"
                />
                <span className="text-muted-foreground/60 absolute top-3 -translate-x-1/2 font-mono text-[10px] tabular-nums">
                  {t.label}
                </span>
              </div>
            );
          })}

          {/* 15-min click-to-add hit-zones (editable mode only).
              Invisible full-height buttons spaced every 15 min.
              On hover: thin guide-line + cursor hint.
              Rendered BEHIND event markers so markers remain interactive. */}
          {editable &&
            slots.map((slot, idx) => {
              // Each zone occupies from this slot's pct to the next slot's pct
              const nextPct = slots[idx + 1]?.pct ?? 100;
              const widthPct = nextPct - slot.pct;
              return (
                <button
                  key={`slot-${slot.label}`}
                  type="button"
                  aria-label={`Legg til kl ${slot.label}`}
                  onClick={() => onSlotClick?.(slot.label)}
                  className={cn(
                    "group absolute top-0 bottom-0 z-0",
                    "cursor-pointer",
                    "focus-visible:outline-none",
                  )}
                  style={{ left: `${slot.pct}%`, width: `${widthPct}%` }}
                >
                  {/* Thin guide-line on hover */}
                  <span
                    aria-hidden
                    className={cn(
                      "pointer-events-none absolute top-0 bottom-0 left-0 w-px",
                      "bg-transparent transition-colors",
                      "group-hover:bg-orange-400/50 group-focus-visible:bg-orange-400/50",
                    )}
                  />
                </button>
              );
            })}

          {/* Duration bars (tasks with start+end). Rendered behind markers. */}
          {withLanes.map(({ event, pct, pctEnd, lane }) => {
            if (pctEnd == null || pctEnd <= pct) return null;
            const meta = TYPE_META[event.type];
            const offsetY = lane === 0 ? "0" : lane === 1 ? "-22px" : "22px";
            return (
              <div
                key={`bar-${event.id}`}
                aria-hidden
                className={cn("absolute top-1/2 h-2 rounded-full", meta.fill)}
                style={{
                  left: `${pct}%`,
                  width: `${pctEnd - pct}%`,
                  transform: `translateY(calc(-50% + ${offsetY}))`,
                  opacity: 0.6,
                }}
              />
            );
          })}

          {/* Event markers in lanes */}
          {withLanes.map(({ event, pct, lane }) => {
            const meta = TYPE_META[event.type];
            const Icon = meta.icon;
            const offsetY = lane === 0 ? "0" : lane === 1 ? "-22px" : "22px";
            return (
              <button
                key={event.id}
                type="button"
                onClick={() => onSelect?.(event)}
                title={`${event.time} · ${event.title}${event.actor ? ` · ${event.actor}` : ""}`}
                aria-label={`${event.time} ${event.title}`}
                className={cn(
                  "absolute top-1/2 z-10 transition-transform",
                  "hover:scale-125 focus-visible:scale-125 focus-visible:outline-none",
                )}
                style={{
                  left: `${pct}%`,
                  transform: `translate(-50%, calc(-50% + ${offsetY}))`,
                }}
              >
                <Marker
                  shape={meta.shape}
                  fill={meta.fill}
                  ring={meta.ring}
                  iconColor={meta.iconColor}
                  Icon={Icon}
                />
              </button>
            );
          })}
        </div>

        {/* Legend */}
        <div className="text-muted-foreground/80 mt-4 flex flex-wrap gap-x-3 gap-y-1.5 text-[11px]">
          {(["booking", "note", "task", "deviation", "checkin", "checkout"] as DayEventType[]).map(
            (k) => {
              const meta = TYPE_META[k];
              const Icon = meta.icon;
              return (
                <span key={k} className="inline-flex items-center gap-1.5">
                  <Marker
                    shape={meta.shape}
                    fill={meta.fill}
                    ring={meta.ring}
                    iconColor={meta.iconColor}
                    Icon={Icon}
                  />
                  {meta.label}
                </span>
              );
            },
          )}
        </div>
      </div>
    </div>
  );
}
