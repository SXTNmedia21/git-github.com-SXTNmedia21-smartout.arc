---
title: "ADR-0107 Amendment — mode→channel Derivation Is Provider-Independent"
id: ADR-0276
status: proposed
layer: decision
created: 2026-05-04
updated: 2026-05-04
amends: [ADR_0107]
---

# ADR-0276: ADR-0107 Amendment — `mode→channel` Derivation Is Provider-Independent

## Context and Problem Statement

ADR-0282 (Voice Plane Consolidation — LiveKit Everywhere, Ultravox Removed) was drafted to migrate all voice surfaces from Ultravox to LiveKit Agents. In its original R1 formulation, ADR-0282 proposed superseding or simplifying ADR-0107 ("Botsson Provider Channel Derivation"). System Council 2026-05-04 Phase 5 synthesis ruled this incorrect: ADR-0107 must be amended, not superseded.

The core question is whether the `mode→channel` derivation contract established by ADR-0107 is tied to any particular audio provider, and therefore whether replacing Ultravox with LiveKit invalidates it.

## Decision Drivers

- ADR-0107 establishes `mode→channel` derivation: `chat-mode → channel='chat'`, `voice-mode → channel='voice'`. This is the contract that allows ADR-0078 and ADR-0163 channel guards to fire correctly.
- Code-trace (coordinator + harness-builder Phase 3, 2026-05-04) found that `BotssonProvider.tsx:693` contains only a hardcoded `provider: "ultravox"` field — there is no provider-derivation logic in `BotssonProvider.tsx`.
- Mobile `apps/mobile/src/providers/botsson-provider.tsx` (per ADR-0107:19) carries the actual `mode→channel` rule. This code path is identical post-Phase-E.
- The `provider` field is transport-level configuration. Post-ADR-0282, it becomes `"livekit"`. It has no effect on how `mode` maps to `channel`.
- Superseding ADR-0107 would remove the documented authority for `mode→channel` derivation and undermine the channel guard chain (ADR-0078 → ADR-0107 → ADR-0163).

## Considered Options

1. **Supersede ADR-0107** — treat provider swap as requiring a new derivation contract.
2. **Amend ADR-0107 (this decision)** — clarify that the derivation contract is provider-independent; update only the provider field reference.
3. **Leave ADR-0107 unchanged** — accept that ADR-0282 implicitly updates all provider references without documentation.

## Decision Outcome

Chosen option: **"Amend ADR-0107"**, because the `mode→channel` contract is load-bearing and must remain documented. Superseding it would create a documentation gap in the channel guard chain. Leaving it unchanged would allow the provider reference to go stale without formal acknowledgment.

## Rules & Consequences

- **R1 (Provider field — clarified):** The `provider` field on `BotssonProvider` is transport-level configuration, not derived. Pre-ADR-0282 it is hardcoded `"ultravox"`. Post-ADR-0282 R6 migration sequence it becomes hardcoded `"livekit"`. No derivation logic exists or is introduced.
- **R2 (`mode→channel` derivation — preserved unchanged):** `chat-mode → channel='chat'`, `voice-mode → channel='voice'`. This contract is the load-bearing one. It holds regardless of audio provider. Web BotssonProvider follows the same rule as mobile post-Phase-E.
- **R3 (ADR-0107 status unchanged):** ADR-0107 remains `accepted`. This amendment is `proposed` until the ADR-0282 R6 migration sequence is completed and verified.
- **R4 (No code change required by this amendment):** All changes to the `provider` field are covered by ADR-0282 R6. This amendment is documentation-only.

- **Good, because** the channel guard chain (ADR-0078 → ADR-0107 → ADR-0163) remains unbroken and correctly documented after the provider swap.
- **Good, because** future capability tools that propagate `ctx.channel` from BotssonProvider context continue to work identically on web and mobile.
- **Bad, because** this amendment creates a two-document relationship (ADR-0107 + ADR-0276) where a clean rewrite would be simpler — deferred until ADR-0107 reaches a natural revision cycle.
- **Agent Impact:** Capability tools reading `ctx.channel` to enforce ADR-0078 channel restrictions are unaffected. No tool, gate, or channel guard needs modification as a consequence of the provider swap. Agents authoring new channel-gated capabilities should continue citing ADR-0107 as the `mode→channel` authority.

---

> After writing: register in `docs/decisions/0000-decision-log.md` and update the ADR table in `CLAUDE.md`.
