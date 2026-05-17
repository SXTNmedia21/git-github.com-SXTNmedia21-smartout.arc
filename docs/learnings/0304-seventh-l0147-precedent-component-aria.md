---
id: L-0304
title: "7th L-0147 component-level ARIA precedent — ProcedureDetailTabs defect reintroduced after HMS fixup"
status: accepted
date: 2026-05-17
related-adrs: [ADR-0357]
tags: [l-0147, chair-self-reversal, aria, wcag, component, council, run-council]
---

# L-0304 — 7th L-0147 Component-Level ARIA Precedent

## Context

Council R1 on `campaign/ui-shell` shippability (2026-05-17 PM3) found a mixed-ARIA defect in `ProcedureDetailTabs.tsx:98-117` — `role="tab"` + `aria-controls` on custom `<button>` elements without matching `role="tabpanel"` + `aria-labelledby` on the corresponding panels. WCAG 4.1.2 violation.

This defect is structurally identical to the defect caught in `HmsSubNav.tsx:34,45,46` during HMS R1 the same afternoon. The HMS R1 council identified the defect, HMS R2 + fixup sortie closed it. The ui-shell R1 council found the same defect class on a sibling component — `ProcedureDetailTabs.tsx` — which lives in the same cluster.

## Pattern

Sortie 4 (sub-sortie of campaign/ui-shell that built ProcedureDetailTabs) reintroduced the defect class AFTER HMS R1 fixup closed it on HmsSubNav. The two components share identical surface characteristics: visual tab strip with custom `<button>` elements as tab controls.

This is the 7th documented L-0147 precedent — a chair or Phase 3 triplet approves commits that contain a defect a subsequent reviewer catches via a specific domain axis.

**The recurring pattern here:** Phase 3 triplet (system-steward + supervisor + system-agent-coordinator) systematically misses component-level ARIA semantics. The axis fires only when a reviewer with explicit visual-surface + accessibility scope looks at class strings, role attributes, and keyboard-navigation primitives.

The visual-surface mandate was added to `run-council/SKILL.md:105-119` after the Tidslinjen R1 council found 3 WCAG defects in commits all three Phase 3 axes had approved. HMS R1 PM confirmed it with HmsSubNav. ui-shell R1 PM3 confirms it again — same defect class, sibling component, same session day.

## Why

The Phase 3 triplet optimizes for cascade-integrity, ADR compliance, telemetry routing, and TypeScript safety. These are different cognitive axes from "does `role='tab'` have a matching `role='tabpanel'` with correct `aria-labelledby`?" The latter requires explicit ARIA audit against WCAG 4.1.2 semantics — a task for a reviewer with that axis as their primary mandate.

## How to Apply

- When any Phase 3 council touches `apps/web/src/components/**` (not just dashboard pages), MUST dispatch `feature-dev:code-reviewer` or `frontend-designer` with an explicit ARIA audit mandate — not just a design-tokens check.
- The visual-surface mandate briefing template already covers `aria-*` in the last enumeration point. The gap is that this mandate is currently framed as "MANDATORY when any of these is true" with a list that includes `apps/web/src/components/**` — but Phase 3 triplet reviews can still miss ARIA if the component is reviewed as "logic" rather than "visual surface."
- Proposed Phase 3 amendment: when component files under `apps/web/src/components/` are in scope, dispatcher MUST attach an ARIA-audit rider to at least one reviewer's brief: "check every custom `<button role=...>` or interactive element for complete ARIA role/property/state contract per WCAG 4.1.2."

## Related

- L-0147 (chair self-reversal pattern — parent)
- L-0283 (6th L-0147 self-reversal precedent)
- L-0279 (chair Phase 3 internal inconsistency — sibling)
- `run-council/SKILL.md:105-119` (visual-surface reviewer mandate, added after Tidslinjen R1)
- HMS R1 HmsSubNav ARIA defect (same defect class, sibling component, same session)

## Action

Consider amending Phase 3 dispatch protocol in `run-council/SKILL.md` to explicitly require a code-reviewer/frontend-designer dispatched at Phase 3 (not only Phase 5) when components under `apps/web/src/components/**` are in the diff. Current wording gates visual-surface reviewer on Phase 3, but the briefing emphasis tends to go to the domain-logic reviewers first.
