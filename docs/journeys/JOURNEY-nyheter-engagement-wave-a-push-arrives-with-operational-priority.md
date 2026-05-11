---
title: "Journey — Push notification arrives at operational priority"
feature: nyheter-engagement-wave-a
journey: push-arrives-with-operational-priority
status: draft
verified_at: null
e2e_test: apps/e2e/komm-nyheter/journey-1-priority-bump.spec.ts
created: 2026-05-11
updated: 2026-05-11
module: MODULE_COMMUNICATION
tags: [journey, notification, trigger, priority]
---

# Journey: Push notification arrives at operational priority

**Role:** notification dispatch system + recipient employee

**Precondition:**
- Notification dispatch path running (Edge Function `process-notifications` polling `notification_outbox`)
- Channel members exist for the news channel
- Recipient has `notification_preference.work_enabled=true` (default)

## Happy Path

1. Manager (or QuickBroadcast caller) inserts row into `channel_message` with `message_type='announcement'`
2. `trigger_channel_message_notification()` fires AFTER INSERT — branches on `NEW.message_type`:
   - `'announcement'` → `v_priority := 1; v_mode := 'work'`
   - else → `v_priority := 0; v_mode := 'community'` (preserves prior behavior)
3. Trigger inserts one row per non-muted, non-left channel member into `notification_outbox` with:
   - `priority = 1`
   - `mode = 'work'`
   - `metadata.event_key = 'announcement.published'`
   - `metadata.message_type = 'announcement'`
   - `metadata.message_id = NEW.id`
   - `allowed_channels = ARRAY['push', 'in_app']`
4. `process-notifications` Edge Function polls outbox, reads row
5. Quiet-hours check (`row.priority < 2` defers in quiet hours) — `priority=1` STILL defers (matches existing announcement priority semantics; SMS `priority=2` only path). Push delivery proceeds outside quiet hours.
6. Mode check (`isModeEnabled(pref, 'work')`) — routes through `notification_preference.work_enabled` toggle (default true). Recipients who opted out of community chat via `community_enabled=false` BUT kept `work_enabled=true` will now receive announcement pushes.
7. Push delivered to recipient device via configured push provider (existing path)
8. In-app notification appears in NotificationBell

**Postcondition:**
- `notification_outbox` row exists per recipient with `priority=1, mode='work'`
- Audit trail: `notification_outbox.status` advances `pending → processing → delivered` per existing dispatch
- Recipient receives push outside quiet hours; community-mode chat would have been suppressed

## Error Paths

- **Recipient muted channel via `channel_member.is_muted=true`:** trigger skips that recipient (existing logic at `cm.is_muted = FALSE` filter)
- **Recipient already left channel (`left_at` not null):** trigger skips
- **Recipient has `work_enabled=false`:** `process-notifications` filters; no push fires
- **Trigger throws (e.g. workspace_id resolve fails):** EXCEPTION handler returns NEW; message INSERT succeeds, notification just doesn't fire (existing fail-safe behavior preserved)

## Verification

- [ ] pgTAP `supabase/tests/announcement_notification_priority_test.sql` passes 4 assertions (2 for announcement, 2 for text fallback)
- [ ] E2E `apps/e2e/komm-nyheter/journey-1-priority-bump.spec.ts` verifies via service-role read of `notification_outbox`
- [ ] Manual smoke: insert an announcement on dev workspace; verify with `psql -c "SELECT priority, mode, metadata FROM notification_outbox ORDER BY scheduled_for DESC LIMIT 5;"`
- [ ] QuickBroadcast side-effect verified — broadcast from dashboard FAB also produces `priority=1, mode='work'` rows (intended scope expansion)

**Mark `status: verified` in frontmatter when all four boxes are checked.**
