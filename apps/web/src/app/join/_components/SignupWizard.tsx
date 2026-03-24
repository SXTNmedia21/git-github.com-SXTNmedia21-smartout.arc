"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { WizardProvider, useSignupWizard } from "../_hooks/useSignupWizard";
import { WizardProgress } from "./WizardProgress";
import { Step1Account } from "./Step1Account";
import { Step2Business } from "./Step2Business";
import { Step3About } from "./Step3About";
import { Step4Hours } from "./Step4Hours";
import { Step5Menu } from "./Step5Menu";
import { Step6CreateAccount } from "./Step6CreateAccount";
import { SetupLoading } from "./SetupLoading";
import { ConnectionBanner } from "./ConnectionBanner";

/* ─────────────────────────────────────────────────────
   Join Wizard — Nordic Split layout

   Continues the visual language from /login:
   - Dark brand panel on the RIGHT (it slid there from login)
   - Wizard content on the LEFT
   - Contextual messages per step on the brand panel
   ───────────────────────────────────────────────────── */

// Step-specific brand messages
const STEP_MESSAGES: Record<number, { heading: string; sub: string }> = {
  1: {
    heading: "Fortell oss\nom bedriften din.",
    sub: "Vi bruker dette til å sette opp alt for deg.",
  },
  2: {
    heading: "Vi fyller ut\nså mye vi kan.",
    sub: "Sjekk at informasjonen stemmer — du kan endre alt.",
  },
  3: {
    heading: "Gi bedriften\ndin en stemme.",
    sub: "AI hjelper deg å skrive — du bestemmer tonen.",
  },
  4: {
    heading: "Når er dere\nåpne?",
    sub: "Åpningstider hjelper oss planlegge drift og bemanning.",
  },
  5: { heading: "Del menyen\ndin.", sub: "Valgfritt — men det gir smartere opplæring." },
  6: { heading: "Nesten\nferdig.", sub: "Opprett kontoen din for å fullføre." },
};

export function SignupWizard() {
  return (
    <WizardProvider>
      <WizardContent />
    </WizardProvider>
  );
}

// Brand panel entrance — slides in from the left as if arriving from login swap
const panelEntrance = {
  hidden: { x: "-30%", opacity: 0 },
  visible: {
    x: "0%",
    opacity: 1,
    transition: {
      type: "spring" as const,
      stiffness: 40,
      damping: 22,
      mass: 2,
      delay: 0.1,
    },
  },
};

// Brand text transition between steps
const brandTransition = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: [0.25, 0.1, 0.25, 1] as const, delay: 0.15 },
  },
  exit: {
    opacity: 0,
    y: -10,
    transition: { duration: 0.25, ease: [0.25, 0.1, 0.25, 1] as const },
  },
};

function WizardContent() {
  const { state, scrapeStatus } = useSignupWizard();
  const prevStepRef = useRef(state.currentStep);
  const [direction, setDirection] = useState<"forward" | "backward">("forward");

  // Determine slide direction
  useEffect(() => {
    setDirection(state.currentStep >= prevStepRef.current ? "forward" : "backward");
    prevStepRef.current = state.currentStep;
  }, [state.currentStep]);

  const isSetupPhase = state.currentStep >= 7;
  const stepMessage = STEP_MESSAGES[state.currentStep] ?? STEP_MESSAGES[1]!;

  return (
    <div className="relative flex min-h-[100dvh] overflow-hidden">
      <ConnectionBanner />
      {/* Noise overlay */}
      <div className="bg-noise pointer-events-none fixed inset-0 z-30 opacity-[0.025] mix-blend-overlay" />

      {/* ── WIZARD CONTENT (left) ── */}
      <div className="relative flex w-full flex-1 flex-col bg-[oklch(0.99_0.004_60)]">
        {/* Progress bar */}
        {!isSetupPhase && <WizardProgress />}

        {/* Step content */}
        <main className="flex flex-1 items-start justify-center px-4 pt-4 pb-12 lg:px-8 xl:px-12">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={state.currentStep}
              className="w-full"
              initial={{ opacity: 0, x: direction === "forward" ? 30 : -30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: direction === "forward" ? -15 : 15 }}
              transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
            >
              {state.currentStep === 1 && <Step1Account />}
              {state.currentStep === 2 && <Step2Business scrapeStatus={scrapeStatus} />}
              {state.currentStep === 3 && <Step3About />}
              {state.currentStep === 4 && <Step4Hours />}
              {state.currentStep === 5 && <Step5Menu />}
              {state.currentStep === 6 && <Step6CreateAccount />}
              {isSetupPhase && <SetupLoading />}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* ── BRAND PANEL (right) — dark, matches login ── */}
      <AnimatePresence>
        {!isSetupPhase && (
          <motion.div
            className="relative hidden w-[380px] shrink-0 overflow-hidden lg:flex xl:w-[440px]"
            style={{ willChange: "transform, opacity" }}
            variants={panelEntrance}
            initial="hidden"
            animate="visible"
            exit={{
              opacity: 0,
              x: "10%",
              transition: { duration: 0.5, ease: [0.25, 0.1, 0.25, 1] },
            }}
          >
            <div className="absolute inset-0 bg-[oklch(0.18_0.03_50)]" />

            {/* Ambient glow — same as login */}
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
              <div className="animate-ambient-1 absolute -top-[20%] left-[20%] h-[50vh] w-[50vh] rounded-full bg-[oklch(0.45_0.18_40)] opacity-30 blur-[130px]" />
              <div className="animate-ambient-2 absolute right-[10%] -bottom-[10%] h-[40vh] w-[40vh] rounded-full bg-[oklch(0.35_0.14_35)] opacity-25 blur-[110px]" />
            </div>

            {/* Subtle left edge */}
            <div className="absolute top-0 left-0 h-full w-px bg-gradient-to-b from-transparent via-white/[0.06] to-transparent" />

            <div className="relative z-10 flex flex-1 flex-col justify-between p-10 xl:p-12">
              {/* Logo */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.6, delay: 0.5, ease: [0.25, 0.1, 0.25, 1] }}
              >
                <Image
                  src="/smartout-logo.png"
                  alt="Smartout"
                  width={100}
                  height={34}
                  className="opacity-70 brightness-0 invert"
                  priority
                />
              </motion.div>

              {/* Contextual message per step */}
              <div className="max-w-[320px]">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={state.currentStep}
                    variants={brandTransition}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                  >
                    <h2 className="text-[2rem] leading-[1.1] font-bold tracking-tight whitespace-pre-line text-white xl:text-[2.2rem]">
                      {stepMessage.heading.split("\n").map((line, i) => (
                        <span key={i}>
                          {i > 0 && <br />}
                          {line}
                        </span>
                      ))}
                    </h2>
                    <p className="mt-4 text-[0.875rem] leading-relaxed text-white/45">
                      {stepMessage.sub}
                    </p>
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* Step indicator */}
              <div className="flex items-center gap-2">
                {[1, 2, 3, 4, 5, 6].map((step) => (
                  <motion.div
                    key={step}
                    className="h-1 rounded-full"
                    animate={{
                      width: step === state.currentStep ? 24 : 12,
                      backgroundColor:
                        step <= state.currentStep ? "oklch(0.75 0.18 40)" : "oklch(1 0 0 / 0.15)",
                    }}
                    transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
                  />
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
