/**
 * @smartout/notifications — Template registry + rendering
 *
 * Each template produces inline-CSS HTML suitable for email clients.
 */

import type { EmailTemplate, RenderedEmail } from "./types";
import { getLegalFooter } from "./compliance";

type TemplateDefinition = {
  subject: (vars: Record<string, string>) => string;
  body: (vars: Record<string, string>) => string;
};

const HEADER_HTML = `
<div style="background-color:#1a1a2e;padding:24px 32px;text-align:center;">
  <span style="color:#ffffff;font-size:24px;font-weight:700;letter-spacing:-0.5px;">Smartout</span>
</div>`;

function wrapLayout(bodyHtml: string, footerHtml: string): string {
  return `<!DOCTYPE html>
<html lang="no">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;">
<tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;max-width:600px;width:100%;">
<tr><td>${HEADER_HTML}</td></tr>
<tr><td style="padding:32px;color:#1a1a2e;font-size:15px;line-height:1.6;">
${bodyHtml}
</td></tr>
<tr><td style="padding:16px 32px 24px;border-top:1px solid #e4e4e7;color:#71717a;font-size:12px;line-height:1.5;">
${footerHtml}
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

function interpolate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? "");
}

const templates: Record<EmailTemplate, TemplateDefinition> = {
  "platform-announcement": {
    subject: (v) => interpolate(v.subject ?? "Viktig melding fra Smartout", v),
    body: (v) => `
<h2 style="margin:0 0 16px;font-size:20px;color:#1a1a2e;">${interpolate(v.title ?? "Melding fra Smartout", v)}</h2>
<p style="margin:0 0 16px;">${interpolate(v.message ?? "", v)}</p>
${v.ctaUrl ? `<p style="margin:24px 0;"><a href="${v.ctaUrl}" style="display:inline-block;padding:12px 24px;background-color:#2563eb;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;">${v.ctaLabel ?? "Les mer"}</a></p>` : ""}`,
  },

  "workspace-notification": {
    subject: (v) => interpolate(v.subject ?? "Oppdatering for {{workspaceName}}", v),
    body: (v) => `
<h2 style="margin:0 0 16px;font-size:20px;color:#1a1a2e;">Hei {{recipientName}},</h2>
<p style="margin:0 0 16px;">${interpolate(v.message ?? "", v)}</p>
<p style="margin:0;color:#71717a;font-size:13px;">Arbeidsplass: ${v.workspaceName ?? ""}</p>`,
  },

  "trial-reminder": {
    subject: (v) =>
      interpolate(v.subject ?? "Proveperioden din utloper snart — {{companyName}}", v),
    body: (v) => `
<h2 style="margin:0 0 16px;font-size:20px;color:#1a1a2e;">Proveperioden utloper snart</h2>
<p style="margin:0 0 16px;">Hei {{recipientName}},</p>
<p style="margin:0 0 16px;">Proveperioden for <strong>{{companyName}}</strong> utloper om <strong>{{daysLeft}}</strong> dager.</p>
<p style="margin:0 0 16px;">Oppgrader na for a beholde tilgang til alle funksjoner.</p>
<p style="margin:24px 0;"><a href="${v.upgradeUrl ?? "https://smartout.io/pricing"}" style="display:inline-block;padding:12px 24px;background-color:#2563eb;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;">Oppgrader na</a></p>`,
  },

  "payment-reminder": {
    subject: (v) => interpolate(v.subject ?? "Betalingspaminnelse — {{companyName}}", v),
    body: (v) => `
<h2 style="margin:0 0 16px;font-size:20px;color:#1a1a2e;">Betalingspaminnelse</h2>
<p style="margin:0 0 16px;">Hei {{recipientName}},</p>
<p style="margin:0 0 16px;">Vi har ikke mottatt betaling for <strong>{{companyName}}</strong>.</p>
<p style="margin:0 0 16px;">Betalingsfrist: <strong>{{dueDate}}</strong></p>
<p style="margin:0 0 16px;">Belop: <strong>{{amount}}</strong></p>
<p style="margin:24px 0;"><a href="${v.paymentUrl ?? "https://smartout.io/billing"}" style="display:inline-block;padding:12px 24px;background-color:#2563eb;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;">Betal na</a></p>`,
  },

  "contract-reminder": {
    subject: (v) => interpolate(v.subject ?? "Kontrakt venter pa signering — {{employeeName}}", v),
    body: (v) => `
<h2 style="margin:0 0 16px;font-size:20px;color:#1a1a2e;">Kontrakt venter pa signering</h2>
<p style="margin:0 0 16px;">Hei {{recipientName}},</p>
<p style="margin:0 0 16px;">Kontrakten for <strong>{{employeeName}}</strong> hos <strong>{{companyName}}</strong> venter fortsatt pa signering.</p>
<p style="margin:0 0 16px;">Sendt: <strong>{{sentDate}}</strong></p>
${v.signUrl ? `<p style="margin:24px 0;"><a href="${v.signUrl}" style="display:inline-block;padding:12px 24px;background-color:#2563eb;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;">Signer na</a></p>` : ""}`,
  },

  "contract-lifecycle": {
    subject: (v) =>
      interpolate(v.subject ?? "Kontraktoppdatering — {{employeeName}}", v),
    body: (v) => `
<h2 style="margin:0 0 16px;font-size:20px;color:#1a1a2e;">${interpolate(v.title ?? "Kontraktoppdatering", v)}</h2>
<p style="margin:0 0 16px;">Hei {{recipientName}},</p>
<p style="margin:0 0 16px;">${interpolate(v.message ?? "", v)}</p>
${v.ctaUrl ? `<p style="margin:24px 0;"><a href="${v.ctaUrl}" style="display:inline-block;padding:12px 24px;background-color:#2563eb;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;">${v.ctaLabel ?? "Se kontrakt"}</a></p>` : ""}`,
  },

  "contract-reminder-due": {
    subject: (v) =>
      interpolate(v.subject ?? "Paminnelse: Signer kontrakten din — {{companyName}}", v),
    body: (v) => `
<h2 style="margin:0 0 16px;font-size:20px;color:#1a1a2e;">Paminnelse om signering</h2>
<p style="margin:0 0 16px;">Hei {{recipientName}},</p>
<p style="margin:0 0 16px;">Du har fortsatt en usignert kontrakt hos <strong>{{companyName}}</strong>. Vennligst signer sa snart som mulig.</p>
${v.signUrl ? `<p style="margin:24px 0;"><a href="${v.signUrl}" style="display:inline-block;padding:12px 24px;background-color:#2563eb;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;">Signer na</a></p>` : ""}`,
  },

  // Dynamic templates are rendered by SendGrid — this is a no-op fallback
  "sendgrid-dynamic": {
    subject: (v) => v.subject ?? "",
    body: () => "",
  },
};

export function renderTemplate(
  template: EmailTemplate,
  variables: Record<string, string>,
  locale?: string,
): RenderedEmail {
  const def = templates[template];
  const subject = def.subject(variables);
  const bodyHtml = interpolate(def.body(variables), variables);
  const footer = getLegalFooter(locale);
  const html = wrapLayout(bodyHtml, footer);

  return { subject, html };
}
