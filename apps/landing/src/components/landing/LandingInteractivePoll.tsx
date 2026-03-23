"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, ChevronRight, MessageCircleQuestion, Users } from "lucide-react";
import { postEvent } from "../../hooks/useTracking"; // For sending the poll answer to DB

type PollState = "idle" | "answering" | "done";

export function LandingInteractivePoll() {
  const [step, setStep] = useState<number>(1);
  const [state, setState] = useState<PollState>("idle");
  const [answers, setAnswers] = useState<{ size?: string; problem?: string }>({});

  const sizeOptions = [
    { id: "1-10", label: "1 - 10 ansatte" },
    { id: "11-30", label: "11 - 30 ansatte" },
    { id: "30+", label: "Over 30 ansatte" },
  ];

  const problemOptions = [
    { id: "scheduling", label: "Evig puslespill med vaktplan og fravær" },
    { id: "communication", label: "Beskjeder forsvinner i Facebook-grupper" },
    { id: "compliance", label: "Sliter med å dokumentere IK-Mat og rutiner" },
  ];

  function handleSizeSelect(id: string) {
    setAnswers((prev) => ({ ...prev, size: id }));
    setStep(2);
  }

  function handleProblemSelect(id: string) {
    const finalAnswers = { ...answers, problem: id };
    setAnswers(finalAnswers);
    setState("done");

    // Track the insight silently via our existing telemetry system!
    postEvent({
      event_type: "landing_poll_submitted",
      details: { ...finalAnswers },
    }).catch(() => {});
  }

  return (
    <div className="border-border bg-card/40 mx-auto w-full max-w-3xl overflow-hidden rounded-[2.5rem] border shadow-2xl backdrop-blur-xl">
      <div className="relative p-8 sm:p-12">
        {/* Soft background glow based on tokens */}
        <div className="bg-primary/5 absolute top-0 left-1/2 h-full w-full -translate-x-1/2 blur-3xl" />

        <AnimatePresence mode="wait">
          {state !== "done" && step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="relative z-10"
            >
              <div className="mb-6 flex items-center gap-3">
                <div className="bg-primary/20 flex h-12 w-12 items-center justify-center rounded-2xl">
                  <Users className="text-primary h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold tracking-tight">Hvor stort er teamet ditt?</h3>
                  <p className="text-muted-foreground mt-1 text-sm">
                    Vi tilpasser Smartout etter din skala.
                  </p>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                {sizeOptions.map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => handleSizeSelect(opt.id)}
                    className="border-border bg-background hover:border-primary/50 group flex flex-col items-center justify-center gap-3 rounded-2xl border p-6 transition-all hover:shadow-lg active:scale-95"
                  >
                    <span className="text-foreground text-lg font-semibold">{opt.label}</span>
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {state !== "done" && step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="relative z-10"
            >
              <div className="mb-6 flex items-center gap-3">
                <div className="bg-brand-orange/20 flex h-12 w-12 items-center justify-center rounded-2xl">
                  <MessageCircleQuestion className="text-brand-orange h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold tracking-tight">
                    Hva stjeler mest av tiden din i dag?
                  </h3>
                  <p className="text-muted-foreground mt-1 text-sm">
                    De fleste ledere mister 10-15 timer i uka på ren administrasjon.
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                {problemOptions.map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => handleProblemSelect(opt.id)}
                    className="border-border bg-background hover:border-brand-orange/50 group flex items-center justify-between rounded-2xl border p-5 text-left transition-all hover:shadow-lg active:scale-95"
                  >
                    <span className="text-foreground text-base font-medium">{opt.label}</span>
                    <ChevronRight className="text-muted-foreground group-hover:text-brand-orange h-5 w-5 transition-colors" />
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {state === "done" && (
            <motion.div
              key="done"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: "spring", damping: 20, stiffness: 100 }}
              className="relative z-10 py-6 text-center"
            >
              <div className="bg-success/20 mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full">
                <CheckCircle2 className="text-success h-10 w-10" />
              </div>
              <h3 className="mb-3 text-3xl font-bold tracking-tight">Vi hører deg.</h3>
              <p className="text-muted-foreground mx-auto max-w-md text-lg">
                {answers.problem === "scheduling"
                  ? "Smarout sin AI-motoren bygger ferdige vaktplaner på sekunder, og håndterer vaktbytter for deg."
                  : answers.problem === "communication"
                    ? "Samle alt i én proff app. Integrert chat, Dagens Beskjed og push-varsler som faktisk når frem."
                    : "Slutt på permer og papir. Alt av sjekklister, temperaturlogger og kontrakter signeres digitalt."}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
