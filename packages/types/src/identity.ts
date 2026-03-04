import { z } from "zod";
import {
  ProfileRoleEnum,
  ProfileStatusEnum,
  AuthProviderEnum,
  PreferredLanguageEnum,
  CurrencyEnum,
  CountryEnum,
  CompanyMemberRoleEnum,
  IndustryEnum,
  InviteStatusEnum,
} from "./enums.js";

export const UserSchema = z.object({
  user_id: z.string().uuid(),
  email: z.string().email(),
  phone: z.string().nullish(),
  auth_provider: AuthProviderEnum,
  auth_provider_id: z.string().nullish(),
  first_name: z.string().min(1),
  last_name: z.string().min(1),
  preferred_language: PreferredLanguageEnum,
  date_of_birth: z.string().nullish(), // date string
  personal_email: z.string().email().nullish(),
  avatar_url: z.string().url().nullish(),
  timezone: z.string(),
  is_active: z.boolean().default(true),
  is_godmode: z.boolean().default(false),
  last_login_at: z.string().datetime().nullish(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime().nullish(),
});
export type User = z.infer<typeof UserSchema>;

export const CompanySchema = z.object({
  company_id: z.string().uuid(),
  name: z.string().min(1),
  legal_name: z.string().nullish(),
  org_number: z.string().min(1),
  country: CountryEnum,
  address_line_1: z.string().nullish(),
  address_line_2: z.string().nullish(),
  postal_code: z.string().nullish(),
  city: z.string().nullish(),
  phone: z.string().nullish(),
  email: z.string().nullish(),
  website: z.string().nullish(),
  logo_url: z.string().nullish(),
  industry: IndustryEnum,
  default_language: PreferredLanguageEnum,
  default_currency: CurrencyEnum,
  billing_email: z.string().nullish(),
  subscription_plan: z.string().nullish(),
  subscription_status: z.string().nullish(),
  trial_ends_at: z.string().datetime().nullish(),
  is_active: z.boolean().default(true),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime().nullish(),
});
export type Company = z.infer<typeof CompanySchema>;

export const CompanyMemberSchema = z.object({
  company_member_id: z.string().uuid(),
  user_id: z.string().uuid(),
  company_id: z.string().uuid(),
  role: CompanyMemberRoleEnum,
  title: z.string().nullish(),
  is_active: z.boolean().default(true),
  joined_at: z.string().datetime(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime().nullish(),
});
export type CompanyMember = z.infer<typeof CompanyMemberSchema>;

export const WorkspaceSchema = z.object({
  workspace_id: z.string().uuid(),
  company_id: z.string().uuid(),
  name: z.string().min(1),
  slug: z.string().min(1),
  description: z.string().nullish(),
  timezone: z.string(),
  currency: CurrencyEnum,
  language: PreferredLanguageEnum,
  country: CountryEnum,
  address_line_1: z.string().nullish(),
  address_line_2: z.string().nullish(),
  postal_code: z.string().nullish(),
  city: z.string().nullish(),
  phone: z.string().nullish(),
  email: z.string().nullish(),
  logo_url: z.string().nullish(),
  active_modules: z.array(z.string()).nullish(),
  max_profiles: z.number().int().nullish(),
  is_active: z.boolean().default(true),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime().nullish(),
});
export type Workspace = z.infer<typeof WorkspaceSchema>;

export const ProfileSchema = z.object({
  profile_id: z.string().uuid(),
  profile_code: z.string().min(1),
  user_id: z.string().uuid(),
  workspace_id: z.string().uuid(),
  company_id: z.string().uuid(),
  role: ProfileRoleEnum,
  status: ProfileStatusEnum,
  is_active: z.boolean().default(true),
  department_id: z.string().uuid().nullish(),
  departments: z.array(z.string().uuid()).nullish(),
  location_id: z.string().uuid().nullish(),
  locations: z.array(z.string().uuid()).nullish(),
  display_name: z.string().min(1),
  job_title: z.string().nullish(),
  employee_number: z.string().nullish(),
  avatar_url: z.string().nullish(),
  trainee_started: z.string().datetime().nullish(),
  trainee_completed: z.string().datetime().nullish(),
  emergency_contact_name: z.string().nullish(),
  emergency_contact_phone: z.string().nullish(),
  emergency_contact_relation: z.string().nullish(),
  notification_pref: z.record(z.boolean()).nullish(), // jsonb
  language_override: PreferredLanguageEnum.nullish(),
  joined_at: z.string().datetime(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime().nullish(),
});
export type Profile = z.infer<typeof ProfileSchema>;

export const InvitationSchema = z.object({
  invitation_id: z.string().uuid(),
  workspace_id: z.string().uuid(),
  company_id: z.string().uuid(),
  email: z.string().email(),
  first_name: z.string().nullish(),
  last_name: z.string().nullish(),
  role: ProfileRoleEnum,
  department_ids: z.array(z.string().uuid()).nullish(),
  team_ids: z.array(z.string().uuid()).nullish(),
  status: InviteStatusEnum,
  token: z.string().uuid(),
  invited_by: z.string().uuid().nullish(),
  expires_at: z.string().datetime(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime().nullish(),
});
export type Invitation = z.infer<typeof InvitationSchema>;
