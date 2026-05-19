"use client";

import { useEffect, useRef } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { motion as motionTokens } from "@smartout/design-tokens";
import {
  addDays,
  endOfMonth,
  endOfWeek,
  format,
  formatISO,
  getDay,
  isSameDay,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { nb } from "date-fns/locale";
import { type CalendarEvent, EVENT_COLOR_HEX } from "../_lib/types";
import type { DayHours } from "@/app/dashboard/website/_actions/bridge-actions";
import { ShiftBadge } from "./overlays/ShiftBadge";
import { HolidayBand } from "./overlays/HolidayBand";

/**
 * Returns the ISO yyyy-MM-dd key for a given Date.
 * Uses local timezone via formatISO to match how CalendarPageShell stores selectedDayISO.
 */
function isoKey(d: Date): string {
  return formatISO(d, { representation: "date" });
}

export type ViewMode = "day" | "week" | "month";

const WEEK_OPTS = { weekStartsOn: 1 as const, locale: nb };
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const HOUR_HEIGHT = 56;

/**
 * date-fns getDay() returns 0=Sun … 6=Sat, but company_opening_hours
 * indexes Monday=0 … Sunday=6. Convert before lookup.
 */
function hoursForDate(date: Date, hours: DayHours[]): DayHours | null {
  if (!hours.length) return null;
  const jsDow = getDay(date); // 0 Sun … 6 Sat
  const isoIndex = jsDow === 0 ? 6 : jsDow - 1; // 0 Mon … 6 Sun
  return hours[isoIndex] ?? null;
}

/**
 * `getCompanyHours` always returns 7 rows; missing DB rows default to
 * `{open: "", close: "", closed: true}`. Treat that as "not configured"
 * so calendar doesn't render as fully-stengt before user enters hours.
 */
function hasRealHours(hours: DayHours[]): boolean {
  return hours.some((h) => (h.open && h.close) || h.closed === false);
}

/**
 * Given hours row, compute open window in fractional hours (0–24).
 * Returns null when fully closed or unparseable.
 */
function openWindow(row: DayHours | null): { from: number; to: number } | null {
  if (!row || row.closed || !row.open || !row.close) return null;
  const [oh, om] = row.open.split(":").map(Number);
  const [ch, cm] = row.close.split(":").map(Number);
  if (
    Number.isNaN(oh ?? NaN) ||
    Number.isNaN(om ?? NaN) ||
    Number.isNaN(ch ?? NaN) ||
    Number.isNaN(cm ?? NaN)
  ) {
    return null;
  }
  return { from: (oh ?? 0) + (om ?? 0) / 60, to: (ch ?? 0) + (cm ?? 0) / 60 };
}

type CalendarTabProps = {
  view: ViewMode;
  cursor: Date;
  events: CalendarEvent[];
  companyHours: DayHours[];
  shiftsByDate?: Record<string, number>;
  holidaysByDate?: Record<string, { name: string }>;
  showShifts?: boolean;
  showHolidays?: boolean;
  onEventClick: (event: CalendarEvent) => void;
  onSlotClick: (date: Date, hour: number) => void;
  onDayOpen: (date: Date) => void;
};

export function CalendarTab({
  view,
  cursor,
  events,
  companyHours,
  shiftsByDate = {},
  holidaysByDate = {},
  showShifts = false,
  showHolidays = false,
  onEventClick,
  onSlotClick,
  onDayOpen,
}: CalendarTabProps) {
  // If hours haven't been configured yet, skip shading entirely so the
  // grid doesn't look all-stengt out of the box.
  const effectiveHours = hasRealHours(companyHours) ? companyHours : [];
  const reduce = useReducedMotion();
  // Use a stable object shape on both SSR and CSR.
  // `reduce` is null on SSR (falsy) → same branch as reduce=false → full animation.
  // Reduced-motion users get duration=0 (instant transition, no layout shift).
  const swap = {
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -8 },
    transition: {
      duration: reduce ? 0 : motionTokens.exitMs / 1000,
      ease: motionTokens.easingExpoArray,
    },
  };

  // Re-key on view + period start so prev/next + view swap both animate.
  // Use local-tz isoKey() — consistent with how CalendarPageShell stores selectedDayISO.
  const periodKey =
    view === "day"
      ? isoKey(cursor)
      : view === "week"
        ? isoKey(startOfWeek(cursor, WEEK_OPTS))
        : format(startOfMonth(cursor), "yyyy-MM");

  return (
    <div className="border-border bg-card relative flex flex-col rounded-xl border">
      <div className="min-h-[36rem]">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={`${view}-${periodKey}`} {...swap}>
            {view === "day" && (
              <DayView
                date={cursor}
                events={events}
                companyHours={effectiveHours}
                shiftsByDate={shiftsByDate}
                holidaysByDate={holidaysByDate}
                showShifts={showShifts}
                showHolidays={showHolidays}
                onEventClick={onEventClick}
                onSlotClick={onSlotClick}
              />
            )}
            {view === "week" && (
              <WeekView
                date={cursor}
                events={events}
                companyHours={effectiveHours}
                shiftsByDate={shiftsByDate}
                holidaysByDate={holidaysByDate}
                showShifts={showShifts}
                showHolidays={showHolidays}
                onEventClick={onEventClick}
                onSlotClick={onSlotClick}
                onDayOpen={onDayOpen}
              />
            )}
            {view === "month" && (
              <MonthView
                date={cursor}
                events={events}
                companyHours={effectiveHours}
                shiftsByDate={shiftsByDate}
                holidaysByDate={holidaysByDate}
                showShifts={showShifts}
                showHolidays={showHolidays}
                onEventClick={onEventClick}
                onDayOpen={onDayOpen}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

function DayView({
  date,
  events,
  companyHours,
  shiftsByDate,
  holidaysByDate,
  showShifts,
  showHolidays,
  onEventClick,
  onSlotClick,
}: {
  date: Date;
  events: CalendarEvent[];
  companyHours: DayHours[];
  shiftsByDate: Record<string, number>;
  holidaysByDate: Record<string, { name: string }>;
  showShifts: boolean;
  showHolidays: boolean;
  onEventClick: (e: CalendarEvent) => void;
  onSlotClick: (date: Date, hour: number) => void;
}) {
  const dayEvents = events.filter((e) => isSameDay(parseISO(e.date), date));
  const window = openWindow(hoursForDate(date, companyHours));
  const key = isoKey(date);
  const hasOverlayStrip =
    (showHolidays && !!holidaysByDate[key]) || (showShifts && (shiftsByDate[key] ?? 0) > 0);

  // Scroll-to-current-hour parity with WeekView.
  const currentHour = new Date().getHours();
  const nowRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    nowRef.current?.scrollIntoView({ behavior: "auto", block: "start" });
  }, []);

  return (
    <div className="grid grid-cols-[4rem_1fr]">
      {/* Overlay top-strip: shows holiday name + shift count for this day */}
      {hasOverlayStrip ? (
        <div className="border-border col-span-2 flex items-center gap-3 border-b px-3 py-1.5">
          {showHolidays && holidaysByDate[key] ? (
            <span className="text-[10px] font-semibold tracking-wide text-[var(--brand-orange)] uppercase">
              {holidaysByDate[key].name}
            </span>
          ) : null}
          {showShifts && (shiftsByDate[key] ?? 0) > 0 ? (
            <ShiftBadge count={shiftsByDate[key]!} size="md" />
          ) : null}
        </div>
      ) : null}
      <div className="border-border border-r">
        {HOURS.map((h) => (
          <div
            key={h}
            ref={h === currentHour ? nowRef : undefined}
            className="text-muted-foreground border-border h-14 scroll-mt-16 border-b px-2 pt-1 text-[10px]"
          >
            {String(h).padStart(2, "0")}:00
          </div>
        ))}
      </div>
      <div className="relative">
        <ClosedHoursOverlay window={window} />
        {HOURS.map((h) => (
          <button
            key={h}
            onClick={() => onSlotClick(date, h)}
            className="border-border hover:bg-muted/40 relative z-10 block h-14 w-full border-b text-left transition-colors"
            aria-label={`Legg til event ${String(h).padStart(2, "0")}:00`}
          />
        ))}
        {dayEvents.map((e) => (
          <EventBlock key={e.id} event={e} onClick={onEventClick} />
        ))}
      </div>
    </div>
  );
}

/**
 * Renders muted shading over hours that fall outside the open window.
 * If no window (closed all day or no hours data) the whole column is muted.
 */
function ClosedHoursOverlay({ window }: { window: { from: number; to: number } | null }) {
  if (!window) {
    return (
      <div
        aria-hidden
        className="bg-muted/40 pointer-events-none absolute inset-0"
        style={{ height: 24 * HOUR_HEIGHT }}
      />
    );
  }
  const beforeHeight = window.from * HOUR_HEIGHT;
  const afterTop = window.to * HOUR_HEIGHT;
  const afterHeight = (24 - window.to) * HOUR_HEIGHT;
  return (
    <>
      {beforeHeight > 0 ? (
        <div
          aria-hidden
          className="bg-muted/40 pointer-events-none absolute inset-x-0 top-0"
          style={{ height: beforeHeight }}
        />
      ) : null}
      {afterHeight > 0 ? (
        <div
          aria-hidden
          className="bg-muted/40 pointer-events-none absolute inset-x-0"
          style={{ top: afterTop, height: afterHeight }}
        />
      ) : null}
      {/* Open-window markers (top + bottom hairlines) */}
      <div
        aria-hidden
        className="bg-primary/30 pointer-events-none absolute inset-x-0 h-px"
        style={{ top: window.from * HOUR_HEIGHT }}
      />
      <div
        aria-hidden
        className="bg-primary/30 pointer-events-none absolute inset-x-0 h-px"
        style={{ top: window.to * HOUR_HEIGHT }}
      />
    </>
  );
}

function WeekView({
  date,
  events,
  companyHours,
  shiftsByDate,
  holidaysByDate,
  showShifts,
  showHolidays,
  onEventClick,
  onSlotClick,
  onDayOpen,
}: {
  date: Date;
  events: CalendarEvent[];
  companyHours: DayHours[];
  shiftsByDate: Record<string, number>;
  holidaysByDate: Record<string, { name: string }>;
  showShifts: boolean;
  showHolidays: boolean;
  onEventClick: (e: CalendarEvent) => void;
  onSlotClick: (date: Date, hour: number) => void;
  onDayOpen: (date: Date) => void;
}) {
  const weekStart = startOfWeek(date, WEEK_OPTS);
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  // Google-Calendar-style: scroll the time-grid so the current hour lands
  // near the top of the visible area on mount + view change. Ref is on the
  // hour-label row matching the current local hour; scrollIntoView climbs
  // to the nearest scrolling ancestor (CalendarPageShell's overflow-y-auto).
  const currentHour = new Date().getHours();
  const nowRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    nowRef.current?.scrollIntoView({ behavior: "auto", block: "start" });
  }, []);

  return (
    <div>
      <div className="border-border bg-card sticky top-0 z-20 grid grid-cols-[4rem_repeat(7,1fr)] border-b">
        <div />
        {days.map((d) => {
          const row = hoursForDate(d, companyHours);
          const today = isSameDay(d, new Date());
          const key = isoKey(d);
          return (
            <button
              key={d.toISOString()}
              type="button"
              onClick={() => onDayOpen(d)}
              className={`border-border hover:bg-muted/40 cursor-pointer border-l px-2 py-2 text-center text-xs transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-orange)] focus-visible:ring-inset ${
                today ? "text-foreground font-bold" : "text-muted-foreground font-medium"
              }`}
            >
              <div className="capitalize">{format(d, "EEE", { locale: nb })}</div>
              <div
                className={`mt-0.5 text-base font-semibold ${
                  today
                    ? "bg-primary text-primary-foreground mx-auto inline-flex h-7 w-7 items-center justify-center rounded-full"
                    : "text-foreground"
                }`}
              >
                {format(d, "d", { locale: nb })}
              </div>
              {row ? (
                <div
                  className={`mt-0.5 text-[9px] tracking-wide ${
                    row.closed ? "text-muted-foreground/70" : "text-primary/80"
                  }`}
                >
                  {row.closed ? "Stengt" : `${row.open}–${row.close}`}
                </div>
              ) : null}
              {showHolidays && holidaysByDate[key] ? (
                <HolidayBand name={holidaysByDate[key].name} variant="week-header" />
              ) : null}
              {showShifts && (shiftsByDate[key] ?? 0) > 0 ? (
                <div className="mt-0.5 flex justify-center">
                  <ShiftBadge count={shiftsByDate[key]!} size="sm" />
                </div>
              ) : null}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-[4rem_repeat(7,1fr)]">
        <div className="border-border border-r">
          {HOURS.map((h) => (
            <div
              key={h}
              ref={h === currentHour ? nowRef : undefined}
              className="text-muted-foreground border-border h-14 scroll-mt-16 border-b px-2 pt-1 text-[10px]"
            >
              {String(h).padStart(2, "0")}:00
            </div>
          ))}
        </div>
        {days.map((d) => {
          const dayEvents = events.filter((e) => isSameDay(parseISO(e.date), d));
          const window = openWindow(hoursForDate(d, companyHours));
          return (
            <div key={d.toISOString()} className="border-border relative border-l">
              <ClosedHoursOverlay window={window} />
              {HOURS.map((h) => (
                <button
                  key={h}
                  onClick={() => onSlotClick(d, h)}
                  className="border-border hover:bg-muted/40 relative z-10 block h-14 w-full border-b text-left transition-colors"
                  aria-label={`Legg til event ${format(d, "d. MMM", { locale: nb })} ${String(h).padStart(2, "0")}:00`}
                />
              ))}
              {dayEvents.map((e) => (
                <EventBlock key={e.id} event={e} onClick={onEventClick} compact />
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MonthView({
  date,
  events,
  companyHours,
  shiftsByDate,
  holidaysByDate,
  showShifts,
  showHolidays,
  onEventClick,
  onDayOpen,
}: {
  date: Date;
  events: CalendarEvent[];
  companyHours: DayHours[];
  shiftsByDate: Record<string, number>;
  holidaysByDate: Record<string, { name: string }>;
  showShifts: boolean;
  showHolidays: boolean;
  onEventClick: (e: CalendarEvent) => void;
  onDayOpen: (date: Date) => void;
}) {
  const monthStart = startOfMonth(date);
  const monthEnd = endOfMonth(date);
  const gridStart = startOfWeek(monthStart, WEEK_OPTS);
  const gridEnd = endOfWeek(monthEnd, WEEK_OPTS);

  const days: Date[] = [];
  let cursor = gridStart;
  while (cursor <= gridEnd) {
    days.push(cursor);
    cursor = addDays(cursor, 1);
  }

  const weekdayLabels = Array.from({ length: 7 }, (_, i) =>
    format(addDays(gridStart, i), "EEE", { locale: nb }),
  );

  return (
    <div>
      <div className="border-border grid grid-cols-7 border-b">
        {weekdayLabels.map((label) => (
          <div
            key={label}
            className="text-muted-foreground border-border border-l px-2 py-2 text-center text-[11px] font-semibold tracking-wide uppercase first:border-l-0"
          >
            {label}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 grid-rows-6">
        {days.map((d) => {
          const inMonth = isSameMonth(d, date);
          const isToday = isSameDay(d, new Date());
          const dayEvents = events.filter((e) => isSameDay(parseISO(e.date), d));
          const closed = companyHours.length > 0 && !openWindow(hoursForDate(d, companyHours));
          const key = isoKey(d);
          return (
            <div
              key={d.toISOString()}
              onClick={() => onDayOpen(d)}
              role="button"
              tabIndex={inMonth ? 0 : -1}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onDayOpen(d);
                }
              }}
              className={`border-border relative min-h-24 cursor-pointer border-b border-l p-1.5 transition-colors first:border-l-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-orange)] focus-visible:ring-inset ${
                inMonth
                  ? closed
                    ? "bg-muted/20 hover:bg-muted/40"
                    : "bg-card hover:bg-muted/30"
                  : "bg-muted/30"
              }`}
            >
              {/* HolidayBand — absolute top strip (~14px tall), aria-hidden */}
              {showHolidays && holidaysByDate[key] ? (
                <HolidayBand name={holidaysByDate[key].name} variant="month-cell" />
              ) : null}
              {/* Push day number below the holiday band when present */}
              <div
                className={`text-xs ${showHolidays && holidaysByDate[key] ? "mt-4" : ""} ${
                  isToday
                    ? "bg-primary text-primary-foreground inline-flex h-6 w-6 items-center justify-center rounded-full font-bold"
                    : inMonth
                      ? "text-foreground font-medium"
                      : "text-muted-foreground"
                }`}
              >
                {format(d, "d")}
              </div>
              <div className="mt-1 flex flex-col gap-0.5">
                {dayEvents.slice(0, 2).map((e) => (
                  <button
                    key={e.id}
                    onClick={(ev) => {
                      ev.stopPropagation();
                      onEventClick(e);
                    }}
                    className="block w-full truncate rounded-sm px-1.5 py-px text-left text-[10px] leading-5 font-semibold transition-opacity hover:opacity-80"
                    style={{
                      // Solid color-keyed background gives reliable contrast
                      // on both light and dark themes. 18% opacity is
                      // enough to show the hue without competing with text.
                      backgroundColor: `color-mix(in oklch, ${EVENT_COLOR_HEX[e.color]} 18%, var(--card))`,
                      color: EVENT_COLOR_HEX[e.color],
                      borderLeft: `2px solid ${EVENT_COLOR_HEX[e.color]}`,
                    }}
                  >
                    {e.title}
                  </button>
                ))}
                {dayEvents.length > 2 ? (
                  <span className="text-muted-foreground inline-block rounded-sm px-1.5 py-px text-[9px] leading-5 font-medium">
                    +{dayEvents.length - 2} til
                  </span>
                ) : null}
              </div>
              {/* ShiftBadge — absolute bottom-right corner */}
              {showShifts && (shiftsByDate[key] ?? 0) > 0 ? (
                <div className="absolute right-1 bottom-1">
                  <ShiftBadge count={shiftsByDate[key]!} size="sm" />
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function EventBlock({
  event,
  onClick,
  compact,
}: {
  event: CalendarEvent;
  onClick: (e: CalendarEvent) => void;
  compact?: boolean;
}) {
  const top = event.startHour * HOUR_HEIGHT;
  const height = Math.max(24, (event.endHour - event.startHour) * HOUR_HEIGHT);
  const color = EVENT_COLOR_HEX[event.color];
  return (
    <button
      onClick={() => onClick(event)}
      className="absolute right-1 left-1 overflow-hidden rounded-md border-l-2 p-1.5 text-left text-[11px] font-semibold transition-opacity hover:opacity-90"
      style={{
        top,
        height,
        // Left border uses full event color; background is a subtle tint so
        // the block reads clearly on both light and dark themes.
        borderColor: color,
        backgroundColor: `color-mix(in oklch, ${color} 12%, var(--card))`,
        color,
      }}
    >
      <div className={compact ? "truncate leading-4" : "leading-4"}>{event.title}</div>
      {!compact ? (
        <div className="mt-0.5 text-[10px] leading-3 opacity-70" style={{ color }}>
          {String(event.startHour).padStart(2, "0")}:00–{String(event.endHour).padStart(2, "0")}:00
        </div>
      ) : null}
    </button>
  );
}
