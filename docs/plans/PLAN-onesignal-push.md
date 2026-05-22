---
title: "Plan — onesignal-push"
feature: onesignal-push
spec: docs/superpowers/specs/2026-05-21-notification-system-design.md
status: draft
updated: 2026-05-22
created: 2026-05-22
module: MODULE_COMMUNICATION
tags: [plan]
---

# Plan — onesignal-push

> Branch: `feat/onesignal-push` | Worktree: `~/dev/smartout.ai-wt-5` | Base: `development` | Module: MODULE_COMMUNICATION

**Spec:** [Notification System — Unified 4-Channel Design](../superpowers/specs/2026-05-21-notification-system-design.md)
**Detailed task plan (TDD, bite-sized):** [OneSignal Push (P1)](../superpowers/plans/2026-05-21-onesignal-push-p1.md)

## Journeys (the contract)

- [JOURNEY-onesignal-push-employee-grants-push-permission](../journeys/JOURNEY-onesignal-push-employee-grants-push-permission.md) — Employee opens PWA, signs in, grants push permission; device subscribes via OneSignal external_id = profile_id
- [JOURNEY-onesignal-push-employee-receives-push](../journeys/JOURNEY-onesignal-push-employee-receives-push.md) — Employee receives a push for a notification event and taps it to deep-link into the PWA at the right route
- [JOURNEY-onesignal-push-critical-sms-fallback](../journeys/JOURNEY-onesignal-push-critical-sms-fallback.md) — Critical event for a user with no subscribed device falls back to SMS via Twilio

## Goal

Make the push channel deliver to the mobile PWA via OneSignal (replacing the dead Expo path), with deep-link navigation on tap, proven on a real device. Phase 1 of the unified 4-channel notification system.

## Tasks

See the detailed P1 plan for bite-sized TDD steps. Summary:

- [ ] Task 1 — ADR-0389 (OneSignal as push channel)
- [ ] Task 2 — Shared `sendOneSignalPush()` Deno helper + unit tests (TDD)
- [ ] Task 3 — Env keys (op:// refs, no raw secrets)
- [ ] Task 4 — Swap push-dispatch → OneSignal + deep links + SMS-preserve
- [ ] Task 5 — `react-onesignal` dep + web-guarded client helper
- [ ] Task 6 — Service worker shim at PWA root
- [ ] Task 7 — Wire init / login / logout into app lifecycle
- [ ] Task 8 — Dashboard config + Android device test (the one real risk)

## Out of scope (P1)

- 3×3 preference matrix (P2)
- AI `notify` tool + `set_reminder` outbox handler (P3)
- mobile preferences UI + digest/grouping bug fixes (P4)
- `day-line-push` + godmode broadcast OneSignal migration (P1-followup, spec D2)

## Acceptance Criteria

- [ ] Every declared journey has `status: verified` in frontmatter
- [ ] Typecheck passes: `pnpm turbo typecheck`
- [ ] Helper unit tests pass: `cd supabase/functions && deno test _shared/onesignal.test.ts --allow-net`
- [ ] Decision log updated (ADR-0389 registered)
- [ ] Device test recorded in HANDOFF (Android push received + deep link works)
