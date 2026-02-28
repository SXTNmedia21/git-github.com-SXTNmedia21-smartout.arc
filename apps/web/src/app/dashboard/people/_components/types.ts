export type ProfileStatus = "active" | "inactive" | "trainee" | "offboarding";

export type ProfileRole = "owner" | "admin" | "manager" | "employee";

export type Employee = {
  id: string;
  name: string;
  email: string;
  role: string;
  department: string;
  departmentId: string | null;
  status: ProfileStatus | "invited";
  readinessScore?: number;
  avatar?: string;
  phone?: string;
  address?: string;
  personalNumber?: string;
  bankAccount?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  hasContract?: boolean;
  inviteStatus?: "pending" | "expired";
  inviteToken?: string;
  contactLog?: {
    id: string;
    type: string;
    channel: "email" | "sms";
    status: "sent" | "delivered" | "failed";
    date: string;
  }[];
};

export type Department = {
  department_id: string;
  name: string;
};
