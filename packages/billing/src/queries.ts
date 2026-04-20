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
import type {
  BillingDispatchChannel,
  BillingDispatchRule,
  BillingIntegration,
  DispatchRuleAction,
  Invoice,
  InvoiceDispatch,
  InvoiceLineItem,
  Payment,
  PaymentAttempt,
  PaymentStatusEnum,
  UsageSnapshot,
} from "./types";
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

/**
 * List billing integrations for the platform-admin UI. Returns newest
 * first (created_at DESC) so freshly added rows surface at the top of
 * the table. Used by page.tsx in the Integrations tab.
 */
export async function listIntegrations(supabase: BillingClient): Promise<BillingIntegration[]> {
  const { data, error } = await supabase
    .from("billing_integration")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as BillingIntegration[];
}

// ─── Fase 2 B3 — Dispatch rule + invoice_dispatch queries ─────────
// Shared between platform-admin settings page and workspace-admin
// dispatch settings tab. Scope filtering is the caller's responsibility
// (RLS + explicit .eq('workspace_id', ...) in the Server Action).

/** Scope of dispatch rules to return. */
export type DispatchRuleScope = "platform" | "workspace" | "all";

/**
 * List dispatch rules. Default returns newest-first. Scope selects
 * between platform baseline (workspace_id IS NULL), a specific
 * workspace set, or all (platform-admin settings view).
 *
 * When opts.scope === 'workspace', opts.workspace_ids is required —
 * caller is expected to have resolved the authorised set.
 */
export async function listDispatchRules(
  supabase: BillingClient,
  opts: {
    scope?: DispatchRuleScope;
    workspace_ids?: string[];
    /** Optional channel filter for tab-scoped views. */
    channel?: BillingDispatchChannel;
    /** Optional trigger_event filter. */
    trigger_event?: string;
  } = {},
): Promise<BillingDispatchRule[]> {
  const scope: DispatchRuleScope = opts.scope ?? "all";
  let query = supabase
    .from("billing_dispatch_rule")
    .select("*")
    .order("created_at", { ascending: false });

  if (scope === "platform") {
    query = query.is("workspace_id", null);
  } else if (scope === "workspace") {
    const ids = opts.workspace_ids ?? [];
    if (ids.length === 0) return [];
    query = query.in("workspace_id", ids);
  }
  // scope === 'all' → no workspace filter; RLS + caller auth decide visibility.

  if (opts.channel) query = query.eq("channel", opts.channel);
  if (opts.trigger_event) query = query.eq("trigger_event", opts.trigger_event);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as BillingDispatchRule[];
}

/**
 * Row shape returned by getDispatchesByInvoice. The rule join is
 * LEFT so ad-hoc dispatches (dispatch_rule_id NULL) still surface.
 */
export type InvoiceDispatchWithRule = InvoiceDispatch & {
  rule: Pick<
    BillingDispatchRule,
    "dispatch_rule_id" | "workspace_id" | "channel" | "trigger_event" | "action"
  > | null;
};

/**
 * List all dispatches for an invoice, with a LEFT join on the owning
 * rule so the UI can tell "ad-hoc" rows apart. Order: newest first
 * so retries float to the top of the list.
 */
export async function getDispatchesByInvoice(
  supabase: BillingClient,
  invoiceId: string,
): Promise<InvoiceDispatchWithRule[]> {
  const { data, error } = await supabase
    .from("invoice_dispatch")
    .select(
      "*, rule:billing_dispatch_rule(dispatch_rule_id, workspace_id, channel, trigger_event, action)",
    )
    .eq("invoice_id", invoiceId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as unknown as InvoiceDispatchWithRule[];
}

/**
 * Row shape returned by the `effective_dispatch_rules` RPC. Mirrors
 * the RETURNS TABLE declaration in
 * supabase/migrations/20260511200007_billing_dispatch_rule_evaluation.sql.
 */
export type EffectiveDispatchRule = {
  dispatch_rule_id: string;
  workspace_id: string | null;
  company_id: string | null;
  channel: BillingDispatchChannel;
  trigger_event: string;
  target: Record<string, unknown>;
  template_id: string | null;
  action: DispatchRuleAction;
  is_enabled: boolean;
  rule_source: "platform" | "workspace";
};

/**
 * Call the `effective_dispatch_rules(invoice_id, trigger_event)` SQL
 * function from ADR-0127. Server Actions + the engine use this — never
 * hand-roll a UNION query against billing_dispatch_rule because the
 * workspace suppress/override semantics live inside the function.
 */
export async function getEffectiveDispatchRules(
  supabase: BillingClient,
  invoiceId: string,
  triggerEvent: string,
): Promise<EffectiveDispatchRule[]> {
  const { data, error } = await supabase.rpc("effective_dispatch_rules", {
    p_invoice_id: invoiceId,
    p_trigger_event: triggerEvent,
  });

  if (error) throw error;
  // Cast through unknown: the DB function returns nullable columns on
  // workspace_id/company_id/template_id which our narrowed shape makes
  // explicit. rule_source is widened to string by the generator — we
  // trust the SQL which only emits 'platform' | 'workspace'.
  return (data ?? []) as unknown as EffectiveDispatchRule[];
}

// ─── Fase 3A B3 — Payment queries (platform-admin + per-invoice) ────
// The payments dashboard lists every payment row across companies with
// optional status/company filters. Per-invoice payment history reuses
// the same `fetchPaymentsByInvoice` pure query.
//
// Mobile parity: React Native callers supply their own Supabase client
// (workspace-scoped JWT) and RLS limits visibility. Web wraps these in
// Server Components / Actions.

/** Row shape returned by listPayments — Payment + optional company join. */
export type PaymentWithCompany = Payment & {
  company: { company_id: string; name: string | null } | null;
};

export type PaymentListFilters = {
  /** Match payment.status exactly. Omit to see all statuses. */
  status?: PaymentStatusEnum;
  /** Match payment.company_id exactly. Omit for all companies. */
  company_id?: string;
  /** ISO-8601 — paid_at >= date. Omit for no lower bound. */
  paid_from?: string;
  /** ISO-8601 — paid_at <= date. Omit for no upper bound. */
  paid_to?: string;
  /** Default 50, max 500. */
  limit?: number;
};

/**
 * List payments across all companies (platform-admin) or a single
 * company (workspace surface + tests). Ordering: created_at DESC
 * because paid_at is NULL for pending/processing rows.
 *
 * Joins company for display name so the dashboard doesn't round-trip
 * per row. If the RLS context can't see a given company, the join
 * resolves to null and the row still surfaces — callers render an
 * em-dash for the name.
 */
export async function listPayments(
  supabase: BillingClient,
  filters: PaymentListFilters = {},
): Promise<PaymentWithCompany[]> {
  const limit = Math.min(filters.limit ?? 50, 500);

  let query = supabase
    .from("payment")
    .select("*, company:company(company_id, name)")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (filters.status) {
    query = query.eq("status", filters.status);
  }
  if (filters.company_id) {
    query = query.eq("company_id", filters.company_id);
  }
  if (filters.paid_from) {
    query = query.gte("paid_at", filters.paid_from);
  }
  if (filters.paid_to) {
    query = query.lte("paid_at", filters.paid_to);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as unknown as PaymentWithCompany[];
}

/**
 * Fetch all payments for a single invoice. Used by both platform-admin
 * (invoice detail accordion) and workspace-admin (payment history on
 * the workspace invoice page). Ordered newest-first.
 */
export async function fetchPaymentsByInvoice(
  supabase: BillingClient,
  invoiceId: string,
): Promise<Payment[]> {
  const { data, error } = await supabase
    .from("payment")
    .select("*")
    .eq("invoice_id", invoiceId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as Payment[];
}

/**
 * Load every payment_attempt for a payment. Platform-admin only per
 * ADR-0141 (payment_attempt RLS rejects non-platform reads). Ordered
 * by attempt_number ASC so the UI renders oldest → newest left-to-right.
 */
export async function fetchPaymentAttempts(
  supabase: BillingClient,
  paymentId: string,
): Promise<PaymentAttempt[]> {
  const { data, error } = await supabase
    .from("payment_attempt")
    .select("*")
    .eq("payment_id", paymentId)
    .order("attempt_number", { ascending: true });

  if (error) throw error;
  return (data ?? []) as PaymentAttempt[];
}
