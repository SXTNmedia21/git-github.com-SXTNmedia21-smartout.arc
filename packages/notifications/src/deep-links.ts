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
  | "chat_message"
  | "task_assigned"
  | "deviation_reported"
  | "hours_confirmation"
  | "absence_approved"
  | "komm_message"
  | "join_request";

export type DeepLinkResolver = (data: Record<string, string>) => string;

export const DEEP_LINK_MAP: Record<NotificationType | "notification_tap", DeepLinkResolver> = {
  shift_reminder: (data) => `/(app)/(shifts)/${data.shift_id}`,
  shift_published: (data) => `/(app)/(shifts)/${data.shift_id}`,
  shift_updated: (data) => `/(app)/(shifts)/${data.shift_id}`,
  chat_message: (data) => `/(app)/(chat)/${data.conversation_id}`,
  task_assigned: () => "/(app)/(home)",
  deviation_reported: (data) => (data.deviation_id ? "/(app)/(home)/deviation" : "/(app)/(home)"),
  hours_confirmation: (data) => `/(app)/(shifts)/${data.shift_id}`,
  absence_approved: () => "/(app)/(me)/absence-balance",
  komm_message: (data) => `/(app)/(komm)/${data.channel_id}`,
  join_request: () => "/(app)/(home)",
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
