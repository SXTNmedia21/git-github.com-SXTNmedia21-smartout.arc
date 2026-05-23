---
id: L-0341
title: L-0147 chair self-reversal — 10th precedent — reading-vs-tracing asymmetry is institutional, not personal
status: canonical
layer: learning
created: 2026-05-23
updated: 2026-05-23
module: governance
council_refs: [council-2026-05-23-tidslinje-surface-boundary]
tags: [learnings, council-protocol, chair-reversal, l-0147, phase5-synthesis]
---

# L-0341 — L-0147 10th precedent (chair self-reversal)

## Context

Council 2026-05-23 (Tidslinje surface boundary in Kontrollsenter / DayControlPanel).

Chair Phase 3 verdict: **REJECT** option (a) port + **RECOMMEND** option (b) consolidate (sunset DayControlPanel). Cited ADR-0156 §"Rejected Option B" prose (*"two overlapping admin surfaces fragments authority"*) as forbidding any two admin day-control surfaces.

Three reviewers voted opposite with file:line code-trace evidence:
- **Supervisor:** `EntityDrawerProvider` mounts globally at `DashboardShell.tsx:1138` — both panels inherit drawer + cascade pipeline; ADR-0156 Phase 2 packages-extraction INTENT is multi-consumer reuse.
- **Agent-coord:** `day-line` capability 4/4 tools PASS Trust Gate identically from both panels; single pipeline preserved.
- **Harness:** Two panels serve legitimately distinct UX (route-anchored full-page vs ephemeral bottom-sheet for date-click drill-down); consolidate is right long-term but larger scope, not this sortie.

Frontend-designer added orthogonal concern (spatial fit + a11y debt — L-0339).

Phase 5 synthesis applied L-0147 protocol. Chair classified:
- Phase 3 claim 1 ("DayControlPanel + WebDayControl is §Rejected Option B violation") → **REVERSED**, falsifying evidence `DashboardShell.tsx:1138` + day-line capability Trust Gate
- Phase 3 claim 2 ("Recommended path: Consolidate") → **REVERSED**, falsifying evidence Frontend spatial budget + Harness distinct-UX argument
- Phase 3 claim 3 ("Required: new ADR before any code change") → **REFINED** to "ADR-0156 amendment when wrapper lands" (not gate-before-code)

## Discovery

This is the 10th L-0147 precedent. Counting was contested between authors at L-0261 ("8th" — sub-axis counting) and L-0289 ("6th" — whole-verdict counting); per L-0294 standardization this council uses whole-verdict count = 10.

Precedent list (whole-verdict count, post-L-0294):

| # | Date | Council | Reversal subject |
|---|------|---------|------------------|
| 1 | 2026-04-20 | Year Wheel Redesign | Trust Gate Phase 3 PASS → Phase 5 FAIL |
| 2 | 2026-04-28 | /dashboard/help | Phase 3 REJECT → Phase 5 APPROVE-as-tier |
| 3 | 2026-04-28 | ADR-0216 | Phase 3 Option A2 → Phase 5 Option B |
| 4 | 2026-05-09 | S6 R4 | Chair Phase 3 → Phase 5 reversal on capability scope |
| 5 | 2026-05-14 | WFM merge council | L-0261 sub-axis |
| 6 | 2026-05-16 | Chat-WhatsApp | Phase 3 → Phase 5 hold-with-refinement |
| 7 | 2026-05-17 | Phase 7d original pivot | L-0289 ADR-0250 misread + source-priority reversal |
| 8 | 2026-05-17 | Phase 7d-followup | Gap 4 + Gap 5 reversed (ADR-0353 §A + ADR-0351 Option C) |
| 9 | 2026-05-17 | ui-shell R1 PM3 | ADR-0361 ESLint-rule-absent reversal (L-0297) |
| 10 | 2026-05-23 | Tidslinje surface boundary (this) | §Rejected Option B over-reading reversal |

**Pattern signature (10x confirmed):** Chair operates on **prose-level reasoning** — reads ADR text, reasons by precedent, generalizes. Two or more reviewers with **code-trace evidence** (file:line citations of actual mounts, capability calls, schema state) vote opposite. Chair must reverse explicitly with canonical format.

**Reading-vs-tracing asymmetry is institutional.** It is not chair-skill failure or chair-bias. It is the necessary trade-off of the chair role: chair must reason at architectural scale (multiple ADRs, cross-domain effects, historical context) which is impossible to combine with file:line precision in a Phase 3 timeframe. Code-tracers complement chair by definition.

## Impact

- L-0147 protocol counter now reads **10/N** in run-council SKILL.md Phase 5 §1.5 precedent table (was 9/N).
- Pattern entrenchment: at 10 precedents, the L-0147 protocol is unambiguously load-bearing for council quality. Removing it would regress to chair-only verdicts that miss code-tracer evidence ~30% of the time (rough estimate from precedent rate over 8 weeks of councils).
- **Promoted standing reminder (proposed for SKILL.md):** *"Chair Phase 3 verdicts are HYPOTHESES based on prose reasoning. They are validated or falsified in Phase 5 by code-tracer + design-axis evidence. A chair who has not been reversed in 5+ consecutive councils is likely under-reasoning — verify that code-tracers actually executed file:line evidence rather than rubber-stamping the chair."*
- Sibling pattern to L-0339 (spatial budget axis) + L-NEW design+a11y axis — both surfaced THIS council. Frontend-designer added BOTH the design-axis concern AND the spatial-fit reversal evidence. Single reviewer carrying 2 axis-asymmetries strengthens the case for mandatory frontend inclusion when UI is touched (L-0339 §Impact).

## References

- Run-council SKILL.md Phase 5 §1.5 — L-0147 protocol enforcement block
- L-0147 origin learning
- L-0261 — 8th precedent (sub-axis counting)
- L-0289 — 6th precedent (whole-verdict counting alternative count)
- L-0294 — counting standardization
- L-0297 — ADR-to-enforcement-code receipt rule (9th precedent)
- L-0339 — spatial budget axis (same 2026-05-23 council, sibling discovery)
- L-0338 — surface duplication ≠ authority fragmentation (same 2026-05-23 council, output of reversal)
- Council session 2026-05-23 — `docs/council/COUNCIL-LOG.md`

---

> Registered in `docs/learnings/0000-learning-log.md`.
