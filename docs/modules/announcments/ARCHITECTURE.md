---
title: Announcements — Architecture
status: archived
superseded_by: docs/domains/announcements/
updated: 2026-05-23
created: 2026-05-18
module: announcements
tags: [module, announcements, architecture, code-map, web, mobile, capabilities, composer]
---

> **ARCHIVED 2026-05-23.** See `docs/domains/announcements/ARCHITECTURE.md`.

# Announcements — Architecture

> Code-level map of every layer the announcement surface depends on. Read alongside [DATA-MODEL.md](./DATA-MODEL.md).

## 1. Layer Diagram

```
┌──────────────────────────────────────────────────────────────────────┐
│ L1 — UI surfaces                                                      │
│   Web bulletin:  NyheterClient + PinnedStrip + NewsCardMenu          │
│   Web cockpit:   AnnounceSheet → QuickBroadcast                       │
│   Web header:    GlobalCreateMenu (Nyhet entry)                       │
│   Web day:       WebDayControl Melding tab                            │
│   Mobile:        ChannelMessageBubble (system-bubble render only)     │
├──────────────────────────────────────────────────────────────────────┤
│ L2 — BFF + Server Actions + Direct Mutation Hooks                     │
│   Server Action:  send-broadcast-action.ts (gated, service-role)     │
│   Direct hooks:   use-send-announcement.ts, use-send-broadcast.ts    │
│   Platform-admin: /api/platform-admin/communications/* (out-of-scope) │
├──────────────────────────────────────────────────────────────────────┤
│ L3 — Stage Engine / Agent Router                                      │
│   services/stage-engine/* (Mr. Botsson chat-only per ADR-0078)        │
├──────────────────────────────────────────────────────────────────────┤
│ L4 — Capabilities                                                     │
│   packages/ai/src/capabilities/communication/                         │
│     ├─ publish-announcement.ts  (callGateAction wrapped, ADR-0204)    │
│     └─ audience-resolver.ts     (server-side port of web hook)        │
├──────────────────────────────────────────────────────────────────────┤
│ L5 — Persistence                                                      │
│   Postgres: channel, channel_member, channel_message,                 │
│             channel_message_reaction, channel_message_attachment,     │
│             channel_message_read, channel_notification_policy         │
│   Trigger:  trigger_channel_message_notification → notification_outbox│
└──────────────────────────────────────────────────────────────────────┘
```

ADR-0078 (voice restriction), ADR-0114 (Server Actions), ADR-0133 (mobile boundary), ADR-0157 (direct mutation hooks), ADR-0189 (`broadcast.send` capability seed), ADR-0204 (gatedMutation) are load-bearing across L1→L4.

---

## 2. Web — Bulletin Board

**Route:** `apps/web/src/app/dashboard/komm/nyheter/page.tsx`

Thin server-component shell that pulls `profileId` from `DashboardContext` and renders `NyheterClient`.

**Component:** `apps/web/src/app/dashboard/komm/_components/NyheterClient.tsx` (641 lines)

Single-file full-page bulletin. Owns:
- Resolution of the workspace's `news` channel (or empty state if absent)
- Feed pagination via `use-channel-messages`
- Pinned-strip rendering via `PinnedStrip`
- Card-by-card render with `NewsCard` + `ReactionBar` + `ReadReceipt` + `AttachmentChips`
- Per-card overflow menu via `NewsCardMenu`
- Compose sheet (`ComposeAnnouncement`) — title + body + audience picker + `RecipientCountPill`
- Auto-mark-as-read on open via `use-mark-as-read`
- Manager+ gating on compose button render

Read hooks called:
- `use-channel-messages.ts` — paginated message fetch (excludes deleted)
- `use-audience-resolver.ts` — converts `audience_kind` → `{ count, profileIds }` for the live pill
- `use-broadcast-recipients.ts` — alternate recipient resolution (used by Day-Control variant)

Write hooks called:
- `use-send-announcement.ts` — direct Supabase mutation
- `use-pin-message.ts` — direct Supabase mutation
- `use-reactions.ts` — direct Supabase mutation
- `use-mark-as-read.ts` — direct Supabase mutation on `channel_member.last_read_message_id`

---

## 3. Web — Cockpit Composer Path

**Sheet:** `apps/web/src/components/dashboard/cockpit/sheets/AnnounceSheet.tsx`

Right-side `Sheet` that wraps `QuickBroadcast`. Opened from cockpit Quick-Actions (`CockpitQuickActions.tsx:67`, `actions_announce` button) and from the header create menu (`GlobalCreateMenu.tsx:103`, `key:"news"`).

**Composer:** `apps/web/src/components/dashboard/interactive/QuickBroadcast.tsx`

Group-toggle composer (on_duty / incoming / yesterday). Calls `useSendBroadcast`. Owns:
- Group toggle state
- Body textarea
- Recipient-count display (uses `use-broadcast-recipients.ts`)
- Submit + reset

**Write hook:** `apps/web/src/app/dashboard/_hooks/use-send-broadcast.ts`

Resolve-or-creates `news` channel via `createAdminClient` (service-role inside hook is permitted because RLS blocks JWT from creating `news`). Inserts `channel_message` with `message_type='announcement'`, `delivery_mode='notification_only'`, `target_profile_ids` from group resolution. Emits `communication.broadcast_sent` telemetry.

---

## 4. Web — Day-Control Melding Composer Path

**Entry:** `WebDayControl` Melding tab (composed inside `apps/web/src/components/day/WebDayControl.tsx` per ADR-0156).

**Server Action:** `apps/web/src/app/dashboard/_actions/send-broadcast-action.ts`

Server action path:
1. Zod-validate input (`broadcast_type ∈ {alert, reminder, note}`, body, session_id)
2. PII guardrail on body
3. Role check `manager+`
4. Gate via `broadcast.send` capability (ADR-0189, line 59)
5. Resolve-or-create `news` channel via service role
6. Insert `channel_message` with `message_type='announcement'`, `delivery_mode='notification_only'`, `system_data={ broadcast_type, session_id, source: 'day_control' }`
7. Emit `communication.broadcast_sent`

This is the only composer that carries `session_id` in `system_data` — Day-Control broadcasts are attributable to the operating day.

---

## 5. Web — Header Create Menu

**File:** `apps/web/src/components/dashboard/GlobalCreateMenu.tsx`

The header-level "Ny ▾" dropdown. Line 103 holds the `news` entry:

```ts
{
  key: "news",
  label: "Nyhet",
  hint: "Kunngjøring til teamet",
  icon: Megaphone,
  action: "announce",
}
```

`action: "announce"` opens `AnnounceSheet`. Other entries (Event, Booking, Vakt, Oppgave, Avvik) route to their respective dashboard pages. The header menu is pure surface — no new write path; it reuses the cockpit composer.

---

## 6. Web — Chat Timeline Render of Announcements

**File:** `apps/web/src/app/dashboard/komm/_components/MessageTimeline.tsx`

When a user opens the `news` channel as a regular chat (vs. the bulletin board), this component renders the message stream. Line 25 declares `SYSTEM_TYPES` set including `announcement` — announcement-type messages render as **system bubbles** (special styling, "Kunngjøring" label) rather than chat bubbles. This is the rendering used both when a user explicitly navigates to the news channel chat and on mobile (see §11).

---

## 7. Web — Cockpit Activity Feed

**File:** `apps/web/src/components/dashboard/cockpit/CockpitActivityFeed.tsx`

Renders recent activity items including broadcast events. Reads from telemetry/activity_trail surface (not directly from `channel_message`). Announcements appear here as `communication.broadcast_sent` event entries.

---

## 8. AI Capability — `publish_announcement`

**File:** `packages/ai/src/capabilities/communication/publish-announcement.ts`

Two-call pattern per agent convention:
- `confirm:false` → returns `{ draft, audience_preview }` with no DB write
- `confirm:true` → wraps insert in `callGateAction` (ADR-0204), gate key `broadcast.send`, inserts `channel_message` with `message_type='announcement'`

Voice channel is **rejected** at the tool boundary per ADR-0078 — agent-published announcements are chat-only.

**Audience port:** `packages/ai/src/capabilities/communication/audience-resolver.ts`

Server-side mirror of `use-audience-resolver.ts`. Implements the same 5 audience kinds (`all`, `on_duty`, `department`, `role`, `individuals`) so the agent can preview audience without a client round-trip.

---

## 9. Platform-Admin Path (OUT-OF-MODULE)

These endpoints write to a different code path entirely. They are Smartout-AS-owned cross-workspace broadcast and are not part of the workspace announcement module:

| Route | File | Purpose |
|---|---|---|
| `POST /api/platform-admin/communications/in-app/broadcast` | `apps/web/src/app/api/platform-admin/communications/in-app/broadcast/route.ts` | Platform-admin in-app broadcast |
| `POST /api/platform-admin/communications/send` | `apps/web/src/app/api/platform-admin/communications/send/route.ts` | Multi-channel send (in-app + email) |
| `POST /api/platform-admin/communications/channels/[id]/post` | `apps/web/src/app/api/platform-admin/communications/channels/[id]/post/route.ts` | Posts to specific channel as platform admin |

Documented here only because grep traffic finds them; they do not write to workspace-scoped `news` channels and are not invoked by the workspace composers.

---

## 10. Composer Comparison Matrix

| Composer | Entry | Write path | Gated? | Telemetry |
|---|---|---|---|---|
| `ComposeAnnouncement` (bulletin) | `NyheterClient.tsx` | `use-send-announcement.ts` (direct JWT) | no | `channel.message.sent` |
| `QuickBroadcast` (cockpit) | `AnnounceSheet.tsx` → `CockpitQuickActions.tsx` or `GlobalCreateMenu.tsx` | `use-send-broadcast.ts` (service role for channel create + JWT-or-service for insert) | no | `communication.broadcast_sent` |
| Day-Control Melding | `WebDayControl` Melding tab | `send-broadcast-action.ts` (server action) | yes — `broadcast.send` | `communication.broadcast_sent` |
| Agent tool | Mr. Botsson chat | `publish-announcement.ts` (capability) | yes — `callGateAction` | `channel.message.sent` (via gated mutation) |

The two-tier gating (direct hooks vs gated capability) is per ADR-0157 — direct Supabase mutations are accepted for surface-driven composers; capability path is for agent-driven mutations.

---

## 11. Mobile Surfaces

### 11.1 Channel list / sidebar

| File | Lines | Behaviour |
|---|---|---|
| `apps/mobile/src/hooks/queries/use-channels.ts` | 43, 56 | Labels `news` channel-type as `"Nyheter"`. `'news'` included in `TYPE_ORDER`, surfaces in komm sidebar. |
| `apps/mobile/src/hooks/queries/use-conversations.ts` | 178 | `c.type === 'news'` included in conversation list filtering. |

### 11.2 Message rendering

| File | Lines | Behaviour |
|---|---|---|
| `apps/mobile/src/components/komm/ChannelMessageBubble.tsx` | 55 | `SYSTEM_TYPES = Set(["system","brief","handoff","announcement","reminder","summary"])`. Announcement-type messages render as system bubbles, not chat bubbles. No dedicated news-card UI. |

### 11.3 Home placeholder

| File | Lines | Behaviour |
|---|---|---|
| `apps/mobile/src/components/home/NoShiftView.tsx` | "Latest news" section | Hardcoded placeholder card ("Ny sesongmeny er her!"). Not wired to live `channel_message`. |

### 11.4 Composer

None. No mobile path can publish an announcement today.

### 11.5 API client

No `/api/mobile/` announcement-specific route. Mobile reads through standard channel RPC (`get_my_channels`) + `channel_message` Supabase queries.

---

## 12. Notification Path

```
channel_message INSERT
       ↓
trigger_channel_message_notification() (BEFORE INSERT or AFTER INSERT — see migration)
       ↓
   branch on message_type
       ↓                   ↓                  ↓
 'announcement'      'text'/'image'      'system'/'brief'/
       ↓                'voice_clip'      'handoff'/'summary'
       ↓                   ↓                  ↓
 notification_outbox  notification_outbox    SKIP
 priority=1           priority=0
 mode='work'          mode='community'
 event_key=            event_key=
  'announcement.        'message.received'
   published'
       ↓
   recipients = channel_member ∩ (target_profile_ids when targeted)
       ↓
   notifications dispatch (Expo push + in-app)
```

The branching lives in `supabase/migrations/20260528020000_announcement_notification_priority.sql`. It is the only mechanical difference between an announcement and a regular channel message in the delivery path.

---

## 13. i18n Footprint

Primary namespaces:
- `komm.nyheter.*` (English: full namespace at `packages/i18n/locales/en/komm.json` lines 158–201)
- `komm.news.*` (empty states)
- `komm.system_message.announcement` — system-bubble label "Kunngjøring"
- `komm.overview.filter_announcement` — overview list filter
- `dashboard.cockpit.announce_title` + `announce_description` — AnnounceSheet copy
- `dashboard.interactive.broadcast_*` — QuickBroadcast composer copy
- `dashboard.sidebar.item_nyheter` — sidebar entry "Nyheter"

Norwegian locale lags English; several composer-side `nyheter.*` strings fall back. Tracked in [GAPS-AND-DEBT.md](./GAPS-AND-DEBT.md).

---

## 14. Layer Ownership

| Layer | Owner | Constraint |
|---|---|---|
| L1 UI | this module | own component tree |
| L2 server actions / direct hooks | this module | one server action (`send-broadcast-action`), two direct hooks (`use-send-announcement`, `use-send-broadcast`), per ADR-0157 |
| L3 stage engine | shared (agent infra) | this module registers `publish_announcement` capability via L4 |
| L4 capability | this module | `publish-announcement.ts` + `audience-resolver.ts` |
| L5 persistence | shared (channel infra) | this module USES the chat substrate; does NOT own `channel`, `channel_message`, `channel_member` schema |

Any schema change to `channel_message` (e.g. adding `announcement_kind` enum, `entity_link` columns) is a cross-module change requiring coordination with the communication module owner.
