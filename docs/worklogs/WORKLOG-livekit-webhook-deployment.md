---
title: "Worklog — livekit-webhook-deployment"
status: in_progress
updated: 2026-03-24
created: 2026-03-24
module: walkieTalkie
tags: [livekit, webhook, voice, video]
---

# Worklog — livekit-webhook-deployment

> Branch: `feat/livekit-webhook-deployment` | Worktree: wt-1 | Started: 2026-03-24

## Status: 🟡 In Progress

## Done

- [x] Verified 4 voice tables locally (channel_presence, channel_call_session, channel_call_participant, call_log)
- [x] Verified 14 RLS policies in place (JWT + API key)
- [x] Verified edge functions respond correctly
- [x] Confirmed LiveKit env vars in edge runtime container
- [x] Created test data + webhook test script (livekit-server-sdk JWT signing)
- [x] Fixed bug: upsert with partial unique index fails silently — changed to insert
- [x] End-to-end webhook test: participant_joined, participant_left, room_finished all write correct DB records
- [x] Added video/screen share grants to livekit-token (reads video_policy)
- [x] Added camera + screen share toggle to use-livekit-call hook
- [x] Updated CallBar with camera, screen share, mic, end call buttons
- [x] Enabled CallBar + IncomingCallOverlay in KommShell (were commented out)
- [x] Typecheck clean (0 errors in our files)

## In Progress

- [ ] Best practices review: research LiveKit patterns from other projects
- [ ] Code quality audit: chat components + data structure
- [ ] Browser testing with forward ports

## Remaining

- [ ] Cloud deployment (via git push to development)

## Decisions

| Date       | Decision                                                  | Reason                                                                                |
| ---------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| 2026-03-24 | Use insert instead of upsert for channel_call_participant | Partial unique index (WHERE left_at IS NULL) not compatible with PostgREST onConflict |
| 2026-03-24 | Migration timestamp 20260422301000 is valid               | Repo convention uses HHMMSS as sequence counter, not real time                        |
| 2026-03-24 | Grant video + screen_share based on video_policy enum     | Allows per-channel video control without token changes                                |

## Log

| Date       | Time  | Event                                                       |
| ---------- | ----- | ----------------------------------------------------------- |
| 2026-03-24 | 15:45 | Feature started                                             |
| 2026-03-24 | 16:00 | Local DB + edge functions verified                          |
| 2026-03-24 | 16:09 | LiveKit env vars confirmed in edge runtime                  |
| 2026-03-24 | 16:13 | Bug found + fixed: upsert → insert for partial unique index |
| 2026-03-24 | 16:15 | All 3 webhook events pass end-to-end                        |
| 2026-03-24 | 16:25 | Video/screen share support added to token + hooks + UI      |
| 2026-03-24 | 16:30 | CallBar + IncomingCallOverlay enabled in KommShell          |
| 2026-03-24 | 16:35 | Starting best practices research + code audit               |
