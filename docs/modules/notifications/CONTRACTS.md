---
title: Notifications — Contracts
status: in_progress
updated: 2026-05-22
created: 2026-05-22
module: notifications
tags: [contracts, notifications, schema, payloads, onesignal, deep-link]
---

# Notifications — Contracts

> Machine-checkable payload shapes, schema contracts, and semantic rules. Code wins over this doc — verify against source files before building integrations.

---

## 1. `notification_outbox` Row Shape

**Source:** `packages/notifications/src/outbox.ts:37-52` + migration `00006_notification_engine.sql`

```ts
// Insert shape (written by insertOutboxNotification)
{
  workspace_id:      string;           // uuid — workspace scope
  recipient_id:      string;           // uuid — profile_id of the target user
  mode:              "training" | "work" | "community";
  priority:          0 | 1 | 2;        // 0=normal, 1=high, 2=urgent
  title:             string;           // interpolated title
  body:              string;           // interpolated body
  action_url:        string | null;    // web-shaped path, e.g. /dashboard/my-schedule?date=2026-05-22
  metadata:          {
    event_key:       string;           // e.g. "shift.published"
    group_key:       string | null;    // e.g. "shift:dept-uuid:2026-05-22"
    icon_type:       string;           // shift | task | chat | deviation | training | approval | contract | info
    ...rest: producer-specific fields  // interpolation variables for title/body re-resolution
  };
  allowed_channels:  ("push" | "email" | "sms" | "in_app")[];
  // DB-defaulted fields (not set by insertOutboxNotification):
  // status: "pending", scheduled_for: now(), retry_count: 0
}
```

**`action_url` semantics:** Always web-shaped (`/dashboard/...`). Stored web-shaped in the outbox row. Deep-link conversion (prepend `ONESIGNAL_DEEP_LINK_BASE`) happens in `push-dispatch`, not at insert time.

---

## 2. `PushRequest` — `push-dispatch` Input

**Source:** `supabase/functions/push-dispatch/index.ts:23-32`

```ts
type PushRequest = {
  event:        string;          // event_key, used for CRITICAL_EVENTS lookup
  profile_id:   string;          // uuid — used as OneSignal External ID
  workspace_id: string;          // uuid
  payload: {
    title: string;               // resolved, ready to display
    body:  string;               // resolved, ready to display
    data?: Record<string, string>; // MUST contain action_url for deep links
                                 // e.g. { action_url: "/dashboard/my-schedule?date=2026-05-22" }
  };
};
```

**`push-dispatch` response:**
```ts
{
  sent:        boolean;   // true if OneSignal call ok AND recipients > 0
  recipients:  number;    // OneSignal reported recipients (0 = no subscribed device)
  sms_fallback: boolean;  // true if critical event triggered SMS fallback
  error?:       string;   // OneSignal error string if ok=false
}
```

---

## 3. OneSignal REST Body

**Source:** `supabase/functions/_shared/onesignal.ts:33-42`
**Endpoint:** `POST https://api.onesignal.com/notifications`
**Auth:** `Authorization: Key <ONESIGNAL_REST_API_KEY>`

```json
{
  "app_id":          "<ONESIGNAL_APP_ID>",
  "target_channel":  "push",
  "include_aliases": {
    "external_id":   ["<profile_id>"]
  },
  "headings":        { "en": "<title>" },
  "contents":        { "en": "<body>" },
  "url":             "https://mobile.smartout.ai/dashboard/<section>",
  "data": {
    "event":        "<event_key>",
    "action_url":   "/dashboard/<section>"
  }
}
```

**`url` field:** absolute PWA URL constructed as `ONESIGNAL_DEEP_LINK_BASE + action_url`. Absent if `action_url` is empty.

**`data` field:** forwarded verbatim to the notification payload on the device. `action_url` (web-shaped) included so native-SDK phase can also use the mapper.

**Successful response from OneSignal:**
```json
{ "id": "<notification-uuid>", "recipients": 1 }
```

**Zero-recipient response (no subscribed device):**
```json
{ "id": "", "recipients": 0, "errors": ["All included players are not subscribed"] }
```
This is HTTP 200. `ok=true, recipients=0`. Not a failure from the helper's perspective — callers must check `recipients`.

---

## 4. Preference Channel-Resolution Semantics

**Source:** `supabase/functions/process-notifications/index.ts:334-422`

The effective channels for a delivery = `event.allowed_channels ∩ user_prefs`.

```
For each channel in row.allowed_channels:
  push:   deliver if pref.push_enabled  (default: true if no pref row)
  email:  deliver if pref.email_enabled (default: true if no pref row)
  sms:    deliver if pref.sms_enabled AND row.priority === 2  (default: false)
  in_app: ALWAYS deliver (no preference gate — in_app is always-on)
```

**Mode gate** applied BEFORE channel gate (lines ~162-169):
```
if pref.{mode}_enabled === false → mark row delivered WITHOUT any fan-out
```

**Quiet hours gate** applied before mode + channel (lines ~152-159):
```
if priority < 2 AND now() is in quiet window → reschedule to next 07:00, return "deferred"
  (priority=2 bypasses quiet hours)
```

**Missing pref row:** treated as all-defaults. `pref?.push_enabled ?? true` pattern throughout.

**Critical SMS fallback** (in `push-dispatch`, NOT `process-notifications`):
```
if recipients === 0 AND event ∈ CRITICAL_EVENTS → sendSms(user_identity.phone, body)
  (regardless of pref.sms_enabled — this is an unconditional safety net)
```
CRITICAL_EVENTS: `shift_confirmation_reminder`, `deviation_reported`, `contract.signed`, `contract.expired`

---

## 5. Event Config Field Contract

**Source:** `packages/notifications/src/event-config.ts:7-21`

```ts
type NotificationEventConfig = {
  event_key:              string;
  mode:                   "training" | "work" | "community";
  default_priority:       0 | 1 | 2;
  group_key_template:     string | null;  // null = no grouping; {vars} interpolated
  title_template:         string;         // {vars} interpolated from metadata
  body_template:          string;
  title_i18n_key:         string;         // e.g. "notifications.shift.published.title"
  body_i18n_key:          string;
  action_url_template:    string;         // web-shaped path with {vars}
  icon_type:              string;         // shift | task | chat | deviation | training | approval | contract | info
  allowed_channels:       ("push" | "email" | "sms" | "in_app")[];
  grouping_window_sec:    number;         // CONFIG ONLY — currently ignored by process-notifications
  admin_overridable:      boolean;        // whether workspace admin can override channel/priority
};
```

**Template interpolation rule** (`interpolateTemplate`, line 622):
```ts
template.replace(/\{(\w+)\}/g, (_, key) => String(metadata[key] ?? `{${key}}`))
```
Unknown variable: left as `{variable_name}` in the output (not silently dropped).

---

## 6. Deep-Link Path → Mobile Route Table

**Source:** `apps/mobile/src/lib/deep-link.ts`

| `action_url` pattern | Mobile Expo Router route | Notes |
|----------------------|--------------------------|-------|
| `/dashboard/komm/<channelId>` | `/(app)/(me)/channel-detail/<channelId>` | `channelId` is the UUID from `channel.channel_id` |
| `/dashboard/shift-clock` | `/(app)/(home)/punch-clock` | |
| `/dashboard/my-schedule[?date=...]` | `/(app)/(shifts)` | Query param preserved in mapper call but route ignores it |
| `/dashboard/schedule` | `/(app)/(shifts)` | |
| `/dashboard/operations` | `/(app)/(home)/operations` | |
| `/dashboard/reconciliation` | `/(app)/(home)/operations` | Reconciliation maps to same operations screen |
| `/dashboard/my-training` | `/(app)/(home)/training` | |
| `/dashboard/contracts` | `/(app)/(me)/contract` | |
| `/dashboard/people/contracts` | `/(app)/(me)/contract` | |
| `/dashboard/people` (without `/contracts`) | `/(app)/(home)/team` | |
| `/dashboard` (generic) | `null` → fallback | Catch-all uses `/(app)/(home)` |
| any other `/dashboard/<unknown>` | `null` → fallback | |
| empty string or non-dashboard path | `null` → fallback | |

**Fallback per consumer:**
- `NotificationScreen` (bell tap): `null` → no navigation (tap closes the screen, no route change)
- `app/dashboard/[...rest].tsx` (OneSignal tap): `null` → `router.replace("/(app)/(home)")`

---

## 7. `notification` Table Insert Shape

Written only by `process-notifications`. Application code reads only.

```ts
// Insert shape (process-notifications:204-213)
{
  workspace_id: string;        // from outbox row
  recipient_id: string;        // from outbox row (profile_id)
  group_key:    string | null; // from outbox metadata.group_key
  title:        string;        // resolvedTitle (re-interpolated or raw)
  body:         string;        // resolvedBody
  action_url:   string | null; // resolvedActionUrl (web-shaped)
  icon_type:    string;        // resolvedIconType
  metadata:     jsonb;         // copy of outbox metadata
  // is_read, read_at, created_at, updated_at — DB defaults
}
```
