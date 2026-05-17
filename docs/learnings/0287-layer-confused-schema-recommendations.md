---
title: "L-0287 — Layer-confused schema recommendations: fixture-author concern projected onto runtime contract"
id: L_0287
status: active
date: 2026-05-17
layer: learning
created: 2026-05-17
updated: 2026-05-17
tags: [council, schema, runtime, fixture, layer-confusion, system-steward, code-trace]
related_adrs: [ADR-0347, ADR-0348, ADR-0349]
related_learnings: [L-0147]
---

# L-0287 — Layer-confused schema recommendations

## Discovery

Phase 7 council (2026-05-17). Chair (system-steward) Phase 3 response recommended adding a 17th field `canonicalParagrafRef` to `ExpectedCell` type to solve the "fixture author needs to see Lovdata ref alongside NHO shorthand" concern during the dual-lineage transition.

Coordinator code-trace:

```bash
grep -rln "paragrafRef" packages/ai/src/capabilities/ services/stage-engine/src/
# → (empty — zero results)
```

Zero runtime consumers of `paragrafRef` outside fixture files and the CI test runner. No capability tool reads `paragrafRef` at runtime. The field exists on the type for audit provenance — it is never consumed in a compute path.

Chair self-reversal in Phase 3 synthesis: recommendation withdrawn. The concern ("fixture author is confused about which §-notation to use during re-cert") lives at the **fixture-author documentation layer**, not the runtime contract layer. A translation map in `docs/reference/` (ADR-0349) serves the fixture author without widening the runtime schema.

This is the 6th documented occurrence of the L-0147 chair-self-reversal pattern.

## Rule

Before recommending schema changes to "load-bearing" types (types used in CI oracle contracts, golden-month fixtures, or certification flows):

1. **Runtime consumer check FIRST:** `grep -rln "<field_name>" packages/ services/` must return ≥1 hit in a capability, engine, or service file (not just fixture or test files).
2. **If zero runtime consumers:** The concern is at data-author or fixture-author layer. Fix there:
   - Fixture-author UX → documentation, translation map, fixture comments
   - Fixture tooling → helper script, schema comment, YAML template
   - CI runner → test helper, assertion message
3. **Schema change is warranted only when** the runtime path requires the field to compute a correct result or enforce an invariant.

## Pattern signature

- Chair recommends new field to "make transitions clearer"
- Field name mirrors an existing field (e.g., `paragrafRef` → `canonicalParagrafRef`)
- Coordinator code-trace returns empty on the existing field in runtime paths
- Field is consumed only in: fixture files, test assertions, CI runner
→ Redirect to documentation layer; withdraw schema recommendation.

## Relationship to other learnings

- L-0147 — Chair self-reversal pattern. This is the 6th occurrence. Promote to `run-council` SKILL.md runtime-consumer-check rule at 7th occurrence.
- L-0276 — Phase 2.5 fact-check concept-vs-name drift. Same class: reviewing names instead of runtime paths produces layer-confused verdicts.
