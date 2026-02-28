/**
 * @smartout/notifications — shared types
 */

export type EmailTemplate =
  | "platform-announcement"
  | "workspace-notification"
  | "trial-reminder"
  | "payment-reminder"
  | "contract-reminder";

export type EmailClassification = "transactional" | "broadcast";

export type AudienceFilter =
  | { type: "all_users" }
  | { type: "super_admins" }
  | { type: "workspace"; workspaceId: string; role?: string; status?: string }
  | { type: "role"; role: string }
  | { type: "status"; status: string }
  | { type: "user_ids"; userIds: string[] };

export type ResolvedRecipient = {
  email: string;
  name: string;
  userId: string;
  workspaceId?: string;
  locale: string;
};

export type EmailJob = {
  jobId: string;
  status: "pending" | "processing" | "completed" | "failed";
  totalRecipients: number;
  processedCount: number;
  sentCount: number;
  failedCount: number;
};

export type SendEmailResult = {
  sent: number;
  failed: number;
  errors: Array<{ email: string; error: string }>;
};

export type RenderedEmail = {
  subject: string;
  html: string;
};

export type EmailJobOptions = {
  template: EmailTemplate;
  variables: Record<string, string>;
  audience: AudienceFilter;
  fromEmail?: string;
  adminId: string;
};
