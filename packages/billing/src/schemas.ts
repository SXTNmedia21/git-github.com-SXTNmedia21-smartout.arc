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
  // Fase 3B (ADR-0148): regnskapsfører-rapportert mark-paid etter EHF-
  // leveranse eksternt. Platform-admin velger denne når melding kommer
  // fra regnskapsfører. Utløser billing accountant_marked_paid event i
  // tillegg til standard invoice marked_paid.
  "accountant_manual",
]);

export const DeliveryChannelSchema = z.enum(["manual", "stripe", "ehf"]);
export const InvoiceFormatSchema = z.enum(["pdf", "ehf"]);
export const BillingIntervalSchema = z.enum(["monthly", "quarterly", "yearly"]);

// ─── Server Action input schemas ───────────────────────────────────

// Strict ISO-8601 date (YYYY-MM-DD). The regex gates UI pickers from
// emitting Date.toString() blobs; the .refine() guard rejects
// calendar-invalid shapes (2024-02-30, 2024-13-01, 2024-00-00) that
// the regex alone admits. Billing period boundaries use these as FK
// equivalents into pricing_terms date ranges — an off-by-one or bogus
// date silently miscalculates entire invoice periods.
const IsoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD date string")
  .refine((value) => {
    const [y, m, d] = value.split("-").map(Number);
    if (!y || !m || !d) return false;
    const date = new Date(Date.UTC(y, m - 1, d));
    return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
  }, "Invalid calendar date (month or day out of range)");

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

// Mirrors the invoice_status enum. Kept in sync with
// Database["public"]["Enums"]["invoice_status"] — see types.ts.
export const InvoiceStatusSchema = z.enum([
  "draft",
  "issued",
  "sent",
  "paid",
  "overdue",
  "void",
  "uncollectible",
]);

export const InvoiceListFiltersSchema = z.object({
  status: InvoiceStatusSchema.optional(),
  limit: z.number().int().min(1).max(500).optional(),
});
export type InvoiceListFilters = z.infer<typeof InvoiceListFiltersSchema>;

// ─── Fase 2 dispatch action inputs ─────────────────────────────────
// Mirror the DB enum so Zod catches channel drift before the RPC boundary.
export const BillingDispatchChannelSchema = z.enum([
  "email_customer",
  "email_internal",
  "http_api",
  "peppol_ehf",
  "stripe_invoice",
]);

export const RetryDispatchInputSchema = z.object({
  invoice_dispatch_id: z.string().uuid(),
});
export type RetryDispatchInput = z.infer<typeof RetryDispatchInputSchema>;

export const CreateAdHocDispatchInputSchema = z.object({
  invoice_id: z.string().uuid(),
  channel: BillingDispatchChannelSchema,
  // Target shape varies per channel; adapters validate at send-time.
  // Zod guard stops obvious misuse (non-object, missing required keys).
  target: z.record(z.string(), z.unknown()),
});
export type CreateAdHocDispatchInput = z.infer<typeof CreateAdHocDispatchInputSchema>;

// ─── Fase 2 B3 — Dispatch rule CRUD (platform + workspace) ─────────
// Mirrors billing_dispatch_rule table columns. Server Actions validate
// these at the RPC boundary; React Native callers call parse() before
// invoking the pure action. Platform vs workspace scope is expressed
// via workspace_id (NULL = platform-baseline per ADR-0127).
export const DispatchRuleActionSchema = z.enum(["send", "suppress"]);

// trigger_event uses telemetry space-separator (see DB CHECK constraint
// in 20260511200001_billing_dispatch_rule_table.sql). Reject dot-
// separator early so the UI surfaces a clean message instead of the
// Postgres CHECK failure.
const TriggerEventString = z
  .string()
  .min(1)
  .max(200)
  .refine((v) => !v.includes("."), "Trigger event must use space-separator (no dots)");

export const CreateDispatchRuleInputSchema = z
  .object({
    workspace_id: z.string().uuid().nullable().optional(),
    company_id: z.string().uuid().nullable().optional(),
    channel: BillingDispatchChannelSchema,
    trigger_event: TriggerEventString,
    target: z.record(z.string(), z.unknown()),
    template_id: z.string().uuid().nullable().optional(),
    action: DispatchRuleActionSchema.optional(),
    is_enabled: z.boolean().optional(),
  })
  .refine(
    // ADR-0127: platform-baseline rules (workspace_id NULL) must be
    // 'send' AND cannot be company-scoped. Matches the DB CHECK
    // constraint billing_dispatch_rule_platform_constraints.
    (v) => {
      const isPlatform = !v.workspace_id; // null or undefined
      if (!isPlatform) return true;
      if (v.action && v.action !== "send") return false;
      if (v.company_id) return false;
      return true;
    },
    {
      message:
        "Platform rules (workspace_id NULL) must use action=send and cannot be company-scoped",
    },
  );
export type CreateDispatchRuleInputParsed = z.infer<typeof CreateDispatchRuleInputSchema>;

export const UpdateDispatchRuleInputSchema = z.object({
  dispatch_rule_id: z.string().uuid(),
  channel: BillingDispatchChannelSchema.optional(),
  trigger_event: TriggerEventString.optional(),
  target: z.record(z.string(), z.unknown()).optional(),
  template_id: z.string().uuid().nullable().optional(),
  company_id: z.string().uuid().nullable().optional(),
  action: DispatchRuleActionSchema.optional(),
  is_enabled: z.boolean().optional(),
});
export type UpdateDispatchRuleInputParsed = z.infer<typeof UpdateDispatchRuleInputSchema>;

export const DeleteDispatchRuleInputSchema = z.object({
  dispatch_rule_id: z.string().uuid(),
});
export type DeleteDispatchRuleInputParsed = z.infer<typeof DeleteDispatchRuleInputSchema>;

export const ToggleDispatchRuleInputSchema = z.object({
  dispatch_rule_id: z.string().uuid(),
  is_enabled: z.boolean(),
});
export type ToggleDispatchRuleInputParsed = z.infer<typeof ToggleDispatchRuleInputSchema>;

// ─── Fase 2 integration action inputs ──────────────────────────────
// Mirrors the DB enum so Zod catches integration_type drift before the
// RPC boundary.
export const BillingIntegrationTypeSchema = z.enum(["fiken", "tripletex", "stripe", "placeholder"]);

export const IntegrationEntitySchema = z.enum([
  "customer",
  "invoice",
  "contract",
  "product",
  "plan",
]);

export const IntegrationOperationSchema = z.enum(["create", "update", "delete"]);

export const CreateIntegrationInputSchema = z.object({
  integration_type: BillingIntegrationTypeSchema,
  display_name: z.string().min(1).max(200),
  config: z.record(z.string(), z.unknown()).optional(),
  is_enabled: z.boolean().optional(),
  is_placeholder: z.boolean().optional(),
  // Platform-level integrations have workspace_id NULL. Explicit null
  // lets the schema accept both platform and workspace scopes without
  // forcing the UI to pass undefined.
  workspace_id: z.string().uuid().nullable().optional(),
});
export type CreateIntegrationInputParsed = z.infer<typeof CreateIntegrationInputSchema>;

export const UpdateIntegrationInputSchema = z.object({
  integration_id: z.string().uuid(),
  display_name: z.string().min(1).max(200).optional(),
  config: z.record(z.string(), z.unknown()).optional(),
  is_enabled: z.boolean().optional(),
  is_placeholder: z.boolean().optional(),
});
export type UpdateIntegrationInputParsed = z.infer<typeof UpdateIntegrationInputSchema>;

export const DeleteIntegrationInputSchema = z.object({
  integration_id: z.string().uuid(),
});
export type DeleteIntegrationInputParsed = z.infer<typeof DeleteIntegrationInputSchema>;

export const ToggleIntegrationInputSchema = z.object({
  integration_id: z.string().uuid(),
  enabled: z.boolean(),
});
export type ToggleIntegrationInputParsed = z.infer<typeof ToggleIntegrationInputSchema>;

export const TestConnectionInputSchema = z.object({
  integration_id: z.string().uuid(),
});
export type TestConnectionInputParsed = z.infer<typeof TestConnectionInputSchema>;

export const RetriggerIntegrationSyncInputSchema = z.object({
  integration_id: z.string().uuid(),
  entity_type: IntegrationEntitySchema,
  entity_id: z.string().uuid(),
  operation: IntegrationOperationSchema,
});
export type RetriggerIntegrationSyncInputParsed = z.infer<
  typeof RetriggerIntegrationSyncInputSchema
>;

// ─── Fase 2 Spor C — Invoice editing + workspace mark-paid ─────────
// Spec §5.2: platform-admin can add/edit/delete manual lines on draft
// invoices, plus create ad-hoc one_off invoices via Sheet drawer. Only
// lines with usage_snapshot_id IS NULL are mutable here — derived
// (usage-backed) lines are locked by the B1 trigger per ADR-0119.

// Reusable line-item draft shape. Used both for manual additions on
// existing invoices AND ad-hoc invoice composition. Quantity is
// unconstrained (decimals allowed for pro-rata billing).
const ManualLineInput = z.object({
  description: z.string().min(1).max(500),
  quantity: z.number().positive(),
  unit_price: z.number().nonnegative(),
  vat_rate: z.number().nonnegative().max(100),
});

export const AddManualLineItemInputSchema = z.object({
  invoice_id: z.string().uuid(),
  description: z.string().min(1).max(500),
  quantity: z.number().positive(),
  unit_price: z.number().nonnegative(),
  vat_rate: z.number().nonnegative().max(100),
});
export type AddManualLineItemInput = z.infer<typeof AddManualLineItemInputSchema>;

export const UpdateManualLineItemInputSchema = z.object({
  line_item_id: z.string().uuid(),
  description: z.string().min(1).max(500).optional(),
  quantity: z.number().positive().optional(),
  unit_price: z.number().nonnegative().optional(),
  vat_rate: z.number().nonnegative().max(100).optional(),
});
export type UpdateManualLineItemInput = z.infer<typeof UpdateManualLineItemInputSchema>;

export const DeleteManualLineItemInputSchema = z.object({
  line_item_id: z.string().uuid(),
});
export type DeleteManualLineItemInput = z.infer<typeof DeleteManualLineItemInputSchema>;

// Mirrors the DB `currency` enum. Keep this narrow to what Postgres
// accepts — a mismatch would surface as a late runtime reject.
export const CurrencySchema = z.enum(["NOK", "SEK", "DKK", "EUR"]);

// Initial status for ad-hoc invoices. Narrower than the full
// invoice_status enum — terminal statuses (paid/void/uncollectible)
// must go through their own reconciliation Server Actions, and
// `overdue` is computed by the dunning cron, not hand-set at creation.
export const AdHocInvoiceInitialStatusSchema = z.enum(["draft", "issued", "sent"]);
export type AdHocInvoiceInitialStatus = z.infer<typeof AdHocInvoiceInitialStatusSchema>;

export const CreateAdHocInvoiceInputSchema = z.object({
  company_id: z.string().uuid(),
  period_from: IsoDate,
  period_to: IsoDate,
  currency: CurrencySchema.optional(),
  status: AdHocInvoiceInitialStatusSchema.optional(),
  due_at: IsoDate.optional(),
  line_items: z.array(ManualLineInput).min(1, "At least one line item is required"),
});
export type CreateAdHocInvoiceInput = z.infer<typeof CreateAdHocInvoiceInputSchema>;

// Workspace-admin mark-paid (Spor C). Narrower than platform-admin
// MarkInvoicePaidInputSchema — workspace-admin only books bank_transfer,
// there is no channel picker. Reversal goes through credit-note only
// (ADR-0120), so no un-pay primitive exists here.
export const MarkInvoicePaidByWorkspaceAdminInputSchema = z.object({
  invoice_id: z.string().uuid(),
  payment_date: IsoDate,
  payment_reference: z.string().min(1).max(500),
  note: z.string().max(1000).optional(),
});
export type MarkInvoicePaidByWorkspaceAdminInput = z.infer<
  typeof MarkInvoicePaidByWorkspaceAdminInputSchema
>;

// ─── Fase 3A — Stripe payment inputs ───────────────────────────────
// Spec §3.2-§3.4 + ADR-0131 + ADR-0142. Server Actions validate these
// at the RPC boundary; pure actions assume data already parsed.

export const PaymentMethodTypeSchema = z.enum([
  "stripe_card",
  "stripe_bank",
  "bank_transfer",
  "manual_adjustment",
]);
export type PaymentMethodType = z.infer<typeof PaymentMethodTypeSchema>;

// Workspace "Betal nå" entrypoint — only the invoice_id is supplied; the
// action resolves the invoice + company + amount server-side to prevent
// tampering. stripe_card is implied for Checkout flows; stripe_bank is
// Stripe's Swish/Bancontact etc. which we enable later.
export const InitiatePaymentInputSchema = z.object({
  invoice_id: z.string().uuid(),
});
export type InitiatePaymentInput = z.infer<typeof InitiatePaymentInputSchema>;

// ADR-0120 void reasons overlap but refunds use a narrower set —
// bankruptcy / write-off don't belong here. Keep it short + aligned to
// Stripe's allowed reasons (duplicate / fraudulent / requested_by_customer).
export const RefundReasonSchema = z.enum([
  "duplicate",
  "fraudulent",
  "requested_by_customer",
  "other",
]);
export type RefundReason = z.infer<typeof RefundReasonSchema>;

// Platform-admin initiates a Stripe refund. amount omitted = full refund.
// Webhook charge.refunded then drives the DB state + credit-note creation
// per ADR-0142. We DO NOT write payment.refunded_amount directly here.
export const RefundPaymentInputSchema = z.object({
  payment_id: z.string().uuid(),
  amount: z.number().positive().optional(),
  reason: RefundReasonSchema,
  reason_detail: z.string().min(10).max(1000),
  idempotency_key: z.string().uuid(),
});
export type RefundPaymentInput = z.infer<typeof RefundPaymentInputSchema>;
