---
title: "Lovsen Confidence Model — dual HØY/MEDIUM/LAV label + numeric 0..1 score"
id: ADR_0239
status: accepted
accepted_at: 2026-04-29
layer: decision
created: 2026-04-29
updated: 2026-04-29
module: MODULE_AGENT_SDK
tags: [lovsen, confidence, adr, p1-s0]
related_adrs: [ADR-0242, ADR-0245]
---

# ADR-0243: Lovsen Confidence Model

## Context and Problem Statement

Lovsen's persona (see `docs/agents/lovsen-agent/lovsen.md` §Confidence-policy) uses three human-readable confidence labels: HØY, MEDIUM, and LAV. These labels are communicated directly to the user and have defined meanings in the Lovsen persona: HØY = direct legal citation, MEDIUM = interpretation, LAV = grey zone needing a lawyer. However, downstream code (capability layer, UI indicators, telemetry thresholds, escalation logic) needs a comparable numeric value to apply thresholds without parsing the Norwegian label. The tension: persona needs human terms, code needs numbers.

## Decision Drivers

- Persona integrity: the HØY/MEDIUM/LAV terminology is part of Lovsen's identity and must not be changed or hidden from the user
- Downstream gating: capability layer (P1.S4) needs to fire `lovsen.confidence.degraded` when score drops below a threshold; a string label is not comparable
- Staleness detection: a paragraph fetched more than 24h ago degrades confidence; this must be expressible in the type contract
- Missing-data transparency: if the confidence is low because context is incomplete, the user (and audit log) must know which fields are missing

## Considered Options

1. **Label-only** — only HØY/MEDIUM/LAV, downstream code maps labels to hard-coded thresholds
2. **Score-only** — only numeric 0..1, persona formats the label dynamically from the score
3. **Dual representation** (chosen) — both `level: 'HØY'|'MEDIUM'|'LAV'` and `score: number (0..1)` in the same object, with `stale_paragraph` and `missing_data` diagnostic fields

## Decision Outcome

Chosen option: **Dual representation**, because it decouples persona communication from code-level gating without forcing either side to reconstruct the other. The label is authoritative for user-facing display; the score is authoritative for threshold comparisons.

The `Confidence` type is defined in `@smartout/lovsen-contract` (`packages/lovsen-contract/src/confidence.ts`). The numeric score uses `z.number().min(0).max(1)` — `score: 0` is valid (floor) per the journey-telemetry error-path requirement. `score: 1.0` represents maximum certainty.

Score derivation (P1.S3 responsibility, not enforced by this schema): `{ citations.length > 0: +0.3, mcp.cache_hit: +0.1, freshness_within_24h: +0.2, single_rule_match: +0.4 }`. Confidence is computed, never written — stored results are derived at answer-composition time.

## Rules & Consequences

- **Good, because** `lovsen.confidence.degraded` telemetry event fires when `score < threshold` (threshold configurable in P1.S4 capability seed — not locked here)
- **Good, because** the `stale_paragraph: true` flag allows the UI to show a "law text may be outdated" warning without the confidence level drop being misleading
- **Bad, because** the dual representation requires the answer-composition layer to keep label + score in sync — a skill that computes HØY but sets score: 0.1 is semantically wrong (no schema enforcement; document contract requires skill implementor to maintain coherence)
- **Agent Impact:** Downstream sub-sorties MUST import `ConfidenceSchema` from `@smartout/lovsen-contract` and construct a valid `Confidence` object before composing `LovsenAnswer`. LAV confidence + legal-consequence question = `escalation_recommended: true` on the `LovsenAnswer`.

---

> Registered in `docs/decisions/0000-decision-log.md`. Cross-reference: ADR-0242 (Lovsen Citation Contract), ADR-0245 (Lovsen Capability Authority).
