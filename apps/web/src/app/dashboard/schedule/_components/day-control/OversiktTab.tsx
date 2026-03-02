// ============================================
// day-control/OversiktTab.tsx
// Overview tab: KPI cards, timeline, employee list, budget.
// ============================================
"use client";

import { useContext, useMemo, useState } from "react";
import { Clock, Users, Pencil, Phone, Mail, CheckCircle2 } from "lucide-react";
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
} from "../schedule-types";
import { useScheduleUI } from "../schedule-ui-context";
import { useShifts } from "../../_hooks/use-shifts";
import { useAbsences } from "../../_hooks/use-absences";
import { useOpenShifts } from "../../_hooks/use-open-shifts";
import { useTemplates } from "../../_hooks/use-templates";
import { useDayMessages, useDayTasks, useDayBookings } from "../../_hooks/use-day-content";
import { useScheduleComputed } from "../../_hooks/use-schedule-computed";
import { useWeekRange } from "../../_hooks/use-week-range";
import { useEmployees, type ScheduleEmployee } from "../../_hooks/use-employees";
import { SectionHeader, KpiCard, formatNok, formatHours, timeToHour } from "./shared";
import { TimelineView, type TimelineEntry } from "./TimelineView";

export function OversiktTab({ dateId }: { dateId: string | null }) {
  const { isDark } = useContext(DashboardContext);
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

  const stats = dateId ? computed.getDayStats(dateId) : null;
  const dayShifts = dateId ? computed.getShiftsForDay(dateId) : [];
  const employeesQuery = useEmployees();
  const employees: ScheduleEmployee[] = employeesQuery.data ?? [];
  const totalWorkHours = dayShifts.reduce((sum, s) => sum + s.workHours, 0);

  // Budget edit state
  const [isEditingBudget, setIsEditingBudget] = useState(false);
  const [budget, setBudget] = useState(15000);
  const [openingHours, setOpeningHours] = useState("11:00 - 23:00");
  const [dutyManagers, setDutyManagers] = useState("");

  // Find duty managers from shifts
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
  const timelineData: TimelineEntry[] = useMemo(() => {
    return dayShifts
      .filter((s) => s.employeeId)
      .map((s) => {
        const emp = employees.find((e) => e.id === s.employeeId);
        return {
          shiftId: s.id,
          name: emp?.name ?? "Ukjent",
          initials: emp?.initials ?? "??",
          avatarColor: emp?.avatarColor ?? "bg-zinc-500/20 text-zinc-400 border-zinc-500/30",
          role: s.role,
          startHour: timeToHour(s.startTime),
          endHour: timeToHour(s.endTime),
          time: s.time,
          status: s.status,
        };
      });
  }, [dayShifts, employees]);

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 space-y-6 duration-200">
      {/* KPI Cards */}
      <section>
        <SectionHeader label="Nokkeltall">
          <button
            onClick={() => setIsEditingBudget(!isEditingBudget)}
            className="flex items-center gap-1 text-[10px] font-bold text-orange-400 hover:text-orange-300"
          >
            <Pencil className="h-3 w-3" />
            {isEditingBudget ? "Lagre" : "Rediger"}
          </button>
        </SectionHeader>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <KpiCard label="Est. Kostnad" value={stats ? formatNok(stats.estimatedCost) : "\u2014"} />
          <KpiCard
            label="Budsjett"
            value={formatNok(budget)}
            editing={isEditingBudget}
            editValue={budget}
            onEditChange={(v) => setBudget(Number(v))}
          />
          <KpiCard label="Timer" value={formatHours(totalWorkHours)} />
          <KpiCard label="Ansatte" value={String(stats?.staffCount ?? 0)} />
        </div>
      </section>

      {/* Extra info row */}
      <section
        className={`rounded-xl border p-3 ${isDark ? "border-border bg-muted/20" : "border-border bg-muted/40"}`}
      >
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
            <span className="text-muted-foreground">8 ans, {formatNok(18400)}, 52t</span>
          </div>
        </div>
      </section>

      {/* Timeline */}
      <section>
        <SectionHeader label="Tidslinje" />
        <TimelineView entries={timelineData} onShiftClick={setSelectedShift} />
      </section>

      {/* Employee list */}
      <section>
        <SectionHeader label={`Ansatte pa vakt (${timelineData.length})`} />
        <div className="space-y-2">
          {timelineData.length === 0 ? (
            <p className="text-muted-foreground py-4 text-center text-xs">
              Ingen ansatte pa vakt denne dagen
            </p>
          ) : (
            timelineData.map((entry) => (
              <EmployeeListRow
                key={entry.shiftId}
                name={entry.name}
                initials={entry.initials}
                avatarColor={entry.avatarColor}
                role={entry.role}
                time={entry.time}
                status={entry.status}
                onShiftClick={() => setSelectedShift(entry.shiftId)}
              />
            ))
          )}
        </div>
      </section>
    </div>
  );
}

// ── Employee List Row ────────────────────────────────────────

function EmployeeListRow({
  name,
  initials,
  avatarColor,
  role,
  time,
  status,
  onShiftClick,
}: {
  name: string;
  initials: string;
  avatarColor: string;
  role: string;
  time: string;
  status: string;
  onShiftClick: () => void;
}) {
  const { isDark } = useContext(DashboardContext);
  const isActive = status === "published" || status === "active";

  return (
    <div
      className={`flex items-center gap-3 rounded-xl border p-3 transition-colors ${isDark ? "border-border bg-muted/20 hover:border-border/80" : "border-border bg-card hover:border-border/80"}`}
    >
      <div className="shrink-0">
        {isActive ? (
          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
        ) : (
          <Clock className="text-muted-foreground h-4 w-4" />
        )}
      </div>

      <div
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-[10px] font-black ${avatarColor}`}
      >
        {initials}
      </div>

      <button onClick={onShiftClick} className="min-w-0 flex-1 text-left">
        <div className="text-foreground truncate text-xs font-bold">{name}</div>
        <div className="text-muted-foreground text-[10px]">
          {time} &middot; {role}
        </div>
      </button>

      <div className="flex shrink-0 items-center gap-1">
        <button
          onClick={() => toast.info(`Ringer ${name}...`)}
          className="text-muted-foreground hover:bg-muted rounded-lg p-1.5 transition-colors hover:text-blue-400"
        >
          <Phone className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => toast.info(`SMS til ${name}...`)}
          className="text-muted-foreground hover:bg-muted rounded-lg p-1.5 transition-colors hover:text-orange-400"
        >
          <Mail className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
