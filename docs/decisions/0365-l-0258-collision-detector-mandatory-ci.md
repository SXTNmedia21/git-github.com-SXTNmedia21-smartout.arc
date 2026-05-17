---
title: "L-0258 collision detector mandatory in CI"
id: ADR-0365
status: proposed
layer: decision
created: 2026-05-17
updated: 2026-05-17
---

# ADR-0365: L-0258 collision detector mandatory in CI

> Renumbered 0347 → 0360 → 0365 per outsider-renumber convention. 0360 collided with `0360-preview-tier-without-persistent-branch-db.md` (development branch, accepted 2026-05-17) after second sync wave brought both into campaign/ui-shell tip. R2 council 2026-05-17 PM3 caught collision pre-HOP-A; renumbered to next free slot.

## Context and Problem Statement

L-0258 (2026-05-14) documented 9 confirmed tool-name collisions across `useRegisterTools(scope, ...)` bridges; ADR-0325 Phase 1 shipped grace mode (`console.error` only, last-mount-wins routing). M5 HMS council (2026-05-17) traced 3 LIVE collisions still present in `/dashboard/hms/*` bridges: `listOpenDeviations` (3-way), `getDriftStatus` (2-way), `getProtocolDetail` (2-way). Routing depends on mount order — user navigates `/dashboard/hms` then `/dashboard/hms/deviations` and the umbrella tool implementation is silently overwritten by the deviations-tab implementation. Same tool name returns different shapes; LLM tool selection becomes route-order-dependent. No CI gate catches new collisions.

## Decision Drivers

- ADR-0325 Phase 1 grace mode was explicit interim; Phase 2 dedupe + CI detector was always the second step.
- 3 live collisions today across HMS surface = M5 polish must close before adding more tool descriptions.
- Manual review missed them through 2 polish sorties (cost-polish, billing-polish) + 1 Polish-Wave QA.
- Phantom-contract amplifier risk (L-0257 sibling): polish refines tool descriptions promising consistent behavior the routing layer cannot deliver under collision.

## Considered Options

1. **Option A — Document and rely on review.** Continue grace mode. Trust per-sortie code review to catch collisions. *Rejected — already failed 3× across 6 weeks.*
2. **Option B — CI detector + ADR-0325 Phase 2 dedupe.** New script `scripts/check-tool-name-collisions.ts` greps all `useRegisterTools(scope, kit)` call sites, extracts `modelToolName` strings from each `kit`, fails on any duplicate across bridges. Run in `pnpm turbo lint` + pre-push hook. Resolution per collision: single-owner assignment (e.g. `listOpenDeviations` → `hms/deviations` only; remove duplicates from `hms` + `governance`).
3. **Option C — Namespace prefix convention.** Force every tool name to start with bridge-scope prefix (`hms_listOpenDeviations`, `governance_listOpenDeviations`). Eliminates collisions structurally but breaks every existing tool name; large refactor.

## Decision

**Option B.** Ship CI detector + ADR-0325 Phase 2 dedupe as sub-sortie `hms-collision-fix` (M5 Sortie 2 of 4). Single-owner assignment per collision. Detector blocks PRs that introduce new collisions. Defer Option C namespace prefix to follow-up ADR if collision rate persists post-detector.

## Consequences

**Positive:**
- CI blocks future collisions at PR time, before mount-order silent drift ships.
- 3 HMS collisions resolved with explicit ownership in commit history.
- L-0257 phantom-contract amplifier closed for HMS surface before M5 polish expands tool descriptions.

**Negative:**
- Sub-sortie burns ~3-4 commits + agent time before any polish.
- Single-owner assignment may force minor route navigation refactor in LLM prompts (some tools move scope).

**Risk mitigation:** Document semantic change per resolved collision in sortie HANDOFF (e.g. "`listOpenDeviations` now requires user to be on `/dashboard/hms/deviations` route; HMS umbrella users must navigate first").

## References

- L-0258 (2026-05-14): Tool-registry Object.assign collision — 9 confirmed
- L-0257 (2026-05-14): ADR-0238 phantom-contract accumulator
- L-0260 (2026-05-14): Polish-wave amplifies pre-existing debt
- ADR-0325 (2026-05-14): Page-tool authority semantics + grace mode
- Council 2026-05-17: M5 HMS cluster scoping verdict (Chair Self-Reversal, 7th L-0147 precedent)
