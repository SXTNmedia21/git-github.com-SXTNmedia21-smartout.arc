"use client";

import React, { useState, useMemo } from "react";
import {
  Calendar,
  Clock,
  ChevronLeft,
  ChevronRight,
  Building2,
  Users,
  AlertCircle,
  Check,
  X,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { useDepartmentShifts } from "@/app/dashboard/_hooks";
import type { DepartmentShiftGroup } from "@/app/dashboard/_hooks/dashboard-types";
import {
  SwipeReconciliation,
  type ShiftForReview,
} from "@/components/dashboard/SwipeReconciliation";

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-GB", { weekday: "short", month: "short", day: "numeric" });
}

function getDateOffset(offset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().split("T")[0]!;
}

function formatTime(time: string): string {
  if (!time || time === "—") return "—";
  const parts = time.split("T");
  const timePart = parts[1] ?? parts[0] ?? time;
  return timePart.slice(0, 5);
}

type ViewMode = "table" | "swipe" | "cards";

export function ReconciliationView({ isDark }: { isDark: boolean }) {
  const [dateOffset, setDateOffset] = useState(0);
  const selectedDate = getDateOffset(dateOffset);
  const [expandedDept, setExpandedDept] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("table");

  const { data: departments, isLoading } = useDepartmentShifts(selectedDate);

  // Flatten all shifts for table and swipe views
  const flatShifts = useMemo<ShiftForReview[]>(() => {
    if (!departments) return [];
    return departments.flatMap((dept) =>
      dept.shifts.map((s) => ({
        id: s.shiftId,
        employee_name: s.employeeName ?? "Unassigned",
        department_name: dept.departmentName,
        department_color: dept.departmentColor ?? "#6366f1",
        role: s.role ?? "—",
        start_time: s.startTime ?? "—",
        end_time: s.endTime ?? "—",
        work_hours: s.workHours ?? 0,
      })),
    );
  }, [departments]);

  return (
    <div className="animate-in fade-in flex min-h-0 min-w-0 flex-1 flex-col gap-6 overflow-y-auto pr-2 pb-6 duration-500">
      {/* Header */}
      <div className="flex flex-shrink-0 flex-col justify-between gap-4 pt-2 md:flex-row md:items-center">
        <div>
          <h1 className="text-foreground text-2xl font-black tracking-tight">
            Daily Reconciliation
          </h1>
          <p className="text-muted-foreground text-sm">
            Review shifts and hours by department for sign-off.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* View Toggle */}
          <div className="bg-muted/50 flex items-center gap-1 rounded-lg p-1">
            <button
              onClick={() => setViewMode("table")}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                viewMode === "table"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground"
              }`}
            >
              Table
            </button>
            <button
              onClick={() => setViewMode("swipe")}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                viewMode === "swipe"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground"
              }`}
            >
              Swipe
            </button>
            <button
              onClick={() => setViewMode("cards")}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                viewMode === "cards"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground"
              }`}
            >
              Cards
            </button>
          </div>

          {/* Date Navigation */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setDateOffset((o) => o - 1)}
              className="border-border text-muted-foreground hover:bg-muted/50 rounded-lg border p-2 transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div
              className={`flex items-center gap-2 rounded-xl border px-4 py-2 ${isDark ? "border-zinc-800 bg-[#0c0c0e]" : "border-border bg-background shadow-sm"}`}
            >
              <Calendar className="text-muted-foreground h-4 w-4" />
              <span className="text-foreground text-sm font-bold">{formatDate(selectedDate)}</span>
            </div>
            <button
              onClick={() => setDateOffset((o) => o + 1)}
              className="border-border text-muted-foreground hover:bg-muted/50 rounded-lg border p-2 transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            {dateOffset !== 0 && (
              <button
                onClick={() => setDateOffset(0)}
                className="text-muted-foreground hover:text-foreground rounded-lg px-3 py-2 text-xs font-semibold"
              >
                Today
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <LoadingSkeleton isDark={isDark} />
      ) : !departments || departments.length === 0 ? (
        <EmptyState selectedDate={selectedDate} />
      ) : viewMode === "table" ? (
        <ShiftTable departments={departments} isDark={isDark} />
      ) : viewMode === "swipe" ? (
        <SwipeReconciliation
          shifts={flatShifts}
          onApprove={(id) => toast.success(`Shift ${id.slice(0, 8)} approved`)}
          onReject={(id) => toast.error(`Shift ${id.slice(0, 8)} flagged`)}
          isDark={isDark}
        />
      ) : (
        /* Cards view — original department card grid */
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {departments.map((dept: DepartmentShiftGroup) => (
            <DepartmentCard
              key={dept.departmentId}
              dept={dept}
              isDark={isDark}
              isExpanded={expandedDept === dept.departmentId}
              onToggle={() =>
                setExpandedDept((prev) => (prev === dept.departmentId ? null : dept.departmentId))
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------- Table View ---------- */

function ShiftTable({
  departments,
  isDark,
}: {
  departments: DepartmentShiftGroup[];
  isDark: boolean;
}) {
  return (
    <div className="border-border overflow-x-auto rounded-xl border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-border text-muted-foreground border-b text-left text-[11px] tracking-wider uppercase">
            <th className="px-4 py-3">Employee</th>
            <th className="px-4 py-3">Department</th>
            <th className="px-4 py-3">Role</th>
            <th className="px-4 py-3">Shift</th>
            <th className="px-4 py-3 text-right">Hours</th>
            <th className="px-4 py-3 text-center">Action</th>
          </tr>
        </thead>
        <tbody>
          {departments.flatMap((dept) =>
            dept.shifts.map((shift) => (
              <tr
                key={shift.shiftId}
                className="border-border/50 hover:bg-muted/30 border-b transition-colors"
              >
                {/* Employee */}
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <div
                      className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                      style={{ backgroundColor: dept.departmentColor ?? "#6366f1" }}
                    >
                      {(shift.employeeName ?? "?")
                        .split(" ")
                        .map((n) => n[0])
                        .join("")
                        .toUpperCase()
                        .slice(0, 2)}
                    </div>
                    <span className="text-foreground font-medium">
                      {shift.employeeName ?? "Unassigned"}
                    </span>
                  </div>
                </td>

                {/* Department */}
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    {dept.departmentColor && (
                      <div
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: dept.departmentColor }}
                      />
                    )}
                    <span className="text-muted-foreground">{dept.departmentName}</span>
                  </div>
                </td>

                {/* Role */}
                <td className="text-muted-foreground px-4 py-3">{shift.role}</td>

                {/* Shift time */}
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    <Clock className="text-muted-foreground h-3.5 w-3.5" />
                    <span className="text-foreground">
                      {formatTime(shift.startTime)} - {formatTime(shift.endTime)}
                    </span>
                  </div>
                </td>

                {/* Hours */}
                <td className="text-foreground px-4 py-3 text-right font-bold">
                  {shift.workHours.toFixed(1)}h
                </td>

                {/* Action */}
                <td className="px-4 py-3">
                  <div className="flex items-center justify-center gap-1.5">
                    <button
                      onClick={() => toast.success(`Shift ${shift.shiftId.slice(0, 8)} approved`)}
                      className={`rounded-lg p-1.5 transition-colors ${
                        isDark
                          ? "text-emerald-400 hover:bg-emerald-500/10"
                          : "text-emerald-600 hover:bg-emerald-50"
                      }`}
                      title="Approve"
                    >
                      <Check className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => toast.error(`Shift ${shift.shiftId.slice(0, 8)} flagged`)}
                      className={`rounded-lg p-1.5 transition-colors ${
                        isDark ? "text-red-400 hover:bg-red-500/10" : "text-red-600 hover:bg-red-50"
                      }`}
                      title="Flag"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            )),
          )}
        </tbody>
      </table>

      {/* Summary footer */}
      <div className="border-border flex items-center justify-between border-t px-4 py-3">
        <span className="text-muted-foreground text-xs font-semibold">
          {departments.reduce((sum, d) => sum + d.shifts.length, 0)} shifts across{" "}
          {departments.length} departments
        </span>
        <span className="text-foreground text-xs font-bold">
          {departments.reduce((sum, d) => sum + d.totalHours, 0).toFixed(1)}h total
        </span>
      </div>
    </div>
  );
}

/* ---------- Department Card (original view) ---------- */

function DepartmentCard({
  dept,
  isDark,
  isExpanded,
  onToggle,
}: {
  dept: DepartmentShiftGroup;
  isDark: boolean;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const unassigned = dept.shifts.filter((s) => !s.employeeId).length;

  return (
    <motion.div
      layout
      className={`cursor-pointer overflow-hidden rounded-2xl border transition-colors ${
        isDark
          ? "border-zinc-800 bg-[#0c0c0e] hover:border-zinc-700"
          : "border-border bg-background hover:border-border/80"
      }`}
      onClick={onToggle}
    >
      <div className="p-5">
        <div className="mb-3 flex items-start justify-between">
          <div className="flex items-center gap-2">
            {dept.departmentColor && (
              <div
                className="h-3 w-3 rounded-full"
                style={{ backgroundColor: dept.departmentColor }}
              />
            )}
            <h3 className="text-foreground text-lg font-bold">{dept.departmentName}</h3>
          </div>
          {unassigned > 0 && (
            <span
              className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold ${isDark ? "bg-orange-500/15 text-orange-400" : "bg-orange-50 text-orange-600"}`}
            >
              <AlertCircle className="h-3 w-3" /> {unassigned} open
            </span>
          )}
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <div className="text-muted-foreground text-xs font-semibold uppercase">Staff</div>
            <div className="flex items-center gap-1">
              <Users className="text-muted-foreground h-3.5 w-3.5" />
              <span className="text-foreground text-lg font-black">{dept.staffCount}</span>
            </div>
          </div>
          <div>
            <div className="text-muted-foreground text-xs font-semibold uppercase">Shifts</div>
            <span className="text-foreground text-lg font-black">{dept.shifts.length}</span>
          </div>
          <div>
            <div className="text-muted-foreground text-xs font-semibold uppercase">Hours</div>
            <span className="text-foreground text-lg font-black">{dept.totalHours.toFixed(1)}</span>
          </div>
        </div>
      </div>

      {/* Expandable Shift List */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div
              className={`border-t px-5 py-3 ${isDark ? "border-zinc-800 bg-zinc-900/30" : "border-border bg-muted/30"}`}
            >
              <h4 className="text-muted-foreground mb-2 text-xs font-bold tracking-wider uppercase">
                Shifts & Hours
              </h4>
              <div className="space-y-2">
                {dept.shifts.map((shift) => (
                  <div key={shift.shiftId} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <Clock className="text-muted-foreground h-3.5 w-3.5" />
                      <span className="text-foreground">
                        {shift.startTime} - {shift.endTime}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-muted-foreground text-xs">{shift.role}</span>
                      <span className="text-foreground font-bold">{shift.workHours}h</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/* ---------- Loading / Empty ---------- */

function LoadingSkeleton({ isDark }: { isDark: boolean }) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className={`h-40 animate-pulse rounded-2xl border ${isDark ? "border-zinc-800 bg-zinc-900/50" : "border-border bg-muted/30"}`}
        />
      ))}
    </div>
  );
}

function EmptyState({ selectedDate }: { selectedDate: string }) {
  return (
    <div className="border-border flex flex-1 items-center justify-center rounded-2xl border-2 border-dashed p-12">
      <div className="text-center">
        <Building2 className="text-muted-foreground mx-auto mb-3 h-8 w-8 opacity-20" />
        <p className="text-muted-foreground font-semibold">
          No shifts scheduled for {formatDate(selectedDate)}
        </p>
      </div>
    </div>
  );
}
