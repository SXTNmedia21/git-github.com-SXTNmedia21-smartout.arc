/**
 * _shared/twilio.ts — Twilio SMS helper for Edge Functions (Deno)
 *
 * Uses Twilio REST API directly (no Node SDK needed).
 * Credentials from Deno.env (set via supabase/functions/.env or Vault).
 */

type TwilioCredentials = {
  accountSid: string;
  authToken: string;
  fromNumber: string;
};

type SendSmsResult = {
  success: boolean;
  sid?: string;
  error?: string;
};

function getCredentials(): TwilioCredentials | null {
  const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
  const authToken = Deno.env.get("TWILIO_AUTH_TOKEN");
  const fromNumber = Deno.env.get("TWILIO_FROM_NUMBER");

  if (!accountSid || !authToken || !fromNumber) {
    return null;
  }

  return { accountSid, authToken, fromNumber };
}

/**
 * Send a single SMS via Twilio REST API.
 */
export async function sendSms(
  to: string,
  body: string,
  creds?: TwilioCredentials,
): Promise<SendSmsResult> {
  const credentials = creds ?? getCredentials();
  if (!credentials) {
    console.warn("Twilio credentials not configured, skipping SMS");
    return { success: false, error: "Twilio credentials not configured" };
  }

  const { accountSid, authToken, fromNumber } = credentials;

  try {
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${btoa(`${accountSid}:${authToken}`)}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          To: to,
          From: fromNumber,
          Body: body,
        }),
      },
    );

    if (!res.ok) {
      const text = await res.text();
      console.error(`Twilio error ${res.status}:`, text);
      return { success: false, error: `Twilio ${res.status}: ${text}` };
    }

    const data = await res.json();
    return { success: true, sid: data.sid };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("Failed to send SMS:", msg);
    return { success: false, error: msg };
  }
}

/**
 * Send SMS to multiple recipients.
 */
export async function sendSmsBatch(
  messages: Array<{ to: string; body: string }>,
  creds?: TwilioCredentials,
): Promise<{ sent: number; failed: number; errors: Array<{ phone: string; error: string }> }> {
  const credentials = creds ?? getCredentials();
  if (!credentials) {
    return {
      sent: 0,
      failed: messages.length,
      errors: messages.map((m) => ({ phone: m.to, error: "Twilio credentials not configured" })),
    };
  }

  let sent = 0;
  let failed = 0;
  const errors: Array<{ phone: string; error: string }> = [];

  for (const msg of messages) {
    const result = await sendSms(msg.to, msg.body, credentials);
    if (result.success) {
      sent++;
    } else {
      failed++;
      errors.push({ phone: msg.to, error: result.error ?? "Unknown error" });
    }
  }

  return { sent, failed, errors };
}
