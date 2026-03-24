// packages/ui/src/wizard/WizardShell.tsx
"use client";

/**
 * WizardShell — Nordic Split layout
 *
 * Follows the visual language from login/signup:
 * - Warm background content area (left)
 * - Dark brand panel with contextual messages (right on desktop, hidden on mobile)
 * - Mobile: top progress bar, bottom navigation
 * - Step indicators in brand panel (minimal dots)
 *
 * When brandPanel is not configured, falls back to a simpler content-only layout.
 */

import { useEffect, useCallback } from "react";
import type { WizardDefinition, WizardStepDef, WizardStepProps, WizardThemeTokens } from "./types";
import { useWizardState } from "./useWizardState";
import { useWizardWalkAi } from "./useWizardWalkAi";
import { WizardTopBar } from "./WizardTopBar";
import { WizardNavBar } from "./WizardNavBar";

interface WizardShellProps<TState extends Record<string, unknown>> {
  definition: WizardDefinition<TState>;
  t: (key: string, params?: Record<string, string | number>) => string;
  onStepChange?: (stepId: string, stepIndex: number, fromStep?: string) => void;
  onStepComplete?: (stepId: string, stepIndex: number, durationMs: number) => void;
  onStepSkip?: (stepId: string, stepIndex: number) => void;
  onStepBack?: (stepId: string, toStep: string) => void;
  onComplete?: () => void;
  onValidationFail?: (stepId: string, errors: string[]) => void;
  renderStep?: (
    stepContent: React.ReactNode,
    direction: "forward" | "back",
    stepKey: string,
  ) => React.ReactNode;
  /** Render the brand panel content — receives current step id and message */
  renderBrandPanel?: (props: {
    currentStepId: string;
    currentStepIndex: number;
    totalSteps: number;
    message?: { heading: string; sub: string };
    logoSrc?: string;
  }) => React.ReactNode;
}

export function WizardShell<TState extends Record<string, unknown>>({
  definition,
  t,
  onStepChange,
  onStepComplete,
  onStepSkip,
  onStepBack,
  onComplete,
  onValidationFail,
  renderStep,
  renderBrandPanel,
}: WizardShellProps<TState>) {
  const {
    data,
    updateState,
    currentStep,
    currentStepIndex,
    completedSteps,
    isFirst,
    isLast,
    next: rawNext,
    back: rawBack,
    goTo: rawGoTo,
    wizardState,
    totalSteps,
  } = useWizardState(definition);

  const walkai = useWizardWalkAi(definition.id, currentStep?.id ?? "");
  const theme: WizardThemeTokens = { name: definition.theme };

  const stepsForNav = definition.steps as unknown as WizardStepDef<Record<string, unknown>>[];

  const handleNext = useCallback(async () => {
    const prevStep = currentStep;
    const durationMs = Date.now() - wizardState.stepEnteredAt;
    const result = await rawNext();

    if (result.success) {
      if (prevStep) {
        onStepComplete?.(prevStep.id, currentStepIndex, durationMs);
      }
      if (isLast) {
        onComplete?.();
      }
    } else if ("errors" in result) {
      onValidationFail?.(currentStep?.id ?? "", result.errors);
    }
  }, [
    rawNext,
    currentStep,
    currentStepIndex,
    isLast,
    wizardState.stepEnteredAt,
    onStepComplete,
    onComplete,
    onValidationFail,
  ]);

  const handleBack = useCallback(() => {
    const fromStep = currentStep?.id ?? "";
    rawBack();
    const prevIndex = currentStepIndex - 1;
    const toStep = definition.steps[prevIndex]?.id ?? "";
    onStepBack?.(fromStep, toStep);
  }, [rawBack, currentStep, currentStepIndex, definition.steps, onStepBack]);

  const handleSkip = useCallback(() => {
    if (currentStep) {
      onStepSkip?.(currentStep.id, currentStepIndex);
    }
    rawNext();
  }, [currentStep, currentStepIndex, rawNext, onStepSkip]);

  const handleGoTo = useCallback(
    (stepId: string) => {
      rawGoTo(stepId);
    },
    [rawGoTo],
  );

  useEffect(() => {
    if (currentStep) {
      onStepChange?.(currentStep.id, currentStepIndex);
    }
  }, [currentStep, currentStepIndex, onStepChange]);

  if (!currentStep) return null;

  const StepComponent = currentStep.component;
  const stepProps: WizardStepProps<TState> = {
    state: data,
    updateState,
    next: handleNext,
    back: handleBack,
    goTo: handleGoTo,
    isFirst,
    isLast,
    t,
    theme,
    walkai,
  };

  const stepContent = <StepComponent {...stepProps} />;
  const renderedStep = renderStep
    ? renderStep(stepContent, "forward", currentStep.id)
    : stepContent;

  const hasBrandPanel = !!definition.brandPanel && !!renderBrandPanel;
  const brandMessage = definition.brandPanel?.messages[currentStep.id];
  const panelPosition = definition.brandPanel?.position ?? "right";

  return (
    <div
      className="relative flex min-h-[100dvh] overflow-hidden"
      data-wizard-theme={definition.theme}
      data-walkai-id={`${definition.id}-shell`}
      data-walkai-type="wizard"
      data-walkai-context={JSON.stringify({
        wizardId: definition.id,
        currentStep: currentStep.id,
        currentStepIndex,
        totalSteps,
        theme: definition.theme,
      })}
    >
      {/* Noise overlay — matches login/signup */}
      <div className="bg-noise pointer-events-none fixed inset-0 z-30 opacity-[0.025] mix-blend-overlay" />

      {/* Brand panel — LEFT position (before content) */}
      {hasBrandPanel &&
        panelPosition === "left" &&
        renderBrandPanel({
          currentStepId: currentStep.id,
          currentStepIndex,
          totalSteps,
          message: brandMessage,
          logoSrc: definition.brandPanel?.logoSrc,
        })}

      {/* WIZARD CONTENT — warm background */}
      <div
        className="relative flex w-full flex-1 flex-col"
        style={{ backgroundColor: "var(--wizard-bg)" }}
      >
        {/* Mobile top bar — only on small screens */}
        <WizardTopBar
          steps={stepsForNav}
          currentStepIndex={currentStepIndex}
          completedSteps={completedSteps}
          t={t}
        />

        {/* Step content */}
        <main
          className="flex flex-1 items-start justify-center overflow-y-auto px-4 pt-4 pb-24 lg:px-8 xl:px-12"
          data-walkai-id={`${definition.id}-${currentStep.id}-step`}
          data-walkai-type="wizard-step"
        >
          {renderedStep}
        </main>

        {/* Navigation bar — bottom of content area */}
        <WizardNavBar
          isFirst={isFirst}
          isLast={isLast}
          isSkippable={currentStep.skippable ?? false}
          t={t}
          onBack={handleBack}
          onNext={handleNext}
          onSkip={currentStep.skippable ? handleSkip : undefined}
        />
      </div>

      {/* Brand panel — RIGHT position (after content, default) */}
      {hasBrandPanel &&
        panelPosition === "right" &&
        renderBrandPanel({
          currentStepId: currentStep.id,
          currentStepIndex,
          totalSteps,
          message: brandMessage,
          logoSrc: definition.brandPanel?.logoSrc,
        })}
    </div>
  );
}
