// packages/ui/src/wizard/useWizardState.ts
"use client";

import { useState, useCallback, useRef, useMemo } from "react";
import type { WizardDefinition, WizardState } from "./types";

export function useWizardState<TState extends Record<string, unknown>>(
  definition: WizardDefinition<TState>,
) {
  const [data, setData] = useState<TState>(definition.initialState);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set());
  const startedAt = useRef(Date.now());
  const stepEnteredAt = useRef(Date.now());

  const currentStep = definition.steps[currentStepIndex];
  const isFirst = currentStepIndex === 0;
  const isLast = currentStepIndex === definition.steps.length - 1;

  const updateState = useCallback((patch: Partial<TState>) => {
    setData((prev) => ({ ...prev, ...patch }));
  }, []);

  const next = useCallback(async () => {
    const step = definition.steps[currentStepIndex];

    if (!step) {
      return { success: false as const, errors: ["No current step"] };
    }

    if (step.validation) {
      const result = step.validation.safeParse(data);
      if (!result.success) {
        return {
          success: false as const,
          errors: result.error.issues.map((i: { message: string }) => i.message),
        };
      }
    }

    setCompletedSteps((prev) => new Set(prev).add(step.id));

    if (currentStepIndex < definition.steps.length - 1) {
      setCurrentStepIndex((i) => i + 1);
      stepEnteredAt.current = Date.now();
    } else if (definition.onComplete) {
      await definition.onComplete(data);
    }

    return { success: true as const };
  }, [currentStepIndex, data, definition]);

  const back = useCallback(() => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex((i) => i - 1);
      stepEnteredAt.current = Date.now();
    }
  }, [currentStepIndex]);

  const goTo = useCallback(
    (stepId: string) => {
      const index = definition.steps.findIndex((s) => s.id === stepId);
      if (index >= 0) {
        setCurrentStepIndex(index);
        stepEnteredAt.current = Date.now();
      }
    },
    [definition.steps],
  );

  const wizardState: WizardState = useMemo(
    () => ({
      currentStepIndex,
      completedSteps,
      data,
      startedAt: startedAt.current,
      stepEnteredAt: stepEnteredAt.current,
    }),
    [currentStepIndex, completedSteps, data],
  );

  return {
    data,
    updateState,
    currentStep,
    currentStepIndex,
    completedSteps,
    isFirst,
    isLast,
    next,
    back,
    goTo,
    wizardState,
    totalSteps: definition.steps.length,
  };
}
