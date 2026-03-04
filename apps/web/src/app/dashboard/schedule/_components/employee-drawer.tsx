"use client";

/**
 * EmployeeDrawer — right-side Sheet for turnus management.
 * Shows turnus editor (weekday grid), period selector, availability
 * calendar, statistics, and auto-fill button.
 * Connected to: schedule-ui-context.tsx (selectedEmployeeId)
 * Connected to: use-employee-roster.ts (roster CRUD + auto-fill)
 * Connected to: use-employees.ts (employee data)
 * Connected to: use-shifts.ts (shift data for stats)
 */

import React, { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Calendar, Clock, Edit2, Save, Wand2, X, BarChart3, CalendarDays } from "lucide-react";

import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

import type { ScheduleEmployee } from "../_hooks/use-employees";
import {
  useRoster,
  useUpsertRoster,
  useAutoFillShifts,
  WEEKDAYS,
  WEEKDAY_LABELS,
  emptyPattern,
  type RosterPattern,
} from "../_hooks/use-employee-roster";
import { useShifts } from "../_hooks/use-shifts";
import { useAbsences } from "../_hooks/use-absences";
import { useWeekRange } from "../_hooks/use-week-range";
import type { Shift, Absence } from "./schedule-types";

// ── Props ─────────────────────────────────────────────────────

type EmployeeDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee: ScheduleEmployee | null;
};

// ── Component ─────────────────────────────────────────────────

export function EmployeeDrawer({ open, onOpenChange, employee }: EmployeeDrawerProps) {
  const { isDark } = useContext(DashboardContext);
  const { weekStart, weekEnd } = useWeekRange();

  // Roster data
  const { data: roster, isLoading: rosterLoading } = useRoster(employee?.id ?? null);
  const upsertRoster = useUpsertRoster();
  const autoFill = useAutoFillShifts();

  // Shift/absence data for stats
  const { data: shiftsData } = useShifts(weekStart, weekEnd);
  const { data: absencesData } = useAbsences(weekStart, weekEnd);

  // Local editing state
  const [isEditing, setIsEditing] = useState(false);
  const [editPattern, setEditPattern] = useState<RosterPattern>(emptyPattern());
  const [editPeriodStart, setEditPeriodStart] = useState("");
  const [editPeriodEnd, setEditPeriodEnd] = useState("");

  // Sync local state when roster data loads or employee changes
  useEffect(() => {
    if (roster) {
      setEditPattern(roster.pattern);
      setEditPeriodStart(roster.periodStart);
      setEditPeriodEnd(roster.periodEnd ?? "");
    } else {
      setEditPattern(emptyPattern());
      setEditPeriodStart(new Date().toISOString().slice(0, 10));
      setEditPeriodEnd("");
    }
    setIsEditing(false);
  }, [roster, employee?.id]);

  // Employee stats for current week
  const stats = useMemo(() => {
    if (!employee || !shiftsData) return { weekHours: 0, monthShifts: 0, overtime: 0 };

    const empShifts = (shiftsData as Shift[]).filter((s) => s.employeeId === employee.id);
    const weekHours = empShifts.reduce((sum, s) => sum + s.workHours, 0);
    const contractedHours = 37.5;
    const overtime = Math.max(0, weekHours - contractedHours);

    // Count shifts this month
    const now = new Date();
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
    const monthShifts = empShifts.filter((s) => s.dateId >= monthStart).length;

    return { weekHours, monthShifts, overtime };
  }, [employee, shiftsData]);

  // Absence dates for availability calendar
  const absenceDates = useMemo(() => {
    if (!employee || !absencesData) return new Set<string>();
    return new Set(
      (absencesData as Absence[]).filter((a) => a.employeeId === employee.id).map((a) => a.dateId),
    );
  }, [employee, absencesData]);

  // Handlers
  const handlePatternChange = useCallback((day: keyof RosterPattern, value: string) => {
    setEditPattern((prev) => ({ ...prev, [day]: value || null }));
  }, []);

  const handleSave = useCallback(() => {
    if (!employee) return;
    upsertRoster.mutate(
      {
        id: roster?.id,
        profileId: employee.id,
        pattern: editPattern,
        periodStart: editPeriodStart,
        periodEnd: editPeriodEnd || null,
      },
      {
        onSuccess: () => setIsEditing(false),
      },
    );
  }, [employee, roster, editPattern, editPeriodStart, editPeriodEnd, upsertRoster]);

  const handleAutoFill = useCallback(() => {
    if (!employee) return;

    const endDate =
      editPeriodEnd ||
      (() => {
        // Default: 4 weeks from period start
        const d = new Date(editPeriodStart);
        d.setDate(d.getDate() + 28);
        return d.toISOString().slice(0, 10);
      })();

    autoFill.mutate({
      profileId: employee.id,
      pattern: editPattern,
      periodStart: editPeriodStart,
      periodEnd: endDate,
      role: employee.jobTitle || employee.role || "Ansatt",
    });
  }, [employee, editPattern, editPeriodStart, editPeriodEnd, autoFill]);

  if (!employee) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="border-border bg-background w-full p-0 sm:max-w-[460px]">
        <SheetHeader className="border-border border-b px-6 pt-6 pb-4">
          <SheetTitle className="flex items-center gap-3">
            <div
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xs font-black ${employee.avatarColor}`}
            >
              {employee.initials}
            </div>
            <div className="min-w-0">
              <div className="truncate text-base font-bold">{employee.name}</div>
              <SheetDescription className="text-xs text-zinc-500">
                {employee.jobTitle || employee.role}
                {employee.team ? ` · ${employee.team}` : ""}
              </SheetDescription>
            </div>
          </SheetTitle>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-7rem)]">
          <div className="space-y-6 px-6 py-5">
            {/* ── Turnus Section ─────────────────────────── */}
            <section>
              <div className="mb-3 flex items-center justify-between">
                <h3 className="flex items-center gap-2 text-xs font-bold tracking-widest text-zinc-500 uppercase">
                  <CalendarDays className="h-3.5 w-3.5" />
                  Turnus
                </h3>
                {isEditing ? (
                  <Button
                    size="sm"
                    variant="default"
                    className="h-7 gap-1.5 text-xs"
                    onClick={handleSave}
                    disabled={upsertRoster.isPending}
                  >
                    <Save className="h-3 w-3" />
                    {upsertRoster.isPending ? "Lagrer..." : "Lagre"}
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 gap-1.5 text-xs"
                    onClick={() => setIsEditing(true)}
                  >
                    <Edit2 className="h-3 w-3" />
                    Rediger
                  </Button>
                )}
              </div>

              {rosterLoading ? (
                <div className="flex h-24 items-center justify-center text-xs text-zinc-500">
                  Laster turnus...
                </div>
              ) : (
                <TurnusGrid
                  pattern={editPattern}
                  isEditing={isEditing}
                  onPatternChange={handlePatternChange}
                  isDark={isDark}
                />
              )}

              {/* Period selector */}
              <div className="mt-3 flex items-center gap-2 text-xs">
                <Clock className="h-3 w-3 text-zinc-500" />
                <span className="text-zinc-500">Periode:</span>
                {isEditing ? (
                  <>
                    <Input
                      type="date"
                      value={editPeriodStart}
                      onChange={(e) => setEditPeriodStart(e.target.value)}
                      className="h-7 w-[130px] text-xs"
                    />
                    <span className="text-zinc-500">&rarr;</span>
                    <Input
                      type="date"
                      value={editPeriodEnd}
                      onChange={(e) => setEditPeriodEnd(e.target.value)}
                      className="h-7 w-[130px] text-xs"
                      placeholder="Løpende"
                    />
                  </>
                ) : (
                  <span className="font-medium">
                    {editPeriodStart ? formatDateNb(editPeriodStart) : "Ikke satt"}
                    {" → "}
                    {editPeriodEnd ? formatDateNb(editPeriodEnd) : "Løpende"}
                  </span>
                )}
              </div>
            </section>

            <Separator className="bg-border" />

            {/* ── Availability Calendar ─────────────────── */}
            <section>
              <h3 className="mb-3 flex items-center gap-2 text-xs font-bold tracking-widest text-zinc-500 uppercase">
                <Calendar className="h-3.5 w-3.5" />
                Tilgjengelighet
              </h3>
              <AvailabilityCalendar
                absenceDates={absenceDates}
                pattern={editPattern}
                isDark={isDark}
              />
            </section>

            <Separator className="bg-border" />

            {/* ── Auto-fill Button ──────────────────────── */}
            <section>
              <Button
                variant="outline"
                className="w-full gap-2"
                onClick={handleAutoFill}
                disabled={autoFill.isPending || !hasAnyShift(editPattern)}
              >
                <Wand2 className="h-4 w-4" />
                {autoFill.isPending ? "Oppretter vakter..." : "Auto-fyll vakter for periode"}
              </Button>
            </section>

            <Separator className="bg-border" />

            {/* ── Statistics ────────────────────────────── */}
            <section>
              <h3 className="mb-3 flex items-center gap-2 text-xs font-bold tracking-widest text-zinc-500 uppercase">
                <BarChart3 className="h-3.5 w-3.5" />
                Statistikk
              </h3>
              <div className="grid grid-cols-3 gap-3">
                <StatCard
                  label="Timer denne uken"
                  value={`${stats.weekHours.toFixed(1)}/37.5`}
                  isDark={isDark}
                />
                <StatCard
                  label="Vakter denne mnd"
                  value={String(stats.monthShifts)}
                  isDark={isDark}
                />
                <StatCard
                  label="Overtid"
                  value={`${stats.overtime.toFixed(1)}t`}
                  warn={stats.overtime > 0}
                  isDark={isDark}
                />
              </div>
            </section>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

// ── TurnusGrid — weekday × time editor ────────────────────────

function TurnusGrid({
  pattern,
  isEditing,
  onPatternChange,
  isDark,
}: {
  pattern: RosterPattern;
  isEditing: boolean;
  onPatternChange: (day: keyof RosterPattern, value: string) => void;
  isDark: boolean;
}) {
  return (
    <div className="grid grid-cols-7 gap-1.5">
      {WEEKDAYS.map((day) => {
        const timeRange = pattern[day];
        const [start, end] = timeRange ? timeRange.split("-") : ["", ""];
        const isWeekend = day === "sat" || day === "sun";

        return (
          <div
            key={day}
            className={`flex flex-col items-center rounded-lg border p-2 ${
              timeRange ? "border-orange-500/20 bg-orange-500/5" : "border-border bg-muted/50"
            } ${isWeekend && !timeRange ? "opacity-50" : ""}`}
          >
            <span
              className={`text-muted-foreground mb-1 text-[10px] font-bold tracking-widest uppercase`}
            >
              {WEEKDAY_LABELS[day]}
            </span>

            {isEditing ? (
              <div className="flex flex-col items-center gap-0.5">
                <Input
                  type="time"
                  value={start ?? ""}
                  onChange={(e) => {
                    const newEnd = end || "16:00";
                    onPatternChange(day, e.target.value ? `${e.target.value}-${newEnd}` : "");
                  }}
                  className="h-6 w-full border-none bg-transparent p-0 text-center text-[10px] shadow-none focus-visible:ring-0"
                />
                <Input
                  type="time"
                  value={end ?? ""}
                  onChange={(e) => {
                    const newStart = start || "08:00";
                    onPatternChange(day, e.target.value ? `${newStart}-${e.target.value}` : "");
                  }}
                  className="h-6 w-full border-none bg-transparent p-0 text-center text-[10px] shadow-none focus-visible:ring-0"
                />
                {timeRange && (
                  <button
                    onClick={() => onPatternChange(day, "")}
                    className="mt-0.5 text-[9px] text-red-400 hover:text-red-300"
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                )}
              </div>
            ) : (
              <span className="text-[11px] font-semibold">
                {timeRange ? (
                  <>
                    {start}
                    <br />
                    {end}
                  </>
                ) : (
                  <span className="text-zinc-600">&mdash;</span>
                )}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── AvailabilityCalendar — 4-week mini calendar ───────────────

function AvailabilityCalendar({
  absenceDates,
  pattern,
  isDark,
}: {
  absenceDates: Set<string>;
  pattern: RosterPattern;
  isDark: boolean;
}) {
  // Show current week + 3 more weeks
  const weeks = useMemo(() => {
    const result: Array<{ date: Date; dateStr: string }[]> = [];
    const today = new Date();
    // Find Monday of current week
    const dayOfWeek = today.getDay();
    const monday = new Date(today);
    monday.setDate(today.getDate() - ((dayOfWeek + 6) % 7));

    for (let week = 0; week < 4; week++) {
      const weekDays: Array<{ date: Date; dateStr: string }> = [];
      for (let d = 0; d < 7; d++) {
        const date = new Date(monday);
        date.setDate(monday.getDate() + week * 7 + d);
        weekDays.push({
          date,
          dateStr: date.toISOString().slice(0, 10),
        });
      }
      result.push(weekDays);
    }
    return result;
  }, []);

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-1">
      {/* Header */}
      <div className="grid grid-cols-7 gap-1">
        {WEEKDAYS.map((day) => (
          <div
            key={day}
            className="text-center text-[9px] font-bold tracking-widest text-zinc-500 uppercase"
          >
            {WEEKDAY_LABELS[day]}
          </div>
        ))}
      </div>

      {/* Week rows */}
      {weeks.map((week, wi) => (
        <div key={wi} className="grid grid-cols-7 gap-1">
          {week.map(({ dateStr }) => {
            const isAbsent = absenceDates.has(dateStr);
            const isToday = dateStr === today;
            const dayIndex = new Date(dateStr).getDay();
            const weekdayKey = (["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const)[
              dayIndex
            ]!;
            const hasShift = !!pattern[weekdayKey];

            return (
              <div
                key={dateStr}
                className={`flex h-7 items-center justify-center rounded text-[10px] font-medium ${
                  isAbsent
                    ? "bg-red-500/20 text-red-400"
                    : hasShift
                      ? "bg-emerald-500/10 text-emerald-400"
                      : "bg-muted/50 text-muted-foreground"
                } ${isToday ? "ring-1 ring-orange-500" : ""}`}
                title={isAbsent ? "Fravær" : hasShift ? `Turnus: ${pattern[weekdayKey]}` : "Fri"}
              >
                {parseInt(dateStr.slice(8, 10), 10)}
              </div>
            );
          })}
        </div>
      ))}

      {/* Legend */}
      <div className="flex items-center gap-4 pt-1 text-[10px] text-zinc-500">
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-sm bg-emerald-500/30" /> Turnus
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-sm bg-red-500/30" /> Fravær
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-sm bg-white/5" /> Fri
        </span>
      </div>
    </div>
  );
}

// ── StatCard ──────────────────────────────────────────────────

function StatCard({
  label,
  value,
  warn,
  isDark,
}: {
  label: string;
  value: string;
  warn?: boolean;
  isDark: boolean;
}) {
  return (
    <div className="border-border bg-muted/50 rounded-lg border p-3">
      <div className="text-muted-foreground text-[10px] font-medium tracking-wide uppercase">
        {label}
      </div>
      <div className={`mt-1 text-lg font-bold ${warn ? "text-red-400" : "text-foreground"}`}>
        {value}
      </div>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────

function hasAnyShift(pattern: RosterPattern): boolean {
  return WEEKDAYS.some((day) => !!pattern[day]);
}

function formatDateNb(dateStr: string): string {
  const [y, m, d] = dateStr.split("-");
  return `${d}.${m}`;
}
