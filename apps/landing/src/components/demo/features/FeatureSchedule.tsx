// ============================================
// FeatureSchedule.tsx
// Demo feature component: shift schedule grid with a
// pre-seeded coverage gap. The AI assistant guides the
// manager to identify and fill the gap using Lise's
// suggestion. Adapted from the shiftplanner feature page.
// Connected to: journeys/journey-2-schedule-ai.ts (config),
//   DemoShell.tsx (rendered inside left panel)
// ============================================

"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Users, CheckCircle2, AlertCircle, Clock, Bot, Sparkles } from "lucide-react";
import type { DemoFeatureProps } from "../journeys/types";

// ── Demo data ──────────────────────────────────────────
// Simulated schedule grid for a hotel housekeeping department.
// Tuesday is deliberately empty to create a visible coverage gap.

type ShiftCell = {
  name: string;
  time: string;
  status: "confirmed" | "pending" | "gap" | "ai-suggested" | "approved";
};

type DayColumn = {
  day: string;
  date: string;
  shifts: ShiftCell[];
};

/** Initial schedule with a gap on Tuesday */
const INITIAL_SCHEDULE: DayColumn[] = [
  {
    day: "Man",
    date: "3. mar",
    shifts: [
      { name: "Maria S.", time: "07:00–15:00", status: "confirmed" },
      { name: "Erik B.", time: "07:00–15:00", status: "confirmed" },
    ],
  },
  {
    day: "Tir",
    date: "4. mar",
    shifts: [],
  },
  {
    day: "Ons",
    date: "5. mar",
    shifts: [
      { name: "Maria S.", time: "07:00–15:00", status: "confirmed" },
      { name: "Jonas K.", time: "08:00–16:00", status: "confirmed" },
    ],
  },
  {
    day: "Tor",
    date: "6. mar",
    shifts: [
      { name: "Erik B.", time: "07:00–15:00", status: "confirmed" },
      { name: "Sara L.", time: "08:00–16:00", status: "pending" },
    ],
  },
  {
    day: "Fre",
    date: "7. mar",
    shifts: [
      { name: "Maria S.", time: "07:00–15:00", status: "confirmed" },
      { name: "Erik B.", time: "07:00–15:00", status: "confirmed" },
      { name: "Jonas K.", time: "10:00–18:00", status: "confirmed" },
    ],
  },
];

/** Lise's AI suggestion — fills Tuesday's gap */
const AI_SUGGESTION: ShiftCell[] = [
  { name: "Jonas K.", time: "07:00–15:00", status: "ai-suggested" },
  { name: "Sara L.", time: "08:00–16:00", status: "ai-suggested" },
];

// ── Status styling ──────────────────────────────────────

const STATUS_STYLES: Record<
  ShiftCell["status"],
  { bg: string; border: string; text: string; badge: string }
> = {
  confirmed: {
    bg: "bg-emerald-500/5",
    border: "border-emerald-500/20",
    text: "text-emerald-300",
    badge: "bg-emerald-500/20 text-emerald-300",
  },
  pending: {
    bg: "bg-amber-500/5",
    border: "border-amber-500/20",
    text: "text-amber-300",
    badge: "bg-amber-500/20 text-amber-300",
  },
  gap: {
    bg: "bg-red-500/5",
    border: "border-red-500/20",
    text: "text-red-300",
    badge: "bg-red-500/20 text-red-300",
  },
  "ai-suggested": {
    bg: "bg-cyan-500/5",
    border: "border-cyan-500/30 border-dashed",
    text: "text-cyan-300",
    badge: "bg-cyan-500/20 text-cyan-300",
  },
  approved: {
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/30",
    text: "text-emerald-200",
    badge: "bg-emerald-500/20 text-emerald-200",
  },
};

// ── Component ───────────────────────────────────────────

/**
 * Renders a shift schedule grid that reacts to demo step state.
 *
 * UI state keys used:
 * - showGapHighlight: pulse the Tuesday gap
 * - showAiSuggestion: show Lise's suggested shifts on Tuesday
 * - showApproved: turn suggestions green (approved)
 * - showStats: show the stats panel at bottom
 */
export function FeatureSchedule({
  currentStepId: _currentStepId,
  uiState,
  onInteraction,
}: DemoFeatureProps) {
  const showGapHighlight = uiState.showGapHighlight === true;
  const showAiSuggestion = uiState.showAiSuggestion === true;
  const showApproved = uiState.showApproved === true;
  const showStats = uiState.showStats === true;

  /**
   * Build the display schedule by injecting AI suggestions
   * or approved shifts into Tuesday's column when appropriate.
   */
  function getSchedule(): DayColumn[] {
    return INITIAL_SCHEDULE.map((day) => {
      // Only modify Tuesday
      if (day.day !== "Tir") return day;

      if (showApproved) {
        return {
          ...day,
          shifts: AI_SUGGESTION.map((s) => ({ ...s, status: "approved" as const })),
        };
      }
      if (showAiSuggestion) {
        return { ...day, shifts: AI_SUGGESTION };
      }
      return day;
    });
  }

  const schedule = getSchedule();

  return (
    <div className="flex h-full flex-col gap-5">
      {/* Header bar */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Vaktplan — Housekeeping</h2>
          <p className="mt-0.5 text-sm text-zinc-500">Uke 10 — 3.–7. mars 2026</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 rounded-lg border border-white/[0.06] bg-[#0a0a0c] px-3 py-1.5 text-xs text-zinc-400">
            <Users className="h-3.5 w-3.5" />4 ansatte
          </span>
        </div>
      </div>

      {/* Schedule grid */}
      <div className="flex-1 overflow-x-auto">
        <div className="grid min-w-[600px] grid-cols-5 gap-2">
          {schedule.map((day) => {
            const isGapDay = day.day === "Tir" && day.shifts.length === 0;

            return (
              <div key={day.day} className="flex flex-col gap-2">
                {/* Day header */}
                <div className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-[#0a0a0c] px-3 py-2">
                  <span className="text-sm font-semibold text-white">{day.day}</span>
                  <span className="text-xs text-zinc-500">{day.date}</span>
                </div>

                {/* Shift cards */}
                <div className="flex flex-col gap-1.5">
                  <AnimatePresence mode="popLayout">
                    {day.shifts.map((shift, i) => {
                      const style = STATUS_STYLES[shift.status];
                      return (
                        <motion.div
                          key={`${day.day}-${shift.name}-${i}`}
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          transition={{ duration: 0.3 }}
                          className={`rounded-xl border p-3 ${style.bg} ${style.border}`}
                          onClick={() => {
                            if (shift.status === "ai-suggested") {
                              onInteraction("approve-shift");
                            }
                          }}
                          role={shift.status === "ai-suggested" ? "button" : undefined}
                        >
                          <div className="flex items-center justify-between">
                            <span className={`text-sm font-medium ${style.text}`}>
                              {shift.name}
                            </span>
                            {shift.status === "ai-suggested" && (
                              <Sparkles className="h-3.5 w-3.5 text-cyan-400" />
                            )}
                            {shift.status === "approved" && (
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                            )}
                          </div>
                          <div className="mt-1 flex items-center gap-1">
                            <Clock className="h-3 w-3 text-zinc-500" />
                            <span className="text-xs text-zinc-500">{shift.time}</span>
                          </div>
                          {shift.status === "ai-suggested" && (
                            <span className="mt-1.5 inline-flex items-center gap-1 text-[10px] text-cyan-400/70">
                              <Bot className="h-2.5 w-2.5" />
                              Foreslått av Lise
                            </span>
                          )}
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>

                  {/* Empty gap indicator for Tuesday */}
                  {isGapDay && (
                    <motion.div
                      animate={
                        showGapHighlight
                          ? {
                              borderColor: [
                                "rgba(239,68,68,0.2)",
                                "rgba(239,68,68,0.5)",
                                "rgba(239,68,68,0.2)",
                              ],
                            }
                          : {}
                      }
                      transition={showGapHighlight ? { duration: 1.5, repeat: Infinity } : {}}
                      className="flex flex-col items-center justify-center rounded-xl border border-dashed border-red-500/20 bg-red-500/5 p-4"
                    >
                      <AlertCircle className="h-5 w-5 text-red-400/60" />
                      <span className="mt-1.5 text-xs font-medium text-red-300/60">
                        Ingen dekning
                      </span>
                      <span className="mt-0.5 text-[10px] text-red-400/40">2 ansatte mangler</span>
                    </motion.div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Stats panel — shown at the final step */}
      <AnimatePresence>
        {showStats && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            transition={{ duration: 0.4 }}
            className="grid grid-cols-3 gap-3"
          >
            <StatCard label="Dekningsgrad" value="100%" color="emerald" />
            <StatCard label="Overtid" value="0 t" color="cyan" />
            <StatCard label="Ønsker oppfylt" value="3/4" color="orange" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Small stat card for the bottom panel */
function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: "emerald" | "cyan" | "orange";
}) {
  const colors = {
    emerald: "border-emerald-500/20 text-emerald-300",
    cyan: "border-cyan-500/20 text-cyan-300",
    orange: "border-orange-500/20 text-orange-300",
  };

  return (
    <div className={`rounded-xl border bg-[#0a0a0c] p-3 text-center ${colors[color]}`}>
      <p className="text-lg font-bold">{value}</p>
      <p className="text-xs text-zinc-500">{label}</p>
    </div>
  );
}
