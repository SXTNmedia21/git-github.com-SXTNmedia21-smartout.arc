---
id: L-0127
title: "Loader-level bugs evade grep-audits — end-to-end code-trace required"
status: accepted
date: 2026-04-23
type: process
created: 2026-04-23
updated: 2026-04-23
related_adrs: [ADR-0195]
module: quality
tags: [code-trace, grep-audit, loader, authority, cve-class, council, l-0117-extension]
---

# L-0127 — Loader-level bugs evade grep-audits: end-to-end code-trace required

## Context

L-0117 ("grep-based structural claims must be code-traced") was promoted 2026-04-22 after its 5th occurrence. The principle: a claim like "file X exists" or "pattern Y appears 258 times" requires Read citation, not grep count. Phase 2.5 gained a strict discipline: structural claims require `file:line` citations.

On 2026-04-23, council Phase 2.5 fact-check ran against 12 briefing claims in the journey-engine post-implementation audit. **All 12 verified, every file:line citation was accurate.** The ground-truth table in the briefing was correct.

During Phase 3 parallel review, `system-agent-coordinator` conducted a true end-to-end code-trace across four layers (classifier → capability registry → tool-selector → authority loader → gate_action RPC). The trace surfaced a **CVE-class loader bug in `services/stage-engine/src/core/authority.ts:45-51` that no claim in the briefing had mentioned** — because no one had written a claim about the loader.

The bug: the loader folds dotted capability keys (`journey.run_dev`) into a base key (`journey`) without an `ORDER BY` on the `.select()`. The base-key authority level is therefore the level of whichever row returns first — non-deterministic per query. Downstream, `tool-selector.ts:67` reads the base-key form, making per-capability tool-visibility decisions using a non-deterministic authority level. ADR-0176's deliberate per-capability C4 seed is silently collapsed.

Every prior audit of this area had grep-counted `callGateAction` occurrences and seed row counts. Both were correct. The bug is in the loader, one layer above those call sites. **Grep of the call sites cannot see a bug in the loader.** Only tracing from seed → loader → authority map → tool-selector → agent observation reaches the defect.

## Discovery

**Some defect classes are structurally invisible to grep-audits.** Even disciplined grep-with-citation (L-0117) cannot find them because the grep's target set is the call sites, not the transformation layers between the call sites.

Three defect classes in this category:

1. **Loader / reader bugs.** Rows in a table are correct; call sites read the loaded data correctly; the transformation in between is wrong. Example: authority base-key fold.
2. **Ordering-dependent bugs.** Each individual query is correct; aggregation across queries depends on undefined ordering. Example: ADR-0176 seed migration writes 4 correct rows per workspace in a deterministic order, but the loader reads them in undefined order.
3. **Identity-collapse bugs.** A field has two possible meanings in different contexts; a collapser picks one. Example: `capability.name` vs `tool.capability` — short vs dotted form — same string type, different semantic layer.

Detection requires tracing a single payload field from source (DB write) to sink (agent observation or user visible behavior). If the field's value changes form, a loader bug is possible. If the field's value is non-deterministic under repeat queries, an ordering bug is possible. If two code paths read "the same" field with different forms, an identity-collapse bug is possible.

Phase 3 code-trace assignment (via the Code-Tracer Mandate) already exists for DB, agent capabilities, stage engine, and cross-system payloads. The L-0127 addition: **the trace must cover intermediate transformation layers, not only endpoints.**

## Impact

**Code-Tracer Mandate amended.** Phase 3 reviewers assigned the code-trace role must trace **through** every loader, transformer, and aggregator between the source and sink, not only across endpoints. Phrasing update:

> Trace the actual code path end-to-end with file:line citations. For every layer that reads, transforms, or aggregates data between the declared input and the declared output, read the transformation code and verify the output form matches the consumer's expectation. Name any layer where the payload's form, ordering, or identity semantics could shift.

**Council briefing template gains a "transformation layers" field.** For any topic touching a capability, authorization, or telemetry path, the briefing lists the transformation layers between source and sink (e.g., for journey capabilities: DB seed → loader → authority map → tool-selector → router → tool execute → emit). Reviewers get targeted trace assignments per layer.

**Phase 2.5 fact-check does NOT get a loader-audit addition.** Fact-check is a claim-verification gate, not a defect-hunt. Loader defects surface in Phase 3 code-trace, not Phase 2.5. This delineation is deliberate: conflating fact-check with defect-hunt dilutes both.

**Single enforcement change:** Council skill's Code-Tracer Mandate section updated to include the transformation-layer trace requirement. L-0117 covers claims; L-0127 covers transformations.

**Recognition signal for reviewers.** If all call sites look correct and the behavior still drifts, look one layer up — at the thing that loaded or transformed the data before the call sites saw it.

## References

- L-0117 — grep-based structural claims must be code-traced (prior principle, promoted to SKILL rule).
- L-0112 — code-trace catches what grep briefing misses (related; different specific pattern).
- L-0118 — every capability tool requires E2E Trust Gate test (adjacent; different failure layer).
- ADR-0195 — authority loader full dotted-key preservation (the defect found via this trace).
- ADR-0173 — four journey capabilities (the contract the loader silently broke).
- Council: `docs/council/COUNCIL-LOG.md` 2026-04-23.
- `services/stage-engine/src/core/authority.ts:45-51`.
- `packages/ai/src/router/tool-selector.ts:67`.
- `packages/ai/src/capabilities/types.ts:24`.

---

> After writing: register in `docs/learnings/0000-learning-log.md`.
