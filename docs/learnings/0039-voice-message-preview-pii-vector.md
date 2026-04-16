---
title: Learning 0039 — Voice message_preview in analytics is a PII vector (ADR-0077 reinforcement)
status: captured
created: 2026-04-16
updated: 2026-04-16
module: security
tags: [learning, pii, voice, analytics, adr-0077]
---

# Learning 0039 — Voice message_preview in analytics is a PII vector

## Context

During Council R2 2026-04-16 review of PR #213, `services/stage-engine/src/routes/agent/chat.ts` added a `botsson.turn_started` telemetry event with `message_preview` = first 100 chars of `body.message`. On voice channel, `body.message` is a transcribed user utterance.

ADR-0077 forbids voice from handling critical data (personnummer, bank details, address). Three-layer defence: process allowed_channels, capability allowedChannels, tool ctx.channel guard.

The preview field defeats the third layer: even if the user's content is routed correctly and no tool writes PII to DB, the preview LEAKS the transcript to PostHog analytics where ADR-0077's protections do not reach.

## What we learned

Transcript content is PII when originated on voice. Any telemetry field that carries raw user content must be gated by channel. Product-analytics previews that are fine for chat are not fine for voice — the threat model is different.

## Why this matters

PostHog and activity_trail retention is not under the same data-minimisation controls as the DB layer. Logs often live longer and are queried by ops/analytics staff without the same access controls. Transcript leakage into analytics is a silent privacy regression.

## How to detect

- grep for any telemetry/emit/log call that carries `message`, `content`, `utterance`, `transcript`, or `body` into properties without a channel gate
- Code review rule: any emit that could receive voice content must either gate on `channel === "chat"` or redact

## How to fix

- Gate preview on `body.channel === "chat"` and use `"[voice — transcript redacted]"` on voice turns
- Prefer emitting derived signal (message length, intent classification) rather than raw text
- For cases where voice preview is genuinely needed (QA, consent-based session replay), build a separate opt-in path that hits a PII-isolated store

## Related

- ADR-0077 — Voice channel PII forbid
- ADR-0078 — Channel restriction three-layer defence
- Council 2026-04-16 R2 review (PR #213)
- Learning 0034 — capability-without-emit (sibling: this is emit-with-too-much-content)
