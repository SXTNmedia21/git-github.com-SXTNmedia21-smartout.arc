---
id: ADR_0351
title: getPhaseBoundaries — presentation-layer ontology, NOT cascade D6 truth
status: proposed
created: 2026-05-17
updated: 2026-05-17
deciders: [pontus, council-r1-tidslinjen]
related: [ADR-0156, ADR-0335, ADR-0349]
tags: [cascade, ontology, dagslinjen, presentation, invariants]
---

# ADR-0351 — `getPhaseBoundaries` is presentation-layer ontology, not cascade D6 truth

## Status

**proposed** — drafted 2026-05-17 from Council R1 Tidslinjen Steward review. Low urgency; documentation + naming fix only. (Slot 0349-0350 occupied by concurrent same-day work — see ADR-0349 status note.)

## Context

Council R1 Steward (2026-05-17) flagged an ontology ambiguity in the Tidslinjen redesign sortie:

**Symbol:** `getPhaseBoundaries(session: { plannedOpen, plannedClose }) => { prep, service, windDown } | null`
**File:** `packages/utils/src/cascade/derive-phase.ts:84-117`
**Sibling:** `derivePhase(session, reconciliation) => "upcoming" | "active" | "pending_signoff" | "closed" | "missed" | "locked"` — the canonical ADR-0156 / L-0064 cascade D6 phase helper.

The two functions share:
- A file (`derive-phase.ts`)
- A package folder (`packages/utils/src/cascade/`)
- A naming prefix (`derive*` / `getPhase*`)

But their roles are **opposite**:

| Function | Role | Persistence | Authority |
|---|---|---|---|
| `derivePhase` | D6 cascade phase per ADR-0156 | Consumed by capabilities, mutations, telemetry routing | Authoritative — drives gate_action, channel routing |
| `getPhaseBoundaries` | UI tint band ranges per Tidslinjen redesign | Pure function, never persisted | Presentation only — drives band-render math |

The `PREP_WIN_MIN = 30` constant inside `getPhaseBoundaries` (line 101) carves intra-session windows for UX purposes. Cascade invariant #6 (`docs/superpowers/specs/2026-03-21-cascade-scheduling-system-design.md`) forbids hardcoded business rules:

> Rates, rules, and constraints must be declarative (D3 framework_rule, D5 workspace config), not hardcoded in code.

Today this constant is borderline-acceptable because it drives **tint rendering only** — no business logic, no Event Engine input, no telemetry routing depends on it. The risk: a future contributor sees `cascade/derive-phase.ts` and assumes `getPhaseBoundaries` is canonical, then binds business logic (e.g. "trainee check-ins must happen during prep") to the 30-min window. That would silently violate invariant #6.

This is a class of mistake the codebase has seen before — same root as L-0177 (file location implies role).

## Decision

**Document `getPhaseBoundaries` as presentation-layer ontology and explicitly disallow business-logic binding.**

1. **Header comment** in `packages/utils/src/cascade/derive-phase.ts` above `getPhaseBoundaries` declaration:

   ```ts
   /**
    * PRESENTATION-LAYER DERIVATION.
    *
    * Computes intra-session tint band ranges for the Dagslinjen Tidslinjen UI.
    * NOT authoritative for business logic. NOT persisted. NOT consumed by
    * capabilities, Event Engine, gate_action, or telemetry routing.
    *
    * `PREP_WIN_MIN = 30` is a UX-only visual cue. If any business rule ever
    * needs a real "prep window" (e.g. trainee restrictions, deviation
    * severity weighting), it MUST be promoted to either:
    *   - D5 workspace config (workspace-specific tunable), OR
    *   - D3 framework_rule (regulatory/policy authority)
    * Do NOT bind business logic to this function. See ADR-0351 + cascade
    * invariant #6.
    *
    * Sibling: `derivePhase()` IS the canonical ADR-0156 cascade D6 helper.
    */
   ```

2. **No file relocation.** Moving to `apps/web/src/components/day/` would split a clearly cascade-themed file family. Document instead.

3. **No symbol rename.** `getPhaseBoundaries` is descriptive; renaming costs more than it clarifies.

4. **Track promotion criteria:** if any later sortie proposes binding business logic to these boundaries, the proposer must (a) draft a follow-up ADR amending invariant #6 OR (b) promote the constant to D5/D3 per the comment above.

## Consequences

**Positive:**
- Future contributors reading `derive-phase.ts` see the boundary explicitly drawn.
- Closes a class of L-0177-style ontology-blur risk without code churn.
- Preserves the current useful colocation (both phase-related helpers in one file family).

**Negative:**
- Header comment is the only enforcement; no compile-time / lint-time safety.
- A determined contributor can still bind business logic to this function in defiance of the comment.

**Mitigation:** if such a binding ever appears in a PR, code reviewers (or `code-reviewer` agent) flag it citing ADR-0351. Repeat occurrences escalate to an enforced lint rule.

## Alternatives Considered

1. **Move `getPhaseBoundaries` to `apps/web/src/components/day/hooks/`.** Rejected — splits the phase-helper family across packages, loses the natural pairing with `derivePhase`.
2. **Rename to `getTimelineTintBands`.** Rejected — clear but verbose; the existing name reads fine once the documentation is in place.
3. **Add an ESLint rule that flags any import of `getPhaseBoundaries` from outside `apps/web/src/components/day/`.** Rejected as overkill; documentation + reviewer discipline is sufficient for a single tint-helper.
4. **Promote `PREP_WIN_MIN` to D5 workspace config immediately.** Rejected — premature; no business need today, and adding a config knob for a UX tint window over-engineers the cascade D5 surface.

## Implementation

A single-line edit to `packages/utils/src/cascade/derive-phase.ts` adds the documentation block. No code change required. Touches no consumers. Can ship as part of any maintenance commit; doesn't block the Tidslinjen a11y polish sub-sortie.

## References

- Council R1 verdict, 2026-05-17 — `docs/council/COUNCIL-LOG.md`
- ADR-0156 — canonical `derivePhase` D6 helper (sibling)
- ADR-0349 — Nordic Split OKLCH literal ban (same R1 council)
- `learning_phase3_coverage_gap_design_axis.md` — adjacent ontology learning
- Cascade spec invariant #6 — `docs/superpowers/specs/2026-03-21-cascade-scheduling-system-design.md`
- `packages/utils/src/cascade/derive-phase.ts:84-117` — target symbol
