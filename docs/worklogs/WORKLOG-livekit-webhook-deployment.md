---
title: "Worklog — livekit-webhook-deployment"
status: in_progress
updated: 2026-03-24
created: 2026-03-24
module: walkieTalkie
tags: [livekit, webhook, voice, video, webrtc]
---

# Worklog — livekit-webhook-deployment

> Branch: `feat/livekit-webhook-deployment` | Worktree: wt-1 | Started: 2026-03-24

## Status: 🟡 In Progress

## Done

- [x] Verified 4 voice tables locally + 14 RLS policies
- [x] Fixed webhook handler: upsert → insert for partial unique index
- [x] End-to-end webhook test passing (participant join/leave/room finish)
- [x] Added video/screen share grants to livekit-token
- [x] Added camera + screen share toggle to use-livekit-call hook
- [x] Enabled CallBar + IncomingCallOverlay in KommShell
- [x] 3-agent audit team: researcher + auditor + schema-reviewer
- [x] Fixed 20 audit issues (C1/C2 critical, H1-H7 high, S1/S2 schema, telemetry, a11y)
- [x] Fixed RLS infinite recursion on channel_member/channel_message
- [x] Fixed all channel RPCs to SECURITY DEFINER
- [x] Fixed call-command broadcast: REST API instead of WebSocket subscribe
- [x] Fixed livekit-token: canPublishSources SDK v2 crash, display_name column
- [x] Fixed auto-join after starting call (was two-click)
- [x] Fixed voiceEnabled check (disabled, not none)
- [x] Installed @livekit/components-react — CallRoom with VideoConference, RoomAudioRenderer
- [x] Speaker layout (GridLayout 1-2, FocusLayout 3+)
- [x] Live participant count from LiveKit room (not DB)
- [x] In-call chat panel reusing MessageTimeline + MessageInput
- [x] Preflight shows vault name + Supabase target
- [x] Fixed .env.template LiveKit vault refs
- [x] Voice + video working end-to-end in browser (2 users tested)

## Remaining

- [ ] Mobile-responsive CallRoom layout (w-96 chat panel breaks on mobile)
- [ ] Mute other participants (moderator controls via MemberPanel)
- [ ] 1Password: update smartout*ai/Supabase with JWT-format keys (sb_publishable* doesn't work)
- [ ] Webhook port forwarding for local testing (LiveKit Cloud → localhost)
- [ ] i18n: aria-labels and hardcoded Norwegian text
- [ ] Cloud deployment (via merge to development)

## Decisions

| Date       | Decision                                                        | Reason                                                        |
| ---------- | --------------------------------------------------------------- | ------------------------------------------------------------- |
| 2026-03-24 | Use insert instead of upsert for channel_call_participant       | Partial unique index not compatible with PostgREST onConflict |
| 2026-03-24 | SECURITY DEFINER on all channel RPCs                            | channel_member RLS self-references causing infinite recursion |
| 2026-03-24 | REST broadcast instead of WebSocket subscribe in edge functions | Edge functions have short lifespan, WebSocket subscribe hangs |
| 2026-03-24 | @livekit/components-react for video UI                          | Official components handle track attachment, layout, controls |
| 2026-03-24 | Reuse MessageTimeline for in-call chat                          | No need for separate LiveKit DataChannel chat                 |
| 2026-03-24 | call-command verify_jwt=false                                   | Function handles auth internally, avoids JWT format issues    |

## Log

| Date       | Time  | Event                                                 |
| ---------- | ----- | ----------------------------------------------------- |
| 2026-03-24 | 15:45 | Feature started                                       |
| 2026-03-24 | 16:15 | Webhook handler bug fixed + tested e2e                |
| 2026-03-24 | 16:30 | Video/screen share + CallBar enabled                  |
| 2026-03-24 | 16:35 | 3-agent audit team spawned                            |
| 2026-03-24 | 16:45 | 20 audit issues fixed + schema migration              |
| 2026-03-24 | 17:30 | RLS recursion discovered + fixed                      |
| 2026-03-24 | 17:45 | Call-command 403 fixed (JWT keys, RLS)                |
| 2026-03-24 | 18:00 | Voice working e2e (2 users)                           |
| 2026-03-24 | 18:15 | @livekit/components-react installed, CallRoom created |
| 2026-03-24 | 18:30 | Video + in-call chat working, session ended           |
