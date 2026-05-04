/**
 * fetchers.ts — typed order fetcher wrappers
 *
 * Thin wrappers around @smartout/billing query functions. Keeps apps/admin
 * clean of direct Supabase table queries for the orders domain.
 *
 * The Supabase client type here comes from @supabase/ssr (createServerClient)
 * which differs in generic parameters from @supabase/supabase-js (createClient).
 * We cast via `unknown` at the boundary — the runtime objects are identical;
 * only the TypeScript generic signatures diverge between the two packages.
 *
 * All functions are server-only — call from Server Components or Server Actions,
 * never from "use client" modules.
 */

import {
  fetchInvoiceDispatches as _fetchInvoiceDispatches,
  fetchInvoicePayments as _fetchInvoicePayments,
  type InvoiceDispatchWithRule,
} from "@smartout/billing";
import { loadInvoiceDetailServer, type InvoiceBasis } from "@smartout/billing/server";
import type { Invoice, Payment } from "@smartout/billing";

// The Supabase client from @supabase/ssr (createServerClient) has different generic
// parameters than the one from @supabase/supabase-js (createClient) that @smartout/billing
// uses internally. Both are runtime-identical; only TS generics diverge. We accept `any`
// here and cast at the boundary — the billing pkg functions are safe regardless.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabaseClient = any;

export type { InvoiceBasis, InvoiceDispatchWithRule };

export type OrderFilters = {
  status?: string;
  company?: string;
  limit?: number;
};

// Re-export for pages to type their order rows.
export type OrderListRow = Pick<
  Invoice,
  | "invoice_id"
  | "invoice_number"
  | "company_id"
  | "invoice_type"
  | "status"
  | "dunning_status"
  | "period_from"
  | "period_to"
  | "due_at"
  | "amount_incl_vat"
> & { company: { name: string } | null };

/**
 * Fetch paginated order list for the accountant across all granted companies.
 * Uses a joined select to include company name for the Selskap column.
 *
 * @param client - Any Supabase client (server or admin).
 * @param grantedCompanyIds - Active grant company UUIDs for this accountant.
 * @param filters - Optional status/company/limit filters.
 */
export async function getOrders(
  client: AnySupabaseClient,
  grantedCompanyIds: string[],
  filters?: OrderFilters,
): Promise<OrderListRow[]> {
  if (grantedCompanyIds.length === 0) return [];

  const limit = Math.min(filters?.limit ?? 100, 500);
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  // client is `any` by design — see AnySupabaseClient comment above.
  let query = client
    .from("invoice")
    .select(
      "invoice_id, invoice_number, company_id, company:company(name), invoice_type, status, dunning_status, period_from, period_to, due_at, amount_incl_vat",
    )
    .in("company_id", grantedCompanyIds)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (filters?.status) {
    query = query.eq("status", filters.status as Invoice["status"]);
  }
  if (
    filters?.company &&
    UUID_RE.test(filters.company) &&
    grantedCompanyIds.includes(filters.company)
  ) {
    query = query.eq("company_id", filters.company);
  }

  const { data, error } = await query;
  if (error) {
    console.error("[orders/fetchers] getOrders failed:", error);
    return [];
  }

  return (data ?? []) as unknown as OrderListRow[];
}

/**
 * Load full invoice detail (header + line items + snapshots + pricing_terms).
 * Returns null when not found or RLS denies access.
 */
export async function getOrderDetail(
  client: AnySupabaseClient,
  invoiceId: string,
): Promise<InvoiceBasis | null> {
  return loadInvoiceDetailServer(client, invoiceId);
}

/**
 * Fetch dispatches for a single invoice (with left-joined rule context).
 */
export async function getOrderDispatches(
  client: AnySupabaseClient,
  invoiceId: string,
): Promise<InvoiceDispatchWithRule[]> {
  return _fetchInvoiceDispatches(client, invoiceId);
}

/**
 * Fetch payments for a single invoice.
 */
export async function getOrderPayments(
  client: AnySupabaseClient,
  invoiceId: string,
): Promise<Payment[]> {
  return _fetchInvoicePayments(client, invoiceId);
}
