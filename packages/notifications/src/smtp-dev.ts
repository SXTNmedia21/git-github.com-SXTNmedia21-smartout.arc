/**
 * @smartout/notifications — Dev-mode SMTP bridge
 *
 * Routes outbound mail through a local SMTP catcher (Mailpit) instead of
 * SendGrid HTTPS API. Active only when `SMTP_DEV_HOST` is set.
 *
 * Why: SendGrid is API-only (ADR-0045). Local dev never sees rendered mail,
 * so template regressions only surface in prod. This bridge wires every
 * @smartout/notifications dispatch path to Mailpit's UI at :54324 in dev.
 *
 * Format of SMTP_DEV_HOST: `host:port` (e.g. `127.0.0.1:54325`).
 *
 * NEVER use in prod: callers in production pass real recipient addresses;
 * routing them through a local catcher would drop real mail. Guarded by
 * NODE_ENV !== "production".
 */

import { createTransport, type Transporter } from "nodemailer";
import type { SendEmailResult, SendGridTemplateData } from "./types";

type EmailMessage = {
  to: string;
  from: string;
  subject: string;
  html: string;
};

type DynamicTemplateMessage = {
  to: string;
  from: string;
  templateId: string;
  dynamicTemplateData: SendGridTemplateData;
};

let cachedTransport: Transporter | null = null;

function parseHost(raw: string): { host: string; port: number } {
  const [host, portStr] = raw.split(":");
  const port = Number(portStr ?? "25");
  if (!host || Number.isNaN(port)) {
    throw new Error(`SMTP_DEV_HOST must be "host:port", got "${raw}"`);
  }
  return { host, port };
}

function getTransport(): Transporter {
  if (cachedTransport) return cachedTransport;
  const { host, port } = parseHost(process.env.SMTP_DEV_HOST!);
  cachedTransport = createTransport({
    host,
    port,
    secure: false,
    ignoreTLS: true,
    // Mailpit accepts any auth; no credentials required in dev.
  });
  return cachedTransport;
}

/** True when the dev SMTP bridge is configured and we are not in production. */
export function isDevSmtpEnabled(): boolean {
  return Boolean(process.env.SMTP_DEV_HOST) && process.env.NODE_ENV !== "production";
}

export async function sendEmailBatchViaSmtp(recipients: EmailMessage[]): Promise<SendEmailResult> {
  const transport = getTransport();
  const errors: Array<{ email: string; error: string }> = [];
  let sent = 0;

  for (const msg of recipients) {
    try {
      await transport.sendMail({
        from: msg.from,
        to: msg.to,
        subject: msg.subject,
        html: msg.html,
      });
      sent += 1;
    } catch (err) {
      errors.push({
        email: msg.to,
        error: err instanceof Error ? err.message : "smtp_send_failed",
      });
    }
  }

  return { sent, failed: errors.length, errors };
}

/**
 * SendGrid dynamic templates resolve server-side at SendGrid; we don't have
 * the rendered HTML locally. For dev, dump the raw templateData as JSON in
 * the body so devs can verify which payload the prod template would receive.
 */
export async function sendDynamicTemplateBatchViaSmtp(
  recipients: DynamicTemplateMessage[],
): Promise<SendEmailResult> {
  const transport = getTransport();
  const errors: Array<{ email: string; error: string }> = [];
  let sent = 0;

  for (const msg of recipients) {
    const html =
      `<p><strong>[dev-smtp]</strong> SendGrid dynamic template <code>${msg.templateId}</code></p>` +
      `<pre>${JSON.stringify(msg.dynamicTemplateData, null, 2)}</pre>`;
    try {
      await transport.sendMail({
        from: msg.from,
        to: msg.to,
        subject: `[dev-smtp] ${msg.templateId}`,
        html,
      });
      sent += 1;
    } catch (err) {
      errors.push({
        email: msg.to,
        error: err instanceof Error ? err.message : "smtp_send_failed",
      });
    }
  }

  return { sent, failed: errors.length, errors };
}
