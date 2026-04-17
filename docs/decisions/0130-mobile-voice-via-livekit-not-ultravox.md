---
title: "Mobile Voice via LiveKit (Not Ultravox)"
id: ADR_0130
status: proposed
layer: decision
created: 2026-04-17
updated: 2026-04-17
---

# ADR-0130: Mobile Voice via LiveKit (Not Ultravox)

## Context and Problem Statement

Web Botsson uses Ultravox (`packages/agent-sdk/src/providers/ultravox.ts`). The npm `ultravox-client` package targets browser/Node and uses `WebRTC` browser APIs (`new UltravoxSession()`, `joinCall(url)`). React Native does not implement those browser APIs natively. Bringing Ultravox to mobile would require a React Native shim that does not exist today.

Meanwhile, mobile already ships `@livekit/react-native` + `@livekit/react-native-webrtc` (`apps/mobile/package.json:20-22`), and `packages/agent-sdk/src/providers/livekit.ts` exists as a sibling provider implementation.

## Decision Drivers

- Ultravox lacks a verified React Native build path
- LiveKit is already installed on mobile and has a working RN integration
- A LiveKit voice provider already exists in agent-sdk
- Maintaining two voice providers per platform doubles maintenance and divergence risk
- Voice on mobile is gated by ADR-0127 (BFF routing) and ADR-0078 (channel restrictions) — provider choice is independent of those concerns

## Considered Options

1. **Build a React Native shim for Ultravox.** Rejected: open-ended work; adds polyfills; no upstream support.
2. **Defer mobile voice indefinitely.** Rejected: voice is a primary mobile interaction model.
3. **Use LiveKit on mobile, keep Ultravox on web.** Chosen.

## Decision Outcome

**Chosen: Option 3 — provider per platform, surface-agnostic capability layer.**

## Rules & Consequences

### R1. Mobile voice provider = LiveKit
- Mobile uses `packages/agent-sdk/src/providers/livekit.ts`.
- Web continues to use `packages/agent-sdk/src/providers/ultravox.ts`.
- Capability code does not know about the provider — it talks to the agent-sdk provider abstraction.

### R2. Voice traffic still routes through BFF (ADR-0127)
- The voice provider connects directly to LiveKit's media plane (audio).
- The agent reasoning + tool calls + transcript still flow through the web BFF → stage-engine path.
- LiveKit is the audio transport; BFF is the agent control plane.

### R3. ADR-0078 channel enforcement applies equally
- Voice on mobile, like voice on web, MUST be rejected by capabilities marked `allowedChannels: ["chat"]`.
- The `tool ctx.channel` guard fires server-side regardless of voice provider.

### R4. Voice on mobile requires ADR-0127 to ship first
- The BFF route must exist before voice is wired.
- The channel guard test must pass before voice is exposed in UI.
- Voice on mobile is week 7+ work, not week 1-2.

### Agent Impact
- **Build agents:** mobile voice work imports from `packages/agent-sdk` (LiveKit provider), never from `ultravox-client` directly.
- **Coordinator:** when adding voice-related capabilities, test against both provider paths; no Ultravox-specific assumptions.

## Consequences

- **Good:** unblocks mobile voice without React Native shim work; reuses already-installed dependencies
- **Bad:** two voice providers to maintain; LiveKit's tool-calling semantics may differ from Ultravox's — needs an integration test
- **Migration cost:** ~3-5 days to wire LiveKit provider + integration test

---

> Registered in `docs/decisions/0000-decision-log.md`. Depends on ADR-0127. Cross-references ADR-0078, ADR-0107.
