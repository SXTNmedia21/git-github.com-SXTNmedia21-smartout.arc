/**
 * @smartout/notifications — Low-level SendGrid adapter
 *
 * Sends emails in batches of 100 with retry + exponential backoff on 429/5xx.
 */

import sgMail from "@sendgrid/mail";
import {
  isDevSmtpEnabled,
  sendDynamicTemplateBatchViaSmtp,
  sendEmailBatchViaSmtp,
} from "./smtp-dev";
import type { SendEmailResult, SendGridTemplateData } from "./types";

const DEFAULT_FROM = "noreply@smartout.ai";

/** Temporary env var fallback — callers should pass apiKey from Vault instead. */
function requireEnvKey(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set. Save it via /platform-admin/keys.`);
  return value;
}
const BATCH_SIZE = 100;
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;

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

function getSendGridClient(apiKey: string): typeof sgMail {
  sgMail.setApiKey(apiKey);
  return sgMail;
}

function isRetryableError(error: unknown): boolean {
  if (typeof error === "object" && error !== null && "code" in error) {
    const code = (error as { code: number }).code;
    return code === 429 || code >= 500;
  }
  return false;
}

async function sendWithRetry(
  client: typeof sgMail,
  messages: EmailMessage[],
): Promise<{ sent: string[]; failed: Array<{ email: string; error: string }> }> {
  const sent: string[] = [];
  const failed: Array<{ email: string; error: string }> = [];

  for (const msg of messages) {
    let lastError: unknown;
    let success = false;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        await client.send(msg);
        sent.push(msg.to);
        success = true;
        break;
      } catch (err: unknown) {
        lastError = err;
        if (isRetryableError(err) && attempt < MAX_RETRIES - 1) {
          const delay = BASE_DELAY_MS * Math.pow(2, attempt);
          await new Promise((r) => setTimeout(r, delay));
          continue;
        }
        break;
      }
    }

    if (!success) {
      const errorMsg = lastError instanceof Error ? lastError.message : "Unknown send error";
      failed.push({ email: msg.to, error: errorMsg });
    }
  }

  return { sent, failed };
}

export async function sendEmailBatch(
  recipients: Array<{ email: string; subject: string; html: string }>,
  fromEmail: string = DEFAULT_FROM,
  apiKey?: string,
): Promise<SendEmailResult> {
  if (isDevSmtpEnabled()) {
    return sendEmailBatchViaSmtp(
      recipients.map((r) => ({
        to: r.email,
        from: fromEmail,
        subject: r.subject,
        html: r.html,
      })),
    );
  }

  const client = getSendGridClient(apiKey ?? requireEnvKey("SENDGRID_API_KEY"));

  let totalSent = 0;
  let totalFailed = 0;
  const allErrors: Array<{ email: string; error: string }> = [];

  for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
    const batch = recipients.slice(i, i + BATCH_SIZE);
    const messages: EmailMessage[] = batch.map((r) => ({
      to: r.email,
      from: fromEmail,
      subject: r.subject,
      html: r.html,
    }));

    const result = await sendWithRetry(client, messages);
    totalSent += result.sent.length;
    totalFailed += result.failed.length;
    allErrors.push(...result.failed);
  }

  return {
    sent: totalSent,
    failed: totalFailed,
    errors: allErrors,
  };
}

async function sendDynamicWithRetry(
  client: typeof sgMail,
  messages: DynamicTemplateMessage[],
): Promise<{ sent: string[]; failed: Array<{ email: string; error: string }> }> {
  const sent: string[] = [];
  const failed: Array<{ email: string; error: string }> = [];

  for (const msg of messages) {
    let lastError: unknown;
    let success = false;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        await client.send(msg);
        sent.push(msg.to);
        success = true;
        break;
      } catch (err: unknown) {
        lastError = err;
        if (isRetryableError(err) && attempt < MAX_RETRIES - 1) {
          const delay = BASE_DELAY_MS * Math.pow(2, attempt);
          await new Promise((r) => setTimeout(r, delay));
          continue;
        }
        break;
      }
    }

    if (!success) {
      const errorMsg = lastError instanceof Error ? lastError.message : "Unknown send error";
      failed.push({ email: msg.to, error: errorMsg });
    }
  }

  return { sent, failed };
}

export async function sendDynamicTemplateBatch(
  recipients: Array<{ email: string; templateData: SendGridTemplateData }>,
  templateId: string,
  fromEmail: string = DEFAULT_FROM,
  apiKey?: string,
): Promise<SendEmailResult> {
  if (isDevSmtpEnabled()) {
    return sendDynamicTemplateBatchViaSmtp(
      recipients.map((r) => ({
        to: r.email,
        from: fromEmail,
        templateId,
        dynamicTemplateData: r.templateData,
      })),
    );
  }

  const client = getSendGridClient(apiKey ?? requireEnvKey("SENDGRID_API_KEY"));

  let totalSent = 0;
  let totalFailed = 0;
  const allErrors: Array<{ email: string; error: string }> = [];

  for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
    const batch = recipients.slice(i, i + BATCH_SIZE);
    const messages: DynamicTemplateMessage[] = batch.map((r) => ({
      to: r.email,
      from: fromEmail,
      templateId,
      dynamicTemplateData: r.templateData,
    }));

    const result = await sendDynamicWithRetry(client, messages);
    totalSent += result.sent.length;
    totalFailed += result.failed.length;
    allErrors.push(...result.failed);
  }

  return {
    sent: totalSent,
    failed: totalFailed,
    errors: allErrors,
  };
}
