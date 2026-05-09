---
title: "ADR-0078 amendment — allowedChannels mandatory for PII capabilities"
id: ADR-0163
status: accepted
layer: decision
created: 2026-04-19
updated: 2026-04-20
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

## Retrofit Plan — COMPLETED 2026-04-20

Council 2026-04-20 code-trace (agent-coordinator) initially identified 4 PII-risk capabilities missing `allowedChannels`. Full audit of `packages/ai/src/capabilities/` found **8 capabilities** without the declaration — any of which would cause `registry.ts` init to throw under ADR-0163 enforcement. All 8 retrofitted in the same commit as ADR acceptance.

**Retrofit result (all committed 2026-04-20):**

| Capability | Declaration | Rationale |
|------------|-------------|-----------|
| `profile` | `['chat']` | HIGH PII — name, email, phone |
| `governance` | `['chat']` | Employee-identifying readiness (profile_id → missing policies) |
| `training` | `['chat']` | Per-employee readiness + certifications |
| `operations` | `['chat']` | Task/deviation data references profile_id + session_id |
| `operations_intelligence` | `['chat']` | Aggregate/KPI drill-down exposes employee identities |
| `communication` | `['chat', 'voice', 'sms', 'email']` | General-purpose messaging; user-authored content, not structured PII |
| `guardian` | `['chat', 'voice', 'sms', 'email']` | System-level telemetry, no employee PII |
| `ui` | `['chat', 'voice', 'sms', 'email']` | Presentation-only, no data exfiltration |

**Acceptance gate cleared:** all 8 capabilities have explicit declarations; `packages/ai/src/capabilities/registry.ts` does not throw at module load.

**Downstream unblocked:** Helpdesk Phase 0 Week 2 dead-infra wiring may now proceed (depends on `communication` policy being declared).

Learning captured: L-0077 — ADR fail-closed enforcement on shared registry without consumer audit = init-time break. Actual scope (8) was 2x the initial estimate (4) — reinforces L-0077's "full consumer audit before acceptance" rule.

---

> Amends ADR-0078. Depends on ADR-0162. Register in `0000-decision-log.md`.
> Accepted 2026-04-20 after retrofit of all 8 capabilities missing `allowedChannels`.
