---
title: Signal Channels — the three inbound streams
status: in_progress
updated: 2026-05-31
created: 2026-05-31
module: redesign-wiring
tags: [channels, heartbeat, telemetry, webhooks, observability]
---

# Signal Channels

Every signal in the system arrives on exactly one of three channels. The dashboard tags
each signal by channel so it's clear at a glance **which channel is live**.

| Channel       | What flows in                                                                                                     | Source                                                          | Log                                                   |
| ------------- | ----------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- | ----------------------------------------------------- |
| **heartbeat** | the liveness pulse — beats + stall-alerts. "Is this agent actually working?"                                      | `heartbeat.sh` (polls the activity feed)                        | `activity/heartbeat.jsonl`                            |
| **telemetry** | app events via `emit()` — the 112 to-register + the registered ones → `activity_trail` / `engine_event` / posthog | `packages/telemetry` registry + agent `delivered`/`gate` events | `activity/feed.jsonl` + per-domain `TELEMETRY-MAP.md` |
| **webhook**   | external inbound — Stripe, SendGrid, DocuSeal, LiveKit                                                            | `supabase/functions/*-webhook` edge functions                   | (live env)                                            |

## Event shape (channel-tagged)

```json
{
  "ts": "<ISO>",
  "channel": "heartbeat|telemetry|webhook",
  "event": "...",
  "agent": "...",
  "domain": "...",
  "detail": "...",
  "gate": "PASS|FAIL|null"
}
```

## How this ensures agents work

The **heartbeat** channel is the liveness guarantee. Every `BEAT` (15s) it reads the
activity feed and classifies each agent: live / working / stalled / done. An agent that
logged on but went silent past the stall threshold emits a `stall-alert` — a dark agent
is _visible_, not silently dead. Combined with the mechanical control.json gate (can't
fake done) and the loop-gate wall (can't stop early), the three together are the
"agents actually work" contract.
