/**
 * Hooks for cleaning checklist execution on mobile.
 *
 * useCompleteCheckpoint — Enqueues a single checkpoint completion to the sync queue.
 * useSignChecklist — Enqueues all remaining checkpoints as completed (batch sign-off).
 *
 * Both use the offline sync queue to ensure compliance data is never lost
 * due to connectivity issues (checklist completion is a legal requirement
 * for HACCP / Mattilsynet compliance in hospitality).
 */

import { useCallback, useState } from "react";
import { enqueue } from "@/lib/sync/queue";
import { emit } from "@smartout/telemetry";

type UseCompleteCheckpointReturn = {
  completeCheckpoint: (params: {
    taskId: string;
    profileId: string;
    workspaceId: string;
    evidence?: Record<string, unknown>;
  }) => Promise<string>;
  isSubmitting: boolean;
};

export function useCompleteCheckpoint(): UseCompleteCheckpointReturn {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const completeCheckpoint = useCallback(
    async (params: {
      taskId: string;
      profileId: string;
      workspaceId: string;
      evidence?: Record<string, unknown>;
    }): Promise<string> => {
      setIsSubmitting(true);

      try {
        const now = new Date().toISOString();
        const rowId = await enqueue("complete_checkpoint", {
          task_id: params.taskId,
          completed_by: params.profileId,
          completed_at: now,
          evidence: params.evidence ?? null,
          status: "completed",
        });

        void emit({
          event: "checklist step_completed",
          workspace_id: params.workspaceId,
          actor_id: params.profileId,
          properties: {
            data: { task_id: params.taskId },
          },
        });

        return rowId;
      } finally {
        setIsSubmitting(false);
      }
    },
    [],
  );

  return { completeCheckpoint, isSubmitting };
}

type UseSignChecklistReturn = {
  signChecklist: (params: {
    taskIds: string[];
    profileId: string;
    workspaceId: string;
    procedureId: string;
    sessionId: string;
  }) => Promise<string>;
  isSigning: boolean;
};

export function useSignChecklist(): UseSignChecklistReturn {
  const [isSigning, setIsSigning] = useState(false);

  const signChecklist = useCallback(
    async (params: {
      taskIds: string[];
      profileId: string;
      workspaceId: string;
      procedureId: string;
      sessionId: string;
    }): Promise<string> => {
      setIsSigning(true);

      try {
        const now = new Date().toISOString();

        /* Enqueue all pending tasks as completed in a single batch */
        const rowId = await enqueue("sign_checklist", {
          task_ids: params.taskIds,
          completed_by: params.profileId,
          completed_at: now,
          status: "completed",
        });

        void emit({
          event: "checklist completed",
          workspace_id: params.workspaceId,
          actor_id: params.profileId,
          properties: {
            data: {
              procedure_id: params.procedureId,
              session_id: params.sessionId,
              total_steps: params.taskIds.length,
            },
          },
        });

        return rowId;
      } finally {
        setIsSigning(false);
      }
    },
    [],
  );

  return { signChecklist, isSigning };
}
