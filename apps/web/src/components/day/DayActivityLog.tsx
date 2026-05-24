"use client";

import {
  Calendar,
  CheckCircle2,
  AlertTriangle,
  StickyNote,
  LogIn,
  LogOut,
  Bell,
} from "lucide-react";
import { cn } from "@smartout/ui";
import type { DayEvent, DayEventType } from "@/app/dashboard/_hooks/use-day-timeline-events";

const TYPE_META: Record<DayEventType, { icon: typeof Calendar; tone: string; label: string }> = {
  booking: {
    icon: Calendar,
    tone: "text-blue-500/80 dark:text-blue-400/80",
    label: "Booking",
  },
  note: {
    icon: StickyNote,
    tone: "text-purple-500/80 dark:text-purple-400/80",
    label: "Notat",
  },
  task: {
    icon: CheckCircle2,
    tone: "text-emerald-500/80 dark:text-emerald-400/80",
    label: "Oppgave",
  },
  deviation: {
    icon: AlertTriangle,
    tone: "text-rose-500/80 dark:text-rose-400/80",
    label: "Avvik",
  },
  checkin: {
    icon: LogIn,
    tone: "text-amber-500/80 dark:text-amber-400/80",
    label: "Innsjekk",
  },
  checkout: {
    icon: LogOut,
    tone: "text-muted-foreground",
    label: "Utsjekk",
  },
  hook: {
    icon: Bell,
    tone: "text-cyan-500/80 dark:text-cyan-400/80",
    label: "Sesjonshook",
  },
};

const VERB: Record<DayEventType, (e: DayEvent) => string> = {
  booking: (e) => e.title,
  note: (e) => e.title,
  task: (e) => (e.done ? "Fullført" : "Opprettet") + ` · ${e.title}`,
  deviation: (e) => e.title,
  checkin: (e) => `${e.title} stemplet inn`,
  checkout: (e) => `${e.title} stemplet ut`,
  hook: (e) => e.title,
};

const SEVERITY_PILL: Record<NonNullable<DayEvent["severity"]>, string> = {
  low: "bg-muted text-muted-foreground",
  medium: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  high: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
  critical: "bg-rose-500/20 text-rose-700 dark:text-rose-300",
};

export function DayActivityLog({
  events,
  limit = 12,
  onSelect,
}: {
  events: DayEvent[];
  limit?: number;
  onSelect?: (event: DayEvent) => void;
}) {
  const sorted = [...events].sort((a, b) => {
    if (!a.iso && !b.iso) return b.time.localeCompare(a.time);
    if (!a.iso) return 1;
    if (!b.iso) return -1;
    return b.iso.localeCompare(a.iso);
  });
  const visible = sorted.slice(0, limit);

  return (
    <div className="bg-card border-border relative flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border p-5 shadow-sm">
      <div className="relative z-10 flex min-h-0 flex-1 flex-col">
        <div className="mb-3 flex shrink-0 items-center justify-between">
          <h3 className="text-foreground text-sm font-bold tracking-tight">Aktivitetslogg</h3>
          <span className="text-muted-foreground font-mono text-[10px] tabular-nums">
            {visible.length} / {events.length}
          </span>
        </div>
        {visible.length === 0 ? (
          <div className="text-muted-foreground py-3 text-[12px]">Ingen aktivitet enda i dag.</div>
        ) : (
          <ul className="scrollbar-thin grid min-h-0 flex-1 gap-0.5 overflow-y-auto pr-1">
            {visible.map((e) => {
              const meta = TYPE_META[e.type];
              const Icon = meta.icon;
              return (
                <li key={e.id}>
                  <button
                    type="button"
                    onClick={() => onSelect?.(e)}
                    className={cn(
                      "hover:bg-muted/50 group flex w-full items-start gap-3 rounded-md px-2 py-1.5 text-left transition-colors",
                      "focus-visible:ring-ring focus-visible:ring-1 focus-visible:outline-none",
                    )}
                  >
                    <span className="text-muted-foreground/70 mt-0.5 w-10 shrink-0 font-mono text-[10px] tabular-nums">
                      {e.time}
                    </span>
                    <Icon className={cn("mt-0.5 h-3.5 w-3.5 shrink-0", meta.tone)} aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span
                        className={cn(
                          "block truncate text-[12px] font-medium",
                          e.done && "text-muted-foreground/60 line-through",
                        )}
                      >
                        {VERB[e.type](e)}
                      </span>
                      {e.actor || e.category || e.severity ? (
                        <span className="text-muted-foreground/80 mt-0.5 flex items-center gap-1.5 text-[10px]">
                          <span className="text-muted-foreground/60 shrink-0 font-bold tracking-wider uppercase">
                            {meta.label}
                          </span>
                          {e.category ? (
                            <>
                              <span aria-hidden className="opacity-50">
                                ·
                              </span>
                              <span className="truncate">{e.category}</span>
                            </>
                          ) : null}
                          {e.severity ? (
                            <span
                              className={cn(
                                "rounded-full px-1.5 py-px text-[9px] font-bold tracking-wider uppercase",
                                SEVERITY_PILL[e.severity],
                              )}
                            >
                              {e.severity}
                            </span>
                          ) : null}
                          {e.actor ? (
                            <>
                              <span aria-hidden className="opacity-50">
                                ·
                              </span>
                              <span className="truncate">av {e.actor}</span>
                            </>
                          ) : null}
                        </span>
                      ) : null}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
