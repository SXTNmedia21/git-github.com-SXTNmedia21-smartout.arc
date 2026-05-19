---
title: Announcements — E2E Coverage
status: placeholder
updated: 2026-05-18
created: 2026-05-18
module: announcements
tags: [module, announcements, e2e, playwright, coverage, testing]
---

# Announcements — E2E Coverage

> Coverage status for the announcement module. No announcement-specific E2E test suite exists today.

## Status

No dedicated `apps/e2e/announcements/` or `apps/e2e/nyheter/` directory exists. Open Wave A follow-up `feat/e2e-nyheter-stabilize` (referenced in `PLAN-nyheter-engagement-wave-a.md`) is the unmerged work for stabilizing E2E coverage.

The closest existing coverage is the **komm channel** E2E suite which exercises `channel_message` mutations generically. Announcement-specific assertions (audience targeting, pinning, priority routing) are not asserted there.

## Coverage Matrix (current)

| Surface / Flow | Web Playwright | Mobile Maestro | Manual matrix | Status |
|---|---|---|---|---|
| Publish from bulletin board | ❌ | n/a | ❌ | uncovered |
| Publish from cockpit Quick-Action | ❌ | n/a | ❌ | uncovered |
| Publish from Day-Control Melding | ❌ | n/a | ❌ | uncovered |
| Publish from header create menu | ❌ | n/a | ❌ | uncovered |
| Audience targeting (`all`, `on_duty`, `department`, `role`, `individuals`) | ❌ | n/a | ❌ | uncovered |
| Pin / unpin | ❌ | n/a | ❌ | uncovered |
| React (emoji) | ❌ | n/a | ❌ | uncovered |
| Read-receipt advances `last_read_message_id` | ❌ | ❌ | ❌ | uncovered |
| Notification fan-out to `notification_outbox` | ❌ | n/a | ❌ | uncovered |
| RLS — non-targeted member cannot read `targeted_members` message | ❌ | n/a | ❌ | uncovered |
| Soft-delete drops from feed | ❌ | n/a | ❌ | uncovered |
| Voice channel rejected on agent path | ❌ | n/a | ❌ | uncovered |
| Mobile renders announcement as system bubble | n/a | ❌ | ❌ | uncovered |
| Mobile sidebar labels `news` as "Nyheter" | n/a | ❌ | ❌ | uncovered |
| `channel.message.sent` telemetry emits | ❌ | ❌ | ❌ | uncovered |
| `communication.broadcast_sent` telemetry emits | ❌ | n/a | ❌ | uncovered |

## Unit / Integration Coverage

| Layer | Coverage |
|---|---|
| `use-audience-resolver.ts` | unit tests TBD |
| `audience-resolver.ts` (agent port) | unit tests TBD |
| `publish-announcement.ts` capability | capability test TBD |
| `send-broadcast-action.ts` server action | server action test TBD |
| Notification trigger branching (`message_type='announcement'` → `priority=1`) | DB test TBD |

## Proposed E2E Suite (when blueprint phases land)

Suggested test files for `apps/e2e/announcements/`:

| File | Coverage |
|---|---|
| `publish-bulletin.spec.ts` | Compose + submit from bulletin board, verify card appears with correct `audience_label` pill |
| `publish-cockpit.spec.ts` | Open cockpit Quick-Action, compose, verify `AnnounceSheet` flow + row inserted |
| `publish-day-control.spec.ts` | Day-Control Melding tab alert/reminder/note flow, verify `system_data.session_id` set |
| `audience-targeting.spec.ts` | 5 audience kinds × resolved count × RLS read-side verification |
| `pin-unpin.spec.ts` | Pin from menu, verify `PinnedStrip` updates; unpin, verify drops |
| `react.spec.ts` | Add/remove emoji reactions, verify `channel_message_reaction` rows |
| `read-receipt.spec.ts` | Open feed, verify `last_read_message_id` advances; receipt visible to operator |
| `notification-priority.spec.ts` | Insert announcement, verify `notification_outbox` row carries `priority=1, mode='work'` |
| `rls-targeted-member.spec.ts` | Insert `targeted_members` message, login as non-targeted member, verify invisible |
| `soft-delete.spec.ts` | Delete from menu, verify `deleted_at` set + row drops from feed for all readers |
| `voice-rejected.spec.ts` | Call `publish_announcement` from voice channel, verify rejection |

Mobile (Maestro) candidates for `apps/mobile/maestro/announcements/`:

| Flow | Coverage |
|---|---|
| `news-channel-list.yaml` | komm tab sidebar shows "Nyheter" label |
| `announcement-system-bubble.yaml` | Open news channel, verify announcement renders as system bubble |
| `notification-receive.yaml` | Push notification arrives with work-priority, deep-links to news channel |

## See also

- `docs/modules/announcments/nyheter/project/docs/plans/PLAN-nyheter-engagement-wave-a.md` — references `feat/e2e-nyheter-stabilize` follow-up sortie.
- [BLUEPRINT.md](./BLUEPRINT.md) — when phases land, each phase MUST add its corresponding E2E entry here.
- [GAPS-AND-DEBT.md](./GAPS-AND-DEBT.md) — gap §3 entries map to test files above.
