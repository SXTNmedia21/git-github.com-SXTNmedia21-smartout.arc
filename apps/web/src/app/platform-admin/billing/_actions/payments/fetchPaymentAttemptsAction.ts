"use server";

import { fetchPaymentAttempts, type AdminActionResult } from "@smartout/billing";
import { withPlatformAdmin } from "@/lib/billing/withAdmin";

// Fase 3A B3 — lazy loader for the PaymentDetailDrawer attempts list.
//
// payment_attempt RLS rejects workspace reads per ADR-0141 (redacted
// Stripe PII lives there). The platform-admin gate here lets the
// service-role client read the rows; the drawer only calls this when
// the user opens a specific payment, keeping the PaymentsList
// payload lean.

type AttemptDTO = {
  payment_attempt_id: string;
  attempt_number: number;
  status: string;
  stripe_event_id: string;
  error_code: string | null;
  error_message: string | null;
  created_at: string;
};

export async function fetchPaymentAttemptsAction(input: {
  payment_id: string;
}): Promise<AdminActionResult<AttemptDTO[]>> {
  return withPlatformAdmin(async (_adminId, client) => {
    try {
      const rows = await fetchPaymentAttempts(client, input.payment_id);
      return {
        ok: true,
        data: rows.map((r) => ({
          payment_attempt_id: r.payment_attempt_id,
          attempt_number: r.attempt_number,
          status: r.status,
          stripe_event_id: r.stripe_event_id,
          error_code: r.error_code,
          error_message: r.error_message,
          created_at: r.created_at,
        })),
      };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
        code: "internal_error",
      };
    }
  });
}
