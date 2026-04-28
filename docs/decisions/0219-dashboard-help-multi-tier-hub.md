---
title: "/dashboard/help as Multi-Tier Hub, Not Helpdesk Page"
id: ADR_0219
status: proposed
layer: decision
created: 2026-04-28
updated: 2026-04-28
---

# ADR-0219: `/dashboard/help` as Multi-Tier Hub, Not Helpdesk Page

## Context and Problem Statement

`/dashboard/help` is greenfield — only `loading.tsx` exists. The brainstorming strawman (12 Q&A) framed it as a unified surface owning AI chat + KB + helpdesk + emergency self-serve + tours. The Phase 3 chair (steward) initially rejected this on cascade-integrity grounds: the page conflated three distinct concerns (governance content / engine_state runtime / AI agent surface). The Phase 5 chair (same steward) reversed partially after frontend-designer's panic-first layout proved the three concerns can coexist as ordered tiers, with helpdesk as one Tier among five rather than as the page's primary identity.

This ADR codifies the result so future councils and developers do not re-litigate the layout question.

## Decision Drivers

- ADR-0165 progressive `helpdesk_enabled` flag means every channel can become a helpdesk. The "central helpdesk page" concept the strawman implied contradicts this design.
- Komm UI is the canonical helpdesk thread surface. Duplicating it on /help would create two surfaces owning the same lifecycle.
- Pontus's intent ("ingen skal besøke uten å føle 100% trygghet og support") spans three cognitive states: panic, hunt, explore. A single-purpose page serves only one.
- WCAG 2.2 *Consistent Help* requires same-place-every-time for emergency exits — argues for a panic bar that is part of the page, not a separate surface.
- Procedure Engine Principle: compliance as byproduct of competence, not logged documentation. /help should NOT regress toward dead-document content.

## Considered Options

1. **Strawman as written** — Botsson as orchestrator + auto-generated articles + helpdesk front door + critical-action shortcuts, all unified under one URL.
2. **Two-surface separation** — /help owns governance content viewer only; Komm owns helpdesk; Settings owns critical actions. /help links to the others.
3. **Multi-tier hub** — single URL with five ordered tiers (Panic Bar / Botsson chat / Quick paths / KB / Footer-kontakt). Each tier has narrow ownership; helpdesk creation lives in Tier 0 + Tier 5.

## Decision Outcome

Chosen option: **Multi-tier hub (Option 3)**, because:

- Tier 0 Panic Bar gives panicked users one-tap exits without scrolling — solves WCAG *Consistent Help* and the "100% trygghet" intent simultaneously.
- Tier 1 Botsson chat hero (Runtime A only) gives explorers a conversational entry without forcing routing through Botsson for hunters.
- Tier 2 quick-path cards let hunters skip Botsson entirely.
- Tier 3 hand-curated KB articles ground v1 in honest content (no auto-gen phantom contracts).
- Tier 5 Kontakt footer is the third escalation path (svartider per kanal + status badge), reinforcing trust through transparency.

Helpdesk creation is **a Tier-level affordance, not the page identity.** Komm remains the canonical helpdesk surface for thread continuation, assignment, SLA tracking, and resolution.

## Rules & Consequences

- **Good, because** every cognitive state (panic / hunt / explore) gets a tier-aligned answer.
- **Good, because** ADR-0165's progressive helpdesk model is preserved — /help routes to existing helpdesks, does not become one.
- **Good, because** v1 ships in 3 weeks with no phantom contracts (G1–G4 merge-blockers documented in spec).
- **Bad, because** users may form a mental model of "/help = the helpdesk" if Tier 0 panic bar is not designed restrained — easy to drift back into strawman territory.
- **Bad, because** the layout has six rendered sections — clutter risk if Nordic Split motion budget (max 3 simultaneous pulses) is not enforced.
- **Agent Impact:**
  - Future councils MUST treat /help layout as solved per this ADR. Re-litigation requires evidence that all five tiers fail a measurable user-state.
  - Any new "let's add X to /help" proposal MUST identify which tier it joins. Cross-tier features (e.g. RAG content driving panic-bar choices) require sub-spec.
  - Helpdesk thread continuation stays in Komm. /help can deep-link to a Komm thread but never renders thread UI inline (until v1.5 explicit decision).

## References

- Council 2026-04-28 (System Council, 5 reviewers)
- ADR-0073 — agent-router as orchestrator
- ADR-0161 — Helpdesk ontology
- ADR-0165 — Progressive channel discriminator
- L-0147 — Phase 3 chair self-reversal pattern (this council)
- Spec: `docs/superpowers/specs/2026-04-28-dashboard-help-design.md`
