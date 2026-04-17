/**
 * Shared deep link map — single source of truth for notification → screen routing.
 *
 * Used by both the backend (notification payload construction) and the mobile app
 * (push handler). Centralising here ensures the two sides never drift apart.
 */

export type NotificationType =
  | "shift_reminder"
  | "shift_published"
  | "shift_updated"
  | "shift_confirmation_reminder"
  | "shift_reminder_24h"
  | "shift_reminder_4h"
  | "shift_reminder_2h"
  | "shift_swap_initiated"
  | "shift_swap_approved"
  | "shift_swap_rejected"
  | "shift_swap_cancelled"
  | "chat_message"
  | "task_assigned"
  | "deviation_reported"
  | "hours_confirmation"
  | "absence_approved"
  | "komm_message"
  | "join_request"
  | "contract_sent"
  | "contract_signed"
  | "contract_declined"
  | "contract_expired"
  | "contract_reminder_due";

export type DeepLinkResolver = (data: Record<string, string>) => string;

export const DEEP_LINK_MAP: Record<NotificationType | "notification_tap", DeepLinkResolver> = {
  shift_reminder: (data) => `/(app)/(shifts)/${data.shift_id}`,
  shift_published: (data) => `/(app)/(shifts)/${data.shift_id}`,
  shift_updated: (data) => `/(app)/(shifts)/${data.shift_id}`,
  shift_confirmation_reminder: (data) => `/(app)/(shifts)/${data.shift_id}`,
  shift_reminder_24h: (data) => `/(app)/(shifts)/${data.shift_id}`,
  shift_reminder_4h: (data) => `/(app)/(shifts)/${data.shift_id}`,
  shift_reminder_2h: (data) => `/(app)/(shifts)/${data.shift_id}`,
  shift_swap_initiated: () => "/(app)/(shifts)",
  shift_swap_approved: () => "/(app)/(shifts)",
  shift_swap_rejected: () => "/(app)/(shifts)",
  shift_swap_cancelled: () => "/(app)/(shifts)",
  chat_message: (data) => `/(app)/(chat)/${data.conversation_id}`,
  task_assigned: () => "/(app)/(home)",
  deviation_reported: (data) => (data.deviation_id ? "/(app)/(home)/deviation" : "/(app)/(home)"),
  hours_confirmation: (data) => `/(app)/(shifts)/${data.shift_id}`,
  absence_approved: () => "/(app)/(me)/payroll/absence-balance",
  komm_message: (data) => `/(app)/(komm)/${data.channel_id}`,
  join_request: () => "/(app)/(home)",
  // Contract deep links
  contract_sent: (data) => `/(app)/(contracts)/${data.contract_id}`,
  contract_signed: (data) => `/(app)/(contracts)/${data.contract_id}`,
  contract_declined: () => "/(app)/(home)",
  contract_expired: (data) => `/(app)/(contracts)/${data.contract_id}`,
  contract_reminder_due: (data) => `/(app)/(contracts)/${data.contract_id}`,
  // Generic fallback — navigates to the notification centre
  notification_tap: () => "/(app)/(me)/notifications",
};

/**
 * Resolve a notification type to an Expo Router deep-link path.
 * Falls back to the notification list screen if the type is not in the map.
 */
export function resolveDeepLink(type: string, data: Record<string, string> = {}): string {
  const resolver = DEEP_LINK_MAP[type as NotificationType] ?? DEEP_LINK_MAP.notification_tap;
  return resolver(data);
}
