import { z } from "zod";

export const ProfileRoleEnum = z.enum([
  "employee",
  "manager",
  "admin",
  "owner",
]);
export type ProfileRole = z.infer<typeof ProfileRoleEnum>;

export const ProfileStatusEnum = z.enum([
  "trainee",
  "active",
  "inactive",
  "offboarding",
]);
export type ProfileStatus = z.infer<typeof ProfileStatusEnum>;

export const PolicyTypeEnum = z.enum([
  "operational",
  "haccp",
  "hr",
  "safety",
  "access",
  "payroll",
  "custom",
]);
export type PolicyType = z.infer<typeof PolicyTypeEnum>;

export const PolicyScopeEnum = z.enum([
  "workspace",
  "department",
  "team",
  "location",
]);
export type PolicyScope = z.infer<typeof PolicyScopeEnum>;

export const EnforcementStatusEnum = z.enum(["aspirational", "enforced"]);
export type EnforcementStatus = z.infer<typeof EnforcementStatusEnum>;

export const ProtocolStatusEnum = z.enum(["draft", "active", "deprecated"]);
export type ProtocolStatus = z.infer<typeof ProtocolStatusEnum>;

export const ProcedureTypeEnum = z.enum([
  "standard",
  "onboarding",
  "safety",
  "maintenance",
  "custom",
]);
export type ProcedureType = z.infer<typeof ProcedureTypeEnum>;

export const TriggerTypeEnum = z.enum(["scheduled", "event"]);
export type TriggerType = z.infer<typeof TriggerTypeEnum>;

export const RoutineAssignedToTypeEnum = z.enum(["team", "role", "profile"]);
export type RoutineAssignedToType = z.infer<typeof RoutineAssignedToTypeEnum>;

export const ControlListAssignedToTypeEnum = z.enum([
  "team_leader",
  "manager",
  "admin",
  "custom",
]);
export type ControlListAssignedToType = z.infer<
  typeof ControlListAssignedToTypeEnum
>;

export const ControlFrequencyEnum = z.enum([
  "every_time",
  "every_nth",
  "never",
]);
export type ControlFrequency = z.infer<typeof ControlFrequencyEnum>;

export const ProtocolAssignmentStatusEnum = z.enum([
  "pending",
  "completed",
  "expired",
]);
export type ProtocolAssignmentStatus = z.infer<
  typeof ProtocolAssignmentStatusEnum
>;

export const SeasonTypeEnum = z.enum([
  "default",
  "calendar",
  "focus",
  "cycle",
  "custom",
]);
export type SeasonType = z.infer<typeof SeasonTypeEnum>;

export const SeasonStatusEnum = z.enum(["draft", "active", "archived"]);
export type SeasonStatus = z.infer<typeof SeasonStatusEnum>;

export const SessionStatusEnum = z.enum([
  "upcoming",
  "active",
  "pending_signoff",
  "closed",
  "missed",
]);
export type SessionStatus = z.infer<typeof SessionStatusEnum>;

export const TaskStatusEnum = z.enum([
  "pending",
  "available",
  "in_progress",
  "completed",
  "skipped",
  "overdue",
  "escalated",
]);
export type TaskStatus = z.infer<typeof TaskStatusEnum>;

export const HookTypeEnum = z.enum([
  "pre_open",
  "open",
  "scheduled",
  "pre_close",
  "close",
  "custom",
]);
export type HookType = z.infer<typeof HookTypeEnum>;

export const InviteStatusEnum = z.enum([
  "pending",
  "accepted",
  "expired",
  "cancelled",
]);
export type InviteStatus = z.infer<typeof InviteStatusEnum>;

export const DayCategoryEnum = z.enum([
  "morning",
  "midday",
  "afternoon",
  "evening",
  "night",
  "weekend",
]);
export type DayCategory = z.infer<typeof DayCategoryEnum>;

export const IndustryEnum = z.enum([
  "restaurant",
  "hotel",
  "cafe",
  "bar",
  "catering",
  "other",
]);
export type Industry = z.infer<typeof IndustryEnum>;

export const AuthProviderEnum = z.enum(["supabase", "google", "microsoft"]);
export type AuthProvider = z.infer<typeof AuthProviderEnum>;

export const PreferredLanguageEnum = z.enum(["no", "sv", "en", "da", "fi"]);
export type PreferredLanguage = z.infer<typeof PreferredLanguageEnum>;

export const CurrencyEnum = z.enum(["NOK", "SEK", "DKK", "EUR"]);
export type Currency = z.infer<typeof CurrencyEnum>;

export const CountryEnum = z.enum(["NO", "SE", "DK", "FI"]);
export type Country = z.infer<typeof CountryEnum>;

export const CompanyMemberRoleEnum = z.enum(["owner", "admin", "member"]);
export type CompanyMemberRole = z.infer<typeof CompanyMemberRoleEnum>;

export const LocationTypeEnum = z.enum([
  "main",
  "outdoor",
  "kitchen",
  "event",
  "storage",
  "other",
]);
export type LocationType = z.infer<typeof LocationTypeEnum>;

export const TeamTypeEnum = z.enum([
  "operational",
  "access",
  "cross_department",
  "seasonal",
  "custom",
]);
export type TeamType = z.infer<typeof TeamTypeEnum>;
