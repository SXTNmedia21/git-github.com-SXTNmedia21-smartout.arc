---
title: Notifications — API Reference
status: in_progress
updated: 2026-05-22
created: 2026-05-22
module: notifications
tags: [api, notifications, edge-functions, helpers, mobile, client]
---

# Notifications — API Reference

> All send paths, Edge Functions, package helpers, and mobile client exports. Every claim traceable to a file.

---

## Package Helpers (`packages/notifications/`)

### `insertOutboxNotification(supabase, input)`

**File:** `packages/notifications/src/outbox.ts:24`
**Purpose:** Insert a single notification into `notification_outbox`. The canonical write path for all application code.

```ts
type OutboxInsert = {
  workspace_id: string;
  recipient_id: string;
  event_key: string;                    // must be in NOTIFICATION_EVENTS registry
  metadata: Record<string, unknown>;    // template variables: date, department_name, etc.
  priority_override?: 0 | 1 | 2;       // overrides config.default_priority if set
};

async function insertOutboxNotification(
  supabase: SupabaseClient,
  input: OutboxInsert,
): Promise<{ error: Error | null }>
```

**Behaviour:**
1. Looks up `event_key` in `NOTIFICATION_EVENTS` registry. Returns `{ error }` for unknown keys.
2. Interpolates all templates with `metadata`.
3. Builds `group_key` from `group_key_template` if set.
4. Inserts complete row into `notification_outbox`.

**Note:** Caller is responsible for providing a Supabase client with sufficient permissions to insert into `notification_outbox` (service role in Edge Functions; server-side in Next.js Route Handlers).

---

### Event Config Registry

**File:** `packages/notifications/src/event-config.ts`

```ts
// Get config for a single event key
getEventConfig(eventKey: string): NotificationEventConfig | undefined

// Interpolate {variable} placeholders from metadata
interpolateTemplate(template: string, metadata: Record<string, unknown>): string

// Full registry (40 events)
NOTIFICATION_EVENTS: Record<string, NotificationEventConfig>

// Config shape:
type NotificationEventConfig = {
  event_key: string;
  mode: "training" | "work" | "community";
  default_priority: 0 | 1 | 2;
  group_key_template: string | null;
  title_template: string;
  body_template: string;
  title_i18n_key: string;           // e.g. "notifications.shift.published.title"
  body_i18n_key: string;
  action_url_template: string;       // e.g. "/dashboard/my-schedule?date={date}"
  icon_type: string;                 // shift | task | chat | deviation | training | approval | contract | info
  allowed_channels: ("push" | "email" | "sms" | "in_app")[];
  grouping_window_sec: number;       // NOTE: currently ignored; hardcoded 3-min in process-notifications
  admin_overridable: boolean;
}
```

---

### Notification Preference Hooks

**File:** `packages/notifications/src/hooks/use-notification-preferences.ts`

```ts
// Read preferences for a user (or null if no row yet)
useNotificationPreferences(userId: string | undefined)
// → useQuery<NotificationPreference | null>

// Upsert preferences (creates row on first save)
useUpdateNotificationPreferences(userId: string | undefined)
// → useMutation<void, Error, Record<string, unknown>>
```

**Note:** These hooks use `createClient()` from `@smartout/supabase/client`. They are web-compatible and can be used in mobile (hook exists in `packages/notifications/`) but are not wired to any mobile UI screen as of P1.

---

## Edge Functions

### `process-notifications`

**File:** `supabase/functions/process-notifications/index.ts`
**Auth:** `Bearer $PROCESS_NOTIFICATIONS_SECRET`
**verify_jwt:** false (cron-only)
**Trigger:** pg_cron every 30s + `dispatch_critical_notification()` DB trigger on priority=2

**Request:** POST (body ignored — cron trigger has no body)

**Response:**
```json
{
  "delivered": 12,
  "failed": 0,
  "deferred": 2,
  "grouped": 3,
  "suppressed": 0
}
```

Not a public API. Called only by pg_cron and the DB trigger. Do not call directly from application code.

---

### `push-dispatch`

**File:** `supabase/functions/push-dispatch/index.ts`
**Auth:** `Bearer $PUSH_DISPATCH_SECRET`
**verify_jwt:** false
**Caller:** `process-notifications` only

**Request body:**
```ts
type PushRequest = {
  event: string;           // event_key, e.g. "shift.published"
  profile_id: string;      // target profile (used as OneSignal External ID)
  workspace_id: string;
  payload: {
    title: string;
    body: string;
    data?: Record<string, string>;  // must include action_url for deep linking
  };
};
```

**Response:**
```json
{
  "sent": true,
  "recipients": 1,
  "sms_fallback": false,
  "error": null
}
```

`sent: false` + `recipients: 0` = no subscribed device (not a send error). `sms_fallback: true` = critical event triggered SMS fallback.

Not a public API. Internal service-to-service call only.

---

### `_shared/onesignal.ts` (Deno helper)

**File:** `supabase/functions/_shared/onesignal.ts`

```ts
type SendOneSignalPushInput = {
  appId: string;
  restApiKey: string;
  externalIds: string[];         // [profile_id]
  title: string;
  body: string;
  url?: string;                  // absolute PWA URL (deep link)
  data?: Record<string, string>; // forwarded as OneSignal data payload
};

type SendOneSignalPushResult = {
  ok: boolean;
  recipients: number;            // 0 = no subscribed device
  error?: string;
};

async function sendOneSignalPush(input: SendOneSignalPushInput): Promise<SendOneSignalPushResult>
```

**Endpoint:** `https://api.onesignal.com/notifications`
**Auth:** `Authorization: Key <restApiKey>`

---

## Mobile Client Exports

### `apps/mobile/src/lib/onesignal.ts`

All exports are web-only (Platform.OS === "web" guard). On native: no-op.

```ts
// Init the OneSignal Web SDK. Call once at app mount (_layout.tsx).
async function initOneSignal(): Promise<void>

// Link browser session to profile_id as External ID.
// Does NOT request permission — call from profile resolve, not gesture handler.
async function loginOneSignal(profileId: string): Promise<void>

// Request web-push permission. MUST be called from a user gesture (tap) handler.
// Returns true if permission was granted.
async function requestPushPermission(): Promise<boolean>

// Synchronously check if push permission is granted.
async function isPushEnabled(): Promise<boolean>

// Unlink on sign-out. Call before supabase.auth.signOut().
async function logoutOneSignal(): Promise<void>
```

**Wiring:**
- `initOneSignal()` → `apps/mobile/app/_layout.tsx` (useEffect on mount)
- `loginOneSignal()` → `apps/mobile/src/hooks/use-push-token.ts` (alongside `registerPushToken`)
- `logoutOneSignal()` → `apps/mobile/app/(app)/(home)/settings.tsx` + `apps/mobile/src/components/home/SettingsSheet.tsx`
- `requestPushPermission()` → "Aktiver varsler" button in NotificationScreen (iOS PWA gesture gate)

---

### `apps/mobile/src/lib/deep-link.ts`

```ts
// Map a web-shaped action_url to a mobile Expo Router path.
// Returns null for unknown/generic paths.
function mobileRouteForActionUrl(actionUrl: string): string | null
```

**Known mappings:**

| Web action_url pattern | Mobile route |
|------------------------|-------------|
| `/dashboard/komm/<id>` | `/(app)/(me)/channel-detail/<id>` |
| `/dashboard/shift-clock` | `/(app)/(home)/punch-clock` |
| `/dashboard/my-schedule` or `/dashboard/schedule` | `/(app)/(shifts)` |
| `/dashboard/operations` or `/dashboard/reconciliation` | `/(app)/(home)/operations` |
| `/dashboard/my-training` | `/(app)/(home)/training` |
| `/dashboard/contracts` or `/dashboard/people/contracts` | `/(app)/(me)/contract` |
| `/dashboard/people` | `/(app)/(home)/team` |
| `/dashboard` (generic) | `null` |
| anything else | `null` |

Callers decide the fallback: bell (`NotificationScreen`) uses no-op; catch-all route uses `/(app)/(home)`.

---

### `apps/mobile/src/lib/push.ts`

Native-only functions (Expo Notifications). Guards on `Platform.OS !== "web"`.

```ts
// Register for push notifications and sync expo_push_token to profile.
// (Legacy Expo path — still used for native builds. OneSignal handles web PWA.)
async function registerPushToken(profileId: string): Promise<PushRegistrationResult>

// Clear expo_push_token on logout.
async function unregisterPushToken(profileId: string): Promise<void>

// Subscribe device to a shift_session push topic (ADR-0367 §M4).
async function subscribeShiftSessionTopic(shiftSessionId: string, pushTopic: string): Promise<void>

// Unsubscribe on clock-out.
async function unsubscribeShiftSessionTopic(shiftSessionId: string): Promise<void>

// Set up push notification tap listeners (native only).
// Returns cleanup function.
function setupNotificationListeners(): () => void
```

---

## Service Worker

**File:** `apps/mobile/public/OneSignalSDKWorker.js`
**Contents:**
```js
importScripts("https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js");
```
Required by OneSignal Web SDK. Must serve at `https://mobile.smartout.ai/OneSignalSDKWorker.js` (not intercepted by the Expo SPA `/(.*) → /index.html` rewrite). Expo web export copies `apps/mobile/public/*` to site root.

**Verification check:** `curl -s https://mobile.smartout.ai/OneSignalSDKWorker.js | head -1` must return the `importScripts` line, NOT `<!doctype html>`.
