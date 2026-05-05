---
title: "Wall-clock estimate divergence >3× as planning-quality signal (mandatory rewrite trigger)"
id: LEARNING_0210
status: canonical
layer: learning
created: 2026-05-05
updated: 2026-05-05
tags: [planning, estimation, council, plan-quality]
---

# Learning-0210: Wall-clock estimate divergence >3× as planning-quality signal

## Context

Pipeline Consolidation Plan Council 2026-05-04. Plan author claimed total wall-clock 4-5 hours with parallelization. Three reviewers independently estimated 2-3 days based on artifact count + comparable past sorties:

| Phase | Plan estimate | Reviewer estimate | Divergence |
|---|---|---|---|
| 1A doc rewrite | 30-45 min (1 subagent) | 2-3 hours (8 doc edits, 6 files, frontmatter validation) | 4× |
| 1B Supabase MCP verification + ADR + learning | 30-45 min | 1-2 hours (MCP query + draft + cross-ref) | 2-3× |
| 1C 3 security workflows | 30-45 min | 4-6 hours (Dependabot config + 2 workflows + ruleset update + first-PR validation) | 5-8× |
| 2 pre-push rewrite | 60 min | 4-6 hours (script + tier logic + concurrency + 3 test scenarios) | 4-6× |
| 3 Supabase Branching + branch-DB | 90 min | 4-8 hours (operator activation + branch-db.sh + env-var routing + Vercel sync timing + ADR-0266 drafting) | 3-5× |
| 4 E2E preview workflow | 60 min | 3-4 hours (correct trigger choice + project config + secrets + first-run validation) | 3-4× |
| 5 skill alignment | 30 min | 1 hour (4 PLAYBOOK entries + skill text + cross-ref) | 2× |
| **Total** | **4-5 hours** | **2-3 days (~16-24h)** | **3-6×** |

## Pattern recognition

### What planning-author saw
Pure mechanical edits, parallelized agents, doc-only Phase 1A. Sum of "fast paths" across 7 phases.

### What reviewers saw (via code-trace)
- **Surface area math:** 16-18 files touched, 1 ADR, 1-2 learnings, ruleset reconfiguration. Comparable past sorties: L-0042 = 8h for 6 files, 2026-04-19 kanaler Phase 0 = 3 weeks for 4 ADRs.
- **First-run validation cost:** 3 new CI workflows × ~30 min observation each per first PR. Plus ruleset re-config requires operator action sequenced after merge.
- **Parallelization theory vs practice:** 30-agent sessions don't sustain 7-phase parallel dispatch — review + merge serialization dominates wall-clock.
- **Plan-decay risk per L-0078:** parts of plan reference state already drifted (495 migrations vs 492; pre-push as "lightweight" while it already runs lint+typecheck).

## Hard rule

**When reviewer estimates diverge from author estimates by >3×, treat as forensic signal that author scoped only the happy path.** Mandatory rewrite trigger. Do NOT dispatch subagents against an under-estimated plan — the under-estimate signals other parts of the plan are also under-thought.

### Why >3× and not >2×

- 1.5-2× factor = normal planning optimism (minor steps forgotten, no architectural blind spots)
- 2-3× factor = scope drift (some phases under-scoped, plan still recoverable with addenda)
- **>3× factor = systemic scoping error** (author wrote happy-path-only; remediation is rewrite, not addenda)

### Mechanism

Plan reviewer must report estimate range alongside verdict. Council Phase 5 synthesis includes "wall-clock divergence ratio" as explicit field. >3× → REJECT verdict regardless of other findings.

## Application precedent

Pipeline-consolidation council 2026-05-04 was textbook case:
- Author: 4-5h
- Steward: 2-3 days
- Supervisor: 2-3 days
- Specialist: silent on estimate but identified 17 ranked items each with own micro-estimate summing to ~16-20h

REJECT verdict was correct. Plan was rewriteable, not refinable.

## Counter-cases (not yet observed but anticipated)

- **Author over-estimates:** reviewer says "this is 2h not 2 days." Same forensic signal — author is risk-averse or pad-padding. Less harmful but worth flagging.
- **Author + reviewer agree but both wrong:** anchor bias. Mitigation = compare against historical sortie wall-clocks (L-0042, kanaler council, etc.) not against author's frame.

## Related

- L-0078 (plan-file decay)
- L-0042 (parallel-worktree migration timestamps — sortie under-estimate enabled the collision)
- Council Skill Phase 5 §6 risk assessment (existing)

## Why this matters

Council exists to catch defects before dispatch. A plan author with >3× under-estimate is a stronger signal of plan defects than any individual finding — under-estimate confirms author did not surface-area the work. Rejecting on estimate alone (when divergence is large enough) is justified rejection.
