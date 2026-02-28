/**
 * @smartout/notifications — Compliance controls
 *
 * Email classification, legal footers, suppression list, sender validation.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { EmailClassification, EmailTemplate } from "./types";

const TEMPLATE_CLASSIFICATION: Record<EmailTemplate, EmailClassification> = {
  "platform-announcement": "broadcast",
  "workspace-notification": "transactional",
  "trial-reminder": "transactional",
  "payment-reminder": "transactional",
  "contract-reminder": "transactional",
};

export const ALLOWED_SENDERS = [
  "noreply@smartout.io",
  "support@smartout.io",
  "hei@smartout.io",
] as const;

export function classifyEmail(template: EmailTemplate): EmailClassification {
  return TEMPLATE_CLASSIFICATION[template];
}

export function getLegalFooter(locale?: string): string {
  if (locale === "en") {
    return `<p style="margin:0;">Smartout AS &middot; Org.nr 932 225 681 &middot; Oslo, Norway</p>
<p style="margin:4px 0 0;">You are receiving this email because you have an account on Smartout. To manage your notification preferences, visit your settings.</p>`;
  }

  // Default: Norwegian
  return `<p style="margin:0;">Smartout AS &middot; Org.nr 932 225 681 &middot; Oslo, Norge</p>
<p style="margin:4px 0 0;">Du mottar denne e-posten fordi du har en konto hos Smartout. For a endre varslingsinnstillingene dine, ga til innstillinger.</p>`;
}

export async function filterSuppressed(
  adminClient: SupabaseClient,
  emails: string[],
): Promise<string[]> {
  if (emails.length === 0) return [];

  // Check platform_email_suppression table if it exists.
  // If the table doesn't exist yet, return an empty suppressed list.
  try {
    const { data, error } = await adminClient
      .from("platform_email_suppression" as never)
      .select("email")
      .in("email", emails);

    if (error) {
      // Table may not exist yet — suppress nothing
      return [];
    }

    const suppressedSet = new Set(
      ((data as Array<{ email: string }>) ?? []).map((d) => d.email.toLowerCase()),
    );
    return emails.filter((e) => suppressedSet.has(e.toLowerCase()));
  } catch {
    // Table doesn't exist or other DB error — suppress nothing
    return [];
  }
}

export function validateSender(from: string): boolean {
  return (ALLOWED_SENDERS as readonly string[]).includes(from.toLowerCase());
}
