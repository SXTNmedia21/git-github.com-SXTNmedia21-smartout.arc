"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Activity,
  Building2,
  Filter,
  Layers,
  MapPin,
  Network,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  Users,
  X,
} from "lucide-react";
import { useTranslation } from "@smartout/i18n";
import { KpiAccentTile } from "@smartout/ui";
import { useWorkforcePipeline } from "@/app/dashboard/_hooks/use-workforce-pipeline";
import { useTrainingReadiness } from "@/app/dashboard/_hooks/use-training-readiness";
import { useActivityFeed } from "@/app/dashboard/_hooks/use-activity-feed";
import type { ActivityEntry } from "@/app/dashboard/_hooks/use-activity-feed";

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

const LOCATION_LABELS = [
  "Bårdshaug Vegkro",
  "Trondheim City",
  "Oslo S Kiosk",
  "Lillehammer Diner",
  "Stavanger FNB",
];
const DEPARTMENT_LABELS = ["Kjøkken", "Servering", "Oppvask", "Renhold", "Lager", "Sikkerhet"];
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

/**
 * Mock generator — real workspace data wires in via use-activity-feed
 * + a future `useActivityHeatmap` hook (TODO). Until then the heatmap
 * shows seeded random intensity per (row, day) pair.
 */
function generateHeatmapData(labels: string[], numDays: number) {
  return labels.map((label) => ({
    id: label.toLowerCase().replace(/\s+/g, "-"),
    label,
    data: Array.from({ length: numDays }, () => Math.floor(Math.random() * 100)),
  }));
}

function getDayLabels(days: number): { index: number; label: string }[] {
  if (days <= 1) return [{ index: 0, label: "1" }];
  const step = days <= 7 ? 1 : days <= 14 ? 2 : days <= 30 ? 5 : 10;
  const labels: { index: number; label: string }[] = [];
  for (let i = 0; i < days; i += step) {
    labels.push({ index: i, label: String(i + 1) });
  }
  if (labels[labels.length - 1]?.index !== days - 1) {
    labels.push({ index: days - 1, label: String(days) });
  }
  return labels;
}

function intensityClass(val: number): string {
  if (val === 0) return "bg-muted";
  if (val < 20) return "bg-indigo-100 dark:bg-indigo-500/10";
  if (val < 40) return "bg-indigo-200 dark:bg-indigo-500/30";
  if (val < 60) return "bg-indigo-300 dark:bg-indigo-500/50";
  if (val < 80) return "bg-indigo-400 dark:bg-indigo-500/70";
  return "bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.5)]";
}

export function ActivityView() {
  const { t: _t } = useTranslation("dashboard");
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

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col gap-5 p-4 pt-1 md:p-6 md:pt-3">
      {/* Page header — Reports-style */}
      <div className="flex items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-heading text-foreground text-3xl leading-tight tracking-tight">
            Aktivitet
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Varmekart over aktivitet og intensitet på tvers av lokasjoner, avdelinger, team og
            brukere.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="border-border bg-card text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors"
          >
            <Filter className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Filtrer</span>
          </button>
          <div className="bg-muted/80 border-border flex items-center gap-1 rounded-lg border p-0.5 shadow-sm">
            {RANGE_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                onClick={() => setTimeRange(opt.id)}
                className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition-all ${
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

      {/* KPI strip — same Oversikt-style cards, hidden when heatmap expanded */}
      {!isExpanded && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <KpiAccentTile
            compact
            title="Aktive ansatte"
            icon={Users}
            accent="emerald"
            primary={{ label: "Aktive nå", value: pipeline ? pipeline.activeStaff : "—" }}
            secondary={{
              label: "Nye 30d",
              value: pipeline ? `+${pipeline.newHires30d}` : "—",
            }}
          />
          <KpiAccentTile
            compact
            title="Beredskap"
            icon={ShieldCheck}
            accent="blue"
            primary={{
              label: "Snitt",
              value: training ? `${training.readinessPercent}` : "—",
              unit: "%",
            }}
            secondary={{
              label: "Fullført",
              value: training ? `${training.completed}/${training.totalAssignments}` : "—",
            }}
          />
          <KpiAccentTile
            compact
            title="Toppintensitet"
            icon={TrendingUp}
            accent="amber"
            primary={{ label: "Ukedag", value: "Fredag" }}
            secondary={{ label: "Team", value: "Kveld" }}
          />
          <KpiAccentTile
            compact
            title="Lavpunkt"
            icon={TrendingDown}
            accent="rose"
            primary={{ label: "Periode", value: "Søn FM" }}
            secondary={{ label: "Vs. budsjett", value: "−5,2%" }}
          />
        </div>
      )}

      {/* Tab pills — heatmap dimension switch, hidden when heatmap expanded */}
      {!isExpanded && (
        <div className="bg-muted/80 border-border inline-flex w-fit items-center gap-1 rounded-xl border p-1 shadow-sm">
          {(
            [
              { key: "locations", label: "Lokasjoner", Icon: MapPin },
              { key: "departments", label: "Avdelinger", Icon: Building2 },
              { key: "teams", label: "Team", Icon: Network },
              { key: "employees", label: "Brukere", Icon: Users },
            ] as const
          ).map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setActiveTab(t.key)}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                activeTab === t.key
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <t.Icon className="h-3.5 w-3.5" />
              {t.label}
            </button>
          ))}
        </div>
      )}

      {/* Heatmap card — fills space, expands when cell selected */}
      <div className="bg-card border-border flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border shadow-sm">
        {/* Expanded toolbar */}
        {isExpanded && selectedCell && (
          <div className="border-border flex flex-shrink-0 flex-wrap items-center gap-3 border-b px-4 py-2">
            <button
              onClick={() => setSelectedCell(null)}
              className="text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg p-1 transition-colors"
              title="Lukk"
            >
              <X className="h-4 w-4" />
            </button>
            <span className="text-foreground text-sm font-bold">
              {selectedCell.row} — Dag {selectedCell.dayIndex + 1}
            </span>
          </div>
        )}

        {/* Legend */}
        <div className="border-border bg-muted/30 flex flex-wrap items-center justify-between gap-4 border-b px-5 py-3">
          <h3 className="text-foreground inline-flex items-center gap-2 text-sm font-bold">
            <Layers className="h-4 w-4 opacity-60" />
            {activeTab === "locations"
              ? "Lokasjonsintensitet"
              : activeTab === "departments"
                ? "Avdelingsintensitet"
                : activeTab === "teams"
                  ? "Teamintensitet"
                  : "Brukerintensitet"}
          </h3>
          <div className="text-muted-foreground inline-flex items-center gap-2 text-xs font-medium">
            <span>Stille</span>
            <div className="flex gap-1">
              <div className="bg-muted h-3.5 w-3.5 rounded-sm" />
              <div className="h-3.5 w-3.5 rounded-sm bg-indigo-100 dark:bg-indigo-500/10" />
              <div className="h-3.5 w-3.5 rounded-sm bg-indigo-200 dark:bg-indigo-500/30" />
              <div className="h-3.5 w-3.5 rounded-sm bg-indigo-300 dark:bg-indigo-500/50" />
              <div className="h-3.5 w-3.5 rounded-sm bg-indigo-400 dark:bg-indigo-500/70" />
              <div className="h-3.5 w-3.5 rounded-sm bg-indigo-500" />
            </div>
            <span>Høy</span>
          </div>
        </div>

        {/* Heatmap grid */}
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-4">
          {/* Day-index header */}
          <div className="mb-1 flex items-end">
            <div className="w-32 flex-shrink-0" />
            <div className="flex flex-1 gap-0.5">
              {Array.from({ length: days }, (_, i) => {
                const labelEntry = dayLabels.find((d) => d.index === i);
                return (
                  <span
                    key={i}
                    className="text-muted-foreground/70 flex-1 text-center text-[10px] font-medium tabular-nums"
                  >
                    {labelEntry ? labelEntry.label : ""}
                  </span>
                );
              })}
            </div>
          </div>

          {/* Rows */}
          <div className="scrollbar-thin flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto pr-1">
            <AnimatePresence mode="popLayout" initial={false}>
              {activeData.map((row) => (
                <motion.div
                  key={row.id}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ type: "spring", stiffness: 35, damping: 22, mass: 2.2 }}
                  className="group hover:bg-muted/30 flex min-h-[28px] items-center rounded-md transition-colors"
                >
                  <div className="text-muted-foreground group-hover:text-foreground w-32 flex-shrink-0 truncate pr-2 text-[12px] font-semibold">
                    {row.label}
                  </div>
                  <div className="flex flex-1 gap-0.5">
                    {row.data.map((val, cellIdx) => (
                      <button
                        type="button"
                        key={cellIdx}
                        title={`${row.label} — Dag ${cellIdx + 1}: ${val}`}
                        onClick={() => handleCellClick(row.label, cellIdx)}
                        className={`min-h-[20px] flex-1 cursor-pointer rounded-sm transition-all duration-200 hover:z-10 hover:scale-110 hover:brightness-125 ${
                          selectedCell?.row === row.label && selectedCell?.dayIndex === cellIdx
                            ? "ring-foreground ring-2"
                            : ""
                        } ${intensityClass(val)}`}
                      />
                    ))}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>

        {/* Activity feed inside expanded heatmap */}
        {isExpanded && selectedCell && (
          <div className="border-border max-h-[40%] shrink-0 overflow-y-auto border-t p-4">
            <ActivityFeed compact />
          </div>
        )}
      </div>

      {/* Activity feed below heatmap when collapsed */}
      {!isExpanded && (
        <div className="bg-card border-border rounded-2xl border p-5 shadow-sm">
          <ActivityFeed />
        </div>
      )}
    </div>
  );
}

function ActivityFeed({ compact = false }: { compact?: boolean }) {
  const { t } = useTranslation("dashboard");
  const { data: feed, isLoading } = useActivityFeed({
    limit: compact ? 12 : 30,
    filters: { timeRange: "today" },
  });

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="border-border bg-muted/10 h-10 animate-pulse rounded-lg border"
            style={{ animationDelay: `${i * 60}ms` }}
          />
        ))}
      </div>
    );
  }

  if (!feed?.length) {
    return <p className="text-muted-foreground py-4 text-center text-sm">{t("activity.empty")}</p>;
  }

  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-muted-foreground mb-2 text-[11px] font-bold tracking-[0.14em] uppercase">
        Aktivitetslogg — i dag
      </p>
      {feed.map((entry: ActivityEntry) => {
        const time = new Date(entry.createdAt).toLocaleTimeString("nb-NO", {
          hour: "2-digit",
          minute: "2-digit",
        });
        const isWarning = entry.event.includes("late") || entry.event.includes("deviation");

        return (
          <div
            key={entry.id}
            className="border-border bg-background flex items-center gap-3 rounded-lg border px-3 py-2"
          >
            <span className="text-muted-foreground/80 w-12 font-mono text-[11px] tabular-nums">
              {time}
            </span>
            {isWarning ? (
              <div className="h-2 w-2 shrink-0 rounded-full bg-rose-500/80" />
            ) : (
              <div className="h-2 w-2 shrink-0 rounded-full bg-emerald-500/60" />
            )}
            <span className="text-foreground flex-1 truncate text-[13px]">
              <span className="font-semibold">{entry.actorName}</span>
              <span className="text-muted-foreground"> — {entry.description}</span>
            </span>
            <span className="text-muted-foreground/80 shrink-0 text-[10px] font-bold tracking-wider uppercase">
              {entry.category}
            </span>
          </div>
        );
      })}
    </div>
  );
}
