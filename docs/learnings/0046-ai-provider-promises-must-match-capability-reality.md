---
title: "AI provider promises must match capability reality — no theatre providers"
id: LEARNING_0046
status: canonical
layer: learning
created: 2026-04-17
updated: 2026-04-17
tags: [ai, mobile, botsson, council, trust, provider-pattern]
---

# Learning-0046: No theatre providers

## Context

2026-04-17 mobile strategy council. Agent-coordinator code-traced mobile Botsson and found:

- `apps/mobile/src/providers/botsson-provider.tsx:156-170` — `startVoiceSession()` sets status to "active" with NO Ultravox session start, NO `voiceSessionRef.current` assignment. Comment line 162-163 admits: "Voice session initialization will be wired in T12 when Ultravox WebRTC is integrated."
- `apps/mobile/src/components/ai/BotssonSheet.tsx:55` — transcript is local `useState`, never populated
- `apps/mobile/src/components/ai/BotssonSheet.tsx:128` — mic toggle calls `setMicrophoneMuted` which is a no-op when `voiceSessionRef.current` is null (which it always is)
- `apps/mobile/src/hooks/queries/use-botsson-chat.ts:290-298` — text mode writes directly to legacy `chat_message` table with no agent processing path

A user tapping the Botsson FAB on mobile sees the orb pulse, sees "Lytter…" status, taps the mic, and gets nothing. The provider exposed an interface that promised behavior, but the implementation was a stub waiting for a future ticket. This is a **theatre provider** — UI pretends, backend isn't there.

## Discovery

When a provider exposes an API surface (`startVoiceSession`, `sendMessage`, `setMicrophoneMuted`), consumers assume the API does what it claims. A no-op behind a real-looking method is a trust violation against:

- **Users** who tap and expect response
- **Developers** who call the API and assume side effects
- **Council reviewers** who read the surface and assume the implementation matches

The pattern is especially dangerous for AI features because:

- AI is harder to test end-to-end than CRUD
- "It seems to work" is not a real assertion
- The TODO comment ("wired in T12") is invisible to the consumer

### The invariant

**A provider must either (a) implement the promised behavior, (b) throw a clear error stating the behavior is not yet available, or (c) not expose the method at all.** Stub no-ops behind a real-looking interface are forbidden.

This applies to:
- Voice/audio session providers (Ultravox, LiveKit)
- AI chat providers (agent-sdk, BFF clients)
- Camera/sensor providers
- Any provider with a published method signature

## Application

- ADR-0132 forces mobile Botsson to route through web BFF — eliminates the theatre by making the implementation real
- New providers must include an integration test that asserts the documented behavior happens (network call sent, session started, etc.)
- Code review checklist: any provider method that exposes "session start," "send," or "play/record" must have a wired implementation OR throw a `NotImplementedError` with a tracking issue link
- TODO comments inside a no-op are not acceptable — convert to throw-with-tracking-issue

## Repeat-learning watch

If similar theatre patterns appear in other providers (camera, audio, push), this learning escalates to a CLAUDE.md hard rule.
