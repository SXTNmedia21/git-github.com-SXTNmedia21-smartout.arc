---
title: "Mobile is a Thin Client; AI/Capabilities Route Through Web BFF"
id: ADR_0127
status: proposed
layer: decision
created: 2026-04-17
updated: 2026-04-17
---

# ADR-0127: Mobile is a Thin Client; AI/Capabilities Route Through Web BFF

> Companion to ADR-0114 (Server Actions canonical mutation primitive — web-only).

## Context and Problem Statement

ADR-0114 established Server Actions as the canonical user-initiated mutation primitive on web. Server Actions do not exist on React Native. Council 2026-04-17 code-traced mobile Botsson and found: (a) mobile chat writes directly to legacy `chat_message` table and never reaches stage-engine, (b) zero of 14 capabilities in `packages/ai/src/capabilities/` are reachable from mobile, (c) no `EXPO_PUBLIC_STAGE_ENGINE_URL` config exists, (d) the ADR-0078 channel-security guard (layer 3 — `tool ctx.channel`) is vacuous on mobile because no tool execution path exists. Mobile inherits every divergence between the three concurrent web write paths plus invents its own.

## Decision Drivers

- Mobile must consume the same capabilities, authority gates, and channel restrictions as web — not invent parallel ones
- Stage-engine is HTTP-callable; the architecture allows mobile to participate, only the wiring is missing
- ADR-0078 channel security is unenforceable without a tool execution path
- Adding a public stage-engine deployment expands attack surface; reusing the web auth surface is safer
- React Native cannot use Next.js Server Actions or `createServerClient`

## Considered Options

1. **Mobile → public stage-engine endpoint directly.** Rejected: requires public deployment, CORS allowlist, separate API-key + JWT scheme.
2. **Mobile rolls its own agent backend.** Rejected: creates a fourth write path with its own authority posture; trust gate violation per ADR-0114.
3. **Mobile → web BFF (`/api/emma/chat`) → stage-engine.** Chosen.

## Decision Outcome

**Chosen: Option 3 — mobile is a thin client; all AI/capability traffic routes through the web BFF.**

## Rules & Consequences

### R1. Mobile AI traffic routes through web BFF
- Mobile POSTs to `${EXPO_PUBLIC_WEB_API_URL}/api/emma/chat` with the user's Supabase JWT in `Authorization: Bearer ...`.
- Web BFF forwards to stage-engine, preserving JWT context, channel pinning, and capability routing.
- Mobile never imports `@smartout/ai` or calls capabilities directly.

### R2. Mobile may import `@smartout/agent-sdk`
- `useAgentChat` from agent-sdk works in React Native if `apiEndpoint` is passed as an absolute URL.
- Replace mobile's hand-rolled `useBotssonChat` with `useAgentChat({ apiEndpoint: webBffUrl })` plus a thin Botsson context wrapper.

### R3. Channel pinning is a server-side decision
- Mobile sends `channel` hint in request body (`"chat"` or `"voice"`).
- BFF validates and pins `channel` in the stage-engine session — mobile cannot override.
- Capability `allowedChannels` enforcement is the BFF/stage-engine's job, not mobile's.

### R4. Direct mobile data calls remain allowed (per ADR-0029)
- Mobile may continue direct `supabase.from().select()` for first-party UI data — this is consistent with ADR-0029.
- Only AI/capability calls require the BFF detour. Raw data reads remain RLS-gated.

### R5. Legacy `chat_message`-direct Botsson is deprecated
- Mobile's current `chat_message` insert pattern is a trust violation (no agent processing happens) and must be removed by week 6.
- If transcript persistence is needed, stage-engine writes back into `chat_message` after producing the assistant turn.

### Agent Impact
- **Build agents:** when adding mobile AI features, route through `/api/emma/chat`. Never invoke capabilities from mobile.
- **Capability authors:** capabilities are surface-agnostic — they receive the same `AgentToolContext` regardless of which client originated the call.
- **Frontend-designer:** mobile UX assumes asynchronous BFF-mediated responses. No client-side capability decisions.

## Consequences

- **Good:** mobile inherits all web channel security + authority gating for free; one capability codebase serves both surfaces
- **Bad:** adds one network hop; mobile depends on web-app availability for AI features
- **Migration cost:** ~2 days to wire the BFF route + replace mobile chat sender; gates ADR-0130 (LiveKit voice) work

---

> Registered in `docs/decisions/0000-decision-log.md`. Companions ADR-0114. Cross-reference ADR-0078, ADR-0107.
