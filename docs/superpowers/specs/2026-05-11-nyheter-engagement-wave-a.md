---
title: Nyheter Engagement Wave A
status: approved
created: 2026-05-11
updated: 2026-05-11
module: MODULE_COMMUNICATION
tags: [nyheter, announcements, audience, pin, notification-priority]
---

# Nyheter Engagement Wave A

> Light spec pointer — full design + decisions live in the handoff bundle and implementation plan.

## What

Three Nyheter follow-up items bundled into one sortie:

- **Item A — Notification priority bump.** `trigger_channel_message_notification()` branches on `message_type='announcement'` → `priority=1, mode='work'`. Other types preserve `priority=0, mode='community'`.
- **Item B — Audience targeting UI.** `ComposeAnnouncement` Sheet replaces stub Select with 5-segment AudiencePicker (All / On duty / Department / Role / Individuals) + drilldowns + RecipientCountPill. `useSendAnnouncement` writes `target_profile_ids[]` + `visibility_scope` + `system_data.audience_kind`.
- **Item C — Pin/unpin UI.** Manager-only NewsCardMenu (DropdownMenu) drives `is_pinned` toggle via Server Action (RLS sender-only UPDATE bypassed via service-role + manager+ role guard). Sticky PinnedStrip renders pinned messages above feed.

## Why

Nyheter audit 2026-05-10 (development branch, `571575fa5`+`5cfe97d8f`+`ff97f773b`) shipped realtime + auto-mark-as-read. Three medium-priority debt holes remained: announcements competing on push priority with chat noise → push fatigue; `target_profile_ids[]` column dead despite schema + RLS support; `is_pinned` column inert. Council 2026-05-10 morning ranked items 3+5+6 as Wave A.

## Sources of truth

- **Design handoff:** [`docs/modules/announcments/nyheter/project/handoff/README.md`](../../modules/announcments/nyheter/project/handoff/README.md) — UX state-by-state detail, color tokens, motion specs, accessibility requirements
- **HTML prototype:** `docs/modules/announcments/nyheter/project/Nyheter Wave A.html` — pixel-perfect target with Smartout Nordic Split tokens inlined
- **JSX components:** `docs/modules/announcments/nyheter/project/nyheter-{shell,compose,app,data,icons}.jsx` — reference React for AudiencePicker + RecipientCountPill + PinnedStrip
- **Implementation plan:** [`docs/superpowers/plans/2026-05-10-nyheter-engagement-wave-a.md`](../plans/2026-05-10-nyheter-engagement-wave-a.md) — 7-task TDD plan with code blocks per step
- **Council verdicts:**
  - 2026-05-10 (item ranking) — APPROVE WITH CHANGES, Wave A bundle = 3+5+6
  - 2026-05-11 (plan review) — REJECT initial; APPROVE after 13 patches
- **Audit context:** session memory `feedback_*` + `learning_*` 2026-05-10 in user memory

## Constraints

- **Web-only authoring** (ADR-0133 — web composes, mobile executes). Mobile read-strip = separate sortie `feat/mobile-nyheter-strip`.
- **Botsson capability tools deferred.** `publishAnnouncement` capability requires ADR for `sendMessage` ADR-0287 retrofit first.
- **Pin Server Action ≠ capability tool.** ADR-0287 + ADR-0204 govern capability paths; Server Actions follow established `_actions/helpdesk-channel-actions.ts` precedent.
- **Telemetry registry edits scoped.** Pre-task A extends only `ChannelMessageSent` / `ChannelMessagePinned` / `ChannelMessageUnpinned` properties + adds `activity_trail` to unpinned routing.
- **`--color-pin` token added** to `globals.css` — not Tailwind palette `text-amber-600`.
- **i18n flat keys** — `@smartout/i18n` does NOT support ICU pluralization; use `_one`/`_other` suffixes + branch in component.
- **E2E uses service-role DB assertions** — `seedProfile` creates phantom `user_id` with no auth.users row, so cross-user UI test impossible without auth-fixture sortie. Wave A defers that.

## Out of scope

- ReadReceipt aggregation (`channel_message_read` write path + RPC)
- Mobile Nyheter surface
- Botsson `publishAnnouncement` capability
- `sendMessage` ADR-0287 retrofit
- `notification_outbox.action_url` entity-ref refactor
- ACK-required announcements (block clock-in)
- Reaction-prompted auto-pin
- Topic clustering / TL;DR summarizer

## Acceptance

Implementation plan defines task-level acceptance. Spec-level: all 5 declared journeys reach `status: verified`, typecheck passes, pgTAP passes, 3 E2E specs pass, HANDOFF written.
