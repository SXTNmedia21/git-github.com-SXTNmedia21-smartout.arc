"use server";

/**
 * actions.ts — order server actions
 *
 * Stub — implemented in M3.
 * markReceivedAction: sets invoice.status='paid', creates payment row with
 *   metadata->>'channel'='accountant_confirmed', emits telemetry.
 * downloadAuditAction: emits audit telemetry for PDF/CSV downloads.
 *
 * TODO M3: call package action from @smartout/billing/accountant
 * TODO M3: use adminClient for atomic invoice + payment row insert
 */

export async function markReceivedAction(_invoiceId: string): Promise<{ ok: boolean }> {
  // TODO M3: replace with @smartout/billing accountant mark-received action
  return { ok: false };
}

export async function downloadAuditAction(
  _invoiceId: string,
  _format: "pdf" | "csv",
): Promise<void> {
  // TODO M3: emit telemetry via @smartout/telemetry emit()
}
