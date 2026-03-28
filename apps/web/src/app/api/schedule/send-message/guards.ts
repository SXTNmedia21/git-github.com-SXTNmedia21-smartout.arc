// ============================================
// send-message guards
// Centralized authority checks for schedule send-message API.
// Why: route handlers should stay focused on orchestration, not role policy details.
// Connected to: schedule/send-message/route.ts
// ============================================

type ScheduleMessagingRole = "employee" | "manager" | "admin" | "owner" | (string & {});

const AUTHORIZED_SCHEDULE_MESSAGE_ROLES = new Set(["manager", "admin", "owner"]);

/**
 * Checks whether the caller can send schedule messages in a workspace.
 * Why: only leadership roles should trigger bulk operational communications.
 *
 * @param role - Membership role resolved from the workspace profile.
 * @returns True when role is manager/admin/owner, otherwise false.
 */
export function canSendScheduleMessage(role: ScheduleMessagingRole | null | undefined): boolean {
  if (!role) return false;
  return AUTHORIZED_SCHEDULE_MESSAGE_ROLES.has(role);
}
