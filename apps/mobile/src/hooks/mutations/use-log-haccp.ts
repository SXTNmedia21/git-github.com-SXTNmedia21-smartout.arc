/**
 * useLogHaccp — Enqueues a HACCP temperature log to the offline sync queue.
 *
 * HACCP logging is a legal requirement (Mattilsynet / food safety authorities).
 * The write goes through the SQLite queue so it works offline — compliance
 * data must never be lost due to connectivity issues.
 *
 * Payload matches the haccp_log table schema. UUID is generated client-side
 * so the record can be referenced immediately.
 */
import { useCallback, useState } from "react";
import { randomUUID } from "expo-crypto";

import { enqueue } from "@/lib/sync/queue";

export type HACCPPayload = {
  ccp_reference: string;
  temperature: number;
  unit: string;
  is_within_range: boolean;
  corrective_action: string | null;
  session_id: string | null;
  profile_id: string;
  workspace_id: string;
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
        profile_id: payload.profile_id,
        workspace_id: payload.workspace_id,
        logged_at: now,
      });

      return rowId;
    } finally {
      setIsSubmitting(false);
    }
  }, []);

  return { logHaccp, isSubmitting };
}
