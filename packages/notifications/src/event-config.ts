/**
 * Event Config Registry — maps every notification event_key to its static config.
 * This is the single source of truth for how each notification type behaves:
 * priority, allowed channels, grouping window, i18n keys, and action URLs.
 */

export type NotificationEventConfig = {
  event_key: string;
  mode: "training" | "work" | "community";
  default_priority: 0 | 1 | 2;
  group_key_template: string | null;
  title_key: string;
  body_key: string;
  action_url_template: string;
  icon_type: string;
  allowed_channels: ("push" | "email" | "sms" | "in_app")[];
  grouping_window_sec: number;
  admin_overridable: boolean;
};

export const NOTIFICATION_EVENTS: Record<string, NotificationEventConfig> = {
  "shift.published": {
    event_key: "shift.published",
    mode: "work",
    default_priority: 1,
    group_key_template: "shift:{department_id}:{date}",
    title_key: "notifications.shift.published.title",
    body_key: "notifications.shift.published.body",
    action_url_template: "/dashboard/my-schedule?date={date}",
    icon_type: "shift",
    allowed_channels: ["push", "email", "in_app"],
    grouping_window_sec: 180,
    admin_overridable: true,
  },
  "shift.updated": {
    event_key: "shift.updated",
    mode: "work",
    default_priority: 1,
    group_key_template: "shift:{department_id}:{date}",
    title_key: "notifications.shift.updated.title",
    body_key: "notifications.shift.updated.body",
    action_url_template: "/dashboard/my-schedule?date={date}",
    icon_type: "shift",
    allowed_channels: ["push", "email", "in_app"],
    grouping_window_sec: 180,
    admin_overridable: true,
  },
  "task.assigned": {
    event_key: "task.assigned",
    mode: "work",
    default_priority: 0,
    group_key_template: "task:{session_id}",
    title_key: "notifications.task.assigned.title",
    body_key: "notifications.task.assigned.body",
    action_url_template: "/dashboard",
    icon_type: "task",
    allowed_channels: ["push", "in_app"],
    grouping_window_sec: 180,
    admin_overridable: false,
  },
  "chat.message": {
    event_key: "chat.message",
    mode: "community",
    default_priority: 0,
    group_key_template: "chat:{channel_id}",
    title_key: "notifications.chat.message.title",
    body_key: "notifications.chat.message.body",
    action_url_template: "/dashboard/komm/{channel_id}",
    icon_type: "chat",
    allowed_channels: ["push", "in_app"],
    grouping_window_sec: 180,
    admin_overridable: false,
  },
  "deviation.reported": {
    event_key: "deviation.reported",
    mode: "work",
    default_priority: 2,
    group_key_template: null,
    title_key: "notifications.deviation.reported.title",
    body_key: "notifications.deviation.reported.body",
    action_url_template: "/dashboard/operations",
    icon_type: "deviation",
    allowed_channels: ["push", "sms", "email", "in_app"],
    grouping_window_sec: 0,
    admin_overridable: true,
  },
  "join.request": {
    event_key: "join.request",
    mode: "work",
    default_priority: 1,
    group_key_template: null,
    title_key: "notifications.join.request.title",
    body_key: "notifications.join.request.body",
    action_url_template: "/dashboard/people",
    icon_type: "info",
    allowed_channels: ["push", "email", "in_app"],
    grouping_window_sec: 0,
    admin_overridable: false,
  },
  "protocol.assigned": {
    event_key: "protocol.assigned",
    mode: "training",
    default_priority: 0,
    group_key_template: null,
    title_key: "notifications.protocol.assigned.title",
    body_key: "notifications.protocol.assigned.body",
    action_url_template: "/dashboard/my-training",
    icon_type: "training",
    allowed_channels: ["push", "email", "in_app"],
    grouping_window_sec: 0,
    admin_overridable: false,
  },
  "approval.pending": {
    event_key: "approval.pending",
    mode: "work",
    default_priority: 1,
    group_key_template: null,
    title_key: "notifications.approval.pending.title",
    body_key: "notifications.approval.pending.body",
    action_url_template: "/dashboard/reconciliation",
    icon_type: "approval",
    allowed_channels: ["push", "email", "in_app"],
    grouping_window_sec: 0,
    admin_overridable: true,
  },
  "training.deadline": {
    event_key: "training.deadline",
    mode: "training",
    default_priority: 1,
    group_key_template: null,
    title_key: "notifications.training.deadline.title",
    body_key: "notifications.training.deadline.body",
    action_url_template: "/dashboard/my-training",
    icon_type: "training",
    allowed_channels: ["push", "email", "in_app"],
    grouping_window_sec: 0,
    admin_overridable: true,
  },
  "session.hook": {
    event_key: "session.hook",
    mode: "work",
    default_priority: 0,
    group_key_template: "hook:{session_id}",
    title_key: "notifications.session.hook.title",
    body_key: "notifications.session.hook.body",
    action_url_template: "/dashboard/operations",
    icon_type: "task",
    allowed_channels: ["push", "in_app"],
    grouping_window_sec: 180,
    admin_overridable: false,
  },
};

export function getEventConfig(eventKey: string): NotificationEventConfig | undefined {
  return NOTIFICATION_EVENTS[eventKey];
}

/** Interpolate {variable} placeholders with values from metadata */
export function interpolateTemplate(template: string, metadata: Record<string, unknown>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => String(metadata[key] ?? `{${key}}`));
}
