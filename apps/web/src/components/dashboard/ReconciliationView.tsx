"use client";

import React, { useState } from "react";
import {
  Calendar,
  Clock,
  ChevronLeft,
  ChevronRight,
  Building2,
  Users,
  AlertCircle,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useDepartmentShifts } from "@/app/dashboard/_hooks";
import type { DepartmentShiftGroup } from "@/app/dashboard/_hooks/dashboard-types";

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-GB", { weekday: "short", month: "short", day: "numeric" });
}

function getDateOffset(offset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().split("T")[0]!;
}

export function ReconciliationView({ isDark }: { isDark: boolean }) {
  const [dateOffset, setDateOffset] = useState(0);
  const selectedDate = getDateOffset(dateOffset);
  const [expandedDept, setExpandedDept] = useState<string | null>(null);

  const { data: departments, isLoading } = useDepartmentShifts(selectedDate);

  return (
    <div className="animate-in fade-in flex min-h-0 min-w-0 flex-1 flex-col gap-6 overflow-y-auto pr-2 pb-6 duration-500">
      {/* Header */}
      <div className="flex flex-shrink-0 flex-col justify-between gap-4 pt-2 md:flex-row md:items-center">
        <div>
          <h1
            className={`text-2xl font-black tracking-tight ${isDark ? "text-zinc-100" : "text-zinc-900"}`}
          >
            Daily Reconciliation
          </h1>
          <p className={`text-sm ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>
            Review shifts and hours by department for sign-off.
          </p>
        </div>

        {/* Date Navigation */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setDateOffset((o) => o - 1)}
            className={`rounded-lg border p-2 transition-colors ${isDark ? "border-zinc-700 text-zinc-400 hover:bg-zinc-800" : "border-zinc-200 text-zinc-500 hover:bg-zinc-50"}`}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div
            className={`flex items-center gap-2 rounded-xl border px-4 py-2 ${isDark ? "border-zinc-800 bg-[#0c0c0e]" : "border-zinc-200 bg-white shadow-sm"}`}
          >
            <Calendar className={`h-4 w-4 ${isDark ? "text-zinc-400" : "text-zinc-500"}`} />
            <span className={`text-sm font-bold ${isDark ? "text-zinc-200" : "text-zinc-800"}`}>
              {formatDate(selectedDate)}
            </span>
          </div>
          <button
            onClick={() => setDateOffset((o) => o + 1)}
            className={`rounded-lg border p-2 transition-colors ${isDark ? "border-zinc-700 text-zinc-400 hover:bg-zinc-800" : "border-zinc-200 text-zinc-500 hover:bg-zinc-50"}`}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          {dateOffset !== 0 && (
            <button
              onClick={() => setDateOffset(0)}
              className={`rounded-lg px-3 py-2 text-xs font-semibold ${isDark ? "text-zinc-400 hover:text-zinc-200" : "text-zinc-500 hover:text-zinc-700"}`}
            >
              Today
            </button>
          )}
        </div>
      </div>

      {/* Department Cards */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className={`h-40 animate-pulse rounded-2xl border ${isDark ? "border-zinc-800 bg-zinc-900/50" : "border-zinc-200 bg-zinc-50"}`}
            />
          ))}
        </div>
      ) : departments && departments.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {departments.map((dept) => (
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
      ) : (
        <div
          className={`flex flex-1 items-center justify-center rounded-2xl border-2 border-dashed p-12 ${isDark ? "border-zinc-800" : "border-zinc-200"}`}
        >
          <div className="text-center">
            <Building2
              className={`mx-auto mb-3 h-8 w-8 opacity-20 ${isDark ? "text-white" : "text-black"}`}
            />
            <p className={`font-semibold ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>
              No shifts scheduled for {formatDate(selectedDate)}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

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
          : "border-zinc-200 bg-white hover:border-zinc-300"
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
            <h3 className={`text-lg font-bold ${isDark ? "text-zinc-100" : "text-zinc-900"}`}>
              {dept.departmentName}
            </h3>
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
            <div
              className={`text-xs font-semibold uppercase ${isDark ? "text-zinc-500" : "text-zinc-400"}`}
            >
              Staff
            </div>
            <div className="flex items-center gap-1">
              <Users className={`h-3.5 w-3.5 ${isDark ? "text-zinc-400" : "text-zinc-500"}`} />
              <span className={`text-lg font-black ${isDark ? "text-white" : "text-zinc-900"}`}>
                {dept.staffCount}
              </span>
            </div>
          </div>
          <div>
            <div
              className={`text-xs font-semibold uppercase ${isDark ? "text-zinc-500" : "text-zinc-400"}`}
            >
              Shifts
            </div>
            <span className={`text-lg font-black ${isDark ? "text-white" : "text-zinc-900"}`}>
              {dept.shifts.length}
            </span>
          </div>
          <div>
            <div
              className={`text-xs font-semibold uppercase ${isDark ? "text-zinc-500" : "text-zinc-400"}`}
            >
              Hours
            </div>
            <span className={`text-lg font-black ${isDark ? "text-white" : "text-zinc-900"}`}>
              {dept.totalHours.toFixed(1)}
            </span>
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
              className={`border-t px-5 py-3 ${isDark ? "border-zinc-800 bg-zinc-900/30" : "border-zinc-200 bg-zinc-50"}`}
            >
              <h4
                className={`mb-2 text-xs font-bold tracking-wider uppercase ${isDark ? "text-zinc-500" : "text-zinc-400"}`}
              >
                Shifts & Hours
              </h4>
              <div className="space-y-2">
                {dept.shifts.map((shift) => (
                  <div key={shift.shiftId} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <Clock
                        className={`h-3.5 w-3.5 ${isDark ? "text-zinc-500" : "text-zinc-400"}`}
                      />
                      <span className={isDark ? "text-zinc-300" : "text-zinc-700"}>
                        {shift.startTime} - {shift.endTime}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`text-xs ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>
                        {shift.role}
                      </span>
                      <span className={`font-bold ${isDark ? "text-zinc-200" : "text-zinc-800"}`}>
                        {shift.workHours}h
                      </span>
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
