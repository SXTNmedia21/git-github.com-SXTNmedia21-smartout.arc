---
title: "Notification System — Full Stack Design"
status: draft
updated: 2026-03-24
created: 2026-03-24
module: notifications
tags: [notifications, push, email, sms, realtime, digest, browser-notifications]
---

# Notification System — Full Stack Design

> Unified notification pipeline for Smartout. Connects engine-dispatch, DB triggers, and telemetry to push, email, SMS, in-app, and browser notifications. Config-driven event registry for zero-code extension.

## Background

The delivery infrastructure exists — mobile push (6 DB triggers, Expo, SMS fallback), SendGrid email (batch, webhooks, templates, suppression), Twilio SMS — but there is no glue layer. The `send_notification` handler in engine-dispatch is a console.log stub. No in-app notification UI exists. No unread count, no bell, no notification center.

**References:**

- `notification_outbox` + `notification_preference` tables (migration `00006_notification_engine.sql`)
- `send_notification` stub in `supabase/functions/engine-dispatch/index.ts` (lines 613-623)
- Telemetry `notifications` destination in `packages/telemetry/src/registry.ts`
- Mobile push: `apps/mobile/src/lib/push.ts`, `supabase/functions/push-dispatch/index.ts`
- SendGrid: `packages/notifications/src/sendgrid.ts`, `supabase/functions/sendgrid-webhook/index.ts`
- Twilio: `supabase/functions/_shared/twilio.ts`, `packages/notifications/src/sms-service.ts`
- Module 9 spec: `docs/modules/SMARTOUT_MODULE_9_COMMUNICATION.md`
- 6 existing push triggers: `20260418120000_push_dispatch_triggers.sql`

---

## Scope

### In scope

| #   | Feature                    | Description                                                                                                  |
| --- | -------------------------- | ------------------------------------------------------------------------------------------------------------ |
| 1   | **Outbox consumer**        | Edge Function that reads `notification_outbox`, applies preferences/quiet hours/grouping, routes to channels |
| 2   | **In-app notifications**   | `notification` table + Realtime, bell icon in header, popover, full notifications page                       |
| 3   | **Browser notifications**  | Notification API when tab is hidden, permission on first bell click                                          |
| 4   | **Preferences UI**         | Settings tab: channel toggles, category toggles, quiet hours                                                 |
| 5   | **Morning digest**         | Cron at 07:00 — queued notifications + pending actions, skip if empty                                        |
| 6   | **Smart grouping**         | Group similar events per recipient within 3 min window                                                       |
| 7   | **Event config registry**  | TypeScript config — new event = new config row, no code change                                               |
| 8   | **Refactor triggers**      | Existing 6 DB triggers route through outbox instead of direct push-dispatch                                  |
| 9   | **Engine-dispatch wiring** | `send_notification` handler INSERTs into outbox                                                              |
| 10  | **Telemetry wiring**       | `notifications` destination handler INSERTs into outbox                                                      |

### Not in scope

- Web push with service worker / VAPID (phase 2)
- Shift swap notifications
- Auto-geofence notifications
- Rich media in notifications (images, actions)
- Notification analytics dashboard

---

## Architecture

### Pipeline

```
Event Sources                 Outbox              Consumer             Delivery
--------------               ------              --------             --------
DB triggers (6) ──┐
                   ├──→ notification_outbox ──→ process-notifications ──→ Push (Expo)
engine-dispatch ──┤                                    │                  Email (SendGrid)
                   │                                    │                  SMS (Twilio)
telemetry emit()──┘                                    │                  In-app (notification table)
                                                       │                  Browser (Notification API)
                                                       │
                                                  Applies:
                                                  - notification_preference
                                                  - Quiet hours
                                                  - Smart grouping
                                                  - Priority routing
```

### Three inflows to outbox

1. **DB triggers** — Existing 6 triggers refactored from direct `push-dispatch` calls to INSERT into `notification_outbox`. The push-dispatch Edge Function becomes a delivery channel called by the consumer, not a trigger handler.
2. **engine-dispatch** — `send_notification` action handler INSERTs into `notification_outbox` with template data from `action_payload`.
3. **Telemetry** — `notifications` destination in the telemetry registry gets a handler that INSERTs into `notification_outbox`.

### Priority routing

| Priority | Value | Channels                    | Quiet hours                 |
| -------- | ----- | --------------------------- | --------------------------- |
| CRITICAL | 2     | Push + SMS + In-app + Email | Ignored — always immediate  |
| HIGH     | 1     | Push + In-app + Email       | Respected — queued to 07:00 |
| NORMAL   | 0     | Push + In-app               | Respected                   |
| LOW      | —     | In-app only                 | Respected                   |

---

## Database

### Existing tables (no changes)

- `notification_outbox` — sending queue with priority, allowed_channels, status lifecycle
- `notification_preference` — per-user channel toggles, quiet hours, timezone

### New table: `notification`

In-app notifications visible to users in the bell/notification center.

```sql
CREATE TABLE notification (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  uuid NOT NULL REFERENCES workspace(id),
  recipient_id  uuid NOT NULL REFERENCES profile(id),
  group_key     text,
  title         text NOT NULL,
  body          text,
  action_url    text,
  icon_type     text NOT NULL DEFAULT 'info',
  is_read       boolean NOT NULL DEFAULT false,
  read_at       timestamptz,
  metadata      jsonb,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_notification_recipient_unread
  ON notification(recipient_id, created_at DESC)
  WHERE is_read = false;

CREATE INDEX idx_notification_group
  ON notification(recipient_id, group_key, created_at DESC)
  WHERE group_key IS NOT NULL;

ALTER TABLE notification ENABLE ROW LEVEL SECURITY;

-- JWT policy
CREATE POLICY "Users read own notifications" ON notification
  FOR SELECT USING (
    recipient_id IN (
      SELECT id FROM profile
      WHERE workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
    )
  );

-- Users can mark their own notifications as read
CREATE POLICY "Users update own notifications" ON notification
  FOR UPDATE USING (
    recipient_id IN (
      SELECT id FROM profile
      WHERE workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
    )
  )
  WITH CHECK (
    recipient_id IN (
      SELECT id FROM profile
      WHERE workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
    )
  );

-- API key policy
CREATE POLICY "api_key_read_notification" ON notification
  FOR SELECT USING (workspace_id = get_api_workspace_id());

-- Service role inserts
CREATE POLICY "Service inserts notifications" ON notification
  FOR INSERT WITH CHECK (true);
```

Realtime enabled on this table for INSERT events.

### Smart grouping via `group_key`

The outbox consumer checks: is there an unread `notification` with the same `group_key` for this recipient within the last 3 minutes?

- **Yes** — UPDATE existing notification (body = "8 nye meldinger i #kjokken", metadata.count++). No new push sent.
- **No** — INSERT new notification + dispatch to channels.

### `icon_type` values

`info` | `shift` | `chat` | `task` | `deviation` | `approval` | `training`

Plain text for flexibility — no enum, new types added freely.

---

## Outbox Consumer — `process-notifications` Edge Function

### Trigger mechanism

- **pg_cron every 30 seconds** for normal processing
- **pg_notify trigger on INSERT** for CRITICAL (priority=2) — calls Edge Function immediately

### Processing flow

```
1. SELECT * FROM notification_outbox
   WHERE status = 'pending' AND scheduled_for <= now()
   ORDER BY priority DESC, created_at ASC
   LIMIT 100
   FOR UPDATE SKIP LOCKED

2. Per recipient batch:
   a. Fetch notification_preference
   b. Quiet hours check:
      - If non-critical AND within quiet hours:
        UPDATE scheduled_for = next 07:00, SKIP
   c. Group check:
      - Same group_key within 3 min? → merge into existing notification
      - Otherwise → INSERT new notification row
   d. Route to channels based on priority + preferences + allowed_channels:
      - push: call push-dispatch Edge Function
      - email: call SendGrid via packages/notifications
      - sms: call Twilio via _shared/twilio.ts (CRITICAL only)
      - in_app: already handled by notification INSERT
      - browser: handled client-side via Realtime subscription
   e. UPDATE outbox SET status = 'delivered'/'failed', processed_at = now()
```

### Error handling

- Delivery failure → `status = 'failed'`, `error_log` populated, retry on next cron run (max 3 attempts)
- Stale rows (pending > 24 hours) → `status = 'suppressed'`

### Auth

`PROCESS_NOTIFICATIONS_SECRET` bearer token (cron-only pattern, matching guardian-watchdog).

---

## Web UI

### Bell in DashboardShell header

- Placement: left of profile avatar in topbar
- Icon: Lucide `Bell`
- Unread badge: pulsating red dot with count, spring animation (stiffness 35, damping 22, mass 2) per "Ren og Varm" motion spec
- Click opens shadcn Popover below bell

### Popover (dropdown)

- Shows last 8 notifications
- Each row: icon (per `icon_type`) + title + relative time ("2 min siden") + unread dot
- Click row → mark as read + navigate to `action_url`
- "Marker alle som lest" button at top
- "Se alle varsler" link at bottom → `/dashboard/notifications`
- Entry animation: fade + slide down (250ms spring)
- Exit: fade out (150ms)

### `/dashboard/notifications` page

- Full notification list with infinite scroll
- Filters: Alle | Uleste | Per category (shift, chat, task, deviation, approval, training)
- Grouped notifications expandable (8 chat messages → show all)
- Bulk "mark as read" per day/category
- Empty state: illustration + "Ingen varsler enna"

### Realtime subscription

```typescript
supabase
  .channel(`notifications:${profileId}`)
  .on(
    "postgres_changes",
    {
      event: "INSERT",
      schema: "public",
      table: "notification",
      filter: `recipient_id=eq.${profileId}`,
    },
    (payload) => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["unread-count"] });

      // Browser notification if tab is hidden
      if (document.hidden && Notification.permission === "granted") {
        new Notification(payload.new.title, {
          body: payload.new.body,
          icon: "/icon-192.png",
        });
      }
    },
  )
  .subscribe();
```

### Browser Notification API

- Permission requested on first bell click (not automatic)
- Fires only when `document.hidden === true` (tab not active)
- Uses `Notification` constructor — no service worker needed
- Title + body from `notification` row, app icon

### Data hooks (in `packages/` for mobile parity)

- `useNotifications(profileId)` — paginated list with TanStack Query
- `useUnreadCount(profileId)` — unread badge count
- `useMarkAsRead()` — mutation for single/bulk mark as read
- `useNotificationPreferences(userId)` — read/write preferences

---

## Preferences UI

### Location

Replaces the existing "Notifications" placeholder tab in `/dashboard/settings`.

### Three sections

**1. Channels**

| Setting         | Default | Description                              |
| --------------- | ------- | ---------------------------------------- |
| Push-varsler    | On      | Mobile push via Expo                     |
| E-post          | On      | Transactional notifications              |
| SMS             | Off     | CRITICAL only (costs money)              |
| Browser-varsler | Off     | Requires permission, activates on toggle |

**2. Categories (per `notification_mode`)**

| Category               | Examples                             | Default |
| ---------------------- | ------------------------------------ | ------- |
| Arbeid (work)          | Shifts, tasks, deviations, approvals | On      |
| Opplaering (training)  | Protocols, tests, deadlines          | On      |
| Fellesskap (community) | Chat, messages, announcements        | On      |

Each category has on/off toggle. Off = no push/email for that category. In-app notifications always created (cannot be disabled).

**3. Quiet hours**

- Start/end time pickers (default 22:00-07:00)
- Timezone selector (default Europe/Oslo, auto-detect from browser)
- "CRITICAL varsler leveres alltid" disclaimer text

### Admin override

Workspace admins can set minimum notification priority per event type in workspace settings (e.g., "avvik er alltid CRITICAL" regardless of user preference). Stored in workspace config jsonb or a future `workspace_notification_override` table.

---

## Morning Digest

### Edge Function: `send-morning-digest`

- **Trigger:** pg_cron at 07:00 Europe/Oslo daily
- **Auth:** `MORNING_DIGEST_SECRET` bearer token

### Processing flow

```
1. SELECT DISTINCT recipient_id FROM notification
   WHERE is_read = false
   AND created_at > now() - interval '24 hours'

2. Per recipient:
   a. Fetch unread notifications (grouped by category)
   b. Fetch pending actions:
      - Unhandled shift approvals
      - Incomplete protocols near deadline
      - Open deviations assigned to them
   c. If no content → skip, no email
   d. Build email via SendGrid dynamic template:
      - Section: "Varsler du har gatt glipp av" (unread notifications)
      - Section: "Venter pa deg" (pending actions)
   e. Send via sendDynamicTemplateBatch()
   f. Mark digest as sent (prevent duplicate next run)
```

### Template

SendGrid dynamic template with sections. Norwegian copy. Clean, scannable layout matching "Ren og Varm" email style. Each item is clickable with `action_url`.

---

## Event Config Registry

### Location

`packages/notifications/src/event-config.ts`

### Type definition

```typescript
type NotificationEventConfig = {
  event_key: string;
  mode: "training" | "work" | "community";
  default_priority: 0 | 1 | 2;
  group_key_template: string | null;
  title_template: string;
  body_template: string;
  action_url_template: string;
  icon_type: string;
  allowed_channels: ("push" | "email" | "sms" | "in_app")[];
  grouping_window_sec: number;
  admin_overridable: boolean;
};
```

### MVP events

| event_key            | mode      | priority | group_key                      | icon      | channels                 |
| -------------------- | --------- | -------- | ------------------------------ | --------- | ------------------------ |
| `shift.published`    | work      | 1        | `shift:{department_id}:{date}` | shift     | push, email, in_app      |
| `shift.updated`      | work      | 1        | `shift:{department_id}:{date}` | shift     | push, email, in_app      |
| `task.assigned`      | work      | 0        | `task:{session_id}`            | task      | push, in_app             |
| `chat.message`       | community | 0        | `chat:{channel_id}`            | chat      | push, in_app             |
| `deviation.reported` | work      | 2        | null                           | deviation | push, sms, email, in_app |
| `join.request`       | work      | 1        | null                           | info      | push, email, in_app      |
| `protocol.assigned`  | training  | 0        | null                           | training  | push, email, in_app      |
| `approval.pending`   | work      | 1        | null                           | approval  | push, email, in_app      |
| `training.deadline`  | training  | 1        | null                           | training  | push, email, in_app      |
| `session.hook`       | work      | 0        | `hook:{session_id}`            | task      | push, in_app             |

### Template interpolation

Templates use `{variable}` syntax. Variables resolved from `notification_outbox.metadata` jsonb at processing time.

Example: `title_template: "Ny vakt {date} kl {start_time}"` + metadata `{ "date": "2026-03-25", "start_time": "16:00" }` → "Ny vakt 2026-03-25 kl 16:00"

### Extension

Adding a new notification type requires only a new entry in this registry. No code changes to the consumer, no new triggers, no new handlers. The outbox consumer matches `event_key` from outbox metadata to the registry and applies the config.

---

## DB Trigger Refactor

### Current state

6 triggers in `20260418120000_push_dispatch_triggers.sql` call `push-dispatch` directly via `net.http_post`.

### Target state

Same 6 triggers refactored to INSERT into `notification_outbox` instead. The `process-notifications` consumer then calls `push-dispatch` as a delivery channel.

```sql
-- Example: shift.published trigger (after refactor)
CREATE OR REPLACE FUNCTION dispatch_shift_published_notification()
RETURNS trigger AS $$
BEGIN
  INSERT INTO notification_outbox (
    workspace_id,
    recipient_id,
    mode,
    priority,
    title,
    body,
    action_url,
    metadata,
    allowed_channels
  ) VALUES (
    NEW.workspace_id,
    NEW.employee_id,
    'work',
    1,
    'Ny vakt publisert',
    format('Du har fatt en vakt %s kl %s', NEW.shift_date, NEW.start_time),
    format('/dashboard/my-schedule?date=%s', NEW.shift_date),
    jsonb_build_object(
      'event_key', 'shift.published',
      'department_id', NEW.department_id,
      'date', NEW.shift_date,
      'start_time', NEW.start_time,
      'shift_id', NEW.id
    ),
    ARRAY['push', 'email', 'in_app']::notification_channel[]
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### Migration strategy

Single migration that:

1. Drops old trigger functions (direct push-dispatch)
2. Creates new trigger functions (outbox INSERT)
3. Replaces triggers on same tables/events

---

## Implementation notes

### Files to create

| File                                                                          | Purpose                                                       |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------- |
| `supabase/migrations/YYYYMMDDHHMMSS_notification_table.sql`                   | `notification` table, indexes, RLS                            |
| `supabase/migrations/YYYYMMDDHHMMSS_refactor_push_triggers.sql`               | Refactor 6 triggers to outbox                                 |
| `supabase/functions/process-notifications/index.ts`                           | Outbox consumer Edge Function                                 |
| `supabase/functions/send-morning-digest/index.ts`                             | Morning digest Edge Function                                  |
| `packages/notifications/src/event-config.ts`                                  | Event config registry                                         |
| `packages/notifications/src/outbox.ts`                                        | Outbox INSERT helpers (shared by triggers, engine, telemetry) |
| `apps/web/src/components/dashboard/NotificationBell.tsx`                      | Bell icon + popover                                           |
| `apps/web/src/app/dashboard/notifications/page.tsx`                           | Full notifications page                                       |
| `apps/web/src/hooks/use-notifications.ts`                                     | Data hooks (useNotifications, useUnreadCount, useMarkAsRead)  |
| `apps/web/src/hooks/use-notification-realtime.ts`                             | Realtime subscription + browser notifications                 |
| `apps/web/src/app/dashboard/settings/_components/NotificationPreferences.tsx` | Preferences UI                                                |

### Files to modify

| File                                                                | Change                                                                        |
| ------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `supabase/functions/engine-dispatch/index.ts`                       | Replace console.log stub with outbox INSERT                                   |
| `packages/telemetry/src/registry.ts`                                | Wire `notifications` destination handler                                      |
| `apps/web/src/components/dashboard/DashboardShell.tsx`              | Add NotificationBell to header                                                |
| `supabase/functions/config.toml`                                    | Add `process-notifications` + `send-morning-digest` with `verify_jwt = false` |
| `apps/web/src/app/dashboard/settings/_components/settings-tabs.tsx` | Replace Notifications placeholder                                             |

### Mobile parity

Data hooks (`useNotifications`, `useUnreadCount`, `useMarkAsRead`) placed in `packages/` or as shared hooks importable by both web and mobile. Mobile notification center UI is a follow-up PR but the data layer supports it from day one.

---

## Not in scope (phase 2)

- Web push with service worker / VAPID keys
- Notification analytics (delivery rates, open rates)
- Rich notifications (images, action buttons in push)
- Shift swap notification events
- Auto-geofence notifications
- Per-notification snooze / remind later
