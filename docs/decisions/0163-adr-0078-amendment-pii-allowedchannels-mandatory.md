---
title: "ADR-0078 amendment — allowedChannels mandatory for PII capabilities"
id: ADR_0163
status: proposed
layer: decision
created: 2026-04-19
updated: 2026-04-19
amends: ADR-0078
---

# ADR-0163: ADR-0078 amendment — `allowedChannels` mandatory for PII-handling capabilities; fail-closed at registration

## Context and Problem Statement

ADR-0078 defined three-layer channel restriction (process.allowed_channels, capability.allowedChannels, tool ctx.channel). A 2026-04-19 code-trace for the helpdesk council revealed that `gate_action` only checks `engine_process.allowed_channels` when `p_engine_process_id` is passed (verified `20260505110000_unified_authority_gate.sql:139-151`). The stage-engine agent-router (`services/stage-engine/src/core/agent-router.ts:89-95`) does NOT pass `p_engine_process_id` for ad-hoc chat — Layer 1 is silent for the common case where an agent opens a ticket, replies to a question, or answers a voice command. Defense-in-depth for PII reduces to Layer 2 (capability.allowedChannels) + Layer 3 (tool self-check). This is thinner than ADR-0078 implies. If Layer 2 is undefined (permissive default, voice allowed), PII can leak via voice.

## Decision Drivers

- Code-trace proof: Layer 1 is silent for agent-router ad-hoc path (not just theoretical).
- `communication` capability has undefined `allowedChannels` (voice permitted by default) — blocking any expansion into PII-adjacent tools.
- `contract_intake` and `shift_swap` correctly declare `allowedChannels: ['chat']`; this should be the enforced pattern.
- Helpdesk capability (ADR-0162) requires enforceable PII isolation.
- Defense-in-depth degrades from three layers to two when Layer 1 is silent — Layer 2 must compensate.

## Considered Options

1. **Document the Layer 1 silence, rely on discipline** — Leave as-is; document that Layer 2 is effective primary.
2. **Fail-closed on capability registration: undefined `allowedChannels` = reject** — TypeScript compile-time or runtime-init check refuses to register a capability without explicit `allowedChannels`.
3. **Pass `p_engine_process_id` from agent-router** — Fix Layer 1 silence at the source; requires agent-router to resolve a process for every chat turn (ontology mismatch — ad-hoc chat has no single process).

## Decision Outcome

Chosen option: **Option 2 — fail-closed at registration for PII-marked capabilities; Option 3 filed as follow-up.**

Rationale:
- Option 1 is the current state and the failure mode is documented (this ADR).
- Option 3 is the correct long-term fix but requires agent-router refactor and process-resolution logic that doesn't exist cleanly (ad-hoc chat spans multiple potential processes).
- Option 2 is a mechanical check that catches the common failure mode (capability author forgot allowedChannels) without requiring agent-router changes.

## Rules & Consequences

### Amended rule (supersedes ADR-0078 §"Defence-in-depth declaration")

1. Every `CapabilityDefinition` MUST either:
   - Explicitly declare `allowedChannels: SessionChannel[]` (non-empty array), OR
   - Explicitly declare `allowedChannels: null` with a top-of-file comment: `// CHANNEL-UNRESTRICTED — no PII; reviewed <date> <reviewer>`.
2. Capability registry (`packages/ai/src/capabilities/registry.ts`) runtime-init asserts on registration. Undefined `allowedChannels` = throw.
3. `communication` capability must be updated in this ADR's implementation window to declare `allowedChannels: null` with the PII-unrestricted comment, OR split into `communication` (general chat) + `communication_pii` (future expansion).
4. Any capability handling personnummer, bank details, salary, contract content, health data, or schedule-of-individuals MUST have `allowedChannels: ['chat']` explicitly.

### Layer 1 silence — documented caveat (for future fix)

- `gate_action` channel check requires `p_engine_process_id` input, which the agent-router does NOT supply for ad-hoc chat.
- Layer 1 protects dispatched engine processes only.
- Layer 2 (capability) + Layer 3 (tool) carry the defense-in-depth load for ad-hoc chat.
- Follow-up ADR (not this one): resolve agent-router to pass candidate process_id when a capability is selected, unblocking Layer 1.

### Agent Impact

- New capability creation checklist MUST include: allowedChannels declaration + authority seed migration (per ADR-0162).
- Capability reviewer (human or automated) blocks PR if allowedChannels is missing and no PII-unrestricted comment is present.
- Dev-mode console error on registry init if any capability lacks declaration.
- Integration test: registering a capability without allowedChannels declaration throws in CI.

### What does NOT change

- ADR-0078's three-layer model remains. This amendment makes Layer 2 non-optional for PII capabilities.
- Existing capabilities with correct `allowedChannels: ['chat']` (contract_intake, shift_swap) are unaffected.
- Voice routing (ADR-0135 LiveKit, ADR-0107 BotssonProvider channel derivation) unchanged.

## Open Questions

- Does `communication` split into general + PII, or get the `allowedChannels: null` comment? Recommend: keep unified with explicit null + PII-unrestricted comment, revisit if PII-adjacent tools appear.
- When is the follow-up ADR for agent-router Layer 1 fix? Recommend: Phase 0 Week 1 of helpdesk rollout.

## Retrofit Plan (blocks status → `accepted`)

Council 2026-04-20 code-trace (agent-coordinator) found four existing capabilities that do NOT declare `allowedChannels`. Accepting this ADR as-is would cause `packages/ai/src/capabilities/registry.ts` init to throw, taking down the stage-engine at startup.

**ADR stays `proposed` until the following retrofit lands:**

| Capability | PII risk | Required declaration |
|------------|----------|----------------------|
| `profile` | HIGH — name, email, phone, display_name | `allowedChannels: ['chat']` |
| `communication` | MEDIUM — message bodies, conversation history | `allowedChannels: null` with `// CHANNEL-UNRESTRICTED — general messaging, no structured PII` comment, OR split into `communication` + `communication_pii` |
| `governance` | MEDIUM — per-employee readiness, missing policies | `allowedChannels: ['chat']` |
| `training` | MEDIUM — per-employee readiness, certifications | `allowedChannels: ['chat']` |

**Acceptance gate:** before flipping status to `accepted`, each of the four must have an explicit declaration committed. PR must also verify `packages/ai/src/capabilities/registry.ts` does not throw at module load.

**Ordering:** the retrofit PR is the single prerequisite. It is not Phase 0 of Helpdesk — it is a gating chore that unblocks ADR-0163 acceptance, which in turn unblocks Helpdesk Phase 0 Week 2 (dead-infra wiring depends on `communication` policy being declared).

Learning captured: L-0077 — ADR fail-closed enforcement on shared registry without consumer audit = init-time break.

---

> Amends ADR-0078. Depends on ADR-0162. Register in `0000-decision-log.md`.
> Retrofit plan added 2026-04-20 by council; 4 capabilities must declare `allowedChannels` before acceptance.
