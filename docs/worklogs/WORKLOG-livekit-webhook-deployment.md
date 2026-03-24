---
title: "Worklog — livekit-webhook-deployment"
status: in_progress
updated: 2026-03-24
created: 2026-03-24
module: walkieTalkie
tags: [livekit, webhook, voice]
---
# Worklog — livekit-webhook-deployment
> Branch: `feat/livekit-webhook-deployment` | Worktree: wt-1 | Started: 2026-03-24

## Status: 🟡 In Progress

## Done
- [x] Verified 4 voice tables exist locally (channel_presence, channel_call_session, channel_call_participant, call_log)
- [x] Verified 14 RLS policies in place (JWT + API key for all tables)
- [x] Verified edge functions respond correctly (livekit-webhook 401, livekit-token 401)
- [x] Confirmed LiveKit env vars present in edge runtime container
- [x] Created test data (workspace, channel with audio_policy=open_mic, members, active session)
- [x] Built webhook test script using livekit-server-sdk for proper JWT signing
- [x] Fixed bug: upsert with partial unique index fails silently — changed to insert
- [x] End-to-end webhook test passing: participant_joined, participant_left, room_finished all write correct DB records

## Remaining
- [ ] Commit bugfix to branch
- [ ] Cloud deployment (migrations + edge functions) — happens via git push to development

## Decisions
| Date | Decision | Reason |
|------|----------|--------|
| 2026-03-24 | Use insert instead of upsert for channel_call_participant | Partial unique index (WHERE left_at IS NULL) not compatible with PostgREST onConflict |
| 2026-03-24 | Migration timestamp 20260422301000 is valid | Repo convention uses HHMMSS as sequence counter, not real time |

## Log
| Date | Time | Event |
|------|------|-------|
| 2026-03-24 | 15:45 | Feature started |
| 2026-03-24 | 16:00 | Local DB + edge functions verified |
| 2026-03-24 | 16:09 | LiveKit env vars confirmed in edge runtime |
| 2026-03-24 | 16:10 | Test data created, webhook test script built |
| 2026-03-24 | 16:13 | Bug found: upsert silently fails with partial unique index |
| 2026-03-24 | 16:15 | Bug fixed: insert + error logging. All 3 webhook events pass end-to-end |
