---
title: Announcements Module — Blueprint Index
status: in_progress
updated: 2026-05-18
created: 2026-05-18
module: announcements
tags: [module, announcements, nyheter, broadcast, channel-message, communication, source-of-truth]
---

# Announcements Module — Blueprint & Source of Truth

> Authoritative blueprint for Smartout's Announcement (Nyheter) surface. If code contradicts this folder → CODE wins, update these docs.

## Status

- **Today (channel-message subtype):** shipped. Announcement is a `channel_message` with `message_type='announcement'` posted into the `news` channel. Wave A (notification priority branching + audience picker + pin/unpin + PinnedStrip) shipped. Read on web; system-bubble rendering on mobile.
- **Sub-kind / tier / entity-link (planned):** no active blueprint. Gaps inventoried in [GAPS-AND-DEBT.md](./GAPS-AND-DEBT.md); design work pending.

## Reading order

| # | Doc | Purpose |
|---|---|---|
| 1 | [MODULE_ANNOUNCEMENTS.md](./MODULE_ANNOUNCEMENTS.md) | Main module doc — overview, identity (subtype of channel_message), purpose, surfaces, authority, invariants |
| 2 | [DATA-MODEL.md](./DATA-MODEL.md) | All tables touched, enums (full values), RLS, triggers, telemetry events |
| 3 | [ARCHITECTURE.md](./ARCHITECTURE.md) | L1-L5 code map: web composers + bulletin board + cockpit + capability layer + mobile |
| 4 | [USER-FLOWS.md](./USER-FLOWS.md) | Admin / employee journeys, web vs mobile surface matrix, edge cases, lifecycle |
| 5 | [GAPS-AND-DEBT.md](./GAPS-AND-DEBT.md) | Verified-working vs aspirational. 10 gaps classified by severity. |
| 6 | [BLUEPRINT.md](./BLUEPRINT.md) | Implementation plan (placeholder — pending gap-analysis sortie). |
| 7 | [E2E-COVERAGE.md](./E2E-COVERAGE.md) | Coverage status — Playwright + manual matrix. |
| 8 | [nyheter/](./nyheter/) | Designer handoff bundle (claude.ai/design export) + Wave A plan. |

## Cross-references

### ADRs

- **Accepted:** [ADR-0078](../../decisions/0078-voice-channel-restrictions.md), [ADR-0156](../../decisions/0156-day-control-panel-canonical-admin-surface.md), [ADR-0157](../../decisions/0157-direct-supabase-mutations-vs-server-actions.md), [ADR-0189](../../decisions/0189-broadcast-send-capability-seed.md), [ADR-0204](../../decisions/0204-gated-mutation-wrapper.md), [ADR-0277](../../decisions/0277-mobile-bff-authority-context.md), [ADR-0331](../../decisions/0331-dagslinjen-audience-jsonb-vs-junction.md)
- **Adjacent:** ADR-0039 (workspace-api gateway), ADR-0099 (gate_action), ADR-0114 (Server Actions), ADR-0132 (mobile AI routing), ADR-0133 (mobile boundary), ADR-0134 (mobile telemetry contract), ADR-0151 (server-resolved IDs), ADR-0287 (gate_action mandatory)
- **Proposed:** TBD — sub-kind discrimination + entity-link + tier classification (pending design after gap-analysis).

### Journeys

No journey docs exist for announcements yet. To be authored when blueprint phases are defined.

### Code locations

- **Web bulletin board:** `apps/web/src/app/dashboard/komm/nyheter/page.tsx` + `apps/web/src/app/dashboard/komm/_components/NyheterClient.tsx`
- **Web composers:** `apps/web/src/app/dashboard/komm/_hooks/use-send-announcement.ts`, `apps/web/src/app/dashboard/_hooks/use-send-broadcast.ts`, `apps/web/src/app/dashboard/_actions/send-broadcast-action.ts`
- **Cockpit Sheet:** `apps/web/src/components/dashboard/cockpit/sheets/AnnounceSheet.tsx` + `apps/web/src/components/dashboard/interactive/QuickBroadcast.tsx`
- **Header create menu:** `apps/web/src/components/dashboard/GlobalCreateMenu.tsx` (line 103, `key:"news"`)
- **Pin/strip:** `apps/web/src/app/dashboard/komm/_components/{PinnedStrip,NewsCardMenu}.tsx` + `apps/web/src/app/dashboard/komm/_hooks/use-pin-message.ts`
- **Audience resolver (web):** `apps/web/src/app/dashboard/komm/_hooks/use-audience-resolver.ts`
- **Audience resolver (server, agent):** `packages/ai/src/capabilities/communication/audience-resolver.ts`
- **Agent capability:** `packages/ai/src/capabilities/communication/publish-announcement.ts`
- **Mobile channel list:** `apps/mobile/src/hooks/queries/use-channels.ts:43,56`
- **Mobile message bubble:** `apps/mobile/src/components/komm/ChannelMessageBubble.tsx:55`
- **Mobile home placeholder:** `apps/mobile/src/components/home/NoShiftView.tsx`
- **Telemetry registry:** `packages/telemetry/src/registry.ts` lines 4171–4278, 11741–11799, 12277
- **Schema:** `supabase/migrations/20260422300000_channel_communications.sql`, `…300100_channel_rls_policies.sql`, `…300200_channel_functions.sql`, `…310100_channel_message_notification_trigger.sql`, `20260528020000_announcement_notification_priority.sql`
- **Platform-admin (out-of-module):** `apps/web/src/app/api/platform-admin/communications/*`

### Sibling modules

- [MODULE_COMMUNICATION](../MODULE_COMMUNICATION.md) — channel infrastructure (channel, channel_member, channel_message) that announcements ride on.
- [daytimeline/MODULE_DAYTIMELINE](../daytimeline/MODULE_DAYTIMELINE.md) — Day-Control Melding tab is a fourth announcement composer scoped to a session.
- [task-manager/](../task-manager/) — task ontology siblings (announcement is the broadcast counterpart to task's assign-and-track pattern).

## Authoring rules

- All announcement mutations from the agent path gate via `gatedMutation` (ADR-0204). Direct browser writes still occur in two of three composers (`use-send-announcement` and `use-send-broadcast`) per ADR-0157; agent path is the gated variant.
- All mutations emit telemetry via `emit()` from `@smartout/telemetry`. Register in BOTH `SmartoutEvent` union AND `EVENT_ROUTING` map (recurrence trap).
- Service-role is used to resolve-or-create the `news` channel from inside the broadcast action — JWT RLS blocks `news`-channel creation by design.
- Voice channel publishing is rejected (ADR-0078). Announcements are chat-only on the agent path.
- Mobile remains read-only per ADR-0133 — no announcement composer on mobile.
- New mutation capability tools require a seed migration before merge (L-0066 default-allow CVE class).

## Glossary

- **Announcement** — engineering term. A `channel_message` row with `message_type='announcement'`.
- **Nyheter** — Norwegian product label for the same thing. The bulletin board page is `/dashboard/komm/nyheter`.
- **News channel** — `channel` row with `channel_type='news'`. The canonical posting surface for announcements; one per workspace by convention.
- **Broadcast** — operator-facing verb for the act of publishing. The Day-Control composer uses `broadcast_type` (alert/reminder/note) in `system_data`.
- **Audience kind** — one of `all`, `on_duty`, `department`, `role`, `individuals`. Resolves to `{ count, profileIds[] }`.
- **Targeted vs all-members** — `visibility_scope` enum. `targeted_members` requires `target_profile_ids[]` and filters RLS reads.
- **Pinned strip** — sticky horizontal scroller of pinned announcements at top of the bulletin board.
- **Wave A** — first ship of the Nyheter Engagement plan (notification priority + audience picker + pin/unpin). Done.
- **AnnounceSheet** — right-side Sheet wrapping `QuickBroadcast`. Opened from cockpit Quick-Action and from header "Ny ▾" → Nyhet.
- **`broadcast.send`** — capability key gated by `gate_action`. Seeded in all workspaces per ADR-0189.
