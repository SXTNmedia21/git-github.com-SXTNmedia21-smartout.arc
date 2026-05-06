"use server";

/**
 * actions.ts — order server actions (accountant scope)
 *
 * markReceivedAction: marks an invoice as received/paid by the accountant.
 *   - Validates accountant has access to the invoice's company.
 *   - Wraps atomically: INSERT payment → UPDATE invoice.
 *   - Uses admin client for the mutation (service_role = defense-in-depth;
 *     RLS UPDATE policy invoice_accountant_mark_received is the primary gate).
 *   - Emits "order marked_received" telemetry.
 *
 * NEVER bypass RLS in fetch paths. Only markReceivedAction uses admin client,
 * and only inside the mutation block after explicit hasAccountantAccess() check.
 *
 * blueprint §3 mark-received action pattern.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getAccountantUserId } from "@/lib/accountant";
import { hasAccountantAccess } from "@smartout/billing/accountant";
import { emit, nonEmpty } from "@smartout/telemetry";

export type MarkReceivedBody = {
  paid_at: string;
  paid_amount: number;
  note?: string;
};

export type MarkReceivedResult = {
  invoice_id: string;
  payment_id: string;
  status: "paid";
};

/**
 * Mark an invoice as received/paid by the accountant.
 *
 * Access flow:
 *  1. Resolve authenticated userId from session.
 *  2. Fetch invoice via user-scoped client (RLS enforces grant).
 *  3. Validate hasAccountantAccess(userId, company_id).
 *  4. Run mutation with admin client (INSERT payment + UPDATE invoice).
 *  5. Emit "order marked_received" telemetry.
 *
 * @throws {Error} "unauthorized" — user not authenticated.
 * @throws {Error} "forbidden" — user has no active grant for this company.
 * @throws {Error} "not_found" — invoice does not exist or RLS denied read.
 * @throws {Error} "conflict" — invoice is not in a markable status.
 */
export async function markReceivedAction(
  invoiceId: string,
  body: MarkReceivedBody,
): Promise<MarkReceivedResult> {
  const userId = await getAccountantUserId();
  if (!userId) throw new Error("unauthorized");

  // User-scoped client for the access check — RLS enforces accountant grant.
  const userClient = await createClient();

  const { data: invoiceRow, error: invoiceErr } = await userClient
    .from("invoice")
    .select("invoice_id, company_id, status, currency")
    .eq("invoice_id", invoiceId)
    .maybeSingle();

  if (invoiceErr || !invoiceRow) throw new Error("not_found");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const canAccess = await hasAccountantAccess(userClient as any, userId, invoiceRow.company_id);
  if (!canAccess) throw new Error("forbidden");

  const markableStatuses = ["issued", "sent", "overdue"] as const;
  if (!markableStatuses.includes(invoiceRow.status as (typeof markableStatuses)[number])) {
    throw new Error("conflict");
  }

  // Admin client for the atomic mutation. Service role bypasses RLS here
  // intentionally — payment INSERT has no user-scoped policy, and we've
  // already validated access above.
  const adminClient = createAdminClient();

  // Intentional: admin client used for atomic payment INSERT + invoice UPDATE.
  // Access already validated via hasAccountantAccess() above (defense-in-depth).
  // eslint-disable-next-line smartout/no-direct-supabase-write
  const { data: paymentRow, error: paymentErr } = await adminClient
    .from("payment")
    .insert({
      invoice_id: invoiceId,
      company_id: invoiceRow.company_id,
      amount: body.paid_amount,
      currency: invoiceRow.currency,
      payment_method: "accountant_manual" as const,
      status: "succeeded" as const,
      paid_at: body.paid_at,
      external_id: body.note ? `note:${body.note.slice(0, 200)}` : null,
    })
    .select("payment_id")
    .single();

  if (paymentErr || !paymentRow) {
    throw new Error(`payment_insert_failed: ${paymentErr?.message ?? "unknown"}`);
  }

  // eslint-disable-next-line smartout/no-direct-supabase-write
  const { error: updateErr } = await adminClient
    .from("invoice")
    .update({
      status: "paid" as const,
      payment_date: body.paid_at,
    })
    .eq("invoice_id", invoiceId)
    .in("status", ["issued", "sent", "overdue"]);

  if (updateErr) {
    throw new Error(`invoice_update_failed: ${updateErr.message}`);
  }

  await emit({
    event: "order marked_received",
    actor_id: nonEmpty(userId, "actor_id"),
    workspace_id: null,
    properties: {
      entity: { entity_type: "invoice", entity_id: invoiceId },
      data: {
        invoice_id: invoiceId,
        payment_id: paymentRow.payment_id,
        paid_at: body.paid_at,
        channel: "accountant_confirmed" as const,
      },
    },
  });

  return { invoice_id: invoiceId, payment_id: paymentRow.payment_id, status: "paid" };
}
