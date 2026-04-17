// Zod input schemas for billing Server Actions (Phase 7) + mobile
// callers. Centralised so web + mobile validate the same shape.
//
// Each action has a matching schema here. Server Actions should call
// `<Schema>.parse(input)` at the top of the handler; mobile callers do
// the same before invoking the shared query layer.

import { z } from "zod";

// ─── Enum schemas (mirror ./types string unions) ───────────────────

export const VoidReasonSchema = z.enum([
  "duplicate",
  "fraudulent",
  "order_change",
  "product_unsatisfactory",
  "issued_in_error",
  "other",
]);

export const UncollectibleReasonSchema = z.enum([
  "bankruptcy",
  "disputed_unresolved",
  "statute_of_limitations",
  "customer_ghosted",
  "written_off",
  "other",
]);

export const PaymentChannelSchema = z.enum([
  "bank_transfer",
  "cash",
  "stripe_manual_capture",
  "out_of_band",
  "partial_write_off",
  "other",
]);

export const DeliveryChannelSchema = z.enum(["manual", "stripe", "ehf"]);
export const InvoiceFormatSchema = z.enum(["pdf", "ehf"]);
export const BillingIntervalSchema = z.enum(["monthly", "quarterly", "yearly"]);

// ─── Server Action input schemas ───────────────────────────────────

// Strict ISO-8601 date (YYYY-MM-DD). Refines so UI pickers can't emit
// Date.toString() blobs.
const IsoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD date string");

export const MarkInvoicePaidInputSchema = z.object({
  invoice_id: z.string().uuid(),
  payment_date: IsoDate,
  payment_reference: z.string().min(1).max(500),
  payment_channel: PaymentChannelSchema,
  amount: z.number().positive(),
  notes: z.string().max(1000).optional(),
  /** Required for write-retry idempotency (ADR-0120 issued-invoice contract). */
  idempotency_key: z.string().uuid(),
});
export type MarkInvoicePaidInput = z.infer<typeof MarkInvoicePaidInputSchema>;

export const VoidInvoiceInputSchema = z.object({
  invoice_id: z.string().uuid(),
  reason: VoidReasonSchema,
  reason_detail: z.string().min(10).max(1000),
  /** Typed confirmation — UI requires user to type the invoice_number. */
  typed_confirmation: z.string().min(1),
  idempotency_key: z.string().uuid(),
});
export type VoidInvoiceInput = z.infer<typeof VoidInvoiceInputSchema>;

export const IssueCreditNoteInputSchema = z.object({
  original_invoice_id: z.string().uuid(),
  reason: VoidReasonSchema,
  reason_detail: z.string().min(10).max(1000),
  amount: z.number().positive(),
  idempotency_key: z.string().uuid(),
});
export type IssueCreditNoteInput = z.infer<typeof IssueCreditNoteInputSchema>;

export const AddDunningNoteInputSchema = z.object({
  invoice_id: z.string().uuid(),
  note: z.string().min(1).max(2000),
});
export type AddDunningNoteInput = z.infer<typeof AddDunningNoteInputSchema>;

export const WriteOffUncollectibleInputSchema = z.object({
  invoice_id: z.string().uuid(),
  reason: UncollectibleReasonSchema,
  reason_detail: z.string().min(10).max(1000),
  idempotency_key: z.string().uuid(),
});
export type WriteOffUncollectibleInput = z.infer<typeof WriteOffUncollectibleInputSchema>;

export const UpdatePricingTermsInputSchema = z.object({
  company_id: z.string().uuid(),
  /** Scoped per-workspace override. Optional — default is company-wide terms. */
  workspace_id: z.string().uuid().optional(),
  monthly_cost: z.number().positive(),
  price_per_employee: z.number().nonnegative(),
  free_users: z.number().int().min(0),
  overage_price_per_user: z.number().nonnegative().optional(),
  billing_interval: BillingIntervalSchema,
  delivery_channel: DeliveryChannelSchema,
  invoice_format: InvoiceFormatSchema,
  effective_from: IsoDate,
  agreement_period_from: IsoDate.optional(),
  agreement_period_to: IsoDate.optional(),
});
export type UpdatePricingTermsInput = z.infer<typeof UpdatePricingTermsInputSchema>;

// ─── Filter schemas (used by pure queries + hooks) ─────────────────

export const InvoiceListFiltersSchema = z.object({
  status: z.string().optional(),
  limit: z.number().int().min(1).max(500).optional(),
});
export type InvoiceListFilters = z.infer<typeof InvoiceListFiltersSchema>;
