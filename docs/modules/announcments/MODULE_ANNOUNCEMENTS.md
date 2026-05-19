---
title: Module — Announcements (Nyheter)
status: in_progress
updated: 2026-05-18
created: 2026-05-18
module: announcements
tags: [module, announcements, nyheter, broadcast, channel-message, communication]
---

# Module — Announcements (Nyheter)

> Authoritative module doc for Smartout's announcement (Nyheter) surface. If code contradicts this doc → CODE wins, update this doc.

## 1. Overview

The Announcements module is the **deliberate-broadcast surface** inside Smartout. It lets an admin or manager post a one-to-many message that lands in front of a chosen audience inside a workspace, with read-receipts, reactions, pinning, and higher-priority notification routing. It is the answer to "I need to tell the team something — new menu, schedule change, staff meeting reminder — without DM-ing 12 people."

Announcements are not stored as a top-level entity today. They are a **discriminated subtype of channel messages**: a row in `channel_message` with `message_type = 'announcement'`, posted into a channel of `channel_type = 'news'`. Every announcement is a message; not every message is an announcement.

The Norwegian product label is **Nyheter**. The engineering module name is **Announcements**. The bulletin-board route is `/dashboard/komm/nyheter`.

**Web entry point:** `apps/web/src/app/dashboard/komm/nyheter/page.tsx`
**Mobile entry point (today):** none dedicated — the `news` channel appears in the komm tab and renders announcement-type messages as system bubbles.
**Cockpit shortcut:** `apps/web/src/components/dashboard/cockpit/sheets/AnnounceSheet.tsx`
**Header shortcut:** `apps/web/src/components/dashboard/GlobalCreateMenu.tsx` (line 103 — `key:"news"`)
**Read hook:** `apps/web/src/app/dashboard/komm/_hooks/use-channel-messages.ts`

---

## 2. Identity — what makes a row an announcement

A row is an announcement when **all four** are true:

1. It is a `channel_message`.
2. Its `message_type` is `announcement` (enum `channel_message_type`).
3. Its `channel.channel_type` is typically `news` (the enum value can technically appear on any channel; the conventional posting surface is the workspace's `news` channel).
4. It was published through one of the sanctioned composers (see [USER-FLOWS.md](./USER-FLOWS.md)), which set `system_data` with audience-targeting metadata.

There is no `announcement` table. There is no `announcement_id`. Every join is `channel_message WHERE message_type = 'announcement'`.

The notification trigger branches on `message_type='announcement'` and writes `notification_outbox` rows with `priority=1, mode='work'` (vs. `priority=0, mode='community'` for normal chat). That single branch is the only mechanical difference between an announcement and a regular chat message in the notification path.

---

## 3. Cascade Placement

Announcements live **outside the cascade dimensions** (D1-D6, C1-C4). They are part of the communication infrastructure that sits alongside the cascade, not within it.

| Layer | Relationship |
|---|---|
| D1 Envelope | none |
| D2 Resource | reads `profile` for audience resolution |
| D3 Rules | none |
| D4 Demand | none |
| D5 Concept | none |
| D6 Production | adjacent — Day-Control Melding tab carries `session_id` in `system_data` so a broadcast is attributable to a session |
| C1-C3 | none |
| C4 Governance | enforces `broadcast.send` capability gate on the agent path |

Announcements are governance-light, surface-heavy. The schema is shared with the chat substrate; the behaviour layer (notification priority branching, audience targeting, pin/strip surfaces) is what makes the module distinct.

---

## 4. Surface Contract — Web

| Surface | Component | Role | Status |
|---|---|---|---|
| **Bulletin board** | `NyheterClient.tsx` (641 lines) | full-page card feed | shipped (Wave A) |
| Pinned strip | `PinnedStrip.tsx` | sticky horizontal scroller | shipped (Wave A) |
| Card menu | `NewsCardMenu.tsx` | per-card pin/unpin/delete | shipped (Wave A) |
| Compose (bulletin) | `ComposeAnnouncement` inside `NyheterClient.tsx` | sheet composer with audience picker | shipped (Wave A) |
| Cockpit Sheet | `AnnounceSheet.tsx` + `QuickBroadcast.tsx` | right-side composer from cockpit | shipped |
| Cockpit Quick-Actions | `CockpitQuickActions.tsx` | "actions_announce" button | shipped |
| Day-Control Melding tab | `WebDayControl` via `send-broadcast-action.ts` | alert/reminder/note tied to session | shipped |
| Header create menu | `GlobalCreateMenu.tsx:103` | "Nyhet" entry opens AnnounceSheet | shipped |
| Chat timeline render | `MessageTimeline.tsx` (line 25) | announcement renders as system bubble in chat view | shipped |
| Recipient count pill | `RecipientCountPill.tsx` | live audience count in composer | shipped (Wave A) |
| Read receipt aggregation | per-card today | batch-fetch not implemented | partial |

---

## 5. Surface Contract — Mobile

| Surface | File | Role | Status |
|---|---|---|---|
| Channel list label | `use-channels.ts:43,56` | `news` channel shows as "Nyheter" in komm tab sidebar | shipped |
| Chat message bubble | `ChannelMessageBubble.tsx:55` | announcement renders as system bubble | shipped |
| Dedicated bulletin layout | — | does not exist | **gap** |
| Home news widget | `NoShiftView.tsx` "Latest news" section | hardcoded placeholder ("Ny sesongmeny er her!") | placeholder |
| Composer | — | does not exist | **gap** |
| Pin/unpin | — | does not exist | **gap** |
| React (emoji) | — | does not exist | **gap** |

Mobile is read-only for announcements per ADR-0133 (mobile = Approve/Execute surface, not Author/Compose). Pin, reactions, and the dedicated bulletin layout are missing from the read-side parity Wave A defined for web.

---

## 6. Authority Surface — C4

| Capability key | Mutation | Required role | Channel | Source |
|---|---|---|---|---|
| `broadcast.send` | publish announcement / broadcast | `manager+` | chat | `send-broadcast-action.ts:59` (server action), `publish-announcement.ts` (agent tool) |
| (channel pin via RLS) | pin/unpin announcement | `manager+` (channel admin) | chat | `use-pin-message.ts` + `channel_jwt_update` policy |
| (channel react via RLS) | add/remove reaction | any channel member | chat | `use-reactions.ts` + `reaction_jwt_*` policies |

Compose UI is also render-gated on `manager+` inside `NyheterClient` and inside `CockpitQuickActions`. RLS enforces the actual write boundary; UI gating is redundant defense.

The AI capability `publish_announcement` wraps writes in `callGateAction` per ADR-0204. The two non-AI composers (`use-send-announcement`, `use-send-broadcast`) are direct-Supabase mutations per ADR-0157 — neither passes through `callGateAction` today. Noted as a gap candidate for harmonization in [GAPS-AND-DEBT.md](./GAPS-AND-DEBT.md).

---

## 7. Invariants

1. **One row, many surfaces.** Every render path (web bulletin, mobile chat bubble, future mobile feed, future home widget, agent-published broadcast) reads from the same `channel_message` row. Pin state, reactions, read-receipts, audience-targeting all live on that row and its child tables. No per-surface duplication.
2. **Soft-delete only.** Operator delete sets `deleted_at`. The row is never hard-deleted; the notification fan-out cannot be recalled.
3. **No edit after publish.** Operator must delete and repost. No `updated_at` semantics for content changes.
4. **No thread / no reply.** Announcements are broadcast, not conversational. Recipients DM the sender to respond.
5. **`news`-channel creation requires service role.** JWT RLS blocks `channel_type='news'` inserts; the broadcast composer resolves-or-creates via `createAdminClient` inside the server action.
6. **Notification priority discriminates on `message_type` alone.** The trigger does not inspect `system_data` or `visibility_scope` — only the message-type discriminator routes priority.
7. **Targeted-member visibility is RLS-enforced.** When `visibility_scope='targeted_members'`, a non-targeted member cannot read the row even if they are a channel member.
8. **Voice cannot publish.** Per ADR-0078, the agent capability rejects voice-channel calls. Chat-only on the agent path.

---

## 8. Adjacent Systems (NOT part of the module)

- **`staff_event` + `staff_event_attendee`** — calendar/event system with RSVP. No FK to `channel_message`. Personaltreff today does not auto-publish an announcement.
- **`channel_event`** — immutable lifecycle log on a channel. `channel_message.event_id` FK references it when a message is system-generated from a lifecycle event.
- **`planning_event`** — D4 cascade demand. No overlap.
- **Platform-admin communications** (`/api/platform-admin/communications/*`) — cross-workspace broadcast surface used by Smartout AS itself. Not a workspace-tenant feature.
- **`notification_outbox`** — delivery fan-out target. Owned by the notifications module; announcements are a writer.

---

## 9. Module Status Summary

- **Schema:** complete; shared with chat substrate. See [DATA-MODEL.md](./DATA-MODEL.md).
- **Web composers:** 4 doors (header, cockpit, bulletin, day-control). Audience targeting + pin + react + read-receipt-per-card all shipped.
- **Web bulletin:** shipped Wave A. Read-receipt aggregation pending.
- **Mobile:** read-side only via chat fallback. Dedicated layout + composer absent.
- **Telemetry:** 6 events registered; routing through PostHog + Logger + activity_trail.
- **Gates:** `broadcast.send` seeded; agent path uses `gatedMutation`, non-AI composers direct-Supabase.
- **Sub-kind / tier / entity-link:** none today. Design work pending; see [GAPS-AND-DEBT.md](./GAPS-AND-DEBT.md) and [BLUEPRINT.md](./BLUEPRINT.md).
