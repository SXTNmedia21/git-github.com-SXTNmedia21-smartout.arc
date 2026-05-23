---
title: "Botsson — User Flows"
status: in_progress
mirror: verified
last_verified: 2026-05-23
updated: 2026-05-23
created: 2026-05-23
domain: botsson
tags: [domain, botsson, user-flows, journeys, voice, orb, mission]
---

# Botsson — User Flows

> Flow index. Links to `docs/journeys/JOURNEY-botsson-*`. Never duplicates journey content.
>
> Verified 2026-05-23: all linked files confirmed present by `ls /home/sxtnl/dev/smartout.ai/docs/journeys/ | grep botsson`.

## Core Botsson journeys

| Journey | Surface | Description |
|---|---|---|
| [JOURNEY-botsson-chat-input-request.md](../../journeys/JOURNEY-botsson-chat-input-request.md) | Orb / Chat | User sends text message to Botsson; response displayed in chat |
| [JOURNEY-botsson-harness-e2e-test.md](../../journeys/JOURNEY-botsson-harness-e2e-test.md) | Full harness | End-to-end harness test: chat input → intent classify → tool dispatch → response |

## Voice overlay — Orb + LiveKit

| Journey | Surface | Description |
|---|---|---|
| [JOURNEY-voice-plane-consolidation-botsson-overlay-voice-livekit.md](../../journeys/JOURNEY-voice-plane-consolidation-botsson-overlay-voice-livekit.md) | Orb voice call | User initiates LiveKit voice call from Orb; Botsson speaks via GPT-Realtime |

## Fase-4 proposal pipeline (5 journeys)

The proposal pipeline is how Botsson proposes actions (e.g. new shifts) and records accept/reject events. See `docs/superpowers/plans/2026-05-06-botsson-fase-4-proposal-pipeline.md` for forward plan.

| Journey | Surface | Description |
|---|---|---|
| [JOURNEY-botsson-fase-4-proposal-pipeline-voice-propose-shift.md](../../journeys/JOURNEY-botsson-fase-4-proposal-pipeline-voice-propose-shift.md) | Voice | Botsson proposes new shift during voice call |
| [JOURNEY-botsson-fase-4-proposal-pipeline-accept-creates-shift.md](../../journeys/JOURNEY-botsson-fase-4-proposal-pipeline-accept-creates-shift.md) | Voice / Chat | User accepts proposal; shift created in DB |
| [JOURNEY-botsson-fase-4-proposal-pipeline-reject-emits-trail.md](../../journeys/JOURNEY-botsson-fase-4-proposal-pipeline-reject-emits-trail.md) | Voice / Chat | User rejects proposal; `activity_trail` event emitted |
| [JOURNEY-botsson-fase-4-proposal-pipeline-auth-recorder-pipe.md](../../journeys/JOURNEY-botsson-fase-4-proposal-pipeline-auth-recorder-pipe.md) | Voice / BFF | Auth + recorder pipe for proposal submissions |
| [JOURNEY-botsson-fase-4-proposal-pipeline-cross-workspace-auth-boundary.md](../../journeys/JOURNEY-botsson-fase-4-proposal-pipeline-cross-workspace-auth-boundary.md) | BFF / Auth | Cross-workspace auth boundary enforcement |

## PublishAnnouncement capability (4 journeys)

The `publish_announcement` tool lives in `communication` capability (ADR-0240). These journeys document botsson's role as the initiating agent.

| Journey | Surface | Description |
|---|---|---|
| [JOURNEY-botsson-publishannouncement-capability-agent-drafts-then-publishes.md](../../journeys/JOURNEY-botsson-publishannouncement-capability-agent-drafts-then-publishes.md) | Chat | Botsson drafts announcement, manager confirms, publishes |
| [JOURNEY-botsson-publishannouncement-capability-agent-attempts-over-voice.md](../../journeys/JOURNEY-botsson-publishannouncement-capability-agent-attempts-over-voice.md) | Voice | Voice attempt; channel guard rejects (ADR-0078 chat-only) |
| [JOURNEY-botsson-publishannouncement-capability-pii-boundary-no-raw-ids.md](../../journeys/JOURNEY-botsson-publishannouncement-capability-pii-boundary-no-raw-ids.md) | Chat | PII boundary: no raw profile IDs in announcement payload |
| [JOURNEY-botsson-publishannouncement-capability-fail-closed-without-seed.md](../../journeys/JOURNEY-botsson-publishannouncement-capability-fail-closed-without-seed.md) | Chat | Fail-closed when authority not seeded for workspace |

## Related surface journeys (cross-domain, botsson-adjacent)

These journeys reference botsson components but are primarily owned by other domains or features:

| Journey | Primary domain | Notes |
|---|---|---|
| [JOURNEY-task-i1-role-compliance-a-botsson-answers-role-requirements.md](../../journeys/JOURNEY-task-i1-role-compliance-a-botsson-answers-role-requirements.md) | task | Botsson answers role-compliance query via task capability |
| [JOURNEY-ui-shell-pos-accounts-polish-botsson-tool.md](../../journeys/JOURNEY-ui-shell-pos-accounts-polish-botsson-tool.md) | ui-shell | Botsson tool bridge for POS accounts surface |
| [JOURNEY-ui-shell-website-polish-botsson-tool.md](../../journeys/JOURNEY-ui-shell-website-polish-botsson-tool.md) | ui-shell | Botsson tool bridge for website surface |

## Platform Admin journeys (session recorder)

Not separate journey files — covered under `JOURNEY-botsson-harness-e2e-test.md` and Phase 2c pending E2E (G11). Session recorder flows:

| Flow | Status | Coverage |
|---|---|---|
| Admin flags turn from Guardian Monitor | 🟢 built | Manual test only |
| Admin whispers into next turn | 🟢 built | Manual test only |
| Admin force-stops session | 🟢 built | Manual test only |
| Platform-admin break-glass PII reveal | 🟢 built | Manual test only |
| Arena LogView user escalation flag | 🟢 built | Manual test only |
| E2E: drawer click → whisper round-trip | 🔴 not built | Phase 2c gap |
| E2E: force-stop hold flow | 🔴 not built | Phase 2c gap |
| E2E: recorder failure injection | 🔴 not built | Phase 2c gap |

## Journey coverage summary

| Journey file | `e2e_test` frontmatter | Playwright spec |
|---|---|---|
| `JOURNEY-botsson-chat-input-request.md` | — | `apps/e2e/tests/botsson-harness-e2e.spec.ts` (partial) |
| `JOURNEY-botsson-harness-e2e-test.md` | — | `apps/e2e/tests/botsson-harness-e2e.spec.ts` |
| `JOURNEY-voice-plane-consolidation-botsson-overlay-voice-livekit.md` | — | None |
| `JOURNEY-botsson-fase-4-proposal-pipeline-*` (5) | — | None |
| `JOURNEY-botsson-publishannouncement-capability-*` (4) | — | None |

> G11 (Mission E2E 0 of 7) tracks this gap — see GAPS-AND-DEBT.md.
