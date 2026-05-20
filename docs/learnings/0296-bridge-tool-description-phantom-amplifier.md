---
title: "Bridge tool description refinement is a phantom-contract amplifier when L4 capability absent"
id: LEARNING_0287
status: canonical
layer: learning
created: 2026-05-17
updated: 2026-05-17
tags: [bridges, capabilities, phantom-contract, ADR-0238-sibling, L-0257-sibling]
---

# Learning-0287: Bridge tool description refinement is a phantom-contract amplifier when L4 capability absent

## Context

M5 HMS council (2026-05-17). Botsson Harness Builder traced BOTSSON-SYSTEM-MAP L4 (Brain / capability) layer for HMS surface — **NO capability exists** in `packages/ai/src/capabilities/` for `hms`, `policies`, `handbook`, or `deviations`. Only `training` capability exists (1 of 4 candidate domains). HMS bridges register tools via `useRegisterTools("hms", kit)` etc. — these are pure L1 client-side dataRef bridges with no Stage Engine roundtrip. Bridge tool `description:` text reads like LLM-routable Botsson tools, but there is no agent backend that consumes them.

The 8-phase `smartout-page-polish` workflow includes "harness-tool descriptions" as one of the polish steps — refining the `description:` text so the LLM picks the right tool. Past polish sorties (contracts, cost, billing) added new tool descriptions assuming the bridge → agent pipe was live.

## Discovery

When the L4 capability does not exist, bridge tool descriptions are L1-only annotations — they affect ONLY the local-page tool registry visible to whoever scans the in-page bridge. They are NOT consumed by the Stage Engine tool router. Refining them creates the illusion of LLM-routable capability while the agent has no backend route to actually call.

This is L-0257 (ADR-0238 phantom-contract accumulator) applied to bridge tool descriptions instead of component references. Same shape: documentation text accumulates promising behavior that the load-bearing system cannot deliver.

**The smell:** any polish sortie that adds or refines bridge tool `description:` text on a domain without a matching `packages/ai/src/capabilities/<domain>/` directory.

## Impact

**For polish sorties:**
- BEFORE refining tool descriptions, check capability existence: `ls packages/ai/src/capabilities/ | grep <domain>`. If absent, choose one of:
  1. **Defer description refinement** — keep current text, document the capability gap in HANDOFF, mark for capability sortie.
  2. **Build capability concurrently** — out of polish scope; promote to dedicated capability sortie before polish proceeds.
  3. **Mark bridge as L1-only explicitly** — add comment to `_tools/use-<domain>-tools.ts` noting "L1 client-side only; no Stage Engine capability; descriptions are local registry only".

**For council orchestrators:**
- Phase 3 brief for any polish-class topic MUST include explicit capability-gap inventory. Briefing claim "bridge has N tools" must be paired with "L4 capability exists Y/N".
- Trust Gate (Phase 5 §2) must answer: "Does any new tool description promise behavior the L4 cannot deliver?"

**For polish workflow (smartout-page-polish skill):**
- Add explicit step "Capability existence check" — grep `packages/ai/src/capabilities/` for domain match before "harness-tool descriptions" phase.

## Sibling pattern

- **L-0257** (2026-05-14): ADR-0238 phantom-contract accumulator (40+ comment refs to non-existent DomainChatOwnership).
- **L-0258** (2026-05-14): Tool-registry collision = the routing layer's failure mode.
- **L-0260** (2026-05-14): Polish-wave amplifies pre-existing debt.
- This learning extends L-0257 from "component reference accumulation" to "tool description accumulation".

## References

- ADR-0238 (DomainChatOwnership build-or-retract threshold)
- ADR-0325 (Page-tool authority semantics)
- L-0257, L-0260
- BOTSSON-SYSTEM-MAP L1-L5 contract
- Council 2026-05-17 M5 HMS scoping verdict
