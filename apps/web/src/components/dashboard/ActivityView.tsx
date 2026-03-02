"use client";

import React, { useState, useMemo } from "react";
import {
  Activity,
  Users,
  MapPin,
  Building2,
  Network,
  Filter,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useWorkforcePipeline, useTrainingReadiness } from "@/app/dashboard/_hooks";

type TimeRange = "today" | "7d" | "14d" | "30d" | "90d";

const RANGE_OPTIONS: { id: TimeRange; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "7d", label: "7d" },
  { id: "14d", label: "14d" },
  { id: "30d", label: "30d" },
  { id: "90d", label: "90d" },
];

const RANGE_DAYS: Record<TimeRange, number> = {
  today: 1,
  "7d": 7,
  "14d": 14,
  "30d": 30,
  "90d": 90,
};

// Helper to generate mock heatmap data
const generateHeatmapData = (labels: string[], numDays: number) => {
  return labels.map((label) => ({
    id: label.toLowerCase().replace(/\s+/g, "-"),
    label,
    data: Array.from({ length: numDays }, () => Math.floor(Math.random() * 100)),
  }));
};

const LOCATION_LABELS = [
  "Baardshaug Vegkro",
  "Trondheim City",
  "Oslo S Kiosk",
  "Lillehammer Diner",
  "Stavanger FNB",
];
const DEPARTMENT_LABELS = ["Kjokken", "Servering", "Oppvask", "Renhold", "Lager", "Sikkerhet"];
const TEAM_LABELS = [
  "Morgenfuglene",
  "Kveldsgjengen",
  "Helgeteamet",
  "Sommervikarer",
  "VIP Catering",
];
const EMPLOYEE_LABELS = [
  "Anna Olsen",
  "Ola Nordmann",
  "Kari Svendsen",
  "Jens Hansen",
  "Bente Johansen",
  "Svein Eide",
  "Linda Bakken",
  "Per Lie",
  "Marianne Berg",
  "Knut Lunde",
];

const TAB_LABELS: Record<string, string[]> = {
  locations: LOCATION_LABELS,
  departments: DEPARTMENT_LABELS,
  teams: TEAM_LABELS,
  employees: EMPLOYEE_LABELS,
};

/** Generate day column labels based on range */
const getDayLabels = (days: number): { index: number; label: string }[] => {
  if (days <= 1) return [{ index: 0, label: "1" }];
  const step = days <= 7 ? 1 : days <= 14 ? 2 : days <= 30 ? 5 : 10;
  const labels: { index: number; label: string }[] = [];
  for (let i = 0; i < days; i += step) {
    labels.push({ index: i, label: String(i + 1) });
  }
  // Always include the last day
  if (labels[labels.length - 1]?.index !== days - 1) {
    labels.push({ index: days - 1, label: String(days) });
  }
  return labels;
};

export function ActivityView({ isDark }: { isDark: boolean }) {
  const [activeTab, setActiveTab] = useState<"locations" | "departments" | "teams" | "employees">(
    "locations",
  );
  const [timeRange, setTimeRange] = useState<TimeRange>("30d");
  const days = RANGE_DAYS[timeRange];

  const { data: pipeline } = useWorkforcePipeline();
  const { data: training } = useTrainingReadiness();

  const activeData = useMemo(() => {
    const labels = TAB_LABELS[activeTab] ?? LOCATION_LABELS;
    return generateHeatmapData(labels, days);
  }, [activeTab, days]);

  const dayLabels = useMemo(() => getDayLabels(days), [days]);

  const getIntensityClass = (val: number, dark: boolean) => {
    if (val === 0) return dark ? "bg-muted/30" : "bg-muted";
    if (val < 20) return dark ? "bg-indigo-500/10" : "bg-indigo-100";
    if (val < 40) return dark ? "bg-indigo-500/30" : "bg-indigo-200";
    if (val < 60) return dark ? "bg-indigo-500/50" : "bg-indigo-300";
    if (val < 80) return dark ? "bg-indigo-500/80" : "bg-indigo-400";
    return "bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.5)]";
  };

  return (
    <div className="animate-in fade-in flex min-h-0 min-w-0 flex-1 flex-col gap-6 overflow-y-auto pr-2 pb-6 duration-500">
      {/* Header */}
      <div className="flex flex-shrink-0 flex-col justify-between gap-4 pt-2 md:flex-row md:items-center">
        <div>
          <h1 className="text-foreground flex items-center gap-3 text-2xl font-black tracking-tight">
            <div
              className={`rounded-xl p-2 ${isDark ? "bg-indigo-500/20 text-indigo-400 shadow-[0_0_20px_rgba(99,102,241,0.2)]" : "bg-indigo-100 text-indigo-600"}`}
            >
              <Activity className="h-5 w-5" />
            </div>
            Activity & Heatmap Dashboard
          </h1>
          <p className="text-muted-foreground mt-1 max-w-2xl text-sm">
            Visualize cross-cutting activity, load and intensity across the business.
          </p>
        </div>

        <div className="relative z-20 flex items-center gap-2">
          <button className="border-border bg-background text-foreground hover:bg-muted flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-bold transition-all">
            <Filter className="h-4 w-4" /> Filter
          </button>
          <div className="bg-muted/50 flex items-center gap-1 rounded-lg p-1">
            {RANGE_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                onClick={() => setTimeRange(opt.id)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                  timeRange === opt.id
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <StatCard
          isDark={isDark}
          title="Active Staff"
          value={pipeline ? String(pipeline.activeStaff) : "--"}
          trend={pipeline ? `+${pipeline.newHires30d} new` : ""}
          isPositive={true}
          subtitle="Currently employed"
        />
        <StatCard
          isDark={isDark}
          title="Training Readiness"
          value={training ? `${training.readinessPercent}%` : "--"}
          trend={training ? `${training.completed}/${training.totalAssignments}` : ""}
          isPositive={!training || training.readinessPercent >= 80}
          subtitle="Protocol completion"
        />
        <StatCard
          isDark={isDark}
          title="Highest Intensity"
          value="Fridays"
          trend="Kveldsgjengen"
          isPositive={true}
          subtitle="Most active"
        />
        <StatCard
          isDark={isDark}
          title="Lowest Intensity"
          value="Sunday AM"
          trend="-5.2%"
          isPositive={false}
          subtitle="Below budget threshold"
        />
      </div>

      {/* Training Progress Section */}
      {training && training.totalAssignments > 0 && (
        <div className="border-border bg-background rounded-2xl border p-5 shadow-sm">
          <h3 className="text-muted-foreground mb-4 text-sm font-bold tracking-widest uppercase">
            Training Progress
          </h3>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="flex h-4 overflow-hidden rounded-full">
                <div
                  className="bg-emerald-500 transition-all duration-700"
                  style={{
                    width: `${(training.completed / training.totalAssignments) * 100}%`,
                  }}
                />
                <div
                  className="bg-amber-500 transition-all duration-700"
                  style={{
                    width: `${(training.pending / training.totalAssignments) * 100}%`,
                  }}
                />
                <div className="bg-muted flex-1" />
              </div>
            </div>
            <div className="flex gap-4 text-xs font-semibold">
              <span className="flex items-center gap-1">
                <div className="h-2 w-2 rounded-full bg-emerald-500" />
                Completed ({training.completed})
              </span>
              <span className="flex items-center gap-1">
                <div className="h-2 w-2 rounded-full bg-amber-500" />
                Pending ({training.pending})
              </span>
              {training.expired > 0 && (
                <span className="flex items-center gap-1">
                  <div className="bg-muted-foreground/40 h-2 w-2 rounded-full" />
                  Expired ({training.expired})
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tabs for Heatmap Categories */}
      <div className="mt-4">
        <div className="border-border bg-muted inline-flex rounded-2xl border p-1.5 shadow-sm">
          <TabBtn
            active={activeTab === "locations"}
            onClick={() => setActiveTab("locations")}
            icon={<MapPin className="h-4 w-4" />}
            label="Locations"
            isDark={isDark}
          />
          <TabBtn
            active={activeTab === "departments"}
            onClick={() => setActiveTab("departments")}
            icon={<Building2 className="h-4 w-4" />}
            label="Departments"
            isDark={isDark}
          />
          <TabBtn
            active={activeTab === "teams"}
            onClick={() => setActiveTab("teams")}
            icon={<Network className="h-4 w-4" />}
            label="Teams"
            isDark={isDark}
          />
          <TabBtn
            active={activeTab === "employees"}
            onClick={() => setActiveTab("employees")}
            icon={<Users className="h-4 w-4" />}
            label="Users"
            isDark={isDark}
          />
        </div>
      </div>

      {/* The Heatmap Visualizer */}
      <div className="border-border bg-background flex flex-1 flex-col overflow-hidden rounded-3xl border shadow-sm">
        {/* Heatmap Legend */}
        <div className="border-border bg-muted/50 flex flex-wrap items-center justify-between gap-4 border-b p-4">
          <h3 className="text-foreground flex items-center gap-2 text-lg font-bold">
            <Layers className="h-5 w-5 opacity-50" />
            {activeTab === "locations"
              ? "Location Intensity"
              : activeTab === "departments"
                ? "Department Intensity"
                : activeTab === "teams"
                  ? "Team Intensity"
                  : "User Intensity"}
            {/* TODO: Replace with real activity scoring algorithm */}
          </h3>

          <div className="flex items-center gap-2 text-xs font-semibold">
            <span className="text-muted-foreground">Quiet</span>
            <div className="mx-2 flex gap-1">
              <div className={`h-4 w-4 rounded-sm ${isDark ? "bg-muted/30" : "bg-muted"}`} />
              <div
                className={`h-4 w-4 rounded-sm ${isDark ? "bg-indigo-500/10" : "bg-indigo-100"}`}
              />
              <div
                className={`h-4 w-4 rounded-sm ${isDark ? "bg-indigo-500/30" : "bg-indigo-200"}`}
              />
              <div
                className={`h-4 w-4 rounded-sm ${isDark ? "bg-indigo-500/50" : "bg-indigo-300"}`}
              />
              <div
                className={`h-4 w-4 rounded-sm ${isDark ? "bg-indigo-500/80" : "bg-indigo-400"}`}
              />
              <div className="h-4 w-4 rounded-sm bg-indigo-500" />
            </div>
            <span className="text-muted-foreground">High</span>
          </div>
        </div>

        {/* Heatmap Grid container */}
        <div className="flex-1 overflow-x-auto p-4">
          <div className="min-w-fit">
            {/* Days Header */}
            <div className="mb-1 flex items-end">
              <div className="w-20 flex-shrink-0" />
              <div className="relative flex gap-0.5" style={{ width: `${days * 16}px` }}>
                {dayLabels.map((d) => (
                  <span
                    key={d.index}
                    className="text-muted-foreground absolute text-[10px] font-medium"
                    style={{ left: `${d.index * 16}px`, width: "14px", textAlign: "center" }}
                  >
                    {d.label}
                  </span>
                ))}
              </div>
            </div>

            {/* Rows */}
            <AnimatePresence mode="popLayout" initial={false}>
              {activeData.map((row) => (
                <motion.div
                  key={row.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.3 }}
                  className="group hover:bg-muted/50 mb-0.5 flex cursor-crosshair items-center rounded-md p-0.5 transition-colors"
                >
                  <div className="text-muted-foreground group-hover:text-foreground w-20 flex-shrink-0 truncate pr-2 text-xs font-semibold">
                    {row.label}
                  </div>

                  <div className="flex gap-0.5">
                    {row.data.map((val, cellIdx) => (
                      <div
                        key={cellIdx}
                        title={`${row.label} - Day ${cellIdx + 1}: Score ${val}`}
                        className={`h-3.5 w-3.5 cursor-pointer rounded-sm transition-all duration-300 hover:z-10 hover:scale-[1.3] ${getIntensityClass(val, isDark)}`}
                      />
                    ))}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}

// Subcomponents

interface StatCardProps {
  isDark: boolean;
  title: string;
  value: string;
  trend: string;
  isPositive: boolean;
  subtitle: string;
}

function StatCard({ isDark, title, value, trend, isPositive, subtitle }: StatCardProps) {
  return (
    <div className="border-border bg-background relative flex flex-col justify-between overflow-hidden rounded-2xl border p-5 shadow-sm">
      <div className="relative z-10 mb-4 flex items-start justify-between">
        <span className="text-muted-foreground text-xs font-bold tracking-wider uppercase">
          {title}
        </span>
        {trend && (
          <span
            className={`flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-bold ${isPositive ? (isDark ? "bg-emerald-500/10 text-emerald-400" : "bg-emerald-50 text-emerald-600") : isDark ? "bg-red-500/10 text-red-400" : "bg-red-50 text-red-600"}`}
          >
            {isPositive ? (
              <ArrowUpRight className="h-3 w-3" />
            ) : (
              <ArrowDownRight className="h-3 w-3" />
            )}
            {trend}
          </span>
        )}
      </div>
      <div className="relative z-10">
        <div className="text-foreground text-2xl font-black">{value}</div>
        <div className="text-muted-foreground mt-1 text-xs">{subtitle}</div>
      </div>
    </div>
  );
}

interface TabBtnProps {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  isDark: boolean;
}

function TabBtn({ active, onClick, icon, label, isDark }: TabBtnProps) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition-all ${active ? "border-border bg-background text-foreground border shadow-sm" : "text-muted-foreground hover:bg-muted/50 hover:text-foreground border border-transparent"}`}
    >
      {icon} {label}
    </button>
  );
}
