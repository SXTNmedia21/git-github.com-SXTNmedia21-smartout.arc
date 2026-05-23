---
title: "Announcements Domain — E2E Coverage"
status: in_progress
updated: 2026-05-23
created: 2026-05-23
domain: announcements
tags: [announcements, e2e, playwright, coverage, testing]
mirror: verified
last_verified: 2026-05-23
---

# Announcements — E2E Coverage

> Coverage matrix — proof of what is actually built and tested. Honest delta from proto-spine `docs/modules/announcments/E2E-COVERAGE.md` (which had 100% uncovered). Wave B added real spec files.

---

## Status Summary

Unlike the proto-spine E2E-COVERAGE.md (dated 2026-05-18 — entirely uncovered), Wave B delivery added Playwright specs and DB integration tests. Coverage is partial: Wave A engagement flows are partially covered; Wave B DB-level tests exist; agent-path journeys have E2E specs.

---

## Playwright Specs (Web)

### `apps/e2e/komm-nyheter/` — Wave A Engagement

| Spec | Covers | Status |
|---|---|---|
| `journey-1-priority-bump.spec.ts` | Notification priority routing (`announcement.published` event_key, `priority=1`) | ✅ exists |
| `journey-2-audience-targeting.spec.ts` | 5 audience kinds + RLS read-side filtering | ✅ exists |
| `journey-3-pin-unpin-realtime.spec.ts` | Pin/unpin + PinnedStrip realtime update | ✅ exists |

### `apps/e2e/komm-nyheter/agent-publish/` — Botsson Journeys

| Spec | Journey | Status |
|---|---|---|
| `journey-1-draft-then-publish.spec.ts` | Agent drafts → manager confirms → publishes | ✅ exists |
| `journey-2-voice-reject.spec.ts` | Voice channel attempt → ADR-0078 rejection | ✅ exists |
| `journey-3-fail-closed.spec.ts` | No authority seed → fail-closed behavior | ✅ exists |
| `journey-4-pii-boundary.spec.ts` | No raw `target_profile_ids` in tool return | ✅ exists |

### `apps/e2e/specs/announcement-kind-tier.spec.ts` — Wave B Kind/Tier

| Coverage | Status |
|---|---|
| Kind/tier picker compose flow (AnnouncementKindPicker, AnnouncementTierPicker) | ✅ exists (NOTE: pickers are Track E deferred — spec tests the RPC path directly; picker UI assertions may fail until Track E ships) |

---

## DB Integration Tests

### `apps/e2e/db/announcement-atomic-rpc.spec.ts`

| Coverage | Status |
|---|---|
| `publish_announcement_atomic` atomicity: `channel_message` + `announcement_meta` in one TX | ✅ exists |
| Tier-driven notification fan-out priority/channels verification | ✅ exists |
| `meta_kind_link_consistent` CHECK constraint rejection | ✅ exists |
| Service-role bypass path | ✅ exists |
| PGRST203 overload (14-param vs 16-param) — regression check | ✅ exists |

---

## Coverage Gap Matrix

| Surface / Flow | Web Playwright | Mobile | Status |
|---|---|---|---|
| Publish from bulletin board (`ComposeAnnouncement`) | ❌ | n/a | uncovered |
| Publish from cockpit Quick-Action | ❌ | n/a | uncovered |
| Publish from Day-Control Melding tab | ❌ | n/a | uncovered |
| Publish from header create menu | ❌ | n/a | uncovered |
| Audience targeting (5 kinds) | ✅ `journey-2-audience-targeting.spec.ts` | n/a | covered |
| Pin / unpin + PinnedStrip | ✅ `journey-3-pin-unpin-realtime.spec.ts` | n/a | covered |
| React (emoji) | ❌ | n/a | uncovered |
| Read-receipt advances `last_read_message_id` | ❌ | ❌ | uncovered |
| Notification priority fan-out to `notification_outbox` | ✅ `journey-1-priority-bump.spec.ts` | n/a | covered |
| RLS: non-targeted member cannot read `targeted_members` message | ✅ `journey-2-audience-targeting.spec.ts` | n/a | covered |
| Soft-delete drops from feed | ❌ | n/a | uncovered |
| Voice channel rejected on agent path | ✅ `journey-2-voice-reject.spec.ts` | n/a | covered |
| Agent draft → confirm → publish | ✅ `journey-1-draft-then-publish.spec.ts` | n/a | covered |
| PII boundary (no raw profile_ids) | ✅ `journey-4-pii-boundary.spec.ts` | n/a | covered |
| Fail-closed without authority seed | ✅ `journey-3-fail-closed.spec.ts` | n/a | covered |
| Kind/tier via RPC (DB-level) | ✅ `announcement-atomic-rpc.spec.ts` | n/a | covered |
| Mobile: announcement renders as system bubble | n/a | ❌ | uncovered |
| Mobile: sidebar labels `news` as "Nyheter" | n/a | ❌ | uncovered |
| Mobile: TierBadge renders correct tier color | n/a | ❌ | uncovered |
| `channel.message.sent` telemetry emits (Wave B props) | ❌ | ❌ | uncovered |
| `communication.broadcast_sent` telemetry emits | ❌ | n/a | uncovered |
| Celebration branch: idempotency gate (once per birthday per day) | ❌ | n/a | uncovered |

---

## Unit / Integration Coverage

| Layer | Status |
|---|---|
| `publish-announcement.ts` capability | ✅ `publishAnnouncement.test.ts` |
| Celebration branch | ✅ `publishCelebrationBirthday.test.ts` |
| `use-audience-resolver.ts` (web hook) | ❌ unit tests pending |
| `audience-resolver.ts` (agent port) | ❌ unit tests pending |
| `send-broadcast-action.ts` (server action) | ❌ pending |
| Notification trigger guard (M5) | included in `announcement-atomic-rpc.spec.ts` DB tests |

---

## E2E Stabilize Sortie

Open follow-up: `feat/e2e-nyheter-stabilize` (see `docs/HANDOFF-e2e-nyheter-stabilize.md`).

Proposed additions:
- `publish-bulletin.spec.ts` — `ComposeAnnouncement` + verify card in feed
- `publish-cockpit.spec.ts` — `AnnounceSheet` flow
- `publish-day-control.spec.ts` — alert/reminder/note + `system_data.session_id`
- `react.spec.ts` — emoji reactions
- `read-receipt.spec.ts` — `last_read_message_id` advances
- `soft-delete.spec.ts` — `deleted_at` set + drops from feed
- Mobile Maestro: `news-channel-list.yaml`, `announcement-system-bubble.yaml`
