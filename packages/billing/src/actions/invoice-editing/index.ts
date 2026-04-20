// Fase 2 Spor C — Invoice editing Server Action building blocks.
//
// Every function here is a PURE ASYNC FUNCTION that takes a Supabase
// client. Web Server Actions wrap these in auth-gate + revalidatePath
// (+ Zod validation at the HTTP edge); React Native mobile callers
// invoke them directly. No Next.js-only dependencies in this module.
//
// The actions cover four Fase 2 Spor C scenarios:
//   1. addManualLineItem — insert a manual adjustment line on a draft
//      invoice. Parent totals are re-aggregated.
//   2. updateManualLineItem — edit a manual line (only where
//      usage_snapshot_id IS NULL). Derived rows are locked by the B1
//      trigger; we also refuse upfront for a cleaner error shape.
//   3. deleteManualLineItem — same rules as update.
//   4. createAdHocInvoice — one-off invoice from scratch. Uses the
//      existing `one_off` invoice_type enum value per spec §5.2.
//
// Ref: Fase 2 spec §5, ADR-0119 (usage-backed immutability),
//      ADR-0120 (reversal via credit note).

export {
  addManualLineItem,
  recalculateInvoiceTotals,
  type AddManualLineItemArgs,
  type AddManualLineItemResult,
} from "./addManualLineItem";
export {
  updateManualLineItem,
  type UpdateManualLineItemArgs,
  type UpdateManualLineItemResult,
} from "./updateManualLineItem";
export {
  deleteManualLineItem,
  type DeleteManualLineItemArgs,
  type DeleteManualLineItemResult,
} from "./deleteManualLineItem";
export {
  createAdHocInvoice,
  type AdHocLineInput,
  type CreateAdHocInvoiceArgs,
  type CreateAdHocInvoiceResult,
} from "./createAdHocInvoice";
