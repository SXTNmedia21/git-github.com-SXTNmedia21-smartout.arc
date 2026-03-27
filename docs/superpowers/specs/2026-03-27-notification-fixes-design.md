---
title: "Notification System Fixes — Targeted Fix Plan"
status: approved
updated: 2026-03-27
created: 2026-03-27
module: notifications
tags: [notifications, fixes, outbox, consumer, reliability, council-approved]
---

# Notification System Fixes — Targeted Fix Plan

> Council-reviewed 2026-03-27. Verdict: APPROVE WITH CHANGES.
> Original spec: `docs/superpowers/specs/2026-03-24-notification-system-design.md`
> Original plan (completed): `docs/superpowers/plans/completed/2026-03-24-notification-system.md`

## Background

The notification system was built per spec and the plan was marked `done`. An audit on 2026-03-27 found 8 issues. A System Council reviewed the fix plan and approved with changes. Fix 1 (API route) was eliminated. Fix 7 (i18n) deferred to separate PR.

## What Exists (verified)

- `notification` table + RLS + Realtime (migration `20260324220000`)
- `notification_outbox` + `notification_preference` tables (migration `00006`)
- 6 DB triggers refactored to outbox INSERT (migration `20260324230000`)
- `process-notifications` EF (340 lines — outbox consumer)
- `send-morning-digest` EF (230 lines)
- `send_notification` handler in engine-dispatch → outbox INSERT
- Event config registry: 15 events in `packages/notifications/src/event-config.ts`
- NotificationBell + popover + notifications page + data hooks + mobile components
- NotificationPreferences settings component
- Realtime subscription + browser notifications

## Eliminated

**Fix 1 (API route `/api/notifications/outbox`)** — ELIMINATED by council. No recipient resolution model exists. The telemetry `notifications` destination currently fires at a no-op route. The no-op stays. When push notifications are built as a full feature, recipient resolution will be designed properly.

## Deferred

**Fix 7 (i18n hardcoded Norwegian)** — Separate PR. ~30 strings across NotificationBell, NotificationPreferences, notifications page, and send-morning-digest. Do not bundle with reliability fixes.

---

## Build Groups

### Group A: Foundation (one PR, lands first)

**Migration: `YYYYMMDDHHMMSS_notification_outbox_reliability.sql`**

1. Add `retry_count smallint NOT NULL DEFAULT 0` to `notification_outbox`
2. Add `updated_at timestamptz NOT NULL DEFAULT now()` to `notification_outbox`
3. Add `set_updated_at()` trigger on `notification_outbox`
4. Tighten RLS — replace `"System manages outbox" FOR ALL WITH CHECK (TRUE)` with:
   - `FOR INSERT` restricted (only reachable by service_role or SECURITY DEFINER triggers)
   - `FOR SELECT` scoped to workspace members (consumer uses service_role anyway)
   - `FOR UPDATE` restricted to service_role
5. Create `fetch_pending_outbox(p_batch_size int)` RPC:
   - SELECT with `FOR UPDATE SKIP LOCKED`
   - Includes `status = 'pending' AND scheduled_for <= now()` OR `status = 'failed' AND retry_count < 3`
   - Marks selected rows as `status = 'processing'`
   - Returns the rows
   - Also resets rows stuck in `processing` for > 5 minutes back to `pending` (staleness recovery)

**Consumer update: `supabase/functions/process-notifications/index.ts`**

6. Replace plain SELECT with `supabase.rpc('fetch_pending_outbox', { p_batch_size: 100 })`
7. On delivery failure: `UPDATE SET status = 'failed', retry_count = retry_count + 1, error_log = ...`
8. On 3rd failure (retry_count >= 3): `UPDATE SET status = 'suppressed'`
9. On success: `UPDATE SET status = 'delivered', processed_at = now()`

### Group B: Routing & Content (one PR, lands after Group A)

**Event config expansion:**

1. Create `supabase/functions/_shared/event-config.ts` — copy of `packages/notifications/src/event-config.ts` with a `// SYNC` comment pointing to the package source. This is the Deno-importable version.
2. Add 6 engine template entries to the registry:

| event_key                        | mode     | priority | icon     | channels            |
| -------------------------------- | -------- | -------- | -------- | ------------------- |
| `engine.reconciliation_feedback` | work     | 0        | approval | push, in_app        |
| `engine.day_closed`              | work     | 0        | info     | in_app              |
| `engine.workspace_ready`         | work     | 1        | info     | push, email, in_app |
| `engine.onboarding_welcome`      | training | 0        | training | push, email, in_app |
| `engine.onboarding_complete`     | training | 1        | training | push, email, in_app |
| `engine.session_hook_task`       | work     | 0        | task     | push, in_app        |

**Consumer title resolution:**

3. Import event config from `_shared/event-config.ts`
4. When processing an outbox row:
   - Read `metadata.event_key`
   - Look up in registry: `getEventConfig(eventKey)`
   - If found: use `title_key` and `body_key` as template strings, interpolate with metadata
   - If not found: log warning, use raw `row.title` and `row.body` as-is (defensive fallback)
   - Store resolved title/body in the `notification` INSERT

**Title key semantics decision:**

The `title_key` and `body_key` fields in event-config currently store i18n dotted keys (e.g., `notifications.shift.published.title`). For Edge Function rendering (no i18n runtime available), these must be changed to **interpolatable template strings** with `{variable}` placeholders.

Example:

```typescript
// BEFORE (broken in EF context)
title_key: "notifications.shift.published.title"

// AFTER (works in EF context)
title_template: "Ny vakt {date} kl {start_time}",
body_template: "Du har fått en vakt i {department_name}",
```

This means renaming `title_key` → `title_template` and `body_key` → `body_template` in the event config type and all 21 entries. The i18n keys can be added as a separate `title_i18n_key` field for client-side rendering in Fix 7.

**Grouping body text (Fix 8):**

5. When smart grouping merges notifications, format body as:
   - `"{count} nye varsler i {group_context}"` for grouped notifications
   - Use metadata to determine group context (department name, chat channel, etc.)

### Group C: Delivery (one PR, lands after Group B)

**Email delivery (Fix 5):**

1. In `process-notifications/index.ts`, replace `console.log("[email] Would send...")` with actual SendGrid API call
2. Follow the same pattern as `send-morning-digest/index.ts` (inline `fetch` to `api.sendgrid.com/v3/mail/send`)
3. Use `SENDGRID_API_KEY` env var (already available to Edge Functions)
4. Email content: plain text with title + body + action_url link

**Timezone fix (Fix 6):**

5. In `getNext7am()`, construct the target time explicitly in the recipient's timezone
6. Use UTC offset calculation: get current UTC offset for the timezone, construct `07:00` in that offset, convert to UTC Date
7. Handle DST transitions (Europe/Oslo is UTC+1 in winter, UTC+2 in summer)

---

## Environment Variables

| Variable               | Action                 | Notes                                                         |
| ---------------------- | ---------------------- | ------------------------------------------------------------- |
| `PUSH_DISPATCH_SECRET` | Add to `.env.template` | Referenced in process-notifications but missing from template |

---

## Files Modified

| File                                                                     | Group | Change                                                  |
| ------------------------------------------------------------------------ | ----- | ------------------------------------------------------- |
| `supabase/migrations/YYYYMMDDHHMMSS_notification_outbox_reliability.sql` | A     | New migration: retry_count, updated_at, RLS, RPC        |
| `supabase/functions/process-notifications/index.ts`                      | A+B+C | Row locking, retry, title resolution, email, timezone   |
| `supabase/functions/_shared/event-config.ts`                             | B     | New file: Deno-importable event config                  |
| `packages/notifications/src/event-config.ts`                             | B     | Rename title_key → title_template, add 6 engine entries |
| `packages/notifications/src/outbox.ts`                                   | B     | Update to use title_template field                      |
| `.env.template`                                                          | A     | Add PUSH_DISPATCH_SECRET                                |

## Files NOT Modified

- `apps/web/src/components/dashboard/NotificationBell.tsx` — i18n deferred to Fix 7 PR
- `apps/web/src/app/dashboard/notifications/page.tsx` — i18n deferred
- `apps/web/src/app/dashboard/settings/_components/NotificationPreferences.tsx` — i18n deferred
- `apps/web/src/app/api/notifications/outbox/route.ts` — Fix 1 eliminated, no-op stays

---

## Risks

| Risk                                                                        | Severity | Mitigation                                                          |
| --------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------- |
| Engine notifications break if Group B ships without engine template entries | CRITICAL | Engine entries are step 2 of Group B — mandatory prerequisite       |
| Stuck rows from consumer crash                                              | MEDIUM   | Staleness recovery in fetch_pending_outbox RPC resets after 5 min   |
| Outbox RLS blocks cron consumer                                             | MEDIUM   | Consumer uses service_role — verify it bypasses new RLS             |
| Duplicate sends on retry                                                    | LOW      | Row locking (FOR UPDATE SKIP LOCKED) prevents concurrent processing |

## Council Conditions (all addressed)

1. ~~Tighten outbox RLS~~ → Group A, step 4
2. ~~Resolve i18n key vs template ambiguity~~ → Group B, title_template rename
3. ~~Use \_shared/ for event config~~ → Group B, step 1
4. ~~Add staleness recovery~~ → Group A, step 5
5. ~~Specify recipient resolution for Fix 1~~ → Fix 1 eliminated
6. ~~Expand Fix 7 scope~~ → Deferred to separate PR (includes morning digest)
7. ~~Add PUSH_DISPATCH_SECRET~~ → Group A env vars
