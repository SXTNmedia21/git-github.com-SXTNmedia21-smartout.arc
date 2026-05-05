---
title: "Asymmetric reviewer coverage as risk signal — 3-reviewer minimum is load-bearing, not redundancy"
id: LEARNING_0211
status: canonical
layer: learning
created: 2026-05-05
updated: 2026-05-05
tags: [council, reviewer-coverage, plan-quality, multi-perspective]
---

# Learning-0211: Asymmetric reviewer coverage = load-bearing 3-reviewer minimum

## Context

Pipeline Consolidation Plan Council 2026-05-04 had 3 reviewers: Steward (chair), Supervisor, Security/CI Specialist. Each surfaced block-level findings the others missed:

| Reviewer | Block-level finding only they caught | Severity |
|---|---|---|
| Steward | §9 step 9 violates ADR-0265 operator-only ("Pontus only does production releases") | P0 — would breach merge boundary if dispatched |
| Steward | §4 env-var content placement (must move to ENV_PROTOCOL.md or becomes 18th doc-conflict) | P1 — silent doc-drift on archive |
| Supervisor | Phase 1D ruleset update gap (rulesets 14797822 + 15290760) — without it, all 4 new CI checks are advisory only | P0 — defeats entire security-baseline phase |
| Supervisor | `_meta_migration_state_rpc` reference is stale → actual RPC name `migration_state_latest` | P0 — acceptance criterion fails |
| Specialist | ADR-0266 collision against bubble-migration HANDOFF (2026-05-03 claims 0266-0268) | P0 — 5th occurrence Renumber Pattern |
| Specialist | `deployment_status` event vs `repository_dispatch` for Vercel→GitHub trigger (Vercel-documented vs operator-coupled) | P0 — replaces broken `workflow_run` claim |
| Specialist | CodeQL Python language matrix gap (services/scrapling/ uncovered) | P1 — security gap on external-data service |

Steward Phase 5 synthesis confirmed: **none of the 7 findings above were surfaced by 2+ reviewers**. Each was a single-reviewer catch.

## Pattern

### Wrong frame: "redundancy"

Common pre-skill-promotion frame: "3 reviewers ensures redundancy — if one misses something, another catches it." Assumes high overlap in reviewer coverage with rare gaps.

### Correct frame: "load-bearing"

Reviewers have **non-overlapping domain expertise**. Removing any one reviewer DROPS specific findings that no other reviewer is positioned to catch:

- Steward owns ADR coherence + cascade integrity + operator-boundary law
- Supervisor owns codebase conventions + ruleset/CI architecture + scope discipline
- Specialist (Security/CI) owns Dependabot/CodeQL/audit semantics + Vercel webhook patterns

7-finding asymmetric distribution at this council = empirical proof. If specialist hadn't been dispatched, ADR-0266 collision + workflow_run replacement + CodeQL Python gap would all have been MISSED. Plan would have been dispatched to subagents with three P0 defects intact.

## Hard rule

**Council Phase 1 INTAKE: 3-reviewer minimum is load-bearing for plan/architecture/post-implementation topics. Never skip "to save time" unless topic is clearly single-domain.**

### Reviewer-skip criteria (already in skill, reinforced here)

Per Council Skill Phase 1 selection flowchart:
- Skip frontend-designer ONLY for backend/DB/CI/script work
- Skip system-agent-coordinator ONLY for pure UI / non-Stage-Engine work
- Skip botsson-harness-builder ONLY when topic does NOT touch packages/ai/, services/stage-engine/, apps/web/src/app/Botsson/
- **Never** drop below 3 reviewers (steward + 2 specialists matched to domain)

### Asymmetric coverage as Phase 5 verification

Steward synthesis must explicitly note when findings are single-reviewer-caught. If 3+ block-level findings each have only 1 reviewer source, that confirms load-bearing 3-reviewer pattern. If all findings are 2+-reviewer-corroborated, Phase 1 may have over-assigned reviewers (acceptable; cost is minor).

## Counter-pattern: full-overlap finding distribution

If all reviewers report the same findings, two interpretations:
1. **Genuine convergence** — finding is high-priority and surface-level (good)
2. **Reviewer scope-collapse** — reviewers are not actually exercising distinct domains (bad signal)

To distinguish: look for findings that require domain-specific knowledge to surface. Pipeline-consolidation council had 4+ such findings (ruleset IDs, ADR collision, Vercel trigger semantics, CodeQL language matrix). Each requires domain knowledge no other reviewer has.

## Application precedent

Prior councils where asymmetric coverage was load-bearing (verified post-hoc):
- 2026-04-13 Calendar Guardian — Agent-coord caught calendar-scope bug; supervisor + steward did not
- 2026-04-16 Web Performance — Agent-coord caught divergence in 3 concurrent write paths; chair did not
- 2026-04-23 Journey Engine post-implementation — Agent-coord code-trace falsified phantom skeletons that grep-counts said were live
- 2026-04-28 ADR-0216 — Supervisor's 139-site blast-radius scan flipped chair Phase 3 verdict
- 2026-05-04 pipeline-consolidation — this council, 7 single-reviewer findings

5+ documented occurrences. Pattern is reliable.

## Related

- L-0023 (per-file review insufficient — code-trace mandate)
- L-0036 (4-layer review assignment for post-implementation — same shape, different mechanism)
- L-0147 (chair self-reversal — chair must REVERSE not REFINE when 2+ reviewers code-trace opposite)
- Council Skill Phase 1 selection flowchart
- Council Skill Phase 5 conflict-resolution table

## Why this matters

Council protocol is expensive (30-90 min per session × 3-5 reviewers in parallel). Temptation to skip a reviewer "for speed" is constant. This learning provides falsifiable cost-benefit: every council where asymmetric coverage was checked post-hoc had 3+ single-reviewer-caught block-level findings. Skipping a reviewer ≈ losing 1-3 P0 findings probabilistically. Cost of a missed P0 in dispatched plan >> cost of running one more reviewer.
