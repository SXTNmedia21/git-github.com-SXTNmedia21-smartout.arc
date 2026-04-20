---
title: "ADR-0102: evidence_tier Enum for Protocol Proof Requirements"
id: ADR-0102
status: accepted
layer: decision
created: 2026-04-15
updated: 2026-04-15
---

# ADR-0102: evidence_tier Enum for Protocol Proof Requirements

**Status:** Accepted
**Date:** 2026-04-15

## Context and Problem Statement

The initial Governance/Training design carried a `protocol.risk_level` field. This collided with `rule_severity` (ADR-0094) and `deviation_severity` — three severity-shaped fields across the cascade, violating the mandate that orthogonal concerns get orthogonal columns. What "protocol risk" actually controlled was *evidence required for sign-off*, not a generic severity.

## Decision Drivers

- Cascade mandate: do not reuse the same vocabulary across unrelated concerns.
- The field's real job is to drive what proof is demanded (quiz, observer, confirmation, four-eyes).
- K1a must set an industry default; K1b must be able to strengthen (not silently weaken).

## Considered Options

- **A.** Keep `protocol.risk_level` and let each consumer interpret it.
- **B.** Replace with an `evidence_tier` ENUM named for what it controls.
- **C.** Model evidence requirements as separate booleans per proof type.

## Decision Outcome

Chosen option: **B**.

- Create ENUM `evidence_tier` with values: `quiz`, `quiz_plus_observer`, `quiz_plus_observer_plus_confirmation`, `four_eyes`.
- Add `protocol.evidence_tier evidence_tier NOT NULL DEFAULT 'quiz'`.
- Name reflects what the field controls (evidence demanded), not severity.

## Rules & Consequences enforced for Agents

- **Good, because** orthogonal to `rule_severity` and `deviation_severity` — no semantic collision.
- **Good, because** K1a/K1b can reason about a single named ladder rather than free-form numerics.
- **Bad, because** enum evolution requires migration when new tiers appear.
- **Agent Impact:** K1a sets default `evidence_tier` per industry. K1b MAY strengthen the tier; weakening requires four-eyes (see ADR-0101). Never reintroduce `risk_level` on `protocol`. `evidence_tier` is orthogonal to rule/deviation severity — do not conflate.
