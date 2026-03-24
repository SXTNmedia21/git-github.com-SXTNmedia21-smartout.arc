/**
 * @smartout/notifications — Email notification infrastructure
 */

// Types
export type {
  AudienceFilter,
  EmailClassification,
  EmailJob,
  EmailJobOptions,
  EmailTemplate,
  RenderedEmail,
  ResolvedRecipient,
  SendEmailResult,
  SendGridTemplateData,
  SmsResult,
} from "./types";

// Email service (high-level API)
export { createEmailJob, getEmailJobStatus, processEmailJob } from "./email-service";

// SendGrid adapter
export { sendDynamicTemplateBatch, sendEmailBatch } from "./sendgrid";

// Templates
export { renderTemplate } from "./templates";

// Audiences
export { countAudience, resolveAudience } from "./audiences";

// Compliance
export {
  ALLOWED_SENDERS,
  classifyEmail,
  filterSuppressed,
  getLegalFooter,
  validateSender,
} from "./compliance";

// Rate limiting
export { checkRateLimit, RECIPIENT_HARD_CAP, RECIPIENT_SOFT_CAP } from "./rate-limit";

// SMS service
export { sendSms, sendSmsBatch } from "./sms-service";

// Kill switch
export { isOutboundEmailEnabled } from "./kill-switch";

// Event config registry
export { NOTIFICATION_EVENTS, getEventConfig, interpolateTemplate } from "./event-config";
export type { NotificationEventConfig } from "./event-config";

// Outbox helper
export { insertOutboxNotification } from "./outbox";
