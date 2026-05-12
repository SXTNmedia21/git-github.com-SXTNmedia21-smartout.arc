/**
 * useReportDeviation — Enqueues a deviation report to the offline sync queue.
 *
 * Deviation reporting is critical for food safety and operational compliance.
 * Reports go through the sync queue so employees can flag issues even without
 * connectivity — the report will sync when the connection is restored.
 *
 * Payload matches the deviation table Insert type.
 *
 * ADR-0134: identity (workspace_id, reported_by/actor_id) is resolved via
 * getProfileContext() before emit — caller-supplied IDs were forgeable
 * attribution (L-0083 / L-0177).
 */
import { useCallback, useState } from "react";
import { randomUUID } from "expo-crypto";

import { enqueue } from "@/lib/sync/queue";
import { getProfileContext } from "@/lib/profile-context";
import { emit } from "@smartout/telemetry";

/** Deviation domains from the deviation_domain enum */
export type DeviationDomain = "safety" | "customer" | "procedure" | "system" | "material";

/** Deviation severity levels from the deviation_severity enum */
export type DeviationSeverity = "low" | "medium" | "high" | "critical";

export type DeviationPayload = {
  domain: DeviationDomain;
  severity: DeviationSeverity;
  title: string;
  description: string | null;
  department_id?: string | null;
  session_id?: string | null;
  linked_shift_id?: string | null;
};

type UseReportDeviationReturn = {
  reportDeviation: (payload: DeviationPayload) => Promise<string>;
  isSubmitting: boolean;
};

export function useReportDeviation(): UseReportDeviationReturn {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const reportDeviation = useCallback(async (payload: DeviationPayload): Promise<string> => {
    setIsSubmitting(true);

    try {
      // ADR-0134: resolve identity from server before any write or emit.
      // Throws on unauthenticated / missing profile — fail fast, no corrupt telemetry.
      const { profileId, workspaceId } = await getProfileContext();

      const deviationId = randomUUID();

      const rowId = await enqueue("report_deviation", {
        deviation_id: deviationId,
        domain: payload.domain,
        severity: payload.severity,
        title: payload.title,
        description: payload.description,
        reported_by: profileId,
        workspace_id: workspaceId,
        department_id: payload.department_id ?? null,
        session_id: payload.session_id ?? null,
        linked_shift_id: payload.linked_shift_id ?? null,
        /* Defaults for new deviations — server/RLS may override */
        status: "open",
        requires_action: true,
        blocks_day_approval: false,
        payroll_impact: false,
      });

      void emit({
        event: "deviation reported",
        workspace_id: workspaceId,
        actor_id: profileId,
        properties: {
          entity: { entity_type: "deviation", entity_id: deviationId },
          data: { domain: payload.domain, severity: payload.severity },
        },
      });

      return rowId;
    } finally {
      setIsSubmitting(false);
    }
  }, []);

  return { reportDeviation, isSubmitting };
}
