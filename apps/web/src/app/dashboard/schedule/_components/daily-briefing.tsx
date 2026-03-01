// ============================================
// daily-briefing.tsx
// Rich day detail panel (DayInspector) with 4 tabs:
// Oversikt, Dagsinfo (Meldinger), Selskap/Booking, Oppgaver.
// All tabs are wired to the schedule context for live state.
// Connected to: schedule-context.tsx (state + dispatch)
// Connected to: schedule-data.ts (dummyDays for dateId lookup)
// Connected to: booking-dialog.tsx (manual booking creation)
// ============================================
"use client";

import { useContext, useMemo, useState } from "react";
import {
  X,
  Info,
  MessageSquare,
  CalendarCheck,
  ListTodo,
  Briefcase,
  ChevronDown,
  Clock,
  Users,
  MapPin,
  Plus,
  Eye,
  Megaphone,
  MessageCircle,
  Mail,
  CheckSquare,
  AlertCircle,
  Trash2,
  Star,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

import { DashboardContext } from "@/components/dashboard/DashboardShell";
import type {
  Shift,
  Absence,
  DayMessage,
  DayTask,
  DayBooking,
  OpenShift,
  ShiftTemplate,
} from "./schedule-types";
import { useScheduleUI } from "./schedule-ui-context";
import { useShifts } from "../_hooks/use-shifts";
import { useAbsences } from "../_hooks/use-absences";
import { useOpenShifts } from "../_hooks/use-open-shifts";
import { useTemplates } from "../_hooks/use-templates";
import {
  useDayMessages,
  useCreateDayMessage,
  useDeleteDayMessage,
  useDayTasks,
  useCreateDayTask,
  useUpdateDayTaskStatus,
  useDeleteDayTask,
  useDayBookings,
} from "../_hooks/use-day-content";
import { useScheduleComputed } from "../_hooks/use-schedule-computed";
import { useWeekRange } from "../_hooks/use-week-range";
import { dummyDays, dummyEmployees } from "./schedule-data";
import { BookingDialog } from "./booking-dialog";
import type { TaskStatus } from "./schedule-types";

// ── Helper: resolve dateId from the display label ────────────

/**
 * Maps a display label (e.g. "Man 22/12") to the corresponding
 * dateId in dummyDays (e.g. "d1"). Returns null if not found.
 */
function resolveDateId(dateLabel: string | null): string | null {
  if (!dateLabel) return null;
  const match = dummyDays.find((d) => d.label === dateLabel);
  return match?.id ?? null;
}

// ── Helper: format NOK currency ──────────────────────────────

/**
 * Formats a number as Norwegian kroner string.
 * Example: 14350 → "14 350 kr"
 */
function formatNok(amount: number): string {
  return `${amount.toLocaleString("nb-NO")} kr`;
}

// ── Helper: format work hours ────────────────────────────────

/**
 * Formats decimal hours into "Xt Ym" display.
 * Example: 8.5 → "8t 30m"
 */
function formatHours(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (m === 0) return `${h}t`;
  return `${h}t ${m}m`;
}

// ── Helper: cycle task status ────────────────────────────────

/**
 * Returns the next status in the cycle: pending → in_progress → completed.
 */
function nextTaskStatus(current: TaskStatus): TaskStatus {
  switch (current) {
    case "pending":
      return "in_progress";
    case "in_progress":
      return "completed";
    case "completed":
      return "pending";
    default:
      return "pending";
  }
}

// ---------------------------------------------------------------------------
// DailyBriefingPanel — rich day detail panel (no DnD interaction)
// ---------------------------------------------------------------------------
export function DailyBriefingPanel({
  date,
  onClose,
}: {
  date: string | null;
  onClose: () => void;
}) {
  const { isDark } = useContext(DashboardContext);
  const [activeTab, setActiveTab] = useState<"oversikt" | "meldinger" | "bookings" | "oppgaver">(
    "oversikt",
  );

  // Resolve the dateId from the label string
  const dateId = useMemo(() => resolveDateId(date), [date]);

  if (!date) return null;

  return (
    <div className="relative flex h-full w-full flex-col">
      {/* Header */}
      <div
        className={`shrink-0 border-b ${isDark ? "border-white/10" : "border-zinc-300"} bg-gradient-to-r from-[#0a0a0c]/40 to-orange-500/[0.02]`}
      >
        <div className="p-5 pb-3">
          <div className="mb-4 flex items-start justify-between">
            <div className="flex flex-col">
              <span className="mb-0.5 text-[10px] font-bold tracking-widest text-orange-400 uppercase">
                Kontrollsenter for dag
              </span>
              <h2
                className={`text-xl font-black ${isDark ? "text-white" : "text-zinc-900"} tracking-tight`}
              >
                {date}
              </h2>
            </div>
            <button
              onClick={onClose}
              className={`p-2 text-zinc-400 hover:text-white ${isDark ? "hover:bg-white/10" : "hover:bg-zinc-200"} rounded-xl transition-all`}
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1 lg:gap-4">
            <TabButton
              active={activeTab === "oversikt"}
              onClick={() => setActiveTab("oversikt")}
              icon={<Info className="h-3.5 w-3.5" />}
              label="Oversikt"
            />
            <TabButton
              active={activeTab === "meldinger"}
              onClick={() => setActiveTab("meldinger")}
              icon={<MessageSquare className="h-3.5 w-3.5" />}
              label="Dagsinfo"
            />
            <TabButton
              active={activeTab === "bookings"}
              onClick={() => setActiveTab("bookings")}
              icon={<CalendarCheck className="h-3.5 w-3.5" />}
              label="Selskap / Booking"
            />
            <TabButton
              active={activeTab === "oppgaver"}
              onClick={() => setActiveTab("oppgaver")}
              icon={<ListTodo className="h-3.5 w-3.5" />}
              label="Oppgaver"
            />
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {activeTab === "oversikt" && <OversiktTab isDark={isDark} dateId={dateId} />}
        {activeTab === "meldinger" && <MeldingerTab isDark={isDark} dateId={dateId} />}
        {activeTab === "bookings" && <BookingsTab isDark={isDark} dateId={dateId} />}
        {activeTab === "oppgaver" && <OppgaverTab isDark={isDark} dateId={dateId} />}
      </div>

      {/* Footer Broadcast Action */}
      <FooterBroadcast isDark={isDark} dateId={dateId} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Footer Broadcast
// ---------------------------------------------------------------------------

/**
 * Footer with "Push Vakt" and "SMS" broadcast buttons.
 * Staff count comes from the schedule context.
 */
function FooterBroadcast({ isDark, dateId }: { isDark: boolean; dateId: string | null }) {
  const { weekStart, weekEnd } = useWeekRange();
  const { data: shifts = [] as Shift[] } = useShifts(weekStart, weekEnd);
  const staffCount = dateId
    ? new Set(
        shifts
          .filter((s) => s.dateId === dateId)
          .map((s) => s.employeeId)
          .filter(Boolean),
      ).size
    : 0;

  return (
    <div className={`border-t border-white/10 p-5 ${isDark ? "bg-[#0a0a0c]" : "bg-white"}`}>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-1.5 text-[11px] font-bold tracking-widest text-zinc-500 uppercase">
          <Megaphone className="h-3.5 w-3.5" /> Kringkast til alle på vakt
        </h3>
        <span className="text-[10px] font-medium text-zinc-600">{staffCount} ansatte</span>
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => toast(`Push-varsler sendt til ${staffCount} ansatte`)}
          className={`flex flex-1 items-center justify-center gap-2 bg-white/5 ${isDark ? "hover:bg-white/10" : "hover:bg-zinc-200"} rounded-xl border border-white/10 py-2.5 text-xs font-bold text-white transition-all hover:border-white/20`}
        >
          <MessageCircle className="h-4 w-4 text-blue-400" /> Push Vakt
        </button>
        <button
          onClick={() => toast(`SMS sendt til ${staffCount} ansatte`)}
          className={`flex flex-1 items-center justify-center gap-2 bg-white/5 ${isDark ? "hover:bg-white/10" : "hover:bg-zinc-200"} rounded-xl border border-white/10 py-2.5 text-xs font-bold text-white transition-all hover:border-white/20`}
        >
          <Mail className="h-4 w-4 text-orange-400" /> SMS
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Oversikt Tab
// ---------------------------------------------------------------------------

/**
 * Overview tab showing shift manager and key metrics from context state.
 */
function OversiktTab({ isDark, dateId }: { isDark: boolean; dateId: string | null }) {
  const { weekStart, weekEnd } = useWeekRange();
  const { data: shifts = [] as Shift[] } = useShifts(weekStart, weekEnd);
  const { data: absences = [] as Absence[] } = useAbsences(weekStart, weekEnd);
  const { data: openShiftsData = [] as OpenShift[] } = useOpenShifts();
  const { data: templates = [] as ShiftTemplate[] } = useTemplates();
  const { data: dayMessages = [] as DayMessage[] } = useDayMessages(weekStart, weekEnd);
  const { data: dayTasks = [] as DayTask[] } = useDayTasks(weekStart, weekEnd);
  const { data: dayBookings = [] as DayBooking[] } = useDayBookings(weekStart, weekEnd);
  const { setSelectedShift } = useScheduleUI();

  const computed = useScheduleComputed(
    shifts,
    absences,
    openShiftsData.length,
    templates,
    dayMessages,
    dayTasks,
    dayBookings,
  );

  // Get stats and shifts for this day from computed
  const stats = dateId ? computed.getDayStats(dateId) : null;
  const dayShifts = dateId ? computed.getShiftsForDay(dateId) : [];

  // Find the manager shift (role includes "Manager" or is the first purple indicator)
  const managerShift = dayShifts.find(
    (s) => s.role.toLowerCase().includes("manager") || s.indicator === "purple",
  );

  // Resolve manager name from employees
  const managerEmployee = managerShift?.employeeId
    ? dummyEmployees.find((e) => e.id === managerShift.employeeId)
    : null;

  // Calculate total work hours from all shifts for this day
  const totalWorkHours = dayShifts.reduce((sum, s) => sum + s.workHours, 0);

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 space-y-8">
      {/* Vaktansvarlig section */}
      <section>
        <div className="mb-3 flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-md border border-purple-500/30 bg-purple-500/20 text-purple-400">
            <Briefcase className="h-3.5 w-3.5" />
          </div>
          <h3 className={`text-sm font-bold ${isDark ? "text-white" : "text-zinc-900"}`}>
            Vaktansvarlig
          </h3>
        </div>
        {managerEmployee && managerShift ? (
          <div
            onClick={() => setSelectedShift(managerShift.id)}
            className={`p-4 ${isDark ? "bg-white/5" : "bg-zinc-100"} group flex cursor-pointer items-center justify-between rounded-2xl border border-white/10 transition-colors hover:border-white/20`}
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full border border-purple-500/30 bg-purple-500/20 text-xs font-black text-purple-400">
                {managerEmployee.initials}
              </div>
              <div className="flex flex-col">
                <span
                  className={`text-sm font-bold ${isDark ? "text-white" : "text-zinc-900"} transition-colors group-hover:text-purple-400`}
                >
                  {managerEmployee.name}
                </span>
                <span className="text-[10px] font-bold tracking-widest text-zinc-500 uppercase">
                  {managerShift.role} &bull; {managerShift.time}
                </span>
              </div>
            </div>
            <ChevronDown className="h-4 w-4 text-zinc-600" />
          </div>
        ) : (
          <div
            className={`p-4 ${isDark ? "bg-white/5" : "bg-zinc-100"} rounded-2xl border border-white/10`}
          >
            <span className="text-xs text-zinc-500">Ingen vaktansvarlig tildelt</span>
          </div>
        )}
      </section>

      {/* Key metrics section */}
      <section>
        <h3 className={`text-sm font-bold ${isDark ? "text-white" : "text-zinc-900"} mb-3`}>
          Dagens nøkkeltall
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <div
            className={`rounded-xl border p-4 ${isDark ? "border-white/10 bg-white/5" : "border-zinc-200 bg-zinc-50"}`}
          >
            <span className="text-[10px] font-bold tracking-widest text-zinc-500 uppercase">
              Est. Kostnad
            </span>
            <div className={`text-lg font-black ${isDark ? "text-white" : "text-zinc-900"} mt-1`}>
              {stats ? formatNok(stats.estimatedCost) : "—"}
            </div>
          </div>
          <div
            className={`rounded-xl border p-4 ${isDark ? "border-white/10 bg-white/5" : "border-zinc-200 bg-zinc-50"}`}
          >
            <span className="text-[10px] font-bold tracking-widest text-zinc-500 uppercase">
              Totale Timer
            </span>
            <div className={`text-lg font-black ${isDark ? "text-white" : "text-zinc-900"} mt-1`}>
              {formatHours(totalWorkHours)}
            </div>
          </div>
          <div
            className={`rounded-xl border p-4 ${isDark ? "border-white/10 bg-white/5" : "border-zinc-200 bg-zinc-50"}`}
          >
            <span className="text-[10px] font-bold tracking-widest text-zinc-500 uppercase">
              Ansatte
            </span>
            <div className={`text-lg font-black ${isDark ? "text-white" : "text-zinc-900"} mt-1`}>
              {stats?.staffCount ?? 0}
            </div>
          </div>
          <div
            className={`rounded-xl border p-4 ${isDark ? "border-white/10 bg-white/5" : "border-zinc-200 bg-zinc-50"}`}
          >
            <span className="text-[10px] font-bold tracking-widest text-zinc-500 uppercase">
              Vakter
            </span>
            <div className={`text-lg font-black ${isDark ? "text-white" : "text-zinc-900"} mt-1`}>
              {stats?.shiftCount ?? 0}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Meldinger Tab (Dagsinfo)
// ---------------------------------------------------------------------------

/**
 * Day messages tab with form for creating new messages
 * and a list of active messages from context.
 */
function MeldingerTab({ isDark, dateId }: { isDark: boolean; dateId: string | null }) {
  const { weekStart, weekEnd } = useWeekRange();
  const { data: dayMessagesData = [] as DayMessage[] } = useDayMessages(weekStart, weekEnd);
  const createDayMessage = useCreateDayMessage(weekStart);
  const deleteDayMessage = useDeleteDayMessage(weekStart);

  // Form state
  const [content, setContent] = useState("");
  const [audience, setAudience] = useState<"all" | "leaders" | string>("all");
  const [visibility, setVisibility] = useState<"all_day" | "until_16" | "permanent">("all_day");

  // Get messages for this day from query data
  const messages = dateId ? dayMessagesData.filter((m) => m.dateId === dateId) : [];

  /**
   * Publishes a new day message via dispatch.
   * Validates that content is not empty and dateId is set.
   */
  function handlePublish() {
    if (!dateId) return;
    if (!content.trim()) {
      toast.error("Skriv en beskjed først");
      return;
    }

    createDayMessage.mutate({
      id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      dateId,
      title: content.trim().slice(0, 50),
      content: content.trim(),
      audience,
      visibility,
      author: "Du",
      isAlert: false,
    });

    toast.success("Oppslag publisert");
    setContent("");
  }

  /**
   * Maps audience values to display labels.
   */
  function audienceLabel(value: string): string {
    switch (value) {
      case "all":
        return "Alle";
      case "leaders":
        return "Kun Ledere";
      default:
        return value;
    }
  }

  /**
   * Maps visibility values to display labels.
   */
  function visibilityLabel(value: string): string {
    switch (value) {
      case "all_day":
        return "Hele dagen";
      case "until_16":
        return "Frem til 16:00";
      case "permanent":
        return "Permanent oppslag";
      default:
        return value;
    }
  }

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 space-y-6">
      {/* New message form */}
      <div
        className={`rounded-2xl border p-4 ${isDark ? "border-white/10 bg-white/5" : "border-zinc-200 bg-white shadow-sm"}`}
      >
        <h4 className={`text-xs font-bold ${isDark ? "text-white" : "text-zinc-900"} mb-2`}>
          Nytt oppslag
        </h4>
        <textarea
          placeholder="Skriv beskjed til ansatte her..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className={`h-24 w-full border bg-transparent ${isDark ? "border-white/10" : "border-zinc-300"} mb-3 block resize-none rounded-xl p-3 text-xs focus:border-blue-500/50 focus:outline-none`}
        />
        <div className="flex flex-col justify-between gap-2 md:flex-row md:items-center">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 rounded-lg p-1.5 focus-within:ring-1 focus-within:ring-white/20">
              <Eye className="h-3.5 w-3.5 text-zinc-400" />
              <select
                value={audience}
                onChange={(e) => setAudience(e.target.value)}
                className="cursor-pointer bg-transparent text-[11px] font-bold text-zinc-300 outline-none"
              >
                <option value="all">Alle På Vakt</option>
                <option value="leaders">Kun Ledere</option>
                <option value="Servering">Servering (Team)</option>
              </select>
            </div>
            <div className="hidden h-4 w-px bg-white/10 md:block" />
            <div className="flex items-center gap-1.5 rounded-lg p-1.5 focus-within:ring-1 focus-within:ring-white/20">
              <Clock className="h-3.5 w-3.5 text-zinc-400" />
              <select
                value={visibility}
                onChange={(e) => setVisibility(e.target.value as typeof visibility)}
                className="cursor-pointer bg-transparent text-[11px] font-bold text-zinc-300 outline-none"
              >
                <option value="all_day">Hele dagen</option>
                <option value="until_16">Frem til 16:00</option>
                <option value="permanent">Permanent oppslag</option>
              </select>
            </div>
          </div>
          <button
            onClick={handlePublish}
            className="rounded-lg border border-blue-500/30 bg-blue-500/20 px-3 py-1.5 text-[10px] font-bold text-blue-400 transition-all hover:bg-blue-500/30"
          >
            Publiser
          </button>
        </div>
      </div>

      {/* Active messages list */}
      <div className="space-y-3">
        <h4
          className={`text-xs font-bold ${isDark ? "text-zinc-500" : "text-zinc-400"} tracking-widest uppercase`}
        >
          Aktive Oppslag ({messages.length})
        </h4>
        {messages.length === 0 ? (
          <p className="py-4 text-center text-xs text-zinc-500">Ingen oppslag for denne dagen</p>
        ) : (
          messages.map((msg) => (
            <MessageCard
              key={msg.id}
              title={msg.title}
              audience={audienceLabel(msg.audience)}
              author={msg.author}
              time={visibilityLabel(msg.visibility)}
              content={msg.content}
              alert={msg.isAlert}
              onDelete={() => {
                deleteDayMessage.mutate(msg.id);
                toast("Oppslag slettet");
              }}
            />
          ))
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Bookings Tab
// ---------------------------------------------------------------------------

/**
 * Bookings tab showing reservations from context.
 * Includes inline detail expansion and a dialog for adding new bookings.
 */
function BookingsTab({ isDark, dateId }: { isDark: boolean; dateId: string | null }) {
  const { weekStart, weekEnd } = useWeekRange();
  const { data: dayBookingsData = [] as DayBooking[] } = useDayBookings(weekStart, weekEnd);
  const [bookingDialogOpen, setBookingDialogOpen] = useState(false);
  const [expandedBookingId, setExpandedBookingId] = useState<string | null>(null);

  // Get bookings for this day from query data
  const bookings = dateId ? dayBookingsData.filter((b) => b.dateId === dateId) : [];

  /**
   * Maps booking status to display badge styling.
   */
  function statusBadge(status: string, isVip: boolean) {
    switch (status) {
      case "confirmed":
        return (
          <span className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
            Bekreftet{isVip ? " \u2022 VIP" : ""}
          </span>
        );
      case "pending":
        return (
          <span className="rounded-lg border border-white/20 bg-white/10 px-2 py-0.5 text-[10px] font-bold text-zinc-400">
            Avventer{isVip ? " \u2022 VIP" : ""}
          </span>
        );
      case "cancelled":
        return (
          <span className="rounded-lg border border-rose-500/20 bg-rose-500/10 px-2 py-0.5 text-[10px] font-bold text-rose-400">
            Kansellert{isVip ? " \u2022 VIP" : ""}
          </span>
        );
      default:
        return null;
    }
  }

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 space-y-5">
      <div className="flex items-center justify-between">
        <h4
          className={`text-xs font-bold ${isDark ? "text-zinc-400" : "text-zinc-500"} tracking-widest uppercase`}
        >
          Reservasjoner og Selskap ({bookings.length})
        </h4>
        <button
          onClick={() => setBookingDialogOpen(true)}
          className="flex items-center gap-1 text-[10px] font-bold text-orange-400 hover:text-orange-300"
        >
          <Plus className="h-3.5 w-3.5" /> Legg til manuelt
        </button>
      </div>

      {bookings.length === 0 ? (
        <p className="py-8 text-center text-xs text-zinc-500">Ingen bookinger for denne dagen</p>
      ) : (
        <div className="space-y-3">
          {bookings.map((booking) => {
            const isExpanded = expandedBookingId === booking.id;

            return (
              <div
                key={booking.id}
                className={`p-4 ${isDark ? "border border-white/10 bg-white/5 hover:border-white/20" : "border bg-white text-zinc-900 shadow-sm hover:border-zinc-300"} rounded-xl transition-colors`}
              >
                <div className="mb-2 flex justify-between">
                  <span className="flex items-center gap-2 text-sm font-bold">
                    <Users className="h-4 w-4 text-orange-400" /> {booking.title}
                    {booking.isVip && <Star className="h-3.5 w-3.5 text-amber-400" />}
                  </span>
                  {statusBadge(booking.status, booking.isVip)}
                </div>
                <p className="mb-3 text-xs font-medium text-zinc-500">
                  {booking.guestCount} Personer &bull; {booking.menu}
                </p>
                <div className="flex items-center justify-between border-t border-white/5 pt-3">
                  <div className="flex gap-4 text-[10px] font-bold text-zinc-400">
                    <span className="flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5 text-zinc-500" /> {booking.time}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5 text-zinc-500" /> {booking.location}
                    </span>
                  </div>
                  <button
                    onClick={() => setExpandedBookingId(isExpanded ? null : booking.id)}
                    className="text-[10px] font-bold text-blue-400 hover:text-blue-300"
                  >
                    {isExpanded ? "Skjul detaljer" : "Se detaljer"}
                  </button>
                </div>

                {/* Expanded detail section */}
                {isExpanded && (
                  <div className="mt-3 space-y-2 border-t border-white/5 pt-3">
                    {booking.contactPerson && (
                      <div className="text-[10px] text-zinc-400">
                        <span className="font-bold text-zinc-500">Kontakt:</span>{" "}
                        {booking.contactPerson}
                      </div>
                    )}
                    {booking.notes && (
                      <div className="text-[10px] text-zinc-400">
                        <span className="font-bold text-zinc-500">Notater:</span> {booking.notes}
                      </div>
                    )}
                    {!booking.contactPerson && !booking.notes && (
                      <p className="text-[10px] text-zinc-500">Ingen tilleggsinformasjon</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Booking creation dialog */}
      {dateId && (
        <BookingDialog
          dateId={dateId}
          open={bookingDialogOpen}
          onOpenChange={setBookingDialogOpen}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Oppgaver Tab
// ---------------------------------------------------------------------------

/**
 * Tasks tab with inline creation, category filters, status toggling,
 * and task deletion. All data from schedule context.
 */
function OppgaverTab({ isDark, dateId }: { isDark: boolean; dateId: string | null }) {
  const { weekStart, weekEnd } = useWeekRange();
  const { data: dayTasksData = [] as DayTask[] } = useDayTasks(weekStart, weekEnd);
  const createDayTask = useCreateDayTask(weekStart);
  const updateDayTaskStatus = useUpdateDayTaskStatus(weekStart);
  const deleteDayTask = useDeleteDayTask(weekStart);

  // Local state for task creation and filtering
  const [newTaskLabel, setNewTaskLabel] = useState("");
  const [filter, setFilter] = useState<"all" | "routine" | "delegated">("all");

  // Get tasks for this day from query data, filtered by category
  const allTasks = dateId ? dayTasksData.filter((t) => t.dateId === dateId) : [];
  const filteredTasks = filter === "all" ? allTasks : allTasks.filter((t) => t.category === filter);

  // Compute completion stats
  const completedCount = allTasks.filter((t) => t.status === "completed").length;
  const totalCount = allTasks.length;

  // Category counts for filter chips
  const routineCount = allTasks.filter((t) => t.category === "routine").length;
  const delegatedCount = allTasks.filter((t) => t.category === "delegated").length;

  /**
   * Adds a new task via dispatch. Defaults to "all" category and "pending" status.
   */
  function handleAddTask() {
    if (!dateId) return;
    if (!newTaskLabel.trim()) {
      toast.error("Skriv et oppgavenavn");
      return;
    }

    createDayTask.mutate({
      id: `task_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      dateId,
      label: newTaskLabel.trim(),
      status: "pending",
      category: "all",
      highlight: false,
    });

    toast.success("Oppgave lagt til");
    setNewTaskLabel("");
  }

  /**
   * Returns the CSS class and icon for a given task status.
   */
  function statusIcon(status: TaskStatus) {
    switch (status) {
      case "completed":
        return {
          icon: <CheckSquare className="h-3.5 w-3.5" />,
          classes: "border-emerald-500 bg-emerald-500 text-[#050505]",
        };
      case "in_progress":
        return {
          icon: <Loader2 className="h-3.5 w-3.5 animate-spin" />,
          classes: "border-blue-500 bg-blue-500/20 text-blue-400",
        };
      default:
        return {
          icon: <CheckSquare className="h-3.5 w-3.5" />,
          classes: "border-zinc-600 text-transparent hover:border-orange-500",
        };
    }
  }

  return (
    <section className="animate-in fade-in slide-in-from-bottom-2">
      <div className="mb-4 flex items-center justify-between">
        <h3
          className={`text-xs font-bold ${isDark ? "text-zinc-500" : "text-zinc-400"} tracking-widest uppercase`}
        >
          Gjøremål &amp; Rutiner
        </h3>
        <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
          {completedCount} / {totalCount} Utført
        </span>
      </div>
      <div className="space-y-2">
        {/* New task input */}
        <div className="mb-4 flex gap-2">
          <input
            type="text"
            placeholder="Planlegg nytt gjøremål for dagen..."
            value={newTaskLabel}
            onChange={(e) => setNewTaskLabel(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAddTask();
            }}
            className={`flex-1 ${isDark ? "border-white/10 bg-white/5 text-white placeholder:text-zinc-600" : "border-zinc-200 bg-white text-zinc-900 placeholder:text-zinc-400"} rounded-xl border p-3 text-xs shadow-inner focus:border-orange-500/50 focus:outline-none`}
          />
          <button
            onClick={handleAddTask}
            className="flex items-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/20 px-3 text-xs font-bold text-emerald-500 transition-all hover:bg-emerald-500/30 md:px-4"
          >
            <Plus className="h-3.5 w-3.5" /> Legg til
          </button>
        </div>

        {/* Filter chips */}
        <div className="no-scrollbar mb-5 flex gap-1.5 overflow-x-auto pb-1">
          <span
            onClick={() => setFilter("all")}
            className={`shrink-0 cursor-pointer rounded-lg px-2 py-1.5 text-[9px] font-bold transition-colors ${
              filter === "all"
                ? isDark
                  ? "bg-zinc-800 text-white"
                  : "bg-zinc-200 text-zinc-900"
                : `border bg-transparent text-zinc-500 ${isDark ? "border-white/10" : "border-zinc-300"}`
            } hover:bg-orange-500/20 hover:text-orange-400`}
          >
            Alle oppgaver
          </span>
          <span
            onClick={() => setFilter("routine")}
            className={`shrink-0 cursor-pointer rounded-lg px-2 py-1.5 text-[9px] font-bold transition-colors ${
              filter === "routine"
                ? isDark
                  ? "bg-zinc-800 text-white"
                  : "bg-zinc-200 text-zinc-900"
                : `border bg-transparent text-zinc-500 ${isDark ? "border-white/10" : "border-zinc-300"}`
            } hover:border-orange-500/50`}
          >
            Faste Rutiner ({routineCount})
          </span>
          <span
            onClick={() => setFilter("delegated")}
            className={`shrink-0 cursor-pointer rounded-lg px-2 py-1.5 text-[9px] font-bold transition-colors ${
              filter === "delegated"
                ? isDark
                  ? "bg-zinc-800 text-white"
                  : "bg-zinc-200 text-zinc-900"
                : `border bg-transparent text-zinc-500 ${isDark ? "border-white/10" : "border-zinc-300"}`
            } hover:border-orange-500/50`}
          >
            Delegert ({delegatedCount})
          </span>
        </div>

        {/* Task list */}
        {filteredTasks.length === 0 ? (
          <p className="py-4 text-center text-xs text-zinc-500">
            {filter === "all"
              ? "Ingen oppgaver for denne dagen"
              : "Ingen oppgaver i denne kategorien"}
          </p>
        ) : (
          filteredTasks.map((task) => {
            const { icon, classes } = statusIcon(task.status);
            const isDone = task.status === "completed";
            const isInProgress = task.status === "in_progress";

            const base = isDone
              ? `${isDark ? "border-white/5 bg-white/5 opacity-60" : "border-zinc-200 bg-zinc-100 opacity-60"}`
              : task.highlight
                ? `${isDark ? "border-orange-500/20 bg-orange-500/5" : "border-orange-200 bg-orange-50"}`
                : isInProgress
                  ? `${isDark ? "border-blue-500/20 bg-blue-500/5" : "border-blue-100 bg-blue-50"}`
                  : `${isDark ? "border-white/5 bg-[#0a0a0c]" : "border-zinc-200 bg-white"}`;

            return (
              <div
                key={task.id}
                className={`flex items-center gap-3 rounded-xl border p-3 transition-colors ${base}`}
              >
                {/* Status toggle button */}
                <button
                  onClick={() =>
                    updateDayTaskStatus.mutate({
                      id: task.id,
                      patch: { status: nextTaskStatus(task.status) },
                    })
                  }
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors ${classes}`}
                >
                  {icon}
                </button>

                {/* Task label */}
                <span
                  className={`truncate text-xs font-medium ${isDone ? "text-zinc-500 line-through" : "text-zinc-200"}`}
                >
                  {task.label}
                </span>

                {/* Highlight dot */}
                {task.highlight && (
                  <span className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.8)]" />
                )}

                {/* Delete button */}
                <button
                  onClick={() => {
                    deleteDayTask.mutate(task.id);
                    toast("Oppgave slettet");
                  }}
                  className="ml-auto shrink-0 text-zinc-600 transition-colors hover:text-rose-400"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Small reusable pieces
// ---------------------------------------------------------------------------

/**
 * Tab button for the header tab bar.
 * Highlights with orange when active.
 */
function TabButton({
  active,
  label,
  icon,
  onClick,
}: {
  active: boolean;
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  const { isDark } = useContext(DashboardContext);
  return (
    <button
      onClick={onClick}
      className={`flex shrink-0 items-center gap-1.5 border-b-2 pb-2 text-[11px] font-bold whitespace-nowrap transition-all ${active ? (isDark ? "border-orange-500 text-orange-400" : "border-orange-500 text-orange-500") : "border-transparent text-zinc-500 hover:text-zinc-400"} px-2`}
    >
      {icon} {label}
    </button>
  );
}

/**
 * Individual message card with delete action.
 * Used in the Meldinger tab.
 */
function MessageCard({
  title,
  audience,
  author,
  time,
  content,
  alert,
  onDelete,
}: {
  title: string;
  audience: string;
  author: string;
  time: string;
  content: string;
  alert?: boolean;
  onDelete?: () => void;
}) {
  const { isDark } = useContext(DashboardContext);
  return (
    <div
      className={`rounded-xl border p-4 ${alert ? (isDark ? "border-rose-500/30 bg-rose-500/10" : "border-rose-200 bg-rose-50") : isDark ? "border-white/10 bg-white/5" : "border-zinc-200 bg-white"} transition-all`}
    >
      <div className="mb-2 flex items-start justify-between">
        <h5
          className={`flex items-center gap-1.5 text-xs font-black ${alert ? "text-rose-400" : isDark ? "text-white" : "text-zinc-900"}`}
        >
          {alert ? <AlertCircle className="h-3.5 w-3.5" /> : null} {title}
        </h5>
        <div className="flex items-center gap-2">
          <span
            className={`rounded px-1.5 py-0.5 text-[9px] font-bold tracking-widest uppercase ${isDark ? "bg-black/40 text-zinc-400" : "bg-zinc-100 text-zinc-500"}`}
          >
            {time}
          </span>
          {onDelete && (
            <button
              onClick={onDelete}
              className="text-zinc-600 transition-colors hover:text-rose-400"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
      <p className={`text-xs leading-relaxed ${isDark ? "text-zinc-400" : "text-zinc-600"} mb-3`}>
        {content}
      </p>
      <div className="flex items-center justify-between text-[10px] font-bold text-zinc-500">
        <span className="flex items-center gap-1">
          <Eye className="h-3 w-3" /> Synlig for: {audience}
        </span>
        <span className="italic">Av: {author}</span>
      </div>
    </div>
  );
}
