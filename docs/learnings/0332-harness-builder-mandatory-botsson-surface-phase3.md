---
title: "Harness-builder mandatory in Phase 3 for Botsson-surface councils — net-new-phase classification is harness-axis only"
id: LEARNING_0332
status: canonical
layer: learning
created: 2026-05-23
updated: 2026-05-23
tags: [council, run-council, phase-3, botsson, harness, l-0147-family]
---

# Learning-0332: Harness-builder reveals net-new-phase classification that triple-reviewer Phase 3 misses

## Context

Council 2026-05-23 reviewed the InlineConfirmCard HITL primitive (ADR-0398). The chair (Steward Phase 3) reviewed cascade integrity + ontology. Supervisor reviewed conventions + scope. Agent-Coord reviewed Stage Engine contracts. None of the three classified the work into a phase taxonomy — they reviewed *whether* the work should ship, not *which phase of the Botsson harness it belongs to*.

**Botsson Harness Builder caught the gap:** ProposalCard / `show_proposal_card` / BotssonChat-fixed registration is **net-new, fitting no existing A/B/C/D phase** in BOTSSON-SYSTEM-MAP.md. Harness Builder proposed Phase H1 (Harness Primitives) or nested-C4 (HITL Primitives) — either way, a phase-classification call that only Harness Builder is positioned to make. The chair did not flag it. Supervisor did not flag it. Agent-Coord traced code but did not classify into phase.

This is the sibling-pattern to L-0147 (single-axis reviewer insufficient) and L-NEW-4 (Phase 3 coverage gap on design+a11y axis). The cascade + conventions + contracts triplet misses **phase classification** as a separate axis.

## Discovery

When a council touches the Botsson harness — specifically anywhere under `apps/web/src/app/Botsson/_components/`, `packages/ai/src/harness/`, `services/stage-engine/`, or `packages/ai/src/capabilities/` interacting with the chat surface — **harness-builder review is MANDATORY in Phase 3, not Phase 4 (narrator) or post-hoc**.

Harness Builder's unique contribution to Phase 3 vs the other three reviewers:

| Reviewer | Axis covered | Net-new-phase classification? |
|---|---|---|
| System Steward | Cascade integrity, ontology, ADR conflicts | NO — reviews against existing model |
| Supervisor | Codebase conventions, scope, telemetry phantom | NO — reviews against existing patterns |
| System Agent Coordinator | Stage Engine contracts, code-trace at adapter/router/dispatch | NO — traces what exists, not what's missing |
| **Botsson Harness Builder** | **L1–L5 phase mapping, BOTSSON-SYSTEM-MAP status, net-new vs existing-pipe** | **YES — owns phase classification** |

Without harness-builder, councils that should ship as a separate sortie with its own phase identity get classified ad-hoc by the orchestrator at synthesis time — which is too late to surface dependencies on open 🔴/🟡 pipes.

## Impact

**Run-council SKILL.md hard rule (Phase 3 Hard Rules — Botsson Harness Surface):**

> When a council touches any of:
> - `apps/web/src/app/Botsson/_components/**`
> - `packages/ai/src/harness/**`
> - `services/stage-engine/**`
> - `packages/ai/src/capabilities/**` interacting with chat surface
> - `apps/web/src/app/api/botsson/**` or `/api/emma/**`
> - `packages/ai/src/primitives/**`
>
> Botsson Harness Builder MUST be dispatched in Phase 3 (parallel with the other reviewers), NOT post-Phase-3 or Phase 4. The Harness Builder's domain-specific question is "Which L1–L5 phase does this work belong to? Which open 🔴/🟡 gaps in BOTSSON-SYSTEM-MAP.md does it depend on? Is this net-new (own phase identity) or extending an existing phase?"

**Promotion threshold:** This is the 1st explicit occurrence of "phase-classification axis missed by triple-reviewer." If the pattern repeats on a 2nd Botsson-surface council, promote from advisory note here to enforced rule in run-council SKILL.md Phase 3 Hard Rules section. Per Pontus directive on schema-locking ADRs (2026-05-16 chair self-reversal precedent), 1st occurrence can warrant promotion if blast radius is sufficiently high — and harness phase mis-classification is high-blast (wrong-phase sortie wastes 5+ wall-days). Recommendation: skip 3-occurrence threshold for this one; promote now.

**For run-council SKILL.md update:** the existing "MANDATORY when ANY of these is true" list for `botsson-harness-builder` inclusion already covers most paths above, but does NOT explicitly require the Harness Builder be assigned the **phase-classification question** in its briefing. Amend the Phase 2 BRIEF section's Harness Builder question template to:

> "Your key question: (a) Which L1–L5 phase does this work belong to? Is it net-new (own phase identity, e.g. Phase H1 / C4 HITL Primitives) or extending an existing phase? (b) Which open 🔴/🟡 gaps in BOTSSON-SYSTEM-MAP.md does this depend on? (c) Are any cross-cutting laws (workspace scope, gate_action, channel guard, telemetry IDs, no-service-role-to-L1, mobile boundary) violated?"

## References

- ADR-0398 — InlineConfirmCard Primitive (surfaced the gap).
- L-0147 family — single-axis reviewer insufficient (sibling pattern).
- L-NEW-4 sibling — Phase 3 coverage gap on design+a11y axis (mandate `frontend-designer` for `apps/web/src/components/**`).
- `docs/architecture/BOTSSON-SYSTEM-MAP.md` — the phase taxonomy under review.
- `.claude/skills/run-council/SKILL.md` — Phase 2 BRIEF + Phase 3 REVIEW ROUND inclusion rules.

---

> After writing: register in `docs/learnings/0000-learning-log.md`.
