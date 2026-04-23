---
id: L-0129
title: "Registry-entry-as-typo is a phantom-contract subclass (5th occurrence)"
status: accepted
date: 2026-04-23
type: process
created: 2026-04-23
updated: 2026-04-23
related_adrs: [ADR-0175, ADR-0197]
related_learnings: [L-0094, L-0117, L-0124]
module: quality
tags: [phantom-contracts, telemetry, registry, fact-check, phase-2-5, council]
---

# L-0129 — Registry-entry-as-typo is a phantom-contract subclass (5th occurrence)

## Context

Hospitality gap analysis council (2026-04-23) fact-checked the shift-swap telemetry path against `packages/telemetry/src/registry.ts`. The registry contained a key for the swap-request emit — but the key was **`"shift swap_requested"` (with a space)** while every emit site in the shift_swap capability tool uses the dot-form **`"shift_swap.requested"`** (or an equivalent underscore-dot variant).

Result: the emit fires, the provider accepts, the event falls on the floor at the registry lookup — there is no destination binding for the string the emit uses. PostHog, Logger, `activity_trail`, and `engine_event` all miss the event. The audit trail for shift_swap has been silently empty since the capability shipped.

This is a **phantom-contract failure** — ADR-0175 named the class ("declared event with no matching producer/consumer binding"). L-0094 logged the original occurrence. L-0124 logged Mode 2 (phantom body — `execute()` returns `ok:true` without side effects). This is the 5th occurrence of the broader phantom-contract class, and the first where the phantom lives inside the registry as a typo rather than as a missing entry.

## Discovery

**Registry-entry-as-typo is a distinct phantom-contract subclass.** The previous modes:

- **Mode 1 (phantom emit)** — emit called with a string that has no registry entry. Detectable by grep: "for every `emit('X')`, does `X` exist in `registry.ts`?"
- **Mode 2 (phantom body)** — tool returns `ok:true` but performs no mutation. Detectable by E2E test that asserts the side effect (ADR-0196 Invariant #11).
- **Mode 3 (phantom status claim)** — campaign claims "M3 complete" with no `verify:` block supporting it. Detectable by verify-block requirement (ADR-0196 Invariant #12).
- **Mode 4 (this one) — registry-entry-as-typo** — emit string and registry key are *both* present but do not match character-for-character. Grep of either side passes. Only cross-checking a *specific* emit site against a *specific* registry entry catches it.

The Phase 2.5 fact-check discipline established by L-0117 (grep claims require code-trace) is not enough for Mode 4. Grepping `"shift_swap"` in the registry returns a match (the typo'd key). Grepping `"shift_swap.requested"` in emit sites returns matches. Both grep results look healthy. The bug is that the two strings differ — and grep without a cross-check comparing the exact strings misses it.

## Impact

**Phase 2.5 fact-check gains a cross-check step for telemetry claims.** Current discipline: "verify event X exists in registry". New addition: "verify event X exists in registry AND the exact string used at the emit site equals the exact string of the registry key". Comparison is string-equality, not substring or lowercase-insensitive.

Concretely, for every briefing claim of the form "capability C emits event E":

1. Locate the emit site(s) for capability C in `packages/ai/src/capabilities/**` (or the equivalent path per project layout).
2. Extract the exact string passed to `emit(`.
3. Locate the registry entry for event E in `packages/telemetry/src/registry.ts`.
4. Extract the exact key string from the registry.
5. Assert string-equality (`extractedEmitString === extractedRegistryKey`).

If equality fails, flag as Mode 4 phantom. Mode 4 is a merge blocker at Phase 2.5 — the briefing's claim is materially false even though both source files appear healthy in isolation.

**Promotion candidate trigger.** Phantom-contract class is at 5 occurrences across ~100 days. ADR-0197 promotes the class rule; this learning is the cross-check addition that ADR-0197 cites. If Mode 4 recurs independently (not as a retest of shift_swap), consider tightening the registry shape so keys are derived from a typed enum rather than string-typed — which would make Mode 4 a compile-time error.

**No new primitive needed.** The registry already exists; the emit helper already exists; the mismatch is human-error in string-typed code. Cross-check is a process gate, not a mechanism change.

## References

- ADR-0175 — journey telemetry contract (the original ADR naming phantom-contract class).
- ADR-0197 — phantom contracts class rule (promotion of L-0094 after 5th occurrence).
- L-0094 — phantom emit contracts recur (original canonical learning).
- L-0117 — grep-based structural claims must be code-traced (the principle Mode 4 evades).
- L-0124 — phantom body vs phantom emit (Mode 2, the other shape surfaced in journey-engine audit).
- Council session 2026-04-23 (hospitality gap analysis) — Phase 2.5 fact-check caught the typo.
- `packages/telemetry/src/registry.ts` — the site of the typo.
- `packages/ai/src/capabilities/` (or local layout) — emit sites for shift_swap.

---

> After writing: register in `docs/learnings/0000-learning-log.md`.
