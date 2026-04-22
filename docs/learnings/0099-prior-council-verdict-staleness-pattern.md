---
title: "Prior-council-verdict staleness pattern — cite-and-verify before Phase 3"
id: LEARNING_0099
status: done
layer: learning
created: 2026-04-22
updated: 2026-04-22
tags: [run-council, staleness, verification, briefing, phase-3, process]
---

# Learning-0099: Prior-council-verdict staleness pattern — cite-and-verify before Phase 3

## Context

Council 2026-04-22 (contract-management-redesign) briefing cited the 2026-04-09 "CompositionWizard is a non-functional shell — `resolveComposition` never called" finding as present-tense fact. Agent-coord + supervisor independently code-traced the claim and proved it STALE — the wizard had been wired in the intervening 13 days, and `resolveComposition` was being called on every step transition.

This is the fourth consecutive council where a cited prior verdict older than two weeks was asserted as present-tense ground truth and disproved by a simple code-trace:

| Date | Council | Stale claim | Reality |
|---|---|---|---|
| 2026-04-18 | Gate Migration | "18 sites need migration" | 9 already migrated; 3 sites were different defects |
| 2026-04-20 | Year Wheel | "Planning cycle activation gate missing" | Shipped in intermediate sortie |
| 2026-04-22 | Auth Invitation | "Update-password page does not exist" (only middleware reference) | Page had landed 3 days before briefing |
| 2026-04-22 | Contract Redesign | "CompositionWizard non-functional" | Wired and emitting; the real defect was elsewhere |

## Discovery

A council verdict built on phantom bugs produces phantom fixes. The cost is not limited to wasted effort during the review session — downstream consequences compound:

- Briefings anchor reviewer attention on bugs that no longer exist, starving real defects of review time.
- Trust Gate runs on stale premises; outcomes that PASS on phantom claims are meaningless.
- Handoffs and follow-up plans inherit the phantom claims and propagate them further.
- Reviewers who notice the staleness late in Phase 5 face the choice of discarding their own Phase 3 work or silently shipping incorrect framing.

Root cause: no rule requires re-verification of prior-council claims older than a brief freshness window. Briefings treat "we said X at the last council" as higher-credibility than "here is the current file". The pattern is adversarial to code-trace discipline (L-0096).

## Impact

Rule promoted to `run-council` SKILL.md:

> **Any council that cites a prior verdict older than 14 days MUST have Agent-coord code-trace-verify the cited claim before Phase 3 dispatch.** Briefings MUST flag any citation older than 14 days with `[VERIFICATION PENDING]` and remove the flag only after the code-trace verifies. The Chair enforces — a briefing with unflagged stale citations is blocked at Phase 2 and returned for revision.

Sibling mitigations that should follow:

- Briefing template gains a "Prior-claim freshness check" section — lists every cited prior finding with a cite-date and a verification-state field.
- Agent-coord Phase 3 output includes a "staleness audit" row for each re-verified claim (`confirmed` / `stale` / `partial`).
- Council log captures stale-claim statistics over time; 3rd promotion triggers a CI-style check (e.g. grep briefings for bare cite-dates and require a companion verification note).

Fourth occurrence means the pattern is reliable enough to codify. Do not wait for a fifth.

## References

- ADR-0177 (Journey Runner UI contract) — same council cycle that raised the freshness concern.
- ADR-0181 / ADR-0182 / ADR-0183 — the contract-redesign council's verdict, which was saved from a phantom-bug premise by Agent-coord's code-trace.
- L-0054 — grep-based site inventories inflate scope (sibling pattern; briefings over-count).
- L-0059 — grep-count briefings undercount without code-trace (sibling pattern; briefings under-count).
- L-0096 — code-trace catches schema-fiction that concept-review approves (the general defense this rule reinforces).
- L-0094 — phantom emit contracts recurring (adjacent pattern: spec-asserted fiction).

---

> After writing: register in `docs/learnings/0000-learning-log.md`.
