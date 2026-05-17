---
id: L-0300
title: "ADR-to-enforcement-code receipt rule — toothless ADR same class as docstring drift"
status: accepted
date: 2026-05-17
related-adrs: [ADR-0349, ADR-0358]
tags: [adr, enforcement, toothless, anti-pattern, eslint, ci, run-council]
---

# L-0300 — ADR-to-Enforcement-Code Receipt Rule

## Context

ADR-0349 (Nordic Split OKLCH literal ban) was accepted with an explicit promise: "Enforcement: new ESLint rule `nordic-split/no-oklch-literal` in `packages/eslint-config/`."

The ui-shell shippability R1 council (2026-05-17 PM3) verified this claim via grep:

```bash
grep -r 'no-oklch-literal' packages/eslint-config/
# 0 results
```

The enforcement rule was never implemented. ADR-0349 was marked `status: proposed` (pending acceptance), but the council had treated it as an accepted constraint. Either way, the claim "enforcement rule in `packages/eslint-config/`" has 0 code backing it.

This is a structurally distinct failure mode from L-0176 (docstring claims ADR compliance but body doesn't implement it). Here, the ADR itself contains the ungrounded claim — the ADR body promises an implementation artifact that doesn't exist.

Same class: toothless prohibition. The OKLCH literal ban in app code has zero enforcement teeth. Developers can and will write `oklch(...)` literals anywhere because nothing stops them at commit time.

## Pattern

ADR text can contain three categories of implementation claims:
1. **Documentation-only** — "the convention is X" — no enforcement code needed; the ADR is the enforcement.
2. **Process-based** — "developers MUST do X per this ADR" — enforced by code review, not code.
3. **Code-based** — "ESLint rule Y will catch violations," "CI gate Z will block deploys," "migration check W will prevent drift" — these require a verifiable implementation artifact.

Category 3 claims are unverifiable until the artifact exists. An ADR with a category-3 claim and no implementation artifact is a **toothless ADR** — it sounds like enforcement but provides none.

Toothless ADRs are worse than documentation-only ADRs because they create false confidence: reviewers see "ESLint rule enforces this" and stop manually checking. The enforcement never fires.

## Why

ADRs are written at decision time (pre-implementation) or shortly after implementation. When the decision includes a planned enforcement mechanism, the ADR accurately describes the intent. But:

1. The enforcement implementation may be deferred to a follow-up sortie that never lands.
2. The ADR may be accepted before the enforcement code ships.
3. Reviewers in subsequent councils read the ADR body and assume the enforcement exists.

This is the exact same drift mechanism as L-0176 (docstring written pre-implementation, body drifts). The only difference is the locus — ADR body vs function docstring.

## How to Apply

**Hard rule for ADR acceptance:** An ADR cannot be marked `status: accepted` until enforcement-code receipt is verified for every category-3 claim. Verification = grep for the rule/script/gate in the implementation surface.

**Implementation surfaces by enforcement type:**
- ESLint rule: `packages/eslint-config/` — grep for rule name
- Lint/check script: `infra/scripts/` or `scripts/` — grep for script file
- CI gate: `.github/workflows/` — grep for job/step name
- Migration check: `scripts/` or pre-commit — grep for check script
- Pre-commit hook: `.husky/` — grep for the check

**Verification command pattern:**

```bash
# For an ADR claiming "ESLint rule nordic-split/no-oklch-literal":
grep -r 'no-oklch-literal' packages/eslint-config/
# Must return ≥1 hit. 0 hits = toothless ADR.

# For an ADR claiming "check-telemetry-emit-coverage.ts CI gate" (ADR-0358):
ls scripts/check-telemetry-emit-coverage.ts
# Must exist. Missing = toothless.
```

**During council Phase 3:** when ADR text includes any of "ESLint rule", "CI gate", "lint script", "migration check", "pre-commit hook" — reviewer MUST grep for that artifact. "ADR promises enforcement" is not evidence of enforcement. The artifact must exist.

**During ADR status flip (proposed → accepted):** the flip commit MUST include one of:
- A grep result confirming the enforcement artifact exists, OR
- A note that the enforcement is deferred (with a Linear ticket or follow-up sortie reference), in which case the ADR note must read "enforcement pending — effectively documentation-only until [ticket] lands."

## Related

- L-0176 (docstring drift — same class, different locus)
- ADR-0349 (Nordic Split OKLCH literal ban — the triggering case; enforcement not wired)
- ADR-0358 (telemetry registry requires emit wiring — correct pattern: enforcement script described alongside the decision)
- L-0299 (4 chair self-reversals same council — reversal 4 was this pattern)

## Action

Added to `run-council/SKILL.md` Phase 3 Hard Rules as "Steward Phase 3 ADR-to-enforcement-code receipt check." When ADR text claims enforcement infrastructure, chair MUST grep for that infrastructure before verdict. Absent = toothless ADR, flag as ADR-status-drift in Phase 5 synthesis.
