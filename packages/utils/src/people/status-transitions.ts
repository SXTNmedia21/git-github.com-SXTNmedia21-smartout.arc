import type { ProfileStatus } from "./types";

export const VALID_TRANSITIONS: Record<ProfileStatus, ProfileStatus[]> = {
  trainee: ["active", "offboarding"],
  active: ["inactive", "offboarding"],
  inactive: ["active", "offboarding"],
  offboarding: ["active"],
};

export function isValidTransition(from: ProfileStatus, to: ProfileStatus): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}
