// ============================================
// day-control/StaffingTab.tsx
// Staffing perspective tab: total staff, hours, role breakdown, hourly chart.
// Uses real shift data from useShifts + useOpenShifts hooks.
// ============================================
"use client";

import { useContext, useMemo } from "react";
import { Users, Clock, AlertTriangle, UserPlus } from "lucide-react";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import type { Shift } from "../schedule-types";
import { useShifts } from "../../_hooks/use-shifts";
import { useOpenShifts } from "../../_hooks/use-open-shifts";
import { useWeekRange } from "../../_hooks/use-week-range";
import { SectionHeader, KpiCard, formatHours } from "./shared";

export function StaffingTab({ dateId }: { dateId: string | null }) {
  const { isDark } = useContext(DashboardContext);
  const { weekStart, weekEnd } = useWeekRange();
  const { data: shifts = [] as Shift[] } = useShifts(weekStart, weekEnd);
  const { data: openShiftsData = [] } = useOpenShifts();

  const dayData = useMemo(() => {
    if (!dateId)
      return {
        dayShifts: [] as Shift[],
        totalHours: 0,
        staffCount: 0,
        roles: new Map<string, { count: number; hours: number }>(),
        openCount: 0,
      };

    const dayShifts = shifts.filter((s: Shift) => s.dateId === dateId);
    const staffIds = new Set(dayShifts.map((s) => s.employeeId).filter(Boolean));
    const totalHours = dayShifts.reduce((sum, s) => sum + s.workHours, 0);

    // Group by role
    const roles = new Map<string, { count: number; hours: number }>();
    for (const s of dayShifts) {
      const role = s.role || "Ukjent";
      const existing = roles.get(role) ?? { count: 0, hours: 0 };
      roles.set(role, {
        count: existing.count + 1,
        hours: existing.hours + s.workHours,
      });
    }

    // Open shifts are workspace-wide (no dateId on OpenShift type),
    // so we show the total count as a global indicator
    const openCount = openShiftsData.length;

    return {
      dayShifts,
      totalHours,
      staffCount: staffIds.size,
      roles,
      openCount,
    };
  }, [dateId, shifts, openShiftsData]);

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 space-y-6 duration-200">
      {/* KPIs */}
      <section>
        <SectionHeader label="Bemanningsoversikt" />
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <KpiCard label="Ansatte" value={String(dayData.staffCount)} />
          <KpiCard label="Totalt timer" value={formatHours(dayData.totalHours)} />
          <KpiCard label="Vakter" value={String(dayData.dayShifts.length)} />
          <KpiCard label="Åpne vakter" value={String(dayData.openCount)} />
        </div>
      </section>

      {/* Open shifts warning */}
      {dayData.openCount > 0 && (
        <div className="border-warning/30 bg-warning/10 flex items-center gap-3 rounded-xl border p-3">
          <AlertTriangle className="text-warning h-4 w-4 shrink-0" />
          <div>
            <p className="text-foreground text-xs font-bold">{dayData.openCount} åpne vakter</p>
            <p className="text-muted-foreground text-[10px]">Disse vaktene mangler ansatte</p>
          </div>
          <button className="bg-warning/20 text-warning hover:bg-warning/30 ml-auto flex items-center gap-1 rounded-lg px-3 py-1.5 text-[10px] font-bold transition-colors">
            <UserPlus className="h-3 w-3" /> Tildel
          </button>
        </div>
      )}

      {/* By role breakdown */}
      <section>
        <SectionHeader label="Fordeling per rolle" />
        <div className="space-y-2">
          {dayData.roles.size === 0 ? (
            <p className="text-muted-foreground py-4 text-center text-xs">
              Ingen vakter denne dagen
            </p>
          ) : (
            Array.from(dayData.roles.entries()).map(([role, data]) => (
              <div
                key={role}
                className={`flex items-center gap-3 rounded-xl border p-3 ${isDark ? "border-border bg-muted/20" : "border-border bg-card"}`}
              >
                <div className="min-w-0 flex-1">
                  <div className="text-foreground text-xs font-bold">{role}</div>
                  <div className="text-muted-foreground text-[10px]">
                    {data.count} {data.count === 1 ? "vakt" : "vakter"} &middot;{" "}
                    {formatHours(data.hours)}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <div className="text-muted-foreground flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    <span className="text-xs font-bold">{data.count}</span>
                  </div>
                  <div className="text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    <span className="text-xs font-bold">{formatHours(data.hours)}</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {/* Staffing timeline summary */}
      <section>
        <SectionHeader label="Timefordeling" />
        <div
          className={`rounded-xl border p-4 ${isDark ? "border-border bg-muted/20" : "border-border bg-card"}`}
        >
          <HourlyStaffChart dayShifts={dayData.dayShifts} />
        </div>
      </section>
    </div>
  );
}

/** Simple hourly staff count chart */
function HourlyStaffChart({ dayShifts }: { dayShifts: Shift[] }) {
  const hours = Array.from({ length: 17 }, (_, i) => i + 6); // 06-22
  const maxStaff = Math.max(
    1,
    ...hours.map((h) => {
      return dayShifts.filter((s) => {
        const sh = Number(s.startTime.split(":")[0]);
        const eh = Number(s.endTime.split(":")[0]);
        return sh <= h && eh > h;
      }).length;
    }),
  );

  return (
    <div className="flex items-end gap-px" style={{ height: 80 }}>
      {hours.map((h) => {
        const count = dayShifts.filter((s) => {
          const sh = Number(s.startTime.split(":")[0]);
          const eh = Number(s.endTime.split(":")[0]);
          return sh <= h && eh > h;
        }).length;
        const pct = (count / maxStaff) * 100;
        return (
          <div
            key={h}
            className="group relative flex flex-1 flex-col items-center justify-end"
            style={{ height: "100%" }}
          >
            <div
              className="bg-accent/60 group-hover:bg-accent w-full rounded-t-sm transition-colors"
              style={{ height: `${pct}%`, minHeight: count > 0 ? 4 : 0 }}
            />
            <span className="text-muted-foreground mt-1 text-[8px]">{h}</span>
          </div>
        );
      })}
    </div>
  );
}
