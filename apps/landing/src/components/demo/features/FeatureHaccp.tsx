// ============================================
// FeatureHaccp.tsx
// Demo feature component: HACCP temperature control.
// Employee checks 3 cooling units. One is at +9°C
// (above the 4°C threshold), triggering an alert.
// Shows the compliance workflow: check → avvik → resolve.
// Connected to: journeys/journey-5-haccp.ts (config),
//   DemoShell.tsx (rendered inside left panel)
// ============================================

"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Thermometer, CheckCircle2, AlertTriangle, Shield, Bell } from "lucide-react";
import type { DemoFeatureProps } from "../journeys/types";

// ── Demo data ──────────────────────────────────────────

type CoolingUnit = {
  id: string;
  name: string;
  location: string;
  temperature: number;
  threshold: number;
  status: "pending" | "ok" | "avvik" | "resolved";
};

const UNITS: CoolingUnit[] = [
  {
    id: "u1",
    name: "Kjøleskap 1",
    location: "Hovedkjøkken",
    temperature: 3.2,
    threshold: 4,
    status: "pending",
  },
  {
    id: "u2",
    name: "Kjølerom",
    location: "Lager B",
    temperature: 9.1,
    threshold: 4,
    status: "pending",
  },
  {
    id: "u3",
    name: "Fryser",
    location: "Hovedkjøkken",
    temperature: -18.5,
    threshold: -15,
    status: "pending",
  },
];

// ── Component ───────────────────────────────────────────

/**
 * Renders a HACCP temperature control panel.
 *
 * UI state keys used:
 * - phase: "checklist" | "alert" | "resolved"
 * - checkedUnits: number of units checked so far (0–3)
 * - showAlert: whether the avvik alert is visible
 */
export function FeatureHaccp({ uiState, onInteraction }: DemoFeatureProps) {
  const phase = (uiState.phase as string) ?? "checklist";
  const checkedUnits = (uiState.checkedUnits as number) ?? 0;
  const showAlert = uiState.showAlert === true;

  /**
   * Determine each unit's display status based on how many
   * have been checked and whether we're in alert/resolved phase.
   */
  function getUnitStatus(index: number): CoolingUnit["status"] {
    if (index >= checkedUnits) return "pending";
    const unit = UNITS[index]!;
    const isOverThreshold = unit.temperature > unit.threshold;

    if (phase === "resolved" && isOverThreshold) return "resolved";
    if (isOverThreshold) return "avvik";
    return "ok";
  }

  return (
    <div className="flex h-full flex-col gap-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">HACCP-kontroll</h2>
          <p className="mt-0.5 text-sm text-zinc-500">
            Daglig temperatursjekk — {new Date().toLocaleDateString("no-NO")}
          </p>
        </div>
        <div className="flex items-center gap-1.5 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-1.5 text-xs text-emerald-400">
          <Shield className="h-3.5 w-3.5" />
          Mattilsynet
        </div>
      </div>

      {/* Progress */}
      <div className="rounded-xl border border-white/[0.06] bg-[#0a0a0c] p-3">
        <div className="flex items-center justify-between text-xs text-zinc-400">
          <span>
            {Math.min(checkedUnits, UNITS.length)} av {UNITS.length} kontrollert
          </span>
          <span>
            {checkedUnits >= UNITS.length
              ? phase === "resolved"
                ? "Fullført"
                : "Avvik funnet"
              : "Pågår"}
          </span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-800">
          <motion.div
            className={`h-full rounded-full ${showAlert ? "bg-red-500" : "bg-emerald-500"}`}
            animate={{
              width: `${(Math.min(checkedUnits, UNITS.length) / UNITS.length) * 100}%`,
            }}
            transition={{ duration: 0.5 }}
          />
        </div>
      </div>

      {/* Unit cards */}
      <div className="flex flex-1 flex-col gap-3">
        {UNITS.map((unit, i) => {
          const status = getUnitStatus(i);
          const isCurrent = i === checkedUnits && checkedUnits < UNITS.length;
          const isOverThreshold = unit.temperature > unit.threshold;

          return (
            <motion.button
              key={unit.id}
              onClick={() => {
                if (isCurrent) onInteraction(`check-unit-${i}`);
              }}
              disabled={!isCurrent}
              className={`rounded-xl border p-4 text-left transition-all ${
                status === "ok"
                  ? "border-emerald-500/20 bg-emerald-500/5"
                  : status === "avvik"
                    ? "border-red-500/30 bg-red-500/5"
                    : status === "resolved"
                      ? "border-amber-500/20 bg-amber-500/5"
                      : isCurrent
                        ? "border-emerald-500/20 bg-[#0a0a0c] hover:border-emerald-500/40"
                        : "border-white/[0.06] bg-[#0a0a0c] opacity-40"
              }`}
              animate={
                isCurrent
                  ? {
                      borderColor: [
                        "rgba(16,185,129,0.2)",
                        "rgba(16,185,129,0.5)",
                        "rgba(16,185,129,0.2)",
                      ],
                    }
                  : {}
              }
              transition={isCurrent ? { duration: 1.5, repeat: Infinity } : {}}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                      status === "ok"
                        ? "bg-emerald-500/10"
                        : status === "avvik"
                          ? "bg-red-500/10"
                          : status === "resolved"
                            ? "bg-amber-500/10"
                            : "bg-white/[0.06]"
                    }`}
                  >
                    <Thermometer
                      className={`h-5 w-5 ${
                        status === "ok"
                          ? "text-emerald-400"
                          : status === "avvik"
                            ? "text-red-400"
                            : status === "resolved"
                              ? "text-amber-400"
                              : "text-zinc-500"
                      }`}
                    />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">{unit.name}</p>
                    <p className="text-xs text-zinc-500">{unit.location}</p>
                  </div>
                </div>

                {/* Temperature + status icon */}
                <div className="flex items-center gap-2">
                  {status !== "pending" && (
                    <span
                      className={`text-lg font-bold tabular-nums ${
                        isOverThreshold && status !== "resolved"
                          ? "text-red-400"
                          : "text-emerald-400"
                      }`}
                    >
                      {unit.temperature > 0 ? "+" : ""}
                      {unit.temperature}°C
                    </span>
                  )}
                  {status === "ok" && <CheckCircle2 className="h-5 w-5 text-emerald-400" />}
                  {status === "avvik" && <AlertTriangle className="h-5 w-5 text-red-400" />}
                  {status === "resolved" && <CheckCircle2 className="h-5 w-5 text-amber-400" />}
                </div>
              </div>

              {/* Threshold info */}
              {status !== "pending" && (
                <div className="mt-2 flex items-center justify-between text-xs">
                  <span className="text-zinc-500">
                    Grense: {unit.threshold > 0 ? "+" : ""}
                    {unit.threshold}°C
                  </span>
                  {status === "ok" && <span className="text-emerald-400">Godkjent</span>}
                  {status === "avvik" && (
                    <span className="text-red-400">
                      Avvik: {(unit.temperature - unit.threshold).toFixed(1)}°C over grensen
                    </span>
                  )}
                  {status === "resolved" && (
                    <span className="text-amber-400">Avvik meldt — tiltak iverksatt</span>
                  )}
                </div>
              )}
            </motion.button>
          );
        })}
      </div>

      {/* Alert banner */}
      <AnimatePresence>
        {showAlert && phase !== "resolved" && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            className="flex items-center gap-3 rounded-xl border border-red-500/30 bg-red-500/5 p-4"
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-red-500/20">
              <Bell className="h-4 w-4 text-red-400" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-red-300">Temperaturavvik registrert</p>
              <p className="text-xs text-zinc-500">
                Kjølerom (Lager B) — +9.1°C — Varslet avdelingsleder
              </p>
            </div>
          </motion.div>
        )}

        {phase === "resolved" && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4"
          >
            <CheckCircle2 className="h-5 w-5 text-emerald-400" />
            <div>
              <p className="text-sm font-medium text-emerald-300">HACCP-kontroll fullført</p>
              <p className="text-xs text-zinc-500">
                2 godkjent, 1 avvik meldt og håndtert. Logg lagret.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
