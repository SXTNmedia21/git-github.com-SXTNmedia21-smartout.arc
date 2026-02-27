import { z } from "zod";

// ─── Platform Audit Log ────────────────────────────────────────

export const PlatformAuditLogSchema = z.object({
  id: z.string().uuid(),
  super_admin_id: z.string().uuid(),
  action: z.string(),
  entity_type: z.string(),
  entity_id: z.string().uuid().nullish(),
  details: z.record(z.unknown()).default({}),
  ip_address: z.string().nullish(),
  created_at: z.string().datetime(),
});
export type PlatformAuditLog = z.infer<typeof PlatformAuditLogSchema>;

// ─── Platform Impersonation Log ────────────────────────────────

export const PlatformImpersonationLogSchema = z.object({
  id: z.string().uuid(),
  super_admin_id: z.string().uuid(),
  target_user_id: z.string().uuid(),
  target_workspace_id: z.string().uuid(),
  reason: z.string().min(1),
  started_at: z.string().datetime(),
  ended_at: z.string().datetime().nullish(),
  actions_taken: z.array(z.unknown()).default([]),
});
export type PlatformImpersonationLog = z.infer<
  typeof PlatformImpersonationLogSchema
>;

// ─── Landing Config ────────────────────────────────────────────

export const LandingConfigSchema = z.object({
  config_id: z.string().uuid(),
  slug: z.string().min(1),
  name: z.string().min(1),
  locale: z.string().default("no"),
  status: z.string(),
  config_json: z.record(z.unknown()),
  published_json: z.record(z.unknown()).nullish(),
  version: z.number().int().default(1),
  created_by: z.string().uuid().nullish(),
  updated_by: z.string().uuid().nullish(),
  published_at: z.string().datetime().nullish(),
  published_by: z.string().uuid().nullish(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});
export type LandingConfig = z.infer<typeof LandingConfigSchema>;

export const LandingConfigVersionSchema = z.object({
  version_id: z.string().uuid(),
  config_id: z.string().uuid(),
  version: z.number().int(),
  config_json: z.record(z.unknown()),
  change_notes: z.string().nullish(),
  created_by: z.string().uuid().nullish(),
  created_at: z.string().datetime(),
});
export type LandingConfigVersion = z.infer<typeof LandingConfigVersionSchema>;

// ─── Platform Contract Template ────────────────────────────────

export const ContractVariableFieldSchema = z.object({
  name: z.string(),
  label: z.string(),
  type: z.enum(["text", "date", "number", "select"]),
  required: z.boolean().default(false),
  options: z.array(z.string()).optional(),
});
export type ContractVariableField = z.infer<typeof ContractVariableFieldSchema>;

export const PlatformContractTemplateSchema = z.object({
  template_id: z.string().uuid(),
  name: z.string().min(1),
  description: z.string().nullish(),
  docuseal_template_id: z.string().nullish(),
  template_type: z.string(),
  locale: z.string().default("no"),
  status: z.string(),
  variable_fields: z.array(ContractVariableFieldSchema).default([]),
  created_by: z.string().uuid().nullish(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});
export type PlatformContractTemplate = z.infer<
  typeof PlatformContractTemplateSchema
>;

// ─── Platform Contract Instance ────────────────────────────────

export const ContractSignatorySchema = z.object({
  name: z.string(),
  email: z.string().email(),
  role: z.string(),
  signed_at: z.string().datetime().nullish(),
});
export type ContractSignatory = z.infer<typeof ContractSignatorySchema>;

export const PlatformContractInstanceSchema = z.object({
  contract_id: z.string().uuid(),
  template_id: z.string().uuid().nullish(),
  company_id: z.string().uuid(),
  workspace_id: z.string().uuid().nullish(),
  title: z.string().min(1),
  status: z.string(),
  docuseal_submission_id: z.string().nullish(),
  field_values: z.record(z.unknown()).default({}),
  signatories: z.array(ContractSignatorySchema).default([]),
  sent_at: z.string().datetime().nullish(),
  signed_at: z.string().datetime().nullish(),
  expires_at: z.string().datetime().nullish(),
  document_url: z.string().nullish(),
  created_by: z.string().uuid().nullish(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});
export type PlatformContractInstance = z.infer<
  typeof PlatformContractInstanceSchema
>;

// ─── Platform Metrics Daily ────────────────────────────────────

export const PlatformMetricsDailySchema = z.object({
  date: z.string(),
  total_users: z.number().int(),
  total_companies: z.number().int(),
  total_workspaces: z.number().int(),
  total_profiles: z.number().int(),
  new_users_today: z.number().int(),
  new_workspaces_today: z.number().int(),
  subscriptions_trial: z.number().int(),
  subscriptions_active: z.number().int(),
  subscriptions_paused: z.number().int(),
  subscriptions_past_due: z.number().int(),
  subscriptions_cancelled: z.number().int(),
  mrr_nok: z.number(),
  active_workspaces_24h: z.number().int(),
  sessions_created_24h: z.number().int(),
  tasks_completed_24h: z.number().int(),
  signups_to_workspace: z.number().nullish(),
  workspace_to_invite: z.number().nullish(),
  invite_to_session: z.number().nullish(),
  computed_at: z.string().datetime(),
});
export type PlatformMetricsDaily = z.infer<typeof PlatformMetricsDailySchema>;
