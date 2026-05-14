"use client";

/**
 * notifications-tools-bridge.tsx — registers Botsson tools for the
 * /dashboard/notifications surface.
 *
 * Why a bridge:
 *  - Keeps the page component clean from voice-tool registration.
 *  - Mounts only when data is ready (notifications array is non-null).
 *    Prevents tools returning empty state before the first fetch completes.
 *
 * Data sourcing:
 *  - Receives live data and mutation callbacks from the page via props.
 *    No duplicate fetch — the page already holds useNotifications +
 *    useUnreadCount results; this bridge just re-uses them.
 *
 * Lifecycle:
 *  - useRegisterTools handles register/unregister automatically on mount/unmount.
 */

import { useRegisterTools } from "@/app/Botsson/_components/tool-registry";
import { useNotificationsTools, type NotificationRow } from "./use-notifications-tools";

type FilterId =
  | "all"
  | "unread"
  | "shift"
  | "chat"
  | "task"
  | "deviation"
  | "approval"
  | "training"
  | "contract";

type NotificationsToolsBridgeProps = {
  notifications: NotificationRow[];
  unreadCount: number;
  activeFilter: FilterId;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  setActiveFilter: (filter: FilterId) => void;
};

export function NotificationsToolsBridge({
  notifications,
  unreadCount,
  activeFilter,
  markAsRead,
  markAllAsRead,
  setActiveFilter,
}: NotificationsToolsBridgeProps) {
  const tools = useNotificationsTools({
    notifications,
    unreadCount,
    activeFilter,
    markAsRead,
    markAllAsRead,
    setActiveFilter,
  });

  useRegisterTools("notifications", tools);

  return null;
}
