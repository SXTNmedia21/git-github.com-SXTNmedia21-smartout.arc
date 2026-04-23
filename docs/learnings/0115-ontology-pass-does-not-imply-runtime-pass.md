---
id: L-0115
title: "Ontology PASS does not imply runtime PASS"
status: accepted
date: 2026-04-22
type: process
created: 2026-04-22
updated: 2026-04-22
related_adrs: [ADR-0191, ADR-0192, ADR-0193]
module: MODULE_GOVERNANCE
tags: [learning, council, trust-gate, phase-5, verdict-discipline, contract-hub-redesign]
---

# L-0115 — Ontology PASS does not imply runtime PASS

## Context

2026-04-22 post-merge review of `contract-hub-redesign` (PR #234). The PR went through four pre-merge council gates. Phase 3 Steward verdict was "Cascade integrity preserved" (PASS WITH CONDITIONS). The conditions were noted but not enforced as merge blockers. The PR merged.

Post-merge code-trace found 4 critical runtime defects:
1. `forkTemplate` 401 (every agent invocation failed silently — auth bug, see ADR-0191).
2. Authority seed migration silently no-ops on workspaces lacking godmode user (default-allow CVE re-opens, see ADR-0192).
3. Triple-emit duplication on hub mount (telemetry inflation).
4. Bulk gate_action absence (single tool call covers 8 capability tools when each should gate).

**Cascade integrity (the ontology) was preserved.** The dimensional model held, the entity placement was correct, the lifecycle was intact. The verdict at Phase 3 was technically accurate at its layer.

**Runtime integrity was not preserved.** Four user-facing or security-facing defects shipped under cover of an ontology-level approval.

The reading "ontology PASS = safe to merge" was structural to the verdict format. The chair did not produce a single merge-gate verdict — only per-layer verdicts that were aggregated by the reader (Pontus + the merge step) into "looks good, ship it."

## Discovery

**Per-layer verdicts are advisory inputs to ONE merge-gate verdict, not substitutes for it.** When Phase 5 produces "PASS at ontology, CONDITIONAL at runtime, PASS at design" without a final synthesis verdict, the conditional layer is structurally invisible to the merge step.

Council Phase 5 must resolve the ontology-vs-runtime tension explicitly:
- If ontology PASS + runtime CONDITIONAL → merge verdict is CONDITIONAL (block merge until conditions enforced).
- If ontology PASS + runtime PASS → merge verdict is APPROVE.
- If ontology FAIL + runtime PASS → merge verdict is REJECT (ontology is load-bearing).

The chair owns the synthesis. Per-layer reviewers report findings; chair produces ONE merge verdict.

## Impact

**Update `run-council` SKILL.md Phase 5:**
1. Chair MUST produce a single merge-gate verdict (APPROVE / APPROVE WITH CHANGES / REJECT / FIX-FORWARD).
2. Per-layer verdicts (Steward ontology, Supervisor runtime, Frontend design) are inputs, not outputs.
3. Conditional verdicts ("PASS WITH CONDITIONS") MUST be enforced as merge-blockers — the conditions become part of the merge gate, not advisory follow-ups.
4. Chair's verdict explicitly states: "what would change my mind?" (i.e., what condition, if violated, downgrades APPROVE to REJECT).

**For contract-hub-redesign specifically:** the 4 P0 defects are addressed via fix-forward sortie (ADR-0191, ADR-0192, ADR-0193 + bulk gate_action + emit dedup).

## References

- ADR-0191 — Agent capability tool auth-passing pattern (P0 #2 fix).
- ADR-0192 — Authority seed bootstrap-trigger pattern (P0 #1 CVE close).
- ADR-0193 — ADR-0134 amendment NonEmptyString brand (telemetry hygiene).
- Council: `docs/council/COUNCIL-LOG.md` 2026-04-22.
- Related L-0099 (prior-council-verdict staleness pattern — sibling failure mode).
- Related L-0091 (semantic conflict resolution per minority — sibling synthesis discipline).

---

> After writing: register in `docs/learnings/0000-learning-log.md`.
