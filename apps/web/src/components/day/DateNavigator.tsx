// apps/web/src/components/day/DateNavigator.tsx
"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from "lucide-react";
import { addDays, format, parseISO, startOfToday, formatISO } from "date-fns";
import { nb } from "date-fns/locale";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";

type Props = {
  dateISO: string;
  onChange: (dateISO: string) => void;
};

export function DateNavigator({ dateISO, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const date = parseISO(dateISO);
  const today = startOfToday();
  const isToday =
    formatISO(date, { representation: "date" }) === formatISO(today, { representation: "date" });

  return (
    <div className="inline-flex items-center gap-1.5">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label="Forrige dag"
        onClick={() => onChange(formatISO(addDays(date, -1), { representation: "date" }))}
      >
        <ChevronLeft className="h-4 w-4" aria-hidden />
      </Button>

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button type="button" variant="outline" size="sm" className="gap-1.5">
            <CalendarIcon className="h-3.5 w-3.5" aria-hidden />
            {format(date, "EEEE d. MMM", { locale: nb })}
            {isToday && (
              <span className="text-muted-foreground text-[10px] font-semibold tracking-[0.12em] uppercase">
                I dag
              </span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={date}
            onSelect={(d) => {
              if (d) {
                onChange(formatISO(d, { representation: "date" }));
                setOpen(false);
              }
            }}
            initialFocus
          />
        </PopoverContent>
      </Popover>

      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label="Neste dag"
        onClick={() => onChange(formatISO(addDays(date, 1), { representation: "date" }))}
      >
        <ChevronRight className="h-4 w-4" aria-hidden />
      </Button>

      {!isToday && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onChange(formatISO(today, { representation: "date" }))}
          className="text-xs"
        >
          Tilbake til i dag
        </Button>
      )}
    </div>
  );
}
