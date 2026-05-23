---
title: "Announcements Domain — Architecture"
status: done
updated: 2026-05-23
created: 2026-05-23
domain: announcements
tags: [announcements, architecture, code-map, capability, rpc, wave-b]
mirror: verified
last_verified: 2026-05-23
---

# Announcements — Architecture

> Code-level map. Every `verified` claim has a grep-able anchor + line ±hint.

## Layer Diagram

```
L1  UI surfaces
    Web bulletin:   NyheterClient + PinnedStrip + NewsCardMenu
    Web cockpit:    AnnounceSheet → QuickBroadcast
    Web header:     GlobalCreateMenu ("Nyhet" entry)
    Web day:        WebDayControl Melding tab
    Mobile:         ChannelMessageBubble (system bubble) + TierBadge
        ↓
L2  BFF + Server Actions + Direct Mutation Hooks
    Server Action:  send-broadcast-action.ts (gated, service-role)
    Direct hooks:   use-send-announcement.ts, use-send-broadcast.ts
        ↓
L3  Stage Engine / Agent Router
    services/stage-engine/* (chat-only per ADR-0078)
        ↓
L4  Capability — packages/ai/src/capabilities/communication/
    publish-announcement.ts   (callGateAction capability=communication, ADR-0370)
    audience-resolver.ts      (server-side port of web hook)
    emit-announcement-events.ts (shared emit helper post-publish, ADR-0358)
        ↓
L5  Persistence
    channel_message (WHERE message_type='announcement')
    announcement_meta (sidecar — Wave B)
    channel_member, channel_message_reaction, channel_message_read
    notification_outbox (write target — owned by notifications domain)
    trigger: channel_message_trigger_announcement_guard (M5)
    rpc: publish_announcement_atomic (M4)
    fn:  fn_publish_announcement_notifications (M3)
```

Load-bearing ADRs: ADR-0078 (voice restriction), ADR-0114 (Server Actions), ADR-0133 (mobile boundary), ADR-0157 (direct mutation hooks), ADR-0189 (`broadcast.send` seed), ADR-0204 (gatedMutation), ADR-0369 (RPC atomicity), ADR-0370 (capability boundary), ADR-0371 (schema contract), ADR-0372 (celebration branch).

---

## L1 — Web Bulletin Board

**Route:** `apps/web/src/app/dashboard/komm/nyheter/page.tsx`
Thin server-component shell; pulls `profileId` from `DashboardContext`; renders `NyheterClient`.

**Component:** `apps/web/src/app/dashboard/komm/_components/NyheterClient.tsx` (691 lines)

Full-page bulletin. Owns:
- Resolution of the workspace's `news` channel
- Feed pagination via `use-channel-messages`
- Pinned-strip rendering via `PinnedStrip` (grep: `import { PinnedStrip }` line ~32)
- Card-by-card render: `NewsCard` + `ReactionBar` + `ReadReceipt` + `AttachmentChips`
- Per-card overflow menu via `NewsCardMenu`
- Compose sheet (`ComposeAnnouncement`): title + body + audience picker + `RecipientCountPill`
- Auto-mark-as-read on open via `use-mark-as-read`
- Manager+ render-gate on compose button

Audience picker wired to `useAudienceResolver` (grep: `const audienceQuery = useAudienceResolver` line ~350).

---

## L1 — Web Cockpit Composer Path

**Sheet:** `apps/web/src/components/dashboard/cockpit/sheets/AnnounceSheet.tsx`
Right-side `Sheet` wrapping `QuickBroadcast`. Opened from:
- Cockpit Quick-Actions (`CockpitQuickActions.tsx:67`, `actions_announce` button)
- Header create menu (`GlobalCreateMenu.tsx:103`, `key:"news"`)

**Composer:** `apps/web/src/components/dashboard/interactive/QuickBroadcast.tsx`
Group-toggle composer (on_duty / incoming / yesterday). Calls `useSendBroadcast`. No dedicated audience picker in this path; audience is group-based.

**Write hook:** `apps/web/src/app/dashboard/_hooks/use-send-broadcast.ts`
Resolve-or-creates `news` channel via `createAdminClient` (service-role — JWT RLS blocks `news` channel creation). Inserts `channel_message` with `message_type='announcement'`.

---

## L1 — Day-Control Melding Composer Path

**Server Action:** `apps/web/src/app/dashboard/_actions/send-broadcast-action.ts`

Path:
1. Zod-validate input (`broadcast_type ∈ {alert, reminder, note}`, body, session_id)
2. PII guardrail on body
3. Role check `manager+`
4. Gate via `broadcast.send` capability (grep: `broadcast.send` line ~59)
5. Resolve-or-create `news` channel via service role
6. Insert `channel_message` with `message_type='announcement'`, `delivery_mode='notification_only'`, `system_data={ broadcast_type, session_id, source:'day_control' }`
7. Emit via `emit-announcement-events.ts` helper

Only composer that carries `session_id` in `system_data` — Day-Control broadcasts are attributable to the operating day.

---

## L1 — Header Create Menu

**File:** `apps/web/src/components/dashboard/GlobalCreateMenu.tsx`

The header "Ny ▾" dropdown. Line ~103: `key:"news"`, `label:"Nyhet"`, `action:"announce"` → opens `AnnounceSheet`. Pure surface — no new write path; reuses cockpit composer.

---

## L1 — Chat Timeline Render

**File:** `apps/web/src/app/dashboard/komm/_components/MessageTimeline.tsx`
Line ~25: `SYSTEM_TYPES` set includes `"announcement"`. Announcement-type messages render as system bubbles (special styling, "Kunngjøring" label) when viewed through the chat timeline view of the `news` channel.

---

## L1 — Mobile Surfaces

| File | Line | Behaviour |
|---|---|---|
| `apps/mobile/src/hooks/queries/use-channels.ts` | ~43,56 | Labels `news` channel as "Nyheter"; `'news'` included in `TYPE_ORDER`. Grep: `'news'` + `"Nyheter"` |
| `apps/mobile/src/components/komm/ChannelMessageBubble.tsx` | ~55 | `SYSTEM_TYPES = Set(["system","brief","handoff","announcement","reminder","summary"])`. Announcement renders as system bubble. |
| `apps/mobile/src/components/news/TierBadge.tsx` | 1 | Renders social/work/external tier badge inside bubble. Grep: `AnnouncementTier` |
| `apps/mobile/src/components/news/EntityLinkCTA.tsx` | 1 | Deferred (Track G) — component exists, mount pending. |
| `apps/mobile/src/components/home/NoShiftView.tsx` | "Latest news" | Hardcoded placeholder card, NOT wired to live `channel_message` |

Mobile is **read-only** per ADR-0133. No composer, no pin, no delete.

---

## L4 — AI Capability

**Owner:** `packages/ai/src/capabilities/communication/` — the `communication` capability.

**Primary tool:** `packages/ai/src/capabilities/communication/publish-announcement.ts`

Two-call draft-return pattern (ADR-0099):
- `confirm=false` → resolve audience, return `{draft, audience_preview}`. No INSERT.
- `confirm=true` → call `callGateAction(capability='communication')` → invoke `publish_announcement_atomic` RPC → emit.

Voice channel rejected at the tool boundary (ADR-0078). Chat-only on the agent path.

**Audience resolver (server-side):** `packages/ai/src/capabilities/communication/audience-resolver.ts`
Server-side mirror of `use-audience-resolver.ts`. Implements the same 5 audience kinds (grep: `audience_kind` + `all_members`/`on_duty`/`department`/`role`/`individuals`).

**Emit helper:** `packages/ai/src/capabilities/communication/emit-announcement-events.ts`
Shared post-publish emit for all 4 composer paths (ADR-0358). Emits `channel.message.sent` with extended V2 props (grep: `AnnouncementPublishedPayload`).

**Tests:** `packages/ai/src/capabilities/communication/__tests__/publishAnnouncement.test.ts` + `publishCelebrationBirthday.test.ts`

---

## L5 — RPC + Functions

| Object | Migration | Role |
|---|---|---|
| `publish_announcement_atomic(…)` | `20260620140400` (M4) + `20260620141300` (M13 celebration) + `20260620141700` (M17 drop 14-param overload) | SECURITY DEFINER RPC — single authorized write path. 16-param overload is canonical (ADR-0369 Option B). |
| `fn_publish_announcement_notifications(…)` | `20260620140300` (M3) | Fan-out helper called inline by RPC body. Tier→(mode, priority, channels) mapping. |
| `trigger_channel_message_notification()` (amended) | `20260620140500` (M5) | Amended to skip `message_type='announcement'` rows (early RETURN NEW). Prevents double fan-out. |
| `get_channel_messages(…)` (extended) | `20260620140600` (M6) | Return shape extended with 5 nullable `announcement_meta` columns (kind, tier, tags, entity_link_type, entity_link_id). DROP + CREATE required. |

---

## Composer Comparison Matrix

| Composer | Entry | Write path | Gated? | Telemetry event |
|---|---|---|---|---|
| `ComposeAnnouncement` (bulletin) | `NyheterClient.tsx` | `use-send-announcement.ts` (direct JWT) | no | `channel.message.sent` via `emit-announcement-events.ts` |
| `QuickBroadcast` (cockpit) | `AnnounceSheet.tsx` | `use-send-broadcast.ts` (service-role for channel create) | no | `channel.message.sent` + `communication.broadcast_sent` |
| Day-Control Melding | `WebDayControl` Melding tab | `send-broadcast-action.ts` (server action) | yes — `broadcast.send` | `channel.message.sent` via `emit-announcement-events.ts` |
| Agent tool | Mr. Botsson chat | `publish-announcement.ts` (capability) | yes — `callGateAction(communication)` | `channel.message.sent` via `emit-announcement-events.ts` |

Direct hooks (`use-send-announcement`, `use-send-broadcast`) are accepted per ADR-0157 (surface-driven composers). Capability path gates per ADR-0204.

---

## Notification Fan-Out Path

```
channel_message INSERT (via publish_announcement_atomic)
       ↓
fn_publish_announcement_notifications (called inline by RPC)
       ↓
Tier mapping:
  social   → priority=0, mode='community', channels=[push, in_app]
  work     → priority=1, mode='work',      channels=[push, in_app]
  external → priority=2, mode='work',      channels=[push, in_app, email]
       ↓
notification_outbox rows inserted (owned by notifications domain)
       ↓
process-notifications Edge Function dispatches
```

The AFTER INSERT trigger on `channel_message` is amended (M5) to skip `message_type='announcement'` — announcement fan-out lives ONLY in the RPC body. Non-announcement messages still fan-out via the original trigger path.
