// ============================================
// day-control/OversiktTab.tsx
// Overview tab: KPI cards, timeline, employee list, budget.
// Opening hours resolved from department_session or weekly defaults via usePlannedHours.
// ============================================
"use client";

import { useContext, useMemo, useState, useCallback, useEffect } from "react";
import { Clock, Pencil, Phone, Mail, CheckCircle2, AlertCircle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { useWorkspaceOptional } from "@/lib/workspace-context";
import { createClient } from "@smartout/supabase/client";
import { useScheduleUI } from "../schedule-ui-context";
import { PendingAbsenceList } from "../pending-absence-list";
import { useMoveShift, useUpdateShift } from "../../_hooks/use-shifts";
import { useWeekRange } from "../../_hooks/use-week-range";
import { usePlannedHours } from "../../_hooks/use-planned-hours";
import { SectionHeader, KpiCard, formatNok, formatHours, timeToHour } from "./shared";
import { TimelineView, type TimelineEntry } from "./TimelineView";
import { useDaySession } from "./use-day-session";
import { HoursOverridePopover } from "./HoursOverridePopover";

// UI Events:
// - action: openOverridePopover (click on hours area)
// - action: closeOverridePopover (click outside, escape, or save/cancel)
// - action: editBudget (pencil button toggle)
// - action: openShiftDetail (employee row click)
// - action: moveShift (day navigation arrows)
// - action: adjustShiftTime (start/end +/- buttons)
// - action: reorderShift (layer ordering buttons)
// - action: callEmployee (phone icon)
// - action: smsEmployee (mail icon)
// - color-regime: status-based (published/active=emerald, draft=muted)

export function OversiktTab({ dateId }: { dateId: string | null }) {
  const { isDark, isAdminMode } = useContext(DashboardContext);
  const { weekStart } = useWeekRange();
  const moveShiftMutation = useMoveShift(weekStart);
  const updateShiftMutation = useUpdateShift(weekStart);
  const { setSelectedShift } = useScheduleUI();
  const { dayStats, dayShifts, dayEmployees } = useDaySession();
  const stats = dateId ? dayStats : null;
  const employees = dayEmployees;
  const totalWorkHours = dayShifts.reduce((sum, s) => sum + s.workHours, 0);

  // Budget edit state
  const [isEditingBudget, setIsEditingBudget] = useState(false);
  const [budget, setBudget] = useState(15000);
  const [dutyManagers, setDutyManagers] = useState("");
  const [dutyLeaderId, setDutyLeaderId] = useState<string | null>(null);

  // Hours override popover
  const [showOverridePopover, setShowOverridePopover] = useState(false);

  // Resolve department for planned hours
  const ctx = useWorkspaceOptional();
  const wsId = ctx?.workspace.workspace_id;
  const supabase = createClient();

  const { data: departments } = useQuery({
    queryKey: ["departments", wsId],
    queryFn: async () => {
      const { data } = await supabase
        .from("department")
        .select("department_id, name")
        .eq("workspace_id", wsId!)
        .eq("is_active", true)
        .order("sort_order", { ascending: true });
      return data ?? [];
    },
    enabled: !!wsId,
  });
  const departmentId = departments?.[0]?.department_id;

  // Load active session's duty leader
  const { data: activeSession } = useQuery({
    queryKey: ["active-session-duty", departmentId, dateId],
    queryFn: async () => {
      const { data } = await supabase
        .from("department_session")
        .select("department_session_id, opened_by")
        .eq("department_id", departmentId!)
        .eq("session_date", dateId!)
        .in("status", ["active", "upcoming"])
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !!departmentId && !!dateId,
  });

  useEffect(() => {
    if (activeSession) {
      setDutyLeaderId(activeSession.opened_by);
    }
  }, [activeSession]);

  const plannedHours = usePlannedHours(departmentId, dateId);

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

  const shiftDateByDays = useCallback(
    (sourceShiftId: string, offsetDays: number) => {
      const shift = dayShifts.find((item) => item.id === sourceShiftId);
      if (!shift || !shift.employeeId) return;
      const date = new Date(`${shift.dateId}T00:00:00`);
      date.setDate(date.getDate() + offsetDays);
      const nextDateId = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
        date.getDate(),
      ).padStart(2, "0")}`;
      moveShiftMutation.mutate({ id: shift.id, employeeId: shift.employeeId, dateId: nextDateId });
    },
    [dayShifts, moveShiftMutation],
  );

  const adjustShiftTime = useCallback(
    (sourceShiftId: string, edge: "start" | "end", deltaMinutes: number) => {
      const shift = dayShifts.find((item) => item.id === sourceShiftId);
      if (!shift) return;
      const toMinutes = (value: string) => {
        const [hours, minutes] = value.split(":").map(Number);
        return (hours ?? 0) * 60 + (minutes ?? 0);
      };
      const fromMinutes = (value: number) => {
        const wrapped = ((value % 1440) + 1440) % 1440;
        const hours = Math.floor(wrapped / 60);
        const minutes = wrapped % 60;
        return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
      };

      const startMinutes = toMinutes(shift.startTime);
      let endMinutes = toMinutes(shift.endTime);
      if (endMinutes <= startMinutes) endMinutes += 24 * 60;

      const nextStart = edge === "start" ? startMinutes + deltaMinutes : startMinutes;
      const nextEnd = edge === "end" ? endMinutes + deltaMinutes : endMinutes;
      if (nextEnd - nextStart < 30) return;

      const normalizedStart = fromMinutes(nextStart);
      const normalizedEnd = fromMinutes(nextEnd);
      const workHours = Math.max(0.5, (nextEnd - nextStart) / 60);

      updateShiftMutation.mutate({
        id: shift.id,
        patch: { startTime: normalizedStart, endTime: normalizedEnd, workHours },
      });
    },
    [dayShifts, updateShiftMutation],
  );

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
      {/* Pending absence requests — admin only */}
      {isAdminMode && <PendingAbsenceList />}

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
          <div className="relative">
            <span className="text-muted-foreground font-bold">Apningstider:</span>{" "}
            {isEditingBudget ? (
              <span className="text-muted-foreground ml-1 text-[10px] italic">
                Klikk tidene for a endre
              </span>
            ) : null}
            <button
              onClick={() => setShowOverridePopover(true)}
              className="hover:bg-muted/40 ml-1 inline-flex items-center gap-1.5 rounded px-1.5 py-0.5 transition-colors"
            >
              <PlannedHoursDisplay
                openTime={plannedHours.openTime}
                closeTime={plannedHours.closeTime}
                source={plannedHours.source}
                isClosed={plannedHours.isClosed}
                isLoading={plannedHours.isLoading}
                hasOverride={plannedHours.hasOverride}
                overrideReason={plannedHours.overrideReason}
              />
            </button>
            {showOverridePopover && departmentId ? (
              <HoursOverridePopover
                departmentId={departmentId}
                dateId={dateId ?? ""}
                onClose={() => setShowOverridePopover(false)}
              />
            ) : null}
          </div>
          <div>
            <span className="text-muted-foreground font-bold">Duty Manager:</span>{" "}
            <select
              value={dutyLeaderId ?? ""}
              onChange={async (e) => {
                const newId = e.target.value || null;
                setDutyLeaderId(newId);
                if (activeSession) {
                  await supabase
                    .from("department_session")
                    .update({ opened_by: newId })
                    .eq("department_session_id", activeSession.department_session_id);
                }
              }}
              className="border-input bg-background text-foreground ml-1 rounded border px-1.5 py-0.5 text-[11px]"
            >
              <option value="">Ingen</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.name}
                </option>
              ))}
            </select>
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
        <TimelineView
          entries={timelineData}
          onShiftClick={setSelectedShift}
          onShiftUpdate={(id, startHour, endHour) => {
            const formatTime = (hourDec: number) => {
              const h = Math.floor(hourDec);
              const m = Math.round((hourDec - h) * 60);
              return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
            };
            const shift = dayShifts.find((s) => s.id === id);
            if (!shift) return;
            const workHours = Math.max(0.5, endHour - startHour);
            updateShiftMutation.mutate({
              id,
              patch: { startTime: formatTime(startHour), endTime: formatTime(endHour), workHours },
            });
          }}
        />
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

// ── Planned Hours Display ────────────────────────────────────

function PlannedHoursDisplay({
  openTime,
  closeTime,
  source,
  isClosed,
  isLoading,
  hasOverride,
  overrideReason,
}: {
  openTime: string | null;
  closeTime: string | null;
  source: "session" | "preview";
  isClosed: boolean;
  isLoading: boolean;
  hasOverride: boolean;
  overrideReason: string | null;
}) {
  if (isLoading) {
    return <span className="bg-muted inline-block h-3 w-20 animate-pulse rounded" />;
  }

  if (isClosed) {
    return (
      <span className="inline-flex items-center gap-1">
        <AlertCircle className="h-3 w-3 text-red-400" />
        <span className="font-bold text-red-400">Stengt</span>
        {overrideReason ? <span className="text-muted-foreground">({overrideReason})</span> : null}
      </span>
    );
  }

  if (!openTime || !closeTime) {
    return <span className="text-muted-foreground italic">Ikke satt</span>;
  }

  const isPreview = source === "preview";

  return (
    <span className="inline-flex items-center gap-1.5">
      {hasOverride ? (
        <span
          className="inline-block h-1.5 w-1.5 rounded-full bg-orange-400"
          title={overrideReason ?? "Unntak for denne datoen"}
        />
      ) : null}
      <span className={isPreview ? "text-muted-foreground italic" : "text-foreground"}>
        {openTime} - {closeTime}
      </span>
      {isPreview ? <span className="text-muted-foreground text-[10px]">(Planlagt)</span> : null}
    </span>
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
  dateId,
  onShiftClick,
}: {
  name: string;
  initials: string;
  avatarColor: string;
  role: string;
  time: string;
  status: string;
  dateId: string;
  onShiftClick: () => void;
}) {
  const { isDark } = useContext(DashboardContext);
  const isActive = status === "published" || status === "active";

  return (
    <div
      className={`rounded-xl border p-3 transition-colors ${isDark ? "border-border bg-muted/20 hover:border-border/80" : "border-border bg-card hover:border-border/80"}`}
    >
      <div className="flex items-center gap-3">
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
          <div className="text-foreground truncate text-sm font-bold">{name}</div>
          <div className="text-muted-foreground text-xs">
            {time} &middot; {role}
          </div>
        </button>

        <div className="flex shrink-0 items-center gap-1">
          <button
            onClick={() => {
              window.dispatchEvent(
                new CustomEvent("smartout:schedule-call", {
                  detail: {
                    employeeName: name,
                    note: `Ring vedr\u00F8rende vakt ${time}.`,
                  },
                }),
              );
              toast.success(`Starter Ultravox-samtale for ${name}`);
            }}
            className="text-muted-foreground hover:bg-muted rounded-lg p-1.5 transition-colors hover:text-blue-400"
          >
            <Phone className="h-4 w-4" />
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
            className="text-muted-foreground hover:bg-muted rounded-lg p-1.5 transition-colors hover:text-orange-400"
          >
            <Mail className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
