---
title: Announcements — User Flows
status: archived
superseded_by: docs/domains/announcements/
updated: 2026-05-23
created: 2026-05-18
module: announcements
tags: [module, announcements, user-flows, journeys, admin, employee, web, mobile, v2, kind, tier, entity-link]
---

> **ARCHIVED 2026-05-23.** See `docs/domains/announcements/USER-FLOWS.md`.

# Announcements — User Flows

> Admin and employee journeys, web vs mobile differences, lifecycle, edge cases. No journey docs exist yet for this module — they will be authored when blueprint phases are defined.

## 1. Mental Model

An announcement is a **deliberate broadcast** from a workspace operator to a chosen audience inside that workspace. It is louder than a chat message, quieter than a notification storm, and longer-lived than a one-off DM. The defining feel is "I have something to tell the team, and I want it to land — once, clearly, in front of the right people, with proof that they saw it."

Three things make an announcement feel different from a regular chat message to the user who reads it:

1. **It is acknowledged as a broadcast.** The UI labels it ("Kunngjøring"), styles it distinctively, and pulls it out of normal chat flow.
2. **It triggers higher-priority delivery.** Push notification carries work-priority weight, not community-chat weight.
3. **It is something the operator wants tracked.** Read-receipt aggregation, reactions, and pinning are first-class so the operator knows whether the message landed.

To the operator who publishes one, an announcement is the answer to: "I need to tell N people one thing, and I don't want to repeat myself in chat, and I don't want to send N DMs, and I don't want this to scroll away."

---

## 2. Role Surfaces

| Role | Publish | Read | Pin/unpin | React | Delete others' | Notes |
|---|---|---|---|---|---|---|
| `owner` | yes | yes | yes | yes | yes | Workspace owner. |
| `admin` | yes | yes | yes | yes | yes | Workspace admin. |
| `manager` | yes | yes | yes | yes | yes (own dept/team) | Default operator role. |
| `employee` (`active`, `trainee`) | no | yes | no | yes | no | Audience side. |
| `employee` (`inactive`, `offboarding`) | no | scoped | no | no | no | Reads only announcements published before status change; new announcements no longer include them in audience resolution. |

Permission is enforced in three layers — RLS on `channel_message`, the `broadcast.send` capability gate inside the server action, and a UI render-guard on the compose button. All three must hold for a publish to succeed.

---

## 3. Lifecycle of One Announcement

```
draft (in composer)
   → publish (composer submits)
      → row inserted into channel_message (message_type='announcement')
         → trigger writes notification_outbox rows (priority=1, mode='work')
            → recipients receive push / in-app notification
               → recipient opens feed → read_receipt advances last_read_message_id
                  → recipient reacts (optional) → reaction row inserted
                     → operator pins (optional) → is_pinned, pinned_by, pinned_at set
                        → operator unpins or message ages → drops off pinned strip
                           → message persists in feed (no archive concept today)
                              → operator deletes (optional) → soft-delete via deleted_at
```

There is no scheduled-publish, no expiry, no auto-archive, and no edit-after-publish in current code. Operator can delete; soft-delete sets `deleted_at` and the row drops from the feed.

---

## 4. Admin / Manager Journey

### 4.1 Four Doors into the Composer

The operator can reach a composer from four places:

| # | Door | When the operator uses it |
|---|---|---|
| D1 | Header "Ny ▾" → Nyhet | Casual, anywhere in the dashboard. Operator already knows they want to announce something; always-available shortcut. |
| D2 | Cockpit → Quick Action "Send kunngjøring" | Operator is in cockpit context, looking at the day; the announce action is one of several quick-actions. |
| D3 | `/dashboard/komm/nyheter` → "Skriv ny" | Operator is in the bulletin board, scanning prior announcements, deciding to add one. |
| D4 | Day-Control Melding tab | Operator is running the operating day; announcement is tied to a `session_id` so the broadcast is later attributable to the session. |

D1 + D2 open the same `AnnounceSheet` UI (`QuickBroadcast` composer). D3 opens `ComposeAnnouncement` (the full-page modal inside the bulletin board). D4 is the narrower three-button alert/reminder/note flow inside `WebDayControl`.

### 4.2 The Composer Flow

The operator:

1. Writes a title and body.
2. Picks an audience kind (`all`, `on_duty`, `department`, `role`, `individuals`).
3. Sees a recipient-count pill update live ("On-duty (4)", "Bar-personell (12)", etc.).
4. (Optional) Attaches a file / image.
5. Submits.

The composer writes the row directly (no draft persistence). If the network fails, the optimistic UI shows the message in the feed greyed-out and retries via `client_message_id` idempotency. On hard failure, a toast surfaces the error and the row never lands.

### 4.3 After Publishing

Operator returns to the bulletin board (or stays in cockpit). They can:

- Pin the message to the top of the feed for everyone (pinned strip appears for all readers).
- Watch reactions accumulate.
- Watch read-receipts aggregate (per-card today; batch-fetch is a known gap).
- Delete the message if it was wrong (soft-delete).
- Edit — not supported today; operator deletes and reposts.

### 4.4 Day-Control Variant

When publishing from Day-Control Melding tab the flow is narrower: pick alert / reminder / note, write body, send. The `audience_kind` is implicit (everyone on the active session), and the message lands with `system_data.broadcast_type` and `system_data.session_id` so the operator can later trace which session a broadcast belonged to.

---

## 5. Employee Journey

### 5.1 Notification Arrives

Employee receives a push (mobile) or in-app notification (web), depending on their notification policy. The notification carries the work-priority weight (per the trigger branching). It identifies the announcement as a broadcast, not a regular chat message.

### 5.2 Opening the Feed

Employee taps the notification or navigates to:

- **Web:** `/dashboard/komm/nyheter` — full bulletin board, card layout, pinned strip on top, scrolling feed below.
- **Mobile (today):** opens the `news` channel in the komm tab. The announcement renders as a system bubble inside the chat view. No dedicated bulletin layout.

The act of opening advances `last_read_message_id` and emits read-receipts back to the operator.

### 5.3 Engaging

Employee can:

- React with an emoji (web only today; mobile gap).
- Reply — not supported as a thread. Announcements are broadcast, not conversational. Employee who wants to respond DMs the operator.
- Open attachments inline.
- Tap a link in the body — plain text today, no entity-linking.

If the message is `targeted_members` and the employee is not in `target_profile_ids`, the row does not appear in their feed at all (RLS filters it).

### 5.4 Read Receipts Visibility

Read receipts are visible to the operator and (in current UI) to readers themselves as a passive marker. Employee does not see who else has read.

---

## 6. Surface Coverage — Web vs Mobile

| Capability | Web (today) | Mobile (today) | Note |
|---|---|---|---|
| Publish | ✅ from 4 doors | ❌ | Mobile is read-only for announcements. |
| Dedicated bulletin layout | ✅ `/komm/nyheter` (NyheterClient) | ❌ — appears only inside chat view of `news` channel | Mobile parity gap. |
| Pinned strip | ✅ sticky top of feed | ❌ | Mobile gap. |
| React (emoji) | ✅ | ❌ | Mobile gap. |
| Read receipts | ✅ auto on open | partial — last-read advances via standard chat read mechanic | Aggregation surface is web-only. |
| Push notification | ✅ in-app | ✅ via Expo push | Both paths fan out from the same `notification_outbox` rows. |
| Home widget showing latest news | ❌ | ❌ (only a hardcoded placeholder in `NoShiftView`) | Both gaps. |
| Targeted-member filtering | ✅ RLS-enforced | ✅ RLS-enforced | RLS is shared; filtering is correct on both. |
| Edit | ❌ | ❌ | Not supported anywhere. |
| Delete | ✅ manager+ via menu | ❌ | Mobile gap. |

The mobile surface is best understood today as "read-side parity with web is incomplete." Every read path that exists on web is either absent or rendered via the generic chat fallback on mobile.

---

## 7. When an Operator Chooses Which Composer

The four composers exist for different operator intents. The composer chosen shapes how the announcement is stored and how it appears later.

| Operator intent | Right composer | Why |
|---|---|---|
| "I'm at my desk, I have something to say to the team" | Header "Ny ▾" → Nyhet (D1) | Always-available; lowest friction. |
| "I'm running the day and want to push something to whoever is on-shift right now" | Cockpit Quick Action → AnnounceSheet (D2) | Audience defaults to on-duty; cockpit is the operating surface. |
| "I'm scanning the bulletin board and remember I owe one more announcement" | `/komm/nyheter` → "Skriv ny" (D3) | Context is already the feed; in-place compose. |
| "Day-Control note tied to this session" | WebDayControl Melding tab (D4) | Carries `session_id` so the broadcast is later attributable to the session. |

D1 and D2 both open `AnnounceSheet` (same UI). D3 opens `ComposeAnnouncement` (full-page modal inside the feed). D4 is the narrower three-button alert/reminder/note flow.

---

## 8. Audience-Targeting Behaviour

The five audience kinds produce different operator experiences:

| Kind | Operator picks | Operator sees | Recipient experience |
|---|---|---|---|
| `all` | Default — no further input | "Alle (N)" pill | Everyone in workspace receives the push. |
| `on_duty` | Toggle | "Pågående vakt (N)" pill | Only those with an active shift receive the push. |
| `department` | Select department(s) | "Bar-personell (12)" pill | Only members of that department. |
| `role` | Select role(s) | "Managers (3)" pill | Only holders of that role. |
| `individuals` | Search + multi-select profiles | "5 valgte" pill | Explicit list; everyone else excluded from RLS read. |

Operator sees the resolved count before sending. Resolution happens client-side (web) or in the agent capability (server-side). If `count = 0`, the composer warns the operator; submit is allowed (announcement goes nowhere but is recorded).

---

## 9. Edge Cases and Failure States

| Situation | Behaviour |
|---|---|
| Operator publishes with `count = 0` | Row is written; no notification fan-out; row visible only to operator and channel members. Audit row still emits. |
| Network fails between submit and confirmation | Optimistic UI shows greyed-out card; idempotency on `client_message_id` prevents duplicates on retry. |
| Employee status changes from active → inactive AFTER an announcement targets them | The historical message remains visible to them while they retain channel membership; new announcements no longer include them in audience resolution. |
| Employee is in `target_profile_ids` but not a member of the `news` channel | RLS filters them out — they cannot read it. The composer assumes targeted profiles are channel members; if not, the announcement effectively silent-drops for them. |
| Operator deletes an announcement | Soft-delete sets `deleted_at`; row drops from feed for all readers; notifications already sent are not recalled. |
| Operator pins many announcements | Pinned strip scrolls horizontally; no hard cap. Visual ordering is by `pinned_at DESC`. |
| Voice tries to publish via Mr. Botsson | Tool rejects voice channel (ADR-0078). Chat-only. |
| Operator targets `individuals` and submits with an empty list | Composer disables submit until ≥1 profile selected; if forced via API, row is still written with `target_profile_ids=[]` and is invisible to everyone except channel admins (RLS edge). |

---

## 10. What the Module Does NOT Do Today

- Does **not** schedule future publishes.
- Does **not** expire or auto-archive.
- Does **not** thread or accept replies.
- Does **not** link to other entities (no FK from announcement to `staff_event`, `schedule_shift`, `policy`, etc.).
- Does **not** classify by type (no "new menu" vs "new hire" vs "staff event" enum).
- Does **not** classify by tier (no social vs work vs external).
- Does **not** publish from mobile.
- Does **not** show a home widget for employees.
- Does **not** allow inline-attach inside a regular chat composer (no chat "+" shortcut to publish-as-announcement).
- Does **not** edit-after-publish.
- Does **not** aggregate read-receipts in a single fetch (per-card today).

---

## 11. Same Announcement on Different Surfaces

A single `channel_message` row is the canonical truth. Every surface — web bulletin, mobile chat-bubble fallback, future mobile feed, future home widget, agent-published broadcast — reads from that one row. Pin state, reactions, read-receipts, audience-targeting all live on that row and its child tables. There is no per-surface copy.

This means: when mobile gets a dedicated bulletin layout, when an employee home widget ships, when the chat "+" inline-attach lands — none of them require schema additions for the same-row case. They are all reads against the same row, with surface-specific rendering. Whether the row's shape is rich enough to drive richer surfaces (typed sub-kind, entity-link, tier) is a separate design question tracked in [GAPS-AND-DEBT.md](./GAPS-AND-DEBT.md).

---

## 12. Journey Index (TBD)

No journey docs exist for this module yet. Candidates to author when blueprint phases land:

| Code | Title | Role | Status |
|---|---|---|---|
| (planned) | Manager publishes from bulletin board | manager+ | unwritten |
| (planned) | Manager publishes from cockpit Quick-Action | manager+ | unwritten |
| (planned) | Manager publishes from Day-Control Melding | manager+ | unwritten |
| (planned) | Manager publishes from header create menu | manager+ | unwritten |
| (planned) | Manager pins an announcement | manager+ | unwritten |
| (planned) | Manager deletes an announcement | manager+ | unwritten |
| (planned) | Employee receives push, opens, reacts | employee | unwritten |
| (planned) | Employee views pinned strip on web bulletin | employee | unwritten |
| (planned) | Agent publishes via `publish_announcement` capability | system (Mr. Botsson) | unwritten |

---

## V2 — kind / tier / entity-link extension

> V2 spec: `docs/superpowers/specs/2026-05-18-announcement-kind-tier-link-design-v2.md`
> Journey doc: `docs/journeys/JOURNEY-announce-kind-tier-link.md`
> ADRs: ADR-0369 (RPC body fan-out), ADR-0370 (capability boundary), ADR-0371 (schema contract)

V2 ships three orthogonal fields on every announcement:

| Field | Table | Values |
|---|---|---|
| `kind` | `announcement_meta` | `workspace_news` · `celebration` · `urgent` · `information` · `policy_update` |
| `tier` | `announcement_meta` | `social` · `work` · `external` |
| `entity_link_type` + `linked_entity_id` | `announcement_meta` | nullable pair: `staff_event` · `schedule_shift` · `policy` · `protocol` |

All three fields are stored in the `announcement_meta` sidecar table (created in M2). They are
populated atomically via `publish_announcement_atomic` RPC (M4). The Wave A `channel_message`
table is unchanged (ADR-0371 Option A — schema contract preserved).

---

### V2.1 Composing a typed announcement

> Composer pickers (AnnouncementKindPicker, AnnouncementTierPicker) are deferred to Track E.
> This section documents the intended flow for when pickers ship.

**Intended flow:**

1. Operator opens any of the four composer doors (D1 header, D2 cockpit, D3 bulletin, D4 Day-Control).
2. Operator writes title + body as before.
3. Operator opens **AnnouncementKindPicker** → selects one of 5 kind values.
4. System auto-suggests a tier based on selected kind (e.g. `celebration → social`,
   `urgent → external`). Operator can override via **AnnouncementTierPicker**.
5. Operator submits. `publish_announcement_atomic` RPC receives `kind` + `tier` in body.
6. RPC writes `announcement_meta` row atomically alongside `channel_message`.
7. Fan-out helper `fn_publish_announcement_notifications` resolves allowed channels from the
   tier mapping configured for the workspace (e.g. `external → ['email','push','in_app']`).

**Before pickers ship (V2 today):**

All four composer paths call `publish_announcement_atomic` with `kind` and `tier` defaulting
to `workspace_news` / `work` respectively. Day-Control server action (`send-broadcast-action.ts`)
uses the same RPC with these defaults. Kind/tier pickers are planned Track E deliverables.

---

### V2.2 Linking to an entity

**Intended flow (Track E + G):**

1. Operator, while composing, optionally opens an **EntityLinkPicker**.
2. Picker presents a search UI for the linked entity type (e.g. "Arrangement", "Vakt", "Policy").
3. Operator selects one entity.
4. Picker writes `entity_link_type` + `linked_entity_id` into the draft payload.
5. `publish_announcement_atomic` RPC persists both columns in `announcement_meta`.
6. On the read side, `get_channel_messages` (extended in M6) returns the sidecar columns.
7. **EntityLinkCTA** component renders a deep-link button: e.g. "Vis arrangement →".

**Current state:**

M6 migration extended `get_channel_messages` to return `kind`, `tier`, `entity_link_type`,
and `linked_entity_id` columns. EntityLinkPicker (Track E) and EntityLinkCTA mobile mount
(Track G) are deferred. The data contract is live; UI components pending.

---

### V2.3 External tier urgent path — email + push channel routing

The `tier` field drives channel fan-out. Tier→channel mappings are configured per workspace
in the V2 notification pipeline:

| Tier | Default allowed channels | Notes |
|---|---|---|
| `social` | `in_app` | Low-priority social broadcasts. |
| `work` | `push` · `in_app` | Standard operating broadcasts. |
| `external` | `email` · `push` · `in_app` | High-priority, crosses channels. |

When `tier='external'` is set, `fn_publish_announcement_notifications` inserts
`notification_outbox` rows for all three channels. The email row is consumed by the SendGrid
webhook consumer. Push is consumed by Expo push notification service. In-app updates the
realtime feed.

**Operator experience:**

- Manager selects `urgent` kind → system suggests `external` tier → manager confirms.
- Sends → all recipients receive email + push + in-app.
- Bulletin board card renders with **TierBadge** in the external-tier accent colour (high
  contrast, urgency signalling).

**Failure modes:**

- Email channel not configured → SendGrid rows skipped; push + in_app still fire.
- Workspace has `external` tier mapping overridden to exclude email → only push + in_app fire;
  RPC does not error.

---

### V2.4 Mobile bulletin V2 enhancements — TierBadge tier-color visualization

> Mobile is read-only for announcements per ADR-0133. No publish surface on mobile.

The `TierBadge` component (`ad5867593`) shipped as part of V2. It renders a small badge on
the announcement card indicating the tier context of the broadcast.

**TierBadge behavior:**

| Tier | Visual | Semantic |
|---|---|---|
| `social` | Warm neutral accent | "This is celebratory / community info." |
| `work` | Professional neutral | "This is standard operating comms." |
| `external` | High-contrast urgent accent | "This crosses channels — read now." |
| `null` (pre-V2 row) | Hidden (null-safe render) | Graceful fallback for Wave A rows. |

**EntityLinkCTA (deferred — Track G):**

The EntityLinkCTA component will render a tappable CTA button beneath the announcement body
when `entity_link_type` is non-null. It deep-links to the referenced entity within the mobile
app. Track G mount is deferred pending RAM headroom in a follow-up session.

**Mobile read surface (current state):**

Announcements appear inside the `news` channel chat view. M6 RPC columns are returned; the
mobile renderer conditionally shows `TierBadge` based on `tier` value. EntityLinkCTA renders
nothing until Track G ships (component exists; mount deferred).
