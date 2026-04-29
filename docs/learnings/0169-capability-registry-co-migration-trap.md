---
title: "Capability Registry Co-Migration Trap"
id: LEARNING_0169
status: canonical
layer: learning
created: 2026-04-29
updated: 2026-04-29
tags: [capability, registry, adr-0192, council, contract-module]
---

# Learning-0169: Capability Registry Co-Migration Trap

## Context

Council 2026-04-29 reviewing Contract Module Phase 0a foundation found ARCHITECTURE-contracts-module promised 4 new capabilities (`salary_query`, `contract_obligation_query`, `obligation_blocker_check`, `amendment_classify_change`) without referencing `capability_default_registry` (the table ADR-0192 created to close the default-allow CVE class). Coord code-trace showed the registry mechanism shipped in `20260518000000_contract_authority_seed_upsert_and_bootstrap.sql:132-233` — `BEFORE INSERT ON workspace` trigger seeds rows for all registered capabilities. Without registry tuple, gate_action default-allows the new capability on every workspace until follow-up migration lands. CVE re-opens.

## Discovery

Per ADR-0192, every new capability registration requires a `capability_default_registry` tuple in the SAME PR as the capability code. The registry is the structural invariant. Architecture documents that propose new capabilities without naming the registry tuple = phantom capability — code paths exist, authority gate doesn't.

Pattern signature:
- ARCH/spec doc lists new capability name + intent
- No INSERT INTO capability_default_registry in the migration
- Capability registers in `packages/ai/src/capabilities/registry.ts`
- gate_action returns "allow" by default → CVE window between merge and follow-up seed migration

## Impact

**Phase 2.5 fact-check for capability-introducing ADRs MUST grep:**
```bash
grep -E "INSERT INTO (public\.)?capability_default_registry" <proposed-migration>
```
Zero matches when ADR proposes new capability = REJECT until tuple added.

**Council Phase 5 Trust Gate:** new capability without registry tuple = pipeline cannot keep promise → block merge.

**Code-Tracer Mandate (Layer 4):** when reviewing ADR proposing capability, verify `INSERT INTO capability_default_registry` count matches new-capability count.

## References

- ADR-0192 (authority seed bootstrap-trigger pattern)
- ADR-0234 (contract/payroll capability split — first ADR to apply this learning)
- L-0094 (phantom emit recurring) — sibling pattern (telemetry registry)
- Council 2026-04-29 Contract Module Phase 0a

---

> Registered in `docs/learnings/0000-learning-log.md` 2026-04-29.
