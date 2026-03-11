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
  TrendingUp,
  TrendingDown,
  ShieldCheck,
  BarChart2,
  X,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useWorkforcePipeline, useTrainingReadiness } from "@/app/dashboard/_hooks";
import { DashboardCard } from "./DashboardCard";

type TimeRange = "today" | "7d" | "14d" | "30d" | "90d";

const RANGE_OPTIONS: { id: TimeRange; label: string }[] = [
  { id: "today", label: "I dag" },
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
  const isExpanded = selectedCell !== null;

  function handleCellClick(rowLabel: string, dayIndex: number) {
    setSelectedCell((prev) =>
      prev?.row === rowLabel && prev?.dayIndex === dayIndex ? null : { row: rowLabel, dayIndex },
    );
  }

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
            Aktivitet & Varmekart
          </h1>
          <p className="text-muted-foreground mt-1 max-w-2xl text-sm">
            Visualiser aktivitet, belastning og intensitet på tvers av virksomheten.
          </p>
        </div>

        <div className="relative z-20 flex items-center gap-2">
          <button className="border-border bg-background text-foreground hover:bg-muted flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-bold transition-all">
            <Filter className="h-4 w-4" /> Filtrer
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

      {/* Quick Stats Grid — hidden when heatmap expanded */}
      {!isExpanded && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <DashboardCard
            label="Aktive ansatte"
            value={pipeline ? String(pipeline.activeStaff) : "--"}
            icon={<Users className="h-4 w-4" />}
            status="good"
            trend={
              pipeline ? { direction: "up", label: `+${pipeline.newHires30d} nye` } : undefined
            }
            explanation="Ansatte som er aktive og tilordnet vakter i arbeidsrommet."
          />
          <DashboardCard
            label="Opplæringsberedskap"
            value={training ? `${training.readinessPercent}%` : "--"}
            icon={<ShieldCheck className="h-4 w-4" />}
            status={
              !training || training.readinessPercent >= 80
                ? "good"
                : training.readinessPercent >= 60
                  ? "warning"
                  : "bad"
            }
            trend={
              training
                ? {
                    direction: training.readinessPercent >= 80 ? "up" : "down",
                    label: `${training.completed}/${training.totalAssignments}`,
                  }
                : undefined
            }
            explanation="Andel protokolltildelinger fullført av aktive ansatte."
          />
          <DashboardCard
            label="Høyest intensitet"
            value="Fredager"
            icon={<TrendingUp className="h-4 w-4" />}
            status="good"
            secondary="Kveldsgjengen"
            explanation="Ukedagen og teamet med høyest registrert aktivitetsnivå i valgt periode."
          />
          <DashboardCard
            label="Lavest intensitet"
            value="Søndag FM"
            icon={<TrendingDown className="h-4 w-4" />}
            status="warning"
            secondary="-5.2% vs budsjett"
            explanation="Ukedagen og perioden som er under budsjettterskel for aktivitet."
          />
        </div>
      )}

      {/* Training Progress — hidden when heatmap expanded */}
      {!isExpanded && training && training.totalAssignments > 0 && (
        <div className="border-border bg-background rounded-2xl border p-5 shadow-sm">
          <h3 className="text-muted-foreground mb-4 text-sm font-bold tracking-widest uppercase">
            Opplæringsframgang
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
                Fullført ({training.completed})
              </span>
              <span className="flex items-center gap-1">
                <div className="h-2 w-2 rounded-full bg-amber-500" />
                Ventende ({training.pending})
              </span>
              {training.expired > 0 && (
                <span className="flex items-center gap-1">
                  <div className="bg-muted-foreground/40 h-2 w-2 rounded-full" />
                  Utløpt ({training.expired})
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tabs for Heatmap Categories — hidden when heatmap expanded */}
      {!isExpanded && (
        <div className="mt-4">
          <div className="border-border bg-muted inline-flex rounded-2xl border p-1.5 shadow-sm">
            <TabBtn
              active={activeTab === "locations"}
              onClick={() => setActiveTab("locations")}
              icon={<MapPin className="h-4 w-4" />}
              label="Lokasjoner"
              isDark={isDark}
            />
            <TabBtn
              active={activeTab === "departments"}
              onClick={() => setActiveTab("departments")}
              icon={<Building2 className="h-4 w-4" />}
              label="Avdelinger"
              isDark={isDark}
            />
            <TabBtn
              active={activeTab === "teams"}
              onClick={() => setActiveTab("teams")}
              icon={<Network className="h-4 w-4" />}
              label="Team"
              isDark={isDark}
            />
            <TabBtn
              active={activeTab === "employees"}
              onClick={() => setActiveTab("employees")}
              icon={<Users className="h-4 w-4" />}
              label="Brukere"
              isDark={isDark}
            />
          </div>
        </div>
      )}

      {/* The Heatmap Visualizer — expands to fill when a cell is selected */}
      <div className="border-border bg-background flex min-h-0 flex-1 flex-col overflow-hidden rounded-3xl border shadow-sm">
        {/* Expanded toolbar — shown only when expanded */}
        {isExpanded && (
          <div className="border-border flex flex-shrink-0 flex-wrap items-center gap-3 border-b px-4 py-2">
            <button
              onClick={() => setSelectedCell(null)}
              className="text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg p-1 transition-colors"
              title="Collapse"
            >
              <X className="h-4 w-4" />
            </button>

            <span className="text-foreground text-sm font-bold">
              {selectedCell.row} — Dag {selectedCell.dayIndex + 1}
            </span>

            <div className="bg-border h-4 w-px" />

            <div className="bg-muted/50 flex items-center gap-0.5 rounded-lg p-0.5">
              <TabBtn
                active={activeTab === "locations"}
                onClick={() => setActiveTab("locations")}
                icon={<MapPin className="h-3 w-3" />}
                label="Lokasjoner"
                isDark={isDark}
              />
              <TabBtn
                active={activeTab === "departments"}
                onClick={() => setActiveTab("departments")}
                icon={<Building2 className="h-3 w-3" />}
                label="Avdelinger"
                isDark={isDark}
              />
              <TabBtn
                active={activeTab === "teams"}
                onClick={() => setActiveTab("teams")}
                icon={<Network className="h-3 w-3" />}
                label="Team"
                isDark={isDark}
              />
              <TabBtn
                active={activeTab === "employees"}
                onClick={() => setActiveTab("employees")}
                icon={<Users className="h-3 w-3" />}
                label="Brukere"
                isDark={isDark}
              />
            </div>

            <div className="flex-1" />

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
        )}

        {/* Heatmap Legend */}
        <div className="border-border bg-muted/50 flex flex-wrap items-center justify-between gap-4 border-b p-4">
          <h3 className="text-foreground flex items-center gap-2 text-lg font-bold">
            <Layers className="h-5 w-5 opacity-50" />
            {activeTab === "locations"
              ? "Lokasjonsintensitet"
              : activeTab === "departments"
                ? "Avdelingsintensitet"
                : activeTab === "teams"
                  ? "Teamintensitet"
                  : "Brukerintensitet"}
          </h3>

          <div className="flex items-center gap-2 text-xs font-semibold">
            <span className="text-muted-foreground">Stille</span>
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
            <span className="text-muted-foreground">Høy</span>
          </div>
        </div>

        {/* Heatmap Grid container */}
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-2 pt-2 pb-1">
          <div className="flex min-h-0 flex-1 flex-col">
            {/* Days Header */}
            <div className="mb-0.5 flex items-end">
              <div className="w-16 flex-shrink-0" />
              <div className="flex flex-1">
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
                  className="group hover:bg-muted/50 flex min-h-[20px] flex-1 cursor-crosshair items-center rounded-sm transition-colors"
                >
                  <div className="text-muted-foreground group-hover:text-foreground w-16 flex-shrink-0 truncate pr-1.5 text-[10px] font-semibold">
                    {row.label}
                  </div>

                  <div className="flex flex-1">
                    {row.data.map((val, cellIdx) => (
                      <div
                        key={cellIdx}
                        title={`${row.label} - Day ${cellIdx + 1}: Score ${val}`}
                        onClick={() => handleCellClick(row.label, cellIdx)}
                        className={`min-h-[14px] flex-1 cursor-pointer transition-all duration-300 hover:z-10 hover:brightness-125 ${
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

        {/* Activity Detail Panel — shown at bottom of expanded heatmap */}
        {isExpanded && (
          <div className="border-border max-h-[40%] shrink-0 overflow-y-auto border-t p-4">
            <div className="mb-3 flex items-center justify-between">
              <h4 className="text-foreground text-sm font-bold">
                {selectedCell.row} — Dag {selectedCell.dayIndex + 1}
              </h4>
              <button
                onClick={() => setSelectedCell(null)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
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
      className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition-all ${active ? "border-border bg-background text-foreground border shadow-sm" : "text-muted-foreground hover:bg-muted/50 hover:text-foreground border border-transparent"}`}
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
        <p className="text-muted-foreground mb-2 text-xs">Time-for-time fordeling</p>
        {hours.map((h) => {
          const activity = (h * 17 + 43) % 100;
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
    event: ["Vaktstart", "Opplæringsøkt", "Pause", "Inspeksjon", "Vaktslutt"][i],
    score: (i * 23 + 37) % 100,
  }));

  return (
    <div className="space-y-2">
      <p className="text-muted-foreground mb-2 text-xs">Aktivitetslogg for dag {dayIndex + 1}</p>
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
