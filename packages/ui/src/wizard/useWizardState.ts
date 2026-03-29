// packages/ui/src/wizard/useWizardState.ts
"use client";

import { useState, useCallback, useRef, useMemo, useEffect } from "react";
import type { WizardDefinition, WizardState } from "./types";

export function useWizardState<TState extends Record<string, unknown>>(
  definition: WizardDefinition<TState>,
) {
  const [data, setData] = useState<TState>(definition.initialState);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(!!definition.loadState);
  const loadAttempted = useRef(false);
  const startedAt = useRef(Date.now());
  const stepEnteredAt = useRef(Date.now());

  /* Load persisted state on mount (guarded against React strict mode double-fire) */
  useEffect(() => {
    if (!definition.loadState || loadAttempted.current) return;
    loadAttempted.current = true;

    definition
      .loadState()
      .then((saved) => {
        if (!saved) {
          setLoading(false);
          return;
        }

        const { _initialStepIndex, ...rest } = saved as Partial<TState> & {
          _initialStepIndex?: number;
        };

        setData((prev) => ({ ...prev, ...rest }));

        if (typeof _initialStepIndex === "number" && _initialStepIndex >= 0) {
          setCurrentStepIndex(_initialStepIndex);
        }

        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, []);

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
      const dataToValidate = step.validationKey ? data[step.validationKey] : data;
      const result = step.validation.safeParse(dataToValidate);
      if (!result.success) {
        return {
          success: false as const,
          errors: result.error.issues.map((i: { message: string }) => i.message),
        };
      }
    }

    /* Let the step persist or clean up before we advance */
    await step.onStepLeave?.(data);

    setCompletedSteps((prev) => new Set(prev).add(step.id));

    if (currentStepIndex < definition.steps.length - 1) {
      setCurrentStepIndex((i) => i + 1);
      stepEnteredAt.current = Date.now();
    } else if (definition.onComplete) {
      await definition.onComplete(data);
    }

    return { success: true as const };
  }, [currentStepIndex, data, definition]);

  const skip = useCallback(() => {
    const step = definition.steps[currentStepIndex];
    if (step) {
      setCompletedSteps((prev) => new Set(prev).add(step.id));
    }
    if (currentStepIndex < definition.steps.length - 1) {
      setCurrentStepIndex((i) => i + 1);
      stepEnteredAt.current = Date.now();
    }
  }, [currentStepIndex, definition.steps]);

  const back = useCallback(async () => {
    if (currentStepIndex > 0) {
      const step = definition.steps[currentStepIndex];
      await step?.onStepLeave?.(data);
      setCurrentStepIndex((i) => i - 1);
      stepEnteredAt.current = Date.now();
    }
  }, [currentStepIndex, data, definition.steps]);

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
    loading,
    next,
    skip,
    back,
    goTo,
    wizardState,
    totalSteps: definition.steps.length,
  };
}
