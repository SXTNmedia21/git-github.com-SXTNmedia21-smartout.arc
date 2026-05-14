"use client";

// DEAD-PIPE-2026-05-14: client tool not delivered to LLM yet; see HANDOFF-2026-05-14 + ADR-0327 (HarnessAdapter pending)

/**
 * use-notifications-tools.ts — Botsson tools for the /dashboard/notifications surface.
 *
 * Five tools: 2 read, 2 write, 1 nav.
 *   listNotifications    — list notifications with optional type filter
 *   getUnreadCount       — get total unread count
 *   markAsRead           — mark one notification as read by id
 *   markAllAsRead        — mark all notifications as read
 *   filterNotifications  — switch the active filter tab (client state only)
 *
 * Write tools delegate to the existing mutation hooks (useMarkAsRead,
 * useMarkAllAsRead) — no direct API calls, no gateAction. Mutations already
 * gate server-side via Supabase RLS (recipient_id = auth.uid()).
 *
 * dataRef pattern (same as use-activity-tools.ts) keeps definitions stable
 * while still reading live cache entries on every invocation.
 */

import { useEffect, useMemo, useRef } from "react";
import type {
  ClientToolDefinition,
  ClientToolImplementation,
  ClientToolKit,
} from "@smartout/agent-sdk";

/* ━━━ Types ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

export type NotificationRow = {
  id: string;
  title: string;
  body: string | null;
  icon_type: string;
  action_url: string | null;
  is_read: boolean;
  created_at: string;
};

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

export type NotificationsToolInput = {
  /** Flat list of all loaded notifications (all pages flattened). */
  notifications: NotificationRow[];
  /** Current unread count from useUnreadCount. */
  unreadCount: number;
  /** Currently active filter tab. */
  activeFilter: FilterId;
  /** Mutation: mark one notification as read. */
  markAsRead: (id: string) => void;
  /** Mutation: mark all notifications as read. */
  markAllAsRead: () => void;
  /** Client state setter: switch active filter. */
  setActiveFilter: (filter: FilterId) => void;
};

const VALID_FILTERS: FilterId[] = [
  "all",
  "unread",
  "shift",
  "chat",
  "task",
  "deviation",
  "approval",
  "training",
  "contract",
];

/* ━━━ Hook ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

export function useNotificationsTools(input: NotificationsToolInput): ClientToolKit {
  const dataRef = useRef(input);
  useEffect(() => {
    dataRef.current = input;
  });

  const definitions = useMemo<ClientToolDefinition[]>(
    () => [
      {
        temporaryTool: {
          modelToolName: "listNotifications",
          description:
            "List notifications for the current user. Filter by type (all|unread|shift|chat|task|deviation|approval|training|contract). Use when manager asks 'hva har skjedd?' or 'hva har jeg gått glipp av?'.",
          dynamicParameters: [
            {
              name: "filter",
              location: "PARAMETER_LOCATION_BODY" as const,
              schema: {
                type: "string",
                enum: [
                  "all",
                  "unread",
                  "shift",
                  "chat",
                  "task",
                  "deviation",
                  "approval",
                  "training",
                  "contract",
                ],
                description:
                  "Notification type to filter by. Omit or use 'all' to return everything.",
              },
              required: false,
            },
          ],
          client: {},
        },
      },
      {
        temporaryTool: {
          modelToolName: "getUnreadCount",
          description:
            "Get count of unread notifications for the current user. Use when user asks 'hvor mange uleste har jeg?'.",
          dynamicParameters: [],
          client: {},
        },
      },
      {
        temporaryTool: {
          modelToolName: "markAsRead",
          description:
            "Mark one notification as read by id. Use when user confirms they've seen a specific notification.",
          dynamicParameters: [
            {
              name: "notificationId",
              location: "PARAMETER_LOCATION_BODY" as const,
              schema: {
                type: "string",
                description: "UUID of the notification to mark as read.",
              },
              required: true,
            },
          ],
          client: {},
        },
      },
      {
        temporaryTool: {
          modelToolName: "markAllAsRead",
          description:
            "Mark all notifications as read for the current user. Use when user says 'merk alle som lest'.",
          dynamicParameters: [],
          client: {},
        },
      },
      {
        temporaryTool: {
          modelToolName: "filterNotifications",
          description:
            "Switch the notification list filter (all|unread|shift|chat|task|deviation|approval|training|contract). Use when user says 'vis bare avvik' or 'vis uleste'.",
          dynamicParameters: [
            {
              name: "filter",
              location: "PARAMETER_LOCATION_BODY" as const,
              schema: {
                type: "string",
                enum: [
                  "all",
                  "unread",
                  "shift",
                  "chat",
                  "task",
                  "deviation",
                  "approval",
                  "training",
                  "contract",
                ],
                description: "The filter tab to activate.",
              },
              required: true,
            },
          ],
          client: {},
        },
      },
    ],
    [],
  );

  const implementations = useMemo<Record<string, ClientToolImplementation>>(
    () => ({
      listNotifications: (params: Record<string, unknown>) => {
        const d = dataRef.current;
        const filter = (params.filter as FilterId | undefined) ?? "all";
        let rows = d.notifications;

        if (filter === "unread") {
          rows = rows.filter((n) => !n.is_read);
        } else if (filter !== "all") {
          rows = rows.filter((n) => n.icon_type === filter);
        }

        return JSON.stringify({
          filter,
          total: rows.length,
          unreadCount: d.unreadCount,
          notifications: rows.map((n) => ({
            id: n.id,
            title: n.title,
            body: n.body,
            type: n.icon_type,
            actionUrl: n.action_url,
            isRead: n.is_read,
            createdAt: n.created_at,
          })),
        });
      },

      getUnreadCount: () => {
        const d = dataRef.current;
        return JSON.stringify({
          unreadCount: d.unreadCount,
          activeFilter: d.activeFilter,
        });
      },

      markAsRead: (params: Record<string, unknown>) => {
        const d = dataRef.current;
        const notificationId = params.notificationId as string | undefined;
        if (!notificationId) {
          return JSON.stringify({ ok: false, reason: "notificationId is required" });
        }
        const exists = d.notifications.find((n) => n.id === notificationId);
        if (!exists) {
          return JSON.stringify({ ok: false, reason: "Notification not found in current view" });
        }
        if (exists.is_read) {
          return JSON.stringify({ ok: true, alreadyRead: true });
        }
        d.markAsRead(notificationId);
        return JSON.stringify({ ok: true, notificationId });
      },

      markAllAsRead: () => {
        const d = dataRef.current;
        if (d.unreadCount === 0) {
          return JSON.stringify({ ok: true, alreadyAllRead: true });
        }
        d.markAllAsRead();
        return JSON.stringify({ ok: true, markedCount: d.unreadCount });
      },

      filterNotifications: (params: Record<string, unknown>) => {
        const d = dataRef.current;
        const filter = params.filter as FilterId | undefined;
        if (!filter || !VALID_FILTERS.includes(filter)) {
          return JSON.stringify({
            ok: false,
            reason: `Invalid filter '${String(filter)}'. Must be one of: ${VALID_FILTERS.join(", ")}`,
          });
        }
        d.setActiveFilter(filter);
        return JSON.stringify({ ok: true, filter });
      },
    }),
    [],
  );

  return useMemo(() => ({ definitions, implementations }), [definitions, implementations]);
}
