// EmailCustomerAdapter — sends the invoice to the paying customer.
//
// Per Fase 2 spec §3.3 this is the customer-facing variant (PDF attach-
// ment when available, richer body). Fase 2 scope excludes PDF generation
// (no existing invoice PDF generator in the repo as of B2), so the
// customer receives an HTML email with a link to the portal invoice
// detail. PDF attachment is Fase 3 carry-over.
//
// Target shape: `{ email: string }`
// Template: billing_dispatch_template row with channel = 'email_customer'.
//           Subject + body both rendered with Mustache context (see
//           ../template.ts). If no template is provided, a safe default
//           wraps the invoice number.

import type {
  DispatchAdapter,
  DispatchInput,
  DispatchResult,
  TemplateContext,
  TestConnectionResult,
} from "../types";
import { renderTemplate } from "../template";
import { sendViaSendGrid } from "./sendgrid";

const DEFAULT_SUBJECT = "Faktura {{invoice.number}} fra Smartout";
const DEFAULT_BODY = `
<div style="font-family: system-ui, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px;">
  <h2 style="color: #1a1a1a;">Faktura {{invoice.number}}</h2>
  <p style="color: #444; line-height: 1.5;">
    Hei! Her er fakturaen din fra Smartout. Beløp inkl. mva:
    <strong>{{invoice.amount_incl_vat}} NOK</strong>.
  </p>
  <p style="color: #666; font-size: 14px;">
    Periode: {{invoice.period_from}} – {{invoice.period_to}}.
    Forfall: {{invoice.due_at}}.
  </p>
  <p style="color: #999; font-size: 13px; margin-top: 24px;">
    Spørsmål? Svar på denne e-posten — vi er her for å hjelpe.
  </p>
</div>
`;

function buildTemplateContext(invoice: DispatchInput["invoice"]): TemplateContext {
  return {
    invoice: {
      number: invoice.invoice_number ?? null,
      invoice_id: invoice.invoice_id,
      amount_incl_vat: invoice.amount_incl_vat,
      amount_excl_vat: invoice.amount_excl_vat,
      vat_amount: invoice.vat_amount,
      period_from: invoice.period_from,
      period_to: invoice.period_to,
      due_at: invoice.due_at ?? null,
      status: invoice.status,
    },
  };
}

function getEmail(target: Record<string, unknown>): string | null {
  const raw = target["email"];
  if (typeof raw !== "string" || !raw.includes("@")) return null;
  return raw;
}

export const EmailCustomerAdapter: DispatchAdapter = {
  channel: "email_customer",

  async send(input: DispatchInput): Promise<DispatchResult> {
    const to = getEmail(input.target);
    if (!to) {
      return {
        status: "failed",
        error_code: "invalid_target",
        error_message: "email_customer target must contain an 'email' string field.",
        retryable: false,
      };
    }

    const context = buildTemplateContext(input.invoice);
    // Subjects should never carry HTML entities; disable escape there.
    const subject = renderTemplate(input.template?.subject_template ?? DEFAULT_SUBJECT, context, {
      escape: false,
    });
    const html = renderTemplate(input.template?.body_template ?? DEFAULT_BODY, context, {
      escape: true,
    });

    return sendViaSendGrid({
      to,
      subject,
      html,
      invoiceDispatchId: input.invoice_dispatch_id,
    });
  },

  async testConnection(target: Record<string, unknown>): Promise<TestConnectionResult> {
    const to = getEmail(target);
    if (!to) {
      return {
        status: "error",
        message: "Target is missing an 'email' field.",
      };
    }
    if (!process.env.SENDGRID_API_KEY) {
      return {
        status: "error",
        message: "SENDGRID_API_KEY is not configured.",
      };
    }
    return { status: "ok" };
  },
};
