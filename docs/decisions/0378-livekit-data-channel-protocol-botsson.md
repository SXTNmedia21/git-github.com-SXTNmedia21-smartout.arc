---
id: ADR-0378
title: "LiveKit data-channel protocol for Botsson voice-agent — four-topic envelope contract"
status: proposed
layer: decision
created: 2026-05-20
updated: 2026-05-20
council: feat-mobile-voice-runtime-wire-p7-steward-gate
supersedes: []
amends: []
related: [ADR-0078, ADR-0132, ADR-0134, ADR-0135, ADR-0151, ADR-0297, ADR-0327, L-0233, L-0234]
tags: [voice, livekit, mobile, web, protocol, contract]
---

# ADR-0378: LiveKit data-channel protocol for Botsson voice-agent — four-topic envelope contract

## Context and Problem Statement

`mobile-voice-runtime-wire` (P3 + P4, 2026-05-20) shipped the runtime wiring that lets mobile publish workforce snapshots and serve client-tool RPC for the LiveKit-based voice-agent. The wire-level protocol now spans **four named topics** on the LiveKit data channel, with producer-half code in `apps/mobile/src/lib/livekit-data-publish.ts` + `apps/mobile/src/hooks/use-botsson-voice-session.ts` and consumer-half code in `services/voice-agent/src/context.ts` + `services/voice-agent/src/client-tool-rpc.ts` + `services/voice-agent/src/agent.ts`.

The contract is currently expressed only as:

1. String literals scattered across producer + consumer source.
2. A prose paragraph in `client-tool-rpc.ts:10-14`.
3. Discriminated-union TypeScript types (`ContextInitMessage` in voice-agent, `BotssonContextInitPayload` in mobile) that are independently maintained on each side.
4. Producer + consumer unit tests that document the envelope shapes (`apps/mobile/src/lib/__tests__/livekit-data-publish.test.ts`, `services/voice-agent/__tests__/context.test.ts`).

Web Botsson voice (`apps/web/src/lib/voice/`) consumes the same voice-agent service via the same data channel. A future refactor (e.g. payload-schema evolution, new topic, gpt-realtime migration in the parked wt-4 sortie) needs a single contract document to reason against. Without it, the four topics are at risk of silent drift — mobile adds a field, voice-agent doesn't parse it, no compile-time error, runtime silently degrades.

Sibling pattern to **ADR-0327** (HarnessAdapter — unified LLM-consumer contract for chat/voice/site-map). That ADR codifies the *server-side* contract between capability tools and LLM consumers. This ADR codifies the *wire-level* contract between the voice-agent and the participating client (mobile and web).

## Decision Drivers

- **Two independently-maintained type sources** (`BotssonContextInitPayload` in mobile + `ContextInitMessage` in voice-agent) carry the same envelope. Drift risk is real — voice-agent's `parseContextPayload` does NOT validate inner structure; it accepts whatever arrives with `type === "context_init"` and stores it as the snapshot. Mobile owns the shape de facto.
- **Tool RPC protocol has no schema validator** — `resolveToolResult(callId, result)` accepts an opaque string; mobile's `botsson-tool-result` envelope is `{ call_id: string, result: unknown }` with no Zod gate.
- **Topic naming is hard-coded as string literals** — `"botsson-context"`, `"botsson-tools-register"`, `"botsson-tool-call"`, `"botsson-tool-result"` appear as bare strings on both sides. A typo on one side = silent drop.
- **L-0233 closure** (voice-agent setSessionContext must fire for mobile) presumed the envelope contract is stable. P3-verify proof artefact pinned the contract at one point in time; the ADR pins it across time.
- **L-0234 closure** (voice view-tools mirror via activity-event) introduced 5 mobile tools (`mobile_navigate_to`, `mobile_open_sheet`, `mobile_show_toast`, `mobile_start_punch`, `mobile_call_leader`). Future mobile tools will register via the same `botsson-tools-register` topic; the registration envelope must be locked.
- **gpt-realtime parking** (separate wt-4 sortie) intends to migrate voice runtime to OpenAI Realtime API. That migration will preserve or replace the data channel, but the decision must be made against a documented contract, not against scattered string literals.
- **Web parity** — `apps/web` participates in the same protocol via web Botsson. The four topics are platform-agnostic; the ADR must reflect that.

## Considered Options

1. **Document the four topics + envelope shapes as a versioned ADR (this proposal).** Pin payload shapes, define topic ownership (producer/consumer roles), require backward-compatible additions, version field on the wire as a forward-compatibility hook.
2. **Move to typed RPC framework (e.g. tRPC over LiveKit).** Heavier, requires runtime adapter for LiveKit data channel; LiveKit's data-channel primitive is byte-blob + topic, not structured RPC.
3. **Use protobuf / flatbuffers.** Strong schema enforcement, but binary serialization is overkill for 4 topics + the payloads are JSON anyway.
4. **Leave as-is, rely on unit tests.** Tests exist (P3 proof) but only catch local regressions — they don't prevent topic drift if a future agent invents a 5th topic or renames an existing one.

## Decision Outcome

Chosen option: **"Option 1 — ADR-pinned four-topic protocol"**, because it matches the existing implementation, requires no infrastructure changes, and provides the single document future agents (mobile UI, voice-agent maintainers, gpt-realtime migration sortie, web Botsson maintainers) can reason against.

### The four topics — wire-level contract

All payloads are UTF-8 JSON, published as byte blobs on the LiveKit data channel with `reliable: true`.

#### Topic 1: `botsson-context` (client → voice-agent)

Carries the user/workspace/workforce context snapshot. Published on `RoomEvent.Connected` and on mid-session snapshot refresh. Deduped by version on the client.

```ts
type BotssonContextInitPayload = {
  type: "context_init";              // discriminator — REQUIRED
  user: Record<string, unknown>;      // user context (profile, role, current shift, etc.)
  workspace: Record<string, unknown>; // workspace context (id, name, niche, etc.)
  workforce?: Record<string, unknown>; // optional workforce facts (employees, shifts, absences)
};
```

- Producer ownership: **mobile** (`apps/mobile/src/lib/livekit-data-publish.ts:publishBotssonContext`), **web** (mirror in `apps/web` voice path).
- Consumer ownership: **voice-agent** (`services/voice-agent/src/context.ts:parseContextPayload + setSessionContext`).
- The voice-agent does **not** validate inner structure. The client owns the payload shape contract. Adding a new top-level field is backward-compatible.
- Discriminator (`type === "context_init"`) is the only enforced field.

#### Topic 2: `botsson-tools-register` (client → voice-agent)

Carries client-side tool definitions so voice-agent can build stub `llm.tool()` entries. Published once per session, immediately after `botsson-context`.

```ts
type BotssonToolsRegisterPayload = {
  definitions: ClientToolDefinition[];  // from @smartout/ai/harness/types
};
```

- Producer ownership: **mobile** (`apps/mobile/src/lib/livekit-data-publish.ts:publishBotssonToolsRegister`).
- Consumer ownership: **voice-agent** (`services/voice-agent/src/agent.ts` DataReceived handler routes to `client-tool-rpc.ts:buildClientToolStub`).
- The `ClientToolDefinition` type is the cross-package contract — defined in `@smartout/ai/harness/types`, shared by both sides at compile time. This is the strongest typing in the protocol.
- Web Botsson, when it registers client tools, MUST use the same `ClientToolDefinition` shape.

#### Topic 3: `botsson-tool-call` (voice-agent → client)

Carries a single tool invocation request. Voice-agent parks a Promise; client must reply on `botsson-tool-result` within 10 seconds or the Promise resolves with a timeout string.

```ts
type BotssonToolCallPayload = {
  type: "tool_call";        // discriminator — REQUIRED
  call_id: string;           // randomUUID() — must echo back in result
  name: string;              // matches modelToolName from the registered definition
  arguments: Record<string, unknown>;  // tool arguments, shape per definition's parameters
};
```

- Producer ownership: **voice-agent** (`services/voice-agent/src/client-tool-rpc.ts:buildClientToolStub.execute` → `_publishOnTopic` adapter).
- Consumer ownership: **mobile** (`apps/mobile/src/hooks/use-botsson-voice-session.ts` `RoomEvent.DataReceived` handler), **web** (mirror).
- Timeout: 10 seconds (`TOOL_CALL_TIMEOUT_MS` in `client-tool-rpc.ts:45`). Clients MUST publish a result within this window or the voice-agent injects a synthetic timeout string into the LLM context.

#### Topic 4: `botsson-tool-result` (client → voice-agent)

Carries the tool execution result back to voice-agent. Client must include the matching `call_id`.

```ts
type BotssonToolResultPayload = {
  call_id: string;     // MUST match the call_id from botsson-tool-call
  result: unknown;     // tool output; voice-agent stringifies for LLM context
  // optional: ok: boolean — recommended for client-side error discrimination,
  //                          but not currently inspected by voice-agent
};
```

- Producer ownership: **mobile** (`apps/mobile/src/lib/livekit-data-publish.ts:publishBotssonToolResult`), **web** (mirror).
- Consumer ownership: **voice-agent** (`services/voice-agent/src/client-tool-rpc.ts:resolveToolResult`).
- Unknown `call_id` is silently ignored on the voice-agent side (handles stale results after timeout).
- The mobile-side telemetry decides ok/fail; the wire-level envelope does not enforce it.

### Rules

1. **Topic names are LOCKED.** Renaming a topic is a breaking change requiring a new ADR + coordinated mobile + web + voice-agent deploy.
2. **Discriminator fields (`type`) are LOCKED.** `context_init` and `tool_call` are the only values currently in use.
3. **Backward-compatible additions are allowed.** New top-level fields on `botsson-context`, new fields inside `result` on `botsson-tool-result`, new optional fields on `botsson-tools-register.definitions[]` items — all permitted without ADR.
4. **Breaking changes require ADR amendment.** Renaming a field, changing a discriminator value, removing a topic, narrowing a type.
5. **Topic dispatch must be guarded by topic name on the consumer side.** Voice-agent's `parseContextPayload` already checks topic name (`__tests__/context.test.ts:topic guard rejects payloads on other topics`). Mobile's `DataReceived` handler must check topic name before dispatching to `executeMobileTool`.
6. **Serialization is JSON.** Binary blobs, msgpack, or custom encodings are NOT permitted on these four topics. Adding a 5th topic with a different encoding would require ADR amendment.
7. **No PII on `botsson-tool-call`.** ADR-0078 voice-channel PII filter applies — voice-agent must not forward PII-bearing arguments. ADR-0078 boundary is enforced server-side before tool stubs are built; the wire contract is a defense-in-depth layer, not the primary gate.
8. **No raw tool output in `voice.bootstrap.rpc_failed` telemetry reason** (per P4-rev fix). Tool name + call_id are sufficient diagnostic; the result payload may carry user data.

### Test obligations

- **Topic guard test on both sides.** Voice-agent already has it (`context.test.ts:topic guard rejects payloads on other topics`). Mobile MUST add equivalent: `DataReceived` with `topic !== "botsson-tool-call"` is dropped silently.
- **Envelope round-trip test.** The P3 proof's `round-trips a mobile-shaped context_init through parse → set → snapshot` is the canonical pattern. Future ADR-bumping changes MUST add equivalent round-trip tests.
- **Timeout test.** Voice-agent's tool-call timeout (10s) must be exercised by at least one integration test; current coverage is unit-level only.

## Rules & Consequences enforced for Agents

- **Good, because** the protocol is now ADR-pinned with explicit producer/consumer ownership per topic. Future agents touching either side see the contract in a single document.
- **Good, because** backward-compatible vs breaking changes are explicitly distinguished, removing ambiguity for future schema evolution.
- **Good, because** the gpt-realtime parking sortie (wt-4) can plan migration against this documented contract instead of scattered string literals.
- **Good, because** web + mobile + voice-agent now share a single canonical reference for tool definition shape (`ClientToolDefinition` from `@smartout/ai/harness/types`).
- **Bad, because** the contract is still split across two type sources (`BotssonContextInitPayload` in mobile + `ContextInitMessage` in voice-agent). A follow-up cleanup could hoist the discriminated unions into a shared `@smartout/types/livekit-protocol` module — recommended but not blocking.
- **Bad, because** `botsson-tool-result` carries `result: unknown` — no schema validation on the voice-agent side. Acceptable for V1; tightening would require per-tool result schemas which is out of scope for this ADR.
- **Agent Impact:**
  - When touching `apps/mobile/src/lib/livekit-data-publish.ts`, `apps/mobile/src/hooks/use-botsson-voice-session.ts`, `services/voice-agent/src/context.ts`, `services/voice-agent/src/client-tool-rpc.ts`, or `services/voice-agent/src/agent.ts`: read this ADR first.
  - When adding a new client tool (mobile or web): use existing `ClientToolDefinition` shape, register on `botsson-tools-register`, serve via `botsson-tool-call`/`botsson-tool-result`. No new topic.
  - When adding a new wire-level concern (e.g. push-to-voice signaling, presence): consider whether a 5th topic is justified. If yes, ADR amendment required.
  - When the gpt-realtime migration lands: this ADR may be superseded or amended depending on whether the new transport reuses the four topics or replaces them.

## Implementation status

This ADR codifies what `mobile-voice-runtime-wire` shipped — no new code required. The protocol is live as of:

- Mobile producer: `apps/mobile/src/lib/livekit-data-publish.ts` (be6c825dd + 354ae0b63).
- Mobile consumer: `apps/mobile/src/hooks/use-botsson-voice-session.ts` DataReceived handler at line 745+ (354ae0b63).
- Voice-agent consumer: `services/voice-agent/src/context.ts:parseContextPayload + setSessionContext` + `services/voice-agent/src/agent.ts` DataReceived router.
- Voice-agent producer: `services/voice-agent/src/client-tool-rpc.ts:buildClientToolStub.execute`.

Test coverage:

- `apps/mobile/src/lib/__tests__/livekit-data-publish.test.ts` — producer side for `botsson-context` (4 assertions, all pass per P3 proof).
- `services/voice-agent/__tests__/context.test.ts` — consumer side for `botsson-context` (5 assertions, all pass per P3 proof).
- Tool RPC round-trip: covered by feature-flag-gated integration in `HARNESS_ADAPTER_VOICE_ENABLED=true` voice-agent path; explicit unit tests for `botsson-tool-call` + `botsson-tool-result` topic guards are a recommended follow-up.

## Follow-ups

- Hoist the discriminated unions into a shared `@smartout/types/livekit-protocol.ts` module so both sides import the same source.
- Add topic-guard unit test on mobile DataReceived handler (parity with voice-agent's `topic guard rejects payloads on other topics`).
- Add timeout integration test for the 10s tool-call timeout.

## Cross-references

- **ADR-0078** — voice channel + PII boundary; defense-in-depth layer above the wire contract.
- **ADR-0132** — mobile thin client; AI through web BFF. The data channel is the BFF-orthogonal pipe for voice-agent state.
- **ADR-0134** — telemetry IDs non-empty + fail-fast. Wire-level events emit telemetry that must satisfy ADR-0134.
- **ADR-0135** — mobile voice = LiveKit (not Ultravox). This ADR pins the protocol on the LiveKit choice.
- **ADR-0151** — server-side profile_id resolution. Server-side resolution still applies; the wire envelope does not relax it.
- **ADR-0297** — workforce snapshot bootstrap pipe. `botsson-context` is the runtime delivery mechanism for the snapshot.
- **ADR-0327** — HarnessAdapter unified LLM-consumer adapter. The server-side complement to this wire-level contract.
- **L-0233** — two LLM contexts (voice-agent setSessionContext must fire). This ADR pins the contract that makes L-0233 closure stable.
- **L-0234** — voice view-tools mirror via activity-event. `botsson-tool-call`/`botsson-tool-result` is the wire-level realisation of L-0234.
