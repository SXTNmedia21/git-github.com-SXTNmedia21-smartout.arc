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

// Enum aliases — direct re-exports from Database.Enums for consistency
// across Server Actions, hooks, and UI.
export type InvoiceStatus = Database["public"]["Enums"]["invoice_status"];
export type InvoiceType = Database["public"]["Enums"]["invoice_type"];
export type DunningStatus = Database["public"]["Enums"]["dunning_status"];
export type InvoiceLineType = Database["public"]["Enums"]["invoice_line_type"];

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

/** Delivery channel on invoice.delivery_channel (matches DB CHECK constraint). */
export type DeliveryChannel = "manual" | "stripe" | "ehf";

/** Invoice format for delivery (matches pricing_terms.invoice_format CHECK). */
export type InvoiceFormat = "pdf" | "ehf";

/** Billing interval on pricing_terms. Strings match pricing_terms.billing_interval. */
export type BillingInterval = "monthly" | "quarterly" | "yearly";
