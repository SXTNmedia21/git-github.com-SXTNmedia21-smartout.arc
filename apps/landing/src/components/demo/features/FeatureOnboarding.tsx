// ============================================
// FeatureOnboarding.tsx
// Demo feature component: new employee onboarding.
// Day-one experience: welcome → accept terms →
// complete first protocol → "Klar til vakt!" badge.
// Connected to: journeys/journey-6-onboarding.ts (config),
//   DemoShell.tsx (rendered inside left panel)
// ============================================

"use client";

import { m, AnimatePresence } from "framer-motion";
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
export function FeatureOnboarding({ uiState, onInteraction }: DemoFeatureProps) {
  const phase = (uiState.phase as string) ?? "welcome";
  const termsAccepted = uiState.termsAccepted === true;
  const completedItems = (uiState.completedItems as number) ?? 0;

  return (
    <div className="flex h-full flex-col gap-5">
      <AnimatePresence mode="wait">
        {/* Phase: Welcome */}
        {phase === "welcome" && (
          <m.div
            key="welcome"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.4 }}
            className="flex flex-1 flex-col items-center justify-center gap-6"
          >
            <m.div
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 200, delay: 0.2 }}
              className="flex h-20 w-20 items-center justify-center rounded-3xl bg-rose-500/10"
            >
              <UserPlus className="h-10 w-10 text-rose-400" />
            </m.div>
            <div className="text-center">
              <h2 className="text-foreground text-2xl font-bold">Velkommen, Sara!</h2>
              <p className="text-muted-foreground mt-2 max-w-sm text-sm">
                Gratulerer med ny jobb hos Grand Hotel. La oss gjøre deg klar til din første vakt.
              </p>
            </div>
            <div className="text-muted-foreground flex items-center gap-3 text-sm">
              <span className="flex items-center gap-1.5 rounded-full border border-rose-500/20 bg-rose-500/5 px-3 py-1 text-xs text-rose-300">
                Ny ansatt
              </span>
              <span>Grand Hotel — Kjøkken</span>
            </div>
          </m.div>
        )}

        {/* Phase: Terms acceptance */}
        {phase === "terms" && (
          <m.div
            key="terms"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.4 }}
            className="flex flex-1 flex-col gap-5"
          >
            <div className="flex items-center gap-3">
              <FileCheck className="h-5 w-5 text-rose-400" />
              <h2 className="text-foreground text-xl font-bold">Arbeidsreglement</h2>
            </div>

            {/* Terms document preview */}
            <div className="border-border bg-background flex-1 rounded-2xl border p-5">
              <h3 className="text-foreground text-sm font-semibold">
                Arbeidsreglement — Grand Hotel
              </h3>
              <div className="text-muted-foreground mt-3 space-y-2 text-xs leading-relaxed">
                <p>
                  1. Alle ansatte skal møte i ren, godkjent uniform. Uniformen skal ikke brukes
                  utenfor arbeidsplassen.
                </p>
                <p>
                  2. Mobiltelefonbruk i arbeidstiden er kun tillatt i pauser og i forbindelse med
                  arbeidsoppgaver.
                </p>
                <p>3. Fravær skal meldes til nærmeste leder minimum 2 timer før vakten starter.</p>
                <p className="text-muted-foreground/70">… (8 punkter til)</p>
              </div>
            </div>

            {/* Accept toggle */}
            <m.button
              onClick={() => onInteraction("accept-terms")}
              className={`flex items-center gap-3 rounded-xl border p-4 transition-all ${
                termsAccepted
                  ? "border-emerald-500/30 bg-emerald-500/5"
                  : "border-border bg-background hover:border-rose-500/30"
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
                  termsAccepted ? "bg-emerald-500/20" : "border-border border bg-transparent"
                }`}
              >
                {termsAccepted && <CheckCircle2 className="h-4 w-4 text-emerald-400" />}
              </div>
              <span className={`text-sm ${termsAccepted ? "text-emerald-300" : "text-foreground"}`}>
                Jeg har lest og godtar arbeidsreglementet
              </span>
            </m.button>
          </m.div>
        )}

        {/* Phase: Protocol training */}
        {phase === "protocol" && (
          <m.div
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
                <h2 className="text-foreground text-xl font-bold">Opplæringsprotokoll</h2>
              </div>
              <span className="text-muted-foreground text-xs">
                {completedItems} / {PROTOCOL_ITEMS.length}
              </span>
            </div>

            {/* Progress bar */}
            <div className="bg-muted h-1.5 overflow-hidden rounded-full">
              <m.div
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
                  <m.button
                    key={item.id}
                    onClick={() => {
                      if (isCurrent) onInteraction(`complete-item-${i}`);
                    }}
                    disabled={!isCurrent}
                    className={`rounded-xl border p-4 text-left transition-all ${
                      isDone
                        ? "border-emerald-500/20 bg-emerald-500/5"
                        : isCurrent
                          ? "bg-background border-rose-500/20 hover:border-rose-500/40"
                          : "border-border bg-background opacity-40"
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
                          className={`h-5 w-5 shrink-0 ${isCurrent ? "text-rose-400" : "text-muted-foreground/70"}`}
                        />
                      )}
                      <div>
                        <p
                          className={`text-sm font-medium ${isDone ? "text-muted-foreground line-through" : "text-foreground"}`}
                        >
                          {item.title}
                        </p>
                        <p className="text-muted-foreground mt-0.5 text-xs">{item.description}</p>
                      </div>
                    </div>
                  </m.button>
                );
              })}
            </div>
          </m.div>
        )}

        {/* Phase: Complete — "Klar til vakt!" */}
        {phase === "complete" && (
          <m.div
            key="complete"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.4 }}
            className="flex flex-1 flex-col items-center justify-center gap-6"
          >
            <m.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 200, delay: 0.2 }}
              className="flex h-24 w-24 items-center justify-center rounded-3xl bg-emerald-500/10"
            >
              <Shield className="h-12 w-12 text-emerald-400" />
            </m.div>

            <div className="text-center">
              <m.h2
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="text-foreground text-3xl font-black"
              >
                Klar til vakt!
              </m.h2>
              <m.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6 }}
                className="text-muted-foreground mt-2 text-sm"
              >
                Sara har fullført onboarding og er klar fra dag 1.
              </m.p>
            </div>

            {/* Completion badges */}
            <m.div
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
            </m.div>

            {/* Ready score */}
            <m.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 1.0 }}
              className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 px-8 py-4 text-center"
            >
              <p className="text-4xl font-black text-emerald-400">100%</p>
              <p className="text-muted-foreground mt-1 text-xs">Readiness Score</p>
            </m.div>
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
}
