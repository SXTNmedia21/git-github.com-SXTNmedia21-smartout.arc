/**
 * @smartout/notifications — SMS service via Twilio SDK
 *
 * Sends SMS messages with retry + exponential backoff.
 * Credentials from Supabase Vault in production, env vars for local dev.
 */

import Twilio from "twilio";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getServiceKey } from "@smartout/supabase/vault";
import type { SmsResult } from "./types";

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;

type TwilioCredentials = {
  accountSid: string;
  authToken: string;
  fromNumber: string;
};

async function getTwilioCredentials(adminClient?: SupabaseClient): Promise<TwilioCredentials> {
  // Try Vault first (production), fall back to env vars (local dev)
  if (adminClient) {
    try {
      const [accountSid, authToken, fromNumber] = await Promise.all([
        getServiceKey(adminClient, "twilio_account_sid"),
        getServiceKey(adminClient, "twilio_auth_token"),
        getServiceKey(adminClient, "twilio_from_number"),
      ]);
      return { accountSid, authToken, fromNumber };
    } catch {
      // Vault unavailable — fall through to env vars
    }
  }

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_FROM_NUMBER;

  if (!accountSid || !authToken || !fromNumber) {
    throw new Error(
      "Twilio credentials not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER or store in Vault.",
    );
  }

  return { accountSid, authToken, fromNumber };
}

function createTwilioClient(creds: TwilioCredentials) {
  return Twilio(creds.accountSid, creds.authToken);
}

async function sendWithRetry(
  client: ReturnType<typeof Twilio>,
  to: string,
  from: string,
  body: string,
): Promise<{ success: boolean; sid?: string; error?: string }> {
  let lastError: unknown;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const message = await client.messages.create({ to, from, body });
      return { success: true, sid: message.sid };
    } catch (err: unknown) {
      lastError = err;
      const isRetryable =
        err instanceof Error &&
        ("status" in err
          ? (err as { status: number }).status === 429 || (err as { status: number }).status >= 500
          : false);

      if (isRetryable && attempt < MAX_RETRIES - 1) {
        const delay = BASE_DELAY_MS * Math.pow(2, attempt);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      break;
    }
  }

  const errorMsg = lastError instanceof Error ? lastError.message : "Unknown SMS error";
  return { success: false, error: errorMsg };
}

/**
 * Send a single SMS message.
 */
export async function sendSms(
  to: string,
  body: string,
  adminClient?: SupabaseClient,
): Promise<SmsResult> {
  const creds = await getTwilioCredentials(adminClient);
  const client = createTwilioClient(creds);
  const result = await sendWithRetry(client, to, creds.fromNumber, body);

  return {
    sent: result.success ? 1 : 0,
    failed: result.success ? 0 : 1,
    errors: result.error ? [{ phone: to, error: result.error }] : [],
  };
}

/**
 * Send SMS to multiple recipients with the same message body.
 */
export async function sendSmsBatch(
  recipients: Array<{ phone: string; body: string }>,
  adminClient?: SupabaseClient,
): Promise<SmsResult> {
  const creds = await getTwilioCredentials(adminClient);
  const client = createTwilioClient(creds);

  let totalSent = 0;
  let totalFailed = 0;
  const allErrors: Array<{ phone: string; error: string }> = [];

  for (const { phone, body } of recipients) {
    const result = await sendWithRetry(client, phone, creds.fromNumber, body);
    if (result.success) {
      totalSent++;
    } else {
      totalFailed++;
      allErrors.push({ phone, error: result.error ?? "Unknown error" });
    }
  }

  return { sent: totalSent, failed: totalFailed, errors: allErrors };
}
