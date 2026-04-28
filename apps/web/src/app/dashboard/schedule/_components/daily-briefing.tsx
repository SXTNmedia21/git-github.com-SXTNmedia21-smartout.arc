// ============================================
// daily-briefing.tsx
// Rich day detail panel (DayInspector) with 4 tabs:
// Oversikt, Dagsinfo (Meldinger), Reservasjoner, Oppgaver.
// v2: Bottom sheet with fullscreen expand, compact header,
// timeline view, employee list, budget edit, broadcast dialog.
// Connected to: schedule-ui-context.tsx (fullscreen state)
// Connected to: schedule-data.ts (dummyDays for dateId lookup)
// Connected to: booking-dialog.tsx (manual booking creation)
// ============================================
"use client";

import { useCallback, useContext, useMemo, useRef, useState } from "react";
import {
  X,
  Info,
  MessageSquare,
  CalendarCheck,
  ListTodo,
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
  Maximize2,
  Minimize2,
  Pencil,
  Phone,
  Send,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { useShifts, useUpdateShift } from "../_hooks/use-shifts";
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
import { useEmployees, type ScheduleEmployee } from "../_hooks/use-employees";
import { BookingDialog } from "./booking-dialog";
import type { TaskStatus } from "./schedule-types";

// ── Helper: format ISO date for display ──────────────────────

const DAY_NAMES_FULL = ["Sondag", "Mandag", "Tirsdag", "Onsdag", "Torsdag", "Fredag", "Lordag"];
const MONTH_NAMES = [
  "januar",
  "februar",
  "mars",
  "april",
  "mai",
  "juni",
  "juli",
  "august",
  "september",
  "oktober",
  "november",
  "desember",
];

function formatDateLabel(dateId: string | null): string {
  if (!dateId) return "";
  const date = new Date(dateId + "T00:00:00");
  const dayName = DAY_NAMES_FULL[date.getDay()] ?? "";
  return `${dayName} ${date.getDate()}. ${MONTH_NAMES[date.getMonth()] ?? ""}`.toUpperCase();
}

// ── Helper: format NOK currency ──────────────────────────────

function formatNok(amount: number): string {
  return `${amount.toLocaleString("nb-NO")} kr`;
}

// ── Helper: format work hours ────────────────────────────────

function formatHours(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (m === 0) return `${h}t`;
  return `${h}t ${m}m`;
}

// ── Helper: cycle task status ────────────────────────────────

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

// ── Helper: parse time string to hour number ─────────────────

function timeToHour(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return (h ?? 0) + (m ?? 0) / 60;
}

// ---------------------------------------------------------------------------
// DailyBriefingPanel — rich day detail panel (bottom sheet content)
// ---------------------------------------------------------------------------
export function DailyBriefingPanel({
  date,
  onClose,
}: {
  date: string | null;
  onClose: () => void;
}) {
  const { isDark } = useContext(DashboardContext);
  const { dayControlFullscreen, setDayControlFullscreen } = useScheduleUI();
  const [activeTab, setActiveTab] = useState<"oversikt" | "meldinger" | "bookings" | "oppgaver">(
    "oversikt",
  );

  const dateId = date;
  const dateLabel = useMemo(() => formatDateLabel(date), [date]);

  if (!date) return null;

  function handleClose() {
    setDayControlFullscreen(false);
    onClose();
  }

  return (
    <div className="relative flex h-full w-full flex-col">
      {/* Compact Header */}
      <div className="border-border shrink-0 border-b">
        <div className="flex items-center gap-3 px-5 py-4">
          {/* Title */}
          <div className="min-w-0 flex-1">
            <span className="text-[9px] font-bold tracking-widest text-orange-400 uppercase">
              Kontrollsenter
            </span>
            <h2 className="text-foreground truncate text-sm leading-tight font-black tracking-tight">
              {dateLabel}
            </h2>
          </div>

          {/* Actions */}
          <div className="flex shrink-0 items-center gap-1">
            <button
              onClick={() => setDayControlFullscreen(!dayControlFullscreen)}
              className="text-muted-foreground hover:bg-accent hover:text-accent-foreground rounded-lg p-1.5 transition-all"
              title={dayControlFullscreen ? "Minimer" : "Fullskjerm"}
            >
              {dayControlFullscreen ? (
                <Minimize2 className="h-4 w-4" />
              ) : (
                <Maximize2 className="h-4 w-4" />
              )}
            </button>
            <button
              onClick={handleClose}
              className="text-muted-foreground hover:bg-accent hover:text-accent-foreground rounded-lg p-1.5 transition-all"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Tabs - compact single row */}
        <div className="no-scrollbar flex gap-0 overflow-x-auto border-t border-white/5 px-5">
          <TabButton
            active={activeTab === "oversikt"}
            onClick={() => setActiveTab("oversikt")}
            icon={<Info className="h-3 w-3" />}
            label="Oversikt"
          />
          <TabButton
            active={activeTab === "meldinger"}
            onClick={() => setActiveTab("meldinger")}
            icon={<MessageSquare className="h-3 w-3" />}
            label="Dagsinfo"
          />
          <TabButton
            active={activeTab === "bookings"}
            onClick={() => setActiveTab("bookings")}
            icon={<CalendarCheck className="h-3 w-3" />}
            label="Reservasjoner"
          />
          <TabButton
            active={activeTab === "oppgaver"}
            onClick={() => setActiveTab("oppgaver")}
            icon={<ListTodo className="h-3 w-3" />}
            label="Oppgaver"
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 pt-4 pb-6">
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
// Footer Broadcast — now opens a dialog instead of instant toast
// ---------------------------------------------------------------------------

function FooterBroadcast({ isDark: _isDark, dateId }: { isDark: boolean; dateId: string | null }) {
  const { weekStart, weekEnd } = useWeekRange();
  const { data: shifts = [] as Shift[] } = useShifts(weekStart, weekEnd);
  const [broadcastType, setBroadcastType] = useState<"push" | "sms" | null>(null);

  const staffCount = dateId
    ? new Set(
        shifts
          .filter((s: Shift) => s.dateId === dateId)
          .map((s: Shift) => s.employeeId)
          .filter(Boolean),
      ).size
    : 0;

  return (
    <>
      <div className="border-border bg-card shrink-0 border-t px-5 py-4">
        <div className="flex items-center gap-3">
          <Megaphone className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
          <span className="text-muted-foreground text-[10px] font-bold tracking-wider uppercase">
            Kringkast ({staffCount})
          </span>
          <div className="flex-1" />
          <button
            onClick={() => setBroadcastType("push")}
            className="bg-muted text-foreground hover:bg-accent border-border flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[10px] font-bold transition-all"
          >
            <MessageCircle className="h-3.5 w-3.5 text-blue-400" /> Push
          </button>
          <button
            onClick={() => setBroadcastType("sms")}
            className="bg-muted text-foreground hover:bg-accent border-border flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[10px] font-bold transition-all"
          >
            <Mail className="h-3.5 w-3.5 text-orange-400" /> SMS
          </button>
        </div>
      </div>

      {/* Broadcast Dialog */}
      {broadcastType && dateId && (
        <BroadcastMessageDialog
          type={broadcastType}
          dateId={dateId}
          staffCount={staffCount}
          open={!!broadcastType}
          onOpenChange={(open) => {
            if (!open) setBroadcastType(null);
          }}
        />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Broadcast Message Dialog — Task 7: message field + daginfo checkbox
// ---------------------------------------------------------------------------

function BroadcastMessageDialog({
  type,
  dateId,
  staffCount,
  open,
  onOpenChange,
}: {
  type: "push" | "sms";
  dateId: string;
  staffCount: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [message, setMessage] = useState("");
  const [includeDaginfo, setIncludeDaginfo] = useState(false);

  function handleSend() {
    if (type === "sms") {
      window.dispatchEvent(
        new CustomEvent("smartout:schedule-sms-compose", {
          detail: {
            dateId,
            customMessage: message.trim(),
            includeDaginfo,
          },
        }),
      );
      toast.success(`SMS-utkast åpnet for ${staffCount} ansatte`);
    } else {
      toast.warning("Push utsending er ikke aktiv i denne versjonen. Bruk SMS eller dagsinfo.");
    }
    setMessage("");
    setIncludeDaginfo(false);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {type === "push" ? (
              <MessageCircle className="h-5 w-5 text-blue-400" />
            ) : (
              <Mail className="h-5 w-5 text-orange-400" />
            )}
            Send {type === "push" ? "Push-melding" : "SMS"}
          </DialogTitle>
          <DialogDescription>
            Til {staffCount} {staffCount === 1 ? "ansatt" : "ansatte"} på vakt
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <textarea
            placeholder="Skriv melding..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="border-input focus:border-ring h-24 w-full resize-none rounded-lg border bg-transparent p-3 text-sm focus:outline-none"
          />

          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={includeDaginfo}
              onChange={(e) => setIncludeDaginfo(e.target.checked)}
              className="border-input h-4 w-4 rounded accent-orange-500"
            />
            <span className="text-muted-foreground text-sm">Pakk med daginfo</span>
          </label>
        </div>

        <DialogFooter className="flex-row gap-2 sm:justify-end">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Avbryt
          </Button>
          <Button onClick={handleSend}>
            <Send className="mr-1.5 h-3.5 w-3.5" />
            Send {type === "push" ? "Push" : "SMS"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Oversikt Tab — with timeline, employee list, budget edit, extra fields
// ---------------------------------------------------------------------------

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
  const updateShift = useUpdateShift(weekStart);

  const computed = useScheduleComputed(
    shifts,
    absences,
    openShiftsData.length,
    templates,
    dayMessages,
    dayTasks,
    dayBookings,
  );

  const stats = dateId ? computed.getDayStats(dateId) : null;
  const dayShifts = useMemo(
    () => (dateId ? computed.getShiftsForDay(dateId) : []),
    [dateId, computed],
  );

  const employeesQuery = useEmployees();
  const employees: ScheduleEmployee[] = useMemo(
    () => employeesQuery.data ?? [],
    [employeesQuery.data],
  );

  const totalWorkHours = dayShifts.reduce((sum, s) => sum + s.workHours, 0);

  // Budget edit state
  const [isEditingBudget, setIsEditingBudget] = useState(false);
  const [budget, setBudget] = useState(15000);
  const [openingHours, setOpeningHours] = useState("11:00 - 23:00");
  const [dutyManagers, setDutyManagers] = useState("");
  const [lastYearData] = useState({ staff: 8, cost: 18400, hours: 52 });

  // Find duty managers from shifts (role includes "manager")
  const managerShifts = dayShifts.filter(
    (s) => s.role.toLowerCase().includes("manager") || s.indicator === "purple",
  );
  const managerNames = managerShifts
    .map((s) => {
      const emp = s.employeeId ? employees.find((e) => e.id === s.employeeId) : null;
      return emp?.name;
    })
    .filter(Boolean);

  // Build timeline data
  const timelineData = useMemo(() => {
    return dayShifts
      .filter((s) => s.employeeId)
      .map((s) => {
        const emp = employees.find((e) => e.id === s.employeeId);
        return {
          shiftId: s.id,
          name: emp?.name ?? "Ukjent",
          initials: emp?.initials ?? "??",
          avatarColor: emp?.avatarColor ?? "bg-muted text-muted-foreground border-border",
          role: s.role,
          startHour: timeToHour(s.startTime),
          endHour: timeToHour(s.endTime),
          startTime: s.startTime,
          endTime: s.endTime,
          time: s.time,
          status: s.status,
          zone: s.zone,
          team: emp?.team,
        };
      });
  }, [dayShifts, employees]);

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 space-y-6">
      {/* KPI Cards with budget edit */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-muted-foreground text-[10px] font-bold tracking-widest uppercase">
            Nokkeltall
          </h3>
          <button
            onClick={() => setIsEditingBudget(!isEditingBudget)}
            className="flex items-center gap-1 text-[10px] font-bold text-orange-400 hover:text-orange-300"
          >
            <Pencil className="h-3 w-3" />
            {isEditingBudget ? "Lagre" : "Rediger"}
          </button>
        </div>

        <div className="grid grid-cols-4 gap-2">
          <KpiCard
            isDark={isDark}
            label="Est. Kostnad"
            value={stats ? formatNok(stats.estimatedCost) : "—"}
          />
          <KpiCard
            isDark={isDark}
            label="Budsjett"
            value={formatNok(budget)}
            editing={isEditingBudget}
            editValue={budget}
            onEditChange={(v) => setBudget(Number(v))}
          />
          <KpiCard isDark={isDark} label="Timer" value={formatHours(totalWorkHours)} />
          <KpiCard isDark={isDark} label="Ansatte" value={String(stats?.staffCount ?? 0)} />
        </div>
      </section>

      {/* Extra info row: opening hours, duty manager, last year */}
      <section className="border-border bg-muted rounded-xl border p-3">
        <div className="grid grid-cols-1 gap-2 text-[11px] md:grid-cols-3">
          <div>
            <span className="text-muted-foreground font-bold">Apningstider:</span>{" "}
            {isEditingBudget ? (
              <input
                type="text"
                value={openingHours}
                onChange={(e) => setOpeningHours(e.target.value)}
                className="border-input ml-1 w-28 rounded border bg-transparent px-1.5 py-0.5 text-[11px]"
              />
            ) : (
              <span className="text-foreground">{openingHours}</span>
            )}
          </div>
          <div>
            <span className="text-muted-foreground font-bold">Duty Manager:</span>{" "}
            {isEditingBudget ? (
              <input
                type="text"
                value={dutyManagers || managerNames.join(", ")}
                onChange={(e) => setDutyManagers(e.target.value)}
                className="border-input ml-1 w-40 rounded border bg-transparent px-1.5 py-0.5 text-[11px]"
              />
            ) : (
              <span className="text-foreground">
                {dutyManagers || managerNames.join(", ") || "Ingen"}
              </span>
            )}
          </div>
          <div>
            <span className="text-muted-foreground font-bold">Forrige ar:</span>{" "}
            <span className="text-muted-foreground">
              {lastYearData.staff} ans, {formatNok(lastYearData.cost)}, {lastYearData.hours}t
            </span>
          </div>
        </div>
      </section>

      {/* Timeline — Gantt-style 06:00-23:00 */}
      <section>
        <h3 className="text-muted-foreground mb-3 text-[10px] font-bold tracking-widest uppercase">
          Tidslinje
        </h3>
        <TimelineView
          isDark={isDark}
          entries={timelineData}
          onShiftClick={setSelectedShift}
          onTimeChange={(shiftId, newStart, newEnd) => {
            const startMins =
              parseInt(newStart.split(":")[0] ?? "0", 10) * 60 +
              parseInt(newStart.split(":")[1] ?? "0", 10);
            let endMins =
              parseInt(newEnd.split(":")[0] ?? "0", 10) * 60 +
              parseInt(newEnd.split(":")[1] ?? "0", 10);
            if (endMins <= startMins) endMins += 24 * 60;
            const workHours = Math.max(0, (endMins - startMins) / 60);
            updateShift.mutate({
              id: shiftId,
              patch: { startTime: newStart, endTime: newEnd, workHours },
            });
          }}
        />
      </section>

      {/* Employee list */}
      <section>
        <h3 className="text-muted-foreground mb-3 text-[10px] font-bold tracking-widest uppercase">
          Ansatte pa vakt ({timelineData.length})
        </h3>
        <div className="space-y-2">
          {timelineData.length === 0 ? (
            <p className="text-muted-foreground py-4 text-center text-xs">
              Ingen ansatte pa vakt denne dagen
            </p>
          ) : (
            timelineData.map((entry) => (
              <EmployeeRow
                key={entry.shiftId}
                isDark={isDark}
                name={entry.name}
                initials={entry.initials}
                avatarColor={entry.avatarColor}
                role={entry.role}
                time={entry.time}
                status={entry.status}
                zone={entry.zone}
                team={entry.team}
                dateId={dateId ?? ""}
                onShiftClick={() => setSelectedShift(entry.shiftId)}
              />
            ))
          )}
        </div>
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// KPI Card
// ---------------------------------------------------------------------------

function KpiCard({
  isDark: _isDark,
  label,
  value,
  editing,
  editValue,
  onEditChange,
}: {
  isDark: boolean;
  label: string;
  value: string;
  editing?: boolean;
  editValue?: number;
  onEditChange?: (v: string) => void;
}) {
  return (
    <div className="border-border bg-card rounded-xl border p-3">
      <span className="text-muted-foreground block text-[9px] font-bold tracking-widest uppercase">
        {label}
      </span>
      {editing && onEditChange ? (
        <input
          type="number"
          value={editValue}
          onChange={(e) => onEditChange(e.target.value)}
          className="border-input mt-1 w-full rounded border bg-transparent px-1 py-0.5 text-sm font-black"
        />
      ) : (
        <div className="text-foreground mt-1 text-base leading-tight font-black">{value}</div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Timeline View — Gantt-style bar chart
// ---------------------------------------------------------------------------

const TIMELINE_START = 6; // 06:00
const TIMELINE_END = 23; // 23:00
const TIMELINE_HOURS = TIMELINE_END - TIMELINE_START;

type TimelineEntry = {
  shiftId: string;
  name: string;
  initials: string;
  avatarColor: string;
  role: string;
  startHour: number;
  endHour: number;
  startTime: string;
  endTime: string;
  time: string;
  status: string;
  zone?: string;
  team?: string;
};

function TimelineView({
  isDark,
  entries,
  onShiftClick,
  onTimeChange,
}: {
  isDark: boolean;
  entries: TimelineEntry[];
  onShiftClick: (id: string) => void;
  onTimeChange?: (shiftId: string, newStart: string, newEnd: string) => void;
}) {
  const hours = Array.from({ length: TIMELINE_HOURS + 1 }, (_, i) => TIMELINE_START + i);

  return (
    <div className="border-border bg-muted overflow-x-auto rounded-xl border p-4">
      {/* Hour labels */}
      <div className="mb-1 flex">
        <div className="w-24 shrink-0" />
        <div className="relative flex-1">
          <div className="flex justify-between">
            {hours.map((h) => (
              <span key={h} className="text-muted-foreground w-0 text-center text-[9px] font-bold">
                {String(h).padStart(2, "0")}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Grid lines + bars */}
      {entries.length === 0 ? (
        <p className="text-muted-foreground py-6 text-center text-xs">Ingen vakter</p>
      ) : (
        entries.map((entry) => (
          <TimelineBar
            key={entry.shiftId}
            isDark={isDark}
            entry={entry}
            hours={hours}
            onShiftClick={onShiftClick}
            onTimeChange={onTimeChange}
          />
        ))
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// TimelineBar — individual draggable/resizable shift bar
// ---------------------------------------------------------------------------

/** Convert hour (decimal) to "HH:MM" string */
function hourToTimeStr(h: number): string {
  const wrapped = ((h % 24) + 24) % 24;
  const hrs = Math.floor(wrapped);
  const mins = Math.round((wrapped - hrs) * 60);
  return `${String(hrs).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

/** Snap a decimal hour to nearest 15-minute increment */
function snapHour(h: number): number {
  return Math.round(h * 4) / 4;
}

function TimelineBar({
  isDark: _isDark,
  entry,
  hours,
  onShiftClick,
  onTimeChange,
}: {
  isDark: boolean;
  entry: TimelineEntry;
  hours: number[];
  onShiftClick: (id: string) => void;
  onTimeChange?: (shiftId: string, newStart: string, newEnd: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dragState, setDragState] = useState<{
    type: "move" | "start" | "end";
    startHour: number;
    endHour: number;
  } | null>(null);

  const currentStart = dragState ? dragState.startHour : entry.startHour;
  const rawEnd = dragState ? dragState.endHour : entry.endHour;
  const currentEnd = rawEnd <= currentStart ? rawEnd + 24 : rawEnd;

  const startPct = Math.max(0, ((currentStart - TIMELINE_START) / TIMELINE_HOURS) * 100);
  const endPct = Math.min(100, ((currentEnd - TIMELINE_START) / TIMELINE_HOURS) * 100);
  const widthPct = Math.max(endPct - startPct, 1.5);

  const displayStart = dragState ? hourToTimeStr(dragState.startHour) : entry.startTime;
  const displayEnd = dragState ? hourToTimeStr(dragState.endHour) : entry.endTime;

  /** Convert a pixel X offset within the container to a decimal hour */
  const pxToHour = useCallback((clientX: number): number => {
    if (!containerRef.current) return TIMELINE_START;
    const rect = containerRef.current.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    return TIMELINE_START + pct * TIMELINE_HOURS;
  }, []);

  const handlePointerDown = useCallback(
    (type: "move" | "start" | "end", e: React.PointerEvent) => {
      if (!onTimeChange) return;
      e.preventDefault();
      e.stopPropagation();

      const originX = e.clientX;
      const origStart = entry.startHour;
      const origEnd = entry.endHour <= entry.startHour ? entry.endHour + 24 : entry.endHour;
      const duration = origEnd - origStart;

      const onMove = (ev: PointerEvent) => {
        const currentHour = pxToHour(ev.clientX);
        const originHour = pxToHour(originX);
        const delta = currentHour - originHour;

        if (type === "move") {
          const newStart = snapHour(origStart + delta);
          const newEnd = snapHour(newStart + duration);
          setDragState({ type, startHour: newStart, endHour: newEnd });
        } else if (type === "start") {
          const newStart = snapHour(origStart + delta);
          if (newStart < origEnd - 0.25) {
            setDragState({ type, startHour: newStart, endHour: entry.endHour });
          }
        } else {
          const newEnd = snapHour(origEnd + delta);
          if (newEnd > origStart + 0.25) {
            setDragState({ type, startHour: entry.startHour, endHour: newEnd });
          }
        }
      };

      const onUp = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        setDragState((prev) => {
          if (prev) {
            const newStartStr = hourToTimeStr(prev.startHour);
            const newEndStr = hourToTimeStr(prev.endHour);
            if (newStartStr !== entry.startTime || newEndStr !== entry.endTime) {
              onTimeChange(entry.shiftId, newStartStr, newEndStr);
            }
          }
          return null;
        });
      };

      // Initialize drag state
      setDragState({ type, startHour: origStart, endHour: entry.endHour });
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [entry, onTimeChange, pxToHour],
  );

  const meta = [entry.zone, entry.team].filter(Boolean).join(" · ");

  return (
    <div className="group/bar mb-2 flex items-center">
      {/* Name + role label */}
      <div className="w-24 shrink-0 pr-3">
        <div className="text-foreground truncate text-[11px] leading-tight font-bold">
          {entry.name.split(" ")[0]}
        </div>
        <div className="text-muted-foreground truncate text-[9px] leading-tight">{entry.role}</div>
      </div>

      {/* Bar container */}
      <div ref={containerRef} className="bg-muted relative h-8 flex-1 rounded-md">
        {/* Grid lines */}
        {hours.map((h) => (
          <div
            key={h}
            className="bg-border absolute top-0 h-full w-px"
            style={{ left: `${((h - TIMELINE_START) / TIMELINE_HOURS) * 100}%` }}
          />
        ))}

        {/* Shift bar */}
        <div
          className={`absolute top-1 h-6 rounded-md transition-shadow ${
            dragState
              ? "z-10 bg-orange-500 shadow-[0_0_12px_rgba(249,115,22,0.5)]"
              : "bg-orange-500/80 group-hover/bar:shadow-[0_0_8px_rgba(249,115,22,0.3)] hover:bg-orange-500"
          } ${onTimeChange ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"}`}
          style={{ left: `${startPct}%`, width: `${widthPct}%` }}
          onPointerDown={onTimeChange ? (e) => handlePointerDown("move", e) : undefined}
          onClick={(e) => {
            if (!dragState) {
              e.stopPropagation();
              onShiftClick(entry.shiftId);
            }
          }}
        >
          {/* Bar content */}
          <div className="flex h-full items-center gap-1.5 overflow-hidden px-1.5">
            <span className="truncate text-[9px] leading-none font-bold text-white">
              {displayStart} - {displayEnd}
            </span>
            {meta && (
              <span className="hidden truncate text-[8px] leading-none text-white/60 xl:inline">
                {meta}
              </span>
            )}
          </div>

          {/* Left resize handle (start time) */}
          {onTimeChange && (
            <div
              className="absolute top-0 left-0 h-full w-2 cursor-col-resize opacity-0 transition-opacity group-hover/bar:opacity-100"
              onPointerDown={(e) => handlePointerDown("start", e)}
            >
              <div className="absolute top-1/2 left-0.5 h-3 w-0.5 -translate-y-1/2 rounded-full bg-white/80" />
            </div>
          )}

          {/* Right resize handle (end time) */}
          {onTimeChange && (
            <div
              className="absolute top-0 right-0 h-full w-2 cursor-col-resize opacity-0 transition-opacity group-hover/bar:opacity-100"
              onPointerDown={(e) => handlePointerDown("end", e)}
            >
              <div className="absolute top-1/2 right-0.5 h-3 w-0.5 -translate-y-1/2 rounded-full bg-white/80" />
            </div>
          )}
        </div>

        {/* Time tooltip during drag */}
        {dragState && (
          <div
            className="bg-card pointer-events-none absolute -top-6 z-20 rounded px-2 py-0.5 text-[10px] font-bold whitespace-nowrap text-orange-300 shadow-lg"
            style={{ left: `${startPct + widthPct / 2}%`, transform: "translateX(-50%)" }}
          >
            {displayStart} - {displayEnd}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Employee Row
// ---------------------------------------------------------------------------

function EmployeeRow({
  isDark: _isDark,
  name,
  initials,
  avatarColor,
  role,
  time,
  status,
  zone,
  team,
  dateId,
  onShiftClick,
}: {
  isDark: boolean;
  name: string;
  initials: string;
  avatarColor: string;
  role: string;
  time: string;
  status: string;
  zone?: string;
  team?: string;
  dateId: string;
  onShiftClick: () => void;
}) {
  const isActive = status === "published" || status === "active";

  return (
    <div className="border-border bg-card hover:border-border flex items-center gap-3 rounded-xl border p-3 transition-colors">
      {/* Status indicator */}
      <div className="shrink-0">
        {isActive ? (
          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
        ) : (
          <Clock className="text-muted-foreground h-4 w-4" />
        )}
      </div>

      {/* Avatar */}
      <div
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-[10px] font-black ${avatarColor}`}
      >
        {initials}
      </div>

      {/* Info */}
      <button onClick={onShiftClick} className="min-w-0 flex-1 text-left">
        <div className="text-foreground truncate text-xs font-bold">{name}</div>
        <div className="text-muted-foreground text-[10px]">
          {time} &middot; {role}
        </div>
        {(zone || team) && (
          <div className="text-muted-foreground mt-0.5 flex items-center gap-2 text-[9px]">
            {zone && (
              <span className="flex items-center gap-0.5">
                <MapPin className="h-2.5 w-2.5" /> {zone}
              </span>
            )}
            {team && (
              <span className="flex items-center gap-0.5">
                <Users className="h-2.5 w-2.5" /> {team}
              </span>
            )}
          </div>
        )}
      </button>

      {/* Contact */}
      <div className="flex shrink-0 items-center gap-1.5">
        <button
          onClick={() => {
            window.dispatchEvent(
              new CustomEvent("smartout:schedule-call", {
                detail: {
                  employeeName: name,
                  note: `Ring vedrørende vakt ${time}.`,
                },
              }),
            );
          }}
          className="hover:bg-accent text-muted-foreground rounded-lg p-1.5 transition-colors hover:text-blue-400"
        >
          <Phone className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => {
            window.dispatchEvent(
              new CustomEvent("smartout:schedule-sms-compose", {
                detail: {
                  dateId,
                  employeeName: name,
                  shiftTime: time,
                },
              }),
            );
          }}
          className="hover:bg-accent text-muted-foreground rounded-lg p-1.5 transition-colors hover:text-orange-400"
        >
          <Mail className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Meldinger Tab (Dagsinfo)
// ---------------------------------------------------------------------------

function MeldingerTab({ isDark: _isDark, dateId }: { isDark: boolean; dateId: string | null }) {
  const { profileId } = useContext(DashboardContext);
  const { weekStart, weekEnd } = useWeekRange();
  const { data: dayMessagesData = [] as DayMessage[] } = useDayMessages(weekStart, weekEnd);
  const createDayMessage = useCreateDayMessage(weekStart);
  const deleteDayMessage = useDeleteDayMessage(weekStart);

  const [content, setContent] = useState("");
  const [audience, setAudience] = useState<"all" | "leaders" | string>("all");
  const [visibility, setVisibility] = useState<"all_day" | "until_16" | "permanent">("all_day");

  const messages = dateId ? dayMessagesData.filter((m: DayMessage) => m.dateId === dateId) : [];

  function handlePublish() {
    if (!dateId) return;
    if (!content.trim()) {
      toast.error("Skriv en beskjed forst");
      return;
    }

    createDayMessage.mutate({
      id: crypto.randomUUID(),
      dateId,
      title: content.trim().slice(0, 50),
      content: content.trim(),
      audience,
      visibility,
      author: profileId ?? "",
      isAlert: false,
    });

    toast.success("Oppslag publisert");
    setContent("");
  }

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
      <div className="border-border bg-card rounded-2xl border p-4 shadow-sm">
        <h4 className="text-foreground mb-2 text-xs font-bold">Nytt oppslag</h4>
        <textarea
          placeholder="Skriv beskjed til ansatte her..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="border-border mb-3 block h-24 w-full resize-none rounded-xl border bg-transparent p-3 text-xs focus:border-blue-500/50 focus:outline-none"
        />
        <div className="flex flex-col justify-between gap-2 md:flex-row md:items-center">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 rounded-lg p-1.5 focus-within:ring-1 focus-within:ring-white/20">
              <Eye className="text-muted-foreground h-3.5 w-3.5" />
              <select
                value={audience}
                onChange={(e) => setAudience(e.target.value)}
                className="text-foreground cursor-pointer bg-transparent text-[11px] font-bold outline-none"
              >
                <option value="all">Alle Pa Vakt</option>
                <option value="leaders">Kun Ledere</option>
                <option value="Servering">Servering (Team)</option>
              </select>
            </div>
            <div className="bg-border hidden h-4 w-px md:block" />
            <div className="flex items-center gap-1.5 rounded-lg p-1.5 focus-within:ring-1 focus-within:ring-white/20">
              <Clock className="text-muted-foreground h-3.5 w-3.5" />
              <select
                value={visibility}
                onChange={(e) => setVisibility(e.target.value as typeof visibility)}
                className="text-foreground cursor-pointer bg-transparent text-[11px] font-bold outline-none"
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
        <h4 className="text-muted-foreground text-xs font-bold tracking-widest uppercase">
          Aktive Oppslag ({messages.length})
        </h4>
        {messages.length === 0 ? (
          <p className="text-muted-foreground py-4 text-center text-xs">
            Ingen oppslag for denne dagen
          </p>
        ) : (
          messages.map((msg: DayMessage) => (
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
// Bookings Tab (Reservasjoner)
// ---------------------------------------------------------------------------

function BookingsTab({ isDark: _isDark, dateId }: { isDark: boolean; dateId: string | null }) {
  const { weekStart, weekEnd } = useWeekRange();
  const { data: dayBookingsData = [] as DayBooking[] } = useDayBookings(weekStart, weekEnd);
  const [bookingDialogOpen, setBookingDialogOpen] = useState(false);
  const [expandedBookingId, setExpandedBookingId] = useState<string | null>(null);

  const bookings = dateId ? dayBookingsData.filter((b: DayBooking) => b.dateId === dateId) : [];

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
          <span className="border-border bg-muted text-muted-foreground rounded-lg border px-2 py-0.5 text-[10px] font-bold">
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
        <h4 className="text-muted-foreground text-xs font-bold tracking-widest uppercase">
          Reservasjoner ({bookings.length})
        </h4>
        <button
          onClick={() => setBookingDialogOpen(true)}
          className="flex items-center gap-1 text-[10px] font-bold text-orange-400 hover:text-orange-300"
        >
          <Plus className="h-3.5 w-3.5" /> Legg til manuelt
        </button>
      </div>

      {bookings.length === 0 ? (
        <p className="text-muted-foreground py-8 text-center text-xs">
          Ingen bookinger for denne dagen
        </p>
      ) : (
        <div className="space-y-3">
          {bookings.map((booking: DayBooking) => {
            const isExpanded = expandedBookingId === booking.id;

            return (
              <div
                key={booking.id}
                className="border-border bg-card text-foreground hover:border-border rounded-xl border p-4 shadow-sm transition-colors"
              >
                <div className="mb-2 flex justify-between">
                  <span className="flex items-center gap-2 text-sm font-bold">
                    <Users className="h-4 w-4 text-orange-400" /> {booking.title}
                    {booking.isVip && <Star className="h-3.5 w-3.5 text-amber-400" />}
                  </span>
                  {statusBadge(booking.status, booking.isVip)}
                </div>
                <p className="text-muted-foreground mb-3 text-xs font-medium">
                  {booking.guestCount} Personer &bull; {booking.menu}
                </p>
                <div className="border-border flex items-center justify-between border-t pt-3">
                  <div className="text-muted-foreground flex gap-4 text-[10px] font-bold">
                    <span className="flex items-center gap-1.5">
                      <Clock className="text-muted-foreground h-3.5 w-3.5" /> {booking.time}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <MapPin className="text-muted-foreground h-3.5 w-3.5" /> {booking.location}
                    </span>
                  </div>
                  <button
                    onClick={() => setExpandedBookingId(isExpanded ? null : booking.id)}
                    className="text-[10px] font-bold text-blue-400 hover:text-blue-300"
                  >
                    {isExpanded ? "Skjul detaljer" : "Se detaljer"}
                  </button>
                </div>

                {isExpanded && (
                  <div className="border-border mt-3 space-y-2 border-t pt-3">
                    {booking.contactPerson && (
                      <div className="text-muted-foreground text-[10px]">
                        <span className="text-muted-foreground font-bold">Kontakt:</span>{" "}
                        {booking.contactPerson}
                      </div>
                    )}
                    {booking.notes && (
                      <div className="text-muted-foreground text-[10px]">
                        <span className="text-muted-foreground font-bold">Notater:</span>{" "}
                        {booking.notes}
                      </div>
                    )}
                    {!booking.contactPerson && !booking.notes && (
                      <p className="text-muted-foreground text-[10px]">Ingen tilleggsinformasjon</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

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

function OppgaverTab({ isDark, dateId }: { isDark: boolean; dateId: string | null }) {
  const { weekStart, weekEnd } = useWeekRange();
  const { data: dayTasksData = [] as DayTask[] } = useDayTasks(weekStart, weekEnd);
  const createDayTask = useCreateDayTask(weekStart);
  const updateDayTaskStatus = useUpdateDayTaskStatus(weekStart);
  const deleteDayTask = useDeleteDayTask(weekStart);

  const [newTaskLabel, setNewTaskLabel] = useState("");
  const [filter, setFilter] = useState<"all" | "routine" | "delegated">("all");

  const allTasks = dateId ? dayTasksData.filter((t: DayTask) => t.dateId === dateId) : [];
  const filteredTasks =
    filter === "all" ? allTasks : allTasks.filter((t: DayTask) => t.category === filter);

  const completedCount = allTasks.filter((t: DayTask) => t.status === "completed").length;
  const totalCount = allTasks.length;

  const routineCount = allTasks.filter((t: DayTask) => t.category === "routine").length;
  const delegatedCount = allTasks.filter((t: DayTask) => t.category === "delegated").length;

  function handleAddTask() {
    if (!dateId) return;
    if (!newTaskLabel.trim()) {
      toast.error("Skriv et oppgavenavn");
      return;
    }

    createDayTask.mutate({
      id: crypto.randomUUID(),
      dateId,
      label: newTaskLabel.trim(),
      status: "pending",
      category: "all",
      highlight: false,
    });

    toast.success("Oppgave lagt til");
    setNewTaskLabel("");
  }

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
          classes: "border-border text-transparent hover:border-orange-500",
        };
    }
  }

  return (
    <section className="animate-in fade-in slide-in-from-bottom-2">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-muted-foreground text-xs font-bold tracking-widest uppercase">
          Gjoremal &amp; Rutiner
        </h3>
        <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
          {completedCount} / {totalCount} Utfort
        </span>
      </div>
      <div className="space-y-2">
        {/* New task input */}
        <div className="mb-4 flex gap-2">
          <input
            type="text"
            placeholder="Planlegg nytt gjoremal for dagen..."
            value={newTaskLabel}
            onChange={(e) => setNewTaskLabel(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAddTask();
            }}
            className="border-border bg-card text-foreground placeholder:text-muted-foreground flex-1 rounded-xl border p-3 text-xs shadow-inner focus:border-orange-500/50 focus:outline-none"
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
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground border-border border bg-transparent"
            } hover:bg-orange-500/20 hover:text-orange-400`}
          >
            Alle oppgaver
          </span>
          <span
            onClick={() => setFilter("routine")}
            className={`shrink-0 cursor-pointer rounded-lg px-2 py-1.5 text-[9px] font-bold transition-colors ${
              filter === "routine"
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground border-border border bg-transparent"
            } hover:border-orange-500/50`}
          >
            Faste Rutiner ({routineCount})
          </span>
          <span
            onClick={() => setFilter("delegated")}
            className={`shrink-0 cursor-pointer rounded-lg px-2 py-1.5 text-[9px] font-bold transition-colors ${
              filter === "delegated"
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground border-border border bg-transparent"
            } hover:border-orange-500/50`}
          >
            Delegert ({delegatedCount})
          </span>
        </div>

        {/* Task list */}
        {filteredTasks.length === 0 ? (
          <p className="text-muted-foreground py-4 text-center text-xs">
            {filter === "all"
              ? "Ingen oppgaver for denne dagen"
              : "Ingen oppgaver i denne kategorien"}
          </p>
        ) : (
          filteredTasks.map((task: DayTask) => {
            const { icon, classes } = statusIcon(task.status);
            const isDone = task.status === "completed";
            const isInProgress = task.status === "in_progress";

            const base = isDone
              ? "border-border bg-muted opacity-60"
              : task.highlight
                ? isDark
                  ? "border-orange-500/20 bg-orange-500/5" // Nordic Split: Phase 2.5 candidate.
                  : "border-orange-200 bg-orange-50"
                : isInProgress
                  ? isDark
                    ? "border-blue-500/20 bg-blue-500/5" // Nordic Split: Phase 2.5 candidate.
                    : "border-blue-100 bg-blue-50"
                  : "border-border bg-card";

            return (
              <div
                key={task.id}
                className={`flex items-center gap-3 rounded-xl border p-3 transition-colors ${base}`}
              >
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

                <span
                  className={`truncate text-xs font-medium ${isDone ? "text-muted-foreground line-through" : "text-foreground"}`}
                >
                  {task.label}
                </span>

                {task.highlight && (
                  <span className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.8)]" />
                )}

                <button
                  onClick={() => {
                    deleteDayTask.mutate(task.id);
                    toast("Oppgave slettet");
                  }}
                  className="text-muted-foreground ml-auto shrink-0 transition-colors hover:text-rose-400"
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
      className={`flex shrink-0 items-center gap-1 border-b-2 px-3 py-2 text-[10px] font-bold whitespace-nowrap transition-all ${active ? (isDark ? "border-orange-500 text-orange-400" : "border-orange-500 text-orange-500") : "text-muted-foreground hover:text-foreground border-transparent"}`}
    >
      {icon} {label}
    </button>
  );
}

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
      className={`rounded-xl border p-4 ${alert ? (isDark ? "border-rose-500/30 bg-rose-500/10" : "border-rose-200 bg-rose-50") : "border-border bg-card"} transition-all`}
    >
      <div className="mb-2 flex items-start justify-between">
        <h5
          className={`flex items-center gap-1.5 text-xs font-black ${alert ? "text-rose-400" : "text-foreground"}`}
        >
          {alert ? <AlertCircle className="h-3.5 w-3.5" /> : null} {title}
        </h5>
        <div className="flex items-center gap-2">
          <span className="bg-muted text-muted-foreground rounded px-1.5 py-0.5 text-[9px] font-bold tracking-widest uppercase">
            {time}
          </span>
          {onDelete && (
            <button
              onClick={onDelete}
              className="text-muted-foreground transition-colors hover:text-rose-400"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
      <p className="text-muted-foreground mb-3 text-xs leading-relaxed">{content}</p>
      <div className="text-muted-foreground flex items-center justify-between text-[10px] font-bold">
        <span className="flex items-center gap-1">
          <Eye className="h-3 w-3" /> Synlig for: {audience}
        </span>
        <span className="italic">Av: {author}</span>
      </div>
    </div>
  );
}
