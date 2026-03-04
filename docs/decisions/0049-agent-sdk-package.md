---
title: "Agent SDK Package — @smartout/agent-sdk"
id: ADR_0049
status: accepted
layer: decision
created: 2026-03-30
updated: 2026-03-30
---

# ADR-0049: Agent SDK Package — `@smartout/agent-sdk`

## Context and Problem Statement

The voice agent client code was duplicated across multiple feature implementations. The `useBotsson` hook in the onboarding wizard hard-coded Ultravox, tool definitions, session management, and transcript handling in a single 575-line file. Any new agent touchpoint (employee dashboard chat, mobile app, future phone channel) would require copying and adapting this code. The `@smartout/ai` package contained server-side tool abstractions (`SmartoutTool`) but had no client-side counterpart.

## Decision Drivers

- Three separate voice implementations were emerging (onboarding, dashboard chat, planned mobile)
- No reusable abstraction existed for client-side agent sessions
- Ultravox `UltravoxSession` was imported directly in app code, coupling to the provider
- Tool definitions (as Ultravox `temporaryTool` objects) were duplicated and drift-prone
- Adding LiveKit as a fallback/alternative provider would require rewriting all call sites
- `useBotsson` mixed tool definitions, tool implementations, session lifecycle, and debug logging

## Considered Options

1. **Keep useBotsson and copy it** — fastest short-term, guaranteed long-term drift and duplication
2. **Upgrade useBotsson in-place** — refactor the existing hook to be more generic, still couples to onboarding
3. **Extract to @smartout/agent-sdk** — new monorepo package with clean public API, provider abstraction, tool registry

## Decision Outcome

Chosen option: **"Extract to @smartout/agent-sdk"**, because it establishes a single source of truth for agent client code, makes providers pluggable, and aligns with the existing `@smartout/ai` package pattern.

### Package structure

```
packages/agent-sdk/
  src/types.ts              — AgentConfig, AgentSession, VoiceProvider, ClientTool
  src/hooks/               — useAgent React hook (primary entry point)
  src/providers/           — Ultravox + LiveKit VoiceSession implementations
  src/tools/               — ClientTool registry, onboarding tools, dashboard tools
  src/context/             — Session context type
```

### Key interfaces

- **`useAgent(config: AgentConfig): AgentSession`** — single hook replacing all voice implementations
- **`VoiceProvider`** — interface implemented by Ultravox and LiveKit providers
- **`ClientTool`** — unified client tool type (definition + implementation bundled)
- **`buildToolKit(tools: ClientTool[]): ClientToolKit`** — converts to provider format
- **`createToolRegistry()`** — mutable registry for dynamic tool sets

### Provider abstraction

The `VoiceSession` interface wraps provider-specific clients:

```typescript
type VoiceSession = {
  join(url: string): void;
  leave(): void;
  muteMic(): void; unmuteMic(): void;
  sendText(text: string): void;
  registerTool(name: string, impl: ClientToolImplementation): void;
  on(event, handler): void; off(event, handler): void;
};
```

Switching providers (Ultravox → LiveKit) requires no changes at call sites.

## Rules & Consequences

- **Good, because** single import — `import { useAgent } from "@smartout/agent-sdk"` replaces all voice-specific code
- **Good, because** provider-agnostic — Ultravox and LiveKit implement the same interface
- **Good, because** tool definitions live in the SDK, not in app components
- **Good, because** `ultravox-client` is an optional peer dependency — apps that don't use voice don't pay the bundle cost
- **Bad, because** `useBotsson` must be migrated — existing onboarding code needs updating
- **Bad, because** additional package to maintain in the monorepo
- **Agent Impact:** All new agent-enabled UIs must import from `@smartout/agent-sdk`. Direct imports of `ultravox-client` in app code are forbidden. When adding a new client tool, add it to `packages/agent-sdk/src/tools/` not to the consuming component.

---

> After writing: register in `docs/decisions/0000-decision-log.md` and update the ADR table in `CLAUDE.md`.
