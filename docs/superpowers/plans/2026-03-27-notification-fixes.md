---
title: "Notification System Fixes — Implementation Plan"
status: in_progress
updated: 2026-03-27
created: 2026-03-27
module: notifications
tags: [notifications, fixes, outbox, consumer, reliability, council-approved]
---

# Notification System Fixes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 6 bugs in the existing notification system to make the outbox consumer reliable, title resolution correct, email delivery functional, and timezone handling accurate.

**Architecture:** Three PRs in order: Group A (foundation — row locking, retry, RLS), Group B (routing — event config in `_shared/`, title resolution, grouping), Group C (delivery — SendGrid email, timezone fix). All changes land on `development` branch via a single feature branch.

**Tech Stack:** Supabase Edge Functions (Deno), PostgreSQL (RPC, RLS, migration), TypeScript, SendGrid API

**Spec:** `docs/superpowers/specs/2026-03-27-notification-fixes-design.md`

---

## File Structure

### New files

| File                                                                     | Responsibility                                                    |
| ------------------------------------------------------------------------ | ----------------------------------------------------------------- |
| `supabase/migrations/20260427200000_notification_outbox_reliability.sql` | retry_count, updated_at, RLS tightening, fetch_pending_outbox RPC |
| `supabase/functions/_shared/event-config.ts`                             | Deno-importable event config registry (21 entries)                |

### Modified files

| File                                                | Change                                                                                                                                                 |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `supabase/functions/process-notifications/index.ts` | Use RPC for row fetch, retry logic, title resolution via \_shared/event-config, email delivery, timezone fix, grouping body text                       |
| `packages/notifications/src/event-config.ts`        | Rename title_key → title_template, body_key → body_template, add 6 engine entries, change templates from i18n keys to interpolatable Norwegian strings |
| `packages/notifications/src/outbox.ts`              | Update field names to title_template / body_template                                                                                                   |
| `.env.template`                                     | Add PUSH_DISPATCH_SECRET                                                                                                                               |

---

## Task 1: Migration — outbox reliability (retry, updated_at, RLS, RPC)

**Files:**

- Create: `supabase/migrations/20260427200000_notification_outbox_reliability.sql`

**Context:** Read `supabase/migrations/00006_notification_engine.sql` for existing `notification_outbox` schema. Read `supabase/functions/process-notifications/index.ts` lines 82-91 for current fetch pattern.

- [ ] **Step 1: Create migration file**

```sql
-- 20260427200000_notification_outbox_reliability.sql
-- Adds retry support, updated_at, tighter RLS, and atomic row-locking RPC
-- for the notification outbox consumer.

-- 1. Add retry_count and updated_at columns
ALTER TABLE notification_outbox ADD COLUMN IF NOT EXISTS retry_count smallint NOT NULL DEFAULT 0;
ALTER TABLE notification_outbox ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE TRIGGER set_notification_outbox_updated_at
  BEFORE UPDATE ON notification_outbox
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 2. Tighten RLS — replace the overly permissive "System manages outbox" policy.
-- The consumer uses service_role (bypasses RLS). DB triggers use SECURITY DEFINER
-- (bypasses RLS). Only the Next.js API route would hit RLS with a user JWT — and
-- Fix 1 was eliminated, so no user-JWT writes happen. Keep RLS enabled but restrict.
DROP POLICY IF EXISTS "System manages outbox" ON notification_outbox;

-- Service role bypasses RLS entirely, so these policies only gate JWT-authenticated access.
-- No JWT user should read or write the outbox directly.
CREATE POLICY "No direct user access to outbox" ON notification_outbox
  FOR ALL USING (false) WITH CHECK (false);

-- 3. Create atomic row-locking RPC for the consumer
CREATE OR REPLACE FUNCTION fetch_pending_outbox(p_batch_size int DEFAULT 100)
RETURNS SETOF notification_outbox
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Reset rows stuck in 'processing' for over 5 minutes (staleness recovery)
  UPDATE notification_outbox
  SET status = 'pending', updated_at = now()
  WHERE status = 'processing'
    AND updated_at < now() - interval '5 minutes';

  -- Fetch and lock pending rows + failed rows eligible for retry
  RETURN QUERY
  UPDATE notification_outbox
  SET status = 'processing', updated_at = now()
  WHERE id IN (
    SELECT id FROM notification_outbox
    WHERE (status = 'pending' AND scheduled_for <= now())
       OR (status = 'failed' AND retry_count < 3)
    ORDER BY priority DESC, created_at ASC
    LIMIT p_batch_size
    FOR UPDATE SKIP LOCKED
  )
  RETURNING *;
END;
$$;
```

- [ ] **Step 2: Run migration locally**

```bash
docker exec -i $(docker ps -q -f name=supabase_db) psql -U postgres < supabase/migrations/20260427200000_notification_outbox_reliability.sql
```

Expected: no errors. Verify with:

```bash
docker exec -i $(docker ps -q -f name=supabase_db) psql -U postgres -c "\d notification_outbox" | grep -E "retry_count|updated_at"
```

Expected: both columns visible.

- [ ] **Step 3: Regenerate types**

```bash
npx supabase gen types typescript --local > packages/supabase/src/database.types.ts
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260427200000_notification_outbox_reliability.sql packages/supabase/src/database.types.ts
git commit -m "feat(notifications): add outbox retry, row locking, and RLS tightening

Add retry_count + updated_at columns, replace permissive RLS with
deny-all (service_role bypasses), create fetch_pending_outbox RPC
with FOR UPDATE SKIP LOCKED and 5-min staleness recovery.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Consumer — use RPC for row fetch + retry logic

**Files:**

- Modify: `supabase/functions/process-notifications/index.ts` (lines 82-114)

**Context:** The current consumer uses a plain `supabase.from("notification_outbox").select("*")` query. Replace with the new `fetch_pending_outbox` RPC. Update error handling to increment retry_count.

- [ ] **Step 1: Replace fetch with RPC call**

In `handleRequest()` (line 82), replace lines 83-91:

```typescript
// OLD:
const { data: rows, error } = await supabase
  .from("notification_outbox")
  .select("*")
  .eq("status", "pending")
  .lte("scheduled_for", new Date().toISOString())
  .order("priority", { ascending: false })
  .order("created_at", { ascending: true })
  .limit(100);

// NEW:
const { data: rows, error } = await supabase.rpc("fetch_pending_outbox", {
  p_batch_size: 100,
});
```

- [ ] **Step 2: Update error handler to use retry_count**

In the catch block (lines 106-114), replace the status update:

```typescript
// OLD:
await supabase
  .from("notification_outbox")
  .update({ status: "failed", error_log: msg })
  .eq("id", row.id);

// NEW:
const newRetryCount = ((row as OutboxRow & { retry_count?: number }).retry_count ?? 0) + 1;
await supabase
  .from("notification_outbox")
  .update({
    status: newRetryCount >= 3 ? "suppressed" : "failed",
    retry_count: newRetryCount,
    error_log: msg,
  })
  .eq("id", row.id);
```

- [ ] **Step 3: Add retry_count to OutboxRow type**

At line 15, add to the type:

```typescript
type OutboxRow = {
  id: number;
  workspace_id: string;
  recipient_id: string;
  mode: string;
  priority: number;
  title: string;
  body: string;
  action_url: string | null;
  metadata: Record<string, unknown>;
  allowed_channels: string[];
  status: string;
  error_log: string | null;
  scheduled_for: string;
  processed_at: string | null;
  created_at: string;
  retry_count: number; // NEW
};
```

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/process-notifications/index.ts
git commit -m "fix(notifications): use RPC for atomic row fetch with retry logic

Replace plain SELECT with fetch_pending_outbox RPC for FOR UPDATE
SKIP LOCKED concurrency safety. Failed rows retry up to 3 times
before being suppressed.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Event config — rename fields, add engine templates, create \_shared/ copy

**Files:**

- Modify: `packages/notifications/src/event-config.ts`
- Modify: `packages/notifications/src/outbox.ts`
- Create: `supabase/functions/_shared/event-config.ts`

**Context:** The event config currently uses `title_key` and `body_key` which store i18n dotted keys. These don't work in Edge Functions (no i18n runtime). Change to `title_template` and `body_template` with interpolatable Norwegian strings. Add 6 engine template entries.

- [ ] **Step 1: Update NotificationEventConfig type in packages/notifications/src/event-config.ts**

Replace the type definition (lines 7-19):

```typescript
export type NotificationEventConfig = {
  event_key: string;
  mode: "training" | "work" | "community";
  default_priority: 0 | 1 | 2;
  group_key_template: string | null;
  title_template: string;
  body_template: string;
  title_i18n_key: string;
  body_i18n_key: string;
  action_url_template: string;
  icon_type: string;
  allowed_channels: ("push" | "email" | "sms" | "in_app")[];
  grouping_window_sec: number;
  admin_overridable: boolean;
};
```

- [ ] **Step 2: Update all 15 existing entries**

For each entry, rename `title_key` → `title_i18n_key`, `body_key` → `body_i18n_key`, and add `title_template` + `body_template` with Norwegian interpolatable strings.

Example for the first entry:

```typescript
"shift.published": {
  event_key: "shift.published",
  mode: "work",
  default_priority: 1,
  group_key_template: "shift:{department_id}:{date}",
  title_template: "Ny vakt {date} kl {start_time}",
  body_template: "Du har fått en vakt i {department_name}",
  title_i18n_key: "notifications.shift.published.title",
  body_i18n_key: "notifications.shift.published.body",
  action_url_template: "/dashboard/my-schedule?date={date}",
  icon_type: "shift",
  allowed_channels: ["push", "email", "in_app"],
  grouping_window_sec: 180,
  admin_overridable: true,
},
```

Apply the same pattern for all 15 entries. Each entry keeps the existing `title_key`/`body_key` value as `title_i18n_key`/`body_i18n_key` and adds a Norwegian template string as `title_template`/`body_template`. Use contextually appropriate Norwegian text for each event type:

| event_key           | title_template                 | body_template                                                  |
| ------------------- | ------------------------------ | -------------------------------------------------------------- |
| shift.published     | Ny vakt {date} kl {start_time} | Du har fått en vakt i {department_name}                        |
| shift.updated       | Vaktendring {date}             | Vakten din i {department_name} er oppdatert                    |
| task.assigned       | Ny oppgave tildelt             | Du har fått en ny oppgave                                      |
| chat.message        | Ny melding i {channel_name}    | {sender_name}: {preview}                                       |
| deviation.reported  | Avvik rapportert               | Et avvik er registrert i {department_name}                     |
| join.request        | Ny søknad mottatt              | En ny person ønsker å bli med                                  |
| protocol.assigned   | Ny opplæring tildelt           | Du har fått tildelt et nytt opplæringsprotokoll                |
| approval.pending    | Godkjenning venter             | En godkjenning venter på deg                                   |
| training.deadline   | Opplæringsfrist nærmer seg     | Fristen for {protocol_name} nærmer seg                         |
| shift.punched_in    | Innstemplet                    | {employee_name} har stemplet inn                               |
| shift.punched_out   | Utstemplet                     | {employee_name} har stemplet ut                                |
| shift.late          | Sen ankomst                    | {employee_name} har ikke stemplet inn til vakt kl {start_time} |
| shift.no_show       | Manglende oppmøte              | {employee_name} møtte ikke til vakt                            |
| shift.adhoc_pending | Tilleggsvakt venter            | En tilleggsvakt venter på godkjenning                          |
| session.hook        | Oppgave utløst                 | En planlagt oppgave er klar                                    |

- [ ] **Step 3: Add 6 engine template entries**

Append to the `NOTIFICATION_EVENTS` object:

```typescript
"engine.reconciliation_feedback": {
  event_key: "engine.reconciliation_feedback",
  mode: "work",
  default_priority: 0,
  group_key_template: null,
  title_template: "Tilbakemelding på avstemming",
  body_template: "Avstemmingen for {date} har fått tilbakemelding",
  title_i18n_key: "notifications.engine.reconciliation_feedback.title",
  body_i18n_key: "notifications.engine.reconciliation_feedback.body",
  action_url_template: "/dashboard/reconciliation",
  icon_type: "approval",
  allowed_channels: ["push", "in_app"],
  grouping_window_sec: 0,
  admin_overridable: false,
},
"engine.day_closed": {
  event_key: "engine.day_closed",
  mode: "work",
  default_priority: 0,
  group_key_template: null,
  title_template: "Dagen er avsluttet",
  body_template: "Driften for {date} er lukket",
  title_i18n_key: "notifications.engine.day_closed.title",
  body_i18n_key: "notifications.engine.day_closed.body",
  action_url_template: "/dashboard/reconciliation",
  icon_type: "info",
  allowed_channels: ["in_app"],
  grouping_window_sec: 0,
  admin_overridable: false,
},
"engine.workspace_ready": {
  event_key: "engine.workspace_ready",
  mode: "work",
  default_priority: 1,
  group_key_template: null,
  title_template: "Arbeidsområdet er klart",
  body_template: "Arbeidsområdet ditt er satt opp og klart til bruk",
  title_i18n_key: "notifications.engine.workspace_ready.title",
  body_i18n_key: "notifications.engine.workspace_ready.body",
  action_url_template: "/dashboard",
  icon_type: "info",
  allowed_channels: ["push", "email", "in_app"],
  grouping_window_sec: 0,
  admin_overridable: false,
},
"engine.onboarding_welcome": {
  event_key: "engine.onboarding_welcome",
  mode: "training",
  default_priority: 0,
  group_key_template: null,
  title_template: "Velkommen!",
  body_template: "Velkommen til teamet! Start opplæringen din her",
  title_i18n_key: "notifications.engine.onboarding_welcome.title",
  body_i18n_key: "notifications.engine.onboarding_welcome.body",
  action_url_template: "/dashboard/my-training",
  icon_type: "training",
  allowed_channels: ["push", "email", "in_app"],
  grouping_window_sec: 0,
  admin_overridable: false,
},
"engine.onboarding_complete": {
  event_key: "engine.onboarding_complete",
  mode: "training",
  default_priority: 1,
  group_key_template: null,
  title_template: "Opplæring fullført!",
  body_template: "Gratulerer — du har fullført all opplæring",
  title_i18n_key: "notifications.engine.onboarding_complete.title",
  body_i18n_key: "notifications.engine.onboarding_complete.body",
  action_url_template: "/dashboard",
  icon_type: "training",
  allowed_channels: ["push", "email", "in_app"],
  grouping_window_sec: 0,
  admin_overridable: false,
},
"engine.session_hook_task": {
  event_key: "engine.session_hook_task",
  mode: "work",
  default_priority: 0,
  group_key_template: "hook:{session_id}",
  title_template: "Oppgave klar",
  body_template: "En planlagt oppgave er utløst for økten",
  title_i18n_key: "notifications.engine.session_hook_task.title",
  body_i18n_key: "notifications.engine.session_hook_task.body",
  action_url_template: "/dashboard/operations",
  icon_type: "task",
  allowed_channels: ["push", "in_app"],
  grouping_window_sec: 180,
  admin_overridable: false,
},
```

- [ ] **Step 4: Update interpolateTemplate to also handle title_template**

The existing `interpolateTemplate` function (line 224-226) already handles `{variable}` syntax. No change needed — it works for both field names.

- [ ] **Step 5: Update outbox.ts to use new field names**

In `packages/notifications/src/outbox.ts`, update lines 42-43:

```typescript
// OLD:
title: interpolateTemplate(config.title_key, input.metadata),
body: interpolateTemplate(config.body_key, input.metadata),

// NEW:
title: interpolateTemplate(config.title_template, input.metadata),
body: interpolateTemplate(config.body_template, input.metadata),
```

- [ ] **Step 6: Run typecheck**

```bash
pnpm turbo typecheck --filter=@smartout/notifications
```

Expected: 0 errors.

- [ ] **Step 7: Create `_shared/event-config.ts` for Deno Edge Functions**

Copy the full content of `packages/notifications/src/event-config.ts` to `supabase/functions/_shared/event-config.ts`. Add a sync comment at the top:

```typescript
/**
 * Event config registry for Deno Edge Functions.
 *
 * SYNC: This is a copy of packages/notifications/src/event-config.ts
 * for use in Deno Edge Functions which cannot import from packages/.
 * When modifying event configs, update BOTH files.
 */

// ... (identical content)
```

- [ ] **Step 8: Commit**

```bash
git add packages/notifications/src/event-config.ts packages/notifications/src/outbox.ts supabase/functions/_shared/event-config.ts
git commit -m "feat(notifications): rename title_key to title_template, add engine entries

Change event config from i18n dotted keys to interpolatable Norwegian
template strings. Add 6 engine notification templates. Create
_shared/event-config.ts for Deno Edge Function access.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Consumer — title resolution from event config

**Files:**

- Modify: `supabase/functions/process-notifications/index.ts` (lines 182-192)

**Context:** The consumer currently passes raw `row.title` and `row.body` to the notification INSERT. After this fix, it resolves titles from the event config registry using `metadata.event_key`.

- [ ] **Step 1: Add import for event config**

At the top of `process-notifications/index.ts`, after the existing imports:

```typescript
import { getEventConfig, interpolateTemplate } from "../_shared/event-config.ts";
```

- [ ] **Step 2: Add title resolution before notification INSERT**

Replace lines 182-192 (the notification INSERT block):

```typescript
// OLD:
await supabase.from("notification").insert({
  workspace_id: row.workspace_id,
  recipient_id: row.recipient_id,
  group_key: groupKey ?? null,
  title: row.title,
  body: row.body,
  action_url: row.action_url,
  icon_type: (row.metadata?.icon_type as string) ?? "info",
  metadata: row.metadata,
});

// NEW:
// Resolve title/body from event config registry if possible
const eventKey = row.metadata?.event_key as string | undefined;
const config = eventKey ? getEventConfig(eventKey) : null;

let resolvedTitle = row.title;
let resolvedBody = row.body;
let resolvedActionUrl = row.action_url;
let resolvedIconType = (row.metadata?.icon_type as string) ?? "info";

if (config) {
  const meta = (row.metadata ?? {}) as Record<string, unknown>;
  resolvedTitle = interpolateTemplate(config.title_template, meta);
  resolvedBody = interpolateTemplate(config.body_template, meta);
  resolvedActionUrl = interpolateTemplate(config.action_url_template, meta);
  resolvedIconType = config.icon_type;
} else if (eventKey) {
  console.warn(`[process-notifications] Unknown event_key: ${eventKey} — using raw title/body`);
}

await supabase.from("notification").insert({
  workspace_id: row.workspace_id,
  recipient_id: row.recipient_id,
  group_key: groupKey ?? null,
  title: resolvedTitle,
  body: resolvedBody,
  action_url: resolvedActionUrl,
  icon_type: resolvedIconType,
  metadata: row.metadata,
});
```

- [ ] **Step 3: Also use resolved title/body for push delivery**

In `deliverToChannels()` (line 297-302), the push payload uses `row.title` and `row.body`. These should use the resolved values. Since `deliverToChannels` is called after resolution, pass the resolved values. Change the function signature:

```typescript
// OLD:
async function deliverToChannels(
  supabase: SupabaseClient,
  row: OutboxRow,
  pref: NotificationPref | null,
  phone: string | null,
);

// NEW:
async function deliverToChannels(
  supabase: SupabaseClient,
  row: OutboxRow,
  pref: NotificationPref | null,
  phone: string | null,
  resolvedTitle: string,
  resolvedBody: string,
);
```

Update the push payload (line 301):

```typescript
payload: { title: resolvedTitle, body: resolvedBody, data: {} },
```

Update the SMS line (line 317):

```typescript
const result = await sendSms(phone, `${resolvedTitle}\n${resolvedBody}`);
```

Update the email log line (line 311):

```typescript
console.log(`[email] Would send to recipient ${row.recipient_id}: ${resolvedTitle}`);
```

Update the call site in `processOutboxRow` to pass resolved values:

```typescript
await deliverToChannels(supabase, row, pref, profile?.phone, resolvedTitle, resolvedBody);
```

- [ ] **Step 4: Update grouping body text**

In `resolveGrouping()` (line 264-271), update the merged body to show count:

```typescript
// OLD:
await supabase
  .from("notification")
  .update({
    body: row.body,
    metadata: { ...meta, count },
    updated_at: new Date().toISOString(),
  })
  .eq("id", existing.id);

// NEW:
const groupLabel =
  (row.metadata?.department_name as string) ?? (row.metadata?.channel_name as string) ?? "";
const groupBody = groupLabel ? `${count} nye varsler i ${groupLabel}` : `${count} nye varsler`;

await supabase
  .from("notification")
  .update({
    body: groupBody,
    metadata: { ...meta, count },
    updated_at: new Date().toISOString(),
  })
  .eq("id", existing.id);
```

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/process-notifications/index.ts
git commit -m "fix(notifications): resolve titles from event config, fix grouping text

Consumer now looks up event_key in the registry and interpolates
title_template/body_template. Unknown keys fall back to raw values
with a warning. Grouped notifications show count text.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Consumer — wire email delivery via SendGrid

**Files:**

- Modify: `supabase/functions/process-notifications/index.ts` (lines 309-312)

**Context:** Read `supabase/functions/send-morning-digest/index.ts` lines 98-116 for the existing SendGrid pattern. The consumer currently has a console.log stub for email delivery.

- [ ] **Step 1: Replace email stub with SendGrid call**

Replace the email block in `deliverToChannels()`:

```typescript
// OLD:
if (channels.includes("email") && (pref?.email_enabled ?? true)) {
  console.log(`[email] Would send to recipient ${row.recipient_id}: ${resolvedTitle}`);
}

// NEW:
if (channels.includes("email") && (pref?.email_enabled ?? true)) {
  const sgKey = Deno.env.get("SENDGRID_API_KEY");
  if (sgKey) {
    // Resolve recipient email via profile → user_identity
    const { data: userRow } = await supabase
      .from("user_identity")
      .select("email")
      .eq("id", profile_user_id)
      .single();

    if (userRow?.email) {
      try {
        await fetch("https://api.sendgrid.com/v3/mail/send", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${sgKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            personalizations: [{ to: [{ email: userRow.email }] }],
            from: { email: "varsler@smartout.ai", name: "Smartout" },
            subject: resolvedTitle,
            content: [
              {
                type: "text/plain",
                value: `${resolvedBody}\n\n${row.action_url ? `Se mer: https://app.smartout.ai${row.action_url}` : ""}`,
              },
            ],
          }),
        });
      } catch (err) {
        console.error("Email delivery failed:", err);
      }
    }
  }
}
```

Note: `profile_user_id` needs to be passed to `deliverToChannels`. Update the function signature to accept it:

```typescript
async function deliverToChannels(
  supabase: SupabaseClient,
  row: OutboxRow,
  pref: NotificationPref | null,
  phone: string | null,
  resolvedTitle: string,
  resolvedBody: string,
  profile_user_id: string | null,
);
```

Update the call site in `processOutboxRow`:

```typescript
await deliverToChannels(
  supabase,
  row,
  pref,
  profile?.phone,
  resolvedTitle,
  resolvedBody,
  profile?.user_id ?? null,
);
```

- [ ] **Step 2: Commit**

```bash
git add supabase/functions/process-notifications/index.ts
git commit -m "feat(notifications): wire email delivery via SendGrid API

Replace console.log email stub with actual SendGrid v3 API call.
Resolves recipient email via user_identity join. Sends plain text
with title, body, and action URL.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Consumer — fix timezone handling

**Files:**

- Modify: `supabase/functions/process-notifications/index.ts` (lines 228-236)

**Context:** The current `getNext7am()` creates a Date from `"YYYY-MM-DDT07:00:00"` without timezone, which Deno interprets as UTC. This means quiet-hours deferral schedules notifications for 07:00 UTC, not 07:00 in the user's timezone.

- [ ] **Step 1: Fix getNext7am to use proper timezone offset**

Replace the function:

```typescript
// OLD:
function getNext7am(tz: string): string {
  const now = new Date();
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const dateStr = tomorrow.toLocaleDateString("sv-SE", { timeZone: tz });
  const target = new Date(`${dateStr}T07:00:00`);
  return target.toISOString();
}

// NEW:
function getNext7am(tz: string): string {
  const now = new Date();
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  // Get tomorrow's date string in the target timezone
  const dateStr = tomorrow.toLocaleDateString("sv-SE", { timeZone: tz });

  // Get the UTC offset for the target timezone at 07:00 tomorrow
  // by comparing formatted time vs UTC time
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  // Create a reference point at midnight UTC on the target date
  const refUtc = new Date(`${dateStr}T07:00:00Z`);
  const parts = formatter.formatToParts(refUtc);
  const localHour = Number(parts.find((p) => p.type === "hour")?.value ?? "7");

  // The difference between local hour and 7 gives us the offset to apply
  // If local shows 8 when UTC is 7, timezone is UTC+1, so we need to subtract 1h
  const offsetHours = localHour - 7;
  const targetUtc = new Date(refUtc.getTime() - offsetHours * 60 * 60 * 1000);

  return targetUtc.toISOString();
}
```

- [ ] **Step 2: Commit**

```bash
git add supabase/functions/process-notifications/index.ts
git commit -m "fix(notifications): correct timezone handling for quiet hours deferral

getNext7am now properly computes 07:00 in the recipient's timezone
using Intl.DateTimeFormat offset detection, instead of defaulting
to UTC 07:00.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: Add PUSH_DISPATCH_SECRET to .env.template

**Files:**

- Modify: `.env.template`

**Context:** The process-notifications consumer reads `PUSH_DISPATCH_SECRET` at line 290 but it's missing from the env template.

- [ ] **Step 1: Add to .env.template**

Find the notifications section (or add near other Edge Function secrets) and add:

```
PUSH_DISPATCH_SECRET=op://smartout_ai/PUSH_DISPATCH_SECRET/credential
```

- [ ] **Step 2: Commit**

```bash
git add .env.template
git commit -m "chore: add PUSH_DISPATCH_SECRET to env template

Referenced by process-notifications EF but was missing from
the template. Uses op:// reference per env protocol.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: Typecheck + final verification

**Files:** None (verification only)

- [ ] **Step 1: Run full typecheck**

```bash
pnpm turbo typecheck
```

Expected: 0 errors across all packages.

- [ ] **Step 2: Verify event config sync**

Manually compare `packages/notifications/src/event-config.ts` and `supabase/functions/_shared/event-config.ts` to ensure they are identical (minus the sync comment).

```bash
diff <(tail -n +8 packages/notifications/src/event-config.ts) <(tail -n +8 supabase/functions/_shared/event-config.ts)
```

Expected: no differences.

- [ ] **Step 3: Verify migration can be re-run (idempotent check)**

```bash
docker exec -i $(docker ps -q -f name=supabase_db) psql -U postgres < supabase/migrations/20260427200000_notification_outbox_reliability.sql
```

Expected: no errors (IF NOT EXISTS guards should handle re-run).

---

## Summary

| Task | Group | What                                                              | Commits |
| ---- | ----- | ----------------------------------------------------------------- | ------- |
| 1    | A     | Migration: retry_count, updated_at, RLS, RPC                      | 1       |
| 2    | A     | Consumer: use RPC, retry logic                                    | 1       |
| 3    | B     | Event config: rename fields, add engine entries, create \_shared/ | 1       |
| 4    | B     | Consumer: title resolution, grouping text                         | 1       |
| 5    | C     | Consumer: email delivery via SendGrid                             | 1       |
| 6    | C     | Consumer: timezone fix                                            | 1       |
| 7    | —     | Env template: add PUSH_DISPATCH_SECRET                            | 1       |
| 8    | —     | Typecheck + verification                                          | 0       |
