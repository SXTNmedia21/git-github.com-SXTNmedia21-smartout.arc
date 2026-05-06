"use client";

import { useState } from "react";
import {
  Calendar,
  CheckCircle2,
  AlertTriangle,
  StickyNote,
  LogIn,
  LogOut,
  Filter,
} from "lucide-react";
import { cn } from "@smartout/ui";
import type { DayEvent, DayEventType } from "@/app/dashboard/_hooks/use-day-timeline-events";

const TYPE_META: Record<
  DayEventType,
  { icon: typeof Calendar; label: string; iconColor: string; bgColor: string; borderColor: string }
> = {
  booking: {
    icon: Calendar,
    label: "Booking",
    iconColor: "text-blue-600 dark:text-blue-400",
    bgColor: "bg-blue-50 dark:bg-blue-500/10",
    borderColor: "border-blue-200 dark:border-blue-500/20",
  },
  note: {
    icon: StickyNote,
    label: "Notat",
    iconColor: "text-purple-600 dark:text-purple-400",
    bgColor: "bg-purple-50 dark:bg-purple-500/10",
    borderColor: "border-purple-200 dark:border-purple-500/20",
  },
  task: {
    icon: CheckCircle2,
    label: "Oppgave",
    iconColor: "text-emerald-600 dark:text-emerald-400",
    bgColor: "bg-emerald-50 dark:bg-emerald-500/10",
    borderColor: "border-emerald-200 dark:border-emerald-500/20",
  },
  deviation: {
    icon: AlertTriangle,
    label: "Avvik",
    iconColor: "text-rose-600 dark:text-rose-400",
    bgColor: "bg-rose-50 dark:bg-rose-500/10",
    borderColor: "border-rose-200 dark:border-rose-500/20",
  },
  checkin: {
    icon: LogIn,
    label: "Innsjekk",
    iconColor: "text-amber-600 dark:text-amber-400",
    bgColor: "bg-amber-50 dark:bg-amber-500/10",
    borderColor: "border-amber-200 dark:border-amber-500/20",
  },
  checkout: {
    icon: LogOut,
    label: "Utsjekk",
    iconColor: "text-muted-foreground",
    bgColor: "bg-muted",
    borderColor: "border-border",
  },
};

const FILTERS: { key: DayEventType | "all"; label: string }[] = [
  { key: "all", label: "Alle" },
  { key: "booking", label: "Bookinger" },
  { key: "note", label: "Notater" },
  { key: "task", label: "Oppgaver" },
  { key: "deviation", label: "Avvik" },
  { key: "checkin", label: "Innsjekk" },
];

export type DayEventListProps = {
  events: DayEvent[];
  highlightedId?: string | null;
  onEventClick?: (event: DayEvent) => void;
};

export function DayEventList({ events, highlightedId, onEventClick }: DayEventListProps) {
  const [filter, setFilter] = useState<DayEventType | "all">("all");

  const filtered = filter === "all" ? events : events.filter((e) => e.type === filter);

  return (
    <div className="bg-card border-border relative overflow-hidden rounded-2xl border p-5 shadow-sm">
      <div className="relative z-10">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-foreground text-sm font-bold tracking-tight">Hendelser i dag</h3>
          <div className="bg-muted/60 border-border inline-flex items-center gap-0.5 rounded-lg border p-0.5">
            <Filter className="text-muted-foreground ml-1.5 h-3 w-3" aria-hidden />
            {FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => setFilter(f.key)}
                className={cn(
                  "rounded-md px-2 py-1 text-[11px] font-semibold transition-all",
                  filter === f.key
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="text-muted-foreground py-8 text-center text-[13px]">
            Ingen hendelser i denne kategorien.
          </div>
        ) : (
          <ul className="grid gap-2">
            {filtered.map((e) => {
              const meta = TYPE_META[e.type];
              const Icon = meta.icon;
              const isHighlighted = highlightedId === e.id;
              return (
                <li key={e.id}>
                  <button
                    type="button"
                    onClick={() => onEventClick?.(e)}
                    className={cn(
                      "border-border bg-background hover:bg-muted/40 group flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-all",
                      "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
                      isHighlighted && "ring-ring ring-2 ring-offset-2",
                    )}
                  >
                    <span className="text-muted-foreground w-12 shrink-0 font-mono text-[12px] tabular-nums">
                      {e.time}
                    </span>
                    <span
                      className={cn(
                        "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border",
                        meta.bgColor,
                        meta.borderColor,
                      )}
                    >
                      <Icon className={cn("h-4 w-4", meta.iconColor)} aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2">
                        <span
                          className={cn(
                            "truncate text-[13px] font-semibold",
                            e.done && "line-through opacity-60",
                          )}
                        >
                          {e.title}
                        </span>
                      </div>
                      {e.subtitle ? (
                        <div className="text-muted-foreground truncate text-[11px]">
                          {e.subtitle}
                        </div>
                      ) : null}
                    </div>
                    <span className="text-muted-foreground shrink-0 text-[10px] font-bold tracking-[0.12em] uppercase">
                      {meta.label}
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
