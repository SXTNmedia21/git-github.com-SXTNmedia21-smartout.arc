"use client";

/**
 * WelcomeWizard.tsx
 *
 * First-login data-capture wizard for new Smartout employees.
 *
 * WHY: Admins should not fill personal data on behalf of employees.
 * This wizard blocks dashboard access until `profile.is_welcome_complete`
 * is true, collecting the minimum required data in 8 warm, polished steps.
 *
 * Design: Nordic Split system — Instrument Serif headings, warm OKLCH palette,
 * Framer Motion spring physics (stiffness 35 / damping 22 / mass 2.2).
 */

import { useState, useCallback, useReducer } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { HeroStep } from "./steps/HeroStep";
import { ContactStep } from "./steps/ContactStep";
import { AddressStep } from "./steps/AddressStep";
import { PersonalNumberStep } from "./steps/PersonalNumberStep";
import { AvailabilityStep } from "./steps/AvailabilityStep";
import { ConsentStep } from "./steps/ConsentStep";
import { OptionalStep } from "./steps/OptionalStep";
import { DoneStep } from "./steps/DoneStep";

// ─── Types ────────────────────────────────────────────────────────────────────

export type WizardStep = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

const TOTAL_STEPS = 8;

// Step 1 is hero (no indicator shown). Steps 2–7 show dots. Step 8 is done.
const STEPS_WITH_INDICATOR: WizardStep[] = [2, 3, 4, 5, 6, 7];

// ─── Spring config (Nordic Split — design-tokens motion.spring) ───────────────

const SPRING = { type: "spring" as const, stiffness: 35, damping: 22, mass: 2.2 };

// ─── Reducer ─────────────────────────────────────────────────────────────────

type WizardState = {
  step: WizardStep;
  direction: 1 | -1;
  userEmail: string;
};

type WizardAction = { type: "NEXT" } | { type: "BACK" } | { type: "JUMP"; step: WizardStep };

function wizardReducer(state: WizardState, action: WizardAction): WizardState {
  switch (action.type) {
    case "NEXT":
      return {
        ...state,
        step: Math.min(state.step + 1, TOTAL_STEPS) as WizardStep,
        direction: 1,
      };
    case "BACK":
      return {
        ...state,
        step: Math.max(state.step - 1, 1) as WizardStep,
        direction: -1,
      };
    case "JUMP":
      return {
        ...state,
        step: action.step,
        direction: action.step > state.step ? 1 : -1,
      };
    default:
      return state;
  }
}

// ─── Step Dots ────────────────────────────────────────────────────────────────

function StepDots({
  current,
  total,
  prefersReduced,
}: {
  current: WizardStep;
  total: number;
  prefersReduced: boolean | null;
}) {
  // Dots show for steps 2-7 (6 data-entry steps). Current refers to which dot is active.
  const dotIndex = current - 2; // step 2 = dot 0, step 7 = dot 5
  // WHY: width morph is a vestibular trigger (WCAG 2.3.3) — collapse to near-instant when
  // user prefers reduced motion.
  const dotTransition = prefersReduced ? { duration: 0.01 } : SPRING;
  return (
    <div className="flex items-center justify-center gap-2" aria-hidden>
      {Array.from({ length: total }).map((_, i) => (
        <motion.div
          key={i}
          animate={{
            width: i === dotIndex ? 20 : 6,
            opacity: i === dotIndex ? 1 : 0.35,
          }}
          transition={dotTransition}
          className="bg-foreground h-1.5 rounded-full"
        />
      ))}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export type WelcomeWizardProps = {
  /** Email from auth.user — pre-filled and readonly in step 2. */
  userEmail: string;
  /**
   * Whether the employee is bound by a collective tariff agreement.
   * Passed to ConsentStep (step 6) to show tariff-specific consent copy.
   * Defaults to false; real value is wired by the parent page (T16).
   */
  tariffBound?: boolean;
};

export function WelcomeWizard({ userEmail, tariffBound = false }: WelcomeWizardProps) {
  const prefersReduced = useReducedMotion();

  const [state, dispatch] = useReducer(wizardReducer, {
    step: 1,
    direction: 1,
    userEmail,
  });

  const next = useCallback(() => dispatch({ type: "NEXT" }), []);
  const back = useCallback(() => dispatch({ type: "BACK" }), []);

  const { step, direction } = state;

  // Slide variants — x offset scaled down when user prefers reduced motion
  const slideDistance = prefersReduced ? 12 : 40;
  const variants = {
    enter: (dir: number) => ({ opacity: 0, x: dir * slideDistance }),
    center: { opacity: 1, x: 0 },
    exit: (dir: number) => ({ opacity: 0, x: -dir * slideDistance }),
  };

  const showIndicator = STEPS_WITH_INDICATOR.includes(step);

  return (
    <Dialog open modal>
      <DialogContent
        // Override default close button — wizard is mandatory until complete
        className="border-border bg-background flex max-h-[100dvh] max-w-md flex-col gap-0 overflow-y-auto rounded-2xl border p-0 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] shadow-2xl"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        aria-describedby="welcome-wizard-desc"
      >
        {/* WHY: Radix Dialog requires DialogTitle for WCAG 4.1.2 — screen readers announce
            the dialog name on open. Visually hidden via sr-only. */}
        <DialogTitle className="sr-only">Velkommen til Smartout</DialogTitle>
        {/* WHY: aria-describedby="welcome-wizard-desc" declared on DialogContent above
            needs a matching element — this fulfils the reference. */}
        <DialogDescription id="welcome-wizard-desc" className="sr-only">
          Fullfør profilen din. Det tar 3–5 minutter.
        </DialogDescription>
        {/* Ambient warm orb — decorative, never interactive */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl"
        >
          <div
            style={{
              background:
                "radial-gradient(ellipse 80% 60% at 50% -10%, color-mix(in oklch, var(--brand-glow-warm) 18%, transparent) 0%, transparent 70%)",
            }}
            className="absolute inset-0"
          />
        </div>

        {/* Step content */}
        <div className="relative flex min-h-[420px] flex-col">
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={step}
              custom={direction}
              variants={variants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={prefersReduced ? { duration: 0.15 } : SPRING}
              className="flex flex-1 flex-col p-8"
              aria-live="polite"
            >
              {step === 1 && <HeroStep onNext={next} />}
              {step === 2 && <ContactStep userEmail={userEmail} onNext={next} onBack={back} />}
              {step === 3 && <AddressStep onNext={next} onBack={back} />}
              {step === 4 && <PersonalNumberStep onNext={next} onBack={back} />}
              {step === 5 && <AvailabilityStep onNext={next} onBack={back} />}
              {step === 6 && <ConsentStep onNext={next} onBack={back} tariffBound={tariffBound} />}
              {step === 7 && <OptionalStep onNext={next} onBack={back} />}
              {step === 8 && <DoneStep />}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Step dots — only visible for data-entry steps */}
        <AnimatePresence>
          {showIndicator && (
            // WHY: transition gated on prefersReduced — unconditional 0.3s fade is a
            // vestibular trigger for reduced-motion users (WCAG 2.3.3).
            <motion.div
              key="dots"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={prefersReduced ? { duration: 0.01 } : { duration: 0.3 }}
              className="flex justify-center pb-6"
            >
              <StepDots
                current={step}
                total={STEPS_WITH_INDICATOR.length}
                prefersReduced={prefersReduced}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}
