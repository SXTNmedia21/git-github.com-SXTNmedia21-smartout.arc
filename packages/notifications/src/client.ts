/**
 * Client-safe exports from @smartout/notifications.
 *
 * Import from "@smartout/notifications/client" in browser/React components.
 * The main barrel ("@smartout/notifications") includes server-only modules
 * (SendGrid, Twilio) that cannot be bundled for the browser.
 */

// Event config registry (pure data, no server deps)
export { NOTIFICATION_EVENTS, getEventConfig, interpolateTemplate } from "./event-config";
export type { NotificationEventConfig } from "./event-config";

// Outbox helper (uses supabase client, browser-safe)
export { insertOutboxNotification } from "./outbox";

// Notification data hooks
export {
  useUnreadCount,
  useNotifications,
  useMarkAsRead,
  useMarkAllAsRead,
} from "./hooks/use-notifications";
export {
  useNotificationPreferences,
  useUpdateNotificationPreferences,
} from "./hooks/use-notification-preferences";
