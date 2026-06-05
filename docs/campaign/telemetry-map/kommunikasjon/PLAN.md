---
title: Sortie Plan — kommunikasjon telemetry wiring
status: draft
updated: 2026-05-31
created: 2026-05-31
module: redesign-wiring
tags: [plan, kommunikasjon, telemetry, wiring]
---

# Sortie Plan — kommunikasjon telemetry wiring

**DoD gate:** `control.json` → `gate: PASS` (all 5 control_points true).

This plan is ordered by risk: mutations with registry coverage first, missing events second, hollow/deferred last.

---

## Phase 1 — Wire existing registry events to real hooks (5 items)

These mutations already have telemetry events in the registry. The gap is that the design uses local mock state. Phase 1 replaces mock state with the real hook and confirms the event fires.

### P1-A: Publish announcement → `channel.message.sent`

- **Element:** KoCompose "Publiser" / "Republiser" (element #33)
- **Event:** `channel.message.sent` — emitted via `emitAnnouncementPublished` helper
- **Hook:** `use-send-announcement` → `publish_announcement_atomic` RPC
- **Task:**
  1. Import `useSendAnnouncement` in the kommunikasjon page implementation.
  2. Replace `upsertAnn(payload, "published")` mock with hook mutation.
  3. Confirm PostHog receives `channel.message.sent` with `origin_type: "human"`.
- **DoD:** Hook mutation completes; `channel.message.sent` visible in PostHog.

### P1-B: Pin / Unpin announcement → `channel.message.pinned` / `channel.message.unpinned`

- **Elements:** Pin toggle in AnnRow (#22), pin toggle in KoDetail footer (#37)
- **Event:** `channel.message.pinned` / `channel.message.unpinned` — emit is co-located in capability tool body (ADR-0415)
- **Hook:** `use-pin-message` → `pin-message-action` server action
- **Task:**
  1. Import `usePinMessage` in the kommunikasjon page implementation.
  2. Replace `togglePin(ann)` local state mutation with hook.
  3. Note: emit is NOT in the hook's `onSuccess` — it lives in the capability tool body. Confirm the action wires emit correctly.
- **DoD:** Pin action persists; events appear in activity trail.

### P1-C: Create channel → `channel.created`

- **Element:** KoChannelModal "Opprett kanal" (#49, create mode)
- **Event:** `channel.created`
- **Hook:** `use-create-channel`
- **Task:**
  1. Import `useCreateChannel`.
  2. Replace `upsertChannel(payload)` (create path) with hook.
  3. Confirm event fires with `channel_type` and `name`.
- **DoD:** Channel created in DB; `channel.created` emitted.

### P1-D: Archive channel → `channel.archived`

- **Element:** Confirm modal "Arkivér" for channel (#46, archive path)
- **Event:** `channel.archived`
- **Hook:** No dedicated `useArchiveChannel` hook exists. Must be created or a server action written.
- **Task:**
  1. Create `useArchiveChannel` hook (or inline server action).
  2. Replace `toggleArchiveChannel(c)` (archive path only) with hook.
  3. Emit `channel.archived` with `channel_type`.
- **DoD:** Channel archived in DB; `channel.archived` emitted.

### P1-E: Resolve helpdesk case → `helpdesk.query.resolved`

- **Element:** KoCaseDrawer "Løs sak" (#72)
- **Event:** `helpdesk.query.resolved`
- **Hook:** No `useResolveCase` hook. Must be created.
- **Task:**
  1. Create `useResolveCase` hook calling the helpdesk resolve action/RPC.
  2. Replace `resolveCase(c)` local state with hook.
  3. Emit `helpdesk.query.resolved` with `channel_id` and `has_resolution_note`.
- **DoD:** Case status updated in DB; `helpdesk.query.resolved` emitted.

### P1-F: Reassign helpdesk case → `helpdesk.query.reassigned`

- **Element:** KoCaseDrawer "Tildel" popover (#70)
- **Event:** `helpdesk.query.reassigned`
- **Hook:** No `useReassignCase` hook. Must be created.
- **Task:**
  1. Create `useReassignCase` hook.
  2. Replace `reassign(c, ownerId)` local state with hook.
  3. Emit `helpdesk.query.reassigned` with `from_profile_id`, `to_profile_id`.
- **DoD:** Reassignment persisted in DB; event emitted.

### P1-G: Create / configure skranke → `channel.helpdesk.enabled`

- **Element:** KoDeskModal "Opprett skranke" / "Lagre" (#86)
- **Event:** `channel.helpdesk.enabled`
- **Hook:** No `useConfigureDesk` hook. Must be created or call existing channel settings action.
- **Task:**
  1. Create `useConfigureDesk` hook.
  2. Replace `upsertDesk(payload)` with hook.
  3. Emit `channel.helpdesk.enabled` with `preset`, `rep_count`, `has_description`.
- **DoD:** Desk config persisted; event emitted.

---

## Phase 2 — Register missing events + wire mutations (7 events to add)

These mutations exist in the design but have NO matching event in the registry. Registry entries must be added FIRST (PR to `packages/telemetry/src/registry.ts`), then hooks and emit call-sites.

| Priority | Element                                      | Missing event                                 | Notes                                                                                |
| -------- | -------------------------------------------- | --------------------------------------------- | ------------------------------------------------------------------------------------ |
| HIGH     | Publish as draft (#31)                       | `announcement.draft_saved`                    | `use-send-announcement` sig needs `status=draft`; RPC may not support scheduled path |
| HIGH     | Schedule announcement (#32)                  | `announcement.scheduled`                      | RPC `publish_announcement_atomic` needs `scheduled_at` param                         |
| HIGH     | Archive announcement (#39)                   | `announcement.archived`                       | Semantically: message is soft-deleted/hidden, not channel archived                   |
| MED      | Republish archived announcement (#40)        | `announcement.republished`                    | Reverse of archive                                                                   |
| MED      | Send reminder to unread recipients (#12/#41) | `announcement.reminder_sent`                  | **BLOCKED by FLAG-1**: notification_outbox is 0-seeded; backend path does not exist  |
| LOW      | Add comment to announcement (#42)            | `announcement.comment_added`                  | Comment thread is design fiction — no backend comment path for announcements         |
| LOW      | Change helpdesk case priority (#71)          | `helpdesk.case.priority_changed`              | Minor operational event                                                              |
| LOW      | Reopen helpdesk case (#73)                   | `helpdesk.case.reopened`                      | Symmetric to resolved                                                                |
| LOW      | AI draft accepted (#65)                      | `helpdesk.ai_draft_accepted`                  | HITL tracking                                                                        |
| LOW      | AI draft dismissed (#66)                     | `helpdesk.ai_draft_dismissed`                 | HITL tracking                                                                        |
| LOW      | Add internal note (#69)                      | `helpdesk.internal_note_added`                | Internal only                                                                        |
| LOW      | Edit channel (update) (#49 edit mode)        | `channel.updated`                             | No update event exists at all; create vs edit share `upsertChannel`                  |
| LOW      | Reopen channel (from archived) (#46 reopen)  | `channel.reopened` or reuse `channel.created` | Decision needed                                                                      |

**Blocker note for `announcement.reminder_sent`:**
The `notification_outbox` table has no seed rows for announcement reminders. The existing trigger (`20260422310100` / `20260528020000`) fires on new `channel_message` inserts, not reminder re-sends. To unblock this event:

1. Create a `send_announcement_reminder` RPC that: queries unread recipients from `channel_message` read receipts, inserts `notification_outbox` rows with `priority=1`.
2. Register `announcement.reminder_sent` event.
3. Create `useSendReminder` hook.

---

## Phase 3 — Skranke (helpdesk) full backend wiring

The entire Skranke tab is design-only. Beyond P1-E/F/G, the following mutations need backend paths:

| Element                       | Backend action needed                                                                                                       |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Send reply (#68)              | Helpdesk reply must write to `channel_message` in the desk's thread (not a separate channel message via `use-send-message`) |
| Add internal note (#69)       | New `helpdesk_internal_note` table or `channel_message` with `visibility_scope=admins`                                      |
| Change status (#changeStatus) | `UPDATE channel_message SET ...` or helpdesk-specific status column                                                         |
| Change priority (#71)         | Helpdesk priority field — no current column in `channel` or `channel_message`                                               |

**Decision needed (ADR):** Define the data model for helpdesk case persistence before implementing P3. The design treats cases as mock objects with `status`, `priority`, `owner`, `sla` — none of these map directly to current schema.

---

## Control-Point DoD

The sortie is DONE when `control.json` reads:

```json
{
  "control_points": {
    "every_element_mapped": true,
    "every_mutation_has_event": true,
    "every_event_registry_status_known": true,
    "every_mutation_has_hook_or_flagged": true,
    "baseline_count_recorded": true
  },
  "gate": "PASS"
}
```

`every_mutation_has_event` is true when either:

- The event is in the registry AND the emit call-site exists, OR
- The mutation is explicitly flagged in `hooks_missing` with a documented reason (hollow/blocked).

`gate: PASS` does NOT require all missing events to be implemented — it requires that every mutation is either wired or explicitly flagged. The gate enforces honesty, not completeness.
