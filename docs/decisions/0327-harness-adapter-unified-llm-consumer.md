---
title: "SmartOut Harness — Unified LLM-Consumer Adapter"
id: ADR_0327
status: proposed
layer: decision
created: 2026-05-14
updated: 2026-05-14
module: harness
tags: [harness, botsson, llm-adapter, polish-wave, dead-pipe-fix]
---

# ADR-0327: SmartOut Harness — Unified LLM-Consumer Adapter

## Status

**Proposed** — 2026-05-14. Body (alternatives weighed in full, consequences, implementation phases, test plan) deferred to dedicated sortie. This document captures the decision and just enough context that the next session can resume the design without re-deriving the problem.

## Context

Council 2026-05-14 (see `docs/council/COUNCIL-LOG.md` 2026-05-14 entry) surfaced that the page-polish wave's Phase 7 (`useRegisterTools`) and Phase 8 (`site-map.json`) artifacts are runtime-unconsumed.

**Current pipe state (file:line evidence):**

| Layer | Status | Evidence |
|---|---|---|
| L1 client tool registry | wired | `apps/web/src/app/Botsson/_components/tool-registry.ts:53-65` |
| L1 BotssonProvider aggregate | wired | `apps/web/src/app/Botsson/_components/BotssonProvider.tsx:715-742` |
| L1 → useAgent serializer | wired | `packages/agent-sdk/src/context/session-context.ts:28-29` writes `body.selected_tools` |
| L2 voice path `/api/wizard/start` | **BREAK** | `apps/web/src/app/api/wizard/start/route.ts:38-130` reads `mission_id`, `voice`, `language`, `first_speaker`, `context`. Does NOT read `selected_tools`. Field silently dropped. |
| L2 voice path LiveKit registerTool | **STUB** | `packages/agent-sdk/src/providers/livekit.ts:38-40` returns early with log message. |
| L2 chat path BFF schema | **MISSING FIELD** | `apps/web/src/app/api/botsson/chat/route.ts:38-59` `RequestSchema` has no tool-related field. |
| L3 stage-engine chat schema | **MISSING FIELD** | `services/stage-engine/src/routes/agent/chat.ts:1-167` accepts no `client_tools` field. `toVercelTools()` operates only on server-side `SmartoutTool` registry. |
| L4 site-map.json consumer | **NONE** | Zero consumers in `apps/web/src/` or `services/`. Only `apps/web/scripts/validate-site-map.ts` reads it (drift detector). |

**Consequence:** ~75 page-scope tools shipped 2026-05-14 + ~42 total polished `_tools/use-*-tools.ts` files cannot be invoked by Botsson on either chat or voice today. They register correctly client-side and disappear at the BFF boundary.

**Future-consumer multiplication risk:** Slack bot, email assistant, API agent — each would need its own integration plumbing if the current fragmented pattern continues. Three current channels (chat, voice, site-map injection) already have three different non-pipes. The pattern does not scale.

**Pontus's directive (verbatim, 2026-05-14):**

> "I want the context tools and descriptions, and everything needs to be set in the harness. I want to be able to connect voice agent, chat agent, any agent at all. I want to be able to connect it to SmartOut Harness. And it should be unified. It should be an adapter that's handling everything."

## Decision

Build a unified **`HarnessAdapter`** in `packages/ai/src/harness/` (new directory) exposing a single contract that every LLM consumer (chat agent, voice agent, future Slack/email/API agents) plugs into.

### Contract surface (proposed signature; refine in sortie body)

```typescript
interface HarnessAdapter {
  // Tool surface for a given consumer + context
  getToolsForChannel(
    channel: "chat" | "voice" | "slack" | "email" | "api",
    pageRoute: string | null,
    userContext: { profile_id: string; workspace_id: string; role: string }
  ): Promise<{
    definitions: ClientToolDefinition[];
    implementations: Record<string, ClientToolImplementation>;
    systemPromptSlices: string[];
    authority: AuthorityConfig;
  }>;

  // Route catalog (subset filtered by user access)
  getSiteMap(userContext: UserContext): Promise<SiteMap>;

  // Hot-swap on navigation (long-lived sessions like voice)
  subscribeToRouteChange(callback: (newRoute: string) => void): Unsubscribe;
}
```

### Authority enforcement (server-side, mandatory)

- `workspace_id` derived from session auth — never read from request body (ADR-0151)
- Channel restriction per tool surface (ADR-0078 — PII tools chat-only, voice forbidden)
- Financial-mutation block per ADR-0244 — adapter `getAuthority()` strips any mutation tool with `risk_tier: financial` from voice/passive surfaces
- Mobile boundary per ADR-0133 — adapter exposes only Approve/Execute/Witness verbs to mobile consumers

### Location

`packages/ai/src/harness/` — shares type space with `packages/ai/src/capabilities/`, `packages/ai/src/adapters/`, `packages/ai/src/router/`. Becomes the formal L4-bridge that `BOTSSON-SYSTEM-MAP.md` has been missing.

### Build sequence (high-level — detail deferred to dedicated sortie)

1. **Phase 1:** Define `HarnessAdapter` interface + type contracts in `packages/ai/src/harness/`.
2. **Phase 2:** Implement registry source — adapter reads from client tool-registry singleton, capabilities registry, site-map.json, context-snapshot helper.
3. **Phase 3:** Chat consumer wired first (cheaper, no LiveKit dependency). Stage-engine BFF + `/agent/chat` schema accepts adapter output. Replace existing `toVercelTools` chain.
4. **Phase 4:** Voice consumer wired second. Fill `LiveKitVoiceSession.registerTool` stub. Voice-agent worker boots from adapter. Hot-swap on route change via LiveKit data channel.
5. **Phase 5:** Authority layer enforced server-side in adapter `getAuthority()`.
6. **Phase 6:** Future consumers (Slack/email/API) plug in via same interface — documented pattern.

### Decisions deferred to sortie body

- Adapter location confirmed `packages/ai/src/harness/` vs alternative `services/harness-adapter/` (new service)?
- Voice tool-delivery transport: LiveKit data channel vs RPC vs custom WebSocket?
- Hot-swap mechanism: per-route refresh vs session-fixed?
- Token-budget management: full site-map vs on-demand `requestSiteMap()` tool?
- Test strategy: integration tests vs trace-based contract tests?

## Consequences

**Positive:**
- Closes 75 dead-pipe tools shipped 2026-05-14 + 42 total polished `_tools/` files
- Single contract for any future LLM consumer (3rd-party agent, internal Slack bot, email assistant)
- Authority enforcement centralized — ADR-0078/0151/0244 enforced in one place, not per-consumer
- Skill text claims (Phase 7 + Phase 8 of `smartout-page-polish`) become factual once Phase 3 ships

**Negative / risks:**
- Single point of failure if adapter has a bug — every LLM consumer fails together
- Migration cost: existing capability-tool chain via `toVercelTools` needs refactor (not rewrite)
- Token budget for full site-map injection may exceed context limits — mitigation: on-demand tool

**Neutral:**
- Skill text demotion (companion commit) signals to readers that runtime claims are pending — no breakage of existing tests or types

**Full enumeration deferred to dedicated sortie.**

## Related

- ADR-0078 — Channel pinning (PII chat-only)
- ADR-0133 — Mobile surface boundary (verbs split)
- ADR-0134 — Mobile telemetry contract (workspace_id/actor_id resolution)
- ADR-0151 — workspace_id auth-derived (never body-forged)
- ADR-0244 — Financial mutation risk tier
- ADR-0297 — Workforce bootstrap pipe (precedent for context-injection pattern)
- L-0147 — Chair Self-Reversal pattern (this council 4th occurrence)
- L-0233 — Two LLM contexts trap (voice-agent + stage-engine prompt-context divergence)
- L-0264 — Pre-flight fact-check must grep alleged consumers (root cause of council finding)
- Handoff: `docs/handoffs/HANDOFF-2026-05-14-polish-wave-council-harness-adapter.md` — full code-trace evidence + open questions + skill-update plan
- Council log: `docs/council/COUNCIL-LOG.md` 2026-05-14 entry
