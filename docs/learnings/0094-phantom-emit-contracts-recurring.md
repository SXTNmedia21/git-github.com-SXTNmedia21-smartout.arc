---
title: "Phantom emit contracts — recurring across specs"
id: LEARNING_0094
status: canonical
layer: learning
created: 2026-04-21
updated: 2026-04-21
tags: [telemetry, emit, phantom-contract, review-gate]
---

# Learning-0094: Phantom emit contracts — recurring across specs

## Context

Journey Runner Suite v1.6.0 named `journey.completed`, `journey.stuck`, `journey.step_reached` as canonical telemetry events. Zero matches in `packages/telemetry/src/registry.ts`. Same failure class as:

- 2026-04-20 COUNCIL: `helpdesk.query.reassigned` declared, zero emit sites (L-0083).
- 2026-04-17 Mobile Strategy: `emit()` exists but payload broken in 6 mutation sites (L-0045).
- 2026-04-07 Onboarding Route: `guardian.*` namespace events were a second phantom contract.

Fourth occurrence in ~100 days. This is now a canonical recurring pattern, not an incidental drift.

## Discovery

Specs and ADRs regularly cite event names in the `domain.verb_noun` shape as if the name is the contract. It is not. The contract is the registered entry in `packages/telemetry/src/registry.ts`. Without a registered entry, `emit()` silently drops the event and the mutation surface looks fine in code review while producing zero telemetry in production.

Phantom contracts survive multiple review layers because:

1. Reviewers grep for `emit(` and see the call — looks wired.
2. Reviewers do NOT grep the registry for the event name — assume it's registered.
3. TypeScript does not enforce registration — event name is a string literal.
4. Tests mock `emit()` or rely on Supabase mock chains — never hit the registry.

## Impact

- Every spec mentioning `domain.verb` events must now include a briefing fact-check line: *"For each named event, grep `packages/telemetry/src/registry.ts`; registered entries only."*
- Promote to Phase 2.5 fact-check step: "phantom emit check" — count matches between spec-named events and registered events.
- ADR-0175 (journey telemetry contract) is the explicit registration for journey events.
- Consider elevating to a CI gate: fail build if `emit('x.y')` in source where `'x.y'` is not in the registry. Strong-typed registry already exists — TypeScript can enforce this.

## References

- ADR-0134 (Mobile Telemetry Contract) — established the registration rule.
- ADR-0175 (Journey telemetry contract) — this council's response.
- L-0083 (helpdesk.query.reassigned phantom contract, 2026-04-20) — prior recurrence.
- L-0045 (emit payload broken, 2026-04-17) — cousin failure class.
- L-0059 (grep-count briefings undercount without code-trace) — why this slips past review.

---

> After writing: register in `docs/learnings/0000-learning-log.md`.
