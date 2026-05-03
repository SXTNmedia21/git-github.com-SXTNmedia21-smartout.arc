import type { InviteChannel, InviteRow } from "./types";

type CryptoLike = { randomUUID?: () => string };

export function createEmptyRow(): InviteRow {
  const c = (globalThis as { crypto?: CryptoLike }).crypto;
  const id = c && typeof c.randomUUID === "function" ? c.randomUUID() : fallbackId();
  return {
    id,
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    departmentId: "",
    role: "employee",
    inviteEmploymentType: "employee",
    employeeGroupId: "",
    salary: "",
    startDate: "",
    contractTemplateId: "",
    extraData: {},
    errors: [],
  };
}

function fallbackId(): string {
  return `inv-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateEmail(email: string): boolean {
  return EMAIL_REGEX.test(email);
}

export function isRowEmpty(row: InviteRow): boolean {
  return (
    !row.firstName.trim() &&
    !row.lastName.trim() &&
    !row.email.trim() &&
    !row.phone.trim() &&
    !row.departmentId &&
    !row.employeeGroupId &&
    !row.salary &&
    !row.startDate &&
    !row.contractTemplateId
  );
}

export function validateRow(row: InviteRow, channels: Set<InviteChannel>): string[] {
  const errors: string[] = [];
  if (!row.firstName.trim()) errors.push("Fornavn mangler");
  if (!row.lastName.trim()) errors.push("Etternavn mangler");

  if (channels.has("email")) {
    if (!row.email.trim()) errors.push("E-post mangler");
    else if (!validateEmail(row.email.trim())) errors.push("Ugyldig e-post");
  }
  if (channels.has("sms")) {
    if (!row.phone.trim()) errors.push("Telefonnummer mangler");
  }

  return errors;
}
