// Pure query layer. Works in Node (Server Actions), Deno (Edge
// Functions), and React Native. Every function accepts a
// SupabaseClient<Database> instance so the auth model is the caller's
// responsibility — web passes a Server-Action-scoped admin client,
// mobile passes an authenticated user client.
//
// NO emit() calls here. Mutations run inside Server Actions where
// workspace/company resolution + authority checks already live; the
// Server Action layer owns the emit() boundary.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@smartout/supabase";
import type { Invoice, InvoiceLineItem, UsageSnapshot } from "./types";
import type { InvoiceListFilters } from "./schemas";

type BillingClient = SupabaseClient<Database>;

/**
 * Fetch recent invoices for a company (platform-admin list view +
 * workspace self-serve list).
 *
 * Sort: issued_at DESC nullsFirst — drafts float to the top. Default
 * limit 50; cap at 500 via Zod schema.
 */
export async function fetchInvoicesForCompany(
  supabase: BillingClient,
  companyId: string,
  filters?: InvoiceListFilters,
): Promise<Invoice[]> {
  let query = supabase
    .from("invoice")
    .select("*")
    .eq("company_id", companyId)
    .order("issued_at", { ascending: false, nullsFirst: true })
    .limit(filters?.limit ?? 50);

  if (filters?.status) {
    query = query.eq("status", filters.status);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

/**
 * Fetch a single invoice with its line items. Used by the invoice
 * detail Sheet (Phase 6.3) and the AI "explain this invoice" tool
 * (preferred to go through `get_invoice_basis()` RPC for full basis
 * with pricing_terms snapshot — this function is the lean version).
 */
export async function fetchInvoiceDetail(
  supabase: BillingClient,
  invoiceId: string,
): Promise<{ invoice: Invoice; line_items: InvoiceLineItem[] } | null> {
  const { data: invoice, error: invoiceError } = await supabase
    .from("invoice")
    .select("*")
    .eq("invoice_id", invoiceId)
    .maybeSingle();

  if (invoiceError) throw invoiceError;
  if (!invoice) return null;

  const { data: lineItems, error: lineItemsError } = await supabase
    .from("invoice_line_item")
    .select("*")
    .eq("invoice_id", invoiceId);

  if (lineItemsError) throw lineItemsError;
  return { invoice, line_items: lineItems ?? [] };
}

/**
 * Fetch the per-workspace usage snapshot for a billing period. Used
 * by the "current plan" preview + invoice basis tooling.
 *
 * usage_snapshot UNIQUE (company_id, workspace_id, period_from,
 * period_to) guarantees at most one row per workspace/period.
 */
export async function fetchUsageSnapshot(
  supabase: BillingClient,
  workspaceId: string,
  periodFrom: string,
  periodTo: string,
): Promise<UsageSnapshot | null> {
  const { data, error } = await supabase
    .from("usage_snapshot")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("period_from", periodFrom)
    .eq("period_to", periodTo)
    .maybeSingle();

  if (error) throw error;
  return data;
}

/**
 * Fetch all usage snapshots for a company in a period (multi-workspace
 * billing preview). Returns one row per workspace.
 */
export async function fetchUsageSnapshotsForCompany(
  supabase: BillingClient,
  companyId: string,
  periodFrom: string,
  periodTo: string,
): Promise<UsageSnapshot[]> {
  const { data, error } = await supabase
    .from("usage_snapshot")
    .select("*")
    .eq("company_id", companyId)
    .eq("period_from", periodFrom)
    .eq("period_to", periodTo);

  if (error) throw error;
  return data ?? [];
}
