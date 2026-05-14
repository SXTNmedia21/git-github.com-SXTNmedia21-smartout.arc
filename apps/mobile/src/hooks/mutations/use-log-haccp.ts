/**
 * useLogHaccp — Enqueues a HACCP temperature log to the offline sync queue.
 *
 * HACCP logging is a legal requirement (Mattilsynet / food safety authorities).
 * The write goes through the SQLite queue so it works offline — compliance
 * data must never be lost due to connectivity issues.
 *
 * Payload matches the haccp_log table schema. UUID is generated client-side
 * so the record can be referenced immediately.
 *
 * ADR-0134: identity (workspace_id, profile_id/actor_id) is resolved via
 * getProfileContext() before emit — caller-supplied IDs were forgeable
 * attribution (L-0083 / L-0177).
 */
import { useCallback, useState } from "react";
import { randomUUID } from "expo-crypto";

import { enqueue } from "@/lib/sync/queue";
import { getProfileContext } from "@/lib/profile-context";
import { emit } from "@smartout/telemetry";

export type HACCPPayload = {
  ccp_reference: string;
  temperature: number;
  unit: string;
  is_within_range: boolean;
  corrective_action: string | null;
  session_id: string | null;
};

type UseLogHaccpReturn = {
  logHaccp: (payload: HACCPPayload) => Promise<string>;
  isSubmitting: boolean;
};

export function useLogHaccp(): UseLogHaccpReturn {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const logHaccp = useCallback(async (payload: HACCPPayload): Promise<string> => {
    setIsSubmitting(true);

    try {
      // ADR-0134: resolve identity from server before any write or emit.
      // Throws on unauthenticated / missing profile — fail fast, no corrupt telemetry.
      const { profileId, workspaceId } = await getProfileContext();

      const haccpLogId = randomUUID();
      const now = new Date().toISOString();

      const rowId = await enqueue("haccp_log", {
        haccp_log_id: haccpLogId,
        ccp_reference: payload.ccp_reference,
        temperature: payload.temperature,
        unit: payload.unit,
        is_within_range: payload.is_within_range,
        corrective_action: payload.corrective_action,
        session_id: payload.session_id,
        profile_id: profileId,
        workspace_id: workspaceId,
        logged_at: now,
      });

      // Only emit when we have a real session reference. Empty-string
      // entity_id silently corrupts activity_trail routing (ADR-0134 /
      // L-0083). Skipping the emit on missing session_id is the safer
      // default — the haccp_log row is already enqueued.
      if (payload.session_id) {
        void emit({
          event: "haccp logged",
          workspace_id: workspaceId,
          actor_id: profileId,
          properties: {
            entity: { entity_type: "department_session", entity_id: payload.session_id },
            data: { task_type: payload.ccp_reference, logged_at: now },
          },
        });
      }

      return rowId;
    } finally {
      setIsSubmitting(false);
    }
  }, []);

  return { logHaccp, isSubmitting };
}
