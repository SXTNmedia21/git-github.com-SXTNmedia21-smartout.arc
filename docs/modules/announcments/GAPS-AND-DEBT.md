---
title: Announcements — Gaps & Debt
status: in_progress
updated: 2026-05-18
created: 2026-05-18
module: announcements
tags: [module, announcements, gaps, debt, audit]
---

# Announcements — Gaps & Debt

> Verified-working vs aspirational. Code citations for every gap. Read with [BLUEPRINT.md](./BLUEPRINT.md) when blueprint phases are defined.

## 1. Verification Method

For each item:
- **CODE** = grepped, line numbers cited.
- **JOURNEY/INTENT** = product intent that surfaces the gap.
- **GAP** = the delta between CODE and intent.
- **SEVERITY** = HIGH (blocks intended use), MEDIUM (parity/UX), LOW (cosmetic/follow-up).

## 2. Working Code (Shipped)

| # | Capability | Evidence |
|---|---|---|
| W1 | Announcement discriminator on `channel_message` | enum `channel_message_type` value `announcement` — `supabase/migrations/20260422300000_channel_communications.sql:9-13` |
| W2 | `news`-channel type seeded | `comm_channel_type` includes `'news'` — same migration |
| W3 | RLS dual-auth on `channel_message` (JWT + API key) | `supabase/migrations/20260422300100_channel_rls_policies.sql` |
| W4 | RLS targets `target_profile_ids[]` for `targeted_members` visibility | `channel_message_jwt_select` policy — same migration |
| W5 | Notification trigger branches on `message_type='announcement'` for `priority=1, mode='work'` | `supabase/migrations/20260528020000_announcement_notification_priority.sql` |
| W6 | Web bulletin full-page card feed | `apps/web/src/app/dashboard/komm/_components/NyheterClient.tsx` (641 lines) |
| W7 | Pin/unpin + sticky pinned strip | `PinnedStrip.tsx` + `NewsCardMenu.tsx` + `use-pin-message.ts` |
| W8 | Audience picker with 5 kinds + live recipient count | `use-audience-resolver.ts` + `RecipientCountPill.tsx` |
| W9 | Compose Sheet from cockpit Quick-Action | `cockpit/sheets/AnnounceSheet.tsx` + `cockpit/CockpitQuickActions.tsx:67` |
| W10 | Header create menu surfaces Nyhet entry | `GlobalCreateMenu.tsx:103` (`key:"news"`) |
| W11 | Day-Control Melding tab with alert/reminder/note + session tagging | `send-broadcast-action.ts` |
| W12 | Agent capability `publish_announcement` with two-call confirm pattern | `packages/ai/src/capabilities/communication/publish-announcement.ts` |
| W13 | Agent capability gated via `callGateAction` (ADR-0204) | same file |
| W14 | Voice channel rejected on agent path (ADR-0078) | same file |
| W15 | `broadcast.send` capability seeded in all workspaces (ADR-0189) | seed migration referenced in ADR-0189 |
| W16 | Telemetry: `channel.message.sent`, `channel.message.pinned`, `channel.message.unpinned`, `communication.broadcast_sent`, `news.post.created`, `news.post.reacted` | `packages/telemetry/src/registry.ts` lines 4171–4278, 11741–11799 |
| W17 | Telemetry routed to PostHog + Logger + activity_trail | `packages/telemetry/src/registry.ts` line 12277 |
| W18 | Mobile recognises announcement type and renders as system bubble | `apps/mobile/src/components/komm/ChannelMessageBubble.tsx:55` |
| W19 | Mobile sidebar labels `news` channel as "Nyheter" | `apps/mobile/src/hooks/queries/use-channels.ts:43,56` |
| W20 | Wave A engagement plan delivered (priority branching, audience picker, pin + strip) | `docs/modules/announcments/nyheter/project/docs/plans/PLAN-nyheter-engagement-wave-a.md` |

---

## 3. Known Gaps

### 3.1 SCHEMA — No sub-kind discrimination on announcement

**CODE:** `channel_message.message_type` is a single value `'announcement'`. No `announcement_kind` column or enum. `system_data` JSONB carries `audience_kind` and (for Day-Control) `broadcast_type` but no formal type-of-announcement.

**INTENT:** Operators want to distinguish "new menu" vs "new hire" vs "personaltreff (staff event)" vs "schedule change" vs "general note". Different sub-kinds drive different UI treatments (icon, default audience, copy-template, link affordance).

**GAP:** No enum, no column, no convention. All announcements are visually homogeneous.

**SEVERITY:** MEDIUM. Blocks differentiated UI. No data corruption risk.

### 3.2 SCHEMA — No link from announcement to other entities

**CODE:** `channel_message` has `event_id` FK to `channel_event` (lifecycle log), not to `staff_event` (calendar). No FK to `schedule_shift`, `policy`, `protocol`, `department`, etc. Body links are plain text.

**INTENT:** A "personaltreff" announcement should link to the `staff_event` row that holds RSVP state. A "new menu" announcement should link to the menu document. A "schedule update" should deep-link to the affected shift.

**GAP:** No polymorphic linking mechanism between an announcement and a target entity. Operators paste text descriptions; readers cannot tap-through.

**SEVERITY:** HIGH for personaltreff flow (RSVP UX broken until linked). MEDIUM for general entity linking.

### 3.3 SCHEMA — No tier / domain classification

**CODE:** No `tier` or `domain` column. All announcements share the same notification priority (`work`) and same UI treatment.

**INTENT:** Operators want to distinguish social (personalfest), operational (ny meny), and external (press release, message from owner). Different tiers might warrant different default audiences, different notification priorities, or different surface styling.

**GAP:** No classification. Tier is implicit in the body text only.

**SEVERITY:** MEDIUM. Notification priority differentiation is the most load-bearing miss.

### 3.4 SURFACE — Mobile composer absent

**CODE:** No file under `apps/mobile/src/` writes to `channel_message` with `message_type='announcement'`. No `/api/mobile/` route for announcements.

**INTENT:** Mobile boundary per ADR-0133 is "Approve/Execute on mobile, Author/Compose on web." Announcement publishing is authoring; mobile composer is correctly out-of-scope under ADR-0133. Recorded here only because operators commonly ask "can I post from my phone" — the answer is no, by design.

**GAP:** None — this is intentional. Marked for clarity only.

**SEVERITY:** N/A. Decision; not a defect.

### 3.5 SURFACE — Mobile dedicated bulletin layout absent

**CODE:** No mobile screen renders a card-feed layout for the news channel. Announcements render via `ChannelMessageBubble.tsx:55` (system bubble) inside the standard chat view of the `news` channel.

**INTENT:** Mobile is read-side; Wave A web parity (pinned strip, reactions, read-receipts, card layout) should reach mobile.

**GAP:** No dedicated mobile bulletin screen. No pinned strip. No reactions UI. No card layout.

**SEVERITY:** MEDIUM. Read parity gap. Tracked in Wave A follow-up `feat/mobile-nyheter-strip`.

### 3.6 SURFACE — Home widget for employees absent (both surfaces)

**CODE:**
- Web: cockpit is admin/manager-only. No employee home page has a "latest announcements" widget.
- Mobile: `NoShiftView.tsx` "Latest news" section is a hardcoded placeholder card with static text.

**INTENT:** Employees should see recent announcements on their home surface without navigating to the komm tab. The placeholder on mobile suggests this was intended but never wired.

**GAP:** No widget component, no read hook scoped for home-widget rendering, no live data flow.

**SEVERITY:** MEDIUM. Engagement gap — recent announcements stay invisible to employees who do not open komm.

### 3.7 SURFACE — Chat "+" inline-attach shortcut absent

**CODE:** Chat composer (in DM and channel views) has no plus-icon affordance to inline-attach a task / event / announcement. The header `GlobalCreateMenu` exists but is global-context only.

**INTENT:** Operators in a chat conversation should be able to convert "let's set up a personaltreff" into an announcement + linked staff_event from inside the chat composer, with audience pre-resolved from the channel context.

**GAP:** No `+`-icon menu, no in-thread compose flow, no conversion path.

**SEVERITY:** MEDIUM. UX friction; workaround is to switch to header menu or `/komm/nyheter`.

### 3.8 CODE — Audience resolver duplicated across web and agent

**CODE:**
- Web: `apps/web/src/app/dashboard/komm/_hooks/use-audience-resolver.ts`
- Agent: `packages/ai/src/capabilities/communication/audience-resolver.ts`

Both implement the same five-kind resolution. Web is client-side, agent is server-side.

**INTENT:** One implementation, two adapters. Sub-classifications and new audience kinds should land in one place.

**GAP:** Two implementations to keep in sync. Tested independently. Drift risk when new audience kinds are added.

**SEVERITY:** LOW. Tracked as harmonization candidate.

### 3.9 CODE — Direct Supabase mutations not gated via `callGateAction`

**CODE:**
- `use-send-announcement.ts` — direct Supabase mutation, no gate.
- `use-send-broadcast.ts` — direct Supabase mutation, no gate (uses service-role for channel create).
- Only `send-broadcast-action.ts` (Day-Control) and `publish-announcement.ts` (agent) gate via `broadcast.send`.

**INTENT:** Per ADR-0157, direct browser mutations are an accepted pattern for surface-driven composers. UI render-gating (`manager+` check on compose button) is the front-line defense. But the agent path goes through `callGateAction` while the surface paths do not — asymmetry.

**GAP:** Two of three composers bypass the capability gate. Authority/audit trail does not include a gate-action row for those publishes.

**SEVERITY:** LOW. Defended by RLS (`manager+` role check is in policy + UI), but inconsistent with the gated-mutation convention. Harmonization candidate.

### 3.10 SURFACE — Read-receipt aggregation per-card

**CODE:** `NyheterClient` fetches read-receipt counts per card on render. N cards = N receipt queries on initial bulletin open.

**INTENT:** Single batch fetch on feed open.

**GAP:** No `fn_news_read_receipts_batch` or equivalent RPC. Performance degrades with feed length.

**SEVERITY:** LOW for current scale. Tracked as Wave A follow-up `feat/nyheter-readreceipt-aggregation`.

### 3.11 i18n — Norwegian locale lags English

**CODE:** `packages/i18n/locales/en/komm.json` has full `nyheter.*` namespace (lines 158–201). Norwegian counterpart has partial coverage; several composer-side strings fall back to English.

**INTENT:** Norwegian is primary product locale.

**GAP:** Missing Norwegian translations for compose composer keys.

**SEVERITY:** MEDIUM for Norwegian operators. Cosmetic; functional.

### 3.12 FEATURE — Scheduled publish absent

**CODE:** No `publish_at` column. No scheduler integration. Publishes happen immediately on submit.

**INTENT:** Operators want to draft tonight's "good morning" announcement for tomorrow 06:00.

**GAP:** No schedule mechanic, no draft persistence.

**SEVERITY:** LOW. Workaround: post when needed. Future feature.

### 3.13 FEATURE — Edit-after-publish absent

**CODE:** No edit UI. `channel_message_jwt_update` policy allows own-message updates but no composer exposes it for announcements.

**INTENT:** Operators want to fix typos without delete-and-repost (which re-fires notifications).

**GAP:** No edit composer. No "edited" indicator on cards.

**SEVERITY:** LOW. Workaround: delete + repost (re-notifies). Future feature.

### 3.14 FEATURE — Expiry / auto-archive absent

**CODE:** No `expires_at` column. Old announcements scroll indefinitely.

**INTENT:** Time-bound announcements (e.g. "tonight's special") should drop from feed automatically after expiry.

**GAP:** No expiry mechanic, no cron, no archive surface.

**SEVERITY:** LOW. Cosmetic. Future feature.

---

## 4. Adjacent Debt (NOT this module, but touches it)

### 4.1 `staff_event` has no link from announcement

`staff_event` table exists with RSVP via `staff_event_attendee`. No FK from `channel_message` to it. When an operator posts a "personaltreff next Friday" announcement, the announcement is text-only and the staff_event (if any) is a separate calendar entry. Same operator workflow today produces two disconnected rows.

Cross-module fix would couple announcement schema to staff_event — see [§3.2](#32-schema--no-link-from-announcement-to-other-entities).

### 4.2 Cockpit is admin-only; employee surface is sparse

The cockpit (`HospitalityOperationsCockpit`) is the admin/manager home. Employee web has no comparable home surface — they land on `/dashboard` and navigate. Until an employee home surface exists, a "home widget for announcements" has no host.

### 4.3 `notification_outbox` consumers

The notifications module owns the outbox. Announcement priority branching is correct; whether the notification consumer (Expo push + in-app) respects `mode='work'` vs `mode='community'` differently (quiet hours, badge styling) is a notifications-module concern.

---

## 5. Gap Summary Table

| ID | Title | Severity | Schema? | Surface? | Code? |
|---|---|---|---|---|---|
| §3.1 | Sub-kind discrimination | MEDIUM | yes | yes | yes |
| §3.2 | Entity-link mechanism | HIGH (personaltreff) / MEDIUM | yes | yes | yes |
| §3.3 | Tier / domain classification | MEDIUM | yes | yes | yes |
| §3.4 | Mobile composer | N/A (by design) | no | no | no |
| §3.5 | Mobile bulletin layout | MEDIUM | no | yes | yes |
| §3.6 | Home widget (employee) | MEDIUM | no | yes | yes |
| §3.7 | Chat "+" inline-attach | MEDIUM | no | yes | yes |
| §3.8 | Audience resolver duplicated | LOW | no | no | yes |
| §3.9 | Direct mutations not gated | LOW | no | no | yes |
| §3.10 | Read-receipt batch fetch | LOW | no | no | yes |
| §3.11 | Norwegian i18n lag | MEDIUM | no | no | yes |
| §3.12 | Scheduled publish | LOW | yes | yes | yes |
| §3.13 | Edit-after-publish | LOW | no | yes | yes |
| §3.14 | Expiry / auto-archive | LOW | yes | yes | yes |
