/**
 * useConfirmHours — Enqueues an hours confirmation or dispute to the sync queue.
 *
 * Updates the shift_approval record status to 'approved' (confirm) or
 * 'disputed' (with justification text). The employee sees planned vs
 * registered hours and decides whether to accept or challenge.
 */
import { useCallback, useState } from "react";

import { enqueue } from "@/lib/sync/queue";
import { emit } from "@smartout/telemetry";

export type ConfirmHoursPayload = {
  approval_id: string;
  status: "approved" | "disputed";
  /** Required when status is 'disputed' — the employee's justification */
  edit_justification?: string | null;
};

type UseConfirmHoursReturn = {
  confirmHours: (payload: ConfirmHoursPayload) => Promise<string>;
  isSubmitting: boolean;
};

export function useConfirmHours(): UseConfirmHoursReturn {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const confirmHours = useCallback(async (payload: ConfirmHoursPayload): Promise<string> => {
    setIsSubmitting(true);

    try {
      const rowId = await enqueue("confirm_hours", {
        approval_id: payload.approval_id,
        status: payload.status,
        edit_justification: payload.edit_justification ?? null,
      });

      void emit({
        event: "shift hours_confirmed",
        workspace_id: null,
        actor_id: "",
        properties: {
          entity_type: "shift",
          entity_id: payload.approval_id,
          data: { shift_id: payload.approval_id, status: payload.status },
        },
      });

      return rowId;
    } finally {
      setIsSubmitting(false);
    }
  }, []);

  return { confirmHours, isSubmitting };
}
