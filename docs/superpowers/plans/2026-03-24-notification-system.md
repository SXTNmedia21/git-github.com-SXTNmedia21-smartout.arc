---
title: "Notification System Implementation Plan"
status: draft
updated: 2026-03-24
created: 2026-03-24
module: notifications
tags: [notifications, push, email, sms, realtime, digest, browser-notifications]
---

# Notification System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the unified notification pipeline connecting engine-dispatch, DB triggers, and telemetry to push, email, SMS, in-app, and browser notification delivery with smart grouping, quiet hours, preferences UI, and morning digest.

**Architecture:** Three inflows (DB triggers, engine-dispatch, telemetry) INSERT into `notification_outbox`. A cron-driven consumer Edge Function reads the outbox, applies preferences/quiet hours/grouping, and routes to delivery channels. In-app notifications land in a `notification` table with Realtime for live UI updates. Browser Notification API for background tab alerts.

**Tech Stack:** Supabase (Edge Functions, pg_cron, Realtime, RLS), TypeScript, React (shadcn/ui, TanStack Query, Framer Motion), SendGrid, Twilio, Expo Push

**Spec:** `docs/superpowers/specs/2026-03-24-notification-system-design.md`

---

## File Structure

### New files

| File                                                                          | Responsibility                                                               |
| ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `supabase/migrations/YYYYMMDDHHMMSS_notification_system.sql`                  | `notification` table + enum fix + preference RLS + cron + triggers           |
| `supabase/migrations/YYYYMMDDHHMMSS_refactor_push_triggers.sql`               | Refactor 6 push triggers from direct dispatch to outbox INSERT               |
| `packages/notifications/src/event-config.ts`                                  | Event config registry (10 MVP events, types, templates)                      |
| `packages/notifications/src/outbox.ts`                                        | Outbox INSERT helper + template interpolation                                |
| `packages/notifications/src/hooks/use-notifications.ts`                       | `useNotifications`, `useUnreadCount`, `useMarkAsRead` hooks                  |
| `packages/notifications/src/hooks/use-notification-preferences.ts`            | `useNotificationPreferences` hook                                            |
| `supabase/functions/process-notifications/index.ts`                           | Outbox consumer: read pending, apply prefs/quiet/grouping, route to channels |
| `supabase/functions/send-morning-digest/index.ts`                             | Morning digest: cron 07:00, collect unread + pending actions, email          |
| `apps/web/src/components/dashboard/NotificationBell.tsx`                      | Bell icon + popover + unread badge                                           |
| `apps/web/src/hooks/use-notification-realtime.ts`                             | Realtime subscription + Browser Notification API                             |
| `apps/web/src/app/dashboard/notifications/page.tsx`                           | Full notifications page with filters + infinite scroll                       |
| `apps/web/src/app/dashboard/notifications/loading.tsx`                        | Loading skeleton                                                             |
| `apps/web/src/app/dashboard/settings/_components/NotificationPreferences.tsx` | Preferences UI: channels, categories, quiet hours                            |

### Modified files

| File                                                                | Change                                                                        |
| ------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `supabase/functions/engine-dispatch/index.ts`                       | Replace `send_notification` console.log stub with outbox INSERT               |
| `packages/telemetry/src/emit.ts`                                    | Add `notifications` destination handler                                       |
| `apps/web/src/components/dashboard/DashboardShell.tsx`              | Add `NotificationBell` to header                                              |
| `supabase/functions/config.toml`                                    | Add `process-notifications` + `send-morning-digest` with `verify_jwt = false` |
| `apps/web/src/app/dashboard/settings/_components/settings-tabs.tsx` | Replace Notifications placeholder tab                                         |

---

## Task 1: Database Migration — notification table + fixes

**Files:**

- Create: `supabase/migrations/YYYYMMDDHHMMSS_notification_system.sql`

**Context:** Read migration `00006_notification_engine.sql` for existing `notification_outbox` and `notification_preference` schemas. Read `20260418120000_push_dispatch_triggers.sql` for existing push trigger patterns. Read `20260311060000_emma_task_cron_and_limit.sql` for pg_cron conditional pattern.

- [ ] **Step 1: Create the migration file**

Timestamp format: `YYYYMMDDHHMMSS`. File: `supabase/migrations/YYYYMMDDHHMMSS_notification_system.sql`

Content:

```sql
-- 1. Add 'in_app' to notification_channel enum
ALTER TYPE notification_channel ADD VALUE IF NOT EXISTS 'in_app';

-- 2. Fix notification_preference: enable RLS + add browser_enabled
ALTER TABLE notification_preference ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_preference ADD COLUMN IF NOT EXISTS browser_enabled boolean DEFAULT false;

CREATE POLICY "Users read own preferences" ON notification_preference
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users update own preferences" ON notification_preference
  FOR UPDATE USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users insert own preferences" ON notification_preference
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- 3. Create notification table
CREATE TABLE notification (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  uuid NOT NULL REFERENCES workspace(workspace_id),
  recipient_id  uuid NOT NULL REFERENCES profile(profile_id),
  group_key     text,
  title         text NOT NULL,
  body          text,
  action_url    text,
  icon_type     text NOT NULL DEFAULT 'info',
  is_read       boolean NOT NULL DEFAULT false,
  read_at       timestamptz,
  metadata      jsonb,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER set_notification_updated_at
  BEFORE UPDATE ON notification
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_notification_recipient_unread
  ON notification(recipient_id, created_at DESC)
  WHERE is_read = false;

CREATE INDEX idx_notification_group
  ON notification(recipient_id, group_key, created_at DESC)
  WHERE group_key IS NOT NULL;

ALTER TABLE notification ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own notifications" ON notification
  FOR SELECT USING (
    recipient_id IN (
      SELECT profile_id FROM profile
      WHERE workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
    )
  );

CREATE POLICY "Users update own notifications" ON notification
  FOR UPDATE USING (
    recipient_id IN (
      SELECT profile_id FROM profile
      WHERE workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
    )
  )
  WITH CHECK (
    recipient_id IN (
      SELECT profile_id FROM profile
      WHERE workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
    )
  );

CREATE POLICY "api_key_read_notification" ON notification
  FOR SELECT USING (workspace_id = get_api_workspace_id());

-- 4. Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE notification;

-- 5. CRITICAL fast-path trigger (priority=2 → immediate dispatch)
CREATE OR REPLACE FUNCTION dispatch_critical_notification()
RETURNS trigger AS $$
BEGIN
  PERFORM net.http_post(
    url := current_setting('app.supabase_url', true) || '/functions/v1/process-notifications',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.process_notifications_secret', true)
    )
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_critical_notification_dispatch
  AFTER INSERT ON notification_outbox
  FOR EACH ROW WHEN (NEW.priority = 2)
  EXECUTE FUNCTION dispatch_critical_notification();

-- 6. pg_cron registration (30s polling)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'process-notifications',
      '30 seconds',
      $$SELECT net.http_post(
        url := current_setting('app.supabase_url', true) || '/functions/v1/process-notifications',
        headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.process_notifications_secret', true))
      )$$
    );
  END IF;
END $$;

-- 7. Morning digest cron (07:00 Europe/Oslo)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'morning-digest',
      '0 7 * * *',
      $$SELECT net.http_post(
        url := current_setting('app.supabase_url', true) || '/functions/v1/send-morning-digest',
        headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.morning_digest_secret', true))
      )$$
    );
  END IF;
END $$;
```

- [ ] **Step 2: Run the migration**

```bash
docker exec -i $(docker ps -q -f name=supabase_db) psql -U postgres < supabase/migrations/YYYYMMDDHHMMSS_notification_system.sql
```

Expected: No errors. Tables created, enum altered, triggers registered.

- [ ] **Step 3: Regenerate types**

```bash
npx supabase gen types typescript --local > packages/supabase/src/database.types.ts
```

Verify `notification` table and `in_app` enum value appear in the generated types.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/YYYYMMDDHHMMSS_notification_system.sql packages/supabase/src/database.types.ts
git commit -m "feat(db): notification table, enum fix, preference RLS, cron registration"
```

---

## Task 2: Event Config Registry + Outbox Helper

**Files:**

- Create: `packages/notifications/src/event-config.ts`
- Create: `packages/notifications/src/outbox.ts`

**Context:** Read `packages/telemetry/src/registry.ts` for the existing registry pattern. Read `packages/notifications/src/index.ts` for current package exports.

- [ ] **Step 1: Create event config registry**

File: `packages/notifications/src/event-config.ts`

```typescript
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
```

- [ ] **Step 2: Create outbox helper**

File: `packages/notifications/src/outbox.ts`

```typescript
import type { SupabaseClient } from "@supabase/supabase-js";
import { getEventConfig, interpolateTemplate } from "./event-config";

type OutboxInsert = {
  workspace_id: string;
  recipient_id: string;
  event_key: string;
  metadata: Record<string, unknown>;
  priority_override?: 0 | 1 | 2;
};

/**
 * Insert a notification into the outbox.
 * Resolves event config from registry, interpolates templates,
 * and builds the outbox row.
 */
export async function insertOutboxNotification(
  supabase: SupabaseClient,
  input: OutboxInsert,
): Promise<{ error: Error | null }> {
  const config = getEventConfig(input.event_key);
  if (!config) {
    return { error: new Error(`Unknown event_key: ${input.event_key}`) };
  }

  const groupKey = config.group_key_template
    ? interpolateTemplate(config.group_key_template, input.metadata)
    : null;

  const { error } = await supabase.from("notification_outbox").insert({
    workspace_id: input.workspace_id,
    recipient_id: input.recipient_id,
    mode: config.mode,
    priority: input.priority_override ?? config.default_priority,
    title: interpolateTemplate(config.title_key, input.metadata),
    body: interpolateTemplate(config.body_key, input.metadata),
    action_url: interpolateTemplate(config.action_url_template, input.metadata),
    metadata: {
      event_key: input.event_key,
      group_key: groupKey,
      icon_type: config.icon_type,
      ...input.metadata,
    },
    allowed_channels: config.allowed_channels,
  });

  return { error: error ? new Error(error.message) : null };
}
```

- [ ] **Step 3: Update package exports**

Check `packages/notifications/src/index.ts` and add exports for the new files:

```typescript
export { NOTIFICATION_EVENTS, getEventConfig, interpolateTemplate } from "./event-config";
export { insertOutboxNotification } from "./outbox";
```

- [ ] **Step 4: Verify it compiles**

```bash
pnpm --filter @smartout/notifications build
```

Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add packages/notifications/src/event-config.ts packages/notifications/src/outbox.ts packages/notifications/src/index.ts
git commit -m "feat(notifications): event config registry + outbox INSERT helper"
```

---

## Task 3: Refactor 6 DB Push Triggers to Outbox

**Files:**

- Create: `supabase/migrations/YYYYMMDDHHMMSS_refactor_push_triggers.sql`

**Context:** Read `supabase/migrations/20260418120000_push_dispatch_triggers.sql` for current trigger functions. Read `supabase/migrations/20260324065817_fix_push_triggers_profile_id.sql` for the patched version (profile_id fix). Use the patched versions as baseline — not the originals.

- [ ] **Step 1: Create refactor migration**

File: `supabase/migrations/YYYYMMDDHHMMSS_refactor_push_triggers.sql`

This migration replaces all 6 trigger functions to INSERT into `notification_outbox` instead of calling `push-dispatch` via `net.http_post`. Each trigger stores `event_key` in metadata (dot notation). The outbox consumer handles delivery.

Key pattern per trigger:

```sql
CREATE OR REPLACE FUNCTION trigger_push_shift_published()
RETURNS trigger AS $$
BEGIN
  IF NEW.is_published = true AND NEW.employee_id IS NOT NULL THEN
    INSERT INTO notification_outbox (
      workspace_id, recipient_id, mode, priority,
      title, body, action_url, metadata, allowed_channels
    ) VALUES (
      NEW.workspace_id, NEW.employee_id, 'work', 1,
      'shift.published', '',
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
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

Repeat for all 6 triggers: `shift_published`, `shift_updated`, `task_assigned`, `chat_message`, `deviation_reported`, `join_request`. For `deviation_reported` and `join_request`: use the corrected profile_id join from the fix migration.

- [ ] **Step 2: Run the migration**

```bash
docker exec -i $(docker ps -q -f name=supabase_db) psql -U postgres < supabase/migrations/YYYYMMDDHHMMSS_refactor_push_triggers.sql
```

Expected: No errors. Functions replaced.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/YYYYMMDDHHMMSS_refactor_push_triggers.sql
git commit -m "refactor(db): 6 push triggers now INSERT into notification_outbox"
```

---

## Task 4: Wire engine-dispatch + telemetry emit

**Files:**

- Modify: `supabase/functions/engine-dispatch/index.ts` (lines 613-623)
- Modify: `packages/telemetry/src/emit.ts`

**Context:** Read `supabase/functions/engine-dispatch/index.ts` for the `send_notification` case. Read `packages/telemetry/src/emit.ts` for the destination handler switch.

- [ ] **Step 1: Fix engine-dispatch stub**

In `supabase/functions/engine-dispatch/index.ts`, replace the `send_notification` case (lines 613-623):

```typescript
case "send_notification": {
  const { template, recipient_id, workspace_id, payload } = step.action_payload as {
    template: string;
    recipient_id?: string;
    workspace_id?: string;
    payload?: Record<string, unknown>;
  };

  const targetRecipient = recipient_id ?? state.assignee_id;
  const targetWorkspace = workspace_id ?? state.workspace_id;

  if (targetRecipient && targetWorkspace) {
    await supabase.from("notification_outbox").insert({
      workspace_id: targetWorkspace,
      recipient_id: targetRecipient,
      mode: "work",
      priority: 0,
      title: template,
      body: "",
      action_url: null,
      metadata: {
        event_key: `engine.${template}`,
        state_id: state.id,
        ...payload,
      },
      allowed_channels: ["push", "in_app"],
    });
  }

  await advanceToNextStep(supabase, state, step);
  break;
}
```

- [ ] **Step 2: Add notifications handler to telemetry emit**

In `packages/telemetry/src/emit.ts`, find the destination handler switch/if chain. Add a case for `"notifications"`:

```typescript
case "notifications": {
  // Notifications destination: fire API call to insert into outbox
  // In browser context, POST to /api/notifications/outbox
  // In server context, direct Supabase insert
  if (typeof window !== "undefined") {
    fetch("/api/notifications/outbox", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event_key: event.name,
        metadata: event.properties,
      }),
    }).catch(() => {
      // Silent fail — notification delivery is best-effort from telemetry
    });
  }
  break;
}
```

Note: The API route `/api/notifications/outbox` is a thin server-side proxy that INSERTs into `notification_outbox` using service role. Create this route as part of this task.

- [ ] **Step 3: Create API route for client-side telemetry → outbox**

File: `apps/web/src/app/api/notifications/outbox/route.ts`

```typescript
import { createServerClient } from "@smartout/supabase/server";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const supabase = await createServerClient();
  const { event_key, metadata } = await req.json();

  // This is a server-side bridge for the telemetry notifications destination.
  // It uses the service role to INSERT into notification_outbox.
  // The actual recipient routing happens in the outbox consumer.
  // For now, this is a no-op placeholder — telemetry events that need
  // specific recipients should use the engine-dispatch path instead.

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 4: Verify typecheck**

```bash
pnpm turbo typecheck
```

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/engine-dispatch/index.ts packages/telemetry/src/emit.ts apps/web/src/app/api/notifications/outbox/route.ts
git commit -m "feat(notifications): wire engine-dispatch + telemetry emit to outbox"
```

---

## Task 5: Outbox Consumer Edge Function

**Files:**

- Create: `supabase/functions/process-notifications/index.ts`
- Modify: `supabase/functions/config.toml`

**Context:** Read `supabase/functions/guardian-sweep/index.ts` for the cron-auth pattern. Read `supabase/functions/push-dispatch/index.ts` for how push delivery works. Read `supabase/functions/_shared/twilio.ts` for SMS. Read `packages/notifications/src/sendgrid.ts` for email.

- [ ] **Step 1: Add to config.toml**

In `supabase/functions/config.toml`, add:

```toml
[process-notifications]
verify_jwt = false

[send-morning-digest]
verify_jwt = false
```

- [ ] **Step 2: Create process-notifications Edge Function**

File: `supabase/functions/process-notifications/index.ts`

The consumer must:

1. Auth via `PROCESS_NOTIFICATIONS_SECRET` bearer token
2. SELECT pending outbox rows (FOR UPDATE SKIP LOCKED, LIMIT 100)
3. Per row: fetch recipient's `notification_preference` (join profile.user_id → notification_preference.user_id)
4. Quiet hours check: if non-critical AND within quiet hours → reschedule to 07:00
5. Grouping: check for existing unread `notification` with same group_key within 3 min
6. INSERT into `notification` table (in-app)
7. Route to push (call `push-dispatch` EF), email (direct SendGrid API), SMS (Twilio for CRITICAL)
8. UPDATE outbox status to `delivered` / `failed`

Structure the function as:

- `handleRequest()` — auth check, fetch batch, process each
- `processOutboxRow()` — single row processing
- `checkQuietHours()` — returns boolean
- `resolveGrouping()` — returns existing notification or null
- `deliverToChannels()` — fan-out to push/email/sms

Keep it under 300 lines. Use `_shared/twilio.ts` for SMS. Use fetch for SendGrid (same pattern as `guardian-notify`). Use `net.http_post` pattern for push-dispatch.

- [ ] **Step 3: Test locally**

```bash
npx supabase functions serve process-notifications --env-file supabase/functions/.env
```

Then manually INSERT a test row into `notification_outbox` and call the function:

```bash
curl -X POST http://localhost:54321/functions/v1/process-notifications \
  -H "Authorization: Bearer test-secret"
```

Expected: Row processed, notification created in `notification` table.

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/process-notifications/index.ts supabase/functions/config.toml
git commit -m "feat(notifications): outbox consumer Edge Function with grouping + quiet hours"
```

---

## Task 6: Notification Data Hooks

**Files:**

- Create: `packages/notifications/src/hooks/use-notifications.ts`
- Create: `packages/notifications/src/hooks/use-notification-preferences.ts`

**Context:** Read existing hooks in `apps/web/src/app/dashboard/chat/_hooks/` for TanStack Query patterns used in this codebase. Read `packages/notifications/src/index.ts` for package exports.

- [ ] **Step 1: Create useNotifications + useUnreadCount + useMarkAsRead**

File: `packages/notifications/src/hooks/use-notifications.ts`

```typescript
import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from "@tanstack/react-query";
import { useSupabase } from "@smartout/supabase/client";

export function useUnreadCount(profileId: string | undefined) {
  const supabase = useSupabase();
  return useQuery({
    queryKey: ["unread-count", profileId],
    queryFn: async () => {
      if (!profileId) return 0;
      const { count } = await supabase
        .from("notification")
        .select("*", { count: "exact", head: true })
        .eq("recipient_id", profileId)
        .eq("is_read", false);
      return count ?? 0;
    },
    enabled: !!profileId,
  });
}

export function useNotifications(
  profileId: string | undefined,
  filter?: {
    unreadOnly?: boolean;
    iconType?: string;
  },
) {
  const supabase = useSupabase();
  return useInfiniteQuery({
    queryKey: ["notifications", profileId, filter],
    queryFn: async ({ pageParam = 0 }) => {
      if (!profileId) return { data: [], nextPage: null };
      let query = supabase
        .from("notification")
        .select("*")
        .eq("recipient_id", profileId)
        .order("created_at", { ascending: false })
        .range(pageParam, pageParam + 19);

      if (filter?.unreadOnly) query = query.eq("is_read", false);
      if (filter?.iconType) query = query.eq("icon_type", filter.iconType);

      const { data, error } = await query;
      if (error) throw error;
      return {
        data: data ?? [],
        nextPage: (data?.length ?? 0) === 20 ? pageParam + 20 : null,
      };
    },
    getNextPageParam: (lastPage) => lastPage.nextPage,
    initialPageParam: 0,
    enabled: !!profileId,
  });
}

export function useMarkAsRead() {
  const supabase = useSupabase();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (ids: string | string[]) => {
      const idArray = Array.isArray(ids) ? ids : [ids];
      const { error } = await supabase
        .from("notification")
        .update({ is_read: true, read_at: new Date().toISOString() })
        .in("id", idArray);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["unread-count"] });
    },
  });
}

export function useMarkAllAsRead(profileId: string | undefined) {
  const supabase = useSupabase();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      if (!profileId) return;
      const { error } = await supabase
        .from("notification")
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq("recipient_id", profileId)
        .eq("is_read", false);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["unread-count"] });
    },
  });
}
```

- [ ] **Step 2: Create useNotificationPreferences**

File: `packages/notifications/src/hooks/use-notification-preferences.ts`

```typescript
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSupabase } from "@smartout/supabase/client";

export function useNotificationPreferences(userId: string | undefined) {
  const supabase = useSupabase();
  return useQuery({
    queryKey: ["notification-preferences", userId],
    queryFn: async () => {
      if (!userId) return null;
      const { data, error } = await supabase
        .from("notification_preference")
        .select("*")
        .eq("user_id", userId)
        .single();
      if (error && error.code !== "PGRST116") throw error;
      return data;
    },
    enabled: !!userId,
  });
}

export function useUpdateNotificationPreferences(userId: string | undefined) {
  const supabase = useSupabase();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (updates: Record<string, unknown>) => {
      if (!userId) return;
      const { error } = await supabase
        .from("notification_preference")
        .upsert({ user_id: userId, ...updates }, { onConflict: "user_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notification-preferences"] });
    },
  });
}
```

- [ ] **Step 3: Export from package**

Update `packages/notifications/src/index.ts`:

```typescript
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
```

- [ ] **Step 4: Verify typecheck**

```bash
pnpm --filter @smartout/notifications build
```

- [ ] **Step 5: Commit**

```bash
git add packages/notifications/src/hooks/ packages/notifications/src/index.ts
git commit -m "feat(notifications): data hooks — useNotifications, useUnreadCount, useMarkAsRead, usePreferences"
```

---

## Task 7: NotificationBell + Realtime + Browser Notifications

**Files:**

- Create: `apps/web/src/components/dashboard/NotificationBell.tsx`
- Create: `apps/web/src/hooks/use-notification-realtime.ts`
- Modify: `apps/web/src/components/dashboard/DashboardShell.tsx`

**Context:** Read `apps/web/src/components/dashboard/DashboardShell.tsx` — find the header flex container (around line 1029-1105) where `UserMenu` is rendered. Read `apps/web/src/app/dashboard/komm/_hooks/use-channel-realtime.ts` for the Realtime subscription pattern. Read `docs/design/ren-og-varm-styleguide.html` for animation/motion specs.

- [ ] **Step 1: Create Realtime hook**

File: `apps/web/src/hooks/use-notification-realtime.ts`

```typescript
"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useSupabase } from "@smartout/supabase/client";

export function useNotificationRealtime(profileId: string | undefined) {
  const supabase = useSupabase();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!profileId) return;

    const channel = supabase
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
            const row = payload.new as { title: string; body?: string };
            new Notification(row.title, {
              body: row.body ?? undefined,
              icon: "/icon-192.png",
            });
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profileId, supabase, queryClient]);
}
```

- [ ] **Step 2: Create NotificationBell component**

File: `apps/web/src/components/dashboard/NotificationBell.tsx`

Build a `"use client"` component with:

- Lucide `Bell` icon button
- `useUnreadCount(profileId)` for badge
- `useNotifications(profileId)` for popover list (first page only, limit 8)
- `useMarkAsRead()` for click-to-read
- `useMarkAllAsRead(profileId)` for "mark all" button
- `useNotificationRealtime(profileId)` for live updates
- shadcn `Popover` + `PopoverTrigger` + `PopoverContent`
- Animated unread badge: `motion.span` with spring animation (stiffness 35, damping 22)
- Browser Notification permission request on first bell click: `Notification.requestPermission()`
- Each notification row navigates to `action_url` via `useRouter().push()`
- "Se alle varsler" link → `/dashboard/notifications`
- Icon mapping: `icon_type` → Lucide icon (Bell, Calendar, MessageCircle, CheckSquare, AlertTriangle, ThumbsUp, GraduationCap)

- [ ] **Step 3: Add NotificationBell to DashboardShell**

In `DashboardShell.tsx`, find the header flex container and add `<NotificationBell profileId={profile.id} />` before `<UserMenu />`. Import the component with `next/dynamic` for lazy loading:

```typescript
const NotificationBell = dynamic(
  () => import("./NotificationBell").then((m) => m.NotificationBell),
  { ssr: false },
);
```

- [ ] **Step 4: Verify it renders**

```bash
pnpm --filter web dev
```

Open dashboard, verify bell appears in header. Click bell, verify empty popover renders.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/dashboard/NotificationBell.tsx apps/web/src/hooks/use-notification-realtime.ts apps/web/src/components/dashboard/DashboardShell.tsx
git commit -m "feat(notifications): bell icon + popover + realtime + browser notifications"
```

---

## Task 8: Full Notifications Page

**Files:**

- Create: `apps/web/src/app/dashboard/notifications/page.tsx`
- Create: `apps/web/src/app/dashboard/notifications/loading.tsx`

**Context:** Read an existing dashboard page (e.g., `apps/web/src/app/dashboard/chat/page.tsx`) for the page shell pattern. Follow the "Ren og Varm" style guide for colors and spacing.

- [ ] **Step 1: Create loading skeleton**

File: `apps/web/src/app/dashboard/notifications/loading.tsx`

Standard shimmer skeleton with 6 rows matching notification card height.

- [ ] **Step 2: Create notifications page**

File: `apps/web/src/app/dashboard/notifications/page.tsx`

Build a `"use client"` page with:

- Page header: "Varsler" with unread count badge
- Filter tabs: Alle | Uleste | Per icon_type category
- Notification list using `useNotifications(profileId, filter)` with infinite scroll (`useInfiniteQuery` + intersection observer)
- Each notification card: icon + title + body + relative time + action_url link + unread indicator
- Grouped notifications (same `group_key`) shown as expandable accordion
- Bulk "Marker som lest" button per visible batch
- Empty state: muted text + illustration

- [ ] **Step 3: Add route to sidebar navigation**

In `DashboardShell.tsx`, the notifications page doesn't need a sidebar entry — it's accessed via the bell "Se alle" link. But verify that `/dashboard/notifications` renders correctly within the dashboard layout.

- [ ] **Step 4: Verify page works**

Navigate to `/dashboard/notifications` in the browser. Verify filters, empty state, and layout.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/dashboard/notifications/
git commit -m "feat(notifications): full notifications page with filters + infinite scroll"
```

---

## Task 9: Notification Preferences UI

**Files:**

- Create: `apps/web/src/app/dashboard/settings/_components/NotificationPreferences.tsx`
- Modify: `apps/web/src/app/dashboard/settings/_components/settings-tabs.tsx`

**Context:** Read `apps/web/src/app/dashboard/settings/_components/settings-tabs.tsx` to find the Notifications placeholder tab. Read existing working settings tabs (e.g., the opening hours component) for the component pattern.

- [ ] **Step 1: Create NotificationPreferences component**

File: `apps/web/src/app/dashboard/settings/_components/NotificationPreferences.tsx`

Build with:

- `useNotificationPreferences(userId)` and `useUpdateNotificationPreferences(userId)` from hooks
- Three sections matching the spec:
  1. **Channels:** 4 Switch toggles (push, email, sms, browser). Browser toggle calls `Notification.requestPermission()` on enable.
  2. **Categories:** 3 Switch toggles (work, training, community). Each with description text.
  3. **Quiet hours:** Two time pickers (start/end), timezone select. Disclaimer for CRITICAL.
- Each toggle calls `updatePreferences.mutate()` with the updated field
- Loading skeleton while preferences load
- Error state if fetch fails

- [ ] **Step 2: Replace placeholder tab**

In `settings-tabs.tsx`, find the Notifications tab that renders `<TabPlaceholder />` and replace it with `<NotificationPreferences userId={userId} />`. Import with dynamic if needed.

- [ ] **Step 3: Verify**

Navigate to `/dashboard/settings` → Notifications tab. Verify toggles render with defaults. Toggle one and verify it persists on reload.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/dashboard/settings/_components/NotificationPreferences.tsx apps/web/src/app/dashboard/settings/_components/settings-tabs.tsx
git commit -m "feat(notifications): preferences UI — channels, categories, quiet hours"
```

---

## Task 10: Morning Digest Edge Function

**Files:**

- Create: `supabase/functions/send-morning-digest/index.ts`

**Context:** Read `supabase/functions/guardian-notify/index.ts` for the SendGrid email pattern from Edge Functions. Read `packages/notifications/src/templates.ts` for email template patterns.

- [ ] **Step 1: Create send-morning-digest Edge Function**

File: `supabase/functions/send-morning-digest/index.ts`

Structure:

1. Auth: `MORNING_DIGEST_SECRET` bearer token check
2. Query: SELECT distinct recipients with unread notifications in last 24h
3. Per recipient:
   a. Fetch unread notifications grouped by `icon_type`
   b. Fetch pending actions (shift_approval WHERE status='pending', protocol_assignment WHERE status='pending' AND deadline approaching)
   c. Skip if empty
   d. Build HTML email (inline CSS, matching "Ren og Varm" email style)
   e. Send via `fetch("https://api.sendgrid.com/v3/mail/send")` — same pattern as `guardian-notify`
4. Return summary: `{ sent: N, skipped: M }`

- [ ] **Step 2: Test locally**

```bash
npx supabase functions serve send-morning-digest --env-file supabase/functions/.env
curl -X POST http://localhost:54321/functions/v1/send-morning-digest \
  -H "Authorization: Bearer test-secret"
```

Expected: Returns `{ sent: 0, skipped: 0 }` (no data in local DB).

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/send-morning-digest/index.ts
git commit -m "feat(notifications): morning digest Edge Function — cron 07:00, unread + pending actions"
```

---

## Task 11: Environment Variables + Documentation

**Files:**

- Modify: `.env.template`
- Modify: `docs/reference/ENV_VARS.md`
- Modify: `supabase/functions/.env`

**Context:** Read `.env.template` for the existing format. Read `docs/reference/ENV_VARS.md` for documentation format. Read `docs/protocols/ENV_PROTOCOL.md` for the protocol.

- [ ] **Step 1: Add to .env.template**

```
PROCESS_NOTIFICATIONS_SECRET=op://smartout_ai/Supabase/process_notifications_secret
MORNING_DIGEST_SECRET=op://smartout_ai/Supabase/morning_digest_secret
```

- [ ] **Step 2: Add to supabase/functions/.env**

```
PROCESS_NOTIFICATIONS_SECRET=test-process-notifications-secret
MORNING_DIGEST_SECRET=test-morning-digest-secret
```

- [ ] **Step 3: Update ENV_VARS.md**

Add both variables to the reference doc with descriptions.

- [ ] **Step 4: Commit**

```bash
git add .env.template supabase/functions/.env docs/reference/ENV_VARS.md
git commit -m "docs(env): add PROCESS_NOTIFICATIONS_SECRET + MORNING_DIGEST_SECRET"
```

---

## Task 12: Typecheck + Integration Smoke Test

- [ ] **Step 1: Run full typecheck**

```bash
pnpm turbo typecheck
```

Fix any type errors introduced by the notification system.

- [ ] **Step 2: Regenerate types if needed**

```bash
npx supabase gen types typescript --local > packages/supabase/src/database.types.ts
```

- [ ] **Step 3: Manual smoke test**

1. Start local Supabase: `npx supabase start`
2. Start web: `pnpm --filter web dev`
3. Login to dashboard
4. Verify bell icon appears in header
5. INSERT a test notification via SQL:
   ```sql
   INSERT INTO notification (workspace_id, recipient_id, title, body, icon_type, action_url)
   VALUES ('your-workspace-id', 'your-profile-id', 'Test notification', 'This is a test', 'info', '/dashboard');
   ```
6. Verify notification appears in bell popover within seconds (Realtime)
7. Click notification → verify navigation + mark as read
8. Navigate to `/dashboard/notifications` → verify full page
9. Navigate to `/dashboard/settings` → Notifications tab → verify preferences

- [ ] **Step 4: Commit any fixes**

```bash
git add -A
git commit -m "fix(notifications): typecheck fixes + smoke test verified"
```
