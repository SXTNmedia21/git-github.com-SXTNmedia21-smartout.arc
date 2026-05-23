---
id: L-0339
title: Spatial budget — bottom-sheet / modal / drawer content size — is a Phase 3 council coverage axis distinct from a11y + design tokens
status: canonical
layer: learning
created: 2026-05-23
updated: 2026-05-23
module: governance
council_refs: [council-2026-05-23-tidslinje-surface-boundary]
tags: [learnings, council-protocol, phase3-coverage, frontend-designer, spatial-fit]
---

# L-0339 — Spatial budget as a Phase 3 council coverage axis

## Context

Council 2026-05-23 (Tidslinje surface boundary). Phase 3 dispatched 5 reviewers including 3 code-tracers (Steward, Supervisor, Agent-coord) + Harness + Frontend-designer.

Three code-tracers + Harness converged on "port full `TimelineTab` (510 LOC) into `DayControlPanel` bottom-sheet via thin wrapper" being mechanically buildable + capability-compliant. None of them flagged that the full `TimelineTab` stack (DayTimelineStrip ~180px + DayLineStrip ~60px/location + AggregatedDayLineList + DayEventList + SlotPicker) would exceed the bottom-sheet's available content area.

Frontend-designer caught it: panel = `h-[75vh]` = ~810px on 1080p display. Minus header (~56px) + tab bar (~44px) + broadcast footer (~56px) = ~654px available for tab content. Full `TimelineTab` stack on a day with >8 events exceeds 654px, AND creates scroll-conflict (nested `overflow-y-auto` between panel wrapper and `DayEventList`).

Result: Frontend recommended `(b′)` — slim purpose-built TidslinjeTab. Council Phase 5 adopted this over `(a)` port-wrapper because spatial fit was decisive evidence the other 4 reviewers missed.

## Discovery

**Spatial budget is a distinct council coverage axis from cascade integrity, ADR coherence, telemetry routing, gate_action compliance, design tokens, and a11y semantics.** None of those axes detect "content height exceeds container height" or "nested overflow-scroll conflict."

The other 4 reviewers (Steward, Supervisor, Agent-coord, Harness) reason in **code/contract semantics** — they verify what the code does, not what the rendered DOM looks like at runtime. They do not measure pixels, content heights, viewport budgets, or scroll-container nesting.

Frontend-designer is the only seat that naturally measures spatial constraints because their reasoning frame includes **rendered surface fit**. This is the same axis-asymmetry pattern as:
- L-0147 / L-0289 / L-0294 — chair generalizes from doc prose, code-tracers falsify by file:line
- L-NEW-3 (existing, design+a11y coverage gap) — 3 axes APPROVE, frontend catches WCAG defects in className strings

## Impact

**New mandatory inclusion rule for council briefings (proposed for SKILL.md Phase 1 INTAKE):**

Frontend-designer (or `feature-dev:code-reviewer` as fallback when files > ~6) MUST be included when the topic touches:
- `*Panel.tsx`, `*Sheet.tsx`, `*Drawer.tsx`, `*Modal.tsx`, `*Dialog.tsx`
- Any surface with fixed-viewport height (`h-[Xvh]`, `max-h-*`, `h-screen`)
- Any nested-scroll context (`overflow-y-auto` inside another `overflow-y-auto`)
- Any "port from full-page to constrained-surface" or "port from constrained-surface to full-page" decision

Frontend briefing template addition: *"Audit `<file paths>` for spatial fit against `<container height>`. Compute available content area (subtract header + tab-bar + footer + any sticky regions). Identify any sub-component that exceeds budget or creates nested-scroll conflict. Recommend slim variant vs full-port vs container resize."*

**3rd-occurrence promotion track:**
- L-0147 design+a11y axis gap (2026-05-17 Tidslinjen R1 + HMS R1)
- L-0339 spatial budget axis gap (2026-05-23 Tidslinje surface boundary)

If a 3rd Frontend-designer-saves-the-council occurrence on a NEW axis lands, promote a generalized rule: *"When council touches user-facing UI, frontend-designer presence is mandatory regardless of other reviewer count — UI has axes that code-trace seats systemically miss."*

## References

- Council session 2026-05-23 — `docs/council/COUNCIL-LOG.md`
- L-0147 — Chair self-reversal precedent family (Phase 3 coverage gaps generally)
- L-NEW design+a11y axis (Tidslinjen R1 + HMS R1 2026-05-17) — sibling axis-asymmetry pattern
- L-0341 — L-0147 10th precedent (same 2026-05-23 council)
- Run-council SKILL.md Phase 1 INTAKE — needs frontend-inclusion rule extension

---

> Registered in `docs/learnings/0000-learning-log.md`.
