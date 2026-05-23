---
title: "Communication Domain — Architecture"
status: done
mirror: verified
last_verified: 2026-05-23
updated: 2026-05-23
created: 2026-05-23
domain: communication
tags: [domain, communication, architecture, livekit, capability, realtime]
---

# Communication Domain — Architecture

> Code wins. All claims verified against actual files. Citations are grep-able symbol anchors + line hints as of 2026-05-23.

---

## L1 — Web routes

```
apps/web/src/app/dashboard/komm/
  page.tsx                     # Root redirect / overview
  layout.tsx                   # KommShell provider mount
  oversikt/page.tsx            # Overview tab — unread + session status
  chat/page.tsx                # Channel list → MessageTimeline
  chat/[channelId]/page.tsx    # Individual channel view
  thread/page.tsx              # Thread (reply context)
  desks/page.tsx               # Helpdesk desk list
  desks/[deskId]/page.tsx      # Desk conversation view
  nyheter/page.tsx             # Announcements bulletin board (owned by Announcements sub-domain)
  varsler/page.tsx             # In-app notifications tab
```

Verified: `apps/web/src/app/dashboard/komm/` directory exists with `chat/`, `desks/`, `nyheter/`, `varsler/`, `thread/`, `oversikt/` sub-routes (`ls` confirmed 2026-05-23).

---

## L2 — Client components

All in `apps/web/src/app/dashboard/komm/_components/`:

| Component | Purpose |
|---|---|
| `KanalerClient.tsx` | Channel list + sidebar |
| `ChatClient.tsx` | Full chat view (MessageTimeline + MessageInput) |
| `ChatList.tsx` | Channel roster with unread badges |
| `MessageBubble.tsx` | Single message renderer (all types) |
| `MessageTimeline.tsx` | Paginated message feed with Realtime subscription |
| `MessageInput.tsx` | Composer — text + attachments |
| `ChannelHeader.tsx` | Channel name, member count, action buttons |
| `ChannelList.tsx` | Filtered/sorted channel roster |
| `ChannelItem.tsx` | Single channel row |
| `ChannelSettingsModal.tsx` | Edit channel (name, policies) |
| `CreateChannel.tsx` | Custom + direct channel creation |
| `MemberPanel.tsx` | Member sidebar |
| `MedlemmerTab.tsx` | Membership management tab |
| `GenereltTab.tsx` | Channel general settings tab |
| `AiPolicyTab.tsx` | AI policy configuration (currently reads policy; write path unverified) |
| `HelpDesk.tsx` | Helpdesk surface (desk list + query thread) |
| `CallRoom.tsx` | LiveKit voice/video call UI |
| `ActiveSpeakerIndicator.tsx` | Realtime speaking indicator |
| `GroupCallBanner.tsx` | Active call banner |
| `IncomingCallOverlay.tsx` | Incoming call notification overlay |
| `CommunicationOverview.tsx` | Overview tab (unread, session status, announcements summary) |
| `MinKoSection.tsx` | "My Komm" quick-access section |
| `AnnouncementKindPicker.tsx` | Announcement kind selector (part of Nyheter composers) |
| `AnnouncementTierPicker.tsx` | Announcement tier selector |
| `AudiencePicker.tsx` | Fanout audience selector |
| `EntityLinkPicker.tsx` | Entity link picker for announcements |
| `NewsCardMenu.tsx` | Announcement card context menu |
| `AttachmentPopup.tsx` | File/media attachment UI |
| `KnowledgeCard.tsx` | Knowledge search result card |

Verified: `ls apps/web/src/app/dashboard/komm/_components/` confirmed 2026-05-23.

---

## L3 — Hooks + data layer

All hooks live in `apps/web/src/app/dashboard/komm/_hooks/`. Key hooks:

| Hook | Purpose |
|---|---|
| `use-channel-messages.ts` | Paginated channel message fetch + Realtime subscription |
| `use-channel-members.ts` | Member list for a channel |
| `use-send-message.ts` | Send a channel_message (calls `communication` capability) |
| `use-communication-overview.ts` | Overview data — unread counts + **grandfathered** `planning_event` query (ADR-0087 §1) |
| `use-start-call.ts` | Initiate a LiveKit call session |
| `use-call-signaling.ts` | Incoming call invite listener (Supabase Realtime) |
| `use-call-realtime.ts` | Active participant tracking (Realtime) |
| `use-call-invite.ts` | Accept/reject call invitations |
| `use-mute-participant.ts` | Admin mute control |
| `use-push-to-talk.ts` | PTT button state |
| `use-call-history.ts` | Past call log query |
| `use-emit-typing.ts` | Typing indicator broadcaster (Supabase broadcast, ADR-0334) |
| `use-typing-indicator.ts` | Typing indicator consumer |
| `use-channel-read-receipts.ts` | Delivered-ack via broadcast (ADR-0334) |

**Mobile parity gap:** all hooks live in `apps/web/`, violating ADR-0087 §6 + CLAUDE.md mobile-parity rule. No equivalents in `packages/`. See GAPS §G5.

---

## L4 — AI capability layer

Three capabilities:

### 1. `communication` capability
`packages/ai/src/capabilities/communication/`

| File | Purpose |
|---|---|
| `index.ts` | `communicationCapability` definition, `allowedChannels: ['chat','voice','sms','email']` |
| `tools.ts` | `get_conversations`, `get_unread_count`, `send_message`, `get_channel_context`, `search_knowledge` |
| `briefing.ts` | `compose_shift_briefing` — reads D2+D6+K1b+D3 |
| `compile-day-brief.ts` | `compile_day_brief` |
| `compile-preclose.ts` | `compile_preclose` |
| `publish-announcement.ts` | `publish_announcement` — posts `channel_message` with `message_type='announcement'` |
| `emit-announcement-events.ts` | Telemetry emit for announcement events |
| `audience-resolver.ts` | Resolve audience JSONB to profile IDs |
| `policy.ts` | `isAiAllowedInChannel()` — reads `channel_ai_policy` (Layer 3 check) |
| `gate.ts` | `callGateAction()` wrapper for `gate_action` RPC (ADR-0099/ADR-0287) |

Authority seed: `supabase/migrations/20260601100000_seed_communication_authority.sql:42` — `level=suggest`, `min_role=employee`.

### 2. `channel_admin` capability
`packages/ai/src/capabilities/channel-admin/`

| Tool file | Tool name | Authority |
|---|---|---|
| `mute_channel.ts` | `channel_admin.mute_channel` | autonomous (self-service) |
| `leave_channel.ts` | `channel_admin.leave_channel` | autonomous |
| `invite_to_channel.ts` | `channel_admin.invite_to_channel` | confirm (PII: invitee identity) |
| `rename_channel.ts` | `channel_admin.rename_channel` | confirm |
| `archive_channel.ts` | `channel_admin.archive_channel` | confirm |

ADR-0336: design accepted; concrete authority matrix + seed migration deferred to `feat/channel-admin-capability-registration` sortie. Current tool files exist but authority config seed is placeholder. `allowedChannels: ['chat']` declared capability-wide (PII surface: invite).

### 3. `helpdesk_query` capability (design accepted, NOT implemented)
Specified in ADR-0162. Four tools planned: `create_desk_query`, `assign_representative`, `resolve_query`, `escalate_query`. `allowedChannels: ['chat']` mandatory. No code exists yet.

---

## L5 — Database + Supabase

**Migration series anchor:** `20260422300000_channel_communications.sql` (16 enums + 3 core tables + 5 supporting tables + 4 policy tables).

**Realtime:** `channel_message` INSERT subscriptions filtered by `channel_id` (Supabase Realtime postgres_changes). Typing/presence via Supabase broadcast channels `chat-typing:{channelId}` and `chat-presence:{channelId}` (ADR-0334).

**LiveKit voice:** `@smartout/walkie-talkie` package wraps LiveKit Cloud EU-region. Token minted by Supabase Edge Function; room name = `channel_{channelId}`. ADR-0282 locks LiveKit as sole WebRTC engine.

**Storage:** Attachments at `{workspace_id}/chat/{channel_id}/` in Supabase Storage. RLS: channel members only.

**Key RPCs (verified in migrations):**
- `create_channel(workspace_id, channel_type, name, created_by, member_ids[])` — `20260422300200_channel_functions.sql`
- `get_channel_messages(channel_id, limit, before_id)` — `20260422300700_optimize_channel_rpcs.sql`
- `get_channel_list(workspace_id)` — same file
- `get_unread_counts(workspace_id)` — same file
- `get_livekit_token(channel_id, workspace_id)` — voice token minting
- `publish_announcement_atomic(...)` — RPC-body fan-out per ADR-0369 (in spec, not yet shipped as of 2026-05-23)

**Auto-create triggers** (`20260422300400_channel_auto_create_triggers.sql`):
- `auto_create_department_channel()` — fires on `department` INSERT
- `auto_create_team_channel()` — fires on `team` INSERT
- `auto_create_session_channel()` — fires on `department_session` INSERT (separate migration `20260413220000_auto_create_session_channel.sql`)

**Targeted note fanout** (`20260616100501_session_note_targeted_fanout.sql`):
- Extends `session_note` with `audience JSONB`, `notify_at TIMESTAMPTZ`, `delivered_at TIMESTAMPTZ`, `deleted_at TIMESTAMPTZ`.
- `session_note_type` + `'targeted'` enum value.
- Cron scheduler (`20260616100600_note_fanout_scheduler_cron.sql`) fires fanout at `notify_at`.
- ADR-0331 (audience JSONB model), ADR-0332 (scheduler cadence), ADR-0333 (cross-dept C4 gate).
