"use client";

import React, { useState, useMemo } from "react";
import { Activity, Users, MapPin, Building2, Network, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

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
  const [selectedCell, setSelectedCell] = useState<{ row: string; dayIndex: number } | null>(null);
  const days = RANGE_DAYS[timeRange];

  function handleCellClick(rowLabel: string, dayIndex: number) {
    setSelectedCell((prev) =>
      prev?.row === rowLabel && prev?.dayIndex === dayIndex ? null : { row: rowLabel, dayIndex },
    );
  }

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
    <div className="animate-in fade-in flex min-h-0 min-w-0 flex-1 flex-col gap-3 pr-2 pb-2 duration-500">
      {/* Compact Toolbar */}
      <div className="flex flex-shrink-0 flex-wrap items-center gap-3 pt-1">
        {/* Title */}
        <h1 className="text-foreground flex items-center gap-2 text-base font-black tracking-tight">
          <Activity className="h-4 w-4 text-indigo-500" />
          Activity Heatmap
        </h1>

        {/* Separator */}
        <div className="bg-border h-5 w-px" />

        {/* Category tabs — inline pills */}
        <div className="bg-muted/50 flex items-center gap-0.5 rounded-lg p-0.5">
          <TabBtn
            active={activeTab === "locations"}
            onClick={() => setActiveTab("locations")}
            icon={<MapPin className="h-3 w-3" />}
            label="Locations"
            isDark={isDark}
          />
          <TabBtn
            active={activeTab === "departments"}
            onClick={() => setActiveTab("departments")}
            icon={<Building2 className="h-3 w-3" />}
            label="Departments"
            isDark={isDark}
          />
          <TabBtn
            active={activeTab === "teams"}
            onClick={() => setActiveTab("teams")}
            icon={<Network className="h-3 w-3" />}
            label="Teams"
            isDark={isDark}
          />
          <TabBtn
            active={activeTab === "employees"}
            onClick={() => setActiveTab("employees")}
            icon={<Users className="h-3 w-3" />}
            label="Users"
            isDark={isDark}
          />
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Range selector */}
        <div className="bg-muted/50 flex items-center gap-0.5 rounded-lg p-0.5">
          {RANGE_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              onClick={() => setTimeRange(opt.id)}
              className={`rounded-md px-2 py-1 text-[10px] font-bold transition-colors ${
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

      {/* The Heatmap Visualizer */}
      <div className="border-border bg-background flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border shadow-sm">
        {/* Activity Detail Panel — above heatmap */}
        {selectedCell && (
          <div className="border-border max-h-[40%] shrink-0 overflow-y-auto border-b p-3">
            <div className="mb-2 flex items-center justify-between">
              <h4 className="text-foreground text-xs font-bold">
                {selectedCell.row} — Day {selectedCell.dayIndex + 1}
              </h4>
              <button
                onClick={() => setSelectedCell(null)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <ActivityDetailPanel
              label={selectedCell.row}
              dayIndex={selectedCell.dayIndex}
              days={days}
              isDark={isDark}
            />
          </div>
        )}

        {/* Heatmap Legend */}
        <div className="border-border flex flex-shrink-0 items-center justify-between gap-2 border-b px-3 py-1.5">
          <span className="text-muted-foreground text-xs font-bold">
            {activeTab === "locations"
              ? "Location"
              : activeTab === "departments"
                ? "Department"
                : activeTab === "teams"
                  ? "Team"
                  : "User"}{" "}
            Intensity
          </span>
          <div className="flex items-center gap-1.5 text-[10px] font-semibold">
            <span className="text-muted-foreground">Low</span>
            <div className="flex gap-0.5">
              <div className={`h-3 w-3 rounded-sm ${isDark ? "bg-muted/30" : "bg-muted"}`} />
              <div
                className={`h-3 w-3 rounded-sm ${isDark ? "bg-indigo-500/10" : "bg-indigo-100"}`}
              />
              <div
                className={`h-3 w-3 rounded-sm ${isDark ? "bg-indigo-500/30" : "bg-indigo-200"}`}
              />
              <div
                className={`h-3 w-3 rounded-sm ${isDark ? "bg-indigo-500/50" : "bg-indigo-300"}`}
              />
              <div
                className={`h-3 w-3 rounded-sm ${isDark ? "bg-indigo-500/80" : "bg-indigo-400"}`}
              />
              <div className="h-3 w-3 rounded-sm bg-indigo-500" />
            </div>
            <span className="text-muted-foreground">High</span>
          </div>
        </div>

        {/* Heatmap Grid container */}
        <div className="flex min-h-0 flex-1 flex-col p-3">
          {/* Days Header */}
          <div className="mb-1 flex items-end">
            <div className="w-24 flex-shrink-0" />
            <div className="flex flex-1 gap-px">
              {Array.from({ length: days }, (_, i) => {
                const labelEntry = dayLabels.find((d) => d.index === i);
                return (
                  <span
                    key={i}
                    className="text-muted-foreground flex-1 text-center text-[10px] font-medium"
                  >
                    {labelEntry ? labelEntry.label : ""}
                  </span>
                );
              })}
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
                className="group hover:bg-muted/50 flex min-h-[20px] flex-1 cursor-crosshair items-center rounded-md px-1 transition-colors"
              >
                <div className="text-muted-foreground group-hover:text-foreground w-24 flex-shrink-0 truncate pr-2 text-xs font-semibold">
                  {row.label}
                </div>

                <div className="flex flex-1 gap-px">
                  {row.data.map((val, cellIdx) => (
                    <div
                      key={cellIdx}
                      title={`${row.label} - Day ${cellIdx + 1}: Score ${val}`}
                      onClick={() => handleCellClick(row.label, cellIdx)}
                      className={`min-h-[14px] flex-1 cursor-pointer rounded-sm transition-all duration-300 hover:z-10 hover:scale-[1.3] ${
                        selectedCell?.row === row.label && selectedCell?.dayIndex === cellIdx
                          ? "ring-foreground ring-2"
                          : ""
                      } ${getIntensityClass(val, isDark)}`}
                    />
                  ))}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

// Subcomponents

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
      className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[10px] font-bold transition-all ${active ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
    >
      {icon} {label}
    </button>
  );
}

function ActivityDetailPanel({
  label,
  dayIndex,
  days,
  isDark,
}: {
  label: string;
  dayIndex: number;
  days: number;
  isDark: boolean;
}) {
  if (days === 1) {
    const hours = Array.from({ length: 17 }, (_, i) => i + 6);
    return (
      <div className="space-y-1">
        <p className="text-muted-foreground mb-2 text-xs">Hourly breakdown</p>
        {hours.map((h) => {
          const activity = Math.floor(Math.random() * 100);
          return (
            <div key={h} className="flex items-center gap-3">
              <span className="text-muted-foreground w-12 font-mono text-xs">
                {String(h).padStart(2, "0")}:00
              </span>
              <div className="bg-muted/30 h-4 flex-1 overflow-hidden rounded-sm">
                <div
                  className="h-full bg-indigo-500/60 transition-all"
                  style={{ width: `${activity}%` }}
                />
              </div>
              <span className="text-muted-foreground w-8 text-right text-xs">{activity}</span>
            </div>
          );
        })}
      </div>
    );
  }

  const entries = Array.from({ length: 5 }, (_, i) => ({
    time: `${8 + i * 2}:${i % 2 === 0 ? "00" : "30"}`,
    event: ["Shift start", "Training session", "Break period", "Inspection", "Shift end"][i],
    score: Math.floor(Math.random() * 100),
  }));

  return (
    <div className="space-y-2">
      <p className="text-muted-foreground mb-2 text-xs">Activity log for day {dayIndex + 1}</p>
      {entries.map((e, i) => (
        <div key={i} className="border-border flex items-center gap-3 rounded-lg border p-2">
          <span className="text-muted-foreground w-12 font-mono text-xs">{e.time}</span>
          <span className="text-foreground flex-1 text-sm">{e.event}</span>
          <div
            className={`rounded px-2 py-0.5 text-xs font-bold ${
              e.score >= 80
                ? "bg-emerald-500/10 text-emerald-500"
                : e.score >= 50
                  ? "bg-amber-500/10 text-amber-500"
                  : "bg-red-500/10 text-red-500"
            }`}
          >
            {e.score}
          </div>
        </div>
      ))}
    </div>
  );
}
