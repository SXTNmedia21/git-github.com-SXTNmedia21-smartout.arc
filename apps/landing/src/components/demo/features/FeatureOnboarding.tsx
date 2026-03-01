// ============================================
// FeatureOnboarding.tsx
// Demo feature component: new employee onboarding.
// Day-one experience: welcome → accept terms →
// complete first protocol → "Klar til vakt!" badge.
// Connected to: journeys/journey-6-onboarding.ts (config),
//   DemoShell.tsx (rendered inside left panel)
// ============================================

"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  UserPlus,
  FileCheck,
  BookOpen,
  CheckCircle2,
  Circle,
  Shield,
  Sparkles,
} from "lucide-react";
import type { DemoFeatureProps } from "../journeys/types";

// ── Demo data ──────────────────────────────────────────

type ProtocolItem = {
  id: string;
  title: string;
  description: string;
};

const PROTOCOL_ITEMS: ProtocolItem[] = [
  {
    id: "p1",
    title: "Hygieneregler i kjøkkenet",
    description: "Les om håndvask, hanskebruk og kryssforurensning.",
  },
  {
    id: "p2",
    title: "Brannrutiner og nødutganger",
    description: "Lær hvor brannslukkere og nødutganger er.",
  },
  {
    id: "p3",
    title: "Allergener og matmerking",
    description: "Kjenn de 14 allergitypene og hvordan de merkes.",
  },
];

// ── Component ───────────────────────────────────────────

/**
 * Renders a new-employee onboarding flow.
 *
 * UI state keys used:
 * - phase: "welcome" | "terms" | "protocol" | "complete"
 * - termsAccepted: whether terms toggle is on
 * - completedItems: number of protocol items read
 */
export function FeatureOnboarding({
  currentStepId: _currentStepId,
  uiState,
  onInteraction,
}: DemoFeatureProps) {
  const phase = (uiState.phase as string) ?? "welcome";
  const termsAccepted = uiState.termsAccepted === true;
  const completedItems = (uiState.completedItems as number) ?? 0;

  return (
    <div className="flex h-full flex-col gap-5">
      <AnimatePresence mode="wait">
        {/* Phase: Welcome */}
        {phase === "welcome" && (
          <motion.div
            key="welcome"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.4 }}
            className="flex flex-1 flex-col items-center justify-center gap-6"
          >
            <motion.div
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 200, delay: 0.2 }}
              className="flex h-20 w-20 items-center justify-center rounded-3xl bg-rose-500/10"
            >
              <UserPlus className="h-10 w-10 text-rose-400" />
            </motion.div>
            <div className="text-center">
              <h2 className="text-2xl font-bold text-white">Velkommen, Sara!</h2>
              <p className="mt-2 max-w-sm text-sm text-zinc-400">
                Gratulerer med ny jobb hos Grand Hotel. La oss gjøre deg klar til din første vakt.
              </p>
            </div>
            <div className="flex items-center gap-3 text-sm text-zinc-500">
              <span className="flex items-center gap-1.5 rounded-full border border-rose-500/20 bg-rose-500/5 px-3 py-1 text-xs text-rose-300">
                Ny ansatt
              </span>
              <span>Grand Hotel — Kjøkken</span>
            </div>
          </motion.div>
        )}

        {/* Phase: Terms acceptance */}
        {phase === "terms" && (
          <motion.div
            key="terms"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.4 }}
            className="flex flex-1 flex-col gap-5"
          >
            <div className="flex items-center gap-3">
              <FileCheck className="h-5 w-5 text-rose-400" />
              <h2 className="text-xl font-bold text-white">Arbeidsreglement</h2>
            </div>

            {/* Terms document preview */}
            <div className="flex-1 rounded-2xl border border-white/[0.06] bg-[#0a0a0c] p-5">
              <h3 className="text-sm font-semibold text-white">Arbeidsreglement — Grand Hotel</h3>
              <div className="mt-3 space-y-2 text-xs leading-relaxed text-zinc-400">
                <p>
                  1. Alle ansatte skal møte i ren, godkjent uniform. Uniformen skal ikke brukes
                  utenfor arbeidsplassen.
                </p>
                <p>
                  2. Mobiltelefonbruk i arbeidstiden er kun tillatt i pauser og i forbindelse med
                  arbeidsoppgaver.
                </p>
                <p>3. Fravær skal meldes til nærmeste leder minimum 2 timer før vakten starter.</p>
                <p className="text-zinc-600">… (8 punkter til)</p>
              </div>
            </div>

            {/* Accept toggle */}
            <motion.button
              onClick={() => onInteraction("accept-terms")}
              className={`flex items-center gap-3 rounded-xl border p-4 transition-all ${
                termsAccepted
                  ? "border-emerald-500/30 bg-emerald-500/5"
                  : "border-white/[0.06] bg-[#0a0a0c] hover:border-rose-500/30"
              }`}
              animate={
                !termsAccepted
                  ? {
                      borderColor: [
                        "rgba(244,63,94,0.1)",
                        "rgba(244,63,94,0.4)",
                        "rgba(244,63,94,0.1)",
                      ],
                    }
                  : {}
              }
              transition={!termsAccepted ? { duration: 1.5, repeat: Infinity } : {}}
            >
              <div
                className={`flex h-6 w-6 items-center justify-center rounded-md ${
                  termsAccepted ? "bg-emerald-500/20" : "border border-zinc-600 bg-transparent"
                }`}
              >
                {termsAccepted && <CheckCircle2 className="h-4 w-4 text-emerald-400" />}
              </div>
              <span className={`text-sm ${termsAccepted ? "text-emerald-300" : "text-zinc-300"}`}>
                Jeg har lest og godtar arbeidsreglementet
              </span>
            </motion.button>
          </motion.div>
        )}

        {/* Phase: Protocol training */}
        {phase === "protocol" && (
          <motion.div
            key="protocol"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.4 }}
            className="flex flex-1 flex-col gap-5"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <BookOpen className="h-5 w-5 text-rose-400" />
                <h2 className="text-xl font-bold text-white">Opplæringsprotokoll</h2>
              </div>
              <span className="text-xs text-zinc-500">
                {completedItems} / {PROTOCOL_ITEMS.length}
              </span>
            </div>

            {/* Progress bar */}
            <div className="h-1.5 overflow-hidden rounded-full bg-zinc-800">
              <motion.div
                className="h-full rounded-full bg-rose-500"
                animate={{
                  width: `${(completedItems / PROTOCOL_ITEMS.length) * 100}%`,
                }}
                transition={{ duration: 0.5 }}
              />
            </div>

            {/* Protocol items */}
            <div className="flex flex-1 flex-col gap-2">
              {PROTOCOL_ITEMS.map((item, i) => {
                const isDone = i < completedItems;
                const isCurrent = i === completedItems;

                return (
                  <motion.button
                    key={item.id}
                    onClick={() => {
                      if (isCurrent) onInteraction(`complete-item-${i}`);
                    }}
                    disabled={!isCurrent}
                    className={`rounded-xl border p-4 text-left transition-all ${
                      isDone
                        ? "border-emerald-500/20 bg-emerald-500/5"
                        : isCurrent
                          ? "border-rose-500/20 bg-[#0a0a0c] hover:border-rose-500/40"
                          : "border-white/[0.06] bg-[#0a0a0c] opacity-40"
                    }`}
                    animate={
                      isCurrent
                        ? {
                            borderColor: [
                              "rgba(244,63,94,0.2)",
                              "rgba(244,63,94,0.5)",
                              "rgba(244,63,94,0.2)",
                            ],
                          }
                        : {}
                    }
                    transition={isCurrent ? { duration: 1.5, repeat: Infinity } : {}}
                  >
                    <div className="flex items-center gap-3">
                      {isDone ? (
                        <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" />
                      ) : (
                        <Circle
                          className={`h-5 w-5 shrink-0 ${isCurrent ? "text-rose-400" : "text-zinc-600"}`}
                        />
                      )}
                      <div>
                        <p
                          className={`text-sm font-medium ${isDone ? "text-zinc-500 line-through" : "text-white"}`}
                        >
                          {item.title}
                        </p>
                        <p className="mt-0.5 text-xs text-zinc-500">{item.description}</p>
                      </div>
                    </div>
                  </motion.button>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* Phase: Complete — "Klar til vakt!" */}
        {phase === "complete" && (
          <motion.div
            key="complete"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.4 }}
            className="flex flex-1 flex-col items-center justify-center gap-6"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 200, delay: 0.2 }}
              className="flex h-24 w-24 items-center justify-center rounded-3xl bg-emerald-500/10"
            >
              <Shield className="h-12 w-12 text-emerald-400" />
            </motion.div>

            <div className="text-center">
              <motion.h2
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="text-3xl font-black text-white"
              >
                Klar til vakt!
              </motion.h2>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6 }}
                className="mt-2 text-sm text-zinc-400"
              >
                Sara har fullført onboarding og er klar fra dag 1.
              </motion.p>
            </div>

            {/* Completion badges */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8 }}
              className="flex flex-wrap justify-center gap-2"
            >
              {[
                { label: "Reglement godkjent", icon: FileCheck },
                { label: "Protokoll fullført", icon: BookOpen },
                { label: "Klar-status", icon: Sparkles },
              ].map((badge) => (
                <span
                  key={badge.label}
                  className="flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/5 px-3 py-1.5 text-xs text-emerald-300"
                >
                  <badge.icon className="h-3 w-3" />
                  {badge.label}
                </span>
              ))}
            </motion.div>

            {/* Ready score */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 1.0 }}
              className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 px-8 py-4 text-center"
            >
              <p className="text-4xl font-black text-emerald-400">100%</p>
              <p className="mt-1 text-xs text-zinc-500">Readiness Score</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
