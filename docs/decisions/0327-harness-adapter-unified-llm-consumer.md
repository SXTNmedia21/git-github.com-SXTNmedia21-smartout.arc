---
title: "SmartOut Harness — Unified LLM-Consumer Adapter"
id: ADR_0327
status: accepted
layer: decision
created: 2026-05-14
updated: 2026-05-14
module: harness
tags: [harness, botsson, llm-adapter, polish-wave, dead-pipe-fix]
---

# ADR-0327: SmartOut Harness — Unified LLM-Consumer Adapter

## Status

**Accepted** — 2026-05-14. Body complete (alternatives, consequences, phase detail, test strategy, migration path, open questions). MVP sortie = Phase 1 (interface) + Phase 2 (registry sources). Consumer wiring deferred: Phase 3 (chat) + Phase 4 (voice) are explicit follow-on sorties.

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

## Alternatives Considered

### A. Per-consumer integration (status quo)

Each LLM consumer owns its own tool-fetch path. Chat path queries capabilities directly; voice path would build its own tool list; a future Slack bot would wire its own.

**Why this fails — code-trace evidence:**

| Pipe gap | File:line | Status |
|---|---|---|
| `/api/wizard/start` drops `selected_tools` | `apps/web/src/app/api/wizard/start/route.ts:38-130` | BREAK — field never read |
| `LiveKitVoiceSession.registerTool()` stub | `packages/agent-sdk/src/providers/livekit.ts:38-40` | STUB — returns early |
| Chat BFF `RequestSchema` has no tool field | `apps/web/src/app/api/botsson/chat/route.ts:38-59` | MISSING FIELD |
| Stage-engine `toVercelTools()` server-only | `services/stage-engine/src/routes/agent/chat.ts:1-167` | MISSING FIELD |
| `site-map.json` — zero consumers in codebase | `apps/web/scripts/validate-site-map.ts` (only reader) | DEAD ARTIFACT |

Three distinct non-pipes, each requiring separate repair work. Each future consumer (Slack bot, email assistant, API agent) would add a fourth, fifth, sixth non-pipe — the problem compounds with N. The status quo would leave all 75 page-scope tools shipped 2026-05-14 permanently unreachable.

**Rejected.** Does not scale; existing breakage is already triple-point.

---

### B. Server-side capability-only adapter

An adapter that wraps the existing server-side capability registry (`packages/ai/src/capabilities/`) and exposes a normalised contract for LLM consumers — but deliberately excludes client-side page-scope tools. Page-scope tools remain a client-only concern.

**Pros:** Simpler surface; no client→server tool-delivery mechanism required; no new architectural patterns in the browser.

**Why this fails:**

- The 75 page-scope tools registered via `useRegisterTools` (the council's primary finding) remain dead-pipe. The council finding is specifically that L1 client tools never reach any LLM consumer — a capability-only adapter does not close this.
- The `site-map.json` route catalog (47 routes, 269 tools) remains a documentation artifact with no consumer.
- Alternative B would close the authority-enforcement finding (ADR-0078/0151/0244 centralised) but leave the page-tool dead-pipe open. Council verdict requires closing both.
- `smartout-page-polish` skill Phase 7 + Phase 8 runtime claims remain false-as-shipped.

**Rejected.** Partially addresses the problem without closing the council's primary finding.

---

### C. Unified HarnessAdapter (chosen)

A single `HarnessAdapter` interface in `packages/ai/src/harness/` that aggregates all tool sources (server-side capability registry, client-side page-tool registry, site-map catalog) and exposes one contract that every LLM consumer plugs into.

**Why chosen over A:** Closes the three broken pipes without creating three separate repairs. Single interface definition means a new consumer (Slack, email, API) gets correct tool access by implementing one contract, not by re-deriving plumbing.

**Why chosen over B:** Explicitly closes the page-tool dead-pipe that is the council's primary finding. The adapter's `getToolsForChannel()` is the bridge between L1 client registry and every L2+ consumer.

**Specific wins that close the council finding:**

- Closes 75 dead-pipe tools shipped 2026-05-14 (and the 42 total polished `_tools/use-*-tools.ts` files)
- Closes three independent pipe breaks with one authority point — no more per-consumer drift
- `site-map.json` becomes a live artifact read by `getSiteMap()` rather than documentation-only
- `smartout-page-polish` skill Phase 7 + Phase 8 claims become factual once Phase 3 (chat consumer) ships

**Cons and mitigations:**

- **More architectural surface** — one more package/directory to reason about. Mitigation: adapter lives in `packages/ai/src/harness/`, sharing type-space with existing `packages/ai/src/capabilities/` and `packages/ai/src/adapters/`. No new service; no new deployment unit.
- **Single point of failure** — if the adapter throws, all LLM consumers fail together. Mitigation: adapter is purely read-only; it has no writes, no network calls of its own, and no side effects. Circuit-breaker at Phase 3 consumer boundary (BFF catches `HarnessAdapterError` and falls back to capability-only mode).

**Accepted.** Closes the council finding completely and scales to N future consumers.

---

## Consequences

### Positive

1. **Closes 75 dead-pipe tools shipped 2026-05-14** — and the 42 total polished `_tools/use-*-tools.ts` files. Page-scope tools registered via `useRegisterTools` will be reachable by any LLM consumer once Phase 3 (chat) + Phase 4 (voice) wire up.
2. **Single authority point for ADR-0078 / ADR-0151 / ADR-0244** — channel pinning (PII chat-only), workspace_id server-derivation, financial-mutation block — enforced once in `authority.ts`, not duplicated per consumer.
3. **Scales to N future consumers** — Slack bot, email assistant, public API agent each gets correct tool access by calling `adapter.getToolsForChannel(channel, route, ctx)`. No new plumbing per consumer.
4. **`site-map.json` becomes a live runtime artifact** — currently read only by the drift-validator script. Once Phase 3 ships, `getSiteMap()` answers "where does feature X live?" without round-tripping `query_smartout` capability.
5. **`smartout-page-polish` skill claims become factual** — Phase 7 ("tools are wired to Botsson") and Phase 8 ("site-map is consumed by LLM") were aspirational-as-shipped. Phase 3 closes that gap.
6. **Resolves L-0233 two-LLM-context trap at the root** — voice LLM and chat LLM diverge today because each has separate plumbing. The adapter is the single source of truth both consumers call.

### Negative / Risks

1. **Single point of failure** — adapter bug fails all consumers simultaneously.
   _Mitigation:_ adapter is stateless and read-only. No writes, no external HTTP calls. At the BFF layer (Phase 3), wrap `getToolsForChannel()` in a try/catch that degrades to capability-only mode (`toVercelTools` at `packages/ai/src/adapters/vercel-ai.ts:46`). Log adapter errors to `activity_trail` so they are observable.

2. **Client→server tool-delivery mechanism is a new surface** — page-scope tools live in the browser; the adapter lives on the server. Bridging them requires a POST field or a server-readable registry.
   _Mitigation:_ Phase 2 ships server-readable sources (capabilities + site-map). Client-side page-tools delivered in Phase 3 via an explicit `selected_tools` field in the BFF schema — the same field that is currently dropped at `apps/web/src/app/api/wizard/start/route.ts:38-130`.

3. **ADR-0078 PII tool-classification gaps** — some page-scope tools may expose PII (e.g. `use-contract-detail-tools.ts:45-46` exposes `hourly_rate`, `monthly_salary`; `use-invoice-detail-tools.ts:130` exposes `amountInclVat`) without being tagged as PII tier. Authority enforcement would pass them through incorrectly.
   _Mitigation:_ Phase 2 ships a conservative deny-list for financial/PII field detection in `authority.ts`. Full tag-audit of all 42 `_tools/` files is Phase 5 scope, not MVP.

4. **Token-budget pressure from full site-map injection** — 47 routes × ~5 tools each × description text = potentially large context addition per request.
   _Mitigation:_ `getSiteMap()` returns the filtered catalog (user-access-filtered); Phase 3 consumer decides injection strategy. Recommendation (deferred to Phase 3): inject summary (`route → purpose` only) by default; full tool list available via on-demand `requestSiteMap()` tool per Agent-Coord recommendation (council 2026-05-14).

5. **Migration cost for existing `toVercelTools` chain** — current stage-engine chat path uses `toVercelTools()` directly. Phase 3 wires the adapter alongside it (not instead), gated behind a feature flag.
   _Mitigation:_ see Migration Path section.

### Neutral

1. **No change to the L1 client registry** — `useRegisterTools`, `useRegisteredTools`, and `BotssonProvider` are correct as shipped. The adapter reads from that registry; it does not replace it.
2. **No new deployment unit** — adapter lives in `packages/ai/src/harness/`, consumed by stage-engine and voice-agent at their existing boot time. No new Docker container, no new Edge Function, no new subdomain.
3. **Dead-pipe markers on 42 `_tools/` files** — the `// DEAD-PIPE-2026-05-14` comments shipped with the polish wave stay until Phase 3 closes the chat pipe. They are not a permanent design; they are a "this file is correctly built but not yet connected" signal for future maintainers.

---

## Phase-by-Phase Detail

### Phase 1 — Interface definition (MVP scope)

**Scope:** Define the `HarnessAdapter` TypeScript interface and all supporting types. No implementation. Establishes the contract that every downstream consumer and source implementation must satisfy.

**Files touched:**
- `packages/ai/src/harness/types.ts` — new file; `HarnessAdapter` interface + `Channel`, `UserContext`, `ToolBundle`, `SiteMap`, `AuthorityConfig`, `Unsubscribe` types
- `packages/ai/src/harness/index.ts` — new file; re-exports + factory function signature
- `packages/ai/src/harness/__tests__/types.test.ts` — new file; compile-time shape verification

**Acceptance criteria (binary):**
- [ ] `HarnessAdapter` interface defines `getToolsForChannel`, `getSiteMap`, `subscribeToRouteChange` with exact signatures from Decision section above
- [ ] `Channel` type is a string union: `"chat" | "voice" | "slack" | "email" | "api"`
- [ ] `ToolBundle` type has fields: `definitions`, `implementations`, `systemPromptSlices`, `authority`
- [ ] `pnpm --filter @smartout/ai typecheck` exits 0
- [ ] No runtime code shipped in this phase (interface only)

**Dependencies:** none — pure TypeScript.

**Out of scope for this phase:** any implementation, any source files, factory function body.

---

### Phase 2 — Registry sources + authority (MVP scope)

**Scope:** Implement the three source modules and authority enforcement. No LLM consumer wiring yet. The adapter is fully functional as a library but not yet called by any BFF or agent.

**Files touched:**
- `packages/ai/src/harness/sources/capabilities-source.ts` — new; reads `packages/ai/src/capabilities/` registry; filters by channel + role + workspace `gate_action`
- `packages/ai/src/harness/sources/site-map-source.ts` — new; reads `apps/web/.botsson/site-map.json` (Zod-validated at construction time); filters routes by user `role` field in each route's `access` array
- `packages/ai/src/harness/authority.ts` — new; implements `applyAuthority(bundle, config)`:
  - Strips tools tagged `pii_tier: restricted` from voice/email/api channels (ADR-0078)
  - Strips tools tagged `risk_tier: financial` from voice/passive surfaces (ADR-0244)
  - Replaces `workspace_id` from any bundle field with server-session-derived value (ADR-0151)
- `packages/ai/src/harness/factory.ts` — new; `createHarnessAdapter({ capabilities, siteMap })` composes sources + authority into a `HarnessAdapter` instance
- `packages/ai/src/harness/__tests__/capabilities-source.test.ts` — unit tests (see Test Strategy)
- `packages/ai/src/harness/__tests__/site-map-source.test.ts` — unit tests
- `packages/ai/src/harness/__tests__/authority.test.ts` — unit tests
- `packages/ai/src/harness/__tests__/factory.test.ts` — integration test (stub sources + factory + `getToolsForChannel`)

**Acceptance criteria (binary):**
- [ ] `createHarnessAdapter({ capabilities, siteMap }).getToolsForChannel("chat", null, ctx)` returns a `ToolBundle` containing all chat-allowed capabilities for `ctx.role`
- [ ] Same call with `channel: "voice"` excludes any tool tagged `pii_tier: restricted`
- [ ] `getSiteMap(ctx)` returns routes filtered to `ctx.role`'s access level
- [ ] `applyAuthority()` rejects any bundle that includes a `risk_tier: financial` tool on the voice channel (throws or strips, documented in function)
- [ ] `pnpm --filter @smartout/ai test src/harness/` exits 0 (all unit + integration tests pass)
- [ ] `pnpm turbo typecheck` exits 0 (repo-wide)

**Dependencies:** Phase 1 interface must exist. Existing `packages/ai/src/capabilities/` registry must be readable without modification.

**Out of scope for this phase:** chat BFF schema change, stage-engine schema change, LiveKit stub implementation, `selected_tools` field in any route handler. Those are Phase 3 and 4 respectively.

---

### Phase 3 — Chat consumer wiring (deferred)

**Status (2026-05-14):** IN PROGRESS — sortie `harness-phase3-chat` (worktree wt-1). Ship target: chat consumer wires BFF + stage-engine to HarnessAdapter behind `HARNESS_ADAPTER_CHAT` feature flag. Toggles ON after live smoke. See `docs/HANDOFF-harness-phase3-chat.md` (post-merge).

**Scope:** Wire the adapter as the tool source for the chat path. Stage-engine BFF accepts `selected_tools` (page-scope client tools forwarded from browser). Existing `toVercelTools` chain remains as fallback.

**Out of scope for this phase:**
- Removing `toVercelTools` from `packages/ai/src/adapters/vercel-ai.ts` — stays as fallback for backward-compat and as internal implementation for capability-subset delegation
- Phase 4 voice consumer wiring
- Capability `risk_tier` metadata tagging (Phase 5 scope)
- Hot-swap on route change (chat doesn't need; deferred to Phase 4 voice)

**Sketch only (implementation in separate sortie):**
- Add `client_tools?: ClientToolDefinition[]` field to `/api/botsson/chat` `RequestSchema` (`apps/web/src/app/api/botsson/chat/route.ts:38-59`)
- Add `client_tools?: ClientToolDefinition[]` to stage-engine chat schema (`services/stage-engine/src/routes/agent/chat.ts`)
- In stage-engine `generateText` call: `const bundle = await adapter.getToolsForChannel(channel, route, ctx)` — merge with `toVercelTools(serverCapabilities, ctx)` bundle
- Feature-flag gate: `HARNESS_ADAPTER_CHAT=true` in env; false falls back to current capability-only path
- Remove `// DEAD-PIPE-2026-05-14` markers from 42 `_tools/` files after smoke-test confirms tools reach LLM

**Dependencies:** Phase 2 adapter must be published. `selected_tools` serialization already exists in `packages/agent-sdk/src/context/session-context.ts:28-29` — only needs the receiving end.

---

### Phase 4 — Voice consumer wiring (deferred)

**Scope:** Wire the adapter for the voice (LiveKit) path. Fill `LiveKitVoiceSession.registerTool()` stub at `packages/agent-sdk/src/providers/livekit.ts:38-40`.

**Sketch only (implementation in separate sortie):**
- Spike on LiveKit tool-delivery transport (data channel vs RPC vs custom WebSocket — see Open Questions)
- Boot voice-agent with `adapter.getToolsForChannel("voice", route, ctx)` instead of static `buildAllBotssonTools()` call at `services/voice-agent/src/agent.ts:200`
- Implement hot-swap: on route-change event (LiveKit data channel), call `subscribeToRouteChange()` callback, re-fetch bundle for new route, push updated tool list to running Realtime LLM session

**Dependencies:** Phase 2 adapter. LiveKit transport spike (separate spike first). Phase 3 recommended (validate adapter with simpler consumer before tackling LiveKit).

---

### Phase 5 — Authority layer hardening (deferred)

**Scope:** Full tag-audit of 42 `_tools/` files for PII and financial tiers. Add tags to any tool definition lacking them. Authority enforcement in Phase 2 is conservative; Phase 5 makes it exhaustive.

**Sketch only:**
- Audit each of the 42 files: identify tools that return fields classified as PII (personnummer, salary, bank account, address, tax id) or financial (amounts, payment references, rates)
- Add `pii_tier: "restricted"` and/or `risk_tier: "financial"` metadata to tool definitions in the registry
- Extend `authority.ts` `applyAuthority()` to use tags rather than deny-list

**Dependencies:** Phase 2 authority conservative approach ships. Phase 3 chat consumer ships (so authority enforcement is exercised in production).

---

### Phase 6 — Future consumer documentation pattern (deferred)

**Scope:** Formalise and document the plug-in pattern for new consumers (Slack, email, API agent).

**Sketch only:**
- Write `packages/ai/src/harness/CONSUMER-GUIDE.md` — "how to wire a new LLM consumer to HarnessAdapter"
- Scaffold `SlackConsumerExample` (type-only, no implementation) to prove the interface works for non-web channels
- Add consumer registration check to `adr-contract-audit` skill scope

**Dependencies:** Phase 3 + Phase 4 live consumers existing as validated examples.

---

## Test Strategy

### Layer 1 — Type-level (Phase 1, MVP)

Compile-time verification that `HarnessAdapter` interface shape is stable. Located at `packages/ai/src/harness/__tests__/types.test.ts`. No runtime assertions — the test is "does this file compile?" Pattern:

```typescript
// Verify assignability
const _: HarnessAdapter = {} as ConcreteHarnessAdapter; // must compile
```

**Ships in Phase 1 MVP.**

### Layer 2 — Unit tests (Phase 2, MVP)

Vitest unit tests for each source module and the authority enforcer, with stub data — no dependency on running Supabase, stage-engine, or LiveKit.

**`capabilities-source.test.ts`:**
- Returns all capabilities for `channel: "chat"` + `role: "admin"`
- Excludes capabilities tagged `channel: "voice"` only when `channel !== "chat"`
- Excludes capabilities requiring gate_action not present in stub `engine_authority_config`
- Returns empty list when no capabilities match role

**`site-map-source.test.ts`:**
- Returns all 47 routes for `role: "admin"` (stub site-map JSON)
- Returns only non-admin routes for `role: "employee"`
- Throws `SiteMapValidationError` on malformed JSON (Zod validation at construction)
- Returns empty catalog when `userContext.workspace_id` has no routes

**`authority.test.ts`:**
- `applyAuthority(bundle, { channel: "voice" })` strips PII-tagged tools from definitions
- `applyAuthority(bundle, { channel: "voice" })` strips financial-mutation tools from definitions
- `applyAuthority(bundle, { channel: "chat" })` passes PII-tagged tools through
- `workspace_id` in bundle definitions is always server-session value, not a value from any bundle field

**`factory.test.ts`:**
- `createHarnessAdapter` with stub `CapabilitiesSource` + `SiteMapSource` returns a valid `HarnessAdapter`
- `getToolsForChannel("chat", "/dashboard/hms/deviations", adminCtx)` returns a `ToolBundle` with non-empty `definitions`
- `getToolsForChannel("voice", "/dashboard/my-profile/complete", ctx)` excludes PII tools

**Ships in Phase 2 MVP.**

### Layer 3 — Integration tests (Phase 3, deferred)

Tests that exercise the adapter together with the real capability registry (mocked Supabase, real type resolution). Located at `packages/ai/src/harness/__tests__/integration/`. Verify that the adapter's output is a valid input for `generateText()` in the Vercel AI SDK.

**Deferred to Phase 3** — requires chat consumer to exist as an integration target.

### Layer 4 — Contract tests (Phase 3+, deferred)

End-to-end tests that start a stage-engine instance, call `/api/botsson/chat` with a stubbed session, and assert that the LLM receives the expected tool definitions. Likely implemented as Playwright API tests.

**Contract tests are NOT MVP scope.** They are Phase 3+ because they require the chat consumer to be wired.

---

## Migration Path

### Current state

Stage-engine's chat path calls `toVercelTools()` at `packages/ai/src/adapters/vercel-ai.ts:46` directly with the server-side `SmartoutTool[]` registry:

```typescript
// services/stage-engine/src/routes/agent/chat.ts (current, simplified)
const tools = toVercelTools(buildAllBotssonTools(ctx), ctx);
const result = await generateText({ tools, ... });
```

This path works correctly for server-side capabilities. It does not see page-scope tools or site-map context. It is not broken — it is incomplete.

### Phase-gated cutover

**Phase 2 (MVP):** Adapter ships as a library. No change to stage-engine or any BFF. `toVercelTools` chain continues to operate unchanged. Zero migration risk.

**Phase 3 (chat consumer sortie):**

1. Add `HARNESS_ADAPTER_CHAT=true` to `.env.template` (default: `false`).
2. In stage-engine `/agent/chat` handler: if flag is on, call `adapter.getToolsForChannel()` and merge the result's server-capability subset with the existing `toVercelTools` output. If flag is off, fall through to current path.
3. Smoke-test with flag on in local dev. Verify LLM receives same tool count as before (capability subset) plus any newly delivered page-scope tools.
4. Once smoke passes: flip flag default to `true` in staging environment. Monitor. Flip in production.

**Backward-compat guarantee:** `toVercelTools()` at `packages/ai/src/adapters/vercel-ai.ts:46` is NOT removed in Phase 3. It remains the fallback and the internal implementation for the capability-source subset. The adapter delegates to it rather than replacing it.

**Phase 4 (voice consumer sortie):**

Replace static `buildAllBotssonTools()` call at `services/voice-agent/src/agent.ts:200` with `adapter.getToolsForChannel("voice", route, ctx)`. The `toVercelTools` call inside `services/voice-agent/src/adapter.ts:177-186` is replaced by the adapter output. LiveKit `registerTool` stub at `packages/agent-sdk/src/providers/livekit.ts:38-40` becomes real.

---

## Open Questions

The following decisions are deferred to Phase 3/4 sorties. They are noted here so the implementing agent does not re-derive the problem space.

### Q1 — Voice tool-delivery transport (Phase 4)

Three options under consideration:
- **LiveKit data channel** — push updated tool list as a JSON message over the data channel on route change. Pro: already used by view-tools mirror (ADR-0234). Con: data channel is for events, not bootstrapping; large tool list may exceed message size.
- **LiveKit RPC** — voice-agent worker exposes an RPC; client calls it with new route on navigation. Pro: request/response pattern is cleaner. Con: adds RPC definition to LiveKit session.
- **Custom WebSocket** — separate WebSocket from voice session. Pro: fully decoupled. Con: another connection to manage; session lifecycle coupling is non-trivial.

Recommendation pending spike. Agent-Coord (council 2026-05-14) noted that the view-tools data-channel pattern (L-0234) is the most natural precedent.

### Q2 — Hot-swap mechanism (Phase 4)

Voice sessions are long-lived (minutes to hours). When the user navigates from `/dashboard/schedule` to `/dashboard/hms`, the active voice session has the wrong tool set.

Options:
- **Per-route refresh** — on navigation, re-call `getToolsForChannel()` and push updated bundle to running Realtime LLM session. Requires LiveKit tool-hot-swap API investigation.
- **Session-fixed** — tool set is fixed at session start; voice agent only has globally-available tools (no page-specific tools). Simpler but reduces page-tool utility for voice.

Recommendation: per-route refresh, but requires LiveKit API confirmation that running sessions accept tool updates without reconnect. Spike before Phase 4.

### Q3 — Token-budget management (Phase 3)

Full site-map injection (47 routes, ~269 tools, descriptions) adds non-trivial context to every request. Options:
- **Full injection** — always include `getSiteMap()` output in system prompt. Simple but expensive.
- **On-demand `requestSiteMap` tool** — inject a single meta-tool `requestSiteMap(query: string)` that the LLM calls when route-navigation intent is detected. Site-map delivered only when needed. Agent-Coord recommended this (council 2026-05-14).
- **Summary injection + full on-demand** — inject `route → purpose` one-liners in system prompt; `requestSiteMap()` delivers full tool list for a given route.

Recommendation: summary + on-demand (option C). Defer concrete implementation to Phase 3.

### Q4 — PII-tier classification gaps (Phase 5)

`authority.ts` Phase 2 ships with a conservative deny-list of known PII and financial tool names (from council finding: `use-contract-detail-tools.ts:45-46` exposes `hourly_rate`, `monthly_salary`; `use-invoice-detail-tools.ts:130` exposes `amountInclVat`). A systematic audit of all 42 `_tools/` files for PII and financial tier tagging is Phase 5 scope.

Phase 2 deny-list approach is intentionally mechanical (name-matching). Phase 5 makes it declarative (tool-metadata tags).

### Q5 — Contract-layer test strategy (Phase 3+)

Phase 2 unit tests are isolated (stub sources). Phase 3 should add integration tests that verify the adapter output passes through the BFF chain to `generateText()` without type errors or silent field drops. The appropriate pattern (Playwright API tests vs vitest supertest) is deferred to Phase 3 sortie planning.

Contract tests MUST NOT use real Supabase Cloud — local only, per project convention.

---

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
