---
title: Decision Log
status: done
updated: 2026-03-24
created: 2026-03-24
module: walkieTalkie
tags: [decisions]
---

# Decision Log — livekit-webhook-deployment

| #   | Date       | Decision                                                                                                                        | Status   |
| --- | ---------- | ------------------------------------------------------------------------------------------------------------------------------- | -------- |
| 1   | 2026-03-24 | Use insert instead of upsert for channel_call_participant — partial unique index not compatible with PostgREST onConflict       | Accepted |
| 2   | 2026-03-24 | SECURITY DEFINER on all channel RPCs — channel_member RLS self-references causing infinite recursion                            | Accepted |
| 3   | 2026-03-24 | REST broadcast instead of WebSocket subscribe in edge functions — edge functions have short lifespan, WebSocket subscribe hangs | Accepted |
| 4   | 2026-03-24 | @livekit/components-react for video UI — official components handle track attachment, layout, controls                          | Accepted |
| 5   | 2026-03-24 | Reuse MessageTimeline for in-call chat — no need for separate LiveKit DataChannel chat                                          | Accepted |
| 6   | 2026-03-24 | call-command verify_jwt=false — function handles auth internally, avoids JWT format issues                                      | Accepted |
| 7   | 2026-03-24 | Server-side mute via RoomServiceClient — client SDK can't mute remote participants, server API needed                           | Accepted |
