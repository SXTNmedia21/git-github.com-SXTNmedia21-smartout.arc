---
title: "5th chair self-reversal — chair-meta + code-tracer-mechanics both required for multi-subsystem plans"
id: L_0192
status: accepted
layer: learning
created: 2026-05-04
updated: 2026-05-04
references:
  - ./0147-phase-3-chair-self-reversal-pattern.md
  - ../decisions/0265-enforced-deployment-pipeline.md
---

# L-0192: 5th chair self-reversal — chair-meta + code-tracer-mechanics both required for multi-subsystem plans

## Why

System Council 2026-05-04 reviewed Pipeline Consolidation v2. The Phase 3 chair (system-steward, opus) produced a thorough structural review catching meta-pattern blockers: category error in Phase 1 (mixing doc-truth tasks with pre-push hook tasks), ordering paradoxes (drift-check in Phase 1 with no alerter to Phase 3), and architectural inconsistencies (ADR-as-experiment framing).

However, the chair missed 8 additional pipeline-mechanics blockers that were only caught by the specialist code-tracers: deploy-conductor caught the `[deploy]` tag propagation gap through `gh pr merge` (L-0190), system-agent-coordinator caught the `/deploy` external-state-machine gap (L-0191), supervisor caught convention and verification gaps in the pre-push hook ordering.

This is the 5th documented chair self-reversal in System Council history:

1. **2026-04-28** — /dashboard/help council: Phase 3 REJECT → Phase 5 APPROVE-as-tier after frontend-designer layout evidence (L-0147)
2. **2026-04-28** — ADR-0216 council: Phase 3 Option A2 → Phase 5 Option B after Supervisor 139-site blast-radius scan
3. **2026-04-28** — Journey Engine audit: Phase 3 "M1-M3.5 complete" claim → Phase 5 FALSE after agent-coord code-trace surfaced CVE and phantom capabilities
4. **2026-04-29** — Botsson on Platform Admin: Phase 3 structural acceptance → Phase 5 ADR-0238 violation caught by frontend-designer
5. **2026-05-04** — Pipeline Consolidation v2: Phase 3 meta-blockers only → Phase 5 8 additional mechanics-blockers from specialist code-trace

The pattern is now stable: chair-meta review (structural, ordering, category) and code-tracer-mechanics review (pipeline integration, API contract, tool execution paths) are **complementary and non-substitutable**. A chair doing only meta review will miss mechanics. A code-tracer doing only mechanics will miss meta-patterns. Both are required for plans touching > 2 subsystems.

The **promotion threshold (5 occurrences)** is met. This must be codified in `run-council` SKILL.md Phase 3 dispatch rules.

## How to apply

**For plan-type councils involving > 2 subsystems:**

Phase 3 dispatch MUST include at minimum:
1. One **chair-meta reviewer** (system-steward) — structural integrity, ordering, ADR compliance, category errors
2. One **domain code-tracer** per subsystem the plan touches — traces actual code/config to verify plan claims

The chair-meta reviewer SHOULD NOT be the only one reading the plan. If only one reviewer is available, they should explicitly state which role they are playing (meta or mechanics) and flag that the other role was not filled.

**Phase 5 synthesis protocol update:**
- Chair MUST classify each Phase 3 position as: HELD / REVERSED / REFINED (per L-0147)
- For reversals caused by code-tracer evidence: chair MUST name which reviewer and which finding caused the reversal
- "Chair-meta missed mechanics" is a known failure mode, not a council failure — document it as such

**Skill update target:** `~/.claude/skills/run-council/SKILL.md` Phase 3 §Dispatch rules — add mandatory dual-track requirement for multi-subsystem plans.

## Pattern signature

- Plan touches > 2 subsystems (CI, deployment, git, Vercel, n8n)
- Phase 3 chair produces structural review (meta-pattern blockers)
- Phase 5 specialist reviewers find additional non-meta gaps
- Chair's Phase 3 verdict must be revised in Phase 5

When all four: single-chair Phase 3 was structurally insufficient; add domain code-tracer next time.

## References

- `./0147-phase-3-chair-self-reversal-pattern.md` — L-0147: original self-reversal pattern (1st occurrence)
- `docs/council/COUNCIL-LOG.md` — 2026-05-04 entry, 5th chair self-reversal documented
- `../decisions/0265-enforced-deployment-pipeline.md` — plan this council reviewed
