---
id: L-0302
title: "4 chair self-reversals in single council — Phase 3 Steward systematic blind spots"
status: accepted
date: 2026-05-17
related-adrs: [ADR-0358, ADR-0349, ADR-0350]
tags: [l-0147, chair-self-reversal, run-council, phase-3, blind-spots, council-protocol]
---

# L-0302 — 4 Chair Self-Reversals in Single Council

## Context

The ui-shell shippability R1 council (2026-05-17 PM3) produced 4 chair self-reversals in a single session — a new per-session high for this codebase. The previous single-session high was 2 (HMS R1 PM 2026-05-17, Tidslinjen R1 2026-05-17 AM).

The 4 reversals in sequence:

1. **Telemetry-contract pipeline** — Steward Phase 3 reviewed the telemetry registry additions and returned "contract correctly registered." Agent-coord code-trace found 0 emit() call-sites for both new events. Hard blocker B2. REVERSED to REJECT.

2. **Cross-campaign merge ancestry** — Steward Phase 3 assessed the campaign tip as a ui-shell sortie stack. Phase 2.5 fact-check found `campaign/world-best-wfm` (31 unique commits) + `campaign/mobile` (23 unique commits) were merged into the campaign tip via merge commits — a tri-campaign aggregation not mentioned in the original brief. REVERSED to "governance question requiring user input before verdict."

3. **Component-level ARIA** — Steward Phase 3 approved `ProcedureDetailTabs.tsx` accessibility semantics as "conventional React tab pattern." Code-reviewer found `role="tab"` on custom `<button>` without matching `role="tabpanel"` + `aria-labelledby` — WCAG 4.1.2 violation identical to HmsSubNav defect from HMS R1 same afternoon. REVERSED to FAIL.

4. **ADR-to-enforcement-code receipt** — Steward Phase 3 noted ADR-0349 "accepted with ESLint rule `nordic-split/no-oklch-literal` promised." Agent-coord grep found 0 hits in `packages/eslint-config/` for `no-oklch-literal`. Steward Phase 3 had marked the ADR as "implementation wired." REVERSED to "toothless ADR — enforcement code absent."

## Pattern

All 4 reversals share a structural signature: Steward Phase 3 operated on **prose-level reasoning** (inspecting what the code or ADR claimed to do) while the reversal came from **artifact-level verification** (grepping for what actually exists in the codebase).

- Reversal 1: "contract registered" (prose) vs "0 emit call-sites" (grep)
- Reversal 2: "ui-shell sorties only" (prose assumption) vs "tri-campaign merge commits" (git log)
- Reversal 3: "conventional React tab pattern" (visual inspection) vs "ARIA role contract broken" (WCAG 4.1.2 check)
- Reversal 4: "ESLint rule promised in ADR" (ADR prose) vs "0 rule files" (grep)

This is a Phase 3 cognitive-mode gap, not a competence gap. Steward Phase 3 correctly handles cascade integrity, ADR semantic compliance, and ontology classification. It systematically misses:
- Call-site presence checks (emit, listeners, enforcement implementations)
- Git ancestry analysis beyond the immediate diff
- ARIA role/property/state contract semantics (WCAG 4.1.2)
- ADR-to-code implementation receipts

## Why

Phase 3 dispatch assigns 3-5 reviewers with overlapping domain scope (cascade, code conventions, AI contracts). The reviews are parallel but they share the same cognitive mode: "does this look right?" — not "does the implementation backing this claim actually exist?"

The artifact-level checks that caught all 4 reversals require:
1. `grep -r 'emit.*event_name' apps/` — not reading the registry
2. `git log --merges --oneline` — not reading the PR title
3. ARIA spec traversal — not reading JSX attribute names
4. `grep -r 'no-oklch-literal' packages/eslint-config/` — not reading the ADR

## How to Apply

These 4 reversal classes suggest 4 Phase 3 protocol amendments:

1. **Telemetry-contract check** — when `packages/telemetry/src/registry.ts` is in diff, MUST grep for emit() call-sites per new entry. (Now enforced via ADR-0358 + run-council SKILL.md amendment.)

2. **Merge-ancestry check** — for campaign tips, MUST run `git log --merges --oneline` to surface unexpected campaign aggregation. (Added to run-council SKILL.md Common Mistakes.)

3. **ARIA audit** — when `apps/web/src/components/**` is in scope, MUST include a reviewer with explicit ARIA role/property/state mandate. (See L-0301.)

4. **ADR-to-enforcement receipt** — when ADR text claims enforcement infrastructure, MUST grep for that infrastructure before marking ADR "wired." (Now enforced via run-council SKILL.md amendment.)

## Related

- L-0147 (chair self-reversal pattern — parent)
- L-0294 (7th L-0147 precedent — promote to SKILL.md hard rule, ui-shell sub-sortie)
- L-0301 (7th component-ARIA L-0147 precedent — sibling from same council)
- L-0303 (ADR-to-enforcement receipt rule — sibling from same council)
- ADR-0358 (telemetry registry requires emit wiring — derived from reversal 1)

## Action

Phase 9 candidate: 3 chair-protocol amendments to `run-council/SKILL.md` — all 3 derived from 4 reversals in this session. See T6 artifacts for the amendments.
