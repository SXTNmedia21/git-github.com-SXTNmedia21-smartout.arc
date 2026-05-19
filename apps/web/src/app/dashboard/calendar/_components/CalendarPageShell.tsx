// ============================================
// CalendarPageShell.tsx
// Calendar hub shell — mirrors reports layout (header + tabs).
// Tabs: Kalender | Årshjul | Eventer | Bookinger
// Year-wheel tab dynamic-imported (heavy canvas).
// Calendar nav (prev/next/today + view toggle) lives in page header.
// ============================================

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { motion as motionTokens } from "@smartout/design-tokens";
import {
  CalendarDays,
  Sparkles,
  ListTree,
  Users,
  ChevronLeft,
  ChevronRight,
  Settings,
} from "lucide-react";
import {
  addDays,
  addMonths,
  addWeeks,
  endOfWeek,
  format,
  formatISO,
  startOfWeek,
  subMonths,
  subWeeks,
} from "date-fns";
import { nb } from "date-fns/locale";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { PageTabNav } from "@/components/dashboard/PageTabNav";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { SkeletonCard, withEntrance } from "@smartout/ui";
import dynamic from "next/dynamic";
import { ScheduleUIProvider } from "@/app/dashboard/schedule/_components/schedule-ui-context";
import { DayControlSheet, DayControlPanel } from "@/app/dashboard/schedule/_components/day-control";
import { CalendarTab, type ViewMode } from "./CalendarTab";
import { EventsTab } from "./EventsTab";
import { BookingsTab } from "./BookingsTab";
import { EventSheet } from "./EventSheet";
import { BookingSheet } from "./BookingSheet";
import { CalendarSettingsSheet } from "./CalendarSettingsSheet";
import { CalendarToolsBridge } from "../_tools/calendar-tools-bridge";
import { useCalendarBookings, useCalendarEvents, useCalendarSettings } from "../_lib/store";
import type { Booking, CalendarEvent } from "../_lib/types";
import { useCompanyHours } from "@/app/dashboard/website/_hooks/use-company-hours";
import { useCalendarOverlays } from "../_hooks/use-calendar-overlays";

const tabLoading = () => <SkeletonCard className="min-h-96" />;

const YearWheelLazy = dynamic(
  () =>
    import("../../year-wheel/year-wheel-page-client").then((m) => ({
      default: withEntrance(m.YearWheelPageClient),
    })),
  { ssr: false, loading: tabLoading },
);

const TABS = [
  { value: "calendar", label: "Kalender", icon: CalendarDays },
  { value: "year-wheel", label: "Årshjul", icon: Sparkles },
  { value: "events", label: "Eventer", icon: ListTree },
  { value: "bookings", label: "Bookinger", icon: Users },
] as const;

const WEEK_OPTS = { weekStartsOn: 1 as const, locale: nb };

export function CalendarPageShell() {
  const [activeTab, setActiveTab] = useState<string>("calendar");
  const [view, setView] = useState<ViewMode>("week");
  const [cursor, setCursor] = useState<Date>(new Date());
  const reduce = useReducedMotion();

  const { events, upsertEvent, deleteEvent } = useCalendarEvents();
  const { bookings, upsertBooking, deleteBooking } = useCalendarBookings();
  const { settings, setSettings } = useCalendarSettings();
  const { hours: companyHours } = useCompanyHours();

  // Overlay window — YYYY-MM-DD bounds of the visible week so useCalendarOverlays
  // can scope both the shift query and the holiday-entry filter to the current cursor.
  const overlayWindow = useMemo(
    () => ({
      weekStart: formatISO(startOfWeek(cursor, WEEK_OPTS), { representation: "date" }),
      weekEnd: formatISO(endOfWeek(cursor, WEEK_OPTS), { representation: "date" }),
    }),
    [cursor],
  );

  const overlays = useCalendarOverlays(overlayWindow);

  const [eventSheetOpen, setEventSheetOpen] = useState(false);
  const [eventDraft, setEventDraft] = useState<Partial<CalendarEvent> | null>(null);

  const [bookingSheetOpen, setBookingSheetOpen] = useState(false);
  const [bookingDraft, setBookingDraft] = useState<Partial<Booking> | null>(null);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [selectedDayISO, setSelectedDayISO] = useState<string | null>(null);

  const handleDayOpen = useCallback((date: Date) => {
    // Local-tz YYYY-MM-DD — toISOString() converts to UTC and shifts dates
    // by one day during Norwegian summer time / nighttime hours.
    setSelectedDayISO(formatISO(date, { representation: "date" }));
  }, []);
  const handleDayClose = useCallback(() => setSelectedDayISO(null), []);

  const router = useRouter();
  const searchParams = useSearchParams();
  const newAction = searchParams?.get("new");

  useEffect(() => {
    // One-shot tab deep-link — consumed from ?tab=<value> then cleared.
    // Used by /dashboard/planning/arshjul etc. shim redirects.
    const tabParam = searchParams?.get("tab");
    const VALID_TABS = ["calendar", "year-wheel", "events", "bookings"] as const;
    if (tabParam && (VALID_TABS as readonly string[]).includes(tabParam)) {
      setActiveTab(tabParam);
      router.replace("/dashboard/planning", { scroll: false });
    }

    // Legacy action params — unchanged.
    if (newAction === "event") {
      setEventDraft({
        date: formatISO(new Date(), { representation: "date" }),
        startHour: 9,
        endHour: 10,
      });
      setEventSheetOpen(true);
      router.replace("/dashboard/calendar", { scroll: false });
    } else if (newAction === "booking") {
      setBookingDraft(null);
      setBookingSheetOpen(true);
      router.replace("/dashboard/calendar", { scroll: false });
    }
  }, [newAction, router, searchParams]);

  const visibleEvents = useMemo(() => {
    return events.filter((e) => {
      if (e.source === "google" && !settings.show.googleEvents) return false;
      if (e.source !== "google" && !settings.show.events) return false;
      return true;
    });
  }, [events, settings.show.events, settings.show.googleEvents]);

  const isCalendar = activeTab === "calendar";

  const handlePrev = useCallback(() => {
    setCursor((d) =>
      view === "month" ? subMonths(d, 1) : view === "week" ? subWeeks(d, 1) : addDays(d, -1),
    );
  }, [view]);
  const handleNext = useCallback(() => {
    setCursor((d) =>
      view === "month" ? addMonths(d, 1) : view === "week" ? addWeeks(d, 1) : addDays(d, 1),
    );
  }, [view]);
  const handleToday = useCallback(() => setCursor(new Date()), []);

  const headerLabel = useMemo(() => {
    if (view === "day") return format(cursor, "EEEE d. MMMM yyyy", { locale: nb });
    if (view === "week") {
      const start = startOfWeek(cursor, WEEK_OPTS);
      const end = endOfWeek(cursor, WEEK_OPTS);
      return `${format(start, "d. MMM", { locale: nb })} – ${format(end, "d. MMM yyyy", { locale: nb })}`;
    }
    return format(cursor, "MMMM yyyy", { locale: nb });
  }, [view, cursor]);

  const openNewEvent = useCallback((date?: Date, hour?: number) => {
    setEventDraft({
      date: formatISO(date ?? new Date(), { representation: "date" }),
      startHour: hour ?? 9,
      endHour: (hour ?? 9) + 1,
    });
    setEventSheetOpen(true);
  }, []);

  const openExistingEvent = useCallback((event: CalendarEvent) => {
    setEventDraft(event);
    setEventSheetOpen(true);
  }, []);

  const openNewBooking = useCallback(() => {
    setBookingDraft(null);
    setBookingSheetOpen(true);
  }, []);

  const openExistingBooking = useCallback((booking: Booking) => {
    setBookingDraft(booking);
    setBookingSheetOpen(true);
  }, []);

  // Memoised on `reduce` — recreating these objects every render passes new references
  // to framer-motion, which re-evaluates variants on each cursor change unnecessarily.
  const tabFade = useMemo(
    () =>
      reduce
        ? { initial: false as const, animate: { opacity: 1 } }
        : {
            initial: { opacity: 0, y: 6 },
            animate: { opacity: 1, y: 0 },
            exit: { opacity: 0, y: -6 },
            transition: {
              duration: motionTokens.exitMs / 1000,
              ease: motionTokens.easingExpoArray,
            },
          },
    [reduce],
  );

  const controlsFade = useMemo(
    () =>
      reduce
        ? { initial: false as const, animate: { opacity: 1 } }
        : {
            initial: { opacity: 0, x: 8 },
            animate: { opacity: 1, x: 0 },
            exit: { opacity: 0, x: 8 },
            transition: { type: "spring" as const, ...motionTokens.springSnappy },
          },
    [reduce],
  );

  return (
    <ScheduleUIProvider>
      <>
        {/* Botsson harness — calendar read + nav + propose tools.
        Mount-bound: tools are unregistered automatically on route leave. */}
        <CalendarToolsBridge
          cursor={cursor}
          view={view}
          activeTab={activeTab}
          visibleEvents={visibleEvents}
          allEvents={events}
          bookings={bookings}
          settings={settings}
          uiActions={{
            openNewEvent,
            openNewBooking,
            setCursor,
            setView,
            setActiveTab,
            openDayInDayControl: handleDayOpen,
          }}
        />

        <div className="flex min-h-0 flex-1 flex-col">
          {/* Page Header */}
          <div className="mb-5 flex items-end justify-between gap-4">
            <div>
              <h1 className="font-heading text-foreground text-3xl leading-tight tracking-tight">
                Kalender
              </h1>
              <p className="text-muted-foreground mt-1 text-sm">
                Datoer, sesonger, eventer og bookinger på ett sted
              </p>
            </div>

            <div className="flex items-center gap-2">
              <AnimatePresence mode="wait" initial={false}>
                {isCalendar ? (
                  <motion.div
                    key="calendar-controls"
                    {...controlsFade}
                    className="flex items-center gap-2"
                  >
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-lg"
                      onClick={handleToday}
                    >
                      I dag
                    </Button>
                    <div className="flex items-center">
                      <Button size="icon" variant="ghost" onClick={handlePrev} aria-label="Forrige">
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={handleNext} aria-label="Neste">
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" size="sm" className="gap-2 rounded-lg">
                          <CalendarDays className="h-4 w-4" />
                          <span className="text-foreground text-sm font-semibold capitalize">
                            {headerLabel}
                          </span>
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent align="end" className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={cursor}
                          onSelect={(d) => d && setCursor(d)}
                        />
                      </PopoverContent>
                    </Popover>
                    <ViewToggle view={view} setView={setView} />
                  </motion.div>
                ) : null}
              </AnimatePresence>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => setSettingsOpen(true)}
                aria-label="Innstillinger"
              >
                <Settings className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Tabs */}
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="flex min-h-0 flex-1 flex-col"
          >
            <PageTabNav
              tabs={TABS.map((tab) => ({ key: tab.value, label: tab.label, icon: tab.icon }))}
              active={activeTab}
              onChange={setActiveTab}
              className="mb-5"
              ariaLabel="Kalender-seksjoner"
            />

            <div className="min-h-0 flex-1 overflow-y-auto pr-1 pb-6">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div key={activeTab} {...tabFade}>
                  <TabsContent
                    value="calendar"
                    className="mt-0"
                    forceMount={isCalendar ? true : undefined}
                  >
                    {isCalendar ? (
                      <CalendarTab
                        view={view}
                        cursor={cursor}
                        events={visibleEvents}
                        companyHours={settings.show.openingHours ? companyHours : []}
                        shiftsByDate={overlays.shiftsByDate}
                        holidaysByDate={overlays.holidaysByDate}
                        showShifts={settings.show.shifts}
                        showHolidays={settings.show.holidays}
                        onEventClick={openExistingEvent}
                        onSlotClick={(d, h) => openNewEvent(d, h)}
                        onDayOpen={handleDayOpen}
                      />
                    ) : null}
                  </TabsContent>

                  <TabsContent value="year-wheel" className="mt-0">
                    {activeTab === "year-wheel" ? <YearWheelLazy /> : null}
                  </TabsContent>

                  <TabsContent value="events" className="mt-0">
                    {activeTab === "events" ? (
                      <EventsTab
                        events={events}
                        onAdd={() => openNewEvent()}
                        onOpen={openExistingEvent}
                      />
                    ) : null}
                  </TabsContent>

                  <TabsContent value="bookings" className="mt-0">
                    {activeTab === "bookings" ? (
                      <BookingsTab
                        bookings={bookings}
                        onAdd={openNewBooking}
                        onOpen={openExistingBooking}
                      />
                    ) : null}
                  </TabsContent>
                </motion.div>
              </AnimatePresence>
            </div>
          </Tabs>

          <EventSheet
            open={eventSheetOpen}
            onOpenChange={setEventSheetOpen}
            initial={eventDraft}
            onSave={upsertEvent}
            onDelete={deleteEvent}
          />

          <BookingSheet
            open={bookingSheetOpen}
            onOpenChange={setBookingSheetOpen}
            initial={bookingDraft}
            onSave={upsertBooking}
            onDelete={deleteBooking}
          />

          <CalendarSettingsSheet
            open={settingsOpen}
            onOpenChange={setSettingsOpen}
            settings={settings}
            onChange={setSettings}
          />
        </div>

        <DayControlSheet selectedDate={selectedDayISO} onClose={handleDayClose}>
          <DayControlPanel date={selectedDayISO} onClose={handleDayClose} />
        </DayControlSheet>
      </>
    </ScheduleUIProvider>
  );
}

function ViewToggle({ view, setView }: { view: ViewMode; setView: (v: ViewMode) => void }) {
  const reduce = useReducedMotion();
  const items: { value: ViewMode; label: string }[] = [
    { value: "day", label: "Dag" },
    { value: "week", label: "Uke" },
    { value: "month", label: "Måned" },
  ];
  return (
    <div className="border-border bg-muted/60 inline-flex items-center gap-1 rounded-lg border p-1">
      {items.map((item) => {
        const active = view === item.value;
        return (
          <button
            key={item.value}
            onClick={() => setView(item.value)}
            className={`relative rounded-md px-3 py-1 text-xs font-semibold transition-colors ${
              active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {active ? (
              <motion.span
                layoutId="calendar-view-toggle-pill"
                className="bg-background absolute inset-0 rounded-md shadow-sm"
                transition={
                  reduce ? { duration: 0 } : { type: "spring", ...motionTokens.springSnappy }
                }
              />
            ) : null}
            <span className="relative">{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}
