// ============================================
// OverviewDeepInsights.tsx
// Deep insight block for reports overview.
// Includes entity steering stack + activity-style heatmap.
// ============================================

"use client";

import { useEffect, useMemo, useState } from "react";
import { Building2, MapPin, Users, Layers, Pause, Play, Square, StepBack } from "lucide-react";
import { chartTheme, ENTITY_STEERING_STACK, HEATMAP_LABELS } from "./report-data";
import type { ReportInsightCard } from "./report-insight-types";

type HeatmapTab = "locations" | "profiles" | "departments";

type OverviewDeepInsightsProps = {
  isDark: boolean;
  onOpenInsight: (insight: ReportInsightCard) => void;
};

/**
 * Generates deterministic heatmap intensity data from labels.
 */
function generateHeatmapRows(labels: readonly string[], days: number) {
  return labels.map((label, rowIndex) => ({
    id: `${label.toLowerCase().replace(/\s+/g, "-")}-${rowIndex}`,
    label,
    data: Array.from(
      { length: days },
      (_, dayIndex) => ((rowIndex + 3) * (dayIndex + 11) * 17) % 100,
    ),
  }));
}

/**
 * Maps intensity values to visual classes matching dashboard activity style.
 */
function getIntensityClass(value: number, isDark: boolean): string {
  if (value < 10) return isDark ? "bg-zinc-800/60" : "bg-zinc-100";
  if (value < 30) return isDark ? "bg-indigo-500/15" : "bg-indigo-100";
  if (value < 50) return isDark ? "bg-indigo-500/35" : "bg-indigo-200";
  if (value < 70) return isDark ? "bg-indigo-500/55" : "bg-indigo-300";
  if (value < 90) return isDark ? "bg-indigo-500/80" : "bg-indigo-400";
  return "bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.45)]";
}

/**
 * Renders a deeper insight area with steering controls and heatmap.
 */
export function OverviewDeepInsights({ isDark, onOpenInsight }: OverviewDeepInsightsProps) {
  const theme = chartTheme(isDark);
  const [activeTab, setActiveTab] = useState<HeatmapTab>("locations");
  const [playbackState, setPlaybackState] = useState<"stopped" | "playing" | "paused">("stopped");
  const [playbackDay, setPlaybackDay] = useState(0);
  const [selectedCell, setSelectedCell] = useState<{ rowLabel: string; dayIndex: number } | null>(
    null,
  );
  const [steeringLevels, setSteeringLevels] = useState<Record<string, number>>(() =>
    Object.fromEntries(ENTITY_STEERING_STACK.map((entity) => [entity.id, entity.controlLevel])),
  );

  const heatmapDays = 14;
  const heatmapRows = useMemo(
    () => generateHeatmapRows(HEATMAP_LABELS[activeTab], heatmapDays),
    [activeTab],
  );
  const selectedEntity = ENTITY_STEERING_STACK.find((entity) => entity.id === activeTab);
  const selectedCellScore = selectedCell
    ? (heatmapRows.find((row) => row.label === selectedCell.rowLabel)?.data[
        selectedCell.dayIndex
      ] ?? 0)
    : null;

  useEffect(() => {
    if (playbackState !== "playing") return;

    const timer = window.setInterval(() => {
      setPlaybackDay((previous) => (previous + 1) % heatmapDays);
    }, 900);

    return () => window.clearInterval(timer);
  }, [heatmapDays, playbackState]);

  useEffect(() => {
    setPlaybackState("stopped");
    setPlaybackDay(0);
    setSelectedCell(null);
  }, [activeTab]);

  const tabStyle = (active: boolean) =>
    `rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${
      active
        ? isDark
          ? "bg-zinc-800 text-zinc-100"
          : "bg-white text-zinc-900 shadow-sm"
        : isDark
          ? "text-zinc-500 hover:text-zinc-200"
          : "text-zinc-500 hover:text-zinc-800"
    }`;

  return (
    <div className="grid grid-cols-1 gap-5">
      <div className={`rounded-2xl border p-5 ${theme.cardBorder} ${theme.cardBg}`}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className={`text-sm font-extrabold ${isDark ? "text-zinc-100" : "text-zinc-800"}`}>
            Entity steering stack
          </h3>
          <span className={`text-[11px] ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>
            Juster styring per enhet
          </span>
        </div>

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          {ENTITY_STEERING_STACK.map((entity) => {
            const control = steeringLevels[entity.id] ?? entity.controlLevel;
            return (
              <div
                key={entity.id}
                className={`rounded-xl border p-4 ${isDark ? "border-zinc-800 bg-zinc-900/40" : "border-zinc-200 bg-zinc-50"}`}
              >
                <button
                  type="button"
                  onClick={() =>
                    onOpenInsight({
                      cardId: `entity-${entity.id}`,
                      title: `${entity.label} - Steering`,
                      summary: "Detaljstyr drivere og variabler for denne entiteten.",
                      factors: [
                        {
                          id: "controlLevel",
                          label: "Styringsnivå",
                          value: control,
                          min: 0,
                          max: 100,
                          step: 1,
                          unit: "%",
                        },
                        {
                          id: "growthTarget",
                          label: "Vekstmål",
                          value: 8,
                          min: -20,
                          max: 40,
                          step: 1,
                          unit: "%",
                        },
                      ],
                    })
                  }
                  className="w-full text-left"
                >
                  <p
                    className={`text-xs font-bold tracking-wider uppercase ${isDark ? "text-zinc-500" : "text-zinc-400"}`}
                  >
                    {entity.label}
                  </p>
                  <p
                    className={`mt-1 text-lg font-black ${isDark ? "text-zinc-100" : "text-zinc-900"}`}
                  >
                    {entity.value}
                  </p>
                  <p className={`text-[11px] ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>
                    {entity.subtitle}
                  </p>
                  <p
                    className={`mt-2 text-xs font-semibold ${isDark ? "text-emerald-400" : "text-emerald-600"}`}
                  >
                    {entity.trendLabel}
                  </p>
                  <p className={`mt-1 text-xs ${isDark ? "text-zinc-500" : "text-zinc-500"}`}>
                    Omsetning:{" "}
                    {new Intl.NumberFormat("nb-NO", {
                      style: "currency",
                      currency: "NOK",
                      maximumFractionDigits: 0,
                    }).format(entity.turnoverNok)}
                  </p>
                </button>

                <div className="mt-3">
                  <div className="mb-1 flex items-center justify-between">
                    <span className={`text-[11px] ${isDark ? "text-zinc-500" : "text-zinc-500"}`}>
                      Lokal styring
                    </span>
                    <span
                      className={`text-[11px] font-bold ${isDark ? "text-zinc-300" : "text-zinc-700"}`}
                    >
                      {control}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={1}
                    value={control}
                    onChange={(event) =>
                      setSteeringLevels((previous) => ({
                        ...previous,
                        [entity.id]: Number(event.target.value),
                      }))
                    }
                    className="w-full"
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className={`rounded-2xl border ${theme.cardBorder} ${theme.cardBg}`}>
        <div
          className={`flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3 ${
            isDark ? "border-zinc-800" : "border-zinc-200"
          }`}
        >
          <h3
            className={`flex items-center gap-2 text-sm font-extrabold ${isDark ? "text-zinc-100" : "text-zinc-800"}`}
          >
            <Layers className="h-4 w-4 opacity-60" />
            Aktivitet heatmap (deep insight)
          </h3>

          <div
            className={`inline-flex gap-1 rounded-xl border p-1 ${isDark ? "border-zinc-800 bg-zinc-900/70" : "border-zinc-200 bg-zinc-50"}`}
          >
            <button
              className={tabStyle(activeTab === "locations")}
              onClick={() => setActiveTab("locations")}
            >
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5" />
                Locations
              </span>
            </button>
            <button
              className={tabStyle(activeTab === "profiles")}
              onClick={() => setActiveTab("profiles")}
            >
              <span className="inline-flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5" />
                Profiles
              </span>
            </button>
            <button
              className={tabStyle(activeTab === "departments")}
              onClick={() => setActiveTab("departments")}
            >
              <span className="inline-flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5" />
                Departments
              </span>
            </button>
          </div>
        </div>

        <div className="px-4 pt-3 pb-4">
          <div className="mb-2 flex items-center justify-between gap-3">
            <p
              className={`text-[11px] font-semibold ${isDark ? "text-zinc-500" : "text-zinc-500"}`}
            >
              Intensitet
            </p>
            <div
              className={`inline-flex items-center gap-1 rounded-lg border px-1 py-1 ${
                isDark ? "border-zinc-800 bg-zinc-900/60" : "border-zinc-200 bg-zinc-50"
              }`}
            >
              <button
                type="button"
                onClick={() =>
                  setPlaybackDay((previous) => (previous - 1 + heatmapDays) % heatmapDays)
                }
                className={tabStyle(false)}
                title="Gå tilbake én animasjon"
              >
                <StepBack className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setPlaybackState("playing")}
                className={tabStyle(playbackState === "playing")}
                title="Start animasjon"
              >
                <Play className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setPlaybackState("paused")}
                className={tabStyle(playbackState === "paused")}
                title="Pause animasjon"
              >
                <Pause className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setPlaybackState("stopped");
                  setPlaybackDay(0);
                }}
                className={tabStyle(playbackState === "stopped")}
                title="Stop animasjon"
              >
                <Square className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="flex items-center gap-1">
              <span className={`text-[10px] ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>
                Lav
              </span>
              <div className={`h-3 w-3 rounded-sm ${isDark ? "bg-zinc-800/60" : "bg-zinc-100"}`} />
              <div
                className={`h-3 w-3 rounded-sm ${isDark ? "bg-indigo-500/15" : "bg-indigo-100"}`}
              />
              <div
                className={`h-3 w-3 rounded-sm ${isDark ? "bg-indigo-500/35" : "bg-indigo-200"}`}
              />
              <div
                className={`h-3 w-3 rounded-sm ${isDark ? "bg-indigo-500/55" : "bg-indigo-300"}`}
              />
              <div
                className={`h-3 w-3 rounded-sm ${isDark ? "bg-indigo-500/80" : "bg-indigo-400"}`}
              />
              <div className="h-3 w-3 rounded-sm bg-indigo-500" />
              <span className={`text-[10px] ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>
                Høy
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
            <div className="overflow-x-auto lg:col-span-3">
              <div className="min-w-[760px]">
                <div className="mb-1 flex items-end">
                  <div className="w-40 shrink-0" />
                  <div className="flex flex-1">
                    {Array.from({ length: heatmapDays }, (_, i) => (
                      <span
                        key={`day-${i}`}
                        className={`flex-1 text-center text-[10px] ${isDark ? "text-zinc-600" : "text-zinc-400"}`}
                      >
                        {i + 1}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="space-y-1">
                  {heatmapRows.map((row) => (
                    <div key={row.id} className="flex items-center">
                      <div
                        className={`w-40 shrink-0 truncate pr-2 text-[11px] font-semibold ${isDark ? "text-zinc-300" : "text-zinc-700"}`}
                      >
                        {row.label}
                      </div>
                      <div className="flex flex-1 gap-[2px]">
                        {row.data.map((value, dayIndex) => (
                          <button
                            key={`${row.id}-${dayIndex}`}
                            type="button"
                            title={`${row.label} - Dag ${dayIndex + 1}: ${value}`}
                            onClick={() => {
                              setSelectedCell({ rowLabel: row.label, dayIndex });
                              setPlaybackDay(dayIndex);
                              onOpenInsight({
                                cardId: `heatmap-${activeTab}-${row.id}-day-${dayIndex + 1}`,
                                title: `${row.label} - Dag ${dayIndex + 1}`,
                                summary:
                                  "Juster drivere for valgt heatmap-cell og simuler ny intensitet.",
                                factors: [
                                  {
                                    id: "intensityTarget",
                                    label: "Målintensitet",
                                    value,
                                    min: 0,
                                    max: 100,
                                    step: 1,
                                  },
                                  {
                                    id: "allocationWeight",
                                    label: "Allokeringsvekt",
                                    value: 1,
                                    min: 0.5,
                                    max: 2.5,
                                    step: 0.1,
                                    unit: "x",
                                  },
                                ],
                              });
                            }}
                            className={`h-4 flex-1 rounded-[2px] transition-all hover:brightness-125 ${
                              playbackDay === dayIndex ? "ring-1 ring-indigo-400/70" : ""
                            } ${selectedCell?.rowLabel === row.label && selectedCell?.dayIndex === dayIndex ? "ring-2 ring-emerald-400/80" : ""} ${getIntensityClass(value, isDark)}`}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div
              className={`rounded-xl border p-3 ${
                isDark ? "border-zinc-800 bg-zinc-900/40" : "border-zinc-200 bg-zinc-50"
              }`}
            >
              <h4
                className={`text-xs font-bold tracking-wider uppercase ${isDark ? "text-zinc-500" : "text-zinc-500"}`}
              >
                System-layer side info
              </h4>
              <div className="mt-3 space-y-2 text-[12px]">
                <div className="flex items-center justify-between">
                  <span className={isDark ? "text-zinc-500" : "text-zinc-500"}>Entity</span>
                  <span className={`font-semibold ${isDark ? "text-zinc-200" : "text-zinc-800"}`}>
                    {selectedEntity?.label ?? "-"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className={isDark ? "text-zinc-500" : "text-zinc-500"}>Animation</span>
                  <span className={`font-semibold ${isDark ? "text-zinc-200" : "text-zinc-800"}`}>
                    {playbackState}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className={isDark ? "text-zinc-500" : "text-zinc-500"}>Current day</span>
                  <span className={`font-semibold ${isDark ? "text-zinc-200" : "text-zinc-800"}`}>
                    {playbackDay + 1}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className={isDark ? "text-zinc-500" : "text-zinc-500"}>Selected row</span>
                  <span
                    className={`max-w-[11rem] truncate text-right font-semibold ${isDark ? "text-zinc-200" : "text-zinc-800"}`}
                  >
                    {selectedCell?.rowLabel ?? "Ingen valgt"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className={isDark ? "text-zinc-500" : "text-zinc-500"}>Cell score</span>
                  <span className={`font-semibold ${isDark ? "text-zinc-200" : "text-zinc-800"}`}>
                    {selectedCellScore != null ? selectedCellScore : "-"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
