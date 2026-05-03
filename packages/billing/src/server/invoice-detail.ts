import "server-only";

// server/invoice-detail.ts — server-only loader for invoice detail page.
//
// Extracts the get_invoice_basis() RPC body out of apps/web so both
// apps/web (platform-admin) and apps/admin (accountant) can consume
// the same composition. Caller supplies an admin-scoped or user-scoped
// Supabase client — auth model is the caller's responsibility.
//
// ADR-B: extend @smartout/billing, not fork. This file MUST NOT be
// imported from any "use client" module (server-only import enforces).

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@smartout/supabase";
import type { InvoiceStatus } from "../types";

type BillingClient = SupabaseClient<Database>;

/** Full invoice basis as returned by get_invoice_basis(). */
export type InvoiceBasis = {
  invoice_id: string;
  invoice_number: number | null;
  company_id: string;
  company_name: string;
  period_from: string;
  period_to: string;
  issued_at: string | null;
  status: InvoiceStatus;
  amount_excl_vat: number;
  vat_rate: number;
  vat_amount: number;
  amount_incl_vat: number;
  currency: string;
  line_items: Array<{
    line_type: string;
    description: string;
    quantity: number;
    unit_price: number;
    amount_incl_vat: number;
    addon_key?: string | null;
  }> | null;
  usage_snapshots: Array<{
    workspace_id: string;
    active_users: number;
    billable_users: number;
    free_users_applied: number;
    period_from: string;
    period_to: string;
  }> | null;
  pricing_terms_at_issue: {
    monthly_cost: number;
    price_per_employee: number;
    free_users: number;
    overage_price_per_user: number | null;
    billing_interval: string;
  } | null;
};

/**
 * Load the full invoice basis via the get_invoice_basis() RPC.
 * Returns null when the invoice does not exist or the caller's RLS
 * context denies access.
 *
 * Used by:
 * - apps/web platform-admin invoice detail page
 * - apps/admin accountant order detail page
 *
 * @param client - Admin or user-scoped Supabase client. Pass admin
 *   client for platform-admin; pass user client for accountant (RLS
 *   enforces accountant_company_grant access).
 * @param invoiceId - The invoice UUID to load.
 */
export async function loadInvoiceDetailServer(
  client: BillingClient,
  invoiceId: string,
): Promise<InvoiceBasis | null> {
  const { data, error } = await client
    .rpc("get_invoice_basis", { p_invoice_id: invoiceId })
    .maybeSingle();

  if (error) {
    console.error("[billing/server/invoice-detail] get_invoice_basis failed:", error);
    return null;
  }

  return (data as InvoiceBasis) ?? null;
}
