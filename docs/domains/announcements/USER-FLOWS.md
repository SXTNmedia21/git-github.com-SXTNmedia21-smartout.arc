---
title: "Announcements Domain — User Flows"
status: done
updated: 2026-05-23
created: 2026-05-23
domain: announcements
tags: [announcements, user-flows, journeys, manager, employee, mobile, wave-a, botsson]
mirror: verified
last_verified: 2026-05-23
---

# Announcements — User Flows

> Flow index. Links to `docs/journeys/` — does NOT duplicate journey content.

## Role Surfaces (verified)

| Role | Publish | Read | Pin/unpin | React | Delete |
|---|---|---|---|---|---|
| `owner` / `admin` | ✅ web only | ✅ | ✅ | ✅ | ✅ |
| `manager` | ✅ web only | ✅ | ✅ | ✅ | ✅ (own dept/team) |
| `employee` (active/trainee) | ❌ | ✅ | ❌ | ✅ | ❌ |
| `employee` (inactive/offboarding) | ❌ | scoped | ❌ | ❌ | ❌ |

Mobile is **read-only** for all roles per ADR-0133.

---

## Wave A Engagement Journeys

Shipped journeys for the Wave A engagement plan (audience picker, pin/unpin, priority routing, notification receipt):

| Journey | Role | Channel |
|---|---|---|
| [JOURNEY-nyheter-engagement-wave-a-manager-publishes-targeted-announcement.md](../../journeys/JOURNEY-nyheter-engagement-wave-a-manager-publishes-targeted-announcement.md) | manager | web |
| [JOURNEY-nyheter-engagement-wave-a-manager-pins-critical-announcement.md](../../journeys/JOURNEY-nyheter-engagement-wave-a-manager-pins-critical-announcement.md) | manager | web |
| [JOURNEY-nyheter-engagement-wave-a-manager-unpins-outdated-announcement.md](../../journeys/JOURNEY-nyheter-engagement-wave-a-manager-unpins-outdated-announcement.md) | manager | web |
| [JOURNEY-nyheter-engagement-wave-a-employee-sees-pinned-on-next-session.md](../../journeys/JOURNEY-nyheter-engagement-wave-a-employee-sees-pinned-on-next-session.md) | employee | web |
| [JOURNEY-nyheter-engagement-wave-a-push-arrives-with-operational-priority.md](../../journeys/JOURNEY-nyheter-engagement-wave-a-push-arrives-with-operational-priority.md) | employee | mobile |

---

## Botsson Publish-Announcement Journeys

Agent-path journeys for `publishAnnouncement` capability (communication domain, ADR-0370):

| Journey | Role | Channel |
|---|---|---|
| [JOURNEY-botsson-publishannouncement-capability-agent-drafts-then-publishes.md](../../journeys/JOURNEY-botsson-publishannouncement-capability-agent-drafts-then-publishes.md) | manager + Botsson | chat |
| [JOURNEY-botsson-publishannouncement-capability-agent-attempts-over-voice.md](../../journeys/JOURNEY-botsson-publishannouncement-capability-agent-attempts-over-voice.md) | manager + Botsson | voice (rejected) |
| [JOURNEY-botsson-publishannouncement-capability-pii-boundary-no-raw-ids.md](../../journeys/JOURNEY-botsson-publishannouncement-capability-pii-boundary-no-raw-ids.md) | manager + Botsson | chat |
| [JOURNEY-botsson-publishannouncement-capability-fail-closed-without-seed.md](../../journeys/JOURNEY-botsson-publishannouncement-capability-fail-closed-without-seed.md) | manager + Botsson | chat |

---

## Kind/Tier/Entity-Link Journey

Wave B (V2) announcement classification journey:

| Journey | Status |
|---|---|
| [JOURNEY-announce-kind-tier-link.md](../../journeys/JOURNEY-announce-kind-tier-link.md) | Authored — spec Track E pickers deferred |

---

## E2E Stabilize Journey

| Journey | Status |
|---|---|
| [JOURNEY-e2e-nyheter-stabilize-all-specs-green.md](../../journeys/JOURNEY-e2e-nyheter-stabilize-all-specs-green.md) | In progress — see E2E-COVERAGE.md |

---

## Lifecycle Overview

```
Operator writes in composer (draft in UI, no persistence)
  → submit → publish_announcement_atomic RPC (Wave B) or direct hook (Wave A)
    → channel_message INSERT (message_type='announcement')
    → announcement_meta INSERT (Wave B — kind/tier/entity_link)
    → fn_publish_announcement_notifications:
        priority fan-out → notification_outbox rows
          → push (mobile Expo) + in_app + email (external tier)
    → recipients receive notification
    → recipient opens feed → last_read_message_id advances → read-receipt visible to operator
    → recipient reacts (optional) → channel_message_reaction INSERT
    → operator pins (optional) → is_pinned/pinned_by/pinned_at set
    → operator soft-deletes (optional) → deleted_at set; row drops from feed
```

---

## Composer Door Map

| Door | Entry point | Composer | Write path |
|---|---|---|---|
| D1 Header | `GlobalCreateMenu.tsx:103` (`key:"news"`) | `AnnounceSheet` → `QuickBroadcast` | `use-send-broadcast.ts` |
| D2 Cockpit | `CockpitQuickActions.tsx:67` (`actions_announce`) | `AnnounceSheet` → `QuickBroadcast` | `use-send-broadcast.ts` |
| D3 Bulletin | `NyheterClient.tsx` "Skriv ny" | `ComposeAnnouncement` (in-page modal) | `use-send-announcement.ts` |
| D4 Day-Control | `WebDayControl` Melding tab | Alert/Reminder/Note flow | `send-broadcast-action.ts` (server action) |

D1 + D2 both open `AnnounceSheet` (same UI). D3 is the full-featured bulletin compose modal with audience picker. D4 is a narrower 3-button flow tied to `session_id`.

---

## Surface Coverage Matrix

| Capability | Web | Mobile | Note |
|---|---|---|---|
| Publish | ✅ 4 doors | ❌ | Mobile boundary ADR-0133 |
| Dedicated bulletin layout | ✅ `/komm/nyheter` | ❌ system bubble only | Mobile parity gap |
| Pinned strip | ✅ | ❌ | Mobile gap |
| React (emoji) | ✅ | ❌ | Mobile gap |
| Read receipts | ✅ per-card | partial (last_read via chat mechanic) | Batch-fetch gap |
| Push notification | ✅ in-app | ✅ Expo push | Same notification_outbox rows |
| Targeted filtering (RLS) | ✅ | ✅ | Shared RLS |
| TierBadge | ✅ (planned) | ✅ (`TierBadge.tsx`) | Mobile has it; web picker deferred |
| EntityLinkCTA | deferred (Track E) | deferred (Track G) | Component exists on mobile; mount pending |
| Home widget | ❌ | ❌ (placeholder only) | Both gaps |
| Edit after publish | ❌ | ❌ | Not supported anywhere |
| Delete | ✅ manager+ | ❌ | Mobile gap |
