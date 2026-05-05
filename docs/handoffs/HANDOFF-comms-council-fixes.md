---
title: "Handoff — comms-council-fixes"
feature: comms-council-fixes
branch: fix/comms-council-fixes
closed: 2026-03-28
module: communications
---

# Handoff — comms-council-fixes

## Summary

Fixed all P0/P1 issues from the System Council audit of Chat, Komm, and WebRTC/LiveKit systems. Three telemetry gaps closed (chat reactions, chat read, komm mute), one React anti-pattern fixed (queueMicrotask in CallRoom), and ADR-0063 written formalizing Komm as the canonical messaging system with Chat frozen.

## What Was Done

- [x] Registered 3 new telemetry events in registry: `chat.reaction.toggled`, `chat.read`, `channel.call.participant_muted`
- [x] Added `emit()` to Chat `useToggleReaction` hook (onSuccess)
- [x] Added `emit()` to Chat `useMarkAsRead` hook (onSuccess)
- [x] Added `emit()` to Komm `useMuteParticipant` hook (onSuccess + profileId param)
- [x] Replaced `queueMicrotask` with `useEffect` in `CallRoom.tsx`
- [x] Wrote ADR-0063: Communication System Consolidation (Komm canonical, Chat frozen)
- [x] Logged council session in COUNCIL-LOG.md
- [x] Applied council review feedback (6 fixes)

## Decisions Made

| Decision                                 | Reason                                                                                      | Impact                                                                                       |
| ---------------------------------------- | ------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| ADR-0063: Komm canonical, Chat frozen    | Two parallel messaging systems with undocumented boundary; Komm is architecturally superior | All new messaging features target Komm. Chat receives only bug fixes and telemetry backfill. |
| `chat.read` entity_type = "conversation" | The entity being acted on is the conversation, not a message                                | Correct audit trail semantics                                                                |
| Freeze comments on Chat hooks            | Signal to future developers that Chat is frozen                                             | Prevents accidental feature development on deprecated system                                 |

## Learnings

| Learning                                                                          | Context                                                                                  |
| --------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Plan event interfaces must include `entity: EntityRef` when emit calls use entity | Initial plan omitted it, caught by typecheck during verification                         |
| Decision log is per-branch and gets overwritten on merge                          | Council caught that the global decision log was being replaced instead of appended to    |
| TanStack Query v5: use `.mutate` not full object in useCallback deps              | Mutation result object is new every render; only `.mutate` is stable                     |
| `queueMicrotask` in React render body is an anti-pattern                          | Breaks React's update batching model; useEffect is the correct way to sync derived state |

## Known Issues / Debt

- ~20+ hardcoded Norwegian strings in Chat + Komm (P2, i18n sweep)
- Chat JSONB reaction race condition (P2, mitigated by Chat freeze)
- `packages/ai/capabilities/communication/` queries frozen Chat tables — must migrate to Komm before ADR-0063 Phase 3
- Parallel tool sets in packages/ai: capabilities/communication (Chat) vs tools/channels.ts (Komm) — should consolidate
- `onParticipantCountChange` callback in CallRoom has no stability contract (works today with useState setter)
- LiveKit Nordic Split theming not yet implemented (P3)

## Next Steps

- Merge to development
- Create issue for agent communication capability migration (Chat → Komm)
- Create issue for i18n sweep across Chat + Komm
- ADR-0063 Phase 2: Add `channel_type = 'ai_assistant'` to Komm when AI-in-channels ships
