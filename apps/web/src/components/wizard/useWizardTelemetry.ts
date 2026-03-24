"use client";

/**
 * useWizardTelemetry — emits SmartoutEvent telemetry for wizard lifecycle.
 *
 * Wraps @smartout/telemetry emit() with stable callbacks that match
 * the WizardShell callback props (onStepChange, onStepComplete, etc.).
 * Web-only — the @smartout/ui WizardShell stays platform-agnostic.
 */

import { useCallback, useRef } from "react";
import { emit } from "@smartout/telemetry";
import type { WizardDefinition } from "@smartout/ui";

export function useWizardTelemetry<TState extends Record<string, unknown>>(
  definition: WizardDefinition<TState>,
  workspaceId: string | null,
  actorId: string,
) {
  const startedAt = useRef(Date.now());

  const emitWizardStarted = useCallback(() => {
    emit({
      event: "wizard started",
      workspace_id: workspaceId,
      actor_id: actorId,
      properties: {
        data: {
          wizard_id: definition.id,
          theme: definition.theme,
          total_steps: definition.steps.length,
        },
      },
    });
    startedAt.current = Date.now();
  }, [definition, workspaceId, actorId]);

  const onStepChange = useCallback(
    (stepId: string, stepIndex: number, fromStep?: string) => {
      emit({
        event: "wizard step_entered",
        workspace_id: workspaceId,
        actor_id: actorId,
        properties: {
          data: {
            wizard_id: definition.id,
            step_id: stepId,
            step_index: stepIndex,
            from_step: fromStep,
          },
        },
      });
    },
    [definition.id, workspaceId, actorId],
  );

  const onStepComplete = useCallback(
    (stepId: string, stepIndex: number, _durationMs: number) => {
      emit({
        event: "wizard step_completed",
        workspace_id: workspaceId,
        actor_id: actorId,
        properties: {
          data: {
            wizard_id: definition.id,
            step_id: stepId,
            step_index: stepIndex,
          },
        },
      });
    },
    [definition.id, workspaceId, actorId],
  );

  const onStepSkip = useCallback(
    (stepId: string, stepIndex: number) => {
      emit({
        event: "wizard step_skipped",
        workspace_id: workspaceId,
        actor_id: actorId,
        properties: {
          data: {
            wizard_id: definition.id,
            step_id: stepId,
            step_index: stepIndex,
          },
        },
      });
    },
    [definition.id, workspaceId, actorId],
  );

  const onStepBack = useCallback(
    (stepId: string, toStep: string) => {
      emit({
        event: "wizard step_back",
        workspace_id: workspaceId,
        actor_id: actorId,
        properties: {
          data: {
            wizard_id: definition.id,
            step_id: stepId,
            to_step: toStep,
          },
        },
      });
    },
    [definition.id, workspaceId, actorId],
  );

  const onComplete = useCallback(() => {
    emit({
      event: "wizard completed",
      workspace_id: workspaceId,
      actor_id: actorId,
      properties: {
        data: {
          wizard_id: definition.id,
          workspace_id: workspaceId,
        },
      },
    });
  }, [definition.id, workspaceId, actorId]);

  const onValidationFail = useCallback(
    (stepId: string, errors: string[]) => {
      emit({
        event: "wizard validation_failed",
        workspace_id: workspaceId,
        actor_id: actorId,
        properties: {
          data: {
            wizard_id: definition.id,
            step_id: stepId,
            errors,
          },
        },
      });
    },
    [definition.id, workspaceId, actorId],
  );

  return {
    emitWizardStarted,
    onStepChange,
    onStepComplete,
    onStepSkip,
    onStepBack,
    onComplete,
    onValidationFail,
  };
}
