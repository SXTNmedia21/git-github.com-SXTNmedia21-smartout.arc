---
id: ADR_0357
title: "ADR-0357 — Page-Polish 8-Phase Rule: Documented Intentional Skips"
status: proposed
updated: 2026-05-17
created: 2026-05-17
module: governance
tags: [adr, council-infrastructure, page-polish, l-0287]
---

# ADR-0357 — Page-Polish 8-Phase Rule: Documented Intentional Skips

> Status: PROPOSED — pending Pontus approval. Codifies the carve-out paragraph added 2026-05-17 in `~/.claude/skills/run-council/SKILL.md:121-133` after Council R1 on `hms-cluster-polish-read` revealed that strict mechanical Phase 0 application can force phantom tool registration — the exact failure mode L-0287 protects against.

## Context

The page-polish 8-phase audit (`.claude/skills/smartout-page-polish/SKILL.md`) is mandatory in any council touching `apps/web/src/app/dashboard/**/page.tsx|layout.tsx|loading.tsx`. Phase 0 (pre-polish capability check) is its hard gate: missing capability/gate_action/telemetry-registry prerequisites → audit returns BLOCKED → council verdict cannot be APPROVE.

The rule was added 2026-05-17 (run-council SKILL.md edit) after the Tidslinjen R1 council found Phase 3 systematically misses production-readiness defects.

In the SAME afternoon, Council R1 on `hms-cluster-polish-read` exposed an interpretation conflict:

- **Supervisor (page-polish mandatory):** `/dashboard/hms/training` has no `_tools/` directory, no `useRegisterTools` call, no site-map entry. Phase 0 BLOCKED → verdict REJECT.
- **Agent-coord (code-trace):** `training/page.tsx` is a 6-line conditional render delegating to `CompetenceMatrix` + `ProtocolList`. The page has no page-level state. The umbrella bridge (`hms-tools-bridge.tsx`) already covers cross-tab navigation via `switchHmsTab("training")`. Predecessor HANDOFF Decision #3 explicitly documents the skip: "No new Botsson bridge tools (L-0287 phantom-contract avoidance per council)."

Both readings are evidence-based. The strict mechanical reading would force phantom tool registration — the exact failure L-0287 (phantom-contract avoidance) protects against. The chair Phase 5 synthesis resolved the conflict by introducing a carve-out paragraph in run-council SKILL.md.

This ADR codifies the carve-out at ADR-grade for visibility outside the run-council skill and for cross-reference by future page-polish audits.

## Decision

The page-polish 8-phase rule operates with a structured carve-out:

### Skippable (with documented cascade rationale in HANDOFF)

- **Tool bridge registration** for thin-shell delegating pages. A "thin-shell delegating page" is a page-file (1–N lines) whose entire body is a conditional render of child components, with no page-level state, no page-level mutations, and no page-specific actions. The bridge can be skipped IF the HANDOFF cites a cascade reason — canonical reason: **L-0287 phantom-contract avoidance** (registering tools without state to back them creates phantoms that drift, mislead, and break Botsson agents downstream).

### NEVER skippable (regardless of HANDOFF rationale)

These three obligations apply to every dashboard route:

1. **Site-map entry** in `apps/web/.botsson/site-map.json`. The Botsson route registry is universal. Every dashboard route belongs there. Empty `tools: []` is acceptable; missing entry is not. Without an entry, Botsson cannot answer "what is at this route?" and route-tier reasoning breaks.

2. **Page header + description**. Botsson must be able to answer "what is this page?" from the rendered DOM (or the page's metadata file if separate). Thin-shell pages can use a sub-component's header IF that header is universally rendered and Botsson-readable.

3. **Telemetry view event `emit()` call-site** when the telemetry registry has a corresponding entry. No phantom-contract registry entries. Either the event fires when its surface is viewed, or its registry entry does not exist (revert the registry add + remove HANDOFF claims).

### Classification

When evaluating a Phase 0 FAIL during a council:

- **STRICT-FAIL**: No HANDOFF rationale exists; verdict tends to REJECT or APPROVE WITH CHANGES with mandatory fix gate.
- **DOCUMENTED-SKIP**: HANDOFF cites cascade reason (L-0287 phantom-contract avoidance, or equivalent). DOCUMENTED-SKIP applies ONLY to tool bridges; the three NEVER-skippable items override.

## Consequences

### Positive

- Strict-rule-vs-cascade-intent conflict resolved canonically. No more false BLOCKED verdicts on thin-shell delegating pages.
- L-0287 (phantom-contract avoidance) is now load-bearing in page-polish audits — rule explicitly accommodates it.
- Three universal obligations are crisply named. Future councils can verify each independently.

### Negative

- Carve-out introduces interpretation surface ("is this page really a thin-shell?"). Mitigated by the structured definition (1-N line body, no page-level state, etc.).
- HANDOFF Decision-section now has more weight; reviewers must read it during Phase 1 INTAKE briefing prep.

### Risks

- Future page-polish topic where "no state" claim is wrong: the HANDOFF says L-0287, but the page actually does have stateful behavior. Mitigation: code-trace reviewer (`system-agent-coordinator` or domain reviewer) verifies the no-state claim during Phase 3.

## Implementation

### Status

- **Code:** N/A (process ADR, not implementation).
- **Skill update:** `~/.claude/skills/run-council/SKILL.md` Phase 0 carve-out paragraph added 2026-05-17 inside the page-polish audit mandatory rule block.
- **Verification:** Future councils on dashboard pages with thin-shell sub-routes (training, deviations, etc.) will exercise the carve-out. Pattern: chair Phase 5 synthesis MUST classify each Phase 0 FAIL as STRICT-FAIL or DOCUMENTED-SKIP per the rule.

### Related

- **L-0287** — phantom-contract avoidance (the root principle this ADR preserves).
- **ADR-0349** (proposed) — Nordic Split OKLCH literal ban + ESLint rule (sibling ADR from same R1 sortie cluster).
- **ADR-0351** (proposed) — `getPhaseBoundaries` presentation-layer ontology (sibling ADR from same R1 sortie cluster).
- **Run-council `learning_phase3_coverage_gap_design_axis.md`** (memory) — 2nd occurrence promotes design+a11y axis mandatory; this ADR is the page-polish-axis equivalent.

### Out of scope

- ADR does not redefine what counts as a "thin-shell delegating page." The current heuristic (1–N line body, no page-level state) is operationally sufficient. If future councils find ambiguous cases, that's an addendum opportunity.
- ADR does not codify ALL of page-polish; it only carves out Phase 0. Phases 1-8 stand as-is.

## Author

System Council R1 verdict on hms-cluster-polish-read 2026-05-17 (Phase 5 chair synthesis). Drafted by Pontus + Claude Opus 4.7 (sub-sortie hms-cluster-polish-fixup).
