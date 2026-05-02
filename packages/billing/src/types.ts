// Billing domain types. Row shapes come from the generated Database types;
// application-level discriminators (void reasons, uncollectible reasons,
// payment channels) live here because the DB stores them as free-form
// text columns (ADR-0120 + plan §3.2).

import type { Database } from "@smartout/supabase";

export type Invoice = Database["public"]["Tables"]["invoice"]["Row"];
export type InvoiceInsert = Database["public"]["Tables"]["invoice"]["Insert"];
export type InvoiceUpdate = Database["public"]["Tables"]["invoice"]["Update"];

export type InvoiceLineItem = Database["public"]["Tables"]["invoice_line_item"]["Row"];
export type InvoiceLineItemInsert = Database["public"]["Tables"]["invoice_line_item"]["Insert"];

export type UsageSnapshot = Database["public"]["Tables"]["usage_snapshot"]["Row"];
export type UsageSnapshotInsert = Database["public"]["Tables"]["usage_snapshot"]["Insert"];

export type BasisDriftEvent = Database["public"]["Tables"]["basis_drift_event"]["Row"];

export type PricingTerms = Database["public"]["Tables"]["pricing_terms"]["Row"];
export type PricingTermsInsert = Database["public"]["Tables"]["pricing_terms"]["Insert"];
export type PricingTermsUpdate = Database["public"]["Tables"]["pricing_terms"]["Update"];

export type BillingActivityLog = Database["public"]["Tables"]["billing_activity_log"]["Row"];

export type BillingProduct = Database["public"]["Tables"]["billing_product"]["Row"];
export type BillingProductInsert = Database["public"]["Tables"]["billing_product"]["Insert"];
export type BillingProductUpdate = Database["public"]["Tables"]["billing_product"]["Update"];

// ─── Fase 2 — Dispatch + Integration row shapes ──────────────────
// Row types for the Fase 2 schema. Imported by dispatch adapters +
// Server Actions so every site uses the same generated shape.

export type BillingDispatchRule = Database["public"]["Tables"]["billing_dispatch_rule"]["Row"];
export type BillingDispatchRuleInsert =
  Database["public"]["Tables"]["billing_dispatch_rule"]["Insert"];
export type BillingDispatchRuleUpdate =
  Database["public"]["Tables"]["billing_dispatch_rule"]["Update"];

export type BillingDispatchTemplate =
  Database["public"]["Tables"]["billing_dispatch_template"]["Row"];

export type InvoiceDispatch = Database["public"]["Tables"]["invoice_dispatch"]["Row"];
export type InvoiceDispatchInsert = Database["public"]["Tables"]["invoice_dispatch"]["Insert"];
export type InvoiceDispatchUpdate = Database["public"]["Tables"]["invoice_dispatch"]["Update"];

export type BillingIntegration = Database["public"]["Tables"]["billing_integration"]["Row"];
export type BillingIntegrationInsert =
  Database["public"]["Tables"]["billing_integration"]["Insert"];
export type BillingIntegrationUpdate =
  Database["public"]["Tables"]["billing_integration"]["Update"];

// Enum aliases — direct re-exports from Database.Enums for consistency
// across Server Actions, hooks, and UI.
export type InvoiceStatus = Database["public"]["Enums"]["invoice_status"];
export type InvoiceType = Database["public"]["Enums"]["invoice_type"];
export type DunningStatus = Database["public"]["Enums"]["dunning_status"];
export type InvoiceLineType = Database["public"]["Enums"]["invoice_line_type"];

// Fase 2 enum aliases. Kept narrow so adapters / UI never string-type
// against raw text — widens only if the DB enum widens.
export type BillingDispatchChannel = Database["public"]["Enums"]["billing_dispatch_channel"];
export type DispatchStatus = Database["public"]["Enums"]["dispatch_status"];
export type DispatchRuleAction = Database["public"]["Enums"]["dispatch_rule_action"];
export type BillingIntegrationType = Database["public"]["Enums"]["billing_integration_type"];

// ─── Fase 3A — payment row shapes ─────────────────────────────────
export type Payment = Database["public"]["Tables"]["payment"]["Row"];
export type PaymentInsert = Database["public"]["Tables"]["payment"]["Insert"];
export type PaymentUpdate = Database["public"]["Tables"]["payment"]["Update"];

export type PaymentAttempt = Database["public"]["Tables"]["payment_attempt"]["Row"];
export type PaymentAttemptInsert = Database["public"]["Tables"]["payment_attempt"]["Insert"];

export type PaymentStatusEnum = Database["public"]["Enums"]["payment_status"];
export type PaymentMethodTypeEnum = Database["public"]["Enums"]["payment_method_type"];

// Application-level string unions (NOT in DB enums — stored as text).
// Kept here so Server Actions + UI use the same literal set.

/** Reasons an invoice may be voided (ADR-0120 §4 credit-note workflow). */
export type VoidReason =
  | "duplicate"
  | "fraudulent"
  | "order_change"
  | "product_unsatisfactory"
  | "issued_in_error"
  | "other";

/** Reasons an invoice may be written off as uncollectible (dunning terminal). */
export type UncollectibleReason =
  | "bankruptcy"
  | "disputed_unresolved"
  | "statute_of_limitations"
  | "customer_ghosted"
  | "written_off"
  | "other";

/** Payment reconciliation channel on mark_paid (Phase 7 Server Action). */
export type PaymentChannel =
  | "bank_transfer"
  | "cash"
  | "stripe_manual_capture"
  | "out_of_band"
  | "partial_write_off"
  | "other";

/** Delivery channel on pricing_terms.delivery_channel (matches DB CHECK constraint).
 *  Previously also on invoice.delivery_channel — that column was DROPPED in
 *  Fase 3A B6 per ADR-0128 + ADR-0135. Delivery-state lives on invoice_dispatch. */
export type DeliveryChannel = "manual" | "stripe" | "ehf";

/** Invoice format for delivery (matches pricing_terms.invoice_format CHECK). */
export type InvoiceFormat = "pdf" | "ehf";

/** Billing interval on pricing_terms. Strings match pricing_terms.billing_interval. */
export type BillingInterval = "monthly" | "quarterly" | "yearly";

// ─── Accountant cross-company grant (billing schema — ADR-A 2026-05-02) ──────
// New objects live in the dedicated billing schema (NOT public).
// Schema: Database["billing"] per regenerated types with --schema billing flag.

export type AccountantCompanyGrant =
  Database["billing"]["Tables"]["accountant_company_grant"]["Row"];
export type AccountantCompanyGrantInsert =
  Database["billing"]["Tables"]["accountant_company_grant"]["Insert"];
export type AccountantCompanyGrantUpdate =
  Database["billing"]["Tables"]["accountant_company_grant"]["Update"];

export type AccountantGrantScope = Database["billing"]["Enums"]["accountant_grant_scope"];

// ─── Kartotek list item (M6 /workspaces list query) ──────────────────────────
// Returned by fetchWorkspacesForCompanies — one row per workspace across all
// granted companies. Used by the /workspaces list page in apps/admin.

/** A single workspace row for the accountant /workspaces list. */
export type WorkspaceListItem = {
  workspace_id: string;
  workspace_name: string;
  company_id: string;
  company_name: string;
  org_nr: string | null;
  status: "sandbox" | "active" | "suspended" | "archived";
  outstanding_amount: number | null;
  last_invoice_at: string | null;
  last_paid_at: string | null;
};
