---
title: "gate_action Layer 1 is silent for ad-hoc agent-router paths"
id: L-0068
status: accepted
layer: learning
module: meta
created: 2026-04-19
updated: 2026-04-19
tags: [learnings, security, authority, adr-0078, agent-router]
---

# Learning-0068: `gate_action` Layer 1 is silent for ad-hoc agent-router paths

## What Happened

ADR-0078 defined three-layer defense-in-depth for voice/chat channel restrictions: Layer 1 (process.allowed_channels, enforced in DB), Layer 2 (capability.allowedChannels, enforced in tool-selector), Layer 3 (tool ctx.channel guard, enforced in tool execute). The ADR presented these as redundant layers protecting PII — if any one fails, the others catch it.

During 2026-04-19 helpdesk code-trace, the agent-coordinator verified that `gate_action` RPC at `20260505110000_unified_authority_gate.sql:139-151` only enforces Layer 1 when `p_engine_process_id` is supplied. The stage-engine agent-router (`services/stage-engine/src/core/agent-router.ts:89-95`) does **not** pass `p_engine_process_id` for ad-hoc chat — the common case where Emma responds to a user message without a specific process in flight.

Concrete implication: for any agent interaction that starts as "user types a question", Layer 1 is silent. The full defense reduces to Layer 2 (capability filter) + Layer 3 (tool self-check). Defense-in-depth is not three layers deep in the common case; it's two.

This was not malicious or obvious. The ADR authors wrote correctly about the model; the implementation of the agent-router chose the most natural integration point (ad-hoc chat has no single process to cite); the combination quietly downgraded the protection model without flagging it.

## What We Learned

Security architecture documents describe intent; code enforces behavior. When the two diverge silently, reviewers looking at the ADR read "three layers" and reviewers looking at the code see "tool-selector + tool" without connecting the dots. The drift is invisible until someone traces a specific payload end-to-end.

This pattern (ADR describes N-layer defense; code implements N-1) is not specific to channel restriction. It recurs whenever:
- A policy document describes redundant checks, and
- One of the checks has a precondition that the caller chain doesn't reliably satisfy.

In this case the precondition is "caller provides process_id." The agent-router is one caller; there may be others (webhooks, scheduled jobs) that also don't supply process_id. Each such caller silently opts out of Layer 1.

## The Rule

Three enforcement points, one per cause:

1. **Document known gaps in the ADR itself.** ADR-0078 gets an amendment (ADR-0163) documenting that Layer 1 is silent for ad-hoc agent-router. A reader of ADR-0078 should not come away believing Layer 1 protects chat.
2. **Compensate at the active layer.** Since Layer 2 carries the load for ad-hoc chat, it must be non-optional for PII capabilities. Undefined `allowedChannels` = fail-closed on registration (ADR-0163).
3. **Trace every caller of a policy-enforcement RPC.** When an RPC takes optional parameters that gate behavior, grep every call site. Call sites that omit the optional parameter are silently opting out. Document each silent opt-out (either "intentional — protection X covers it" or "bug — fix").

Corollary: when reviewing a new ADR that describes redundant defense, ask "what are the preconditions for each layer, and who enforces those preconditions?" If the answer is "the caller," the layer is advisory, not enforced.

## References

- ADR-0078 — three-layer channel restriction (original).
- ADR-0163 — amends 0078 with fail-closed rule on capability registration.
- `services/stage-engine/src/core/agent-router.ts:89-95` — omits `p_engine_process_id`.
- `supabase/migrations/20260505110000_unified_authority_gate.sql:139-151` — Layer 1 precondition.
- Council 2026-04-19 — helpdesk, code-trace discovery.
