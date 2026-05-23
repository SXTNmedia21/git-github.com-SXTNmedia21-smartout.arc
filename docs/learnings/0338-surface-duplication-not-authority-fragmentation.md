---
id: L-0338
title: Surface duplication permitted when both views consume the same capability — fragmented authority is the forbidden pattern, not differentiated chrome
status: canonical
layer: learning
created: 2026-05-23
updated: 2026-05-23
module: day-session
council_refs: [council-2026-05-23-tidslinje-surface-boundary]
tags: [learnings, surface-boundary, adr-0156, cascade-integrity, council-protocol]
---

# L-0338 — Surface duplication ≠ authority fragmentation

## Context

Council 2026-05-23 reviewed whether to add a "Tidslinje" tab to `DayControlPanel` (schedule bottom-sheet, 3 mount sites) when `WebDayControl` (full-page route per ADR-0156) already mounted an equivalent `TimelineTab` (510 LOC).

Chair Phase 3 verdict was REJECT + RECOMMEND consolidate, reading ADR-0156 §"Rejected Option B" prose (*"two overlapping admin surfaces fragments authority"*) as forbidding any two admin day-control surfaces.

Three reviewers (Supervisor + Agent-coord + Harness) voted opposite with code-trace evidence:
- `EntityDrawerProvider` mounts globally at `DashboardShell.tsx:1138` — both panels inherit the same drawer + cascade pipeline
- `day-line` capability (4 tools) PASS Trust Gate identically from both panels
- The two surfaces serve legitimately distinct UX (route-anchored full-page vs ephemeral bottom-sheet for date-click drill-down)

Chair Phase 5 REVERSED on L-0147 protocol (10th precedent — see L-0341).

## Discovery

"Surface duplication" is the wrong concept frame. The actual forbidden pattern in ADR-0156 §"Rejected Option B" is **fragmented authority**: two surfaces with different rules writing to overlapping state via different capability paths or different `gate_action` semantics. Two views consuming the SAME capability with the SAME authority model is permitted — and is precisely what ADR-0156 Phase 2 packages-extraction anticipates.

**Discriminating test for surface duplication (codified, applies to all multi-surface decisions):**

1. Do both surfaces call the same capability tools? → YES = permitted differentiated chrome
2. Do both apply the same C4 authority governance to writes? → YES = permitted
3. Do they share the same data layer (provider / hook / context)? → YES = permitted
4. If ANY answer is NO → forbidden fragmentation; consolidate or carve out the divergent paths

Applied to the 2026-05-23 case: `DayControlPanel` and `WebDayControl` answer YES/YES/YES → permitted to coexist with same `day-line` capability, same `pinDayControlContextAction`-class context pin (gap G16 to close), same `DaySessionProvider` data layer.

## Impact

- ADR-0156 amended 2026-05-23 with this clarification + discriminating test.
- All future surface-boundary councils MUST apply the discriminating test before invoking ADR-0156 §"Rejected Option B" as a veto.
- Phase 3 council reviewers reading ADR prose for "two surfaces" language MUST verify by code-trace whether the two surfaces share capability + authority + data layer before recommending consolidation.
- Pattern signature for likely chair over-reading: ADR §"Rejected Option" prose generalized into a categorical ban without re-checking the original ADR's discriminating context. Sibling pattern to L-0297 (ADR-to-enforcement-code receipt rule — claims without code).

## References

- ADR-0156 amendment 2026-05-23 — `docs/decisions/0156-day-control-panel-canonical-admin-surface.md` §"Amendment — 2026-05-23"
- Council session 2026-05-23 — `docs/council/COUNCIL-LOG.md`
- L-0341 — L-0147 10th precedent (chair self-reversal, same council)
- L-0252 — Cross-cascade-role projection surfaces (related but distinct concept — that's about cascade-dimension blur, not capability sharing)
- Cascade-integrity-mandate §"Single canonical pipeline" — one pipeline, multiple views is the underlying principle

---

> Registered in `docs/learnings/0000-learning-log.md`.
