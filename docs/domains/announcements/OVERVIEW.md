---
title: "Announcements Domain — Overview"
status: done
updated: 2026-05-23
created: 2026-05-23
domain: announcements
tags: [announcements, nyheter, channel_message, publish, broadcast, cascade]
mirror: verified
last_verified: 2026-05-23
---

# Announcements Overview

## What it is

The Announcements domain is the **deliberate-broadcast surface** inside Smartout. It lets a manager or admin post a one-to-many message that lands in front of a chosen audience with read-receipts, reactions, pinning, and higher-priority notification routing.

The Norwegian product label is **Nyheter** ("news"). The bulletin-board route is `/dashboard/komm/nyheter`. Engineering name is **Announcements**.

**Core identity:** An announcement is NOT a top-level table. It is a `channel_message` row where `message_type = 'announcement'`, posted into a channel of `channel_type = 'news'`. Three things distinguish it from a regular chat message to the reader:

1. **UI signals broadcast.** "Kunngjøring" label, card styling, pulled out of normal chat flow.
2. **Priority delivery.** `priority=1, mode='work'` in `notification_outbox` (vs. `priority=0, mode='community'` for chat).
3. **Tracking affordances.** Read-receipt aggregation, emoji reactions, and pin/strip are first-class.

Wave B adds `announcement_meta` sidecar with `kind`, `tier`, `entity_link` classification. The `channel_message` schema is unchanged (ADR-0371).

---

## Why it exists

The product answer to: "I need to tell 12 people one thing — without DM-ing each one, without it scrolling away in chat, and with proof they saw it."

Operators previously solved this with group SMS, DM loops, or paper notices. Announcements give that broadcast intent a first-class digital surface anchored to the workspace.

---

## Cascade placement

Announcements sit **outside the cascade dimensions (D1–D6, C1–C4)**. They are part of the communication infrastructure that runs alongside the cascade.

| Dimension | Relationship |
|---|---|
| D1 Envelope | none |
| D2 Resource | reads `profile` for audience resolution |
| D3 Rules | none |
| D4 Demand | none |
| D5 Concept | none |
| D6 Production | adjacent — Day-Control Melding tab carries `session_id` in `system_data` so a broadcast is attributable to the operating day |
| C1–C3 | none |
| C4 Governance | enforces `broadcast.send` capability gate on the Day-Control server-action path; `communication` capability gate on the agent path |

Announcements are governance-light, surface-heavy. The schema is shared with the chat substrate; the behaviour layer (notification priority branching, audience targeting, pin/strip, `announcement_meta` sidecar) is what makes the domain distinct.

---

## Surface identity — what makes a row an announcement

A row is an announcement when ALL of the following are true:

1. It is a `channel_message` row.
2. Its `message_type` is `announcement` (enum `channel_message_type`).
3. Its containing channel's `channel_type` is typically `news` (the conventional posting surface; technically `message_type='announcement'` can appear on any channel but the canonical container is the workspace's `news` channel).
4. It was published through one of the four sanctioned composers (see ARCHITECTURE.md §2–5).

There is no `announcement` table, no `announcement_id`. Every join is `channel_message WHERE message_type = 'announcement'`.

---

## Kind / Tier / Entity-Link (Wave B)

Wave B adds a `announcement_meta` sidecar table with three orthogonal fields:

| Field | Values |
|---|---|
| `kind` | `general`, `new_menu`, `new_hire`, `staff_event`, `schedule_change`, `policy_update`, `external`, `celebration`, `system_message` |
| `tier` | `social` (community, priority=0), `work` (priority=1), `external` (priority=2, email+push+in_app) |
| `entity_link_type` + `linked_entity_id` | nullable pair — links announcement to `staff_event`, `schedule_shift`, `policy`, `protocol`, `profile`, `menu_document`, or `external_url` |

These fields are stored atomically via `publish_announcement_atomic` RPC (ADR-0369). The sidecar is a 1:1 companion row; it is NOT in `channel_message` (ADR-0371 preserved the `channel_message` schema contract).

UI pickers (AnnouncementKindPicker, AnnouncementTierPicker, EntityLinkPicker) are deferred to Track E. The RPC + `announcement_meta` table are live; defaults to `kind='general'`, `tier='work'`.

---

## Nyheter feed surface

**Web bulletin board:** `/dashboard/komm/nyheter/page.tsx` → `NyheterClient.tsx` (691 lines). Full-page card feed with pinned strip, per-card reactions, read-receipts, compose sheet.

**Mobile:** No dedicated bulletin layout. Announcements render as system bubbles inside the standard `news` channel chat view via `ChannelMessageBubble.tsx:55`. `TierBadge` component (`apps/mobile/src/components/news/TierBadge.tsx`) renders tier on the system bubble. `EntityLinkCTA` component (`apps/mobile/src/components/news/EntityLinkCTA.tsx`) is deferred (Track G).

**Composer surfaces (web only):** Four doors into the compose flow:
- D1: Header "Ny ▾" → Nyhet → `AnnounceSheet`
- D2: Cockpit Quick-Action → `AnnounceSheet`
- D3: `/komm/nyheter` → `ComposeAnnouncement` in-page modal
- D4: Day-Control Melding tab → `send-broadcast-action.ts`
