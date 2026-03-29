"use client";

/**
 * AnimatedWizardShell — Nordic Split layout
 *
 * Follows the established design language from login/signup/join:
 * - Content area (left) with warm background
 * - Dark brand panel (right) with ambient glows, logo, contextual messages
 * - framer-motion transitions between steps
 * - Mobile: brand panel hidden, top progress bar shown
 *
 * This IS the Smartout design. Every wizard uses this layout.
 */

import { useRef, useEffect, useCallback } from "react";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { WizardShell, type WizardDefinition } from "@smartout/ui";
import { useTranslation } from "@smartout/i18n";
import { motion as motionTokens } from "@smartout/design-tokens";
import { useWizardTelemetry } from "./useWizardTelemetry";

const EASE = motionTokens.easingArray;

/* ── Motion constants — matching login/signup springs ── */

const brandTextTransition = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: EASE, delay: 0.15 },
  },
  exit: {
    opacity: 0,
    y: -10,
    transition: { duration: 0.25, ease: EASE },
  },
};

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

const stepTransition = {
  initial: { opacity: 0, x: 30 },
  animate: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.25, ease: EASE },
  },
  exit: {
    opacity: 0,
    x: -15,
    transition: { duration: 0.25, ease: EASE },
  },
};

interface AnimatedWizardShellProps<TState extends Record<string, unknown>> {
  definition: WizardDefinition<TState>;
  workspaceId?: string | null;
  actorId?: string;
  onContextChange?: (context: import("@smartout/ui").WizardContextPayload) => void;
}

export function AnimatedWizardShell<TState extends Record<string, unknown>>({
  definition,
  workspaceId = null,
  actorId = "anonymous",
  onContextChange,
}: AnimatedWizardShellProps<TState>) {
  const { t: tShell } = useTranslation("wizard");
  const { t: tWizard } = useTranslation(definition.metadata.i18nNamespace);
  const telemetry = useWizardTelemetry(definition, workspaceId, actorId);
  const directionRef = useRef<"forward" | "back">("forward");

  const t = useCallback(
    (key: string, params?: Record<string, string | number>) => {
      const wizardResult = tWizard(key, params);
      if (wizardResult === key) return tShell(key, params);
      return wizardResult;
    },
    [tWizard, tShell],
  );

  useEffect(() => {
    telemetry.emitWizardStarted();
  }, [telemetry.emitWizardStarted]);

  const renderStep = useCallback(
    (stepContent: React.ReactNode, direction: "forward" | "back", stepKey: string) => {
      directionRef.current = direction;
      return (
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={stepKey}
            className="w-full"
            initial={stepTransition.initial}
            animate={stepTransition.animate}
            exit={stepTransition.exit}
          >
            {stepContent}
          </motion.div>
        </AnimatePresence>
      );
    },
    [],
  );

  const renderBrandPanel = useCallback(
    (props: {
      currentStepId: string;
      currentStepIndex: number;
      totalSteps: number;
      message?: { heading: string; sub: string };
      logoSrc?: string;
    }) => {
      const raw = props.message ?? { heading: "", sub: "" };
      // Resolve i18n keys — if t() returns the key unchanged, use the raw value
      const resolvedHeading = t(raw.heading);
      const resolvedSub = t(raw.sub);
      const message = {
        heading: resolvedHeading !== raw.heading ? resolvedHeading : raw.heading,
        sub: resolvedSub !== raw.sub ? resolvedSub : raw.sub,
      };

      return (
        <motion.div
          className="relative hidden w-[380px] shrink-0 overflow-hidden lg:flex xl:w-[440px]"
          style={{ willChange: "transform, opacity" }}
          variants={panelEntrance}
          initial="hidden"
          animate="visible"
          exit={{
            opacity: 0,
            x: "10%",
            transition: { duration: 0.5, ease: EASE },
          }}
        >
          {/* Dark panel background */}
          <div className="bg-join-panel absolute inset-0" />

          {/* Ambient glow orbs — warm Nordic */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="animate-ambient-1 bg-join-glow-1 absolute -top-[20%] left-[20%] h-[50vh] w-[50vh] rounded-full opacity-30 blur-[130px]" />
            <div className="animate-ambient-2 bg-join-glow-2 absolute right-[10%] -bottom-[10%] h-[40vh] w-[40vh] rounded-full opacity-25 blur-[110px]" />
          </div>

          {/* Subtle left edge divider */}
          <div className="absolute top-0 left-0 h-full w-px bg-gradient-to-b from-transparent via-white/[0.06] to-transparent" />

          <div className="relative z-10 flex flex-1 flex-col justify-between p-10 xl:p-12">
            {/* Logo */}
            {props.logoSrc && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.6, delay: 0.5, ease: EASE }}
              >
                <Image
                  src={props.logoSrc}
                  alt="Smartout"
                  width={100}
                  height={34}
                  className="opacity-70 brightness-0 invert"
                  priority
                />
              </motion.div>
            )}

            {/* Contextual message per step */}
            <div className="max-w-[320px]">
              <AnimatePresence mode="wait">
                <motion.div
                  key={props.currentStepId}
                  variants={brandTextTransition}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                >
                  <h2 className="text-[2rem] leading-[1.1] font-bold tracking-tight whitespace-pre-line text-white xl:text-[2.2rem]">
                    {message.heading.split("\n").map((line, i) => (
                      <span key={i}>
                        {i > 0 && <br />}
                        {line}
                      </span>
                    ))}
                  </h2>
                  <p className="mt-4 text-[0.875rem] leading-relaxed text-white/45">
                    {message.sub}
                  </p>
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Step indicator dots — minimal, matches login */}
            <div className="flex items-center gap-2">
              {definition.steps.map((step, i) => (
                <motion.div
                  key={step.id}
                  className="h-1 rounded-full"
                  animate={{
                    width: i === props.currentStepIndex ? 24 : 12,
                    backgroundColor:
                      i <= props.currentStepIndex
                        ? "var(--brand-orange-light)"
                        : "oklch(1 0 0 / 0.15)",
                  }}
                  transition={{ duration: 0.4, ease: EASE }}
                />
              ))}
            </div>
          </div>
        </motion.div>
      );
    },
    [definition.steps],
  );

  return (
    <WizardShell
      definition={definition}
      t={t}
      onStepChange={telemetry.onStepChange}
      onStepComplete={telemetry.onStepComplete}
      onStepSkip={telemetry.onStepSkip}
      onStepBack={telemetry.onStepBack}
      onComplete={telemetry.onComplete}
      onValidationFail={telemetry.onValidationFail}
      onContextChange={onContextChange}
      renderStep={renderStep}
      renderBrandPanel={definition.brandPanel ? renderBrandPanel : undefined}
    />
  );
}
