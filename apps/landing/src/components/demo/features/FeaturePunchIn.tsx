// ============================================
// FeaturePunchIn.tsx
// Demo feature component: employee clock-in and task list.
// Shows a punch clock → transitions to a task checklist
// → ends with a manager stats view.
// Connected to: journeys/journey-1-punch-in.ts (config),
//   DemoShell.tsx (rendered inside left panel)
// ============================================

"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Clock, CheckCircle2, Circle, MapPin, User, BarChart3, TrendingUp } from "lucide-react";
import type { DemoFeatureProps } from "../journeys/types";

// ── Demo data ──────────────────────────────────────────

type TaskItem = {
  id: string;
  label: string;
  time: string;
};

const TASKS: TaskItem[] = [
  { id: "t1", label: "Sjekk kjøletemperatur — kjøkken", time: "07:15" },
  { id: "t2", label: "Klargjør frokostbuffet", time: "07:30" },
  { id: "t3", label: "Tøm oppvaskmaskinen", time: "08:00" },
  { id: "t4", label: "Bestill varer fra lager", time: "09:00" },
];

// ── Component ───────────────────────────────────────────

/**
 * Renders a punch-clock → task list → stats view.
 *
 * UI state keys used:
 * - phase: "clock-in" | "tasks" | "stats"
 * - clockedIn: whether the employee has punched in
 * - completedTasks: number of tasks checked off
 */
export function FeaturePunchIn({ currentStepId, uiState, onInteraction }: DemoFeatureProps) {
  const phase = (uiState.phase as string) ?? "clock-in";
  const clockedIn = uiState.clockedIn === true;
  const completedTasks = (uiState.completedTasks as number) ?? 0;

  return (
    <div className="flex h-full flex-col gap-5">
      <AnimatePresence mode="wait">
        {/* Phase 1: Clock-in screen */}
        {phase === "clock-in" && (
          <motion.div
            key="clock-in"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.4 }}
            className="flex flex-1 flex-col items-center justify-center gap-6"
          >
            {/* Location badge */}
            <div className="flex items-center gap-2 rounded-full border border-white/[0.06] bg-[#0a0a0c] px-4 py-2">
              <MapPin className="h-4 w-4 text-zinc-500" />
              <span className="text-sm text-zinc-400">Grand Hotel — Kjøkken</span>
            </div>

            {/* Clock display */}
            <div className="text-center">
              <p className="text-5xl font-black text-white tabular-nums">06:58</p>
              <p className="mt-1 text-sm text-zinc-500">Vakt starter 07:00</p>
            </div>

            {/* Punch button */}
            <motion.button
              onClick={() => onInteraction("clock-in")}
              className={`flex items-center gap-3 rounded-2xl px-8 py-4 text-lg font-bold transition-all ${
                clockedIn
                  ? "border border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                  : "border border-orange-500/30 bg-orange-500/10 text-orange-300 hover:bg-orange-500/20"
              }`}
              animate={
                !clockedIn && currentStepId === "clock-in-prompt"
                  ? {
                      borderColor: [
                        "rgba(249,115,22,0.3)",
                        "rgba(249,115,22,0.6)",
                        "rgba(249,115,22,0.3)",
                      ],
                    }
                  : {}
              }
              transition={
                !clockedIn && currentStepId === "clock-in-prompt"
                  ? { duration: 1.5, repeat: Infinity }
                  : {}
              }
            >
              <Clock className="h-6 w-6" />
              {clockedIn ? "Innstemplet 06:58" : "Stempel inn"}
            </motion.button>

            {/* Clocked-in confirmation */}
            <AnimatePresence>
              {clockedIn && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex items-center gap-2 text-sm text-emerald-400"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Du er innstemplet — 2 minutter før vaktstart
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {/* Phase 2: Task list */}
        {phase === "tasks" && (
          <motion.div
            key="tasks"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.4 }}
            className="flex flex-1 flex-col gap-4"
          >
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-white">Dagens oppgaver</h2>
                <p className="mt-0.5 text-sm text-zinc-500">Mandag 3. mars — Morgenvakt</p>
              </div>
              <div className="flex items-center gap-1.5 rounded-lg border border-white/[0.06] bg-[#0a0a0c] px-3 py-1.5">
                <User className="h-3.5 w-3.5 text-zinc-500" />
                <span className="text-xs text-zinc-400">Maria S.</span>
              </div>
            </div>

            {/* Progress bar */}
            <div className="rounded-xl border border-white/[0.06] bg-[#0a0a0c] p-3">
              <div className="flex items-center justify-between text-xs text-zinc-400">
                <span>
                  {completedTasks} av {TASKS.length} fullført
                </span>
                <span>{Math.round((completedTasks / TASKS.length) * 100)}%</span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-800">
                <motion.div
                  className="h-full rounded-full bg-orange-500"
                  animate={{ width: `${(completedTasks / TASKS.length) * 100}%` }}
                  transition={{ duration: 0.5 }}
                />
              </div>
            </div>

            {/* Task items */}
            <div className="flex flex-col gap-2">
              {TASKS.map((task, i) => {
                const isDone = i < completedTasks;
                const isCurrent = i === completedTasks;

                return (
                  <motion.button
                    key={task.id}
                    onClick={() => {
                      if (isCurrent) onInteraction("check-task");
                    }}
                    className={`flex items-center gap-3 rounded-xl border p-4 text-left transition-all ${
                      isDone
                        ? "border-emerald-500/20 bg-emerald-500/5"
                        : isCurrent
                          ? "border-orange-500/20 bg-orange-500/5 hover:border-orange-500/40"
                          : "border-white/[0.06] bg-[#0a0a0c] opacity-50"
                    }`}
                    animate={
                      isCurrent && currentStepId === "check-task"
                        ? {
                            borderColor: [
                              "rgba(249,115,22,0.2)",
                              "rgba(249,115,22,0.5)",
                              "rgba(249,115,22,0.2)",
                            ],
                          }
                        : {}
                    }
                    transition={
                      isCurrent && currentStepId === "check-task"
                        ? { duration: 1.5, repeat: Infinity }
                        : {}
                    }
                    disabled={!isCurrent}
                  >
                    {isDone ? (
                      <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" />
                    ) : (
                      <Circle
                        className={`h-5 w-5 shrink-0 ${isCurrent ? "text-orange-400" : "text-zinc-600"}`}
                      />
                    )}
                    <div className="flex-1">
                      <p
                        className={`text-sm font-medium ${isDone ? "text-zinc-500 line-through" : "text-white"}`}
                      >
                        {task.label}
                      </p>
                    </div>
                    <span className="text-xs text-zinc-500">{task.time}</span>
                  </motion.button>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* Phase 3: Manager stats view */}
        {phase === "stats" && (
          <motion.div
            key="stats"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.4 }}
            className="flex flex-1 flex-col gap-5"
          >
            <div>
              <h2 className="text-xl font-bold text-white">Ledervisning — sanntid</h2>
              <p className="mt-0.5 text-sm text-zinc-500">Slik ser det ut fra lederens dashboard</p>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-2 gap-3">
              <StatsCard
                icon={<User className="h-5 w-5" />}
                label="Innstemplet"
                value="8 / 8"
                color="emerald"
              />
              <StatsCard
                icon={<CheckCircle2 className="h-5 w-5" />}
                label="Oppgaver fullført"
                value="73%"
                color="orange"
              />
              <StatsCard
                icon={<Clock className="h-5 w-5" />}
                label="Gj.snitt innstemplingstid"
                value="−3 min"
                color="cyan"
              />
              <StatsCard
                icon={<TrendingUp className="h-5 w-5" />}
                label="Trend denne uken"
                value="+12%"
                color="purple"
              />
            </div>

            {/* Live feed */}
            <div className="flex-1 rounded-xl border border-white/[0.06] bg-[#0a0a0c] p-4">
              <div className="mb-3 flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-zinc-500" />
                <span className="text-sm font-medium text-zinc-300">Aktivitetslogg</span>
              </div>
              <div className="flex flex-col gap-2">
                {[
                  { time: "06:58", text: "Maria S. stemplet inn", color: "text-emerald-400" },
                  { time: "07:02", text: "Erik B. stemplet inn", color: "text-emerald-400" },
                  {
                    time: "07:16",
                    text: "Maria S. fullførte: Sjekk kjøletemperatur",
                    color: "text-orange-400",
                  },
                  {
                    time: "07:31",
                    text: "Maria S. fullførte: Klargjør frokostbuffet",
                    color: "text-orange-400",
                  },
                ].map((entry, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.15, duration: 0.3 }}
                    className="flex items-center gap-3"
                  >
                    <span className="w-12 shrink-0 text-xs text-zinc-600 tabular-nums">
                      {entry.time}
                    </span>
                    <span className={`text-sm ${entry.color}`}>{entry.text}</span>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Small stat card used in the manager stats view */
function StatsCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: "emerald" | "orange" | "cyan" | "purple";
}) {
  const colors = {
    emerald: "border-emerald-500/20 text-emerald-400",
    orange: "border-orange-500/20 text-orange-400",
    cyan: "border-cyan-500/20 text-cyan-400",
    purple: "border-purple-500/20 text-purple-400",
  };

  return (
    <div className={`rounded-xl border bg-[#0a0a0c] p-4 ${colors[color]}`}>
      <div className="mb-2">{icon}</div>
      <p className="text-2xl font-bold">{value}</p>
      <p className="mt-0.5 text-xs text-zinc-500">{label}</p>
    </div>
  );
}
