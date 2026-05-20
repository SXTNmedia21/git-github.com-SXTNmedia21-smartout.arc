---
title: "Pre-Promote-Preview Council Protocol"
id: ADR_0323
status: proposed
layer: decision
created: 2026-05-14
updated: 2026-05-14
module: governance
tags: [council, promote-preview, pipeline, governance, adr-0265]
---

# ADR-0323: Pre-Promote-Preview Council Protocol

## Context and Problem Statement

ADR-0265 codified the enforced deployment pipeline (HOP A dev→preview, HOP B preview→main, 6+14 mechanical gates). Mechanical gates catch: sync state, CI green, Vercel READY, FF-ancestry, smoke probe, lkg-tag. They do NOT catch semantic risks: capability promises ahead of data pipeline, telemetry events without producers, ADR-corpus drift from code, harness bridges re-exposing pre-existing mutation gaps as agent-callable, Unicode in filenames, motion-token debt.

The 2026-05-14 promote round had 169 commits, 20 migrations, 17 new ADRs. Mechanical gates would have passed. A 5-reviewer council found:
- P1 (HIGH): notifications bridge re-exposed pre-existing `useMarkAsRead` emit gap as agent-callable
- P2: `/dashboard/my-day` missing from Botsson site-map
- P3: `BOTSSON-SYSTEM-MAP.md` stale 3 days, cap count 29 vs real 30

All 3 fixed before HOP A. 9 additional deferred items captured as Linear tickets SMA-362..370.

## Decision Drivers

- Mechanical gates (CI, Vercel, smoke) verify infrastructure state, not semantic contract integrity
- Batch promote rounds with ≥50 commits contain enough semantic surface area to hide P1-class issues
- Harness bridges create a new actor class (agent) that surfaces pre-existing hook compliance gaps
- ADR-corpus drift accumulates across parallel campaigns; a pre-promote council is the last gate before staging exposure

## Considered Options

1. **Option A** — No council; rely on mechanical gates + post-deploy observation
2. **Option B** — Mandatory council before every promote regardless of batch size
3. **Option C** — Trigger-threshold council (chosen): council required only when semantic-density threshold fires

## Decision Outcome

Chosen option: **Option C** — trigger-threshold council.

Before every `./infra/scripts/promote-preview.sh` HOP A run, dispatch a **Pre-Promote-Preview Council** when ANY of these triggers fires:

- ≥50 commits since last promote (semantic-density threshold)
- ≥3 new migrations in the batch
- ≥3 new accepted ADRs
- Any new harness bridge or capability ships
- Any cross-cutting law touched (workspace scope, gate_action, channel guard, telemetry, mobile boundary, voice guard)

The council uses the standard 5-reviewer parallel pattern: system-steward (chair), supervisor, system-agent-coordinator, botsson-harness-builder, frontend-designer.

Phases follow the `/run-council` skill:

- **Phase 1 INTAKE:** enumerate commits, migrations, ADRs, capability code, telemetry deltas (git/grep, NOT agent fact-check)
- **Phase 2 BRIEF:** key-question-per-reviewer template; code-tracer mandate assigned to agent-coord + harness-builder
- **Phase 2.5 FACT-CHECK:** skip if intake is direct git/grep; required if briefing claims sourced from prior synthesis
- **Phase 3 REVIEW:** parallel dispatch, 5 reviewers
- **Phase 4 NARRATOR:** skip if convergence is strong (orchestrator inline synthesis)
- **Phase 5 SYNTHESIS:** chair self-reversal protocol mandatory; per-tool trust gate for capabilities with ≥2 tools
- **Phase 6 VERDICT:** APPROVE | APPROVE WITH CHANGES | REJECT | DEGRADED-MODE
- **Phase 6.5 EXECUTION:** dispatch sub-agents for merge-blockers
- **Phase 7 HOP A:** run `./infra/scripts/promote-preview.sh`
- **Phase 8 CAPTURE:** ADR + learnings + COUNCIL-LOG (this artifact)

## Rules & Consequences

**Positive:**
- Semantic risks caught BEFORE preview (HOP A gates don't catch them)
- ADR-corpus drift surfaced + tracked as Linear debt
- Phantom-contract count tracked across promote rounds
- Chair self-reversal frequency tracked (L-0147 precedent count = governance health signal)

**Negative:**
- ~30-45 min overhead per promote (5 parallel reviewers + synthesis)
- Council fatigue risk on small promote rounds (mitigated by trigger thresholds — small batches skip council)

**Agent Impact:** Before running `./infra/scripts/promote-preview.sh`, orchestrator MUST evaluate all 5 trigger conditions. If any fires: dispatch council, collect verdict, fix merge-blockers, THEN run HOP A. Skip council only when ALL 5 conditions are false.

## Output shape

Verdict format MUST include:
- Numbered merge-blockers (P1, P2, ...) with file paths + owners + estimates
- Numbered deferred-tickets (D1, D2, ...) registered as Linear issues (council-required ones flagged)
- Resolved concerns table (orchestrator fact-checks)
- Agent Trust Gate per-capability table
- Phase 5 §1.5 Chair Self-Reversal entry (if applicable)
- Knowledge to Capture list (ADR + learnings to write in Phase 8)

---

## Cross-references

- ADR-0265 (enforced deployment pipeline)
- ADR-0213 (campaign merge ancestry)
- L-0147 (Chair Self-Reversal pattern, 6 codified precedents as of 2026-05-14)
- L-0253 (chair must grep before negative count claims — 6th L-0147 precedent, sourced from this council)
- L-0254 (harness bridges re-expose pre-existing emit gaps as agent-callable)
- L-0255 (ASCII-only filenames; `paragraf` not `§`)
- `/run-council` skill (Phase 1-9 protocol)
- `deploying` skill (HOP A runbook)
- SMA-362..370 (post-promote tickets from first council session)

> After writing: register in `docs/decisions/0000-decision-log.md`.
