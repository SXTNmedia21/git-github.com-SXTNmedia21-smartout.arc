import { z } from "zod";

export const InviteChannelSchema = z.enum(["email", "sms", "link"]);
export type InviteChannel = z.infer<typeof InviteChannelSchema>;

export const InviteRoleSchema = z.enum(["admin", "manager", "employee", "owner"]);
export type InviteRole = z.infer<typeof InviteRoleSchema>;

export const InviteEmploymentTypeSchema = z.enum(["employee", "guest"]);
export type InviteEmploymentType = z.infer<typeof InviteEmploymentTypeSchema>;

export const InviteModeSchema = z.enum(["single", "csv"]);
export type InviteMode = z.infer<typeof InviteModeSchema>;

export type InviteRow = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  departmentId: string;
  role: Extract<InviteRole, "employee" | "manager" | "admin">;
  inviteEmploymentType: InviteEmploymentType;
  employeeGroupId: string;
  salary: string;
  startDate: string;
  contractTemplateId: string;
  extraData: Record<string, string>;
  errors: string[];
};

export type InviteDraft = {
  row: Omit<InviteRow, "id" | "errors">;
  channels: InviteChannel[];
};

export type InviteMetadata = {
  employee_group_id?: string;
  salary?: number;
  start_date?: string;
  contract_template_id?: string;
};

export type SingleInvitePayload = {
  workspace_id: string;
  invite_type: "link";
  channels: InviteChannel[];
  email?: string;
  phone?: string;
  role: InviteRow["role"];
  first_name: string;
  last_name: string;
  department_ids: string[];
  invite_employment_type: InviteEmploymentType;
  metadata?: InviteMetadata;
};

export type BulkInviteRow = {
  email: string;
  first_name: string;
  last_name: string;
  role: InviteRow["role"];
  department_ids: string[];
  invite_employment_type: InviteEmploymentType;
  metadata?: InviteMetadata;
};

export type BulkInvitePayload = {
  workspace_id: string;
  company_id: string | null;
  invites: BulkInviteRow[];
  skip_dispatch: boolean;
};

export type SingleInviteResponse = {
  token?: string;
  [key: string]: unknown;
};

export type BulkInviteResponse = {
  dispatched?: number;
  failed?: number;
  count?: number;
  [key: string]: unknown;
};
