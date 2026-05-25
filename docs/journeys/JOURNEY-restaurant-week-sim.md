---
title: "Journey — Restaurant Week Simulation"
status: done
created: 2026-05-25
updated: 2026-05-25
module: meta
tags: [journey, simulation, gap-analysis, audit]
---

# Journey — Restaurant Week Simulation

> Three-phase autonomous gap/bug sweep simulating real-world Smartout usage across
> escalating hospitality scenarios. NOT a code-shipping feature — this is an **audit
> deliverable** that produces strategic surface area visibility for the next 4-12 weeks.

## Journey: Audit-Producer (Claude) authors a multi-phase sim

**Precondition:**
- `docs/test-runs/2026-05-23-journey-sweep/BUGS.md` exists with 22 mechanical-sweep bugs as baseline
- Smartout codebase on `development` with active campaigns + recent wt-6/wt-7 merges
- 11 council-persona prompts ready (5 bistro + 3 hotel + 3 festival agents)

1. Audit-producer invokes `/start-feature restaurant-week-sim` →
   System creates worktree `~/dev/smartout.ai-wt-1` on `feat/restaurant-week-sim` branch from `development` →
   Audit-producer sees: clean worktree + auto-generated plan stub
2. Audit-producer authors three plan documents (SIMULATION-PLAN.md, HOTEL-WEDDING-PLAN.md, CONCERT-FESTIVAL-PLAN.md) →
   System: plan files committed to feature branch →
   Audit-producer sees: 3 scenario files + INDEX.md + findings/ scaffold
3. Audit-producer dispatches 11 sonnet sim-agents in parallel via `Agent` tool with industry-intel personas →
   System: 11 background subagents trace code paths for assigned journey slices →
   Audit-producer sees: completion notifications stream in, ~93 NEW findings written to findings/ dir
4. Audit-producer dispatches opus synthesizer →
   System: reads 11 finding files (~2700 lines) + 22-bug baseline, writes BUGS.md + GAPS.md + SYNTHESIS.md →
   Audit-producer sees: 28 NEW bugs + 47 NEW gaps + cross-cutting pattern verdict
5. Audit-producer writes JOURNEY-restaurant-week-sim.md + HANDOFF-restaurant-week-sim.md →
   System: docs staged + committed →
   Audit-producer sees: closure-ready feature with all gates green
6. Audit-producer triggers close-feature script (or user does) →
   System: merges `feat/restaurant-week-sim` → `development` via FF, removes worktree, writes activity-log →
   Audit-producer sees: merge SHA + cleanup confirmation
7. Audit-producer suggests `/promote-preview` for next Pontus session →
   User Pontus sees: preview branch advances when ready (only Pontus runs this per CLAUDE.md)

**Postcondition:**
- `docs/test-runs/2026-05-25-restaurant-week-sim/` lives on `development` with:
  - INDEX.md, 3 phase plans, 11 finding files
  - BUGS.md (28 NEW + dedup-reference to 22 baseline)
  - GAPS.md (47 NEW gaps categorized by sector)
  - SYNTHESIS.md (10 cross-cutting patterns, strategic roadmap)
- Worktree `~/dev/smartout.ai-wt-1` removed
- Activity-log entry on second-brain-v2
- Next sortie owners can pick from a prioritized fast-wins table

**Error paths:**

E1. Sim agent runs out of context mid-trace
- System: agent crashes/returns partial result
- Recovery: audit-producer re-dispatches with smaller slice OR proceeds with partial findings (synthesizer dedups)

E2. Findings file cites non-existent file:line
- System: orphan reference in synthesis
- Recovery: synthesizer verifies cites by spot-checking; flags unverifiable as "claim only"

E3. Synthesizer over-aggregates (loses agent-specific signal)
- System: final sheets miss nuance from individual agents
- Recovery: audit-producer keeps raw findings/ dir in repo for downstream readers

E4. close-feature typecheck OOMs on WSL2 (MEMORY: L-WSL2-OOM)
- System: SIGTERM 143 during `pnpm turbo typecheck`
- Recovery: use `TURBO_CONCURRENCY=1`; this feature is docs-only so typecheck SHOULD be no-op cache hit

E5. Subsequent agents miss-claim the sim was a code feature (it isn't)
- System: future sortie owners read sim findings as authoritative
- Recovery: SYNTHESIS.md is **audit output** not architectural decision. Each strategic recommendation needs its own ADR before implementation.

## Journey: Strategic reader uses the output

**Precondition:** Sim merged. Reader is in next session looking for sortie material.

1. Reader opens `docs/test-runs/2026-05-25-restaurant-week-sim/SYNTHESIS.md` →
   Sees: executive summary + 10 cross-cutting patterns + 2x2 priority matrix
2. Reader picks high-impact/low-effort quadrant entry →
   Sees: specific GAP-SIM-NN with fix scope sized (minor / sortie / campaign / ADR-grade)
3. Reader cross-references the gap to BUGS.md if mechanical bug exists →
   Sees: file:line, evidence, fix sketch
4. Reader drafts an ADR or sortie plan referencing GAP-SIM-NN as the source signal →
   System: new ADR in `docs/decisions/`, new plan in `docs/superpowers/plans/`
5. Reader assigns the sortie via `/start-feature` →
   Standard sortie lifecycle continues

**Postcondition:** Sortie owner has clear scope, named gap, source citation, fix-scope estimate.

**Error paths:**

E1. Reader treats sim finding as authoritative without verifying current state
- Recovery: sim was 2026-05-25. Any finding older than 30 days needs re-verification before sortie kickoff.

E2. Reader cherry-picks individual gap without reading SYNTHESIS cross-cutting patterns
- System: misses the root cause that unifies 5+ gaps
- Recovery: SYNTHESIS Pattern 1-10 is mandatory reading before scoping any sim-derived sortie.

## Scope (what this journey covers)

- Producing the audit deliverable
- Reading + using the audit deliverable

## Out of scope (what this journey does NOT cover)

- Implementing any of the 28 NEW bugs (each is its own sortie)
- Implementing any of the 47 NEW gaps (each is ADR-grade or sortie-grade — separate plans)
- Promoting findings to ADR status (ADR authoring is separate)
- Closing the 22-baseline BUGS.md (other in-flight hotfix sorties own those)
