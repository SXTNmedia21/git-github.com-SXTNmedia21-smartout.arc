/**
 * @smartout/notifications — High-level email job API
 *
 * Orchestrates audience resolution, compliance checks, rate limiting,
 * template rendering, and batch sending via SendGrid.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { EmailJob, EmailJobOptions, SendEmailResult } from "./types";
import { resolveAudience } from "./audiences";
import { classifyEmail, filterSuppressed, validateSender } from "./compliance";
import { isOutboundEmailEnabled } from "./kill-switch";
import { checkRateLimit, RECIPIENT_HARD_CAP } from "./rate-limit";
import { sendEmailBatch } from "./sendgrid";
import { renderTemplate } from "./templates";

const JOB_BATCH_SIZE = 100;

export async function createEmailJob(
  adminClient: SupabaseClient,
  opts: EmailJobOptions,
): Promise<EmailJob> {
  // Kill switch
  const enabled = await isOutboundEmailEnabled(adminClient);
  if (!enabled) {
    throw new Error("Outbound email is currently disabled");
  }

  // Validate sender
  const fromEmail = opts.fromEmail ?? "noreply@smartout.io";
  if (!validateSender(fromEmail)) {
    throw new Error(`Sender address not allowed: ${fromEmail}`);
  }

  // Classification + rate limit
  const classification = classifyEmail(opts.template);
  const rateResult = await checkRateLimit(opts.adminId, classification);
  if (!rateResult.allowed) {
    throw new Error(rateResult.reason ?? "Rate limit exceeded");
  }

  // Resolve audience
  const recipients = await resolveAudience(adminClient, opts.audience);
  if (recipients.length === 0) {
    throw new Error("No recipients match the audience filter");
  }

  if (recipients.length > RECIPIENT_HARD_CAP) {
    throw new Error(
      `Recipient count (${recipients.length}) exceeds hard cap of ${RECIPIENT_HARD_CAP}`,
    );
  }

  // Filter suppressed emails
  const suppressed = await filterSuppressed(
    adminClient,
    recipients.map((r) => r.email),
  );
  const suppressedSet = new Set(suppressed.map((e) => e.toLowerCase()));
  const activeRecipients = recipients.filter((r) => !suppressedSet.has(r.email.toLowerCase()));

  if (activeRecipients.length === 0) {
    throw new Error("All recipients are suppressed");
  }

  // Create job record
  const jobId = crypto.randomUUID();
  const job: EmailJob = {
    jobId,
    status: "pending",
    totalRecipients: activeRecipients.length,
    processedCount: 0,
    sentCount: 0,
    failedCount: 0,
  };

  // Store job metadata for processing
  // We store in communication_log-compatible format when possible,
  // but for platform-level sends we track the job in memory and process immediately
  const result = await processEmailBatches(
    activeRecipients.map((r) => ({
      email: r.email,
      name: r.name,
      locale: r.locale,
    })),
    opts.template,
    opts.variables,
    fromEmail,
  );

  job.status = result.failed > 0 ? "completed" : "completed";
  job.processedCount = result.sent + result.failed;
  job.sentCount = result.sent;
  job.failedCount = result.failed;

  return job;
}

async function processEmailBatches(
  recipients: Array<{ email: string; name: string; locale: string }>,
  template: EmailJobOptions["template"],
  variables: Record<string, string>,
  fromEmail: string,
): Promise<SendEmailResult> {
  let totalSent = 0;
  let totalFailed = 0;
  const allErrors: Array<{ email: string; error: string }> = [];

  for (let i = 0; i < recipients.length; i += JOB_BATCH_SIZE) {
    const batch = recipients.slice(i, i + JOB_BATCH_SIZE);

    const emailsToSend = batch.map((r) => {
      const rendered = renderTemplate(template, { ...variables, recipientName: r.name }, r.locale);
      return {
        email: r.email,
        subject: rendered.subject,
        html: rendered.html,
      };
    });

    const result = await sendEmailBatch(emailsToSend, fromEmail);
    totalSent += result.sent;
    totalFailed += result.failed;
    allErrors.push(...result.errors);
  }

  return { sent: totalSent, failed: totalFailed, errors: allErrors };
}

export async function processEmailJob(
  adminClient: SupabaseClient,
  jobId: string,
): Promise<EmailJob> {
  // For now, jobs are processed synchronously in createEmailJob.
  // This function exists for future async job processing via queues.
  return getEmailJobStatus(adminClient, jobId);
}

export async function getEmailJobStatus(
  _adminClient: SupabaseClient,
  jobId: string,
): Promise<EmailJob> {
  // For now, since jobs are processed synchronously, we return a completed stub.
  // Future: query a jobs table for persisted status.
  return {
    jobId,
    status: "completed",
    totalRecipients: 0,
    processedCount: 0,
    sentCount: 0,
    failedCount: 0,
  };
}
