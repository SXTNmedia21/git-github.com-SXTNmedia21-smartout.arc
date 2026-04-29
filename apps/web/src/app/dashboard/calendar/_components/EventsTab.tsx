"use client";

import { CalendarClock, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { type CalendarEvent, EVENT_COLOR_HEX } from "../_lib/types";

type EventsTabProps = {
  events: CalendarEvent[];
  onAdd: () => void;
  onOpen: (event: CalendarEvent) => void;
};

export function EventsTab({ events, onAdd, onOpen }: EventsTabProps) {
  const sorted = [...events].sort((a, b) => {
    const cmp = a.date.localeCompare(b.date);
    if (cmp !== 0) return cmp;
    return a.startHour - b.startHour;
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-foreground text-base font-semibold">Alle eventer</h2>
          <p className="text-muted-foreground text-xs">
            {events.length} eventer · klikk for å åpne
          </p>
        </div>
        <Button size="sm" onClick={onAdd} className="gap-1.5">
          <Plus className="h-4 w-4" />
          Nytt event
        </Button>
      </div>

      {sorted.length === 0 ? (
        <div className="border-border bg-muted/30 text-muted-foreground rounded-xl border border-dashed p-10 text-center text-sm">
          Ingen eventer ennå. Trykk «Nytt event» for å starte.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {sorted.map((event) => {
            const color = EVENT_COLOR_HEX[event.color];
            return (
              <button
                key={event.id}
                onClick={() => onOpen(event)}
                className="border-border bg-card hover:border-foreground/20 flex items-center justify-between rounded-xl border p-4 text-left transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-lg"
                    style={{ backgroundColor: "color-mix(in oklch, " + color + " 15%, transparent)" }}
                  >
                    <CalendarClock className="h-5 w-5" style={{ color }} />
                  </div>
                  <div>
                    <div className="text-foreground text-sm font-semibold">{event.title}</div>
                    <div className="text-muted-foreground text-xs">
                      {event.date} · {String(event.startHour).padStart(2, "0")}:00 –{" "}
                      {String(event.endHour).padStart(2, "0")}:00
                    </div>
                  </div>
                </div>
                {event.source === "google" ? (
                  <span className="text-muted-foreground text-[10px] font-semibold uppercase tracking-wide">
                    Google
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
