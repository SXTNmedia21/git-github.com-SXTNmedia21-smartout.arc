---
title: "LiveKit as WebRTC Provider"
id: ADR_0058
status: accepted
layer: decision
created: 2026-03-22
updated: 2026-03-22
---

# ADR-0058: LiveKit as WebRTC Provider

## Context and Problem Statement

Smartout needs real-time voice calling (1:1, group, push-to-talk) for its channel communications system. The solution must work on both web and React Native mobile, support future AI agent participants, and integrate with Supabase Edge Functions (Deno runtime).

## Decision Drivers

- Must support web + React Native with first-class SDKs
- Must have a Deno-compatible server SDK for Edge Function token minting
- Must support AI agent participants (future: Mr. Botsson joins calls)
- Must be deployable in EU for GDPR compliance
- Cost must scale with actual usage, not fixed infrastructure
- Open-source core preferred for long-term flexibility

## Considered Options

1. **LiveKit Cloud** — Open-source WebRTC platform with managed cloud offering
2. **Twilio Video** — Established video/voice API from Twilio
3. **Daily.co** — Developer-friendly video API
4. **Self-hosted Jitsi** — Open-source, self-managed

## Decision Outcome

Chosen option: **"LiveKit Cloud"**, because it uniquely satisfies all drivers.

- **Deno SDK**: `livekit-server-sdk` works in Deno/Edge Functions — Twilio and Daily.co have Node-only server SDKs
- **React Native**: `@livekit/react-native` is actively maintained with AudioSession management, Krisp noise filter, and Expo plugin support
- **AI agents**: LiveKit's Agent Framework is purpose-built for AI participants with voice activity detection and turn-taking — this aligns with Mr. Botsson's roadmap
- **EU region**: LiveKit Cloud offers EU deployment (Frankfurt) for GDPR
- **Open source**: MIT-licensed core means we can self-host if costs scale or vendor risk increases
- **Cost**: Pay-per-participant-minute with generous free tier, no fixed infrastructure

## Rules & Consequences

- **Good, because** single SDK family covers web, mobile, server, and future AI agents
- **Good, because** Krisp noise cancellation is built into the SDK (important for hospitality environments)
- **Bad, because** LiveKit is newer than Twilio — smaller community, fewer StackOverflow answers
- **Bad, because** React Native SDK requires Expo dev builds (not Expo Go)
- **Agent Impact:** All WebRTC token minting goes through `livekit-token` Edge Function. Never mint tokens client-side. Room names follow `{workspaceId}:{channelId}` format.

---

> After writing: register in `docs/decisions/0000-decision-log.md` and update the ADR table in `CLAUDE.md`.
