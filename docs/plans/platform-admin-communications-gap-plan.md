---
title: Platform Admin Communications — Gap Plan
status: draft
created: 2026-04-13
updated: 2026-04-13
module: platform-admin
tags: [communications, multi-channel, gap-plan, notifications]
---

# Platform Admin Communications — Gap Plan

> **Goal:** Platform Admin can contact and write messages to any workspace or user through every available channel — email, SMS, push, in-app notification, and channel message — from a single unified communications hub.

---

## Current State

### What Works (Backend)

| Channel | Package/Function | Status |
|---------|-----------------|--------|
| **Email** | `@smartout/notifications` → `createEmailJob()` → SendGrid | Production-ready |
| **SMS** | `@smartout/notifications` → `sendSms()` / `sendSmsBatch()` → Twilio | Production-ready |
| **Push** | Edge Function `push-dispatch` → Expo Push API | Production-ready |
| **In-App** | `insertOutboxNotification()` → `notification_outbox` → `process-notifications` EF | Production-ready |
| **Channel Messages** | `channel` + `channel_message` tables, full schema with reactions/attachments/threading | Schema exists, no platform admin write path |

### What Works (Platform Admin UI)

| Feature | Status | Notes |
|---------|--------|-------|
| Email Quick Send (sheet) | ✅ Working | 4 preset audiences + custom |
| Email Compose (full page) | ✅ Working | SendGrid dynamic templates, AI correction, preview |
| Email History (data table) | ✅ Working | Delivery + engagement metrics |
| Email Templates (editor) | ✅ Working | Section builder, save/load |
| Engagement Reports | ✅ Working | Open/click tracking from SendGrid webhooks |
| Audience Selector | ⚠️ Partial | Missing: workspace picker, department filter, user search |
| Suppression Display | ⚠️ Display-only | Shows count, no management UI |

---

## Gap Analysis

### GAP 1: Channel Selector — No way to choose delivery channel

**Problem:** Compose UI is hardwired to email. The `send` API route only calls `createEmailJob()`. No path to SMS, push, or in-app from Platform Admin.

**Backend ready:** Yes — `sendSmsBatch()`, `push-dispatch` EF, `insertOutboxNotification()` all exist.

**What to build:**
- [ ] Add channel picker to compose UI: `email` | `sms` | `push` | `in-app` | `channel-message`
- [ ] Allow multi-channel selection (send same content via email + push + in-app simultaneously)
- [ ] Create unified `POST /api/platform-admin/communications/send` that routes to the right backend based on selected channels
- [ ] Each channel gets appropriate content field (email = rich HTML, SMS = plain text with char limit, push = title + short body, in-app = title + body + action_url)

**Priority:** P0 — this is the core gap

---

### GAP 2: Audience Selector — Incomplete targeting

**Problem:** The audience selector (`audience-selector.tsx`) has these gaps:

| Filter | Type exists | UI exists | Notes |
|--------|------------|-----------|-------|
| All Users | ✅ | ✅ | |
| Super Admins | ✅ | ✅ | |
| By Workspace | ✅ | ⚠️ | Shows placeholder: "Workspace selector to be connected to workspace list API" |
| By Department | ✅ | ❌ | `department` filter type in backend, no UI |
| By Role | ✅ | ✅ | |
| By Status | ✅ | ✅ | |
| Individual Users | ✅ | ❌ | `user_ids` type exists, no search/select UI |
| By Team | ❌ | ❌ | Not in type definition |

**What to build:**
- [ ] Connect workspace selector to real workspace list API (currently placeholder text)
- [ ] Add workspace search/autocomplete component
- [ ] Add department filter (workspace → department cascade dropdown)
- [ ] Add individual user search with multi-select (name/email search → `user_ids` filter)
- [ ] Add team filter option
- [ ] Add combined filters (e.g., "all managers in workspace X, department Y")
- [ ] Show recipient count preview as filters are selected (dry-run on change)

**Priority:** P0 — can't effectively target messages without this

---

### GAP 3: SMS Compose — No SMS sending UI

**Problem:** `sendSms()` and `sendSmsBatch()` exist in `packages/notifications/src/sms-service.ts` with Twilio credentials from Vault. No UI to use them.

**What to build:**
- [ ] SMS compose view (plain text, 160-char counter, segment indicator)
- [ ] Phone number resolution from audience (requires profile.phone lookup)
- [ ] SMS preview before send
- [ ] SMS delivery tracking (Twilio status callbacks → webhook)
- [ ] SMS history in communication log (extend `platform_communication_log` with `provider: 'twilio'`)
- [ ] SMS cost estimation before send (Twilio pricing per segment)

**Priority:** P1 — SMS is a secondary channel but critical for urgent messages

---

### GAP 4: Push Notification Compose — No push UI

**Problem:** `push-dispatch` Edge Function exists and works for automated events. No way for Platform Admin to send ad-hoc push notifications.

**What to build:**
- [ ] Push compose view (title max 50 chars, body max 200 chars, action URL)
- [ ] Push preview (mock mobile notification)
- [ ] API route that calls `push-dispatch` EF with platform admin auth
- [ ] Push token availability check (show how many users have active push tokens vs. not)
- [ ] Push delivery tracking

**Priority:** P1 — push is the highest-engagement channel

---

### GAP 5: In-App Notification Broadcast — No in-app compose

**Problem:** `insertOutboxNotification()` works for event-driven notifications. No way for Platform Admin to broadcast in-app messages to a filtered audience.

**What to build:**
- [ ] In-app notification compose (title, body, action_url, icon selector, priority)
- [ ] API route that bulk-inserts into `notification_outbox` for resolved audience
- [ ] In-app notification preview (mock notification bell item)
- [ ] Set custom `mode` (training/work/community) for proper categorization

**Priority:** P1 — least-friction channel for non-urgent announcements

---

### GAP 6: Channel Message Broadcasting — No workspace channel posting

**Problem:** Full `channel` + `channel_message` schema exists (department, team, news, custom channels). No Platform Admin UI to post messages into workspace channels.

**What to build:**
- [ ] Channel browser: list all channels across workspaces (filterable by type: news, department, team)
- [ ] Channel message composer (supports message types: announcement, reminder, brief)
- [ ] Post as "system" origin (not impersonating a user)
- [ ] Workspace → channel cascade selector
- [ ] Cross-workspace broadcast to all `news` channels simultaneously
- [ ] Attachment support (files, images)
- [ ] Pin option for important messages
- [ ] Delivery confirmation (channel_message_read tracking)

**Priority:** P2 — powerful feature but requires more design work

---

### GAP 7: Unified Communication History — Email-only history

**Problem:** `platform_communication_log` only tracks email sends. SMS, push, in-app, and channel messages have no unified history view.

**What to build:**
- [ ] Extend `platform_communication_log` schema: add `channel` column (email/sms/push/in_app/channel_message)
- [ ] Or create unified view joining email log + notification_outbox + channel_message where origin='system'
- [ ] Update history data table to show channel type with icon
- [ ] Filter history by channel type
- [ ] Aggregate delivery metrics across channels for multi-channel sends
- [ ] Link multi-channel sends with a shared `campaign_id`

**Priority:** P1 — can't operate without visibility

---

### GAP 8: Suppression & Preference Management — Display-only

**Problem:** Shows suppression count but no way to manage. No view of user notification preferences.

**What to build:**
- [ ] Suppression list viewer (search, filter by reason: bounce/unsubscribe/complaint/manual)
- [ ] Manual add/remove from suppression list
- [ ] User preference viewer (per-user: which channels enabled, quiet hours, category toggles)
- [ ] Bulk preference overrides (platform admin can toggle channels for compliance)
- [ ] Opt-out compliance report

**Priority:** P2 — operational necessity for compliance

---

### GAP 9: Scheduled Sends — Everything is immediate

**Problem:** No way to schedule a communication for a future time.

**What to build:**
- [ ] Add datetime picker to compose ("Send now" vs. "Schedule for")
- [ ] `scheduled_for` column on `platform_communication_log` (already exists on `notification_outbox`)
- [ ] Cron job or pg_cron to process scheduled communications
- [ ] Scheduled sends queue view (pending, edit, cancel)
- [ ] Timezone-aware scheduling

**Priority:** P2 — nice to have, not blocking

---

### GAP 10: Template System for Non-Email — Email-only templates

**Problem:** `platform_email_template` table and template editor only support email. No templates for SMS, push, or in-app.

**What to build:**
- [ ] Extend template system to be channel-aware (or create `platform_message_template` with channel column)
- [ ] SMS template editor (plain text, placeholder variables, character limit)
- [ ] Push template editor (title + body + action URL placeholders)
- [ ] In-app template editor (title + body + icon + priority)
- [ ] Template library grouped by channel with preview

**Priority:** P3 — templates are a workflow accelerator, not a blocker

---

## Implementation Order

```
Phase 1 — Multi-Channel Foundation (P0)
├── GAP 2: Fix audience selector (workspace picker, department, user search)
├── GAP 1: Add channel selector to compose UI
└── GAP 7: Unified communication history (extend log schema)

Phase 2 — Channel Implementations (P1)
├── GAP 3: SMS compose + send
├── GAP 4: Push notification compose + send
├── GAP 5: In-app notification broadcast
└── GAP 7: History view updates

Phase 3 — Advanced Features (P2-P3)
├── GAP 6: Channel message broadcasting
├── GAP 8: Suppression & preference management
├── GAP 9: Scheduled sends
└── GAP 10: Multi-channel template system
```

---

## Architecture Decision Needed

**Single compose vs. per-channel compose?**

Option A: **Single unified compose page** — one form, channel selector at top, content adapts per channel (shows char limit for SMS, rich editor for email, etc.). Multi-channel sends create one log entry with multiple deliveries.

Option B: **Tab-per-channel** — Communications page gets tabs: Email | SMS | Push | In-App | Channels. Each tab has its own compose flow optimized for that channel.

**Recommendation:** Option A for the compose flow (unified), Option B for the history view (filtered tabs). This gives the best UX: compose once, deliver everywhere — but review results per channel.

---

## Database Changes Required

```sql
-- 1. Extend platform_communication_log
ALTER TABLE platform_communication_log
  ADD COLUMN channel TEXT NOT NULL DEFAULT 'email',  -- email | sms | push | in_app | channel_message
  ADD COLUMN campaign_id UUID,                       -- links multi-channel sends
  ADD COLUMN scheduled_for TIMESTAMPTZ;              -- NULL = immediate

-- 2. Add platform_communication_channel_result (per-channel delivery tracking for multi-channel sends)
CREATE TABLE platform_communication_channel_result (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  communication_id UUID NOT NULL REFERENCES platform_communication_log(communication_id),
  channel TEXT NOT NULL,              -- email | sms | push | in_app
  recipient_count INT DEFAULT 0,
  sent_count INT DEFAULT 0,
  failed_count INT DEFAULT 0,
  provider TEXT,                      -- sendgrid | twilio | expo | internal
  provider_batch_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Index for campaign grouping
CREATE INDEX idx_comm_log_campaign ON platform_communication_log(campaign_id) WHERE campaign_id IS NOT NULL;
```

---

## API Routes Needed

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/platform-admin/communications/send` | POST | Extend existing — add `channels[]` field |
| `/api/platform-admin/communications/sms/send` | POST | SMS-specific send (or unified route handles it) |
| `/api/platform-admin/communications/push/send` | POST | Push-specific send |
| `/api/platform-admin/communications/in-app/broadcast` | POST | Bulk in-app notification insert |
| `/api/platform-admin/communications/channels` | GET | List all workspace channels |
| `/api/platform-admin/communications/channels/[id]/post` | POST | Post message to channel |
| `/api/platform-admin/workspaces/search` | GET | Workspace search for audience selector |
| `/api/platform-admin/users/search` | GET | User search for audience selector |
| `/api/platform-admin/communications/suppressions` | GET/DELETE | Manage suppression list |
| `/api/platform-admin/communications/schedule` | POST/GET/DELETE | Manage scheduled sends |

---

## Files to Create/Modify

### New Files
- `apps/web/src/app/platform-admin/communications/_components/channel-selector.tsx`
- `apps/web/src/app/platform-admin/communications/_components/sms-compose.tsx`
- `apps/web/src/app/platform-admin/communications/_components/push-compose.tsx`
- `apps/web/src/app/platform-admin/communications/_components/in-app-compose.tsx`
- `apps/web/src/app/platform-admin/communications/_components/channel-message-compose.tsx`
- `apps/web/src/app/platform-admin/communications/_components/unified-compose.tsx`
- `apps/web/src/app/platform-admin/communications/suppressions/page.tsx`
- `apps/web/src/app/platform-admin/communications/scheduled/page.tsx`
- `apps/web/src/components/platform-admin/workspace-search.tsx`
- `apps/web/src/components/platform-admin/user-search.tsx`
- `apps/web/src/app/api/platform-admin/communications/push/send/route.ts`
- `apps/web/src/app/api/platform-admin/communications/in-app/broadcast/route.ts`
- `apps/web/src/app/api/platform-admin/communications/channels/route.ts`
- `apps/web/src/app/api/platform-admin/communications/channels/[id]/post/route.ts`
- `apps/web/src/app/api/platform-admin/users/search/route.ts`
- `apps/web/src/app/api/platform-admin/workspaces/search/route.ts`

### Modify
- `apps/web/src/components/platform-admin/audience-selector.tsx` — add workspace picker, department, user search
- `apps/web/src/components/platform-admin/compose-email-sheet.tsx` → rename to `compose-sheet.tsx`, add channel support
- `apps/web/src/app/platform-admin/communications/_components/communications-client.tsx` — add channel filter tabs to history
- `apps/web/src/app/platform-admin/communications/page.tsx` — add channel stats cards
- `apps/web/src/app/api/platform-admin/communications/send/route.ts` — extend for multi-channel
- `packages/notifications/src/audiences.ts` — add department + team resolution
- `packages/notifications/src/types.ts` — extend AudienceFilter with department + team

### Migrations
- `supabase/migrations/YYYYMMDDHHMMSS_platform_comm_multi_channel.sql`

---

## Acceptance Criteria

When complete, Platform Admin can:

1. **Select any channel** (email, SMS, push, in-app, channel message) or multiple channels
2. **Target any audience**: all users, by workspace, by department, by team, by role, by status, or individual users by search
3. **Compose appropriate content** per channel (rich email, 160-char SMS, short push, in-app with action URL)
4. **Preview before sending** with recipient count and content preview per channel
5. **Dry-run** to validate audience without sending
6. **View unified history** of all communications across all channels
7. **Manage suppressions** (view, add, remove bounced/unsubscribed emails)
8. **Schedule sends** for future delivery
9. **Post directly to workspace channels** (news, department, team) as system announcements

---

## Decisions (confirmed 2026-04-14)

1. **Channel message identity** — Posts appear as **"Smartout"** (system origin). Platform admin acts on behalf of the platform, not themselves.
2. **SMS cost visibility** — **Yes.** Show estimated cost before sending: `{count} recipients × {segments} segments ≈ {cost} NOK`.
3. **Push without token** — **Auto-fallback to email for priority ≥ 1.** Normal priority (0) = skip silently. High/critical = email fallback.
4. **Workspace admin notifications** — **Yes, in-app only.** Quiet notification so workspace admins know their users received a platform message.
5. **Rate limits per channel** — **SMS: 500/hour. Push: 5,000/hour.** Email keeps existing 100k soft / 500k hard caps.
6. **Priority override** — **Yes, critical only (priority 2).** Checkbox: "Override quiet hours (critical only)". Normal/high = respect quiet hours.
7. **Channel message replies** — **No replies in v1.** System messages are read-only. Users can react (emoji) but not reply. V2 may add discussion threads.
