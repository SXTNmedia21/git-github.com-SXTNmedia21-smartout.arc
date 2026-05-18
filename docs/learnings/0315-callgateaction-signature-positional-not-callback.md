---
title: "callGateAction Signature is Positional, Not Callback — Spec Pseudocode Must Match Real Signature"
id: LEARNING_0315
status: canonical
layer: learning
created: 2026-05-18
updated: 2026-05-18
tags: [council, spec-review, gate-action, phantom-contract, L-0176-family]
---

# Learning-0315: `callGateAction` Signature is Positional, Not Callback

## Context

Council review on 2026-05-18 of the Announcement Kind/Tier/Entity-Link spec. Spec §8 pseudocode showed `callGateAction({ capability: 'broadcast.send', channel: 'chat', workspace_id, profile_id, action: async () => { supabase.rpc('publish_announcement_atomic', ...) } })` — a callback pattern.

Agent-Coordinator + Harness Phase 3 code-trace surfaced that the real signature at `packages/ai/src/capabilities/communication/gate.ts:52-57` is:

```ts
async function callGateAction(
  supabase: SupabaseClient,
  workspaceId: string,
  actorProfileId: string,
  args: GateActionArgs
): Promise<GateActionResult>;
```

Returns `{ allow, reason, ... }`. There is no callback parameter. There is no `action` field. The caller checks `result.allow` before performing the mutation.

The spec's pseudocode was implementable-looking but non-implementable; any builder copying it directly would get TypeScript errors immediately, then might "fix" the signature in ways that bypass the gate result-check entirely (e.g. invoke the action without inspecting `allow`).

## Discovery

Spec pseudocode is an **illustration of intent**, not an **implementation target**. When the illustrated function does not match the real function signature, the spec creates a phantom contract.

Phantom contracts in capability tools have a known failure mode: the builder, faced with a TypeScript error, often abandons the wrapping pattern entirely and goes back to direct mutation. This is the exact regression the gate-action mechanism (ADR-0287, ADR-0204) was designed to prevent.

This is a **sibling pattern** to L-0314 (capability-key drift). Both are forms of spec-vs-code drift where the spec was written at a level above the real call site without re-verifying the contract.

## Impact

**Hard rule for spec authors:** When pseudocode invokes a shared helper (`callGateAction`, `emit`, `gatedMutation`, `useToolBridge`, etc.), the pseudocode MUST match the helper's actual exported signature.

If the spec INTENDS to evolve the helper signature, declare that explicitly: "This spec PROPOSES a new callback-style `callGateAction` overload." The proposal then requires an ADR for the helper change before the spec can ship.

**Council Phase 2.5 fact-check addition:** For every shared-helper invocation in spec pseudocode:

1. Grep the helper's export location.
2. Verify the parameter list + return shape match the pseudocode.
3. If mismatched, flag as `HELPER-SIGNATURE-DRIFT`.

**Council Phase 3 trust-gate addition:** Reviewer assigned to Code-Tracer Mandate must explicitly call out helper-signature drift. The phrasing "trace the call shape end-to-end with file:line" already implies this but should be made explicit in the briefing template.

**Memory hook:** Spec pseudocode invoking shared helpers is a smell that requires immediate grep-verification. Treat pseudocode that mismatches the real signature as a structural defect, not a stylistic note.

## References

- ADR-0369, ADR-0370, ADR-0371 (Announcement council derivatives)
- Council session: `docs/council/COUNCIL-LOG.md` entry 2026-05-18 Announcement Kind/Tier/Link
- Sibling patterns: L-0176 (docstring drift), L-0177 (silent fallback), L-0314 (capability-key drift)
- Falsifying evidence: `packages/ai/src/capabilities/communication/gate.ts:52-57` vs spec §8 pseudocode

---

> After writing: register in `docs/learnings/0000-learning-log.md`.
