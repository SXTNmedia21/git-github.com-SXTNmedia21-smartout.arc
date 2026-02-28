import type { Profile } from "@smartout/types/src/identity";

const ROLE_HIERARCHY: Record<string, number> = {
  employee: 1,
  manager: 2,
  admin: 3,
  owner: 4,
};

export function hasMinimumRole(userRole: Profile["role"], requiredRole: Profile["role"]): boolean {
  if (!userRole || !requiredRole) return false;

  const userLevel = ROLE_HIERARCHY[userRole] ?? 0;
  const requiredLevel = ROLE_HIERARCHY[requiredRole] ?? 0;

  return userLevel >= requiredLevel;
}
