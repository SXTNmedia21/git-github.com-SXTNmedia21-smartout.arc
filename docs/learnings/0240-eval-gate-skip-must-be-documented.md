---
title: "L-0240 — Eval-gate skip must declare in JOURNEY, not bury in HANDOFF"
id: L-0240
status: accepted
created: 2026-05-13
updated: 2026-05-13
module: governance
tags: [eval-gate, council, journey, handoff, sortie-5b]
related: [L-0181, L-0176]
---

# L-0240: Eval-gate skip must declare in JOURNEY, not bury in HANDOFF

## Trigger

Sortie 5b Phase 1 eval-gate (intent-classifier accuracy on IC1-IC4) ran with `pnpm vitest run packages/ai/src/router/__evals__/intent-classifier.eval.ts`. OPENROUTER_API_KEY absent in agent env. `beforeAll` guard threw, all tests skipped.

Verdict: SKIPPED. Phase 7 (aliasTaskVerbs shim drop) deferred.

The skip was documented in `docs/audits/sortie-5b-intent-classifier-eval-gate.md` (good) and HANDOFF (good) BUT not in JOURNEY frontmatter or top-level summary. Journey describes the happy path; eval-skip is the non-happy path.

A future contributor reading JOURNEY-hard-delete-operations-complete sees "shim dropped per eval-gate green" — but eval-gate was skipped, shim stays. Journey lies to future-self.

## Pattern

When a sortie has conditional phases gated on external state (API key, infra readiness, prior PR merged), the SKIP outcome must surface in JOURNEY just as the PASS outcome would. Otherwise journey reads correct-by-omission — describes only what happened, not what was meant to happen.

## Rule

Journey for any sortie with conditional phase MUST include:

1. Header section "Conditional phases" listing each gate + its outcome (PASS / FAIL / SKIPPED).
2. If SKIPPED: explicit reason + what would unblock it.
3. The conditional phase's user-impact described from BOTH branches (e.g. "Shim active → personal-route gets auto-rewritten to task. After shim drop → relies on classifier accuracy.").

## Mitigation

Update plan template (per supervisor council recommendation `plan-template-bake-gates`) to pre-bake a "Conditional phases" section in journey stub. close-feature.sh gate verifies the section is present + completed.

## Sibling references

- L-0181 reservation in council 2026-05-13 (became this learning)
- L-0176 (docstring drift — same class: artifact describes ideal not reality)
