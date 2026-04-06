---
title: "Journey — Council Review Fixes"
status: done
updated: 2026-04-06
created: 2026-04-06
module: cross-cutting
tags: [council, code-review, migrations, type-safety, i18n]
---

# Journey: Council Review Fixes

Fixes identified by System Council review of two merged branches (feat/mobile-production-readiness and feat/production-gaps-tier1).

---

## Journey: Developer merges safe migrations to production

**Precondition:** shift_clock_config and shift_note tables exist (created by earlier migrations)

1. Developer runs `npx supabase db push` or applies migrations in order
2. Migration 20260406100000 runs `CREATE TABLE IF NOT EXISTS shift_clock_config` with ON DELETE CASCADE FKs
3. If table already exists -> no-op (data preserved). If missing -> table created fresh.
4. Trigger, RLS, and policies are idempotently recreated (DROP IF EXISTS + CREATE)
5. Migration 20260406100001 does the same for shift_note, including restored UPDATE policy
6. Developer verifies: `SELECT polname FROM pg_policy WHERE polrelid = 'shift_note'::regclass`

**Postcondition:** Both tables exist with correct FK constraints, RLS enabled, all policies (SELECT, INSERT, UPDATE for shift_note, ALL for shift_clock_config admin). No data loss.

**Error paths:**

- If referenced tables (workspace, department, team, schedule_shift, profile) don't exist -> FK error. Must run earlier migrations first.
- If set_updated_at() function doesn't exist -> trigger creation fails. Function created in earlier migration.

---

## Journey: Agent sends a message via Botsson

**Precondition:** Employee is authenticated, has an active agent session, and is a member of a channel

1. Employee asks Botsson to send a message to a channel
2. Agent calls sendMessage tool with channel_id and content
3. Tool verifies membership via channel_member query
4. Tool inserts channel_message row
5. Tool emits engine_event with type "channel_message.sent" (audit trail)
6. Tool returns confirmation to agent

**Postcondition:** Message exists in channel_message. engine_event record exists for audit/telemetry.

**Error paths:**

- Employee not a member of channel -> "You are not a member of this channel"
- Insert fails -> error message returned to agent
- emit() fails -> message still sent (emit is fire-and-forget in current pattern)

---

## Journey: Employee edits a shift note

**Precondition:** Employee has previously created a shift note for one of their shifts

1. Employee opens shift detail view
2. Employee edits their note content
3. Supabase client sends UPDATE to shift_note
4. RLS policy jwt_update_shift_note verifies profile_id matches auth.uid()
5. Update succeeds, updated_at trigger fires

**Postcondition:** Note content is updated, updated_at timestamp refreshed.

**Error paths:**

- Employee tries to edit another employee's note -> RLS blocks (policy checks profile_id)
- Note doesn't exist -> no rows affected

---

## Journey: Admin views ActivityView dashboard

**Precondition:** Admin is logged in, on the dashboard

1. Admin navigates to Activity view
2. Page renders with translated heading (t("activity.title"))
3. Icon uses warm-spectrum semantic color (bg-primary/10 text-primary)
4. Activity feed loads from activity_trail
5. Empty state shows translated message (t("activity.empty"))
6. Warning dots on late/deviation entries use semantic color (bg-destructive)
7. Norwegian users see all text in Norwegian, English users see English

**Postcondition:** Activity view renders with design-system-compliant colors and translated text.

**Error paths:**

- No activity data -> empty state message displayed
- i18n key missing -> falls back to key name (standard i18n behavior)
