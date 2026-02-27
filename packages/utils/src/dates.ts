import { format, isWithinInterval } from "date-fns";
import { nb } from "date-fns/locale";

export function formatNorwegianDate(date: Date): string {
  return format(date, "EEEE d. MMMM yyyy", { locale: nb });
}

export interface DateRange {
  startTime: Date;
  endTime: Date;
}

export function isOverlapping(a: DateRange, b: DateRange): boolean {
  return (
    isWithinInterval(a.startTime, { start: b.startTime, end: b.endTime }) ||
    isWithinInterval(b.startTime, { start: a.startTime, end: a.endTime }) ||
    isWithinInterval(a.endTime, { start: b.startTime, end: b.endTime }) ||
    isWithinInterval(b.endTime, { start: a.startTime, end: a.endTime })
  );
}
