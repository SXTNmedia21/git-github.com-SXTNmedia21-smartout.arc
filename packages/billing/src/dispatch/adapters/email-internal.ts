// EmailInternalAdapter — audit-cc copy for Smartout + workspace admins.
//
// Minimal template: invoice number, period, amount, link to portal. No
// PDF attachment (§3.3 explicit); the recipient is internal so a plain
// summary is enough.
//
// Target shape: `{ email: string }`

import type {
  DispatchAdapter,
  DispatchInput,
  DispatchResult,
  TemplateContext,
  TestConnectionResult,
} from "../types";
import { renderTemplate } from "../template";
import { sendViaSendGrid } from "./sendgrid";

const DEFAULT_SUBJECT = "[Smartout audit] Faktura {{invoice.number}}";
const DEFAULT_BODY = `
<div style="font-family: system-ui, sans-serif; max-width: 520px; margin: 0 auto; padding: 20px;">
  <h3 style="color: #1a1a1a; margin: 0 0 12px;">Faktura {{invoice.number}}</h3>
  <table style="border-collapse: collapse; font-size: 14px; color: #444;">
    <tr><td style="padding: 4px 12px 4px 0;">Invoice ID</td><td>{{invoice.invoice_id}}</td></tr>
    <tr><td style="padding: 4px 12px 4px 0;">Status</td><td>{{invoice.status}}</td></tr>
    <tr><td style="padding: 4px 12px 4px 0;">Periode</td><td>{{invoice.period_from}} – {{invoice.period_to}}</td></tr>
    <tr><td style="padding: 4px 12px 4px 0;">Beløp inkl. mva</td><td>{{invoice.amount_incl_vat}} NOK</td></tr>
    <tr><td style="padding: 4px 12px 4px 0;">Forfall</td><td>{{invoice.due_at}}</td></tr>
  </table>
  <p style="color: #999; font-size: 12px; margin-top: 16px;">
    Automatisk audit-kopi. Ikke svar på denne meldingen.
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

export const EmailInternalAdapter: DispatchAdapter = {
  channel: "email_internal",

  async send(input: DispatchInput): Promise<DispatchResult> {
    const to = getEmail(input.target);
    if (!to) {
      return {
        status: "failed",
        error_code: "invalid_target",
        error_message: "email_internal target must contain an 'email' string field.",
        retryable: false,
      };
    }

    const context = buildTemplateContext(input.invoice);
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
